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

## Subagents Architecture

- **Propagation Subagent (`src/subagents/propagation.ts`)**: Traces reverse call graph dependency cascades, circuit breaker status, and failure mechanisms (`timeout_cascade`, `retry_storm`, `direct_dependency_loss`, `unhandled_exception`).
- **Latency & Bottleneck Subagent (`src/subagents/bottleneck.ts`)**: Inspects connection pools, timeout budgets, queue backlog risks, and latency multiplier amplification.
- **Recovery & Self-Healing Subagent (`src/subagents/recovery.ts`)**: Evaluates automatic degradation, health checks, fallback strategies, and calculates recovery time bounds.
- **Patch Generator (`src/subagents/patch_generator.ts`)**: Synthesizes production-ready resilience patterns (circuit breakers, exponential backoff with jitter, fallback cache, bulkhead isolation) into valid unified git diffs.
- **Scenario Parser (`src/parser/scenario_parser.ts`)**: Deterministic NLP parser extracting scenario types (`complete_failure`, `latency_degradation`, `network_partition`, etc.) and quantified parameters (`latency_multiplier`, `duration_ms`, `error_rate`).

## LLM Providers

- **`BobLLMProvider` (`src/llm/watsonx.ts`)**: Connects to the IBM Bob inference API (`/ml/v1/text/chat`) using `BOB_API_KEY`. Defaults to `ibm/granite-3-8b-instruct`. Automatically degrades gracefully to `MockLLMProvider` when unconfigured.
- **`MockLLMProvider` (`src/llm/mock_provider.ts`)**: Enables 100% offline deterministic execution and lightning-fast test suite runs without external API dependencies.

## Testing & Verification

Run the full test suite using Node's native test runner:

```bash
npm test
# or
node --test tests/*.test.ts
```
