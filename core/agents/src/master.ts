/**
 * @fileoverview Master Agent — top-level orchestrator for IBM Bob Agent Mode.
 *
 * Coordinates parallel subagent dispatch (Propagation, Bottleneck, Recovery),
 * aggregates and deduplicates findings, and delegates patch generation.
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

export class MasterAgent {
  private readonly llm: LLMProvider;
  private readonly propagationSubagent: PropagationSubagent;
  private readonly bottleneckSubagent: LatencyBottleneckSubagent;
  private readonly recoverySubagent: RecoverySelfHealingSubagent;
  private readonly patchGenerator: PatchGeneratorAgent;

  constructor(llmProvider?: LLMProvider) {
    this.llm = llmProvider ?? new OllamaLLMProvider();
    this.propagationSubagent = new PropagationSubagent(this.llm);
    this.bottleneckSubagent = new LatencyBottleneckSubagent(this.llm);
    this.recoverySubagent = new RecoverySelfHealingSubagent(this.llm);
    this.patchGenerator = new PatchGeneratorAgent(this.llm);
  }

  async runFailureAnalysis(
    digitalTwin: DigitalTwinSchema,
    attackPrompt: string,
    options?: AgentExecutionOptions,
  ): Promise<FailureAnalysisReport> {
    if (options?.timeout_ms && options.timeout_ms > 0) {
      const timeoutMs = options.timeout_ms;
      let timer: NodeJS.Timeout | undefined;
      try {
        return await Promise.race([
          this.executePipeline(digitalTwin, attackPrompt, options),
          new Promise<FailureAnalysisReport>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(`MasterAgent: Failure analysis exceeded timeout budget of ${timeoutMs}ms`)
                ),
              timeoutMs
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    return this.executePipeline(digitalTwin, attackPrompt, options);
  }

  private async executePipeline(
    digitalTwin: DigitalTwinSchema,
    attackPrompt: string,
    options?: AgentExecutionOptions,
  ): Promise<FailureAnalysisReport> {
    if (!digitalTwin || !Array.isArray(digitalTwin.nodes) || !Array.isArray(digitalTwin.edges)) {
      return this.emptyReport(attackPrompt);
    }
    if (digitalTwin.nodes.length === 0) {
      return this.emptyReport(attackPrompt);
    }

    const useMock = options?.mock_mode === true;
    const propagationSubagent = useMock ? new PropagationSubagent(new MockLLMProvider()) : this.propagationSubagent;
    const bottleneckSubagent = useMock ? new LatencyBottleneckSubagent(new MockLLMProvider()) : this.bottleneckSubagent;
    const recoverySubagent = useMock ? new RecoverySelfHealingSubagent(new MockLLMProvider()) : this.recoverySubagent;
    const patchGenerator = useMock ? new PatchGeneratorAgent(new MockLLMProvider()) : this.patchGenerator;

    const parsed = parseScenario(attackPrompt);
    const seedNodeIds = this.identifySeedNodes(digitalTwin, attackPrompt, parsed.target_mentions);

    const [propagationRes, bottleneckRes] = await Promise.all([
      propagationSubagent.analyze(digitalTwin, seedNodeIds, attackPrompt),
      bottleneckSubagent.analyze(digitalTwin, seedNodeIds, attackPrompt, parsed.parameters?.latency_multiplier),
    ]);

    const recoveryRes = await recoverySubagent.analyze(
      digitalTwin,
      propagationRes.affected_nodes,
      attackPrompt
    );

    const recoveringSet = new Set(recoveryRes.recovering_nodes);
    const affectedNodes = propagationRes.affected_nodes.map(node => ({
      ...node,
      recovering: recoveringSet.has(node.node_id),
    }));

    const allRootCauses: RootCause[] = [
      ...bottleneckRes.root_causes,
      ...recoveryRes.root_causes,
    ];
    const rootCauses = Array.from(new Map(allRootCauses.map(rc => [rc.id, rc])).values());

    // Filter by confidence_threshold if provided: maps severity to a 0-1
    // rank and drops root causes below the requested floor.
    const SEVERITY_RANK: Record<string, number> = {
      low: 0.25,
      medium: 0.5,
      high: 0.75,
      critical: 1.0,
    };
    const filteredRootCauses =
      options?.confidence_threshold !== undefined
        ? rootCauses.filter(
            (rc) => (SEVERITY_RANK[rc.severity] ?? 0) >= options.confidence_threshold!,
          )
        : rootCauses;

    const suggestedPatches = await patchGenerator.generatePatches(digitalTwin, filteredRootCauses);

    return {
      scenario_prompt: attackPrompt,
      parsed_scenario: parsed,
      analyzed_at: new Date().toISOString(),
      affected_nodes: affectedNodes,
      failure_chains: propagationRes.failure_chains,
      root_causes: filteredRootCauses,
      suggested_patches: suggestedPatches,
      // IMPORTANT: kept per-subagent, not flattened — core/engine's
      // SubagentDiagnosticsInput and the test suite both read
      // diagnostics.propagation / diagnostics.bottleneck / diagnostics.recovery.
      diagnostics: {
        propagation: propagationRes.diagnostics,
        bottleneck: bottleneckRes.diagnostics,
        recovery: recoveryRes.diagnostics,
      },
    };
  }

  private emptyReport(prompt: string): FailureAnalysisReport {
    return {
      scenario_prompt: prompt,
      parsed_scenario: parseScenario(prompt),
      analyzed_at: new Date().toISOString(),
      affected_nodes: [],
      failure_chains: [],
      root_causes: [],
      suggested_patches: [],
      diagnostics: {
        propagation: {
          analyzed_paths_count: 0,
          depth_reached: 0,
          notes: ['Digital twin is empty or invalid.'],
        },
        bottleneck: {
          saturated_pools: [],
          max_latency_multiplier: 1.0,
          queue_backlog_risk: false,
          notes: [],
        },
        recovery: {
          self_healing_capable: false,
          expected_recovery_time_ms: 0,
          identified_recovery_barriers: [],
          notes: [],
        },
      },
    };
  }

  private identifySeedNodes(digitalTwin: DigitalTwinSchema, prompt: string, mentions: readonly string[]): string[] {
    const seeds = new Set<string>();
    const promptLower = prompt.toLowerCase();

    // Exact match from parsed mentions
    for (const mention of mentions) {
      for (const node of digitalTwin.nodes) {
        if (node.name.toLowerCase().includes(mention) || node.id.toLowerCase().includes(mention)) {
          seeds.add(node.id);
        }
      }
    }

    // Fallback naive search
    if (seeds.size === 0) {
      for (const node of digitalTwin.nodes) {
        if (promptLower.includes(node.name.toLowerCase()) || promptLower.includes(node.id.toLowerCase())) {
          seeds.add(node.id);
        }
      }
    }

    // If still empty, assume the first node is failing just to have something (or could be empty)
    if (seeds.size === 0 && digitalTwin.nodes.length > 0) {
      seeds.add(digitalTwin.nodes[0].id);
    }

    return Array.from(seeds);
  }
}
