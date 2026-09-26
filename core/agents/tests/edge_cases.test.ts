/**
 * @fileoverview Edge cases and defensive handling test suite.
 *
 * Verifies that the agent orchestration pipeline handles malformed, empty,
 * cyclic, and disconnected graphs gracefully without throwing unhandled exceptions.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MasterAgent, MockLLMProvider } from '../src/index.ts';
import type { DigitalTwinSchema } from '../../../shared/types/agent.ts';

// Use MockLLMProvider so edge case tests stay fast and fully offline
const agent = new MasterAgent(new MockLLMProvider());
const runFailureAnalysis = agent.runFailureAnalysis.bind(agent);

describe('Edge Cases & Defensive Handling', () => {
  test('Handles empty graph defensively', async () => {
    const emptyGraph: DigitalTwinSchema = {
      nodes: [],
      edges: [],
    };

    const report = await runFailureAnalysis(emptyGraph, 'What if Redis crashes?');
    assert.ok(report);
    assert.equal(report.affected_nodes.length, 0);
    assert.equal(report.failure_chains.length, 0);
    assert.equal(report.root_causes.length, 0);
    assert.equal(report.suggested_patches.length, 0);
    assert.ok(report.analyzed_at);
  });

  test('Handles malformed or missing input gracefully', async () => {
    const report1 = await runFailureAnalysis(null as unknown as DigitalTwinSchema, '');
    assert.ok(report1);
    assert.equal(report1.affected_nodes.length, 0);

    const report2 = await runFailureAnalysis(
      { nodes: undefined as unknown as [] } as unknown as DigitalTwinSchema,
      'Test prompt',
    );
    assert.ok(report2);
    assert.equal(report2.affected_nodes.length, 0);

    const report3 = await runFailureAnalysis(
      { nodes: [], edges: undefined as unknown as [] } as unknown as DigitalTwinSchema,
      'Test prompt',
    );
    assert.ok(report3);
    assert.equal(report3.affected_nodes.length, 0);
  });

  test('Handles disconnected nodes without errors', async () => {
    const disconnectedGraph: DigitalTwinSchema = {
      nodes: [
        { id: 'isolated-node-1', name: 'Isolated 1', type: 'service' },
        { id: 'isolated-node-2', name: 'Isolated 2', type: 'service' },
      ],
      edges: [],
    };

    const report = await runFailureAnalysis(disconnectedGraph, 'What if isolated-node-1 fails?');
    assert.ok(report);
    assert.equal(report.affected_nodes.length, 1);
    assert.equal(report.affected_nodes[0].node_id, 'isolated-node-1');
    assert.equal(report.failure_chains.length, 0);
  });

  test('Handles cyclical graph topologies without infinite loops', async () => {
    const cyclicGraph: DigitalTwinSchema = {
      nodes: [
        { id: 'service-a', name: 'Service A', type: 'service' },
        { id: 'service-b', name: 'Service B', type: 'service' },
      ],
      edges: [
        { source: 'service-a', target: 'service-b', protocol: 'http', sync: true },
        { source: 'service-b', target: 'service-a', protocol: 'http', sync: true },
      ],
    };

    const report = await runFailureAnalysis(cyclicGraph, 'What if service-a goes down?');
    assert.ok(report);
    assert.ok(report.affected_nodes.length >= 1);
    // Traversal terminates cleanly
  });

  test('Handles unknown scenario prompt with graceful fallback', async () => {
    const graph: DigitalTwinSchema = {
      nodes: [{ id: 'srv-1', name: 'Service 1', type: 'service' }],
      edges: [],
    };

    const report = await runFailureAnalysis(graph, 'Something completely unrecognized');
    assert.ok(report);
    assert.equal(report.affected_nodes.length, 1, 'Falls back to first node');
    assert.equal(report.affected_nodes[0].node_id, 'srv-1');
  });
});
