"""Public entrypoint for core/parser."""

from __future__ import annotations

import argparse
import os

from . import infra_parser
from .ast_parser import extract_service_dependencies
from .errors import MissingFileError
from .graph_builder import GraphBuilder, validate_graph
from .models import DigitalTwinSchema


def parse_repository(repo_path: str, strict: bool = False) -> DigitalTwinSchema:
    if not os.path.isdir(repo_path):
        raise MissingFileError(repo_path, context="repo_path is not a directory")

    builder = GraphBuilder(repo_path)

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
    repo_path: str, output_path: str | None = None, strict: bool = False
) -> str:
    schema = parse_repository(repo_path, strict=strict)
    payload = schema.to_json()

    if output_path is not None:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(payload)

    return payload


def main() -> None:
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
