/**
 * Article API Routes
 *
 * REST endpoints for managing Articles in the GEO Platform.
 * Includes CRUD operations and workflow state transitions.
 *
 * @module api/routes/article.routes
 * @version 1.0.0
 */

import { Hono } from 'hono';
import {
  ArticleService,
  InMemoryArticleRepository,
  InMemoryArticleVersionRepository,
} from '../../article/article.service';
import type {
  ArticleId,
  ArticleVersionId,
  ClearStoryId,
  CustomerId,
  UserId,
  ArticleStatus,
  PaginationParams,
  UserRef,
} from '../../shared/shared.types';
import type {
  CreateArticleInput,
  UpdateArticleInput,
} from '../../article/article.repository';

const app = new Hono();

// Initialize service with in-memory repositories
const articleRepository = new InMemoryArticleRepository();
const versionRepository = new InMemoryArticleVersionRepository();
const service = new ArticleService(articleRepository, versionRepository);

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
 * GET / - List Articles with pagination
 */
app.get('/', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId | undefined;
    const status = c.req.query('status') as ArticleStatus | undefined;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

    if (status && customerId) {
      const articles = await service.getArticlesByStatus(status, customerId);
      return c.json({
        data: articles,
        pagination: {
          page: 1,
          pageSize: articles.length,
          totalItems: articles.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    }

    if (customerId) {
      const pagination: PaginationParams = { page, pageSize };
      const result = await service.getArticlesByCustomer(customerId, pagination);
      return c.json(result);
    }

    // Return empty result if no customer ID provided
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
 * GET /:id - Get Article by ID
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id') as ArticleId;
    const article = await service.getArticleById(id);

    if (!article) {
      return c.json({ error: 'Article not found' }, 404);
    }

    return c.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST / - Create a new Article
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json<Omit<CreateArticleInput, 'createdBy'>>();
    const userRef = getUserRef(c);

    const input: CreateArticleInput = {
      ...body,
      createdBy: userRef,
    };

    const article = await service.createArticle(input);
    return c.json(article, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

/**
 * PUT /:id - Update an Article
 */
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id') as ArticleId;
    const body = await c.req.json<Omit<UpdateArticleInput, 'updatedBy'>>();
    const userRef = getUserRef(c);

    const input: UpdateArticleInput = {
      ...body,
      updatedBy: userRef,
    };

    const article = await service.updateArticle(id, input);
    return c.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * DELETE /:id - Delete an Article
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id') as ArticleId;

    const deleted = await service.deleteArticle(id);
    if (!deleted) {
      return c.json({ error: 'Article not found' }, 404);
    }

    return c.json({ success: true, message: 'Article deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// WORKFLOW TRANSITIONS
// =============================================================================

/**
 * POST /:id/submit-review - Submit article for review
 */
app.post('/:id/submit-review', async (c) => {
  try {
    const id = c.req.param('id') as ArticleId;
    const userRef = getUserRef(c);

    const article = await service.submitForReview(id, userRef);
    return c.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    if (message.includes('Invalid status')) {
      return c.json({ error: message }, 400);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/approve - Approve article for publishing
 */
app.post('/:id/approve', async (c) => {
  try {
    const id = c.req.param('id') as ArticleId;
    const userRef = getUserRef(c);

    const article = await service.approve(id, userRef);
    return c.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    if (message.includes('Invalid status')) {
      return c.json({ error: message }, 400);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/request-revision - Request revision on article
 */
app.post('/:id/request-revision', async (c) => {
  try {
    const id = c.req.param('id') as ArticleId;
    const body = await c.req.json<{ feedback: string }>();
    const userRef = getUserRef(c);

    if (!body.feedback) {
      return c.json({ error: 'Feedback is required' }, 400);
    }

    const article = await service.requestRevision(id, body.feedback, userRef);
    return c.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    if (message.includes('Invalid status')) {
      return c.json({ error: message }, 400);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/publish - Publish an approved article
 */
app.post('/:id/publish', async (c) => {
  try {
    const id = c.req.param('id') as ArticleId;
    const body = await c.req.json<{ publishedUrl: string }>();

    if (!body.publishedUrl) {
      return c.json({ error: 'Published URL is required' }, 400);
    }

    const article = await service.publish(id, body.publishedUrl);
    return c.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    if (message.includes('Invalid status')) {
      return c.json({ error: message }, 400);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/archive - Archive an article
 */
app.post('/:id/archive', async (c) => {
  try {
    const id = c.req.param('id') as ArticleId;

    const article = await service.archive(id);
    return c.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    if (message.includes('Invalid status')) {
      return c.json({ error: message }, 400);
    }
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// VERSIONING ENDPOINTS
// =============================================================================

/**
 * GET /:id/versions - Get all versions of an article
 */
app.get('/:id/versions', async (c) => {
  try {
    const id = c.req.param('id') as ArticleId;

    const versions = await service.getVersions(id);
    return c.json({ data: versions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/versions/:versionId/revert - Revert to a specific version
 */
app.post('/:id/versions/:versionId/revert', async (c) => {
  try {
    const id = c.req.param('id') as ArticleId;
    const versionId = c.req.param('versionId') as ArticleVersionId;

    const article = await service.revertToVersion(id, versionId);
    return c.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

// =============================================================================
// QUERY ENDPOINTS
// =============================================================================

/**
 * GET /by-status/:status - Get articles by status
 */
app.get('/by-status/:status', async (c) => {
  try {
    const status = c.req.param('status') as ArticleStatus;
    const customerId = c.req.query('customerId') as CustomerId | undefined;

    const articles = await service.getArticlesByStatus(status, customerId);
    return c.json({ data: articles });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /by-clear-story/:clearStoryId - Get articles by Clear Story
 */
app.get('/by-clear-story/:clearStoryId', async (c) => {
  try {
    const clearStoryId = c.req.param('clearStoryId') as ClearStoryId;

    const articles = await service.getArticlesByClearStory(clearStoryId);
    return c.json({ data: articles });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export default app;
