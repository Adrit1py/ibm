import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { ShieldAlert, Activity, CheckCircle2 } from 'lucide-react';

export default function ResilienceScorecard() {
  const { result } = useSimulationStore();
  
  // Safely cast result to any to bypass strict TS checks for live backend properties
  const backendResult = result as any;
  const score = backendResult?.resilience_score;
  const blast = backendResult?.blast_radius;

  if (!score || !blast) return null;

  const gradeColors: Record<string, string> = {
    'A+': 'text-emerald-400 border-emerald-500/50 bg-emerald-950/40',
    'A': 'text-emerald-400 border-emerald-500/50 bg-emerald-950/40',
    'B': 'text-blue-400 border-blue-500/50 bg-blue-950/40',
    'C': 'text-amber-400 border-amber-500/50 bg-amber-950/40',
    'D': 'text-orange-400 border-orange-500/50 bg-orange-950/40',
    'F': 'text-rose-400 border-rose-500/50 bg-rose-950/40',
  };

  return (
    <div className="absolute top-4 right-4 z-20 flex items-center space-x-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-2xl">
      {/* Grade Badge */}
      <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg border font-mono font-bold text-lg ${gradeColors[score.letter_grade] || 'text-slate-400'}`}>
        {score.letter_grade}
      </div>

      {/* Resilience Score */}
      <div className="flex flex-col border-r border-slate-800 pr-3">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center">
          <Activity size={12} className="mr-1 text-blue-400" /> Resilience
        </span>
        <span className="text-base font-extrabold text-white font-mono">
          {score.overall_resilience_score.toFixed(1)}<span className="text-xs text-slate-500">/100</span>
        </span>
      </div>

      {/* Blast Radius */}
      <div className="flex flex-col border-r border-slate-800 pr-3">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center">
          <ShieldAlert size={12} className="mr-1 text-rose-400" /> Blast Radius
        </span>
        <span className="text-base font-extrabold text-rose-400 font-mono">
          {blast.blast_radius_pct.toFixed(0)}%
        </span>
      </div>

      {/* Status Mode */}
      <div className="flex flex-col pl-1">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</span>
        <span className="text-xs font-semibold text-slate-200 flex items-center mt-0.5">
          {backendResult?.is_patched_run ? (
            <span className="text-emerald-400 flex items-center"><CheckCircle2 size={12} className="mr-1" /> Patched</span>
          ) : (
            <span className="text-rose-400 flex items-center">Unmitigated</span>
          )}
        </span>
      </div>
    </div>
  );
}
