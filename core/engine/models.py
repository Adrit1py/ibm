"""Data models and type definitions for Person 3 — Simulation Engine & Blast Radius.

Defines schemas for failure reports, timeline ticks, blast-radius metrics,
resilience scoring, and delta comparisons.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Health & Status Enumerations
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Person 2 Failure Report Input Types
# ---------------------------------------------------------------------------

class AffectedNodeInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    node_id: str
    node_name: Optional[str] = None
    status: str = "failing"
    impact_level: str = "high"
    failure_reason: Optional[str] = None
    latency_impact_multiplier: float = 1.0
    error_rate_estimate: float = 0.0
    recovering: bool = False


class FailurePropagationStepInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    step_order: int = 1
    source_node_id: str
    target_node_id: str
    edge_protocol: Optional[str] = "http"
    mechanism: str = "direct_dependency_loss"
    description: Optional[str] = None
    elapsed_ms_estimate: int = 250


class FailureChainInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    chain_id: str
    trigger_event: Optional[str] = None
    root_node_id: str
    steps: List[FailurePropagationStepInput] = Field(default_factory=list)
    cascading_blast_radius: int = 1


class RootCauseInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    node_id: str
    vulnerability_type: str
    description: str
    severity: str = "medium"
    file_target: Optional[str] = None
    code_reference: Optional[str] = None


class SuggestedPatchInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    root_cause_id: Optional[str] = None
    target_node_id: str
    target_file: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    resilience_pattern: Optional[str] = None
    diff: str = ""
    estimated_blast_radius_reduction_pct: float = 50.0


class SubagentDiagnosticsInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    propagation: Optional[Dict[str, Any]] = None
    bottleneck: Optional[Dict[str, Any]] = None
    recovery: Optional[Dict[str, Any]] = None


class FailureAnalysisReportInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    scenario_prompt: str
    analyzed_at: Optional[str] = None
    affected_nodes: List[AffectedNodeInput] = Field(default_factory=list)
    failure_chains: List[FailureChainInput] = Field(default_factory=list)
    root_causes: List[RootCauseInput] = Field(default_factory=list)
    suggested_patches: List[SuggestedPatchInput] = Field(default_factory=list)
    diagnostics: Optional[SubagentDiagnosticsInput] = None


# ---------------------------------------------------------------------------
# Person 3 Engine Output Types — Timeline & State Ticks
# ---------------------------------------------------------------------------

class TimelineNodeState(BaseModel):
    """Component state snapshot at a specific point in the failure timeline."""
    id: str
    name: str
    type: str = "service"
    status: str = "healthy"  # healthy | degraded | failing | dead | recovering
    latency_multiplier: float = 1.0
    error_rate: float = 0.0
    is_failing: bool = False
    recovering: bool = False
    failure_reason: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TimelineEdgeState(BaseModel):
    """Dependency edge state snapshot at a specific point in the failure timeline."""
    id: str
    source: str
    target: str
    type: str = "sync"
    is_failing: bool = False
    latency_ms: Optional[int] = None
    mechanism: Optional[str] = None


class SimulationTick(BaseModel):
    """Discrete time frame representing state of the whole system."""
    time_offset_sec: float = Field(..., alias="timeOffsetSec")
    nodes: List[TimelineNodeState]
    edges: List[TimelineEdgeState]
    agent_logs: List[str] = Field(default_factory=list, alias="agentLogs")
    summary: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


# ---------------------------------------------------------------------------
# Blast Radius & Resilience Metrics
# ---------------------------------------------------------------------------

class BlastRadiusMetrics(BaseModel):
    """Detailed blast-radius impact analysis."""
    total_nodes: int
    affected_nodes_count: int
    direct_failure_count: int
    cascaded_failure_count: int
    blast_radius_pct: float
    direct_node_ids: List[str]
    cascaded_node_ids: List[str]
    unaffected_node_ids: List[str]
    impact_level: str  # low | medium | high | critical
    max_cascade_depth: int
    critical_services_impacted: List[str] = Field(default_factory=list)


class ResilienceBreakdown(BaseModel):
    """Sub-scores contributing to overall resilience score."""
    cascading_resistance: float = Field(description="Score 0-100: Resistance to multi-hop cascade propagation")
    fault_isolation: float = Field(description="Score 0-100: Presence of circuit breakers and bulkheads")
    graceful_degradation: float = Field(description="Score 0-100: Fallback caches and non-fatal degradation")
    recovery_efficiency: float = Field(description="Score 0-100: Self-healing speed and barrier absence")


class ResilienceScoreReport(BaseModel):
    """Comprehensive resilience score and risk assessment."""
    overall_resilience_score: float = Field(description="Normalized 0-100 overall resilience score")
    letter_grade: str = Field(description="Letter grade (A+, A, B, C, D, F)")
    breakdown: ResilienceBreakdown
    blast_radius: BlastRadiusMetrics
    risk_factors: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    remediation_recommendations: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Rerun / Delta Comparator
# ---------------------------------------------------------------------------

class DeltaComparisonReport(BaseModel):
    """Quantitative before-and-after comparison between baseline and patched runs."""
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
    saved_node_ids: List[str]
    still_affected_node_ids: List[str]
    severed_chain_ids: List[str]
    baseline_max_latency_multiplier: float
    patched_max_latency_multiplier: float
    latency_reduction_pct: float
    baseline_avg_error_rate: float
    patched_avg_error_rate: float
    error_rate_reduction_pct: float
    patches_applied: List[str]
    executive_summary: str


# ---------------------------------------------------------------------------
# Complete Simulation Run Output
# ---------------------------------------------------------------------------

class SimulationRunResult(BaseModel):
    """Top-level immutable payload for a simulation run."""
    run_id: str
    scenario_id: str
    scenario_prompt: str
    executed_at: str
    is_patched_run: bool = False
    node_count: int
    edge_count: int
    timeline: List[SimulationTick]
    blast_radius: BlastRadiusMetrics
    resilience_score: ResilienceScoreReport
    suggested_patches: List[SuggestedPatchInput] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
