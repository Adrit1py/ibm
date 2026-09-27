/**
 * @fileoverview Public API surface for `@bob-simulator/agents`.
 *
 * Provides two primary entrypoints:
 *   - `runFailureAnalysis` — orchestrates the full failure-analysis pipeline.
 *   - `generate_resilience_patch` — compiles a report into a unified git diff.
 *
 * Also re-exports all subagent classes, the LLM provider interface, and the
 * shared type definitions so consumers need only a single import path.
 *
 * @module core/agents
 */

import type {
  DigitalTwinSchema,
  FailureAnalysisReport,
  AgentExecutionOptions,
} from '../../../shared/types/agent.ts';
import { MasterAgent } from './master.ts';
import { parseScenario } from './parser/scenario_parser.ts';
import {
  generate_resilience_patch,
  PatchGeneratorAgent,
} from './subagents/patch_generator.ts';
import { PropagationSubagent } from './subagents/propagation.ts';
import { LatencyBottleneckSubagent } from './subagents/bottleneck.ts';
import { RecoverySelfHealingSubagent } from './subagents/recovery.ts';
import type { LLMProvider } from './llm/provider.ts';
import { MockLLMProvider } from './llm/mock_provider.ts';
import { BobLLMProvider, OllamaLLMProvider, BobCloudLLMProvider, WatsonxLLMProvider } from './llm/watsonx.ts';

/**
 * Main entrypoint: runs a complete failure-analysis simulation.
 *
 * Creates a `MasterAgent` with the default `OllamaLLMProvider` (which
 * auto-falls back to `MockLLMProvider` when Ollama is unreachable) and
 * delegates to it. For custom LLM providers, instantiate `MasterAgent` directly.
 *
 * @param digitalTwin - Architecture graph from Person 1's parser.
 * @param attackPrompt - Natural-language "what if" scenario.
 * @param options - Execution options (reserved for future use).
 * @returns Structured failure analysis report.
 *
 * @example
 * ```ts
 * const report = await runFailureAnalysis(graph, "What if Redis goes down?");
 * console.log(report.affected_nodes);
 * ```
 */
export async function runFailureAnalysis(
  digitalTwin: DigitalTwinSchema,
  attackPrompt: string,
  options?: AgentExecutionOptions,
): Promise<FailureAnalysisReport> {
  const master = new MasterAgent();
  return master.runFailureAnalysis(digitalTwin, attackPrompt, options);
}

// Re-export the patch compiler entrypoint
export { generate_resilience_patch };

// Re-export classes for advanced composition
export {
  MasterAgent,
  PropagationSubagent,
  LatencyBottleneckSubagent,
  RecoverySelfHealingSubagent,
  PatchGeneratorAgent,
  MockLLMProvider,
  BobLLMProvider,
  BobCloudLLMProvider,
  OllamaLLMProvider,
  WatsonxLLMProvider,
  parseScenario,
};

// Re-export shared types and LLM interface
export type * from '../../../shared/types/agent.ts';
export type { LLMProvider } from './llm/provider.ts';
export type { LLMRequestOptions } from './llm/provider.ts';
export type { ParsedScenario, ScenarioType, ScenarioParameters } from './parser/scenario_parser.ts';
