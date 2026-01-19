/**
 * Article Domain Types
 *
 * This module defines all TypeScript types, interfaces, and enums for the Article domain
 * in the GEO Platform. The Article domain is responsible for generating,
 * storing, versioning, reviewing, and publishing articles derived from Clear Stories.
 *
 * @module domains/article/article.types
 * @version 1.0.0
 */

import {
  // Identity Types
  ArticleId,
  ArticleVersionId,
  ClearStoryId,
  CustomerId,
  UserId,
  AgentSessionId,

  // Enums
  ArticleStatus,
  ContentTone,
  CustomerTier,

  // Cross-Domain References
  ClearStoryRef,
  CustomerRef,
  UserRef,

  // API Patterns
  PaginatedResponse,
  PaginationParams,
  SearchParams,
  ISOTimestamp
} from '../../shared/shared.types';

// =============================================================================
// RE-EXPORT SHARED TYPES USED BY THIS DOMAIN
// =============================================================================

export {
  ArticleId,
  ArticleVersionId,
  ClearStoryId,
  CustomerId,
  UserId,
  AgentSessionId,
  ArticleStatus,
  ContentTone,
  CustomerTier,
  ClearStoryRef,
  CustomerRef,
  UserRef,
  PaginatedResponse,
  PaginationParams,
  SearchParams,
  ISOTimestamp
};

// =============================================================================
// ARTICLE ENTITY
// =============================================================================

/**
 * Full Article entity representing a generated blog article.
 * Articles are generated from Clear Stories using Claude agents
 * and go through a review workflow before publishing.
 */
export interface Article {
  /** Unique identifier for the article (format: art_uuid) */
  id: ArticleId;

  /** Customer who owns this article */
  customerId: CustomerId;

  /** Reference to the source Clear Story */
  clearStoryId: ClearStoryId;

  /** Article title (SEO-optimized) */
  title: string;

  /** Subtitle/hook for the article */
  subtitle?: string;

  /** Full article content in Markdown format */
  content: string;

  /** Calculated word count of the content */
  wordCount: number;

  /** Current workflow status */
  status: ArticleStatus;

  /** Content tone used for generation */
  tone: ContentTone;

  /** SEO meta description (150-160 chars) */
  metaDescription?: string;

  /** SEO keywords/tags */
  keywords: string[];

  /** Target audience description */
  targetAudience?: string;

  /** Array of version IDs for this article */
  versionIds: ArticleVersionId[];

  /** Current version number (1-indexed) */
  currentVersion: number;

  /** URL where article is published (if published) */
  publishedUrl?: string;

  /** Date/time when article was published */
  publishedAt?: ISOTimestamp;

  /** Date/time when article was approved */
  approvedAt?: ISOTimestamp;

  /** User who approved the article */
  approvedBy?: UserRef;

  /** Agent session that generated this article */
  generatedBySessionId?: AgentSessionId;

  /** Generation metadata */
  generationMetadata?: ArticleGenerationMetadata;

  /** Audit information */
  createdAt: ISOTimestamp;
  createdBy: UserRef;
  updatedAt: ISOTimestamp;
  updatedBy: UserRef;
}

// =============================================================================
// ARTICLE VERSION
// =============================================================================

/** Change types that trigger a new article version */
export type ArticleChangeType = 'initial' | 'manual_edit' | 'regeneration' | 'ai_revision';

/**
 * Represents a specific version/revision of an article.
 * New versions are created when content is regenerated or edited.
 */
export interface ArticleVersion {
  /** Unique identifier for this version (format: artv_uuid) */
  id: ArticleVersionId;

  /** Reference to parent article */
  articleId: ArticleId;

  /** Full article content for this version */
  content: string;

  /** Title at this version */
  title: string;

  /** Subtitle at this version */
  subtitle?: string;

  /** Word count at this version */
  wordCount: number;

  /** Sequential version number (1-indexed) */
  versionNumber: number;

  /** What triggered this version (initial, edit, regeneration) */
  changeType: ArticleChangeType;

  /** Description of changes made */
  changeDescription?: string;

  /** Feedback note from reviewer that prompted this version */
  feedbackNote?: string;

  /** When this version was created */
  createdAt: ISOTimestamp;

  /** Who created this version */
  createdBy: UserRef;

  /** Agent session that created this version (if AI-generated) */
  generatedBySessionId?: AgentSessionId;
}

// =============================================================================
// GENERATION METADATA
// =============================================================================

/**
 * Metadata about how an article was generated.
 * Useful for debugging and improving generation quality.
 */
export interface ArticleGenerationMetadata {
  /** Claude model used for generation */
  model: string;

  /** Tokens used in generation */
  tokensUsed: number;

  /** Generation latency in milliseconds */
  latencyMs: number;

  /** Number of regeneration attempts */
  attempts: number;

  /** Prompt template version used */
  promptVersion: string;

  /** Clear Story source data snapshot */
  clearStorySnapshot: {
    topic: string;
    belief: string;
    keyPoints: string[];
  };

  /** Brand guidelines applied */
  brandGuidelinesApplied: boolean;

  /** Customer-specific instructions applied */
  customInstructions?: string;
}

// =============================================================================
// SEARCH PARAMS
// =============================================================================

/**
 * Search and filter parameters for querying articles.
 */
export interface ArticleSearchParams extends SearchParams {
  /** Filter by customer ID */
  customerId?: CustomerId;

  /** Filter by Clear Story ID */
  clearStoryId?: ClearStoryId;

  /** Filter by status(es) */
  status?: ArticleStatus | ArticleStatus[];

  /** Filter by tone */
  tone?: ContentTone;

  /** Filter by date range - created after */
  createdAfter?: ISOTimestamp;

  /** Filter by date range - created before */
  createdBefore?: ISOTimestamp;

  /** Filter by published date range */
  publishedAfter?: ISOTimestamp;
  publishedBefore?: ISOTimestamp;

  /** Filter by keyword/tag */
  keyword?: string;

  /** Text search in title and content */
  textSearch?: string;

  /** Minimum word count */
  minWordCount?: number;

  /** Maximum word count */
  maxWordCount?: number;

  /** Include archived articles (default: false) */
  includeArchived?: boolean;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a new article manually (non-AI generated).
 * For AI generation, use ArticleGenerationRequest instead.
 */
export interface CreateArticleInput {
  /** Customer who owns the article */
  customerId: CustomerId;

  /** Source Clear Story ID */
  clearStoryId: ClearStoryId;

  /** Article title */
  title: string;

  /** Optional subtitle */
  subtitle?: string;

  /** Article content in Markdown */
  content: string;

  /** Desired tone */
  tone?: ContentTone;

  /** SEO meta description */
  metaDescription?: string;

  /** SEO keywords */
  keywords?: string[];

  /** Target audience */
  targetAudience?: string;

  /** Initial status (default: draft) */
  status?: ArticleStatus;
}

/**
 * Input for updating an existing article.
 * Creates a new version if content changes.
 */
export interface UpdateArticleInput {
  /** Updated title */
  title?: string;

  /** Updated subtitle */
  subtitle?: string;

  /** Updated content (triggers new version) */
  content?: string;

  /** Updated tone */
  tone?: ContentTone;

  /** Updated meta description */
  metaDescription?: string;

  /** Updated keywords */
  keywords?: string[];

  /** Updated target audience */
  targetAudience?: string;

  /** Description of changes (required if content changes) */
  changeDescription?: string;
}

// =============================================================================
// GENERATION TYPES
// =============================================================================

/**
 * Internal link to include in generated article.
 */
export interface InternalLink {
  /** URL of the link */
  url: string;
  /** Anchor text for the link */
  anchorText: string;
}

/**
 * Word count target range for article generation.
 */
export interface WordCountTarget {
  /** Minimum word count (default: 1200) */
  min: number;
  /** Maximum word count (default: 1800) */
  max: number;
}

/**
 * Request to trigger Claude agent for article generation.
 * This is the primary input for AI-powered article creation.
 */
export interface ArticleGenerationRequest {
  /** Customer requesting the article */
  customerId: CustomerId;

  /** Source Clear Story to generate from */
  clearStoryId: ClearStoryId;

  /** Desired content tone */
  tone?: ContentTone;

  /** Target word count range */
  wordCountTarget?: WordCountTarget;

  /** SEO keywords to incorporate */
  keywords?: string[];

  /** Target audience description */
  targetAudience?: string;

  /** Custom instructions for the generator */
  customInstructions?: string;

  /** Whether to use customer brand guidelines */
  useBrandGuidelines?: boolean;

  /** Specific sections to include */
  requiredSections?: string[];

  /** Call-to-action text to include */
  callToAction?: string;

  /** Links to include in the article */
  internalLinks?: InternalLink[];
}

/**
 * Result from article generation agent.
 */
export interface ArticleGenerationResult {
  /** Whether generation succeeded */
  success: boolean;

  /** Generated article (if successful) */
  article?: Article;

  /** Error message (if failed) */
  error?: string;

  /** Error code (if failed) */
  errorCode?: string;

  /** Generation metadata */
  metadata?: ArticleGenerationMetadata;

  /** Suggested improvements or alternatives */
  suggestions?: string[];
}

// =============================================================================
// REVIEW TYPES
// =============================================================================

/** Review decision options */
export type ReviewDecision = 'approve' | 'request_revision' | 'reject';

/**
 * Improvement area identified during review.
 */
export interface ImprovementArea {
  /** Section of the article needing improvement */
  section: string;
  /** Description of the issue */
  issue: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Feedback provided during article review.
 */
export interface ReviewFeedback {
  /** Overall assessment */
  decision: ReviewDecision;

  /** Detailed feedback for revisions */
  feedbackNote?: string;

  /** Specific areas needing improvement */
  improvementAreas?: ImprovementArea[];

  /** Rating (1-5 stars) */
  rating?: number;
}

/**
 * Input for publishing an approved article.
 */
export interface PublishInput {
  /** URL where article was/will be published */
  publishedUrl: string;

  /** Platform where published (e.g., wordpress, ghost, custom) */
  platform?: string;

  /** Whether to auto-publish or just mark as published */
  autoPublish?: boolean;

  /** Scheduled publish time (if scheduling) */
  scheduledFor?: ISOTimestamp;
}

// =============================================================================
// SUMMARY TYPES
// =============================================================================

/**
 * Lightweight article summary for list views.
 */
export interface ArticleSummary {
  /** Article ID */
  id: ArticleId;

  /** Article title */
  title: string;

  /** Current status */
  status: ArticleStatus;

  /** Word count */
  wordCount: number;

  /** Content tone */
  tone: ContentTone;

  /** Source Clear Story reference */
  clearStoryRef: ClearStoryRef;

  /** Customer reference */
  customerRef: CustomerRef;

  /** Published URL (if published) */
  publishedUrl?: string;

  /** When created */
  createdAt: ISOTimestamp;

  /** When last updated */
  updatedAt: ISOTimestamp;
}

// =============================================================================
// VERSION DIFF
// =============================================================================

/**
 * Diff between two article versions.
 */
export interface ArticleVersionDiff {
  /** Article ID */
  articleId: ArticleId;

  /** Version A number */
  versionA: number;

  /** Version B number */
  versionB: number;

  /** Title change */
  titleDiff?: {
    from: string;
    to: string;
  };

  /** Content diff in unified format */
  contentDiff: string;

  /** Word count change */
  wordCountDiff: {
    from: number;
    to: number;
    delta: number;
  };
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Article statistics for a customer.
 */
export interface ArticleStatistics {
  /** Customer ID */
  customerId: CustomerId;

  /** Total articles */
  totalArticles: number;

  /** Count by status */
  byStatus: Record<ArticleStatus, number>;

  /** Count by tone */
  byTone: Record<ContentTone, number>;

  /** Average word count */
  averageWordCount: number;

  /** Articles created this month */
  articlesThisMonth: number;

  /** Articles published this month */
  publishedThisMonth: number;

  /** Average time from draft to published (hours) */
  averageTimeToPublish: number;

  /** Total versions across all articles */
  totalVersions: number;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Article domain service interface.
 * All methods are async and return Promises.
 */
export interface IArticleService {
  // -------------------------------------------------------------------------
  // Article Generation (AI-Powered)
  // -------------------------------------------------------------------------

  /**
   * Generate a new article using Claude agent from a Clear Story.
   * This is the primary method for AI-powered article creation.
   *
   * @param request - Generation request with Clear Story reference and options
   * @param userId - User initiating the generation
   * @returns Generation result with created article or error
   * @throws ArticleGenerationError if generation fails
   * @emits article.created on success
   */
  generate(
    request: ArticleGenerationRequest,
    userId: UserId
  ): Promise<ArticleGenerationResult>;

  /**
   * Regenerate an existing article with new parameters.
   * Creates a new version of the article.
   *
   * @param articleId - Article to regenerate
   * @param request - Updated generation parameters
   * @param userId - User initiating the regeneration
   * @returns Generation result with updated article
   * @throws ArticleNotFoundError if article does not exist
   * @emits article.regenerated on success
   */
  regenerate(
    articleId: ArticleId,
    request: Partial<ArticleGenerationRequest>,
    userId: UserId
  ): Promise<ArticleGenerationResult>;

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  /**
   * Create a new article manually (non-AI).
   * Used for importing existing articles or manual entry.
   *
   * @param input - Article creation input
   * @param userId - User creating the article
   * @returns Created article
   * @emits article.created on success
   */
  create(input: CreateArticleInput, userId: UserId): Promise<Article>;

  /**
   * Get an article by its ID.
   *
   * @param id - Article ID to retrieve
   * @returns Article or null if not found
   */
  getById(id: ArticleId): Promise<Article | null>;

  /**
   * Search articles with filters and pagination.
   *
   * @param params - Search parameters
   * @returns Paginated list of articles
   */
  search(params: ArticleSearchParams): Promise<PaginatedResponse<ArticleSummary>>;

  /**
   * Update an existing article.
   * Content changes create a new version.
   *
   * @param id - Article ID to update
   * @param input - Update input
   * @param userId - User making the update
   * @returns Updated article
   * @throws ArticleNotFoundError if article does not exist
   * @throws InvalidStatusTransitionError if update not allowed in current status
   */
  update(id: ArticleId, input: UpdateArticleInput, userId: UserId): Promise<Article>;

  /**
   * Soft delete an article (archives it).
   * Hard delete not supported to preserve audit trail.
   *
   * @param id - Article ID to delete
   * @param userId - User deleting the article
   * @returns Success confirmation
   * @throws ArticleNotFoundError if article does not exist
   * @emits article.archived on success
   */
  delete(id: ArticleId, userId: UserId): Promise<{ success: boolean }>;

  // -------------------------------------------------------------------------
  // Review Workflow
  // -------------------------------------------------------------------------

  /**
   * Submit an article for review.
   * Transitions from draft to review status.
   *
   * @param id - Article ID to submit
   * @param userId - User submitting for review
   * @returns Updated article
   * @throws ArticleNotFoundError if article does not exist
   * @throws InvalidStatusTransitionError if not in draft status
   * @emits article.submitted_for_review on success
   */
  submitForReview(id: ArticleId, userId: UserId): Promise<Article>;

  /**
   * Request revision on an article under review.
   * Transitions to revision_requested status.
   *
   * @param id - Article ID to request revision on
   * @param feedback - Review feedback with requested changes
   * @param userId - Reviewer requesting the revision
   * @returns Updated article
   * @throws ArticleNotFoundError if article does not exist
   * @throws InvalidStatusTransitionError if not in review status
   * @emits article.revision_requested on success
   */
  requestRevision(
    id: ArticleId,
    feedback: ReviewFeedback,
    userId: UserId
  ): Promise<Article>;

  /**
   * Approve an article for publishing.
   * Transitions to approved status.
   *
   * @param id - Article ID to approve
   * @param feedback - Optional approval feedback
   * @param userId - Reviewer approving the article
   * @returns Updated article
   * @throws ArticleNotFoundError if article does not exist
   * @throws InvalidStatusTransitionError if not in review status
   * @emits article.approved on success
   */
  approve(
    id: ArticleId,
    feedback?: ReviewFeedback,
    userId?: UserId
  ): Promise<Article>;

  /**
   * Publish an approved article.
   * Records the published URL and transitions to published status.
   *
   * @param id - Article ID to publish
   * @param input - Publish input with URL
   * @param userId - User publishing the article
   * @returns Updated article with published URL
   * @throws ArticleNotFoundError if article does not exist
   * @throws InvalidStatusTransitionError if not in approved status
   * @emits article.published on success
   */
  publish(id: ArticleId, input: PublishInput, userId: UserId): Promise<Article>;

  /**
   * Archive an article (remove from active circulation).
   * Can be done from any status except archived.
   *
   * @param id - Article ID to archive
   * @param reason - Reason for archiving
   * @param userId - User archiving the article
   * @returns Updated article
   * @throws ArticleNotFoundError if article does not exist
   * @throws InvalidStatusTransitionError if already archived
   * @emits article.archived on success
   */
  archive(id: ArticleId, reason: string, userId: UserId): Promise<Article>;

  // -------------------------------------------------------------------------
  // Version Management
  // -------------------------------------------------------------------------

  /**
   * Get full version history for an article.
   * Returns all versions ordered by version number descending.
   *
   * @param articleId - Article to get history for
   * @returns Array of article versions
   * @throws ArticleNotFoundError if article does not exist
   */
  getVersionHistory(articleId: ArticleId): Promise<ArticleVersion[]>;

  /**
   * Get a specific version of an article.
   *
   * @param versionId - Version ID to retrieve
   * @returns Article version or null if not found
   */
  getVersion(versionId: ArticleVersionId): Promise<ArticleVersion | null>;

  /**
   * Revert article to a previous version.
   * Creates a new version with the content from the specified version.
   *
   * @param articleId - Article to revert
   * @param versionNumber - Version number to revert to
   * @param userId - User performing the revert
   * @returns Updated article with new version
   * @throws ArticleNotFoundError if article does not exist
   * @throws VersionNotFoundError if version does not exist
   */
  revertToVersion(
    articleId: ArticleId,
    versionNumber: number,
    userId: UserId
  ): Promise<Article>;

  /**
   * Compare two versions of an article.
   * Returns a diff of the content.
   *
   * @param articleId - Article to compare versions of
   * @param versionA - First version number
   * @param versionB - Second version number
   * @returns Diff result
   */
  compareVersions(
    articleId: ArticleId,
    versionA: number,
    versionB: number
  ): Promise<ArticleVersionDiff>;

  // -------------------------------------------------------------------------
  // Query Methods
  // -------------------------------------------------------------------------

  /**
   * Get all articles for a specific customer.
   *
   * @param customerId - Customer to query
   * @param pagination - Pagination parameters
   * @returns Paginated list of articles
   */
  getByCustomer(
    customerId: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ArticleSummary>>;

  /**
   * Get articles by status.
   *
   * @param status - Status(es) to filter by
   * @param customerId - Optional customer filter
   * @param pagination - Pagination parameters
   * @returns Paginated list of articles
   */
  getByStatus(
    status: ArticleStatus | ArticleStatus[],
    customerId?: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ArticleSummary>>;

  /**
   * Get articles by Clear Story.
   *
   * @param clearStoryId - Clear Story to query
   * @param pagination - Pagination parameters
   * @returns Paginated list of articles
   */
  getByClearStory(
    clearStoryId: ClearStoryId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ArticleSummary>>;

  /**
   * Get article statistics for a customer.
   *
   * @param customerId - Customer to get stats for
   * @returns Article statistics
   */
  getStatistics(customerId: CustomerId): Promise<ArticleStatistics>;
}

// =============================================================================
// AGENT INTERFACE
// =============================================================================

/**
 * Input context for Article Generator Agent invocation.
 */
export interface ArticleGeneratorAgentInput {
  /** Customer identifier */
  customerId: CustomerId;

  /** User making the request */
  userId: UserId;

  /** Type of operation requested */
  operation: 'generate' | 'regenerate' | 'revise' | 'improve';

  /** Source Clear Story data */
  clearStory: {
    id: ClearStoryId;
    topic: string;
    belief: string;
    keyPoints: string[];
    evidence: string[];
    sourceType: string;
  };

  /** Customer context */
  customer: {
    companyName: string;
    industry: string;
    targetAudience: string;
    brandVoice?: string;
    competitorMentions?: string[];
  };

  /** Generation parameters */
  parameters: {
    tone: ContentTone;
    wordCountMin: number;
    wordCountMax: number;
    keywords: string[];
    targetAudience?: string;
    customInstructions?: string;
    requiredSections?: string[];
    callToAction?: string;
    internalLinks?: InternalLink[];
  };

  /** Previous version (for regeneration/revision) */
  previousVersion?: {
    content: string;
    title: string;
    feedback?: string;
  };

  /** Brand guidelines (if available) */
  brandGuidelines?: {
    voiceAndTone: string;
    doNotMention: string[];
    requiredDisclosures?: string[];
    styleGuide?: string;
  };
}

/**
 * Output from Article Generator Agent invocation.
 */
export interface ArticleGeneratorAgentOutput {
  /** Whether the operation succeeded */
  success: boolean;

  /** Generated article data */
  article?: {
    title: string;
    subtitle?: string;
    content: string;
    metaDescription: string;
    keywords: string[];
    wordCount: number;
  };

  /** Error message if failed */
  error?: string;

  /** Error code if failed */
  errorCode?: string;

  /** Suggestions for improvement */
  suggestions?: string[];

  /** SEO score estimate (0-100) */
  seoScore?: number;

  /** Readability score estimate (0-100) */
  readabilityScore?: number;

  /** Operation metadata */
  metadata?: {
    tokensUsed: number;
    latencyMs: number;
    model: string;
    promptVersion: string;
  };
}

/**
 * Tool definition for agent.
 */
export interface AgentToolDefinition {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Input schema */
  inputSchema: Record<string, unknown>;
}

/**
 * Article Generator Agent interface.
 * AI-powered agent for generating articles from Clear Stories.
 */
export interface IArticleGeneratorAgent {
  /**
   * Invoke the article generator agent with given context.
   * Routes to appropriate sub-operation based on input.
   *
   * @param input - Agent input context
   * @returns Agent output with generated article data
   */
  invoke(input: ArticleGeneratorAgentInput): Promise<ArticleGeneratorAgentOutput>;

  /**
   * Get the agent system prompt.
   * Used for testing and debugging.
   */
  readonly systemPrompt: string;

  /**
   * Get the agent tool definitions.
   * Tools available to the agent during generation.
   */
  readonly tools: AgentToolDefinition[];
}

// =============================================================================
// REPOSITORY INTERFACES
// =============================================================================

/** Query options for finding articles by customer */
export interface FindByCustomerOptions {
  status?: ArticleStatus | ArticleStatus[];
  tone?: ContentTone;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'publishedAt';
  orderDir?: 'asc' | 'desc';
}

/**
 * Repository interface for Article persistence.
 * Extends base repository pattern with article-specific queries.
 */
export interface IArticleRepository {
  /**
   * Create a new article.
   *
   * @param article - Article data to create
   * @returns Created article with ID
   */
  create(article: Omit<Article, 'id'>): Promise<Article>;

  /**
   * Find an article by ID.
   *
   * @param id - Article ID
   * @returns Article or null
   */
  findById(id: ArticleId): Promise<Article | null>;

  /**
   * Update an article.
   *
   * @param id - Article ID
   * @param updates - Partial updates
   * @returns Updated article
   */
  update(id: ArticleId, updates: Partial<Article>): Promise<Article>;

  /**
   * Delete an article (soft delete - sets archived status).
   *
   * @param id - Article ID
   */
  delete(id: ArticleId): Promise<void>;

  /**
   * Find articles by customer.
   *
   * @param customerId - Customer ID
   * @param options - Query options
   * @returns Array of articles
   */
  findByCustomer(
    customerId: CustomerId,
    options?: FindByCustomerOptions
  ): Promise<Article[]>;

  /**
   * Find articles by Clear Story.
   *
   * @param clearStoryId - Clear Story ID
   * @returns Array of articles
   */
  findByClearStory(clearStoryId: ClearStoryId): Promise<Article[]>;

  /**
   * Find articles by status.
   *
   * @param status - Status(es) to filter by
   * @param customerId - Optional customer filter
   * @param limit - Max results
   * @param offset - Offset for pagination
   * @returns Array of articles
   */
  findByStatus(
    status: ArticleStatus | ArticleStatus[],
    customerId?: CustomerId,
    limit?: number,
    offset?: number
  ): Promise<Article[]>;

  /**
   * Search articles with full-text search.
   *
   * @param params - Search parameters
   * @returns Paginated results
   */
  search(params: ArticleSearchParams): Promise<{
    items: Article[];
    total: number;
  }>;

  /**
   * Count articles by customer and optional status.
   *
   * @param customerId - Customer ID
   * @param status - Optional status filter
   * @returns Count
   */
  count(customerId: CustomerId, status?: ArticleStatus): Promise<number>;

  /**
   * Get aggregated statistics.
   *
   * @param customerId - Customer ID
   * @returns Statistics object
   */
  getStatistics(customerId: CustomerId): Promise<{
    total: number;
    byStatus: Record<ArticleStatus, number>;
    byTone: Record<ContentTone, number>;
    avgWordCount: number;
    thisMonth: number;
    publishedThisMonth: number;
  }>;
}

/**
 * Repository interface for ArticleVersion persistence.
 */
export interface IArticleVersionRepository {
  /**
   * Create a new version.
   *
   * @param version - Version data
   * @returns Created version with ID
   */
  create(version: Omit<ArticleVersion, 'id'>): Promise<ArticleVersion>;

  /**
   * Find a version by ID.
   *
   * @param id - Version ID
   * @returns Version or null
   */
  findById(id: ArticleVersionId): Promise<ArticleVersion | null>;

  /**
   * Find all versions for an article.
   *
   * @param articleId - Article ID
   * @returns Array of versions ordered by version number
   */
  findByArticle(articleId: ArticleId): Promise<ArticleVersion[]>;

  /**
   * Find a specific version by article and version number.
   *
   * @param articleId - Article ID
   * @param versionNumber - Version number
   * @returns Version or null
   */
  findByVersionNumber(
    articleId: ArticleId,
    versionNumber: number
  ): Promise<ArticleVersion | null>;

  /**
   * Get the latest version for an article.
   *
   * @param articleId - Article ID
   * @returns Latest version or null
   */
  findLatest(articleId: ArticleId): Promise<ArticleVersion | null>;

  /**
   * Count versions for an article.
   *
   * @param articleId - Article ID
   * @returns Version count
   */
  count(articleId: ArticleId): Promise<number>;

  /**
   * Get next version number for an article.
   *
   * @param articleId - Article ID
   * @returns Next version number
   */
  getNextVersionNumber(articleId: ArticleId): Promise<number>;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * POST /articles/generate request body
 */
export interface GenerateArticleRequest {
  customerId: CustomerId;
  clearStoryId: ClearStoryId;
  tone?: ContentTone;
  wordCountTarget?: WordCountTarget;
  keywords?: string[];
  targetAudience?: string;
  customInstructions?: string;
  useBrandGuidelines?: boolean;
  requiredSections?: string[];
  callToAction?: string;
  internalLinks?: InternalLink[];
}

/**
 * POST /articles/generate response
 */
export interface GenerateArticleResponse {
  success: boolean;
  article: Article;
  metadata: ArticleGenerationMetadata;
}

/**
 * POST /articles/:id/regenerate request body
 */
export interface RegenerateArticleRequest {
  tone?: ContentTone;
  wordCountTarget?: WordCountTarget;
  keywords?: string[];
  customInstructions?: string;
  feedbackNote?: string;
}

/**
 * POST /articles/:id/regenerate response
 */
export interface RegenerateArticleResponse {
  success: boolean;
  article: Article;
  version: ArticleVersion;
  metadata: ArticleGenerationMetadata;
}

/**
 * POST /articles request body
 */
export interface CreateArticleRequest {
  customerId: CustomerId;
  clearStoryId: ClearStoryId;
  title: string;
  subtitle?: string;
  content: string;
  tone?: ContentTone;
  metaDescription?: string;
  keywords?: string[];
  targetAudience?: string;
}

/**
 * GET /articles query params
 */
export interface ListArticlesQuery {
  customerId?: CustomerId;
  clearStoryId?: ClearStoryId;
  status?: ArticleStatus | ArticleStatus[];
  tone?: ContentTone;
  createdAfter?: ISOTimestamp;
  createdBefore?: ISOTimestamp;
  publishedAfter?: ISOTimestamp;
  publishedBefore?: ISOTimestamp;
  keyword?: string;
  textSearch?: string;
  minWordCount?: number;
  maxWordCount?: number;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * PATCH /articles/:id request body
 */
export interface UpdateArticleRequest {
  title?: string;
  subtitle?: string;
  content?: string;
  tone?: ContentTone;
  metaDescription?: string;
  keywords?: string[];
  targetAudience?: string;
  changeDescription?: string;
}

/**
 * POST /articles/:id/request-revision request body
 */
export interface RequestRevisionRequest {
  decision: 'request_revision';
  feedbackNote: string;
  improvementAreas?: ImprovementArea[];
  rating?: number;
}

/**
 * POST /articles/:id/approve request body
 */
export interface ApproveArticleRequest {
  feedbackNote?: string;
  rating?: number;
}

/**
 * POST /articles/:id/publish request body
 */
export interface PublishArticleRequest {
  publishedUrl: string;
  platform?: string;
  autoPublish?: boolean;
  scheduledFor?: ISOTimestamp;
}

/**
 * POST /articles/:id/archive request body
 */
export interface ArchiveArticleRequest {
  reason: string;
}

/**
 * POST /articles/:id/revert request body
 */
export interface RevertArticleRequest {
  versionNumber: number;
}

/**
 * GET /articles/:id/versions/compare query params
 */
export interface CompareVersionsQuery {
  versionA: number;
  versionB: number;
}

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Article domain-specific error codes.
 * Use these codes in ApiError responses for consistent error handling.
 */
export const ArticleErrorCodes = {
  // Article Errors
  ARTICLE_NOT_FOUND: 'ARTICLE_NOT_FOUND',
  ARTICLE_ALREADY_EXISTS: 'ARTICLE_ALREADY_EXISTS',
  ARTICLE_INVALID_CONTENT: 'ARTICLE_INVALID_CONTENT',
  ARTICLE_WORD_COUNT_INVALID: 'ARTICLE_WORD_COUNT_INVALID',

  // Generation Errors
  GENERATION_FAILED: 'ARTICLE_GENERATION_FAILED',
  GENERATION_TIMEOUT: 'ARTICLE_GENERATION_TIMEOUT',
  GENERATION_INVALID_SOURCE: 'ARTICLE_GENERATION_INVALID_SOURCE',
  GENERATION_INVALID_RESPONSE: 'ARTICLE_GENERATION_INVALID_RESPONSE',
  REGENERATION_NOT_ALLOWED: 'ARTICLE_REGENERATION_NOT_ALLOWED',

  // Workflow Errors
  INVALID_STATUS_TRANSITION: 'ARTICLE_INVALID_STATUS_TRANSITION',
  NOT_IN_DRAFT: 'ARTICLE_NOT_IN_DRAFT',
  NOT_IN_REVIEW: 'ARTICLE_NOT_IN_REVIEW',
  NOT_APPROVED: 'ARTICLE_NOT_APPROVED',
  ALREADY_PUBLISHED: 'ARTICLE_ALREADY_PUBLISHED',
  ALREADY_ARCHIVED: 'ARTICLE_ALREADY_ARCHIVED',
  FEEDBACK_REQUIRED: 'ARTICLE_FEEDBACK_REQUIRED',

  // Version Errors
  VERSION_NOT_FOUND: 'ARTICLE_VERSION_NOT_FOUND',
  REVERT_TO_CURRENT: 'ARTICLE_REVERT_TO_CURRENT',
  REVERT_PUBLISHED: 'ARTICLE_REVERT_PUBLISHED',
  VERSION_COMPARE_FAILED: 'ARTICLE_VERSION_COMPARE_FAILED',

  // Reference Errors
  CLEAR_STORY_NOT_FOUND: 'ARTICLE_CLEAR_STORY_NOT_FOUND',
  CUSTOMER_NOT_FOUND: 'ARTICLE_CUSTOMER_NOT_FOUND',

  // Quota/Authorization Errors
  QUOTA_EXCEEDED: 'ARTICLE_QUOTA_EXCEEDED',
  UNAUTHORIZED_ACCESS: 'ARTICLE_UNAUTHORIZED_ACCESS',
  UNAUTHORIZED_ACTION: 'ARTICLE_UNAUTHORIZED_ACTION'
} as const;

/**
 * Type for Article error codes
 */
export type ArticleErrorCode = typeof ArticleErrorCodes[keyof typeof ArticleErrorCodes];

// =============================================================================
// EVENTS
// =============================================================================

/**
 * Events the Article domain publishes for other domains to consume.
 * Events are published to the event bus when article state changes.
 */
export interface ArticleEvents {
  /**
   * Emitted when a new article is created (generated or manual).
   * Subscribers: Analytics, Scheduling
   */
  'article.created': {
    articleId: ArticleId;
    customerId: CustomerId;
    clearStoryId: ClearStoryId;
    title: string;
    tone: ContentTone;
    wordCount: number;
    isAiGenerated: boolean;
    agentSessionId?: AgentSessionId;
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when an article is submitted for review.
   * Subscribers: Analytics
   */
  'article.submitted_for_review': {
    articleId: ArticleId;
    customerId: CustomerId;
    submittedBy: UserId;
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when revision is requested on an article.
   * Subscribers: Analytics
   */
  'article.revision_requested': {
    articleId: ArticleId;
    customerId: CustomerId;
    requestedBy: UserId;
    feedbackNote: string;
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when an article is approved for publishing.
   * Subscribers: Reddit Distribution, Analytics, Scheduling
   */
  'article.approved': {
    articleId: ArticleId;
    customerId: CustomerId;
    clearStoryId: ClearStoryId;
    title: string;
    approvedBy: UserId;
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when an article is published.
   * Subscribers: Analytics, Reddit Distribution
   */
  'article.published': {
    articleId: ArticleId;
    customerId: CustomerId;
    clearStoryId: ClearStoryId;
    publishedUrl: string;
    platform?: string;
    publishedBy: UserId;
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when an article is archived.
   * Subscribers: Analytics, Scheduling
   */
  'article.archived': {
    articleId: ArticleId;
    customerId: CustomerId;
    previousStatus: ArticleStatus;
    reason: string;
    archivedBy: UserId;
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when article content is regenerated.
   * Subscribers: Analytics
   */
  'article.regenerated': {
    articleId: ArticleId;
    customerId: CustomerId;
    versionNumber: number;
    agentSessionId: AgentSessionId;
    tokensUsed: number;
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when article is reverted to previous version.
   * Subscribers: Analytics
   */
  'article.reverted': {
    articleId: ArticleId;
    customerId: CustomerId;
    fromVersion: number;
    toVersion: number;
    revertedBy: UserId;
    timestamp: ISOTimestamp;
  };
}

/**
 * Events the Article domain consumes from other domains.
 */
export interface ConsumedEvents {
  /**
   * From Clear Story domain - when a Clear Story is selected for content generation.
   * Triggers: May auto-generate article draft for customer.
   */
  'clear_story.selected': {
    clearStoryId: ClearStoryId;
    customerId: CustomerId;
    selectedBy: UserId;
    topic: string;
    beliefSummary: string;
    timestamp: ISOTimestamp;
  };

  /**
   * From User/Customer domain - when customer brand guidelines are updated.
   * Triggers: Future articles will use updated guidelines.
   */
  'customer.brand_guidelines_updated': {
    customerId: CustomerId;
    guidelineVersion: string;
    timestamp: ISOTimestamp;
  };

  /**
   * From User/Customer domain - when customer subscription changes.
   * Triggers: Updates quota checks for article generation.
   */
  'customer.tier_changed': {
    customerId: CustomerId;
    newTier: CustomerTier;
    previousTier: CustomerTier;
    timestamp: ISOTimestamp;
  };

  /**
   * From Clear Story domain - when a Clear Story is archived/deleted.
   * Triggers: May update articles referencing this Clear Story.
   */
  'clear_story.archived': {
    clearStoryId: ClearStoryId;
    customerId: CustomerId;
    timestamp: ISOTimestamp;
  };
}

/**
 * Event handler interface for Article domain.
 * Implement this to handle incoming events from other domains.
 */
export interface IArticleEventHandler {
  /**
   * Handle Clear Story selection event.
   * May trigger automatic article draft generation.
   */
  handleClearStorySelected(event: ConsumedEvents['clear_story.selected']): Promise<void>;

  /**
   * Handle brand guidelines update.
   * Updates internal cache of customer guidelines.
   */
  handleBrandGuidelinesUpdated(
    event: ConsumedEvents['customer.brand_guidelines_updated']
  ): Promise<void>;

  /**
   * Handle customer tier change.
   * Updates quota limits for article generation.
   */
  handleCustomerTierChanged(event: ConsumedEvents['customer.tier_changed']): Promise<void>;

  /**
   * Handle Clear Story archived.
   * May add note to articles referencing archived Clear Story.
   */
  handleClearStoryArchived(event: ConsumedEvents['clear_story.archived']): Promise<void>;
}
