"""Context Formatter for LLMs."""

from __future__ import annotations

from collections import defaultdict

from .models import DigitalTwinSchema, GraphEdge, GraphNode


def _format_node_line(node: GraphNode) -> str:
    lang = f" [{node.language}]" if node.language else ""
    return f"- {node.id} ({node.type.value if hasattr(node.type, 'value') else node.type}){lang}"


def _format_edge_line(edge: GraphEdge) -> str:
    parts = [f"{edge.source} -> {edge.target} :: {edge.type.value if hasattr(edge.type, 'value') else edge.type}"]
    if edge.timeout_ms is not None:
        parts.append(f"timeout={edge.timeout_ms}ms")
    if edge.retry_policy is not None and edge.retry_policy.max_attempts is not None:
        parts.append(f"retries={edge.retry_policy.max_attempts}")
    return "  * " + " | ".join(parts)


def format_for_llm(schema: DigitalTwinSchema, max_edges: int | None = None) -> str:
    lines: list[str] = []
    lines.append(f"# digital_twin schema_version={schema.schema_version} repo={schema.repo_path}")
    lines.append(f"# nodes={len(schema.nodes)} edges={len(schema.edges)}")
    if schema.warnings:
        lines.append(f"# warnings={len(schema.warnings)} (see full JSON for details)")

    lines.append("nodes:")
    for node in schema.nodes:
        lines.append(_format_node_line(node))

    edges = schema.edges
    if max_edges is not None and len(edges) > max_edges:
        edges = sorted(
            edges,
            key=lambda e: (e.timeout_ms is None, e.retry_policy is None),
        )[:max_edges]
        lines.append(f"edges: (showing {max_edges} of {len(schema.edges)}, prioritized by resilience-relevant metadata)")
    else:
        lines.append("edges:")

    for edge in edges:
        lines.append(_format_edge_line(edge))

    return "\n".join(lines)


def summarize_by_type(schema: DigitalTwinSchema) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for node in schema.nodes:
        key = node.type.value if hasattr(node.type, "value") else node.type
        counts[key] += 1
    return dict(counts)
