"""FastAPI JSON/Data API router for Person 3 — Simulation Engine."""

from __future__ import annotations

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from shared.types.digital_twin import DigitalTwinSchema
from .engine import default_engine
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
    run_id: str | None = None

class PatchAndRerunRequest(BaseModel):
    graph: DigitalTwinSchema
    report: FailureAnalysisReportInput
    custom_patches: list[SuggestedPatchInput] | None = None

class PatchAndRerunResponse(BaseModel):
    baseline: SimulationRunResult
    patched: SimulationRunResult
    delta: DeltaComparisonReport

class CompareRunsRequest(BaseModel):
    baseline_run_id: str | None = None
    patched_run_id: str | None = None
    baseline_run: SimulationRunResult | None = None
    patched_run: SimulationRunResult | None = None

@router.post("/simulate", response_model=SimulationRunResult)
def simulate(req: SimulationRequest) -> SimulationRunResult:
    try:
        return default_engine.run(req.graph, req.report, run_id=req.run_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Simulation error: {str(e)}")

@router.post("/score", response_model=ResilienceScoreReport)
def score(req: SimulationRequest) -> ResilienceScoreReport:
    try:
        return default_engine.score_only(req.graph, req.report)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Scoring error: {str(e)}")

@router.post("/patch-and-rerun", response_model=PatchAndRerunResponse)
def patch_and_rerun(req: PatchAndRerunRequest) -> PatchAndRerunResponse:
    try:
        baseline, patched, delta = default_engine.run_with_patch(
            req.graph, req.report, custom_patches=req.custom_patches
        )
        return PatchAndRerunResponse(baseline=baseline, patched=patched, delta=delta)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Patch & rerun error: {str(e)}")

@router.post("/compare", response_model=DeltaComparisonReport)
def compare(req: CompareRunsRequest) -> DeltaComparisonReport:
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

@router.get("/runs", response_model=list[SimulationRunResult])
def list_runs() -> list[SimulationRunResult]:
    return default_engine.store.list_runs()

@router.get("/runs/{run_id}", response_model=SimulationRunResult)
def get_run(run_id: str) -> SimulationRunResult:
    run = default_engine.store.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return run

@router.get("/deltas/{scenario_id}", response_model=DeltaComparisonReport)
def get_delta(scenario_id: str) -> DeltaComparisonReport:
    delta = default_engine.store.get_delta(scenario_id)
    if not delta:
        raise HTTPException(status_code=404, detail=f"Delta for '{scenario_id}' not found.")
    return delta

@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "simulation-engine", "version": "1.0.0"}

def create_engine_app() -> FastAPI:
    app = FastAPI(
        title="IBM Bob Simulation & Blast-Radius Engine",
        description="Deterministic failure timeline, resilience scoring, and delta comparator API.",
        version="1.0.0",
    )
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    app.include_router(router)
    return app

app = create_engine_app()
