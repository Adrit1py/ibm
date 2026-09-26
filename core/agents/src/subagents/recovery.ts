/**
 * @fileoverview Recovery & Self-Healing Subagent — evaluates automatic recovery.
 *
 * For each affected node, inspects its resilience configuration to determine
 * whether the system can recover automatically (self-heal) or whether manual
 * intervention would be required. Produces root causes for missing recovery
 * mechanisms and estimates the expected recovery time.
 *
 * @module core/agents/subagents/recovery
 */

import type {
  DigitalTwinSchema,
  DigitalTwinNode,
  RootCause,
  AffectedNode,
} from '../../../../shared/types/agent.ts';
import type { LLMProvider } from '../llm/provider.ts';

/** Time penalty (ms) added for each unprotected affected node. */
const RECOVERY_PENALTY_PER_NODE_MS = 15_000;

/** Base recovery time (ms) when at least some protection exists. */
const BASE_RECOVERY_TIME_MS = 5_000;

/** Result payload from the recovery analysis. */
export interface RecoveryAnalysisResult {
  readonly root_causes: RootCause[];
  readonly recovering_nodes: string[];
  readonly diagnostics: {
    readonly self_healing_capable: boolean;
    readonly expected_recovery_time_ms: number;
    readonly identified_recovery_barriers: string[];
    readonly notes: string[];
  };
}

/**
 * Evaluates self-healing mechanisms across the affected portion of the
 * architecture graph, identifying missing circuit breakers, fallbacks,
 * and health checks that would prevent automatic recovery.
 */
export class RecoverySelfHealingSubagent {
  private readonly llm: LLMProvider;

  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  /**
   * Runs the recovery analysis pass.
   *
   * @param digitalTwin  - The complete architecture graph.
   * @param affectedNodes - Nodes already identified as affected by propagation.
   * @param scenario      - The user's natural-language failure scenario.
   * @returns Recovery barriers, self-healing assessment, and ERT estimate.
   */
  async analyze(
    digitalTwin: DigitalTwinSchema,
    affectedNodes: readonly AffectedNode[],
    scenario: string,
  ): Promise<RecoveryAnalysisResult> {
    const rootCauses: RootCause[] = [];
    const recoveringNodes: string[] = [];
    const recoveryBarriers: string[] = [];
    const notes: string[] = [];

    let canSelfHeal = true;
    let computedRecoveryTimeMs = BASE_RECOVERY_TIME_MS;

    const affectedSet = new Set(affectedNodes.map((a) => a.node_id));

    for (const node of digitalTwin.nodes) {
      if (!affectedSet.has(node.id)) continue;

      const config = node.config ?? {};
      const hasCircuitBreaker = config.circuit_breaker === true;
      const hasFallback = config.fallback_enabled === true;

      // --- Missing Circuit Breaker ---
      if (!hasCircuitBreaker) {
        rootCauses.push({
          id: `rc-cb-${node.id}`,
          node_id: node.id,
          vulnerability_type: 'missing_circuit_breaker',
          description:
            `Node ${node.name} does not employ a circuit breaker when ` +
            `calling downstream dependencies, causing permanent lockup ` +
            `during outages until manual restart.`,
          severity: 'critical',
          file_target: node.file_path,
          code_reference: node.code_snippet,
        });
        recoveryBarriers.push(
          `Node ${node.name} cannot fast-fail without a circuit breaker.`,
        );
        canSelfHeal = false;
      }

      // --- Missing Fallback ---
      if (!hasFallback) {
        rootCauses.push({
          id: `rc-fb-${node.id}`,
          node_id: node.id,
          vulnerability_type: 'missing_fallback',
          description:
            `Node ${node.name} lacks graceful fallback responses when ` +
            `downstream dependencies are unavailable.`,
          severity: 'high',
          file_target: node.file_path,
        });
      }

      // --- Classify recovery posture ---
      if (hasCircuitBreaker && hasFallback) {
        recoveringNodes.push(node.id);
        notes.push(
          `Node ${node.name} can self-heal via circuit breaker + fallback.`,
        );
      } else {
        computedRecoveryTimeMs += RECOVERY_PENALTY_PER_NODE_MS;
      }
    }

    // Extract explicit duration from the scenario if present
    const scenarioRecoveryMs = this.extractDurationFromScenario(scenario);
    const expectedRecoveryTimeMs =
      scenarioRecoveryMs !== null
        ? Math.max(scenarioRecoveryMs, computedRecoveryTimeMs)
        : computedRecoveryTimeMs;

    // LLM enrichment: ask for recovery acceleration opportunities
    const llmNotes = await this.enrichWithLLM(scenario, affectedNodes, digitalTwin);
    notes.push(...llmNotes);

    return {
      root_causes: rootCauses,
      recovering_nodes: recoveringNodes,
      diagnostics: {
        self_healing_capable: canSelfHeal && recoveringNodes.length > 0,
        expected_recovery_time_ms: expectedRecoveryTimeMs,
        identified_recovery_barriers: recoveryBarriers,
        notes,
      },
    };
  }

  /**
   * Asks the LLM to identify recovery acceleration opportunities — e.g.
   * automated runbooks, health check improvements, or warm standby strategies.
   */
  private async enrichWithLLM(
    scenario: string,
    affectedNodes: readonly AffectedNode[],
    digitalTwin: DigitalTwinSchema,
  ): Promise<string[]> {
    if (affectedNodes.length === 0) return [];

    const nodeList = affectedNodes
      .slice(0, 5)
      .map((n) => `  - ${n.node_name}: ${n.status}`)
      .join('\n');

    const prompt =
      `Scenario: "${scenario}"\n` +
      `Affected nodes:\n${nodeList}\n\n` +
      `Suggest up to 3 specific recovery acceleration strategies for this failure ` +
      `(e.g. automated health-check restart, pre-warmed fallback instance, ` +
      `DNS TTL reduction for failover). Be specific and brief. ` +
      `Return as a JSON array of strings: ["strategy1", "strategy2"]`;

    try {
      const strategies = await this.llm.generateStructuredJson<string[]>(
        prompt,
        'string[] — array of brief recovery strategies',
        { maxTokens: 150, temperature: 0.3 },
      );
      return Array.isArray(strategies) ? strategies.slice(0, 3) : [];
    } catch {
      return [];
    }
  }

  /**
   * Attempts to extract a duration in milliseconds from the scenario text.
   *
   * Recognizes patterns like "30s", "30 seconds", "5 minutes", "2m".
   * Returns `null` if no duration is found.
   */
  private extractDurationFromScenario(scenario: string): number | null {
    const lower = scenario.toLowerCase();

    // Match "Ns", "N seconds", "Nm", "N minutes"
    const secMatch = lower.match(/(\d+)\s*(?:s(?:ec(?:ond)?s?)?)\b/);
    if (secMatch) {
      return parseInt(secMatch[1], 10) * 1_000;
    }

    const minMatch = lower.match(/(\d+)\s*(?:m(?:in(?:ute)?s?)?)\b/);
    if (minMatch) {
      return parseInt(minMatch[1], 10) * 60_000;
    }

    return null;
  }
}
