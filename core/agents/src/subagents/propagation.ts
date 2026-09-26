/**
 * @fileoverview Propagation Subagent — traces cascading failure blast radius.
 *
 * Given a set of "seed" failure nodes, this subagent performs a reverse
 * breadth-first traversal of the dependency graph to determine which
 * upstream callers are affected, by what mechanism, and in what order.
 *
 * This is a **pure graph analysis** module — it has no side effects,
 * no I/O beyond the injected LLM, and no dependency on external state.
 *
 * @module core/agents/subagents/propagation
 */

import type {
  DigitalTwinSchema,
  DigitalTwinNode,
  DigitalTwinEdge,
  AffectedNode,
  FailureChain,
  FailurePropagationStep,
  FailureMechanism,
  ComponentStatus,
  ImpactLevel,
} from '../../../../shared/types/agent.ts';
import type { LLMProvider } from '../llm/provider.ts';

/** Result payload from the propagation analysis. */
export interface PropagationAnalysisResult {
  readonly affected_nodes: AffectedNode[];
  readonly failure_chains: FailureChain[];
  readonly diagnostics: {
    readonly analyzed_paths_count: number;
    readonly depth_reached: number;
    readonly notes: string[];
  };
}

/** Severity rank map for comparing cascading impact levels. */
const STATUS_SEVERITY_RANK: Record<ComponentStatus, number> = {
  healthy: 0,
  degraded: 1,
  failing: 2,
  dead: 3,
};

const IMPACT_SEVERITY_RANK: Record<ImpactLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/** Internal BFS queue item. */
interface TraversalFrame {
  readonly nodeId: string;
  readonly depth: number;
  readonly chainSteps: FailurePropagationStep[];
}

/**
 * Traces failure propagation across the dependency graph.
 *
 * Performs a reverse BFS from each seed node, following incoming edges
 * (i.e. "who calls me?") to discover upstream callers that would be
 * impacted by the seed node's failure.
 */
export class PropagationSubagent {
  private readonly llm: LLMProvider;

  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  /**
   * Analyzes failure propagation across the dependency graph.
   *
   * @param digitalTwin  - The complete architecture graph.
   * @param targetNodeIds - IDs of the initially-failed seed nodes.
   * @param scenario      - The user's natural-language failure scenario.
   * @returns Propagation analysis with affected nodes, chains, and diagnostics.
   */
  async analyze(
    digitalTwin: DigitalTwinSchema,
    targetNodeIds: string[],
    scenario: string,
  ): Promise<PropagationAnalysisResult> {
    // Build lookup structures
    const nodesMap = new Map<string, DigitalTwinNode>(
      digitalTwin.nodes.map((n) => [n.id, n]),
    );

    const incomingEdges = this.buildEdgeIndex(
      digitalTwin.edges,
      (e) => e.target,
    );

    // Accumulation state
    const affectedMap = new Map<string, AffectedNode>();
    const failureChains: FailureChain[] = [];
    const emittedChainIds = new Set<string>();
    let maxDepth = 0;
    let pathsCount = 0;
    const notes: string[] = [];

    for (const targetId of targetNodeIds) {
      const node = nodesMap.get(targetId);
      const nodeName = node?.name ?? targetId;

      // Seed node is marked as dead — it's the direct failure point
      affectedMap.set(targetId, {
        node_id: targetId,
        node_name: nodeName,
        status: 'dead',
        impact_level: 'critical',
        failure_reason: `Direct point of failure: "${scenario}"`,
        latency_impact_multiplier: 10.0,
        error_rate_estimate: 1.0,
        recovering: false,
      });

      // BFS reverse traversal: who depends on the failing node?
      const queue: TraversalFrame[] = [
        { nodeId: targetId, depth: 0, chainSteps: [] },
      ];
      const visited = new Set<string>([targetId]);

      while (queue.length > 0) {
        const current = queue.shift()!;
        pathsCount++;
        if (current.depth > maxDepth) maxDepth = current.depth;

        const callerEdges = incomingEdges.get(current.nodeId) ?? [];

        for (const edge of callerEdges) {
          const callerId = edge.source;
          const callerNode = nodesMap.get(callerId);
          const callerName = callerNode?.name ?? callerId;

          // Classify the propagation mechanism based on edge and node config
          const classification = this.classifyPropagation(
            edge,
            callerNode,
            callerName,
            current.nodeId,
            notes,
          );

          const step: FailurePropagationStep = {
            step_order: current.chainSteps.length + 1,
            source_node_id: current.nodeId,
            target_node_id: callerId,
            edge_protocol: edge.protocol ?? 'http',
            mechanism: classification.mechanism,
            description:
              `Failure propagated from ${current.nodeId} to upstream ` +
              `caller ${callerName} via ${classification.mechanism}`,
            elapsed_ms_estimate: (current.depth + 1) * 250,
          };

          const chainSteps = [...current.chainSteps, step];

          // Multi-path severity escalation: add new or escalate to worst-case severity
          const existing = affectedMap.get(callerId);
          if (!existing) {
            affectedMap.set(callerId, {
              node_id: callerId,
              node_name: callerName,
              status: classification.status,
              impact_level: classification.impact,
              failure_reason:
                `Cascading dependency failure: downstream node ` +
                `${current.nodeId} became unavailable.`,
              latency_impact_multiplier: classification.latencyMult,
              error_rate_estimate: classification.errorRate,
              recovering: false,
            });
          } else {
            // Escalate if this incoming path presents a worse failure mode
            const higherStatus =
              STATUS_SEVERITY_RANK[classification.status] >
              STATUS_SEVERITY_RANK[existing.status]
                ? classification.status
                : existing.status;
            const higherImpact =
              IMPACT_SEVERITY_RANK[classification.impact] >
              IMPACT_SEVERITY_RANK[existing.impact_level]
                ? classification.impact
                : existing.impact_level;

            affectedMap.set(callerId, {
              ...existing,
              status: higherStatus,
              impact_level: higherImpact,
              latency_impact_multiplier: Math.max(
                existing.latency_impact_multiplier,
                classification.latencyMult,
              ),
              error_rate_estimate: Math.max(
                existing.error_rate_estimate,
                classification.errorRate,
              ),
            });
          }

          // Continue traversal only if not already visited (prevents cycles)
          if (!visited.has(callerId)) {
            visited.add(callerId);
            queue.push({
              nodeId: callerId,
              depth: current.depth + 1,
              chainSteps,
            });
          }

          // Emit one chain per unique (root → caller) pair with the full
          // accumulated step path up to this point. Re-emitting on a second
          // incoming edge would create a duplicate with incomplete steps.
          const chainId = `chain-${targetId}-to-${callerId}`;
          if (!emittedChainIds.has(chainId)) {
            emittedChainIds.add(chainId);
            failureChains.push({
              chain_id: chainId,
              trigger_event: scenario,
              root_node_id: targetId,
              steps: chainSteps,
              cascading_blast_radius: visited.size,
            });
          }
        }
      }
    }

    // LLM enrichment: ask the model to surface any additional propagation
    // paths or mechanisms the graph traversal may have missed.
    const llmNotes = await this.enrichWithLLM(
      scenario,
      Array.from(affectedMap.keys()),
      digitalTwin,
    );
    notes.push(...llmNotes);

    return {
      affected_nodes: Array.from(affectedMap.values()),
      failure_chains: failureChains,
      diagnostics: {
        analyzed_paths_count: Math.max(pathsCount, 1),
        depth_reached: maxDepth,
        notes,
      },
    };
  }

  /**
   * Uses the LLM to identify additional propagation risks beyond pure graph
   * traversal — e.g. implicit shared state, external SLA dependencies, or
   * non-obvious retry amplification patterns.
   */
  private async enrichWithLLM(
    scenario: string,
    affectedNodeIds: string[],
    digitalTwin: DigitalTwinSchema,
  ): Promise<string[]> {
    if (affectedNodeIds.length === 0) return [];

    const nodeList = digitalTwin.nodes
      .filter((n) => affectedNodeIds.includes(n.id))
      .map((n) => `  - ${n.name} (${n.type})`)
      .join('\n');

    const prompt =
      `Scenario: "${scenario}"\n` +
      `Affected nodes identified by graph traversal:\n${nodeList}\n\n` +
      `Identify up to 3 additional non-obvious failure propagation risks ` +
      `(e.g. shared connection pools, retry amplification, external SLA breach) ` +
      `that graph traversal alone would miss. Be specific and brief. ` +
      `Return as a JSON array of strings: ["risk1", "risk2"]`;

    try {
      const risks = await this.llm.generateStructuredJson<string[]>(
        prompt,
        'string[] — array of brief risk descriptions',
        { maxTokens: 200, temperature: 0.3 },
      );
      return Array.isArray(risks) ? risks.slice(0, 3) : [];
    } catch {
      return [];
    }
  }

  /**
   * Builds a lookup index mapping a key (extracted via `keyFn`) to its edges.
   */
  private buildEdgeIndex(
    edges: readonly DigitalTwinEdge[],
    keyFn: (edge: DigitalTwinEdge) => string,
  ): Map<string, DigitalTwinEdge[]> {
    const index = new Map<string, DigitalTwinEdge[]>();
    for (const edge of edges) {
      const key = keyFn(edge);
      if (!index.has(key)) index.set(key, []);
      index.get(key)!.push(edge);
    }
    return index;
  }

  /**
   * Classifies how a failure propagates from a downstream node to its caller,
   * based on edge characteristics and the caller's resilience configuration.
   */
  private classifyPropagation(
    edge: DigitalTwinEdge,
    callerNode: DigitalTwinNode | undefined,
    callerName: string,
    failedNodeId: string,
    notes: string[],
  ): {
    mechanism: FailureMechanism;
    status: ComponentStatus;
    impact: ImpactLevel;
    errorRate: number;
    latencyMult: number;
  } {
    const isSync = edge.sync !== false;
    const hasCircuitBreaker = callerNode?.config?.circuit_breaker === true;
    const hasFallback = callerNode?.config?.fallback_enabled === true;

    // Circuit breaker present — node degrades gracefully
    if (hasCircuitBreaker) {
      notes.push(
        `Node ${callerName} protected by circuit breaker against ${failedNodeId}.`,
      );

      if (hasFallback) {
        notes.push(`Node ${callerName} activated fallback strategy.`);
        return {
          mechanism: 'unhandled_exception',
          status: 'degraded',
          impact: 'low',
          errorRate: 0.05,
          latencyMult: 1.2,
        };
      }

      return {
        mechanism: 'unhandled_exception',
        status: 'degraded',
        impact: 'medium',
        errorRate: 0.2,
        latencyMult: 1.5,
      };
    }

    // No circuit breaker — fallback alone provides partial protection
    if (hasFallback) {
      notes.push(`Node ${callerName} activated fallback strategy.`);
      return {
        mechanism: 'direct_dependency_loss',
        status: 'degraded',
        impact: 'low',
        errorRate: 0.05,
        latencyMult: 1.5,
      };
    }

    // Synchronous call without protection — cascading timeout
    if (isSync) {
      return {
        mechanism: 'timeout_cascade',
        status: 'failing',
        impact: 'critical',
        errorRate: 0.95,
        latencyMult: 8.0,
      };
    }

    // Asynchronous call without protection — retry storm
    return {
      mechanism: 'retry_storm',
      status: 'degraded',
      impact: 'medium',
      errorRate: 0.4,
      latencyMult: 2.0,
    };
  }
}
