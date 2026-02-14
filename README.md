# ⚖️ JustEase Legal Translator

> An agentic, multi-model legal document intelligence platform powered by Google Gemini.

JustEase translates, analyzes, and summarizes legal documents with courtroom-grade fidelity. It uses a **Multi-Agent "Model Council"** architecture where multiple AI agents independently process each page, then a judicial synthesis agent produces the final, most accurate result.

---

## ✨ Key Features

### 🏛️ Multi-Agent Model Council
Three AI agents work in consensus to maximize translation accuracy:

| Agent | Role | Model |
|-------|------|-------|
| **Agent Flash** | Fast OCR + triage — scans every page, detects complexity | `gemini-3-flash-preview` |
| **Agent Pro** | Deep legal reasoning — activated for complex clauses | `gemini-3-pro-preview` |
| **The Judge** | Judicial synthesis — resolves conflicts, produces final verdict | `gemini-3-pro-preview` |

### 📄 Visual Document Intelligence
- **Deep OCR**: Handles printed text, handwriting, stamps, seals, and watermarks
- **Rotation Correction**: Mentally corrects upside-down or rotated pages
- **Mixed Languages**: Detects and translates multiple scripts in a single document
- **Up to 50 pages** per document with per-page processing

### 🌍 11 Supported Languages
Hindi 🇮🇳 · Malayalam 🇮🇳 · Spanish 🇪🇸 · French 🇫🇷 · German 🇩🇪 · Chinese 🇨🇳 · Japanese 🇯🇵 · Arabic 🇸🇦 · Russian 🇷🇺 · Portuguese 🇵🇹 · English 🇬🇧

### 🔍 Legal Risk Analysis
- **Headnote-style** executive summaries (Parties, Term, Termination)
- **Risk grading**: HIGH / MEDIUM / LOW for each clause
- **Plain English** explanations for laypersons

### ⚡ Performance & Caching
- **Web Worker**: PDF rendering runs in a background thread — zero UI lag
- **Semantic Caching**: SHA-256 image hashing + IndexedDB — instant results for repeated pages
- **Hybrid Handoff**: Flash handles boilerplate; Pro only activates for complex pages (~40% cost savings)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   App.tsx                        │
│         (Orchestrator + State Manager)           │
├─────────────┬───────────────┬───────────────────┤
│ DocumentViewer │ LanguageSelector │ AnalysisPanel │
│  (Left Panel)  │   (Dropdown)     │ (Right Panel) │
└──────┬──────┴───────┬───────┴───────┬───────────┘
       │              │               │
┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────────┐
│ pdfService  │ │  gemini   │ │ modelCouncil    │
│ (OCR/Render)│ │  Service  │ │ Service         │
│ + pdfWorker │ │ (Simple)  │ │ (Multi-Agent)   │
└─────────────┘ └───────────┘ └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │ storageService   │
                              │ (IndexedDB Cache) │
                              └─────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- A **Google Gemini API key** ([Get one here](https://aistudio.google.com/app/apikey))

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/justease-legal-translator.git
cd justease-legal-translator

# 2. Install dependencies
npm install

# 3. Create environment file
echo "API_KEY=your_gemini_api_key_here" > .env.local

# 4. Start the development server
npm run dev
```

The app will be running at **http://localhost:5173** (or the port shown in your terminal).

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📁 Project Structure

```
justease-legal-translator/
├── index.html              # Entry HTML with Tailwind CDN + PDF.js
├── index.tsx               # React entry point
├── index.css               # Custom animations (shimmer, scrollbar)
├── App.tsx                 # Main app — state, routing, UI layout
├── constants.ts            # Models, languages, thinking budget
├── types.ts                # TypeScript interfaces & enums
├── metadata.json           # Project metadata
│
├── components/
│   ├── DocumentViewer.tsx   # Left panel — image preview / text input
│   ├── AnalysisPanel.tsx    # Risk analysis output renderer
│   └── LanguageSelector.tsx # Language dropdown with native names
│
├── services/
│   ├── geminiService.ts     # Direct Gemini API (summarize, analyze, translate)
│   ├── modelCouncilService.ts  # Multi-Agent Council orchestrator
│   ├── pdfService.ts        # PDF → images + text extraction + hashing
│   ├── pdfWorker.ts         # Background Web Worker for PDF rendering
│   └── storageService.ts    # IndexedDB session persistence + semantic cache
│
├── .env.local               # API_KEY (not committed)
├── vite.config.ts           # Vite + React + env config
└── tsconfig.json            # TypeScript configuration
```

---

## 🔧 Configuration

| Variable | File | Description |
|----------|------|-------------|
| `API_KEY` | `.env.local` | Your Google Gemini API key |
| `MODEL_EXPERT` | `constants.ts` | Expert model (`gemini-3-pro-preview`) |
| `MODEL_PERFORMANCE` | `constants.ts` | Fast model (`gemini-3-flash-preview`) |
| `THINKING_BUDGET_EXPERT` | `constants.ts` | Token budget for deep reasoning (10,000) |

---

## 💡 How It Works

### Translation Flow (Per Page)
```
Upload PDF → Rasterize to JPEG → Check Semantic Cache
                                      │
                                 Cache Hit? → Return instant result
                                      │
                                 Cache Miss ↓
                                      │
                            Agent Flash (OCR + Triage)
                                      │
                          ┌───────────┴───────────┐
                     Simple Page            Complex Page
                          │                       │
                    Use Flash Result      Agent Pro (Deep Analysis)
                          │                       │
                          │              The Judge (Synthesis)
                          │                       │
                          └───────────┬───────────┘
                                      │
                              Save to Cache → Return Result
```

### Document Modes
- **Translate** — Full visual translation with Model Council
- **Analyze** — Risk analysis with clause-level grading
- **Summarize** — Headnote-style executive summary

---

## 🛡️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS |
| AI | Google Gemini 3 (Flash + Pro with Thinking) |
| PDF | PDF.js 3.11 + Web Workers |
| Caching | IndexedDB + SHA-256 hashing |
| Build | Vite 6 |
| Export | docx (DOCX generation) + FileSaver |

---

## 📄 License

MIT

---

<p align="center">
  Built with ⚖️ for the Google Hackathon
</p>
