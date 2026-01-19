/**
 * Reddit Distribution Service
 *
 * This module implements the IRedditDistributionService interface for managing
 * Reddit post lifecycle, engagement tracking, subreddit management, and rate limiting.
 *
 * @module reddit-distribution/reddit-distribution.service
 * @version 1.0.0
 */

import type {
  RedditPostId,
  RedditExternalId,
  ArticleId,
  CustomerId,
  SubredditId,
  UserRef,
  ISOTimestamp,
  PaginationParams,
  PaginatedResponse,
  RedditPostStatus,
  EngagementLevel,
  UtmParams,
} from '../shared/shared.types';

import {
  REDDIT_TITLE_MAX_CHARS,
  REDDIT_BODY_MAX_CHARS,
  REDDIT_POST_MAX_RETRIES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../shared/shared.types';

import type {
  RedditPost,
  RedditEngagement,
  Subreddit,
  SubredditRestrictions,
  RedditRateLimitStatus,
  CreateRedditPostInput,
  IRedditPostRepository,
  ISubredditRepository,
  IRedditRateLimitRepository,
} from './reddit-distribution.repository';

// =============================================================================
// INPUT/OUTPUT TYPES FOR SERVICE METHODS
// =============================================================================

/**
 * Input for updating a Reddit post.
 */
export interface UpdateRedditPostInput {
  title?: string;
  body?: string;
  subreddit?: string;
  flair?: string;
  scheduledFor?: ISOTimestamp;
  utmParams?: Partial<UtmParams>;
  updatedBy: UserRef;
}

/**
 * Input for approving a post.
 */
export interface ApprovePostInput {
  postId: RedditPostId;
  approvedBy: UserRef;
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
 * Input for queueing a post.
 */
export interface QueuePostInput {
  postId: RedditPostId;
  scheduledFor: ISOTimestamp;
  priority?: number;
}

/**
 * Result from submitting a post.
 */
export interface SubmitPostResult {
  success: boolean;
  redditExternalId?: RedditExternalId;
  permalink?: string;
  fullUrl?: string;
  error?: string;
  redditErrorCode?: string;
  retryable?: boolean;
  retryAfterMs?: number;
}

/**
 * Input for refreshing engagement metrics.
 */
export interface RefreshEngagementInput {
  postId: RedditPostId;
  force?: boolean;
}

/**
 * Input for bulk engagement refresh.
 */
export interface BulkRefreshEngagementInput {
  postIds: RedditPostId[];
  minAgeMinutes?: number;
}

/**
 * Result from refreshing engagement.
 */
export interface EngagementRefreshResult {
  postId: RedditPostId;
  success: boolean;
  previousEngagement?: RedditEngagement;
  newEngagement?: RedditEngagement;
  error?: string;
}

/**
 * Input for tracking a subreddit.
 */
export interface TrackSubredditInput {
  subredditName: string;
  customerId: CustomerId;
  topics?: string[];
  syncRulesNow?: boolean;
  trackedBy: UserRef;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Reddit Distribution service interface.
 */
export interface IRedditDistributionService {
  // Post Management
  createPost(input: CreateRedditPostInput): Promise<RedditPost>;
  getPostById(postId: RedditPostId): Promise<RedditPost | null>;
  updatePost(postId: RedditPostId, input: UpdateRedditPostInput): Promise<RedditPost>;
  deletePost(postId: RedditPostId): Promise<boolean>;

  // Post Lifecycle
  approvePost(input: ApprovePostInput): Promise<RedditPost>;
  rejectPost(postId: RedditPostId, reason: string, rejectedBy: UserRef): Promise<RedditPost>;
  queuePost(input: QueuePostInput): Promise<RedditPost>;
  submitPost(postId: RedditPostId): Promise<SubmitPostResult>;
  retryPost(postId: RedditPostId): Promise<RedditPost>;

  // Engagement
  refreshEngagement(input: RefreshEngagementInput): Promise<EngagementRefreshResult>;
  bulkRefreshEngagement(input: BulkRefreshEngagementInput): Promise<EngagementRefreshResult[]>;

  // Queries
  getPostsByArticle(
    articleId: ArticleId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<RedditPost>>;
  getPostsByCustomer(
    customerId: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<RedditPost>>;
  getPostsByStatus(status: RedditPostStatus, customerId?: CustomerId): Promise<RedditPost[]>;
  getScheduledPosts(
    startTime: ISOTimestamp,
    endTime: ISOTimestamp,
    customerId?: CustomerId
  ): Promise<RedditPost[]>;

  // Subreddit Management
  trackSubreddit(input: TrackSubredditInput): Promise<Subreddit>;
  untrackSubreddit(subredditId: SubredditId, customerId: CustomerId): Promise<boolean>;
  getTrackedSubreddits(customerId: CustomerId): Promise<Subreddit[]>;

  // Rate Limiting
  getRateLimitStatus(customerId: CustomerId): Promise<RedditRateLimitStatus>;
  canPost(customerId: CustomerId): Promise<boolean>;
}

// =============================================================================
// VALID STATUS TRANSITIONS
// =============================================================================

/**
 * Valid status transitions for Reddit posts.
 * Enforces the lifecycle: pending_approval -> approved -> queued -> posting -> posted
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_approval: ['approved', 'deleted'],
  approved: ['queued', 'deleted'],
  queued: ['posting', 'approved', 'deleted'],
  posting: ['posted', 'failed'],
  posted: ['removed', 'deleted'],
  failed: ['queued', 'deleted'],
  removed: ['deleted'],
  deleted: [],
};

/**
 * Check if a status transition is valid.
 */
function isValidTransition(from: RedditPostStatus, to: RedditPostStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get current ISO timestamp.
 */
function now(): ISOTimestamp {
  return new Date().toISOString();
}

/**
 * Calculate engagement level based on metrics.
 */
function calculateEngagementLevel(score: number, comments: number): EngagementLevel {
  const totalEngagement = score + comments * 2;

  if (totalEngagement >= 1000) {
    return 'viral' as EngagementLevel;
  } else if (totalEngagement >= 100) {
    return 'high' as EngagementLevel;
  } else if (totalEngagement >= 20) {
    return 'medium' as EngagementLevel;
  }
  return 'low' as EngagementLevel;
}

/**
 * Generate a mock Reddit external ID for simulation.
 */
function generateMockRedditId(): RedditExternalId {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `t3_${id}` as RedditExternalId;
}

/**
 * Generate mock engagement metrics for simulation.
 */
function generateMockEngagement(): Omit<RedditEngagement, 'level' | 'lastUpdatedAt'> {
  const upvotes = Math.floor(Math.random() * 100);
  const downvotes = Math.floor(Math.random() * 20);
  const score = upvotes - downvotes;
  const ratio = upvotes / (upvotes + downvotes) || 0;
  const comments = Math.floor(Math.random() * 30);
  const awards = Math.floor(Math.random() * 3);
  const crossposts = Math.floor(Math.random() * 2);

  return {
    upvotes,
    downvotes,
    score,
    ratio,
    comments,
    awards,
    crossposts,
  };
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Implementation of IRedditDistributionService.
 * Delegates data access to repositories and implements business logic.
 */
export class RedditDistributionService implements IRedditDistributionService {
  constructor(
    private readonly postRepository: IRedditPostRepository,
    private readonly subredditRepository: ISubredditRepository,
    private readonly rateLimitRepository: IRedditRateLimitRepository
  ) {}

  // ---------------------------------------------------------------------------
  // Post Management
  // ---------------------------------------------------------------------------

  async createPost(input: CreateRedditPostInput): Promise<RedditPost> {
    // Validate title length
    if (input.title.length > REDDIT_TITLE_MAX_CHARS) {
      throw new Error(
        `Title exceeds maximum length of ${REDDIT_TITLE_MAX_CHARS} characters`
      );
    }

    // Validate body length
    if (input.body.length > REDDIT_BODY_MAX_CHARS) {
      throw new Error(
        `Body exceeds maximum length of ${REDDIT_BODY_MAX_CHARS} characters`
      );
    }

    // Validate subreddit name (basic validation)
    if (!input.subreddit || input.subreddit.trim().length === 0) {
      throw new Error('Subreddit name is required');
    }

    // Remove r/ prefix if present
    const normalizedSubreddit = input.subreddit.replace(/^r\//, '');

    const post = await this.postRepository.create({
      ...input,
      subreddit: normalizedSubreddit,
    });

    return post;
  }

  async getPostById(postId: RedditPostId): Promise<RedditPost | null> {
    return this.postRepository.findById(postId);
  }

  async updatePost(postId: RedditPostId, input: UpdateRedditPostInput): Promise<RedditPost> {
    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw new Error(`Post not found: ${postId}`);
    }

    // Cannot modify posted content
    const postedStatus = 'posted' as RedditPostStatus;
    const postingStatus = 'posting' as RedditPostStatus;
    const deletedStatus = 'deleted' as RedditPostStatus;

    if (post.status === postedStatus || post.status === postingStatus) {
      throw new Error('Cannot modify a post that has already been submitted to Reddit');
    }

    // Cannot modify deleted content
    if (post.status === deletedStatus) {
      throw new Error('Cannot modify a deleted post');
    }

    // Validate title if provided
    if (input.title && input.title.length > REDDIT_TITLE_MAX_CHARS) {
      throw new Error(
        `Title exceeds maximum length of ${REDDIT_TITLE_MAX_CHARS} characters`
      );
    }

    // Validate body if provided
    if (input.body && input.body.length > REDDIT_BODY_MAX_CHARS) {
      throw new Error(
        `Body exceeds maximum length of ${REDDIT_BODY_MAX_CHARS} characters`
      );
    }

    const updates: Partial<RedditPost> = {};

    if (input.title !== undefined) updates.title = input.title;
    if (input.body !== undefined) updates.body = input.body;
    if (input.subreddit !== undefined) {
      updates.subreddit = input.subreddit.replace(/^r\//, '');
    }
    if (input.flair !== undefined) updates.flair = input.flair;
    if (input.scheduledFor !== undefined) updates.scheduledFor = input.scheduledFor;

    if (input.utmParams) {
      updates.utmParams = {
        source: input.utmParams.source ?? post.utmParams?.source ?? 'reddit',
        medium: input.utmParams.medium ?? post.utmParams?.medium ?? 'social',
        campaign: input.utmParams.campaign ?? post.utmParams?.campaign ?? 'organic',
        content: input.utmParams.content ?? post.utmParams?.content,
        term: input.utmParams.term ?? post.utmParams?.term,
      };
    }

    updates.audit = {
      ...post.audit,
      updatedAt: now(),
      updatedBy: input.updatedBy,
    };

    return this.postRepository.update(postId, updates);
  }

  async deletePost(postId: RedditPostId): Promise<boolean> {
    const post = await this.postRepository.findById(postId);

    if (!post) {
      return false;
    }

    // Can only delete if not currently posting
    const postingStatus = 'posting' as RedditPostStatus;
    if (post.status === postingStatus) {
      throw new Error('Cannot delete a post that is currently being submitted');
    }

    return this.postRepository.delete(postId);
  }

  // ---------------------------------------------------------------------------
  // Post Lifecycle
  // ---------------------------------------------------------------------------

  async approvePost(input: ApprovePostInput): Promise<RedditPost> {
    const post = await this.postRepository.findById(input.postId);

    if (!post) {
      throw new Error(`Post not found: ${input.postId}`);
    }

    const pendingApprovalStatus = 'pending_approval' as RedditPostStatus;
    if (post.status !== pendingApprovalStatus) {
      throw new Error(
        `Cannot approve post with status '${post.status}'. Only pending_approval posts can be approved.`
      );
    }

    const timestamp = now();
    const approvedStatus = 'approved' as RedditPostStatus;

    const updates: Partial<RedditPost> = {
      status: approvedStatus,
      approvedAt: timestamp,
      approvedBy: input.approvedBy,
      audit: {
        ...post.audit,
        updatedAt: timestamp,
        updatedBy: input.approvedBy,
      },
    };

    // Apply edits if provided
    if (input.edits) {
      if (input.edits.title) {
        if (input.edits.title.length > REDDIT_TITLE_MAX_CHARS) {
          throw new Error(
            `Title exceeds maximum length of ${REDDIT_TITLE_MAX_CHARS} characters`
          );
        }
        updates.title = input.edits.title;
      }
      if (input.edits.body) {
        if (input.edits.body.length > REDDIT_BODY_MAX_CHARS) {
          throw new Error(
            `Body exceeds maximum length of ${REDDIT_BODY_MAX_CHARS} characters`
          );
        }
        updates.body = input.edits.body;
      }
      if (input.edits.subreddit) {
        updates.subreddit = input.edits.subreddit.replace(/^r\//, '');
      }
      if (input.edits.flair) {
        updates.flair = input.edits.flair;
      }
    }

    let updatedPost = await this.postRepository.update(input.postId, updates);

    // Auto-queue if requested
    if (input.autoQueue && input.scheduledFor) {
      updatedPost = await this.queuePost({
        postId: input.postId,
        scheduledFor: input.scheduledFor,
      });
    }

    return updatedPost;
  }

  async rejectPost(
    postId: RedditPostId,
    reason: string,
    rejectedBy: UserRef
  ): Promise<RedditPost> {
    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw new Error(`Post not found: ${postId}`);
    }

    const pendingApprovalStatus = 'pending_approval' as RedditPostStatus;
    if (post.status !== pendingApprovalStatus) {
      throw new Error(
        `Cannot reject post with status '${post.status}'. Only pending_approval posts can be rejected.`
      );
    }

    const timestamp = now();
    const deletedStatus = 'deleted' as RedditPostStatus;

    const updates: Partial<RedditPost> = {
      status: deletedStatus,
      lastError: `Rejected: ${reason}`,
      audit: {
        ...post.audit,
        updatedAt: timestamp,
        updatedBy: rejectedBy,
      },
    };

    return this.postRepository.update(postId, updates);
  }

  async queuePost(input: QueuePostInput): Promise<RedditPost> {
    const post = await this.postRepository.findById(input.postId);

    if (!post) {
      throw new Error(`Post not found: ${input.postId}`);
    }

    const approvedStatus = 'approved' as RedditPostStatus;
    const failedStatus = 'failed' as RedditPostStatus;

    if (post.status !== approvedStatus && post.status !== failedStatus) {
      throw new Error(
        `Cannot queue post with status '${post.status}'. Only approved or failed posts can be queued.`
      );
    }

    // Validate scheduled time is in the future
    const scheduledTime = new Date(input.scheduledFor).getTime();
    if (scheduledTime <= Date.now()) {
      throw new Error('Scheduled time must be in the future');
    }

    const timestamp = now();
    const queuedStatus = 'queued' as RedditPostStatus;

    const updates: Partial<RedditPost> = {
      status: queuedStatus,
      scheduledFor: input.scheduledFor,
      audit: {
        ...post.audit,
        updatedAt: timestamp,
      },
    };

    return this.postRepository.update(input.postId, updates);
  }

  async submitPost(postId: RedditPostId): Promise<SubmitPostResult> {
    const post = await this.postRepository.findById(postId);

    if (!post) {
      return {
        success: false,
        error: `Post not found: ${postId}`,
        retryable: false,
      };
    }

    const queuedStatus = 'queued' as RedditPostStatus;
    const approvedStatus = 'approved' as RedditPostStatus;

    if (post.status !== queuedStatus && post.status !== approvedStatus) {
      return {
        success: false,
        error: `Cannot submit post with status '${post.status}'`,
        retryable: false,
      };
    }

    // Check rate limits
    const canPostNow = await this.canPost(post.customerId);
    if (!canPostNow) {
      const rateLimitStatus = await this.getRateLimitStatus(post.customerId);
      return {
        success: false,
        error: 'Rate limit exceeded',
        redditErrorCode: 'RATE_LIMITED',
        retryable: true,
        retryAfterMs: (rateLimitStatus.waitSeconds ?? 60) * 1000,
      };
    }

    // Transition to posting status
    const postingStatus = 'posting' as RedditPostStatus;
    await this.postRepository.update(postId, {
      status: postingStatus,
      attempts: post.attempts + 1,
      audit: {
        ...post.audit,
        updatedAt: now(),
      },
    });

    // Record the rate limit attempt
    await this.rateLimitRepository.recordPostAttempt(post.customerId);

    // Simulate Reddit API call (in real implementation, this would call Reddit API)
    try {
      // Simulate success/failure (90% success rate for simulation)
      const isSuccess = Math.random() < 0.9;

      if (isSuccess) {
        const redditExternalId = generateMockRedditId();
        const permalink = `/r/${post.subreddit}/comments/${redditExternalId.replace('t3_', '')}`;
        const fullUrl = `https://www.reddit.com${permalink}`;
        const timestamp = now();

        const postedStatus = 'posted' as RedditPostStatus;

        // Update with success
        await this.postRepository.update(postId, {
          status: postedStatus,
          redditExternalId,
          permalink,
          fullUrl,
          postedAt: timestamp,
          lastError: undefined,
          audit: {
            ...post.audit,
            updatedAt: timestamp,
          },
        });

        return {
          success: true,
          redditExternalId,
          permalink,
          fullUrl,
        };
      } else {
        // Simulate failure
        const errorMessage = 'Simulated Reddit API error';
        const hasRetriesRemaining = post.attempts + 1 < post.maxRetries;

        const failedStatus = 'failed' as RedditPostStatus;

        await this.postRepository.update(postId, {
          status: failedStatus,
          lastError: errorMessage,
          audit: {
            ...post.audit,
            updatedAt: now(),
          },
        });

        return {
          success: false,
          error: errorMessage,
          redditErrorCode: 'API_ERROR',
          retryable: hasRetriesRemaining,
          retryAfterMs: hasRetriesRemaining ? 60000 : undefined,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const failedStatus = 'failed' as RedditPostStatus;

      await this.postRepository.update(postId, {
        status: failedStatus,
        lastError: errorMessage,
        audit: {
          ...post.audit,
          updatedAt: now(),
        },
      });

      return {
        success: false,
        error: errorMessage,
        retryable: post.attempts + 1 < post.maxRetries,
      };
    }
  }

  async retryPost(postId: RedditPostId): Promise<RedditPost> {
    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw new Error(`Post not found: ${postId}`);
    }

    const failedStatus = 'failed' as RedditPostStatus;
    if (post.status !== failedStatus) {
      throw new Error(
        `Cannot retry post with status '${post.status}'. Only failed posts can be retried.`
      );
    }

    if (post.attempts >= post.maxRetries) {
      throw new Error(
        `Maximum retry attempts (${post.maxRetries}) exceeded for post ${postId}`
      );
    }

    // Queue the post for immediate retry
    const scheduledFor = new Date(Date.now() + 1000).toISOString();

    return this.queuePost({
      postId,
      scheduledFor,
    });
  }

  // ---------------------------------------------------------------------------
  // Engagement
  // ---------------------------------------------------------------------------

  async refreshEngagement(input: RefreshEngagementInput): Promise<EngagementRefreshResult> {
    const post = await this.postRepository.findById(input.postId);

    if (!post) {
      return {
        postId: input.postId,
        success: false,
        error: `Post not found: ${input.postId}`,
      };
    }

    const postedStatus = 'posted' as RedditPostStatus;
    if (post.status !== postedStatus) {
      return {
        postId: input.postId,
        success: false,
        error: `Cannot refresh engagement for post with status '${post.status}'`,
      };
    }

    // Check if we need to force refresh or if it's been long enough
    const lastUpdate = new Date(post.engagement.lastUpdatedAt).getTime();
    const minUpdateInterval = 5 * 60 * 1000; // 5 minutes

    if (!input.force && Date.now() - lastUpdate < minUpdateInterval) {
      return {
        postId: input.postId,
        success: true,
        previousEngagement: post.engagement,
        newEngagement: post.engagement,
      };
    }

    // Simulate fetching new engagement data from Reddit
    try {
      const mockMetrics = generateMockEngagement();
      const newEngagement: RedditEngagement = {
        ...mockMetrics,
        level: calculateEngagementLevel(mockMetrics.score, mockMetrics.comments),
        lastUpdatedAt: now(),
      };

      await this.postRepository.update(input.postId, {
        engagement: newEngagement,
        engagementUpdatedAt: now(),
      });

      return {
        postId: input.postId,
        success: true,
        previousEngagement: post.engagement,
        newEngagement,
      };
    } catch (error) {
      return {
        postId: input.postId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async bulkRefreshEngagement(
    input: BulkRefreshEngagementInput
  ): Promise<EngagementRefreshResult[]> {
    const results: EngagementRefreshResult[] = [];

    for (const postId of input.postIds) {
      const result = await this.refreshEngagement({
        postId,
        force: true,
      });
      results.push(result);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async getPostsByArticle(
    articleId: ArticleId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<RedditPost>> {
    const page = pagination?.page ?? 1;
    const pageSize = Math.min(pagination?.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = (page - 1) * pageSize;

    const [posts, totalItems] = await Promise.all([
      this.postRepository.findByArticle(articleId, { limit: pageSize, offset }),
      this.postRepository.countByArticle(articleId),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      data: posts,
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

  async getPostsByCustomer(
    customerId: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<RedditPost>> {
    const page = pagination?.page ?? 1;
    const pageSize = Math.min(pagination?.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = (page - 1) * pageSize;

    const [posts, totalItems] = await Promise.all([
      this.postRepository.findByCustomer(customerId, { limit: pageSize, offset }),
      this.postRepository.countByCustomer(customerId),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      data: posts,
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

  async getPostsByStatus(
    status: RedditPostStatus,
    customerId?: CustomerId
  ): Promise<RedditPost[]> {
    return this.postRepository.findByStatus(status, { customerId });
  }

  async getScheduledPosts(
    startTime: ISOTimestamp,
    endTime: ISOTimestamp,
    customerId?: CustomerId
  ): Promise<RedditPost[]> {
    const posts = await this.postRepository.findScheduled(startTime, endTime);

    if (customerId) {
      return posts.filter((post) => post.customerId === customerId);
    }

    return posts;
  }

  // ---------------------------------------------------------------------------
  // Subreddit Management
  // ---------------------------------------------------------------------------

  async trackSubreddit(input: TrackSubredditInput): Promise<Subreddit> {
    // Normalize subreddit name
    const subredditName = input.subredditName.replace(/^r\//, '').toLowerCase();

    // Check if already tracked
    const existing = await this.subredditRepository.findByName(subredditName);

    if (existing && existing.isTracked && existing.trackedByCustomerId === input.customerId) {
      throw new Error(`Subreddit r/${subredditName} is already being tracked`);
    }

    // Create default restrictions
    const defaultRestrictions: SubredditRestrictions = {
      isNsfw: false,
      requiresFlair: false,
      hasTitleRequirements: false,
    };

    // Create or update subreddit
    const subredditData: Omit<Subreddit, 'id' | 'audit'> = {
      name: subredditName,
      displayName: `r/${subredditName}`,
      subscribers: 0, // Would be fetched from Reddit API
      isActive: true,
      allowsTextPosts: true,
      allowsLinkPosts: true,
      rules: [],
      restrictions: defaultRestrictions,
      topics: input.topics ?? [],
      isTracked: true,
      trackedByCustomerId: input.customerId,
      lastSyncedAt: now(),
    };

    return this.subredditRepository.upsert(subredditData, input.trackedBy);
  }

  async untrackSubreddit(subredditId: SubredditId, customerId: CustomerId): Promise<boolean> {
    const subreddit = await this.subredditRepository.findById(subredditId);

    if (!subreddit) {
      return false;
    }

    if (subreddit.trackedByCustomerId !== customerId) {
      throw new Error('Cannot untrack a subreddit you do not own');
    }

    await this.subredditRepository.updateTracking(subredditId, customerId, false);
    return true;
  }

  async getTrackedSubreddits(customerId: CustomerId): Promise<Subreddit[]> {
    return this.subredditRepository.findTrackedByCustomer(customerId);
  }

  // ---------------------------------------------------------------------------
  // Rate Limiting
  // ---------------------------------------------------------------------------

  async getRateLimitStatus(customerId: CustomerId): Promise<RedditRateLimitStatus> {
    return this.rateLimitRepository.getStatus(customerId);
  }

  async canPost(customerId: CustomerId): Promise<boolean> {
    const status = await this.rateLimitRepository.getStatus(customerId);
    return status.postsRemaining > 0;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

import {
  InMemoryRedditPostRepository,
  InMemorySubredditRepository,
  InMemoryRedditRateLimitRepository,
} from './reddit-distribution.repository';

/**
 * Create a new RedditDistributionService with in-memory repositories.
 * Useful for testing and development.
 */
export function createRedditDistributionService(): RedditDistributionService {
  return new RedditDistributionService(
    new InMemoryRedditPostRepository(),
    new InMemorySubredditRepository(),
    new InMemoryRedditRateLimitRepository()
  );
}
