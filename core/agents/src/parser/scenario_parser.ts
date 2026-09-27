/**
 * @fileoverview Advanced NLP Scenario Parser for "What If?" attack prompts.
 *
 * Parses complex natural-language failure scenarios into a structured
 * `ParsedScenario` object using regex + semantic heuristics — no external
 * API required. Handles multi-factor queries like:
 *
 *   "What if Stripe API latency increases by 5000ms?"
 *   "What if Redis cache crashes and stays down for 1 minute?"
 *   "What if auth-service fails during peak traffic with 90% error rate?"
 *
 * Used by `MasterAgent` to enrich seed node identification and to pass
 * quantified parameters down to subagents.
 *
 * @module core/agents/parser/scenario_parser
 */

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** The category of failure scenario being described. */
export type ScenarioType =
  | 'complete_failure'    // service crash / total unavailability
  | 'latency_degradation' // slowdown / increased response times
  | 'error_rate_spike'    // elevated HTTP 5xx / exception rate
  | 'partial_outage'      // intermittent or percentage-based failures
  | 'resource_exhaustion' // CPU / memory / pool saturation
  | 'network_partition'   // packet loss, connectivity issues
  | 'data_corruption'     // malformed or wrong responses
  | 'unknown';            // unclassified

/** Quantified parameters extracted from the scenario text. */
export interface ScenarioParameters {
  /** Latency increase in milliseconds (e.g. 5000 from "+5000ms"). */
  readonly latency_increase_ms?: number;
  /** Error rate as 0.0–1.0 fraction (e.g. 0.9 from "90% error rate"). */
  readonly error_rate?: number;
  /** How long the failure lasts in milliseconds (e.g. 60000 from "1 minute"). */
  readonly duration_ms?: number;
  /** Latency scale multiplier (e.g. 10 from "10x slower"). */
  readonly latency_multiplier?: number;
  /** Fraction of traffic affected (e.g. 0.5 from "50% of requests"). */
  readonly traffic_percentage?: number;
}

/** A structured, machine-readable failure scenario parsed from free text. */
export interface ParsedScenario {
  /** The original user-supplied prompt (unchanged). */
  readonly original_prompt: string;
  /** Normalized lowercase version used internally for matching. */
  readonly normalized_prompt: string;
  /** The primary failure category. */
  readonly scenario_type: ScenarioType;
  /** Named targets extracted from the prompt (service / infra names). */
  readonly target_mentions: readonly string[];
  /** Quantified parameters extracted from the prompt. */
  readonly parameters: ScenarioParameters;
  /** Human-readable one-line summary of what was parsed. */
  readonly summary: string;
  /** True when at least one quantified parameter was successfully extracted. */
  readonly is_quantified: boolean;
}

// ---------------------------------------------------------------------------
// Scenario type detection patterns (evaluated in priority order)
// ---------------------------------------------------------------------------

const SCENARIO_TYPE_PATTERNS: ReadonlyArray<{
  readonly type: ScenarioType;
  readonly patterns: ReadonlyArray<RegExp>;
}> = [
  {
    type: 'network_partition',
    patterns: [
      /network\s+partition/,
      /packet\s+loss/,
      /split[\s-]brain/,
      /drops?\s+packets?/,
      /connectivity\s+(?:loss|issue)/,
    ],
  },
  {
    type: 'complete_failure',
    patterns: [
      /crash(?:es|ed)?/,
      /goes?\s+down/,
      /(?:completely\s+)?(?:unavailable|unreachable|offline)/,
      /stops?\s+responding/,
      /goes?\s+(?:completely\s+)?offline/,
      /\bkilled?\b/,
      /\bfails?\b/,
    ],
  },
  {
    type: 'latency_degradation',
    patterns: [
      /latency\s+(?:increase|spike|degrade)/,
      /becomes?\s+\d+x\s+slower/,
      /slows?\s+down/,
      /\bslow(?:er)?\b/,
      /response\s+time\s+(?:increase|grow)/,
      /\d+\s*ms\b/,
      /\bhangs?\b/,
      /\bno\s+response\b/,
      /\btime(?:d)?[\s-]?outs?\b/,
    ],
  },
  {
    type: 'error_rate_spike',
    patterns: [
      /error\s+rate\s+(?:spike|increase|hit)/,
      /\d+%\s+(?:error|failure)\s+rate/,
      /throws?\s+(?:errors?|exceptions?)/,
      /returns?\s+5\d\d/,
    ],
  },
  {
    type: 'resource_exhaustion',
    patterns: [
      /(?:cpu|memory|heap|disk)\s+(?:saturation|exhaustion|spike)/,
      /(?:thread|connection)\s+(?:pool\s+)?(?:starvation|exhaustion)/,
      /(?:out\s+of|exhausts?)\s+(?:memory|connections?)/,
      /(?:pool|queue)\s+(?:full|saturated)/,
    ],
  },
  {
    type: 'partial_outage',
    patterns: [
      /\d+%\s+of\s+(?:requests?|traffic|calls?)/,
      /intermittent/,
      /flapping/,
      /partial\s+(?:outage|failure)/,
    ],
  },
  {
    type: 'data_corruption',
    patterns: [
      /corrupt(?:s|ed|ion)?/,
      /malformed\s+(?:data|response)/,
      /bad\s+data/,
      /returns?\s+(?:wrong|invalid|garbage)/,
    ],
  },
];

// ---------------------------------------------------------------------------
// Target name extraction patterns
// ---------------------------------------------------------------------------

const TARGET_PATTERNS: ReadonlyArray<RegExp> = [
  // Hyphenated / underscored service names: "order-service", "auth_service"
  /\b([a-z][a-z0-9]*(?:[-_][a-z][a-z0-9]*)+)\b/gi,
  // Well-known infrastructure names
  /\b(redis|postgres|mysql|mongodb|kafka|rabbitmq|elasticsearch|nginx|haproxy|memcached)\b/gi,
  // Well-known SaaS / payment APIs
  /\b(stripe|twilio|sendgrid|auth0|okta|datadog|pagerduty|braintree)\b/gi,
  // Generic labelled components
  /\b(api[\s-]?gateway|load[\s-]?balancer|message[\s-]?queue|cache[\s-]?layer)\b/gi,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a natural-language "what if?" scenario into a structured
 * `ParsedScenario` object.
 *
 * Stateless and pure — identical inputs always produce identical outputs.
 *
 * @param prompt - Raw user-supplied scenario string.
 * @returns Structured `ParsedScenario`.
 */
export function parseScenario(prompt: string): ParsedScenario {
  const normalized = (prompt ?? '').toLowerCase().trim();

  const scenario_type = detectType(normalized);
  const target_mentions = extractTargets(normalized);
  const parameters = extractParameters(normalized);
  const is_quantified =
    parameters.latency_increase_ms !== undefined ||
    parameters.error_rate !== undefined ||
    parameters.duration_ms !== undefined ||
    parameters.latency_multiplier !== undefined ||
    parameters.traffic_percentage !== undefined;

  const summary = buildSummary(scenario_type, target_mentions, parameters);

  return {
    original_prompt: prompt,
    normalized_prompt: normalized,
    scenario_type,
    target_mentions,
    parameters,
    summary,
    is_quantified,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function detectType(normalized: string): ScenarioType {
  for (const { type, patterns } of SCENARIO_TYPE_PATTERNS) {
    if (patterns.some((p) => p.test(normalized))) return type;
  }
  return 'unknown';
}

function extractTargets(normalized: string): string[] {
  const found = new Set<string>();
  for (const pattern of TARGET_PATTERNS) {
    const re = new RegExp(pattern.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(normalized)) !== null) {
      const candidate = m[1]?.toLowerCase().trim();
      if (candidate && candidate.length > 2) found.add(candidate);
    }
  }
  return Array.from(found);
}

function extractParameters(normalized: string): ScenarioParameters {
  const p: {
    latency_increase_ms?: number;
    error_rate?: number;
    duration_ms?: number;
    latency_multiplier?: number;
    traffic_percentage?: number;
  } = {};

  // Latency increase — explicit ms value
  const msMatch = normalized.match(/(\d+(?:\.\d+)?)\s*ms(?:ec(?:ond)?s?)?/);
  if (msMatch) {
    p.latency_increase_ms = parseFloat(msMatch[1]);
  } else {
    // "2 second latency increase"
    const secLatencyMatch = normalized.match(
      /latency\s+(?:increase[sd]?\s+(?:to|by)\s+|of\s+)?(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?/,
    );
    if (secLatencyMatch) p.latency_increase_ms = parseFloat(secLatencyMatch[1]) * 1_000;
  }

  // Latency multiplier — "10x slower", "5x latency", "spikes 10x", "10x higher"
  const multMatch = normalized.match(
    /(\d+(?:\.\d+)?)x\s+(?:slower|latency|increase|higher|worse)|(?:spikes?\s+(?:to\s+)?)(\d+(?:\.\d+)?)x\b/,
  );
  if (multMatch) p.latency_multiplier = parseFloat(multMatch[1] ?? multMatch[2]);

  // Error rate — "90% error rate" or "error rate of 0.9"
  const errPctMatch = normalized.match(/(\d+(?:\.\d+)?)\s*%\s*(?:error|failure)\s*rate/);
  if (errPctMatch) {
    p.error_rate = Math.min(parseFloat(errPctMatch[1]) / 100, 1.0);
  } else {
    const errFracMatch = normalized.match(
      /error\s+rate\s+(?:of\s+)?(?:hits?\s+)?(\d+(?:\.\d+)?)(?!\s*%)/,
    );
    if (errFracMatch) {
      const val = parseFloat(errFracMatch[1]);
      p.error_rate = val > 1 ? Math.min(val / 100, 1.0) : val;
    }
  }

  // Duration — "for 30s", "for 1 minute", "stays down for 2m"
  const durSecMatch = normalized.match(
    /(?:for|stays?\s+down\s+for|down\s+for)\s+(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?(?:\b)/,
  );
  if (durSecMatch) {
    p.duration_ms = parseFloat(durSecMatch[1]) * 1_000;
  } else {
    const durMinMatch = normalized.match(
      /(?:for|stays?\s+down\s+for|down\s+for)\s+(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?(?:\b)/,
    );
    if (durMinMatch) p.duration_ms = parseFloat(durMinMatch[1]) * 60_000;
  }

  // Traffic percentage — "50% of requests"
  const trafficMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*%\s*of\s*(?:requests?|traffic|calls?)/,
  );
  if (trafficMatch) p.traffic_percentage = Math.min(parseFloat(trafficMatch[1]) / 100, 1.0);

  return p;
}

function buildSummary(
  type: ScenarioType,
  targets: readonly string[],
  params: ScenarioParameters,
): string {
  const typeLabel: Record<ScenarioType, string> = {
    complete_failure: 'complete failure',
    latency_degradation: 'latency degradation',
    error_rate_spike: 'error rate spike',
    partial_outage: 'partial outage',
    resource_exhaustion: 'resource exhaustion',
    network_partition: 'network partition',
    data_corruption: 'data corruption',
    unknown: 'unclassified failure',
  };

  const targetStr = targets.length > 0 ? targets.slice(0, 3).join(', ') : 'unknown service';
  const parts: string[] = [`${typeLabel[type]} on [${targetStr}]`];

  if (params.latency_increase_ms !== undefined)
    parts.push(`+${params.latency_increase_ms}ms latency`);
  if (params.latency_multiplier !== undefined)
    parts.push(`${params.latency_multiplier}x multiplier`);
  if (params.error_rate !== undefined)
    parts.push(`${(params.error_rate * 100).toFixed(0)}% error rate`);
  if (params.duration_ms !== undefined) {
    const s = params.duration_ms / 1_000;
    parts.push(s >= 60 ? `for ${(s / 60).toFixed(1)}min` : `for ${s}s`);
  }
  if (params.traffic_percentage !== undefined)
    parts.push(`${(params.traffic_percentage * 100).toFixed(0)}% traffic`);

  return parts.join(' | ');
}
