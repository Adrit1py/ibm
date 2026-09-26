"""core/parser — Person 1: Codebase Intelligence & System Graph.

Public surface (what Person 2/3/4 are allowed to depend on, and only via
shared/types/parser.py + the exported JSON — never these internals
directly, per the project's SHARED CONTRACT rule):

    from core.parser import parse_repository, parse_repository_to_json

Everything else in this package (ast_parser, infra_parser, graph_builder,
context_formatter, models, errors) is an implementation detail.
"""

from .entrypoint import parse_repository, parse_repository_to_json
from .errors import EmptyGraphError, MalformedConfigError, MissingFileError, ParserError
from .models import DigitalTwinSchema, EdgeType, GraphEdge, GraphNode, NodeType

__all__ = [
    "parse_repository",
    "parse_repository_to_json",
    "DigitalTwinSchema",
    "GraphNode",
    "GraphEdge",
    "NodeType",
    "EdgeType",
    "ParserError",
    "MissingFileError",
    "MalformedConfigError",
    "EmptyGraphError",
]
