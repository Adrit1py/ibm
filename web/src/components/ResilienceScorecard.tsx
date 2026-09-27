import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { ShieldAlert, Activity, CheckCircle } from 'lucide-react';

export default function ResilienceScorecard() {
  const { result } = useSimulationStore();
  
  const backendResult = result as any;
  const score = backendResult?.resilience_score;
  const blast = backendResult?.blast_radius;

  if (!score || !blast) return null;

  const gradeColors: Record<string, string> = {
    'A+': 'text-green-700 bg-green-50',
    'A': 'text-green-700 bg-green-50',
    'B': 'text-blue-700 bg-blue-50',
    'C': 'text-yellow-700 bg-yellow-50',
    'D': 'text-orange-700 bg-orange-50',
    'F': 'text-red-700 bg-red-50',
  };

  return (
    <div className="absolute top-4 right-4 z-20 flex bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
      
      {/* Grade Badge */}
      <div className={`flex items-center justify-center w-12 border-r border-gray-300 font-bold text-lg ${gradeColors[score.letter_grade] || 'text-gray-700 bg-gray-50'}`}>
        {score.letter_grade}
      </div>

      <div className="flex items-center">
        {/* Resilience Score */}
        <div className="flex flex-col border-r border-gray-300 px-3 py-1.5">
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center">
            <Activity size={10} className="mr-1 text-gray-400" /> Score
          </span>
          <span className="text-sm font-bold text-gray-900 font-mono">
            {score.overall_resilience_score.toFixed(1)}
          </span>
        </div>

        {/* Blast Radius */}
        <div className="flex flex-col border-r border-gray-300 px-3 py-1.5">
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center">
            <ShieldAlert size={10} className="mr-1 text-gray-400" /> Radius
          </span>
          <span className="text-sm font-bold text-red-600 font-mono">
            {blast.blast_radius_pct.toFixed(0)}%
          </span>
        </div>

        {/* Status Mode */}
        <div className="flex flex-col px-3 py-1.5 bg-gray-50 h-full justify-center">
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">State</span>
          <span className="text-xs font-semibold flex items-center mt-0.5">
            {backendResult?.is_patched_run ? (
              <span className="text-green-700 flex items-center"><CheckCircle size={12} className="mr-1" /> Patched</span>
            ) : (
              <span className="text-gray-600">Baseline</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
