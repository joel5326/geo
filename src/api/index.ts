/**
 * GEO Platform - Main API Entry Point
 *
 * This module configures and exports the main Hono application that serves
 * as the REST API layer for all domain services. It mounts all domain routes
 * and configures middleware for logging, CORS, and error handling.
 *
 * @module api/index
 * @version 1.0.0
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';

// Import route modules
import clearStoryRoutes from './routes/clear-story.routes';
import articleRoutes from './routes/article.routes';
import redditRoutes from './routes/reddit-distribution.routes';
import schedulingRoutes from './routes/scheduling.routes';
import { usersApp, customersApp } from './routes/user-customer.routes';
import analyticsRoutes from './routes/analytics.routes';
import agentRoutes from './routes/agent-orchestration.routes';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface ApiInfo {
  name: string;
  version: string;
  description: string;
  documentation: string;
  endpoints: {
    path: string;
    description: string;
    methods: string[];
  }[];
}

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    name: string;
    status: 'ok' | 'error';
  }[];
}

// =============================================================================
// APPLICATION SETUP
// =============================================================================

const app = new Hono();

// Store server start time for uptime calculation
const serverStartTime = Date.now();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Request logging
app.use('*', logger());

// Pretty print JSON responses in development
app.use('*', prettyJSON());

// Secure HTTP headers
app.use('*', secureHeaders());

// CORS configuration
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-User-Email', 'X-User-Name', 'X-Request-Id'],
  exposeHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400,
  credentials: true,
}));

// Request ID middleware
app.use('*', async (c, next) => {
  const requestId = c.req.header('X-Request-Id') || `req_${crypto.randomUUID()}`;
  c.header('X-Request-Id', requestId);
  await next();
});

// API Key authentication middleware
// Skips auth for public endpoints (health, ready, live, root)
app.use('/api/*', async (c, next) => {
  const publicPaths = ['/', '/health', '/ready', '/live'];
  if (publicPaths.includes(c.req.path)) {
    return next();
  }

  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');
  const validApiKey = process.env.API_KEY;

  // If no API_KEY is configured, allow all requests (development mode)
  if (!validApiKey) {
    return next();
  }

  if (!apiKey || apiKey !== validApiKey) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing API key. Provide X-API-Key header or Bearer token.',
        },
      },
      401
    );
  }

  await next();
});

// =============================================================================
// ROOT AND INFO ENDPOINTS
// =============================================================================

/**
 * GET / - API root information
 */
app.get('/', (c) => {
  const info: ApiInfo = {
    name: 'GEO Platform API',
    version: '1.0.0',
    description: 'REST API for managing content automation, Reddit distribution, and analytics',
    documentation: '/api/docs',
    endpoints: [
      {
        path: '/api/clear-stories',
        description: 'Manage Clear Stories for content generation',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      },
      {
        path: '/api/articles',
        description: 'Manage articles and their workflow states',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      },
      {
        path: '/api/reddit-posts',
        description: 'Manage Reddit post distribution and engagement',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      },
      {
        path: '/api/schedules',
        description: 'Manage scheduled tasks and execution',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      },
      {
        path: '/api/users',
        description: 'User management and authentication',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      },
      {
        path: '/api/customers',
        description: 'Customer management, brand guidelines, and usage tracking',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      },
      {
        path: '/api/analytics',
        description: 'Analytics, reporting, and performance metrics',
        methods: ['GET', 'POST'],
      },
      {
        path: '/api/sessions',
        description: 'Claude agent session and workflow management',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      },
    ],
  };

  return c.json(info);
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (c) => {
  const status: HealthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    version: '1.0.0',
    services: [
      { name: 'clear-story', status: 'ok' },
      { name: 'article', status: 'ok' },
      { name: 'reddit-distribution', status: 'ok' },
      { name: 'scheduling', status: 'ok' },
      { name: 'user-customer', status: 'ok' },
      { name: 'analytics', status: 'ok' },
      { name: 'agent-orchestration', status: 'ok' },
    ],
  };

  return c.json(status);
});

/**
 * GET /ready - Readiness probe
 */
app.get('/ready', (c) => {
  return c.json({ ready: true });
});

/**
 * GET /live - Liveness probe
 */
app.get('/live', (c) => {
  return c.json({ alive: true });
});

// =============================================================================
// API ROUTES
// =============================================================================

// Mount domain routes
app.route('/api/clear-stories', clearStoryRoutes);
app.route('/api/articles', articleRoutes);
app.route('/api/reddit-posts', redditRoutes);
app.route('/api/schedules', schedulingRoutes);
app.route('/api/users', usersApp);
app.route('/api/customers', customersApp);
app.route('/api/analytics', analyticsRoutes);
app.route('/api/sessions', agentRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Global error handler
 */
app.onError((err, c) => {
  console.error('Unhandled error:', err);

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: {
          code: 'HTTP_ERROR',
          message: err.message,
          status: err.status,
        },
      },
      err.status
    );
  }

  // Log unexpected errors
  const errorId = `err_${crypto.randomUUID()}`;
  console.error(`Error ID: ${errorId}`, err);

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        errorId,
      },
    },
    500
  );
});

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${c.req.method} ${c.req.path}`,
      },
    },
    404
  );
});

// =============================================================================
// EXPORTS
// =============================================================================

export default app;

/**
 * Export the app for use in different environments
 */
export { app };

/**
 * Export types for consumers
 */
export type { ApiInfo, HealthStatus };
