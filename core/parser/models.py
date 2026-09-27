"""Domain Models for core/parser.

Defines the DigitalTwinSchema and related node/edge types used by
Person 1 to represent the system architecture graph.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class NodeType(str, Enum):
    SERVICE = "service"
    DATABASE = "database"
    CACHE = "cache"
    QUEUE = "queue"
    GATEWAY = "gateway"
    EXTERNAL_API = "external_api"


class EdgeType(str, Enum):
    SYNC_CALL = "sync_call"
    ASYNC_CALL = "async_call"
    DEPENDS_ON = "depends_on"


class RetryPolicy(BaseModel):
    max_attempts: int | None = None
    backoff: str | None = None


class GraphNode(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    type: NodeType
    name: str
    language: str | None = None
    source_files: list[str] = Field(default_factory=list)
    metadata: dict[str, object] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    model_config = ConfigDict(extra="ignore")

    source: str
    target: str
    type: EdgeType
    timeout_ms: int | None = None
    retry_policy: RetryPolicy | None = None
    source_files: list[str] = Field(default_factory=list)
    metadata: dict[str, object] = Field(default_factory=dict)


class DigitalTwinSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    schema_version: str = "0.1.0"
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    repo_path: str
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    def to_json(self, indent: int = 2) -> str:
        return self.model_dump_json(indent=indent)

    @classmethod
    from_json: type[DigitalTwinSchema]

DigitalTwinSchema.from_json = classmethod(
    lambda cls, json_str: cls.model_validate_json(json_str)
)
