/**
 * Reddit Distribution API Routes
 *
 * REST endpoints for managing Reddit posts in the GEO Platform.
 * Includes CRUD operations, lifecycle management, and engagement tracking.
 *
 * @module api/routes/reddit-distribution.routes
 * @version 1.0.0
 */

import { Hono } from 'hono';
import {
  createRedditDistributionService,
} from '../../reddit-distribution/reddit-distribution.service';
import type {
  RedditPostId,
  ArticleId,
  CustomerId,
  UserId,
  SubredditId,
  RedditPostStatus,
  ISOTimestamp,
  PaginationParams,
  UserRef,
} from '../../shared/shared.types';
import type {
  CreateRedditPostInput,
} from '../../reddit-distribution/reddit-distribution.repository';

const app = new Hono();

// Initialize service with in-memory repositories
const service = createRedditDistributionService();

/**
 * Helper to create a UserRef from request headers
 */
function getUserRef(c: { req: { header: (name: string) => string | undefined } }): UserRef {
  const userId = c.req.header('X-User-Id') || 'usr_anonymous';
  const userEmail = c.req.header('X-User-Email') || 'anonymous@example.com';
  const userName = c.req.header('X-User-Name') || 'Anonymous User';

  return {
    id: userId as UserId,
    email: userEmail,
    displayName: userName,
  };
}

// =============================================================================
// CRUD ENDPOINTS
// =============================================================================

/**
 * GET / - List Reddit posts with pagination
 */
app.get('/', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId | undefined;
    const status = c.req.query('status') as RedditPostStatus | undefined;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

    if (status) {
      const posts = await service.getPostsByStatus(status, customerId);
      return c.json({
        data: posts,
        pagination: {
          page: 1,
          pageSize: posts.length,
          totalItems: posts.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    }

    if (customerId) {
      const pagination: PaginationParams = { page, pageSize };
      const result = await service.getPostsByCustomer(customerId, pagination);
      return c.json(result);
    }

    return c.json({
      data: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:id - Get Reddit post by ID
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id') as RedditPostId;
    const post = await service.getPostById(id);

    if (!post) {
      return c.json({ error: 'Reddit post not found' }, 404);
    }

    return c.json(post);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST / - Create a new Reddit post
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json<CreateRedditPostInput>();

    const post = await service.createPost(body);
    return c.json(post, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

/**
 * PUT /:id - Update a Reddit post
 */
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id') as RedditPostId;
    const body = await c.req.json<{
      title?: string;
      body?: string;
      subreddit?: string;
      flair?: string;
      scheduledFor?: ISOTimestamp;
    }>();
    const userRef = getUserRef(c);

    const post = await service.updatePost(id, {
      ...body,
      updatedBy: userRef,
    });
    return c.json(post);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * DELETE /:id - Delete a Reddit post
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id') as RedditPostId;

    const deleted = await service.deletePost(id);
    if (!deleted) {
      return c.json({ error: 'Reddit post not found' }, 404);
    }

    return c.json({ success: true, message: 'Reddit post deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// LIFECYCLE ENDPOINTS
// =============================================================================

/**
 * POST /:id/approve - Approve a Reddit post
 */
app.post('/:id/approve', async (c) => {
  try {
    const id = c.req.param('id') as RedditPostId;
    const body = await c.req.json<{
      edits?: {
        title?: string;
        body?: string;
        subreddit?: string;
        flair?: string;
      };
      autoQueue?: boolean;
      scheduledFor?: ISOTimestamp;
    }>();
    const userRef = getUserRef(c);

    const post = await service.approvePost({
      postId: id,
      approvedBy: userRef,
      ...body,
    });
    return c.json(post);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /:id/reject - Reject a Reddit post
 */
app.post('/:id/reject', async (c) => {
  try {
    const id = c.req.param('id') as RedditPostId;
    const body = await c.req.json<{ reason: string }>();
    const userRef = getUserRef(c);

    if (!body.reason) {
      return c.json({ error: 'Rejection reason is required' }, 400);
    }

    const post = await service.rejectPost(id, body.reason, userRef);
    return c.json(post);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /:id/queue - Queue a post for submission
 */
app.post('/:id/queue', async (c) => {
  try {
    const id = c.req.param('id') as RedditPostId;
    const body = await c.req.json<{
      scheduledFor: ISOTimestamp;
      priority?: number;
    }>();

    if (!body.scheduledFor) {
      return c.json({ error: 'Scheduled time is required' }, 400);
    }

    const post = await service.queuePost({
      postId: id,
      scheduledFor: body.scheduledFor,
      priority: body.priority,
    });
    return c.json(post);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /:id/submit - Submit a post to Reddit
 */
app.post('/:id/submit', async (c) => {
  try {
    const id = c.req.param('id') as RedditPostId;

    const result = await service.submitPost(id);
    if (!result.success) {
      return c.json(result, result.retryable ? 429 : 400);
    }

    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/retry - Retry a failed post
 */
app.post('/:id/retry', async (c) => {
  try {
    const id = c.req.param('id') as RedditPostId;

    const post = await service.retryPost(id);
    return c.json(post);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

// =============================================================================
// ENGAGEMENT ENDPOINTS
// =============================================================================

/**
 * POST /:id/refresh-engagement - Refresh engagement metrics
 */
app.post('/:id/refresh-engagement', async (c) => {
  try {
    const id = c.req.param('id') as RedditPostId;
    const body = await c.req.json<{ force?: boolean }>();

    const result = await service.refreshEngagement({
      postId: id,
      force: body?.force,
    });
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /bulk/refresh-engagement - Bulk refresh engagement
 */
app.post('/bulk/refresh-engagement', async (c) => {
  try {
    const body = await c.req.json<{
      postIds: RedditPostId[];
      minAgeMinutes?: number;
    }>();

    if (!body.postIds || body.postIds.length === 0) {
      return c.json({ error: 'Post IDs are required' }, 400);
    }

    const results = await service.bulkRefreshEngagement(body);
    return c.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// QUERY ENDPOINTS
// =============================================================================

/**
 * GET /by-article/:articleId - Get posts by article
 */
app.get('/by-article/:articleId', async (c) => {
  try {
    const articleId = c.req.param('articleId') as ArticleId;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

    const pagination: PaginationParams = { page, pageSize };
    const result = await service.getPostsByArticle(articleId, pagination);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /scheduled - Get scheduled posts in time range
 */
app.get('/scheduled', async (c) => {
  try {
    const startTime = c.req.query('startTime') as ISOTimestamp;
    const endTime = c.req.query('endTime') as ISOTimestamp;
    const customerId = c.req.query('customerId') as CustomerId | undefined;

    if (!startTime || !endTime) {
      return c.json({ error: 'Start time and end time are required' }, 400);
    }

    const posts = await service.getScheduledPosts(startTime, endTime, customerId);
    return c.json({ data: posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// SUBREDDIT MANAGEMENT
// =============================================================================

/**
 * GET /subreddits - Get tracked subreddits for customer
 */
app.get('/subreddits', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const subreddits = await service.getTrackedSubreddits(customerId);
    return c.json({ data: subreddits });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /subreddits/track - Track a new subreddit
 */
app.post('/subreddits/track', async (c) => {
  try {
    const body = await c.req.json<{
      subredditName: string;
      customerId: CustomerId;
      topics?: string[];
      syncRulesNow?: boolean;
    }>();
    const userRef = getUserRef(c);

    if (!body.subredditName || !body.customerId) {
      return c.json({ error: 'Subreddit name and customer ID are required' }, 400);
    }

    const subreddit = await service.trackSubreddit({
      ...body,
      trackedBy: userRef,
    });
    return c.json(subreddit, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

/**
 * DELETE /subreddits/:subredditId - Untrack a subreddit
 */
app.delete('/subreddits/:subredditId', async (c) => {
  try {
    const subredditId = c.req.param('subredditId') as SubredditId;
    const customerId = c.req.query('customerId') as CustomerId;

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const untracked = await service.untrackSubreddit(subredditId, customerId);
    if (!untracked) {
      return c.json({ error: 'Subreddit not found' }, 404);
    }

    return c.json({ success: true, message: 'Subreddit untracked' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * GET /rate-limit - Get rate limit status for customer
 */
app.get('/rate-limit', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const status = await service.getRateLimitStatus(customerId);
    return c.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /can-post - Check if customer can post
 */
app.get('/can-post', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const canPost = await service.canPost(customerId);
    return c.json({ canPost });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export default app;
