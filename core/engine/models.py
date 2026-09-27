"""Data models and type definitions for Person 3 — Simulation Engine & Blast Radius."""

from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class EngineComponentStatus(str, Enum):
    healthy = "healthy"
    degraded = "degraded"
    failing = "failing"
    dead = "dead"
    failed = "failed"
    recovering = "recovering"


class EngineImpactLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class EngineFailureMechanism(str, Enum):
    timeout_cascade = "timeout_cascade"
    connection_pool_exhaustion = "connection_pool_exhaustion"
    unhandled_exception = "unhandled_exception"
    retry_storm = "retry_storm"
    thread_starvation = "thread_starvation"
    cache_stampede = "cache_stampede"
    direct_dependency_loss = "direct_dependency_loss"
    unknown = "unknown"


class AffectedNodeInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    node_id: str
    node_name: str | None = None
    status: str = "failing"
    impact_level: str = "high"
    failure_reason: str | None = None
    latency_impact_multiplier: float = 1.0
    error_rate_estimate: float = 0.0
    recovering: bool = False


class FailurePropagationStepInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    step_order: int = 1
    source_node_id: str
    target_node_id: str
    edge_protocol: str | None = "http"
    mechanism: str = "direct_dependency_loss"
    description: str | None = None
    elapsed_ms_estimate: int = 250


class FailureChainInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    chain_id: str
    trigger_event: str | None = None
    root_node_id: str
    steps: list[FailurePropagationStepInput] = Field(default_factory=list)
    cascading_blast_radius: int = 1


class RootCauseInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    node_id: str
    vulnerability_type: str
    description: str
    severity: str = "medium"
    file_target: str | None = None
    code_reference: str | None = None


class SuggestedPatchInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    root_cause_id: str | None = None
    target_node_id: str
    target_file: str | None = None
    title: str | None = None
    description: str | None = None
    resilience_pattern: str | None = None
    diff: str = ""
    estimated_blast_radius_reduction_pct: float = 50.0


class SubagentDiagnosticsInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    propagation: dict[str, object] | None = None
    bottleneck: dict[str, object] | None = None
    recovery: dict[str, object] | None = None


class FailureAnalysisReportInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    scenario_prompt: str
    analyzed_at: str | None = None
    affected_nodes: list[AffectedNodeInput] = Field(default_factory=list)
    failure_chains: list[FailureChainInput] = Field(default_factory=list)
    root_causes: list[RootCauseInput] = Field(default_factory=list)
    suggested_patches: list[SuggestedPatchInput] = Field(default_factory=list)
    diagnostics: SubagentDiagnosticsInput | None = None


class TimelineNodeState(BaseModel):
    id: str
    name: str
    type: str = "service"
    status: str = "healthy"
    latency_multiplier: float = 1.0
    error_rate: float = 0.0
    is_failing: bool = False
    recovering: bool = False
    failure_reason: str | None = None
    metadata: dict[str, object] = Field(default_factory=dict)


class TimelineEdgeState(BaseModel):
    id: str
    source: str
    target: str
    type: str = "sync"
    is_failing: bool = False
    latency_ms: int | None = None
    mechanism: str | None = None


class SimulationTick(BaseModel):
    time_offset_sec: float = Field(..., alias="timeOffsetSec")
    nodes: list[TimelineNodeState]
    edges: list[TimelineEdgeState]
    agent_logs: list[str] = Field(default_factory=list, alias="agentLogs")
    summary: str | None = None

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class BlastRadiusMetrics(BaseModel):
    total_nodes: int
    affected_nodes_count: int
    direct_failure_count: int
    cascaded_failure_count: int
    blast_radius_pct: float
    direct_node_ids: list[str]
    cascaded_node_ids: list[str]
    unaffected_node_ids: list[str]
    impact_level: str
    max_cascade_depth: int
    critical_services_impacted: list[str] = Field(default_factory=list)


class ResilienceBreakdown(BaseModel):
    cascading_resistance: float = Field(description="Score 0-100: Resistance to multi-hop cascade propagation")
    fault_isolation: float = Field(description="Score 0-100: Presence of circuit breakers and bulkheads")
    graceful_degradation: float = Field(description="Score 0-100: Fallback caches and non-fatal degradation")
    recovery_efficiency: float = Field(description="Score 0-100: Self-healing speed and barrier absence")


class ResilienceScoreReport(BaseModel):
    overall_resilience_score: float = Field(description="Normalized 0-100 overall resilience score")
    letter_grade: str = Field(description="Letter grade (A+, A, B, C, D, F)")
    breakdown: ResilienceBreakdown
    blast_radius: BlastRadiusMetrics
    risk_factors: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    remediation_recommendations: list[str] = Field(default_factory=list)


class DeltaComparisonReport(BaseModel):
    scenario_id: str
    scenario_prompt: str
    baseline_run_id: str
    patched_run_id: str
    baseline_resilience_score: float
    patched_resilience_score: float
    resilience_score_improvement: float
    baseline_blast_radius_pct: float
    patched_blast_radius_pct: float
    blast_radius_reduction_pct: float
    saved_node_ids: list[str]
    still_affected_node_ids: list[str]
    severed_chain_ids: list[str]
    baseline_max_latency_multiplier: float
    patched_max_latency_multiplier: float
    latency_reduction_pct: float
    baseline_avg_error_rate: float
    patched_avg_error_rate: float
    error_rate_reduction_pct: float
    patches_applied: list[str]
    executive_summary: str


class SimulationRunResult(BaseModel):
    run_id: str
    scenario_id: str
    scenario_prompt: str
    executed_at: str
    is_patched_run: bool = False
    node_count: int
    edge_count: int
    timeline: list[SimulationTick]
    blast_radius: BlastRadiusMetrics
    resilience_score: ResilienceScoreReport
    suggested_patches: list[SuggestedPatchInput] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
