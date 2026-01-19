# CLEAR-STORY Domain Contract

> **Version**: 1.0.0
> **Domain**: Clear Story
> **Owner**: Clear Story Agent
> **Last Updated**: 2026-01-18

This contract defines the complete interface for the Clear Story domain in the LEO Automation Platform. Clear Story is the belief library - responsible for storage, search, filtering, and retrieval of Clear Stories that ground AI-generated content. All implementations must adhere to these types and interfaces.

---

## Table of Contents

1. [Imports from Shared Primitives](#imports-from-shared-primitives)
2. [Cross-Domain References](#cross-domain-references)
3. [Domain-Specific Types](#domain-specific-types)
4. [Service Interface](#service-interface)
5. [Repository Interface](#repository-interface)
6. [API Routes](#api-routes)
7. [Validation Schemas](#validation-schemas)
8. [Error Codes](#error-codes)
9. [Integration Points](#integration-points)

---

## Imports from Shared Primitives

```typescript
import {
  // Identity Types
  ClearStoryId,
  CustomerId,
  KolId,
  UserId,

  // Enums
  ClearStorySource,
  ContentTone,
  CustomerTier,

  // Cross-Domain References
  ClearStoryRef,
  CustomerRef,
  KolRef,
  UserRef,

  // API Patterns
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  SearchParams,
  AuditInfo,
  ISOTimestamp
} from './shared.types';
```

---

## Cross-Domain References

The Clear Story domain is a **source domain** - other domains reference it, but it does not depend on other LEO domains. It only references shared primitives.

### CustomerRef (Read-Only)

```typescript
/**
 * Minimal customer reference for associating Clear Stories with customers.
 * The User/Customer domain owns the full Customer entity.
 */
export interface CustomerRef {
  /** Unique customer identifier */
  id: CustomerId;

  /** Company/brand name */
  companyName: string;

  /** Customer tier for access control */
  tier: CustomerTier;
}
```

### KolRef (Read-Only)

```typescript
/**
 * Minimal Key Opinion Leader reference for attributing beliefs.
 * The User/Customer domain may own the full KOL entity.
 */
export interface KolRef {
  /** Unique KOL identifier */
  id: KolId;

  /** Display name of the KOL */
  name: string;

  /** Platform where the KOL is active */
  platform: 'reddit' | 'quora' | 'forum' | 'linkedin';
}
```

---

## Domain-Specific Types

### Clear Story Confidence Level

```typescript
/**
 * Confidence level indicating the strength of evidence for a belief.
 * Higher confidence beliefs should be prioritized for content generation.
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'verified';

/**
 * Numeric confidence thresholds for filtering.
 */
export const CONFIDENCE_THRESHOLDS = {
  low: 0.25,
  medium: 0.50,
  high: 0.75,
  verified: 0.95
} as const;
```

### Clear Story Status

```typescript
/**
 * Lifecycle status of a Clear Story entry.
 */
export enum ClearStoryStatus {
  /** Newly extracted, pending review */
  draft = 'draft',

  /** Under review for accuracy */
  review = 'review',

  /** Approved and ready for use in content */
  active = 'active',

  /** Temporarily disabled from use */
  paused = 'paused',

  /** Permanently retired (e.g., outdated belief) */
  archived = 'archived'
}
```

### Clear Story Category

```typescript
/**
 * High-level categories for organizing Clear Stories.
 */
export enum ClearStoryCategory {
  /** Product features and capabilities */
  product_capability = 'product_capability',

  /** Common customer problems and pain points */
  pain_point = 'pain_point',

  /** Competitor weaknesses or gaps */
  competitor_gap = 'competitor_gap',

  /** Industry trends and market insights */
  market_insight = 'market_insight',

  /** Customer success stories and outcomes */
  success_story = 'success_story',

  /** Technical differentiators */
  technical_advantage = 'technical_advantage',

  /** Pricing and value propositions */
  value_proposition = 'value_proposition',

  /** Integration and compatibility benefits */
  integration_benefit = 'integration_benefit'
}
```

### Supporting Evidence

```typescript
/**
 * Evidence supporting a Clear Story belief.
 * Provides attribution and source verification.
 */
export interface SupportingEvidence {
  /** Type of evidence */
  type: 'quote' | 'statistic' | 'case_study' | 'expert_opinion' | 'user_testimony';

  /** The actual evidence content */
  content: string;

  /** Source URL if available */
  sourceUrl?: string;

  /** Date the evidence was collected */
  collectedAt: ISOTimestamp;

  /** KOL attribution if applicable */
  attributedTo?: KolRef;

  /** Credibility score (0-1) */
  credibility: number;
}
```

### Clear Story

```typescript
/**
 * A Clear Story represents a verified belief that can be used to ground
 * AI-generated content. Clear Stories are extracted from various sources
 * (interviews, competitor analysis, social media) and serve as the
 * foundation for authentic, evidence-based content.
 *
 * @example
 * {
 *   id: "cs_abc123",
 *   customerId: "cust_xyz789",
 *   topic: "Project Management Tool Switching",
 *   belief: "Engineering teams waste 4-6 hours weekly on status meetings that could be replaced with async updates",
 *   beliefSummary: "Engineering teams waste 4-6 hours weekly on status meetings...",
 *   source: "customer_interview",
 *   category: "pain_point",
 *   status: "active",
 *   ...
 * }
 */
export interface ClearStory {
  /** Unique identifier (format: cs_${uuid}) */
  id: ClearStoryId;

  /** Customer this Clear Story belongs to */
  customerId: CustomerId;

  /** Customer reference with denormalized data */
  customer?: CustomerRef;

  /** Primary topic or theme (searchable) */
  topic: string;

  /** The core belief statement (max 2000 chars) */
  belief: string;

  /** Truncated belief for previews (first 200 chars) */
  beliefSummary: string;

  /** Where this belief was extracted from */
  source: ClearStorySource;

  /** High-level category for organization */
  category: ClearStoryCategory;

  /** Current lifecycle status */
  status: ClearStoryStatus;

  /** Confidence level in this belief */
  confidence: ConfidenceLevel;

  /** Numeric confidence score (0-1) */
  confidenceScore: number;

  /** KOLs who support or validate this belief */
  supportingKols: KolRef[];

  /** Evidence supporting this belief */
  evidence: SupportingEvidence[];

  /** Searchable tags for filtering */
  tags: string[];

  /** Related competitor names (for competitive positioning) */
  competitors?: string[];

  /** Target audience segments this applies to */
  targetAudiences?: string[];

  /** Recommended content tones for this belief */
  recommendedTones: ContentTone[];

  /** How many times this Clear Story has been used in articles */
  usageCount: number;

  /** Last time this Clear Story was used */
  lastUsedAt?: ISOTimestamp;

  /** Performance metrics when used in content */
  performanceMetrics?: {
    /** Average engagement when used */
    avgEngagement: number;
    /** Number of successful mentions */
    successfulMentions: number;
    /** Click-through rate */
    avgCtr: number;
  };

  /** Audit trail */
  createdAt: ISOTimestamp;
  createdBy: UserRef;
  updatedAt: ISOTimestamp;
  updatedBy: UserRef;

  /** Optional expiration for time-sensitive beliefs */
  expiresAt?: ISOTimestamp;

  /** Internal notes (not used in content) */
  internalNotes?: string;
}
```

### ClearStorySearchParams

```typescript
/**
 * Parameters for searching and filtering Clear Stories.
 * Extends the base SearchParams with domain-specific filters.
 */
export interface ClearStorySearchParams extends SearchParams {
  /** Filter by customer */
  customerId?: CustomerId;

  /** Filter by topic (partial match) */
  topic?: string;

  /** Full-text search across belief and topic */
  query?: string;

  /** Filter by source type */
  sources?: ClearStorySource[];

  /** Filter by category */
  categories?: ClearStoryCategory[];

  /** Filter by status */
  statuses?: ClearStoryStatus[];

  /** Filter by minimum confidence level */
  minConfidence?: ConfidenceLevel;

  /** Filter by KOL IDs */
  kolIds?: KolId[];

  /** Filter by tags (any match) */
  tags?: string[];

  /** Filter by competitor mentions */
  competitors?: string[];

  /** Filter by target audience */
  targetAudience?: string;

  /** Filter by recommended tone */
  tone?: ContentTone;

  /** Exclude recently used (within N days) */
  excludeUsedWithinDays?: number;

  /** Only include high-performing stories */
  minEngagement?: number;

  /** Include expired stories */
  includeExpired?: boolean;

  /** Include archived stories */
  includeArchived?: boolean;

  /** Sort options */
  sortBy?: 'relevance' | 'usageCount' | 'createdAt' | 'lastUsedAt' | 'confidence' | 'engagement';
  sortOrder?: 'asc' | 'desc';
}
```

### CreateClearStoryInput

```typescript
/**
 * Input for creating a new Clear Story.
 * Required fields ensure minimum viable content for use.
 */
export interface CreateClearStoryInput {
  /** Customer this belongs to (required) */
  customerId: CustomerId;

  /** Primary topic (required, 3-200 chars) */
  topic: string;

  /** Core belief statement (required, 10-2000 chars) */
  belief: string;

  /** Source of extraction (required) */
  source: ClearStorySource;

  /** Category classification (required) */
  category: ClearStoryCategory;

  /** Initial confidence level */
  confidence?: ConfidenceLevel;

  /** Initial status (defaults to 'draft') */
  status?: ClearStoryStatus;

  /** Supporting KOLs */
  supportingKols?: KolRef[];

  /** Supporting evidence */
  evidence?: Omit<SupportingEvidence, 'collectedAt'>[];

  /** Tags for searchability */
  tags?: string[];

  /** Related competitors */
  competitors?: string[];

  /** Target audience segments */
  targetAudiences?: string[];

  /** Recommended content tones */
  recommendedTones?: ContentTone[];

  /** Optional expiration date */
  expiresAt?: ISOTimestamp;

  /** Internal notes */
  internalNotes?: string;
}
```

### UpdateClearStoryInput

```typescript
/**
 * Input for updating an existing Clear Story.
 * All fields are optional - only specified fields are updated.
 */
export interface UpdateClearStoryInput {
  /** Update topic */
  topic?: string;

  /** Update belief text */
  belief?: string;

  /** Update source attribution */
  source?: ClearStorySource;

  /** Update category */
  category?: ClearStoryCategory;

  /** Update confidence level */
  confidence?: ConfidenceLevel;

  /** Update status */
  status?: ClearStoryStatus;

  /** Replace all supporting KOLs */
  supportingKols?: KolRef[];

  /** Add supporting KOLs (without replacing existing) */
  addKols?: KolRef[];

  /** Remove KOLs by ID */
  removeKolIds?: KolId[];

  /** Replace all evidence */
  evidence?: SupportingEvidence[];

  /** Add evidence items */
  addEvidence?: Omit<SupportingEvidence, 'collectedAt'>[];

  /** Replace all tags */
  tags?: string[];

  /** Add tags (without replacing existing) */
  addTags?: string[];

  /** Remove specific tags */
  removeTags?: string[];

  /** Update competitors */
  competitors?: string[];

  /** Update target audiences */
  targetAudiences?: string[];

  /** Update recommended tones */
  recommendedTones?: ContentTone[];

  /** Update expiration */
  expiresAt?: ISOTimestamp;

  /** Update internal notes */
  internalNotes?: string;
}
```

### ClearStoryBulkOperation

```typescript
/**
 * Bulk operation on multiple Clear Stories.
 */
export interface ClearStoryBulkOperation {
  /** Clear Story IDs to operate on */
  ids: ClearStoryId[];

  /** Operation to perform */
  operation: 'activate' | 'pause' | 'archive' | 'delete' | 'addTags' | 'removeTags';

  /** Additional data for certain operations */
  data?: {
    tags?: string[];
  };
}
```

### ClearStoryStats

```typescript
/**
 * Aggregated statistics for Clear Stories.
 */
export interface ClearStoryStats {
  /** Customer these stats are for */
  customerId: CustomerId;

  /** Total number of Clear Stories */
  totalCount: number;

  /** Count by status */
  byStatus: Record<ClearStoryStatus, number>;

  /** Count by source */
  bySource: Record<ClearStorySource, number>;

  /** Count by category */
  byCategory: Record<ClearStoryCategory, number>;

  /** Average confidence score */
  avgConfidence: number;

  /** Total usage across all stories */
  totalUsage: number;

  /** Most used story ID */
  mostUsedId?: ClearStoryId;

  /** Last story created date */
  lastCreatedAt?: ISOTimestamp;

  /** When stats were calculated */
  calculatedAt: ISOTimestamp;
}
```

---

## Service Interface

```typescript
/**
 * Clear Story domain service interface.
 * All methods are async and return Promises.
 */
export interface IClearStoryService {
  // ─────────────────────────────────────────────────────────────
  // CRUD Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new Clear Story.
   * Automatically generates beliefSummary from belief text.
   *
   * @param input - Creation input
   * @param userId - User performing the action
   * @returns The created Clear Story
   * @throws VALIDATION_ERROR if input is invalid
   * @throws CUSTOMER_NOT_FOUND if customerId doesn't exist
   */
  create(
    input: CreateClearStoryInput,
    userId: UserId
  ): Promise<ClearStory>;

  /**
   * Get a Clear Story by ID.
   *
   * @param id - Clear Story ID
   * @returns The Clear Story or null if not found
   */
  getById(id: ClearStoryId): Promise<ClearStory | null>;

  /**
   * Get multiple Clear Stories by IDs.
   * Returns only found stories (does not throw for missing IDs).
   *
   * @param ids - Array of Clear Story IDs
   * @returns Array of found Clear Stories
   */
  getByIds(ids: ClearStoryId[]): Promise<ClearStory[]>;

  /**
   * Search Clear Stories with filters and pagination.
   *
   * @param params - Search parameters
   * @returns Paginated list of Clear Stories
   */
  search(params: ClearStorySearchParams): Promise<PaginatedResponse<ClearStory>>;

  /**
   * Update a Clear Story.
   *
   * @param id - Clear Story ID to update
   * @param input - Update input
   * @param userId - User performing the action
   * @returns The updated Clear Story
   * @throws CLEAR_STORY_NOT_FOUND if ID doesn't exist
   */
  update(
    id: ClearStoryId,
    input: UpdateClearStoryInput,
    userId: UserId
  ): Promise<ClearStory>;

  /**
   * Delete a Clear Story (soft delete - sets status to archived).
   *
   * @param id - Clear Story ID to delete
   * @param userId - User performing the action
   * @throws CLEAR_STORY_NOT_FOUND if ID doesn't exist
   * @throws CLEAR_STORY_IN_USE if currently referenced by active articles
   */
  delete(id: ClearStoryId, userId: UserId): Promise<void>;

  /**
   * Permanently delete a Clear Story (hard delete).
   * Requires admin permissions.
   *
   * @param id - Clear Story ID
   * @throws CLEAR_STORY_NOT_FOUND if ID doesn't exist
   */
  hardDelete(id: ClearStoryId): Promise<void>;

  // ─────────────────────────────────────────────────────────────
  // Finder Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Find Clear Stories by topic (partial match).
   *
   * @param topic - Topic to search for
   * @param customerId - Optional customer filter
   * @param pagination - Pagination params
   * @returns Paginated list of matching Clear Stories
   */
  findByTopic(
    topic: string,
    customerId?: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ClearStory>>;

  /**
   * Find Clear Stories by source type.
   *
   * @param source - Source type to filter by
   * @param customerId - Optional customer filter
   * @param pagination - Pagination params
   * @returns Paginated list of matching Clear Stories
   */
  findBySource(
    source: ClearStorySource,
    customerId?: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ClearStory>>;

  /**
   * Find all Clear Stories for a customer.
   *
   * @param customerId - Customer ID
   * @param activeOnly - Only return active stories (default: true)
   * @param pagination - Pagination params
   * @returns Paginated list of Clear Stories
   */
  findByCustomer(
    customerId: CustomerId,
    activeOnly?: boolean,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ClearStory>>;

  /**
   * Find Clear Stories supported by a specific KOL.
   *
   * @param kolId - KOL ID
   * @param pagination - Pagination params
   * @returns Paginated list of Clear Stories
   */
  findByKol(
    kolId: KolId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ClearStory>>;

  /**
   * Find Clear Stories by category.
   *
   * @param category - Category to filter by
   * @param customerId - Optional customer filter
   * @param pagination - Pagination params
   * @returns Paginated list of Clear Stories
   */
  findByCategory(
    category: ClearStoryCategory,
    customerId?: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ClearStory>>;

  /**
   * Find Clear Stories by tags (any match).
   *
   * @param tags - Tags to search for
   * @param customerId - Optional customer filter
   * @param pagination - Pagination params
   * @returns Paginated list of matching Clear Stories
   */
  findByTags(
    tags: string[],
    customerId?: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ClearStory>>;

  // ─────────────────────────────────────────────────────────────
  // Usage Tracking
  // ─────────────────────────────────────────────────────────────

  /**
   * Increment usage count when a Clear Story is used in content.
   * Also updates lastUsedAt timestamp.
   *
   * @param id - Clear Story ID
   * @returns Updated Clear Story
   * @throws CLEAR_STORY_NOT_FOUND if ID doesn't exist
   */
  incrementUsageCount(id: ClearStoryId): Promise<ClearStory>;

  /**
   * Record usage with performance metrics.
   *
   * @param id - Clear Story ID
   * @param metrics - Performance data from the content where it was used
   */
  recordUsageWithMetrics(
    id: ClearStoryId,
    metrics: {
      engagement: number;
      ctr?: number;
      mentionSuccess: boolean;
    }
  ): Promise<ClearStory>;

  // ─────────────────────────────────────────────────────────────
  // Analytics & Discovery
  // ─────────────────────────────────────────────────────────────

  /**
   * Get most frequently used Clear Stories.
   *
   * @param customerId - Customer filter
   * @param limit - Number to return (default: 10)
   * @returns Array of popular Clear Stories
   */
  getPopular(
    customerId: CustomerId,
    limit?: number
  ): Promise<ClearStory[]>;

  /**
   * Get most recently created Clear Stories.
   *
   * @param customerId - Customer filter
   * @param limit - Number to return (default: 10)
   * @returns Array of recent Clear Stories
   */
  getRecent(
    customerId: CustomerId,
    limit?: number
  ): Promise<ClearStory[]>;

  /**
   * Get high-performing Clear Stories based on content metrics.
   *
   * @param customerId - Customer filter
   * @param limit - Number to return (default: 10)
   * @returns Array of top performing Clear Stories
   */
  getTopPerforming(
    customerId: CustomerId,
    limit?: number
  ): Promise<ClearStory[]>;

  /**
   * Get underutilized Clear Stories (active but rarely used).
   *
   * @param customerId - Customer filter
   * @param limit - Number to return (default: 10)
   * @returns Array of underutilized Clear Stories
   */
  getUnderutilized(
    customerId: CustomerId,
    limit?: number
  ): Promise<ClearStory[]>;

  /**
   * Get Clear Stories that are expiring soon.
   *
   * @param customerId - Customer filter
   * @param withinDays - Days until expiration (default: 30)
   * @returns Array of expiring Clear Stories
   */
  getExpiringSoon(
    customerId: CustomerId,
    withinDays?: number
  ): Promise<ClearStory[]>;

  /**
   * Get aggregated statistics for a customer's Clear Stories.
   *
   * @param customerId - Customer ID
   * @returns Statistics object
   */
  getStats(customerId: CustomerId): Promise<ClearStoryStats>;

  // ─────────────────────────────────────────────────────────────
  // Bulk Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Perform a bulk operation on multiple Clear Stories.
   *
   * @param operation - Bulk operation to perform
   * @param userId - User performing the action
   * @returns Count of affected stories
   */
  bulkOperation(
    operation: ClearStoryBulkOperation,
    userId: UserId
  ): Promise<{ affected: number }>;

  /**
   * Import Clear Stories from external data.
   *
   * @param customerId - Target customer
   * @param stories - Array of creation inputs
   * @param userId - User performing the import
   * @returns Import results
   */
  bulkImport(
    customerId: CustomerId,
    stories: CreateClearStoryInput[],
    userId: UserId
  ): Promise<{
    created: number;
    failed: number;
    errors: { index: number; error: string }[];
  }>;

  // ─────────────────────────────────────────────────────────────
  // Content Selection (for Article Domain)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get recommended Clear Stories for content generation.
   * Balances freshness, performance, and usage distribution.
   *
   * @param customerId - Customer ID
   * @param options - Selection options
   * @returns Array of recommended Clear Stories
   */
  getRecommendedForContent(
    customerId: CustomerId,
    options?: {
      topic?: string;
      category?: ClearStoryCategory;
      tone?: ContentTone;
      excludeIds?: ClearStoryId[];
      limit?: number;
    }
  ): Promise<ClearStory[]>;

  /**
   * Get a random selection of Clear Stories for variety.
   * Weighted by confidence and recency.
   *
   * @param customerId - Customer ID
   * @param count - Number to return
   * @param excludeIds - IDs to exclude
   * @returns Array of randomly selected Clear Stories
   */
  getRandomSelection(
    customerId: CustomerId,
    count: number,
    excludeIds?: ClearStoryId[]
  ): Promise<ClearStory[]>;
}
```

---

## Repository Interface

```typescript
/**
 * Repository interface for ClearStory persistence.
 * Provides low-level data access methods.
 */
export interface IClearStoryRepository {
  // ─────────────────────────────────────────────────────────────
  // Basic CRUD
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new Clear Story record.
   *
   * @param data - Clear Story data (without generated fields)
   * @returns Created Clear Story with ID
   */
  create(data: Omit<ClearStory, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'beliefSummary'>): Promise<ClearStory>;

  /**
   * Find a Clear Story by ID.
   *
   * @param id - Clear Story ID
   * @returns Clear Story or null
   */
  findById(id: ClearStoryId): Promise<ClearStory | null>;

  /**
   * Find multiple Clear Stories by IDs.
   *
   * @param ids - Array of IDs
   * @returns Array of found Clear Stories
   */
  findByIds(ids: ClearStoryId[]): Promise<ClearStory[]>;

  /**
   * Update a Clear Story.
   *
   * @param id - ID to update
   * @param data - Partial update data
   * @returns Updated Clear Story
   */
  update(id: ClearStoryId, data: Partial<ClearStory>): Promise<ClearStory>;

  /**
   * Soft delete (set status to archived).
   *
   * @param id - ID to delete
   */
  softDelete(id: ClearStoryId): Promise<void>;

  /**
   * Hard delete (permanent removal).
   *
   * @param id - ID to delete
   */
  hardDelete(id: ClearStoryId): Promise<void>;

  // ─────────────────────────────────────────────────────────────
  // Query Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Find Clear Stories by customer.
   *
   * @param customerId - Customer ID
   * @param options - Query options
   * @returns Array of Clear Stories
   */
  findByCustomer(
    customerId: CustomerId,
    options?: {
      status?: ClearStoryStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<ClearStory[]>;

  /**
   * Count Clear Stories by customer.
   *
   * @param customerId - Customer ID
   * @param status - Optional status filter
   * @returns Count
   */
  countByCustomer(customerId: CustomerId, status?: ClearStoryStatus): Promise<number>;

  /**
   * Search with full filter support.
   *
   * @param params - Search parameters
   * @returns Paginated results
   */
  search(params: ClearStorySearchParams): Promise<{
    data: ClearStory[];
    total: number;
  }>;

  /**
   * Find by topic with partial matching.
   *
   * @param topic - Topic string
   * @param customerId - Optional customer filter
   * @param limit - Max results
   * @returns Array of matching Clear Stories
   */
  findByTopic(
    topic: string,
    customerId?: CustomerId,
    limit?: number
  ): Promise<ClearStory[]>;

  /**
   * Find by source type.
   *
   * @param source - Source type
   * @param customerId - Optional customer filter
   * @param limit - Max results
   * @returns Array of matching Clear Stories
   */
  findBySource(
    source: ClearStorySource,
    customerId?: CustomerId,
    limit?: number
  ): Promise<ClearStory[]>;

  /**
   * Find by KOL ID.
   *
   * @param kolId - KOL ID
   * @param limit - Max results
   * @returns Array of Clear Stories supported by this KOL
   */
  findByKol(kolId: KolId, limit?: number): Promise<ClearStory[]>;

  /**
   * Find by tags (any match).
   *
   * @param tags - Tags to match
   * @param customerId - Optional customer filter
   * @param limit - Max results
   * @returns Array of matching Clear Stories
   */
  findByTags(
    tags: string[],
    customerId?: CustomerId,
    limit?: number
  ): Promise<ClearStory[]>;

  // ─────────────────────────────────────────────────────────────
  // Aggregation Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Get top used Clear Stories.
   *
   * @param customerId - Customer ID
   * @param limit - Max results
   * @returns Array sorted by usage count descending
   */
  findTopUsed(customerId: CustomerId, limit: number): Promise<ClearStory[]>;

  /**
   * Get recently created Clear Stories.
   *
   * @param customerId - Customer ID
   * @param limit - Max results
   * @returns Array sorted by creation date descending
   */
  findRecent(customerId: CustomerId, limit: number): Promise<ClearStory[]>;

  /**
   * Get least used active Clear Stories.
   *
   * @param customerId - Customer ID
   * @param limit - Max results
   * @returns Array sorted by usage count ascending
   */
  findLeastUsed(customerId: CustomerId, limit: number): Promise<ClearStory[]>;

  /**
   * Get expiring Clear Stories.
   *
   * @param customerId - Customer ID
   * @param beforeDate - Expiration cutoff
   * @returns Array of expiring Clear Stories
   */
  findExpiring(customerId: CustomerId, beforeDate: ISOTimestamp): Promise<ClearStory[]>;

  /**
   * Get aggregated statistics.
   *
   * @param customerId - Customer ID
   * @returns Statistics
   */
  getStats(customerId: CustomerId): Promise<{
    totalCount: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
    byCategory: Record<string, number>;
    avgConfidence: number;
    totalUsage: number;
  }>;

  // ─────────────────────────────────────────────────────────────
  // Bulk Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Update multiple Clear Stories.
   *
   * @param ids - IDs to update
   * @param data - Update data
   * @returns Count of updated records
   */
  bulkUpdate(ids: ClearStoryId[], data: Partial<ClearStory>): Promise<number>;

  /**
   * Bulk insert Clear Stories.
   *
   * @param stories - Array of Clear Stories to insert
   * @returns Created Clear Stories
   */
  bulkInsert(stories: Omit<ClearStory, 'id'>[]): Promise<ClearStory[]>;

  // ─────────────────────────────────────────────────────────────
  // Usage Tracking
  // ─────────────────────────────────────────────────────────────

  /**
   * Increment usage count atomically.
   *
   * @param id - Clear Story ID
   * @returns Updated usage count
   */
  incrementUsage(id: ClearStoryId): Promise<number>;

  /**
   * Update performance metrics.
   *
   * @param id - Clear Story ID
   * @param metrics - New metrics to merge
   */
  updateMetrics(
    id: ClearStoryId,
    metrics: {
      engagement?: number;
      ctr?: number;
      mentionSuccess?: boolean;
    }
  ): Promise<void>;
}
```

---

## API Routes

### Route Definitions

```yaml
# ═══════════════════════════════════════════════════════════════
# CLEAR STORY CRUD ENDPOINTS
# ═══════════════════════════════════════════════════════════════

# POST /clear-stories
# Create a new Clear Story
POST /clear-stories:
  auth: required (user with customer access)
  body:
    customerId: CustomerId (required)
    topic: string (required, 3-200 chars)
    belief: string (required, 10-2000 chars)
    source: ClearStorySource (required)
    category: ClearStoryCategory (required)
    confidence: ConfidenceLevel (optional, default: 'medium')
    status: ClearStoryStatus (optional, default: 'draft')
    supportingKols: KolRef[] (optional)
    evidence: SupportingEvidence[] (optional)
    tags: string[] (optional)
    competitors: string[] (optional)
    targetAudiences: string[] (optional)
    recommendedTones: ContentTone[] (optional)
    expiresAt: ISOTimestamp (optional)
    internalNotes: string (optional)
  response:
    201:
      success: true
      data: ClearStory
    400: Validation error
    401: Unauthorized
    403: Forbidden (no customer access)

# GET /clear-stories/:id
# Get a Clear Story by ID
GET /clear-stories/:id:
  auth: required
  params:
    id: ClearStoryId (required)
  response:
    200:
      success: true
      data: ClearStory
    404: Clear Story not found

# PUT /clear-stories/:id
# Update a Clear Story
PUT /clear-stories/:id:
  auth: required (user with customer access)
  params:
    id: ClearStoryId (required)
  body: UpdateClearStoryInput
  response:
    200:
      success: true
      data: ClearStory
    400: Validation error
    404: Clear Story not found

# DELETE /clear-stories/:id
# Soft delete (archive) a Clear Story
DELETE /clear-stories/:id:
  auth: required (user with customer access)
  params:
    id: ClearStoryId (required)
  query:
    hard: boolean (optional, requires admin, permanently deletes)
  response:
    204: No content
    404: Clear Story not found
    409: Clear Story in use by active articles

# ═══════════════════════════════════════════════════════════════
# SEARCH & FILTER ENDPOINTS
# ═══════════════════════════════════════════════════════════════

# GET /clear-stories
# Search and list Clear Stories
GET /clear-stories:
  auth: required
  query:
    customerId: CustomerId (required for non-admin)
    query: string (full-text search)
    topic: string (partial match)
    sources: ClearStorySource[] (comma-separated)
    categories: ClearStoryCategory[] (comma-separated)
    statuses: ClearStoryStatus[] (comma-separated)
    minConfidence: ConfidenceLevel
    kolIds: KolId[] (comma-separated)
    tags: string[] (comma-separated)
    competitors: string[] (comma-separated)
    targetAudience: string
    tone: ContentTone
    excludeUsedWithinDays: number
    minEngagement: number
    includeExpired: boolean (default: false)
    includeArchived: boolean (default: false)
    sortBy: 'relevance' | 'usageCount' | 'createdAt' | 'lastUsedAt' | 'confidence' | 'engagement'
    sortOrder: 'asc' | 'desc' (default: 'desc')
    page: number (default: 1)
    pageSize: number (default: 20, max: 100)
  response:
    200:
      success: true
      data: ClearStory[]
      pagination:
        page: number
        pageSize: number
        totalItems: number
        totalPages: number
        hasNextPage: boolean
        hasPreviousPage: boolean

# GET /clear-stories/by-topic
# Find Clear Stories by topic
GET /clear-stories/by-topic:
  auth: required
  query:
    topic: string (required)
    customerId: CustomerId (optional)
    page: number (default: 1)
    pageSize: number (default: 20)
  response:
    200: PaginatedResponse<ClearStory>

# GET /clear-stories/by-source/:source
# Find Clear Stories by source type
GET /clear-stories/by-source/:source:
  auth: required
  params:
    source: ClearStorySource (required)
  query:
    customerId: CustomerId (optional)
    page: number (default: 1)
    pageSize: number (default: 20)
  response:
    200: PaginatedResponse<ClearStory>

# GET /clear-stories/by-customer/:customerId
# Find all Clear Stories for a customer
GET /clear-stories/by-customer/:customerId:
  auth: required (with customer access)
  params:
    customerId: CustomerId (required)
  query:
    activeOnly: boolean (default: true)
    page: number (default: 1)
    pageSize: number (default: 20)
  response:
    200: PaginatedResponse<ClearStory>

# GET /clear-stories/by-kol/:kolId
# Find Clear Stories by supporting KOL
GET /clear-stories/by-kol/:kolId:
  auth: required
  params:
    kolId: KolId (required)
  query:
    page: number (default: 1)
    pageSize: number (default: 20)
  response:
    200: PaginatedResponse<ClearStory>

# GET /clear-stories/by-category/:category
# Find Clear Stories by category
GET /clear-stories/by-category/:category:
  auth: required
  params:
    category: ClearStoryCategory (required)
  query:
    customerId: CustomerId (optional)
    page: number (default: 1)
    pageSize: number (default: 20)
  response:
    200: PaginatedResponse<ClearStory>

# GET /clear-stories/by-tags
# Find Clear Stories by tags
GET /clear-stories/by-tags:
  auth: required
  query:
    tags: string[] (required, comma-separated)
    customerId: CustomerId (optional)
    page: number (default: 1)
    pageSize: number (default: 20)
  response:
    200: PaginatedResponse<ClearStory>

# ═══════════════════════════════════════════════════════════════
# ANALYTICS & DISCOVERY ENDPOINTS
# ═══════════════════════════════════════════════════════════════

# GET /clear-stories/popular
# Get most frequently used Clear Stories
GET /clear-stories/popular:
  auth: required
  query:
    customerId: CustomerId (required)
    limit: number (default: 10, max: 50)
  response:
    200:
      success: true
      data: ClearStory[]

# GET /clear-stories/recent
# Get most recently created Clear Stories
GET /clear-stories/recent:
  auth: required
  query:
    customerId: CustomerId (required)
    limit: number (default: 10, max: 50)
  response:
    200:
      success: true
      data: ClearStory[]

# GET /clear-stories/top-performing
# Get highest performing Clear Stories
GET /clear-stories/top-performing:
  auth: required
  query:
    customerId: CustomerId (required)
    limit: number (default: 10, max: 50)
  response:
    200:
      success: true
      data: ClearStory[]

# GET /clear-stories/underutilized
# Get active but rarely used Clear Stories
GET /clear-stories/underutilized:
  auth: required
  query:
    customerId: CustomerId (required)
    limit: number (default: 10, max: 50)
  response:
    200:
      success: true
      data: ClearStory[]

# GET /clear-stories/expiring
# Get Clear Stories expiring soon
GET /clear-stories/expiring:
  auth: required
  query:
    customerId: CustomerId (required)
    withinDays: number (default: 30)
  response:
    200:
      success: true
      data: ClearStory[]

# GET /clear-stories/stats
# Get aggregated statistics
GET /clear-stories/stats:
  auth: required
  query:
    customerId: CustomerId (required)
  response:
    200:
      success: true
      data: ClearStoryStats

# ═══════════════════════════════════════════════════════════════
# USAGE TRACKING ENDPOINTS
# ═══════════════════════════════════════════════════════════════

# POST /clear-stories/:id/usage
# Increment usage count
POST /clear-stories/:id/usage:
  auth: required (system or user)
  params:
    id: ClearStoryId (required)
  body:
    metrics: (optional)
      engagement: number
      ctr: number
      mentionSuccess: boolean
  response:
    200:
      success: true
      data: ClearStory

# ═══════════════════════════════════════════════════════════════
# BULK OPERATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════

# POST /clear-stories/bulk
# Perform bulk operation
POST /clear-stories/bulk:
  auth: required (with customer access)
  body:
    ids: ClearStoryId[] (required, max: 100)
    operation: 'activate' | 'pause' | 'archive' | 'delete' | 'addTags' | 'removeTags' (required)
    data:
      tags: string[] (required for addTags/removeTags)
  response:
    200:
      success: true
      data:
        affected: number

# POST /clear-stories/import
# Bulk import Clear Stories
POST /clear-stories/import:
  auth: required (with customer access)
  body:
    customerId: CustomerId (required)
    stories: CreateClearStoryInput[] (required, max: 500)
  response:
    200:
      success: true
      data:
        created: number
        failed: number
        errors: { index: number, error: string }[]

# ═══════════════════════════════════════════════════════════════
# CONTENT SELECTION ENDPOINTS (for Article Domain)
# ═══════════════════════════════════════════════════════════════

# GET /clear-stories/recommended
# Get recommended Clear Stories for content generation
GET /clear-stories/recommended:
  auth: required
  query:
    customerId: CustomerId (required)
    topic: string (optional)
    category: ClearStoryCategory (optional)
    tone: ContentTone (optional)
    excludeIds: ClearStoryId[] (optional, comma-separated)
    limit: number (default: 5, max: 20)
  response:
    200:
      success: true
      data: ClearStory[]

# GET /clear-stories/random
# Get random selection for content variety
GET /clear-stories/random:
  auth: required
  query:
    customerId: CustomerId (required)
    count: number (required, max: 10)
    excludeIds: ClearStoryId[] (optional, comma-separated)
  response:
    200:
      success: true
      data: ClearStory[]
```

### TypeScript Request/Response Types

```typescript
// ═══════════════════════════════════════════════════════════════
// Request Types
// ═══════════════════════════════════════════════════════════════

/**
 * POST /clear-stories request body
 */
export type CreateClearStoryRequest = CreateClearStoryInput;

/**
 * PUT /clear-stories/:id request body
 */
export type UpdateClearStoryRequest = UpdateClearStoryInput;

/**
 * GET /clear-stories query parameters
 */
export interface SearchClearStoriesQuery {
  customerId?: CustomerId;
  query?: string;
  topic?: string;
  sources?: string;  // comma-separated ClearStorySource values
  categories?: string;  // comma-separated ClearStoryCategory values
  statuses?: string;  // comma-separated ClearStoryStatus values
  minConfidence?: ConfidenceLevel;
  kolIds?: string;  // comma-separated KolId values
  tags?: string;  // comma-separated
  competitors?: string;  // comma-separated
  targetAudience?: string;
  tone?: ContentTone;
  excludeUsedWithinDays?: number;
  minEngagement?: number;
  includeExpired?: boolean;
  includeArchived?: boolean;
  sortBy?: 'relevance' | 'usageCount' | 'createdAt' | 'lastUsedAt' | 'confidence' | 'engagement';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/**
 * POST /clear-stories/:id/usage request body
 */
export interface RecordUsageRequest {
  metrics?: {
    engagement?: number;
    ctr?: number;
    mentionSuccess?: boolean;
  };
}

/**
 * POST /clear-stories/bulk request body
 */
export type BulkOperationRequest = ClearStoryBulkOperation;

/**
 * POST /clear-stories/import request body
 */
export interface ImportClearStoriesRequest {
  customerId: CustomerId;
  stories: CreateClearStoryInput[];
}

/**
 * GET /clear-stories/recommended query parameters
 */
export interface RecommendedClearStoriesQuery {
  customerId: CustomerId;
  topic?: string;
  category?: ClearStoryCategory;
  tone?: ContentTone;
  excludeIds?: string;  // comma-separated ClearStoryId values
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════
// Response Types
// ═══════════════════════════════════════════════════════════════

/**
 * Single Clear Story response
 */
export type ClearStoryResponse = ApiResponse<ClearStory>;

/**
 * Paginated Clear Stories response
 */
export type ClearStoriesResponse = ApiResponse<PaginatedResponse<ClearStory>>;

/**
 * Clear Story list response (non-paginated)
 */
export type ClearStoryListResponse = ApiResponse<ClearStory[]>;

/**
 * Clear Story stats response
 */
export type ClearStoryStatsResponse = ApiResponse<ClearStoryStats>;

/**
 * Bulk operation response
 */
export type BulkOperationResponse = ApiResponse<{ affected: number }>;

/**
 * Import response
 */
export type ImportResponse = ApiResponse<{
  created: number;
  failed: number;
  errors: { index: number; error: string }[];
}>;
```

---

## Validation Schemas

```typescript
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Enum Schemas
// ═══════════════════════════════════════════════════════════════

/**
 * Clear Story source validation
 */
export const ClearStorySourceSchema = z.enum([
  'customer_interview',
  'competitor_website',
  'reddit_analysis',
  'forum_analysis',
  'sales_call',
  'kol_content',
  'quora_analysis'
]);

/**
 * Clear Story category validation
 */
export const ClearStoryCategorySchema = z.enum([
  'product_capability',
  'pain_point',
  'competitor_gap',
  'market_insight',
  'success_story',
  'technical_advantage',
  'value_proposition',
  'integration_benefit'
]);

/**
 * Clear Story status validation
 */
export const ClearStoryStatusSchema = z.enum([
  'draft',
  'review',
  'active',
  'paused',
  'archived'
]);

/**
 * Confidence level validation
 */
export const ConfidenceLevelSchema = z.enum([
  'low',
  'medium',
  'high',
  'verified'
]);

/**
 * Content tone validation
 */
export const ContentToneSchema = z.enum([
  'authoritative',
  'conversational',
  'educational',
  'empathetic',
  'professional'
]);

/**
 * Platform validation
 */
export const PlatformSchema = z.enum([
  'reddit',
  'quora',
  'forum',
  'linkedin'
]);

// ═══════════════════════════════════════════════════════════════
// ID Format Schemas
// ═══════════════════════════════════════════════════════════════

/**
 * Clear Story ID format validation
 */
export const ClearStoryIdSchema = z.string().regex(
  /^cs_[a-f0-9-]{36}$/,
  'Clear Story ID must be in format: cs_${uuid}'
);

/**
 * Customer ID format validation
 */
export const CustomerIdSchema = z.string().regex(
  /^cust_[a-f0-9-]{36}$/,
  'Customer ID must be in format: cust_${uuid}'
);

/**
 * KOL ID format validation
 */
export const KolIdSchema = z.string().regex(
  /^kol_[a-f0-9-]{36}$/,
  'KOL ID must be in format: kol_${uuid}'
);

/**
 * User ID format validation
 */
export const UserIdSchema = z.string().regex(
  /^usr_[a-f0-9-]{36}$/,
  'User ID must be in format: usr_${uuid}'
);

// ═══════════════════════════════════════════════════════════════
// Reference Schemas
// ═══════════════════════════════════════════════════════════════

/**
 * KOL reference validation
 */
export const KolRefSchema = z.object({
  id: KolIdSchema,
  name: z.string().min(1).max(200),
  platform: PlatformSchema
});

/**
 * Supporting evidence validation
 */
export const SupportingEvidenceSchema = z.object({
  type: z.enum(['quote', 'statistic', 'case_study', 'expert_opinion', 'user_testimony']),
  content: z.string().min(10).max(2000),
  sourceUrl: z.string().url().optional(),
  collectedAt: z.string().datetime().optional(),
  attributedTo: KolRefSchema.optional(),
  credibility: z.number().min(0).max(1)
});

/**
 * Evidence input (without collectedAt, which is auto-generated)
 */
export const SupportingEvidenceInputSchema = SupportingEvidenceSchema.omit({
  collectedAt: true
});

// ═══════════════════════════════════════════════════════════════
// Input Validation Schemas
// ═══════════════════════════════════════════════════════════════

/**
 * Create Clear Story input validation
 */
export const CreateClearStorySchema = z.object({
  customerId: CustomerIdSchema,
  topic: z.string()
    .min(3, 'Topic must be at least 3 characters')
    .max(200, 'Topic cannot exceed 200 characters')
    .trim(),
  belief: z.string()
    .min(10, 'Belief must be at least 10 characters')
    .max(2000, 'Belief cannot exceed 2000 characters')
    .trim(),
  source: ClearStorySourceSchema,
  category: ClearStoryCategorySchema,
  confidence: ConfidenceLevelSchema.optional().default('medium'),
  status: ClearStoryStatusSchema.optional().default('draft'),
  supportingKols: z.array(KolRefSchema).max(20).optional(),
  evidence: z.array(SupportingEvidenceInputSchema).max(10).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  competitors: z.array(z.string().min(1).max(100)).max(10).optional(),
  targetAudiences: z.array(z.string().min(1).max(100)).max(10).optional(),
  recommendedTones: z.array(ContentToneSchema).max(5).optional(),
  expiresAt: z.string().datetime().optional(),
  internalNotes: z.string().max(1000).optional()
});

/**
 * Update Clear Story input validation
 */
export const UpdateClearStorySchema = z.object({
  topic: z.string().min(3).max(200).trim().optional(),
  belief: z.string().min(10).max(2000).trim().optional(),
  source: ClearStorySourceSchema.optional(),
  category: ClearStoryCategorySchema.optional(),
  confidence: ConfidenceLevelSchema.optional(),
  status: ClearStoryStatusSchema.optional(),
  supportingKols: z.array(KolRefSchema).max(20).optional(),
  addKols: z.array(KolRefSchema).max(10).optional(),
  removeKolIds: z.array(KolIdSchema).max(10).optional(),
  evidence: z.array(SupportingEvidenceSchema).max(10).optional(),
  addEvidence: z.array(SupportingEvidenceInputSchema).max(5).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  addTags: z.array(z.string().min(1).max(50)).max(10).optional(),
  removeTags: z.array(z.string().min(1).max(50)).max(10).optional(),
  competitors: z.array(z.string().min(1).max(100)).max(10).optional(),
  targetAudiences: z.array(z.string().min(1).max(100)).max(10).optional(),
  recommendedTones: z.array(ContentToneSchema).max(5).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  internalNotes: z.string().max(1000).nullable().optional()
}).refine(
  data => Object.keys(data).length > 0,
  'At least one field must be provided for update'
);

/**
 * Search query validation
 */
export const SearchClearStoriesSchema = z.object({
  customerId: CustomerIdSchema.optional(),
  query: z.string().min(1).max(200).optional(),
  topic: z.string().min(1).max(200).optional(),
  sources: z.string().optional(),  // Parsed as comma-separated
  categories: z.string().optional(),
  statuses: z.string().optional(),
  minConfidence: ConfidenceLevelSchema.optional(),
  kolIds: z.string().optional(),
  tags: z.string().optional(),
  competitors: z.string().optional(),
  targetAudience: z.string().max(100).optional(),
  tone: ContentToneSchema.optional(),
  excludeUsedWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  minEngagement: z.coerce.number().min(0).max(1).optional(),
  includeExpired: z.coerce.boolean().optional(),
  includeArchived: z.coerce.boolean().optional(),
  sortBy: z.enum(['relevance', 'usageCount', 'createdAt', 'lastUsedAt', 'confidence', 'engagement']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20)
});

/**
 * Record usage validation
 */
export const RecordUsageSchema = z.object({
  metrics: z.object({
    engagement: z.number().min(0).max(1).optional(),
    ctr: z.number().min(0).max(1).optional(),
    mentionSuccess: z.boolean().optional()
  }).optional()
});

/**
 * Bulk operation validation
 */
export const BulkOperationSchema = z.object({
  ids: z.array(ClearStoryIdSchema).min(1).max(100),
  operation: z.enum(['activate', 'pause', 'archive', 'delete', 'addTags', 'removeTags']),
  data: z.object({
    tags: z.array(z.string().min(1).max(50)).min(1).max(10)
  }).optional()
}).refine(
  data => {
    if (data.operation === 'addTags' || data.operation === 'removeTags') {
      return data.data?.tags && data.data.tags.length > 0;
    }
    return true;
  },
  'Tags are required for addTags/removeTags operations'
);

/**
 * Import validation
 */
export const ImportClearStoriesSchema = z.object({
  customerId: CustomerIdSchema,
  stories: z.array(CreateClearStorySchema.omit({ customerId: true }))
    .min(1, 'At least one story is required')
    .max(500, 'Maximum 500 stories per import')
});

/**
 * Recommended query validation
 */
export const RecommendedQuerySchema = z.object({
  customerId: CustomerIdSchema,
  topic: z.string().min(1).max(200).optional(),
  category: ClearStoryCategorySchema.optional(),
  tone: ContentToneSchema.optional(),
  excludeIds: z.string().optional(),  // Parsed as comma-separated
  limit: z.coerce.number().int().min(1).max(20).optional().default(5)
});

/**
 * Random selection query validation
 */
export const RandomSelectionQuerySchema = z.object({
  customerId: CustomerIdSchema,
  count: z.coerce.number().int().min(1).max(10),
  excludeIds: z.string().optional()  // Parsed as comma-separated
});
```

---

## Error Codes

```typescript
/**
 * Clear Story domain-specific error codes.
 * All codes are prefixed with CLEAR_STORY_ for domain identification.
 */
export const ClearStoryErrorCodes = {
  // ─────────────────────────────────────────────────────────────
  // Not Found Errors (404)
  // ─────────────────────────────────────────────────────────────

  /** Clear Story with given ID does not exist */
  CLEAR_STORY_NOT_FOUND: 'CLEAR_STORY_NOT_FOUND',

  /** Referenced customer does not exist */
  CUSTOMER_NOT_FOUND: 'CLEAR_STORY_CUSTOMER_NOT_FOUND',

  /** Referenced KOL does not exist */
  KOL_NOT_FOUND: 'CLEAR_STORY_KOL_NOT_FOUND',

  // ─────────────────────────────────────────────────────────────
  // Validation Errors (400)
  // ─────────────────────────────────────────────────────────────

  /** Input validation failed */
  VALIDATION_ERROR: 'CLEAR_STORY_VALIDATION_ERROR',

  /** Topic is required */
  TOPIC_REQUIRED: 'CLEAR_STORY_TOPIC_REQUIRED',

  /** Belief text is required */
  BELIEF_REQUIRED: 'CLEAR_STORY_BELIEF_REQUIRED',

  /** Belief text exceeds maximum length (2000 chars) */
  BELIEF_TOO_LONG: 'CLEAR_STORY_BELIEF_TOO_LONG',

  /** Invalid source type */
  INVALID_SOURCE: 'CLEAR_STORY_INVALID_SOURCE',

  /** Invalid category */
  INVALID_CATEGORY: 'CLEAR_STORY_INVALID_CATEGORY',

  /** Invalid status transition */
  INVALID_STATUS_TRANSITION: 'CLEAR_STORY_INVALID_STATUS_TRANSITION',

  /** Duplicate topic within customer */
  DUPLICATE_TOPIC: 'CLEAR_STORY_DUPLICATE_TOPIC',

  // ─────────────────────────────────────────────────────────────
  // Conflict Errors (409)
  // ─────────────────────────────────────────────────────────────

  /** Cannot delete - referenced by active articles */
  IN_USE: 'CLEAR_STORY_IN_USE',

  /** Cannot modify archived Clear Story */
  ARCHIVED: 'CLEAR_STORY_ARCHIVED',

  /** Clear Story has expired */
  EXPIRED: 'CLEAR_STORY_EXPIRED',

  // ─────────────────────────────────────────────────────────────
  // Authorization Errors (403)
  // ─────────────────────────────────────────────────────────────

  /** User does not have access to this customer's Clear Stories */
  UNAUTHORIZED_CUSTOMER: 'CLEAR_STORY_UNAUTHORIZED_CUSTOMER',

  /** Operation requires admin permissions */
  ADMIN_REQUIRED: 'CLEAR_STORY_ADMIN_REQUIRED',

  // ─────────────────────────────────────────────────────────────
  // Limit Errors (429)
  // ─────────────────────────────────────────────────────────────

  /** Customer has reached Clear Story limit for their tier */
  QUOTA_EXCEEDED: 'CLEAR_STORY_QUOTA_EXCEEDED',

  /** Bulk operation exceeds maximum batch size */
  BULK_LIMIT_EXCEEDED: 'CLEAR_STORY_BULK_LIMIT_EXCEEDED',

  /** Import exceeds maximum stories per request */
  IMPORT_LIMIT_EXCEEDED: 'CLEAR_STORY_IMPORT_LIMIT_EXCEEDED',

  // ─────────────────────────────────────────────────────────────
  // Internal Errors (500)
  // ─────────────────────────────────────────────────────────────

  /** Database operation failed */
  DATABASE_ERROR: 'CLEAR_STORY_DATABASE_ERROR',

  /** Search index operation failed */
  SEARCH_INDEX_ERROR: 'CLEAR_STORY_SEARCH_INDEX_ERROR'
} as const;

/**
 * Type for Clear Story error codes
 */
export type ClearStoryErrorCode = typeof ClearStoryErrorCodes[keyof typeof ClearStoryErrorCodes];

/**
 * HTTP status code mapping for error codes
 */
export const ClearStoryErrorStatusMap: Record<ClearStoryErrorCode, number> = {
  [ClearStoryErrorCodes.CLEAR_STORY_NOT_FOUND]: 404,
  [ClearStoryErrorCodes.CUSTOMER_NOT_FOUND]: 404,
  [ClearStoryErrorCodes.KOL_NOT_FOUND]: 404,
  [ClearStoryErrorCodes.VALIDATION_ERROR]: 400,
  [ClearStoryErrorCodes.TOPIC_REQUIRED]: 400,
  [ClearStoryErrorCodes.BELIEF_REQUIRED]: 400,
  [ClearStoryErrorCodes.BELIEF_TOO_LONG]: 400,
  [ClearStoryErrorCodes.INVALID_SOURCE]: 400,
  [ClearStoryErrorCodes.INVALID_CATEGORY]: 400,
  [ClearStoryErrorCodes.INVALID_STATUS_TRANSITION]: 400,
  [ClearStoryErrorCodes.DUPLICATE_TOPIC]: 400,
  [ClearStoryErrorCodes.IN_USE]: 409,
  [ClearStoryErrorCodes.ARCHIVED]: 409,
  [ClearStoryErrorCodes.EXPIRED]: 409,
  [ClearStoryErrorCodes.UNAUTHORIZED_CUSTOMER]: 403,
  [ClearStoryErrorCodes.ADMIN_REQUIRED]: 403,
  [ClearStoryErrorCodes.QUOTA_EXCEEDED]: 429,
  [ClearStoryErrorCodes.BULK_LIMIT_EXCEEDED]: 429,
  [ClearStoryErrorCodes.IMPORT_LIMIT_EXCEEDED]: 429,
  [ClearStoryErrorCodes.DATABASE_ERROR]: 500,
  [ClearStoryErrorCodes.SEARCH_INDEX_ERROR]: 500
};
```

---

## Integration Points

### Events Published (to other domains)

```typescript
/**
 * Events the Clear Story domain publishes for other domains to consume.
 * All events include a timestamp and requestId for tracing.
 */
export interface ClearStoryEvents {
  /**
   * Emitted when a new Clear Story is created.
   * Consumers: Analytics (for tracking), potentially future search indexing.
   */
  'clear_story.created': {
    /** The created Clear Story ID */
    clearStoryId: ClearStoryId;
    /** Customer ID */
    customerId: CustomerId;
    /** Topic of the Clear Story */
    topic: string;
    /** Source type */
    source: ClearStorySource;
    /** Category */
    category: ClearStoryCategory;
    /** Who created it */
    createdBy: UserId;
    /** When it was created */
    createdAt: ISOTimestamp;
  };

  /**
   * Emitted when a Clear Story is selected for use in content generation.
   * Consumers: Article (confirms selection), Analytics (tracks usage patterns).
   */
  'clear_story.selected': {
    /** The selected Clear Story ID */
    clearStoryId: ClearStoryId;
    /** Customer ID */
    customerId: CustomerId;
    /** Topic selected */
    topic: string;
    /** Context of selection (e.g., which article generation) */
    context: {
      /** What selected it (article_generation, manual, random) */
      selectionType: 'article_generation' | 'manual' | 'random';
      /** ID of the selecting entity (e.g., article ID) */
      requesterId?: string;
      /** Requester type */
      requesterType?: 'article' | 'user' | 'system';
    };
    /** Updated usage count */
    usageCount: number;
    /** When it was selected */
    selectedAt: ISOTimestamp;
  };

  /**
   * Emitted when a Clear Story's usage produces performance data.
   * Consumers: Analytics (for performance tracking).
   */
  'clear_story.performance_recorded': {
    /** The Clear Story ID */
    clearStoryId: ClearStoryId;
    /** Customer ID */
    customerId: CustomerId;
    /** Performance metrics */
    metrics: {
      engagement: number;
      ctr?: number;
      mentionSuccess: boolean;
    };
    /** Where the performance came from */
    sourceArticleId?: string;
    sourcePostId?: string;
    /** When recorded */
    recordedAt: ISOTimestamp;
  };

  /**
   * Emitted when a Clear Story status changes.
   * Consumers: Analytics, potentially Article (to invalidate cached refs).
   */
  'clear_story.status_changed': {
    /** The Clear Story ID */
    clearStoryId: ClearStoryId;
    /** Customer ID */
    customerId: CustomerId;
    /** Previous status */
    previousStatus: ClearStoryStatus;
    /** New status */
    newStatus: ClearStoryStatus;
    /** Who changed it */
    changedBy: UserId;
    /** When it was changed */
    changedAt: ISOTimestamp;
  };

  /**
   * Emitted when a Clear Story is updated.
   * Consumers: Analytics, search index refresh.
   */
  'clear_story.updated': {
    /** The Clear Story ID */
    clearStoryId: ClearStoryId;
    /** Customer ID */
    customerId: CustomerId;
    /** Fields that were updated */
    updatedFields: string[];
    /** Who updated it */
    updatedBy: UserId;
    /** When it was updated */
    updatedAt: ISOTimestamp;
  };

  /**
   * Emitted when a Clear Story is archived or deleted.
   * Consumers: Article (to handle orphaned references), Analytics.
   */
  'clear_story.archived': {
    /** The Clear Story ID */
    clearStoryId: ClearStoryId;
    /** Customer ID */
    customerId: CustomerId;
    /** Whether it was hard deleted */
    hardDeleted: boolean;
    /** Who archived it */
    archivedBy: UserId;
    /** When it was archived */
    archivedAt: ISOTimestamp;
  };

  /**
   * Emitted when a Clear Story is expiring soon (within 7 days).
   * Consumers: Notification system, User/Customer domain.
   */
  'clear_story.expiring_soon': {
    /** The Clear Story ID */
    clearStoryId: ClearStoryId;
    /** Customer ID */
    customerId: CustomerId;
    /** Topic */
    topic: string;
    /** When it expires */
    expiresAt: ISOTimestamp;
    /** Days until expiration */
    daysUntilExpiration: number;
  };

  /**
   * Emitted when bulk import completes.
   * Consumers: Analytics, notification system.
   */
  'clear_story.bulk_imported': {
    /** Customer ID */
    customerId: CustomerId;
    /** Number of stories created */
    created: number;
    /** Number of failures */
    failed: number;
    /** Who performed the import */
    importedBy: UserId;
    /** When import completed */
    completedAt: ISOTimestamp;
  };
}
```

### Events Consumed (from other domains)

```typescript
/**
 * Events the Clear Story domain listens for from other domains.
 * Clear Story is a source domain, so it consumes minimal external events.
 */
export interface ConsumedEvents {
  /**
   * From User/Customer domain - customer tier changes may affect quotas.
   */
  'customer.tier_changed': {
    customerId: CustomerId;
    previousTier: CustomerTier;
    newTier: CustomerTier;
  };

  /**
   * From User/Customer domain - customer deleted (cascade soft-delete stories).
   */
  'customer.deleted': {
    customerId: CustomerId;
    deletedAt: ISOTimestamp;
  };

  /**
   * From Article domain - article published using this Clear Story.
   * Used to update performance metrics.
   */
  'article.published': {
    articleId: string;
    clearStoryIds: ClearStoryId[];
    publishedAt: ISOTimestamp;
  };

  /**
   * From Analytics domain - engagement data for content using Clear Stories.
   * Used to update performance metrics.
   */
  'analytics.engagement_updated': {
    entityType: 'article' | 'reddit_post';
    entityId: string;
    clearStoryIds: ClearStoryId[];
    metrics: {
      engagement: number;
      ctr?: number;
      mentionDetected: boolean;
    };
  };
}
```

### Event Publishing Example

```typescript
/**
 * Example event publisher interface for Clear Story domain.
 */
export interface IClearStoryEventPublisher {
  /**
   * Publish an event to the event bus.
   *
   * @param eventName - Name of the event
   * @param payload - Event payload
   */
  publish<K extends keyof ClearStoryEvents>(
    eventName: K,
    payload: ClearStoryEvents[K]
  ): Promise<void>;
}
```

---

## Database Schema

```sql
-- Clear Stories table
CREATE TABLE clear_stories (
  id VARCHAR(40) PRIMARY KEY,  -- cs_${uuid}
  customer_id VARCHAR(42) NOT NULL,  -- cust_${uuid}
  topic VARCHAR(200) NOT NULL,
  belief TEXT NOT NULL,  -- max 2000 chars enforced at app level
  belief_summary VARCHAR(203) NOT NULL,  -- first 200 chars + "..."
  source VARCHAR(30) NOT NULL,  -- ClearStorySource enum
  category VARCHAR(30) NOT NULL,  -- ClearStoryCategory enum
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- ClearStoryStatus enum
  confidence VARCHAR(20) NOT NULL DEFAULT 'medium',  -- ConfidenceLevel
  confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.50,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  internal_notes TEXT,

  -- Performance metrics (JSONB for flexibility)
  performance_metrics JSONB,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by VARCHAR(40) NOT NULL,  -- usr_${uuid}
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(40) NOT NULL,

  -- Indexes
  CONSTRAINT fk_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE CASCADE
);

-- Supporting KOLs junction table
CREATE TABLE clear_story_kols (
  clear_story_id VARCHAR(40) NOT NULL,
  kol_id VARCHAR(40) NOT NULL,
  kol_name VARCHAR(200) NOT NULL,
  kol_platform VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  PRIMARY KEY (clear_story_id, kol_id),
  CONSTRAINT fk_clear_story FOREIGN KEY (clear_story_id)
    REFERENCES clear_stories(id) ON DELETE CASCADE
);

-- Tags (array stored as separate table for efficient querying)
CREATE TABLE clear_story_tags (
  clear_story_id VARCHAR(40) NOT NULL,
  tag VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  PRIMARY KEY (clear_story_id, tag),
  CONSTRAINT fk_clear_story FOREIGN KEY (clear_story_id)
    REFERENCES clear_stories(id) ON DELETE CASCADE
);

-- Competitors
CREATE TABLE clear_story_competitors (
  clear_story_id VARCHAR(40) NOT NULL,
  competitor_name VARCHAR(100) NOT NULL,

  PRIMARY KEY (clear_story_id, competitor_name),
  CONSTRAINT fk_clear_story FOREIGN KEY (clear_story_id)
    REFERENCES clear_stories(id) ON DELETE CASCADE
);

-- Target audiences
CREATE TABLE clear_story_audiences (
  clear_story_id VARCHAR(40) NOT NULL,
  audience VARCHAR(100) NOT NULL,

  PRIMARY KEY (clear_story_id, audience),
  CONSTRAINT fk_clear_story FOREIGN KEY (clear_story_id)
    REFERENCES clear_stories(id) ON DELETE CASCADE
);

-- Recommended tones
CREATE TABLE clear_story_tones (
  clear_story_id VARCHAR(40) NOT NULL,
  tone VARCHAR(20) NOT NULL,

  PRIMARY KEY (clear_story_id, tone),
  CONSTRAINT fk_clear_story FOREIGN KEY (clear_story_id)
    REFERENCES clear_stories(id) ON DELETE CASCADE
);

-- Supporting evidence
CREATE TABLE clear_story_evidence (
  id SERIAL PRIMARY KEY,
  clear_story_id VARCHAR(40) NOT NULL,
  evidence_type VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  attributed_to_kol_id VARCHAR(40),
  attributed_to_kol_name VARCHAR(200),
  credibility DECIMAL(3,2) NOT NULL DEFAULT 0.50,

  CONSTRAINT fk_clear_story FOREIGN KEY (clear_story_id)
    REFERENCES clear_stories(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX idx_cs_customer_id ON clear_stories(customer_id);
CREATE INDEX idx_cs_customer_created ON clear_stories(customer_id, created_at DESC);
CREATE INDEX idx_cs_customer_status ON clear_stories(customer_id, status);
CREATE INDEX idx_cs_customer_source ON clear_stories(customer_id, source);
CREATE INDEX idx_cs_customer_category ON clear_stories(customer_id, category);
CREATE INDEX idx_cs_topic ON clear_stories USING gin(to_tsvector('english', topic));
CREATE INDEX idx_cs_belief ON clear_stories USING gin(to_tsvector('english', belief));
CREATE INDEX idx_cs_usage_count ON clear_stories(usage_count DESC);
CREATE INDEX idx_cs_expires_at ON clear_stories(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_cs_tags ON clear_story_tags(tag);
CREATE INDEX idx_cs_kols ON clear_story_kols(kol_id);
```

---

## Constants

```typescript
/**
 * Clear Story domain constants
 */
export const CLEAR_STORY_CONSTANTS = {
  // Content limits
  TOPIC_MIN_LENGTH: 3,
  TOPIC_MAX_LENGTH: 200,
  BELIEF_MIN_LENGTH: 10,
  BELIEF_MAX_LENGTH: 2000,
  BELIEF_SUMMARY_LENGTH: 200,
  INTERNAL_NOTES_MAX_LENGTH: 1000,
  TAG_MAX_LENGTH: 50,
  MAX_TAGS_PER_STORY: 20,
  MAX_KOLS_PER_STORY: 20,
  MAX_EVIDENCE_PER_STORY: 10,
  MAX_COMPETITORS_PER_STORY: 10,
  MAX_AUDIENCES_PER_STORY: 10,
  MAX_TONES_PER_STORY: 5,

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Bulk operations
  MAX_BULK_OPERATION_SIZE: 100,
  MAX_IMPORT_SIZE: 500,

  // Discovery
  DEFAULT_POPULAR_LIMIT: 10,
  DEFAULT_RECENT_LIMIT: 10,
  MAX_DISCOVERY_LIMIT: 50,
  DEFAULT_EXPIRING_DAYS: 30,
  EXPIRING_SOON_THRESHOLD_DAYS: 7,

  // Content selection
  DEFAULT_RECOMMENDED_LIMIT: 5,
  MAX_RECOMMENDED_LIMIT: 20,
  MAX_RANDOM_SELECTION: 10,

  // Customer tier quotas
  QUOTA_BY_TIER: {
    trial: 50,
    starter: 200,
    growth: 1000,
    enterprise: Infinity
  }
} as const;
```

---

## Notes for Implementers

1. **beliefSummary Generation**: When creating or updating a Clear Story, automatically generate `beliefSummary` as the first 200 characters of `belief` with "..." appended if truncated.

2. **Confidence Score Mapping**: Convert `ConfidenceLevel` to `confidenceScore`:
   - `low` -> 0.25
   - `medium` -> 0.50
   - `high` -> 0.75
   - `verified` -> 0.95

3. **Usage Tracking**: The `incrementUsageCount` method should be called by the Article domain when a Clear Story is selected for content generation, not when the article is published.

4. **Performance Metrics**: Update performance metrics using exponential moving average to prevent single outliers from skewing scores.

5. **Status Transitions**: Enforce valid status transitions:
   - `draft` -> `review`, `active`, `archived`
   - `review` -> `active`, `draft`, `archived`
   - `active` -> `paused`, `archived`
   - `paused` -> `active`, `archived`
   - `archived` -> (no transitions, except via admin restore)

6. **Soft Delete**: The standard `delete` operation should set `status` to `archived`, not remove the record. Only `hardDelete` removes data.

7. **Expiration**: Expired Clear Stories should still be retrievable but excluded from content selection unless `includeExpired` is true.

8. **Full-Text Search**: Implement search across both `topic` and `belief` fields. Consider using PostgreSQL's `tsvector` for efficient text search.

9. **Event Timing**: Publish events after the database transaction commits successfully to ensure consistency.

10. **Cache Considerations**: Consider caching popular and recent Clear Stories, invalidating on create/update/usage.

---

*Contract Version: 1.0.0 | Generated: 2026-01-18*
