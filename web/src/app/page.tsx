'use client';

import React, { useState } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import TopologyCanvas from '../components/TopologyCanvas';
import TimelineScrubber from '../components/TimelineScrubber';
import ScenarioConsole from '../components/ScenarioConsole';
import ResilienceScorecard from '../components/ResilienceScorecard';
import { Loader2, Download, Info, X } from 'lucide-react';

export default function BobSimulatorDashboard() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const { getCurrentTick, result, applyPatchAndRerun, isSimulating } = useSimulationStore();
  const currentTick = getCurrentTick();

  const backendResult = result as any;
  const suggestedPatch = backendResult?.suggested_patches?.[0] || backendResult?.suggestedPatch;

  // Frontend-only JSON Export feature
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
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-900">
      
      {/* Top Navigation Bar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold">B</div>
          <h1 className="font-bold text-lg text-slate-800 tracking-tight">Bob Simulator</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => setIsGuideOpen(true)} className="flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
            <Info size={16} className="mr-1" /> User Guide
          </button>
          <button 
            onClick={exportReport}
            disabled={!result}
            className="flex items-center text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 px-3 py-1.5 rounded-md shadow-sm transition-all"
          >
            <Download size={16} className="mr-1" /> Export JSON
          </button>
        </div>
      </header>

      {/* Main Content Split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <aside className="w-[400px] flex flex-col z-10 shadow-xl bg-white border-r border-slate-200">
          <div className="flex-1 overflow-hidden">
            <ScenarioConsole />
          </div>

          {/* Patch Reviewer */}
          {suggestedPatch && currentTick && currentTick.timeOffsetSec > 0 && (
            <div className="h-[280px] min-h-[280px] border-t border-slate-200 bg-slate-50 p-4 flex flex-col shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Suggested Fix</h3>
                <span className="text-[10px] text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm truncate max-w-[200px]">
                  {suggestedPatch.target_file || suggestedPatch.filepath || "system_config"}
                </span>
              </div>
              
              <p className="text-xs text-slate-600 mb-3 leading-relaxed line-clamp-2">
                {suggestedPatch.description}
              </p>
              
              <div className="flex-1 bg-white border border-slate-200 rounded p-3 overflow-x-auto overflow-y-auto font-mono text-[10px] mb-3 shadow-inner">
                <pre className="text-slate-800 whitespace-pre-wrap leading-tight">
                  {suggestedPatch.diff}
                </pre>
              </div>

              <button 
                onClick={() => applyPatchAndRerun()}
                disabled={isSimulating}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-medium py-2 px-4 rounded shadow-md transition-all flex items-center justify-center space-x-2"
              >
                {isSimulating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Applying & Re-running...</span>
                  </>
                ) : (
                  <span>Apply Patch & Re-run Simulation</span>
                )}
              </button>
            </div>
          )}
        </aside>

        {/* Right Panel */}
        <main className="flex-1 flex flex-col relative bg-slate-50">
          <ResilienceScorecard />

          <div className="flex-1 relative">
            {currentTick ? (
              <TopologyCanvas nodes={currentTick.nodes} edges={currentTick.edges} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full text-slate-400 space-y-4">
                {isSimulating ? (
                  <>
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                    <div className="font-mono text-sm tracking-wide animate-pulse">Bob is analyzing architecture...</div>
                  </>
                ) : (
                  <div className="text-sm font-medium">Select a scenario to begin simulation.</div>
                )}
              </div>
            )}
          </div>

          <div className="w-full bg-white border-t border-slate-200 shadow-lg">
            <TimelineScrubber />
          </div>
        </main>
      </div>

      {/* User Guide Modal */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-800">How to use Bob Simulator</h2>
              <button onClick={() => setIsGuideOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm text-slate-600">
              <p>Bob Simulator is a Digital Twin resilience testing platform. Here is how to use it:</p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li><strong>Trigger a Scenario:</strong> Use the terminal console on the left to inject a natural-language "What If?" failure.</li>
                <li><strong>Watch the Cascade:</strong> Use the timeline scrubber at the bottom to step through time and watch failures propagate across the architecture.</li>
                <li><strong>Analyze the Metrics:</strong> Check the Resilience Scorecard in the top right for your system's overall blast radius and grade.</li>
                <li><strong>Apply Patches:</strong> Review the AI-generated code fixes in the bottom left, and apply them to watch the simulation rerun successfully.</li>
              </ol>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setIsGuideOpen(false)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm text-sm font-medium transition-colors">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
