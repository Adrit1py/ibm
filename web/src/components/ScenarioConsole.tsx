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
  const { 
    getCurrentTick, 
    result, 
    isSimulating, 
    liveLogs, 
    runSimulation 
  } = useSimulationStore();
  
  const currentTick = getCurrentTick();
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom whenever live logs or timeline logs update
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentTick?.agentLogs, liveLogs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSimulating) return;
    
    // Trigger the real API integration via the Zustand store
    runSimulation(input);
    setInput('');
  };

  // Decide which logs to show based on state
  const displayLogs = isSimulating ? liveLogs : (currentTick?.agentLogs || []);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="text-emerald-500" size={20} />
          <h2 className="text-sm font-bold text-slate-200 tracking-wide">Bob Agent Console</h2>
        </div>
        {/* Render a spinner when simulating */}
        {isSimulating && <Loader2 className="animate-spin text-blue-500" size={16} />}
      </div>

      {/* Log Viewer */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs text-slate-300">
        {!isSimulating && !result && (
          <div className="text-slate-500 italic">System initialized. Awaiting scenario...</div>
        )}
        
        {/* Updated from result.scenarioDescription to result.scenario_prompt per digital twin schema */}
        {!isSimulating && result?.scenario_prompt && (
          <div className="text-emerald-400">&gt; Scenario: {result.scenario_prompt}</div>
        )}
        
        {displayLogs.map((log, idx) => (
          <div key={idx} className="border-l-2 border-slate-700 pl-3">
            <span className="text-blue-400">
              {isSimulating ? "[Live]" : `[${currentTick?.timeOffsetSec || 0}s]`}
            </span> {log}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>

      {/* Command Input Area */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col space-y-3">
        
        {/* Quick Demo Scenarios */}
        <div className="flex flex-wrap gap-1.5">
          {DEMO_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInput(preset.prompt);
              }}
              disabled={isSimulating}
              className="text-[10px] bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button 
            type="submit"
            disabled={isSimulating}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-medium py-2 px-4 rounded transition-colors flex items-center justify-center space-x-2"
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
