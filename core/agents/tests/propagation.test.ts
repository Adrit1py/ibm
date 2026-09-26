import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PropagationSubagent } from '../src/subagents/propagation.ts';
import { MockLLMProvider } from '../src/llm/mock_provider.ts';
import { sampleEcommerceGraph } from './fixtures.ts';

describe('PropagationSubagent', () => {
  const subagent = new PropagationSubagent(new MockLLMProvider());

  test('Traces reverse cascade: redis-cache → order-service → api-gateway', async () => {
    const result = await subagent.analyze(
      sampleEcommerceGraph,
      ['redis-cache'],
      'Redis is completely down',
    );

    // All three upstream nodes affected
    assert.ok(result.affected_nodes.length >= 3);
    const map = new Map(result.affected_nodes.map((n) => [n.node_id, n]));

    assert.equal(map.get('redis-cache')?.status, 'dead', 'Seed node is dead');
    assert.equal(map.get('order-service')?.status, 'failing', 'Direct caller fails');
    assert.ok(map.has('api-gateway'), 'Gateway affected via cascade');

    // Chain reaches gateway
    const chainToGateway = result.failure_chains.find((c) =>
      c.steps.some((s) => s.target_node_id === 'api-gateway'),
    );
    assert.ok(chainToGateway, 'Chain should propagate to API Gateway');
  });

  test('Seed node with no upstream callers produces single affected node', async () => {
    const result = await subagent.analyze(
      sampleEcommerceGraph,
      ['api-gateway'],
      'Gateway crashes',
    );

    assert.equal(result.affected_nodes.length, 1);
    assert.equal(result.affected_nodes[0].node_id, 'api-gateway');
    assert.equal(result.affected_nodes[0].status, 'dead');
    assert.equal(result.failure_chains.length, 0, 'No chains for root node');
  });

  test('Diagnostics track path count and depth', async () => {
    const result = await subagent.analyze(
      sampleEcommerceGraph,
      ['redis-cache'],
      'Redis down',
    );

    assert.ok(result.diagnostics.analyzed_paths_count >= 1);
    assert.ok(result.diagnostics.depth_reached >= 1, 'At least 1 hop deep');
  });

  test('Multi-path severity escalation upgrades caller to worst-case status', async () => {
    // Multi-path graph: node-target-1 and node-target-2 both call node-caller
    // Target 1 has async link (degraded), Target 2 has sync blocking link (failing)
    const multiPathGraph = {
      nodes: [
        { id: 'caller', name: 'Caller Service', type: 'service' },
        { id: 'dep-async', name: 'Async Dep', type: 'service' },
        { id: 'dep-sync', name: 'Sync Dep', type: 'service' },
      ],
      edges: [
        { source: 'caller', target: 'dep-async', protocol: 'http', sync: false },
        { source: 'caller', target: 'dep-sync', protocol: 'http', sync: true },
      ],
    };

    const result = await subagent.analyze(
      multiPathGraph,
      ['dep-async', 'dep-sync'],
      'Both dependencies fail',
    );

    const callerNode = result.affected_nodes.find((n) => n.node_id === 'caller');
    assert.ok(callerNode, 'Caller should be affected');
    // Escalates to failing (the worse of degraded vs failing)
    assert.equal(callerNode.status, 'failing');
    assert.equal(callerNode.impact_level, 'critical');
    assert.ok(callerNode.latency_impact_multiplier >= 8.0);
  });
});
