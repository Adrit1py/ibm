
import type { SimulationResult } from '../../../shared/types/digital_twin';

export const mockRedisFailureSim: SimulationResult = {
  scenarioId: "sc_12345",
  scenarioDescription: "What happens if Redis goes down for 30s?",
  timeline: [
    {
      timeOffsetSec: 0,
      nodes: [
        { id: "api-gateway", type: "service", label: "API Gateway", status: "healthy" },
        { id: "redis-cache", type: "cache", label: "Redis Cache", status: "healthy" },
        { id: "postgres-db", type: "database", label: "Primary DB", status: "healthy" }
      ],
      edges: [
        { id: "e1", source: "api-gateway", target: "redis-cache", type: "sync", isFailing: false },
        { id: "e2", source: "api-gateway", target: "postgres-db", type: "sync", isFailing: false }
      ],
      agentLogs: ["[Orchestrator] Ingested architecture graph. Waiting for trigger."]
    },
    {
      timeOffsetSec: 5,
      nodes: [
        { id: "api-gateway", type: "service", label: "API Gateway", status: "degraded" },
        { id: "redis-cache", type: "cache", label: "Redis Cache", status: "failed" },
        { id: "postgres-db", type: "database", label: "Primary DB", status: "healthy" }
      ],
      edges: [
        { id: "e1", source: "api-gateway", target: "redis-cache", type: "sync", isFailing: true },
        { id: "e2", source: "api-gateway", target: "postgres-db", type: "sync", isFailing: false }
      ],
      agentLogs: [
        "[Simulation Engine] Redis container terminated.",
        "[Subagent: Propagation] Connection timeouts spiking on api-gateway -> redis-cache."
      ]
    }
  ],
  suggestedPatch: {
    filepath: "src/api/cache_client.py",
    description: "Implement exponential backoff and circuit breaker to prevent thread exhaustion.",
    diff: "@@ -12,4 +12,6 @@\n- redis.connect(timeout=None)\n+ redis.connect(timeout=2.0)\n+ if circuit_breaker.is_open():\n+     return fallback_cache"
  }
};
