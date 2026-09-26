
'use client';

import React, { useEffect } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { mockRedisFailureSim } from '../mocks/simulation_fixture';
import TopologyCanvas from '../components/TopologyCanvas';
import TimelineScrubber from '../components/TimelineScrubber';
import ScenarioConsole from '../components/ScenarioConsole';

export default function BobSimulatorDashboard() {
  const { loadSimulation, getCurrentTick } = useSimulationStore();

  // Initialize the visualizer with our mock data on mount
  useEffect(() => {
    loadSimulation(mockRedisFailureSim);
  }, [loadSimulation]);

  const currentTick = getCurrentTick();

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden font-sans">
      
      {/* Left Panel: 400px fixed width for the Console and Patch Data */}
      <aside className="w-[400px] flex flex-col z-10 shadow-xl shadow-black/50">
        <div className="flex-1">
          <ScenarioConsole />
        </div>

        {/* Patch Reviewer (Visible only if a patch exists and we are past T+0) */}
        {currentTick && currentTick.timeOffsetSec > 0 && mockRedisFailureSim.suggestedPatch && (
          <div className="h-64 border-t border-slate-800 bg-slate-900 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suggested Fix</h3>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                {mockRedisFailureSim.suggestedPatch.filepath}
              </span>
            </div>
            
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              {mockRedisFailureSim.suggestedPatch.description}
            </p>
            
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded p-3 overflow-x-auto overflow-y-auto font-mono text-xs">
              <pre className="text-emerald-400/90 whitespace-pre-wrap">
                {mockRedisFailureSim.suggestedPatch.diff}
              </pre>
            </div>
          </div>
        )}
      </aside>

      {/* Right Panel: Flexible width for the Graph and Timeline */}
      <main className="flex-1 flex flex-col relative">
        
        {/* Topology Canvas Area */}
        <div className="flex-1 relative">
          {currentTick ? (
            <TopologyCanvas 
              nodes={currentTick.nodes} 
              edges={currentTick.edges} 
            />
          ) : (
            <div className="flex items-center justify-center h-full w-full text-slate-500">
              Initializing Digital Twin...
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
