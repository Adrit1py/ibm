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
        return lang === 'python'
          ? this.buildCircuitBreakerPatchPython(rc, targetFile, nodeName)
          : lang === 'go'
            ? this.buildCircuitBreakerPatchGo(rc, targetFile, nodeName)
            : this.buildCircuitBreakerPatch(rc, targetFile, nodeName);
      case 'infinite_retry_without_jitter':
        return lang === 'python'
          ? this.buildExponentialBackoffPatchPython(rc, targetFile, nodeName)
          : lang === 'go'
            ? this.buildExponentialBackoffPatchGo(rc, targetFile, nodeName)
            : this.buildExponentialBackoffPatch(rc, targetFile, nodeName);
      case 'tight_timeout':
      case 'unbounded_connection_pool':
        return lang === 'python'
          ? this.buildBulkheadPatchPython(rc, targetFile, nodeName)
          : lang === 'go'
            ? this.buildBulkheadPatchGo(rc, targetFile, nodeName)
            : this.buildBulkheadIsolationPatch(rc, targetFile, nodeName);
      case 'missing_fallback':
        return lang === 'python'
          ? this.buildFallbackCachePatchPython(rc, targetFile, nodeName)
          : lang === 'go'
            ? this.buildFallbackCachePatchGo(rc, targetFile, nodeName)
            : this.buildFallbackCachePatch(rc, targetFile, nodeName);
      default:
        return null;
    }
  }

  /** Detects language from file extension. */
  private detectLanguage(filePath: string): 'typescript' | 'python' | 'go' {
    if (filePath.endsWith('.py')) return 'python';
    if (filePath.endsWith('.go')) return 'go';
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
