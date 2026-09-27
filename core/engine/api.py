"""FastAPI JSON/Data API router for Person 3 — Simulation Engine.

Produces pure JSON timestamped data, resilience metrics, and delta comparisons.
Does NOT serve or touch any HTML/CSS/UI.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from shared.types.digital_twin import DigitalTwinSchema
from .engine import SimulationEngine, default_engine
from .models import (
    DeltaComparisonReport,
    FailureAnalysisReportInput,
    ResilienceScoreReport,
    SimulationRunResult,
    SuggestedPatchInput,
)

router = APIRouter(prefix="/api/engine", tags=["Simulation Engine"])

class SimulationRequest(BaseModel):
    graph: DigitalTwinSchema
    report: FailureAnalysisReportInput
    run_id: Optional[str] = None

class PatchAndRerunRequest(BaseModel):
    graph: DigitalTwinSchema
    report: FailureAnalysisReportInput
    custom_patches: Optional[List[SuggestedPatchInput]] = None

class PatchAndRerunResponse(BaseModel):
    baseline: SimulationRunResult
    patched: SimulationRunResult
    delta: DeltaComparisonReport

class CompareRunsRequest(BaseModel):
    baseline_run_id: Optional[str] = None
    patched_run_id: Optional[str] = None
    baseline_run: Optional[SimulationRunResult] = None
    patched_run: Optional[SimulationRunResult] = None

@router.post("/simulate", response_model=SimulationRunResult)
def simulate(req: SimulationRequest) -> SimulationRunResult:
    """Run a deterministic failure simulation and return timeline + metrics."""
    try:
        return default_engine.run(req.graph, req.report, run_id=req.run_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Simulation error: {str(e)}")

@router.post("/score", response_model=ResilienceScoreReport)
def score(req: SimulationRequest) -> ResilienceScoreReport:
    """Calculate blast radius and multi-factor resilience score report."""
    try:
        return default_engine.score_only(req.graph, req.report)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Scoring error: {str(e)}")

@router.post("/patch-and-rerun", response_model=PatchAndRerunResponse)
def patch_and_rerun(req: PatchAndRerunRequest) -> PatchAndRerunResponse:
    """Execute baseline simulation, apply patches, rerun, and produce delta comparison."""
    try:
        baseline, patched, delta = default_engine.run_with_patch(
            req.graph, req.report, custom_patches=req.custom_patches
        )
        return PatchAndRerunResponse(baseline=baseline, patched=patched, delta=delta)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Patch & rerun error: {str(e)}")

@router.post("/compare", response_model=DeltaComparisonReport)
def compare(req: CompareRunsRequest) -> DeltaComparisonReport:
    """Compare two simulation runs by ID or direct payload."""
    try:
        b_run = req.baseline_run
        p_run = req.patched_run

        if not b_run and req.baseline_run_id:
            b_run = default_engine.store.get_run(req.baseline_run_id)
        if not p_run and req.patched_run_id:
            p_run = default_engine.store.get_run(req.patched_run_id)

        if not b_run or not p_run:
            raise HTTPException(
                status_code=404,
                detail="Could not find both baseline and patched runs for comparison.",
            )

        return default_engine.compare(b_run, p_run)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Comparison error: {str(e)}")

@router.get("/runs", response_model=List[SimulationRunResult])
def list_runs() -> List[SimulationRunResult]:
    """List all stored simulation runs."""
    return default_engine.store.list_runs()

@router.get("/runs/{run_id}", response_model=SimulationRunResult)
def get_run(run_id: str) -> SimulationRunResult:
    """Retrieve a specific simulation run by ID."""
    run = default_engine.store.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return run

@router.get("/deltas/{scenario_id}", response_model=DeltaComparisonReport)
def get_delta(scenario_id: str) -> DeltaComparisonReport:
    """Retrieve a delta comparison report by scenario ID."""
    delta = default_engine.store.get_delta(scenario_id)
    if not delta:
        raise HTTPException(status_code=404, detail=f"Delta for '{scenario_id}' not found.")
    return delta

@router.get("/health")
def health() -> Dict[str, str]:
    """Engine service health probe."""
    return {"status": "ok", "service": "simulation-engine", "version": "1.0.0"}

def create_engine_app() -> FastAPI:
    """Factory to create a standalone FastAPI application for the engine."""
    app = FastAPI(
        title="IBM Bob Simulation & Blast-Radius Engine",
        description="Deterministic failure timeline, resilience scoring, and delta comparator API.",
        version="1.0.0",
    )
    
    # Enable CORS for frontend integration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # In strict production, change this to your Vercel URL
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    app.include_router(router)
    return app

# Expose app at the module level for ASGI servers (uvicorn/gunicorn)
app = create_engine_app()
