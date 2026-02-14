import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Document as DocxDocument, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import saveAs from 'file-saver';
import { Scale, FileText, Upload, Download, Languages, Gavel, ScanLine, Shield, Activity, Eraser, Check, Settings, Copy, Eye, MoveRight, ArrowRightLeft } from 'lucide-react';

import { DocumentMode, SessionData, AnalysisResult, CouncilVerdict, PdfPageImage } from './types';
import * as storageService from './services/storageService';
import { DEFAULT_SESSION } from './services/storageService';
import * as pdfService from './services/pdfService';
import * as geminiService from './services/geminiService';
import * as modelCouncilService from './services/modelCouncilService';
import { SUPPORTED_LANGUAGES, AUTO_DETECT } from './constants';

import DocumentViewer from './components/DocumentViewer';
import AnalysisPanel from './components/AnalysisPanel';
import LanguageSelector from './components/LanguageSelector';

const App: React.FC = () => {
  // State
  // Initialize with Default, then load async
  const [session, setSession] = useState<SessionData>(DEFAULT_SESSION);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived State for Layout
  const hasResults = !!(session.translatedText || session.analysisResult || session.councilVerdict);
  const showRightPanel = session.mode === DocumentMode.TRANSLATE || hasResults || isProcessing;

  // Initial Load from IndexedDB
  useEffect(() => {
    const initSession = async () => {
      const loaded = await storageService.loadSession();
      setSession(loaded);
      setIsStorageLoaded(true);
    };
    initSession();
  }, []);

  // Auto-save effect (Debounced, only after load)
  useEffect(() => {
    if (!isStorageLoaded) return;
    const timer = setTimeout(() => {
      storageService.saveSession(session);
    }, 2000);
    return () => clearTimeout(timer);
  }, [session, isStorageLoaded]);

  const handleModeChange = (mode: DocumentMode) => {
    setSession(prev => ({ ...prev, mode }));
  };

  const handleTextChange = (text: string) => {
    setSession(prev => ({ ...prev, sourceText: text }));
  };

  const handleSourceLanguageChange = (lang: string) => {
    setSession(prev => ({ ...prev, sourceLanguage: lang }));
  };

  const handleTargetLanguageChange = (lang: string) => {
    setSession(prev => ({ ...prev, targetLanguage: lang }));
  };

  const handleSwapLanguages = () => {
    setSession(prev => {
      const currentSource = prev.sourceLanguage;
      const currentTarget = prev.targetLanguage;

      // Cannot swap if source is auto
      if (currentSource === 'auto') {
        return prev;
      }

      return {
        ...prev,
        sourceLanguage: currentTarget,
        targetLanguage: currentSource,
      };
    });
  };

  // Drag and Drop Handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const processFile = async (file: File) => {
    // 1. Validation: Client-side size limit (25MB soft limit)
    const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_SIZE_BYTES) {
      alert("File too large. Please upload a document smaller than 25MB to ensure browser stability.");
      return;
    }

    setIsProcessing(true);
    setStatusMessage("Analyzing document structure...");

    try {
      if (file.type === 'application/pdf') {
        // Always rasterize PDF pages for visual preview
        setStatusMessage("Rasterizing pages for preview...");
        const images = await pdfService.convertPdfToImages(file);
        const imageStrings = images.slice(0, 50).map(img => img.dataUrl);

        if (images.length > 50) {
          alert("Note: Only the first 50 pages will be processed to ensure browser stability.");
        }

        // Also attempt text extraction
        const text = await pdfService.extractTextFromPdf(file);
        const strippedText = text.replace(/\s/g, '');

        // Improved Heuristic: check text quality, not just length
        // A valid text PDF will have mostly printable ASCII / Unicode letters.
        // Garbled OCR output has high ratio of control chars and symbols.
        const printableChars = (text.match(/[a-zA-Z0-9.,;:!?'"()\-\s]/g) || []).length;
        const totalChars = text.length || 1;
        const qualityRatio = printableChars / totalChars;

        // If text is very short, or the quality is low, treat as scanned
        const isLikelyScanned = strippedText.length < 100 || qualityRatio < 0.6;

        if (isLikelyScanned) {
          setStatusMessage("Scanned document detected. Using Visual Processing...");
          setSession(prev => ({
            ...prev,
            sourceText: '',
            sourceImages: imageStrings,
            isScannedMode: true
          }));
        } else {
          // Good text quality, but still store images for preview
          setSession(prev => ({
            ...prev,
            sourceText: text,
            sourceImages: imageStrings,
            isScannedMode: false
          }));
        }
      } else {
        // Plain text file
        const text = await file.text();
        setSession(prev => ({
          ...prev,
          sourceText: text,
          sourceImages: [],
          isScannedMode: false
        }));
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("Error reading file.");
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input value so re-selecting the same file triggers onChange again
    e.target.value = '';
    await processFile(file);
  };

  const handleProcess = async () => {
    if (!session.sourceText && session.sourceImages.length === 0) {
      alert("Please upload a document or enter text.");
      return;
    }

    setIsProcessing(true);

    try {
      if (session.mode === DocumentMode.TRANSLATE) {
        if (session.sourceImages.length > 0) {
          // --- MODEL COUNCIL (Visual) — Always use for PDFs for full page coverage ---
          const verdict = await modelCouncilService.runModelCouncil(
            session.sourceImages,
            session.targetLanguage,
            setStatusMessage
          );
          setSession(prev => ({
            ...prev,
            councilVerdict: verdict,
            translatedText: verdict.finalTranslation
          }));
        } else {
          // --- STANDARD TRANSLATION (Text) ---
          setStatusMessage(`Translating to ${session.targetLanguage}...`);
          const result = await geminiService.simpleTranslate(
            session.sourceText,
            session.targetLanguage,
            session.sourceLanguage
          );
          setSession(prev => ({ ...prev, translatedText: result }));
        }
      }
      else if (session.mode === DocumentMode.ANALYZE) {
        setStatusMessage("Scanning document for legal risks...");
        const textToAnalyze = session.isScannedMode && session.councilVerdict
          ? session.councilVerdict.agentResults[0].extractedText
          : session.sourceText;

        if (!textToAnalyze) {
          // If we don't have text yet for analysis (e.g. fresh scan), we might need to OCR first.
          // For simplicity in this demo, we assume Text Mode or previously processed scan.
          if (session.isScannedMode && !session.councilVerdict) {
            // Auto-trigger OCR via Flash first? 
            // For now, let's warn.
            alert("Please translate first to extract text from this scanned document.");
            setIsProcessing(false);
            return;
          }
        }

        const result = await geminiService.analyzeLegalRisks(textToAnalyze || session.sourceText);
        setSession(prev => ({ ...prev, analysisResult: result }));
      }
      else if (session.mode === DocumentMode.SUMMARIZE) {
        setStatusMessage("Distilling key obligations...");
        const textToSum = session.isScannedMode && session.councilVerdict
          ? session.councilVerdict.agentResults[0].extractedText
          : session.sourceText;

        if (session.isScannedMode && !textToSum) {
          alert("Please translate first to extract text from this scanned document.");
          setIsProcessing(false);
          return;
        }

        const summary = await geminiService.summarizeLegalText(textToSum || session.sourceText);
        setSession(prev => ({ ...prev, translatedText: summary }));
      }
    } catch (e) {
      console.error(e);
      setStatusMessage("An error occurred processing the request.");
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
    }
  };

  const handleExport = async () => {
    const textContent = session.translatedText || "No content";

    const doc = new DocxDocument({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "JustEase Translated Document",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }), // Spacer
          ...textContent.split('\n').map(line => new Paragraph({
            children: [new TextRun({ text: line, font: "Times New Roman", size: 24 })], // 12pt
            alignment: AlignmentType.BOTH
          }))
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "JustEase_Translation.docx");
  };

  const handleCopyToClipboard = () => {
    if (session.translatedText) {
      navigator.clipboard.writeText(session.translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = async () => {
    if (confirm("Reset current session? This will clear all data.")) {
      const newSession = await storageService.clearSession();
      setSession(newSession);
    }
  };

  const viewerImages: PdfPageImage[] = session.sourceImages.map((dataUrl, idx) => ({
    pageNumber: idx + 1,
    dataUrl
  }));

  return (
    <div className="flex flex-col h-screen bg-legal-50 text-legal-900 font-sans">

      {/* 1. HEADER */}
      <header className="bg-white border-b border-legal-200 shadow-sm z-20">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">

          {/* Brand & New Project */}
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-3">
              <div className="bg-legal-700 p-1.5 rounded-lg text-white shadow-soft">
                <Scale size={24} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-serif font-bold text-legal-900 leading-none">JustEase</h1>
                <span className="text-[10px] uppercase tracking-wider font-bold text-legal-400 mt-0.5">Advanced Legal Intelligence</span>
              </div>
            </div>

            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-legal-600 bg-white border border-legal-200 rounded-lg hover:bg-legal-50 hover:text-legal-900 transition-colors shadow-sm"
            >
              <Eraser size={14} />
              New Project
            </button>
          </div>

          {/* Actions & Mode Switcher */}
          <div className="flex items-center gap-4">
            {/* Mode Switcher (Pill) */}
            <div className="flex bg-legal-100 p-1 rounded-lg">
              {[DocumentMode.TRANSLATE, DocumentMode.ANALYZE, DocumentMode.SUMMARIZE].map(mode => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${session.mode === mode
                    ? 'bg-white text-legal-700 shadow-sm'
                    : 'text-legal-500 hover:text-legal-700'
                    }`}
                >
                  {mode === DocumentMode.SUMMARIZE ? 'Quick Summary' : mode}
                </button>
              ))}
            </div>

            <button className="text-legal-400 hover:text-legal-700 transition-colors p-2 hover:bg-legal-50 rounded-lg">
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 overflow-hidden flex gap-0">

        {/* LEFT PANE: SOURCE */}
        <div
          className={`flex flex-col border-r border-legal-200 bg-white relative transition-all duration-500 ease-in-out ${showRightPanel ? 'flex-1 w-1/2' : 'flex-1 w-full'} ${dragActive ? 'bg-legal-50 ring-2 ring-inset ring-legal-300' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {/* Pane Header */}
          <div className="h-14 border-b border-legal-100 flex items-center justify-between px-4 bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-legal-400 uppercase tracking-wide">SOURCE</span>

              {/* SOURCE SELECTOR */}
              {session.mode === DocumentMode.TRANSLATE ? (
                <LanguageSelector
                  selectedCode={session.sourceLanguage}
                  onChange={handleSourceLanguageChange}
                  includeAuto={true}
                />
              ) : (
                <span className="font-bold text-sm text-legal-700">Original Document</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Scanned Mode Badge - only show when scanned document is loaded */}
              {session.isScannedMode && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-50 border border-orange-200 text-orange-700 rounded text-[10px] font-bold uppercase">
                  <ScanLine size={10} />
                  SCANNED MODE
                </div>
              )}

              {session.isScannedMode && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-100/50 border border-orange-200 text-orange-800 rounded text-[10px] font-bold uppercase">
                  VISUAL MODE
                </div>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-legal-600 bg-white border border-legal-300 hover:bg-legal-50 px-2.5 py-1.5 rounded-md shadow-sm transition-all flex items-center gap-1.5"
              >
                <Upload size={12} /> Upload
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative">
            <DocumentViewer
              text={session.sourceText}
              images={viewerImages}
              isScanned={session.isScannedMode}
              onTextChange={handleTextChange}
              onUploadClick={() => fileInputRef.current?.click()}
            />

            {/* Drag Overlay */}
            {dragActive && (
              <div className="absolute inset-0 bg-legal-700/5 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
                <div className="bg-white p-6 rounded-xl shadow-xl border-2 border-legal-300 flex flex-col items-center animate-bounce">
                  <Upload size={48} className="text-legal-700 mb-2" />
                  <p className="font-bold text-legal-800">Drop legal document here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER ACTION (Floating) */}
        <div className={`w-16 flex flex-col items-center justify-center bg-legal-50 z-10 relative transition-all duration-300 ${showRightPanel ? 'border-r border-legal-200' : 'border-l border-legal-200 shadow-xl'}`}>
          <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-6 items-center w-full">

            {/* SWAP BUTTON (Only show here if split view, otherwise it's in header) */}
            {showRightPanel && session.mode === DocumentMode.TRANSLATE && (
              <button
                onClick={handleSwapLanguages}
                disabled={session.sourceLanguage === 'auto'}
                className={`w-10 h-10 rounded-full border border-legal-200 flex items-center justify-center text-legal-500 shadow-sm transition-all
                        ${session.sourceLanguage === 'auto' ? 'opacity-30 cursor-not-allowed' : 'bg-white hover:border-legal-400 hover:text-legal-700 active:rotate-180'}
                    `}
                title="Swap Source & Target"
              >
                <ArrowRightLeft size={16} />
              </button>
            )}

            <button
              onClick={handleProcess}
              disabled={isProcessing}
              className={`
                        w-12 h-12 rounded-full flex items-center justify-center text-white shadow-soft transition-all duration-300
                        ${isProcessing
                  ? 'bg-legal-400 cursor-not-allowed'
                  : 'bg-legal-700 hover:bg-legal-900 hover:scale-110 active:scale-95 shadow-lg shadow-legal-700/30'}
                    `}
              title="Process Document"
            >
              {isProcessing ? (
                <Activity className="animate-spin" size={24} />
              ) : (
                <MoveRight size={24} />
              )}
            </button>
          </div>
        </div>

        {/* RIGHT PANE: RESULT */}
        {
          showRightPanel && (
            <div className="flex-1 flex flex-col bg-legal-50/30 relative animate-in slide-in-from-right duration-500">

              {/* Smart Toolbar */}
              <div className="h-14 border-b border-legal-200 flex items-center justify-between px-4 bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-legal-400 uppercase tracking-wide">
                    {session.mode === DocumentMode.ANALYZE ? 'Output' : 'TARGET'}
                  </span>

                  {/* TARGET LANGUAGE SELECTOR */}
                  {session.mode === DocumentMode.TRANSLATE && (
                    <LanguageSelector
                      selectedCode={session.targetLanguage}
                      onChange={handleTargetLanguageChange}
                    />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Visual Reasoning AI Badge */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-50 border border-orange-200 text-orange-700 rounded text-[10px] font-bold">
                    <Activity size={10} />
                    Visual Reasoning AI
                  </div>

                  {/* Explicit Translate Button */}
                  <button
                    onClick={handleProcess}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-legal-800 text-white text-xs font-bold rounded-md hover:bg-legal-900 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isProcessing ? <Activity className="animate-spin" size={12} /> : <Gavel size={12} />}
                    Translate
                  </button>
                </div>
              </div>

              {/* Output Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar relative">

                {/* Premium Loading State */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-legal-50/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-8 text-center">

                    {/* Animated Glow Ring */}
                    <div className="mb-8 relative">
                      <div className="w-24 h-24 rounded-full border-[3px] border-legal-100 absolute top-0 left-0" />
                      <div className="w-24 h-24 rounded-full border-[3px] border-transparent border-t-legal-700 border-r-legal-400 animate-spin absolute top-0 left-0" style={{ animationDuration: '1.5s' }} />
                      <div className="w-24 h-24 rounded-full flex items-center justify-center">
                        <div className="w-16 h-16 bg-legal-700/5 rounded-full flex items-center justify-center backdrop-blur-sm">
                          <Scale size={28} className="text-legal-700 animate-pulse" />
                        </div>
                      </div>
                      {/* Orbiting dot */}
                      <div className="absolute w-3 h-3 bg-orange-500 rounded-full top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-orange-300" style={{ animation: 'spin 1.5s linear infinite', transformOrigin: '50% calc(50% + 48px)' }} />
                    </div>

                    {/* Dynamic Status */}
                    <h3 className="text-lg font-serif font-bold text-legal-900 mb-1 min-h-[28px] transition-all duration-300">{statusMessage || 'Initializing...'}</h3>
                    <p className="text-xs text-legal-400 mb-8 max-w-xs">Multi-Agent Council is deliberating with maximum legal fidelity</p>

                    {/* Agent Pipeline */}
                    <div className="flex items-center gap-3 mb-6">
                      {/* Agent Flash */}
                      <div className={`flex flex-col items-center gap-1.5 transition-all duration-500 ${statusMessage.includes('Flash') ? 'scale-110 opacity-100' : 'scale-100 opacity-50'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${statusMessage.includes('Flash') ? 'bg-amber-50 border-amber-400 shadow-lg shadow-amber-200' : statusMessage.includes('Pro') || statusMessage.includes('Judicial') || statusMessage.includes('✅') || statusMessage.includes('Assembling') ? 'bg-green-50 border-green-400' : 'bg-legal-50 border-legal-200'}`}>
                          {statusMessage.includes('Pro') || statusMessage.includes('Judicial') || statusMessage.includes('✅') || statusMessage.includes('Assembling')
                            ? <Check size={16} className="text-green-600" />
                            : <Activity size={16} className={`text-amber-600 ${statusMessage.includes('Flash') ? 'animate-pulse' : ''}`} />}
                        </div>
                        <span className="text-[9px] font-bold text-legal-500 uppercase tracking-wider">Flash</span>
                      </div>

                      {/* Connector */}
                      <div className={`w-8 h-0.5 rounded-full transition-all duration-500 ${statusMessage.includes('Pro') || statusMessage.includes('Judicial') || statusMessage.includes('Assembling') ? 'bg-green-300' : statusMessage.includes('Flash') ? 'bg-amber-200 animate-pulse' : 'bg-legal-100'}`} />

                      {/* Agent Pro */}
                      <div className={`flex flex-col items-center gap-1.5 transition-all duration-500 ${statusMessage.includes('Pro') ? 'scale-110 opacity-100' : 'scale-100 opacity-50'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${statusMessage.includes('Pro') ? 'bg-blue-50 border-blue-400 shadow-lg shadow-blue-200' : statusMessage.includes('Judicial') || statusMessage.includes('Assembling') ? 'bg-green-50 border-green-400' : 'bg-legal-50 border-legal-200'}`}>
                          {statusMessage.includes('Judicial') || statusMessage.includes('Assembling')
                            ? <Check size={16} className="text-green-600" />
                            : <Shield size={16} className={`text-blue-600 ${statusMessage.includes('Pro') ? 'animate-pulse' : ''}`} />}
                        </div>
                        <span className="text-[9px] font-bold text-legal-500 uppercase tracking-wider">Expert</span>
                      </div>

                      {/* Connector */}
                      <div className={`w-8 h-0.5 rounded-full transition-all duration-500 ${statusMessage.includes('Judicial') || statusMessage.includes('Assembling') ? 'bg-green-300' : statusMessage.includes('Pro') ? 'bg-blue-200 animate-pulse' : 'bg-legal-100'}`} />

                      {/* The Judge */}
                      <div className={`flex flex-col items-center gap-1.5 transition-all duration-500 ${statusMessage.includes('Judicial') || statusMessage.includes('Assembling') ? 'scale-110 opacity-100' : 'scale-100 opacity-50'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${statusMessage.includes('Judicial') ? 'bg-purple-50 border-purple-400 shadow-lg shadow-purple-200' : statusMessage.includes('Assembling') || statusMessage.includes('adjourned') ? 'bg-green-50 border-green-400' : 'bg-legal-50 border-legal-200'}`}>
                          {statusMessage.includes('adjourned')
                            ? <Check size={16} className="text-green-600" />
                            : <Gavel size={16} className={`text-purple-600 ${statusMessage.includes('Judicial') || statusMessage.includes('Assembling') ? 'animate-pulse' : ''}`} />}
                        </div>
                        <span className="text-[9px] font-bold text-legal-500 uppercase tracking-wider">Judge</span>
                      </div>
                    </div>

                    {/* Subtle shimmer bar */}
                    <div className="w-48 h-1 bg-legal-100 rounded-full overflow-hidden">
                      <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-legal-400 to-transparent rounded-full" style={{ animation: 'shimmer 1.5s ease-in-out infinite' }} />
                    </div>
                  </div>
                )}

                {/* Content Switcher */}
                {session.mode === DocumentMode.ANALYZE ? (
                  <AnalysisPanel data={session.analysisResult} isLoading={isProcessing} />
                ) : (
                  <div className="h-full flex flex-col">
                    {!hasResults && !isProcessing ? (
                      // Empty State for Right Panel
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-40 select-none">
                        <Languages size={48} className="mb-4" />
                        <p className="font-serif text-lg text-legal-600">Select a document and action to begin</p>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col">
                        {/* Judge's Reasoning Card */}
                        {session.councilVerdict && session.isScannedMode && (
                          <div className="m-6 mb-0 bg-legal-50 border border-legal-200 rounded-lg p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-bold text-xs text-legal-700 uppercase tracking-wider flex items-center gap-2">
                                <Gavel size={14} /> Verdict Reasoning
                              </h4>
                              <span className="text-[10px] font-bold text-legal-500 bg-white border border-legal-200 px-2 py-0.5 rounded-full">
                                Confidence: {session.councilVerdict.confidenceScore}%
                              </span>
                            </div>
                            <p className="text-sm text-legal-600 font-serif italic leading-relaxed whitespace-pre-line border-l-2 border-legal-300 pl-3">
                              {session.councilVerdict.judgeReasoning}
                            </p>
                          </div>
                        )}
                        {/* Main Text Area */}
                        <div className="flex-1 p-6">
                          <textarea
                            className="w-full h-full resize-none focus:outline-none font-serif text-legal-900 leading-8 text-lg bg-transparent placeholder:text-legal-300"
                            placeholder={isProcessing ? "" : "Translation output will appear here..."}
                            value={session.translatedText}
                            readOnly
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        }

      </main>

      {/* 3. FOOTER */}
      <footer className="h-8 bg-white border-t border-legal-200 flex items-center justify-end px-4 z-20">
        <div className="flex items-center gap-2 text-[10px] text-legal-500 font-medium">
          <Scale size={10} />
          Agentic Model Council — Multi-Agent Consensus
        </div>
      </footer>
    </div>
  );
};

export default App;