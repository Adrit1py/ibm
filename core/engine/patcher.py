"""Virtual patch applicator for Person 3."""

from __future__ import annotations

import copy

from shared.types.digital_twin import DigitalTwinSchema, RetryPolicy
from .models import (
    AffectedNodeInput,
    FailureAnalysisReportInput,
    FailureChainInput,
    FailurePropagationStepInput,
    SuggestedPatchInput,
)


def apply_resilience_patches(
    graph: DigitalTwinSchema,
    patches: list[SuggestedPatchInput] | FailureAnalysisReportInput,
) -> DigitalTwinSchema:
    patch_list: list[SuggestedPatchInput] = []
    if isinstance(patches, FailureAnalysisReportInput):
        patch_list = patches.suggested_patches
    elif isinstance(patches, list):
        patch_list = patches

    graph_dict = graph.model_dump() if hasattr(graph, "model_dump") else copy.deepcopy(graph)
    patched_graph = DigitalTwinSchema.model_validate(graph_dict)

    for patch in patch_list:
        target_id = patch.target_node_id
        pattern = (patch.resilience_pattern or "").lower()

        for node in patched_graph.nodes:
            if node.id == target_id:
                if node.metadata is None:
                    node.metadata = {}

                config = node.metadata.setdefault("config", {})
                node.metadata["patched"] = True
                node.metadata["applied_patch_id"] = patch.id

                if "circuit_breaker" in pattern or "cb" in patch.id:
                    config["circuit_breaker"] = True
                    config["circuit_breaker_threshold"] = 0.5
                    config["circuit_breaker_reset_timeout_ms"] = 10000
                    node.metadata["circuit_breaker"] = True

                if "fallback" in pattern or "fb" in patch.id:
                    config["fallback_enabled"] = True
                    node.metadata["fallback_enabled"] = True

                if "bulkhead" in pattern or "pool" in patch.id or "timeout" in pattern:
                    config["pool_size"] = 50
                    config["timeout_ms"] = 2500
                    node.metadata["bulkhead_bounded"] = True

                if "exponential_backoff" in pattern or "jitter" in pattern or "retry" in patch.id:
                    config["exponential_backoff"] = True
                    config["retry_max_attempts"] = 3
                    config["retry_jitter"] = "full"

        for edge in patched_graph.edges:
            if edge.source == target_id:
                if "exponential_backoff" in pattern or "retry" in patch.id:
                    edge.retry_policy = RetryPolicy(max_attempts=3, backoff="exponential_jitter")
                if "bulkhead" in pattern or "timeout" in pattern:
                    edge.timeout_ms = 2500

    return patched_graph


def build_patched_failure_report(
    original_report: FailureAnalysisReportInput,
    patched_graph: DigitalTwinSchema,
) -> FailureAnalysisReportInput:
    protected_nodes_map: set[str] = set()

    for node in patched_graph.nodes:
        if node.metadata and (
            node.metadata.get("patched")
            or node.metadata.get("circuit_breaker")
            or node.metadata.get("config", {}).get("circuit_breaker")
            or node.metadata.get("config", {}).get("fallback_enabled")
        ):
            protected_nodes_map.add(node.id)

    patched_chains: list[FailureChainInput] = []
    for chain in original_report.failure_chains:
        new_steps: list[FailurePropagationStepInput] = []
        for step in chain.steps:
            if step.target_node_id in protected_nodes_map:
                new_steps.append(FailurePropagationStepInput(
                    step_order=step.step_order,
                    source_node_id=step.source_node_id,
                    target_node_id=step.target_node_id,
                    edge_protocol=step.edge_protocol,
                    mechanism="unhandled_exception",
                    description=f"Cascade intercepted by circuit breaker on {step.target_node_id}. Isolated failure.",
                    elapsed_ms_estimate=step.elapsed_ms_estimate,
                ))
                break
            else:
                new_steps.append(step)

        patched_chains.append(FailureChainInput(
            chain_id=f"patched-{chain.chain_id}",
            trigger_event=chain.trigger_event,
            root_node_id=chain.root_node_id,
            steps=new_steps,
            cascading_blast_radius=len(new_steps) + 1,
        ))

    root_ids: set[str] = set(c.root_node_id for c in original_report.failure_chains if c.root_node_id)
    if not root_ids and original_report.affected_nodes:
        root_ids.add(original_report.affected_nodes[0].node_id)

    severed_targets: set[str] = set()
    for chain in patched_chains:
        for s in chain.steps:
            severed_targets.add(s.target_node_id)

    patched_affected_nodes: list[AffectedNodeInput] = []
    for aff in original_report.affected_nodes:
        if aff.node_id in root_ids:
            patched_affected_nodes.append(aff)
        elif aff.node_id in protected_nodes_map:
            patched_affected_nodes.append(AffectedNodeInput(
                node_id=aff.node_id,
                node_name=aff.node_name,
                status="degraded",
                impact_level="low",
                failure_reason="Protected by active Circuit Breaker and Fallback cache. Isolated dependency failure.",
                latency_impact_multiplier=1.2,
                error_rate_estimate=0.02,
                recovering=True,
            ))
        elif aff.node_id in severed_targets:
            patched_affected_nodes.append(aff)

    return FailureAnalysisReportInput(
        scenario_prompt=original_report.scenario_prompt,
        analyzed_at=original_report.analyzed_at,
        affected_nodes=patched_affected_nodes,
        failure_chains=patched_chains,
        root_causes=[],
        suggested_patches=original_report.suggested_patches,
        diagnostics=original_report.diagnostics,
    )
