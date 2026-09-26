'use client';

import React, { useEffect } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import TopologyCanvas from '../components/TopologyCanvas';
import TimelineScrubber from '../components/TimelineScrubber';
import ScenarioConsole from '../components/ScenarioConsole';
import ResilienceScorecard from '../components/ResilienceScorecard';
import { Loader2 } from 'lucide-react';

export default function BobSimulatorDashboard() {
  const { 
    getCurrentTick, 
    result, 
    applyPatchAndRerun, 
    isSimulating 
  } = useSimulationStore();

  const currentTick = getCurrentTick();

  // Safely extract the first suggested patch (handling both the old mock format and the live Python format)
  const backendResult = result as any;
  const suggestedPatch = backendResult?.suggested_patches?.[0] || backendResult?.suggestedPatch;

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden font-sans">
      
      {/* Left Panel: 400px fixed width for the Console and Patch Data */}
      <aside className="w-[400px] flex flex-col z-10 shadow-xl shadow-black/50 border-r border-slate-800">
        <div className="flex-1 overflow-hidden">
          <ScenarioConsole />
        </div>

        {/* Patch Reviewer (Visible only if a patch exists and we are past T+0) */}
        {suggestedPatch && currentTick && currentTick.timeOffsetSec > 0 && (
          <div className="h-[280px] min-h-[280px] border-t border-slate-800 bg-slate-900 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suggested Fix</h3>
              <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded truncate max-w-[200px]" title={suggestedPatch.target_file || suggestedPatch.filepath}>
                {suggestedPatch.target_file || suggestedPatch.filepath || "system_config"}
              </span>
            </div>
            
            <p className="text-xs text-slate-300 mb-3 leading-relaxed line-clamp-2" title={suggestedPatch.description}>
              {suggestedPatch.description}
            </p>
            
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded p-3 overflow-x-auto overflow-y-auto font-mono text-[10px] mb-3">
              <pre className="text-emerald-400/90 whitespace-pre-wrap leading-tight">
                {suggestedPatch.diff}
              </pre>
            </div>

            <button 
              onClick={() => applyPatchAndRerun()}
              disabled={isSimulating}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-medium py-2 px-4 rounded transition-colors flex items-center justify-center space-x-2"
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

      {/* Right Panel: Flexible width for the Graph and Timeline */}
      <main className="flex-1 flex flex-col relative bg-slate-950">
        
        {/* The floating Resilience Scorecard HUD */}
        <ResilienceScorecard />

        {/* Topology Canvas Area */}
        <div className="flex-1 relative">
          {currentTick ? (
            <TopologyCanvas 
              nodes={currentTick.nodes} 
              edges={currentTick.edges} 
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full w-full text-slate-500 space-y-4">
              {isSimulating ? (
                <>
                  <Loader2 className="animate-spin text-blue-500" size={32} />
                  <div className="font-mono text-sm tracking-wide animate-pulse">Bob is analyzing architecture...</div>
                </>
              ) : (
                <div className="font-mono text-sm tracking-wide">Awaiting failure scenario prompt.</div>
              )}
            </div>
          )}
        </div>

        {/* Timeline Scrubber anchored to the bottom */}
        <div className="w-full">
          <TimelineScrubber />
        </div>
        
      </main>
      
    </div>
  );
}
