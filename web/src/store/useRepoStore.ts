import { create } from 'zustand';

interface RepoStore {
  repoId: string | null;
  nodeCount: number;
  edgeCount: number;
  setRepo: (id: string, nodeCount: number, edgeCount: number) => void;
  reset: () => void;
}

export const useRepoStore = create<RepoStore>((set) => ({
  repoId: null,
  nodeCount: 0,
  edgeCount: 0,
  setRepo: (repoId, nodeCount, edgeCount) => set({ repoId, nodeCount, edgeCount }),
  reset: () => set({ repoId: null, nodeCount: 0, edgeCount: 0 }),
}));
