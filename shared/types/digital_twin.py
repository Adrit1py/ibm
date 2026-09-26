from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class NodeType(str, Enum):
    service = "service"
    database = "database"
    cache = "cache"
    queue = "queue"
    external_api = "external_api"
    gateway = "gateway"
    unknown = "unknown"

class EdgeType(str, Enum):
    sync_call = "sync_call"
    async_call = "async_call"
    timeout = "timeout"
    retry = "retry"
    circuit_breaker = "circuit_breaker"
    fallback = "fallback"
    depends_on = "depends_on"

class GraphNode(BaseModel):
    id: str = Field(description="Stable unique node id, e.g. 'service:payment-api'.")
    type: NodeType
    name: str
    language: Optional[str] = Field(default=None, description="e.g. python, node, go, java. Null if not code-backed (e.g. a managed DB).")
    source_files: Optional[List[str]] = Field(default=None, description="Repo-relative paths that contributed to detecting this node.")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Free-form extras: image name, port, env vars relevant to resilience (timeouts, pool size), etc. Intentionally open so we don't need a schema PR for every new metadata key — but structural fields above are fixed.")

class RetryPolicy(BaseModel):
    max_attempts: Optional[int] = None
    backoff: Optional[str] = None

class GraphEdge(BaseModel):
    source: str = Field(description="GraphNode id.")
    target: str = Field(description="GraphNode id.")
    type: EdgeType
    timeout_ms: Optional[int] = None
    retry_policy: Optional[RetryPolicy] = None
    source_files: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None

class DigitalTwinSchema(BaseModel):
    schema_version: str = Field(description="Semver of this schema shape, e.g. 0.1.0. Consumers should check this before parsing.")
    generated_at: datetime = Field(description="ISO-8601 UTC timestamp of when the graph was generated.")
    repo_path: str = Field(description="Absolute or repo-relative path that was parsed.")
    warnings: Optional[List[str]] = Field(default_factory=list, description="Non-fatal issues encountered during parsing (missing files skipped, unparseable config, ambiguous edges, etc). Always present so downstream consumers can surface data-quality caveats instead of silently trusting an incomplete graph.")
    nodes: List[GraphNode]
    edges: List[GraphEdge]
