/**
 * @fileoverview Hackathon demo scenario fixtures.
 *
 * Three pre-configured high-impact architecture graphs for the three
 * presentation demo scenarios:
 *
 *   1. "The Black Friday Cascade"  — Redis latency → thread starvation → gateway down
 *   2. "The Silent Payment Hang"   — Stripe hangs 30s → DB pool drain → order service dead
 *   3. "The Self-Healing Test"     — Circuit breakers + fallbacks absorb auth-service failure
 *
 * Each graph is deliberately crafted to showcase the specific failure mode
 * and its blast radius in the most dramatic (and realistic) way possible.
 */

import type { DigitalTwinSchema } from '../../../shared/types/agent.ts';

// ---------------------------------------------------------------------------
// Demo 1 — "The Black Friday Cascade"
//
// Topology:  cdn-edge → api-gateway → order-service → redis-cache
//                                  ↘ inventory-service → redis-cache
//                                  ↘ user-service     → postgres-users
//
// Failure:  Redis cache latency spikes to 5000ms (no circuit breakers anywhere)
//           → thread starvation on order-service and inventory-service
//           → API Gateway exhausts connection pool
//           → CDN edge times out, serving 503 to all users
// ---------------------------------------------------------------------------

export const blackFridayCascadeGraph: DigitalTwinSchema = {
  version: '1.0.0',
  project_name: 'black-friday-platform',
  nodes: [
    {
      id: 'cdn-edge',
      name: 'CDN Edge',
      type: 'gateway',
      file_path: 'src/edge/cdn.ts',
      config: {
        timeout_ms: 3000,
        circuit_breaker: false,
        pool_size: 500,
      },
    },
    {
      id: 'api-gateway',
      name: 'API Gateway',
      type: 'gateway',
      file_path: 'src/gateway/server.ts',
      config: {
        timeout_ms: 5000,
        circuit_breaker: false,
        pool_size: 200,
        max_retries: 3,
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
        pool_size: 100,
      },
    },
    {
      id: 'inventory-service',
      name: 'Inventory Service',
      type: 'service',
      file_path: 'src/services/inventory.ts',
      config: {
        timeout_ms: 2000,
        max_retries: 4,
        circuit_breaker: false,
        fallback_enabled: false,
        pool_size: 80,
      },
    },
    {
      id: 'user-service',
      name: 'User Service',
      type: 'service',
      file_path: 'src/services/user.ts',
      config: {
        timeout_ms: 2000,
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
      id: 'postgres-users',
      name: 'Users PostgreSQL DB',
      type: 'database',
      file_path: 'src/db/users.ts',
      config: {
        pool_size: 150,
        timeout_ms: 3000,
      },
    },
  ],
  edges: [
    { source: 'cdn-edge', target: 'api-gateway', protocol: 'http', sync: true },
    { source: 'api-gateway', target: 'order-service', protocol: 'http', sync: true, critical: true },
    { source: 'api-gateway', target: 'inventory-service', protocol: 'http', sync: true },
    { source: 'api-gateway', target: 'user-service', protocol: 'http', sync: true },
    { source: 'order-service', target: 'redis-cache', protocol: 'redis', sync: true, critical: true },
    { source: 'inventory-service', target: 'redis-cache', protocol: 'redis', sync: true },
    { source: 'user-service', target: 'postgres-users', protocol: 'sql', sync: true },
  ],
};

/** Canonical scenario prompt for Demo 1. */
export const blackFridayPrompt =
  'What happens if Redis cache latency spikes to 5000ms during Black Friday peak traffic?';

// ---------------------------------------------------------------------------
// Demo 2 — "The Silent Payment Hang"
//
// Topology:  checkout-service → stripe-api (hangs 30s, no timeout, infinite retry)
//                             → order-db  (connection pool drained by blocked threads)
//                             → audit-queue
//
// Failure:  Stripe API hangs indefinitely — threads are blocked waiting,
//           DB connection pool drains as more requests arrive,
//           order-db becomes unreachable, checkout-service dies silently
// ---------------------------------------------------------------------------

export const silentPaymentHangGraph: DigitalTwinSchema = {
  version: '1.0.0',
  project_name: 'payment-platform',
  nodes: [
    {
      id: 'checkout-service',
      name: 'Checkout Service',
      type: 'service',
      file_path: 'src/services/checkout.ts',
      config: {
        // No timeout — threads block indefinitely
        max_retries: 10,
        circuit_breaker: false,
        fallback_enabled: false,
        pool_size: 50,
      },
    },
    {
      id: 'stripe-api',
      name: 'Stripe Payment API',
      type: 'external_api',
      file_path: 'src/clients/stripe.ts',
      config: {
        // Intentionally no timeout — demonstrates the hang
        circuit_breaker: false,
        fallback_enabled: false,
      },
    },
    {
      id: 'order-db',
      name: 'Orders Database',
      type: 'database',
      file_path: 'src/db/orders.ts',
      config: {
        pool_size: 20,
        timeout_ms: 5000,
      },
    },
    {
      id: 'audit-queue',
      name: 'Audit Event Queue',
      type: 'queue',
      file_path: 'src/queues/audit.ts',
      config: {
        circuit_breaker: false,
      },
    },
  ],
  edges: [
    { source: 'checkout-service', target: 'stripe-api', protocol: 'http', sync: true, critical: true },
    { source: 'checkout-service', target: 'order-db', protocol: 'sql', sync: true },
    { source: 'checkout-service', target: 'audit-queue', protocol: 'amqp', sync: false },
  ],
};

/** Canonical scenario prompt for Demo 2. */
export const silentPaymentHangPrompt =
  'What if the Stripe Payment API hangs for 30 seconds with no response?';

// ---------------------------------------------------------------------------
// Demo 3 — "The Microservice Self-Healing Test"
//
// Topology:  web-frontend → auth-service  (has CB + fallback)
//                         → product-service (has CB, no fallback)
//                         → recommendation-engine (no CB, no fallback)
//
// Failure:  auth-service goes completely down — demonstrates how circuit
//           breakers + fallbacks absorb the failure vs propagation without them.
//           Expected result: web-frontend degrades gracefully for auth,
//           product-service trips its circuit breaker,
//           recommendation-engine cascades fully.
// ---------------------------------------------------------------------------

export const selfHealingTestGraph: DigitalTwinSchema = {
  version: '1.0.0',
  project_name: 'self-healing-demo',
  nodes: [
    {
      id: 'web-frontend',
      name: 'Web Frontend BFF',
      type: 'service',
      file_path: 'src/bff/frontend.ts',
      config: {
        timeout_ms: 5000,
        circuit_breaker: true,
        fallback_enabled: true,
        pool_size: 50,
      },
    },
    {
      id: 'auth-service',
      name: 'Auth Service',
      type: 'service',
      file_path: 'src/services/auth.ts',
      config: {
        timeout_ms: 2000,
        circuit_breaker: true,
        fallback_enabled: true,
      },
    },
    {
      id: 'product-service',
      name: 'Product Catalog Service',
      type: 'service',
      file_path: 'src/services/product.ts',
      config: {
        timeout_ms: 3000,
        circuit_breaker: true,
        fallback_enabled: false, // CB trips but no fallback — degraded
      },
    },
    {
      id: 'recommendation-engine',
      name: 'Recommendation Engine',
      type: 'service',
      file_path: 'src/services/recommendations.ts',
      config: {
        timeout_ms: 4000,
        max_retries: 5,
        circuit_breaker: false,
        fallback_enabled: false, // fully unprotected
      },
    },
    {
      id: 'session-cache',
      name: 'Session Redis Cache',
      type: 'cache',
      file_path: 'src/cache/sessions.ts',
      config: {
        pool_size: 30,
        timeout_ms: 500,
        circuit_breaker: false,
        fallback_enabled: false,
      },
    },
  ],
  edges: [
    { source: 'web-frontend', target: 'auth-service', protocol: 'grpc', sync: true, critical: true },
    { source: 'web-frontend', target: 'product-service', protocol: 'http', sync: true },
    { source: 'web-frontend', target: 'recommendation-engine', protocol: 'http', sync: true },
    { source: 'auth-service', target: 'session-cache', protocol: 'redis', sync: true },
  ],
};

/** Canonical scenario prompt for Demo 3. */
export const selfHealingPrompt =
  'What if auth-service fails completely during peak traffic?';
