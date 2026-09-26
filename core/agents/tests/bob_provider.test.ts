/**
 * @fileoverview Tests for OllamaLLMProvider (offline fallback path only).
 *
 * All tests here run fully offline — no Ollama connection required.
 * Live Ollama tests live in live_integration.test.ts (gated by OLLAMA_LIVE=1).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { OllamaLLMProvider, BobLLMProvider, WatsonxLLMProvider } from '../src/llm/watsonx.ts';
import { MockLLMProvider } from '../src/llm/mock_provider.ts';

describe('OllamaLLMProvider', () => {
  test('provider name is ollama-local', () => {
    const llm = new OllamaLLMProvider();
    assert.equal(llm.name, 'ollama-local');
  });

  test('falls back to mock when Ollama is unreachable (bad URL)', async () => {
    // Point at a port nothing is running on — should degrade to mock
    const llm = new OllamaLLMProvider({ baseUrl: 'http://localhost:19999/v1' });
    const result = await llm.generateCompletion('ping');
    // Mock returns a stub string — we just need it to not throw
    assert.ok(typeof result === 'string', 'Should return a string');
  });

  test('resolveModel returns configured model when Ollama unreachable', async () => {
    const llm = new OllamaLLMProvider({
      baseUrl: 'http://localhost:19999/v1',
      model: 'test-model',
    });
    const model = await llm.resolveModel();
    assert.equal(model, 'test-model', 'Falls back to configured model');
  });

  test('generateStructuredJson falls back to mock object when Ollama unreachable', async () => {
    const llm = new OllamaLLMProvider({ baseUrl: 'http://localhost:19999/v1' });
    const result = await llm.generateStructuredJson<{ status: string }>(
      'Parse this',
      '{ status: string }',
    );
    assert.ok(typeof result === 'object' && result !== null, 'Should return object');
  });

  test('BobLLMProvider alias resolves to OllamaLLMProvider', () => {
    const llm = new BobLLMProvider();
    assert.equal(llm.name, 'ollama-local');
    assert.ok(llm instanceof OllamaLLMProvider);
  });

  test('WatsonxLLMProvider alias resolves to OllamaLLMProvider (backward compat)', () => {
    const llm = new WatsonxLLMProvider();
    assert.equal(llm.name, 'ollama-local');
    assert.ok(llm instanceof OllamaLLMProvider);
  });
});
