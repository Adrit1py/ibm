// web/src/store/useSimulationStore.ts
import { create } from 'zustand';
import type { SimulationResult, SimulationTick } from '../../../shared/types/digital_twin';

interface SimStore {
  result: SimulationResult | null;
  currentTickIndex: number;
  isPlaying: boolean;
  isSimulating: boolean;
  liveLogs: string[];
  
  loadSimulation: (data: SimulationResult) => void;
  setTickIndex: (index: number) => void;
  togglePlay: () => void;
  getCurrentTick: () => SimulationTick | null;
  
  // Real API Integration Methods
  runSimulation: (prompt: string) => Promise<void>;
  applyPatchAndRerun: () => Promise<void>;
}

export const useSimulationStore = create<SimStore>((set, get) => ({
  result: null,
  currentTickIndex: 0,
  isPlaying: false,
  isSimulating: false,
  liveLogs: [],
  
  loadSimulation: (data) => set({ 
    result: data, 
    currentTickIndex: 0, 
    isPlaying: false, 
    isSimulating: false 
  }),
  
  setTickIndex: (index) => set({ currentTickIndex: index }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  getCurrentTick: () => {
    const { result, currentTickIndex } = get();
    if (!result || !result.timeline.length) return null;
    return result.timeline[currentTickIndex];
  },

  runSimulation: async (prompt: string) => {
    set({ 
      isSimulating: true, 
      result: null, 
      liveLogs: [`[User] ${prompt}`, "[System] Connecting to Python Engine..."] 
    });

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) throw new Error("Failed to fetch simulation from engine");

      const data = await res.json();
      set({ result: data, isSimulating: false, liveLogs: [] });
    } catch (err: any) {
      set({ 
        isSimulating: false, 
        liveLogs: [...get().liveLogs, `[Error] ${err.message}`] 
      });
    }
  },

  applyPatchAndRerun: async () => {
    set({ isSimulating: true, liveLogs: ["[System] Applying patches and re-running simulation..."] });
    try {
      const res = await fetch('/api/patch', { method: 'POST' });
      if (!res.ok) throw new Error("Failed to apply patches");
      
      const data = await res.json();
      // data.patched contains the new SimulationRunResult from Python
      set({ result: data.patched, isSimulating: false, liveLogs: [] });
    } catch (err: any) {
      set({ isSimulating: false, liveLogs: [...get().liveLogs, `[Error] ${err.message}`] });
    }
  }
}));
