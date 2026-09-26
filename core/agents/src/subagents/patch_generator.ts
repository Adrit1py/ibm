/**
 * @fileoverview Patch Generator — synthesizes resilience code fixes.
 *
 * For each identified root cause, generates a production-quality unified
 * git diff implementing a battle-tested resilience pattern. Also provides
 * the `generate_resilience_patch` function that compiles all suggested
 * patches from a `FailureAnalysisReport` into a single `UnifiedGitDiff`.
 *
 * @module core/agents/subagents/patch_generator
 */

import type {
  DigitalTwinSchema,
  DigitalTwinNode,
  RootCause,
  SuggestedPatch,
  FailureAnalysisReport,
  UnifiedGitDiff,
  PatchEntry,
  VulnerabilityType,
} from '../../../../shared/types/agent.ts';
import type { LLMProvider } from '../llm/provider.ts';

/**
 * Generates actionable code patches implementing resilience patterns
 * for each identified root-cause vulnerability.
 */
export class PatchGeneratorAgent {
  private readonly llm: LLMProvider;

  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  /**
   * Generates suggested patches for all provided root causes.
   *
   * @param digitalTwin - The architecture graph (used to resolve node metadata).
   * @param rootCauses  - Vulnerabilities identified by the analysis subagents.
   * @returns Array of suggested patches with unified git diffs.
   */
  async generatePatches(
    digitalTwin: DigitalTwinSchema,
    rootCauses: readonly RootCause[],
  ): Promise<SuggestedPatch[]> {
    const nodeMap = new Map<string, DigitalTwinNode>(
      digitalTwin.nodes.map((n) => [n.id, n]),
    );

    const patches: SuggestedPatch[] = [];

    for (const rc of rootCauses) {
      const node = nodeMap.get(rc.node_id);
      const targetFile =
        rc.file_target ?? node?.file_path ?? `src/services/${rc.node_id}.ts`;
      const nodeName = node?.name ?? rc.node_id;

      const patch = this.buildPatchForVulnerability(rc, targetFile, nodeName);
      if (patch !== null) {
        patches.push(patch);
      }
    }

    return patches;
  }

  /**
   * Dispatches to the appropriate patch template based on vulnerability type
   * and target file language (detected from file extension).
   * Returns `null` for vulnerability types without a defined patch template.
   */
  private buildPatchForVulnerability(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch | null {
    const lang = this.detectLanguage(targetFile);

    switch (rc.vulnerability_type) {
      case 'missing_circuit_breaker':
        switch (lang) {
          case 'python': return this.buildCircuitBreakerPatchPython(rc, targetFile, nodeName);
          case 'go': return this.buildCircuitBreakerPatchGo(rc, targetFile, nodeName);
          case 'java': return this.buildCircuitBreakerPatchJava(rc, targetFile, nodeName);
          case 'csharp': return this.buildCircuitBreakerPatchCSharp(rc, targetFile, nodeName);
          case 'rust': return this.buildCircuitBreakerPatchRust(rc, targetFile, nodeName);
          case 'php': return this.buildCircuitBreakerPatchPHP(rc, targetFile, nodeName);
          case 'ruby': return this.buildCircuitBreakerPatchRuby(rc, targetFile, nodeName);
          case 'cpp': return this.buildCircuitBreakerPatchCpp(rc, targetFile, nodeName);
          case 'elixir': return this.buildCircuitBreakerPatchElixir(rc, targetFile, nodeName);
          case 'yaml': return this.buildCircuitBreakerPatchYaml(rc, targetFile, nodeName);
          default: return this.buildCircuitBreakerPatch(rc, targetFile, nodeName);
        }
      case 'infinite_retry_without_jitter':
        switch (lang) {
          case 'python': return this.buildExponentialBackoffPatchPython(rc, targetFile, nodeName);
          case 'go': return this.buildExponentialBackoffPatchGo(rc, targetFile, nodeName);
          case 'java': return this.buildExponentialBackoffPatchJava(rc, targetFile, nodeName);
          case 'csharp': return this.buildExponentialBackoffPatchCSharp(rc, targetFile, nodeName);
          case 'rust': return this.buildExponentialBackoffPatchRust(rc, targetFile, nodeName);
          case 'php': return this.buildExponentialBackoffPatchPHP(rc, targetFile, nodeName);
          case 'ruby': return this.buildExponentialBackoffPatchRuby(rc, targetFile, nodeName);
          case 'cpp': return this.buildExponentialBackoffPatchCpp(rc, targetFile, nodeName);
          case 'elixir': return this.buildExponentialBackoffPatchElixir(rc, targetFile, nodeName);
          case 'yaml': return this.buildExponentialBackoffPatchYaml(rc, targetFile, nodeName);
          default: return this.buildExponentialBackoffPatch(rc, targetFile, nodeName);
        }
      case 'tight_timeout':
      case 'unbounded_connection_pool':
        switch (lang) {
          case 'python': return this.buildBulkheadPatchPython(rc, targetFile, nodeName);
          case 'go': return this.buildBulkheadPatchGo(rc, targetFile, nodeName);
          case 'java': return this.buildBulkheadPatchJava(rc, targetFile, nodeName);
          case 'csharp': return this.buildBulkheadPatchCSharp(rc, targetFile, nodeName);
          case 'rust': return this.buildBulkheadPatchRust(rc, targetFile, nodeName);
          case 'php': return this.buildBulkheadPatchPHP(rc, targetFile, nodeName);
          case 'ruby': return this.buildBulkheadPatchRuby(rc, targetFile, nodeName);
          case 'cpp': return this.buildBulkheadPatchCpp(rc, targetFile, nodeName);
          case 'elixir': return this.buildBulkheadPatchElixir(rc, targetFile, nodeName);
          case 'yaml': return this.buildBulkheadPatchYaml(rc, targetFile, nodeName);
          default: return this.buildBulkheadIsolationPatch(rc, targetFile, nodeName);
        }
      case 'missing_fallback':
        switch (lang) {
          case 'python': return this.buildFallbackCachePatchPython(rc, targetFile, nodeName);
          case 'go': return this.buildFallbackCachePatchGo(rc, targetFile, nodeName);
          case 'java': return this.buildFallbackCachePatchJava(rc, targetFile, nodeName);
          case 'csharp': return this.buildFallbackCachePatchCSharp(rc, targetFile, nodeName);
          case 'rust': return this.buildFallbackCachePatchRust(rc, targetFile, nodeName);
          case 'php': return this.buildFallbackCachePatchPHP(rc, targetFile, nodeName);
          case 'ruby': return this.buildFallbackCachePatchRuby(rc, targetFile, nodeName);
          case 'cpp': return this.buildFallbackCachePatchCpp(rc, targetFile, nodeName);
          case 'elixir': return this.buildFallbackCachePatchElixir(rc, targetFile, nodeName);
          case 'yaml': return this.buildFallbackCachePatchYaml(rc, targetFile, nodeName);
          default: return this.buildFallbackCachePatch(rc, targetFile, nodeName);
        }
      case 'missing_health_check':
        switch (lang) {
          case 'python': return this.buildHealthCheckPatchPython(rc, targetFile, nodeName);
          case 'go': return this.buildHealthCheckPatchGo(rc, targetFile, nodeName);
          case 'java': return this.buildHealthCheckPatchJava(rc, targetFile, nodeName);
          case 'csharp': return this.buildHealthCheckPatchCSharp(rc, targetFile, nodeName);
          case 'rust': return this.buildHealthCheckPatchRust(rc, targetFile, nodeName);
          case 'php': return this.buildHealthCheckPatchPHP(rc, targetFile, nodeName);
          case 'ruby': return this.buildHealthCheckPatchRuby(rc, targetFile, nodeName);
          case 'cpp': return this.buildHealthCheckPatchCpp(rc, targetFile, nodeName);
          case 'elixir': return this.buildHealthCheckPatchElixir(rc, targetFile, nodeName);
          case 'yaml': return this.buildHealthCheckPatchYaml(rc, targetFile, nodeName);
          default: return this.buildHealthCheckPatch(rc, targetFile, nodeName);
        }
      case 'synchronous_blocking_call':
        switch (lang) {
          case 'python': return this.buildAsyncQueuePatchPython(rc, targetFile, nodeName);
          case 'go': return this.buildAsyncQueuePatchGo(rc, targetFile, nodeName);
          case 'java': return this.buildAsyncQueuePatchJava(rc, targetFile, nodeName);
          case 'csharp': return this.buildAsyncQueuePatchCSharp(rc, targetFile, nodeName);
          case 'rust': return this.buildAsyncQueuePatchRust(rc, targetFile, nodeName);
          case 'php': return this.buildAsyncQueuePatchPHP(rc, targetFile, nodeName);
          case 'ruby': return this.buildAsyncQueuePatchRuby(rc, targetFile, nodeName);
          case 'cpp': return this.buildAsyncQueuePatchCpp(rc, targetFile, nodeName);
          case 'elixir': return this.buildAsyncQueuePatchElixir(rc, targetFile, nodeName);
          case 'yaml': return this.buildAsyncQueuePatchYaml(rc, targetFile, nodeName);
          default: return this.buildAsyncQueuePatch(rc, targetFile, nodeName);
        }
      case 'single_point_of_failure':
        switch (lang) {
          case 'python': return this.buildFailoverPatchPython(rc, targetFile, nodeName);
          case 'go': return this.buildFailoverPatchGo(rc, targetFile, nodeName);
          case 'java': return this.buildFailoverPatchJava(rc, targetFile, nodeName);
          case 'csharp': return this.buildFailoverPatchCSharp(rc, targetFile, nodeName);
          case 'rust': return this.buildFailoverPatchRust(rc, targetFile, nodeName);
          case 'php': return this.buildFailoverPatchPHP(rc, targetFile, nodeName);
          case 'ruby': return this.buildFailoverPatchRuby(rc, targetFile, nodeName);
          case 'cpp': return this.buildFailoverPatchCpp(rc, targetFile, nodeName);
          case 'elixir': return this.buildFailoverPatchElixir(rc, targetFile, nodeName);
          case 'yaml': return this.buildFailoverPatchYaml(rc, targetFile, nodeName);
          default: return this.buildFailoverPatch(rc, targetFile, nodeName);
        }
      default:
        return null;
    }
  }

  /** Detects language from file extension across major enterprise ecosystems. */
  private detectLanguage(
    filePath: string,
  ):
    | 'typescript'
    | 'python'
    | 'go'
    | 'java'
    | 'csharp'
    | 'rust'
    | 'php'
    | 'ruby'
    | 'cpp'
    | 'elixir'
    | 'yaml' {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.py')) return 'python';
    if (lower.endsWith('.go')) return 'go';
    if (
      lower.endsWith('.java') ||
      lower.endsWith('.kt') ||
      lower.endsWith('.scala') ||
      lower.endsWith('.groovy')
    ) {
      return 'java';
    }
    if (lower.endsWith('.cs') || lower.endsWith('.fs')) return 'csharp';
    if (lower.endsWith('.rs')) return 'rust';
    if (lower.endsWith('.php')) return 'php';
    if (lower.endsWith('.rb') || lower.endsWith('.rake') || lower.endsWith('.gemspec')) return 'ruby';
    if (lower.endsWith('.c') || lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.h') || lower.endsWith('.hpp')) return 'cpp';
    if (lower.endsWith('.ex') || lower.endsWith('.exs')) return 'elixir';
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
    return 'typescript';
  }

  /** Generates a Circuit Breaker + Fallback patch. */
  private buildCircuitBreakerPatch(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 83a12cd..49f03ba 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -12,1 +12,9 @@ export async function callDependency(request: Request) {`,
      `-  return await executeRemoteCall(request);`,
      `+  // Bob Resilience Patch: Circuit Breaker with 50% failure threshold & 10s cooldown`,
      `+  const breaker = new CircuitBreaker(executeRemoteCall, {`,
      `+    timeout: 3000,`,
      `+    errorThresholdPercentage: 50,`,
      `+    resetTimeout: 10000`,
      `+  });`,
      `+  breaker.fallback(() => getFallbackCacheResponse(request));`,
      `+  return breaker.fire(request);`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-cb-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Circuit Breaker and Fallback to ${nodeName}`,
      description:
        `Wraps remote calls from ${nodeName} in a circuit breaker ` +
        `(opossum-style) to prevent cascading thread starvation during ` +
        `dependency downtime. Includes a fallback for degraded responses.`,
      resilience_pattern: 'circuit_breaker',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  /** Generates an Exponential Backoff with Full Jitter patch. */
  private buildExponentialBackoffPatch(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 91f7a4e..2bc84e1 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -25,1 +25,8 @@ export async function retryOperation(fn: Function) {`,
      `-  for (let i = 0; i < 5; i++) { await fn(); }`,
      `+  // Bob Resilience Patch: Exponential Backoff with Full Jitter`,
      `+  const MAX_ATTEMPTS = 3;`,
      `+  const backoff = (attempt: number) =>`,
      `+    Math.random() * Math.min(5000, 100 * Math.pow(2, attempt));`,
      `+  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {`,
      `+    try { return await fn(); }`,
      `+    catch (err) { if (attempt === MAX_ATTEMPTS - 1) throw err; await sleep(backoff(attempt)); }`,
      `+  }`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-retry-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Apply Exponential Backoff with Jitter to ${nodeName}`,
      description:
        `Replaces aggressive unthrottled retries with truncated ` +
        `exponential backoff and randomized full jitter to prevent ` +
        `retry storms from amplifying downstream failures.`,
      resilience_pattern: 'exponential_backoff_jitter',
      diff,
      estimated_blast_radius_reduction_pct: 60,
    };
  }

  /** Generates a Bulkhead Isolation / Connection Pool Bounding patch. */
  private buildBulkheadIsolationPatch(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index e7103a1..fa91280 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,6 @@ export const poolConfig = {`,
      `-  maxConnections: 500, timeoutMs: 200`,
      `+  // Bob Resilience Patch: Bounded connection pool & adaptive timeout budget`,
      `+  maxConnections: 50,`,
      `+  timeoutMs: 2500,`,
      `+  idleTimeoutMillis: 30000,`,
      `+  connectionTimeoutMillis: 2000`,
      ` };`,
    ].join('\n');

    return {
      id: `patch-pool-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Bound Connection Pool & Adjust Timeout for ${nodeName}`,
      description:
        `Configures strict connection pool bounds and a realistic ` +
        `timeout budget to prevent thread starvation under load.`,
      resilience_pattern: 'bulkhead_isolation',
      diff,
      estimated_blast_radius_reduction_pct: 50,
    };
  }

  /** Generates a Stale-While-Revalidate Fallback Cache patch. */
  private buildFallbackCachePatch(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 6711cd2..98bb12c 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -18,1 +18,6 @@ export async function getData(key: string) {`,
      `-  return await remoteClient.get(key);`,
      `+  // Bob Resilience Patch: Degrade to stale local in-memory cache`,
      `+  try {`,
      `+    return await remoteClient.get(key);`,
      `+  } catch (err) {`,
      `+    return localStaleCache.get(key) || DEFAULT_FALLBACK_PAYLOAD;`,
      `+  }`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-fb-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Stale-While-Revalidate Fallback Cache to ${nodeName}`,
      description:
        `Provides local cached responses when the primary upstream ` +
        `service fails, ensuring high availability with stale data.`,
      resilience_pattern: 'fallback_cache',
      diff,
      estimated_blast_radius_reduction_pct: 80,
    };
  }

  // ── Python / FastAPI patches ───────────────────────────────────────────────

  /** Circuit Breaker for Python using pybreaker. */
  private buildCircuitBreakerPatchPython(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index a1b2c3d..d4e5f6a 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,3 +1,12 @@ from fastapi import FastAPI`,
      `+# Bob Resilience Patch: Circuit Breaker via pybreaker`,
      `+import pybreaker`,
      `+`,
      `+_breaker = pybreaker.CircuitBreaker(`,
      `+    fail_max=5,`,
      `+    reset_timeout=10,`,
      `+    listeners=[pybreaker.CircuitBreakerListener()]`,
      `+)`,
      `+`,
      `+@_breaker`,
      ` async def call_dependency(payload: dict):`,
      `-    return await remote_client.post(payload)`,
      `+    return await remote_client.post(payload)  # protected by circuit breaker`,
    ].join('\n');

    return {
      id: `patch-cb-py-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Circuit Breaker (pybreaker) to ${nodeName}`,
      description:
        `Wraps the remote call in a pybreaker circuit breaker that opens ` +
        `after 5 consecutive failures and resets after 10 seconds.`,
      resilience_pattern: 'circuit_breaker',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  /** Exponential Backoff with Jitter for Python using tenacity. */
  private buildExponentialBackoffPatchPython(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index b2c3d4e..e5f6a7b 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,3 +1,11 @@ import httpx`,
      `+# Bob Resilience Patch: Exponential Backoff with Full Jitter via tenacity`,
      `+from tenacity import (`,
      `+    retry, stop_after_attempt, wait_exponential_jitter, retry_if_exception_type`,
      `+)`,
      `+`,
      `+@retry(`,
      `+    stop=stop_after_attempt(3),`,
      `+    wait=wait_exponential_jitter(initial=0.1, max=5.0),`,
      `+    retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),`,
      `+)`,
      ` async def call_with_retry(url: str) -> dict:`,
      `-    async with httpx.AsyncClient() as client:`,
      `-        return (await client.get(url)).json()`,
      `+    async with httpx.AsyncClient(timeout=5.0) as client:`,
      `+        return (await client.get(url)).json()`,
    ].join('\n');

    return {
      id: `patch-retry-py-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Apply Exponential Backoff with Jitter (tenacity) to ${nodeName}`,
      description:
        `Replaces bare retry loop with tenacity exponential backoff + ` +
        `randomized jitter, capped at 3 attempts and 5s max wait.`,
      resilience_pattern: 'exponential_backoff_jitter',
      diff,
      estimated_blast_radius_reduction_pct: 60,
    };
  }

  /** Bulkhead / thread pool bounding for Python. */
  private buildBulkheadPatchPython(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index c3d4e5f..f6a7b8c 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,5 +1,10 @@ import asyncpg`,
      `+# Bob Resilience Patch: Bounded connection pool & timeout budget`,
      ` async def get_pool():`,
      `-    return await asyncpg.create_pool(DATABASE_URL)`,
      `+    return await asyncpg.create_pool(`,
      `+        DATABASE_URL,`,
      `+        min_size=2,`,
      `+        max_size=10,`,
      `+        command_timeout=5.0,`,
      `+        max_inactive_connection_lifetime=30.0,`,
      `+    )`,
    ].join('\n');

    return {
      id: `patch-pool-py-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Bound Connection Pool & Timeout for ${nodeName}`,
      description:
        `Configures asyncpg with max_size=10, command_timeout=5s, and ` +
        `inactive connection lifetime to prevent pool exhaustion.`,
      resilience_pattern: 'bulkhead_isolation',
      diff,
      estimated_blast_radius_reduction_pct: 50,
    };
  }

  /** Stale-while-revalidate fallback cache for Python. */
  private buildFallbackCachePatchPython(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index d4e5f6a..a7b8c9d 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,5 +1,14 @@ import httpx`,
      `+# Bob Resilience Patch: Stale-while-revalidate in-memory fallback`,
      `+from functools import lru_cache`,
      `+import time`,
      `+_stale_cache: dict = {}`,
      `+`,
      ` async def get_data(key: str) -> dict:`,
      `-    return await remote_client.get(key)`,
      `+    try:`,
      `+        result = await remote_client.get(key)`,
      `+        _stale_cache[key] = result`,
      `+        return result`,
      `+    except Exception:`,
      `+        return _stale_cache.get(key, DEFAULT_FALLBACK)`,
    ].join('\n');

    return {
      id: `patch-fb-py-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Stale Fallback Cache to ${nodeName}`,
      description:
        `Returns stale cached data from an in-memory dict when the remote ` +
        `call fails, preventing hard errors from propagating.`,
      resilience_pattern: 'fallback_cache',
      diff,
      estimated_blast_radius_reduction_pct: 80,
    };
  }

  // ── Go patches ────────────────────────────────────────────────────────────

  /** Circuit Breaker for Go using gobreaker. */
  private buildCircuitBreakerPatchGo(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index e5f6a7b..b8c9d0e 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,5 +1,17 @@ package service`,
      `+// Bob Resilience Patch: Circuit Breaker via sony/gobreaker`,
      `+import "github.com/sony/gobreaker"`,
      `+`,
      `+var cb = gobreaker.NewCircuitBreaker(gobreaker.Settings{`,
      `+    Name:        "${nodeName}",`,
      `+    MaxRequests: 1,`,
      `+    Interval:    10 * time.Second,`,
      `+    Timeout:     10 * time.Second,`,
      `+    ReadyToTrip: func(c gobreaker.Counts) bool {`,
      `+        return c.ConsecutiveFailures > 5`,
      `+    },`,
      `+})`,
      `+`,
      ` func CallDependency(req Request) (Response, error) {`,
      `-    return executeRemoteCall(req)`,
      `+    result, err := cb.Execute(func() (interface{}, error) { return executeRemoteCall(req) })`,
      `+    if err != nil { return Response{}, err }`,
      `+    return result.(Response), nil`,
    ].join('\n');

    return {
      id: `patch-cb-go-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Circuit Breaker (gobreaker) to ${nodeName}`,
      description:
        `Wraps remote call in a sony/gobreaker circuit breaker: opens after ` +
        `5 consecutive failures, resets after 10 seconds.`,
      resilience_pattern: 'circuit_breaker',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  /** Exponential Backoff with Jitter for Go. */
  private buildExponentialBackoffPatchGo(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index f6a7b8c..c9d0e1f 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,5 +1,18 @@ package service`,
      `+// Bob Resilience Patch: Exponential Backoff with Full Jitter`,
      `+import (`,
      `+    "math"`,
      `+    "math/rand"`,
      `+    "time"`,
      `+)`,
      `+`,
      `+func withBackoff(fn func() error) error {`,
      `+    const maxAttempts = 3`,
      `+    for attempt := 0; attempt < maxAttempts; attempt++ {`,
      `+        if err := fn(); err == nil { return nil }`,
      `+        if attempt == maxAttempts-1 { break }`,
      `+        cap := math.Pow(2, float64(attempt)) * 100`,
      `+        sleep := time.Duration(rand.Float64()*cap) * time.Millisecond`,
      `+        time.Sleep(sleep)`,
      `+    }`,
      `+    return fmt.Errorf("all %d attempts failed", maxAttempts)`,
      `+}`,
      ` func retryOperation() error {`,
      `-    for i := 0; i < 5; i++ { if err := doWork(); err == nil { return nil } }`,
      `-    return errors.New("failed")`,
      `+    return withBackoff(doWork)`,
    ].join('\n');

    return {
      id: `patch-retry-go-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Apply Exponential Backoff with Jitter to ${nodeName}`,
      description:
        `Replaces naive retry loop with truncated exponential backoff and ` +
        `randomized full jitter (max 3 attempts).`,
      resilience_pattern: 'exponential_backoff_jitter',
      diff,
      estimated_blast_radius_reduction_pct: 60,
    };
  }

  /** Connection pool bounding for Go. */
  private buildBulkheadPatchGo(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index a7b8c9d..d0e1f2a 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,5 +1,10 @@ package db`,
      `+// Bob Resilience Patch: Bounded connection pool & query timeout`,
      ` func NewPool(dsn string) (*sql.DB, error) {`,
      `     db, err := sql.Open("postgres", dsn)`,
      `     if err != nil { return nil, err }`,
      `-    db.SetMaxOpenConns(200)`,
      `+    // Bob: bound pool, add idle + lifetime limits`,
      `+    db.SetMaxOpenConns(25)`,
      `+    db.SetMaxIdleConns(5)`,
      `+    db.SetConnMaxLifetime(5 * time.Minute)`,
      `+    db.SetConnMaxIdleTime(30 * time.Second)`,
      `     return db, nil`,
    ].join('\n');

    return {
      id: `patch-pool-go-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Bound Connection Pool for ${nodeName}`,
      description:
        `Limits DB connection pool to 25 open + 5 idle connections with ` +
        `5min lifetime and 30s idle timeout.`,
      resilience_pattern: 'bulkhead_isolation',
      diff,
      estimated_blast_radius_reduction_pct: 50,
    };
  }

  /** Stale fallback cache for Go. */
  private buildFallbackCachePatchGo(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index b8c9d0e..e1f2a3b 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,7 +1,19 @@ package service`,
      `+// Bob Resilience Patch: Stale-while-revalidate in-memory cache`,
      `+import "sync"`,
      `+`,
      `+var (`,
      `+    mu    sync.RWMutex`,
      `+    cache = make(map[string]interface{})`,
      `+)`,
      `+`,
      ` func GetData(key string) (interface{}, error) {`,
      `-    return remoteClient.Get(key)`,
      `+    result, err := remoteClient.Get(key)`,
      `+    if err == nil {`,
      `+        mu.Lock(); cache[key] = result; mu.Unlock()`,
      `+        return result, nil`,
      `+    }`,
      `+    mu.RLock(); stale, ok := cache[key]; mu.RUnlock()`,
      `+    if ok { return stale, nil }`,
      `+    return nil, err`,
    ].join('\n');

    return {
      id: `patch-fb-go-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Stale Fallback Cache to ${nodeName}`,
      description:
        `Uses a sync.RWMutex-protected in-memory map to serve stale data ` +
        `when the remote call fails.`,
      resilience_pattern: 'fallback_cache',
      diff,
      estimated_blast_radius_reduction_pct: 80,
    };
  }

  // -------------------------------------------------------------------------
  // Health Check Endpoint Patches (TS, Python, Go)
  // -------------------------------------------------------------------------

  /** Health check endpoint for TypeScript (Express/Fastify). */
  private buildHealthCheckPatch(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 4a5b6c7..7d8e9f0 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,3 +1,11 @@`,
      ` const app = express();`,
      `+// Bob Resilience Patch: Health & Liveness Probe Endpoint`,
      `+app.get('/healthz', async (_req, res) => {`,
      `+  const isHealthy = await checkDependenciesHealthy();`,
      `+  res.status(isHealthy ? 200 : 503).json({`,
      `+    status: isHealthy ? 'UP' : 'DOWN',`,
      `+    uptime: process.uptime(),`,
      `+    node: '${nodeName}',`,
      `+  });`,
      `+});`,
    ].join('\n');

    return {
      id: `patch-hc-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add /healthz Liveness & Readiness Endpoint to ${nodeName}`,
      description:
        `Exposes an active /healthz probe endpoint checking upstream dependency ` +
        `health to enable rapid upstream circuit breaking during failures.`,
      resilience_pattern: 'health_check_endpoint',
      diff,
      estimated_blast_radius_reduction_pct: 65,
    };
  }

  /** Health check endpoint for Python (FastAPI/Flask). */
  private buildHealthCheckPatchPython(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 5b6c7d8..8e9f0a1 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,3 +1,10 @@`,
      ` app = FastAPI()`,
      `+# Bob Resilience Patch: Liveness Probe Endpoint`,
      `+@app.get("/healthz")`,
      `+async def health_check():`,
      `+    if not await check_dependencies_live():`,
      `+        raise HTTPException(status_code=503, detail="Unhealthy")`,
      `+    return {"status": "UP", "service": "${nodeName}"}`,
    ].join('\n');

    return {
      id: `patch-hc-py-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add /healthz Endpoint to ${nodeName}`,
      description:
        `Implements active health check probe returning 503 on dependency loss.`,
      resilience_pattern: 'health_check_endpoint',
      diff,
      estimated_blast_radius_reduction_pct: 65,
    };
  }

  /** Health check endpoint for Go (net/http). */
  private buildHealthCheckPatchGo(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 6c7d8e9..9f0a1b2 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,4 +1,12 @@ package main`,
      `+// Bob Resilience Patch: HTTP /healthz Handler`,
      `+func healthzHandler(w http.ResponseWriter, r *http.Request) {`,
      `+    if !checkDependencies() {`,
      `+        http.Error(w, "Unavailable", http.StatusServiceUnavailable)`,
      `+        return`,
      `+    }`,
      `+    w.Header().Set("Content-Type", "application/json")`,
      `+    w.WriteHeader(http.StatusOK)`,
      `+    w.Write([]byte(\`{"status":"UP","node":"${nodeName}"}\`))`,
      `+}`,
    ].join('\n');

    return {
      id: `patch-hc-go-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add /healthz Handler to ${nodeName}`,
      description:
        `Registers a net/http health check endpoint reporting live status.`,
      resilience_pattern: 'health_check_endpoint',
      diff,
      estimated_blast_radius_reduction_pct: 65,
    };
  }

  // -------------------------------------------------------------------------
  // Synchronous Blocking Call Patches (TS, Python, Go)
  // -------------------------------------------------------------------------

  /** Async/timeout budgeting for synchronous blocking calls (TypeScript). */
  private buildAsyncQueuePatch(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 7d8e9f0..0a1b2c3 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -15,1 +15,9 @@ export async function handleRequest(data: Payload) {`,
      `-  const result = syncExecuteBlocking(data);`,
      `+  // Bob Resilience Patch: Non-blocking asynchronous dispatch with timeout budget`,
      `+  const controller = new AbortController();`,
      `+  const timeout = setTimeout(() => controller.abort(), 2500);`,
      `+  try {`,
      `+    return await asyncQueue.enqueue(() => executeTaskAsync(data, controller.signal));`,
      `+  } finally {`,
      `+    clearTimeout(timeout);`,
      `+  }`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-async-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Convert Blocking Call to Async Queue in ${nodeName}`,
      description:
        `Replaces synchronous blocking call with bounded async queue execution ` +
        `and strict 2.5s AbortController timeout budget.`,
      resilience_pattern: 'timeout_budgeting',
      diff,
      estimated_blast_radius_reduction_pct: 70,
    };
  }

  /** Async worker for Python. */
  private buildAsyncQueuePatchPython(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 8e9f0a1..1b2c3d4 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -10,1 +10,7 @@ async def process_job(payload):`,
      `-    result = blocking_sync_call(payload)`,
      `+    # Bob Resilience Patch: Non-blocking thread delegation with timeout budget`,
      `+    try:`,
      `+        async with asyncio.timeout(2.5):`,
      `+            return await asyncio.to_thread(blocking_sync_call, payload)`,
      `+    except TimeoutError:`,
      `+        return get_fallback_result()`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-async-py-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Wrap Blocking Call in asyncio.to_thread with Timeout for ${nodeName}`,
      description:
        `Delegates blocking sync call to threadpool with strict 2.5s timeout.`,
      resilience_pattern: 'timeout_budgeting',
      diff,
      estimated_blast_radius_reduction_pct: 70,
    };
  }

  /** Non-blocking channel worker for Go. */
  private buildAsyncQueuePatchGo(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 9f0a1b2..2c3d4e5 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -12,1 +12,10 @@ func HandleRequest(ctx context.Context, payload []byte) error {`,
      `-    return syncBlockingCall(payload)`,
      `+    // Bob Resilience Patch: Goroutine channel with context timeout budget`,
      `+    ctx, cancel := context.WithTimeout(ctx, 2500*time.Millisecond)`,
      `+    defer cancel()`,
      `+    ch := make(chan error, 1)`,
      `+    go func() { ch <- syncBlockingCall(payload) }()`,
      `+    select {`,
      `+    case err := <-ch: return err`,
      `+    case <-ctx.Done(): return errors.New("timeout budget exceeded")`,
      `+    }`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-async-go-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Wrap Blocking Call in Goroutine with Timeout for ${nodeName}`,
      description:
        `Converts synchronous blocking call to buffered channel select with context timeout.`,
      resilience_pattern: 'timeout_budgeting',
      diff,
      estimated_blast_radius_reduction_pct: 70,
    };
  }

  // -------------------------------------------------------------------------
  // Single Point of Failure (SPOF) Patches (TS, Python, Go)
  // -------------------------------------------------------------------------

  /** High-availability failover configuration for TypeScript. */
  private buildFailoverPatch(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 0a1b2c3..3d4e5f6 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,7 @@ export const clientConfig = {`,
      `-  host: "primary.internal",`,
      `+  // Bob Resilience Patch: Multi-host failover configuration`,
      `+  hosts: ["primary.internal", "standby.internal"],`,
      `+  failover: { enabled: true, maxRetriesBeforeSwitch: 2, healthCheckIntervalMs: 5000 },`,
      `+  readReplicas: ["replica-1.internal", "replica-2.internal"],`,
      ` };`,
    ].join('\n');

    return {
      id: `patch-spof-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add High-Availability Standby Failover to ${nodeName}`,
      description:
        `Configures automated multi-host standby failover and read-replica distribution.`,
      resilience_pattern: 'graceful_degradation',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  /** High-availability failover for Python. */
  private buildFailoverPatchPython(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 1b2c3d4..4e5f6a7 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -4,1 +4,6 @@ DB_URI = "postgresql://user:pass@primary-db:5432/main"`,
      `+# Bob Resilience Patch: Multi-host failover connection string`,
      `+DB_URI = "postgresql://user:pass@primary-db:5432,standby-db:5432/main?target_session_attrs=read-write"`,
      `+ENGINE_OPTIONS = {`,
      `+    "pool_pre_ping": True,`,
      `+    "pool_recycle": 1800,`,
      `+}`,
    ].join('\n');

    return {
      id: `patch-spof-py-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Multi-Host Failover URI for ${nodeName}`,
      description:
        `Configures multi-host target_session_attrs=read-write with pre-ping validation.`,
      resilience_pattern: 'graceful_degradation',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  /** High-availability failover for Go. */
  private buildFailoverPatchGo(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 2c3d4e5..5f6a7b8 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -8,1 +8,6 @@ func Connect() (*sql.DB, error) {`,
      `-    return sql.Open("pgx", "host=primary-db user=app dbname=main")`,
      `+    // Bob Resilience Patch: Multi-host failover DSN`,
      `+    dsn := "host=primary-db,standby-db user=app dbname=main target_session_attrs=read-write"`,
      `+    db, err := sql.Open("pgx", dsn)`,
      `+    if err != nil { return nil, err }`,
      `+    db.SetConnMaxLifetime(10 * time.Minute)`,
      `+    return db, nil`,
    ].join('\n');

    return {
      id: `patch-spof-go-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Multi-Host Failover DSN for ${nodeName}`,
      description:
        `Configures automatic multi-host failover in pgx connection DSN.`,
      resilience_pattern: 'graceful_degradation',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  // =========================================================================
  // Java / Kotlin Resilience Templates (Spring Boot & Resilience4j)
  // =========================================================================

  /** Circuit breaker for Java via Resilience4j. */
  private buildCircuitBreakerPatchJava(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 11a22b3..44c55d6 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -15,1 +15,11 @@ public Response callDependency(Request request) {`,
      `-    return executeRemoteCall(request);`,
      `+    // Bob Resilience Patch: Resilience4j CircuitBreaker via io.github.resilience4j:resilience4j-circuitbreaker`,
      `+    CircuitBreakerConfig config = CircuitBreakerConfig.custom()`,
      `+        .failureRateThreshold(50.0f)`,
      `+        .waitDurationInOpenState(Duration.ofSeconds(10))`,
      `+        .slidingWindowSize(20)`,
      `+        .build();`,
      `+    CircuitBreaker cb = CircuitBreaker.of("${nodeName}", config);`,
      `+    return cb.executeSupplier(() -> executeRemoteCall(request));`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-cb-java-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Circuit Breaker (Resilience4j) to ${nodeName}`,
      description:
        `Wraps remote call in a Resilience4j circuit breaker with 50% failure rate threshold and 10s cooldown.`,
      resilience_pattern: 'circuit_breaker',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  /** Exponential backoff with jitter for Java. */
  private buildExponentialBackoffPatchJava(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 22b33c4..55d66e7 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -10,1 +10,10 @@ public Response executeWithRetry() {`,
      `-    for (int i = 0; i < 5; i++) { try { return doWork(); } catch (Exception e) {} }`,
      `+    // Bob Resilience Patch: Resilience4j Retry with Exponential Backoff & Jitter`,
      `+    IntervalFunction intervalFn = IntervalFunction.ofExponentialRandomBackoff(100, 2.0, 0.5);`,
      `+    RetryConfig retryConfig = RetryConfig.custom()`,
      `+        .maxAttempts(3)`,
      `+        .intervalFunction(intervalFn)`,
      `+        .build();`,
      `+    Retry retry = Retry.of("${nodeName}", retryConfig);`,
      `+    return retry.executeSupplier(() -> doWork());`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-retry-java-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Exponential Backoff with Jitter (Resilience4j) to ${nodeName}`,
      description:
        `Replaces naive retry loop with Resilience4j exponential random backoff.`,
      resilience_pattern: 'exponential_backoff_jitter',
      diff,
      estimated_blast_radius_reduction_pct: 60,
    };
  }

  /** Connection pool bulkhead for Java (HikariCP). */
  private buildBulkheadPatchJava(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 33c44d5..66e77f8 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -8,1 +8,9 @@ public DataSource dataSource() {`,
      `-    HikariConfig config = new HikariConfig();`,
      `+    // Bob Resilience Patch: Bounded HikariCP connection pool`,
      `+    HikariConfig config = new HikariConfig();`,
      `+    config.setMaximumPoolSize(25);`,
      `+    config.setMinimumIdle(5);`,
      `+    config.setConnectionTimeout(3000);`,
      `+    config.setIdleTimeout(30000);`,
      `+    config.setMaxLifetime(600000);`,
      `     return new HikariDataSource(config);`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-pool-java-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Bound HikariCP Connection Pool for ${nodeName}`,
      description:
        `Configures max pool size of 25 connections and strict 3s connection timeout.`,
      resilience_pattern: 'bulkhead_isolation',
      diff,
      estimated_blast_radius_reduction_pct: 55,
    };
  }

  /** Stale fallback cache for Java (Caffeine). */
  private buildFallbackCachePatchJava(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 44d55e6..77f88a9 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -12,1 +12,12 @@ public String getData(String key) {`,
      `-    return remoteClient.get(key);`,
      `+    // Bob Resilience Patch: Caffeine stale-while-revalidate fallback cache`,
      `+    try {`,
      `+        String liveData = remoteClient.get(key);`,
      `+        staleCache.put(key, liveData);`,
      `+        return liveData;`,
      `+    } catch (Exception ex) {`,
      `+        String cached = staleCache.getIfPresent(key);`,
      `+        if (cached != null) return cached;`,
      `+        throw ex;`,
      `+    }`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-fb-java-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Stale Fallback Cache to ${nodeName}`,
      description:
        `Captures live data in Caffeine in-memory cache and returns stale cached entries during outages.`,
      resilience_pattern: 'fallback_cache',
      diff,
      estimated_blast_radius_reduction_pct: 80,
    };
  }

  /** Spring Boot Actuator Health Indicator. */
  private buildHealthCheckPatchJava(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 55e66f7..88a99b0 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,4 +1,14 @@ package com.app.health;`,
      `+// Bob Resilience Patch: Spring Boot Actuator HealthIndicator`,
      `+import org.springframework.boot.actuate.health.Health;`,
      `+import org.springframework.boot.actuate.health.HealthIndicator;`,
      `+import org.springframework.stereotype.Component;`,
      `+`,
      `+@Component`,
      `+public class ${nodeName.replace(/[^a-zA-Z0-9]/g, '')}HealthIndicator implements HealthIndicator {`,
      `+    @Override`,
      `+    public Health health() {`,
      `+        return isServiceHealthy() ? Health.up().build() : Health.down().withDetail("reason", "Dependency failure").build();`,
      `+    }`,
      `+}`,
    ].join('\n');

    return {
      id: `patch-hc-java-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Spring Boot HealthIndicator for ${nodeName}`,
      description:
        `Implements Actuator HealthIndicator to expose automated liveness probe for Kubernetes/OpenShift.`,
      resilience_pattern: 'health_check_endpoint',
      diff,
      estimated_blast_radius_reduction_pct: 65,
    };
  }

  /** Async CompletableFuture timeout budget for Java. */
  private buildAsyncQueuePatchJava(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 66f77a8..99b00c1 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -10,1 +10,8 @@ public Data processData(Payload payload) {`,
      `-    return executeBlocking(payload);`,
      `+    // Bob Resilience Patch: Non-blocking CompletableFuture with timeout budget`,
      `+    return CompletableFuture.supplyAsync(() -> executeBlocking(payload))`,
      `+        .orTimeout(2500, TimeUnit.MILLISECONDS)`,
      `+        .exceptionally(ex -> getFallbackData(payload))`,
      `+        .join();`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-async-java-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Wrap Blocking Call in CompletableFuture with Timeout for ${nodeName}`,
      description:
        `Executes blocking task in common ForkJoinPool with a strict 2.5s timeout budget.`,
      resilience_pattern: 'timeout_budgeting',
      diff,
      estimated_blast_radius_reduction_pct: 70,
    };
  }

  /** Multi-host failover JDBC for Java. */
  private buildFailoverPatchJava(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 77a88b9..00c11d2 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,4 @@ spring:`,
      `-    url: jdbc:postgresql://primary-db:5432/main`,
      `+    # Bob Resilience Patch: Multi-host standby failover JDBC URI`,
      `+    url: jdbc:postgresql://primary-db:5432,standby-db:5432/main?targetServerType=primary&connectTimeout=5`,
    ].join('\n');

    return {
      id: `patch-spof-java-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Configure Multi-Host JDBC Failover for ${nodeName}`,
      description:
        `Adds multi-host failover with targetServerType=primary for automatic standby routing.`,
      resilience_pattern: 'graceful_degradation',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  // =========================================================================
  // C# / .NET Resilience Templates (Polly & ASP.NET Core)
  // =========================================================================

  /** Circuit breaker for C# via Polly. */
  private buildCircuitBreakerPatchCSharp(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 88b99c0..11c22d3 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -12,1 +12,11 @@ public async Task<HttpResponseMessage> CallService(HttpRequestMessage request) {`,
      `-    return await _httpClient.SendAsync(request);`,
      `+    // Bob Resilience Patch: Circuit Breaker via Polly`,
      `+    var circuitBreakerPolicy = Policy`,
      `+        .Handle<HttpRequestException>()`,
      `+        .OrResult<HttpResponseMessage>(r => (int)r.StatusCode >= 500)`,
      `+        .CircuitBreakerAsync(handledEventsAllowedBeforeBreaking: 5, durationOfBreak: TimeSpan.FromSeconds(10));`,
      `+    return await circuitBreakerPolicy.ExecuteAsync(() => _httpClient.SendAsync(request));`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-cb-cs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Circuit Breaker (Polly) to ${nodeName}`,
      description:
        `Wraps outbound HTTP requests in a Polly circuit breaker (breaks after 5 consecutive 5xx failures for 10s).`,
      resilience_pattern: 'circuit_breaker',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  /** Exponential backoff with jitter for C# via Polly. */
  private buildExponentialBackoffPatchCSharp(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 99c00d1..22d33e4 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -8,1 +8,9 @@ public async Task<Result> ExecuteWork() {`,
      `-    for (int i = 0; i < 5; i++) { try { return await DoWork(); } catch {} }`,
      `+    // Bob Resilience Patch: Exponential backoff with full jitter via Polly`,
      `+    var delay = Backoff.DecorrelatedJitterBackoffV2(medianFirstRetryDelay: TimeSpan.FromMilliseconds(100), retryCount: 3);`,
      `+    var retryPolicy = Policy.Handle<Exception>()`,
      `+        .WaitAndRetryAsync(delay);`,
      `+    return await retryPolicy.ExecuteAsync(() => DoWork());`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-retry-cs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Exponential Backoff with Jitter (Polly) to ${nodeName}`,
      description:
        `Applies decorrelated jitter backoff across 3 attempts using Polly.`,
      resilience_pattern: 'exponential_backoff_jitter',
      diff,
      estimated_blast_radius_reduction_pct: 60,
    };
  }

  /** Connection pool bulkhead for C#. */
  private buildBulkheadPatchCSharp(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 00d11e2..33e44f5 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,8 @@ services.AddHttpClient("${nodeName}", client => {`,
      `-    client.Timeout = TimeSpan.FromSeconds(100);`,
      `+    // Bob Resilience Patch: Bounded SocketsHttpHandler pool & connection lifetime`,
      `+    client.Timeout = TimeSpan.FromSeconds(3);`,
      `+}).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler {`,
      `+    MaxConnectionsPerServer = 25,`,
      `+    PooledConnectionLifetime = TimeSpan.FromMinutes(5),`,
      `+    PooledConnectionIdleTimeout = TimeSpan.FromSeconds(30)`,
      ` });`,
    ].join('\n');

    return {
      id: `patch-pool-cs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Bound SocketsHttpHandler Pool for ${nodeName}`,
      description:
        `Limits outbound connections to 25 per server with 5min lifetime and 3s timeout.`,
      resilience_pattern: 'bulkhead_isolation',
      diff,
      estimated_blast_radius_reduction_pct: 50,
    };
  }

  /** Fallback cache for C#. */
  private buildFallbackCachePatchCSharp(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 11e22f3..44f55a6 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -15,1 +15,11 @@ public async Task<string> GetData(string key) {`,
      `-    return await _client.GetStringAsync(key);`,
      `+    // Bob Resilience Patch: MemoryCache stale-while-revalidate fallback`,
      `+    try {`,
      `+        var fresh = await _client.GetStringAsync(key);`,
      `+        _cache.Set(key, fresh, TimeSpan.FromMinutes(30));`,
      `+        return fresh;`,
      `+    } catch when (_cache.TryGetValue(key, out string stale)) {`,
      `+        return stale;`,
      `+    }`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-fb-cs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Stale Fallback Cache to ${nodeName}`,
      description:
        `Caches successful responses in IMemoryCache and serves stale cache when downstream fails.`,
      resilience_pattern: 'fallback_cache',
      diff,
      estimated_blast_radius_reduction_pct: 80,
    };
  }

  /** Health check endpoint for C# (ASP.NET Core). */
  private buildHealthCheckPatchCSharp(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 22f33a4..55a66b7 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,4 +1,8 @@ var app = builder.Build();`,
      `+// Bob Resilience Patch: ASP.NET Core Health Checks`,
      `+app.MapHealthChecks("/healthz", new HealthCheckOptions {`,
      `+    Predicate = _ => true,`,
      `+    ResultStatusCodes = { [HealthStatus.Healthy] = StatusCodes.Status200OK, [HealthStatus.Unhealthy] = StatusCodes.Status503ServiceUnavailable }`,
      `+});`,
    ].join('\n');

    return {
      id: `patch-hc-cs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Map /healthz Health Endpoint for ${nodeName}`,
      description:
        `Exposes standard ASP.NET Core /healthz route for Kubernetes container readiness probes.`,
      resilience_pattern: 'health_check_endpoint',
      diff,
      estimated_blast_radius_reduction_pct: 65,
    };
  }

  /** Async task delegation with timeout for C#. */
  private buildAsyncQueuePatchCSharp(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 33a44b5..66b77c8 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -10,1 +10,8 @@ public async Task<Data> HandleBlockingCall(Payload payload) {`,
      `-    return ExecuteSyncBlocking(payload);`,
      `+    // Bob Resilience Patch: CancellationTokenSource timeout budget`,
      `+    using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(2500));`,
      `+    try {`,
      `+        return await Task.Run(() => ExecuteSyncBlocking(payload), cts.Token);`,
      `+    } catch (OperationCanceledException) {`,
      `+        return GetFallbackData(payload);`,
      `+    }`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-async-cs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Wrap Blocking Call in Task.Run with Timeout for ${nodeName}`,
      description:
        `Delegates blocking call to ThreadPool with strict 2.5s CancellationToken timeout.`,
      resilience_pattern: 'timeout_budgeting',
      diff,
      estimated_blast_radius_reduction_pct: 70,
    };
  }

  /** Multi-host failover for C#. */
  private buildFailoverPatchCSharp(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 44b55c6..77c88d9 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -4,1 +4,4 @@ "ConnectionStrings": {`,
      `-    "Database": "Server=primary-db;Database=main;"`,
      `+    // Bob Resilience Patch: Multi-host standby failover connection string`,
      `+    "Database": "Server=primary-db,standby-db;Database=main;Target Server Type=Primary;Timeout=5;"`,
    ].join('\n');

    return {
      id: `patch-spof-cs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Configure Multi-Host Failover for ${nodeName}`,
      description:
        `Enables automated multi-host target server failover in database connection string.`,
      resilience_pattern: 'graceful_degradation',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  // =========================================================================
  // Rust Resilience Templates (Tokio & Tower)
  // =========================================================================

  /** Circuit breaker for Rust. */
  private buildCircuitBreakerPatchRust(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 55c66d7..88d99e0 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -15,1 +15,9 @@ pub async fn call_dependency(req: Request) -> Result<Response, Error> {`,
      `-    execute_remote_call(req).await`,
      `+    // Bob Resilience Patch: Circuit breaker via recloser`,
      `+    lazy_static! {`,
      `+        static ref BREAKER: recloser::Recloser = recloser::Recloser::custom()`,
      `+            .error_rate(0.50).closed_len(20).half_open_len(5).open_wait(Duration::from_secs(10)).build();`,
      `+    }`,
      `+    BREAKER.call(execute_remote_call(req)).await`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-cb-rs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Circuit Breaker (Recloser) to ${nodeName}`,
      description:
        `Protects outbound calls with a 50% error rate threshold and 10s cooldown.`,
      resilience_pattern: 'circuit_breaker',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  /** Exponential backoff with jitter for Rust. */
  private buildExponentialBackoffPatchRust(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 66d77e8..99e00f1 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -10,1 +10,7 @@ pub async fn retry_operation() -> Result<Data, Error> {`,
      `-    for _ in 0..5 { if let Ok(res) = do_work().await { return Ok(res); } }`,
      `+    // Bob Resilience Patch: Exponential backoff with randomized jitter via backoff crate`,
      `+    let backoff = backoff::ExponentialBackoff {`,
      `+        max_elapsed_time: Some(Duration::from_secs(5)),`,
      `+        ..Default::default()`,
      `+    };`,
      `+    backoff::future::retry(backoff, || async { do_work().await.map_err(backoff::Error::transient) }).await`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-retry-rs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Exponential Backoff with Jitter to ${nodeName}`,
      description:
        `Replaces naive retry loop with backoff::ExponentialBackoff.`,
      resilience_pattern: 'exponential_backoff_jitter',
      diff,
      estimated_blast_radius_reduction_pct: 60,
    };
  }

  /** Connection pool bulkhead for Rust (r2d2 / sqlx). */
  private buildBulkheadPatchRust(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 77e88f9..00f11a2 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,6 @@ pub async fn create_pool(dsn: &str) -> Result<Pool, Error> {`,
      `-    PgPoolOptions::new().connect(dsn).await`,
      `+    // Bob Resilience Patch: Bounded connection pool limits & acquire timeout`,
      `+    PgPoolOptions::new()`,
      `+        .max_connections(25)`,
      `+        .acquire_timeout(Duration::from_secs(3))`,
      `+        .idle_timeout(Duration::from_secs(30))`,
      `+        .connect(dsn).await`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-pool-rs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Bound PgPool Connections for ${nodeName}`,
      description:
        `Limits pool to 25 connections with strict 3s acquire timeout.`,
      resilience_pattern: 'bulkhead_isolation',
      diff,
      estimated_blast_radius_reduction_pct: 50,
    };
  }

  /** Fallback cache for Rust. */
  private buildFallbackCachePatchRust(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 88f99a0..11a22b3 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -12,1 +12,11 @@ pub async fn get_data(key: &str) -> Result<String, Error> {`,
      `-    client.get_remote(key).await`,
      `+    // Bob Resilience Patch: Moka in-memory stale fallback cache`,
      `+    match client.get_remote(key).await {`,
      `+        Ok(val) => {`,
      `+            CACHE.insert(key.to_string(), val.clone()).await;`,
      `+            Ok(val)`,
      `+        }`,
      `+        Err(e) => CACHE.get(key).await.ok_or(e),`,
      `+    }`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-fb-rs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Stale Fallback Cache to ${nodeName}`,
      description:
        `Caches remote responses in memory and serves stale entry during downstream downtime.`,
      resilience_pattern: 'fallback_cache',
      diff,
      estimated_blast_radius_reduction_pct: 80,
    };
  }

  /** Health check endpoint for Rust (Axum/Actix). */
  private buildHealthCheckPatchRust(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 99a00b1..22b33c4 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,4 +1,7 @@`,
      `+// Bob Resilience Patch: Health check endpoint`,
      `+async fn healthz() -> impl axum::response::IntoResponse {`,
      `+    if check_health().await { (StatusCode::OK, "UP") } else { (StatusCode::SERVICE_UNAVAILABLE, "DOWN") }`,
      `+}`,
    ].join('\n');

    return {
      id: `patch-hc-rs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add /healthz Route for ${nodeName}`,
      description:
        `Exposes health check route returning 503 on dependency failure.`,
      resilience_pattern: 'health_check_endpoint',
      diff,
      estimated_blast_radius_reduction_pct: 65,
    };
  }

  /** Async task delegation with timeout for Rust. */
  private buildAsyncQueuePatchRust(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 00b11c2..33c44d5 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -8,1 +8,7 @@ pub async fn process_job(data: Payload) -> Result<Data, Error> {`,
      `-    blocking_operation(data)`,
      `+    // Bob Resilience Patch: tokio::time::timeout budget`,
      `+    match tokio::time::timeout(Duration::from_millis(2500), tokio::task::spawn_blocking(move || blocking_operation(data))).await {`,
      `+        Ok(res) => res.map_err(|e| Error::TaskJoin(e))?,`,
      `+        Err(_) => Ok(get_fallback_data()),`,
      `+    }`,
      ` }`,
    ].join('\n');

    return {
      id: `patch-async-rs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Wrap Blocking Operation in tokio::time::timeout for ${nodeName}`,
      description:
        `Delegates blocking operation to spawn_blocking with strict 2.5s timeout budget.`,
      resilience_pattern: 'timeout_budgeting',
      diff,
      estimated_blast_radius_reduction_pct: 70,
    };
  }

  /** Multi-host failover for Rust. */
  private buildFailoverPatchRust(
    rc: RootCause,
    targetFile: string,
    nodeName: string,
  ): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index 11c22d3..44d55e6 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,4 @@ pub fn get_db_url() -> &'static str {`,
      `-    "postgres://user:pass@primary-db:5432/main"`,
      `+    // Bob Resilience Patch: Multi-host target_session_attrs connection string`,
      `+    "postgres://user:pass@primary-db:5432,standby-db:5432/main?target_session_attrs=read-write&connect_timeout=5"`,
    ].join('\n');

    return {
      id: `patch-spof-rs-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Configure Multi-Host Failover for ${nodeName}`,
      description:
        `Adds multi-host connection string with automatic primary failover.`,
      resilience_pattern: 'graceful_degradation',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  // =========================================================================
  // PHP / Laravel Resilience Templates (Ganesha & Guzzle)
  // =========================================================================

  private buildCircuitBreakerPatchPHP(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index a1b2c3d..e4f5a6b 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -15,1 +15,10 @@ public function callRemoteService(Request $request) {`,
      `-    return $this->client->send($request);`,
      `+    // Bob Resilience Patch: Circuit Breaker via ackintosh/ganesha`,
      `+    $ganesha = GaneshaBuilder::withRateStrategy()->timeWindow(30)->failureRateThreshold(50)->build();`,
      `+    if (!$ganesha->isAvailable("${nodeName}")) { return $this->getFallbackResponse($request); }`,
      `+    try {`,
      `+        $res = $this->client->send($request);`,
      `+        $ganesha->success("${nodeName}");`,
      `+        return $res;`,
      `+    } catch (\\Throwable $e) { $ganesha->failure("${nodeName}"); return $this->getFallbackResponse($request); }`,
      ` }`,
    ].join('\n');
    return {
      id: `patch-cb-php-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Circuit Breaker (Ganesha) to ${nodeName}`,
      description: `Protects remote HTTP call with ackintosh/ganesha circuit breaker.`,
      resilience_pattern: 'circuit_breaker',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  private buildExponentialBackoffPatchPHP(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index b2c3d4e..f5a6b7c 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -10,1 +10,8 @@ public function retryOperation() {`,
      `-    for ($i = 0; $i < 5; $i++) { try { return $this->doWork(); } catch (\\Exception $e) {} }`,
      `+    // Bob Resilience Patch: Exponential backoff with randomized jitter`,
      `+    for ($i = 0; $i < 3; $i++) {`,
      `+        try { return $this->doWork(); }`,
      `+        catch (\\Exception $e) {`,
      `+            if ($i === 2) throw $e;`,
      `+            usleep((int)((2 ** $i * 100000) + random_int(0, 50000)));`,
      `+        }`,
      `+    }`,
      ` }`,
    ].join('\n');
    return {
      id: `patch-retry-php-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Exponential Backoff with Jitter for ${nodeName}`,
      description: `Applies 3-attempt exponential backoff with full jitter to retry loop.`,
      resilience_pattern: 'exponential_backoff_jitter',
      diff,
      estimated_blast_radius_reduction_pct: 60,
    };
  }

  private buildBulkheadPatchPHP(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index c3d4e5f..a6b7c8d 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,4 @@ $pdo = new PDO($dsn, $user, $pass);`,
      `+// Bob Resilience Patch: Bounded PDO timeout & error mode`,
      `+$pdo->setAttribute(\\PDO::ATTR_TIMEOUT, 3);`,
      `+$pdo->setAttribute(\\PDO::ATTR_ERRMODE, \\PDO::ERRMODE_EXCEPTION);`,
    ].join('\n');
    return {
      id: `patch-pool-php-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Bound PDO Timeout for ${nodeName}`,
      description: `Enforces strict 3-second PDO connection timeout.`,
      resilience_pattern: 'bulkhead_isolation',
      diff,
      estimated_blast_radius_reduction_pct: 50,
    };
  }

  private buildFallbackCachePatchPHP(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index d4e5f6a..b7c8d9e 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -12,1 +12,8 @@ public function getData(string $key) {`,
      `-    return $this->remoteApi->fetch($key);`,
      `+    // Bob Resilience Patch: Stale fallback cache`,
      `+    try {`,
      `+        $fresh = $this->remoteApi->fetch($key);`,
      `+        Cache::put("stale:{$key}", $fresh, 3600);`,
      `+        return $fresh;`,
      `+    } catch (\\Throwable $e) { return Cache::get("stale:{$key}") ?? throw $e; }`,
      ` }`,
    ].join('\n');
    return {
      id: `patch-fb-php-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Stale Fallback Cache to ${nodeName}`,
      description: `Caches successful responses in Cache and serves stale entry on error.`,
      resilience_pattern: 'fallback_cache',
      diff,
      estimated_blast_radius_reduction_pct: 80,
    };
  }

  private buildHealthCheckPatchPHP(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index e5f6a7b..c8d9e0f 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,3 +1,6 @@`,
      `+// Bob Resilience Patch: Laravel Health Check Route`,
      `+Route::get('/healthz', function () {`,
      `+    return DB::connection()->getPdo() ? response()->json(['status' => 'UP']) : response()->json(['status' => 'DOWN'], 503);`,
      `+});`,
    ].join('\n');
    return {
      id: `patch-hc-php-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add /healthz Route for ${nodeName}`,
      description: `Registers health check route reporting database and dependency status.`,
      resilience_pattern: 'health_check_endpoint',
      diff,
      estimated_blast_radius_reduction_pct: 65,
    };
  }

  private buildAsyncQueuePatchPHP(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index f6a7b8c..d9e0f1a 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -8,1 +8,4 @@ public function processRequest(Payload $data) {`,
      `-    return $this->executeSyncBlocking($data);`,
      `+    // Bob Resilience Patch: Non-blocking queue job delegation`,
      `+    ProcessPayloadJob::dispatch($data)->onQueue('resilience')->delay(now()->addMilliseconds(200));`,
      ` }`,
    ].join('\n');
    return {
      id: `patch-async-php-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Delegate Blocking Call to Async Queue in ${nodeName}`,
      description: `Dispatches blocking task to async queue worker.`,
      resilience_pattern: 'timeout_budgeting',
      diff,
      estimated_blast_radius_reduction_pct: 70,
    };
  }

  private buildFailoverPatchPHP(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index a7b8c9d..e0f1a2b 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,4 @@ 'mysql' => [`,
      `-    'host' => 'primary-db',`,
      `+    // Bob Resilience Patch: Read/write multi-host split and failover`,
      `+    'read' => ['host' => ['replica-1.db', 'replica-2.db']],`,
      `+    'write' => ['host' => ['primary-db', 'standby-db']],`,
    ].join('\n');
    return {
      id: `patch-spof-php-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Configure Read/Write Multi-Host Failover for ${nodeName}`,
      description: `Splits read/write hosts with standby failover.`,
      resilience_pattern: 'graceful_degradation',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  // =========================================================================
  // Ruby / Rails Resilience Templates (Shopify Semian & ActiveRecord)
  // =========================================================================

  private buildCircuitBreakerPatchRuby(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index b8c9d0e..f1a2b3c 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,6 @@ client = Net::HTTP.new(uri.host, uri.port)`,
      `+# Bob Resilience Patch: Shopify Semian Circuit Breaker`,
      `+Semian::NetHTTP.semian_configuration = proc do |host, port|`,
      `+  { name: "${nodeName}", tickets: 20, timeout: 3.0, error_threshold: 5, error_timeout: 10 }`,
      `+end`,
    ].join('\n');
    return {
      id: `patch-cb-rb-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Circuit Breaker (Semian) to ${nodeName}`,
      description: `Applies Shopify Semian circuit breaker to outbound HTTP calls.`,
      resilience_pattern: 'circuit_breaker',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  private buildExponentialBackoffPatchRuby(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index c9d0e1f..a2b3c4d 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -8,1 +8,9 @@ def execute_work`,
      `-  5.times { do_work rescue nil }`,
      `+  # Bob Resilience Patch: Exponential backoff with random jitter`,
      `+  retries = 3`,
      `+  begin`,
      `+    do_work`,
      `+  rescue StandardError => e`,
      `+    retry_count ||= 0`,
      `+    (retry_count += 1) < retries ? (sleep(rand(0.1..0.3) * (2 ** retry_count)); retry) : raise(e)`,
      `+  end`,
      ` end`,
    ].join('\n');
    return {
      id: `patch-retry-rb-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Exponential Backoff with Jitter for ${nodeName}`,
      description: `Adds random jitter backoff loop with 3 retry ceiling.`,
      resilience_pattern: 'exponential_backoff_jitter',
      diff,
      estimated_blast_radius_reduction_pct: 60,
    };
  }

  private buildBulkheadPatchRuby(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index d0e1f2a..b3c4d5e 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -4,1 +4,5 @@ default: &default`,
      `-  pool: 100`,
      `+  # Bob Resilience Patch: Bounded connection pool & checkout timeout`,
      `+  pool: 25`,
      `+  checkout_timeout: 3.0`,
      `+  reaping_frequency: 10`,
    ].join('\n');
    return {
      id: `patch-pool-rb-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Bound ActiveRecord Pool for ${nodeName}`,
      description: `Limits ActiveRecord pool to 25 connections with 3s checkout timeout.`,
      resilience_pattern: 'bulkhead_isolation',
      diff,
      estimated_blast_radius_reduction_pct: 50,
    };
  }

  private buildFallbackCachePatchRuby(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index e1f2a3b..c4d5e6f 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -10,1 +10,8 @@ def get_data(key)`,
      `-  remote_client.fetch(key)`,
      `+  # Bob Resilience Patch: Stale fallback cache`,
      `+  begin`,
      `+    fresh = remote_client.fetch(key)`,
      `+    Rails.cache.write("stale:#{key}", fresh, expires_in: 1.hour)`,
      `+    fresh`,
      `+  rescue StandardError`,
      `+    Rails.cache.read("stale:#{key}") || raise`,
      `+  end`,
      ` end`,
    ].join('\n');
    return {
      id: `patch-fb-rb-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Stale Fallback Cache for ${nodeName}`,
      description: `Caches responses in Rails.cache and serves stale data on failure.`,
      resilience_pattern: 'fallback_cache',
      diff,
      estimated_blast_radius_reduction_pct: 80,
    };
  }

  private buildHealthCheckPatchRuby(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index f2a3b4c..d5e6f7a 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,3 +1,5 @@ Rails.application.routes.draw do`,
      `+  # Bob Resilience Patch: Rails 7.1+ Health Check Probe`,
      `+  get "healthz" => "rails/health#show", as: :rails_health_check`,
    ].join('\n');
    return {
      id: `patch-hc-rb-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add /healthz Route for ${nodeName}`,
      description: `Exposes Rails health check probe endpoint.`,
      resilience_pattern: 'health_check_endpoint',
      diff,
      estimated_blast_radius_reduction_pct: 65,
    };
  }

  private buildAsyncQueuePatchRuby(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index a3b4c5d..e6f7a8b 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,4 @@ def handle_request(payload)`,
      `-  blocking_call(payload)`,
      `+  # Bob Resilience Patch: Timeout budget with fallback`,
      `+  Timeout.timeout(2.5) { blocking_call(payload) } rescue get_fallback_data(payload)`,
      ` end`,
    ].join('\n');
    return {
      id: `patch-async-rb-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Wrap Blocking Call in Timeout Budget for ${nodeName}`,
      description: `Protects blocking execution with 2.5s timeout.`,
      resilience_pattern: 'timeout_budgeting',
      diff,
      estimated_blast_radius_reduction_pct: 70,
    };
  }

  private buildFailoverPatchRuby(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index b4c5d6e..f7a8b9c 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,5 @@ production:`,
      `-  host: primary-db`,
      `+  # Bob Resilience Patch: Multi-host replica failover`,
      `+  primary:`,
      `+    hosts: ["primary-db", "standby-db"]`,
    ].join('\n');
    return {
      id: `patch-spof-rb-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Configure Multi-Host Replica Failover for ${nodeName}`,
      description: `Configures primary and standby replica hosts in database.yml.`,
      resilience_pattern: 'graceful_degradation',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  // =========================================================================
  // C / C++ Resilience Templates (libcurl & POSIX)
  // =========================================================================

  private buildCircuitBreakerPatchCpp(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index c5d6e7f..a8b9c0d 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -12,1 +12,7 @@ int call_service(const char* url) {`,
      `-    return execute_http_call(url);`,
      `+    // Bob Resilience Patch: Circuit breaker guard`,
      `+    static std::atomic<int> consecutive_failures{0};`,
      `+    if (consecutive_failures.load() >= 5) { return -1; /* circuit open */ }`,
      `+    int res = execute_http_call(url);`,
      `+    if (res != 0) { consecutive_failures.fetch_add(1); } else { consecutive_failures.store(0); }`,
      `+    return res;`,
      ` }`,
    ].join('\n');
    return {
      id: `patch-cb-cpp-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Circuit Breaker to ${nodeName}`,
      description: `Adds consecutive failure counter circuit breaker.`,
      resilience_pattern: 'circuit_breaker',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  private buildExponentialBackoffPatchCpp(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index d6e7f8a..b9c0d1e 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -8,1 +8,7 @@ int execute_work() {`,
      `-    for (int i = 0; i < 5; ++i) { if (do_work() == 0) return 0; }`,
      `+    // Bob Resilience Patch: Exponential backoff with random jitter`,
      `+    for (int attempt = 0; attempt < 3; ++attempt) {`,
      `+        if (do_work() == 0) return 0;`,
      `+        usleep((100000 << attempt) + (rand() % 50000));`,
      `+    }`,
      `+    return -1;`,
      ` }`,
    ].join('\n');
    return {
      id: `patch-retry-cpp-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Exponential Backoff with Jitter for ${nodeName}`,
      description: `Implements backoff with usleep and jitter.`,
      resilience_pattern: 'exponential_backoff_jitter',
      diff,
      estimated_blast_radius_reduction_pct: 60,
    };
  }

  private buildBulkheadPatchCpp(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index e7f8a9b..c0d1e2f 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,4 @@ curl_easy_setopt(curl, CURLOPT_URL, url);`,
      `+// Bob Resilience Patch: Strict libcurl timeout bounds`,
      `+curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, 3000L);`,
      `+curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT_MS, 1000L);`,
    ].join('\n');
    return {
      id: `patch-pool-cpp-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Bound libcurl Timeouts for ${nodeName}`,
      description: `Sets 3s request timeout and 1s connect timeout.`,
      resilience_pattern: 'bulkhead_isolation',
      diff,
      estimated_blast_radius_reduction_pct: 50,
    };
  }

  private buildFallbackCachePatchCpp(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index f8a9b0c..d1e2f3a 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -10,1 +10,6 @@ std::string get_data(const std::string& key) {`,
      `-    return fetch_remote(key);`,
      `+    // Bob Resilience Patch: In-memory fallback cache`,
      `+    static std::unordered_map<std::string, std::string> cache;`,
      `+    try { auto res = fetch_remote(key); cache[key] = res; return res; }`,
      `+    catch (...) { if (cache.count(key)) return cache[key]; throw; }`,
      ` }`,
    ].join('\n');
    return {
      id: `patch-fb-cpp-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Stale Fallback Cache to ${nodeName}`,
      description: `Returns in-memory cache entry on remote exception.`,
      resilience_pattern: 'fallback_cache',
      diff,
      estimated_blast_radius_reduction_pct: 80,
    };
  }

  private buildHealthCheckPatchCpp(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index a9b0c1d..e2f3a4b 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,3 +1,5 @@`,
      `+// Bob Resilience Patch: Health check endpoint`,
      `+void handle_healthz(struct mg_connection *c) { mg_http_reply(c, 200, "", "{\\"status\\":\\"UP\\"}"); }`,
    ].join('\n');
    return {
      id: `patch-hc-cpp-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Health Probe Handler for ${nodeName}`,
      description: `Registers HTTP health check callback.`,
      resilience_pattern: 'health_check_endpoint',
      diff,
      estimated_blast_radius_reduction_pct: 65,
    };
  }

  private buildAsyncQueuePatchCpp(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index b0c1d2e..f3a4b5c 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -8,1 +8,6 @@ void handle_job(const Payload& p) {`,
      `-    execute_blocking(p);`,
      `+    // Bob Resilience Patch: std::async with timeout budget`,
      `+    auto fut = std::async(std::launch::async, execute_blocking, p);`,
      `+    if (fut.wait_for(std::chrono::milliseconds(2500)) == std::future_status::timeout) {`,
      `+        log_timeout_fallback();`,
      `+    }`,
      ` }`,
    ].join('\n');
    return {
      id: `patch-async-cpp-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Wrap Blocking Call in std::async Timeout for ${nodeName}`,
      description: `Executes blocking function with 2.5s future wait.`,
      resilience_pattern: 'timeout_budgeting',
      diff,
      estimated_blast_radius_reduction_pct: 70,
    };
  }

  private buildFailoverPatchCpp(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index c1d2e3f..a4b5c6d 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -3,1 +3,4 @@`,
      `-const char* DB_HOST = "primary-db";`,
      `+// Bob Resilience Patch: Multi-host failover configuration`,
      `+const char* DB_HOSTS[] = {"primary-db", "standby-db", nullptr};`,
    ].join('\n');
    return {
      id: `patch-spof-cpp-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Configure Standby Host Array for ${nodeName}`,
      description: `Adds multi-host connection list with automatic secondary fallback.`,
      resilience_pattern: 'graceful_degradation',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  // =========================================================================
  // Elixir / Phoenix Resilience Templates (:fuse & OTP)
  // =========================================================================

  private buildCircuitBreakerPatchElixir(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index d2e3f4a..b5c6d7e 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -10,1 +10,8 @@ def call_remote_service do`,
      `-  RemoteClient.fetch()`,
      `+  # Bob Resilience Patch: Circuit breaker via :fuse`,
      `+  case :fuse.ask(:${nodeName}_fuse, :sync) do`,
      `+    :ok ->`,
      `+      res = RemoteClient.fetch()`,
      `+      :fuse.melt(:${nodeName}_fuse)`,
      `+      res`,
      `+    :blown -> get_fallback_data()`,
      `+  end`,
      ` end`,
    ].join('\n');
    return {
      id: `patch-cb-ex-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Circuit Breaker (:fuse) to ${nodeName}`,
      description: `Protects remote call with Erlang :fuse circuit breaker.`,
      resilience_pattern: 'circuit_breaker',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  private buildExponentialBackoffPatchElixir(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index e3f4a5b..c6d7e8f 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -8,1 +8,9 @@ def retry_work do`,
      `-  1..5 |> Enum.each(fn _ -> do_work() end)`,
      `+  # Bob Resilience Patch: Exponential backoff with jitter`,
      `+  Enum.reduce_while(1..3, :error, fn attempt, _acc ->`,
      `+    case do_work() do`,
      `+      {:ok, val} -> {:halt, {:ok, val}}`,
      `+      {:error, _} when attempt < 3 ->`,
      `+        :timer.sleep(:rand.uniform(trunc(:math.pow(2, attempt) * 100)))`,
      `+        {:cont, :error}`,
      `+      {:error, reason} -> {:halt, {:error, reason}}`,
      `+    end`,
      `+  end)`,
      ` end`,
    ].join('\n');
    return {
      id: `patch-retry-ex-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Exponential Backoff with Jitter for ${nodeName}`,
      description: `Uses Enum.reduce_while with exponential jitter backoff.`,
      resilience_pattern: 'exponential_backoff_jitter',
      diff,
      estimated_blast_radius_reduction_pct: 60,
    };
  }

  private buildBulkheadPatchElixir(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index f4a5b6c..d7e8f9a 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,4 @@ config :my_app, MyApp.Repo,`,
      `-  pool_size: 100`,
      `+  # Bob Resilience Patch: Bounded connection pool & queue target`,
      `+  pool_size: 25,`,
      `+  queue_target: 3000`,
    ].join('\n');
    return {
      id: `patch-pool-ex-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Bound Repo Pool Size for ${nodeName}`,
      description: `Limits Ecto repo pool_size to 25 with 3s queue target.`,
      resilience_pattern: 'bulkhead_isolation',
      diff,
      estimated_blast_radius_reduction_pct: 50,
    };
  }

  private buildFallbackCachePatchElixir(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index a5b6c7d..e8f9a0b 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -10,1 +10,8 @@ def get_data(key) do`,
      `-  RemoteApi.get(key)`,
      `+  # Bob Resilience Patch: ETS stale fallback cache`,
      `+  case RemoteApi.get(key) do`,
      `+    {:ok, val} -> :ets.insert(:stale_cache, {key, val}); {:ok, val}`,
      `+    {:error, _} ->`,
      `+      case :ets.lookup(:stale_cache, key) do`,
      `+        [{^key, val}] -> {:ok, val}`,
      `+        [] -> {:error, :unavailable}`,
      `+      end`,
      `+  end`,
      ` end`,
    ].join('\n');
    return {
      id: `patch-fb-ex-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Stale Fallback Cache for ${nodeName}`,
      description: `Serves cached data from :ets table during outages.`,
      resilience_pattern: 'fallback_cache',
      diff,
      estimated_blast_radius_reduction_pct: 80,
    };
  }

  private buildHealthCheckPatchElixir(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index b6c7d8e..f9a0b1c 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -1,3 +1,5 @@`,
      `+# Bob Resilience Patch: Plug /healthz probe`,
      `+get "/healthz" do`,
      `+  send_resp(conn, 200, Jason.encode!(%{status: "UP"}))`,
      `+end`,
    ].join('\n');
    return {
      id: `patch-hc-ex-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add /healthz Route for ${nodeName}`,
      description: `Exposes Plug health check endpoint.`,
      resilience_pattern: 'health_check_endpoint',
      diff,
      estimated_blast_radius_reduction_pct: 65,
    };
  }

  private buildAsyncQueuePatchElixir(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index c7d8e9f..a0b1c2d 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,4 @@ def handle_blocking_call(data) do`,
      `-  execute_blocking(data)`,
      `+  # Bob Resilience Patch: Task.await with timeout budget`,
      `+  Task.async(fn -> execute_blocking(data) end) |> Task.await(2500)`,
      ` end`,
    ].join('\n');
    return {
      id: `patch-async-ex-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Wrap Blocking Call in Task.await Timeout for ${nodeName}`,
      description: `Guards execution with 2.5s Task.await timeout.`,
      resilience_pattern: 'timeout_budgeting',
      diff,
      estimated_blast_radius_reduction_pct: 70,
    };
  }

  private buildFailoverPatchElixir(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index d8e9f0a..b1c2d3e 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -3,1 +3,4 @@ config :my_app,`,
      `-  database_hosts: ["primary-db"]`,
      `+  # Bob Resilience Patch: Multi-node standby cluster failover`,
      `+  database_hosts: ["primary-db", "standby-db"]`,
    ].join('\n');
    return {
      id: `patch-spof-ex-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Configure Multi-Node Standby Failover for ${nodeName}`,
      description: `Configures primary and standby database cluster hosts.`,
      resilience_pattern: 'graceful_degradation',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  // =========================================================================
  // Kubernetes / Envoy / Istio YAML Resilience Templates
  // =========================================================================

  private buildCircuitBreakerPatchYaml(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index e9f0a1b..c2d3e4f 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -10,1 +10,12 @@ spec:`,
      `+  # Bob Resilience Patch: Envoy/Istio OutlierDetection Circuit Breaker`,
      `+  trafficPolicy:`,
      `+    connectionPool:`,
      `+      http:`,
      `+        maxConnections: 50`,
      `+    outlierDetection:`,
      `+      consecutive5xxErrors: 5`,
      `+      interval: 10s`,
      `+      baseEjectionTime: 30s`,
      `+      maxEjectionPercent: 100`,
    ].join('\n');
    return {
      id: `patch-cb-yaml-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Istio OutlierDetection Circuit Breaker for ${nodeName}`,
      description: `Injects Envoy outlierDetection ejecting failing upstream hosts for 30s.`,
      resilience_pattern: 'circuit_breaker',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }

  private buildExponentialBackoffPatchYaml(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index f0a1b2c..d3e4f5a 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -8,1 +8,7 @@ route:`,
      `+  # Bob Resilience Patch: Istio VirtualService Retry Policy`,
      `+  retries:`,
      `+    attempts: 3`,
      `+    perTryTimeout: 2s`,
      `+    retryOn: 5xx,connect-failure,refused-stream`,
    ].join('\n');
    return {
      id: `patch-retry-yaml-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Istio Retry Policy for ${nodeName}`,
      description: `Configures 3 retries with 2s per-try timeout on 5xx failures.`,
      resilience_pattern: 'exponential_backoff_jitter',
      diff,
      estimated_blast_radius_reduction_pct: 60,
    };
  }

  private buildBulkheadPatchYaml(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index a1b2c3d..e4f5a6b 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -15,1 +15,7 @@ containers:`,
      `+    # Bob Resilience Patch: Kubernetes Resource Quota Bulkhead`,
      `+    resources:`,
      `+      limits:`,
      `+        cpu: "1000m"`,
      `+        memory: "1Gi"`,
      `+      requests:`,
      `+        cpu: "250m"`,
      `+        memory: "256Mi"`,
    ].join('\n');
    return {
      id: `patch-pool-yaml-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Set Resource Limits Bulkhead for ${nodeName}`,
      description: `Bounds CPU and memory consumption to prevent noisy neighbor starvation.`,
      resilience_pattern: 'bulkhead_isolation',
      diff,
      estimated_blast_radius_reduction_pct: 50,
    };
  }

  private buildFallbackCachePatchYaml(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index b2c3d4e..f5a6b7c 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -10,1 +10,4 @@ location /api {`,
      `+  # Bob Resilience Patch: Nginx Stale Cache Fallback on Error`,
      `+  proxy_cache_use_stale error timeout updating http_500 http_502 http_503;`,
      `+  proxy_cache_valid 200 10m;`,
    ].join('\n');
    return {
      id: `patch-fb-yaml-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Enable Stale Cache Fallback in Gateway for ${nodeName}`,
      description: `Configures reverse proxy to serve stale cached responses during upstream downtime.`,
      resilience_pattern: 'fallback_cache',
      diff,
      estimated_blast_radius_reduction_pct: 80,
    };
  }

  private buildHealthCheckPatchYaml(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index c3d4e5f..a6b7c8d 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -12,1 +12,11 @@ containers:`,
      `+    # Bob Resilience Patch: Kubernetes Liveness & Readiness Probes`,
      `+    livenessProbe:`,
      `+      httpGet:`,
      `+        path: /healthz`,
      `+        port: 8080`,
      `+      periodSeconds: 10`,
      `+      timeoutSeconds: 3`,
      `+    readinessProbe:`,
      `+      httpGet:`,
      `+        path: /readyz`,
      `+        port: 8080`,
    ].join('\n');
    return {
      id: `patch-hc-yaml-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Add Kubernetes Liveness & Readiness Probes for ${nodeName}`,
      description: `Configures container health probes with 3s timeout for automatic pod restarts.`,
      resilience_pattern: 'health_check_endpoint',
      diff,
      estimated_blast_radius_reduction_pct: 65,
    };
  }

  private buildAsyncQueuePatchYaml(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index d4e5f6a..b7c8d9e 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -5,1 +5,3 @@ spec:`,
      `+  # Bob Resilience Patch: Ingress Route Timeout Budget`,
      `+  timeout: 2.5s`,
    ].join('\n');
    return {
      id: `patch-async-yaml-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Enforce Ingress Timeout Budget for ${nodeName}`,
      description: `Sets 2.5-second request timeout at the ingress / gateway tier.`,
      resilience_pattern: 'timeout_budgeting',
      diff,
      estimated_blast_radius_reduction_pct: 70,
    };
  }

  private buildFailoverPatchYaml(rc: RootCause, targetFile: string, nodeName: string): SuggestedPatch {
    const diff = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `index e5f6a7b..c8d9e0f 100644`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      `@@ -8,1 +8,6 @@ spec:`,
      `+  # Bob Resilience Patch: Primary-Standby DestinationRule Subsets`,
      `+  subsets:`,
      `+    - name: primary`,
      `+      labels: { role: primary }`,
      `+    - name: standby`,
      `+      labels: { role: standby }`,
    ].join('\n');
    return {
      id: `patch-spof-yaml-${rc.id}`,
      root_cause_id: rc.id,
      target_node_id: rc.node_id,
      target_file: targetFile,
      title: `Configure Primary/Standby Subsets in DestinationRule for ${nodeName}`,
      description: `Enables traffic policy routing with standby failover subsets.`,
      resilience_pattern: 'graceful_degradation',
      diff,
      estimated_blast_radius_reduction_pct: 75,
    };
  }
}

// ---------------------------------------------------------------------------
// Public utility: compile report → unified diff
// ---------------------------------------------------------------------------

/**
 * Compiles all suggested patches from a `FailureAnalysisReport` into a
 * single `UnifiedGitDiff` object.
 *
 * This is the second public entrypoint of the agents package, consumed
 * by Person 4's diff viewer and Person 3's delta comparator.
 *
 * @param failureReport - A completed failure analysis report.
 * @returns A compiled unified git diff with addition/deletion counts.
 */
export function generate_resilience_patch(
  failureReport: FailureAnalysisReport,
): UnifiedGitDiff {
  const patches = failureReport.suggested_patches ?? [];
  const filesChangedSet = new Set<string>();
  const rawDiffParts: string[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;
  const patchEntries: PatchEntry[] = [];

  for (const patch of patches) {
    filesChangedSet.add(patch.target_file);
    rawDiffParts.push(patch.diff);

    // Count additions/deletions from diff lines
    for (const line of patch.diff.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        totalAdditions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        totalDeletions++;
      }
    }

    patchEntries.push({
      file_path: patch.target_file,
      diff_hunk: patch.diff,
      description: `${patch.title}: ${patch.description}`,
    });
  }

  return {
    raw_diff: rawDiffParts.join('\n\n'),
    files_changed: Array.from(filesChangedSet),
    total_additions: totalAdditions,
    total_deletions: totalDeletions,
    patches: patchEntries,
  };
}
