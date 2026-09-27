import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { Terminal, Loader2 } from 'lucide-react';

const DEMO_PRESETS = [
  { label: 'Black Friday Cascade', prompt: 'What happens if Redis cache latency spikes to 5000ms during Black Friday peak traffic?' },
  { label: 'Silent Payment Hang', prompt: 'What if the Stripe Payment API hangs for 30 seconds with no response?' },
  { label: 'Self-Healing Auth', prompt: 'What if auth-service fails completely during peak traffic?' },
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
    <div className="flex flex-col h-full bg-white">
      
      {/* Console Header */}
      <div className="px-3 py-2 border-b border-gray-300 bg-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-gray-700">
          <Terminal size={14} />
          <h2 className="text-xs font-bold uppercase tracking-wide">Execution Console</h2>
        </div>
        {isSimulating && <Loader2 className="animate-spin text-gray-500" size={14} />}
      </div>

      {/* Classic Dark Terminal Output */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-[11px] bg-[#1e1e1e] text-gray-300">
        {!isSimulating && !result && (
          <div className="text-gray-500">System ready. Waiting for input...</div>
        )}
        
        {!isSimulating && scenarioText && (
          <div className="text-green-400 mb-2">$ execute --scenario "{scenarioText}"</div>
        )}
        
        {displayLogs.map((log, idx) => (
          <div key={idx} className="flex space-x-2">
            <span className="text-gray-500 shrink-0">
              {isSimulating ? "LIVE" : `T+${currentTick?.timeOffsetSec || 0}s`}
            </span> 
            <span className={log.includes('[Error]') ? 'text-red-400' : 'text-gray-300'}>{log}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-gray-50 border-t border-gray-300 flex flex-col space-y-3">
        
        <div className="flex flex-wrap gap-2">
          {DEMO_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setInput(preset.prompt)}
              disabled={isSimulating}
              className="text-[11px] bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-2 py-1 rounded-sm transition-none disabled:bg-gray-100 disabled:text-gray-400"
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
            placeholder="Enter failure condition..."
            className="w-full bg-white border border-gray-300 rounded-sm px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button 
            type="submit"
            disabled={isSimulating || !input.trim()}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:border-gray-300 text-white border border-blue-800 text-sm font-semibold py-1.5 rounded-sm transition-none"
          >
            {isSimulating ? "Processing..." : "Run Simulation"}
          </button>
        </form>
      </div>
    </div>
  );
}
