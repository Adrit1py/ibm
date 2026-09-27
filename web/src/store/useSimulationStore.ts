// web/src/store/useSimulationStore.ts
import { create } from 'zustand';
import type { SimulationResult, SimulationTick } from '../../../shared/types/digital_twin';

interface SimStore {
  result: SimulationResult | null;
  currentTickIndex: number;
  isPlaying: boolean;
  isSimulating: boolean;
  liveLogs: string[];
  error: string | null;

  loadSimulation: (data: SimulationResult) => void;
  setTickIndex: (index: number) => void;
  togglePlay: () => void;
  getCurrentTick: () => SimulationTick | null;

  // Real API Integration Methods — both require a repoId from useRepoStore
  runSimulation: (prompt: string, repoId: string) => Promise<void>;
  applyPatchAndRerun: (repoId: string) => Promise<void>;
}

export const useSimulationStore = create<SimStore>((set, get) => ({
  result: null,
  currentTickIndex: 0,
  isPlaying: false,
  isSimulating: false,
  liveLogs: [],
  error: null,

  loadSimulation: (data) =>
    set({
      result: data,
      currentTickIndex: 0,
      isPlaying: false,
      isSimulating: false,
      error: null,
    }),

  setTickIndex: (index) => set({ currentTickIndex: index }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  getCurrentTick: () => {
    const { result, currentTickIndex } = get();
    if (!result || !result.timeline.length) return null;
    return result.timeline[currentTickIndex];
  },

  runSimulation: async (prompt: string, repoId: string) => {
    if (!repoId) {
      set({ error: 'No repository connected.' });
      return;
    }

    set({
      isSimulating: true,
      result: null,
      error: null,
      liveLogs: [`[User] ${prompt}`, '[System] Running multi-agent failure analysis...'],
    });

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, repoId }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Route handler returns { error: string } on failure
        throw new Error(data?.error || `Request failed with status ${res.status}`);
      }

      set({ result: data, isSimulating: false, error: null });
    } catch (err: any) {
      const message = err?.message ?? 'Unknown error running simulation';
      set((state) => ({
        isSimulating: false,
        error: message,
        liveLogs: [...state.liveLogs, `[Error] ${message}`],
      }));
    }
  },

  applyPatchAndRerun: async (repoId: string) => {
    if (!repoId) {
      set({ error: 'No repository connected.' });
      return;
    }

    set({
      isSimulating: true,
      error: null,
      liveLogs: ['[System] Applying patches and re-running simulation...'],
    });
    try {
      const res = await fetch('/api/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `Request failed with status ${res.status}`);
      }

      // data.patched contains the new SimulationRunResult from Python
      set({ result: data.patched, isSimulating: false, error: null });
    } catch (err: any) {
      const message = err?.message ?? 'Unknown error applying patch';
      set((state) => ({
        isSimulating: false,
        error: message,
        liveLogs: [...state.liveLogs, `[Error] ${message}`],
      }));
    }
  },
}));
