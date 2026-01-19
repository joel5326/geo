/**
 * Reddit Distribution Repository
 *
 * This module provides the repository interfaces and in-memory implementations
 * for the Reddit Distribution domain. It handles persistence of Reddit posts,
 * subreddits, and OAuth tokens.
 *
 * @module reddit-distribution/reddit-distribution.repository
 * @version 1.0.0
 */

import type {
  RedditPostId,
  RedditExternalId,
  ArticleId,
  CustomerId,
  SubredditId,
  UtmCampaignId,
  AgentSessionId,
  UserRef,
  ISOTimestamp,
  AuditInfo,
  RedditPostStatus,
  EngagementLevel,
  UtmParams,
} from '../shared/shared.types';

import {
  REDDIT_POST_MAX_RETRIES,
  REDDIT_POSTS_PER_HOUR,
  REDDIT_COMMENTS_PER_HOUR,
} from '../shared/shared.types';

// =============================================================================
// DOMAIN ENTITY TYPES
// =============================================================================

/**
 * Engagement metrics for a Reddit post.
 */
export interface RedditEngagement {
  upvotes: number;
  downvotes: number;
  score: number;
  ratio: number;
  comments: number;
  awards: number;
  crossposts: number;
  level: EngagementLevel;
  lastUpdatedAt: ISOTimestamp;
}

/**
 * Individual subreddit rule.
 */
export interface SubredditRule {
  priority: number;
  shortName: string;
  description: string;
  violationType: 'ban' | 'removal' | 'warning';
}

/**
 * Posting restrictions for a subreddit.
 */
export interface SubredditRestrictions {
  isNsfw: boolean;
  requiresFlair: boolean;
  flairOptions?: string[];
  hasTitleRequirements: boolean;
  titleRequirements?: string;
  minTitleLength?: number;
  postsPerDay?: number;
  blacklistedDomains?: string[];
}

/**
 * Subreddit entity.
 */
export interface Subreddit {
  id: SubredditId;
  name: string;
  displayName: string;
  subscribers: number;
  isActive: boolean;
  allowsTextPosts: boolean;
  allowsLinkPosts: boolean;
  minAccountAge?: number;
  minKarma?: number;
  rules: SubredditRule[];
  restrictions: SubredditRestrictions;
  topics: string[];
  isTracked: boolean;
  trackedByCustomerId?: CustomerId;
  lastSyncedAt: ISOTimestamp;
  audit: AuditInfo;
}

/**
 * Reddit post entity.
 */
export interface RedditPost {
  id: RedditPostId;
  articleId: ArticleId;
  customerId: CustomerId;
  subreddit: string;
  title: string;
  body: string;
  linkUrl?: string;
  flair?: string;
  status: RedditPostStatus;
  redditExternalId?: RedditExternalId;
  permalink?: string;
  fullUrl?: string;
  engagement: RedditEngagement;
  utmParams?: UtmParams;
  utmCampaignId?: UtmCampaignId;
  attempts: number;
  maxRetries: number;
  lastError?: string;
  scheduledFor?: ISOTimestamp;
  approvedAt?: ISOTimestamp;
  approvedBy?: UserRef;
  postedAt?: ISOTimestamp;
  engagementUpdatedAt?: ISOTimestamp;
  agentSessionId?: AgentSessionId;
  generationModel?: string;
  generationTokens?: number;
  generationLatencyMs?: number;
  audit: AuditInfo;
}

/**
 * Reddit OAuth token entity.
 */
export interface RedditOAuthToken {
  customerId: CustomerId;
  accessToken: string;
  refreshToken: string;
  expiresAt: ISOTimestamp;
  scope: string[];
  redditUsername: string;
  redditAccountId: string;
  issuedAt: ISOTimestamp;
  lastRefreshedAt?: ISOTimestamp;
  isValid: boolean;
  refreshFailures: number;
  audit: AuditInfo;
}

/**
 * Rate limit status for a customer.
 */
export interface RedditRateLimitStatus {
  customerId: CustomerId;
  postsRemaining: number;
  commentsRemaining: number;
  resetsAt: ISOTimestamp;
  isLimited: boolean;
  waitSeconds?: number;
}

/**
 * Input for creating a Reddit post.
 */
export interface CreateRedditPostInput {
  articleId: ArticleId;
  customerId: CustomerId;
  subreddit: string;
  title: string;
  body: string;
  linkUrl?: string;
  flair?: string;
  utmCampaignId?: UtmCampaignId;
  utmParams?: Partial<UtmParams>;
  scheduledFor?: ISOTimestamp;
  autoApprove?: boolean;
  createdBy: UserRef;
  agentSessionId?: AgentSessionId;
}

// =============================================================================
// REPOSITORY INTERFACES
// =============================================================================

/**
 * Repository interface for RedditPost persistence.
 */
export interface IRedditPostRepository {
  // CRUD Operations
  create(input: CreateRedditPostInput): Promise<RedditPost>;
  findById(id: RedditPostId): Promise<RedditPost | null>;
  findByExternalId(externalId: RedditExternalId): Promise<RedditPost | null>;
  update(id: RedditPostId, input: Partial<RedditPost>): Promise<RedditPost>;
  delete(id: RedditPostId): Promise<boolean>;

  // Query Methods
  findByArticle(
    articleId: ArticleId,
    options?: {
      status?: RedditPostStatus | RedditPostStatus[];
      limit?: number;
      offset?: number;
    }
  ): Promise<RedditPost[]>;

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

  findByStatus(
    status: RedditPostStatus,
    options?: {
      customerId?: CustomerId;
      limit?: number;
      offset?: number;
    }
  ): Promise<RedditPost[]>;

  findScheduled(startTime: ISOTimestamp, endTime: ISOTimestamp): Promise<RedditPost[]>;

  findNeedingEngagementRefresh(olderThanMinutes: number, limit: number): Promise<RedditPost[]>;

  countByStatus(customerId: CustomerId): Promise<Record<RedditPostStatus, number>>;

  // Aggregate Queries
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

  getPostingActivity(
    customerId: CustomerId,
    fromDate: ISOTimestamp,
    toDate: ISOTimestamp
  ): Promise<
    Array<{
      date: string;
      posted: number;
      failed: number;
      engagement: number;
    }>
  >;

  // Count methods for pagination
  countByArticle(articleId: ArticleId): Promise<number>;
  countByCustomer(customerId: CustomerId): Promise<number>;
}

/**
 * Repository interface for Subreddit persistence.
 */
export interface ISubredditRepository {
  upsert(subreddit: Omit<Subreddit, 'id' | 'audit'>, createdBy: UserRef): Promise<Subreddit>;
  findById(id: SubredditId): Promise<Subreddit | null>;
  findByName(name: string): Promise<Subreddit | null>;
  findTrackedByCustomer(customerId: CustomerId): Promise<Subreddit[]>;
  findByTopics(topics: string[], limit?: number): Promise<Subreddit[]>;
  updateTracking(id: SubredditId, customerId: CustomerId, isTracked: boolean): Promise<Subreddit>;
  findNeedingSync(olderThanHours: number, limit: number): Promise<Subreddit[]>;
}

/**
 * Repository interface for OAuth token persistence.
 */
export interface IRedditOAuthRepository {
  store(token: Omit<RedditOAuthToken, 'audit'>, createdBy: UserRef): Promise<RedditOAuthToken>;
  findByCustomer(customerId: CustomerId): Promise<RedditOAuthToken | null>;
  update(customerId: CustomerId, updates: Partial<RedditOAuthToken>): Promise<RedditOAuthToken>;
  delete(customerId: CustomerId): Promise<boolean>;
  findExpiringSoon(withinMs: number): Promise<RedditOAuthToken[]>;
  findWithRefreshFailures(minFailures: number): Promise<RedditOAuthToken[]>;
}

/**
 * Repository interface for rate limit tracking.
 */
export interface IRedditRateLimitRepository {
  getStatus(customerId: CustomerId): Promise<RedditRateLimitStatus>;
  recordPostAttempt(customerId: CustomerId): Promise<RedditRateLimitStatus>;
  recordCommentAttempt(customerId: CustomerId): Promise<RedditRateLimitStatus>;
  reset(customerId: CustomerId): Promise<void>;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate a unique ID with a prefix.
 */
function generateId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  return `${prefix}_${uuid}`;
}

/**
 * Get current ISO timestamp.
 */
function now(): ISOTimestamp {
  return new Date().toISOString();
}

/**
 * Create default engagement metrics.
 */
function createDefaultEngagement(): RedditEngagement {
  return {
    upvotes: 0,
    downvotes: 0,
    score: 0,
    ratio: 0,
    comments: 0,
    awards: 0,
    crossposts: 0,
    level: 'low' as EngagementLevel,
    lastUpdatedAt: now(),
  };
}

/**
 * Create audit info for a new entity.
 */
function createAuditInfo(createdBy: UserRef): AuditInfo {
  const timestamp = now();
  return {
    createdAt: timestamp,
    createdBy,
    updatedAt: timestamp,
    updatedBy: createdBy,
  };
}

/**
 * Update audit info for an existing entity.
 */
function updateAuditInfo(existing: AuditInfo, updatedBy: UserRef): AuditInfo {
  return {
    ...existing,
    updatedAt: now(),
    updatedBy,
  };
}

// =============================================================================
// IN-MEMORY REDDIT POST REPOSITORY
// =============================================================================

/**
 * In-memory implementation of IRedditPostRepository.
 * Uses Map for O(1) lookups by ID.
 */
export class InMemoryRedditPostRepository implements IRedditPostRepository {
  private posts: Map<string, RedditPost> = new Map();
  private externalIdIndex: Map<string, string> = new Map();

  async create(input: CreateRedditPostInput): Promise<RedditPost> {
    const id = generateId('rp') as RedditPostId;
    const timestamp = now();

    // Determine initial status based on autoApprove flag
    const status: RedditPostStatus = input.autoApprove
      ? ('approved' as RedditPostStatus)
      : ('pending_approval' as RedditPostStatus);

    // Build complete UTM params if partial provided
    let utmParams: UtmParams | undefined;
    if (input.utmParams) {
      utmParams = {
        source: input.utmParams.source ?? 'reddit',
        medium: input.utmParams.medium ?? 'social',
        campaign: input.utmParams.campaign ?? `article_${input.articleId}`,
        content: input.utmParams.content,
        term: input.utmParams.term,
      };
    }

    const post: RedditPost = {
      id,
      articleId: input.articleId,
      customerId: input.customerId,
      subreddit: input.subreddit,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      flair: input.flair,
      status,
      engagement: createDefaultEngagement(),
      utmParams,
      utmCampaignId: input.utmCampaignId,
      attempts: 0,
      maxRetries: REDDIT_POST_MAX_RETRIES,
      scheduledFor: input.scheduledFor,
      approvedAt: input.autoApprove ? timestamp : undefined,
      approvedBy: input.autoApprove ? input.createdBy : undefined,
      agentSessionId: input.agentSessionId,
      audit: createAuditInfo(input.createdBy),
    };

    this.posts.set(id, post);
    return post;
  }

  async findById(id: RedditPostId): Promise<RedditPost | null> {
    return this.posts.get(id) ?? null;
  }

  async findByExternalId(externalId: RedditExternalId): Promise<RedditPost | null> {
    const postId = this.externalIdIndex.get(externalId);
    if (!postId) return null;
    return this.posts.get(postId) ?? null;
  }

  async update(id: RedditPostId, input: Partial<RedditPost>): Promise<RedditPost> {
    const existing = this.posts.get(id);
    if (!existing) {
      throw new Error(`Post not found: ${id}`);
    }

    const updated: RedditPost = {
      ...existing,
      ...input,
      id: existing.id, // Prevent ID changes
      audit: {
        ...existing.audit,
        updatedAt: now(),
        updatedBy: input.audit?.updatedBy ?? existing.audit.updatedBy,
      },
    };

    // Update external ID index if changed
    if (input.redditExternalId && input.redditExternalId !== existing.redditExternalId) {
      if (existing.redditExternalId) {
        this.externalIdIndex.delete(existing.redditExternalId);
      }
      this.externalIdIndex.set(input.redditExternalId, id);
    }

    this.posts.set(id, updated);
    return updated;
  }

  async delete(id: RedditPostId): Promise<boolean> {
    const existing = this.posts.get(id);
    if (!existing) return false;

    // Remove from external ID index
    if (existing.redditExternalId) {
      this.externalIdIndex.delete(existing.redditExternalId);
    }

    // Soft delete - mark as deleted status
    const deleted: RedditPost = {
      ...existing,
      status: 'deleted' as RedditPostStatus,
      audit: {
        ...existing.audit,
        updatedAt: now(),
      },
    };
    this.posts.set(id, deleted);
    return true;
  }

  async findByArticle(
    articleId: ArticleId,
    options?: {
      status?: RedditPostStatus | RedditPostStatus[];
      limit?: number;
      offset?: number;
    }
  ): Promise<RedditPost[]> {
    let results = Array.from(this.posts.values()).filter(
      (post) => post.articleId === articleId && post.status !== ('deleted' as RedditPostStatus)
    );

    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      results = results.filter((post) => statuses.includes(post.status));
    }

    // Sort by created date descending
    results.sort(
      (a, b) => new Date(b.audit.createdAt).getTime() - new Date(a.audit.createdAt).getTime()
    );

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  async findByCustomer(
    customerId: CustomerId,
    options?: {
      status?: RedditPostStatus | RedditPostStatus[];
      subreddit?: string;
      fromDate?: ISOTimestamp;
      toDate?: ISOTimestamp;
      limit?: number;
      offset?: number;
    }
  ): Promise<RedditPost[]> {
    let results = Array.from(this.posts.values()).filter(
      (post) => post.customerId === customerId && post.status !== ('deleted' as RedditPostStatus)
    );

    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      results = results.filter((post) => statuses.includes(post.status));
    }

    if (options?.subreddit) {
      results = results.filter(
        (post) => post.subreddit.toLowerCase() === options.subreddit!.toLowerCase()
      );
    }

    if (options?.fromDate) {
      const fromTime = new Date(options.fromDate).getTime();
      results = results.filter((post) => new Date(post.audit.createdAt).getTime() >= fromTime);
    }

    if (options?.toDate) {
      const toTime = new Date(options.toDate).getTime();
      results = results.filter((post) => new Date(post.audit.createdAt).getTime() <= toTime);
    }

    // Sort by created date descending
    results.sort(
      (a, b) => new Date(b.audit.createdAt).getTime() - new Date(a.audit.createdAt).getTime()
    );

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  async findByStatus(
    status: RedditPostStatus,
    options?: {
      customerId?: CustomerId;
      limit?: number;
      offset?: number;
    }
  ): Promise<RedditPost[]> {
    let results = Array.from(this.posts.values()).filter((post) => post.status === status);

    if (options?.customerId) {
      results = results.filter((post) => post.customerId === options.customerId);
    }

    // Sort by created date descending
    results.sort(
      (a, b) => new Date(b.audit.createdAt).getTime() - new Date(a.audit.createdAt).getTime()
    );

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  async findScheduled(startTime: ISOTimestamp, endTime: ISOTimestamp): Promise<RedditPost[]> {
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();

    const results = Array.from(this.posts.values()).filter((post) => {
      if (!post.scheduledFor) return false;
      if (post.status !== ('queued' as RedditPostStatus)) return false;

      const scheduledMs = new Date(post.scheduledFor).getTime();
      return scheduledMs >= startMs && scheduledMs <= endMs;
    });

    // Sort by scheduled time ascending
    results.sort((a, b) => {
      const aTime = new Date(a.scheduledFor!).getTime();
      const bTime = new Date(b.scheduledFor!).getTime();
      return aTime - bTime;
    });

    return results;
  }

  async findNeedingEngagementRefresh(
    olderThanMinutes: number,
    limit: number
  ): Promise<RedditPost[]> {
    const cutoffTime = Date.now() - olderThanMinutes * 60 * 1000;

    const results = Array.from(this.posts.values())
      .filter((post) => {
        if (post.status !== ('posted' as RedditPostStatus)) return false;
        const lastUpdate = new Date(post.engagement.lastUpdatedAt).getTime();
        return lastUpdate < cutoffTime;
      })
      .sort((a, b) => {
        // Sort by last update ascending (oldest first)
        const aTime = new Date(a.engagement.lastUpdatedAt).getTime();
        const bTime = new Date(b.engagement.lastUpdatedAt).getTime();
        return aTime - bTime;
      })
      .slice(0, limit);

    return results;
  }

  async countByStatus(customerId: CustomerId): Promise<Record<RedditPostStatus, number>> {
    const counts: Record<RedditPostStatus, number> = {
      pending_approval: 0,
      approved: 0,
      queued: 0,
      posting: 0,
      posted: 0,
      failed: 0,
      removed: 0,
      deleted: 0,
    } as Record<RedditPostStatus, number>;

    for (const post of this.posts.values()) {
      if (post.customerId === customerId) {
        counts[post.status]++;
      }
    }

    return counts;
  }

  async getEngagementStats(
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
  }> {
    const fromTime = new Date(fromDate).getTime();

    const relevantPosts = Array.from(this.posts.values()).filter((post) => {
      if (post.customerId !== customerId) return false;
      if (post.status !== ('posted' as RedditPostStatus)) return false;
      if (!post.postedAt) return false;
      return new Date(post.postedAt).getTime() >= fromTime;
    });

    const byEngagementLevel: Record<EngagementLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      viral: 0,
    } as Record<EngagementLevel, number>;

    const subredditStats: Map<string, { posts: number; totalScore: number }> = new Map();

    let totalUpvotes = 0;
    let totalComments = 0;
    let totalScore = 0;
    let totalRatio = 0;

    for (const post of relevantPosts) {
      totalUpvotes += post.engagement.upvotes;
      totalComments += post.engagement.comments;
      totalScore += post.engagement.score;
      totalRatio += post.engagement.ratio;
      byEngagementLevel[post.engagement.level]++;

      const existing = subredditStats.get(post.subreddit) ?? { posts: 0, totalScore: 0 };
      existing.posts++;
      existing.totalScore += post.engagement.score;
      subredditStats.set(post.subreddit, existing);
    }

    const totalPosts = relevantPosts.length;
    const averageScore = totalPosts > 0 ? totalScore / totalPosts : 0;
    const averageRatio = totalPosts > 0 ? totalRatio / totalPosts : 0;

    const bySubreddit = Array.from(subredditStats.entries()).map(([subreddit, stats]) => ({
      subreddit,
      posts: stats.posts,
      totalScore: stats.totalScore,
      avgScore: stats.posts > 0 ? stats.totalScore / stats.posts : 0,
    }));

    return {
      totalPosts,
      totalUpvotes,
      totalComments,
      averageScore,
      averageRatio,
      byEngagementLevel,
      bySubreddit,
    };
  }

  async getPostingActivity(
    customerId: CustomerId,
    fromDate: ISOTimestamp,
    toDate: ISOTimestamp
  ): Promise<
    Array<{
      date: string;
      posted: number;
      failed: number;
      engagement: number;
    }>
  > {
    const fromTime = new Date(fromDate).getTime();
    const toTime = new Date(toDate).getTime();

    const dailyStats: Map<string, { posted: number; failed: number; engagement: number }> =
      new Map();

    // Initialize all days in range
    const currentDate = new Date(fromDate);
    const endDate = new Date(toDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dailyStats.set(dateStr, { posted: 0, failed: 0, engagement: 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate posts
    for (const post of this.posts.values()) {
      if (post.customerId !== customerId) continue;

      if (post.status === ('posted' as RedditPostStatus) && post.postedAt) {
        const postedTime = new Date(post.postedAt).getTime();
        if (postedTime >= fromTime && postedTime <= toTime) {
          const dateStr = post.postedAt.split('T')[0];
          const stats = dailyStats.get(dateStr);
          if (stats) {
            stats.posted++;
            stats.engagement += post.engagement.score;
          }
        }
      }

      if (post.status === ('failed' as RedditPostStatus)) {
        const createdTime = new Date(post.audit.createdAt).getTime();
        if (createdTime >= fromTime && createdTime <= toTime) {
          const dateStr = post.audit.createdAt.split('T')[0];
          const stats = dailyStats.get(dateStr);
          if (stats) {
            stats.failed++;
          }
        }
      }
    }

    return Array.from(dailyStats.entries())
      .map(([date, stats]) => ({
        date,
        ...stats,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async countByArticle(articleId: ArticleId): Promise<number> {
    return Array.from(this.posts.values()).filter(
      (post) => post.articleId === articleId && post.status !== ('deleted' as RedditPostStatus)
    ).length;
  }

  async countByCustomer(customerId: CustomerId): Promise<number> {
    return Array.from(this.posts.values()).filter(
      (post) => post.customerId === customerId && post.status !== ('deleted' as RedditPostStatus)
    ).length;
  }
}

// =============================================================================
// IN-MEMORY SUBREDDIT REPOSITORY
// =============================================================================

/**
 * In-memory implementation of ISubredditRepository.
 */
export class InMemorySubredditRepository implements ISubredditRepository {
  private subreddits: Map<string, Subreddit> = new Map();
  private nameIndex: Map<string, string> = new Map();

  async upsert(
    subreddit: Omit<Subreddit, 'id' | 'audit'>,
    createdBy: UserRef
  ): Promise<Subreddit> {
    const normalizedName = subreddit.name.toLowerCase();
    const existingId = this.nameIndex.get(normalizedName);

    if (existingId) {
      // Update existing
      const existing = this.subreddits.get(existingId)!;
      const updated: Subreddit = {
        ...existing,
        ...subreddit,
        id: existing.id,
        audit: updateAuditInfo(existing.audit, createdBy),
      };
      this.subreddits.set(existingId, updated);
      return updated;
    }

    // Create new
    const id = generateId('sub') as SubredditId;
    const newSubreddit: Subreddit = {
      ...subreddit,
      id,
      audit: createAuditInfo(createdBy),
    };

    this.subreddits.set(id, newSubreddit);
    this.nameIndex.set(normalizedName, id);
    return newSubreddit;
  }

  async findById(id: SubredditId): Promise<Subreddit | null> {
    return this.subreddits.get(id) ?? null;
  }

  async findByName(name: string): Promise<Subreddit | null> {
    const normalizedName = name.toLowerCase();
    const id = this.nameIndex.get(normalizedName);
    if (!id) return null;
    return this.subreddits.get(id) ?? null;
  }

  async findTrackedByCustomer(customerId: CustomerId): Promise<Subreddit[]> {
    return Array.from(this.subreddits.values()).filter(
      (sub) => sub.isTracked && sub.trackedByCustomerId === customerId
    );
  }

  async findByTopics(topics: string[], limit: number = 10): Promise<Subreddit[]> {
    const normalizedTopics = topics.map((t) => t.toLowerCase());

    const results = Array.from(this.subreddits.values())
      .filter((sub) => {
        const subTopics = sub.topics.map((t) => t.toLowerCase());
        return normalizedTopics.some((topic) => subTopics.includes(topic));
      })
      .sort((a, b) => b.subscribers - a.subscribers)
      .slice(0, limit);

    return results;
  }

  async updateTracking(
    id: SubredditId,
    customerId: CustomerId,
    isTracked: boolean
  ): Promise<Subreddit> {
    const existing = this.subreddits.get(id);
    if (!existing) {
      throw new Error(`Subreddit not found: ${id}`);
    }

    const updated: Subreddit = {
      ...existing,
      isTracked,
      trackedByCustomerId: isTracked ? customerId : undefined,
      audit: {
        ...existing.audit,
        updatedAt: now(),
      },
    };

    this.subreddits.set(id, updated);
    return updated;
  }

  async findNeedingSync(olderThanHours: number, limit: number): Promise<Subreddit[]> {
    const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;

    return Array.from(this.subreddits.values())
      .filter((sub) => {
        if (!sub.isTracked) return false;
        const lastSync = new Date(sub.lastSyncedAt).getTime();
        return lastSync < cutoffTime;
      })
      .sort((a, b) => {
        const aTime = new Date(a.lastSyncedAt).getTime();
        const bTime = new Date(b.lastSyncedAt).getTime();
        return aTime - bTime;
      })
      .slice(0, limit);
  }
}

// =============================================================================
// IN-MEMORY OAUTH REPOSITORY
// =============================================================================

/**
 * In-memory implementation of IRedditOAuthRepository.
 */
export class InMemoryRedditOAuthRepository implements IRedditOAuthRepository {
  private tokens: Map<string, RedditOAuthToken> = new Map();

  async store(
    token: Omit<RedditOAuthToken, 'audit'>,
    createdBy: UserRef
  ): Promise<RedditOAuthToken> {
    const fullToken: RedditOAuthToken = {
      ...token,
      audit: createAuditInfo(createdBy),
    };

    this.tokens.set(token.customerId, fullToken);
    return fullToken;
  }

  async findByCustomer(customerId: CustomerId): Promise<RedditOAuthToken | null> {
    return this.tokens.get(customerId) ?? null;
  }

  async update(
    customerId: CustomerId,
    updates: Partial<RedditOAuthToken>
  ): Promise<RedditOAuthToken> {
    const existing = this.tokens.get(customerId);
    if (!existing) {
      throw new Error(`OAuth token not found for customer: ${customerId}`);
    }

    const updated: RedditOAuthToken = {
      ...existing,
      ...updates,
      customerId: existing.customerId,
      audit: {
        ...existing.audit,
        updatedAt: now(),
      },
    };

    this.tokens.set(customerId, updated);
    return updated;
  }

  async delete(customerId: CustomerId): Promise<boolean> {
    return this.tokens.delete(customerId);
  }

  async findExpiringSoon(withinMs: number): Promise<RedditOAuthToken[]> {
    const cutoffTime = Date.now() + withinMs;

    return Array.from(this.tokens.values()).filter((token) => {
      if (!token.isValid) return false;
      const expiresAt = new Date(token.expiresAt).getTime();
      return expiresAt <= cutoffTime;
    });
  }

  async findWithRefreshFailures(minFailures: number): Promise<RedditOAuthToken[]> {
    return Array.from(this.tokens.values()).filter(
      (token) => token.refreshFailures >= minFailures
    );
  }
}

// =============================================================================
// IN-MEMORY RATE LIMIT REPOSITORY
// =============================================================================

/**
 * In-memory implementation of IRedditRateLimitRepository.
 */
export class InMemoryRedditRateLimitRepository implements IRedditRateLimitRepository {
  private rateLimits: Map<
    string,
    {
      postsUsed: number;
      commentsUsed: number;
      windowStart: number;
    }
  > = new Map();

  private readonly windowMs = 60 * 60 * 1000; // 1 hour

  private getOrCreateWindow(customerId: CustomerId): {
    postsUsed: number;
    commentsUsed: number;
    windowStart: number;
  } {
    const existing = this.rateLimits.get(customerId);
    const currentTime = Date.now();

    if (!existing || currentTime - existing.windowStart >= this.windowMs) {
      const newWindow = {
        postsUsed: 0,
        commentsUsed: 0,
        windowStart: currentTime,
      };
      this.rateLimits.set(customerId, newWindow);
      return newWindow;
    }

    return existing;
  }

  async getStatus(customerId: CustomerId): Promise<RedditRateLimitStatus> {
    const window = this.getOrCreateWindow(customerId);
    const postsRemaining = Math.max(0, REDDIT_POSTS_PER_HOUR - window.postsUsed);
    const commentsRemaining = Math.max(0, REDDIT_COMMENTS_PER_HOUR - window.commentsUsed);
    const resetsAt = new Date(window.windowStart + this.windowMs).toISOString();
    const isLimited = postsRemaining === 0 || commentsRemaining === 0;
    const waitSeconds = isLimited
      ? Math.ceil((window.windowStart + this.windowMs - Date.now()) / 1000)
      : undefined;

    return {
      customerId,
      postsRemaining,
      commentsRemaining,
      resetsAt,
      isLimited,
      waitSeconds,
    };
  }

  async recordPostAttempt(customerId: CustomerId): Promise<RedditRateLimitStatus> {
    const window = this.getOrCreateWindow(customerId);
    window.postsUsed++;
    this.rateLimits.set(customerId, window);
    return this.getStatus(customerId);
  }

  async recordCommentAttempt(customerId: CustomerId): Promise<RedditRateLimitStatus> {
    const window = this.getOrCreateWindow(customerId);
    window.commentsUsed++;
    this.rateLimits.set(customerId, window);
    return this.getStatus(customerId);
  }

  async reset(customerId: CustomerId): Promise<void> {
    this.rateLimits.delete(customerId);
  }
}
