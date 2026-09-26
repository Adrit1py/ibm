/**
 * @fileoverview Test fixtures — sample architecture graphs for agent testing.
 *
 * Each fixture is a `DigitalTwinSchema` with deliberate resilience gaps:
 *   - `redis-cache`: Oversized pool (200), tight timeout (200ms)
 *   - `order-service`: 5 retries without jitter, no circuit breaker, no fallback
 *   - `postgres-db`: Oversized pool (150)
 *   - `payment-api`: No circuit breaker, no fallback
 *   - `api-gateway`: No circuit breaker
 *
 * Topology:  api-gateway → order-service → { redis-cache, payment-api, postgres-db }
 */

import type { DigitalTwinSchema } from '../../../shared/types/agent.ts';

/** A 5-node e-commerce platform with intentional resilience gaps. */
export const sampleEcommerceGraph: DigitalTwinSchema = {
  version: '1.0.0',
  project_name: 'ecommerce-platform',
  nodes: [
    {
      id: 'api-gateway',
      name: 'API Gateway',
      type: 'gateway',
      file_path: 'src/gateway/server.ts',
      config: {
        timeout_ms: 5000,
        circuit_breaker: false,
      },
    },
    {
      id: 'order-service',
      name: 'Order Service',
      type: 'service',
      file_path: 'src/services/order.ts',
      config: {
        timeout_ms: 3000,
        max_retries: 5,
        circuit_breaker: false,
        fallback_enabled: false,
      },
    },
    {
      id: 'redis-cache',
      name: 'Redis Cache',
      type: 'cache',
      file_path: 'src/cache/redis.ts',
      config: {
        pool_size: 200,
        timeout_ms: 200,
      },
    },
    {
      id: 'payment-api',
      name: 'Stripe Payment API',
      type: 'external_api',
      file_path: 'src/clients/payment.ts',
      config: {
        timeout_ms: 8000,
        circuit_breaker: false,
        fallback_enabled: false,
      },
    },
    {
      id: 'postgres-db',
      name: 'Orders PostgreSQL DB',
      type: 'database',
      file_path: 'src/db/client.ts',
      config: {
        pool_size: 150,
        timeout_ms: 2000,
      },
    },
  ],
  edges: [
    {
      source: 'api-gateway',
      target: 'order-service',
      protocol: 'http',
      sync: true,
    },
    {
      source: 'order-service',
      target: 'redis-cache',
      protocol: 'redis',
      sync: true,
    },
    {
      source: 'order-service',
      target: 'payment-api',
      protocol: 'http',
      sync: true,
    },
    {
      source: 'order-service',
      target: 'postgres-db',
      protocol: 'sql',
      sync: true,
    },
  ],
};

/** A minimal graph with a single resilient node (circuit breaker + fallback). */
export const resilientSingleNodeGraph: DigitalTwinSchema = {
  version: '1.0.0',
  project_name: 'resilient-app',
  nodes: [
    {
      id: 'web-server',
      name: 'Web Server',
      type: 'service',
      file_path: 'src/server.ts',
      config: {
        timeout_ms: 3000,
        circuit_breaker: true,
        fallback_enabled: true,
        pool_size: 50,
      },
    },
    {
      id: 'upstream-api',
      name: 'Upstream API',
      type: 'external_api',
      file_path: 'src/api.ts',
      config: {
        timeout_ms: 5000,
      },
    },
  ],
  edges: [
    {
      source: 'web-server',
      target: 'upstream-api',
      protocol: 'http',
      sync: true,
    },
  ],
};
