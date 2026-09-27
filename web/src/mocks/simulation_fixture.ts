// web/src/mocks/simulation_fixture.ts
//
// This is the request body sent as `report` to the Python engine's
// /api/engine/simulate and /api/engine/patch-and-rerun endpoints.
// It must match core/engine/models.py::FailureAnalysisReportInput,
// NOT the old client-side SimulationResult shape — those are different
// contracts. Anything with fields the Pydantic model doesn't recognize
// gets silently ignored (extra="ignore"), which is why the previous
// version of this file produced empty simulations.

export interface MockFailureAnalysisReport {
  scenario_prompt: string;
  analyzed_at?: string;
  affected_nodes: Array<{
    node_id: string;
    node_name?: string;
    status: string;
    impact_level: string;
    failure_reason?: string;
    latency_impact_multiplier: number;
    error_rate_estimate: number;
    recovering: boolean;
  }>;
  failure_chains: Array<{
    chain_id: string;
    trigger_event?: string;
    root_node_id: string;
    steps: Array<{
      step_order: number;
      source_node_id: string;
      target_node_id: string;
      edge_protocol?: string;
      mechanism: string;
      description?: string;
      elapsed_ms_estimate: number;
    }>;
    cascading_blast_radius: number;
  }>;
  root_causes: Array<{
    id: string;
    node_id: string;
    vulnerability_type: string;
    description: string;
    severity: string;
    file_target?: string;
    code_reference?: string;
  }>;
  suggested_patches: Array<{
    id: string;
    root_cause_id?: string;
    target_node_id: string;
    target_file?: string;
    title?: string;
    description?: string;
    resilience_pattern?: string;
    diff: string;
    estimated_blast_radius_reduction_pct: number;
  }>;
}

export const mockRedisFailureSim: MockFailureAnalysisReport = {
  scenario_prompt: "What happens if Redis goes down for 30 seconds?",
  analyzed_at: new Date().toISOString(),
  affected_nodes: [
    {
      node_id: "redis-cache",
      node_name: "Redis Cache",
      status: "dead",
      impact_level: "critical",
      failure_reason: "Direct point of failure: Redis container crashed",
      latency_impact_multiplier: 10.0,
      error_rate_estimate: 1.0,
      recovering: false,
    },
    {
      node_id: "order-service",
      node_name: "Order Service",
      status: "failing",
      impact_level: "critical",
      failure_reason: "Cascading timeout on downstream redis-cache",
      latency_impact_multiplier: 8.0,
      error_rate_estimate: 0.95,
      recovering: false,
    },
    {
      node_id: "api-gateway",
      node_name: "API Gateway",
      status: "degraded",
      impact_level: "medium",
      failure_reason: "Upstream order-service latency threshold exceeded",
      latency_impact_multiplier: 3.0,
      error_rate_estimate: 0.4,
      recovering: true,
    },
  ],
  failure_chains: [
    {
      chain_id: "chain-redis-to-order-to-gw",
      trigger_event: "What happens if Redis goes down for 30 seconds?",
      root_node_id: "redis-cache",
      steps: [
        {
          step_order: 1,
          source_node_id: "redis-cache",
          target_node_id: "order-service",
          edge_protocol: "redis",
          mechanism: "timeout_cascade",
          description:
            "Connection timeout on redis-cache causes order-service pool saturation",
          elapsed_ms_estimate: 500,
        },
        {
          step_order: 2,
          source_node_id: "order-service",
          target_node_id: "api-gateway",
          edge_protocol: "http",
          mechanism: "unhandled_exception",
          description:
            "Gateway requests to order-service fail with HTTP 504 Gateway Timeout",
          elapsed_ms_estimate: 2500,
        },
      ],
      cascading_blast_radius: 3,
    },
  ],
  root_causes: [
    {
      id: "rc-1",
      node_id: "order-service",
      vulnerability_type: "missing_circuit_breaker",
      description: "order-service has no circuit breaker wrapping redis calls",
      severity: "critical",
      file_target: "src/services/order.py",
    },
    {
      id: "rc-2",
      node_id: "order-service",
      vulnerability_type: "missing_fallback",
      description:
        "order-service does not have local stale-while-revalidate fallback cache",
      severity: "high",
      file_target: "src/services/order.py",
    },
  ],
  suggested_patches: [
    {
      id: "patch-cb-order-service",
      root_cause_id: "rc-1",
      target_node_id: "order-service",
      target_file: "src/services/order.py",
      title: "Add pybreaker circuit breaker to order-service",
      description: "Wraps Redis client calls with circuit breaker and fallback",
      resilience_pattern: "circuit_breaker",
      diff:
        "@@ -12,2 +12,8 @@\n+ @pybreaker.circuit_breaker\n def get_cache(): pass",
      estimated_blast_radius_reduction_pct: 66.7,
    },
  ],
};
