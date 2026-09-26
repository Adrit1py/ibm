
import { create } from 'zustand';
import type { SimulationResult, SimulationTick } from '../../../shared/types/digital_twin';

interface SimStore {
  result: SimulationResult | null;
  currentTickIndex: number;
  isPlaying: boolean;
  
  loadSimulation: (data: SimulationResult) => void;
  setTickIndex: (index: number) => void;
  togglePlay: () => void;
  getCurrentTick: () => SimulationTick | null;
}

export const useSimulationStore = create<SimStore>((set, get) => ({
  result: null,
  currentTickIndex: 0,
  isPlaying: false,
  
  loadSimulation: (data) => set({ result: data, currentTickIndex: 0, isPlaying: false }),
  
  setTickIndex: (index) => set({ currentTickIndex: index }),
  
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  getCurrentTick: () => {
    const { result, currentTickIndex } = get();
    if (!result || !result.timeline.length) return null;
    return result.timeline[currentTickIndex];
  }
}));
