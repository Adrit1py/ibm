"""Typed models for the digital-twin graph.

These are the internal, fully-typed representation used inside
core/parser. They are kept in 1:1 correspondence with
schemas/digital_twin_schema.json (SCHEMA_VERSION below) and are what
context_formatter.py / graph_builder.py operate on before final
serialization to JSON via DigitalTwinSchema.to_json().

Person 1 owns this shape. Any change here must be mirrored in
schemas/digital_twin_schema.json AND shared/types/parser.py, and per
project rules that's a separate PR tagged to all 4 owners — never bundled
with a parser feature commit.
"""

from __future__ import annotations

import dataclasses
import datetime as _dt
import enum
import json
from typing import Any, Dict, List, Optional

SCHEMA_VERSION = "0.1.0"


class NodeType(str, enum.Enum):
    SERVICE = "service"
    DATABASE = "database"
    CACHE = "cache"
    QUEUE = "queue"
    EXTERNAL_API = "external_api"
    GATEWAY = "gateway"
    UNKNOWN = "unknown"


class EdgeType(str, enum.Enum):
    SYNC_CALL = "sync_call"
    ASYNC_CALL = "async_call"
    TIMEOUT = "timeout"
    RETRY = "retry"
    CIRCUIT_BREAKER = "circuit_breaker"
    FALLBACK = "fallback"
    DEPENDS_ON = "depends_on"


@dataclasses.dataclass
class RetryPolicy:
    max_attempts: Optional[int] = None
    backoff: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {"max_attempts": self.max_attempts, "backoff": self.backoff}


@dataclasses.dataclass
class GraphNode:
    id: str
    type: NodeType
    name: str
    language: Optional[str] = None
    source_files: List[str] = dataclasses.field(default_factory=list)
    metadata: Dict[str, Any] = dataclasses.field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value if isinstance(self.type, NodeType) else self.type,
            "name": self.name,
            "language": self.language,
            "source_files": list(self.source_files),
            "metadata": dict(self.metadata),
        }


@dataclasses.dataclass
class GraphEdge:
    source: str
    target: str
    type: EdgeType
    timeout_ms: Optional[int] = None
    retry_policy: Optional[RetryPolicy] = None
    source_files: List[str] = dataclasses.field(default_factory=list)
    metadata: Dict[str, Any] = dataclasses.field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "target": self.target,
            "type": self.type.value if isinstance(self.type, EdgeType) else self.type,
            "timeout_ms": self.timeout_ms,
            "retry_policy": self.retry_policy.to_dict() if self.retry_policy else None,
            "source_files": list(self.source_files),
            "metadata": dict(self.metadata),
        }


@dataclasses.dataclass
class DigitalTwinSchema:
    repo_path: str
    nodes: List[GraphNode] = dataclasses.field(default_factory=list)
    edges: List[GraphEdge] = dataclasses.field(default_factory=list)
    warnings: List[str] = dataclasses.field(default_factory=list)
    schema_version: str = SCHEMA_VERSION
    generated_at: str = dataclasses.field(
        default_factory=lambda: _dt.datetime.utcnow().isoformat() + "Z"
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "generated_at": self.generated_at,
            "repo_path": self.repo_path,
            "warnings": list(self.warnings),
            "nodes": [n.to_dict() for n in self.nodes],
            "edges": [e.to_dict() for e in self.edges],
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, sort_keys=False)
