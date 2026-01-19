/**
 * GEO Platform - Vercel Serverless Entry Point
 *
 * This file exports the Hono app for Vercel's serverless environment.
 */

import { handle } from 'hono/vercel';
import app from '../src/api/index';

export const config = {
  runtime: 'edge',
};

export default handle(app);
