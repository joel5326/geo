/**
 * Clear Story API Routes
 *
 * REST endpoints for managing Clear Stories in the GEO Platform.
 *
 * @module api/routes/clear-story.routes
 * @version 1.0.0
 */

import { Hono } from 'hono';
import { ClearStoryService } from '../../clear-story/clear-story.service';
import { InMemoryClearStoryRepository } from '../../clear-story/clear-story.repository';
import type {
  ClearStoryId,
  CustomerId,
  UserId,
  PaginationParams,
} from '../../shared/shared.types';
import type {
  CreateClearStoryInput,
  UpdateClearStoryInput,
  ClearStorySearchParams,
} from '../../domains/clear-story/clear-story.types';

const app = new Hono();

// Initialize service with in-memory repository
const repository = new InMemoryClearStoryRepository();
const service = new ClearStoryService(repository);

// =============================================================================
// CRUD ENDPOINTS
// =============================================================================

/**
 * GET / - List Clear Stories with pagination and search
 */
app.get('/', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId | undefined;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);
    const query = c.req.query('query');
    const topic = c.req.query('topic');

    const searchParams: ClearStorySearchParams = {
      customerId,
      query,
      topic,
      pagination: { page, pageSize },
    };

    const result = await service.search(searchParams);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:id - Get Clear Story by ID
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id') as ClearStoryId;
    const story = await service.getById(id);

    if (!story) {
      return c.json({ error: 'Clear Story not found' }, 404);
    }

    return c.json(story);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST / - Create a new Clear Story
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json<CreateClearStoryInput>();
    const userId = c.req.header('X-User-Id') as UserId || 'usr_anonymous' as UserId;

    const story = await service.create(body, userId);
    return c.json(story, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

/**
 * PUT /:id - Update a Clear Story
 */
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id') as ClearStoryId;
    const body = await c.req.json<UpdateClearStoryInput>();
    const userId = c.req.header('X-User-Id') as UserId || 'usr_anonymous' as UserId;

    const story = await service.update(id, body, userId);
    return c.json(story);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * DELETE /:id - Soft delete (archive) a Clear Story
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id') as ClearStoryId;
    const userId = c.req.header('X-User-Id') as UserId || 'usr_anonymous' as UserId;

    await service.delete(id, userId);
    return c.json({ success: true, message: 'Clear Story archived' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// FINDER ENDPOINTS
// =============================================================================

/**
 * GET /customer/:customerId - Get Clear Stories by customer
 */
app.get('/customer/:customerId', async (c) => {
  try {
    const customerId = c.req.param('customerId') as CustomerId;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);
    const activeOnly = c.req.query('activeOnly') !== 'false';

    const pagination: PaginationParams = { page, pageSize };
    const result = await service.findByCustomer(customerId, activeOnly, pagination);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /popular/:customerId - Get most used Clear Stories
 */
app.get('/popular/:customerId', async (c) => {
  try {
    const customerId = c.req.param('customerId') as CustomerId;
    const limit = parseInt(c.req.query('limit') || '10', 10);

    const stories = await service.getPopular(customerId, limit);
    return c.json({ data: stories });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /recent/:customerId - Get recently created Clear Stories
 */
app.get('/recent/:customerId', async (c) => {
  try {
    const customerId = c.req.param('customerId') as CustomerId;
    const limit = parseInt(c.req.query('limit') || '10', 10);

    const stories = await service.getRecent(customerId, limit);
    return c.json({ data: stories });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /stats/:customerId - Get Clear Story statistics
 */
app.get('/stats/:customerId', async (c) => {
  try {
    const customerId = c.req.param('customerId') as CustomerId;

    const stats = await service.getStats(customerId);
    return c.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// USAGE TRACKING
// =============================================================================

/**
 * POST /:id/usage - Increment usage count
 */
app.post('/:id/usage', async (c) => {
  try {
    const id = c.req.param('id') as ClearStoryId;

    const story = await service.incrementUsageCount(id);
    return c.json(story);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * POST /bulk - Perform bulk operations on Clear Stories
 */
app.post('/bulk', async (c) => {
  try {
    const body = await c.req.json<{
      operation: 'activate' | 'pause' | 'archive' | 'delete' | 'addTags' | 'removeTags';
      ids: ClearStoryId[];
      data?: { tags?: string[] };
    }>();
    const userId = c.req.header('X-User-Id') as UserId || 'usr_anonymous' as UserId;

    const result = await service.bulkOperation(body, userId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

export default app;
