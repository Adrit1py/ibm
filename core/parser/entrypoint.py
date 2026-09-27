"""Public entrypoint for core/parser.

parse_repository() is the ONLY function other pillars (agents, engine,
web) should ever call from this module — and even then, only indirectly
via shared/types/parser.py + the exported JSON, never by importing
core/parser internals directly (see project SHARED CONTRACT rule).

Also runnable as a CLI, for callers that shell out to it (e.g.
core/agents/src/cli.ts and the web app's /api/analyze route):

    python3 core/parser/entrypoint.py --target <repo_dir> --output <graph.json>
"""

from __future__ import annotations

import argparse
import os
from typing import Optional

from . import infra_parser
from .ast_parser import extract_service_dependencies
from .errors import MissingFileError
from .graph_builder import GraphBuilder, validate_graph
from .models import DigitalTwinSchema


def parse_repository(repo_path: str, strict: bool = False) -> DigitalTwinSchema:
    """Ingest a target project directory and produce a DigitalTwinSchema.

    Args:
        repo_path: path to the root of the project to analyze. Must exist
            and be a directory.
        strict: if True, raise EmptyGraphError when nothing could be
            extracted at all (see graph_builder.validate_graph). Default
            False: an empty/unrecognized repo returns a schema with an
            empty node list plus warnings, rather than hard-failing —
            callers decide what "no result" means for them.

    Returns:
        A fully-populated, validated DigitalTwinSchema.

    Raises:
        MissingFileError: repo_path does not exist or is not a directory.
        EmptyGraphError: only if strict=True and zero nodes were found.
    """
    if not os.path.isdir(repo_path):
        raise MissingFileError(repo_path, context="repo_path is not a directory")

    builder = GraphBuilder(repo_path)

    # --- Infra & config analysis ---
    for compose_path in infra_parser.find_compose_files(repo_path):
        nodes, edges, warnings = infra_parser.parse_docker_compose(compose_path, repo_path)
        builder.add_nodes(nodes)
        builder.add_edges(edges)
        builder.add_warnings(warnings)

    k8s_dir_candidates = [
        os.path.join(repo_path, "k8s"),
        os.path.join(repo_path, "kubernetes"),
        os.path.join(repo_path, "manifests"),
    ]
    for k8s_dir in k8s_dir_candidates:
        if os.path.isdir(k8s_dir):
            nodes, edges, warnings = infra_parser.parse_k8s_manifests(k8s_dir, repo_path)
            builder.add_nodes(nodes)
            builder.add_edges(edges)
            builder.add_warnings(warnings)

    # --- Repository ingestion & AST parsing ---
    nodes, edges, warnings = extract_service_dependencies(repo_path)
    builder.add_nodes(nodes)
    builder.add_edges(edges)
    builder.add_warnings(warnings)

    schema = builder.build()

    extra_warnings = validate_graph(schema, strict=strict)
    if extra_warnings:
        schema.warnings.extend(extra_warnings)

    return schema


def parse_repository_to_json(
    repo_path: str, output_path: Optional[str] = None, strict: bool = False
) -> str:
    """Convenience wrapper: parse_repository() + serialize to JSON.

    If output_path is given, also writes the JSON to disk (creating
    parent directories as needed) and still returns the JSON string.
    """
    schema = parse_repository(repo_path, strict=strict)
    payload = schema.to_json()

    if output_path is not None:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(payload)

    return payload


def main() -> None:
    """CLI wrapper so external callers (cli.ts, web /api/analyze) can shell
    out to this file directly, e.g.:

        python3 core/parser/entrypoint.py --target <repo_dir> --output <graph.json>
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True, help="Target repository directory")
    parser.add_argument("--output", required=True, help="Output JSON file path")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Raise an error instead of returning an empty graph when nothing could be extracted",
    )
    args = parser.parse_args()

    print(f"Parsing repository at {args.target}...")
    parse_repository_to_json(args.target, output_path=args.output, strict=args.strict)
    print(f"DigitalTwinSchema successfully written to {args.output}")


if __name__ == "__main__":
    main()
