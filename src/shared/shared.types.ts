/**
 * GEO Platform - Shared Primitives
 *
 * This module contains all shared types, enums, interfaces, and constants
 * used across the GEO Platform. These primitives ensure consistency
 * across domain boundaries and enable parallel development of domain contracts.
 *
 * @module shared/shared.types
 * @version 1.0.0
 */

// =============================================================================
// IDENTITY TYPES (Branded types for type safety)
// =============================================================================

/** Unique identifier for platform users (format: usr_uuid) */
export type UserId = string & { readonly __brand: 'UserId' };

/** Unique identifier for customer/company accounts (format: cust_uuid) */
export type CustomerId = string & { readonly __brand: 'CustomerId' };

/** Unique identifier for Clear Story entries (format: cs_uuid) */
export type ClearStoryId = string & { readonly __brand: 'ClearStoryId' };

/** Unique identifier for generated articles (format: art_uuid) */
export type ArticleId = string & { readonly __brand: 'ArticleId' };

/** Unique identifier for article revisions (format: artv_uuid) */
export type ArticleVersionId = string & { readonly __brand: 'ArticleVersionId' };

/** Internal identifier for Reddit post records (format: rp_uuid) */
export type RedditPostId = string & { readonly __brand: 'RedditPostId' };

/** Reddit native post ID (t3_xxxxx format) */
export type RedditExternalId = string;

/** Unique identifier for scheduled tasks (format: sched_uuid) */
export type ScheduleId = string & { readonly __brand: 'ScheduleId' };

/** Unique identifier for agent workflow sessions (format: sess_uuid) */
export type AgentSessionId = string & { readonly __brand: 'AgentSessionId' };

/** Unique identifier for Key Opinion Leaders (format: kol_uuid) */
export type KolId = string & { readonly __brand: 'KolId' };

/** Unique identifier for competitor entries (format: comp_uuid) */
export type CompetitorId = string & { readonly __brand: 'CompetitorId' };

/** Unique identifier for tracked subreddits (format: sub_uuid) */
export type SubredditId = string & { readonly __brand: 'SubredditId' };

/** Unique identifier for UTM tracking campaigns (format: utm_uuid) */
export type UtmCampaignId = string & { readonly __brand: 'UtmCampaignId' };

/** Unique identifier for brand guideline documents (format: bg_uuid) */
export type BrandGuidelineId = string & { readonly __brand: 'BrandGuidelineId' };

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Lifecycle states for generated articles.
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
  /** Published to customer blog/site */
  published = 'published',
  /** No longer active, removed from distribution */
  archived = 'archived'
}

/**
 * Lifecycle states for Reddit distribution.
 */
export enum RedditPostStatus {
  /** Generated, awaiting human approval */
  pending_approval = 'pending_approval',
  /** Approved, ready for posting */
  approved = 'approved',
  /** In scheduler queue */
  queued = 'queued',
  /** Currently being posted */
  posting = 'posting',
  /** Successfully posted to Reddit */
  posted = 'posted',
  /** Post attempt failed */
  failed = 'failed',
  /** Removed by Reddit/moderators */
  removed = 'removed',
  /** Deleted by user */
  deleted = 'deleted'
}

/**
 * States for scheduled tasks.
 */
export enum ScheduleStatus {
  /** Awaiting execution time */
  pending = 'pending',
  /** Currently executing */
  running = 'running',
  /** Successfully completed */
  completed = 'completed',
  /** Execution failed */
  failed = 'failed',
  /** User cancelled */
  cancelled = 'cancelled',
  /** Temporarily paused */
  paused = 'paused'
}

/**
 * Types of Claude agents in the system.
 */
export enum AgentType {
  /** Helps user find appropriate Clear Story */
  story_selector = 'story_selector',
  /** Generates blog articles from Clear Stories */
  article_generator = 'article_generator',
  /** Creates and posts Reddit summaries */
  reddit_poster = 'reddit_poster',
  /** Manages posting queue and timing */
  scheduler = 'scheduler'
}

/**
 * States for agent workflow sessions.
 */
export enum AgentSessionStatus {
  /** Session in progress */
  active = 'active',
  /** Waiting for user input */
  awaiting_input = 'awaiting_input',
  /** Agent executing tools */
  processing = 'processing',
  /** Session finished successfully */
  completed = 'completed',
  /** Session encountered error */
  failed = 'failed',
  /** Session timed out */
  timeout = 'timeout'
}

/**
 * Origin types for Clear Story beliefs.
 */
export enum ClearStorySource {
  /** Extracted from customer interviews */
  customer_interview = 'customer_interview',
  /** Extracted from competitor content */
  competitor_website = 'competitor_website',
  /** Extracted from Reddit discussions */
  reddit_analysis = 'reddit_analysis',
  /** Extracted from niche forums */
  forum_analysis = 'forum_analysis',
  /** Extracted from sales call transcripts */
  sales_call = 'sales_call',
  /** Extracted from Key Opinion Leader content */
  kol_content = 'kol_content',
  /** Extracted from Quora discussions */
  quora_analysis = 'quora_analysis'
}

/**
 * Tone options for generated content.
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

/**
 * Engagement classification for posts.
 */
export enum EngagementLevel {
  /** Below target engagement */
  low = 'low',
  /** Meeting basic targets */
  medium = 'medium',
  /** Exceeding targets */
  high = 'high',
  /** Significantly exceeding targets */
  viral = 'viral'
}

/**
 * Customer account tiers.
 */
export enum CustomerTier {
  /** Trial period */
  trial = 'trial',
  /** Basic tier */
  starter = 'starter',
  /** Mid-tier */
  growth = 'growth',
  /** Full feature access */
  enterprise = 'enterprise'
}

/**
 * Supported distribution platforms.
 */
export enum Platform {
  /** Reddit (Phase 1) */
  reddit = 'reddit',
  /** Quora (Future) */
  quora = 'quora',
  /** Niche forums (Future) */
  forum = 'forum',
  /** LinkedIn (Future) */
  linkedin = 'linkedin'
}

// =============================================================================
// TIMESTAMP TYPES
// =============================================================================

/** ISO 8601 formatted timestamp string */
export type ISOTimestamp = string;

/** Unix timestamp in milliseconds */
export type UnixTimestamp = number;

// =============================================================================
// CROSS-REFERENCE INTERFACES
// =============================================================================

/**
 * Minimal user reference for cross-domain use.
 * The User/Customer domain owns the full User entity.
 */
export interface UserRef {
  /** Unique identifier for the user */
  id: UserId;
  /** User email address */
  email: string;
  /** Display name for UI */
  displayName: string;
}

/**
 * Minimal customer reference for cross-domain use.
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

/**
 * Minimal Clear Story reference for articles and posts.
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

/**
 * Minimal article reference for scheduling and analytics.
 * The Article domain owns the full Article entity.
 */
export interface ArticleRef {
  /** Article ID */
  id: ArticleId;
  /** Article title */
  title: string;
  /** Current status */
  status: ArticleStatus;
  /** Published URL (if published) */
  publishedUrl?: string;
}

/**
 * Minimal Reddit post reference for analytics.
 * The Reddit Distribution domain owns the full RedditPost entity.
 */
export interface RedditPostRef {
  /** Internal post ID */
  id: RedditPostId;
  /** Reddit external post ID */
  redditExternalId?: RedditExternalId;
  /** Subreddit name */
  subreddit: string;
  /** Current status */
  status: RedditPostStatus;
  /** Reddit permalink */
  permalink?: string;
}

/**
 * Minimal KOL reference for Clear Stories.
 */
export interface KolRef {
  /** KOL ID */
  id: KolId;
  /** KOL name */
  name: string;
  /** Platform where KOL is active */
  platform: Platform;
}

/**
 * Minimal session reference for tracking.
 */
export interface AgentSessionRef {
  /** Session ID */
  id: AgentSessionId;
  /** Type of agent */
  agentType: AgentType;
  /** Current session status */
  status: AgentSessionStatus;
  /** When session started */
  startedAt: ISOTimestamp;
}

// =============================================================================
// PAGINATION
// =============================================================================

/**
 * Pagination parameters for list queries.
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  /** Array of items for current page */
  data: T[];
  /** Pagination metadata */
  pagination: {
    /** Current page number */
    page: number;
    /** Items per page */
    pageSize: number;
    /** Total number of items across all pages */
    totalItems: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether there is a next page */
    hasNextPage: boolean;
    /** Whether there is a previous page */
    hasPreviousPage: boolean;
  };
}

// =============================================================================
// API RESPONSE WRAPPERS
// =============================================================================

/**
 * Standard API response wrapper.
 */
export interface ApiResponse<T> {
  /** Whether the request succeeded */
  success: boolean;
  /** Response data (if successful) */
  data?: T;
  /** Error details (if failed) */
  error?: ApiError;
  /** Unique request identifier for tracing */
  requestId: string;
  /** Response timestamp */
  timestamp: ISOTimestamp;
}

/**
 * API error details.
 */
export interface ApiError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error context */
  details?: Record<string, unknown>;
  /** Whether the request can be retried */
  retryable: boolean;
}

// =============================================================================
// SEARCH/FILTER PATTERNS
// =============================================================================

/**
 * Standard search parameters for list endpoints.
 */
export interface SearchParams {
  /** Text search query */
  query?: string;
  /** Filter criteria */
  filters?: Record<string, string | string[] | boolean>;
  /** Field to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Pagination parameters */
  pagination?: PaginationParams;
}

// =============================================================================
// UTM PARAMETERS
// =============================================================================

/**
 * UTM tracking parameters for links.
 */
export interface UtmParams {
  /** Traffic source (e.g., reddit, newsletter) */
  source: string;
  /** Marketing medium (e.g., social, email) */
  medium: string;
  /** Campaign name/identifier */
  campaign: string;
  /** Content variant identifier */
  content?: string;
  /** Search term (if applicable) */
  term?: string;
}

// =============================================================================
// AUDIT TRAIL
// =============================================================================

/**
 * Standard audit information for entities.
 */
export interface AuditInfo {
  /** When the entity was created */
  createdAt: ISOTimestamp;
  /** Who created the entity */
  createdBy: UserRef;
  /** When the entity was last updated */
  updatedAt: ISOTimestamp;
  /** Who last updated the entity */
  updatedBy: UserRef;
}

// =============================================================================
// AGENT TOOL CALL
// =============================================================================

/**
 * Record of a tool call made by an agent.
 */
export interface AgentToolCall {
  /** Name of the tool called */
  toolName: string;
  /** Input parameters passed to the tool */
  input: Record<string, unknown>;
  /** Output returned by the tool */
  output?: Record<string, unknown>;
  /** When the tool call started */
  startedAt: ISOTimestamp;
  /** When the tool call completed */
  completedAt?: ISOTimestamp;
  /** Current status of the tool call */
  status: 'pending' | 'running' | 'success' | 'error';
  /** Error message if status is error */
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Rate Limits
export const REDDIT_POSTS_PER_HOUR = 60;
export const REDDIT_COMMENTS_PER_HOUR = 100;
export const ARTICLES_PER_DAY_STARTER = 10;
export const ARTICLES_PER_DAY_GROWTH = 50;
export const ARTICLES_PER_DAY_ENTERPRISE = Infinity;
export const API_REQUESTS_PER_MINUTE = 100;

// Content Constraints
export const ARTICLE_MIN_WORDS = 1200;
export const ARTICLE_MAX_WORDS = 1800;
export const REDDIT_TITLE_MAX_CHARS = 300;
export const REDDIT_BODY_MAX_CHARS = 40000;
export const REDDIT_SUMMARY_TARGET_WORDS_MIN = 200;
export const REDDIT_SUMMARY_TARGET_WORDS_MAX = 400;
export const CLEAR_STORY_BELIEF_MAX_CHARS = 2000;

// Timing Constants
export const ARTICLE_GENERATION_TIMEOUT_MS = 30000;
export const REDDIT_POST_RETRY_DELAY_MS = 60000;
export const REDDIT_POST_MAX_RETRIES = 3;
export const SCHEDULE_LOOKAHEAD_HOURS = 168;
export const SESSION_TIMEOUT_MS = 1800000;
export const OAUTH_TOKEN_REFRESH_BUFFER_MS = 300000;

// Success Thresholds (Phase 1 Metrics)
export const TARGET_LLM_MENTION_INCREASE = 0.20;
export const TARGET_TRAFFIC_INCREASE = 0.50;
export const TARGET_REDDIT_UPVOTES = 10;
export const TARGET_REDDIT_COMMENTS = 2;
export const REDDIT_POST_SUCCESS_RATE = 0.95;
export const ARTICLE_GENERATION_SUCCESS_TIME_MS = 30000;

// Default Values
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_SORT_ORDER = 'desc' as const;
export const DEFAULT_ARTICLE_TONE = ContentTone.authoritative;
export const DEFAULT_SCHEDULE_BUFFER_MINUTES = 15;
