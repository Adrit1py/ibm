"""Unit tests for core/parser, run against mocked sample repositories.

These tests only touch fixtures under core/parser/tests/fixtures/ — no
network, no real cloned repos. Person 1 boundary: this file only tests
core/parser's own public + internal functions.
"""

import os
import shutil
import tempfile

import pytest

from core.parser.entrypoint import parse_repository, parse_repository_to_json
from core.parser.errors import EmptyGraphError, MalformedConfigError, MissingFileError
from core.parser.graph_builder import GraphBuilder, validate_graph
from core.parser.infra_parser import parse_docker_compose
from core.parser.ast_parser import analyze_js_file, analyze_python_file
from core.parser.context_formatter import format_for_llm, summarize_by_type
from core.parser.models import EdgeType, GraphEdge, GraphNode, NodeType

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


# ---------------------------------------------------------------------------
# infra_parser: docker-compose
# ---------------------------------------------------------------------------

def test_parse_docker_compose_sample_extracts_services_and_deps():
    compose_path = os.path.join(FIXTURES_DIR, "docker-compose.sample.yml")
    nodes, edges, warnings = parse_docker_compose(compose_path, FIXTURES_DIR)

    node_ids = {n.id for n in nodes}
    assert node_ids == {
        "service:api", "service:worker", "service:redis",
        "service:postgres", "service:rabbitmq",
    }

    redis_node = next(n for n in nodes if n.id == "service:redis")
    assert redis_node.type == NodeType.CACHE

    postgres_node = next(n for n in nodes if n.id == "service:postgres")
    assert postgres_node.type == NodeType.DATABASE

    api_to_redis = next(e for e in edges if e.source == "service:api" and e.target == "service:redis")
    assert api_to_redis.type == EdgeType.DEPENDS_ON
    assert api_to_redis.timeout_ms == 3000
    assert api_to_redis.retry_policy is not None
    assert api_to_redis.retry_policy.max_attempts == 2

    worker_to_rabbit = next(e for e in edges if e.source == "service:worker" and e.target == "service:rabbitmq")
    # QUEUE_TIMEOUT_SECONDS=10 -> normalized to ms.
    assert worker_to_rabbit.timeout_ms == 10000

    assert warnings == []


def test_parse_docker_compose_missing_file_raises():
    with pytest.raises(MissingFileError):
        parse_docker_compose(os.path.join(FIXTURES_DIR, "does-not-exist.yml"), FIXTURES_DIR)


def test_parse_docker_compose_malformed_yaml_raises(tmp_path):
    bad_file = tmp_path / "docker-compose.yml"
    bad_file.write_text("services: [this, is, not, a, mapping")  # unbalanced -> invalid YAML
    with pytest.raises(MalformedConfigError):
        parse_docker_compose(str(bad_file), str(tmp_path))


def test_parse_docker_compose_no_services_key_warns(tmp_path):
    odd_file = tmp_path / "docker-compose.yml"
    odd_file.write_text("version: '3.8'\n")
    nodes, edges, warnings = parse_docker_compose(str(odd_file), str(tmp_path))
    assert nodes == []
    assert edges == []
    assert len(warnings) == 1


# ---------------------------------------------------------------------------
# ast_parser: Python + JS
# ---------------------------------------------------------------------------

def test_analyze_python_file_detects_redis_postgres_http():
    file_path = os.path.join(FIXTURES_DIR, "sample_fastapi", "main.py")
    nodes, edges, warnings = analyze_python_file(FIXTURES_DIR, file_path)

    node_ids = {n.id for n in nodes}
    assert "cache:redis" in node_ids
    assert "database:postgres" in node_ids
    assert "external_api:http_client" in node_ids
    assert warnings == []

    service_node = next(n for n in nodes if n.type == NodeType.SERVICE)
    assert service_node.language == "python"
    edge_targets = {e.target for e in edges}
    assert {"cache:redis", "database:postgres", "external_api:http_client"} <= edge_targets


def test_analyze_python_file_syntax_error_warns_not_raises(tmp_path):
    bad_file = tmp_path / "broken.py"
    bad_file.write_text("def broken(:\n")
    nodes, edges, warnings = analyze_python_file(str(tmp_path), str(bad_file))
    assert nodes == []
    assert edges == []
    assert len(warnings) == 1
    assert "syntax error" in warnings[0]


def test_analyze_js_file_detects_redis_pg_axios_and_url_env():
    file_path = os.path.join(FIXTURES_DIR, "sample_express", "server.js")
    nodes, edges, warnings = analyze_js_file(FIXTURES_DIR, file_path)

    node_ids = {n.id for n in nodes}
    assert "cache:redis" in node_ids
    assert "database:postgres" in node_ids
    assert "external_api:http_client" in node_ids
    assert "external_api:payment_api_url" in node_ids
    assert warnings == []

    service_node = next(n for n in nodes if n.type == NodeType.SERVICE)
    assert service_node.language == "node"


# ---------------------------------------------------------------------------
# graph_builder
# ---------------------------------------------------------------------------

def test_graph_builder_merges_duplicate_nodes_and_unions_source_files():
    builder = GraphBuilder("/fake/repo")
    builder.add_node(GraphNode(id="cache:redis", type=NodeType.CACHE, name="redis", source_files=["a.py"]))
    builder.add_node(GraphNode(id="cache:redis", type=NodeType.CACHE, name="redis", source_files=["b.py"]))
    schema = builder.build()

    assert len(schema.nodes) == 1
    assert set(schema.nodes[0].source_files) == {"a.py", "b.py"}


def test_graph_builder_drops_dangling_edges_with_warning():
    builder = GraphBuilder("/fake/repo")
    builder.add_node(GraphNode(id="service:api", type=NodeType.SERVICE, name="api"))
    builder.add_edge(GraphEdge(source="service:api", target="cache:redis", type=EdgeType.SYNC_CALL))
    schema = builder.build()

    assert schema.edges == []
    assert any("dropped edge" in w for w in schema.warnings)


def test_validate_graph_strict_raises_on_empty():
    builder = GraphBuilder("/fake/repo")
    schema = builder.build()
    with pytest.raises(EmptyGraphError):
        validate_graph(schema, strict=True)


def test_validate_graph_non_strict_returns_warning_string():
    builder = GraphBuilder("/fake/repo")
    schema = builder.build()
    problems = validate_graph(schema, strict=False)
    assert any("zero nodes" in p for p in problems)


# ---------------------------------------------------------------------------
# entrypoint: parse_repository end-to-end
# ---------------------------------------------------------------------------

def test_parse_repository_missing_dir_raises():
    with pytest.raises(MissingFileError):
        parse_repository("/definitely/does/not/exist")


def test_parse_repository_on_fastapi_fixture_end_to_end(tmp_path):
    # Copy the fixture into an isolated tmp dir so we exercise a realistic
    # "repo root" shape without depending on the fixtures/ layout itself.
    repo_dir = tmp_path / "sample_repo"
    shutil.copytree(os.path.join(FIXTURES_DIR, "sample_fastapi"), repo_dir)

    schema = parse_repository(str(repo_dir))

    assert schema.repo_path == str(repo_dir)
    assert len(schema.nodes) > 0
    type_counts = summarize_by_type(schema)
    assert type_counts.get("cache", 0) >= 1
    assert type_counts.get("database", 0) >= 1


def test_parse_repository_on_compose_fixture_end_to_end(tmp_path):
    repo_dir = tmp_path / "compose_repo"
    repo_dir.mkdir()
    shutil.copy(
        os.path.join(FIXTURES_DIR, "docker-compose.sample.yml"),
        repo_dir / "docker-compose.yml",
    )

    schema = parse_repository(str(repo_dir))
    node_ids = {n.id for n in schema.nodes}
    assert "service:redis" in node_ids
    assert "service:rabbitmq" in node_ids


def test_parse_repository_empty_dir_returns_empty_schema_not_raise(tmp_path):
    empty_dir = tmp_path / "empty_repo"
    empty_dir.mkdir()
    schema = parse_repository(str(empty_dir))
    assert schema.nodes == []
    assert any("zero nodes" in w for w in schema.warnings)


def test_parse_repository_strict_raises_on_empty(tmp_path):
    empty_dir = tmp_path / "empty_repo"
    empty_dir.mkdir()
    with pytest.raises(EmptyGraphError):
        parse_repository(str(empty_dir), strict=True)


def test_parse_repository_to_json_writes_file(tmp_path):
    repo_dir = tmp_path / "sample_repo"
    shutil.copytree(os.path.join(FIXTURES_DIR, "sample_fastapi"), repo_dir)
    output_path = tmp_path / "out" / "graph.json"

    payload = parse_repository_to_json(str(repo_dir), output_path=str(output_path))

    assert output_path.exists()
    assert output_path.read_text() == payload
    assert '"schema_version"' in payload


# ---------------------------------------------------------------------------
# context_formatter
# ---------------------------------------------------------------------------

def test_format_for_llm_produces_compact_text(tmp_path):
    repo_dir = tmp_path / "sample_repo"
    shutil.copytree(os.path.join(FIXTURES_DIR, "sample_fastapi"), repo_dir)
    schema = parse_repository(str(repo_dir))

    text = format_for_llm(schema)
    assert "nodes:" in text
    assert "edges:" in text
    assert "schema_version=" in text


def test_format_for_llm_respects_max_edges_cap(tmp_path):
    repo_dir = tmp_path / "sample_repo"
    shutil.copytree(os.path.join(FIXTURES_DIR, "sample_fastapi"), repo_dir)
    schema = parse_repository(str(repo_dir))

    text = format_for_llm(schema, max_edges=1)
    assert "showing 1 of" in text
