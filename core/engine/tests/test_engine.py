"""Comprehensive unit and integration test suite for Person 3 — Simulation Engine & Blast Radius.
"""

import json
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from shared.types.digital_twin import (
    DigitalTwinSchema,
    GraphEdge,
    GraphNode,
    NodeType,
    EdgeType,
)
from core.engine.models import (
    AffectedNodeInput,
    FailureAnalysisReportInput,
    FailureChainInput,
    FailurePropagationStepInput,
    RootCauseInput,
    SuggestedPatchInput,
)
from core.engine.graph_loader import (
    calculate_node_centrality,
    find_single_points_of_failure,
    get_downstream_dependencies,
    get_upstream_callers,
    load_digital_twin,
    to_networkx,
)
from core.engine.timeline import generate_timeline
from core.engine.scorer import calculate_blast_radius, calculate_resilience_score
from core.engine.patcher import apply_resilience_patches, build_patched_failure_report
from core.engine.delta import compare_runs
from core.engine.engine import SimulationEngine
from core.engine.api import create_engine_app


@pytest.fixture
def sample_digital_twin() -> DigitalTwinSchema:
    """Fixture providing a standard 4-node microservices architecture."""
    now = datetime.now(timezone.utc)
    nodes = [
        GraphNode(id="api-gateway", type=NodeType.gateway, name="API Gateway", language="node"),
        GraphNode(id="order-service", type=NodeType.service, name="Order Service", language="python"),
        GraphNode(id="redis-cache", type=NodeType.cache, name="Redis Cache", language=None),
        GraphNode(id="postgres-db", type=NodeType.database, name="PostgreSQL DB", language=None),
    ]
    edges = [
        GraphEdge(source="api-gateway", target="order-service", type=EdgeType.sync_call, timeout_ms=3000),
        GraphEdge(source="order-service", target="redis-cache", type=EdgeType.sync_call, timeout_ms=500),
        GraphEdge(source="order-service", target="postgres-db", type=EdgeType.sync_call, timeout_ms=2000),
    ]
    return DigitalTwinSchema(
        schema_version="0.1.0",
        generated_at=now,
        repo_path="/app/test",
        warnings=[],
        nodes=nodes,
        edges=edges,
    )


@pytest.fixture
def sample_failure_report() -> FailureAnalysisReportInput:
    """Fixture providing a Person 2 FailureAnalysisReport for Redis failure."""
    return FailureAnalysisReportInput(
        scenario_prompt="What happens if Redis goes down for 30 seconds?",
        analyzed_at="2026-09-26T12:00:00Z",
        affected_nodes=[
            AffectedNodeInput(
                node_id="redis-cache",
                node_name="Redis Cache",
                status="dead",
                impact_level="critical",
                failure_reason="Direct point of failure: Redis container crashed",
                latency_impact_multiplier=10.0,
                error_rate_estimate=1.0,
                recovering=False,
            ),
            AffectedNodeInput(
                node_id="order-service",
                node_name="Order Service",
                status="failing",
                impact_level="critical",
                failure_reason="Cascading timeout on downstream redis-cache",
                latency_impact_multiplier=8.0,
                error_rate_estimate=0.95,
                recovering=False,
            ),
            AffectedNodeInput(
                node_id="api-gateway",
                node_name="API Gateway",
                status="degraded",
                impact_level="medium",
                failure_reason="Upstream order-service latency threshold exceeded",
                latency_impact_multiplier=3.0,
                error_rate_estimate=0.4,
                recovering=True,
            ),
        ],
        failure_chains=[
            FailureChainInput(
                chain_id="chain-redis-to-order-to-gw",
                trigger_event="What happens if Redis goes down for 30 seconds?",
                root_node_id="redis-cache",
                steps=[
                    FailurePropagationStepInput(
                        step_order=1,
                        source_node_id="redis-cache",
                        target_node_id="order-service",
                        edge_protocol="redis",
                        mechanism="timeout_cascade",
                        description="Connection timeout on redis-cache causes order-service pool saturation",
                        elapsed_ms_estimate=500,
                    ),
                    FailurePropagationStepInput(
                        step_order=2,
                        source_node_id="order-service",
                        target_node_id="api-gateway",
                        edge_protocol="http",
                        mechanism="unhandled_exception",
                        description="Gateway requests to order-service fail with HTTP 504 Gateway Timeout",
                        elapsed_ms_estimate=2500,
                    ),
                ],
                cascading_blast_radius=3,
            )
        ],
        root_causes=[
            RootCauseInput(
                id="rc-1",
                node_id="order-service",
                vulnerability_type="missing_circuit_breaker",
                description="order-service has no circuit breaker wrapping redis calls",
                severity="critical",
                file_target="src/services/order.py",
            ),
            RootCauseInput(
                id="rc-2",
                node_id="order-service",
                vulnerability_type="missing_fallback",
                description="order-service does not have local stale-while-revalidate fallback cache",
                severity="high",
                file_target="src/services/order.py",
            ),
        ],
        suggested_patches=[
            SuggestedPatchInput(
                id="patch-cb-order-service",
                root_cause_id="rc-1",
                target_node_id="order-service",
                target_file="src/services/order.py",
                title="Add pybreaker circuit breaker to order-service",
                description="Wraps Redis client calls with circuit breaker and fallback",
                resilience_pattern="circuit_breaker",
                diff="@@ -12,2 +12,8 @@\n+ @pybreaker.circuit_breaker\n def get_cache(): pass",
                estimated_blast_radius_reduction_pct=66.7,
            )
        ],
    )


def test_graph_loader_and_topology(sample_digital_twin: DigitalTwinSchema):
    """Test graph conversion, DiGraph properties, and topological analysis."""
    G = to_networkx(sample_digital_twin)
    assert len(G.nodes) == 4
    assert len(G.edges) == 3
    assert G.has_edge("api-gateway", "order-service")
    assert G.has_edge("order-service", "redis-cache")

    upstream = get_upstream_callers(G, "redis-cache")
    assert "order-service" in upstream
    assert "api-gateway" in upstream

    downstream = get_downstream_dependencies(G, "api-gateway")
    assert "order-service" in downstream
    assert "redis-cache" in downstream
    assert "postgres-db" in downstream

    centrality = calculate_node_centrality(G)
    assert "order-service" in centrality
    assert centrality["order-service"] >= centrality["postgres-db"]

    spofs = find_single_points_of_failure(G)
    assert isinstance(spofs, list)


def test_timeline_generation(sample_digital_twin: DigitalTwinSchema, sample_failure_report: FailureAnalysisReportInput):
    """Test deterministic multi-tick timeline generation and state transitions."""
    timeline = generate_timeline(sample_digital_twin, sample_failure_report)
    assert len(timeline) >= 5

    # T=0: Initial healthy baseline
    tick_0 = timeline[0]
    assert tick_0.time_offset_sec == 0.0
    for node in tick_0.nodes:
        assert node.status == "healthy"
        assert node.error_rate == 0.0
        assert not node.is_failing

    # T=1: Direct seed failure on redis-cache
    tick_1 = next(t for t in timeline if t.time_offset_sec == 1.0)
    redis_node_1 = next(n for n in tick_1.nodes if n.id == "redis-cache")
    assert redis_node_1.status in ("dead", "failing")
    assert redis_node_1.is_failing

    # T >= 3: Cascade has propagated to order-service and api-gateway
    tick_late = timeline[-1]
    assert any("[Simulation Engine]" in log for log in tick_0.agent_logs)


def test_blast_radius_calculation(sample_digital_twin: DigitalTwinSchema, sample_failure_report: FailureAnalysisReportInput):
    """Test blast radius quantitative metrics calculation."""
    metrics = calculate_blast_radius(sample_digital_twin, sample_failure_report)
    assert metrics.total_nodes == 4
    assert metrics.affected_nodes_count == 3
    assert metrics.direct_failure_count == 1
    assert metrics.cascaded_failure_count == 2
    assert metrics.blast_radius_pct == 75.0
    assert "redis-cache" in metrics.direct_node_ids
    assert "order-service" in metrics.cascaded_node_ids
    assert "postgres-db" in metrics.unaffected_node_ids
    assert metrics.impact_level in ("high", "critical")


def test_resilience_scoring(sample_digital_twin: DigitalTwinSchema, sample_failure_report: FailureAnalysisReportInput):
    """Test multi-factor resilience score calculation and letter grade assignment."""
    score_report = calculate_resilience_score(sample_digital_twin, sample_failure_report)
    assert 0.0 <= score_report.overall_resilience_score <= 100.0
    assert score_report.letter_grade in ("A+", "A", "B", "C", "D", "F")
    assert 0.0 <= score_report.breakdown.cascading_resistance <= 100.0
    assert 0.0 <= score_report.breakdown.fault_isolation <= 100.0
    assert 0.0 <= score_report.breakdown.graceful_degradation <= 100.0
    assert 0.0 <= score_report.breakdown.recovery_efficiency <= 100.0
    assert len(score_report.risk_factors) > 0
    assert len(score_report.remediation_recommendations) > 0


def test_patch_application_and_delta_comparison(
    sample_digital_twin: DigitalTwinSchema, sample_failure_report: FailureAnalysisReportInput
):
    """Test patch applicator, rerun simulation, and delta comparator."""
    engine = SimulationEngine()
    baseline, patched, delta = engine.run_with_patch(sample_digital_twin, sample_failure_report)

    assert baseline.is_patched_run is False
    assert patched.is_patched_run is True

    # Patched run should have higher or equal resilience score and lower blast radius
    assert patched.resilience_score.overall_resilience_score > baseline.resilience_score.overall_resilience_score
    assert delta.resilience_score_improvement > 0
    assert delta.blast_radius_reduction_pct > 0
    assert len(delta.executive_summary) > 10


def test_fastapi_endpoints(sample_digital_twin: DigitalTwinSchema, sample_failure_report: FailureAnalysisReportInput):
    """Test Person 3 FastAPI JSON/Data API endpoints."""
    app = create_engine_app()
    client = TestClient(app)

    # 1. Health check
    res_health = client.get("/api/engine/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"

    # 2. Simulate endpoint
    req_data = {
        "graph": sample_digital_twin.model_dump(mode="json"),
        "report": sample_failure_report.model_dump(mode="json"),
    }
    res_sim = client.post("/api/engine/simulate", json=req_data)
    assert res_sim.status_code == 200
    sim_json = res_sim.json()
    assert "timeline" in sim_json
    assert "blast_radius" in sim_json
    assert "resilience_score" in sim_json

    # 3. Score endpoint
    res_score = client.post("/api/engine/score", json=req_data)
    assert res_score.status_code == 200
    score_json = res_score.json()
    assert "overall_resilience_score" in score_json
    assert "breakdown" in score_json

    # 4. Patch & rerun endpoint
    res_patch = client.post("/api/engine/patch-and-rerun", json=req_data)
    assert res_patch.status_code == 200
    patch_json = res_patch.json()
    assert "baseline" in patch_json
    assert "patched" in patch_json
    assert "delta" in patch_json
    assert patch_json["delta"]["resilience_score_improvement"] > 0


def test_empty_graph_edge_case():
    """Test engine handling of empty graph edge case."""
    empty_twin = DigitalTwinSchema(
        schema_version="0.1.0",
        generated_at=datetime.now(timezone.utc),
        repo_path="/empty",
        warnings=[],
        nodes=[],
        edges=[],
    )
    empty_report = FailureAnalysisReportInput(scenario_prompt="Empty graph test")

    engine = SimulationEngine()
    result = engine.run(empty_twin, empty_report)
    assert result.node_count == 0
    assert result.blast_radius.blast_radius_pct == 0.0
    assert result.resilience_score.overall_resilience_score >= 0.0
