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
    <div className="flex flex-col h-screen w-full bg-[#f4f5f7] overflow-hidden font-sans text-gray-900">
      
      {/* Top Navigation Bar - Classic Flat Design */}
      <header className="h-12 bg-white border-b border-gray-300 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 bg-blue-700 rounded-sm flex items-center justify-center text-white font-bold text-xs">B</div>
          <h1 className="font-semibold text-sm text-gray-800 tracking-tight">Bob Simulator Workspace</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => setIsGuideOpen(true)} className="flex items-center text-xs font-medium text-gray-600 hover:text-blue-700 px-2 py-1 transition-colors">
            <Info className="mr-1.5" size="{14}"/> Documentation
          </button>
          <button 
            onClick={exportReport}
            disabled={!result}
            className="flex items-center text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 px-3 py-1.5 rounded-sm shadow-sm transition-all"
          >
            <Download className="mr-1.5" size="{14}"/> Export JSON
          </button>
        </div>
      </header>

      {/* Main Content Split - Strict Borders, No Outer Shadows */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Panel */}
        <aside className="w-[450px] flex flex-col bg-white border-r border-gray-300 z-10 shrink-0">
          <div className="flex-1 overflow-hidden">
            <ScenarioConsole/>
          </div>

          {/* Patch Reviewer - Flat IDE styling */}
          {suggestedPatch && currentTick && currentTick.timeOffsetSec > 0 && (
            <div className="h-[300px] border-t border-gray-300 bg-[#f8f9fa] p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Suggested Remediation</h3>
                <span className="text-[11px] font-mono text-gray-700 bg-white border border-gray-300 px-2 py-0.5 rounded-sm truncate max-w-[220px]">
                  {suggestedPatch.target_file || suggestedPatch.filepath || "system_config"}
                </span>
              </div>
              
              <p className="text-xs text-gray-700 mb-3 leading-relaxed border-l-2 border-blue-500 pl-2">
                {suggestedPatch.description}
              </p>
              
              <div className="flex-1 bg-white border border-gray-300 rounded-sm p-3 overflow-auto font-mono text-[11px] mb-3">
                <pre className="text-gray-800 whitespace-pre-wrap leading-tight">
                  {suggestedPatch.diff}
                </pre>
              </div>

              <button 
                onClick={() => applyPatchAndRerun()}
                disabled={isSimulating}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium py-2 px-4 rounded-sm shadow-sm transition-all flex items-center justify-center space-x-2 text-sm"
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="animate-spin" size="{16}"/>
                    <span>Applying Patch...</span>
                  </>
                ) : (
                  <span>Apply Patch & Re-run</span>
                )}
              </button>
            </div>
          )}
        </aside>

        {/* Right Panel */}
        <main className="flex-1 flex flex-col relative bg-[#f4f5f7]">
          <ResilienceScorecard/>

          <div className="flex-1 relative">
            {currentTick ? (
              <TopologyCanvas edges="{currentTick.edges}" nodes="{currentTick.nodes}"/>
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full text-gray-500 space-y-3">
                {isSimulating ? (
                  <>
                    <Loader2 className="animate-spin text-blue-600" size="{28}"/>
                    <div className="font-medium text-sm">Processing architecture topology...</div>
                  </>
                ) : (
                  <div className="text-sm border border-gray-300 bg-white px-4 py-3 rounded-sm shadow-sm">
                    Waiting for failure scenario input to begin simulation.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-full bg-white border-t border-gray-300 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
            <TimelineScrubber/>
          </div>
        </main>
      </div>

      {/* User Guide Modal - Sharp corners, classic enterprise dialog */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40">
          <div className="bg-white border border-gray-300 shadow-xl w-[550px] flex flex-col rounded-sm">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#f8f9fa]">
              <h2 className="font-semibold text-gray-800 text-sm">Platform Documentation</h2>
              <button onClick={() => setIsGuideOpen(false)} className="text-gray-500 hover:text-gray-800 transition-colors">
                <X size="{18}"/>
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm text-gray-700 leading-relaxed">
              <p>The Bob Simulator relies on a locally generated `digital_twin_schema.json` file produced by the parsing engine. To test resilience:</p>
              <ul className="list-disc list-outside space-y-2 ml-4">
                <li><strong>Define Scenario:</strong> Use the terminal console to propose a natural-language structural failure (e.g., "Redis cache drops connections").</li>
                <li><strong>Analyze Topology:</strong> The system will parse the JSON schema and map the cascading blast radius across your services.</li>
                <li><strong>Scrub Timeline:</strong> Use the playback controls to step through the chronological failure propagation.</li>
                <li><strong>Apply Remediation:</strong> Review the generated unified diff patch, apply it, and compare the delta improvement in the scorecard.</li>
              </ul>
            </div>
            <div className="p-4 border-t border-gray-200 bg-[#f8f9fa] flex justify-end">
              <button onClick={() => setIsGuideOpen(false)} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 px-4 py-1.5 rounded-sm shadow-sm text-sm font-medium transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
