# JustEase Master Project Documentation

**JustEase** is a high-precision Legal AI workstation designed to bridge the gap between complex legal documents and professional-grade translation/analysis. This document serves as the comprehensive "Source of Truth" for the entire application workflow.

---

## 1. High-Level Architecture
JustEase is built using a modern, client-first architecture that prioritizes security (GDPR/Attorney-Client Privilege) and performance.
*   **Frontend:** React 19 + Vite (Port 3005).
*   **AI Engine:** Google Gemini SDK integration (Model Council architecture).
*   **Processing:** Entirely client-side or direct-to-API (Zero intermediate server storage).
*   **Persistence:** `IndexedDB` for session-state protection.

---

## 2. Ingestion Workflow
The "journey" of a document begins at the **Smart Drop Zone**.

### 2.1 Drag-and-Drop Ingestion
Users can drop any PDF into the left panel. The app immediately runs a **Heuristic Integrity Check** in `App.tsx`:
*   **Text Presence:** Checks if the PDF contains < 100 characters.
*   **Quality Ratio:** Analyzes the ratio of printable characters to total characters to detect garbled OCR output.
*   **Digital vs. Scanned:** If the file is large (>20KB) but text is sparse or quality is low, it triggers **Visual Analysis Mode**.
*   **Auto-Switching:** Toasts the user: *"Scanned document detected. Switched to Visual Mode."*

### 2.2 Pre-Processing & Scaling
For scanned documents, `pdfService.ts` converts PDF pages into high-resolution Base64 JPEGs (3.0 scale) to ensure legal fine-print is legible for AI.

---

## 3. The Model Council (Translation Engine)
Once the document is "read," it enters the **Model Council**, a multi-agent consensus system.

### 3.1 Batching (The Chunker)
To prevent browser crashes and API timeouts, documents are sliced into **4-page batches** (optimized for Gemini context).

### 3.2 Parallel Agent Feedback
Each batch is processed by three specialized agents simultaneously:
1.  **Agent Flash (`gemini-3-flash-preview`):** Performs rapid OCR and structural drafting.
2.  **Agent Pro (`gemini-3-pro-preview`):** Performs deep reasoning with a 10k token thinking budget.
3.  **The Judge (`gemini-3-pro-preview`):** Compares results from Flash and Pro against the original image to deliver the final authoritative translation.

---

## 4. UI/UX & Interaction Design
The design follows a **"Trust Through Clarity"** philosophy.

### 4.1 Interface Layout
*   **Left Panel (Source View):** Dynamic viewport. Shows a scrollable grid of original images (for scans) or an editable `textarea` (for digital text).
*   **Right Panel (Result View):** Displays the output. While processing, it shows a **Narrative Progress Stream** ("Agent Pro is analyzing signature block...").
*   **Center Handle:** Resizable split-view for side-by-side comparison.

### 4.2 Language Selection Mechanism
The **Language Selector** provides access to professional legal translation across multiple languages.
*   **Structure:** Maps over `SUPPORTED_LANGUAGES` in `constants.ts` (11+ Indian languages + English).
*   **Current implementation:** Searchable Smart Combobox with flags and a "Quick Swap" button.

---

## 5. Capabilities & Features
*   **Multi-Mode Toggle:**
    *   **Translate:** Full batch-processed document translation.
    *   **Analyze:** Risk-focused review identifying high-risk clauses (Indemnity, Liability).
    *   **Summarize:** Fast executive summaries using `gemini-3-flash`.
*   **Export Intelligence:** One-click export to **Microsoft Word (.docx)** using the `docx` library, maintaining professional legal formatting.

---

## 6. Technical Specification Summary

| Feature | Technical Implementation |
| :--- | :--- |
| **Model Ensemble** | Gemini 3 Pro (Judge/Deep) + Gemini 3 Flash (Rapid) |
| **Document Parsing** | pdfjs-dist (Text + Canvas Rendering) |
| **Retry Logic** | Exponential Backoff (withRetry utility) |
| **Security** | Zero-Server Architecture (Direct Browser-to-AI) |
| **Persistence** | storageService.ts (IndexedDB) |
| **Output Styling** | Vanilla CSS with Legal-Industry tokens |

---

## 7. Scalability & Roadmap

JustEase is built on a "Precision First" philosophy, which currently favors accuracy over extreme throughput. However, the architecture is designed for several strategic scalability phases:

### Phase 1: Browser-Bound Efficiency (Current Target)
*   **Web Worker Parallelism**: Moving PDF rendering and image conversion to background threads to ensure zero UI lag during ingestion.
*   **Adaptive Batching**: Dynamically scaling context windows based on document density to maximize TPM (Tokens Per Minute) efficiency.
*   **Semantic Caching**: Implementing page-level hashing in `IndexedDB` to provide "instant" results for previously seen legal clauses/pages, reducing redundant API costs.

### Phase 2: Intelligence Optimization
*   **Hybrid Pro-Flash Handoff**: Using Agent Flash as a triage layer. Only complex or ambiguous clauses escalate to the "Expert" Thinking models, while standard boilerplate is handled by performance models.
*   **Vector embeddings**: Integrating local vector storage for faster cross-document reference and citation lookup.

### Phase 3: Enterprise Scale (Future)
*   **Cloud Orchestration**: Moving the Model Council from the client to a distributed cloud backend (e.g., using Google Cloud Run or specialized GPU nodes) to handle 1000+ page documents with sub-minute latency.
*   **Organization-Wide Workspace**: Collaborative legal review rooms with real-time sync.

---

> [!IMPORTANT]
> JustEase maintains a STRICT zero-server-storage policy in all phases. Even in Phase 3, document content remains ephemeral or encrypted at rest with user-controlled keys.
