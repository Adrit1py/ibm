import type { DigitalTwinSchema } from '../../../shared/types/agent';

interface StoredRepo {
  graph: DigitalTwinSchema;
  lastReport?: any;
  createdAt: number;
}

// Process-lifetime, in-memory session store. Fine for a single-instance
// dev/demo deployment — resets on server restart and does not survive
// across multiple server instances/replicas. If this ever needs to run
// behind a load balancer or serverless functions with cold starts,
// swap this for Redis/DB-backed storage keyed the same way.
const repos = new Map<string, StoredRepo>();

export function saveRepo(repoId: string, graph: DigitalTwinSchema): void {
  repos.set(repoId, { graph, createdAt: Date.now() });
}

export function getRepo(repoId: string): StoredRepo | undefined {
  return repos.get(repoId);
}

export function saveLastReport(repoId: string, report: any): void {
  const entry = repos.get(repoId);
  if (entry) {
    entry.lastReport = report;
  }
}

export function deleteRepo(repoId: string): void {
  repos.delete(repoId);
}
