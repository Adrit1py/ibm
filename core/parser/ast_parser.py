"""Repository Ingestion & AST Parsing.

Scans source files across primary languages (Python, Node.js are
implemented; Go/Java are stubbed for a future PR — see NotImplemented
markers below, flagged rather than silently guessed at) and extracts
service boundaries, API clients, database calls, caches, and message
queues as GraphNode / GraphEdge candidates.

Design note: full multi-language static analysis (real Go/Java AST,
cross-file symbol resolution) is out of scope for this MVP scaffold.
Python uses the real `ast` module. Node.js uses conservative regex
heuristics over require()/import statements and known client method
calls — good enough to seed the graph, not a substitute for a real JS
parser (e.g. a future PR could swap in a tree-sitter based pass without
changing this module's public functions).
"""

from __future__ import annotations

import ast
import os
import re
from typing import Dict, List, Set, Tuple

from .models import EdgeType, GraphEdge, GraphNode, NodeType

_IGNORED_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    "dist", "build", ".mypy_cache", ".pytest_cache",
}

_PY_EXT = {".py"}
_JS_EXT = {".js", ".ts", ".jsx", ".tsx"}

# module/package name -> (NodeType, canonical dependency name)
_PY_DEPENDENCY_HINTS: Dict[str, Tuple[NodeType, str]] = {
    "redis": (NodeType.CACHE, "redis"),
    "pymemcache": (NodeType.CACHE, "memcached"),
    "psycopg2": (NodeType.DATABASE, "postgres"),
    "psycopg": (NodeType.DATABASE, "postgres"),
    "asyncpg": (NodeType.DATABASE, "postgres"),
    "pymysql": (NodeType.DATABASE, "mysql"),
    "pymongo": (NodeType.DATABASE, "mongo"),
    "sqlalchemy": (NodeType.DATABASE, "sql_database"),
    "pika": (NodeType.QUEUE, "rabbitmq"),
    "kafka": (NodeType.QUEUE, "kafka"),
    "confluent_kafka": (NodeType.QUEUE, "kafka"),
    "boto3": (NodeType.EXTERNAL_API, "aws"),
    "httpx": (NodeType.EXTERNAL_API, "http_client"),
    "requests": (NodeType.EXTERNAL_API, "http_client"),
    "aiohttp": (NodeType.EXTERNAL_API, "http_client"),
}

# require()/import package name -> (NodeType, canonical dependency name)
_JS_DEPENDENCY_HINTS: Dict[str, Tuple[NodeType, str]] = {
    "redis": (NodeType.CACHE, "redis"),
    "ioredis": (NodeType.CACHE, "redis"),
    "memcached": (NodeType.CACHE, "memcached"),
    "pg": (NodeType.DATABASE, "postgres"),
    "mysql": (NodeType.DATABASE, "mysql"),
    "mysql2": (NodeType.DATABASE, "mysql"),
    "mongodb": (NodeType.DATABASE, "mongo"),
    "mongoose": (NodeType.DATABASE, "mongo"),
    "amqplib": (NodeType.QUEUE, "rabbitmq"),
    "kafkajs": (NodeType.QUEUE, "kafka"),
    "aws-sdk": (NodeType.EXTERNAL_API, "aws"),
    "@aws-sdk/client-s3": (NodeType.EXTERNAL_API, "aws"),
    "axios": (NodeType.EXTERNAL_API, "http_client"),
    "node-fetch": (NodeType.EXTERNAL_API, "http_client"),
}

_JS_REQUIRE_RE = re.compile(r"""require\(\s*['"]([^'"]+)['"]\s*\)""")
_JS_IMPORT_RE = re.compile(r"""import\s+.*?from\s+['"]([^'"]+)['"]""")
# crude "looks like an outbound HTTP call to another internal service" hint,
# e.g. axios.get(`${PAYMENT_API_URL}/charge`) or fetch(process.env.X_URL)
_JS_URL_ENV_RE = re.compile(r"""(?:axios(?:\.\w+)?|fetch)\(\s*[`'"]?\$?\{?\s*(?:process\.env\.)?([A-Z0-9_]*URL[A-Z0-9_]*)""")


def walk_source_files(repo_path: str) -> List[str]:
    """Return all source file paths under repo_path, skipping noisy dirs."""
    results: List[str] = []
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in _IGNORED_DIRS and not d.startswith(".")]
        for fname in files:
            ext = os.path.splitext(fname)[1]
            if ext in _PY_EXT or ext in _JS_EXT:
                results.append(os.path.join(root, fname))
    return results


def _service_node_id_for_file(repo_path: str, file_path: str) -> str:
    """Best-effort: treat the top-level directory containing the file
    (relative to repo root) as the service boundary. Falls back to the
    repo root itself for flat/single-service repos.
    """
    rel = os.path.relpath(file_path, repo_path)
    parts = rel.split(os.sep)
    if len(parts) > 1 and parts[0] not in _IGNORED_DIRS:
        return f"service:{parts[0]}"
    return "service:app"


class _PythonImportVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.imported_modules: Set[str] = set()

    def visit_Import(self, node: ast.Import) -> None:  # noqa: N802
        for alias in node.names:
            self.imported_modules.add(alias.name.split(".")[0])
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:  # noqa: N802
        if node.module:
            self.imported_modules.add(node.module.split(".")[0])
        self.generic_visit(node)


def analyze_python_file(
    repo_path: str, file_path: str
) -> Tuple[List[GraphNode], List[GraphEdge], List[str]]:
    warnings: List[str] = []
    rel_path = os.path.relpath(file_path, repo_path)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            source = f.read()
    except (OSError, UnicodeDecodeError) as exc:
        warnings.append(f"{rel_path}: could not read file, skipped ({exc})")
        return [], [], warnings

    try:
        tree = ast.parse(source, filename=file_path)
    except SyntaxError as exc:
        warnings.append(f"{rel_path}: syntax error, skipped ({exc})")
        return [], [], warnings

    visitor = _PythonImportVisitor()
    visitor.visit(tree)

    service_id = _service_node_id_for_file(repo_path, file_path)
    nodes: List[GraphNode] = [
        GraphNode(
            id=service_id,
            type=NodeType.SERVICE,
            name=service_id.split(":", 1)[1],
            language="python",
            source_files=[rel_path],
        )
    ]
    edges: List[GraphEdge] = []

    for module_name in visitor.imported_modules:
        hint = _PY_DEPENDENCY_HINTS.get(module_name)
        if not hint:
            continue
        dep_type, dep_name = hint
        dep_id = f"{dep_type.value}:{dep_name}"
        nodes.append(
            GraphNode(
                id=dep_id,
                type=dep_type,
                name=dep_name,
                language=None,
                source_files=[rel_path],
                metadata={"detected_via": f"python import '{module_name}'"},
            )
        )
        edges.append(
            GraphEdge(
                source=service_id,
                target=dep_id,
                type=EdgeType.SYNC_CALL if dep_type != NodeType.QUEUE else EdgeType.ASYNC_CALL,
                source_files=[rel_path],
                metadata={"detected_via": f"python import '{module_name}'"},
            )
        )

    return nodes, edges, warnings


def analyze_js_file(
    repo_path: str, file_path: str
) -> Tuple[List[GraphNode], List[GraphEdge], List[str]]:
    warnings: List[str] = []
    rel_path = os.path.relpath(file_path, repo_path)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            source = f.read()
    except (OSError, UnicodeDecodeError) as exc:
        warnings.append(f"{rel_path}: could not read file, skipped ({exc})")
        return [], [], warnings

    imported_modules: Set[str] = set(_JS_REQUIRE_RE.findall(source))
    imported_modules |= set(_JS_IMPORT_RE.findall(source))

    service_id = _service_node_id_for_file(repo_path, file_path)
    nodes: List[GraphNode] = [
        GraphNode(
            id=service_id,
            type=NodeType.SERVICE,
            name=service_id.split(":", 1)[1],
            language="node",
            source_files=[rel_path],
        )
    ]
    edges: List[GraphEdge] = []

    for module_name in imported_modules:
        hint = _JS_DEPENDENCY_HINTS.get(module_name)
        if not hint:
            continue
        dep_type, dep_name = hint
        dep_id = f"{dep_type.value}:{dep_name}"
        nodes.append(
            GraphNode(
                id=dep_id,
                type=dep_type,
                name=dep_name,
                language=None,
                source_files=[rel_path],
                metadata={"detected_via": f"js import '{module_name}'"},
            )
        )
        edges.append(
            GraphEdge(
                source=service_id,
                target=dep_id,
                type=EdgeType.SYNC_CALL if dep_type != NodeType.QUEUE else EdgeType.ASYNC_CALL,
                source_files=[rel_path],
                metadata={"detected_via": f"js import '{module_name}'"},
            )
        )

    # Heuristic: outbound calls that reference an *_URL env var, treated as
    # an external_api node named after the env var (e.g. PAYMENT_API_URL).
    for env_var in set(_JS_URL_ENV_RE.findall(source)):
        dep_name = env_var.lower()
        dep_id = f"external_api:{dep_name}"
        nodes.append(
            GraphNode(
                id=dep_id,
                type=NodeType.EXTERNAL_API,
                name=dep_name,
                language=None,
                source_files=[rel_path],
                metadata={"detected_via": f"js call referencing env var '{env_var}'"},
            )
        )
        edges.append(
            GraphEdge(
                source=service_id,
                target=dep_id,
                type=EdgeType.SYNC_CALL,
                source_files=[rel_path],
                metadata={"detected_via": f"js call referencing env var '{env_var}'"},
            )
        )

    return nodes, edges, warnings


def extract_service_dependencies(
    repo_path: str,
) -> Tuple[List[GraphNode], List[GraphEdge], List[str]]:
    """Scan all supported source files under repo_path and return the
    union of detected nodes/edges plus any non-fatal warnings.
    """
    all_nodes: List[GraphNode] = []
    all_edges: List[GraphEdge] = []
    all_warnings: List[str] = []

    for file_path in walk_source_files(repo_path):
        ext = os.path.splitext(file_path)[1]
        if ext in _PY_EXT:
            nodes, edges, warnings = analyze_python_file(repo_path, file_path)
        elif ext in _JS_EXT:
            nodes, edges, warnings = analyze_js_file(repo_path, file_path)
        else:
            continue
        all_nodes.extend(nodes)
        all_edges.extend(edges)
        all_warnings.extend(warnings)

    return all_nodes, all_edges, all_warnings
