/**
 * @fileoverview Master Agent — top-level orchestrator for IBM Bob Agent Mode.
 *
 * Coordinates parallel subagent dispatch (Propagation, Bottleneck, Recovery),
 * aggregates and deduplicates findings, and delegates patch generation.
 * This is the sole orchestration entry point; subagents are stateless workers.
 *
 * @module core/agents/master
 */

import type {
  DigitalTwinSchema,
  DigitalTwinNode,
  FailureAnalysisReport,
  AgentExecutionOptions,
  RootCause,
} from '../../../shared/types/agent.ts';
import type { LLMProvider } from './llm/provider.ts';
import { MockLLMProvider } from './llm/mock_provider.ts';
import { OllamaLLMProvider } from './llm/watsonx.ts';
import { parseScenario } from './parser/scenario_parser.ts';
import { PropagationSubagent } from './subagents/propagation.ts';
import { LatencyBottleneckSubagent } from './subagents/bottleneck.ts';
import { RecoverySelfHealingSubagent } from './subagents/recovery.ts';
import { PatchGeneratorAgent } from './subagents/patch_generator.ts';

/**
 * The Master Agent orchestrates the full failure-analysis pipeline:
 *
 * 1. Identify seed failure nodes from the natural-language prompt.
 * 2. Dispatch Propagation + Bottleneck subagents in parallel.
 * 3. Feed propagation results into the Recovery subagent.
 * 4. Aggregate and deduplicate root causes.
 * 5. Generate resilience patches for all root causes.
 * 6. Assemble and return the complete `FailureAnalysisReport`.
 */
export class MasterAgent {
  private readonly llm: LLMProvider;
  private readonly propagationSubagent: PropagationSubagent;
  private readonly bottleneckSubagent: LatencyBottleneckSubagent;
  private readonly recoverySubagent: RecoverySelfHealingSubagent;
  private readonly patchGenerator: PatchGeneratorAgent;

  /**
   * @param llmProvider - LLM provider for subagent inference.
   *                      Defaults to `OllamaLLMProvider` (auto-falls back to
   *                      `MockLLMProvider` when Ollama is unreachable).
   */
  constructor(llmProvider?: LLMProvider) {
    this.llm = llmProvider ?? new OllamaLLMProvider();
    this.propagationSubagent = new PropagationSubagent(this.llm);
    this.bottleneckSubagent = new LatencyBottleneckSubagent(this.llm);
    this.recoverySubagent = new RecoverySelfHealingSubagent(this.llm);
    this.patchGenerator = new PatchGeneratorAgent(this.llm);
  }

  /**
   * Runs the full failure analysis orchestration pipeline.
   *
   * @param digitalTwin - The architecture graph from Person 1's parser.
   * @param attackPrompt - Natural-language failure scenario.
   * @param _options - Execution options (reserved for future use).
   * @returns A complete `FailureAnalysisReport`.
   */
  async runFailureAnalysis(
    digitalTwin: DigitalTwinSchema,
    attackPrompt: string,
    options?: AgentExecutionOptions,
  ): Promise<FailureAnalysisReport> {
    // If a timeout is requested, wrap execution in a timeout race
    if (options?.timeout_ms && options.timeout_ms > 0) {
      const timeoutMs = options.timeout_ms;
      return Promise.race([
        this.executePipeline(digitalTwin, attackPrompt, options),
        new Promise<FailureAnalysisReport>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `MasterAgent: Failure analysis exceeded timeout budget of ${timeoutMs}ms`,
                ),
              ),
            timeoutMs,
          ),
        ),
      ]);
    }

    return this.executePipeline(digitalTwin, attackPrompt, options);
  }

  /**
   * Internal execution pipeline for failure analysis.
   */
  private async executePipeline(
    digitalTwin: DigitalTwinSchema,
    attackPrompt: string,
    options?: AgentExecutionOptions,
  ): Promise<FailureAnalysisReport> {
    // --- 1. Defensive input validation ---
    if (
      !digitalTwin ||
      !Array.isArray(digitalTwin.nodes) ||
      !Array.isArray(digitalTwin.edges)
    ) {
      return this.emptyReport(attackPrompt ?? '');
    }

    if (digitalTwin.nodes.length === 0) {
      return this.emptyReport(attackPrompt);
    }

    // --- Select active subagents (mock_mode forces MockLLMProvider) ---
    const useMock = options?.mock_mode === true;
    const propagationSubagent = useMock
      ? new PropagationSubagent(new MockLLMProvider())
      : this.propagationSubagent;
    const bottleneckSubagent = useMock
      ? new LatencyBottleneckSubagent(new MockLLMProvider())
      : this.bottleneckSubagent;
    const recoverySubagent = useMock
      ? new RecoverySelfHealingSubagent(new MockLLMProvider())
      : this.recoverySubagent;
    const patchGenerator = useMock
      ? new PatchGeneratorAgent(new MockLLMProvider())
      : this.patchGenerator;

    // --- 2. Parse the scenario for structured parameters ---
    const parsed = parseScenario(attackPrompt);

    // --- 3. Identify seed failure nodes (parser targets augment matching) ---
    const seedNodeIds = this.identifySeedNodes(digitalTwin, attackPrompt, parsed.target_mentions);

    // --- 4. Dispatch Propagation + Bottleneck in parallel ---
    const [propagationRes, bottleneckRes] = await Promise.all([
      propagationSubagent.analyze(digitalTwin, seedNodeIds, attackPrompt),
      bottleneckSubagent.analyze(
        digitalTwin,
        seedNodeIds,
        attackPrompt,
        parsed.parameters.latency_multiplier,
      ),
    ]);

    // --- 5. Run Recovery with propagation findings ---
    const recoveryRes = await recoverySubagent.analyze(
      digitalTwin,
      propagationRes.affected_nodes,
      attackPrompt,
    );

    // --- 6. Merge recovery status into affected nodes ---
    const recoveringSet = new Set(recoveryRes.recovering_nodes);
    const affectedNodes = propagationRes.affected_nodes.map((node) => ({
      ...node,
      recovering: recoveringSet.has(node.node_id),
    }));

    // --- 7. Aggregate and deduplicate root causes ---
    const allRootCauses: RootCause[] = [];
    const seenKeys = new Set<string>();

    // Severity rank for confidence threshold filtering
    const severityRank: Record<string, number> = {
      low: 0.25,
      medium: 0.5,
      high: 0.75,
      critical: 1.0,
    };
    const minConfidence = options?.confidence_threshold ?? 0.0;

    for (const rc of [...bottleneckRes.root_causes, ...recoveryRes.root_causes]) {
      const key = `${rc.node_id}:${rc.vulnerability_type}`;
      const rcConfidence = severityRank[rc.severity] ?? 0.5;

      if (!seenKeys.has(key) && rcConfidence >= minConfidence) {
        seenKeys.add(key);
        allRootCauses.push(rc);
      }
    }

    // --- 8. Generate resilience patches ---
    const suggestedPatches = await patchGenerator.generatePatches(
      digitalTwin,
      allRootCauses,
    );

    // --- 9. Assemble final report ---
    return {
      scenario_prompt: attackPrompt,
      analyzed_at: new Date().toISOString(),
      affected_nodes: affectedNodes,
      failure_chains: propagationRes.failure_chains,
      root_causes: allRootCauses,
      suggested_patches: suggestedPatches,
      diagnostics: {
        propagation: propagationRes.diagnostics,
        bottleneck: bottleneckRes.diagnostics,
        recovery: recoveryRes.diagnostics,
      },
    };
  }

  /**
   * Identifies which nodes in the graph are the "seed" failure targets
   * for the given scenario prompt.
   *
   * Matching priority:
   *   1. Exact node ID or name match from the raw prompt
   *   2. Parser-extracted target mentions matched against node IDs/names
   *   3. Keyword-to-type heuristic fallback (e.g. "database" → type=database)
   *   4. Last resort: first node in the graph
   */
  private identifySeedNodes(
    digitalTwin: DigitalTwinSchema,
    scenario: string,
    parserTargets: readonly string[] = [],
  ): string[] {
    const promptLower = scenario.toLowerCase();
    const matchedNodeIds: string[] = [];

    // Priority 1: Match by node ID or node name directly in the raw prompt
    for (const node of digitalTwin.nodes) {
      const idMatch = promptLower.includes(node.id.toLowerCase());
      const nameMatch = promptLower.includes(node.name.toLowerCase());

      if (idMatch || nameMatch) {
        matchedNodeIds.push(node.id);
      }
    }

    if (matchedNodeIds.length > 0) return matchedNodeIds;

    // Priority 2: Match parser-extracted target tokens against node IDs/names
    if (parserTargets.length > 0) {
      for (const node of digitalTwin.nodes) {
        const nodeIdLower = node.id.toLowerCase();
        const nodeNameLower = node.name.toLowerCase();
        for (const target of parserTargets) {
          if (nodeIdLower.includes(target) || nodeNameLower.includes(target)) {
            matchedNodeIds.push(node.id);
            break;
          }
        }
      }
      if (matchedNodeIds.length > 0) return matchedNodeIds;
    }

    // Priority 3: Keyword-to-type heuristic
    const keywordMap: Array<{
      keywords: string[];
      finder: (n: DigitalTwinNode) => boolean;
    }> = [
      {
        keywords: ['database', 'db', 'postgres', 'mysql', 'mongo'],
        finder: (n) => n.type === 'database',
      },
      {
        keywords: ['cache', 'redis', 'memcached'],
        finder: (n) => n.type === 'cache',
      },
      {
        keywords: ['queue', 'rabbit', 'kafka', 'sqs'],
        finder: (n) => n.type === 'queue',
      },
      {
        keywords: ['payment', 'stripe', 'external', 'third-party'],
        finder: (n) => n.type === 'external_api',
      },
      {
        keywords: ['gateway', 'ingress', 'load balancer'],
        finder: (n) => n.type === 'gateway',
      },
    ];

    for (const { keywords, finder } of keywordMap) {
      if (keywords.some((kw) => promptLower.includes(kw))) {
        const match = digitalTwin.nodes.find(finder);
        if (match) {
          matchedNodeIds.push(match.id);
          return matchedNodeIds;
        }
      }
    }

    // Priority 4: Last resort — first node
    if (digitalTwin.nodes.length > 0) {
      matchedNodeIds.push(digitalTwin.nodes[0].id);
    }

    return matchedNodeIds;
  }

  /** Builds an empty report for invalid / empty inputs. */
  private emptyReport(prompt: string): FailureAnalysisReport {
    return {
      scenario_prompt: prompt,
      analyzed_at: new Date().toISOString(),
      affected_nodes: [],
      failure_chains: [],
      root_causes: [],
      suggested_patches: [],
    };
  }
}
