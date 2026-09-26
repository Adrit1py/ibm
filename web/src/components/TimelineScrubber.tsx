import React, { useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';

export default function TimelineScrubber() {
  const { 
    result, 
    currentTickIndex, 
    isPlaying, 
    setTickIndex, 
    togglePlay,
    getCurrentTick 
  } = useSimulationStore();

  const maxTicks = result?.timeline.length ? result.timeline.length - 1 : 0;
  const currentTick = getCurrentTick();

  // Handle the automatic playback interval
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isPlaying && currentTickIndex < maxTicks) {
      intervalId = setInterval(() => {
        setTickIndex(currentTickIndex + 1);
      }, 1000); // 1-second simulation steps
    } else if (isPlaying && currentTickIndex >= maxTicks) {
      // Auto-pause when reaching the end of the timeline
      togglePlay();
    }

    return () => clearInterval(intervalId);
  }, [isPlaying, currentTickIndex, maxTicks, setTickIndex, togglePlay]);

  // If no simulation is loaded, render a disabled placeholder
  if (!result || maxTicks === 0) {
    return (
      <div className="w-full h-24 bg-slate-900 border-t border-slate-800 p-6 flex flex-col justify-center opacity-50">
        <div className="text-center text-slate-500 font-mono text-sm">
          No active simulation data. Waiting for scenario ingestion...
        </div>
      </div>
    );
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTickIndex(Number(e.target.value));
  };

  const handleStepBack = () => setTickIndex(Math.max(0, currentTickIndex - 1));
  const handleStepForward = () => setTickIndex(Math.min(maxTicks, currentTickIndex + 1));

  return (
    <div className="w-full h-24 bg-slate-900 border-t border-slate-800 p-4 px-6 flex flex-col justify-center shadow-lg z-10 relative">
      
      {/* Time Markers Header */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-mono text-slate-400">T+0s (Impact)</span>
        <span className="text-sm font-bold text-slate-100 tracking-widest bg-slate-800 px-3 py-1 rounded-md border border-slate-700 shadow-inner">
          T+{currentTick?.timeOffsetSec || 0}s
        </span>
        <span className="text-xs font-mono text-slate-400">
          T+{result.timeline[maxTicks].timeOffsetSec}s (End)
        </span>
      </div>

      {/* Controls & Scrubber Slider */}
      <div className="flex items-center space-x-4">
        {/* Playback Controls */}
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleStepBack}
            disabled={currentTickIndex === 0}
            className="text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <SkipBack size={20} />
          </button>
          
          <button 
            onClick={togglePlay}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-full p-2 h-10 w-10 flex items-center justify-center transition-all shadow-md shadow-blue-900/50"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </button>
          
          <button 
            onClick={handleStepForward}
            disabled={currentTickIndex === maxTicks}
            className="text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <SkipForward size={20} />
          </button>
        </div>

        {/* Range Input Slider */}
        <input 
          type="range" 
          min={0} 
          max={maxTicks} 
          value={currentTickIndex}
          onChange={handleSliderChange}
          className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          aria-label="Simulation Time Scrubber"
        />
      </div>
    </div>
  );
}
