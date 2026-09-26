"""Graph loader and topology analysis utilities for Person 3.

Loads and validates DigitalTwinSchema representations and converts them into
NetworkX directed graphs for topological analysis.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import networkx as nx

from shared.types.digital_twin import DigitalTwinSchema, GraphEdge, GraphNode


def load_digital_twin(source: Union[str, Path, dict, DigitalTwinSchema]) -> DigitalTwinSchema:
    """Read and validate a DigitalTwinSchema from a file path, JSON string, dict, or instance.

    Args:
        source: File path, JSON string, dictionary, or already-instantiated DigitalTwinSchema.

    Returns:
        Validated DigitalTwinSchema model.

    Raises:
        ValueError: If input cannot be parsed or validated.
        FileNotFoundError: If path does not exist.
    """
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
        # Attempt raw JSON string parsing if not an existing file
        if isinstance(source, str) and source.strip().startswith("{"):
            data = json.loads(source)
            return DigitalTwinSchema.model_validate(data)
        raise FileNotFoundError(f"Digital twin file not found at: {source}")

    raise ValueError(f"Unsupported source type for digital twin: {type(source)}")


def to_networkx(graph: DigitalTwinSchema) -> nx.DiGraph:
    """Convert a DigitalTwinSchema into a NetworkX DiGraph.

    Nodes store:
      - 'id': str
      - 'name': str
      - 'type': str
      - 'model': GraphNode
      - 'metadata': dict

    Edges store:
      - 'source': str
      - 'target': str
      - 'type': str
      - 'timeout_ms': int | None
      - 'retry_policy': RetryPolicy | None
      - 'model': GraphEdge
      - 'metadata': dict

    Dangling edges where source or target is missing from node list are safely ignored.
    """
    G = nx.DiGraph()

    for node in graph.nodes:
        node_dict = node.model_dump() if hasattr(node, "model_dump") else dict(node)
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
) -> Dict[str, int]:
    """Find all upstream nodes that depend on (call) target_node_id, with distance/depth.

    In a call graph: caller (source) -> callee (target).
    Upstream callers are predecessors in G.
    """
    if target_node_id not in G:
        return {}

    upstream_depths: Dict[str, int] = {}
    visited: Set[str] = {target_node_id}
    queue: List[Tuple[str, int]] = [(target_node_id, 0)]

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
) -> Dict[str, int]:
    """Find all downstream nodes that source_node_id depends on, with distance/depth."""
    if source_node_id not in G:
        return {}

    downstream_depths: Dict[str, int] = {}
    visited: Set[str] = {source_node_id}
    queue: List[Tuple[str, int]] = [(source_node_id, 0)]

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


def find_single_points_of_failure(G: nx.DiGraph) -> List[str]:
    """Identify potential single points of failure (SPOFs) in the graph topology.

    A node is a topological SPOF if its removal disconnects other nodes or if
    multiple services critically depend solely on it without alternative paths.
    """
    spofs: List[str] = []
    if len(G) < 3:
        return spofs

    # Undirected projection to check articulation points (bridges/cut vertices)
    UG = G.to_undirected()
    try:
        articulation_points = list(nx.articulation_points(UG))
        spofs.extend(articulation_points)
    except Exception:
        pass

    # High in-degree bottlenecks (nodes relied upon by > 40% of services)
    num_nodes = len(G)
    for node_id in G.nodes:
        in_deg = G.in_degree(node_id)
        if in_deg >= max(2, int(num_nodes * 0.4)) and node_id not in spofs:
            spofs.append(node_id)

    return spofs


def calculate_node_centrality(G: nx.DiGraph) -> Dict[str, float]:
    """Calculate normalized degree and betweenness centrality for all nodes."""
    if not G.nodes:
        return {}

    try:
        betweenness = nx.betweenness_centrality(G)
        in_degree = nx.in_degree_centrality(G)
        out_degree = nx.out_degree_centrality(G)

        combined: Dict[str, float] = {}
        for n in G.nodes:
            # Weighted formula emphasizing in-degree dependency and betweenness transit
            combined[n] = round(
                0.5 * in_degree.get(n, 0.0) + 0.3 * betweenness.get(n, 0.0) + 0.2 * out_degree.get(n, 0.0),
                4,
            )
        return combined
    except Exception:
        return {n: 0.0 for n in G.nodes}
