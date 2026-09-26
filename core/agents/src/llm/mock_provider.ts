/**
 * @fileoverview Deterministic mock LLM provider for offline testing and CI/CD.
 *
 * Enables the full agent orchestration pipeline to run without any external
 * API calls, producing reproducible results suitable for snapshot testing
 * and automated judging.
 *
 * @module core/agents/llm/mock_provider
 */

import type { LLMProvider, LLMRequestOptions } from './provider.ts';

/**
 * A mock LLM provider that returns deterministic responses.
 *
 * Custom responses can be injected via the constructor for scenario-specific
 * testing. If no custom match is found, a generic stub response is returned.
 *
 * @example
 * ```ts
 * const llm = new MockLLMProvider({
 *   'Redis': '{"analysis": "cache failure detected"}'
 * });
 * ```
 */
export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock-llm-provider';

  private readonly customResponses: ReadonlyMap<string, string>;

  constructor(customMocks?: Record<string, string>) {
    const entries = customMocks ? Object.entries(customMocks) : [];
    this.customResponses = new Map(entries);
  }

  async generateCompletion(
    prompt: string,
    _options?: LLMRequestOptions
  ): Promise<string> {
    for (const [key, response] of this.customResponses) {
      if (prompt.includes(key)) {
        return response;
      }
    }
    return `[Mock LLM] Deterministic stub for: "${prompt.slice(0, 80)}..."`;
  }

  async generateStructuredJson<T>(
    prompt: string,
    schemaDescription: string,
    _options?: LLMRequestOptions
  ): Promise<T> {
    for (const [key, response] of this.customResponses) {
      if (prompt.includes(key)) {
        return JSON.parse(response) as T;
      }
    }

    // When the schema description indicates an array is expected, return an
    // empty array so callers using Array.isArray() guards get a valid result
    // rather than a plain object that silently drops the enrichment.
    if (schemaDescription.includes('[]') || schemaDescription.startsWith('string[]')) {
      return [] as unknown as T;
    }

    return {
      status: 'mock_processed',
      prompt_summary: prompt.slice(0, 100),
    } as unknown as T;
  }
}
