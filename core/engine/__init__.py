"""Public entrypoint for core/engine (Person 3 — Simulation Engine & Blast Radius).

Provides deterministic failure timeline simulation, resilience scoring,
blast-radius metrics, and rerun delta comparisons.
"""

from .delta import compare_runs
from .engine import SimulationEngine, default_engine
from .graph_loader import (
    calculate_node_centrality,
    find_single_points_of_failure,
    get_downstream_dependencies,
    get_upstream_callers,
    load_digital_twin,
    to_networkx,
)
from .models import (
    AffectedNodeInput,
    BlastRadiusMetrics,
    DeltaComparisonReport,
    FailureAnalysisReportInput,
    FailureChainInput,
    FailurePropagationStepInput,
    ResilienceBreakdown,
    ResilienceScoreReport,
    RootCauseInput,
    SimulationRunResult,
    SimulationTick,
    SuggestedPatchInput,
    TimelineEdgeState,
    TimelineNodeState,
)
from .patcher import apply_resilience_patches, build_patched_failure_report
from .scorer import calculate_blast_radius, calculate_resilience_score
from .store import SimulationStore, default_store
from .timeline import generate_timeline

__all__ = [
    "SimulationEngine",
    "default_engine",
    "load_digital_twin",
    "to_networkx",
    "get_upstream_callers",
    "get_downstream_dependencies",
    "find_single_points_of_failure",
    "calculate_node_centrality",
    "generate_timeline",
    "calculate_blast_radius",
    "calculate_resilience_score",
    "apply_resilience_patches",
    "build_patched_failure_report",
    "compare_runs",
    "SimulationStore",
    "default_store",
    "SimulationRunResult",
    "SimulationTick",
    "TimelineNodeState",
    "TimelineEdgeState",
    "BlastRadiusMetrics",
    "ResilienceScoreReport",
    "ResilienceBreakdown",
    "DeltaComparisonReport",
    "FailureAnalysisReportInput",
    "AffectedNodeInput",
    "FailureChainInput",
    "FailurePropagationStepInput",
    "RootCauseInput",
    "SuggestedPatchInput",
]
