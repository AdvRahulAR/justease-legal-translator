import { PdfPageImage } from '../types';

export const computeImageHash = async (base64: string): Promise<string> => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }

  return fullText;
};

/**
 * Converts PDF pages to high-resolution JPEG images.
 * Attempts Web Worker first for zero UI lag, falls back to Main Thread.
 */
export const convertPdfToImages = async (file: File): Promise<PdfPageImage[]> => {

  // --- Strategy 1: Web Worker (Background Thread) ---
  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    try {
      const workerBuffer = await file.arrayBuffer(); // Fresh buffer for worker
      const images = await new Promise<PdfPageImage[]>((resolve, reject) => {
        // IMPORTANT: Use classic worker (no { type: 'module' }) because importScripts
        // is not available in module workers.
        const worker = new Worker(new URL('./pdfWorker.ts', import.meta.url));

        const timeout = setTimeout(() => {
          reject(new Error('Worker timed out after 60s'));
          worker.terminate();
        }, 60000);

        worker.onmessage = (e) => {
          clearTimeout(timeout);
          if (e.data.type === 'SUCCESS') {
            resolve(e.data.images);
          } else {
            reject(new Error(e.data.error || 'Worker processing error'));
          }
          worker.terminate();
        };

        worker.onerror = (err) => {
          clearTimeout(timeout);
          reject(err);
          worker.terminate();
        };

        // Transfer buffer for zero-copy speed
        worker.postMessage({ arrayBuffer: workerBuffer, scale: 3.0, quality: 0.9 }, [workerBuffer]);
      });

      if (images && images.length > 0) return images;
    } catch (err) {
      console.warn('⚡ Web Worker failed, falling back to Main Thread:', err);
    }
  }

  // --- Strategy 2: Main Thread Fallback (Always works) ---
  console.log('📄 Using Main Thread for PDF rendering...');
  const fallbackBuffer = await file.arrayBuffer(); // Fresh buffer for fallback
  const pdf = await window.pdfjsLib.getDocument({ data: fallbackBuffer }).promise;
  const images: PdfPageImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 3.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const base64 = dataUrl.split(',')[1];
      images.push({
        pageNumber: i,
        dataUrl: base64
      });
    }
  }

  return images;
};