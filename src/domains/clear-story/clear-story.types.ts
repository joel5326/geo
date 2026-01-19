/**
 * Clear Story Domain Types
 *
 * This file contains all TypeScript type definitions for the Clear Story domain
 * in the GEO Platform. Clear Story is the belief library - responsible
 * for storage, search, filtering, and retrieval of Clear Stories that ground
 * AI-generated content.
 *
 * @module clear-story/types
 * @version 1.0.0
 */

// =============================================================================
// IMPORTS FROM SHARED PRIMITIVES
// =============================================================================

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
} from '../../shared/shared.types';

// Re-export imported types for convenience
export type {
  ClearStoryId,
  CustomerId,
  KolId,
  UserId,
  ClearStorySource,
  ContentTone,
  CustomerTier,
  ClearStoryRef,
  CustomerRef,
  KolRef,
  UserRef,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  SearchParams,
  AuditInfo,
  ISOTimestamp
};

// =============================================================================
// DOMAIN-SPECIFIC TYPES
// =============================================================================

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

// =============================================================================
// SUPPORTING TYPES
// =============================================================================

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

// =============================================================================
// CLEAR STORY ENTITY
// =============================================================================

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

// =============================================================================
// SEARCH AND FILTER TYPES
// =============================================================================

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

// =============================================================================
// INPUT TYPES
// =============================================================================

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

// =============================================================================
// BULK OPERATION TYPES
// =============================================================================

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

// =============================================================================
// STATISTICS TYPES
// =============================================================================

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

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Clear Story domain service interface.
 * All methods are async and return Promises.
 */
export interface IClearStoryService {
  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Finder Methods
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Usage Tracking
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Analytics & Discovery
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Bulk Operations
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Content Selection (for Article Domain)
  // -------------------------------------------------------------------------

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

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

/**
 * Repository interface for ClearStory persistence.
 * Provides low-level data access methods.
 */
export interface IClearStoryRepository {
  // -------------------------------------------------------------------------
  // Basic CRUD
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Query Methods
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Aggregation Methods
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Bulk Operations
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Usage Tracking
  // -------------------------------------------------------------------------

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

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

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

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

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

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Clear Story domain-specific error codes.
 * All codes are prefixed with CLEAR_STORY_ for domain identification.
 */
export const ClearStoryErrorCodes = {
  // -------------------------------------------------------------------------
  // Not Found Errors (404)
  // -------------------------------------------------------------------------

  /** Clear Story with given ID does not exist */
  CLEAR_STORY_NOT_FOUND: 'CLEAR_STORY_NOT_FOUND',

  /** Referenced customer does not exist */
  CUSTOMER_NOT_FOUND: 'CLEAR_STORY_CUSTOMER_NOT_FOUND',

  /** Referenced KOL does not exist */
  KOL_NOT_FOUND: 'CLEAR_STORY_KOL_NOT_FOUND',

  // -------------------------------------------------------------------------
  // Validation Errors (400)
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Conflict Errors (409)
  // -------------------------------------------------------------------------

  /** Cannot delete - referenced by active articles */
  IN_USE: 'CLEAR_STORY_IN_USE',

  /** Cannot modify archived Clear Story */
  ARCHIVED: 'CLEAR_STORY_ARCHIVED',

  /** Clear Story has expired */
  EXPIRED: 'CLEAR_STORY_EXPIRED',

  // -------------------------------------------------------------------------
  // Authorization Errors (403)
  // -------------------------------------------------------------------------

  /** User does not have access to this customer's Clear Stories */
  UNAUTHORIZED_CUSTOMER: 'CLEAR_STORY_UNAUTHORIZED_CUSTOMER',

  /** Operation requires admin permissions */
  ADMIN_REQUIRED: 'CLEAR_STORY_ADMIN_REQUIRED',

  // -------------------------------------------------------------------------
  // Limit Errors (429)
  // -------------------------------------------------------------------------

  /** Customer has reached Clear Story limit for their tier */
  QUOTA_EXCEEDED: 'CLEAR_STORY_QUOTA_EXCEEDED',

  /** Bulk operation exceeds maximum batch size */
  BULK_LIMIT_EXCEEDED: 'CLEAR_STORY_BULK_LIMIT_EXCEEDED',

  /** Import exceeds maximum stories per request */
  IMPORT_LIMIT_EXCEEDED: 'CLEAR_STORY_IMPORT_LIMIT_EXCEEDED',

  // -------------------------------------------------------------------------
  // Internal Errors (500)
  // -------------------------------------------------------------------------

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

// =============================================================================
// EVENT TYPES
// =============================================================================

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

// =============================================================================
// CONSTANTS
// =============================================================================

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
