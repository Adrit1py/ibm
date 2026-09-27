export interface DigitalTwinNode {
  id: string;
  name: string;
  type: string;
  file_path?: string;
  code_snippet?: string;
  config?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DigitalTwinEdge {
  source: string;
  target: string;
  type?: string;
  protocol?: string;
  sync?: boolean;
}

export interface DigitalTwinSchema {
  nodes: DigitalTwinNode[];
  edges: DigitalTwinEdge[];
}

export type ComponentStatus = 'healthy' | 'degraded' | 'failing' | 'dead';
export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';
export type FailureMechanism = 'unhandled_exception' | 'direct_dependency_loss' | 'timeout_cascade' | 'retry_storm';
export type VulnerabilityType = 'missing_circuit_breaker' | 'infinite_retry_without_jitter' | 'tight_timeout' | 'unbounded_connection_pool' | 'missing_fallback' | 'missing_health_check' | 'synchronous_blocking_call' | 'single_point_of_failure';

export interface AffectedNode {
  node_id: string;
  node_name: string;
  status: ComponentStatus;
  impact_level: ImpactLevel;
  failure_reason: string;
  latency_impact_multiplier: number;
  error_rate_estimate: number;
  recovering: boolean;
}

export interface FailurePropagationStep {
  step_order: number;
  source_node_id: string;
  target_node_id: string;
  edge_protocol: string;
  mechanism: FailureMechanism;
  description: string;
  elapsed_ms_estimate: number;
}

export interface FailureChain {
  chain_id: string;
  trigger_event: string;
  root_node_id: string;
  steps: FailurePropagationStep[];
  cascading_blast_radius: number;
}

export interface RootCause {
  id: string;
  node_id: string;
  vulnerability_type: VulnerabilityType;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  file_target?: string;
  code_reference?: string;
}

export interface SuggestedPatch {
  id: string;
  root_cause_id: string;
  target_node_id: string;
  target_file: string;
  title: string;
  description: string;
  resilience_pattern: string;
  diff: string;
  estimated_blast_radius_reduction_pct: number;
}

/** Diagnostics produced by the Propagation subagent. */
export interface PropagationDiagnostics {
  analyzed_paths_count: number;
  depth_reached: number;
  notes: string[];
}

/** Diagnostics produced by the Latency/Bottleneck subagent. */
export interface BottleneckDiagnostics {
  saturated_pools: string[];
  max_latency_multiplier: number;
  queue_backlog_risk: boolean;
  notes: string[];
}

/** Diagnostics produced by the Recovery/Self-Healing subagent. */
export interface RecoveryDiagnostics {
  self_healing_capable: boolean;
  expected_recovery_time_ms: number;
  identified_recovery_barriers: string[];
  notes: string[];
}

export interface FailureAnalysisReport {
  scenario_prompt: string;
  parsed_scenario: any;
  /** ISO-8601 timestamp — required by core/engine's FailureAnalysisReportInput.analyzed_at and by the test suite. */
  analyzed_at: string;
  affected_nodes: AffectedNode[];
  failure_chains: FailureChain[];
  root_causes: RootCause[];
  suggested_patches: SuggestedPatch[];
  // Nested per-subagent, matching what core/engine's
  // SubagentDiagnosticsInput and the test suite both expect —
  // never flatten this.
  diagnostics: {
    propagation: PropagationDiagnostics;
    bottleneck: BottleneckDiagnostics;
    recovery: RecoveryDiagnostics;
  };
}

export interface AgentExecutionOptions {
  mock_mode?: boolean;
  timeout_ms?: number;
  /** 0.0–1.0 floor on root-cause severity rank (critical=1.0, high=0.75, medium=0.5, low=0.25). */
  confidence_threshold?: number;
}

export interface PatchEntry {
  file_path: string;
  diff_hunk: string;
  description: string;
}

export interface UnifiedGitDiff {
  raw_diff: string;
  files_changed: string[];
  total_additions: number;
  total_deletions: number;
  patches: PatchEntry[];
}
