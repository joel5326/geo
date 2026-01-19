/**
 * Article Service Implementation
 *
 * This module implements the IArticleService interface for the Article domain.
 * Provides business logic for article lifecycle management including CRUD operations,
 * status transitions, versioning, and queries.
 *
 * @module article/article.service
 * @version 1.0.0
 */

import {
  ArticleId,
  ArticleVersionId,
  ClearStoryId,
  CustomerId,
  ArticleStatus,
  ContentTone,
  ISOTimestamp,
  UserRef,
  PaginatedResponse,
  PaginationParams,
  SearchParams,
  ARTICLE_MIN_WORDS,
  ARTICLE_MAX_WORDS,
  DEFAULT_PAGE_SIZE,
} from '../shared/shared.types';

import {
  Article,
  ArticleContent,
  ArticleVersion,
  CreateArticleInput,
  UpdateArticleInput,
  SeoMetadata,
  IArticleRepository,
  IArticleVersionRepository,
  InMemoryArticleRepository,
  InMemoryArticleVersionRepository,
} from './article.repository';

// =============================================================================
// ERROR CLASSES
// =============================================================================

/**
 * Error thrown when an article is not found.
 */
export class ArticleNotFoundError extends Error {
  constructor(id: ArticleId) {
    super(`Article not found: ${id}`);
    this.name = 'ArticleNotFoundError';
  }
}

/**
 * Error thrown when a version is not found.
 */
export class ArticleVersionNotFoundError extends Error {
  constructor(articleId: ArticleId, versionId?: ArticleVersionId, versionNumber?: number) {
    const detail = versionId ? `version ${versionId}` : `version number ${versionNumber}`;
    super(`Article version not found: ${articleId} - ${detail}`);
    this.name = 'ArticleVersionNotFoundError';
  }
}

/**
 * Error thrown when an invalid status transition is attempted.
 */
export class InvalidStatusTransitionError extends Error {
  constructor(currentStatus: ArticleStatus, targetStatus: ArticleStatus) {
    super(`Invalid status transition: ${currentStatus} -> ${targetStatus}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * Error thrown when content validation fails.
 */
export class ContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentValidationError';
  }
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Article domain service interface.
 * Provides business logic for article lifecycle management.
 */
export interface IArticleService {
  // CRUD Operations
  createArticle(input: CreateArticleInput): Promise<Article>;
  getArticleById(id: ArticleId): Promise<Article | null>;
  updateArticle(id: ArticleId, input: UpdateArticleInput): Promise<Article>;
  deleteArticle(id: ArticleId): Promise<boolean>;

  // Status Transitions
  submitForReview(id: ArticleId, submittedBy: UserRef): Promise<Article>;
  approve(id: ArticleId, approvedBy: UserRef): Promise<Article>;
  requestRevision(id: ArticleId, feedback: string, requestedBy: UserRef): Promise<Article>;
  publish(id: ArticleId, publishedUrl: string): Promise<Article>;
  archive(id: ArticleId): Promise<Article>;

  // Queries
  getArticlesByCustomer(
    customerId: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Article>>;
  getArticlesByStatus(status: ArticleStatus, customerId?: CustomerId): Promise<Article[]>;
  getArticlesByClearStory(clearStoryId: ClearStoryId): Promise<Article[]>;
  searchArticles(params: SearchParams): Promise<PaginatedResponse<Article>>;

  // Versioning
  createVersion(articleId: ArticleId, content: ArticleContent): Promise<ArticleVersion>;
  getVersions(articleId: ArticleId): Promise<ArticleVersion[]>;
  revertToVersion(articleId: ArticleId, versionId: ArticleVersionId): Promise<Article>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Valid status transitions for the article workflow.
 */
const VALID_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  [ArticleStatus.draft]: [ArticleStatus.review, ArticleStatus.archived],
  [ArticleStatus.review]: [
    ArticleStatus.approved,
    ArticleStatus.revision_requested,
    ArticleStatus.archived,
  ],
  [ArticleStatus.revision_requested]: [ArticleStatus.review, ArticleStatus.archived],
  [ArticleStatus.approved]: [ArticleStatus.published, ArticleStatus.archived],
  [ArticleStatus.published]: [ArticleStatus.archived],
  [ArticleStatus.archived]: [],
};

/**
 * Calculate word count from article content.
 */
function calculateWordCount(content: ArticleContent): number {
  const text = [content.body, content.summary, ...(content.keyPoints ?? [])].filter(Boolean).join(' ');
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Generate ID with prefix.
 */
function generateId<T extends string>(prefix: string): T {
  return `${prefix}_${crypto.randomUUID()}` as T;
}

/**
 * Get current ISO timestamp.
 */
function now(): ISOTimestamp {
  return new Date().toISOString() as ISOTimestamp;
}

/**
 * Create default SEO metadata.
 */
function createDefaultSeoMetadata(title: string, partial?: Partial<SeoMetadata>): SeoMetadata {
  return {
    metaTitle: partial?.metaTitle ?? title,
    metaDescription: partial?.metaDescription ?? '',
    focusKeyword: partial?.focusKeyword ?? '',
    keywords: partial?.keywords ?? [],
  };
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Article Service implementation.
 * Delegates data access to repositories and implements business logic.
 */
export class ArticleService implements IArticleService {
  private readonly articleRepository: IArticleRepository;
  private readonly versionRepository: IArticleVersionRepository;

  constructor(
    articleRepository?: IArticleRepository,
    versionRepository?: IArticleVersionRepository
  ) {
    this.articleRepository = articleRepository ?? new InMemoryArticleRepository();
    this.versionRepository = versionRepository ?? new InMemoryArticleVersionRepository();
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Create a new article.
   * Creates an initial version and calculates word count.
   */
  async createArticle(input: CreateArticleInput): Promise<Article> {
    const wordCount = calculateWordCount(input.content);

    // Validate word count
    if (wordCount < ARTICLE_MIN_WORDS) {
      throw new ContentValidationError(
        `Article must have at least ${ARTICLE_MIN_WORDS} words. Current: ${wordCount}`
      );
    }
    if (wordCount > ARTICLE_MAX_WORDS) {
      throw new ContentValidationError(
        `Article must have at most ${ARTICLE_MAX_WORDS} words. Current: ${wordCount}`
      );
    }

    const timestamp = now();
    const versionId = generateId<ArticleVersionId>('artv');

    // Create the article
    const article = await this.articleRepository.create({
      customerId: input.customerId,
      clearStoryId: input.clearStoryId,
      title: input.title,
      content: input.content,
      status: ArticleStatus.draft,
      tone: input.tone ?? ContentTone.authoritative,
      wordCount,
      seoMetadata: createDefaultSeoMetadata(input.title, input.seoMetadata),
      currentVersionId: versionId,
      agentSessionId: input.agentSessionId,
      audit: {
        createdAt: timestamp,
        createdBy: input.createdBy,
        updatedAt: timestamp,
        updatedBy: input.createdBy,
      },
    });

    // Create the initial version
    await this.versionRepository.create({
      id: versionId,
      articleId: article.id,
      versionNumber: 1,
      content: input.content,
      wordCount,
      createdAt: timestamp,
      createdBy: input.createdBy,
      changeNote: 'Initial version',
    } as ArticleVersion);

    return article;
  }

  /**
   * Get an article by its ID.
   */
  async getArticleById(id: ArticleId): Promise<Article | null> {
    return this.articleRepository.findById(id);
  }

  /**
   * Update an existing article.
   * Creates a new version if content changes.
   */
  async updateArticle(id: ArticleId, input: UpdateArticleInput): Promise<Article> {
    const article = await this.articleRepository.findById(id);
    if (!article) {
      throw new ArticleNotFoundError(id);
    }

    const timestamp = now();
    const updates: Partial<Article> = {
      audit: {
        ...article.audit,
        updatedAt: timestamp,
        updatedBy: input.updatedBy,
      },
    };

    // Handle title update
    if (input.title !== undefined) {
      updates.title = input.title;
    }

    // Handle tone update
    if (input.tone !== undefined) {
      updates.tone = input.tone;
    }

    // Handle SEO metadata update
    if (input.seoMetadata !== undefined) {
      updates.seoMetadata = {
        ...article.seoMetadata,
        ...input.seoMetadata,
      };
    }

    // Handle content update - creates a new version
    if (input.content !== undefined) {
      const wordCount = calculateWordCount(input.content);

      // Validate word count
      if (wordCount < ARTICLE_MIN_WORDS) {
        throw new ContentValidationError(
          `Article must have at least ${ARTICLE_MIN_WORDS} words. Current: ${wordCount}`
        );
      }
      if (wordCount > ARTICLE_MAX_WORDS) {
        throw new ContentValidationError(
          `Article must have at most ${ARTICLE_MAX_WORDS} words. Current: ${wordCount}`
        );
      }

      // Create a new version
      const nextVersionNumber = await this.versionRepository.getNextVersionNumber(id);
      const newVersion = await this.versionRepository.create({
        articleId: id,
        versionNumber: nextVersionNumber,
        content: input.content,
        wordCount,
        createdAt: timestamp,
        createdBy: input.updatedBy,
        changeNote: 'Content updated',
      });

      updates.content = input.content;
      updates.wordCount = wordCount;
      updates.currentVersionId = newVersion.id;
    }

    return this.articleRepository.update(id, updates);
  }

  /**
   * Delete an article.
   */
  async deleteArticle(id: ArticleId): Promise<boolean> {
    const article = await this.articleRepository.findById(id);
    if (!article) {
      return false;
    }
    return this.articleRepository.delete(id);
  }

  // ===========================================================================
  // Status Transitions
  // ===========================================================================

  /**
   * Validate and perform a status transition.
   */
  private async transitionStatus(
    id: ArticleId,
    targetStatus: ArticleStatus,
    updatedBy: UserRef,
    additionalUpdates?: Partial<Article>
  ): Promise<Article> {
    const article = await this.articleRepository.findById(id);
    if (!article) {
      throw new ArticleNotFoundError(id);
    }

    const validTransitions = VALID_TRANSITIONS[article.status];
    if (!validTransitions.includes(targetStatus)) {
      throw new InvalidStatusTransitionError(article.status, targetStatus);
    }

    const timestamp = now();
    return this.articleRepository.update(id, {
      status: targetStatus,
      ...additionalUpdates,
      audit: {
        ...article.audit,
        updatedAt: timestamp,
        updatedBy,
      },
    });
  }

  /**
   * Submit an article for review.
   * Transitions from draft or revision_requested to review status.
   */
  async submitForReview(id: ArticleId, submittedBy: UserRef): Promise<Article> {
    const article = await this.articleRepository.findById(id);
    if (!article) {
      throw new ArticleNotFoundError(id);
    }

    // Allow submission from draft or revision_requested
    if (article.status !== ArticleStatus.draft && article.status !== ArticleStatus.revision_requested) {
      throw new InvalidStatusTransitionError(article.status, ArticleStatus.review);
    }

    const timestamp = now();
    return this.articleRepository.update(id, {
      status: ArticleStatus.review,
      audit: {
        ...article.audit,
        updatedAt: timestamp,
        updatedBy: submittedBy,
      },
    });
  }

  /**
   * Approve an article for publishing.
   * Transitions from review to approved status.
   */
  async approve(id: ArticleId, approvedBy: UserRef): Promise<Article> {
    return this.transitionStatus(id, ArticleStatus.approved, approvedBy);
  }

  /**
   * Request revision on an article.
   * Transitions from review to revision_requested status.
   */
  async requestRevision(id: ArticleId, feedback: string, requestedBy: UserRef): Promise<Article> {
    const article = await this.articleRepository.findById(id);
    if (!article) {
      throw new ArticleNotFoundError(id);
    }

    if (article.status !== ArticleStatus.review) {
      throw new InvalidStatusTransitionError(article.status, ArticleStatus.revision_requested);
    }

    // Create a new version with the feedback note
    const timestamp = now();
    const nextVersionNumber = await this.versionRepository.getNextVersionNumber(id);
    const newVersion = await this.versionRepository.create({
      articleId: id,
      versionNumber: nextVersionNumber,
      content: article.content,
      wordCount: article.wordCount,
      createdAt: timestamp,
      createdBy: requestedBy,
      changeNote: `Revision requested: ${feedback}`,
    });

    return this.articleRepository.update(id, {
      status: ArticleStatus.revision_requested,
      currentVersionId: newVersion.id,
      audit: {
        ...article.audit,
        updatedAt: timestamp,
        updatedBy: requestedBy,
      },
    });
  }

  /**
   * Publish an approved article.
   * Records the published URL and transitions to published status.
   */
  async publish(id: ArticleId, publishedUrl: string): Promise<Article> {
    const article = await this.articleRepository.findById(id);
    if (!article) {
      throw new ArticleNotFoundError(id);
    }

    if (article.status !== ArticleStatus.approved) {
      throw new InvalidStatusTransitionError(article.status, ArticleStatus.published);
    }

    const timestamp = now();
    return this.articleRepository.update(id, {
      status: ArticleStatus.published,
      publishedUrl,
      publishedAt: timestamp,
      audit: {
        ...article.audit,
        updatedAt: timestamp,
        updatedBy: article.audit.updatedBy,
      },
    });
  }

  /**
   * Archive an article.
   * Can be done from any status except already archived.
   */
  async archive(id: ArticleId): Promise<Article> {
    const article = await this.articleRepository.findById(id);
    if (!article) {
      throw new ArticleNotFoundError(id);
    }

    if (article.status === ArticleStatus.archived) {
      throw new InvalidStatusTransitionError(article.status, ArticleStatus.archived);
    }

    const timestamp = now();
    return this.articleRepository.update(id, {
      status: ArticleStatus.archived,
      audit: {
        ...article.audit,
        updatedAt: timestamp,
        updatedBy: article.audit.updatedBy,
      },
    });
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  /**
   * Get articles by customer with pagination.
   */
  async getArticlesByCustomer(
    customerId: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Article>> {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const [articles, totalItems] = await Promise.all([
      this.articleRepository.findByCustomer(customerId, pageSize, offset),
      this.articleRepository.countByCustomer(customerId),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      data: articles,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get articles by status.
   */
  async getArticlesByStatus(status: ArticleStatus, customerId?: CustomerId): Promise<Article[]> {
    return this.articleRepository.findByStatus(status, customerId);
  }

  /**
   * Get articles by Clear Story.
   */
  async getArticlesByClearStory(clearStoryId: ClearStoryId): Promise<Article[]> {
    return this.articleRepository.findByClearStory(clearStoryId);
  }

  /**
   * Search articles with filters and pagination.
   */
  async searchArticles(params: SearchParams): Promise<PaginatedResponse<Article>> {
    const page = params.pagination?.page ?? 1;
    const pageSize = params.pagination?.pageSize ?? DEFAULT_PAGE_SIZE;

    const { items, total } = await this.articleRepository.search(params);
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: items,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  // ===========================================================================
  // Versioning
  // ===========================================================================

  /**
   * Create a new version for an article.
   */
  async createVersion(articleId: ArticleId, content: ArticleContent): Promise<ArticleVersion> {
    const article = await this.articleRepository.findById(articleId);
    if (!article) {
      throw new ArticleNotFoundError(articleId);
    }

    const wordCount = calculateWordCount(content);
    const timestamp = now();
    const nextVersionNumber = await this.versionRepository.getNextVersionNumber(articleId);

    const version = await this.versionRepository.create({
      articleId,
      versionNumber: nextVersionNumber,
      content,
      wordCount,
      createdAt: timestamp,
      createdBy: article.audit.updatedBy,
      changeNote: 'Manual version created',
    });

    // Update the article to point to the new version
    await this.articleRepository.update(articleId, {
      content,
      wordCount,
      currentVersionId: version.id,
      audit: {
        ...article.audit,
        updatedAt: timestamp,
      },
    });

    return version;
  }

  /**
   * Get all versions for an article.
   */
  async getVersions(articleId: ArticleId): Promise<ArticleVersion[]> {
    const article = await this.articleRepository.findById(articleId);
    if (!article) {
      throw new ArticleNotFoundError(articleId);
    }

    return this.versionRepository.findByArticle(articleId);
  }

  /**
   * Revert an article to a previous version.
   * Creates a new version with the content from the specified version.
   */
  async revertToVersion(articleId: ArticleId, versionId: ArticleVersionId): Promise<Article> {
    const article = await this.articleRepository.findById(articleId);
    if (!article) {
      throw new ArticleNotFoundError(articleId);
    }

    const targetVersion = await this.versionRepository.findById(versionId);
    if (!targetVersion || targetVersion.articleId !== articleId) {
      throw new ArticleVersionNotFoundError(articleId, versionId);
    }

    // Cannot revert to current version
    if (article.currentVersionId === versionId) {
      throw new ContentValidationError('Cannot revert to the current version');
    }

    const timestamp = now();
    const nextVersionNumber = await this.versionRepository.getNextVersionNumber(articleId);

    // Create a new version with the content from the target version
    const newVersion = await this.versionRepository.create({
      articleId,
      versionNumber: nextVersionNumber,
      content: targetVersion.content,
      wordCount: targetVersion.wordCount,
      createdAt: timestamp,
      createdBy: article.audit.updatedBy,
      changeNote: `Reverted to version ${targetVersion.versionNumber}`,
    });

    // Update the article
    return this.articleRepository.update(articleId, {
      content: targetVersion.content,
      wordCount: targetVersion.wordCount,
      currentVersionId: newVersion.id,
      audit: {
        ...article.audit,
        updatedAt: timestamp,
      },
    });
  }
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Re-export types from repository for convenience
export type {
  Article,
  ArticleContent,
  ArticleVersion,
  CreateArticleInput,
  UpdateArticleInput,
  SeoMetadata,
  IArticleRepository,
  IArticleVersionRepository,
} from './article.repository';

export { InMemoryArticleRepository, InMemoryArticleVersionRepository } from './article.repository';
