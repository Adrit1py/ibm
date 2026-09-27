'use client';

import React, { useState } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import TopologyCanvas from '../components/TopologyCanvas';
import TimelineScrubber from '../components/TimelineScrubber';
import ScenarioConsole from '../components/ScenarioConsole';
import ResilienceScorecard from '../components/ResilienceScorecard';
import { Loader2, Download, BookOpen, X } from 'lucide-react';

export default function BobSimulatorDashboard() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const { getCurrentTick, result, applyPatchAndRerun, isSimulating } = useSimulationStore();
  const currentTick = getCurrentTick();

  const backendResult = result as any;
  const suggestedPatch = backendResult?.suggested_patches?.[0] || backendResult?.suggestedPatch;

  const exportReport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bob_simulation_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-brand-bg font-sans">
      
      {/* Deep Indigo Header with Amber Accent */}
      <header className="h-14 bg-brand-navy text-white flex items-center justify-between px-6 flex-shrink-0 border-b-[3px] border-brand-amber shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 bg-brand-amber text-brand-navy flex items-center justify-center font-bold text-sm rounded-sm">B</div>
          <h1 className="font-semibold text-sm tracking-wide">Bob Simulator <span className="text-slate-400 font-normal ml-2">| Resilience Engine</span></h1>
        </div>
        <div className="flex items-center space-x-6 text-sm font-medium">
          <button onClick={() => setIsGuideOpen(true)} className="flex items-center text-slate-300 hover:text-brand-amber transition-colors">
            <BookOpen size={16} className="mr-2" /> Documentation
          </button>
          <button 
            onClick={exportReport}
            disabled={!result}
            className="flex items-center text-brand-navy bg-white hover:bg-slate-100 disabled:bg-slate-700 disabled:text-slate-400 px-4 py-1.5 rounded-sm shadow-sm transition-colors"
          >
            <Download size={14} className="mr-2" /> Export JSON
          </button>
        </div>
      </header>

      {/* Main Content Split */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Panel */}
        <aside className="w-[450px] flex flex-col bg-brand-surface border-r border-brand-border flex-shrink-0 z-10 shadow-flat">
          <div className="flex-1 overflow-hidden">
            <ScenarioConsole />
          </div>

          {/* Patch Reviewer */}
          {suggestedPatch && currentTick && currentTick.timeOffsetSec > 0 && (
            <div className="h-[320px] border-t border-brand-border flex flex-col bg-brand-surface">
              <div className="bg-brand-bg border-b border-brand-border px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-brand-navy uppercase tracking-wider">Suggested Patch</span>
                <span className="text-xs text-brand-amber font-mono font-semibold bg-amber-50 px-2 py-0.5 border border-amber-200 rounded">
                  {suggestedPatch.target_file || suggestedPatch.filepath || "system_config"}
                </span>
              </div>
              
              <div className="p-4 flex-1 flex flex-col overflow-hidden">
                <p className="text-xs text-brand-textMuted mb-3 font-medium leading-relaxed">
                  {suggestedPatch.description}
                </p>
                <div className="flex-1 bg-brand-bg border border-brand-border overflow-auto p-3 mb-4 font-mono text-[11px] leading-tight rounded">
                  <pre className="whitespace-pre-wrap">
                    {suggestedPatch.diff.split('\n').map((line: string, i: number) => (
                      <div key={i} className={
                        line.startsWith('+') ? 'bg-status-successBg text-status-success px-1' : 
                        line.startsWith('-') ? 'bg-status-dangerBg text-status-danger px-1' : 'text-brand-text px-1'
                      }>
                        {line}
                      </div>
                    ))}
                  </pre>
                </div>
                <button 
                  onClick={() => applyPatchAndRerun()}
                  disabled={isSimulating}
                  className="w-full bg-brand-amber hover:bg-brand-amberHover disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-200 text-white text-sm py-2.5 rounded shadow-sm transition-colors flex items-center justify-center font-bold tracking-wide"
                >
                  {isSimulating ? (
                    <><Loader2 size={16} className="animate-spin mr-2" /> Executing Patch...</>
                  ) : (
                    "Apply Patch & Re-run Simulation"
                  )}
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Right Panel */}
        <main className="flex-1 flex flex-col relative bg-brand-bg">
          <ResilienceScorecard />

          <div className="flex-1 relative">
            {currentTick ? (
              <TopologyCanvas nodes={currentTick.nodes} edges={currentTick.edges} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full text-brand-textMuted">
                {isSimulating ? (
                  <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="animate-spin text-brand-amber" size={36} />
                    <span className="font-mono text-sm uppercase tracking-widest text-brand-navy font-semibold">Analyzing Graph...</span>
                  </div>
                ) : (
                  <div className="font-mono text-sm border border-brand-border bg-brand-surface px-6 py-4 rounded shadow-flat text-brand-text font-medium">
                    Awaiting scenario injection.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-full bg-brand-surface border-t border-brand-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <TimelineScrubber />
          </div>
        </main>
      </div>

      {/* Modern Documentation Modal */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/80 backdrop-blur-sm">
          <div className="bg-brand-surface border border-brand-border w-[550px] flex flex-col rounded-lg shadow-floating overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border bg-brand-bg">
              <h2 className="text-base font-bold text-brand-navy flex items-center">
                <BookOpen size={18} className="mr-2 text-brand-amber" /> Operation Guide
              </h2>
              <button onClick={() => setIsGuideOpen(false)} className="text-brand-textMuted hover:text-brand-danger transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm text-brand-text leading-relaxed">
              <p className="font-medium">Bob Simulator evaluates distributed system resilience through deterministic fault injection.</p>
              <div className="space-y-4 mt-4">
                <div className="flex"><span className="w-6 h-6 rounded bg-brand-navy text-brand-amber flex items-center justify-center font-bold text-xs mr-3 shrink-0">1</span><p><strong>Inject Fault:</strong> Select a preset or type a natural language prompt in the console to inject failures into the loaded <code>digital_twin_schema.json</code>.</p></div>
                <div className="flex"><span className="w-6 h-6 rounded bg-brand-navy text-brand-amber flex items-center justify-center font-bold text-xs mr-3 shrink-0">2</span><p><strong>Trace Propagation:</strong> Use the scrubber to step through the exact failure cascade across network boundaries.</p></div>
                <div className="flex"><span className="w-6 h-6 rounded bg-brand-navy text-brand-amber flex items-center justify-center font-bold text-xs mr-3 shrink-0">3</span><p><strong>Review Metrics:</strong> Observe the quantitative blast radius and resilience score in the upper right HUD.</p></div>
                <div className="flex"><span className="w-6 h-6 rounded bg-brand-navy text-brand-amber flex items-center justify-center font-bold text-xs mr-3 shrink-0">4</span><p><strong>Apply Mitigation:</strong> Review the generated AST code patch and apply it to simulate a remediated run.</p></div>
              </div>
            </div>
            <div className="px-6 py-4 bg-brand-bg border-t border-brand-border flex justify-end">
              <button onClick={() => setIsGuideOpen(false)} className="bg-brand-navy hover:bg-brand-navyHover text-white px-6 py-2 rounded text-sm font-semibold transition-colors shadow-sm">
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
