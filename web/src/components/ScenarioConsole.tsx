import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useRepoStore } from '../store/useRepoStore';
import { Terminal, Loader2, Play } from 'lucide-react';

const DEMO_PRESETS = [
  { label: 'Black Friday Cascade', prompt: 'What happens if Redis cache latency spikes to 5000ms during Black Friday peak traffic?' },
  { label: 'Silent Payment Hang', prompt: 'What if the Stripe Payment API hangs for 30 seconds with no response?' },
  { label: 'Self-Healing Auth', prompt: 'What if auth-service fails completely during peak traffic?' },
];

export default function ScenarioConsole() {
  const [input, setInput] = useState('');
  const { getCurrentTick, result, isSimulating, liveLogs, error, runSimulation } = useSimulationStore();
  const repoId = useRepoStore((s) => s.repoId);

  const currentTick = getCurrentTick();
  const logsEndRef = useRef<HTMLDivElement>(null);

  const backendResult = result as any;
  const scenarioText = backendResult?.scenario_prompt || result?.scenarioDescription;

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentTick?.agentLogs, liveLogs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSimulating || !repoId) return;
    runSimulation(input, repoId);
    setInput('');
  };

  // Keep showing liveLogs (which include any [Error] line) whenever there's
  // no successful result yet — previously this fell back to an empty array
  // the instant isSimulating flipped to false, hiding the error entirely.
  const displayLogs =
    isSimulating || (!result && liveLogs.length > 0)
      ? liveLogs
      : currentTick?.agentLogs || [];

  return (
    <div className="flex flex-col h-full bg-brand-surface">

      {/* Console Header */}
      <div className="px-4 py-3 border-b border-brand-border bg-brand-bg flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-brand-navy flex items-center">
          <Terminal size={14} className="mr-2 text-brand-amber" /> Orchestrator Console
        </h2>
        {isSimulating && <Loader2 className="animate-spin text-brand-amber" size={14} />}
      </div>

      {/* True Dark Terminal Output */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-[12px] bg-brand-navy text-slate-300">
        {!isSimulating && !result && !error && (
          <div className="text-slate-500 font-medium">System ready. Waiting for injection parameters...</div>
        )}

        {/* Yellowish accent for the prompt */}
        {!isSimulating && scenarioText && (
          <div className="text-brand-amber mb-4 border-l-2 border-brand-amber pl-3 py-1 bg-slate-800/50 font-bold">
            $ execute_scenario "{scenarioText}"
          </div>
        )}

        {error && !result && (
          <div className="text-status-danger mb-3 border-l-2 border-status-danger pl-3 py-1 bg-red-950/30 font-bold">
            Simulation failed — see log below.
          </div>
        )}

        {displayLogs.map((log, idx) => (
          <div key={idx} className="flex space-x-3">
            <span className="text-slate-500 shrink-0 w-12 font-semibold">
              {isSimulating ? "LIVE" : `T+${currentTick?.timeOffsetSec || 0}s`}
            </span>
            <span className={log.includes('[Error]') ? 'text-status-danger' : 'text-slate-200'}>{log}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-brand-surface border-t border-brand-border flex flex-col">

        <div className="px-4 py-3 bg-brand-bg border-b border-brand-border flex flex-wrap gap-2">
          {DEMO_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setInput(preset.prompt)}
              disabled={isSimulating}
              className="text-[11px] font-semibold bg-brand-surface hover:bg-brand-border text-brand-navy border border-brand-border px-3 py-1.5 rounded transition-colors disabled:bg-slate-100 disabled:text-slate-400 shadow-sm"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex p-4 space-x-3 bg-brand-surface">
          <div className="flex-1 border-2 border-brand-border rounded focus-within:border-brand-amber transition-colors bg-white shadow-inner">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSimulating || !repoId}
              placeholder="Define a failure condition..."
              className="w-full bg-transparent px-3 py-2.5 text-sm text-brand-navy font-medium focus:outline-none disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={isSimulating || !input.trim() || !repoId}
            className="bg-brand-navy hover:bg-brand-navyHover disabled:bg-slate-200 disabled:text-slate-500 text-white px-5 py-2.5 rounded transition-colors flex items-center shadow-md font-bold"
          >
            {isSimulating ? <Loader2 size={16} className="animate-spin" /> : <><Play size={16} className="mr-2" fill="currentColor"/> Execute</>}
          </button>
        </form>
      </div>
    </div>
  );
}
