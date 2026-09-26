/**
 * @fileoverview Pluggable LLM provider interface for IBM Bob 2.0 Agent Mode.
 *
 * All subagents receive an `LLMProvider` instance via dependency injection.
 * In production the provider calls IBM watsonx.ai / Granite endpoints;
 * during offline testing or CI it is swapped for `MockLLMProvider`.
 *
 * @module core/agents/llm/provider
 */

/** Options governing LLM inference behavior. */
export interface LLMRequestOptions {
  /** Sampling temperature (0.0 = deterministic, 1.0 = creative). */
  readonly temperature?: number;
  /** Maximum tokens to generate in the response. */
  readonly maxTokens?: number;
  /** System-level prompt prepended to the request. */
  readonly systemPrompt?: string;
  /** Model identifier override (e.g. "ibm/granite-13b-chat-v2"). */
  readonly model?: string;
}

/**
 * Abstract LLM provider contract.
 *
 * Implementations must be stateless with respect to conversation history —
 * each call is independent.
 */
export interface LLMProvider {
  /** Human-readable provider name for logging/diagnostics. */
  readonly name: string;

  /**
   * Generates a free-form text completion.
   *
   * @param prompt  - The input prompt.
   * @param options - Optional inference parameters.
   * @returns The generated text response.
   */
  generateCompletion(
    prompt: string,
    options?: LLMRequestOptions
  ): Promise<string>;

  /**
   * Generates a structured JSON response conforming to a described schema.
   *
   * @param prompt            - The input prompt.
   * @param schemaDescription - Plain-English description of the expected JSON shape.
   * @param options           - Optional inference parameters.
   * @returns The parsed JSON object of type `T`.
   */
  generateStructuredJson<T>(
    prompt: string,
    schemaDescription: string,
    options?: LLMRequestOptions
  ): Promise<T>;
}
