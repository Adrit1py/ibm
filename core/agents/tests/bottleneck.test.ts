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

  test('Tight timeout detection is scope-independent', async () => {
    const result = await subagent.analyze(
      sampleEcommerceGraph,
      ['order-service'],
      'Order service crashes',
    );

    const timeoutRcs = result.root_causes.filter(
      (r) => r.vulnerability_type === 'tight_timeout',
    );
    // redis-cache has timeout_ms: 200 which is < 500
    assert.ok(
      timeoutRcs.some((r) => r.node_id === 'redis-cache'),
      'Redis tight timeout detected globally',
    );
  });
});
