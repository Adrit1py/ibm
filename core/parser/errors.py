"""Custom exceptions for core/parser.

Person 1 boundary: these are internal to the parser pillar. Person 2/3/4
should never need to catch these directly — parse_repository() is the only
public entrypoint they consume, and it either returns a valid
DigitalTwinSchema or raises one of these with a clear, actionable message.
"""

from __future__ import annotations


class ParserError(Exception):
    """Base class for all core/parser errors."""


class MissingFileError(ParserError):
    """Raised when a required path (repo root, an explicitly-requested
    config file) does not exist on disk."""

    def __init__(self, path: str, context: str = ""):
        self.path = path
        self.context = context
        msg = f"Missing required path: {path!r}"
        if context:
            msg += f" ({context})"
        super().__init__(msg)


class MalformedConfigError(ParserError):
    """Raised when a config file exists but cannot be parsed as expected
    (invalid YAML/JSON, unexpected top-level shape)."""

    def __init__(self, path: str, reason: str):
        self.path = path
        self.reason = reason
        super().__init__(f"Malformed config at {path!r}: {reason}")


class EmptyGraphError(ParserError):
    """Raised by validate_graph() when a graph has zero nodes.

    Note: parse_repository() itself does NOT raise this automatically for
    an empty/unrecognized repo — it returns a schema with an empty node
    list plus a warning, so callers can decide whether an empty result is
    acceptable. Call validate_graph(schema, strict=True) explicitly if you
    need a hard failure on empty graphs.
    """

    def __init__(self, repo_path: str):
        self.repo_path = repo_path
        super().__init__(
            f"No nodes could be extracted from repo at {repo_path!r}. "
            "Check that the path contains recognizable source files or "
            "infra config (docker-compose*.yml, k8s manifests)."
        )
