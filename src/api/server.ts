/**
 * GEO Platform - HTTP Server Entry Point
 *
 * This module starts the HTTP server for the GEO Platform API.
 * It uses Node.js's native http module with Hono's node adapter.
 *
 * @module api/server
 * @version 1.0.0
 */

import { serve } from '@hono/node-server';
import app from './index';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// =============================================================================
// SERVER STARTUP
// =============================================================================

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   GEO Platform API                                               ║
║   Version: 1.0.0                                                 ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);

console.log('Starting server...');

serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  },
  (info) => {
    console.log(`
Server is running!

  Local:    http://localhost:${info.port}
  Network:  http://${HOST}:${info.port}

Available endpoints:
  GET  /              - API information
  GET  /health        - Health check
  GET  /ready         - Readiness probe
  GET  /live          - Liveness probe

API Routes:
  /api/clear-stories  - Clear Story management
  /api/articles       - Article management
  /api/reddit-posts   - Reddit post distribution
  /api/schedules      - Task scheduling
  /api/users          - User management
  /api/customers      - Customer management
  /api/analytics      - Analytics and reporting
  /api/sessions       - Agent orchestration

Press Ctrl+C to stop the server
`);
  }
);

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

const shutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
