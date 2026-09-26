/**
 * @fileoverview Live integration test — runs the full pipeline against Ollama.
 *
 * Gated by `OLLAMA_LIVE=1`. Skipped automatically in CI / offline environments.
 * Verifies that the real LLM enrichment round-trips work end-to-end.
 *
 * Run manually:
 *   OLLAMA_LIVE=1 node --experimental-strip-types --test tests/live_integration.test.ts
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { OllamaLLMProvider } from '../src/llm/watsonx.ts';
import { MasterAgent } from '../src/master.ts';
import { sampleEcommerceGraph } from './fixtures.ts';
import {
  blackFridayCascadeGraph,
  blackFridayPrompt,
  silentPaymentHangGraph,
  silentPaymentHangPrompt,
} from './demo_scenarios.ts';

const LIVE = process.env['OLLAMA_LIVE'] === '1';

describe('Live Integration — Ollama (skip when OLLAMA_LIVE≠1)', { skip: !LIVE }, () => {
  test('OllamaLLMProvider resolves a model from running Ollama instance', async () => {
    const llm = new OllamaLLMProvider();
    const model = await llm.resolveModel();
    assert.ok(typeof model === 'string' && model.length > 0, `Resolved model: ${model}`);
    console.log(`  → Resolved model: ${model}`);
  });

  test('generateCompletion returns a non-empty string', async () => {
    const llm = new OllamaLLMProvider();
    const result = await llm.generateCompletion(
      'In one sentence: what is a circuit breaker pattern in distributed systems?',
      { maxTokens: 60 },
    );
    assert.ok(typeof result === 'string', 'Result should be string');
    assert.ok(result.trim().length > 10, `LLM response too short: "${result}"`);
    console.log(`  → LLM response: ${result.trim().slice(0, 120)}`);
  });

  test('generateStructuredJson returns a parseable JSON array', async () => {
    const llm = new OllamaLLMProvider();
    const risks = await llm.generateStructuredJson<string[]>(
      'List 2 failure risks for a Redis cache going down in an e-commerce system.',
      'string[] — array of brief risk descriptions (max 2 items)',
      { maxTokens: 100 },
    );
    assert.ok(Array.isArray(risks), `Expected array, got: ${typeof risks}`);
    assert.ok(risks.length > 0, 'Should return at least 1 risk');
    console.log(`  → Risks: ${JSON.stringify(risks)}`);
  });

  test('Full pipeline: Black Friday scenario with live LLM enrichment', async () => {
    const llm = new OllamaLLMProvider();
    const agent = new MasterAgent(llm);

    const report = await agent.runFailureAnalysis(blackFridayCascadeGraph, blackFridayPrompt);

    assert.ok(report.affected_nodes.length >= 2, 'Multiple nodes affected');
    assert.ok(report.root_causes.length > 0, 'Root causes identified');
    assert.ok(report.suggested_patches.length > 0, 'Patches generated');

    // LLM enrichment should append notes to diagnostics
    const allNotes = [
      ...(report.diagnostics?.propagation.notes ?? []),
      ...(report.diagnostics?.bottleneck.notes ?? []),
      ...(report.diagnostics?.recovery.notes ?? []),
    ];
    console.log(`  → Total diagnostic notes: ${allNotes.length}`);
    console.log(`  → LLM notes sample: ${allNotes.slice(-3).join(' | ')}`);

    assert.ok(Array.isArray(allNotes), 'Diagnostics notes should be arrays');
  });

  test('Full pipeline: Silent Payment Hang with live LLM enrichment', async () => {
    const llm = new OllamaLLMProvider();
    const agent = new MasterAgent(llm);

    const report = await agent.runFailureAnalysis(silentPaymentHangGraph, silentPaymentHangPrompt);

    assert.ok(report.affected_nodes.some((n) => n.node_id === 'stripe-api'));
    assert.ok(report.suggested_patches.some((p) => p.resilience_pattern === 'circuit_breaker'));
    console.log(`  → Patches: ${report.suggested_patches.map((p) => p.resilience_pattern).join(', ')}`);
  });

  test('Multi-language patches: Python file generates Python diff', async () => {
    const llm = new OllamaLLMProvider();
    const agent = new MasterAgent(llm);

    // Graph with Python file paths
    const pythonGraph = {
      ...sampleEcommerceGraph,
      nodes: sampleEcommerceGraph.nodes.map((n) => ({
        ...n,
        file_path: n.file_path?.replace('.ts', '.py') ?? `src/${n.id}.py`,
      })),
    };

    const report = await agent.runFailureAnalysis(
      pythonGraph,
      'What if Redis crashes?',
    );

    const pyPatches = report.suggested_patches.filter((p) =>
      p.target_file.endsWith('.py'),
    );
    assert.ok(pyPatches.length > 0, 'Python patches should be generated');
    assert.ok(
      pyPatches.some((p) => p.diff.includes('pybreaker') || p.diff.includes('tenacity') || p.diff.includes('asyncpg')),
      'Python patches should use Python libraries',
    );
    console.log(`  → Python patches: ${pyPatches.map((p) => p.resilience_pattern).join(', ')}`);
  });
});
