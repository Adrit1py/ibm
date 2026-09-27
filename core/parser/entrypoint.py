#!/usr/bin/env python3
import argparse
import json
import os
import glob
import re

def parse_repo(target_dir):
    """
    Very basic static analysis to infer nodes (services, db, cache) and edges
    from a repository, creating a DigitalTwinSchema.
    In a real implementation, this would use AST and package managers.
    """
    nodes = []
    edges = []

    # 1. Look for package.json (Node.js) or requirements.txt (Python)
    # 2. Look for docker-compose.yml to infer infrastructure

    # Find all source files to get a sense of services
    ts_files = glob.glob(os.path.join(target_dir, '**', '*.ts'), recursive=True)
    py_files = glob.glob(os.path.join(target_dir, '**', '*.py'), recursive=True)
    go_files = glob.glob(os.path.join(target_dir, '**', '*.go'), recursive=True)

    # Simple heuristics to create a mock graph based on actual files
    if ts_files or py_files or go_files:
        main_service_node = {
            "id": "main-service",
            "name": "Main Application Service",
            "type": "service",
            "file_path": (ts_files + py_files + go_files)[0] if (ts_files + py_files + go_files) else "unknown",
            "config": {
                "timeout_ms": 10000,
                "max_retries": 5
            }
        }
        nodes.append(main_service_node)

    # Check for docker-compose for external dependencies
    docker_compose_path = os.path.join(target_dir, 'docker-compose.yml')
    if not os.path.exists(docker_compose_path):
        docker_compose_path = os.path.join(target_dir, 'docker-compose.yaml')

    if os.path.exists(docker_compose_path):
        with open(docker_compose_path, 'r') as f:
            content = f.read()
            if 'redis' in content:
                nodes.append({
                    "id": "redis-cache",
                    "name": "Redis Cache",
                    "type": "cache",
                    "config": {"timeout_ms": 200, "pool_size": 200}
                })
                edges.append({
                    "source": "main-service",
                    "target": "redis-cache",
                    "protocol": "tcp",
                    "sync": True
                })
            if 'postgres' in content or 'mysql' in content:
                nodes.append({
                    "id": "database",
                    "name": "Primary Database",
                    "type": "database",
                    "config": {"pool_size": 100, "timeout_ms": 5000}
                })
                edges.append({
                    "source": "main-service",
                    "target": "database",
                    "protocol": "tcp",
                    "sync": True
                })

    # If nothing was found, create some basic nodes so it doesn't fail
    if not nodes:
        nodes.append({
            "id": "unknown-service",
            "name": "Unknown Service",
            "type": "service",
            "config": {}
        })

    # --- Ensure every node carries metadata.config mirroring its top-level
    # config, so both consumers agree on where resilience settings live:
    #   - core/agents (TS) reads node.config directly
    #   - core/engine (Python patcher/scorer) reads node.metadata.config
    # Without this, patch-and-rerun silently no-ops because the engine
    # never sees the circuit_breaker / fallback_enabled flags it writes.
    for node in nodes:
        config = node.get("config", {})
        metadata = node.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
        metadata["config"] = config
        node["metadata"] = metadata

    return {
        "nodes": nodes,
        "edges": edges
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', required=True, help='Target repository directory')
    parser.add_argument('--output', required=True, help='Output JSON file path')
    args = parser.parse_args()

    print(f"Parsing repository at {args.target}...")
    schema = parse_repo(args.target)

    with open(args.output, 'w') as f:
        json.dump(schema, f, indent=2)
    print(f"DigitalTwinSchema successfully written to {args.output}")

if __name__ == '__main__':
    main()
