"""Shared typed contract for the digital-twin graph.

This is the file Person 2 (core/agents), Person 3 (core/engine), and
Person 4 (web/, via a generated JSON-schema-to-TS step or a thin JSON
fetch) are meant to depend on — NOT core/parser's internal dataclasses in
models.py. It mirrors schemas/digital_twin_schema.json field-for-field.

Kept intentionally dependency-free (stdlib `typing` only, no dataclasses,
no yaml) so any pillar can import it without pulling in parser internals.

Ownership: Person 1 (parser) owns this shape as producer. Changing it is
a schema change — see the project's PR/tagging rule in the root prompt.
"""

from __future__ import annotations

from typing import List, Literal, Optional, TypedDict

SCHEMA_VERSION = "0.1.0"

NodeTypeLiteral = Literal[
    "service", "database", "cache", "queue", "external_api", "gateway", "unknown"
]

EdgeTypeLiteral = Literal[
    "sync_call", "async_call", "timeout", "retry", "circuit_breaker", "fallback", "depends_on"
]


class RetryPolicyDict(TypedDict, total=False):
    max_attempts: Optional[int]
    backoff: Optional[str]


class GraphNodeDict(TypedDict):
    id: str
    type: NodeTypeLiteral
    name: str
    language: Optional[str]
    source_files: List[str]
    metadata: dict


class GraphEdgeDict(TypedDict):
    source: str
    target: str
    type: EdgeTypeLiteral
    timeout_ms: Optional[int]
    retry_policy: Optional[RetryPolicyDict]
    source_files: List[str]
    metadata: dict


class DigitalTwinSchemaDict(TypedDict):
    schema_version: str
    generated_at: str
    repo_path: str
    warnings: List[str]
    nodes: List[GraphNodeDict]
    edges: List[GraphEdgeDict]
