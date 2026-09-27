import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { ShieldAlert, Activity, CheckCircle } from 'lucide-react';

export default function ResilienceScorecard() {
  const { result } = useSimulationStore();
  
  const backendResult = result as any;
  const score = backendResult?.resilience_score;
  const blast = backendResult?.blast_radius;

  if (!score || !blast) return null;

  const gradeColors: Record<string, { bg: string, text: string, border: string }> = {
    'A+': { bg: 'bg-status-successBg', text: 'text-status-success', border: 'border-status-success' },
    'A':  { bg: 'bg-status-successBg', text: 'text-status-success', border: 'border-status-success' },
    'B':  { bg: 'bg-status-warningBg', text: 'text-status-warning', border: 'border-status-warning' }, 
    'C':  { bg: 'bg-status-warningBg', text: 'text-status-warning', border: 'border-status-warning' },
    'D':  { bg: 'bg-status-dangerBg', text: 'text-status-danger', border: 'border-status-danger' },
    'F':  { bg: 'bg-status-dangerBg', text: 'text-status-danger', border: 'border-status-danger' },
  };

  const theme = gradeColors[score.letter_grade] || { bg: 'bg-brand-bg', text: 'text-brand-navy', border: 'border-brand-border' };

  return (
    <div className={`absolute top-6 right-6 z-20 flex bg-brand-surface border border-brand-border border-l-4 ${theme.border} shadow-floating rounded-md overflow-hidden`}>
      
      <div className={`flex flex-col items-center justify-center w-16 border-r border-brand-border font-mono font-extrabold text-2xl ${theme.bg} ${theme.text}`}>
        {score.letter_grade}
      </div>

      <div className="flex">
        <div className="flex flex-col justify-center border-r border-brand-border px-5 py-2 min-w-[110px]">
          <span className="text-[10px] uppercase font-bold text-brand-textMuted tracking-wider flex items-center">
            <Activity size={12} className="mr-1.5 text-brand-navy" /> Score
          </span>
          <span className="text-xl font-black text-brand-navy font-mono mt-0.5">
            {score.overall_resilience_score.toFixed(1)}
          </span>
        </div>

        <div className="flex flex-col justify-center border-r border-brand-border px-5 py-2 min-w-[110px]">
          <span className="text-[10px] uppercase font-bold text-brand-textMuted tracking-wider flex items-center">
            <ShieldAlert size={12} className="mr-1.5 text-status-danger" /> Radius
          </span>
          <span className="text-xl font-black text-status-danger font-mono mt-0.5">
            {blast.blast_radius_pct.toFixed(0)}%
          </span>
        </div>

        <div className="flex flex-col justify-center px-5 py-2 bg-brand-bg min-w-[130px]">
          <span className="text-[10px] uppercase font-bold text-brand-textMuted tracking-wider">Configuration</span>
          <span className="text-sm font-bold mt-1">
            {backendResult?.is_patched_run ? (
              <span className="text-status-success flex items-center"><CheckCircle size={14} className="mr-1.5" /> Mitigated</span>
            ) : (
              <span className="text-brand-textMuted">Baseline</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
