"""Thread-safe in-memory and disk-backed store for Person 3 simulation runs and metrics."""

from __future__ import annotations

from pathlib import Path
from threading import Lock

from .models import DeltaComparisonReport, SimulationRunResult


class SimulationStore:
    def __init__(self, storage_dir: Path | None = None):
        self._lock = Lock()
        self._runs: dict[str, SimulationRunResult] = {}
        self._deltas: dict[str, DeltaComparisonReport] = {}
        self._storage_dir = Path(storage_dir) if storage_dir else None
        if self._storage_dir:
            self._storage_dir.mkdir(parents=True, exist_ok=True)

    def save_run(self, run: SimulationRunResult) -> None:
        with self._lock:
            self._runs[run.run_id] = run
            if self._storage_dir:
                file_path = self._storage_dir / f"run_{run.run_id}.json"
                file_path.write_text(run.model_dump_json(indent=2), encoding="utf-8")

    def get_run(self, run_id: str) -> SimulationRunResult | None:
        with self._lock:
            return self._runs.get(run_id)

    def list_runs(self) -> list[SimulationRunResult]:
        with self._lock:
            return list(self._runs.values())

    def save_delta(self, delta: DeltaComparisonReport) -> None:
        with self._lock:
            key = f"{delta.baseline_run_id}_vs_{delta.patched_run_id}"
            self._deltas[key] = delta
            self._deltas[delta.scenario_id] = delta
            if self._storage_dir:
                file_path = self._storage_dir / f"delta_{key}.json"
                file_path.write_text(delta.model_dump_json(indent=2), encoding="utf-8")

    def get_delta(self, key: str) -> DeltaComparisonReport | None:
        with self._lock:
            return self._deltas.get(key)

    def clear(self) -> None:
        with self._lock:
            self._runs.clear()
            self._deltas.clear()


default_store = SimulationStore()
