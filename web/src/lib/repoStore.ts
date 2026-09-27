import type { DigitalTwinSchema } from '../../../shared/types/agent';

interface StoredRepo {
  graph: DigitalTwinSchema;
  lastReport?: any;
  createdAt: number;
}

const repos = new Map<string, StoredRepo>();

export function saveRepo(repoId: string, graph: DigitalTwinSchema) {
  repos.set(repoId, { graph, createdAt: Date.now() });
}
export function getRepo(repoId: string): StoredRepo | undefined {
  return repos.get(repoId);
}
export function saveLastReport(repoId: string, report: any) {
  const entry = repos.get(repoId);
  if (entry) entry.lastReport = report;
}
