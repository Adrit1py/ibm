"""Infrastructure & Config Analysis.

Parses Docker Compose files and Kubernetes manifests to extract network
boundaries, service topology, timeout defaults, and retry policies.
"""

from __future__ import annotations

import glob
import os
import re

import yaml

from .errors import MalformedConfigError, MissingFileError
from .models import EdgeType, GraphEdge, GraphNode, NodeType, RetryPolicy

_IMAGE_TYPE_HINTS: list[tuple[str, NodeType]] = [
    ("redis", NodeType.CACHE),
    ("memcached", NodeType.CACHE),
    ("postgres", NodeType.DATABASE),
    ("mysql", NodeType.DATABASE),
    ("mariadb", NodeType.DATABASE),
    ("mongo", NodeType.DATABASE),
    ("cassandra", NodeType.DATABASE),
    ("rabbitmq", NodeType.QUEUE),
    ("kafka", NodeType.QUEUE),
    ("sqs", NodeType.QUEUE),
    ("nginx", NodeType.GATEWAY),
    ("traefik", NodeType.GATEWAY),
    ("envoy", NodeType.GATEWAY),
]

_TIMEOUT_ENV_RE = re.compile(r"(TIMEOUT|TIMEOUT_MS|TIMEOUT_SECONDS)$", re.IGNORECASE)
_RETRY_ENV_RE = re.compile(r"(RETRIES|RETRY_ATTEMPTS|MAX_RETRIES)$", re.IGNORECASE)


def _classify_by_image(image: str) -> NodeType:
    image_lower = image.lower()
    for hint, node_type in _IMAGE_TYPE_HINTS:
        if hint in image_lower:
            return node_type
    return NodeType.SERVICE


def _extract_timeout_retry_from_env(
    env: dict[str, object]
) -> tuple[int | None, RetryPolicy | None]:
    timeout_ms: int | None = None
    retry_policy: RetryPolicy | None = None

    for key, raw_value in (env or {}).items():
        value = str(raw_value)
        if _TIMEOUT_ENV_RE.search(key):
            parsed = _coerce_int(value)
            if parsed is not None:
                if "SECONDS" in key.upper() and parsed < 1000:
                    parsed *= 1000
                timeout_ms = parsed
        elif _RETRY_ENV_RE.search(key):
            parsed = _coerce_int(value)
            if parsed is not None:
                retry_policy = RetryPolicy(max_attempts=parsed, backoff=None)

    return timeout_ms, retry_policy


def _coerce_int(value: str) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _normalize_env(env_block: object) -> dict[str, object]:
    if env_block is None:
        return {}
    if isinstance(env_block, dict):
        return env_block
    if isinstance(env_block, list):
        result: dict[str, object] = {}
        for item in env_block:
            if isinstance(item, str) and "=" in item:
                k, _, v = item.partition("=")
                result[k] = v
        return result
    return {}


def find_compose_files(repo_path: str) -> list[str]:
    patterns = [
        "docker-compose.yml",
        "docker-compose.yaml",
        "docker-compose.*.yml",
        "docker-compose.*.yaml",
        "compose.yml",
        "compose.yaml",
    ]
    found: list[str] = []
    for pattern in patterns:
        found.extend(glob.glob(os.path.join(repo_path, pattern)))
    seen = set()
    unique = []
    for f in found:
        if f not in seen:
            seen.add(f)
            unique.append(f)
    return unique


def parse_docker_compose(
    path: str, repo_path: str
) -> tuple[list[GraphNode], list[GraphEdge], list[str]]:
    if not os.path.isfile(path):
        raise MissingFileError(path, context="docker-compose file")

    with open(path, "r", encoding="utf-8") as f:
        try:
            doc = yaml.safe_load(f)
        except yaml.YAMLError as exc:
            raise MalformedConfigError(path, f"invalid YAML: {exc}") from exc

    warnings: list[str] = []

    if not isinstance(doc, dict):
        raise MalformedConfigError(path, "top-level document is not a mapping")

    services = doc.get("services")
    if not isinstance(services, dict):
        warnings.append(
            f"{os.path.relpath(path, repo_path)}: no 'services' mapping found; skipped"
        )
        return [], [], warnings

    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    rel_path = os.path.relpath(path, repo_path)

    for service_name, service_def in services.items():
        if not isinstance(service_def, dict):
            warnings.append(f"{rel_path}: service '{service_name}' has non-mapping definition; skipped")
            continue

        image = service_def.get("image", "")
        node_type = _classify_by_image(image) if image else NodeType.SERVICE

        env = _normalize_env(service_def.get("environment"))
        timeout_ms, retry_policy = _extract_timeout_retry_from_env(env)

        node_id = f"service:{service_name}"
        nodes.append(
            GraphNode(
                id=node_id,
                type=node_type,
                name=service_name,
                language=None,
                source_files=[rel_path],
                metadata={
                    "image": image or None,
                    "ports": service_def.get("ports", []),
                    "compose_key": service_name,
                },
            )
        )

        depends_on = service_def.get("depends_on", [])
        if isinstance(depends_on, dict):
            dep_names = list(depends_on.keys())
        elif isinstance(depends_on, list):
            dep_names = depends_on
        else:
            dep_names = []

        for dep in dep_names:
            edges.append(
                GraphEdge(
                    source=node_id,
                    target=f"service:{dep}",
                    type=EdgeType.DEPENDS_ON,
                    timeout_ms=timeout_ms,
                    retry_policy=retry_policy,
                    source_files=[rel_path],
                    metadata={"declared_via": "depends_on"},
                )
            )

    return nodes, edges, warnings


def parse_k8s_manifests(
    manifests_dir: str, repo_path: str
) -> tuple[list[GraphNode], list[GraphEdge], list[str]]:
    warnings: list[str] = []
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []

    if not os.path.isdir(manifests_dir):
        return nodes, edges, warnings

    yaml_files = glob.glob(os.path.join(manifests_dir, "**", "*.yml"), recursive=True)
    yaml_files += glob.glob(os.path.join(manifests_dir, "**", "*.yaml"), recursive=True)

    for path in yaml_files:
        rel_path = os.path.relpath(path, repo_path)
        try:
            with open(path, "r", encoding="utf-8") as f:
                docs = list(yaml.safe_load_all(f))
        except yaml.YAMLError as exc:
            warnings.append(f"{rel_path}: invalid YAML manifest ({exc})")
            continue

        for doc in docs:
            if not isinstance(doc, dict):
                continue
            kind = doc.get("kind", "")
            meta = doc.get("metadata", {})
            name = meta.get("name") if isinstance(meta, dict) else None

            if kind == "Deployment" and name:
                node_id = f"service:{name}"
                nodes.append(
                    GraphNode(
                        id=node_id,
                        type=NodeType.SERVICE,
                        name=name,
                        source_files=[rel_path],
                        metadata={"k8s_kind": "Deployment"},
                    )
                )

    return nodes, edges, warnings
