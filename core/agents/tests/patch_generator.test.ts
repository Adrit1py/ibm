/**
 * @fileoverview Test suite for PatchGeneratorAgent and generate_resilience_patch utility.
 *
 * Verifies that each supported resilience vulnerability type produces valid,
 * syntactically sound unified git diffs with accurate additions and deletions counts.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PatchGeneratorAgent,
  generate_resilience_patch,
} from '../src/subagents/patch_generator.ts';
import { MockLLMProvider } from '../src/llm/mock_provider.ts';
import { sampleEcommerceGraph } from './fixtures.ts';
import type {
  RootCause,
  FailureAnalysisReport,
} from '../../../shared/types/agent.ts';

describe('Patch Generator Test Suite', () => {
  const llm = new MockLLMProvider();
  const generator = new PatchGeneratorAgent(llm);

  test('Generates circuit breaker and backoff retry patches with valid unified diffs', async () => {
    const rootCauses: RootCause[] = [
      {
        id: 'rc-cb-order-service',
        node_id: 'order-service',
        vulnerability_type: 'missing_circuit_breaker',
        description: 'Missing circuit breaker on order service',
        severity: 'critical',
        file_target: 'src/services/order.ts',
      },
      {
        id: 'rc-retry-order-service',
        node_id: 'order-service',
        vulnerability_type: 'infinite_retry_without_jitter',
        description: 'Aggressive retry storm without jitter',
        severity: 'high',
        file_target: 'src/services/order.ts',
      },
    ];

    const patches = await generator.generatePatches(sampleEcommerceGraph, rootCauses);
    assert.equal(patches.length, 2, 'Should generate 2 patches');

    const cbPatch = patches.find((p) => p.resilience_pattern === 'circuit_breaker');
    assert.ok(cbPatch, 'Circuit breaker patch should exist');
    assert.equal(cbPatch.target_node_id, 'order-service');
    assert.ok(cbPatch.diff.includes('new CircuitBreaker'));
    assert.ok(cbPatch.estimated_blast_radius_reduction_pct > 0);

    const retryPatch = patches.find(
      (p) => p.resilience_pattern === 'exponential_backoff_jitter',
    );
    assert.ok(retryPatch, 'Exponential backoff patch should exist');
    assert.ok(retryPatch.diff.includes('backoff'));

    const report: FailureAnalysisReport = {
      scenario_prompt: 'Redis down',
      analyzed_at: new Date().toISOString(),
      affected_nodes: [],
      failure_chains: [],
      root_causes: rootCauses,
      suggested_patches: patches,
    };

    const unifiedDiff = generate_resilience_patch(report);
    assert.ok(
      unifiedDiff.raw_diff.includes('diff --git a/src/services/order.ts b/src/services/order.ts'),
    );
    assert.ok(unifiedDiff.files_changed.includes('src/services/order.ts'));
    assert.ok(unifiedDiff.total_additions > 0);
    assert.ok(unifiedDiff.total_deletions > 0);
    assert.equal(unifiedDiff.patches.length, 2);
  });

  test('Generates bulkhead and fallback cache patches', async () => {
    const rootCauses: RootCause[] = [
      {
        id: 'rc-pool-postgres',
        node_id: 'postgres-db',
        vulnerability_type: 'unbounded_connection_pool',
        description: 'Unbounded pool on Postgres',
        severity: 'high',
      },
      {
        id: 'rc-fb-order',
        node_id: 'order-service',
        vulnerability_type: 'missing_fallback',
        description: 'Missing fallback on order service',
        severity: 'high',
        file_target: 'src/services/order.ts',
      },
    ];

    const patches = await generator.generatePatches(sampleEcommerceGraph, rootCauses);
    assert.equal(patches.length, 2);

    const poolPatch = patches.find((p) => p.resilience_pattern === 'bulkhead_isolation');
    assert.ok(poolPatch, 'Bulkhead patch should be generated for unbounded pool');
    assert.ok(poolPatch.diff.includes('maxConnections: 50'));

    const fbPatch = patches.find((p) => p.resilience_pattern === 'fallback_cache');
    assert.ok(fbPatch, 'Fallback patch should be generated');
    assert.ok(fbPatch.diff.includes('localStaleCache'));
  });

  test('Handles empty or unsupported root causes gracefully', async () => {
    const unsupportedRootCauses: RootCause[] = [
      {
        id: 'rc-unknown',
        node_id: 'api-gateway',
        vulnerability_type: 'single_point_of_failure',
        description: 'Single point of failure',
        severity: 'medium',
      },
    ];

    const patches = await generator.generatePatches(sampleEcommerceGraph, unsupportedRootCauses);
    assert.equal(patches.length, 0, 'Unsupported vulnerability types produce no patches');

    const emptyReport: FailureAnalysisReport = {
      scenario_prompt: 'Test',
      analyzed_at: new Date().toISOString(),
      affected_nodes: [],
      failure_chains: [],
      root_causes: [],
      suggested_patches: [],
    };

    const emptyDiff = generate_resilience_patch(emptyReport);
    assert.equal(emptyDiff.raw_diff, '');
    assert.equal(emptyDiff.files_changed.length, 0);
    assert.equal(emptyDiff.total_additions, 0);
    assert.equal(emptyDiff.total_deletions, 0);
    assert.equal(emptyDiff.patches.length, 0);
  });
});
