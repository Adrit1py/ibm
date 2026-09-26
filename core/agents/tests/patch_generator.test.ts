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

  test('Generates health check, async queue, and failover patches', async () => {
    const rootCauses: RootCause[] = [
      {
        id: 'rc-hc-1',
        node_id: 'order-service',
        vulnerability_type: 'missing_health_check',
        description: 'Missing health check',
        severity: 'medium',
      },
      {
        id: 'rc-async-1',
        node_id: 'order-service',
        vulnerability_type: 'synchronous_blocking_call',
        description: 'Synchronous blocking call',
        severity: 'high',
      },
      {
        id: 'rc-spof-1',
        node_id: 'postgres-db',
        vulnerability_type: 'single_point_of_failure',
        description: 'Single database instance',
        severity: 'critical',
      },
    ];

    const patches = await generator.generatePatches(sampleEcommerceGraph, rootCauses);
    assert.equal(patches.length, 3, 'Should generate patches for all 3 vulnerability types');

    const hcPatch = patches.find((p) => p.resilience_pattern === 'health_check_endpoint');
    assert.ok(hcPatch);
    assert.ok(hcPatch.diff.includes('/healthz'));

    const asyncPatch = patches.find((p) => p.resilience_pattern === 'timeout_budgeting');
    assert.ok(asyncPatch);
    assert.ok(asyncPatch.diff.includes('AbortController') || asyncPatch.diff.includes('asyncQueue'));

    const spofPatch = patches.find((p) => p.resilience_pattern === 'graceful_degradation');
    assert.ok(spofPatch, 'SPOF patch should use graceful_degradation pattern');
    assert.ok(spofPatch.diff.includes('failover'));
  });

  test('Handles empty or unsupported root causes gracefully', async () => {
    const unsupportedRootCauses: RootCause[] = [
      {
        id: 'rc-unknown',
        node_id: 'api-gateway',
        vulnerability_type: 'unrecognized_custom_vulnerability' as any,
        description: 'Custom unsupported type',
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

  test('Polyglot patch synthesis: Java, C#, and Rust files produce language-idiomatic diffs', async () => {
    // Java file
    const javaRootCauses: RootCause[] = [
      {
        id: 'rc-java-cb',
        node_id: 'order-service',
        vulnerability_type: 'missing_circuit_breaker',
        description: 'Missing circuit breaker',
        severity: 'critical',
        file_target: 'src/main/java/com/app/OrderService.java',
      },
    ];
    const javaPatches = await generator.generatePatches(sampleEcommerceGraph, javaRootCauses);
    assert.equal(javaPatches.length, 1);
    assert.ok(javaPatches[0].diff.includes('Resilience4j'));
    assert.ok(javaPatches[0].diff.includes('CircuitBreakerConfig'));

    // C# file
    const csRootCauses: RootCause[] = [
      {
        id: 'rc-cs-cb',
        node_id: 'order-service',
        vulnerability_type: 'missing_circuit_breaker',
        description: 'Missing circuit breaker',
        severity: 'critical',
        file_target: 'src/Services/OrderService.cs',
      },
    ];
    const csPatches = await generator.generatePatches(sampleEcommerceGraph, csRootCauses);
    assert.equal(csPatches.length, 1);
    assert.ok(csPatches[0].diff.includes('Polly'));
    assert.ok(csPatches[0].diff.includes('CircuitBreakerAsync'));

    // Rust file
    const rustRootCauses: RootCause[] = [
      {
        id: 'rc-rs-cb',
        node_id: 'order-service',
        vulnerability_type: 'missing_circuit_breaker',
        description: 'Missing circuit breaker',
        severity: 'critical',
        file_target: 'src/services/order.rs',
      },
    ];
    const rustPatches = await generator.generatePatches(sampleEcommerceGraph, rustRootCauses);
    assert.equal(rustPatches.length, 1);
    assert.ok(rustPatches[0].diff.includes('recloser::Recloser'));
  });

  test('Polyglot patch synthesis: PHP, Ruby, C++, Elixir, and Kubernetes/YAML', async () => {
    // PHP file (Ganesha)
    const phpRootCauses: RootCause[] = [
      {
        id: 'rc-php-cb',
        node_id: 'order-service',
        vulnerability_type: 'missing_circuit_breaker',
        description: 'Missing circuit breaker on PHP service',
        severity: 'critical',
        file_target: 'src/Services/OrderService.php',
      },
    ];
    const phpPatches = await generator.generatePatches(sampleEcommerceGraph, phpRootCauses);
    assert.equal(phpPatches.length, 1);
    assert.ok(phpPatches[0].diff.includes('ackintosh/ganesha') || phpPatches[0].diff.includes('Ganesha'));

    // Ruby file (Semian)
    const rubyRootCauses: RootCause[] = [
      {
        id: 'rc-rb-cb',
        node_id: 'order-service',
        vulnerability_type: 'missing_circuit_breaker',
        description: 'Missing circuit breaker on Ruby service',
        severity: 'critical',
        file_target: 'app/services/order_service.rb',
      },
    ];
    const rubyPatches = await generator.generatePatches(sampleEcommerceGraph, rubyRootCauses);
    assert.equal(rubyPatches.length, 1);
    assert.ok(rubyPatches[0].diff.includes('semian') || rubyPatches[0].diff.includes('Semian'));

    // C++ file
    const cppRootCauses: RootCause[] = [
      {
        id: 'rc-cpp-cb',
        node_id: 'order-service',
        vulnerability_type: 'missing_circuit_breaker',
        description: 'Missing circuit breaker on C++ service',
        severity: 'critical',
        file_target: 'src/order_service.cpp',
      },
    ];
    const cppPatches = await generator.generatePatches(sampleEcommerceGraph, cppRootCauses);
    assert.equal(cppPatches.length, 1);
    assert.ok(cppPatches[0].diff.includes('CircuitBreaker') || cppPatches[0].diff.includes('consecutive_failures'));

    // Elixir file (:fuse)
    const elixirRootCauses: RootCause[] = [
      {
        id: 'rc-ex-cb',
        node_id: 'order-service',
        vulnerability_type: 'missing_circuit_breaker',
        description: 'Missing circuit breaker on Elixir service',
        severity: 'critical',
        file_target: 'lib/order_service.ex',
      },
    ];
    const elixirPatches = await generator.generatePatches(sampleEcommerceGraph, elixirRootCauses);
    assert.equal(elixirPatches.length, 1);
    assert.ok(elixirPatches[0].diff.includes(':fuse'));

    // Kubernetes / Service Mesh YAML
    const yamlRootCauses: RootCause[] = [
      {
        id: 'rc-k8s-cb',
        node_id: 'order-service',
        vulnerability_type: 'missing_circuit_breaker',
        description: 'Missing circuit breaker in Envoy/Istio config',
        severity: 'critical',
        file_target: 'k8s/destination-rule.yaml',
      },
      {
        id: 'rc-k8s-hc',
        node_id: 'order-service',
        vulnerability_type: 'missing_health_check',
        description: 'Missing liveness/readiness probes',
        severity: 'high',
        file_target: 'k8s/deployment.yaml',
      },
    ];
    const yamlPatches = await generator.generatePatches(sampleEcommerceGraph, yamlRootCauses);
    assert.equal(yamlPatches.length, 2);
    assert.ok(yamlPatches[0].diff.includes('outlierDetection') || yamlPatches[0].diff.includes('consecutive5xxErrors'));
    assert.ok(yamlPatches[1].diff.includes('livenessProbe') || yamlPatches[1].diff.includes('readinessProbe'));
  });
});

