# Core Agents — Agent Orchestration & Subagents (Person 2)

The `core/agents` package implements IBM Bob 2.0 Agent Mode orchestration, parallel subagent dispatch (Propagation, Latency/Bottleneck, Recovery/Self-Healing), natural-language attack scenario parsing, and automated resilience patch generation.

Its primary entrypoint is `runFailureAnalysis(digitalTwin, attackPrompt, options?)` alongside the patch compiler utility `generate_resilience_patch(failureReport)`. The package assumes an in-memory `DigitalTwinSchema` graph conforming to `shared/types/agent.ts` containing typed `nodes` (services, databases, caches, queues, APIs) and `edges` (call relationships with protocol and sync flags), and outputs a typed `FailureAnalysisReport` with affected nodes, failure propagation chains, identified root-cause vulnerabilities, and suggested unified git diff patches.

## Public Entrypoints

```typescript
import {
  runFailureAnalysis,
  generate_resilience_patch,
  parseScenario,
  MasterAgent,
  BobLLMProvider,
  MockLLMProvider,
} from '@bob-simulator/agents';

// 1. Run failure simulation
const report = await runFailureAnalysis(
  digitalTwin,
  'What happens if Redis drops packets for 30s?'
);

// 2. Compile suggested patches to unified git diff
const diff = generate_resilience_patch(report);

// 3. Parse freeform scenario text
const scenario = parseScenario('What if payment API is 10x slower for 1 minute?');
```

## Interactive CLI Demo

Run the end-to-end multi-agent resilience analyzer directly from your terminal:

```bash
# Run with default Black Friday cascade scenario (auto-fallback to IBM Cloud/Mock)
npm run demo

# Fast offline execution (<10ms)
npm run demo:offline

# Run with a custom natural-language attack scenario
node src/cli.ts "What happens if Stripe payment gateway is 10x slower?"

# Export full FailureAnalysisReport JSON for Person 3 / Person 4
npm run demo:export
```

## Subagents Architecture

- **Propagation Subagent (`src/subagents/propagation.ts`)**: Traces reverse call graph dependency cascades, multi-path severity escalation, and failure mechanisms (`timeout_cascade`, `retry_storm`, `direct_dependency_loss`, `unhandled_exception`).
- **Latency & Bottleneck Subagent (`src/subagents/bottleneck.ts`)**: Inspects connection pools, timeout budgets, queue backlog risks, and latency multiplier amplification.
- **Recovery & Self-Healing Subagent (`src/subagents/recovery.ts`)**: Evaluates self-healing readiness, health checks, fallback strategies, and calculates recovery time bounds with leaf-node discrimination.
- **Universal Polyglot Patch Generator (`src/subagents/patch_generator.ts`)**: Synthesizes production-ready resilience patterns into syntactically valid Unified Git Diffs across **11 language ecosystems**:
  1. **TypeScript / JavaScript**: `opossum`, `p-retry` with full jitter, `p-queue`, `express`
  2. **Python**: `pybreaker`, `tenacity` (jitter backoff), `asyncpg`, `asyncio.Semaphore`, `FastAPI`
  3. **Go**: `sony/gobreaker`, `math/rand`, buffered worker channels, `net/http`
  4. **Java / Kotlin / Scala**: `io.github.resilience4j` (CB + Retry), `HikariCP`, `Spring Boot Actuator`
  5. **C# / .NET / F#**: `Polly` (`CircuitBreakerAsync`, `WaitAndRetryAsync`), `SocketsHttpHandler`, ASP.NET Core
  6. **Rust**: `recloser::Recloser`, `backoff::ExponentialBackoff`, `tokio::sync::Semaphore`, `r2d2`, `axum`
  7. **PHP / Laravel**: `ackintosh/ganesha`, `PDO`, queue dispatch, `/healthz`
  8. **Ruby / Rails**: Shopify `semian`, `retries` gem, ActiveRecord pool, Rails `/up`
  9. **C / C++**: `libcurl`, POSIX timeouts, `std::async`, socket pools
  10. **Elixir / Phoenix**: OTP `:fuse` circuit breaker, `:poolboy`, Plug `/healthz`
  11. **Kubernetes & Service Mesh IaC**: `livenessProbe` / `readinessProbe`, Envoy `outlierDetection`, Istio `DestinationRule`
- **Scenario Parser (`src/parser/scenario_parser.ts`)**: Deterministic NLP parser extracting scenario types (`complete_failure`, `latency_degradation`, `network_partition`, etc.) and quantified parameters (`latency_multiplier`, `duration_ms`, `error_rate`).

## Multi-Tier LLM Architecture

Resilience is guaranteed via an automatic 3-tier fallback chain:
$$\text{Local Ollama (localhost:11434)} \longrightarrow \text{IBM Bob Cloud (BOB\_API\_KEY)} \longrightarrow \text{Offline Mock Heuristics}$$

- **`BobLLMProvider` / `OllamaLLMProvider` (`src/llm/watsonx.ts`)**: Tries local Ollama inference first, automatically falls back to IBM Bob Cloud (`https://us-south.ml.cloud.ibm.com`) when `BOB_API_KEY` is present, and gracefully degrades to `MockLLMProvider` if offline.
- **`BobCloudLLMProvider` (`src/llm/watsonx.ts`)**: Standalone IBM Cloud provider connecting directly to Bob inference endpoints.
- **`MockLLMProvider` (`src/llm/mock_provider.ts`)**: Enables 100% offline deterministic execution and lightning-fast test suite runs.

## Testing & Verification

Run the full test suite (56 tests / 12 suites / 0 failures) using Node's native test runner:

```bash
npm test
# or
node --test tests/*.test.ts
```

