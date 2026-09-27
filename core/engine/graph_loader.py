"""Graph loader and topology analysis utilities for Person 3."""

from __future__ import annotations

import json
from pathlib import Path

import networkx as nx

from shared.types.digital_twin import DigitalTwinSchema


def load_digital_twin(source: str | Path | dict | DigitalTwinSchema) -> DigitalTwinSchema:
    if isinstance(source, DigitalTwinSchema):
        return source

    if isinstance(source, dict):
        return DigitalTwinSchema.model_validate(source)

    if isinstance(source, (str, Path)):
        path = Path(source)
        if path.exists() and path.is_file():
            text = path.read_text(encoding="utf-8")
            data = json.loads(text)
            return DigitalTwinSchema.model_validate(data)
        if isinstance(source, str) and source.strip().startswith("{"):
            data = json.loads(source)
            return DigitalTwinSchema.model_validate(data)
        raise FileNotFoundError(f"Digital twin file not found at: {source}")

    raise ValueError(f"Unsupported source type for digital twin: {type(source)}")


def to_networkx(graph: DigitalTwinSchema) -> nx.DiGraph:
    G = nx.DiGraph()

    for node in graph.nodes:
        G.add_node(
            node.id,
            id=node.id,
            name=node.name,
            type=node.type.value if hasattr(node.type, "value") else str(node.type),
            language=node.language,
            metadata=node.metadata or {},
            model=node,
        )

    for edge in graph.edges:
        if edge.source in G and edge.target in G:
            G.add_edge(
                edge.source,
                edge.target,
                id=f"{edge.source}->{edge.target}",
                type=edge.type.value if hasattr(edge.type, "value") else str(edge.type),
                timeout_ms=edge.timeout_ms,
                retry_policy=edge.retry_policy,
                metadata=edge.metadata or {},
                model=edge,
            )

    return G


def get_upstream_callers(
    G: nx.DiGraph, target_node_id: str, max_depth: int = 10
) -> dict[str, int]:
    if target_node_id not in G:
        return {}

    upstream_depths: dict[str, int] = {}
    visited: set[str] = {target_node_id}
    queue: list[tuple[str, int]] = [(target_node_id, 0)]

    while queue:
        current_id, depth = queue.pop(0)
        if depth >= max_depth:
            continue

        for pred_id in G.predecessors(current_id):
            if pred_id not in visited:
                visited.add(pred_id)
                upstream_depths[pred_id] = depth + 1
                queue.append((pred_id, depth + 1))

    return upstream_depths


def get_downstream_dependencies(
    G: nx.DiGraph, source_node_id: str, max_depth: int = 10
) -> dict[str, int]:
    if source_node_id not in G:
        return {}

    downstream_depths: dict[str, int] = {}
    visited: set[str] = {source_node_id}
    queue: list[tuple[str, int]] = [(source_node_id, 0)]

    while queue:
        current_id, depth = queue.pop(0)
        if depth >= max_depth:
            continue

        for succ_id in G.successors(current_id):
            if succ_id not in visited:
                visited.add(succ_id)
                downstream_depths[succ_id] = depth + 1
                queue.append((succ_id, depth + 1))

    return downstream_depths


def find_single_points_of_failure(G: nx.DiGraph) -> list[str]:
    spofs: list[str] = []
    if len(G) < 3:
        return spofs

    UG = G.to_undirected()
    try:
        articulation_points = list(nx.articulation_points(UG))
        spofs.extend(articulation_points)
    except Exception:
        pass

    num_nodes = len(G)
    for node_id in G.nodes:
        in_deg = G.in_degree(node_id)
        if in_deg >= max(2, int(num_nodes * 0.4)) and node_id not in spofs:
            spofs.append(node_id)

    return spofs


def calculate_node_centrality(G: nx.DiGraph) -> dict[str, float]:
    if not G.nodes:
        return {}

    try:
        betweenness = nx.betweenness_centrality(G)
        in_degree = nx.in_degree_centrality(G)
        out_degree = nx.out_degree_centrality(G)

        combined: dict[str, float] = {}
        for n in G.nodes:
            combined[n] = round(
                0.5 * in_degree.get(n, 0.0) + 0.3 * betweenness.get(n, 0.0) + 0.2 * out_degree.get(n, 0.0),
                4,
            )
        return combined
    except Exception:
        return {n: 0.0 for n in G.nodes}
