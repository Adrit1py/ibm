"""Top-level Simulation Engine orchestrator for Person 3.

Coordinates timeline generation, blast-radius assessment, resilience scoring,
patch application, and delta comparison.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union

from shared.types.digital_twin import DigitalTwinSchema
from .delta import compare_runs
from .graph_loader import load_digital_twin
from .models import (
    BlastRadiusMetrics,
    DeltaComparisonReport,
    FailureAnalysisReportInput,
    ResilienceScoreReport,
    SimulationRunResult,
    SuggestedPatchInput,
)
from .patcher import apply_resilience_patches, build_patched_failure_report
from .scorer import calculate_blast_radius, calculate_resilience_score
from .store import SimulationStore, default_store
from .timeline import generate_timeline


class SimulationEngine:
    """Core deterministic simulation and blast-radius engine.

    Consumes Person 1's architecture graph + Person 2's failure-analysis report.
    Produces pure timestamped data, resilience metrics, and delta comparisons.
    """

    def __init__(self, store: Optional[SimulationStore] = None):
        self.store = store or default_store

    def run(
        self,
        graph_input: Union[str, dict, DigitalTwinSchema],
        report_input: Union[dict, FailureAnalysisReportInput],
        run_id: Optional[str] = None,
        is_patched: bool = False,
    ) -> SimulationRunResult:
        """Execute a deterministic failure simulation run.

        Args:
            graph_input: Digital twin schema instance, dictionary, or file path.
            report_input: Person 2 failure analysis report instance or dictionary.
            run_id: Optional custom run identifier.
            is_patched: Whether this is a post-patch rerun.

        Returns:
            Fully populated SimulationRunResult.
        """
        # Parse inputs
        graph = load_digital_twin(graph_input)
        if isinstance(report_input, dict):
            failure_report = FailureAnalysisReportInput.model_validate(report_input)
        else:
            failure_report = report_input

        current_run_id = run_id or f"run_{uuid.uuid4().hex[:8]}"
        scenario_id = f"sc_{abs(hash(failure_report.scenario_prompt)) % 100000:05d}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Generate Deterministic Timeline
        timeline = generate_timeline(graph, failure_report)

        # 2. Compute Blast Radius Metrics
        blast_radius = calculate_blast_radius(graph, failure_report, timeline=timeline)

        # 3. Compute Multi-Factor Resilience Score Report
        resilience_score = calculate_resilience_score(graph, failure_report, blast_radius=blast_radius)

        result = SimulationRunResult(
            run_id=current_run_id,
            scenario_id=scenario_id,
            scenario_prompt=failure_report.scenario_prompt,
            executed_at=now_iso,
            is_patched_run=is_patched,
            node_count=len(graph.nodes),
            edge_count=len(graph.edges),
            timeline=timeline,
            blast_radius=blast_radius,
            resilience_score=resilience_score,
            suggested_patches=failure_report.suggested_patches,
            warnings=list(graph.warnings or []),
        )

        self.store.save_run(result)
        return result

    def run_with_patch(
        self,
        graph_input: Union[str, dict, DigitalTwinSchema],
        report_input: Union[dict, FailureAnalysisReportInput],
        custom_patches: Optional[List[SuggestedPatchInput]] = None,
    ) -> Tuple[SimulationRunResult, SimulationRunResult, DeltaComparisonReport]:
        """Execute baseline simulation, apply resilience patches, rerun, and compare delta.

        Args:
            graph_input: Initial architecture graph.
            report_input: Initial failure analysis report.
            custom_patches: Optional override for suggested patches.

        Returns:
            Tuple of (baseline_result, patched_result, delta_comparison_report).
        """
        graph = load_digital_twin(graph_input)
        if isinstance(report_input, dict):
            report = FailureAnalysisReportInput.model_validate(report_input)
        else:
            report = report_input

        # 1. Baseline Run
        baseline_result = self.run(graph, report, is_patched=False)

        # 2. Apply Patches to Graph
        patches_to_apply = custom_patches or report.suggested_patches
        patched_graph = apply_resilience_patches(graph, patches_to_apply)

        # 3. Build Patched Failure Report
        patched_report = build_patched_failure_report(report, patched_graph)

        # 4. Patched Rerun
        patched_result = self.run(patched_graph, patched_report, is_patched=True)

        # 5. Calculate Delta Comparison
        delta = compare_runs(baseline_result, patched_result)
        self.store.save_delta(delta)

        return baseline_result, patched_result, delta

    def score_only(
        self,
        graph_input: Union[str, dict, DigitalTwinSchema],
        report_input: Union[dict, FailureAnalysisReportInput],
    ) -> ResilienceScoreReport:
        """Fast-path resilience calculation without full timeline generation."""
        graph = load_digital_twin(graph_input)
        if isinstance(report_input, dict):
            report = FailureAnalysisReportInput.model_validate(report_input)
        else:
            report = report_input

        blast_radius = calculate_blast_radius(graph, report)
        return calculate_resilience_score(graph, report, blast_radius=blast_radius)

    def compare(
        self,
        baseline_result: SimulationRunResult,
        patched_result: SimulationRunResult,
    ) -> DeltaComparisonReport:
        """Compare any two simulation runs."""
        delta = compare_runs(baseline_result, patched_result)
        self.store.save_delta(delta)
        return delta


# Default global engine instance
default_engine = SimulationEngine()
