import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore';

export default function ResilienceScorecard() {
  const { result } = useSimulationStore();
  
  const backendResult = result as any;
  const score = backendResult?.resilience_score;
  const blast = backendResult?.blast_radius;

  if (!score || !blast) return null;

  // Strict IBM Colors
  const gradeColors: Record<string, { bg: string, text: string, border: string }> = {
    'A+': { bg: 'bg-[#defbe6]', text: 'text-[#0e6027]', border: 'border-[#24a148]' },
    'A':  { bg: 'bg-[#defbe6]', text: 'text-[#0e6027]', border: 'border-[#24a148]' },
    'B':  { bg: 'bg-[#fcf4d6]', text: 'text-[#8a6800]', border: 'border-[#f1c21b]' }, // Yellowish request!
    'C':  { bg: 'bg-[#fcf4d6]', text: 'text-[#8a6800]', border: 'border-[#f1c21b]' },
    'D':  { bg: 'bg-[#fff1f1]', text: 'text-[#a2191f]', border: 'border-[#da1e28]' },
    'F':  { bg: 'bg-[#fff1f1]', text: 'text-[#a2191f]', border: 'border-[#da1e28]' },
  };

  const theme = gradeColors[score.letter_grade] || { bg: 'bg-ibm-gray10', text: 'text-ibm-gray100', border: 'border-ibm-gray60' };

  return (
    <div className={`absolute top-5 right-5 z-20 flex bg-white border border-ibm-gray30 border-l-4 ${theme.border} shadow-md`}>
      
      <div className={`flex flex-col items-center justify-center w-14 border-r border-ibm-gray20 font-mono font-bold text-xl ${theme.bg} ${theme.text}`}>
        {score.letter_grade}
      </div>

      <div className="flex">
        <div className="flex flex-col justify-center border-r border-ibm-gray20 px-4 py-2 min-w-[100px]">
          <span className="text-[10px] uppercase font-semibold text-ibm-gray60 tracking-wide">Resilience</span>
          <span className="text-lg font-bold text-ibm-gray100 font-mono">
            {score.overall_resilience_score.toFixed(1)}
          </span>
        </div>

        <div className="flex flex-col justify-center border-r border-ibm-gray20 px-4 py-2 min-w-[100px]">
          <span className="text-[10px] uppercase font-semibold text-ibm-gray60 tracking-wide">Blast Radius</span>
          <span className="text-lg font-bold text-ibm-red font-mono">
            {blast.blast_radius_pct.toFixed(0)}%
          </span>
        </div>

        <div className="flex flex-col justify-center px-4 py-2 bg-ibm-gray10 min-w-[120px]">
          <span className="text-[10px] uppercase font-semibold text-ibm-gray60 tracking-wide">Configuration</span>
          <span className="text-xs font-bold mt-0.5">
            {backendResult?.is_patched_run ? (
              <span className="text-ibm-green">Mitigated</span>
            ) : (
              <span className="text-ibm-gray80">Baseline</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
