/**
 * @fileoverview Tests for the advanced NLP scenario parser.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseScenario } from '../src/parser/scenario_parser.ts';

describe('ScenarioParser', () => {
  test('Detects complete_failure from "crashes"', () => {
    const result = parseScenario('What if Redis crashes and goes down?');
    assert.equal(result.scenario_type, 'complete_failure');
  });

  test('Detects network_partition from "drops packets"', () => {
    const result = parseScenario('What if Redis drops packets for 30s?');
    assert.equal(result.scenario_type, 'network_partition');
    assert.equal(result.parameters.duration_ms, 30_000);
    assert.equal(result.is_quantified, true);
  });

  test('Detects latency_degradation from "5000ms"', () => {
    const result = parseScenario('What if Stripe API latency increases by 5000ms?');
    assert.equal(result.scenario_type, 'latency_degradation');
    assert.equal(result.parameters.latency_increase_ms, 5000);
    assert.equal(result.is_quantified, true);
  });

  test('Extracts latency multiplier from "10x slower"', () => {
    const result = parseScenario('What if the payment service becomes 10x slower?');
    assert.equal(result.scenario_type, 'latency_degradation');
    assert.equal(result.parameters.latency_multiplier, 10);
  });

  test('Extracts error rate percentage', () => {
    const result = parseScenario('What if auth-service has a 90% error rate?');
    assert.ok(Math.abs((result.parameters.error_rate ?? 0) - 0.9) < 0.01);
    assert.equal(result.is_quantified, true);
  });

  test('Extracts duration in minutes', () => {
    const result = parseScenario('What if Redis cache crashes and stays down for 1 minute?');
    assert.equal(result.parameters.duration_ms, 60_000);
  });

  test('Extracts traffic percentage', () => {
    const result = parseScenario('What if 50% of requests to order-service fail?');
    assert.ok(Math.abs((result.parameters.traffic_percentage ?? 0) - 0.5) < 0.01);
  });

  test('Extracts hyphenated service names as targets', () => {
    const result = parseScenario('What if order-service and auth-service both fail?');
    assert.ok(result.target_mentions.some((t) => t.includes('order-service') || t.includes('order')));
    assert.ok(result.target_mentions.some((t) => t.includes('auth-service') || t.includes('auth')));
  });

  test('Extracts well-known infra names as targets', () => {
    const result = parseScenario('What if Redis and Postgres both go down?');
    assert.ok(result.target_mentions.includes('redis'));
    assert.ok(result.target_mentions.includes('postgres'));
  });

  test('Returns unknown type for generic prompt', () => {
    const result = parseScenario('Something bad happens');
    assert.equal(result.scenario_type, 'unknown');
    assert.equal(result.is_quantified, false);
  });

  test('Preserves original prompt unchanged', () => {
    const prompt = 'What if Redis drops packets for 30s?';
    const result = parseScenario(prompt);
    assert.equal(result.original_prompt, prompt);
  });

  test('Summary includes type and quantified params', () => {
    const result = parseScenario('What if Stripe API latency increases by 5000ms?');
    assert.ok(result.summary.includes('5000'), 'Summary should include latency value');
  });

  test('Is deterministic — same input always same output', () => {
    const prompt = 'What if auth-service fails with 90% error rate for 30s?';
    const r1 = parseScenario(prompt);
    const r2 = parseScenario(prompt);
    assert.deepEqual(r1, r2);
  });
});
