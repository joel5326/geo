/**
 * Article Repository Implementation
 *
 * This module defines the repository interfaces and in-memory implementations
 * for the Article domain. Provides persistence operations for Articles and
 * ArticleVersions with proper type safety.
 *
 * @module article/article.repository
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
  AuditInfo,
  AgentSessionId,
  PaginationParams,
  SearchParams,
} from '../shared/shared.types';

// =============================================================================
// DOMAIN TYPES
// =============================================================================

/**
 * Structured article content with body, summary, and key points.
 */
export interface ArticleContent {
  /** Main body content in Markdown format */
  body: string;
  /** Brief summary of the article */
  summary?: string;
  /** Key points covered in the article */
  keyPoints?: string[];
}

/**
 * SEO metadata for article optimization.
 */
export interface SeoMetadata {
  /** SEO-optimized title for search engines */
  metaTitle: string;
  /** Meta description (150-160 chars) */
  metaDescription: string;
  /** Primary focus keyword */
  focusKeyword: string;
  /** Additional target keywords */
  keywords: string[];
}

/**
 * Full Article entity.
 */
export interface Article {
  /** Unique identifier (format: art_uuid) */
  id: ArticleId;
  /** Customer who owns this article */
  customerId: CustomerId;
  /** Reference to the source Clear Story */
  clearStoryId: ClearStoryId;
  /** Article title */
  title: string;
  /** Structured article content */
  content: ArticleContent;
  /** Current workflow status */
  status: ArticleStatus;
  /** Content tone */
  tone: ContentTone;
  /** Calculated word count */
  wordCount: number;
  /** SEO metadata */
  seoMetadata: SeoMetadata;
  /** URL where article is published (if published) */
  publishedUrl?: string;
  /** Date/time when article was published */
  publishedAt?: ISOTimestamp;
  /** Current version ID */
  currentVersionId: ArticleVersionId;
  /** Agent session that generated this article */
  agentSessionId?: AgentSessionId;
  /** Tokens used in generation */
  generationTokens?: number;
  /** Generation latency in milliseconds */
  generationLatencyMs?: number;
  /** Audit information */
  audit: AuditInfo;
}

/**
 * Article version for tracking content history.
 */
export interface ArticleVersion {
  /** Unique identifier (format: artv_uuid) */
  id: ArticleVersionId;
  /** Reference to parent article */
  articleId: ArticleId;
  /** Sequential version number (1-indexed) */
  versionNumber: number;
  /** Content at this version */
  content: ArticleContent;
  /** Word count at this version */
  wordCount: number;
  /** When this version was created */
  createdAt: ISOTimestamp;
  /** Who created this version */
  createdBy: UserRef;
  /** Description of changes made */
  changeNote?: string;
}

/**
 * Input for creating a new article.
 */
export interface CreateArticleInput {
  /** Customer who owns the article */
  customerId: CustomerId;
  /** Source Clear Story ID */
  clearStoryId: ClearStoryId;
  /** Article title */
  title: string;
  /** Article content */
  content: ArticleContent;
  /** Desired tone (defaults to authoritative) */
  tone?: ContentTone;
  /** SEO metadata (partial, will be filled with defaults) */
  seoMetadata?: Partial<SeoMetadata>;
  /** User creating the article */
  createdBy: UserRef;
  /** Agent session that generated this article */
  agentSessionId?: AgentSessionId;
}

/**
 * Input for updating an existing article.
 */
export interface UpdateArticleInput {
  /** Updated title */
  title?: string;
  /** Updated content (triggers new version) */
  content?: ArticleContent;
  /** Updated tone */
  tone?: ContentTone;
  /** Updated SEO metadata */
  seoMetadata?: Partial<SeoMetadata>;
  /** User making the update */
  updatedBy: UserRef;
}

// =============================================================================
// REPOSITORY INTERFACES
// =============================================================================

/**
 * Repository interface for Article persistence.
 */
export interface IArticleRepository {
  /**
   * Create a new article.
   * @param article - Article data (without ID, will be generated)
   * @returns Created article with ID
   */
  create(article: Omit<Article, 'id'>): Promise<Article>;

  /**
   * Find an article by ID.
   * @param id - Article ID
   * @returns Article or null if not found
   */
  findById(id: ArticleId): Promise<Article | null>;

  /**
   * Update an article.
   * @param id - Article ID
   * @param updates - Partial updates to apply
   * @returns Updated article
   * @throws Error if article not found
   */
  update(id: ArticleId, updates: Partial<Article>): Promise<Article>;

  /**
   * Delete an article.
   * @param id - Article ID
   * @returns true if deleted, false if not found
   */
  delete(id: ArticleId): Promise<boolean>;

  /**
   * Find articles by customer.
   * @param customerId - Customer ID
   * @param limit - Max results
   * @param offset - Offset for pagination
   * @returns Array of articles
   */
  findByCustomer(customerId: CustomerId, limit?: number, offset?: number): Promise<Article[]>;

  /**
   * Count articles by customer.
   * @param customerId - Customer ID
   * @returns Count of articles
   */
  countByCustomer(customerId: CustomerId): Promise<number>;

  /**
   * Find articles by Clear Story.
   * @param clearStoryId - Clear Story ID
   * @returns Array of articles
   */
  findByClearStory(clearStoryId: ClearStoryId): Promise<Article[]>;

  /**
   * Find articles by status.
   * @param status - Status to filter by
   * @param customerId - Optional customer filter
   * @returns Array of articles
   */
  findByStatus(status: ArticleStatus, customerId?: CustomerId): Promise<Article[]>;

  /**
   * Search articles with filters.
   * @param params - Search parameters
   * @returns Search results with total count
   */
  search(params: SearchParams): Promise<{ items: Article[]; total: number }>;
}

/**
 * Repository interface for ArticleVersion persistence.
 */
export interface IArticleVersionRepository {
  /**
   * Create a new version.
   * @param version - Version data (without ID, will be generated)
   * @returns Created version with ID
   */
  create(version: Omit<ArticleVersion, 'id'>): Promise<ArticleVersion>;

  /**
   * Find a version by ID.
   * @param id - Version ID
   * @returns Version or null if not found
   */
  findById(id: ArticleVersionId): Promise<ArticleVersion | null>;

  /**
   * Find all versions for an article.
   * @param articleId - Article ID
   * @returns Array of versions ordered by version number descending
   */
  findByArticle(articleId: ArticleId): Promise<ArticleVersion[]>;

  /**
   * Find a specific version by article and version number.
   * @param articleId - Article ID
   * @param versionNumber - Version number
   * @returns Version or null if not found
   */
  findByVersionNumber(articleId: ArticleId, versionNumber: number): Promise<ArticleVersion | null>;

  /**
   * Get the next version number for an article.
   * @param articleId - Article ID
   * @returns Next version number
   */
  getNextVersionNumber(articleId: ArticleId): Promise<number>;
}

// =============================================================================
// IN-MEMORY IMPLEMENTATIONS
// =============================================================================

/**
 * Generates a unique ID with the specified prefix.
 */
function generateId<T extends string>(prefix: string): T {
  const uuid = crypto.randomUUID();
  return `${prefix}_${uuid}` as T;
}

/**
 * In-memory implementation of IArticleRepository.
 * Uses a Map for storage with ArticleId as the key.
 */
export class InMemoryArticleRepository implements IArticleRepository {
  private articles = new Map<string, Article>();

  async create(article: Omit<Article, 'id'>): Promise<Article> {
    const id = generateId<ArticleId>('art');
    const newArticle: Article = {
      ...article,
      id,
    };
    this.articles.set(id, newArticle);
    return newArticle;
  }

  async findById(id: ArticleId): Promise<Article | null> {
    return this.articles.get(id) ?? null;
  }

  async update(id: ArticleId, updates: Partial<Article>): Promise<Article> {
    const existing = this.articles.get(id);
    if (!existing) {
      throw new Error(`Article not found: ${id}`);
    }
    const updated: Article = {
      ...existing,
      ...updates,
      id, // Ensure ID is not overwritten
    };
    this.articles.set(id, updated);
    return updated;
  }

  async delete(id: ArticleId): Promise<boolean> {
    return this.articles.delete(id);
  }

  async findByCustomer(
    customerId: CustomerId,
    limit?: number,
    offset?: number
  ): Promise<Article[]> {
    let results = Array.from(this.articles.values()).filter(
      (article) => article.customerId === customerId
    );

    // Sort by createdAt descending
    results.sort((a, b) => b.audit.createdAt.localeCompare(a.audit.createdAt));

    // Apply pagination
    const actualOffset = offset ?? 0;
    if (limit !== undefined) {
      results = results.slice(actualOffset, actualOffset + limit);
    } else if (actualOffset > 0) {
      results = results.slice(actualOffset);
    }

    return results;
  }

  async countByCustomer(customerId: CustomerId): Promise<number> {
    return Array.from(this.articles.values()).filter(
      (article) => article.customerId === customerId
    ).length;
  }

  async findByClearStory(clearStoryId: ClearStoryId): Promise<Article[]> {
    return Array.from(this.articles.values()).filter(
      (article) => article.clearStoryId === clearStoryId
    );
  }

  async findByStatus(status: ArticleStatus, customerId?: CustomerId): Promise<Article[]> {
    let results = Array.from(this.articles.values()).filter(
      (article) => article.status === status
    );

    if (customerId) {
      results = results.filter((article) => article.customerId === customerId);
    }

    // Sort by updatedAt descending
    results.sort((a, b) => b.audit.updatedAt.localeCompare(a.audit.updatedAt));

    return results;
  }

  async search(params: SearchParams): Promise<{ items: Article[]; total: number }> {
    let results = Array.from(this.articles.values());

    // Apply filters from params.filters
    if (params.filters) {
      if (params.filters['customerId']) {
        const customerId = params.filters['customerId'] as string;
        results = results.filter((a) => a.customerId === customerId);
      }

      if (params.filters['clearStoryId']) {
        const clearStoryId = params.filters['clearStoryId'] as string;
        results = results.filter((a) => a.clearStoryId === clearStoryId);
      }

      if (params.filters['status']) {
        const status = params.filters['status'];
        if (Array.isArray(status)) {
          results = results.filter((a) => (status as string[]).includes(a.status));
        } else {
          results = results.filter((a) => a.status === status);
        }
      }

      if (params.filters['tone']) {
        const tone = params.filters['tone'] as string;
        results = results.filter((a) => a.tone === tone);
      }

      // Exclude archived unless explicitly included
      if (params.filters['includeArchived'] !== true) {
        results = results.filter((a) => a.status !== ArticleStatus.archived);
      }
    }

    // Apply text search
    if (params.query) {
      const queryLower = params.query.toLowerCase();
      results = results.filter(
        (article) =>
          article.title.toLowerCase().includes(queryLower) ||
          article.content.body.toLowerCase().includes(queryLower) ||
          (article.content.summary?.toLowerCase().includes(queryLower) ?? false) ||
          article.seoMetadata.keywords.some((kw) => kw.toLowerCase().includes(queryLower))
      );
    }

    const total = results.length;

    // Apply sorting
    const sortBy = params.sortBy ?? 'createdAt';
    const sortOrder = params.sortOrder ?? 'desc';
    results.sort((a, b) => {
      let aVal: string;
      let bVal: string;

      if (sortBy === 'title') {
        aVal = a.title;
        bVal = b.title;
      } else if (sortBy === 'updatedAt') {
        aVal = a.audit.updatedAt;
        bVal = b.audit.updatedAt;
      } else {
        aVal = a.audit.createdAt;
        bVal = b.audit.createdAt;
      }

      const comparison = aVal.localeCompare(bVal);
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const page = params.pagination?.page ?? 1;
    const pageSize = params.pagination?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const items = results.slice(offset, offset + pageSize);

    return { items, total };
  }

  /**
   * Clear all articles (useful for testing).
   */
  clear(): void {
    this.articles.clear();
  }

  /**
   * Get all articles (useful for debugging).
   */
  getAll(): Article[] {
    return Array.from(this.articles.values());
  }
}

/**
 * In-memory implementation of IArticleVersionRepository.
 * Uses a Map for storage with ArticleVersionId as the key.
 */
export class InMemoryArticleVersionRepository implements IArticleVersionRepository {
  private versions = new Map<string, ArticleVersion>();

  async create(version: Omit<ArticleVersion, 'id'>): Promise<ArticleVersion> {
    const id = generateId<ArticleVersionId>('artv');
    const newVersion: ArticleVersion = {
      ...version,
      id,
    };
    this.versions.set(id, newVersion);
    return newVersion;
  }

  async findById(id: ArticleVersionId): Promise<ArticleVersion | null> {
    return this.versions.get(id) ?? null;
  }

  async findByArticle(articleId: ArticleId): Promise<ArticleVersion[]> {
    const results = Array.from(this.versions.values()).filter(
      (v) => v.articleId === articleId
    );
    // Sort by version number descending (most recent first)
    return results.sort((a, b) => b.versionNumber - a.versionNumber);
  }

  async findByVersionNumber(
    articleId: ArticleId,
    versionNumber: number
  ): Promise<ArticleVersion | null> {
    return (
      Array.from(this.versions.values()).find(
        (v) => v.articleId === articleId && v.versionNumber === versionNumber
      ) ?? null
    );
  }

  async getNextVersionNumber(articleId: ArticleId): Promise<number> {
    const versions = Array.from(this.versions.values()).filter(
      (v) => v.articleId === articleId
    );
    if (versions.length === 0) {
      return 1;
    }
    const maxVersion = Math.max(...versions.map((v) => v.versionNumber));
    return maxVersion + 1;
  }

  /**
   * Clear all versions (useful for testing).
   */
  clear(): void {
    this.versions.clear();
  }

  /**
   * Get all versions (useful for debugging).
   */
  getAll(): ArticleVersion[] {
    return Array.from(this.versions.values());
  }
}
