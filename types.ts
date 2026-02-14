export enum DocumentMode {
  TRANSLATE = 'TRANSLATE',
  ANALYZE = 'ANALYZE',
  SUMMARIZE = 'SUMMARIZE'
}

export enum ModelProvider {
  GEMINI_FLASH = 'gemini-3-flash-preview',
  GEMINI_PRO = 'gemini-3-pro-preview'
}

export interface AnalysisResult {
  summary?: string;
  risks?: string[];
  clauses?: {
    original: string;
    explanation: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  }[];
}

export interface AgentResult {
  agentName: string;
  model: string;
  extractedText: string;
  translation: string;
  confidence: number;
  notes: string;
}

export interface CouncilVerdict {
  finalTranslation: string;
  agentResults: AgentResult[];
  judgeReasoning: string;
  confidenceScore: number;
}

export interface SessionData {
  mode: DocumentMode;
  isScannedMode: boolean;
  sourceText: string;
  sourceImages: string[]; // Base64 strings
  translatedText: string;
  councilVerdict: CouncilVerdict | null;
  analysisResult: AnalysisResult | null;
  timestamp: number;
  targetLanguage: string;
  sourceLanguage: string;
}

export interface PdfPageImage {
  pageNumber: number;
  dataUrl: string;
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}
