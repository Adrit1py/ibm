export type ComponentStatus = 'healthy' | 'degraded' | 'failing' | 'dead' | 'recovering';

export interface SystemNode {
  id: string;
  name: string;
  type: string;
  status: ComponentStatus;
  latency_multiplier: number;
  error_rate: number;
  is_failing: boolean;
  recovering: boolean;
  failure_reason?: string | null;
  metadata?: Record<string, any>;
}

export interface SystemEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  is_failing: boolean;
  latency_ms?: number | null;
  mechanism?: string | null;
}

export interface SimulationTick {
  timeOffsetSec: number;
  nodes: SystemNode[];
  edges: SystemEdge[];
  agentLogs: string[];
  summary?: string | null;
}

export interface SimulationResult {
  scenarioId?: string;
  scenarioDescription?: string;
  timeline: SimulationTick[];
  suggestedPatch?: {
    filepath: string;
    diff: string;
    description: string;
  };
  resilience_score?: any;
  blast_radius?: any;
  is_patched_run?: boolean;
  suggested_patches?: any[];
  [key: string]: any;
}
