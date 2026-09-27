import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { Terminal, Loader2, Play } from 'lucide-react';

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
      <div className="px-4 py-3 border-b border-ibm-gray20 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ibm-gray100 flex items-center">
          <Terminal size={14} className="mr-2" /> Orchestrator Console
        </h2>
        {isSimulating && <Loader2 className="animate-spin text-ibm-blue" size={14} />}
      </div>

      {/* True Dark Terminal Output */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-[12px] bg-ibm-gray100 text-ibm-gray10">
        {!isSimulating && !result && (
          <div className="text-ibm-gray60">System initialized. Awaiting injection parameters...</div>
        )}
        
        {/* Yellowish accent for the prompt */}
        {!isSimulating && scenarioText && (
          <div className="text-ibm-yellow mb-4 border-l-2 border-ibm-yellow pl-3 py-1 bg-ibm-gray80/30">
            $ execute_scenario "{scenarioText}"
          </div>
        )}
        
        {displayLogs.map((log, idx) => (
          <div key={idx} className="flex space-x-3">
            <span className="text-ibm-gray60 shrink-0 w-12">
              {isSimulating ? "LIVE" : `T+${currentTick?.timeOffsetSec || 0}s`}
            </span> 
            <span className={log.includes('[Error]') ? 'text-ibm-red' : 'text-ibm-gray20'}>{log}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-ibm-gray30 flex flex-col">
        
        <div className="px-4 py-3 bg-ibm-gray10 border-b border-ibm-gray20 flex flex-wrap gap-2">
          {DEMO_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setInput(preset.prompt)}
              disabled={isSimulating}
              className="text-[11px] font-medium bg-white hover:bg-ibm-gray20 text-ibm-gray100 border border-ibm-gray30 px-3 py-1 transition-none disabled:bg-ibm-gray10 disabled:text-ibm-gray30"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex p-4 space-x-3 bg-white">
          <div className="flex-1 border-b-2 border-ibm-gray30 focus-within:border-ibm-blue transition-none">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSimulating}
              placeholder="Define a failure condition..."
              className="w-full bg-transparent px-2 py-2 text-sm text-ibm-gray100 focus:outline-none disabled:opacity-50"
            />
          </div>
          <button 
            type="submit"
            disabled={isSimulating || !input.trim()}
            className="bg-ibm-blue hover:bg-ibm-blueHover disabled:bg-ibm-gray30 disabled:text-ibm-gray60 text-white px-4 py-2 transition-none flex items-center"
          >
            {isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
