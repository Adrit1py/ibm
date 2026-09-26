
export type ComponentStatus = 'healthy' | 'degraded' | 'failed';

export interface SystemNode {
  id: string;
  type: 'service' | 'database' | 'queue' | 'cache' | 'external';
  label: string;
  status: ComponentStatus;
  metadata?: Record<string, any>;
}

export interface SystemEdge {
  id: string;
  source: string;
  target: string;
  type: 'sync' | 'async' | 'failover';
  isFailing: boolean;
}

export interface SimulationTick {
  timeOffsetSec: number;
  nodes: SystemNode[];
  edges: SystemEdge[];
  agentLogs: string[];
}

export interface SimulationResult {
  scenarioId: string;
  scenarioDescription: string;
  timeline: SimulationTick[];
  suggestedPatch?: {
    filepath: string;
    diff: string;
    description: string;
  };
}
