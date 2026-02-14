import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from '../types';
import { MODEL_EXPERT, MODEL_PERFORMANCE, THINKING_BUDGET_EXPERT } from '../constants';

// Helper to get client
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const RETRY_DELAY_MS = 2000;

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

export const summarizeLegalText = async (text: string): Promise<string> => {
  const client = getClient();
  const prompt = `You are a legal expert. Generate a concise 'Headnote' style executive summary (under 250 words) of the following legal document. Focus specifically on Parties, Term, Termination Rights, and Key Obligations.\n\nDocument:\n${text}`;

  try {
    const response = await withRetry(() => client.models.generateContent({
      model: MODEL_PERFORMANCE,
      contents: prompt,
    }));
    return response.text || "Could not generate summary.";
  } catch (error) {
    console.error("Summarization error:", error);
    return "Error generating summary.";
  }
};

export const analyzeLegalRisks = async (text: string): Promise<AnalysisResult> => {
  const client = getClient();

  const schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "A brief 'Headnote' style summary of the document." },
      risks: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of high-level potential risks based on standard legal playbooks (e.g., Uncapped Liability, Unilateral Termination)."
      },
      clauses: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            original: { type: Type.STRING, description: "The exact clause text." },
            explanation: { type: Type.STRING, description: "Simple 'Plain English' explanation." },
            riskLevel: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] }
          }
        }
      }
    }
  };

  const prompt = `Analyze this legal document acting as a senior legal consultant.
  1. Executive Summary: Provide a 'Headnote' style summary (Parties, Term, Termination).
  2. Risk Analysis: Identify high-risk clauses based on standard legal playbooks (e.g., Uncapped Liability, Unilateral Termination, vague Indemnity, Dispute Resolution issues).
  3. Clause Breakdown: Extract key clauses, grade their risk (HIGH/MEDIUM/LOW), and provide a 'Plain English' explanation for a layperson. \n\nDocument:\n${text}`;

  try {
    const response = await withRetry(() => client.models.generateContent({
      model: MODEL_EXPERT,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        thinkingConfig: { thinkingBudget: THINKING_BUDGET_EXPERT }
      }
    }));

    const jsonText = response.text || "{}";
    return JSON.parse(jsonText) as AnalysisResult;
  } catch (error) {
    console.error("Analysis error:", error);
    throw new Error("Failed to analyze document.");
  }
};

// Fallback plain text translator
export const simpleTranslate = async (text: string, targetLang: string, sourceLang: string = 'auto'): Promise<string> => {
  const client = getClient();
  let prompt = `Translate the following legal text into ${targetLang}. Maintain strict legal formatting, terminology, and structural integrity.\n\nText:\n${text}`;

  if (sourceLang && sourceLang !== 'auto') {
    prompt = `Translate the following legal text from ${sourceLang} into ${targetLang}. Maintain strict legal formatting, terminology, and structural integrity.\n\nText:\n${text}`;
  }

  const response = await withRetry(() => client.models.generateContent({
    model: MODEL_PERFORMANCE,
    contents: prompt
  }));
  return response.text || "";
}
