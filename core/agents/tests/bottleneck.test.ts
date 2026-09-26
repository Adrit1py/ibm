import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LatencyBottleneckSubagent } from '../src/subagents/bottleneck.ts';
import { MockLLMProvider } from '../src/llm/mock_provider.ts';
import { sampleEcommerceGraph } from './fixtures.ts';

describe('LatencyBottleneckSubagent', () => {
  const subagent = new LatencyBottleneckSubagent(new MockLLMProvider());

  test('Detects pool, timeout, and retry vulnerabilities on latency scenario', async () => {
    const result = await subagent.analyze(
      sampleEcommerceGraph,
      ['redis-cache'],
      'Payment API becomes 10x slower causing latency spike',
    );

    assert.ok(result.root_causes.length > 0, 'Vulnerabilities detected');
    const types = result.root_causes.map((r) => r.vulnerability_type);

    assert.ok(types.includes('unbounded_connection_pool'));
    assert.ok(types.includes('infinite_retry_without_jitter'));
    assert.equal(result.diagnostics.max_latency_multiplier, 10.0);
  });

  test('Non-latency scenario uses lower latency multiplier', async () => {
    const result = await subagent.analyze(
      sampleEcommerceGraph,
      ['redis-cache'],
      'Redis cache goes completely offline',
    );

    assert.equal(result.diagnostics.max_latency_multiplier, 3.5);
  });

  test('"spike" keyword triggers latency scenario (10x multiplier)', async () => {
    const result = await subagent.analyze(
      sampleEcommerceGraph,
      ['redis-cache'],
      'CPU spike causes database to become unresponsive',
    );

    assert.equal(result.diagnostics.max_latency_multiplier, 10.0);
  });

  test('parsedLatencyMultiplier overrides heuristic default', async () => {
    const result = await subagent.analyze(
      sampleEcommerceGraph,
      ['redis-cache'],
      'Redis cache goes completely offline',
      7.5,
    );

    assert.equal(result.diagnostics.max_latency_multiplier, 7.5);
  });

  test('Tight timeout detection fires on services but skips cache/queue nodes', async () => {
    // Use a graph that has a service with a tight timeout
    const graphWithTightServiceTimeout = {
      ...sampleEcommerceGraph,
      nodes: [
        ...sampleEcommerceGraph.nodes,
        {
          id: 'fast-service',
          name: 'Fast Service',
          type: 'service' as const,
          file_path: 'src/services/fast.ts',
          config: { timeout_ms: 100 },
        },
      ],
    };

    const result = await subagent.analyze(
      graphWithTightServiceTimeout,
      ['order-service'],
      'Order service crashes',
    );

    const timeoutRcs = result.root_causes.filter(
      (r) => r.vulnerability_type === 'tight_timeout',
    );

    // fast-service (type: service, 100ms) should be flagged
    assert.ok(
      timeoutRcs.some((r) => r.node_id === 'fast-service'),
      'Service with 100ms timeout should be flagged',
    );

    // redis-cache (type: cache, 200ms) must NOT be flagged — intentionally fast
    assert.ok(
      !timeoutRcs.some((r) => r.node_id === 'redis-cache'),
      'Cache nodes must be exempt from tight_timeout detection',
    );
  });
});
