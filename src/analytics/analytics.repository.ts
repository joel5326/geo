/**
 * @fileoverview Analytics Domain Repository Implementations
 * @description In-memory repository implementations for the Analytics domain.
 * @module analytics/analytics.repository
 * @version 1.0.0
 */

import {
  UtmCampaignId,
  CustomerId,
  ISOTimestamp,
  EngagementLevel,
  Platform,
  UtmCampaign,
  UtmClick,
  LlmMention,
  EngagementMetric,
  PerformanceReport,
  EngagementSnapshot,
  TimeSeriesDataPoint,
  CustomerBaseline,
  CreateCampaignInput,
  ReportPeriod,
  LlmPlatform,
  AnalyticsEntityType,
  AggregationGranularity,
  IUtmCampaignRepository,
  IUtmClickRepository,
  ILlmMentionRepository,
  IEngagementMetricRepository,
  IPerformanceReportRepository,
  TARGET_REDDIT_UPVOTES,
  TARGET_REDDIT_COMMENTS,
} from '../domains/analytics/analytics.types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate current ISO timestamp
 */
function now(): ISOTimestamp {
  return new Date().toISOString() as ISOTimestamp;
}

/**
 * Check if a date string falls within a range
 */
function isWithinDateRange(
  dateStr: ISOTimestamp,
  startDate?: ISOTimestamp,
  endDate?: ISOTimestamp
): boolean {
  if (!startDate && !endDate) return true;
  const date = new Date(dateStr).getTime();
  if (startDate && date < new Date(startDate).getTime()) return false;
  if (endDate && date > new Date(endDate).getTime()) return false;
  return true;
}

/**
 * Calculate engagement level based on metrics
 */
function calculateEngagementLevel(upvotes: number, comments: number): EngagementLevel {
  const meetsUpvoteTarget = upvotes >= TARGET_REDDIT_UPVOTES;
  const meetsCommentTarget = comments >= TARGET_REDDIT_COMMENTS;

  if (upvotes >= TARGET_REDDIT_UPVOTES * 5 || comments >= TARGET_REDDIT_COMMENTS * 5) {
    return EngagementLevel.viral;
  }
  if (upvotes >= TARGET_REDDIT_UPVOTES * 2 || comments >= TARGET_REDDIT_COMMENTS * 2) {
    return EngagementLevel.high;
  }
  if (meetsUpvoteTarget && meetsCommentTarget) {
    return EngagementLevel.medium;
  }
  return EngagementLevel.low;
}

/**
 * Calculate engagement rate
 */
function calculateEngagementRate(
  upvotes: number,
  comments: number,
  shares: number,
  impressions: number
): number {
  if (impressions === 0) return 0;
  return ((upvotes + comments + shares) / impressions) * 100;
}

/**
 * Build UTM tracking URL
 */
function buildTrackingUrl(baseUrl: string, params: CreateCampaignInput): string {
  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', params.source);
  url.searchParams.set('utm_medium', params.medium);
  url.searchParams.set('utm_campaign', params.campaign);
  if (params.content) url.searchParams.set('utm_content', params.content);
  if (params.term) url.searchParams.set('utm_term', params.term);
  return url.toString();
}

// ============================================================================
// UTM CAMPAIGN REPOSITORY
// ============================================================================

/**
 * In-memory implementation of IUtmCampaignRepository
 */
export class InMemoryUtmCampaignRepository implements IUtmCampaignRepository {
  private campaigns: Map<UtmCampaignId, UtmCampaign> = new Map();

  async create(input: CreateCampaignInput): Promise<UtmCampaign> {
    const id = `utm_${crypto.randomUUID()}` as UtmCampaignId;
    const timestamp = now();

    const campaign: UtmCampaign = {
      id,
      customerId: input.customerId,
      source: input.source,
      medium: input.medium,
      campaign: input.campaign,
      content: input.content,
      term: input.term,
      trackingUrl: buildTrackingUrl(input.baseUrl, input),
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.campaigns.set(id, campaign);
    return campaign;
  }

  async findById(id: UtmCampaignId): Promise<UtmCampaign | null> {
    return this.campaigns.get(id) || null;
  }

  async findByCustomer(
    customerId: CustomerId,
    options?: {
      isActive?: boolean;
      source?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<UtmCampaign[]> {
    let results = Array.from(this.campaigns.values()).filter(
      (c) => c.customerId === customerId
    );

    if (options?.isActive !== undefined) {
      results = results.filter((c) => c.isActive === options.isActive);
    }
    if (options?.source) {
      results = results.filter((c) => c.source === options.source);
    }

    // Sort by createdAt descending
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async countByCustomer(
    customerId: CustomerId,
    options?: {
      isActive?: boolean;
      source?: string;
    }
  ): Promise<number> {
    let count = 0;
    for (const campaign of this.campaigns.values()) {
      if (campaign.customerId !== customerId) continue;
      if (options?.isActive !== undefined && campaign.isActive !== options.isActive) continue;
      if (options?.source && campaign.source !== options.source) continue;
      count++;
    }
    return count;
  }

  async update(id: UtmCampaignId, updates: Partial<UtmCampaign>): Promise<UtmCampaign> {
    const campaign = this.campaigns.get(id);
    if (!campaign) {
      throw new Error(`Campaign not found: ${id}`);
    }

    const updated: UtmCampaign = {
      ...campaign,
      ...updates,
      id: campaign.id, // Prevent ID override
      updatedAt: now(),
    };

    this.campaigns.set(id, updated);
    return updated;
  }

  async findByTrackingUrl(trackingUrl: string): Promise<UtmCampaign | null> {
    for (const campaign of this.campaigns.values()) {
      if (campaign.trackingUrl === trackingUrl) {
        return campaign;
      }
    }
    return null;
  }

  async findByEntity(
    entityType: 'article' | 'redditPost',
    entityId: string
  ): Promise<UtmCampaign[]> {
    return Array.from(this.campaigns.values()).filter((c) => {
      if (entityType === 'article' && c.articleRef?.id === entityId) return true;
      if (entityType === 'redditPost' && c.redditPostRef?.id === entityId) return true;
      return false;
    });
  }
}

// ============================================================================
// UTM CLICK REPOSITORY
// ============================================================================

/**
 * In-memory implementation of IUtmClickRepository
 */
export class InMemoryUtmClickRepository implements IUtmClickRepository {
  private clicks: Map<string, UtmClick> = new Map();

  async create(input: Omit<UtmClick, 'id'>): Promise<UtmClick> {
    const id = `clk_${crypto.randomUUID()}`;

    const click: UtmClick = {
      ...input,
      id,
    };

    this.clicks.set(id, click);
    return click;
  }

  async findByCampaign(
    campaignId: UtmCampaignId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      limit?: number;
      offset?: number;
    }
  ): Promise<UtmClick[]> {
    let results = Array.from(this.clicks.values()).filter(
      (c) => c.campaignId === campaignId
    );

    if (options?.startDate || options?.endDate) {
      results = results.filter((c) =>
        isWithinDateRange(c.timestamp, options?.startDate, options?.endDate)
      );
    }

    // Sort by timestamp descending
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async countByCampaign(
    campaignId: UtmCampaignId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<number> {
    let count = 0;
    for (const click of this.clicks.values()) {
      if (click.campaignId !== campaignId) continue;
      if (!isWithinDateRange(click.timestamp, options?.startDate, options?.endDate)) continue;
      count++;
    }
    return count;
  }

  async countUniqueVisitors(
    campaignId: UtmCampaignId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<number> {
    const ipHashes = new Set<string>();
    for (const click of this.clicks.values()) {
      if (click.campaignId !== campaignId) continue;
      if (!isWithinDateRange(click.timestamp, options?.startDate, options?.endDate)) continue;
      if (click.ipHash) {
        ipHashes.add(click.ipHash);
      }
    }
    return ipHashes.size;
  }

  async aggregateByDevice(
    campaignId: UtmCampaignId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<Record<'mobile' | 'desktop' | 'tablet', number>> {
    const result = { mobile: 0, desktop: 0, tablet: 0 };

    for (const click of this.clicks.values()) {
      if (click.campaignId !== campaignId) continue;
      if (!isWithinDateRange(click.timestamp, options?.startDate, options?.endDate)) continue;
      if (click.deviceType) {
        result[click.deviceType]++;
      }
    }

    return result;
  }

  async aggregateByCountry(
    campaignId: UtmCampaignId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      limit?: number;
    }
  ): Promise<Array<{ country: string; clicks: number }>> {
    const countryMap = new Map<string, number>();

    for (const click of this.clicks.values()) {
      if (click.campaignId !== campaignId) continue;
      if (!isWithinDateRange(click.timestamp, options?.startDate, options?.endDate)) continue;
      if (click.country) {
        countryMap.set(click.country, (countryMap.get(click.country) || 0) + 1);
      }
    }

    const results = Array.from(countryMap.entries())
      .map(([country, clicks]) => ({ country, clicks }))
      .sort((a, b) => b.clicks - a.clicks);

    return options?.limit ? results.slice(0, options.limit) : results;
  }

  async getTimeSeries(
    campaignId: UtmCampaignId,
    granularity: AggregationGranularity,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<TimeSeriesDataPoint[]> {
    const buckets = new Map<string, number>();

    for (const click of this.clicks.values()) {
      if (click.campaignId !== campaignId) continue;
      if (!isWithinDateRange(click.timestamp, options?.startDate, options?.endDate)) continue;

      const date = new Date(click.timestamp);
      let key: string;

      switch (granularity) {
        case AggregationGranularity.hourly:
          key = `${date.toISOString().slice(0, 13)}:00:00.000Z`;
          break;
        case AggregationGranularity.daily:
          key = `${date.toISOString().slice(0, 10)}T00:00:00.000Z`;
          break;
        case AggregationGranularity.weekly:
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `${weekStart.toISOString().slice(0, 10)}T00:00:00.000Z`;
          break;
        case AggregationGranularity.monthly:
          key = `${date.toISOString().slice(0, 7)}-01T00:00:00.000Z`;
          break;
        default:
          key = date.toISOString();
      }

      buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    return Array.from(buckets.entries())
      .map(([timestamp, value]) => ({ timestamp: timestamp as ISOTimestamp, value }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}

// ============================================================================
// LLM MENTION REPOSITORY
// ============================================================================

/**
 * In-memory implementation of ILlmMentionRepository
 */
export class InMemoryLlmMentionRepository implements ILlmMentionRepository {
  private mentions: Map<string, LlmMention> = new Map();

  async create(input: Omit<LlmMention, 'id'>): Promise<LlmMention> {
    const id = `mnt_${crypto.randomUUID()}`;

    const mention: LlmMention = {
      ...input,
      id,
    };

    this.mentions.set(id, mention);
    return mention;
  }

  async createMany(inputs: Omit<LlmMention, 'id'>[]): Promise<LlmMention[]> {
    const results: LlmMention[] = [];
    for (const input of inputs) {
      const mention = await this.create(input);
      results.push(mention);
    }
    return results;
  }

  async findById(id: string): Promise<LlmMention | null> {
    return this.mentions.get(id) || null;
  }

  async findByPeecReferenceId(peecReferenceId: string): Promise<LlmMention | null> {
    for (const mention of this.mentions.values()) {
      if (mention.peecReferenceId === peecReferenceId) {
        return mention;
      }
    }
    return null;
  }

  async findByCustomer(
    customerId: CustomerId,
    options?: {
      platform?: LlmPlatform;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      sentiment?: 'positive' | 'neutral' | 'negative';
      limit?: number;
      offset?: number;
    }
  ): Promise<LlmMention[]> {
    let results = Array.from(this.mentions.values()).filter(
      (m) => m.customerId === customerId
    );

    if (options?.platform) {
      results = results.filter((m) => m.platform === options.platform);
    }
    if (options?.sentiment) {
      results = results.filter((m) => m.sentiment === options.sentiment);
    }
    if (options?.startDate || options?.endDate) {
      results = results.filter((m) =>
        isWithinDateRange(m.detectedAt, options?.startDate, options?.endDate)
      );
    }

    // Sort by detectedAt descending
    results.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async countByCustomer(
    customerId: CustomerId,
    options?: {
      platform?: LlmPlatform;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      sentiment?: 'positive' | 'neutral' | 'negative';
    }
  ): Promise<number> {
    let count = 0;
    for (const mention of this.mentions.values()) {
      if (mention.customerId !== customerId) continue;
      if (options?.platform && mention.platform !== options.platform) continue;
      if (options?.sentiment && mention.sentiment !== options.sentiment) continue;
      if (!isWithinDateRange(mention.detectedAt, options?.startDate, options?.endDate)) continue;
      count++;
    }
    return count;
  }

  async aggregateByPlatform(
    customerId: CustomerId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<Array<{ platform: LlmPlatform; count: number }>> {
    const platformMap = new Map<LlmPlatform, number>();

    for (const mention of this.mentions.values()) {
      if (mention.customerId !== customerId) continue;
      if (!isWithinDateRange(mention.detectedAt, options?.startDate, options?.endDate)) continue;
      platformMap.set(mention.platform, (platformMap.get(mention.platform) || 0) + 1);
    }

    return Array.from(platformMap.entries())
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getTimeSeries(
    customerId: CustomerId,
    granularity: AggregationGranularity,
    options?: {
      platform?: LlmPlatform;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<TimeSeriesDataPoint[]> {
    const buckets = new Map<string, number>();

    for (const mention of this.mentions.values()) {
      if (mention.customerId !== customerId) continue;
      if (options?.platform && mention.platform !== options.platform) continue;
      if (!isWithinDateRange(mention.detectedAt, options?.startDate, options?.endDate)) continue;

      const date = new Date(mention.detectedAt);
      let key: string;

      switch (granularity) {
        case AggregationGranularity.hourly:
          key = `${date.toISOString().slice(0, 13)}:00:00.000Z`;
          break;
        case AggregationGranularity.daily:
          key = `${date.toISOString().slice(0, 10)}T00:00:00.000Z`;
          break;
        case AggregationGranularity.weekly:
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `${weekStart.toISOString().slice(0, 10)}T00:00:00.000Z`;
          break;
        case AggregationGranularity.monthly:
          key = `${date.toISOString().slice(0, 7)}-01T00:00:00.000Z`;
          break;
        default:
          key = date.toISOString();
      }

      buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    return Array.from(buckets.entries())
      .map(([timestamp, value]) => ({ timestamp: timestamp as ISOTimestamp, value }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getLatestSyncTimestamp(customerId: CustomerId): Promise<ISOTimestamp | null> {
    let latest: ISOTimestamp | null = null;

    for (const mention of this.mentions.values()) {
      if (mention.customerId !== customerId) continue;
      if (!latest || new Date(mention.detectedAt) > new Date(latest)) {
        latest = mention.detectedAt;
      }
    }

    return latest;
  }
}

// ============================================================================
// ENGAGEMENT METRIC REPOSITORY
// ============================================================================

/**
 * In-memory implementation of IEngagementMetricRepository
 */
export class InMemoryEngagementMetricRepository implements IEngagementMetricRepository {
  private metrics: Map<string, EngagementMetric> = new Map();
  private snapshots: Map<string, EngagementSnapshot[]> = new Map();

  private getKey(entityType: AnalyticsEntityType, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  async upsert(
    entityType: AnalyticsEntityType,
    entityId: string,
    metrics: Partial<{
      customerId: CustomerId;
      upvotes: number;
      comments: number;
      shares: number;
      clicks: number;
      impressions: number;
      platform: Platform;
    }>
  ): Promise<EngagementMetric> {
    const key = this.getKey(entityType, entityId);
    const existing = this.metrics.get(key);
    const timestamp = now();

    const upvotes = metrics.upvotes ?? existing?.upvotes ?? 0;
    const comments = metrics.comments ?? existing?.comments ?? 0;
    const shares = metrics.shares ?? existing?.shares ?? 0;
    const clicks = metrics.clicks ?? existing?.clicks ?? 0;
    const impressions = metrics.impressions ?? existing?.impressions ?? 0;

    const engagementLevel = calculateEngagementLevel(upvotes, comments);
    const engagementRate = calculateEngagementRate(upvotes, comments, shares, impressions);
    const meetsTargets = upvotes >= TARGET_REDDIT_UPVOTES && comments >= TARGET_REDDIT_COMMENTS;

    const metric: EngagementMetric = {
      id: existing?.id || `eng_${crypto.randomUUID()}`,
      entityType,
      entityId,
      customerId: metrics.customerId ?? existing?.customerId ?? ('' as CustomerId),
      upvotes,
      comments,
      shares,
      clicks,
      impressions,
      engagementRate,
      engagementLevel,
      meetsTargets,
      platform: metrics.platform ?? existing?.platform ?? Platform.reddit,
      firstRecordedAt: existing?.firstRecordedAt ?? timestamp,
      lastUpdatedAt: timestamp,
    };

    this.metrics.set(key, metric);
    return metric;
  }

  async findByEntity(
    entityType: AnalyticsEntityType,
    entityId: string
  ): Promise<EngagementMetric | null> {
    const key = this.getKey(entityType, entityId);
    return this.metrics.get(key) || null;
  }

  async findByCustomer(
    customerId: CustomerId,
    options?: {
      entityTypes?: AnalyticsEntityType[];
      engagementLevel?: EngagementLevel;
      meetsTargets?: boolean;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      limit?: number;
      offset?: number;
    }
  ): Promise<EngagementMetric[]> {
    let results = Array.from(this.metrics.values()).filter(
      (m) => m.customerId === customerId
    );

    if (options?.entityTypes?.length) {
      results = results.filter((m) => options.entityTypes!.includes(m.entityType));
    }
    if (options?.engagementLevel) {
      results = results.filter((m) => m.engagementLevel === options.engagementLevel);
    }
    if (options?.meetsTargets !== undefined) {
      results = results.filter((m) => m.meetsTargets === options.meetsTargets);
    }
    if (options?.startDate || options?.endDate) {
      results = results.filter((m) =>
        isWithinDateRange(m.lastUpdatedAt, options?.startDate, options?.endDate)
      );
    }

    // Sort by lastUpdatedAt descending
    results.sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async aggregate(
    customerId: CustomerId,
    options?: {
      entityTypes?: AnalyticsEntityType[];
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      groupBy?: 'entityType' | 'platform' | 'day' | 'week';
    }
  ): Promise<{
    totals: {
      upvotes: number;
      comments: number;
      shares: number;
      clicks: number;
      impressions: number;
    };
    byGroup?: Record<string, {
      upvotes: number;
      comments: number;
      shares: number;
      clicks: number;
      impressions: number;
    }>;
  }> {
    const totals = { upvotes: 0, comments: 0, shares: 0, clicks: 0, impressions: 0 };
    const groups = new Map<string, typeof totals>();

    for (const metric of this.metrics.values()) {
      if (metric.customerId !== customerId) continue;
      if (options?.entityTypes?.length && !options.entityTypes.includes(metric.entityType)) continue;
      if (!isWithinDateRange(metric.lastUpdatedAt, options?.startDate, options?.endDate)) continue;

      totals.upvotes += metric.upvotes;
      totals.comments += metric.comments;
      totals.shares += metric.shares;
      totals.clicks += metric.clicks;
      totals.impressions += metric.impressions;

      if (options?.groupBy) {
        let groupKey: string;
        switch (options.groupBy) {
          case 'entityType':
            groupKey = metric.entityType;
            break;
          case 'platform':
            groupKey = metric.platform;
            break;
          case 'day':
            groupKey = metric.lastUpdatedAt.slice(0, 10);
            break;
          case 'week':
            const date = new Date(metric.lastUpdatedAt);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            groupKey = weekStart.toISOString().slice(0, 10);
            break;
          default:
            groupKey = 'default';
        }

        const existing = groups.get(groupKey) || { upvotes: 0, comments: 0, shares: 0, clicks: 0, impressions: 0 };
        existing.upvotes += metric.upvotes;
        existing.comments += metric.comments;
        existing.shares += metric.shares;
        existing.clicks += metric.clicks;
        existing.impressions += metric.impressions;
        groups.set(groupKey, existing);
      }
    }

    const result: ReturnType<IEngagementMetricRepository['aggregate']> extends Promise<infer R> ? R : never = { totals };
    if (options?.groupBy && groups.size > 0) {
      result.byGroup = Object.fromEntries(groups);
    }

    return result;
  }

  async recordSnapshot(
    entityType: AnalyticsEntityType,
    entityId: string,
    snapshot: EngagementSnapshot
  ): Promise<void> {
    const key = this.getKey(entityType, entityId);
    const existing = this.snapshots.get(key) || [];
    existing.push(snapshot);
    this.snapshots.set(key, existing);

    // Also update the metric's history
    const metric = this.metrics.get(key);
    if (metric) {
      metric.history = existing;
    }
  }

  async getTopPerforming(
    customerId: CustomerId,
    options?: {
      entityType?: AnalyticsEntityType;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      orderBy?: 'upvotes' | 'comments' | 'clicks' | 'total';
      limit?: number;
    }
  ): Promise<EngagementMetric[]> {
    let results = Array.from(this.metrics.values()).filter(
      (m) => m.customerId === customerId
    );

    if (options?.entityType) {
      results = results.filter((m) => m.entityType === options.entityType);
    }
    if (options?.startDate || options?.endDate) {
      results = results.filter((m) =>
        isWithinDateRange(m.lastUpdatedAt, options?.startDate, options?.endDate)
      );
    }

    const orderBy = options?.orderBy || 'total';
    results.sort((a, b) => {
      switch (orderBy) {
        case 'upvotes':
          return b.upvotes - a.upvotes;
        case 'comments':
          return b.comments - a.comments;
        case 'clicks':
          return b.clicks - a.clicks;
        case 'total':
        default:
          return (b.upvotes + b.comments + b.clicks) - (a.upvotes + a.comments + a.clicks);
      }
    });

    return results.slice(0, options?.limit || 10);
  }

  async countMeetingTargets(
    customerId: CustomerId,
    options?: {
      entityTypes?: AnalyticsEntityType[];
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<{
    total: number;
    meetingTargets: number;
    rate: number;
  }> {
    let total = 0;
    let meetingTargets = 0;

    for (const metric of this.metrics.values()) {
      if (metric.customerId !== customerId) continue;
      if (options?.entityTypes?.length && !options.entityTypes.includes(metric.entityType)) continue;
      if (!isWithinDateRange(metric.lastUpdatedAt, options?.startDate, options?.endDate)) continue;

      total++;
      if (metric.meetsTargets) {
        meetingTargets++;
      }
    }

    return {
      total,
      meetingTargets,
      rate: total > 0 ? meetingTargets / total : 0,
    };
  }
}

// ============================================================================
// PERFORMANCE REPORT REPOSITORY
// ============================================================================

/**
 * In-memory implementation of IPerformanceReportRepository
 */
export class InMemoryPerformanceReportRepository implements IPerformanceReportRepository {
  private reports: Map<string, PerformanceReport> = new Map();

  async create(input: Omit<PerformanceReport, 'id'>): Promise<PerformanceReport> {
    const id = `rpt_${crypto.randomUUID()}`;

    const report: PerformanceReport = {
      ...input,
      id,
    };

    this.reports.set(id, report);
    return report;
  }

  async findById(id: string): Promise<PerformanceReport | null> {
    return this.reports.get(id) || null;
  }

  async findByCustomer(
    customerId: CustomerId,
    options?: {
      period?: ReportPeriod;
      status?: 'generating' | 'ready' | 'failed';
      limit?: number;
      offset?: number;
    }
  ): Promise<PerformanceReport[]> {
    let results = Array.from(this.reports.values()).filter(
      (r) => r.customerId === customerId
    );

    if (options?.period) {
      results = results.filter((r) => r.period === options.period);
    }
    if (options?.status) {
      results = results.filter((r) => r.status === options.status);
    }

    // Sort by generatedAt descending
    results.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async updateStatus(
    id: string,
    status: 'generating' | 'ready' | 'failed'
  ): Promise<PerformanceReport> {
    const report = this.reports.get(id);
    if (!report) {
      throw new Error(`Report not found: ${id}`);
    }

    report.status = status;
    this.reports.set(id, report);
    return report;
  }

  async findMostRecent(
    customerId: CustomerId,
    period?: ReportPeriod
  ): Promise<PerformanceReport | null> {
    const reports = await this.findByCustomer(customerId, {
      period,
      status: 'ready',
      limit: 1,
    });
    return reports[0] || null;
  }
}

// ============================================================================
// CUSTOMER BASELINE REPOSITORY
// ============================================================================

/**
 * Interface for CustomerBaseline persistence
 */
export interface ICustomerBaselineRepository {
  set(customerId: CustomerId, baseline: Omit<CustomerBaseline, 'customerId' | 'createdAt'>): Promise<CustomerBaseline>;
  get(customerId: CustomerId): Promise<CustomerBaseline | null>;
}

/**
 * In-memory implementation of ICustomerBaselineRepository
 */
export class InMemoryCustomerBaselineRepository implements ICustomerBaselineRepository {
  private baselines: Map<CustomerId, CustomerBaseline> = new Map();

  async set(
    customerId: CustomerId,
    baseline: Omit<CustomerBaseline, 'customerId' | 'createdAt'>
  ): Promise<CustomerBaseline> {
    const record: CustomerBaseline = {
      customerId,
      llmMentions: baseline.llmMentions,
      monthlyTraffic: baseline.monthlyTraffic,
      recordedAt: baseline.recordedAt,
      createdAt: now(),
    };

    this.baselines.set(customerId, record);
    return record;
  }

  async get(customerId: CustomerId): Promise<CustomerBaseline | null> {
    return this.baselines.get(customerId) || null;
  }
}
