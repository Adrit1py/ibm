import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RecoverySelfHealingSubagent } from '../src/subagents/recovery.ts';
import { MockLLMProvider } from '../src/llm/mock_provider.ts';
import { sampleEcommerceGraph, resilientSingleNodeGraph } from './fixtures.ts';
import type { AffectedNode } from '../../../shared/types/agent.ts';

describe('RecoverySelfHealingSubagent', () => {
  const subagent = new RecoverySelfHealingSubagent(new MockLLMProvider());

  test('Identifies missing CB and fallback on unprotected nodes', async () => {
    const affected: AffectedNode[] = [
      {
        node_id: 'order-service',
        node_name: 'Order Service',
        status: 'failing',
        impact_level: 'critical',
        failure_reason: 'Cascading timeout',
        latency_impact_multiplier: 5.0,
        error_rate_estimate: 0.9,
        recovering: false,
      },
    ];

    const result = await subagent.analyze(
      sampleEcommerceGraph,
      affected,
      'Redis drops packets for 30s',
    );

    const types = result.root_causes.map((r) => r.vulnerability_type);
    assert.ok(types.includes('missing_circuit_breaker'));
    assert.ok(types.includes('missing_fallback'));
    assert.ok(result.diagnostics.expected_recovery_time_ms >= 30000);
    assert.ok(result.diagnostics.identified_recovery_barriers.length > 0);
    assert.equal(result.diagnostics.self_healing_capable, false);
  });

  test('Resilient node with CB + fallback is marked as recovering', async () => {
    const affected: AffectedNode[] = [
      {
        node_id: 'web-server',
        node_name: 'Web Server',
        status: 'degraded',
        impact_level: 'medium',
        failure_reason: 'Upstream dependency down',
        latency_impact_multiplier: 1.5,
        error_rate_estimate: 0.1,
        recovering: false,
      },
    ];

    const result = await subagent.analyze(
      resilientSingleNodeGraph,
      affected,
      'Upstream API is unreachable for 10 seconds',
    );

    assert.ok(result.recovering_nodes.includes('web-server'));
    assert.equal(result.diagnostics.self_healing_capable, true);
    assert.equal(result.root_causes.length, 0, 'No vulnerabilities on resilient node');
  });

  test('Duration extraction: "10 seconds" scenario sets recovery time', async () => {
    const affected: AffectedNode[] = [
      {
        node_id: 'order-service',
        node_name: 'Order Service',
        status: 'failing',
        impact_level: 'critical',
        failure_reason: 'Cascading timeout',
        latency_impact_multiplier: 5.0,
        error_rate_estimate: 0.9,
        recovering: false,
      },
    ];

    const result = await subagent.analyze(
      sampleEcommerceGraph,
      affected,
      'Payment goes down for 10 seconds',
    );

    assert.ok(
      result.diagnostics.expected_recovery_time_ms >= 10000,
      'Should incorporate 10s from scenario',
    );
  });

  test('Leaf database node is not falsely flagged for missing client circuit breaker', async () => {
    const affected: AffectedNode[] = [
      {
        node_id: 'postgres-db',
        node_name: 'Orders PostgreSQL DB',
        status: 'dead',
        impact_level: 'critical',
        failure_reason: 'Database down',
        latency_impact_multiplier: 10.0,
        error_rate_estimate: 1.0,
        recovering: false,
      },
    ];

    const result = await subagent.analyze(
      sampleEcommerceGraph,
      affected,
      'Postgres crashes',
    );

    const cbVulnerabilities = result.root_causes.filter(
      (r) => r.node_id === 'postgres-db' && r.vulnerability_type === 'missing_circuit_breaker',
    );
    assert.equal(
      cbVulnerabilities.length,
      0,
      'Database should NOT be flagged for missing client circuit breaker when calling downstream',
    );
  });
});
