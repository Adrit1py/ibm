/**
 * @fileoverview Shared Type Definitions for Bob Simulator — Agent Orchestration & Subagents
 *
 * This module defines the **public contract** between the Agent Orchestration
 * subsystem (Person 2, `core/agents/`) and all downstream consumers:
 *   - Person 3 — Simulation Engine (`core/engine/`)
 *   - Person 4 — Interactive Visualizer (`web/`)
 *
 * The types below mirror — but never extend — the read-only schema at
 * `schemas/digital_twin_schema.json`. If a field is missing from the
 * upstream schema, flag the gap to Person 1 instead of adding it here.
 *
 * @version 1.0.0
 * @module shared/types/agent
 */

// ---------------------------------------------------------------------------
// Digital Twin Graph — consumed from Person 1 (core/parser)
// ---------------------------------------------------------------------------

/** Known component types within the digital-twin graph. */
export type NodeType =
  | 'service'
  | 'database'
  | 'cache'
  | 'queue'
  | 'external_api'
  | 'gateway'
  | 'worker';

/** Known inter-component communication protocols. */
export type EdgeProtocol =
  | 'http'
  | 'grpc'
  | 'redis'
  | 'amqp'
  | 'sql'
  | 'event';

/** Operational configuration for a node's resilience posture. */
export interface NodeConfig {
  readonly timeout_ms?: number;
  readonly max_retries?: number;
  readonly retry_delay_ms?: number;
  readonly circuit_breaker?: boolean;
  readonly circuit_breaker_threshold?: number;
  readonly fallback_enabled?: boolean;
  readonly pool_size?: number;
  readonly [key: string]: unknown;
}

/** A single node (service, database, cache, etc.) in the digital-twin graph. */
export interface DigitalTwinNode {
  /** Unique stable identifier for this component. */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  /** Component category — known `NodeType` or a custom string for extensions. */
  readonly type: NodeType | (string & {});
  /** Runtime environment (e.g. "node:18", "python:3.11", "go:1.21"). */
  readonly runtime?: string;
  /** Source file path relative to the project root. */
  readonly file_path?: string;
  /** Representative source code snippet for context. */
  readonly code_snippet?: string;
  /** Operational configuration governing resilience behavior. */
  readonly config?: NodeConfig;
  /** Arbitrary extension metadata from the parser. */
  readonly metadata?: Record<string, unknown>;
}

/** A directed edge representing a dependency between two nodes. */
export interface DigitalTwinEdge {
  /** Optional unique identifier for this edge. */
  readonly id?: string;
  /** Node ID of the caller / upstream component. */
  readonly source: string;
  /** Node ID of the callee / downstream dependency. */
  readonly target: string;
  /** Communication protocol used across this edge. */
  readonly protocol?: EdgeProtocol | (string & {});
  /** Whether this call is synchronous (blocking). Defaults to `true`. */
  readonly sync?: boolean;
  /** Timeout budget allocated for this specific call, in milliseconds. */
  readonly timeout_ms?: number;
  /** Whether this edge sits on the critical path of request processing. */
  readonly critical?: boolean;
  /** Arbitrary extension metadata from the parser. */
  readonly metadata?: Record<string, unknown>;
}

/**
 * The complete digital-twin graph produced by Person 1's parser.
 *
 * This is the **sole input** to the agent orchestration system.
 * Treat as read-only — never mutate in place.
 */
export interface DigitalTwinSchema {
  /** Schema version string (e.g. "1.0.0"). */
  readonly version?: string;
  /** Human-readable project name. */
  readonly project_name?: string;
  /** All discovered components in the target application. */
  readonly nodes: readonly DigitalTwinNode[];
  /** All dependency relationships between components. */
  readonly edges: readonly DigitalTwinEdge[];
  /** Top-level metadata from the parser. */
  readonly metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Failure Analysis Output — produced by Person 2 (core/agents)
// ---------------------------------------------------------------------------

/** Health status of a component during a failure scenario. */
export type ComponentStatus = 'healthy' | 'degraded' | 'failing' | 'dead';

/** Severity / impact classification. */
export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

/** A component affected by the injected failure scenario. */
export interface AffectedNode {
  /** ID of the affected component (matches `DigitalTwinNode.id`). */
  readonly node_id: string;
  /** Human-readable name (matches `DigitalTwinNode.name`). */
  readonly node_name: string;
  /** Current health status under the failure scenario. */
  readonly status: ComponentStatus;
  /** Assessed blast-radius impact level. */
  readonly impact_level: ImpactLevel;
  /** Human-readable explanation of why this node is affected. */
  readonly failure_reason: string;
  /** Multiplier on baseline p99 latency (1.0 = no change). */
  readonly latency_impact_multiplier: number;
  /** Estimated error rate under the scenario (0.0–1.0). */
  readonly error_rate_estimate: number;
  /** Whether this node can self-heal with its current configuration. */
  readonly recovering: boolean;
}

/** The mechanism through which a failure propagates across an edge. */
export type FailureMechanism =
  | 'timeout_cascade'
  | 'connection_pool_exhaustion'
  | 'unhandled_exception'
  | 'retry_storm'
  | 'thread_starvation'
  | 'cache_stampede'
  | 'direct_dependency_loss';

/** A single hop in a failure propagation chain. */
export interface FailurePropagationStep {
  /** Ordinal position within the chain (1-based). */
  readonly step_order: number;
  /** Node ID where the failure originates for this hop. */
  readonly source_node_id: string;
  /** Node ID that receives the cascading failure. */
  readonly target_node_id: string;
  /** Protocol across the edge (mirrors `DigitalTwinEdge.protocol`). */
  readonly edge_protocol?: string;
  /** The propagation mechanism causing this hop. */
  readonly mechanism: FailureMechanism;
  /** Human-readable description of this propagation step. */
  readonly description: string;
  /** Estimated wall-clock milliseconds since the initial failure event. */
  readonly elapsed_ms_estimate: number;
}

/** A complete chain of failure propagation from root cause to blast radius. */
export interface FailureChain {
  /** Unique chain identifier. */
  readonly chain_id: string;
  /** The user's original "what if" scenario text. */
  readonly trigger_event: string;
  /** Node ID where this chain originates. */
  readonly root_node_id: string;
  /** Ordered sequence of propagation hops. */
  readonly steps: readonly FailurePropagationStep[];
  /** Total count of distinct nodes affected by this chain. */
  readonly cascading_blast_radius: number;
}

/** Categorization of architectural vulnerability types. */
export type VulnerabilityType =
  | 'missing_circuit_breaker'
  | 'tight_timeout'
  | 'infinite_retry_without_jitter'
  | 'missing_fallback'
  | 'single_point_of_failure'
  | 'unbounded_connection_pool'
  | 'synchronous_blocking_call'
  | 'missing_health_check';

/** An identified architectural vulnerability (root cause). */
export interface RootCause {
  /** Unique root-cause identifier. */
  readonly id: string;
  /** Node ID exhibiting this vulnerability. */
  readonly node_id: string;
  /** Category of the vulnerability. */
  readonly vulnerability_type: VulnerabilityType;
  /** Human-readable explanation of the vulnerability. */
  readonly description: string;
  /** Assessed severity of this vulnerability. */
  readonly severity: ImpactLevel;
  /** File path in the project where the fix should be applied. */
  readonly file_target?: string;
  /** Relevant code snippet for context. */
  readonly code_reference?: string;
}

/** Known resilience patterns that patches can implement. */
export type ResiliencePattern =
  | 'circuit_breaker'
  | 'exponential_backoff_jitter'
  | 'fallback_cache'
  | 'graceful_degradation'
  | 'bulkhead_isolation'
  | 'timeout_budgeting'
  | 'health_check_endpoint';

/** A suggested code patch to remediate a root cause. */
export interface SuggestedPatch {
  /** Unique patch identifier. */
  readonly id: string;
  /** The root cause this patch addresses. */
  readonly root_cause_id: string;
  /** Target node ID. */
  readonly target_node_id: string;
  /** File path where the patch should be applied. */
  readonly target_file: string;
  /** Short title describing the patch. */
  readonly title: string;
  /** Detailed description of what the patch does. */
  readonly description: string;
  /** The resilience pattern being applied. */
  readonly resilience_pattern: ResiliencePattern;
  /** The patch content in unified git diff format. */
  readonly diff: string;
  /** Estimated percentage reduction in blast-radius (0–100). */
  readonly estimated_blast_radius_reduction_pct: number;
}

/** Diagnostic telemetry from each specialized subagent. */
export interface SubagentDiagnostics {
  readonly propagation: {
    readonly analyzed_paths_count: number;
    readonly depth_reached: number;
    readonly notes: readonly string[];
  };
  readonly bottleneck: {
    readonly saturated_pools: readonly string[];
    readonly max_latency_multiplier: number;
    readonly queue_backlog_risk: boolean;
    readonly notes: readonly string[];
  };
  readonly recovery: {
    readonly self_healing_capable: boolean;
    readonly expected_recovery_time_ms: number;
    readonly identified_recovery_barriers: readonly string[];
    readonly notes: readonly string[];
  };
}

/**
 * The complete failure analysis report — the primary output of the
 * agent orchestration system.
 *
 * Consumed by Person 3 (Simulation Engine) and Person 4 (Web UI).
 */
export interface FailureAnalysisReport {
  /** The original natural-language "what if" scenario. */
  readonly scenario_prompt: string;
  /** ISO 8601 timestamp of when analysis was performed. */
  readonly analyzed_at: string;
  /** All nodes affected by the failure scenario. */
  readonly affected_nodes: readonly AffectedNode[];
  /** All traced failure propagation chains. */
  readonly failure_chains: readonly FailureChain[];
  /** All identified architectural vulnerabilities. */
  readonly root_causes: readonly RootCause[];
  /** All suggested code patches for remediation. */
  readonly suggested_patches: readonly SuggestedPatch[];
  /** Optional diagnostic telemetry from each subagent. */
  readonly diagnostics?: SubagentDiagnostics;
}

// ---------------------------------------------------------------------------
// Patch / Diff Output — consumed by Person 4 (web/)
// ---------------------------------------------------------------------------

/** A single file-level patch entry within a unified diff. */
export interface PatchEntry {
  /** Path to the file being patched. */
  readonly file_path: string;
  /** The raw unified-diff hunk for this file. */
  readonly diff_hunk: string;
  /** Human-readable description of the change. */
  readonly description: string;
}

/** A compiled unified git diff representing all suggested patches. */
export interface UnifiedGitDiff {
  /** Complete raw diff output (concatenation of all hunks). */
  readonly raw_diff: string;
  /** Deduplicated list of files modified. */
  readonly files_changed: readonly string[];
  /** Total lines added across all patches. */
  readonly total_additions: number;
  /** Total lines removed across all patches. */
  readonly total_deletions: number;
  /** Individual patch entries per file. */
  readonly patches: readonly PatchEntry[];
}

// ---------------------------------------------------------------------------
// Execution Options — controls for the orchestration runner
// ---------------------------------------------------------------------------

/** Runtime configuration options for the agent orchestration loop. */
export interface AgentExecutionOptions {
  /** When true, use the deterministic mock LLM provider (default: true). */
  readonly mock_mode?: boolean;
  /** Maximum subagents to dispatch concurrently (default: 3). */
  readonly max_parallel_agents?: number;
  /** Minimum confidence threshold to include a root cause (0.0–1.0). */
  readonly confidence_threshold?: number;
  /** Overall timeout for the analysis run, in milliseconds. */
  readonly timeout_ms?: number;
}
