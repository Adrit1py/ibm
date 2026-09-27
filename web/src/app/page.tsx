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
    <div className="flex flex-col h-screen w-full bg-gray-100 font-sans text-gray-900 overflow-hidden">
      
      {/* Classic Solid Header */}
      <header className="h-12 bg-white border-b border-gray-300 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 bg-blue-700 text-white flex items-center justify-center font-bold text-xs rounded-sm">B</div>
          <h1 className="font-semibold text-sm text-gray-800 tracking-tight">Bob Simulator</h1>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <button onClick={() => setIsGuideOpen(true)} className="flex items-center text-gray-600 hover:text-blue-700 transition-none">
            <Info size={14} className="mr-1.5" /> Guide
          </button>
          <button 
            onClick={exportReport}
            disabled={!result}
            className="flex items-center text-gray-700 bg-gray-50 border border-gray-300 hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 px-3 py-1 rounded-sm transition-none"
          >
            <Download size={14} className="mr-1.5" /> Export JSON
          </button>
        </div>
      </header>

      {/* Main Content Split */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Panel - Strict Borders, No Shadows */}
        <aside className="w-[450px] flex flex-col bg-white border-r border-gray-300 flex-shrink-0 z-10">
          <div className="flex-1 overflow-hidden">
            <ScenarioConsole />
          </div>

          {/* Patch Reviewer - Classic Diff View */}
          {suggestedPatch && currentTick && currentTick.timeOffsetSec > 0 && (
            <div className="h-[300px] border-t border-gray-300 bg-gray-50 flex flex-col">
              <div className="bg-gray-200 border-b border-gray-300 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Suggested Patch</span>
                <span className="text-xs text-gray-600 font-mono bg-white border border-gray-300 px-1.5 py-0.5 rounded-sm">
                  {suggestedPatch.target_file || suggestedPatch.filepath || "system_config"}
                </span>
              </div>
              
              <div className="p-3 flex-1 flex flex-col overflow-hidden">
                <p className="text-xs text-gray-700 mb-2 font-medium">
                  {suggestedPatch.description}
                </p>
                <div className="flex-1 bg-white border border-gray-300 overflow-auto p-2 mb-3 font-mono text-[11px] leading-tight">
                  <pre className="text-gray-800 whitespace-pre-wrap">
                    {suggestedPatch.diff.split('\n').map((line: string, i: number) => (
                      <div key={i} className={
                        line.startsWith('+') ? 'bg-green-50 text-green-800' : 
                        line.startsWith('-') ? 'bg-red-50 text-red-800' : 'text-gray-600'
                      }>
                        {line}
                      </div>
                    ))}
                  </pre>
                </div>
                <button 
                  onClick={() => applyPatchAndRerun()}
                  disabled={isSimulating}
                  className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:border-gray-300 text-white border border-blue-800 text-sm font-semibold py-1.5 rounded-sm transition-none flex items-center justify-center"
                >
                  {isSimulating ? (
                    <><Loader2 size={14} className="animate-spin mr-2" /> Applying...</>
                  ) : (
                    "Apply Patch & Re-run"
                  )}
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Right Panel */}
        <main className="flex-1 flex flex-col relative bg-gray-100">
          <ResilienceScorecard />

          <div className="flex-1 relative">
            {currentTick ? (
              <TopologyCanvas nodes={currentTick.nodes} edges={currentTick.edges} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full text-gray-500">
                {isSimulating ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="animate-spin text-blue-700" size={20} />
                    <span className="font-mono text-sm">Analyzing architecture graph...</span>
                  </div>
                ) : (
                  <div className="font-mono text-sm bg-white border border-gray-300 px-4 py-2 rounded-sm text-gray-600">
                    Awaiting scenario execution.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-full bg-white border-t border-gray-300">
            <TimelineScrubber />
          </div>
        </main>
      </div>

      {/* Standard Modal */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50">
          <div className="bg-white border border-gray-300 shadow-lg w-[500px] flex flex-col rounded-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300 bg-gray-50">
              <h2 className="font-semibold text-gray-800 text-sm">Operation Guide</h2>
              <button onClick={() => setIsGuideOpen(false)} className="text-gray-500 hover:text-gray-800">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm text-gray-700 leading-relaxed">
              <p>Bob Simulator is a Digital Twin resilience testing platform operating entirely locally.</p>
              <ol className="list-decimal list-inside space-y-2 ml-1">
                <li><strong>Trigger Scenario:</strong> Use the left console to inject a failure scenario against the loaded `digital_twin_schema.json`.</li>
                <li><strong>Analyze Cascade:</strong> Use the bottom timeline to step through the exact failure propagation sequence.</li>
                <li><strong>Review Metrics:</strong> Observe the quantitative blast radius and resilience score in the upper right.</li>
                <li><strong>Apply Mitigation:</strong> Review the AST-aware code patch and apply it to simulate a remediated run.</li>
              </ol>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button onClick={() => setIsGuideOpen(false)} className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 px-4 py-1.5 rounded-sm text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
