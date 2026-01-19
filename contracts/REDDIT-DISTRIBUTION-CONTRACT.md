# REDDIT-DISTRIBUTION Domain Contract

> **Version**: 1.0.0
> **Domain**: Reddit Distribution
> **Owner**: Reddit Distribution Agent
> **Last Updated**: 2026-01-18

This contract defines the complete interface for the Reddit Distribution domain in the LEO Automation Platform. All implementations must adhere to these types and interfaces. The Reddit Distribution domain handles OAuth integration with Reddit, generates platform-appropriate summaries from articles, manages post creation and lifecycle, tracks engagement metrics, and ensures compliance with Reddit's rate limits and content policies.

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
  RedditPostId,
  RedditExternalId,
  ArticleId,
  SubredditId,
  CustomerId,
  UserId,
  UtmCampaignId,
  AgentSessionId,

  // Enums
  RedditPostStatus,
  Platform,
  EngagementLevel,
  AgentType,
  AgentSessionStatus,

  // Cross-Domain References
  RedditPostRef,
  ArticleRef,
  CustomerRef,
  UserRef,
  AgentSessionRef,

  // API Patterns
  ApiResponse,
  ApiError,
  PaginatedResponse,
  PaginationParams,
  SearchParams,

  // Shared Data Structures
  ISOTimestamp,
  UnixTimestamp,
  UtmParams,
  AuditInfo,
  AgentToolCall,

  // Constants
  REDDIT_POSTS_PER_HOUR,           // 60
  REDDIT_COMMENTS_PER_HOUR,        // 100
  REDDIT_TITLE_MAX_CHARS,          // 300
  REDDIT_BODY_MAX_CHARS,           // 40000
  REDDIT_SUMMARY_TARGET_WORDS,     // 200-400
  REDDIT_POST_RETRY_DELAY_MS,      // 60000
  REDDIT_POST_MAX_RETRIES,         // 3
  OAUTH_TOKEN_REFRESH_BUFFER_MS,   // 300000
  DEFAULT_PAGE_SIZE,               // 20
  MAX_PAGE_SIZE                    // 100
} from './shared.types';
```

---

## Cross-Domain References

### ArticleRef

Reference to articles from the Article domain. The Reddit Distribution domain reads this but does not own it.

```typescript
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
```

### CustomerRef

Reference to customers from the User/Customer domain.

```typescript
/**
 * Minimal customer reference used by Reddit Distribution domain.
 * The User/Customer domain owns the full Customer entity.
 */
export interface CustomerRef {
  /** Customer unique identifier */
  id: CustomerId;

  /** Company name for display */
  companyName: string;

  /** Customer tier affects rate limits and features */
  tier: CustomerTier;
}
```

### UserRef

Reference to users from the User/Customer domain.

```typescript
/**
 * Minimal user reference for audit trails and ownership.
 */
export interface UserRef {
  /** User unique identifier */
  id: UserId;

  /** User email address */
  email: string;

  /** Display name for UI */
  displayName: string;
}
```

---

## Domain-Specific Types

### RedditPostStatus Enum

```typescript
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
```

### EngagementLevel Enum

```typescript
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
```

### RedditOAuthToken Interface

```typescript
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
```

### RedditEngagement Interface

```typescript
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
export const DEFAULT_ENGAGEMENT: RedditEngagement = {
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
```

### Subreddit Interface

```typescript
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
```

### RedditPost Interface

```typescript
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
```

### CreateRedditPostInput Interface

```typescript
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
```

### UpdateRedditPostInput Interface

```typescript
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
```

### RedditSummaryRequest Interface

```typescript
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
  tone?: 'casual' | 'informative' | 'engaging' | 'professional';

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
```

### Post Lifecycle Transition Types

```typescript
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
```

### Engagement Update Types

```typescript
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
```

### Subreddit Tracking Types

```typescript
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
```

### Rate Limit Types

```typescript
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
```

---

## Service Interface

```typescript
/**
 * Reddit Distribution domain service interface.
 * All methods are async and return Promises.
 * Handles post lifecycle, OAuth management, and engagement tracking.
 */
export interface IRedditDistributionService {
  // ─────────────────────────────────────────────────────────────
  // Summary Generation (AI-Powered)
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate a Reddit-appropriate summary from an article using Claude.
   * Returns title options and body content optimized for the target subreddit.
   *
   * @param request - Summary generation request with article and subreddit context
   * @returns Generated summary with title options and body
   */
  generateSummary(request: RedditSummaryRequest): Promise<RedditSummaryResponse>;

  // ─────────────────────────────────────────────────────────────
  // Post Management
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Post Lifecycle Transitions
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Engagement Tracking
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Query Methods
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // OAuth Management
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Subreddit Management
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Rate Limiting
  // ─────────────────────────────────────────────────────────────

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
```

---

## Agent Interface

### Agent Input/Output Types

```typescript
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
  operation:
    | 'generate_summary'
    | 'suggest_subreddits'
    | 'optimize_title'
    | 'validate_content';

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
  suggestedSubreddits?: Array<{
    name: string;
    relevanceScore: number;
    reasoning: string;
  }>;

  /** Validation results (for validate_content) */
  validation?: {
    isValid: boolean;
    issues: Array<{
      severity: 'error' | 'warning' | 'info';
      rule: string;
      message: string;
    }>;
    suggestions: string[];
  };

  /** Confidence score (0-1) */
  confidence?: number;

  /** Error message if failed */
  error?: string;

  /** Operation metadata */
  metadata?: {
    tokensUsed: number;
    latencyMs: number;
    model: string;
  };
}
```

### Agent Interface

```typescript
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
```

---

## Repository Interface

### RedditPost Repository

```typescript
/**
 * Repository interface for RedditPost persistence.
 * Extends base repository pattern with reddit-specific queries.
 */
export interface IRedditPostRepository {
  // ─────────────────────────────────────────────────────────────
  // CRUD Operations
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Query Methods
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Aggregate Queries
  // ─────────────────────────────────────────────────────────────

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
```

### Subreddit Repository

```typescript
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
```

### RedditOAuth Repository

```typescript
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
```

---

## API Routes

### Route Definitions

```yaml
# ═══════════════════════════════════════════════════════════════
# SUMMARY GENERATION
# ═══════════════════════════════════════════════════════════════

# POST /reddit/summary
# Generate a Reddit summary from an article (AI-powered)
POST /reddit/summary:
  auth: required
  body:
    articleId: ArticleId (required)
    targetSubreddit: string (required)
    additionalInstructions: string (optional)
    targetWordCount: { min: number, max: number } (optional)
    tone: "casual" | "informative" | "engaging" | "professional" (optional)
    includeCta: boolean (optional)
    focusPoints: string[] (optional)
  response:
    201:
      success: true
      titleOptions: string[]
      body: string
      wordCount: number
      suggestedSubreddits: string[]
      confidence: number
      tokensUsed: number
      latencyMs: number
    400: Validation error
    404: Article not found
    500: Generation failed

# ═══════════════════════════════════════════════════════════════
# POST MANAGEMENT
# ═══════════════════════════════════════════════════════════════

# POST /reddit/posts
# Create a new Reddit post
POST /reddit/posts:
  auth: required
  body:
    articleId: ArticleId (required)
    subreddit: string (required)
    title: string (required, max 300 chars)
    body: string (required, max 40000 chars)
    linkUrl: string (optional)
    flair: string (optional)
    utmCampaignId: UtmCampaignId (optional)
    utmParams: UtmParams (optional)
    scheduledFor: ISOTimestamp (optional)
    autoApprove: boolean (optional, default: false)
  response:
    201:
      post: RedditPost
    400: Validation error
    404: Article not found
    409: Duplicate post

# GET /reddit/posts
# List posts with filters
GET /reddit/posts:
  auth: required
  query:
    customerId: CustomerId (optional, admin only)
    articleId: ArticleId (optional)
    subreddit: string (optional)
    status: RedditPostStatus | RedditPostStatus[] (optional)
    fromDate: ISOTimestamp (optional)
    toDate: ISOTimestamp (optional)
    page: number (default: 1)
    pageSize: number (default: 20, max: 100)
    sortBy: "createdAt" | "scheduledFor" | "postedAt" | "engagement.score" (default: "createdAt")
    sortOrder: "asc" | "desc" (default: "desc")
  response:
    200: PaginatedResponse<RedditPost>

# GET /reddit/posts/:id
# Get a specific post
GET /reddit/posts/:id:
  auth: required
  params:
    id: RedditPostId
  response:
    200: RedditPost
    404: Post not found

# PATCH /reddit/posts/:id
# Update a post (only before posting)
PATCH /reddit/posts/:id:
  auth: required
  params:
    id: RedditPostId
  body:
    title: string (optional)
    body: string (optional)
    subreddit: string (optional)
    flair: string (optional)
    scheduledFor: ISOTimestamp (optional)
    utmParams: UtmParams (optional)
  response:
    200: RedditPost
    400: Validation error / Cannot update posted content
    404: Post not found

# DELETE /reddit/posts/:id
# Delete a post (soft delete)
DELETE /reddit/posts/:id:
  auth: required
  params:
    id: RedditPostId
  response:
    204: No content
    404: Post not found

# ═══════════════════════════════════════════════════════════════
# POST LIFECYCLE
# ═══════════════════════════════════════════════════════════════

# POST /reddit/posts/:id/approve
# Approve a post for distribution
POST /reddit/posts/:id/approve:
  auth: required
  params:
    id: RedditPostId
  body:
    edits: { title?, body?, subreddit?, flair? } (optional)
    autoQueue: boolean (optional, default: false)
    scheduledFor: ISOTimestamp (optional, required if autoQueue)
  response:
    200: RedditPost
    400: Invalid status transition
    404: Post not found

# POST /reddit/posts/:id/reject
# Reject a post
POST /reddit/posts/:id/reject:
  auth: required
  params:
    id: RedditPostId
  body:
    reason: string (required)
  response:
    200: RedditPost
    400: Invalid status transition
    404: Post not found

# POST /reddit/posts/:id/queue
# Queue a post for scheduled posting
POST /reddit/posts/:id/queue:
  auth: required
  params:
    id: RedditPostId
  body:
    scheduledFor: ISOTimestamp (required)
    priority: number (optional, default: 0)
  response:
    200: RedditPost
    400: Invalid status transition / Invalid schedule time
    404: Post not found

# POST /reddit/posts/:id/submit
# Submit a post to Reddit immediately
POST /reddit/posts/:id/submit:
  auth: required
  params:
    id: RedditPostId
  response:
    200:
      success: true
      redditExternalId: string
      permalink: string
      fullUrl: string
    400: Invalid status transition
    404: Post not found
    429: Rate limited
    502: Reddit API error

# POST /reddit/posts/:id/retry
# Retry a failed post
POST /reddit/posts/:id/retry:
  auth: required
  params:
    id: RedditPostId
  response:
    200: RedditPost
    400: Max retries exceeded / Not in failed status
    404: Post not found

# ═══════════════════════════════════════════════════════════════
# ENGAGEMENT
# ═══════════════════════════════════════════════════════════════

# POST /reddit/posts/:id/engagement/refresh
# Refresh engagement metrics for a post
POST /reddit/posts/:id/engagement/refresh:
  auth: required
  params:
    id: RedditPostId
  body:
    force: boolean (optional, default: false)
  response:
    200:
      postId: RedditPostId
      success: true
      previousEngagement: RedditEngagement
      newEngagement: RedditEngagement
    404: Post not found
    400: Post not yet posted

# POST /reddit/engagement/bulk-refresh
# Refresh engagement for multiple posts
POST /reddit/engagement/bulk-refresh:
  auth: required
  body:
    postIds: RedditPostId[] (required, max 100)
    minAgeMinutes: number (optional, default: 60)
  response:
    200:
      results: EngagementRefreshResult[]
      successCount: number
      failureCount: number

# GET /reddit/engagement/stats
# Get engagement statistics
GET /reddit/engagement/stats:
  auth: required
  query:
    customerId: CustomerId (optional, admin only)
    fromDate: ISOTimestamp (required)
    toDate: ISOTimestamp (optional, default: now)
  response:
    200:
      totalPosts: number
      totalUpvotes: number
      totalComments: number
      averageScore: number
      averageRatio: number
      byEngagementLevel: Record<EngagementLevel, number>
      bySubreddit: SubredditStats[]

# ═══════════════════════════════════════════════════════════════
# OAUTH
# ═══════════════════════════════════════════════════════════════

# GET /reddit/oauth/authorize
# Get OAuth authorization URL
GET /reddit/oauth/authorize:
  auth: required
  query:
    redirectUri: string (required)
  response:
    200:
      url: string
      state: string

# POST /reddit/oauth/callback
# Complete OAuth with authorization code
POST /reddit/oauth/callback:
  auth: required
  body:
    authorizationCode: string (required)
    redirectUri: string (required)
    state: string (required)
  response:
    201:
      connected: true
      redditUsername: string
      scope: string[]
      expiresAt: ISOTimestamp
    400: Invalid code/state
    409: Already connected

# POST /reddit/oauth/refresh
# Refresh OAuth token
POST /reddit/oauth/refresh:
  auth: required
  body:
    force: boolean (optional, default: false)
  response:
    200:
      refreshed: true
      expiresAt: ISOTimestamp
    400: Not connected
    502: Reddit API error

# DELETE /reddit/oauth
# Revoke OAuth connection
DELETE /reddit/oauth:
  auth: required
  response:
    204: No content
    400: Not connected

# GET /reddit/oauth/status
# Get OAuth connection status
GET /reddit/oauth/status:
  auth: required
  response:
    200:
      connected: boolean
      redditUsername: string | null
      scope: string[] | null
      expiresAt: ISOTimestamp | null
      isValid: boolean
      needsRefresh: boolean

# ═══════════════════════════════════════════════════════════════
# SUBREDDITS
# ═══════════════════════════════════════════════════════════════

# POST /reddit/subreddits/track
# Track a new subreddit
POST /reddit/subreddits/track:
  auth: required
  body:
    subredditName: string (required)
    topics: string[] (optional)
    syncRulesNow: boolean (optional, default: true)
  response:
    201: Subreddit
    400: Invalid subreddit name
    404: Subreddit not found on Reddit
    409: Already tracking

# DELETE /reddit/subreddits/:id/track
# Untrack a subreddit
DELETE /reddit/subreddits/:id/track:
  auth: required
  params:
    id: SubredditId
  response:
    204: No content
    404: Subreddit not found

# GET /reddit/subreddits
# List tracked subreddits
GET /reddit/subreddits:
  auth: required
  query:
    topics: string[] (optional)
    onlyTracked: boolean (optional, default: true)
  response:
    200:
      subreddits: Subreddit[]

# GET /reddit/subreddits/:id
# Get subreddit details
GET /reddit/subreddits/:id:
  auth: required
  params:
    id: SubredditId
  response:
    200: Subreddit
    404: Subreddit not found

# GET /reddit/subreddits/by-name/:name
# Get subreddit by name
GET /reddit/subreddits/by-name/:name:
  auth: required
  params:
    name: string
  response:
    200: Subreddit
    404: Subreddit not found

# POST /reddit/subreddits/:id/sync
# Sync subreddit rules from Reddit
POST /reddit/subreddits/:id/sync:
  auth: required
  params:
    id: SubredditId
  response:
    200:
      subredditId: SubredditId
      success: true
      rulesSynced: number
      lastSyncedAt: ISOTimestamp
    404: Subreddit not found
    502: Reddit API error

# POST /reddit/subreddits/suggest
# Get subreddit suggestions for an article
POST /reddit/subreddits/suggest:
  auth: required
  body:
    articleId: ArticleId (required)
    limit: number (optional, default: 5)
  response:
    200:
      suggestions: Array<{
        subreddit: Subreddit
        relevanceScore: number
        reasoning: string
      }>

# ═══════════════════════════════════════════════════════════════
# RATE LIMITS
# ═══════════════════════════════════════════════════════════════

# GET /reddit/rate-limit
# Get rate limit status
GET /reddit/rate-limit:
  auth: required
  response:
    200:
      postsRemaining: number
      commentsRemaining: number
      resetsAt: ISOTimestamp
      isLimited: boolean
      waitSeconds: number | null
```

### TypeScript Route Types

```typescript
// ═══════════════════════════════════════════════════════════════
// SUMMARY GENERATION
// ═══════════════════════════════════════════════════════════════

/**
 * POST /reddit/summary request body
 */
export interface GenerateSummaryRequest {
  articleId: ArticleId;
  targetSubreddit: string;
  additionalInstructions?: string;
  targetWordCount?: { min: number; max: number };
  tone?: 'casual' | 'informative' | 'engaging' | 'professional';
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

// ═══════════════════════════════════════════════════════════════
// POST MANAGEMENT
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// POST LIFECYCLE
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// ENGAGEMENT
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// OAUTH
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// SUBREDDITS
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// RATE LIMITS
// ═══════════════════════════════════════════════════════════════

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
```

---

## Validation Schemas

```typescript
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// IDENTITY SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * Reddit Post ID validation (rp_uuid format)
 */
export const RedditPostIdSchema = z.string().regex(
  /^rp_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Must be in rp_uuid format'
);

/**
 * Article ID validation (art_uuid format)
 */
export const ArticleIdSchema = z.string().regex(
  /^art_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Must be in art_uuid format'
);

/**
 * Customer ID validation (cust_uuid format)
 */
export const CustomerIdSchema = z.string().regex(
  /^cust_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Must be in cust_uuid format'
);

/**
 * Subreddit ID validation (sub_uuid format)
 */
export const SubredditIdSchema = z.string().regex(
  /^sub_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Must be in sub_uuid format'
);

/**
 * UTM Campaign ID validation (utm_uuid format)
 */
export const UtmCampaignIdSchema = z.string().regex(
  /^utm_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Must be in utm_uuid format'
);

// ═══════════════════════════════════════════════════════════════
// CONTENT SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * Subreddit name validation (without r/ prefix)
 */
export const SubredditNameSchema = z.string()
  .min(3, 'Subreddit name must be at least 3 characters')
  .max(21, 'Subreddit name cannot exceed 21 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Subreddit name can only contain letters, numbers, and underscores');

/**
 * Reddit post title validation
 */
export const RedditTitleSchema = z.string()
  .min(1, 'Title is required')
  .max(300, 'Title cannot exceed 300 characters')
  .refine(
    (val) => !val.startsWith(' ') && !val.endsWith(' '),
    'Title cannot start or end with spaces'
  );

/**
 * Reddit post body validation
 */
export const RedditBodySchema = z.string()
  .min(1, 'Body is required')
  .max(40000, 'Body cannot exceed 40000 characters');

/**
 * ISO timestamp validation
 */
export const ISOTimestampSchema = z.string().datetime({
  message: 'Must be a valid ISO 8601 timestamp'
});

/**
 * Future timestamp validation (for scheduling)
 */
export const FutureTimestampSchema = ISOTimestampSchema.refine(
  (val) => new Date(val) > new Date(),
  'Scheduled time must be in the future'
);

// ═══════════════════════════════════════════════════════════════
// UTM SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * UTM parameters validation
 */
export const UtmParamsSchema = z.object({
  source: z.string().min(1).max(50).optional(),
  medium: z.string().min(1).max(50).optional(),
  campaign: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(100).optional(),
  term: z.string().min(1).max(100).optional()
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY GENERATION SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate summary request validation
 */
export const GenerateSummaryRequestSchema = z.object({
  articleId: ArticleIdSchema,
  targetSubreddit: SubredditNameSchema,
  additionalInstructions: z.string().max(1000).optional(),
  targetWordCount: z.object({
    min: z.number().int().min(50).max(500),
    max: z.number().int().min(100).max(1000)
  }).refine(
    (val) => val.min < val.max,
    'min must be less than max'
  ).optional(),
  tone: z.enum(['casual', 'informative', 'engaging', 'professional']).optional(),
  includeCta: z.boolean().optional(),
  focusPoints: z.array(z.string().max(100)).max(5).optional()
});

// ═══════════════════════════════════════════════════════════════
// POST MANAGEMENT SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * Create post request validation
 */
export const CreatePostRequestSchema = z.object({
  articleId: ArticleIdSchema,
  subreddit: SubredditNameSchema,
  title: RedditTitleSchema,
  body: RedditBodySchema,
  linkUrl: z.string().url().optional(),
  flair: z.string().max(64).optional(),
  utmCampaignId: UtmCampaignIdSchema.optional(),
  utmParams: UtmParamsSchema.optional(),
  scheduledFor: FutureTimestampSchema.optional(),
  autoApprove: z.boolean().optional().default(false)
});

/**
 * Update post request validation
 */
export const UpdatePostRequestSchema = z.object({
  title: RedditTitleSchema.optional(),
  body: RedditBodySchema.optional(),
  subreddit: SubredditNameSchema.optional(),
  flair: z.string().max(64).optional(),
  scheduledFor: FutureTimestampSchema.optional(),
  utmParams: UtmParamsSchema.optional()
}).refine(
  (val) => Object.keys(val).length > 0,
  'At least one field must be provided'
);

/**
 * List posts query validation
 */
export const ListPostsQuerySchema = z.object({
  customerId: CustomerIdSchema.optional(),
  articleId: ArticleIdSchema.optional(),
  subreddit: SubredditNameSchema.optional(),
  status: z.union([
    z.nativeEnum(RedditPostStatus),
    z.array(z.nativeEnum(RedditPostStatus))
  ]).optional(),
  fromDate: ISOTimestampSchema.optional(),
  toDate: ISOTimestampSchema.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(['createdAt', 'scheduledFor', 'postedAt', 'engagement.score']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

// ═══════════════════════════════════════════════════════════════
// POST LIFECYCLE SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * Approve post request validation
 */
export const ApprovePostRequestSchema = z.object({
  edits: z.object({
    title: RedditTitleSchema.optional(),
    body: RedditBodySchema.optional(),
    subreddit: SubredditNameSchema.optional(),
    flair: z.string().max(64).optional()
  }).optional(),
  autoQueue: z.boolean().optional().default(false),
  scheduledFor: FutureTimestampSchema.optional()
}).refine(
  (val) => !val.autoQueue || val.scheduledFor,
  'scheduledFor is required when autoQueue is true'
);

/**
 * Reject post request validation
 */
export const RejectPostRequestSchema = z.object({
  reason: z.string().min(1).max(500)
});

/**
 * Queue post request validation
 */
export const QueuePostRequestSchema = z.object({
  scheduledFor: FutureTimestampSchema,
  priority: z.number().int().min(0).max(100).optional().default(0)
});

// ═══════════════════════════════════════════════════════════════
// ENGAGEMENT SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * Refresh engagement request validation
 */
export const RefreshEngagementRequestSchema = z.object({
  force: z.boolean().optional().default(false)
});

/**
 * Bulk refresh engagement request validation
 */
export const BulkRefreshEngagementRequestSchema = z.object({
  postIds: z.array(RedditPostIdSchema).min(1).max(100),
  minAgeMinutes: z.number().int().min(1).optional().default(60)
});

/**
 * Engagement stats query validation
 */
export const EngagementStatsQuerySchema = z.object({
  customerId: CustomerIdSchema.optional(),
  fromDate: ISOTimestampSchema,
  toDate: ISOTimestampSchema.optional()
});

// ═══════════════════════════════════════════════════════════════
// OAUTH SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * OAuth callback request validation
 */
export const OAuthCallbackRequestSchema = z.object({
  authorizationCode: z.string().min(1),
  redirectUri: z.string().url(),
  state: z.string().min(1)
});

/**
 * OAuth refresh request validation
 */
export const OAuthRefreshRequestSchema = z.object({
  force: z.boolean().optional().default(false)
});

// ═══════════════════════════════════════════════════════════════
// SUBREDDIT SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * Track subreddit request validation
 */
export const TrackSubredditRequestSchema = z.object({
  subredditName: SubredditNameSchema,
  topics: z.array(z.string().min(1).max(50)).max(10).optional(),
  syncRulesNow: z.boolean().optional().default(true)
});

/**
 * Suggest subreddits request validation
 */
export const SuggestSubredditsRequestSchema = z.object({
  articleId: ArticleIdSchema,
  limit: z.number().int().min(1).max(20).optional().default(5)
});

// ═══════════════════════════════════════════════════════════════
// ENGAGEMENT VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Reddit engagement data validation
 */
export const RedditEngagementSchema = z.object({
  upvotes: z.number().int().min(0),
  downvotes: z.number().int().min(0),
  score: z.number().int(),
  ratio: z.number().min(0).max(1),
  comments: z.number().int().min(0),
  awards: z.number().int().min(0),
  crossposts: z.number().int().min(0),
  level: z.nativeEnum(EngagementLevel),
  lastUpdatedAt: ISOTimestampSchema
});

// ═══════════════════════════════════════════════════════════════
// SUBREDDIT RULE VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Subreddit rule validation
 */
export const SubredditRuleSchema = z.object({
  priority: z.number().int().min(1),
  shortName: z.string().min(1).max(100),
  description: z.string().max(2000),
  violationType: z.enum(['ban', 'removal', 'warning'])
});

/**
 * Subreddit restrictions validation
 */
export const SubredditRestrictionsSchema = z.object({
  isNsfw: z.boolean(),
  requiresFlair: z.boolean(),
  flairOptions: z.array(z.string()).optional(),
  hasTitleRequirements: z.boolean(),
  titleRequirements: z.string().optional(),
  minTitleLength: z.number().int().min(0).optional(),
  postsPerDay: z.number().int().min(1).optional(),
  blacklistedDomains: z.array(z.string()).optional()
});
```

---

## Error Codes

```typescript
/**
 * Reddit Distribution domain-specific error codes.
 * All codes are prefixed with REDDIT_ for namespacing.
 */
export const RedditDistributionErrorCodes = {
  // ─────────────────────────────────────────────────────────────
  // API Errors
  // ─────────────────────────────────────────────────────────────

  /** Reddit API returned an error response */
  REDDIT_API_ERROR: 'REDDIT_API_ERROR',

  /** Reddit API rate limit exceeded */
  REDDIT_RATE_LIMITED: 'REDDIT_RATE_LIMITED',

  /** Reddit API timeout */
  REDDIT_TIMEOUT: 'REDDIT_TIMEOUT',

  /** Reddit API returned unexpected response */
  REDDIT_INVALID_RESPONSE: 'REDDIT_INVALID_RESPONSE',

  // ─────────────────────────────────────────────────────────────
  // OAuth Errors
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Post Errors
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Subreddit Errors
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Content Errors
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Generation Errors
  // ─────────────────────────────────────────────────────────────

  /** Summary generation failed */
  REDDIT_GENERATION_FAILED: 'REDDIT_GENERATION_FAILED',

  /** Article content not found or empty */
  REDDIT_ARTICLE_NOT_FOUND: 'REDDIT_ARTICLE_NOT_FOUND',

  /** Agent invocation failed */
  REDDIT_AGENT_ERROR: 'REDDIT_AGENT_ERROR',

  // ─────────────────────────────────────────────────────────────
  // Scheduling Errors
  // ─────────────────────────────────────────────────────────────

  /** Scheduled time is in the past */
  REDDIT_SCHEDULE_IN_PAST: 'REDDIT_SCHEDULE_IN_PAST',

  /** Schedule conflict with existing post */
  REDDIT_SCHEDULE_CONFLICT: 'REDDIT_SCHEDULE_CONFLICT',

  // ─────────────────────────────────────────────────────────────
  // Account Errors
  // ─────────────────────────────────────────────────────────────

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
 * Error metadata by code
 */
export const RedditErrorMetadata: Record<RedditDistributionErrorCode, {
  httpStatus: number;
  retryable: boolean;
  userMessage: string;
}> = {
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
```

---

## Integration Points

### Events Published (to other domains)

```typescript
/**
 * Events the Reddit Distribution domain publishes for other domains to consume.
 * Published via event bus to Analytics, Scheduling, and other interested domains.
 */
export interface RedditDistributionEvents {
  // ─────────────────────────────────────────────────────────────
  // Post Lifecycle Events
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Engagement Events
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // OAuth Events
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Rate Limit Events
  // ─────────────────────────────────────────────────────────────

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
```

### Events Consumed (from other domains)

```typescript
/**
 * Events the Reddit Distribution domain consumes from other domains.
 */
export interface ConsumedEvents {
  // ─────────────────────────────────────────────────────────────
  // From Article Domain
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // From Scheduling Domain
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // From User/Customer Domain
  // ─────────────────────────────────────────────────────────────

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
```

### Event Handler Specifications

```typescript
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
```

---

## Notes for Implementers

### Post Lifecycle State Machine

```
                   ┌──────────────────┐
                   │ pending_approval │
                   └────────┬─────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
         ┌────────┐                 ┌─────────┐
         │approved│                 │ deleted │
         └───┬────┘                 └─────────┘
             │
             ▼
         ┌───────┐
         │queued │
         └───┬───┘
             │
             ▼
        ┌────────┐
        │posting │
        └───┬────┘
            │
   ┌────────┴────────┐
   │                 │
   ▼                 ▼
┌──────┐         ┌──────┐
│posted│         │failed│──┐
└──┬───┘         └──────┘  │ retry (if attempts < maxRetries)
   │                 ▲     │
   │                 └─────┘
   │
   ├───────────────┐
   │               │
   ▼               ▼
┌───────┐     ┌───────┐
│removed│     │deleted│
└───────┘     └───────┘
```

### Valid Status Transitions

| From Status | To Status | Trigger |
|-------------|-----------|---------|
| `pending_approval` | `approved` | `approvePost()` |
| `pending_approval` | `deleted` | `rejectPost()` or `deletePost()` |
| `approved` | `queued` | `queuePost()` |
| `approved` | `posting` | `submitPost()` (immediate) |
| `approved` | `deleted` | `deletePost()` |
| `queued` | `posting` | Scheduler trigger |
| `queued` | `approved` | Unqueue operation |
| `queued` | `deleted` | `deletePost()` |
| `posting` | `posted` | Successful Reddit API response |
| `posting` | `failed` | Reddit API error |
| `failed` | `queued` | `retryPost()` |
| `failed` | `deleted` | `deletePost()` |
| `posted` | `removed` | Reddit removal detection |
| `posted` | `deleted` | `deletePost()` |

### Engagement Level Thresholds

| Level | Score | Comments | Ratio |
|-------|-------|----------|-------|
| `low` | < 10 | < 2 | any |
| `medium` | 10-49 | 2-9 | > 0.5 |
| `high` | 50-499 | 10-49 | > 0.7 |
| `viral` | >= 500 | >= 50 | > 0.8 |

### Rate Limit Handling

1. **Pre-check**: Before any Reddit API call, check `canPost()` to verify rate limit availability.

2. **Backoff Strategy**: When rate limited:
   - Wait for `retryAfterMs` from error response
   - If not provided, wait `REDDIT_POST_RETRY_DELAY_MS` (60000ms)
   - Exponential backoff on repeated failures

3. **Token Refresh**: Refresh OAuth tokens `OAUTH_TOKEN_REFRESH_BUFFER_MS` (5 minutes) before expiration.

### Summary Generation Guidelines

1. **Target Word Count**: 200-400 words (configurable per request)

2. **Tone Matching**: Match subreddit culture:
   - Technical subreddits: More formal, data-driven
   - Discussion subreddits: More conversational
   - News subreddits: More factual, neutral

3. **Title Generation**: Provide 2-3 options:
   - Question format (engagement driver)
   - Statement format (direct)
   - Curiosity gap (click-worthy but not clickbait)

4. **CTA Placement**: If included, place naturally at the end, not promotional

### OAuth Scopes Required

```typescript
const REQUIRED_SCOPES = [
  'identity',    // Read Reddit username
  'submit',      // Submit posts
  'read',        // Read subreddit info
  'mysubreddits' // List user's subreddits
];

const OPTIONAL_SCOPES = [
  'edit',        // Edit own posts
  'delete',      // Delete own posts
  'history'      // Read post history
];
```

### Database Schema Recommendations

```sql
-- Reddit posts table
CREATE TABLE reddit_posts (
  id VARCHAR(50) PRIMARY KEY,
  article_id VARCHAR(50) NOT NULL REFERENCES articles(id),
  customer_id VARCHAR(50) NOT NULL REFERENCES customers(id),
  subreddit VARCHAR(30) NOT NULL,
  title VARCHAR(300) NOT NULL,
  body TEXT NOT NULL,
  link_url TEXT,
  flair VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'pending_approval',
  reddit_external_id VARCHAR(20),
  permalink TEXT,
  full_url TEXT,
  -- Engagement stored as JSONB
  engagement JSONB NOT NULL DEFAULT '{}',
  utm_params JSONB,
  utm_campaign_id VARCHAR(50),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by JSONB,
  posted_at TIMESTAMP WITH TIME ZONE,
  engagement_updated_at TIMESTAMP WITH TIME ZONE,
  agent_session_id VARCHAR(50),
  generation_model VARCHAR(50),
  generation_tokens INTEGER,
  generation_latency_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by JSONB NOT NULL
);

-- Indexes
CREATE INDEX idx_reddit_posts_customer ON reddit_posts(customer_id);
CREATE INDEX idx_reddit_posts_article ON reddit_posts(article_id);
CREATE INDEX idx_reddit_posts_status ON reddit_posts(status);
CREATE INDEX idx_reddit_posts_scheduled ON reddit_posts(scheduled_for) WHERE status = 'queued';
CREATE INDEX idx_reddit_posts_customer_status ON reddit_posts(customer_id, status);
CREATE INDEX idx_reddit_posts_external ON reddit_posts(reddit_external_id) WHERE reddit_external_id IS NOT NULL;

-- Subreddits table
CREATE TABLE subreddits (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  subscribers INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  allows_text_posts BOOLEAN NOT NULL DEFAULT true,
  allows_link_posts BOOLEAN NOT NULL DEFAULT true,
  min_account_age INTEGER,
  min_karma INTEGER,
  rules JSONB NOT NULL DEFAULT '[]',
  restrictions JSONB NOT NULL DEFAULT '{}',
  topics TEXT[] NOT NULL DEFAULT '{}',
  is_tracked BOOLEAN NOT NULL DEFAULT false,
  tracked_by_customer_id VARCHAR(50) REFERENCES customers(id),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subreddits_name ON subreddits(name);
CREATE INDEX idx_subreddits_tracked ON subreddits(is_tracked, tracked_by_customer_id);
CREATE INDEX idx_subreddits_topics ON subreddits USING GIN(topics);

-- OAuth tokens table
CREATE TABLE reddit_oauth_tokens (
  customer_id VARCHAR(50) PRIMARY KEY REFERENCES customers(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT[] NOT NULL,
  reddit_username VARCHAR(30) NOT NULL,
  reddit_account_id VARCHAR(20) NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_refreshed_at TIMESTAMP WITH TIME ZONE,
  is_valid BOOLEAN NOT NULL DEFAULT true,
  refresh_failures INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_expires ON reddit_oauth_tokens(expires_at) WHERE is_valid = true;
CREATE INDEX idx_oauth_failures ON reddit_oauth_tokens(refresh_failures) WHERE refresh_failures > 0;
```

---

*Contract Version: 1.0.0 | Generated: 2026-01-18*
