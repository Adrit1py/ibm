'use client';

import React, { useState } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import TopologyCanvas from '../components/TopologyCanvas';
import TimelineScrubber from '../components/TimelineScrubber';
import ScenarioConsole from '../components/ScenarioConsole';
import ResilienceScorecard from '../components/ResilienceScorecard';
import { Loader2, Download, HelpCircle, X } from 'lucide-react';

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
    <div className="flex flex-col h-screen w-full bg-ibm-gray10 font-sans">
      
      {/* IBM Carbon Dark Header */}
      <header className="h-12 bg-ibm-gray100 text-white flex items-center justify-between px-5 flex-shrink-0 border-b-4 border-ibm-blue">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 bg-ibm-yellow text-ibm-gray100 flex items-center justify-center font-bold text-xs">B</div>
          <h1 className="font-semibold text-sm tracking-wide">Bob Simulator <span className="text-ibm-gray60 font-normal ml-2">| Resilience Engine</span></h1>
        </div>
        <div className="flex items-center space-x-5 text-sm">
          <button onClick={() => setIsGuideOpen(true)} className="flex items-center text-ibm-gray30 hover:text-white transition-none">
            <HelpCircle size={14} className="mr-1.5" /> Documentation
          </button>
          <button 
            onClick={exportReport}
            disabled={!result}
            className="flex items-center text-white bg-ibm-gray80 hover:bg-ibm-gray60 disabled:bg-ibm-gray80/50 disabled:text-ibm-gray60 px-3 py-1 transition-none"
          >
            <Download size={14} className="mr-1.5" /> Export JSON
          </button>
        </div>
      </header>

      {/* Main Content Split */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Panel */}
        <aside className="w-[480px] flex flex-col bg-white border-r border-ibm-gray30 flex-shrink-0 z-10">
          <div className="flex-1 overflow-hidden">
            <ScenarioConsole />
          </div>

          {/* Patch Reviewer - Flat Enterprise Diff */}
          {suggestedPatch && currentTick && currentTick.timeOffsetSec > 0 && (
            <div className="h-[320px] border-t border-ibm-gray30 flex flex-col bg-white">
              <div className="bg-ibm-gray10 border-b border-ibm-gray20 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-ibm-gray100">Suggested Mitigation Patch</span>
                <span className="text-xs text-ibm-blue font-mono bg-blue-50 px-2 py-0.5 border border-blue-200">
                  {suggestedPatch.target_file || suggestedPatch.filepath || "system_config"}
                </span>
              </div>
              
              <div className="p-4 flex-1 flex flex-col overflow-hidden">
                <p className="text-xs text-ibm-gray80 mb-3 leading-relaxed">
                  {suggestedPatch.description}
                </p>
                <div className="flex-1 bg-ibm-gray10 border border-ibm-gray30 overflow-auto p-3 mb-4 font-mono text-[11px] leading-tight">
                  <pre className="text-ibm-gray100 whitespace-pre-wrap">
                    {suggestedPatch.diff.split('\n').map((line: string, i: number) => (
                      <div key={i} className={
                        line.startsWith('+') ? 'bg-[#defbe6] text-[#0e6027]' : 
                        line.startsWith('-') ? 'bg-[#fff1f1] text-[#a2191f]' : 'text-ibm-gray80'
                      }>
                        {line}
                      </div>
                    ))}
                  </pre>
                </div>
                <button 
                  onClick={() => applyPatchAndRerun()}
                  disabled={isSimulating}
                  className="w-full bg-ibm-blue hover:bg-ibm-blueHover disabled:bg-ibm-gray20 disabled:text-ibm-gray60 disabled:border-ibm-gray30 text-white text-sm py-3 transition-none flex items-center justify-center font-medium"
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
        <main className="flex-1 flex flex-col relative bg-ibm-gray10">
          <ResilienceScorecard />

          <div className="flex-1 relative">
            {currentTick ? (
              <TopologyCanvas nodes={currentTick.nodes} edges={currentTick.edges} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full text-ibm-gray60">
                {isSimulating ? (
                  <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="animate-spin text-ibm-blue" size={32} />
                    <span className="font-mono text-sm uppercase tracking-widest text-ibm-gray80">Analyzing Graph...</span>
                  </div>
                ) : (
                  <div className="font-mono text-sm border border-ibm-gray30 bg-white px-6 py-3 text-ibm-gray80 shadow-sm">
                    Awaiting scenario injection.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-full bg-white border-t border-ibm-gray30">
            <TimelineScrubber />
          </div>
        </main>
      </div>

      {/* Strict IBM-style Modal */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ibm-gray100/60">
          <div className="bg-white border-t-4 border-ibm-blue w-[500px] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ibm-gray20">
              <h2 className="text-lg font-semibold text-ibm-gray100">Operation Guide</h2>
              <button onClick={() => setIsGuideOpen(false)} className="text-ibm-gray60 hover:text-ibm-gray100">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm text-ibm-gray80 leading-relaxed">
              <p>Bob Simulator evaluates distributed system resilience through deterministic fault injection.</p>
              <ol className="list-decimal list-inside space-y-3 mt-4">
                <li><span className="font-semibold text-ibm-gray100">Inject Fault:</span> Select a preset or type a natural language prompt in the console.</li>
                <li><span className="font-semibold text-ibm-gray100">Trace Propagation:</span> Use the scrubber to step through the exact failure cascade.</li>
                <li><span className="font-semibold text-ibm-gray100">Review Metrics:</span> Note the Blast Radius and Resilience Score in the upper right.</li>
                <li><span className="font-semibold text-ibm-gray100">Apply Mitigation:</span> Review the generated AST code patch and apply it to test remediation.</li>
              </ol>
            </div>
            <div className="px-6 py-4 bg-ibm-gray10 border-t border-ibm-gray20 flex justify-end">
              <button onClick={() => setIsGuideOpen(false)} className="bg-ibm-blue hover:bg-ibm-blueHover text-white px-6 py-2 text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
