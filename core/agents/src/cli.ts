#!/usr/bin/env node
/**
 * @fileoverview Bob Simulator — Standalone CLI Demo Runner.
 *
 * Demonstrates real-time multi-agent failure simulation, cascade tracing,
 * and polyglot resilience patch generation from the terminal.
 *
 * Usage:
 *   npm run demo
 *   node src/cli.ts "What happens if Stripe payment gateway is 10x slower?"
 *   node src/cli.ts --export sample_report.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseScenario } from './parser/scenario_parser.ts';
import { MasterAgent } from './master.ts';
import { generate_resilience_patch } from './subagents/patch_generator.ts';
import { BobLLMProvider } from './llm/watsonx.ts';
import { MockLLMProvider } from './llm/mock_provider.ts';
import { sampleEcommerceGraph } from '../tests/fixtures.ts';
import type { FailureAnalysisReport } from '../../../shared/types/agent.ts';

// ANSI colors for professional terminal output
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const DIM = '\x1b[2m';

function printHeader(): void {
  console.log(`\n${CYAN}${BOLD}╔═══════════════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${CYAN}${BOLD}║              BOB SIMULATOR — AGENT RESILIENCE ENGINE                  ║${RESET}`);
  console.log(`${CYAN}${BOLD}║       Automated Cascade Simulation & Polyglot Patch Generator         ║${RESET}`);
  console.log(`${CYAN}${BOLD}╚═══════════════════════════════════════════════════════════════════════╝${RESET}\n`);
}

function printUsage(): void {
  console.log(`${BOLD}Usage:${RESET}`);
  console.log(`  node src/cli.ts [options] ["<scenario_prompt>"]\n`);
  console.log(`${BOLD}Options:${RESET}`);
  console.log(`  --export <file>   Export full FailureAnalysisReport JSON to disk`);
  console.log(`  --offline         Force offline mock heuristic provider (default: auto fallback)`);
  console.log(`  --help, -h        Show this help message\n`);
  console.log(`${BOLD}Examples:${RESET}`);
  console.log(`  node src/cli.ts "What happens if Redis drops packets for 30s?"`);
  console.log(`  node src/cli.ts --export ../../sample_report.json "Payment API hangs"\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHeader();
    printUsage();
    process.exit(0);
  }

  let exportPath: string | null = null;
  let forceOffline = false;
  let prompt = 'What happens if Redis drops packets and latency spikes 10x for 30 seconds?';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--export' && i + 1 < args.length) {
      exportPath = args[++i];
    } else if (args[i] === '--offline') {
      forceOffline = true;
    } else if (!args[i].startsWith('--')) {
      prompt = args[i];
    }
  }

  printHeader();

  // 1. Scenario Parsing
  console.log(`${BOLD}[1/4] Scenario Parser${RESET} — Ingesting natural-language chaos prompt:`);
  console.log(`      ${DIM}"${prompt}"${RESET}`);
  const parsed = parseScenario(prompt);
  console.log(`      ${GREEN}✔${RESET} Scenario Type:     ${YELLOW}${parsed.scenario_type}${RESET}`);
  console.log(`      ${GREEN}✔${RESET} Target Components: ${parsed.target_mentions.length > 0 ? parsed.target_mentions.join(', ') : 'auto-inferred'}`);
  console.log(`      ${GREEN}✔${RESET} Latency Multiplier:${parsed.parameters?.latency_multiplier ?? 1}x`);
  console.log(`      ${GREEN}✔${RESET} Duration:          ${parsed.parameters?.duration_ms ? `${parsed.parameters.duration_ms / 1000}s` : 'unspecified'}\n`);

  // 2. Multi-Agent Orchestration
  console.log(`${BOLD}[2/4] Agent Mode Dispatch${RESET} — Executing parallel subagents...`);
  const startTime = Date.now();

  const llm = forceOffline ? new MockLLMProvider() : new BobLLMProvider();
  console.log(`      ${DIM}Active LLM Provider: ${llm.name}${RESET}`);

  const master = new MasterAgent(llm);
  const report: FailureAnalysisReport = await master.runFailureAnalysis(sampleEcommerceGraph, prompt, {
    mock_mode: forceOffline,
  });

  const durationMs = Date.now() - startTime;
  console.log(`      ${GREEN}✔${RESET} Multi-agent pipeline completed in ${BOLD}${durationMs}ms${RESET}\n`);

  // 3. Cascade Propagation Visualization
  console.log(`${BOLD}[3/4] Failure Propagation Tree${RESET} — Traced failure blast radius:`);
  if (report.failure_chains.length === 0) {
    console.log(`      ${DIM}No cascading propagation detected.${RESET}`);
  } else {
    for (const chain of report.failure_chains) {
      console.log(`      ${RED}● Root Trigger:${RESET} ${BOLD}${chain.root_node_id}${RESET} (${chain.trigger_event})`);
      chain.steps.forEach((step, idx) => {
        const isLast = idx === chain.steps.length - 1;
        const prefix = isLast ? '      └──' : '      ├──';
        const color = step.mechanism === 'timeout_cascade' ? RED : YELLOW;
        console.log(`${prefix} ${color}[${step.mechanism}]${RESET} → ${BOLD}${step.target_node_id}${RESET} (${step.description || 'impacted'})`);
      });
    }
  }

  console.log(`\n      ${BOLD}Affected Services Summary (${report.affected_nodes.length} nodes):${RESET}`);
  for (const node of report.affected_nodes) {
    const statusColor = node.status === 'dead' ? RED : node.status === 'failing' ? RED : YELLOW;
    const recovTag = node.recovering ? ` ${GREEN}[RECOVERING]${RESET}` : '';
    console.log(`      • ${BOLD}${node.node_id.padEnd(22)}${RESET} Status: ${statusColor}${node.status.toUpperCase()}${RESET}${recovTag} | Impact: ${node.impact_level} | Latency: ${node.latency_impact_multiplier}x`);
  }

  // 4. Root Causes & Patches
  console.log(`\n${BOLD}[4/4] Root Causes & Polyglot Patches Generated (${report.suggested_patches.length} patches):${RESET}`);
  for (const rc of report.root_causes) {
    const patch = report.suggested_patches.find((p) => p.root_cause_id === rc.id)
      ?? report.suggested_patches.find((p) => p.target_node_id === rc.node_id);
    const reduction = patch?.estimated_blast_radius_reduction_pct ?? 0;
    console.log(`\n      ${MAGENTA}▸ Root Cause:${RESET} ${BOLD}${rc.vulnerability_type}${RESET} on ${CYAN}${rc.node_id}${RESET}`);
    console.log(`        Severity: ${rc.severity.toUpperCase()} | Target: ${rc.file_target || 'N/A'}`);
    console.log(`        Diagnosis: ${rc.description}`);
    if (patch) {
      console.log(`        ${GREEN}✔ Patch Pattern:${RESET} ${BOLD}${patch.resilience_pattern}${RESET} (${GREEN}↓ ${reduction}% blast radius${RESET})`);
    }
  }

  // Generate unified diff
  const unified = generate_resilience_patch(report);
  if (unified.raw_diff) {
    console.log(`\n${BOLD}Generated Unified Git Diff Snippet:${RESET}`);
    console.log(`${DIM}----------------------------------------------------------------------${RESET}`);
    const lines = unified.raw_diff.split('\n').slice(0, 22);
    for (const line of lines) {
      if (line.startsWith('+')) {
        console.log(`${GREEN}${line}${RESET}`);
      } else if (line.startsWith('-')) {
        console.log(`${RED}${line}${RESET}`);
      } else if (line.startsWith('@')) {
        console.log(`${CYAN}${line}${RESET}`);
      } else {
        console.log(line);
      }
    }
    if (unified.raw_diff.split('\n').length > 22) {
      console.log(`${DIM}... (remaining patch lines truncated for terminal display) ...${RESET}`);
    }
    console.log(`${DIM}----------------------------------------------------------------------${RESET}`);
    console.log(`Stats: ${GREEN}+${unified.total_additions} additions${RESET}, ${RED}-${unified.total_deletions} deletions${RESET} across ${unified.files_changed.length} file(s)`);
  }

  // Export JSON if requested
  if (exportPath) {
    const resolved = path.resolve(process.cwd(), exportPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n${GREEN}${BOLD}✔ Successfully exported FailureAnalysisReport JSON to:${RESET} ${resolved}`);
  }

  console.log(`\n${GREEN}${BOLD}✔ Simulation & Patch Generation complete.${RESET}\n`);
}

main().catch((err) => {
  console.error(`\n${RED}${BOLD}Execution Error:${RESET}`, err);
  process.exit(1);
});
