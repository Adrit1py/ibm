import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MasterAgent, MockLLMProvider } from '../src/index.ts';
import { sampleEcommerceGraph } from './fixtures.ts';

// All master agent tests run offline with MockLLMProvider
const mockAgent = new MasterAgent(new MockLLMProvider());
const runFailureAnalysis = mockAgent.runFailureAnalysis.bind(mockAgent);

describe('MasterAgent Orchestration Suite', () => {
  test('Full pipeline: Redis failure cascades through order service to gateway', async () => {
    const report = await runFailureAnalysis(
      sampleEcommerceGraph,
      'What happens if Redis drops packets for 30s?',
    );

    // Report shape
    assert.ok(report, 'Report should be returned');
    assert.equal(report.scenario_prompt, 'What happens if Redis drops packets for 30s?');
    assert.ok(report.analyzed_at, 'Should have ISO timestamp');

    // Affected nodes
    assert.ok(Array.isArray(report.affected_nodes));
    assert.ok(report.affected_nodes.length >= 2, 'Redis + upstream callers affected');
    const affectedIds = report.affected_nodes.map((n) => n.node_id);
    assert.ok(affectedIds.includes('redis-cache'), 'redis-cache is the seed');
    assert.ok(affectedIds.includes('order-service'), 'order-service cascades');

    // Failure chains
    assert.ok(report.failure_chains.length > 0, 'At least one chain');
    assert.equal(report.failure_chains[0].root_node_id, 'redis-cache');

    // Root causes
    assert.ok(report.root_causes.length > 0, 'Root causes identified');

    // Suggested patches — all valid unified diffs
    assert.ok(report.suggested_patches.length > 0, 'Patches generated');
    for (const patch of report.suggested_patches) {
      assert.ok(patch.diff.includes('diff --git'), 'Valid diff header');
      assert.ok(patch.diff.includes('@@'), 'Valid hunk header');
      assert.ok(patch.id, 'Patch has an ID');
      assert.ok(patch.root_cause_id, 'Patch links to a root cause');
    }

    // Diagnostics populated
    assert.ok(report.diagnostics, 'Diagnostics should be present');
    assert.ok(report.diagnostics!.propagation.analyzed_paths_count >= 1);
    assert.ok(report.diagnostics!.recovery.expected_recovery_time_ms > 0);
  });

  test('Payment API slowdown triggers latency-focused analysis', async () => {
    const report = await runFailureAnalysis(
      sampleEcommerceGraph,
      'What if the Stripe Payment API becomes 10x slower?',
    );

    assert.ok(report.affected_nodes.some((n) => n.node_id === 'payment-api'));
    assert.equal(
      report.diagnostics?.bottleneck.max_latency_multiplier,
      10.0,
      'Latency multiplier should be 10x for slow scenarios',
    );
  });

  test('Database unavailability triggers database-specific seed matching', async () => {
    const report = await runFailureAnalysis(
      sampleEcommerceGraph,
      'What if the database is unavailable for 30 seconds?',
    );

    const affectedIds = report.affected_nodes.map((n) => n.node_id);
    assert.ok(
      affectedIds.includes('postgres-db'),
      'postgres-db should be the seed node',
    );
  });

  test('AgentExecutionOptions: mock_mode forces offline execution', async () => {
    const report = await runFailureAnalysis(
      sampleEcommerceGraph,
      'What if Redis crashes?',
      { mock_mode: true },
    );
    assert.ok(report);
    assert.ok(report.affected_nodes.length > 0);
  });

  test('AgentExecutionOptions: confidence_threshold filters low-severity root causes', async () => {
    const unfiltered = await runFailureAnalysis(
      sampleEcommerceGraph,
      'What if Redis crashes?',
      { confidence_threshold: 0.0 },
    );

    const filtered = await runFailureAnalysis(
      sampleEcommerceGraph,
      'What if Redis crashes?',
      { confidence_threshold: 0.75 },
    );

    assert.ok(
      filtered.root_causes.length <= unfiltered.root_causes.length,
      'High confidence threshold should filter out lower-severity root causes',
    );
    for (const rc of filtered.root_causes) {
      assert.ok(
        rc.severity === 'high' || rc.severity === 'critical',
        `Should only retain high or critical severity, got: ${rc.severity}`,
      );
    }
  });

  test('AgentExecutionOptions: timeout_ms enforces execution deadline', async () => {
    // Inject a provider with deliberate delay to verify timeout enforcement
    const slowProvider = new MockLLMProvider();
    slowProvider.generateStructuredJson = () =>
      new Promise((resolve) => setTimeout(() => resolve([] as any), 60));
    const slowMaster = new MasterAgent(slowProvider);

    await assert.rejects(
      async () => {
        await slowMaster.runFailureAnalysis(
          sampleEcommerceGraph,
          'What if Redis crashes?',
          { timeout_ms: 10 },
        );
      },
      /exceeded timeout budget/,
    );
  });
});
