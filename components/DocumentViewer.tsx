import React from 'react';
import { PdfPageImage } from '../types';
import { FileText, Eye, UploadCloud, ScanLine } from 'lucide-react';

interface Props {
  text: string;
  images: PdfPageImage[];
  isScanned: boolean;
  onTextChange: (text: string) => void;
  onUploadClick: () => void;
}

const DocumentViewer: React.FC<Props> = ({ text, images, isScanned, onTextChange, onUploadClick }) => {

  // Empty State - Visual Document Analysis
  if (!text && images.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-legal-200 m-4 rounded-xl bg-legal-50/30">
        <div className="relative mb-6 group cursor-pointer" onClick={onUploadClick}>
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-legal-100 group-hover:scale-105 transition-transform duration-300">
            <Eye size={32} className="text-legal-400 group-hover:text-legal-600 transition-colors" />
          </div>
          <div className="absolute -top-1 -right-1 bg-orange-500 text-white p-1 rounded-full shadow-md animate-pulse">
            <ScanLine size={12} />
          </div>
        </div>

        <h3 className="text-lg font-bold text-legal-800 mb-2">Visual Document Analysis</h3>
        <p className="text-sm text-legal-500 max-w-xs leading-relaxed mb-6">
          Best for scanned PDFs, images, and handwritten notes. Deep visual analysis by Advanced AI.
        </p>

        <button
          onClick={onUploadClick}
          className="bg-legal-800 hover:bg-legal-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
        >
          <UploadCloud size={16} />
          Select Document
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-legal-100/30">
      {images.length > 0 ? (
        <div className="p-8 grid gap-8 justify-items-center min-h-full">
          {images.map((img, idx) => (
            <div key={idx} className="w-full max-w-2xl rounded-lg shadow-md border border-legal-200 bg-white overflow-hidden">
              <img
                src={`data:image/jpeg;base64,${img.dataUrl}`}
                alt={`Page ${idx + 1}`}
                className="w-full h-auto block"
              />
              <div className="bg-legal-50 p-2 text-center text-[10px] font-bold text-legal-500 uppercase tracking-widest border-t border-legal-100">
                Page {idx + 1} of {images.length}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <textarea
          className="w-full h-full p-8 resize-none focus:outline-none font-serif text-legal-800 leading-8 text-lg bg-white selection:bg-legal-200"
          placeholder="Paste legal text here..."
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          spellCheck={false}
        />
      )}
    </div>
  );
};

export default DocumentViewer;