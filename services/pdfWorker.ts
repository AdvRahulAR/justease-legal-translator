// pdfWorker.ts - Off-main-thread PDF rendering (Classic Worker)
// Uses importScripts for PDF.js CDN loading (requires classic worker, NOT module worker)
declare function importScripts(...urls: string[]): void;

importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
(self as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

self.onmessage = async (e: MessageEvent) => {
    const { arrayBuffer, scale, quality } = e.data;

    try {
        const pdf = await (self as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const images: { pageNumber: number; dataUrl: string }[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });

            const canvas = new OffscreenCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');

            if (context) {
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
                const buffer = await blob.arrayBuffer();
                const base64 = arrayBufferToBase64(buffer);

                images.push({
                    pageNumber: i,
                    dataUrl: base64
                });
            }
        }

        self.postMessage({ type: 'SUCCESS', images });
    } catch (error: any) {
        console.error('Worker Error:', error);
        self.postMessage({ type: 'ERROR', error: error.message || 'Unknown worker error' });
    }
};
