import { GoogleGenAI, Type } from "@google/genai";
import { AgentResult, CouncilVerdict } from '../types';
import { MODEL_EXPERT, MODEL_PERFORMANCE, THINKING_BUDGET_EXPERT } from '../constants';
import * as storageService from './storageService';
import * as pdfService from './pdfService';

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Process ONE page at a time to guarantee zero pages are skipped
const BATCH_SIZE = 1;
const RETRY_DELAY_MS = 2000;
const BATCH_COOLDOWN_MS = 500;

// --- UTILS ---

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = RETRY_DELAY_MS): Promise<T> => {
    try {
        return await fn();
    } catch (error: any) {
        const isRetryable = error?.status === 503 || error?.status === 429 || error?.message?.includes('fetch failed');
        if (retries === 0 || !isRetryable) throw error;

        console.warn(`API call failed. Retrying in ${delay}ms... (${retries} attempts left)`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 2);
    }
};

const cleanBase64 = (b64: string) => b64.split(',')[1] || b64;

// --- AGENT FLASH (OCR + Fast Translation + Complexity Triage) ---
const runAgentFlash = async (images: string[], targetLang: string, pageLabel: string): Promise<AgentResult & { isComplex: boolean }> => {
    const client = getClient();
    const prompt = `You are AGENT FLASH — a fast, efficient OCR and translation specialist.

CRITICAL INSTRUCTIONS:
- Extract ALL text from this page image. Do NOT skip any content.
- If the text is ROTATED or UPSIDE DOWN, mentally correct the orientation before reading.
- If the page contains HANDWRITTEN text or annotations, extract them with best-effort OCR. Prefix handwritten sections with [Handwritten].
- If the page contains MULTIPLE LANGUAGES, identify and translate ALL of them into ${targetLang}.
- If there are STAMPS, SEALS, or WATERMARKS with text, include them in the extraction.
- If text is partially obscured or blurry, infer from context and mark as [Uncertain: ...].

This is ${pageLabel}.

Task:
1. Extract ALL text from the page image — printed, handwritten, stamps, everything.
2. Provide a complete translation to ${targetLang}. Do NOT summarize — translate EVERY line.
3. Complexity Triage: Set "isComplex": true if the page has dense legal jargon, high-ambiguity clauses, or mixed handwritten+printed content requiring expert review. Set false for standard text.

Output strictly in JSON.`;

    const imageParts = images.map(img => ({
        inlineData: { mimeType: 'image/jpeg', data: cleanBase64(img) }
    }));

    const callApi = async () => {
        const response = await client.models.generateContent({
            model: MODEL_PERFORMANCE,
            contents: {
                parts: [...imageParts, { text: prompt }]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        extractedText: { type: Type.STRING },
                        translation: { type: Type.STRING },
                        notes: { type: Type.STRING },
                        isComplex: { type: Type.BOOLEAN }
                    }
                }
            }
        });
        return response;
    };

    const response = await withRetry(callApi);
    const result = JSON.parse(response.text || "{}");

    return {
        agentName: "Agent Flash",
        model: MODEL_PERFORMANCE,
        confidence: 85,
        extractedText: result.extractedText || "",
        translation: result.translation || "",
        notes: result.notes || "Initial OCR and translation complete.",
        isComplex: !!result.isComplex
    };
};

// --- AGENT PRO (Deep Reasoning + Legal Precision) ---
const runAgentPro = async (images: string[], targetLang: string, pageLabel: string): Promise<AgentResult> => {
    const client = getClient();
    const prompt = `You are AGENT PRO — an expert-level legal translation specialist with deep reasoning capabilities.

CRITICAL INSTRUCTIONS:
- You MUST extract and translate EVERY piece of text on this page — no exceptions.
- Correct for ROTATION — if the page or any section is upside-down or sideways, mentally orient it before reading.
- HANDWRITTEN annotations: Read carefully, cross-reference with printed text nearby for context. Mark handwritten content with [Handwritten].
- MIXED LANGUAGES: If multiple languages appear (e.g., English headers with Hindi body, bilingual contracts), translate ALL content into ${targetLang}.
- STAMPS/SEALS: Describe and translate any text within official stamps, seals, or watermarks.
- OBSCURED TEXT: If text is partially hidden or blurry, infer from legal context and flag as [Inferred: ...].
- Maintain 'legal fiction' distinctions (e.g., 'shall' vs 'may', 'indemnify' vs 'hold harmless').

This is ${pageLabel}.

Task:
1. OCR the page with extreme attention to legal scripts, diacritics, faint stamps, and margin notes.
2. Translate to ${targetLang} by transplanting legal meaning, not just words. Translate EVERY line — do NOT summarize.
3. Note any ambiguities, translation risks, or uncertain readings.

Output strictly in JSON.`;

    const imageParts = images.map(img => ({
        inlineData: { mimeType: 'image/jpeg', data: cleanBase64(img) }
    }));

    const callApi = async () => {
        const response = await client.models.generateContent({
            model: MODEL_EXPERT,
            contents: {
                parts: [...imageParts, { text: prompt }]
            },
            config: {
                thinkingConfig: { thinkingBudget: THINKING_BUDGET_EXPERT },
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        extractedText: { type: Type.STRING },
                        translation: { type: Type.STRING },
                        notes: { type: Type.STRING }
                    }
                }
            }
        });
        return response;
    };

    const response = await withRetry(callApi);
    const result = JSON.parse(response.text || "{}");

    return {
        agentName: "Agent Pro",
        model: MODEL_EXPERT,
        confidence: 95,
        extractedText: result.extractedText || "",
        translation: result.translation || "",
        notes: result.notes || ""
    };
};

// --- THE JUDGE (Synthesis) ---
const runTheJudge = async (images: string[], flashResult: AgentResult, proResult: AgentResult, targetLang: string, pageLabel: string): Promise<CouncilVerdict> => {
    const client = getClient();

    const imageParts = images.map(img => ({
        inlineData: { mimeType: 'image/jpeg', data: cleanBase64(img) }
    }));

    const prompt = `You are THE JUDGE. You have received TWO independent analyses of ${pageLabel}.
  
  --- REPORT: AGENT FLASH (Paralegal) ---
  Extracted Text: "${flashResult.extractedText}"
  Translation: "${flashResult.translation}"
  
  --- REPORT: AGENT PRO (Legal Scholar) ---
  Extracted Text: "${proResult.extractedText}"
  Translation: "${proResult.translation}"
  Notes: "${proResult.notes}"

  Your Task:
  1. Compare both reports against the visual content of the page image.
  2. Resolve discrepancies (e.g., if Flash missed handwritten text but Pro caught it).
  3. Ensure EVERY line on the page is accounted for in the final translation.
  4. Produce the final, most accurate and COMPLETE legal translation in ${targetLang}.
  5. Provide reasoning for your choices.
  6. Assign a confidence score (0-100).
  
  CRITICAL: The final translation must cover ALL text on the page. Do NOT skip or summarize.`;

    const callApi = async () => {
        const response = await client.models.generateContent({
            model: MODEL_EXPERT,
            contents: {
                parts: [...imageParts, { text: prompt }]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        finalTranslation: { type: Type.STRING },
                        judgeReasoning: { type: Type.STRING },
                        confidenceScore: { type: Type.NUMBER }
                    }
                }
            }
        });
        return response;
    };

    const response = await withRetry(callApi);
    const result = JSON.parse(response.text || "{}");

    return {
        finalTranslation: result.finalTranslation || "",
        judgeReasoning: result.judgeReasoning || "",
        confidenceScore: result.confidenceScore || 90,
        agentResults: [flashResult, proResult]
    };
};

// --- ORCHESTRATOR ---
export const runModelCouncil = async (
    allImages: string[],
    targetLang: string,
    onStatusUpdate: (msg: string) => void
): Promise<CouncilVerdict> => {

    const totalPages = allImages.length;
    const verdicts: CouncilVerdict[] = [];

    let i = 0;
    while (i < allImages.length) {
        const batchImages = allImages.slice(i, i + BATCH_SIZE);
        const pageNumber = i + 1;
        const pageLabel = `Page ${pageNumber} of ${totalPages}`;

        // --- SEMANTIC CACHE LOOKUP ---
        const pageHash = await pdfService.computeImageHash(batchImages[0]);
        const cacheKey = `${pageHash}_${targetLang}`;
        const cachedVerdict = await storageService.getCachedResult(cacheKey);

        if (cachedVerdict) {
            onStatusUpdate(`⚡ ${pageLabel} — Served from cache (instant)`);
            verdicts.push(cachedVerdict);
            i += batchImages.length;
            continue;
        }

        // --- HYBRID PRO-FLASH HANDOFF ---
        onStatusUpdate(`📄 ${pageLabel} — Agent Flash scanning...`);
        const flash = await runAgentFlash(batchImages, targetLang, pageLabel);

        let verdict: CouncilVerdict;

        if (flash.isComplex) {
            onStatusUpdate(`🧠 ${pageLabel} — Complex content detected. Agent Pro analyzing...`);
            const pro = await runAgentPro(batchImages, targetLang, pageLabel);

            onStatusUpdate(`⚖️ ${pageLabel} — Judicial review...`);
            verdict = await runTheJudge(batchImages, flash, pro, targetLang, pageLabel);
        } else {
            onStatusUpdate(`✅ ${pageLabel} — Translation complete`);
            verdict = {
                finalTranslation: flash.translation,
                judgeReasoning: "Flash translation approved for standard content.",
                confidenceScore: 90,
                agentResults: [flash, flash]
            };
        }

        // --- SAVE TO CACHE ---
        await storageService.saveCachedResult(cacheKey, verdict);

        verdicts.push(verdict);
        i += batchImages.length;

        // Brief cooldown between pages
        if (i < allImages.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_COOLDOWN_MS));
        }
    }

    // --- AGGREGATION ---
    onStatusUpdate(`📋 Assembling ${totalPages}-page translation...`);

    const finalVerdict: CouncilVerdict = {
        finalTranslation: verdicts.map((v, idx) =>
            `--- Page ${idx + 1} of ${totalPages} ---\n${v.finalTranslation}`
        ).join('\n\n'),
        judgeReasoning: verdicts.map((v, idx) =>
            `[Page ${idx + 1}]: ${v.judgeReasoning}`
        ).join('\n\n'),
        confidenceScore: Math.round(
            verdicts.reduce((acc, v) => acc + v.confidenceScore, 0) / verdicts.length
        ),
        agentResults: verdicts[0]?.agentResults || []
    };

    onStatusUpdate("✅ All pages translated. Council adjourned.");
    return finalVerdict;
};
