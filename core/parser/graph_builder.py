"""Architecture Graph Builder."""

from __future__ import annotations

from .errors import EmptyGraphError
from .models import DigitalTwinSchema, GraphEdge, GraphNode


class GraphBuilder:
    def __init__(self, repo_path: str):
        self._repo_path = repo_path
        self._nodes: dict[str, GraphNode] = {}
        self._edges: dict[tuple, GraphEdge] = {}
        self._warnings: list[str] = []

    def add_node(self, node: GraphNode) -> None:
        existing = self._nodes.get(node.id)
        if existing is None:
            self._nodes[node.id] = node
            return
        merged_files = sorted(set(existing.source_files) | set(node.source_files))
        merged_meta = {**existing.metadata, **node.metadata}
        existing.source_files = merged_files
        existing.metadata = merged_meta
        if existing.language is None and node.language is not None:
            existing.language = node.language

    def add_edge(self, edge: GraphEdge) -> None:
        key = (edge.source, edge.target, edge.type.value if hasattr(edge.type, "value") else edge.type)
        existing = self._edges.get(key)
        if existing is None:
            self._edges[key] = edge
            return
        merged_files = sorted(set(existing.source_files) | set(edge.source_files))
        merged_meta = {**existing.metadata, **edge.metadata}
        existing.source_files = merged_files
        existing.metadata = merged_meta
        if existing.timeout_ms is None and edge.timeout_ms is not None:
            existing.timeout_ms = edge.timeout_ms
        if existing.retry_policy is None and edge.retry_policy is not None:
            existing.retry_policy = edge.retry_policy

    def add_nodes(self, nodes: list[GraphNode]) -> None:
        for n in nodes:
            self.add_node(n)

    def add_edges(self, edges: list[GraphEdge]) -> None:
        for e in edges:
            self.add_edge(e)

    def add_warning(self, message: str) -> None:
        self._warnings.append(message)

    def add_warnings(self, messages: list[str]) -> None:
        self._warnings.extend(messages)

    def _drop_dangling_edges(self) -> None:
        valid_ids = set(self._nodes.keys())
        kept: dict[tuple, GraphEdge] = {}
        for key, edge in self._edges.items():
            if edge.source not in valid_ids or edge.target not in valid_ids:
                self._warnings.append(
                    f"dropped edge {edge.source} -> {edge.target} "
                    f"({'source' if edge.source not in valid_ids else 'target'} node not found)"
                )
                continue
            kept[key] = edge
        self._edges = kept

    def build(self) -> DigitalTwinSchema:
        self._drop_dangling_edges()
        return DigitalTwinSchema(
            repo_path=self._repo_path,
            nodes=list(self._nodes.values()),
            edges=list(self._edges.values()),
            warnings=list(self._warnings),
        )


def validate_graph(schema: DigitalTwinSchema, strict: bool = False) -> list[str]:
    problems: list[str] = []

    if not schema.nodes:
        if strict:
            raise EmptyGraphError(schema.repo_path)
        problems.append("graph has zero nodes")

    node_ids = {n.id for n in schema.nodes}
    duplicate_check: dict[str, int] = {}
    for n in schema.nodes:
        duplicate_check[n.id] = duplicate_check.get(n.id, 0) + 1
    for node_id, count in duplicate_check.items():
        if count > 1:
            problems.append(f"duplicate node id after build(): {node_id!r} (x{count})")

    for e in schema.edges:
        if e.source not in node_ids or e.target not in node_ids:
            problems.append(f"edge references unknown node: {e.source} -> {e.target}")

    return problems
