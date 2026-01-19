/**
 * Reddit Distribution Domain - TypeScript Type Definitions
 *
 * This file contains all types, interfaces, enums, and constants for the
 * Reddit Distribution domain in the GEO Platform.
 *
 * The Reddit Distribution domain handles OAuth integration with Reddit,
 * generates platform-appropriate summaries from articles, manages post
 * creation and lifecycle, tracks engagement metrics, and ensures compliance
 * with Reddit's rate limits and content policies.
 *
 * @version 1.0.0
 * @date 2026-01-18
 */

import type {
  // Identity Types
  RedditPostId,
  ArticleId,
  CustomerId,
  UserId,
  ScheduleId,

  // Cross-Domain References
  UserRef,
  CustomerRef,

  // API Patterns
  PaginatedResponse,
  PaginationParams,
  SearchParams,

  // Shared Data Structures
  ISOTimestamp,
  AuditInfo
} from '../../shared/shared.types';

// Re-export for convenience
export type {
  RedditPostId,
  ArticleId,
  CustomerId,
  UserId,
  ScheduleId,
  UserRef,
  CustomerRef,
  PaginatedResponse,
  PaginationParams,
  SearchParams,
  ISOTimestamp,
  AuditInfo
};

// =============================================================================
// DOMAIN-SPECIFIC BRANDED ID TYPES
// =============================================================================

/**
 * Reddit's native post ID (t3_xxxxx format).
 */
export type RedditExternalId = string;

/**
 * Internal identifier for tracked subreddits.
 * Format: `sub_${uuid}`
 */
export type SubredditId = string & { readonly __brand: 'SubredditId' };

/**
 * Unique identifier for UTM tracking campaigns.
 * Format: `utm_${uuid}`
 */
export type UtmCampaignId = string & { readonly __brand: 'UtmCampaignId' };

/**
 * Unique identifier for agent workflow sessions.
 * Format: `sess_${uuid}`
 */
export type AgentSessionId = string & { readonly __brand: 'AgentSessionId' };

// =============================================================================
// DOMAIN-SPECIFIC ENUMS
// =============================================================================

/**
 * Lifecycle states for Reddit posts.
 * Posts progress through these states from creation to publication.
 */
export enum RedditPostStatus {
  /** Generated summary awaiting human approval */
  pending_approval = 'pending_approval',

  /** Approved by human, ready for scheduling */
  approved = 'approved',

  /** Added to scheduler queue with scheduled time */
  queued = 'queued',

  /** Currently being posted to Reddit API */
  posting = 'posting',

  /** Successfully posted to Reddit */
  posted = 'posted',

  /** Post attempt failed (will retry if retries remain) */
  failed = 'failed',

  /** Removed by Reddit moderators or spam filter */
  removed = 'removed',

  /** Deleted by user or system */
  deleted = 'deleted'
}

/**
 * Classification levels for post engagement performance.
 * Used for analytics and automated decision-making.
 */
export enum EngagementLevel {
  /** Below target engagement thresholds */
  low = 'low',

  /** Meeting basic engagement targets */
  medium = 'medium',

  /** Exceeding target thresholds */
  high = 'high',

  /** Significantly exceeding targets (10x+ normal) */
  viral = 'viral'
}

/**
 * Lifecycle states for generated articles.
 */
export enum ArticleStatus {
  /** Initial generation, not reviewed */
  draft = 'draft',
  /** Under human review */
  review = 'review',
  /** User requested changes/regeneration */
  revision_requested = 'revision_requested',
  /** Approved for distribution */
  approved = 'approved',
  /** Published to customer's blog/site */
  published = 'published',
  /** No longer active */
  archived = 'archived'
}

// =============================================================================
// SHARED DATA STRUCTURES (Domain-specific definitions)
// =============================================================================

/**
 * UTM tracking parameters for analytics.
 */
export interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

/**
 * Minimal article reference used by Reddit Distribution domain.
 * The Article domain owns the full Article entity.
 * Used to link Reddit posts back to their source articles.
 */
export interface ArticleRef {
  /** Article unique identifier */
  id: ArticleId;

  /** Article title for display */
  title: string;

  /** Current article status */
  status: ArticleStatus;

  /** Published URL if article is published */
  publishedUrl?: string;
}

// =============================================================================
// OAUTH TYPES
// =============================================================================

/**
 * Reddit OAuth token storage for a customer.
 * Manages authentication state for Reddit API access.
 */
export interface RedditOAuthToken {
  /** Customer this token belongs to */
  customerId: CustomerId;

  /** Reddit OAuth access token */
  accessToken: string;

  /** Reddit OAuth refresh token for renewal */
  refreshToken: string;

  /** Token expiration timestamp */
  expiresAt: ISOTimestamp;

  /** OAuth scopes granted by the user */
  scope: string[];

  /** Reddit username associated with this token */
  redditUsername: string;

  /** Reddit account ID */
  redditAccountId: string;

  /** When the token was first issued */
  issuedAt: ISOTimestamp;

  /** When the token was last refreshed */
  lastRefreshedAt?: ISOTimestamp;

  /** Whether the token is currently valid */
  isValid: boolean;

  /** Number of consecutive refresh failures */
  refreshFailures: number;

  /** Audit information */
  audit: AuditInfo;
}

/**
 * OAuth connection request for initiating Reddit OAuth flow.
 */
export interface RedditOAuthConnectInput {
  /** Customer initiating the connection */
  customerId: CustomerId;

  /** OAuth authorization code from Reddit callback */
  authorizationCode: string;

  /** Redirect URI used in the OAuth flow */
  redirectUri: string;

  /** State parameter for CSRF protection */
  state: string;
}

/**
 * OAuth token refresh request.
 */
export interface RedditOAuthRefreshInput {
  /** Customer whose token to refresh */
  customerId: CustomerId;

  /** Force refresh even if token not expired */
  force?: boolean;
}

// =============================================================================
// ENGAGEMENT TYPES
// =============================================================================

/**
 * Engagement metrics for a Reddit post.
 * Updated periodically after posting.
 */
export interface RedditEngagement {
  /** Number of upvotes */
  upvotes: number;

  /** Number of downvotes */
  downvotes: number;

  /** Net score (upvotes - downvotes) */
  score: number;

  /** Upvote ratio (0-1) */
  ratio: number;

  /** Number of comments */
  comments: number;

  /** Number of awards received */
  awards: number;

  /** Number of crossposts */
  crossposts: number;

  /** Calculated engagement level */
  level: EngagementLevel;

  /** When metrics were last updated */
  lastUpdatedAt: ISOTimestamp;
}

/**
 * Default engagement values for new posts.
 */
export const DEFAULT_ENGAGEMENT: Omit<RedditEngagement, 'lastUpdatedAt'> & { lastUpdatedAt: string } = {
  upvotes: 0,
  downvotes: 0,
  score: 0,
  ratio: 0,
  comments: 0,
  awards: 0,
  crossposts: 0,
  level: EngagementLevel.low,
  lastUpdatedAt: new Date().toISOString()
};

// =============================================================================
// SUBREDDIT TYPES
// =============================================================================

/**
 * Individual subreddit rule.
 */
export interface SubredditRule {
  /** Rule number/priority */
  priority: number;

  /** Short rule name */
  shortName: string;

  /** Full rule description */
  description: string;

  /** Rule violation type */
  violationType: 'ban' | 'removal' | 'warning';
}

/**
 * Posting restrictions for a subreddit.
 */
export interface SubredditRestrictions {
  /** Whether the subreddit is NSFW */
  isNsfw: boolean;

  /** Whether posting requires flair */
  requiresFlair: boolean;

  /** Available flair options if required */
  flairOptions?: string[];

  /** Whether titles have specific requirements */
  hasTitleRequirements: boolean;

  /** Title prefix/suffix requirements */
  titleRequirements?: string;

  /** Minimum title length */
  minTitleLength?: number;

  /** Maximum posts per day per user */
  postsPerDay?: number;

  /** Domains that are blacklisted */
  blacklistedDomains?: string[];
}

/**
 * Tracked subreddit information.
 * Stores subreddit metadata and posting rules.
 */
export interface Subreddit {
  /** Internal subreddit identifier */
  id: SubredditId;

  /** Subreddit name without r/ prefix (e.g., "technology") */
  name: string;

  /** Subreddit display name */
  displayName: string;

  /** Number of subscribers */
  subscribers: number;

  /** Whether the subreddit is currently active */
  isActive: boolean;

  /** Whether posts are allowed */
  allowsTextPosts: boolean;

  /** Whether links are allowed */
  allowsLinkPosts: boolean;

  /** Minimum account age required (days) */
  minAccountAge?: number;

  /** Minimum karma required */
  minKarma?: number;

  /** Subreddit rules summary */
  rules: SubredditRule[];

  /** Posting restrictions */
  restrictions: SubredditRestrictions;

  /** Topics/categories this subreddit covers */
  topics: string[];

  /** Whether we are actively tracking this subreddit */
  isTracked: boolean;

  /** Customer who added this subreddit for tracking */
  trackedByCustomerId?: CustomerId;

  /** When subreddit info was last synced from Reddit */
  lastSyncedAt: ISOTimestamp;

  /** Audit information */
  audit: AuditInfo;
}

// =============================================================================
// REDDIT POST TYPES
// =============================================================================

/**
 * Reddit post entity - the core entity of this domain.
 * Represents a Reddit post created from an article summary.
 */
export interface RedditPost {
  /** Internal post identifier (rp_uuid format) */
  id: RedditPostId;

  /** Reference to source article */
  articleId: ArticleId;

  /** Customer who owns this post */
  customerId: CustomerId;

  /** Target subreddit (without r/ prefix) */
  subreddit: string;

  /** Post title (max 300 chars) */
  title: string;

  /** Post body/content (max 40000 chars) */
  body: string;

  /** Optional link URL if link post */
  linkUrl?: string;

  /** Selected flair if required by subreddit */
  flair?: string;

  /** Current post status */
  status: RedditPostStatus;

  /** Reddit's external post ID (t3_xxxxx format) after posting */
  redditExternalId?: RedditExternalId;

  /** Permalink to the post on Reddit */
  permalink?: string;

  /** Full URL to the post */
  fullUrl?: string;

  /** Engagement metrics */
  engagement: RedditEngagement;

  /** UTM parameters for link tracking */
  utmParams?: UtmParams;

  /** Campaign this post belongs to */
  utmCampaignId?: UtmCampaignId;

  /** Number of post attempts */
  attempts: number;

  /** Maximum retry attempts allowed */
  maxRetries: number;

  /** Last error message if failed */
  lastError?: string;

  /** Scheduled posting time */
  scheduledFor?: ISOTimestamp;

  /** When the post was approved */
  approvedAt?: ISOTimestamp;

  /** User who approved the post */
  approvedBy?: UserRef;

  /** When the post was actually posted */
  postedAt?: ISOTimestamp;

  /** When engagement was last refreshed */
  engagementUpdatedAt?: ISOTimestamp;

  /** Agent session that generated this post */
  agentSessionId?: AgentSessionId;

  /** AI model used for summary generation */
  generationModel?: string;

  /** Tokens used in generation */
  generationTokens?: number;

  /** Generation latency in milliseconds */
  generationLatencyMs?: number;

  /** Audit information */
  audit: AuditInfo;
}

/**
 * Minimal Reddit post reference for cross-domain use.
 */
export interface RedditPostRef {
  /** Post identifier */
  id: RedditPostId;

  /** Reddit external ID if posted */
  redditExternalId?: RedditExternalId;

  /** Target subreddit */
  subreddit: string;

  /** Current status */
  status: RedditPostStatus;

  /** Permalink if posted */
  permalink?: string;
}

// =============================================================================
// POST INPUT/OUTPUT TYPES
// =============================================================================

/**
 * Input for creating a new Reddit post.
 * Used when manually creating a post or when the agent generates one.
 */
export interface CreateRedditPostInput {
  /** Source article to create post from */
  articleId: ArticleId;

  /** Customer creating the post */
  customerId: CustomerId;

  /** Target subreddit (without r/ prefix) */
  subreddit: string;

  /** Post title */
  title: string;

  /** Post body content */
  body: string;

  /** Optional link URL */
  linkUrl?: string;

  /** Selected flair */
  flair?: string;

  /** UTM campaign to associate with */
  utmCampaignId?: UtmCampaignId;

  /** Custom UTM parameters */
  utmParams?: Partial<UtmParams>;

  /** Scheduled posting time (ISO 8601) */
  scheduledFor?: ISOTimestamp;

  /** Whether to auto-approve (skip pending_approval) */
  autoApprove?: boolean;

  /** Agent session ID if created by agent */
  agentSessionId?: AgentSessionId;
}

/**
 * Input for updating an existing Reddit post.
 * Only certain fields can be updated based on status.
 */
export interface UpdateRedditPostInput {
  /** Update title (only before posting) */
  title?: string;

  /** Update body (only before posting) */
  body?: string;

  /** Update target subreddit (only before queuing) */
  subreddit?: string;

  /** Update flair selection */
  flair?: string;

  /** Update scheduled time (only before posting) */
  scheduledFor?: ISOTimestamp;

  /** Update UTM parameters */
  utmParams?: Partial<UtmParams>;
}

// =============================================================================
// SUMMARY GENERATION TYPES
// =============================================================================

/**
 * Tone options for Reddit summary generation.
 */
export type RedditSummaryTone = 'casual' | 'informative' | 'engaging' | 'professional';

/**
 * Request to generate a Reddit-appropriate summary from an article.
 * Triggers the Claude agent for AI-powered summary generation.
 */
export interface RedditSummaryRequest {
  /** Article to summarize */
  articleId: ArticleId;

  /** Customer context for brand voice */
  customerId: CustomerId;

  /** Target subreddit for context-aware generation */
  targetSubreddit: string;

  /** Additional context or instructions */
  additionalInstructions?: string;

  /** Target word count range (default: 200-400) */
  targetWordCount?: {
    min: number;
    max: number;
  };

  /** Tone preference */
  tone?: RedditSummaryTone;

  /** Whether to include a call-to-action */
  includeCta?: boolean;

  /** Specific aspects to highlight */
  focusPoints?: string[];

  /** User requesting the summary */
  requestedBy: UserRef;
}

/**
 * Response from summary generation.
 */
export interface RedditSummaryResponse {
  /** Whether generation succeeded */
  success: boolean;

  /** Generated title options (usually 2-3) */
  titleOptions: string[];

  /** Generated body content */
  body: string;

  /** Word count of generated body */
  wordCount: number;

  /** Suggested subreddits based on content */
  suggestedSubreddits?: string[];

  /** Confidence score (0-1) */
  confidence: number;

  /** Tokens used in generation */
  tokensUsed: number;

  /** Generation latency in milliseconds */
  latencyMs: number;

  /** Model used for generation */
  model: string;

  /** Error message if failed */
  error?: string;
}

// =============================================================================
// POST LIFECYCLE TYPES
// =============================================================================

/**
 * Post approval input.
 */
export interface ApprovePostInput {
  /** Post to approve */
  postId: RedditPostId;

  /** User approving the post */
  approvedBy: UserRef;

  /** Optional edits to apply during approval */
  edits?: {
    title?: string;
    body?: string;
    subreddit?: string;
    flair?: string;
  };

  /** Whether to immediately queue after approval */
  autoQueue?: boolean;

  /** Scheduled time if auto-queuing */
  scheduledFor?: ISOTimestamp;
}

/**
 * Post queue input.
 */
export interface QueuePostInput {
  /** Post to queue */
  postId: RedditPostId;

  /** Scheduled posting time */
  scheduledFor: ISOTimestamp;

  /** Priority in queue (higher = sooner if same time) */
  priority?: number;
}

/**
 * Post submission result.
 */
export interface SubmitPostResult {
  /** Whether submission succeeded */
  success: boolean;

  /** Reddit external ID if successful */
  redditExternalId?: RedditExternalId;

  /** Permalink if successful */
  permalink?: string;

  /** Full URL if successful */
  fullUrl?: string;

  /** Error message if failed */
  error?: string;

  /** Error code from Reddit API */
  redditErrorCode?: string;

  /** Whether the error is retryable */
  retryable?: boolean;

  /** Suggested retry delay in milliseconds */
  retryAfterMs?: number;
}

// =============================================================================
// ENGAGEMENT UPDATE TYPES
// =============================================================================

/**
 * Request to refresh engagement metrics for a post.
 */
export interface RefreshEngagementInput {
  /** Post ID to refresh */
  postId: RedditPostId;

  /** Force refresh even if recently updated */
  force?: boolean;
}

/**
 * Bulk engagement refresh request.
 */
export interface BulkRefreshEngagementInput {
  /** Post IDs to refresh */
  postIds: RedditPostId[];

  /** Only refresh posts older than this many minutes */
  minAgeMinutes?: number;
}

/**
 * Engagement refresh result.
 */
export interface EngagementRefreshResult {
  /** Post ID */
  postId: RedditPostId;

  /** Whether refresh succeeded */
  success: boolean;

  /** Previous engagement values */
  previousEngagement?: RedditEngagement;

  /** New engagement values */
  newEngagement?: RedditEngagement;

  /** Error if failed */
  error?: string;
}

// =============================================================================
// SUBREDDIT TRACKING TYPES
// =============================================================================

/**
 * Input for tracking a new subreddit.
 */
export interface TrackSubredditInput {
  /** Subreddit name (without r/ prefix) */
  subredditName: string;

  /** Customer tracking this subreddit */
  customerId: CustomerId;

  /** Topics/categories for this subreddit */
  topics?: string[];

  /** Whether to sync rules immediately */
  syncRulesNow?: boolean;
}

/**
 * Subreddit sync result.
 */
export interface SubredditSyncResult {
  /** Subreddit ID */
  subredditId: SubredditId;

  /** Whether sync succeeded */
  success: boolean;

  /** Number of rules synced */
  rulesSynced: number;

  /** Last sync timestamp */
  lastSyncedAt: ISOTimestamp;

  /** Error if failed */
  error?: string;
}

// =============================================================================
// RATE LIMIT TYPES
// =============================================================================

/**
 * Rate limit status for a customer's Reddit account.
 */
export interface RedditRateLimitStatus {
  /** Customer ID */
  customerId: CustomerId;

  /** Posts remaining this hour */
  postsRemaining: number;

  /** Comments remaining this hour */
  commentsRemaining: number;

  /** When rate limits reset */
  resetsAt: ISOTimestamp;

  /** Whether currently rate limited */
  isLimited: boolean;

  /** Estimated wait time if limited (seconds) */
  waitSeconds?: number;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Reddit Distribution domain service interface.
 * All methods are async and return Promises.
 * Handles post lifecycle, OAuth management, and engagement tracking.
 */
export interface IRedditDistributionService {
  // ─────────────────────────────────────────────────────────────────────────
  // Summary Generation (AI-Powered)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate a Reddit-appropriate summary from an article using Claude.
   * Returns title options and body content optimized for the target subreddit.
   *
   * @param request - Summary generation request with article and subreddit context
   * @returns Generated summary with title options and body
   */
  generateSummary(request: RedditSummaryRequest): Promise<RedditSummaryResponse>;

  // ─────────────────────────────────────────────────────────────────────────
  // Post Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new Reddit post record.
   * Post starts in pending_approval status unless autoApprove is true.
   *
   * @param input - Post creation input
   * @returns The created post
   */
  createPost(input: CreateRedditPostInput): Promise<RedditPost>;

  /**
   * Get a post by its internal ID.
   *
   * @param postId - Internal post identifier
   * @returns The post or null if not found
   */
  getPostById(postId: RedditPostId): Promise<RedditPost | null>;

  /**
   * Update a post (only allowed before posting).
   *
   * @param postId - Post to update
   * @param input - Fields to update
   * @returns Updated post
   * @throws Error if post is already posted
   */
  updatePost(postId: RedditPostId, input: UpdateRedditPostInput): Promise<RedditPost>;

  /**
   * Delete a post (soft delete - marks as deleted status).
   *
   * @param postId - Post to delete
   * @returns Success indicator
   */
  deletePost(postId: RedditPostId): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────────────────
  // Post Lifecycle Transitions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Approve a post for distribution.
   * Transitions from pending_approval to approved.
   * Optionally auto-queues with a scheduled time.
   *
   * @param input - Approval input with optional edits
   * @returns Approved post
   * @throws Error if post is not in pending_approval status
   */
  approvePost(input: ApprovePostInput): Promise<RedditPost>;

  /**
   * Reject a post (marks as deleted with reason).
   *
   * @param postId - Post to reject
   * @param reason - Rejection reason
   * @param rejectedBy - User rejecting
   * @returns Rejected post
   */
  rejectPost(
    postId: RedditPostId,
    reason: string,
    rejectedBy: UserRef
  ): Promise<RedditPost>;

  /**
   * Queue a post for scheduled posting.
   * Transitions from approved to queued.
   *
   * @param input - Queue input with scheduled time
   * @returns Queued post
   * @throws Error if post is not approved
   */
  queuePost(input: QueuePostInput): Promise<RedditPost>;

  /**
   * Submit a post to Reddit immediately.
   * Transitions through posting to posted (or failed).
   *
   * @param postId - Post to submit
   * @returns Submission result
   * @throws Error if post is not queued or approved
   */
  submitPost(postId: RedditPostId): Promise<SubmitPostResult>;

  /**
   * Retry a failed post.
   * Resets status and increments attempt counter.
   *
   * @param postId - Post to retry
   * @returns Updated post ready for retry
   * @throws Error if max retries exceeded
   */
  retryPost(postId: RedditPostId): Promise<RedditPost>;

  // ─────────────────────────────────────────────────────────────────────────
  // Engagement Tracking
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Refresh engagement metrics for a single post.
   *
   * @param input - Refresh request
   * @returns Refresh result with old and new metrics
   */
  refreshEngagement(input: RefreshEngagementInput): Promise<EngagementRefreshResult>;

  /**
   * Refresh engagement metrics for multiple posts.
   * Respects Reddit API rate limits.
   *
   * @param input - Bulk refresh request
   * @returns Array of refresh results
   */
  bulkRefreshEngagement(input: BulkRefreshEngagementInput): Promise<EngagementRefreshResult[]>;

  // ─────────────────────────────────────────────────────────────────────────
  // Query Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all posts for an article.
   *
   * @param articleId - Article to query
   * @param pagination - Pagination options
   * @returns Paginated posts
   */
  getPostsByArticle(
    articleId: ArticleId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<RedditPost>>;

  /**
   * Get all posts for a customer.
   *
   * @param customerId - Customer to query
   * @param pagination - Pagination options
   * @returns Paginated posts
   */
  getPostsByCustomer(
    customerId: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<RedditPost>>;

  /**
   * Get posts by status.
   *
   * @param status - Status to filter by
   * @param customerId - Optional customer filter
   * @param pagination - Pagination options
   * @returns Paginated posts
   */
  getPostsByStatus(
    status: RedditPostStatus,
    customerId?: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<RedditPost>>;

  /**
   * Get posts scheduled within a time range.
   *
   * @param startTime - Range start
   * @param endTime - Range end
   * @param customerId - Optional customer filter
   * @returns Posts scheduled in range
   */
  getScheduledPosts(
    startTime: ISOTimestamp,
    endTime: ISOTimestamp,
    customerId?: CustomerId
  ): Promise<RedditPost[]>;

  /**
   * Search posts with filters.
   *
   * @param params - Search parameters
   * @returns Paginated search results
   */
  searchPosts(params: SearchParams): Promise<PaginatedResponse<RedditPost>>;

  // ─────────────────────────────────────────────────────────────────────────
  // OAuth Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get OAuth authorization URL for Reddit connection.
   *
   * @param customerId - Customer initiating connection
   * @param redirectUri - Callback URI after authorization
   * @returns OAuth authorization URL to redirect user to
   */
  getOAuthAuthorizationUrl(
    customerId: CustomerId,
    redirectUri: string
  ): Promise<{ url: string; state: string }>;

  /**
   * Complete OAuth connection with authorization code.
   * Exchanges code for tokens and stores them.
   *
   * @param input - OAuth connection input
   * @returns Connected OAuth token info
   */
  connectOAuth(input: RedditOAuthConnectInput): Promise<RedditOAuthToken>;

  /**
   * Refresh OAuth token for a customer.
   * Automatically handles token expiration.
   *
   * @param input - Refresh input
   * @returns Refreshed token
   */
  refreshOAuthToken(input: RedditOAuthRefreshInput): Promise<RedditOAuthToken>;

  /**
   * Revoke OAuth connection for a customer.
   * Invalidates all tokens and disconnects from Reddit.
   *
   * @param customerId - Customer to disconnect
   * @returns Success indicator
   */
  revokeOAuth(customerId: CustomerId): Promise<boolean>;

  /**
   * Get OAuth status for a customer.
   *
   * @param customerId - Customer to check
   * @returns OAuth token if connected, null otherwise
   */
  getOAuthStatus(customerId: CustomerId): Promise<RedditOAuthToken | null>;

  /**
   * Check if OAuth token needs refresh.
   *
   * @param customerId - Customer to check
   * @returns Whether token needs refresh
   */
  needsTokenRefresh(customerId: CustomerId): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────────────────
  // Subreddit Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Track a new subreddit for a customer.
   *
   * @param input - Track subreddit input
   * @returns Tracked subreddit
   */
  trackSubreddit(input: TrackSubredditInput): Promise<Subreddit>;

  /**
   * Untrack a subreddit.
   *
   * @param subredditId - Subreddit to untrack
   * @param customerId - Customer untracking
   * @returns Success indicator
   */
  untrackSubreddit(subredditId: SubredditId, customerId: CustomerId): Promise<boolean>;

  /**
   * Get all tracked subreddits for a customer.
   *
   * @param customerId - Customer to query
   * @returns Array of tracked subreddits
   */
  getTrackedSubreddits(customerId: CustomerId): Promise<Subreddit[]>;

  /**
   * Get subreddit by name.
   *
   * @param name - Subreddit name (without r/ prefix)
   * @returns Subreddit or null
   */
  getSubredditByName(name: string): Promise<Subreddit | null>;

  /**
   * Sync subreddit rules and info from Reddit.
   *
   * @param subredditId - Subreddit to sync
   * @returns Sync result
   */
  syncSubredditRules(subredditId: SubredditId): Promise<SubredditSyncResult>;

  /**
   * Suggest subreddits based on article content.
   *
   * @param articleId - Article to analyze
   * @param customerId - Customer context
   * @param limit - Max suggestions (default: 5)
   * @returns Suggested subreddits ranked by relevance
   */
  suggestSubreddits(
    articleId: ArticleId,
    customerId: CustomerId,
    limit?: number
  ): Promise<Array<{ subreddit: Subreddit; relevanceScore: number }>>;

  // ─────────────────────────────────────────────────────────────────────────
  // Rate Limiting
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get current rate limit status for a customer.
   *
   * @param customerId - Customer to check
   * @returns Rate limit status
   */
  getRateLimitStatus(customerId: CustomerId): Promise<RedditRateLimitStatus>;

  /**
   * Check if posting is allowed for a customer.
   *
   * @param customerId - Customer to check
   * @returns Whether posting is currently allowed
   */
  canPost(customerId: CustomerId): Promise<boolean>;
}

// =============================================================================
// AGENT INTERFACE
// =============================================================================

/**
 * Operation types for Reddit Poster Agent invocation.
 */
export type RedditPosterAgentOperation =
  | 'generate_summary'
  | 'suggest_subreddits'
  | 'optimize_title'
  | 'validate_content';

/**
 * Input context for Reddit Poster Agent invocation.
 */
export interface RedditPosterAgentInput {
  /** Customer context */
  customerId: CustomerId;

  /** User making the request */
  userId: UserId;

  /** User's role for authorization */
  role: string;

  /** Type of operation requested */
  operation: RedditPosterAgentOperation;

  /** Article reference for content generation */
  articleRef?: ArticleRef;

  /** Full article content for generation */
  articleContent?: {
    title: string;
    body: string;
    publishedUrl?: string;
  };

  /** Target subreddit for context-aware generation */
  targetSubreddit?: string;

  /** Subreddit rules for compliance checking */
  subredditRules?: SubredditRule[];

  /** Brand guidelines for tone consistency */
  brandGuidelines?: {
    tone: string;
    keywords: string[];
    avoidWords: string[];
  };

  /** Additional context */
  data?: {
    existingTitle?: string;
    existingBody?: string;
    focusPoints?: string[];
    targetWordCount?: { min: number; max: number };
    includeCta?: boolean;
  };
}

/**
 * Validation issue from content validation.
 */
export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
}

/**
 * Validation result from content validation.
 */
export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  suggestions: string[];
}

/**
 * Suggested subreddit from agent analysis.
 */
export interface SuggestedSubreddit {
  name: string;
  relevanceScore: number;
  reasoning: string;
}

/**
 * Operation metadata from agent invocation.
 */
export interface AgentOperationMetadata {
  tokensUsed: number;
  latencyMs: number;
  model: string;
}

/**
 * Output from Reddit Poster Agent invocation.
 */
export interface RedditPosterAgentOutput {
  /** Whether the operation succeeded */
  success: boolean;

  /** Generated title options (for generate_summary, optimize_title) */
  titleOptions?: string[];

  /** Generated body content (for generate_summary) */
  body?: string;

  /** Word count of generated content */
  wordCount?: number;

  /** Suggested subreddits with relevance scores (for suggest_subreddits) */
  suggestedSubreddits?: SuggestedSubreddit[];

  /** Validation results (for validate_content) */
  validation?: ValidationResult;

  /** Confidence score (0-1) */
  confidence?: number;

  /** Error message if failed */
  error?: string;

  /** Operation metadata */
  metadata?: AgentOperationMetadata;
}

/**
 * Tool definition for agent capabilities.
 */
export interface AgentToolDefinition {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Input schema (JSON Schema format) */
  inputSchema: Record<string, unknown>;
}

/**
 * Reddit Poster Agent interface.
 * AI-powered agent for generating Reddit content and suggestions.
 */
export interface IRedditPosterAgent {
  /**
   * Invoke the Reddit poster agent with given context.
   * Routes to appropriate sub-operation based on input.
   *
   * @param input - Agent input context
   * @returns Agent output with generated content or suggestions
   */
  invoke(input: RedditPosterAgentInput): Promise<RedditPosterAgentOutput>;

  /**
   * Get the agent's system prompt.
   * Used for testing and debugging.
   */
  readonly systemPrompt: string;

  /**
   * Get available tools for this agent.
   */
  readonly tools: AgentToolDefinition[];
}

// =============================================================================
// REPOSITORY INTERFACES
// =============================================================================

/**
 * Repository interface for RedditPost persistence.
 * Extends base repository pattern with reddit-specific queries.
 */
export interface IRedditPostRepository {
  // ─────────────────────────────────────────────────────────────────────────
  // CRUD Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new Reddit post.
   *
   * @param input - Post creation input
   * @returns Created post with generated ID
   */
  create(input: CreateRedditPostInput): Promise<RedditPost>;

  /**
   * Find a post by internal ID.
   *
   * @param id - Post identifier
   * @returns Post or null
   */
  findById(id: RedditPostId): Promise<RedditPost | null>;

  /**
   * Find a post by Reddit external ID.
   *
   * @param externalId - Reddit's post ID (t3_xxxxx)
   * @returns Post or null
   */
  findByExternalId(externalId: RedditExternalId): Promise<RedditPost | null>;

  /**
   * Update a post.
   *
   * @param id - Post to update
   * @param input - Fields to update
   * @returns Updated post
   */
  update(id: RedditPostId, input: Partial<RedditPost>): Promise<RedditPost>;

  /**
   * Delete a post (soft delete).
   *
   * @param id - Post to delete
   * @returns Success indicator
   */
  delete(id: RedditPostId): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────────────────
  // Query Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Find all posts for an article.
   *
   * @param articleId - Article to query
   * @param options - Query options
   * @returns Array of posts
   */
  findByArticle(
    articleId: ArticleId,
    options?: {
      status?: RedditPostStatus | RedditPostStatus[];
      limit?: number;
      offset?: number;
    }
  ): Promise<RedditPost[]>;

  /**
   * Find all posts for a customer.
   *
   * @param customerId - Customer to query
   * @param options - Query options
   * @returns Array of posts
   */
  findByCustomer(
    customerId: CustomerId,
    options?: {
      status?: RedditPostStatus | RedditPostStatus[];
      subreddit?: string;
      fromDate?: ISOTimestamp;
      toDate?: ISOTimestamp;
      limit?: number;
      offset?: number;
    }
  ): Promise<RedditPost[]>;

  /**
   * Find posts by status.
   *
   * @param status - Status to filter
   * @param options - Query options
   * @returns Array of posts
   */
  findByStatus(
    status: RedditPostStatus,
    options?: {
      customerId?: CustomerId;
      limit?: number;
      offset?: number;
    }
  ): Promise<RedditPost[]>;

  /**
   * Find posts scheduled within a time range.
   *
   * @param startTime - Range start
   * @param endTime - Range end
   * @returns Array of posts
   */
  findScheduled(
    startTime: ISOTimestamp,
    endTime: ISOTimestamp
  ): Promise<RedditPost[]>;

  /**
   * Find posts needing engagement refresh.
   *
   * @param olderThanMinutes - Minimum age since last refresh
   * @param limit - Maximum posts to return
   * @returns Array of posts
   */
  findNeedingEngagementRefresh(
    olderThanMinutes: number,
    limit: number
  ): Promise<RedditPost[]>;

  /**
   * Count posts by status for a customer.
   *
   * @param customerId - Customer to query
   * @returns Counts by status
   */
  countByStatus(customerId: CustomerId): Promise<Record<RedditPostStatus, number>>;

  // ─────────────────────────────────────────────────────────────────────────
  // Aggregate Queries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get engagement statistics for a customer.
   *
   * @param customerId - Customer to query
   * @param fromDate - Stats start date
   * @returns Aggregate stats
   */
  getEngagementStats(
    customerId: CustomerId,
    fromDate: ISOTimestamp
  ): Promise<{
    totalPosts: number;
    totalUpvotes: number;
    totalComments: number;
    averageScore: number;
    averageRatio: number;
    byEngagementLevel: Record<EngagementLevel, number>;
    bySubreddit: Array<{
      subreddit: string;
      posts: number;
      totalScore: number;
      avgScore: number;
    }>;
  }>;

  /**
   * Get posting activity for a time period.
   *
   * @param customerId - Customer to query
   * @param fromDate - Period start
   * @param toDate - Period end
   * @returns Daily activity counts
   */
  getPostingActivity(
    customerId: CustomerId,
    fromDate: ISOTimestamp,
    toDate: ISOTimestamp
  ): Promise<Array<{
    date: string;
    posted: number;
    failed: number;
    engagement: number;
  }>>;
}

/**
 * Repository interface for Subreddit persistence.
 */
export interface ISubredditRepository {
  /**
   * Create or update a subreddit.
   *
   * @param subreddit - Subreddit data
   * @returns Created/updated subreddit
   */
  upsert(subreddit: Omit<Subreddit, 'id' | 'audit'>): Promise<Subreddit>;

  /**
   * Find a subreddit by internal ID.
   *
   * @param id - Subreddit identifier
   * @returns Subreddit or null
   */
  findById(id: SubredditId): Promise<Subreddit | null>;

  /**
   * Find a subreddit by name.
   *
   * @param name - Subreddit name (without r/ prefix)
   * @returns Subreddit or null
   */
  findByName(name: string): Promise<Subreddit | null>;

  /**
   * Find tracked subreddits for a customer.
   *
   * @param customerId - Customer to query
   * @returns Array of tracked subreddits
   */
  findTrackedByCustomer(customerId: CustomerId): Promise<Subreddit[]>;

  /**
   * Find subreddits by topics.
   *
   * @param topics - Topics to match
   * @param limit - Maximum results
   * @returns Array of matching subreddits
   */
  findByTopics(topics: string[], limit?: number): Promise<Subreddit[]>;

  /**
   * Update tracking status.
   *
   * @param id - Subreddit ID
   * @param customerId - Customer ID
   * @param isTracked - New tracking status
   * @returns Updated subreddit
   */
  updateTracking(
    id: SubredditId,
    customerId: CustomerId,
    isTracked: boolean
  ): Promise<Subreddit>;

  /**
   * Find subreddits needing sync.
   *
   * @param olderThanHours - Minimum hours since last sync
   * @param limit - Maximum results
   * @returns Array of subreddits needing sync
   */
  findNeedingSync(olderThanHours: number, limit: number): Promise<Subreddit[]>;
}

/**
 * Repository interface for RedditOAuthToken persistence.
 */
export interface IRedditOAuthRepository {
  /**
   * Store OAuth tokens for a customer.
   *
   * @param token - Token data to store
   * @returns Stored token
   */
  store(token: Omit<RedditOAuthToken, 'audit'>): Promise<RedditOAuthToken>;

  /**
   * Find OAuth token for a customer.
   *
   * @param customerId - Customer to query
   * @returns Token or null
   */
  findByCustomer(customerId: CustomerId): Promise<RedditOAuthToken | null>;

  /**
   * Update OAuth token.
   *
   * @param customerId - Customer whose token to update
   * @param updates - Fields to update
   * @returns Updated token
   */
  update(
    customerId: CustomerId,
    updates: Partial<RedditOAuthToken>
  ): Promise<RedditOAuthToken>;

  /**
   * Delete OAuth token (revoke).
   *
   * @param customerId - Customer whose token to delete
   * @returns Success indicator
   */
  delete(customerId: CustomerId): Promise<boolean>;

  /**
   * Find tokens expiring soon.
   *
   * @param withinMs - Expiration window in milliseconds
   * @returns Array of expiring tokens
   */
  findExpiringSoon(withinMs: number): Promise<RedditOAuthToken[]>;

  /**
   * Find tokens with refresh failures.
   *
   * @param minFailures - Minimum failure count
   * @returns Array of failed tokens
   */
  findWithRefreshFailures(minFailures: number): Promise<RedditOAuthToken[]>;
}

// =============================================================================
// API ROUTE TYPES
// =============================================================================

/**
 * POST /reddit/summary request body
 */
export interface GenerateSummaryRequest {
  articleId: ArticleId;
  targetSubreddit: string;
  additionalInstructions?: string;
  targetWordCount?: { min: number; max: number };
  tone?: RedditSummaryTone;
  includeCta?: boolean;
  focusPoints?: string[];
}

/**
 * POST /reddit/summary response
 */
export interface GenerateSummaryResponse {
  success: boolean;
  titleOptions: string[];
  body: string;
  wordCount: number;
  suggestedSubreddits?: string[];
  confidence: number;
  tokensUsed: number;
  latencyMs: number;
}

/**
 * POST /reddit/posts request body
 */
export interface CreatePostRequest {
  articleId: ArticleId;
  subreddit: string;
  title: string;
  body: string;
  linkUrl?: string;
  flair?: string;
  utmCampaignId?: UtmCampaignId;
  utmParams?: Partial<UtmParams>;
  scheduledFor?: ISOTimestamp;
  autoApprove?: boolean;
}

/**
 * PATCH /reddit/posts/:id request body
 */
export interface UpdatePostRequest {
  title?: string;
  body?: string;
  subreddit?: string;
  flair?: string;
  scheduledFor?: ISOTimestamp;
  utmParams?: Partial<UtmParams>;
}

/**
 * GET /reddit/posts query parameters
 */
export interface ListPostsQuery extends PaginationParams {
  customerId?: CustomerId;
  articleId?: ArticleId;
  subreddit?: string;
  status?: RedditPostStatus | RedditPostStatus[];
  fromDate?: ISOTimestamp;
  toDate?: ISOTimestamp;
  sortBy?: 'createdAt' | 'scheduledFor' | 'postedAt' | 'engagement.score';
  sortOrder?: 'asc' | 'desc';
}

/**
 * POST /reddit/posts/:id/approve request body
 */
export interface ApprovePostRequest {
  edits?: {
    title?: string;
    body?: string;
    subreddit?: string;
    flair?: string;
  };
  autoQueue?: boolean;
  scheduledFor?: ISOTimestamp;
}

/**
 * POST /reddit/posts/:id/reject request body
 */
export interface RejectPostRequest {
  reason: string;
}

/**
 * POST /reddit/posts/:id/queue request body
 */
export interface QueuePostRequest {
  scheduledFor: ISOTimestamp;
  priority?: number;
}

/**
 * POST /reddit/posts/:id/submit response
 */
export interface SubmitPostResponse {
  success: boolean;
  redditExternalId?: string;
  permalink?: string;
  fullUrl?: string;
  error?: string;
  retryable?: boolean;
  retryAfterMs?: number;
}

/**
 * POST /reddit/posts/:id/engagement/refresh request body
 */
export interface RefreshEngagementRequest {
  force?: boolean;
}

/**
 * POST /reddit/engagement/bulk-refresh request body
 */
export interface BulkRefreshEngagementRequest {
  postIds: RedditPostId[];
  minAgeMinutes?: number;
}

/**
 * POST /reddit/engagement/bulk-refresh response
 */
export interface BulkRefreshEngagementResponse {
  results: EngagementRefreshResult[];
  successCount: number;
  failureCount: number;
}

/**
 * GET /reddit/engagement/stats response
 */
export interface EngagementStatsResponse {
  totalPosts: number;
  totalUpvotes: number;
  totalComments: number;
  averageScore: number;
  averageRatio: number;
  byEngagementLevel: Record<EngagementLevel, number>;
  bySubreddit: Array<{
    subreddit: string;
    posts: number;
    totalScore: number;
    avgScore: number;
  }>;
}

/**
 * GET /reddit/oauth/authorize response
 */
export interface OAuthAuthorizeResponse {
  url: string;
  state: string;
}

/**
 * POST /reddit/oauth/callback request body
 */
export interface OAuthCallbackRequest {
  authorizationCode: string;
  redirectUri: string;
  state: string;
}

/**
 * POST /reddit/oauth/callback response
 */
export interface OAuthCallbackResponse {
  connected: boolean;
  redditUsername: string;
  scope: string[];
  expiresAt: ISOTimestamp;
}

/**
 * GET /reddit/oauth/status response
 */
export interface OAuthStatusResponse {
  connected: boolean;
  redditUsername: string | null;
  scope: string[] | null;
  expiresAt: ISOTimestamp | null;
  isValid: boolean;
  needsRefresh: boolean;
}

/**
 * POST /reddit/subreddits/track request body
 */
export interface TrackSubredditRequest {
  subredditName: string;
  topics?: string[];
  syncRulesNow?: boolean;
}

/**
 * POST /reddit/subreddits/suggest request body
 */
export interface SuggestSubredditsRequest {
  articleId: ArticleId;
  limit?: number;
}

/**
 * POST /reddit/subreddits/suggest response
 */
export interface SuggestSubredditsResponse {
  suggestions: Array<{
    subreddit: Subreddit;
    relevanceScore: number;
    reasoning: string;
  }>;
}

/**
 * GET /reddit/rate-limit response
 */
export interface RateLimitStatusResponse {
  postsRemaining: number;
  commentsRemaining: number;
  resetsAt: ISOTimestamp;
  isLimited: boolean;
  waitSeconds: number | null;
}

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Reddit Distribution domain-specific error codes.
 * All codes are prefixed with REDDIT_ for namespacing.
 */
export const RedditDistributionErrorCodes = {
  // API Errors
  /** Reddit API returned an error response */
  REDDIT_API_ERROR: 'REDDIT_API_ERROR',
  /** Reddit API rate limit exceeded */
  REDDIT_RATE_LIMITED: 'REDDIT_RATE_LIMITED',
  /** Reddit API timeout */
  REDDIT_TIMEOUT: 'REDDIT_TIMEOUT',
  /** Reddit API returned unexpected response */
  REDDIT_INVALID_RESPONSE: 'REDDIT_INVALID_RESPONSE',

  // OAuth Errors
  /** OAuth token has expired */
  REDDIT_AUTH_EXPIRED: 'REDDIT_AUTH_EXPIRED',
  /** OAuth token refresh failed */
  REDDIT_AUTH_REFRESH_FAILED: 'REDDIT_AUTH_REFRESH_FAILED',
  /** OAuth not connected for customer */
  REDDIT_NOT_CONNECTED: 'REDDIT_NOT_CONNECTED',
  /** OAuth already connected for customer */
  REDDIT_ALREADY_CONNECTED: 'REDDIT_ALREADY_CONNECTED',
  /** Invalid OAuth state parameter (CSRF) */
  REDDIT_INVALID_STATE: 'REDDIT_INVALID_STATE',
  /** OAuth authorization code invalid or expired */
  REDDIT_INVALID_AUTH_CODE: 'REDDIT_INVALID_AUTH_CODE',
  /** Insufficient OAuth scope for operation */
  REDDIT_INSUFFICIENT_SCOPE: 'REDDIT_INSUFFICIENT_SCOPE',

  // Post Errors
  /** Post not found */
  REDDIT_POST_NOT_FOUND: 'REDDIT_POST_NOT_FOUND',
  /** Invalid status transition attempted */
  REDDIT_INVALID_STATUS_TRANSITION: 'REDDIT_INVALID_STATUS_TRANSITION',
  /** Post already exists for article/subreddit */
  REDDIT_DUPLICATE_POST: 'REDDIT_DUPLICATE_POST',
  /** Maximum retry attempts exceeded */
  REDDIT_MAX_RETRIES_EXCEEDED: 'REDDIT_MAX_RETRIES_EXCEEDED',
  /** Cannot modify posted content */
  REDDIT_CANNOT_MODIFY_POSTED: 'REDDIT_CANNOT_MODIFY_POSTED',
  /** Post was removed by Reddit */
  REDDIT_POST_REMOVED: 'REDDIT_POST_REMOVED',
  /** Post was shadowbanned */
  REDDIT_POST_SHADOWBANNED: 'REDDIT_POST_SHADOWBANNED',

  // Subreddit Errors
  /** Subreddit not found */
  REDDIT_SUBREDDIT_NOT_FOUND: 'REDDIT_SUBREDDIT_NOT_FOUND',
  /** Subreddit is private */
  REDDIT_SUBREDDIT_PRIVATE: 'REDDIT_SUBREDDIT_PRIVATE',
  /** Subreddit is quarantined */
  REDDIT_SUBREDDIT_QUARANTINED: 'REDDIT_SUBREDDIT_QUARANTINED',
  /** Subreddit does not allow posts */
  REDDIT_SUBREDDIT_RESTRICTED: 'REDDIT_SUBREDDIT_RESTRICTED',
  /** Already tracking this subreddit */
  REDDIT_SUBREDDIT_ALREADY_TRACKED: 'REDDIT_SUBREDDIT_ALREADY_TRACKED',
  /** User banned from subreddit */
  REDDIT_BANNED_FROM_SUBREDDIT: 'REDDIT_BANNED_FROM_SUBREDDIT',

  // Content Errors
  /** Title too long (>300 chars) */
  REDDIT_TITLE_TOO_LONG: 'REDDIT_TITLE_TOO_LONG',
  /** Body too long (>40000 chars) */
  REDDIT_BODY_TOO_LONG: 'REDDIT_BODY_TOO_LONG',
  /** Content violates subreddit rules */
  REDDIT_RULE_VIOLATION: 'REDDIT_RULE_VIOLATION',
  /** Flair required but not provided */
  REDDIT_FLAIR_REQUIRED: 'REDDIT_FLAIR_REQUIRED',
  /** Invalid flair selection */
  REDDIT_INVALID_FLAIR: 'REDDIT_INVALID_FLAIR',
  /** Link domain is blacklisted */
  REDDIT_BLACKLISTED_DOMAIN: 'REDDIT_BLACKLISTED_DOMAIN',

  // Generation Errors
  /** Summary generation failed */
  REDDIT_GENERATION_FAILED: 'REDDIT_GENERATION_FAILED',
  /** Article content not found or empty */
  REDDIT_ARTICLE_NOT_FOUND: 'REDDIT_ARTICLE_NOT_FOUND',
  /** Agent invocation failed */
  REDDIT_AGENT_ERROR: 'REDDIT_AGENT_ERROR',

  // Scheduling Errors
  /** Scheduled time is in the past */
  REDDIT_SCHEDULE_IN_PAST: 'REDDIT_SCHEDULE_IN_PAST',
  /** Schedule conflict with existing post */
  REDDIT_SCHEDULE_CONFLICT: 'REDDIT_SCHEDULE_CONFLICT',

  // Account Errors
  /** Reddit account suspended */
  REDDIT_ACCOUNT_SUSPENDED: 'REDDIT_ACCOUNT_SUSPENDED',
  /** Reddit account too new */
  REDDIT_ACCOUNT_TOO_NEW: 'REDDIT_ACCOUNT_TOO_NEW',
  /** Insufficient karma */
  REDDIT_INSUFFICIENT_KARMA: 'REDDIT_INSUFFICIENT_KARMA'
} as const;

/**
 * Type for error codes
 */
export type RedditDistributionErrorCode = typeof RedditDistributionErrorCodes[keyof typeof RedditDistributionErrorCodes];

/**
 * Error metadata structure
 */
export interface RedditErrorMetadataEntry {
  httpStatus: number;
  retryable: boolean;
  userMessage: string;
}

/**
 * Error metadata by code
 */
export const RedditErrorMetadata: Record<RedditDistributionErrorCode, RedditErrorMetadataEntry> = {
  [RedditDistributionErrorCodes.REDDIT_API_ERROR]: {
    httpStatus: 502,
    retryable: true,
    userMessage: 'Reddit API is temporarily unavailable. Please try again.'
  },
  [RedditDistributionErrorCodes.REDDIT_RATE_LIMITED]: {
    httpStatus: 429,
    retryable: true,
    userMessage: 'Reddit rate limit reached. Please wait before trying again.'
  },
  [RedditDistributionErrorCodes.REDDIT_TIMEOUT]: {
    httpStatus: 504,
    retryable: true,
    userMessage: 'Reddit API request timed out. Please try again.'
  },
  [RedditDistributionErrorCodes.REDDIT_INVALID_RESPONSE]: {
    httpStatus: 502,
    retryable: true,
    userMessage: 'Received unexpected response from Reddit. Please try again.'
  },
  [RedditDistributionErrorCodes.REDDIT_AUTH_EXPIRED]: {
    httpStatus: 401,
    retryable: false,
    userMessage: 'Your Reddit connection has expired. Please reconnect.'
  },
  [RedditDistributionErrorCodes.REDDIT_AUTH_REFRESH_FAILED]: {
    httpStatus: 401,
    retryable: false,
    userMessage: 'Failed to refresh Reddit authentication. Please reconnect.'
  },
  [RedditDistributionErrorCodes.REDDIT_NOT_CONNECTED]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'Reddit account not connected. Please connect your account first.'
  },
  [RedditDistributionErrorCodes.REDDIT_ALREADY_CONNECTED]: {
    httpStatus: 409,
    retryable: false,
    userMessage: 'A Reddit account is already connected.'
  },
  [RedditDistributionErrorCodes.REDDIT_INVALID_STATE]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'Invalid OAuth state. Please start the connection process again.'
  },
  [RedditDistributionErrorCodes.REDDIT_INVALID_AUTH_CODE]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'Authorization code is invalid or expired. Please try again.'
  },
  [RedditDistributionErrorCodes.REDDIT_INSUFFICIENT_SCOPE]: {
    httpStatus: 403,
    retryable: false,
    userMessage: 'Insufficient Reddit permissions. Please reconnect with full permissions.'
  },
  [RedditDistributionErrorCodes.REDDIT_POST_NOT_FOUND]: {
    httpStatus: 404,
    retryable: false,
    userMessage: 'Post not found.'
  },
  [RedditDistributionErrorCodes.REDDIT_INVALID_STATUS_TRANSITION]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'Invalid operation for current post status.'
  },
  [RedditDistributionErrorCodes.REDDIT_DUPLICATE_POST]: {
    httpStatus: 409,
    retryable: false,
    userMessage: 'A post already exists for this article in this subreddit.'
  },
  [RedditDistributionErrorCodes.REDDIT_MAX_RETRIES_EXCEEDED]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'Maximum retry attempts exceeded. Please create a new post.'
  },
  [RedditDistributionErrorCodes.REDDIT_CANNOT_MODIFY_POSTED]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'Cannot modify a post that has already been submitted to Reddit.'
  },
  [RedditDistributionErrorCodes.REDDIT_POST_REMOVED]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'This post was removed by Reddit moderators.'
  },
  [RedditDistributionErrorCodes.REDDIT_POST_SHADOWBANNED]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'This post appears to be shadowbanned on Reddit.'
  },
  [RedditDistributionErrorCodes.REDDIT_SUBREDDIT_NOT_FOUND]: {
    httpStatus: 404,
    retryable: false,
    userMessage: 'Subreddit not found. Please check the name and try again.'
  },
  [RedditDistributionErrorCodes.REDDIT_SUBREDDIT_PRIVATE]: {
    httpStatus: 403,
    retryable: false,
    userMessage: 'This subreddit is private and cannot be accessed.'
  },
  [RedditDistributionErrorCodes.REDDIT_SUBREDDIT_QUARANTINED]: {
    httpStatus: 403,
    retryable: false,
    userMessage: 'This subreddit is quarantined and cannot be used.'
  },
  [RedditDistributionErrorCodes.REDDIT_SUBREDDIT_RESTRICTED]: {
    httpStatus: 403,
    retryable: false,
    userMessage: 'Posting is restricted in this subreddit.'
  },
  [RedditDistributionErrorCodes.REDDIT_SUBREDDIT_ALREADY_TRACKED]: {
    httpStatus: 409,
    retryable: false,
    userMessage: 'This subreddit is already being tracked.'
  },
  [RedditDistributionErrorCodes.REDDIT_BANNED_FROM_SUBREDDIT]: {
    httpStatus: 403,
    retryable: false,
    userMessage: 'Your Reddit account is banned from this subreddit.'
  },
  [RedditDistributionErrorCodes.REDDIT_TITLE_TOO_LONG]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'Post title exceeds the 300 character limit.'
  },
  [RedditDistributionErrorCodes.REDDIT_BODY_TOO_LONG]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'Post body exceeds the 40,000 character limit.'
  },
  [RedditDistributionErrorCodes.REDDIT_RULE_VIOLATION]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'Post content violates subreddit rules.'
  },
  [RedditDistributionErrorCodes.REDDIT_FLAIR_REQUIRED]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'This subreddit requires a flair selection.'
  },
  [RedditDistributionErrorCodes.REDDIT_INVALID_FLAIR]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'Invalid flair selection for this subreddit.'
  },
  [RedditDistributionErrorCodes.REDDIT_BLACKLISTED_DOMAIN]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'The link domain is not allowed in this subreddit.'
  },
  [RedditDistributionErrorCodes.REDDIT_GENERATION_FAILED]: {
    httpStatus: 500,
    retryable: true,
    userMessage: 'Failed to generate summary. Please try again.'
  },
  [RedditDistributionErrorCodes.REDDIT_ARTICLE_NOT_FOUND]: {
    httpStatus: 404,
    retryable: false,
    userMessage: 'Article not found or has no content.'
  },
  [RedditDistributionErrorCodes.REDDIT_AGENT_ERROR]: {
    httpStatus: 500,
    retryable: true,
    userMessage: 'AI processing error. Please try again.'
  },
  [RedditDistributionErrorCodes.REDDIT_SCHEDULE_IN_PAST]: {
    httpStatus: 400,
    retryable: false,
    userMessage: 'Scheduled time must be in the future.'
  },
  [RedditDistributionErrorCodes.REDDIT_SCHEDULE_CONFLICT]: {
    httpStatus: 409,
    retryable: false,
    userMessage: 'Another post is already scheduled for this time.'
  },
  [RedditDistributionErrorCodes.REDDIT_ACCOUNT_SUSPENDED]: {
    httpStatus: 403,
    retryable: false,
    userMessage: 'Your Reddit account has been suspended.'
  },
  [RedditDistributionErrorCodes.REDDIT_ACCOUNT_TOO_NEW]: {
    httpStatus: 403,
    retryable: false,
    userMessage: 'Your Reddit account is too new to post in this subreddit.'
  },
  [RedditDistributionErrorCodes.REDDIT_INSUFFICIENT_KARMA]: {
    httpStatus: 403,
    retryable: false,
    userMessage: 'Your Reddit account has insufficient karma to post in this subreddit.'
  }
};

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Events the Reddit Distribution domain publishes for other domains to consume.
 * Published via event bus to Analytics, Scheduling, and other interested domains.
 */
export interface RedditDistributionEvents {
  // Post Lifecycle Events

  /**
   * Emitted when a new post is created.
   * Subscribers: Analytics (tracking), Scheduling (awareness)
   */
  'reddit_post.created': {
    postId: RedditPostId;
    articleId: ArticleId;
    customerId: CustomerId;
    subreddit: string;
    status: RedditPostStatus;
    createdAt: ISOTimestamp;
  };

  /**
   * Emitted when a post is approved for distribution.
   * Subscribers: Scheduling (queue management)
   */
  'reddit_post.approved': {
    postId: RedditPostId;
    articleId: ArticleId;
    customerId: CustomerId;
    approvedBy: UserRef;
    approvedAt: ISOTimestamp;
    autoQueue: boolean;
    scheduledFor?: ISOTimestamp;
  };

  /**
   * Emitted when a post is queued for posting.
   * Subscribers: Scheduling (execution)
   */
  'reddit_post.queued': {
    postId: RedditPostId;
    customerId: CustomerId;
    subreddit: string;
    scheduledFor: ISOTimestamp;
    priority: number;
  };

  /**
   * Emitted when a post is successfully posted to Reddit.
   * Subscribers: Analytics (tracking), Scheduling (completion)
   */
  'reddit_post.posted': {
    postId: RedditPostId;
    articleId: ArticleId;
    customerId: CustomerId;
    subreddit: string;
    redditExternalId: RedditExternalId;
    permalink: string;
    fullUrl: string;
    postedAt: ISOTimestamp;
    utmParams?: UtmParams;
  };

  /**
   * Emitted when a post fails to submit.
   * Subscribers: Analytics (tracking), Alerts (notification)
   */
  'reddit_post.failed': {
    postId: RedditPostId;
    customerId: CustomerId;
    subreddit: string;
    errorCode: RedditDistributionErrorCode;
    errorMessage: string;
    attempt: number;
    maxRetries: number;
    retryable: boolean;
    failedAt: ISOTimestamp;
  };

  /**
   * Emitted when a post is removed by Reddit.
   * Subscribers: Analytics (tracking), Alerts (notification)
   */
  'reddit_post.removed': {
    postId: RedditPostId;
    redditExternalId: RedditExternalId;
    customerId: CustomerId;
    subreddit: string;
    reason?: string;
    removedAt: ISOTimestamp;
  };

  // Engagement Events

  /**
   * Emitted when post engagement metrics are updated.
   * Subscribers: Analytics (tracking)
   */
  'reddit_post.engagement_updated': {
    postId: RedditPostId;
    redditExternalId: RedditExternalId;
    customerId: CustomerId;
    subreddit: string;
    previousEngagement: RedditEngagement;
    newEngagement: RedditEngagement;
    engagementDelta: {
      upvotesDelta: number;
      commentsDelta: number;
      scoreDelta: number;
    };
    updatedAt: ISOTimestamp;
  };

  /**
   * Emitted when a post reaches a new engagement level.
   * Subscribers: Analytics (milestones), Alerts (notification)
   */
  'reddit_post.engagement_milestone': {
    postId: RedditPostId;
    customerId: CustomerId;
    subreddit: string;
    previousLevel: EngagementLevel;
    newLevel: EngagementLevel;
    currentScore: number;
    currentComments: number;
    reachedAt: ISOTimestamp;
  };

  // OAuth Events

  /**
   * Emitted when a customer connects Reddit OAuth.
   * Subscribers: User/Customer (profile update)
   */
  'reddit_oauth.connected': {
    customerId: CustomerId;
    redditUsername: string;
    scope: string[];
    connectedAt: ISOTimestamp;
  };

  /**
   * Emitted when Reddit OAuth is revoked.
   * Subscribers: User/Customer (profile update), Scheduling (pause posts)
   */
  'reddit_oauth.revoked': {
    customerId: CustomerId;
    redditUsername: string;
    revokedAt: ISOTimestamp;
    reason: 'user_initiated' | 'token_expired' | 'refresh_failed';
  };

  /**
   * Emitted when OAuth token refresh fails repeatedly.
   * Subscribers: Alerts (notification)
   */
  'reddit_oauth.refresh_failed': {
    customerId: CustomerId;
    failureCount: number;
    lastAttemptAt: ISOTimestamp;
    error: string;
  };

  // Rate Limit Events

  /**
   * Emitted when rate limit is approached or hit.
   * Subscribers: Scheduling (throttle), Alerts (notification)
   */
  'reddit_rate_limit.warning': {
    customerId: CustomerId;
    postsRemaining: number;
    resetsAt: ISOTimestamp;
    severity: 'warning' | 'critical';
  };
}

/**
 * Events the Reddit Distribution domain consumes from other domains.
 */
export interface ConsumedEvents {
  // From Article Domain

  /**
   * Triggers auto-generation of Reddit summary when article is approved.
   * If customer has auto-generate enabled, creates a pending post.
   */
  'article.approved': {
    articleId: ArticleId;
    customerId: CustomerId;
    title: string;
    publishedUrl?: string;
    approvedAt: ISOTimestamp;
    approvedBy: UserRef;
  };

  /**
   * Updates post references if article is published.
   * Allows updating UTM links with final published URL.
   */
  'article.published': {
    articleId: ArticleId;
    customerId: CustomerId;
    publishedUrl: string;
    publishedAt: ISOTimestamp;
  };

  /**
   * Handles article archival - may need to update post status.
   */
  'article.archived': {
    articleId: ArticleId;
    customerId: CustomerId;
    archivedAt: ISOTimestamp;
  };

  // From Scheduling Domain

  /**
   * Triggers post submission when scheduled time arrives.
   */
  'schedule.execute': {
    scheduleId: ScheduleId;
    entityType: 'reddit_post';
    entityId: RedditPostId;
    customerId: CustomerId;
    scheduledFor: ISOTimestamp;
    executeAt: ISOTimestamp;
  };

  /**
   * Handles schedule cancellation.
   */
  'schedule.cancelled': {
    scheduleId: ScheduleId;
    entityType: 'reddit_post';
    entityId: RedditPostId;
    reason: string;
    cancelledAt: ISOTimestamp;
  };

  // From User/Customer Domain

  /**
   * Handles customer settings changes that affect posting.
   */
  'customer.settings_updated': {
    customerId: CustomerId;
    settings: {
      autoGenerateRedditPosts?: boolean;
      defaultSubreddits?: string[];
      postingPreferences?: {
        preferredTone?: string;
        includeCta?: boolean;
      };
    };
    updatedAt: ISOTimestamp;
  };

  /**
   * Handles customer deactivation - pause all pending posts.
   */
  'customer.deactivated': {
    customerId: CustomerId;
    reason: string;
    deactivatedAt: ISOTimestamp;
  };
}

/**
 * Event handler interface for Reddit Distribution domain.
 */
export interface IRedditDistributionEventHandler {
  /**
   * Handle article approved event.
   * Auto-generates Reddit summary if customer has setting enabled.
   */
  handleArticleApproved(event: ConsumedEvents['article.approved']): Promise<void>;

  /**
   * Handle article published event.
   * Updates UTM links in pending posts with final URL.
   */
  handleArticlePublished(event: ConsumedEvents['article.published']): Promise<void>;

  /**
   * Handle schedule execute event.
   * Submits the post to Reddit.
   */
  handleScheduleExecute(event: ConsumedEvents['schedule.execute']): Promise<void>;

  /**
   * Handle schedule cancelled event.
   * Updates post status back to approved.
   */
  handleScheduleCancelled(event: ConsumedEvents['schedule.cancelled']): Promise<void>;

  /**
   * Handle customer settings updated event.
   * Updates posting preferences.
   */
  handleCustomerSettingsUpdated(event: ConsumedEvents['customer.settings_updated']): Promise<void>;

  /**
   * Handle customer deactivated event.
   * Pauses all pending/queued posts.
   */
  handleCustomerDeactivated(event: ConsumedEvents['customer.deactivated']): Promise<void>;
}
