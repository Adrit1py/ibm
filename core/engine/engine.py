"""Top-level Simulation Engine orchestrator for Person 3."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from shared.types.digital_twin import DigitalTwinSchema
from .delta import compare_runs
from .graph_loader import load_digital_twin
from .models import (
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
    def __init__(self, store: SimulationStore | None = None):
        self.store = store or default_store

    def run(
        self,
        graph_input: str | dict | DigitalTwinSchema,
        report_input: dict | FailureAnalysisReportInput,
        run_id: str | None = None,
        is_patched: bool = False,
    ) -> SimulationRunResult:
        graph = load_digital_twin(graph_input)
        if isinstance(report_input, dict):
            failure_report = FailureAnalysisReportInput.model_validate(report_input)
        else:
            failure_report = report_input

        current_run_id = run_id or f"run_{uuid.uuid4().hex[:8]}"
        scenario_id = f"sc_{abs(hash(failure_report.scenario_prompt)) % 100000:05d}"
        now_iso = datetime.now(timezone.utc).isoformat()

        timeline = generate_timeline(graph, failure_report)
        blast_radius = calculate_blast_radius(graph, failure_report, timeline=timeline)
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
        graph_input: str | dict | DigitalTwinSchema,
        report_input: dict | FailureAnalysisReportInput,
        custom_patches: list[SuggestedPatchInput] | None = None,
    ) -> tuple[SimulationRunResult, SimulationRunResult, DeltaComparisonReport]:
        graph = load_digital_twin(graph_input)
        if isinstance(report_input, dict):
            report = FailureAnalysisReportInput.model_validate(report_input)
        else:
            report = report_input

        baseline_result = self.run(graph, report, is_patched=False)
        patches_to_apply = custom_patches or report.suggested_patches
        patched_graph = apply_resilience_patches(graph, patches_to_apply)
        patched_report = build_patched_failure_report(report, patched_graph)
        patched_result = self.run(patched_graph, patched_report, is_patched=True)

        delta = compare_runs(baseline_result, patched_result)
        self.store.save_delta(delta)

        return baseline_result, patched_result, delta

    def score_only(
        self,
        graph_input: str | dict | DigitalTwinSchema,
        report_input: dict | FailureAnalysisReportInput,
    ) -> ResilienceScoreReport:
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
        delta = compare_runs(baseline_result, patched_result)
        self.store.save_delta(delta)
        return delta


default_engine = SimulationEngine()
