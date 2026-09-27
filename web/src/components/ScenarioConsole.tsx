import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { Terminal, Loader2 } from 'lucide-react';

const DEMO_PRESETS = [
  { label: '🔥 Black Friday Cascade', prompt: 'What happens if Redis cache latency spikes to 5000ms during Black Friday peak traffic?' },
  { label: '💳 Silent Payment Hang', prompt: 'What if the Stripe Payment API hangs for 30 seconds with no response?' },
  { label: '🛡️ Self-Healing Auth', prompt: 'What if auth-service fails completely during peak traffic?' },
];

export default function ScenarioConsole() {
  const [input, setInput] = useState('');
  const { getCurrentTick, result, isSimulating, liveLogs, runSimulation } = useSimulationStore();
  
  const currentTick = getCurrentTick();
  const logsEndRef = useRef<HTMLDivElement>(null);

  const backendResult = result as any;
  const scenarioText = backendResult?.scenario_prompt || result?.scenarioDescription;

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentTick?.agentLogs, liveLogs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSimulating) return;
    runSimulation(input);
    setInput('');
  };

  const displayLogs = isSimulating ? liveLogs : (currentTick?.agentLogs || []);

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 shadow-sm">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="text-blue-600" size={20} />
          <h2 className="text-sm font-bold text-slate-800 tracking-wide">Bob Agent Console</h2>
        </div>
        {isSimulating && <Loader2 className="animate-spin text-blue-600" size={16} />}
      </div>

      {/* Log Viewer */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs text-slate-600">
        {!isSimulating && !result && (
          <div className="text-slate-400 italic">System initialized. Awaiting scenario...</div>
        )}
        
        {!isSimulating && scenarioText && (
          <div className="text-blue-600 font-bold">&gt; Scenario: {scenarioText}</div>
        )}
        
        {displayLogs.map((log, idx) => (
          <div key={idx} className="border-l-2 border-slate-300 pl-3">
            <span className="text-slate-400 font-semibold">
              {isSimulating ? "[Live]" : `[${currentTick?.timeOffsetSec || 0}s]`}
            </span> {log}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>

      {/* Command Input Area */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {DEMO_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setInput(preset.prompt)}
              disabled={isSimulating}
              className="text-[10px] bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-sm px-2 py-1 rounded transition-colors disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSimulating}
            placeholder='e.g. "What if Redis drops connections for 30s?"'
            className="w-full bg-white border border-slate-300 rounded p-3 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-inner"
          />
          <button 
            type="submit"
            disabled={isSimulating}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white text-sm font-medium py-2 px-4 rounded transition-colors shadow-sm flex items-center justify-center space-x-2"
          >
            {isSimulating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <span>Run Simulation</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
