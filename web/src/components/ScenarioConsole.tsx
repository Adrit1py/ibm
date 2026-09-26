import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { Terminal } from 'lucide-react';

export default function ScenarioConsole() {
  const [input, setInput] = useState('');
  const { getCurrentTick, result } = useSimulationStore();
  const currentTick = getCurrentTick();
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when new logs appear
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentTick?.agentLogs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    console.log("Triggering scenario generation for:", input);
    setInput('');
    // In Phase 3, this will call the Person 2/3 backend via an API route.
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center space-x-2">
        <Terminal className="text-emerald-500" size={20} />
        <h2 className="text-sm font-bold text-slate-200 tracking-wide">Bob Agent Console</h2>
      </div>

      {/* Log Viewer */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs text-slate-300">
        <div className="text-slate-500 italic">System initialized. Awaiting scenario...</div>
        {result?.scenarioDescription && (
          <div className="text-emerald-400">&gt; Scenario: {result.scenarioDescription}</div>
        )}
        {currentTick?.agentLogs.map((log, idx) => (
          <div key={idx} className="border-l-2 border-slate-700 pl-3">
            <span className="text-blue-400">[{currentTick.timeOffsetSec}s]</span> {log}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>

      {/* Command Input */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='e.g. "What if Redis drops connections for 30s?"'
            className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500"
          />
          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
          >
            Run Simulation
          </button>
        </form>
      </div>
    </div>
  );
}
