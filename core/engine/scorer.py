"""Resilience and blast-radius scoring engine for Person 3.

Calculates quantitative blast-radius metrics, multi-factor architectural resilience scores,
and structured diagnostic breakdowns.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Set

from shared.types.digital_twin import DigitalTwinSchema, GraphNode
from .graph_loader import calculate_node_centrality, find_single_points_of_failure, to_networkx
from .models import (
    AffectedNodeInput,
    BlastRadiusMetrics,
    FailureAnalysisReportInput,
    ResilienceBreakdown,
    ResilienceScoreReport,
    SimulationTick,
)


def calculate_blast_radius(
    graph: DigitalTwinSchema,
    failure_report: FailureAnalysisReportInput,
    timeline: Optional[List[SimulationTick]] = None,
) -> BlastRadiusMetrics:
    """Compute deterministic blast radius metrics for a failure scenario.

    Args:
        graph: The digital twin architecture graph.
        failure_report: The Person 2 failure analysis report.
        timeline: Optional generated timeline ticks.

    Returns:
        BlastRadiusMetrics containing counts, percentages, and affected component IDs.
    """
    total_nodes = len(graph.nodes)
    if total_nodes == 0:
        return BlastRadiusMetrics(
            total_nodes=0,
            affected_nodes_count=0,
            direct_failure_count=0,
            cascaded_failure_count=0,
            blast_radius_pct=0.0,
            direct_node_ids=[],
            cascaded_node_ids=[],
            unaffected_node_ids=[],
            impact_level="low",
            max_cascade_depth=0,
            critical_services_impacted=[],
        )

    all_node_ids = set(n.id for n in graph.nodes)
    node_map: Dict[str, GraphNode] = {n.id: n for n in graph.nodes}

    # 1. Direct seed failure nodes
    direct_node_ids: Set[str] = set()
    for chain in failure_report.failure_chains:
        if chain.root_node_id and chain.root_node_id in all_node_ids:
            direct_node_ids.add(chain.root_node_id)

    if not direct_node_ids and failure_report.affected_nodes:
        for aff in failure_report.affected_nodes:
            if aff.node_id in all_node_ids and (
                aff.status.lower() in ("dead", "failed") or aff.impact_level.lower() == "critical"
            ):
                direct_node_ids.add(aff.node_id)
        if not direct_node_ids and failure_report.affected_nodes:
            direct_node_ids.add(failure_report.affected_nodes[0].node_id)

    # 2. All affected nodes
    affected_node_ids: Set[str] = set(direct_node_ids)
    for aff in failure_report.affected_nodes:
        if aff.node_id in all_node_ids:
            affected_node_ids.add(aff.node_id)

    for chain in failure_report.failure_chains:
        for step in chain.steps:
            if step.target_node_id in all_node_ids:
                affected_node_ids.add(step.target_node_id)

    cascaded_node_ids = affected_node_ids - direct_node_ids
    unaffected_node_ids = all_node_ids - affected_node_ids

    # 3. Max cascade depth
    max_depth = 0
    if failure_report.failure_chains:
        for chain in failure_report.failure_chains:
            max_depth = max(max_depth, len(chain.steps))
    elif cascaded_node_ids:
        max_depth = 1

    if failure_report.diagnostics and failure_report.diagnostics.propagation:
        diag_depth = failure_report.diagnostics.propagation.get("depth_reached", 0)
        max_depth = max(max_depth, diag_depth)

    # 4. Critical services impacted (gateways, databases, or high centrality)
    critical_services: List[str] = []
    G = to_networkx(graph)
    spofs = set(find_single_points_of_failure(G))

    for n_id in affected_node_ids:
        node = node_map.get(n_id)
        if node:
            n_type = node.type.value if hasattr(node.type, "value") else str(node.type)
            if n_type in ("gateway", "database") or n_id in spofs:
                critical_services.append(n_id)

    blast_radius_pct = round((len(affected_node_ids) / total_nodes) * 100.0, 2)

    # 5. Impact Level
    if blast_radius_pct >= 60.0 or any(node_map.get(n_id, None) and getattr(node_map[n_id], "type", "") == "gateway" for n_id in direct_node_ids):
        impact_level = "critical"
    elif blast_radius_pct >= 35.0 or len(critical_services) >= 2:
        impact_level = "high"
    elif blast_radius_pct >= 15.0 or len(cascaded_node_ids) > 0:
        impact_level = "medium"
    else:
        impact_level = "low"

    return BlastRadiusMetrics(
        total_nodes=total_nodes,
        affected_nodes_count=len(affected_node_ids),
        direct_failure_count=len(direct_node_ids),
        cascaded_failure_count=len(cascaded_node_ids),
        blast_radius_pct=blast_radius_pct,
        direct_node_ids=sorted(list(direct_node_ids)),
        cascaded_node_ids=sorted(list(cascaded_node_ids)),
        unaffected_node_ids=sorted(list(unaffected_node_ids)),
        impact_level=impact_level,
        max_cascade_depth=max_depth,
        critical_services_impacted=sorted(list(set(critical_services))),
    )


def calculate_resilience_score(
    graph: DigitalTwinSchema,
    failure_report: FailureAnalysisReportInput,
    blast_radius: Optional[BlastRadiusMetrics] = None,
) -> ResilienceScoreReport:
    """Calculate multi-factor resilience score and risk assessment report.

    Args:
        graph: The architecture graph.
        failure_report: Person 2 failure analysis report.
        blast_radius: Optional precalculated blast radius metrics.

    Returns:
        ResilienceScoreReport with overall score (0-100), breakdown, grade, and recommendations.
    """
    if blast_radius is None:
        blast_radius = calculate_blast_radius(graph, failure_report)

    risk_factors: List[str] = []
    strengths: List[str] = []
    recommendations: List[str] = []

    # --- 1. Cascading Resistance Sub-score (0-100) ---
    cascading_score = 100.0
    if blast_radius.total_nodes > 0:
        cascade_ratio = blast_radius.cascaded_failure_count / blast_radius.total_nodes
        cascading_score -= cascade_ratio * 60.0

    if blast_radius.max_cascade_depth > 1:
        cascading_score -= (blast_radius.max_cascade_depth - 1) * 15.0
        risk_factors.append(f"Deep failure cascade detected (depth {blast_radius.max_cascade_depth}).")
    elif blast_radius.cascaded_failure_count == 0:
        strengths.append("Zero cascading spread beyond seed failure point.")

    cascading_score = max(0.0, min(100.0, cascading_score))

    # --- 2. Fault Isolation Sub-score (0-100) ---
    isolation_score = 100.0
    vulnerability_types = [rc.vulnerability_type for rc in failure_report.root_causes]

    if "missing_circuit_breaker" in vulnerability_types:
        isolation_score -= 30.0
        risk_factors.append("Missing circuit breakers allow cascading thread exhaustion.")
        recommendations.append("Wrap inter-service remote calls with circuit breakers (e.g. opossum / pybreaker).")

    if "unbounded_connection_pool" in vulnerability_types:
        isolation_score -= 25.0
        risk_factors.append("Unbounded connection pools risk resource starvation during upstream stalls.")
        recommendations.append("Apply bulkhead isolation and cap connection pool sizes.")

    if "infinite_retry_without_jitter" in vulnerability_types:
        isolation_score -= 20.0
        risk_factors.append("Unthrottled retries can amplify outages via retry storms.")
        recommendations.append("Configure exponential backoff with randomized full jitter.")

    if not vulnerability_types:
        strengths.append("No critical fault isolation vulnerabilities identified.")

    isolation_score = max(0.0, min(100.0, isolation_score))

    # --- 3. Graceful Degradation Sub-score (0-100) ---
    degradation_score = 100.0
    if "missing_fallback" in vulnerability_types:
        degradation_score -= 35.0
        risk_factors.append("Services lack fallback paths when dependencies are unavailable.")
        recommendations.append("Implement stale-while-revalidate local cache fallbacks.")

    avg_error_rate = 0.0
    if failure_report.affected_nodes:
        avg_error_rate = sum(a.error_rate_estimate for a in failure_report.affected_nodes) / len(failure_report.affected_nodes)
        degradation_score -= avg_error_rate * 40.0

    if degradation_score >= 80.0:
        strengths.append("High tolerance for graceful partial degradation.")

    degradation_score = max(0.0, min(100.0, degradation_score))

    # --- 4. Recovery Efficiency Sub-score (0-100) ---
    recovery_score = 70.0
    recovering_count = sum(1 for a in failure_report.affected_nodes if a.recovering)
    if failure_report.affected_nodes:
        recovery_ratio = recovering_count / len(failure_report.affected_nodes)
        recovery_score += recovery_ratio * 30.0
        if recovery_ratio > 0.5:
            strengths.append("Automated self-healing capable across majority of affected components.")
        else:
            risk_factors.append("Limited self-healing capabilities; manual intervention required.")
            recommendations.append("Implement automated health-check reconcilers and circuit auto-reset.")
    else:
        recovery_score = 100.0

    if failure_report.diagnostics and failure_report.diagnostics.recovery:
        if not failure_report.diagnostics.recovery.get("self_healing_capable", False):
            recovery_score -= 20.0

    recovery_score = max(0.0, min(100.0, recovery_score))

    # --- 5. Overall Weighted Resilience Score ---
    raw_score = (
        0.30 * cascading_score
        + 0.30 * isolation_score
        + 0.20 * degradation_score
        + 0.20 * recovery_score
    )

    # Blast radius penalty multiplier
    blast_penalty_multiplier = max(0.2, 1.0 - (blast_radius.blast_radius_pct / 100.0) * 0.45)
    overall_score = round(max(0.0, min(100.0, raw_score * blast_penalty_multiplier)), 1)

    # Letter Grade Assignment
    if overall_score >= 90.0:
        letter_grade = "A+"
    elif overall_score >= 80.0:
        letter_grade = "A"
    elif overall_score >= 70.0:
        letter_grade = "B"
    elif overall_score >= 55.0:
        letter_grade = "C"
    elif overall_score >= 40.0:
        letter_grade = "D"
    else:
        letter_grade = "F"

    breakdown = ResilienceBreakdown(
        cascading_resistance=round(cascading_score, 1),
        fault_isolation=round(isolation_score, 1),
        graceful_degradation=round(degradation_score, 1),
        recovery_efficiency=round(recovery_score, 1),
    )

    return ResilienceScoreReport(
        overall_resilience_score=overall_score,
        letter_grade=letter_grade,
        breakdown=breakdown,
        blast_radius=blast_radius,
        risk_factors=risk_factors,
        strengths=strengths,
        remediation_recommendations=recommendations,
    )
