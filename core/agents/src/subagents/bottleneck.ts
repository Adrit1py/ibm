/**
 * @fileoverview Latency & Bottleneck Subagent — resource saturation analysis.
 *
 * Inspects every node in the digital-twin graph for connection pool bounds,
 * timeout budgets, retry policies, and queue backlog exposure. Produces
 * root-cause entries for each detected vulnerability.
 *
 * This is a **pure analysis** module — no side effects, no I/O beyond
 * the injected LLM provider.
 *
 * @module core/agents/subagents/bottleneck
 */

import type {
  DigitalTwinSchema,
  DigitalTwinNode,
  RootCause,
} from '../../../../shared/types/agent.ts';
import type { LLMProvider } from '../llm/provider.ts';

/** Threshold above which a connection pool is considered "unbounded". */
const POOL_SIZE_SAFE_LIMIT = 100;

/** Timeout below which a budget is considered "tight". */
const TIGHT_TIMEOUT_THRESHOLD_MS = 500;

/** Retry count above which retries without jitter are flagged. */
const RETRY_COUNT_THRESHOLD = 3;

/** Result payload from the bottleneck analysis. */
export interface BottleneckAnalysisResult {
  readonly root_causes: RootCause[];
  readonly diagnostics: {
    readonly saturated_pools: string[];
    readonly max_latency_multiplier: number;
    readonly queue_backlog_risk: boolean;
    readonly notes: string[];
  };
}

/**
 * Analyzes timeout budgets, connection pool saturation, retry policies,
 * and latency amplification bottlenecks across the architecture graph.
 */
export class LatencyBottleneckSubagent {
  private readonly llm: LLMProvider;

  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  /**
   * Runs the bottleneck analysis pass.
   *
   * @param digitalTwin   - The complete architecture graph.
   * @param targetNodeIds - IDs of nodes directly affected by the failure.
   * @param scenario      - The user's natural-language failure scenario.
   * @returns Root causes, saturated pool data, and latency diagnostics.
   */
  async analyze(
    digitalTwin: DigitalTwinSchema,
    targetNodeIds: string[],
    scenario: string,
    parsedLatencyMultiplier?: number,
  ): Promise<BottleneckAnalysisResult> {
    const rootCauses: RootCause[] = [];
    const saturatedPools: string[] = [];
    const notes: string[] = [];
    let queueBacklogRisk = false;

    const scenarioLower = scenario.toLowerCase();
    const isLatencyScenario =
      scenarioLower.includes('slow') ||
      scenarioLower.includes('latency') ||
      scenarioLower.includes('timeout') ||
      scenarioLower.includes('delay') ||
      scenarioLower.includes('spike');

    const targetSet = new Set(targetNodeIds);

    for (const node of digitalTwin.nodes) {
      const config = (node.config ?? (node.metadata?.['config'] as Record<string, unknown>) ?? {}) as NonNullable<DigitalTwinNode['config']>;
      const isInScope = targetSet.has(node.id) || isLatencyScenario;

      // --- Check unbounded connection pools ---
      if (isInScope) {
        this.checkPoolBounds(node, config, rootCauses, saturatedPools, notes);
      }

      // --- Check tight timeouts (applies globally, not scoped) ---
      this.checkTightTimeout(node, config, rootCauses);

      // --- Check aggressive retries without jitter ---
      this.checkRetryPolicy(node, config, rootCauses);
      if (config.max_retries && config.max_retries > RETRY_COUNT_THRESHOLD && !config.retry_delay_ms) {
        queueBacklogRisk = true;
      }

      // --- Flag queue/worker backlog risk ---
      if (node.type === 'queue' || node.type === 'worker') {
        queueBacklogRisk = true;
        notes.push(`Worker/queue backlog risk flagged for ${node.name}.`);
      }
    }

    const maxLatencyMultiplier =
      parsedLatencyMultiplier !== undefined
        ? parsedLatencyMultiplier
        : isLatencyScenario
          ? 10.0
          : 3.5;

    // LLM enrichment: ask for additional latency amplification paths
    const llmNotes = await this.enrichWithLLM(scenario, digitalTwin, targetNodeIds);
    notes.push(...llmNotes);

    return {
      root_causes: rootCauses,
      diagnostics: {
        saturated_pools: saturatedPools,
        max_latency_multiplier: maxLatencyMultiplier,
        queue_backlog_risk: queueBacklogRisk,
        notes,
      },
    };
  }

  /**
   * Asks the LLM to surface latency amplification risks not captured by
   * static threshold checks — e.g. N+1 query patterns, thundering herd,
   * or GC pressure under load.
   */
  private async enrichWithLLM(
    scenario: string,
    digitalTwin: DigitalTwinSchema,
    targetNodeIds: string[],
  ): Promise<string[]> {
    if (targetNodeIds.length === 0) return [];

    const targets = targetNodeIds
      .map((id) => {
        const n = digitalTwin.nodes.find((node) => node.id === id);
        return n ? `${n.name} (${n.type})` : id;
      })
      .join(', ');

    const prompt =
      `Scenario: "${scenario}"\n` +
      `Target nodes: ${targets}\n\n` +
      `List up to 3 latency amplification risks specific to this scenario ` +
      `(e.g. thundering herd on cache miss, N+1 DB queries under timeout pressure, ` +
      `GC pause cascade). Be concise. ` +
      `Return as a JSON array of strings: ["risk1", "risk2"]`;

    try {
      const risks = await this.llm.generateStructuredJson<string[]>(
        prompt,
        'string[] — array of brief latency risk descriptions',
        { maxTokens: 150, temperature: 0.3 },
      );
      return Array.isArray(risks) ? risks.slice(0, 3) : [];
    } catch {
      return [];
    }
  }

  /** Flags nodes with unbounded or excessively large connection pools. */
  private checkPoolBounds(
    node: DigitalTwinNode,
    config: NonNullable<DigitalTwinNode['config']>,
    rootCauses: RootCause[],
    saturatedPools: string[],
    notes: string[],
  ): void {
    const poolSize = config.pool_size;

    if (poolSize === undefined || poolSize > POOL_SIZE_SAFE_LIMIT) {
      saturatedPools.push(node.id);
      const poolDescription = poolSize === undefined
        ? `Node ${node.name} has no connection pool limit (unbounded), risking thread exhaustion under load.`
        : `Node ${node.name} has an oversized connection pool (${poolSize} connections) ` +
          `exceeding the safe limit of ${POOL_SIZE_SAFE_LIMIT}, risking thread starvation under latency spikes.`;
      rootCauses.push({
        id: `rc-pool-${node.id}`,
        node_id: node.id,
        vulnerability_type: 'unbounded_connection_pool',
        description: poolDescription,
        severity: 'high',
        file_target: node.file_path,
        code_reference: node.code_snippet,
      });
      notes.push(`Identified potential thread exhaustion on ${node.name}.`);
    }
  }

  /** Flags nodes with excessively tight timeout budgets.
   *
   * Skips cache and queue nodes — sub-500ms timeouts are intentional and
   * correct for those component types (fast-fail on cache miss is desirable).
   */
  private checkTightTimeout(
    node: DigitalTwinNode,
    config: NonNullable<DigitalTwinNode['config']>,
    rootCauses: RootCause[],
  ): void {
    // Cache and queue timeouts are deliberately short — not a vulnerability
    if (node.type === 'cache' || node.type === 'queue') return;

    const timeoutMs = config.timeout_ms;

    if (timeoutMs !== undefined && timeoutMs < TIGHT_TIMEOUT_THRESHOLD_MS) {
      rootCauses.push({
        id: `rc-timeout-${node.id}`,
        node_id: node.id,
        vulnerability_type: 'tight_timeout',
        description:
          `Node ${node.name} has an aggressive timeout (${timeoutMs}ms) ` +
          `without dynamic backoff, causing premature request cancellation.`,
        severity: 'medium',
        file_target: node.file_path,
      });
    }
  }

  /** Flags nodes with aggressive retries that lack jitter / backoff. */
  private checkRetryPolicy(
    node: DigitalTwinNode,
    config: NonNullable<DigitalTwinNode['config']>,
    rootCauses: RootCause[],
  ): void {
    const maxRetries = config.max_retries;
    const hasJitter = config.retry_delay_ms !== undefined;

    if (maxRetries !== undefined && maxRetries > RETRY_COUNT_THRESHOLD && !hasJitter) {
      rootCauses.push({
        id: `rc-retry-${node.id}`,
        node_id: node.id,
        vulnerability_type: 'infinite_retry_without_jitter',
        description:
          `Node ${node.name} configured with ${maxRetries} retries ` +
          `without jitter, prone to amplifying downstream outages.`,
        severity: 'high',
        file_target: node.file_path,
      });
    }
  }
}
