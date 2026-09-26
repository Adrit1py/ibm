/**
 * @fileoverview Ollama LLM provider — local OpenAI-compatible inference engine.
 *
 * Targets the Ollama server running locally at `http://localhost:11434/v1`,
 * which exposes a full OpenAI-compatible `/v1/chat/completions` API.
 *
 * Model selection strategy (in priority order):
 *   1. Explicit `model` option passed per-call
 *   2. `OLLAMA_MODEL` environment variable
 *   3. Auto-detected "best" model from the running Ollama instance
 *   4. Hard-coded fallback: `qwen2.5-coder:7b`
 *
 * Environment variables:
 *   OLLAMA_BASE_URL  — Base URL (default: http://localhost:11434/v1)
 *   OLLAMA_MODEL     — Default model (default: qwen2.5-coder:7b)
 *
 * Offline / CI fallback: when Ollama is unreachable the provider
 * automatically delegates to `MockLLMProvider`, keeping all offline
 * tests fast and reproducible with zero network dependency.
 *
 * @module core/agents/llm/watsonx
 */

import type { LLMProvider, LLMRequestOptions } from './provider.ts';
import { MockLLMProvider } from './mock_provider.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'http://localhost:11434/v1';
const DEFAULT_MODEL = 'qwen2.5-coder:7b';

/**
 * Preference-ordered list of model names to auto-select when no explicit
 * model is configured. First match found in the running Ollama instance wins.
 */
const MODEL_PREFERENCE: readonly string[] = [
  'qwen2.5-coder:7b',   // Best for code + resilience analysis
  'deepseek-r1:8b',     // Strong reasoning, good for propagation tracing
  'qwen3:8b',           // General purpose
  'llama3.1:8b',        // Reliable fallback
];

// ---------------------------------------------------------------------------
// Types (OpenAI-compatible subset)
// ---------------------------------------------------------------------------

interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

interface ChatCompletionRequest {
  readonly model: string;
  readonly messages: ChatMessage[];
  readonly max_tokens?: number;
  readonly temperature?: number;
  readonly stream?: false;
}

interface ChatCompletionResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly content?: string };
  }>;
}

interface OllamaModelsResponse {
  readonly data?: ReadonlyArray<{ readonly id?: string }>;
}

// ---------------------------------------------------------------------------
// OllamaLLMProvider
// ---------------------------------------------------------------------------

/**
 * LLM provider targeting the local Ollama inference server.
 *
 * Ollama exposes a full OpenAI-compatible API at `/v1/chat/completions`.
 * Falls back to `MockLLMProvider` when Ollama is not reachable, so
 * all unit tests remain offline and deterministic.
 *
 * @example
 * ```ts
 * // Uses OLLAMA_MODEL env var or auto-detects best available model
 * const llm = new OllamaLLMProvider();
 *
 * // Explicit model override
 * const llm = new OllamaLLMProvider({ model: 'deepseek-r1:8b' });
 * ```
 */
export class OllamaLLMProvider implements LLMProvider {
  readonly name = 'ollama-local';

  private readonly baseUrl: string;
  private readonly configuredModel: string;
  private readonly apiKey: string;
  private readonly fallback: MockLLMProvider;

  /** Cached result of model auto-detection (null = not yet resolved). */
  private resolvedModel: string | null = null;

  constructor(opts?: { baseUrl?: string; model?: string; apiKey?: string }) {
    this.baseUrl =
      (opts?.baseUrl ?? process.env['OLLAMA_BASE_URL'] ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.configuredModel = opts?.model ?? process.env['OLLAMA_MODEL'] ?? DEFAULT_MODEL;
    this.apiKey = opts?.apiKey ?? process.env['BOB_API_KEY'] ?? '';
    this.fallback = new MockLLMProvider();
  }

  // -------------------------------------------------------------------------
  // LLMProvider implementation
  // -------------------------------------------------------------------------

  async generateCompletion(
    prompt: string,
    options?: LLMRequestOptions,
  ): Promise<string> {
    const model = options?.model ?? (await this.resolveModel());

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          options?.systemPrompt ??
          'You are an expert in distributed systems resilience engineering and chaos analysis. ' +
          'Provide precise, technical, and actionable analysis. Be concise and data-driven.',
      },
      { role: 'user', content: prompt },
    ];

    const body: ChatCompletionRequest = {
      model,
      messages,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.2,
      stream: false,
    };

    try {
      const data = await this.post<ChatCompletionResponse>(
        `${this.baseUrl}/chat/completions`,
        body,
      );
      return data.choices?.[0]?.message?.content ?? '';
    } catch {
      // If local Ollama is offline and an IBM Bob API key is present, route to IBM Cloud
      if (this.apiKey) {
        try {
          return await this.callBobCloud(prompt, options);
        } catch {
          // Cloud also failed — degrade to deterministic mock
        }
      }
      return this.fallback.generateCompletion(prompt, options);
    }
  }

  /** Calls the IBM Bob Cloud endpoint when local Ollama is unavailable. */
  private async callBobCloud(
    prompt: string,
    options?: LLMRequestOptions,
  ): Promise<string> {
    const cloudUrl =
      (process.env['BOB_API_BASE_URL'] ?? 'https://us-south.ml.cloud.ibm.com').replace(/\/$/, '') +
      '/ml/v1/text/chat?version=2024-05-01';

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          options?.systemPrompt ??
          'You are an expert in distributed systems resilience engineering and chaos analysis.',
      },
      { role: 'user', content: prompt },
    ];

    const body = {
      model: options?.model ?? process.env['BOB_MODEL'] ?? 'ibm/granite-3-8b-instruct',
      messages,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.2,
    };

    const res = await fetch(cloudUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`IBM Cloud Bob inference failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    return data.choices?.[0]?.message?.content ?? '';
  }

  async generateStructuredJson<T>(
    prompt: string,
    schemaDescription: string,
    options?: LLMRequestOptions,
  ): Promise<T> {
    const jsonPrompt =
      `${prompt}\n\n` +
      `Respond with ONLY a valid JSON object matching this schema:\n${schemaDescription}\n` +
      `Output raw JSON only — no prose, no markdown fences, no explanation.`;

    const raw = await this.generateCompletion(jsonPrompt, {
      ...options,
      temperature: 0.0,
    });

    // Strip accidental markdown fences
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      return this.fallback.generateStructuredJson<T>(prompt, schemaDescription, options);
    }
  }

  // -------------------------------------------------------------------------
  // Model resolution
  // -------------------------------------------------------------------------

  /**
   * Returns the best available model from the running Ollama instance.
   * Queries `/v1/models`, matches against `MODEL_PREFERENCE` list.
   * Result is cached after the first successful resolution.
   */
  async resolveModel(): Promise<string> {
    if (this.resolvedModel !== null) return this.resolvedModel;

    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        this.resolvedModel = this.configuredModel;
        return this.resolvedModel;
      }

      const data = (await res.json()) as OllamaModelsResponse;
      const available = new Set(
        (data.data ?? []).map((m) => m.id).filter(Boolean) as string[],
      );

      for (const preferred of MODEL_PREFERENCE) {
        if (available.has(preferred)) {
          this.resolvedModel = preferred;
          return this.resolvedModel;
        }
      }

      // None of the preferred models found — use first available or configured
      const first = data.data?.[0]?.id;
      this.resolvedModel = first ?? this.configuredModel;
      return this.resolvedModel;
    } catch {
      this.resolvedModel = this.configuredModel;
      return this.resolvedModel;
    }
  }

  // -------------------------------------------------------------------------
  // HTTP helper
  // -------------------------------------------------------------------------

  private async post<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OllamaLLMProvider: POST ${url} failed — HTTP ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }
}

// ---------------------------------------------------------------------------
// Named aliases (backward compatibility + plan naming)
// ---------------------------------------------------------------------------

/**
 * Primary exported name — use this for all new code.
 * @alias OllamaLLMProvider
 */
export const BobLLMProvider = OllamaLLMProvider;
export type BobLLMProvider = OllamaLLMProvider;

/**
 * @deprecated Kept for backward compat. Use `BobLLMProvider`.
 */
export const WatsonxLLMProvider = OllamaLLMProvider;
export type WatsonxLLMProvider = OllamaLLMProvider;

// ---------------------------------------------------------------------------
// Dedicated IBM Cloud Provider
// ---------------------------------------------------------------------------

/**
 * Dedicated LLM provider for the IBM Bob Cloud inference API.
 *
 * Calls `/ml/v1/text/chat?version=2024-05-01` on the IBM Cloud Watsonx endpoint
 * using the provided `BOB_API_KEY`.
 */
export class BobCloudLLMProvider implements LLMProvider {
  readonly name = 'bob-cloud-inference';

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fallback: MockLLMProvider;

  constructor(opts?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = opts?.apiKey ?? process.env['BOB_API_KEY'] ?? '';
    this.baseUrl =
      (opts?.baseUrl ?? process.env['BOB_API_BASE_URL'] ?? 'https://us-south.ml.cloud.ibm.com').replace(/\/$/, '');
    this.defaultModel = opts?.model ?? process.env['BOB_MODEL'] ?? 'ibm/granite-3-8b-instruct';
    this.fallback = new MockLLMProvider();
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async generateCompletion(
    prompt: string,
    options?: LLMRequestOptions,
  ): Promise<string> {
    if (!this.isConfigured) {
      return this.fallback.generateCompletion(prompt, options);
    }

    const messages = [
      {
        role: 'system',
        content:
          options?.systemPrompt ??
          'You are an expert in distributed systems resilience engineering. Be concise and technical.',
      },
      { role: 'user', content: prompt },
    ];

    const body = {
      model: options?.model ?? this.defaultModel,
      messages,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.2,
    };

    try {
      const res = await fetch(`${this.baseUrl}/ml/v1/text/chat?version=2024-05-01`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`BobCloudLLMProvider: HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content ?? '';
    } catch {
      return this.fallback.generateCompletion(prompt, options);
    }
  }

  async generateStructuredJson<T>(
    prompt: string,
    schemaDescription: string,
    options?: LLMRequestOptions,
  ): Promise<T> {
    if (!this.isConfigured) {
      return this.fallback.generateStructuredJson<T>(prompt, schemaDescription, options);
    }

    const jsonPrompt =
      `${prompt}\n\n` +
      `Respond with ONLY valid JSON matching this schema:\n${schemaDescription}\n` +
      `No prose, no markdown fences.`;

    const raw = await this.generateCompletion(jsonPrompt, {
      ...options,
      temperature: 0.0,
    });

    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      return this.fallback.generateStructuredJson<T>(prompt, schemaDescription, options);
    }
  }
}
