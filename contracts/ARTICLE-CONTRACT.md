# ARTICLE Domain Contract

> **Version**: 1.0.0
> **Domain**: Article
> **Owner**: Article Agent
> **Last Updated**: 2026-01-18

This contract defines the complete interface for the Article domain in the LEO Automation Platform. The Article domain is responsible for generating, storing, versioning, reviewing, and publishing articles derived from Clear Stories. All implementations must adhere to these types and interfaces.

---

## Table of Contents

1. [Imports from Shared Primitives](#imports-from-shared-primitives)
2. [Cross-Domain References](#cross-domain-references)
3. [Domain-Specific Types](#domain-specific-types)
4. [Service Interface](#service-interface)
5. [Agent Interface](#agent-interface)
6. [Repository Interface](#repository-interface)
7. [API Routes](#api-routes)
8. [Validation Schemas](#validation-schemas)
9. [Error Codes](#error-codes)
10. [Integration Points](#integration-points)

---

## Imports from Shared Primitives

```typescript
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
  ArticleRef,
  ClearStoryRef,
  CustomerRef,
  UserRef,
  AgentSessionRef,

  // API Patterns
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  SearchParams,
  AuditInfo,
  ISOTimestamp
} from './shared-primitives';
```

---

## Cross-Domain References

### ClearStoryRef

Reference to Clear Story from the Clear Story domain. The Article domain reads this but does not own it.

```typescript
/**
 * Minimal Clear Story reference used by Article domain.
 * The Clear Story domain owns the full ClearStory entity.
 */
export interface ClearStoryRef {
  /** Unique identifier for the Clear Story */
  id: ClearStoryId;

  /** Topic/category of the belief */
  topic: string;

  /** First 200 characters of the belief for preview */
  beliefSummary: string;
}
```

### CustomerRef

Reference to Customer from the User/Customer domain.

```typescript
/**
 * Minimal customer reference for article ownership.
 * The User/Customer domain owns the full Customer entity.
 */
export interface CustomerRef {
  /** Unique identifier for the customer */
  id: CustomerId;

  /** Company name for display */
  companyName: string;

  /** Customer tier affects quotas and features */
  tier: CustomerTier;
}
```

### UserRef

Reference to User for audit trails.

```typescript
/**
 * Minimal user reference for tracking who performed actions.
 * The User/Customer domain owns the full User entity.
 */
export interface UserRef {
  /** Unique identifier for the user */
  id: UserId;

  /** User's email address */
  email: string;

  /** Display name for UI */
  displayName: string;
}
```

---

## Domain-Specific Types

### ArticleStatus Enum

```typescript
/**
 * Lifecycle states for articles.
 * Articles progress through these states during the review workflow.
 */
export enum ArticleStatus {
  /** Initial generation, not yet reviewed */
  draft = 'draft',

  /** Submitted for human review */
  review = 'review',

  /** Reviewer requested changes/regeneration */
  revision_requested = 'revision_requested',

  /** Approved for publishing */
  approved = 'approved',

  /** Published to customer's blog/site */
  published = 'published',

  /** No longer active, removed from distribution */
  archived = 'archived'
}
```

### ContentTone Enum

```typescript
/**
 * Tone options for generated article content.
 * Aligns with customer brand guidelines.
 */
export enum ContentTone {
  /** Expert, research-backed tone */
  authoritative = 'authoritative',

  /** Friendly, approachable tone */
  conversational = 'conversational',

  /** Teaching, informative tone */
  educational = 'educational',

  /** Understanding, supportive tone */
  empathetic = 'empathetic',

  /** Business-appropriate tone */
  professional = 'professional'
}
```

### Article

```typescript
/**
 * Full Article entity representing a generated blog article.
 * Articles are generated from Clear Stories using Claude agents
 * and go through a review workflow before publishing.
 */
export interface Article {
  /** Unique identifier for the article (format: art_${uuid}) */
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
```

### ArticleVersion

```typescript
/**
 * Represents a specific version/revision of an article.
 * New versions are created when content is regenerated or edited.
 */
export interface ArticleVersion {
  /** Unique identifier for this version (format: artv_${uuid}) */
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
  changeType: 'initial' | 'manual_edit' | 'regeneration' | 'ai_revision';

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
```

### ArticleGenerationMetadata

```typescript
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
```

### ArticleSearchParams

```typescript
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
```

### CreateArticleInput

```typescript
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
```

### UpdateArticleInput

```typescript
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
```

### ArticleGenerationRequest

```typescript
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
  wordCountTarget?: {
    min: number;  // Default: 1200
    max: number;  // Default: 1800
  };

  /** SEO keywords to incorporate */
  keywords?: string[];

  /** Target audience description */
  targetAudience?: string;

  /** Custom instructions for the generator */
  customInstructions?: string;

  /** Whether to use customer's brand guidelines */
  useBrandGuidelines?: boolean;

  /** Specific sections to include */
  requiredSections?: string[];

  /** Call-to-action text to include */
  callToAction?: string;

  /** Links to include in the article */
  internalLinks?: Array<{
    url: string;
    anchorText: string;
  }>;
}
```

### ArticleGenerationResult

```typescript
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
```

### ReviewFeedback

```typescript
/**
 * Feedback provided during article review.
 */
export interface ReviewFeedback {
  /** Overall assessment */
  decision: 'approve' | 'request_revision' | 'reject';

  /** Detailed feedback for revisions */
  feedbackNote?: string;

  /** Specific areas needing improvement */
  improvementAreas?: Array<{
    section: string;
    issue: string;
    suggestion?: string;
  }>;

  /** Rating (1-5 stars) */
  rating?: number;
}
```

### PublishInput

```typescript
/**
 * Input for publishing an approved article.
 */
export interface PublishInput {
  /** URL where article was/will be published */
  publishedUrl: string;

  /** Platform where published (e.g., 'wordpress', 'ghost', 'custom') */
  platform?: string;

  /** Whether to auto-publish or just mark as published */
  autoPublish?: boolean;

  /** Scheduled publish time (if scheduling) */
  scheduledFor?: ISOTimestamp;
}
```

### ArticleSummary

```typescript
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
```

---

## Service Interface

```typescript
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
   * @throws ArticleNotFoundError if article doesn't exist
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
   * @throws ArticleNotFoundError if article doesn't exist
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
   * @throws ArticleNotFoundError if article doesn't exist
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
   * @throws ArticleNotFoundError if article doesn't exist
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
   * @throws ArticleNotFoundError if article doesn't exist
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
   * @throws ArticleNotFoundError if article doesn't exist
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
   * @throws ArticleNotFoundError if article doesn't exist
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
   * @throws ArticleNotFoundError if article doesn't exist
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
   * @throws ArticleNotFoundError if article doesn't exist
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
   * @throws ArticleNotFoundError if article doesn't exist
   * @throws VersionNotFoundError if version doesn't exist
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
```

---

## Agent Interface

### Agent Input/Output Types

```typescript
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
    internalLinks?: Array<{
      url: string;
      anchorText: string;
    }>;
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
```

### Agent Interface

```typescript
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
   * Get the agent's system prompt.
   * Used for testing and debugging.
   */
  readonly systemPrompt: string;

  /**
   * Get the agent's tool definitions.
   * Tools available to the agent during generation.
   */
  readonly tools: AgentToolDefinition[];
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
```

---

## Repository Interface

```typescript
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
    options?: {
      status?: ArticleStatus | ArticleStatus[];
      tone?: ContentTone;
      limit?: number;
      offset?: number;
      orderBy?: 'createdAt' | 'updatedAt' | 'publishedAt';
      orderDir?: 'asc' | 'desc';
    }
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
```

---

## API Routes

### Route Definitions

```yaml
# =========================================================================
# ARTICLE GENERATION
# =========================================================================

# POST /articles/generate
# Generate a new article using AI from a Clear Story
POST /articles/generate:
  auth: required (customer_admin, customer_editor)
  body:
    customerId: CustomerId (required)
    clearStoryId: ClearStoryId (required)
    tone: ContentTone (optional, default: authoritative)
    wordCountTarget:
      min: number (optional, default: 1200)
      max: number (optional, default: 1800)
    keywords: string[] (optional)
    targetAudience: string (optional)
    customInstructions: string (optional)
    useBrandGuidelines: boolean (optional, default: true)
    requiredSections: string[] (optional)
    callToAction: string (optional)
    internalLinks: Array<{url, anchorText}> (optional)
  response:
    202:
      success: boolean
      article: Article
      metadata: ArticleGenerationMetadata
    400: Validation error
    403: Quota exceeded
    404: Clear Story not found
    500: Generation failed

# POST /articles/:id/regenerate
# Regenerate an existing article with updated parameters
POST /articles/:id/regenerate:
  auth: required (customer_admin, customer_editor)
  params:
    id: ArticleId
  body:
    tone: ContentTone (optional)
    wordCountTarget: {min, max} (optional)
    keywords: string[] (optional)
    customInstructions: string (optional)
    feedbackNote: string (optional - reviewer feedback to address)
  response:
    202:
      success: boolean
      article: Article
      version: ArticleVersion
      metadata: ArticleGenerationMetadata
    400: Validation error
    404: Article not found

# =========================================================================
# CRUD OPERATIONS
# =========================================================================

# POST /articles
# Create a new article manually
POST /articles:
  auth: required (customer_admin, customer_editor)
  body:
    customerId: CustomerId (required)
    clearStoryId: ClearStoryId (required)
    title: string (required)
    subtitle: string (optional)
    content: string (required)
    tone: ContentTone (optional)
    metaDescription: string (optional)
    keywords: string[] (optional)
    targetAudience: string (optional)
  response:
    201: Article
    400: Validation error
    404: Clear Story not found

# GET /articles/:id
# Get article by ID
GET /articles/:id:
  auth: required
  params:
    id: ArticleId
  query:
    includeVersions: boolean (optional, default: false)
  response:
    200: Article (with versions if requested)
    404: Article not found

# GET /articles
# Search and list articles
GET /articles:
  auth: required
  query:
    customerId: CustomerId (optional - required for non-admin)
    clearStoryId: ClearStoryId (optional)
    status: ArticleStatus | ArticleStatus[] (optional)
    tone: ContentTone (optional)
    createdAfter: ISOTimestamp (optional)
    createdBefore: ISOTimestamp (optional)
    publishedAfter: ISOTimestamp (optional)
    publishedBefore: ISOTimestamp (optional)
    keyword: string (optional)
    textSearch: string (optional)
    minWordCount: number (optional)
    maxWordCount: number (optional)
    includeArchived: boolean (optional, default: false)
    page: number (optional, default: 1)
    pageSize: number (optional, default: 20, max: 100)
    sortBy: string (optional, default: createdAt)
    sortOrder: 'asc' | 'desc' (optional, default: desc)
  response:
    200: PaginatedResponse<ArticleSummary>

# PATCH /articles/:id
# Update an article
PATCH /articles/:id:
  auth: required (customer_admin, customer_editor)
  params:
    id: ArticleId
  body:
    title: string (optional)
    subtitle: string (optional)
    content: string (optional)
    tone: ContentTone (optional)
    metaDescription: string (optional)
    keywords: string[] (optional)
    targetAudience: string (optional)
    changeDescription: string (required if content changes)
  response:
    200: Article
    400: Validation error
    404: Article not found
    409: Invalid status for edit

# DELETE /articles/:id
# Archive an article
DELETE /articles/:id:
  auth: required (customer_admin)
  params:
    id: ArticleId
  query:
    reason: string (optional)
  response:
    200: { success: true }
    404: Article not found
    409: Already archived

# =========================================================================
# REVIEW WORKFLOW
# =========================================================================

# POST /articles/:id/submit-for-review
# Submit article for review
POST /articles/:id/submit-for-review:
  auth: required (customer_admin, customer_editor)
  params:
    id: ArticleId
  response:
    200: Article
    404: Article not found
    409: Invalid status transition (not in draft)

# POST /articles/:id/request-revision
# Request revision on article
POST /articles/:id/request-revision:
  auth: required (customer_admin, customer_reviewer)
  params:
    id: ArticleId
  body:
    decision: 'request_revision' (required)
    feedbackNote: string (required)
    improvementAreas: Array<{section, issue, suggestion}> (optional)
    rating: number (optional, 1-5)
  response:
    200: Article
    400: Feedback required
    404: Article not found
    409: Invalid status transition (not in review)

# POST /articles/:id/approve
# Approve article for publishing
POST /articles/:id/approve:
  auth: required (customer_admin, customer_reviewer)
  params:
    id: ArticleId
  body:
    feedbackNote: string (optional)
    rating: number (optional, 1-5)
  response:
    200: Article
    404: Article not found
    409: Invalid status transition (not in review)

# POST /articles/:id/publish
# Publish approved article
POST /articles/:id/publish:
  auth: required (customer_admin)
  params:
    id: ArticleId
  body:
    publishedUrl: string (required, valid URL)
    platform: string (optional)
    autoPublish: boolean (optional)
    scheduledFor: ISOTimestamp (optional)
  response:
    200: Article
    400: Invalid URL
    404: Article not found
    409: Invalid status transition (not approved)

# POST /articles/:id/archive
# Archive article
POST /articles/:id/archive:
  auth: required (customer_admin)
  params:
    id: ArticleId
  body:
    reason: string (required)
  response:
    200: Article
    400: Reason required
    404: Article not found
    409: Already archived

# =========================================================================
# VERSION MANAGEMENT
# =========================================================================

# GET /articles/:id/versions
# Get version history for article
GET /articles/:id/versions:
  auth: required
  params:
    id: ArticleId
  query:
    page: number (optional, default: 1)
    pageSize: number (optional, default: 20)
  response:
    200: PaginatedResponse<ArticleVersion>
    404: Article not found

# GET /articles/:id/versions/:versionNumber
# Get specific version
GET /articles/:id/versions/:versionNumber:
  auth: required
  params:
    id: ArticleId
    versionNumber: number
  response:
    200: ArticleVersion
    404: Version not found

# POST /articles/:id/revert
# Revert to previous version
POST /articles/:id/revert:
  auth: required (customer_admin, customer_editor)
  params:
    id: ArticleId
  body:
    versionNumber: number (required)
  response:
    200: Article
    400: Invalid version number
    404: Article or version not found
    409: Cannot revert published article

# GET /articles/:id/versions/compare
# Compare two versions
GET /articles/:id/versions/compare:
  auth: required
  params:
    id: ArticleId
  query:
    versionA: number (required)
    versionB: number (required)
  response:
    200: ArticleVersionDiff
    400: Same version comparison
    404: Article or version not found

# =========================================================================
# QUERY ENDPOINTS
# =========================================================================

# GET /customers/:customerId/articles
# Get articles by customer
GET /customers/:customerId/articles:
  auth: required
  params:
    customerId: CustomerId
  query:
    status: ArticleStatus (optional)
    page: number (optional)
    pageSize: number (optional)
  response:
    200: PaginatedResponse<ArticleSummary>
    403: Unauthorized for customer

# GET /customers/:customerId/articles/statistics
# Get article statistics for customer
GET /customers/:customerId/articles/statistics:
  auth: required
  params:
    customerId: CustomerId
  response:
    200: ArticleStatistics
    403: Unauthorized for customer

# GET /clear-stories/:clearStoryId/articles
# Get articles by Clear Story
GET /clear-stories/:clearStoryId/articles:
  auth: required
  params:
    clearStoryId: ClearStoryId
  query:
    page: number (optional)
    pageSize: number (optional)
  response:
    200: PaginatedResponse<ArticleSummary>
    404: Clear Story not found
```

### TypeScript Route Types

```typescript
// =========================================================================
// Generation Endpoints
// =========================================================================

/**
 * POST /articles/generate request body
 */
export interface GenerateArticleRequest {
  customerId: CustomerId;
  clearStoryId: ClearStoryId;
  tone?: ContentTone;
  wordCountTarget?: {
    min: number;
    max: number;
  };
  keywords?: string[];
  targetAudience?: string;
  customInstructions?: string;
  useBrandGuidelines?: boolean;
  requiredSections?: string[];
  callToAction?: string;
  internalLinks?: Array<{
    url: string;
    anchorText: string;
  }>;
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
  wordCountTarget?: {
    min: number;
    max: number;
  };
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

// =========================================================================
// CRUD Endpoints
// =========================================================================

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

// =========================================================================
// Review Workflow Endpoints
// =========================================================================

/**
 * POST /articles/:id/request-revision request body
 */
export interface RequestRevisionRequest {
  decision: 'request_revision';
  feedbackNote: string;
  improvementAreas?: Array<{
    section: string;
    issue: string;
    suggestion?: string;
  }>;
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

// =========================================================================
// Version Endpoints
// =========================================================================

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
```

---

## Validation Schemas

```typescript
import { z } from 'zod';

// =========================================================================
// Base Schemas
// =========================================================================

/**
 * Article ID format validation
 */
const ArticleIdSchema = z.string().regex(
  /^art_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  'Article ID must be in format art_${uuid}'
);

/**
 * Article Version ID format validation
 */
const ArticleVersionIdSchema = z.string().regex(
  /^artv_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  'Article Version ID must be in format artv_${uuid}'
);

/**
 * Clear Story ID format validation
 */
const ClearStoryIdSchema = z.string().regex(
  /^cs_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  'Clear Story ID must be in format cs_${uuid}'
);

/**
 * Customer ID format validation
 */
const CustomerIdSchema = z.string().regex(
  /^cust_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  'Customer ID must be in format cust_${uuid}'
);

/**
 * URL format validation
 */
const UrlSchema = z.string().url('Must be a valid URL');

/**
 * ISO timestamp format validation
 */
const ISOTimestampSchema = z.string().datetime('Must be a valid ISO 8601 timestamp');

// =========================================================================
// Enum Schemas
// =========================================================================

/**
 * Article status enum validation
 */
export const ArticleStatusSchema = z.enum([
  'draft',
  'review',
  'revision_requested',
  'approved',
  'published',
  'archived'
]);

/**
 * Content tone enum validation
 */
export const ContentToneSchema = z.enum([
  'authoritative',
  'conversational',
  'educational',
  'empathetic',
  'professional'
]);

// =========================================================================
// Input Validation Schemas
// =========================================================================

/**
 * Generate article input validation
 */
export const GenerateArticleSchema = z.object({
  customerId: CustomerIdSchema,
  clearStoryId: ClearStoryIdSchema,
  tone: ContentToneSchema.optional().default('authoritative'),
  wordCountTarget: z.object({
    min: z.number().int().min(500).max(5000).default(1200),
    max: z.number().int().min(500).max(5000).default(1800)
  }).optional(),
  keywords: z.array(z.string().min(1).max(50)).max(20).optional(),
  targetAudience: z.string().max(500).optional(),
  customInstructions: z.string().max(2000).optional(),
  useBrandGuidelines: z.boolean().optional().default(true),
  requiredSections: z.array(z.string().min(1).max(100)).max(10).optional(),
  callToAction: z.string().max(500).optional(),
  internalLinks: z.array(z.object({
    url: UrlSchema,
    anchorText: z.string().min(1).max(100)
  })).max(10).optional()
}).refine(
  (data) => !data.wordCountTarget || data.wordCountTarget.min <= data.wordCountTarget.max,
  { message: 'wordCountTarget.min must be less than or equal to wordCountTarget.max' }
);

/**
 * Regenerate article input validation
 */
export const RegenerateArticleSchema = z.object({
  tone: ContentToneSchema.optional(),
  wordCountTarget: z.object({
    min: z.number().int().min(500).max(5000),
    max: z.number().int().min(500).max(5000)
  }).optional(),
  keywords: z.array(z.string().min(1).max(50)).max(20).optional(),
  customInstructions: z.string().max(2000).optional(),
  feedbackNote: z.string().max(2000).optional()
});

/**
 * Create article input validation
 */
export const CreateArticleSchema = z.object({
  customerId: CustomerIdSchema,
  clearStoryId: ClearStoryIdSchema,
  title: z.string().min(10).max(200),
  subtitle: z.string().max(300).optional(),
  content: z.string().min(500).max(50000),
  tone: ContentToneSchema.optional().default('authoritative'),
  metaDescription: z.string().min(50).max(160).optional(),
  keywords: z.array(z.string().min(1).max(50)).max(20).optional(),
  targetAudience: z.string().max(500).optional()
});

/**
 * Update article input validation
 */
export const UpdateArticleSchema = z.object({
  title: z.string().min(10).max(200).optional(),
  subtitle: z.string().max(300).optional(),
  content: z.string().min(500).max(50000).optional(),
  tone: ContentToneSchema.optional(),
  metaDescription: z.string().min(50).max(160).optional(),
  keywords: z.array(z.string().min(1).max(50)).max(20).optional(),
  targetAudience: z.string().max(500).optional(),
  changeDescription: z.string().max(500).optional()
}).refine(
  (data) => !data.content || data.changeDescription,
  { message: 'changeDescription is required when updating content' }
);

/**
 * Request revision input validation
 */
export const RequestRevisionSchema = z.object({
  decision: z.literal('request_revision'),
  feedbackNote: z.string().min(10).max(2000),
  improvementAreas: z.array(z.object({
    section: z.string().min(1).max(100),
    issue: z.string().min(1).max(500),
    suggestion: z.string().max(500).optional()
  })).max(10).optional(),
  rating: z.number().int().min(1).max(5).optional()
});

/**
 * Approve article input validation
 */
export const ApproveArticleSchema = z.object({
  feedbackNote: z.string().max(2000).optional(),
  rating: z.number().int().min(1).max(5).optional()
});

/**
 * Publish article input validation
 */
export const PublishArticleSchema = z.object({
  publishedUrl: UrlSchema,
  platform: z.string().max(50).optional(),
  autoPublish: z.boolean().optional(),
  scheduledFor: ISOTimestampSchema.optional()
});

/**
 * Archive article input validation
 */
export const ArchiveArticleSchema = z.object({
  reason: z.string().min(5).max(500)
});

/**
 * Revert article input validation
 */
export const RevertArticleSchema = z.object({
  versionNumber: z.number().int().min(1)
});

/**
 * Article search params validation
 */
export const ArticleSearchParamsSchema = z.object({
  customerId: CustomerIdSchema.optional(),
  clearStoryId: ClearStoryIdSchema.optional(),
  status: z.union([
    ArticleStatusSchema,
    z.array(ArticleStatusSchema)
  ]).optional(),
  tone: ContentToneSchema.optional(),
  createdAfter: ISOTimestampSchema.optional(),
  createdBefore: ISOTimestampSchema.optional(),
  publishedAfter: ISOTimestampSchema.optional(),
  publishedBefore: ISOTimestampSchema.optional(),
  keyword: z.string().max(50).optional(),
  textSearch: z.string().max(200).optional(),
  minWordCount: z.number().int().min(0).optional(),
  maxWordCount: z.number().int().max(100000).optional(),
  includeArchived: z.boolean().optional().default(false),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'publishedAt', 'title', 'wordCount']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

/**
 * Compare versions query validation
 */
export const CompareVersionsSchema = z.object({
  versionA: z.number().int().min(1),
  versionB: z.number().int().min(1)
}).refine(
  (data) => data.versionA !== data.versionB,
  { message: 'Cannot compare a version with itself' }
);
```

---

## Error Codes

```typescript
/**
 * Article domain-specific error codes.
 * Use these codes in ApiError responses for consistent error handling.
 */
export const ArticleErrorCodes = {
  // ─────────────────────────────────────────────────────────────────────────
  // Article Errors
  // ─────────────────────────────────────────────────────────────────────────

  /** Article not found with given ID */
  ARTICLE_NOT_FOUND: 'ARTICLE_NOT_FOUND',

  /** Article already exists (duplicate) */
  ARTICLE_ALREADY_EXISTS: 'ARTICLE_ALREADY_EXISTS',

  /** Article content validation failed */
  ARTICLE_INVALID_CONTENT: 'ARTICLE_INVALID_CONTENT',

  /** Article word count outside allowed range */
  ARTICLE_WORD_COUNT_INVALID: 'ARTICLE_WORD_COUNT_INVALID',

  // ─────────────────────────────────────────────────────────────────────────
  // Generation Errors
  // ─────────────────────────────────────────────────────────────────────────

  /** Article generation failed */
  GENERATION_FAILED: 'ARTICLE_GENERATION_FAILED',

  /** Generation timed out */
  GENERATION_TIMEOUT: 'ARTICLE_GENERATION_TIMEOUT',

  /** Clear Story not suitable for article generation */
  GENERATION_INVALID_SOURCE: 'ARTICLE_GENERATION_INVALID_SOURCE',

  /** AI model returned invalid response */
  GENERATION_INVALID_RESPONSE: 'ARTICLE_GENERATION_INVALID_RESPONSE',

  /** Regeneration not allowed in current status */
  REGENERATION_NOT_ALLOWED: 'ARTICLE_REGENERATION_NOT_ALLOWED',

  // ─────────────────────────────────────────────────────────────────────────
  // Workflow Errors
  // ─────────────────────────────────────────────────────────────────────────

  /** Invalid status transition attempted */
  INVALID_STATUS_TRANSITION: 'ARTICLE_INVALID_STATUS_TRANSITION',

  /** Article not in draft status for submission */
  NOT_IN_DRAFT: 'ARTICLE_NOT_IN_DRAFT',

  /** Article not in review status for approval/revision */
  NOT_IN_REVIEW: 'ARTICLE_NOT_IN_REVIEW',

  /** Article not approved for publishing */
  NOT_APPROVED: 'ARTICLE_NOT_APPROVED',

  /** Article already published */
  ALREADY_PUBLISHED: 'ARTICLE_ALREADY_PUBLISHED',

  /** Article already archived */
  ALREADY_ARCHIVED: 'ARTICLE_ALREADY_ARCHIVED',

  /** Feedback required for revision request */
  FEEDBACK_REQUIRED: 'ARTICLE_FEEDBACK_REQUIRED',

  // ─────────────────────────────────────────────────────────────────────────
  // Version Errors
  // ─────────────────────────────────────────────────────────────────────────

  /** Version not found */
  VERSION_NOT_FOUND: 'ARTICLE_VERSION_NOT_FOUND',

  /** Cannot revert to current version */
  REVERT_TO_CURRENT: 'ARTICLE_REVERT_TO_CURRENT',

  /** Cannot revert published article without unpublishing */
  REVERT_PUBLISHED: 'ARTICLE_REVERT_PUBLISHED',

  /** Version comparison failed */
  VERSION_COMPARE_FAILED: 'ARTICLE_VERSION_COMPARE_FAILED',

  // ─────────────────────────────────────────────────────────────────────────
  // Reference Errors
  // ─────────────────────────────────────────────────────────────────────────

  /** Referenced Clear Story not found */
  CLEAR_STORY_NOT_FOUND: 'ARTICLE_CLEAR_STORY_NOT_FOUND',

  /** Referenced Customer not found */
  CUSTOMER_NOT_FOUND: 'ARTICLE_CUSTOMER_NOT_FOUND',

  // ─────────────────────────────────────────────────────────────────────────
  // Quota/Authorization Errors
  // ─────────────────────────────────────────────────────────────────────────

  /** Customer's article quota exceeded */
  QUOTA_EXCEEDED: 'ARTICLE_QUOTA_EXCEEDED',

  /** User not authorized to access article */
  UNAUTHORIZED_ACCESS: 'ARTICLE_UNAUTHORIZED_ACCESS',

  /** User not authorized to perform action */
  UNAUTHORIZED_ACTION: 'ARTICLE_UNAUTHORIZED_ACTION'

} as const;

/**
 * Type for Article error codes
 */
export type ArticleErrorCode = typeof ArticleErrorCodes[keyof typeof ArticleErrorCodes];
```

---

## Integration Points

### Events Published (to other domains)

```typescript
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
    /** Article ID */
    articleId: ArticleId;

    /** Customer who owns the article */
    customerId: CustomerId;

    /** Source Clear Story */
    clearStoryId: ClearStoryId;

    /** Article title */
    title: string;

    /** Content tone */
    tone: ContentTone;

    /** Word count */
    wordCount: number;

    /** Whether AI-generated */
    isAiGenerated: boolean;

    /** Agent session ID (if AI-generated) */
    agentSessionId?: AgentSessionId;

    /** When created */
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when an article is submitted for review.
   * Subscribers: Analytics
   */
  'article.submitted_for_review': {
    /** Article ID */
    articleId: ArticleId;

    /** Customer ID */
    customerId: CustomerId;

    /** User who submitted */
    submittedBy: UserId;

    /** When submitted */
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when revision is requested on an article.
   * Subscribers: Analytics
   */
  'article.revision_requested': {
    /** Article ID */
    articleId: ArticleId;

    /** Customer ID */
    customerId: CustomerId;

    /** Reviewer who requested */
    requestedBy: UserId;

    /** Feedback note */
    feedbackNote: string;

    /** When requested */
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when an article is approved for publishing.
   * Subscribers: Reddit Distribution, Analytics, Scheduling
   */
  'article.approved': {
    /** Article ID */
    articleId: ArticleId;

    /** Customer ID */
    customerId: CustomerId;

    /** Source Clear Story */
    clearStoryId: ClearStoryId;

    /** Article title */
    title: string;

    /** Reviewer who approved */
    approvedBy: UserId;

    /** When approved */
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when an article is published.
   * Subscribers: Analytics, Reddit Distribution
   */
  'article.published': {
    /** Article ID */
    articleId: ArticleId;

    /** Customer ID */
    customerId: CustomerId;

    /** Source Clear Story */
    clearStoryId: ClearStoryId;

    /** Published URL */
    publishedUrl: string;

    /** Publishing platform */
    platform?: string;

    /** User who published */
    publishedBy: UserId;

    /** When published */
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when an article is archived.
   * Subscribers: Analytics, Scheduling
   */
  'article.archived': {
    /** Article ID */
    articleId: ArticleId;

    /** Customer ID */
    customerId: CustomerId;

    /** Previous status before archiving */
    previousStatus: ArticleStatus;

    /** Reason for archiving */
    reason: string;

    /** User who archived */
    archivedBy: UserId;

    /** When archived */
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when article content is regenerated.
   * Subscribers: Analytics
   */
  'article.regenerated': {
    /** Article ID */
    articleId: ArticleId;

    /** Customer ID */
    customerId: CustomerId;

    /** New version number */
    versionNumber: number;

    /** Agent session ID */
    agentSessionId: AgentSessionId;

    /** Tokens used in regeneration */
    tokensUsed: number;

    /** When regenerated */
    timestamp: ISOTimestamp;
  };

  /**
   * Emitted when article is reverted to previous version.
   * Subscribers: Analytics
   */
  'article.reverted': {
    /** Article ID */
    articleId: ArticleId;

    /** Customer ID */
    customerId: CustomerId;

    /** Version reverted from */
    fromVersion: number;

    /** Version reverted to */
    toVersion: number;

    /** User who reverted */
    revertedBy: UserId;

    /** When reverted */
    timestamp: ISOTimestamp;
  };
}
```

### Events Consumed (from other domains)

```typescript
/**
 * Events the Article domain consumes from other domains.
 */
export interface ConsumedEvents {
  /**
   * From Clear Story domain - when a Clear Story is selected for content generation.
   * Triggers: May auto-generate article draft for customer.
   */
  'clear_story.selected': {
    /** Clear Story ID */
    clearStoryId: ClearStoryId;

    /** Customer ID */
    customerId: CustomerId;

    /** User who selected */
    selectedBy: UserId;

    /** Clear Story topic */
    topic: string;

    /** Brief belief summary */
    beliefSummary: string;

    /** When selected */
    timestamp: ISOTimestamp;
  };

  /**
   * From User/Customer domain - when customer brand guidelines are updated.
   * Triggers: Future articles will use updated guidelines.
   */
  'customer.brand_guidelines_updated': {
    /** Customer ID */
    customerId: CustomerId;

    /** Updated guideline version */
    guidelineVersion: string;

    /** When updated */
    timestamp: ISOTimestamp;
  };

  /**
   * From User/Customer domain - when customer subscription changes.
   * Triggers: Updates quota checks for article generation.
   */
  'customer.tier_changed': {
    /** Customer ID */
    customerId: CustomerId;

    /** New tier */
    newTier: CustomerTier;

    /** Previous tier */
    previousTier: CustomerTier;

    /** When changed */
    timestamp: ISOTimestamp;
  };

  /**
   * From Clear Story domain - when a Clear Story is archived/deleted.
   * Triggers: May update articles referencing this Clear Story.
   */
  'clear_story.archived': {
    /** Clear Story ID */
    clearStoryId: ClearStoryId;

    /** Customer ID */
    customerId: CustomerId;

    /** When archived */
    timestamp: ISOTimestamp;
  };
}
```

### Event Handlers

```typescript
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
```

---

## Notes for Implementers

1. **Article Generation Flow**:
   - Fetch Clear Story data from Clear Story domain
   - Fetch customer brand guidelines from User/Customer domain
   - Invoke ArticleGeneratorAgent with context
   - Store generated article and initial version
   - Publish `article.created` event

2. **Status Transitions**:
   ```
   draft -> review -> approved -> published
                  |-> revision_requested -> draft (cycle)

   Any status (except archived) -> archived
   ```

3. **Version Management**:
   - Initial creation creates version 1
   - Content edits create new versions
   - AI regeneration creates new versions
   - Revert creates a new version with content from target version

4. **Word Count Validation**:
   - Default target: 1200-1800 words (from shared constants)
   - Validation enforces minimum of 500 words
   - Maximum cap at 50,000 characters for storage

5. **Quota Enforcement**:
   ```typescript
   // Daily article limits by tier
   const DAILY_LIMITS = {
     trial: 3,
     starter: 10,
     growth: 50,
     enterprise: Infinity
   };
   ```

6. **SEO Optimization**:
   - Meta description: 150-160 characters
   - Title: 10-200 characters
   - Keywords: max 20 keywords

7. **Agent Context Requirements**:
   - ArticleGeneratorAgent requires full Clear Story data
   - Brand guidelines should be fetched if `useBrandGuidelines` is true
   - Previous version content needed for regeneration/revision

8. **Indexing Strategy**:
   - Primary key on `id` column
   - Index on `customer_id` for customer queries
   - Index on `clear_story_id` for source queries
   - Index on `status` for workflow queries
   - Composite index on `customer_id` + `created_at` for chronological queries
   - Full-text index on `title` + `content` for search

---

*Contract Version: 1.0.0 | Generated: 2026-01-18*
