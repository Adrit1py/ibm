"""Deterministic failure timeline generator for Person 3.

Translates architecture graphs and failure-analysis reports into discrete,
timestamped simulation ticks modeling cascading failure propagation and recovery.
"""

from __future__ import annotations

import copy
from typing import Dict, List, Optional, Set, Tuple

from shared.types.digital_twin import DigitalTwinSchema, GraphEdge, GraphNode
from .models import (
    AffectedNodeInput,
    FailureAnalysisReportInput,
    FailureChainInput,
    SimulationTick,
    TimelineEdgeState,
    TimelineNodeState,
)


def generate_timeline(
    graph: DigitalTwinSchema,
    failure_report: FailureAnalysisReportInput,
    max_duration_sec: float = 30.0,
    tick_intervals: Optional[List[float]] = None,
) -> List[SimulationTick]:
    """Generate a deterministic multi-tick failure timeline from graph and report.

    Args:
        graph: Digital twin architecture graph.
        failure_report: Failure analysis report from Person 2 (agents).
        max_duration_sec: Total duration of the simulated scenario in seconds.
        tick_intervals: Optional explicit time offsets in seconds. Defaults to
                        [0.0, 1.0, 3.0, 5.0, 10.0, 15.0, 20.0, 30.0].

    Returns:
        Ordered list of SimulationTick objects capturing system state progression.
    """
    if tick_intervals is None:
        tick_intervals = [0.0, 1.0, 3.0, 5.0, 10.0, 15.0, 20.0, max_duration_sec]
        # Filter and sort
        tick_intervals = sorted(list(set([t for t in tick_intervals if t <= max_duration_sec])))

    # Index nodes and edges
    node_map: Dict[str, GraphNode] = {n.id: n for n in graph.nodes}
    affected_map: Dict[str, AffectedNodeInput] = {
        a.node_id: a for a in failure_report.affected_nodes
    }

    # Identify direct root failure nodes (seed nodes)
    root_node_ids: Set[str] = set()
    for chain in failure_report.failure_chains:
        if chain.root_node_id:
            root_node_ids.add(chain.root_node_id)

    # Fallback: if no chains, pick nodes with status "dead" or worst impact
    if not root_node_ids and failure_report.affected_nodes:
        for aff in failure_report.affected_nodes:
            if aff.status.lower() in ("dead", "failed") or aff.impact_level.lower() == "critical":
                root_node_ids.add(aff.node_id)
        if not root_node_ids:
            root_node_ids.add(failure_report.affected_nodes[0].node_id)

    # Precompute step propagation timings (in seconds)
    step_timings: List[Tuple[float, str, str, str, str]] = []  # (time_sec, src, target, mechanism, desc)
    for chain in failure_report.failure_chains:
        for step in chain.steps:
            timing_sec = max(1.0, step.elapsed_ms_estimate / 1000.0)
            step_timings.append((
                timing_sec,
                step.source_node_id,
                step.target_node_id,
                step.mechanism,
                step.description or f"Failure propagated from {step.source_node_id} to {step.target_node_id}",
            ))

    # Sort propagation events by time
    step_timings.sort(key=lambda x: x[0])

    timeline: List[SimulationTick] = []

    for t in tick_intervals:
        current_node_states: List[TimelineNodeState] = []
        current_edge_states: List[TimelineEdgeState] = []
        tick_logs: List[str] = []

        if t == 0.0:
            # Baseline tick: all nodes healthy
            tick_logs.append(f"[Simulation Engine] Ingested architecture graph ({len(graph.nodes)} nodes, {len(graph.edges)} edges).")
            tick_logs.append(f"[Simulation Engine] Initializing failure scenario: \"{failure_report.scenario_prompt}\"")

            for node in graph.nodes:
                current_node_states.append(TimelineNodeState(
                    id=node.id,
                    name=node.name,
                    type=node.type.value if hasattr(node.type, "value") else str(node.type),
                    status="healthy",
                    latency_multiplier=1.0,
                    error_rate=0.0,
                    is_failing=False,
                    recovering=False,
                    failure_reason=None,
                    metadata=node.metadata or {},
                ))

            for i, edge in enumerate(graph.edges):
                current_edge_states.append(TimelineEdgeState(
                    id=f"e_{edge.source}_{edge.target}_{i}",
                    source=edge.source,
                    target=edge.target,
                    type=edge.type.value if hasattr(edge.type, "value") else str(edge.type),
                    is_failing=False,
                    latency_ms=edge.timeout_ms,
                    mechanism=None,
                ))

            summary = "System in baseline healthy operational state."

        else:
            # Active failure timeline evolution
            # 1. Check which direct failures have occurred
            failing_node_ids: Set[str] = set()
            degraded_node_ids: Set[str] = set()
            recovering_node_ids: Set[str] = set()

            # Seed failures activate by T=1.0
            if t >= 1.0:
                for root_id in root_node_ids:
                    failing_node_ids.add(root_id)
                    root_name = node_map.get(root_id, None)
                    r_display = root_name.name if root_name else root_id
                    if t == 1.0:
                        tick_logs.append(f"[Simulation Engine] Direct failure triggered on seed component '{r_display}' ({root_id}).")

            # 2. Check cascade propagation steps triggered by or before time t
            for p_time, src, tgt, mech, desc in step_timings:
                if t >= p_time:
                    # Target node is affected
                    aff_info = affected_map.get(tgt)
                    tgt_node = node_map.get(tgt)
                    has_cb = False
                    has_fb = False
                    if tgt_node and tgt_node.metadata:
                        has_cb = bool(tgt_node.metadata.get("circuit_breaker") or tgt_node.metadata.get("config", {}).get("circuit_breaker"))
                        has_fb = bool(tgt_node.metadata.get("fallback_enabled") or tgt_node.metadata.get("config", {}).get("fallback_enabled"))

                    if has_cb:
                        degraded_node_ids.add(tgt)
                        if t == p_time or (t > p_time and t <= p_time + 2.0):
                            tick_logs.append(f"[Circuit Breaker] Trip threshold reached on '{tgt}'. Isolated dependency '{src}' with graceful fallback.")
                    elif has_fb:
                        degraded_node_ids.add(tgt)
                        if t == p_time:
                            tick_logs.append(f"[Fallback Cache] Node '{tgt}' activated fallback responses due to downstream outage on '{src}'.")
                    else:
                        # Full failure cascade
                        failing_node_ids.add(tgt)
                        if t == p_time or (t > p_time and t <= p_time + 2.0):
                            tick_logs.append(f"[Cascading Failure] {desc} (Mechanism: {mech})")

            # Also ensure any node marked affected in Person 2 report is reflected
            if t >= 3.0:
                for aff in failure_report.affected_nodes:
                    if aff.node_id not in failing_node_ids and aff.node_id not in degraded_node_ids:
                        if aff.status.lower() in ("dead", "failed", "failing"):
                            failing_node_ids.add(aff.node_id)
                        elif aff.status.lower() == "degraded":
                            degraded_node_ids.add(aff.node_id)

            # 3. Check recovery progression (T >= 15.0)
            if t >= 15.0:
                for aff in failure_report.affected_nodes:
                    if aff.recovering:
                        recovering_node_ids.add(aff.node_id)
                        if t == 15.0:
                            tick_logs.append(f"[Self-Healing] Node '{aff.node_name or aff.node_id}' initiated automated recovery sequence.")

            # Build node states for this tick
            for node in graph.nodes:
                aff = affected_map.get(node.id)
                if node.id in recovering_node_ids:
                    status = "recovering" if t < 25.0 else "degraded"
                    lat_mult = 1.3
                    err_rate = 0.05
                    is_fail = False
                    rec = True
                    reason = "Node recovering via auto-remediation / self-healing"
                elif node.id in failing_node_ids:
                    status = "dead" if node.id in root_node_ids else "failing"
                    lat_mult = aff.latency_impact_multiplier if aff else 8.0
                    err_rate = aff.error_rate_estimate if aff else 0.95
                    is_fail = True
                    rec = False
                    reason = aff.failure_reason if aff else f"Cascading failure from dependency"
                elif node.id in degraded_node_ids:
                    status = "degraded"
                    lat_mult = aff.latency_impact_multiplier if aff else 1.5
                    err_rate = aff.error_rate_estimate if aff else 0.15
                    is_fail = False
                    rec = False
                    reason = aff.failure_reason if aff else "Operating in degraded mode with active fallback/circuit breaker"
                else:
                    status = "healthy"
                    lat_mult = 1.0
                    err_rate = 0.0
                    is_fail = False
                    rec = False
                    reason = None

                current_node_states.append(TimelineNodeState(
                    id=node.id,
                    name=node.name,
                    type=node.type.value if hasattr(node.type, "value") else str(node.type),
                    status=status,
                    latency_multiplier=lat_mult,
                    error_rate=err_rate,
                    is_failing=is_fail,
                    recovering=rec,
                    failure_reason=reason,
                    metadata=node.metadata or {},
                ))

            # Build edge states for this tick
            failing_set = failing_node_ids
            for i, edge in enumerate(graph.edges):
                edge_failing = (edge.target in failing_set) or (edge.source in failing_set and edge.target in degraded_node_ids)
                edge_mech = None
                if edge_failing:
                    edge_mech = "timeout_cascade" if edge.type.value == "sync_call" else "retry_storm"

                current_edge_states.append(TimelineEdgeState(
                    id=f"e_{edge.source}_{edge.target}_{i}",
                    source=edge.source,
                    target=edge.target,
                    type=edge.type.value if hasattr(edge.type, "value") else str(edge.type),
                    is_failing=edge_failing,
                    latency_ms=int(edge.timeout_ms * 4) if (edge.timeout_ms and edge_failing) else edge.timeout_ms,
                    mechanism=edge_mech,
                ))

            # Summary narrative for this tick
            dead_cnt = sum(1 for n in current_node_states if n.status in ("dead", "failing"))
            deg_cnt = sum(1 for n in current_node_states if n.status in ("degraded", "recovering"))
            healthy_cnt = sum(1 for n in current_node_states if n.status == "healthy")

            summary = f"T+{t:.0f}s: {dead_cnt} failing, {deg_cnt} degraded, {healthy_cnt} healthy components."

        timeline.append(SimulationTick(
            timeOffsetSec=t,
            nodes=current_node_states,
            edges=current_edge_states,
            agentLogs=tick_logs,
            summary=summary,
        ))

    return timeline
