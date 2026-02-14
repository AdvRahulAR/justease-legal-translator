import React from 'react';
import { AnalysisResult } from '../types';
import { ShieldAlert, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';

interface Props {
  data: AnalysisResult | null;
  isLoading: boolean;
}

const AnalysisPanel: React.FC<Props> = ({ data, isLoading }) => {
  if (isLoading) {
    return null; // Handled by parent loading state
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-legal-400 p-8 text-center">
        <ShieldAlert size={48} className="mb-4 text-legal-300" />
        <h3 className="font-bold text-legal-600 mb-1">Awaiting Analysis</h3>
        <p className="text-sm">Run the "Risk Analysis" mode to identify contract traps.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 pb-20">
      
      {/* 1. Executive Summary Card */}
      <div className="bg-white p-6 rounded-xl shadow-soft border border-legal-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-legal-700"></div>
        <h3 className="font-sans text-xs font-bold text-legal-500 uppercase tracking-wider mb-3">Executive Summary</h3>
        <p className="text-legal-800 leading-relaxed font-serif text-lg">{data.summary}</p>
      </div>

      {/* 2. Critical Risks Alert */}
      {data.risks && data.risks.length > 0 && (
        <div className="bg-red-50 p-6 rounded-xl border border-red-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-100 p-2 rounded-full text-red-600">
                <AlertTriangle size={20} />
            </div>
            <h3 className="font-sans text-lg font-bold text-red-900">Critical Risks Identified</h3>
          </div>
          <ul className="space-y-3">
            {data.risks.map((risk, idx) => (
              <li key={idx} className="flex items-start gap-3 text-red-800 text-sm font-medium leading-relaxed">
                 <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0"></span>
                 {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Clause Breakdown */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="font-sans text-sm font-bold text-legal-900 uppercase tracking-wider">Detailed Clause Analysis</h3>
            <span className="text-xs text-legal-400 font-medium">{data.clauses?.length || 0} Clauses Detected</span>
        </div>
        
        <div className="space-y-4">
          {data.clauses?.map((clause, idx) => {
            const isHigh = clause.riskLevel === 'HIGH';
            const isMed = clause.riskLevel === 'MEDIUM';
            
            const badgeColor = isHigh 
                ? 'bg-red-100 text-red-700 border-red-200' 
                : isMed 
                    ? 'bg-orange-100 text-orange-800 border-orange-200' 
                    : 'bg-green-100 text-green-700 border-green-200';

            const borderColor = isHigh ? 'border-l-red-500' : isMed ? 'border-l-orange-400' : 'border-l-green-400';

            return (
              <div key={idx} className={`bg-white rounded-lg shadow-sm border border-legal-200 overflow-hidden hover:shadow-md transition-shadow border-l-4 ${borderColor}`}>
                {/* Original Text (Legal) */}
                <div className="p-4 bg-legal-50/50 border-b border-legal-100">
                   <div className="flex justify-between items-start mb-2">
                        <h4 className="text-[10px] font-bold text-legal-400 uppercase tracking-widest">Original Clause</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${badgeColor}`}>
                        {clause.riskLevel} RISK
                        </span>
                   </div>
                   <p className="font-serif italic text-legal-700 text-sm leading-relaxed opacity-90">"{clause.original}"</p>
                </div>
                
                {/* Explanation (Plain English) */}
                <div className="p-4">
                    <h4 className="text-[10px] font-bold text-legal-400 uppercase tracking-widest mb-2">Meaning</h4>
                    <p className="text-legal-800 text-sm leading-relaxed">{clause.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;