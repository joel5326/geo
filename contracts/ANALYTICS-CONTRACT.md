# ANALYTICS Domain Contract

> **Version**: 1.0.0
> **Domain**: Analytics
> **Owner**: Analytics Agent
> **Last Updated**: 2026-01-18

This contract defines the complete interface for the Analytics domain in the LEO Automation Platform. The Analytics domain is responsible for UTM tracking, engagement metrics aggregation, LLM mention tracking (via peec.ai integration), and performance reporting. All implementations must adhere to these types and interfaces.

---

## Table of Contents

1. [Imports from Shared Primitives](#imports-from-shared-primitives)
2. [Cross-Domain References](#cross-domain-references)
3. [Domain-Specific Types](#domain-specific-types)
4. [Service Interface](#service-interface)
5. [Repository Interfaces](#repository-interfaces)
6. [API Routes](#api-routes)
7. [Validation Schemas](#validation-schemas)
8. [Error Codes](#error-codes)
9. [Integration Points](#integration-points)

---

## Imports from Shared Primitives

```typescript
import {
  // Identity Types
  UtmCampaignId,
  ArticleId,
  RedditPostId,
  CustomerId,
  UserId,
  ClearStoryId,

  // Enums
  EngagementLevel,
  Platform,
  ArticleStatus,
  RedditPostStatus,

  // Cross-Domain References
  ArticleRef,
  RedditPostRef,
  CustomerRef,
  ClearStoryRef,

  // API Patterns
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  UtmParams,
  AuditInfo,
  ISOTimestamp,

  // Constants
  TARGET_LLM_MENTION_INCREASE,   // 0.20 (20%)
  TARGET_TRAFFIC_INCREASE,        // 0.50 (50%)
  TARGET_REDDIT_UPVOTES,          // 10
  TARGET_REDDIT_COMMENTS          // 2
} from './shared-primitives';
```

---

## Cross-Domain References

### ArticleRef

Reference to articles from the Article domain. The Analytics domain reads this but does not own it.

```typescript
/**
 * Minimal article reference used by Analytics domain.
 * The Article domain owns the full Article entity.
 */
export interface ArticleRef {
  /** Unique article identifier */
  id: ArticleId;

  /** Article title */
  title: string;

  /** Current article status */
  status: ArticleStatus;

  /** Published URL if article is published */
  publishedUrl?: string;
}
```

### RedditPostRef

Reference to Reddit posts from the Reddit Distribution domain.

```typescript
/**
 * Minimal Reddit post reference used by Analytics domain.
 * The Reddit Distribution domain owns the full RedditPost entity.
 */
export interface RedditPostRef {
  /** Internal Reddit post identifier */
  id: RedditPostId;

  /** Reddit's native post ID (t3_xxxxx format) */
  redditExternalId?: string;

  /** Subreddit where posted */
  subreddit: string;

  /** Current post status */
  status: RedditPostStatus;

  /** Permalink to the Reddit post */
  permalink?: string;
}
```

### ClearStoryRef

Reference to Clear Stories from the Clear Story domain.

```typescript
/**
 * Minimal Clear Story reference used by Analytics domain.
 * The Clear Story domain owns the full ClearStory entity.
 */
export interface ClearStoryRef {
  /** Unique Clear Story identifier */
  id: ClearStoryId;

  /** Topic/category of the belief */
  topic: string;

  /** First 200 characters of the belief text */
  beliefSummary: string;
}
```

---

## Domain-Specific Types

### Report Period Enum

```typescript
/**
 * Time periods for analytics reports.
 * Determines the granularity and range of report data.
 */
export enum ReportPeriod {
  /** Daily report (last 24 hours) */
  daily = 'daily',

  /** Weekly report (last 7 days) */
  weekly = 'weekly',

  /** Bi-weekly report (last 14 days) */
  biweekly = 'biweekly',

  /** Monthly report (last 30 days) */
  monthly = 'monthly',

  /** Quarterly report (last 90 days) */
  quarterly = 'quarterly',

  /** Custom date range */
  custom = 'custom'
}
```

### Metric Type Enum

```typescript
/**
 * Types of metrics tracked by the Analytics domain.
 */
export enum MetricType {
  /** Number of upvotes on content */
  upvotes = 'upvotes',

  /** Number of comments on content */
  comments = 'comments',

  /** Number of shares/cross-posts */
  shares = 'shares',

  /** Number of link clicks (UTM tracked) */
  clicks = 'clicks',

  /** Number of content impressions/views */
  impressions = 'impressions',

  /** Number of LLM mentions detected */
  llmMentions = 'llm_mentions',

  /** Website traffic from distributed content */
  traffic = 'traffic',

  /** Engagement rate (interactions / impressions) */
  engagementRate = 'engagement_rate'
}
```

### Aggregation Granularity Enum

```typescript
/**
 * Granularity options for time-series aggregation.
 */
export enum AggregationGranularity {
  /** Hourly data points */
  hourly = 'hourly',

  /** Daily data points */
  daily = 'daily',

  /** Weekly data points */
  weekly = 'weekly',

  /** Monthly data points */
  monthly = 'monthly'
}
```

### Entity Type Enum

```typescript
/**
 * Types of entities that can have engagement metrics.
 */
export enum AnalyticsEntityType {
  /** Blog article */
  article = 'article',

  /** Reddit post */
  redditPost = 'reddit_post',

  /** UTM campaign */
  utmCampaign = 'utm_campaign',

  /** Clear Story */
  clearStory = 'clear_story'
}
```

### LLM Platform Enum

```typescript
/**
 * LLM platforms where mentions are tracked via peec.ai.
 */
export enum LlmPlatform {
  /** OpenAI ChatGPT */
  chatgpt = 'chatgpt',

  /** Anthropic Claude */
  claude = 'claude',

  /** Google Gemini */
  gemini = 'gemini',

  /** Perplexity AI */
  perplexity = 'perplexity',

  /** Microsoft Copilot */
  copilot = 'copilot',

  /** Meta Llama-based products */
  llama = 'llama',

  /** Other/Unknown LLM */
  other = 'other'
}
```

### UtmCampaign

```typescript
/**
 * UTM tracking campaign for content distribution.
 * Associates UTM parameters with specific content and customers.
 */
export interface UtmCampaign {
  /** Unique campaign identifier (utm_${uuid}) */
  id: UtmCampaignId;

  /** Customer this campaign belongs to */
  customerId: CustomerId;

  /** Traffic source (e.g., "reddit", "quora") */
  source: string;

  /** Marketing medium (e.g., "social", "organic") */
  medium: string;

  /** Campaign name (e.g., "leo_phase1_jan2026") */
  campaign: string;

  /** Content identifier (e.g., article or post ID) */
  content?: string;

  /** Search term if applicable */
  term?: string;

  /** Associated article if this campaign tracks an article */
  articleRef?: ArticleRef;

  /** Associated Reddit post if this campaign tracks a post */
  redditPostRef?: RedditPostRef;

  /** Full UTM URL for the campaign */
  trackingUrl: string;

  /** Whether this campaign is currently active */
  isActive: boolean;

  /** When the campaign was created */
  createdAt: ISOTimestamp;

  /** When the campaign was last updated */
  updatedAt: ISOTimestamp;
}
```

### UtmClick

```typescript
/**
 * Individual click event recorded via UTM tracking.
 * Captures visitor information for analytics.
 */
export interface UtmClick {
  /** Unique click identifier */
  id: string;

  /** Campaign this click belongs to */
  campaignId: UtmCampaignId;

  /** When the click occurred */
  timestamp: ISOTimestamp;

  /** Referring URL (where the user came from) */
  referrer?: string;

  /** User agent string of the visitor's browser */
  userAgent?: string;

  /** Hashed IP address for privacy-compliant tracking */
  ipHash?: string;

  /** Country code derived from IP (e.g., "US", "UK") */
  country?: string;

  /** Device type (mobile, desktop, tablet) */
  deviceType?: 'mobile' | 'desktop' | 'tablet';

  /** Landing page URL */
  landingPage: string;

  /** Session identifier for grouping clicks */
  sessionId?: string;
}
```

### LlmMention

```typescript
/**
 * LLM mention detected via peec.ai integration.
 * Tracks when and how a customer's brand is mentioned in LLM responses.
 */
export interface LlmMention {
  /** Unique mention identifier */
  id: string;

  /** Customer whose brand was mentioned */
  customerId: CustomerId;

  /** LLM platform where mention was detected */
  platform: LlmPlatform;

  /** The query/prompt that triggered the mention */
  query: string;

  /** The actual mention text from the LLM response */
  mentionText: string;

  /** Context surrounding the mention (up to 500 chars before/after) */
  context?: string;

  /** Sentiment of the mention (positive, neutral, negative) */
  sentiment?: 'positive' | 'neutral' | 'negative';

  /** When the mention was detected */
  detectedAt: ISOTimestamp;

  /** Source of the detection (peec.ai API endpoint) */
  source: string;

  /** peec.ai internal reference ID */
  peecReferenceId?: string;

  /** Keywords that triggered the mention */
  keywords?: string[];

  /** Associated Clear Story if the mention relates to specific content */
  clearStoryRef?: ClearStoryRef;

  /** Confidence score of the mention detection (0-1) */
  confidence?: number;
}
```

### EngagementMetric

```typescript
/**
 * Aggregated engagement metrics for a tracked entity.
 * Updated periodically from platform APIs and event processing.
 */
export interface EngagementMetric {
  /** Unique metric record identifier */
  id: string;

  /** Type of entity being tracked */
  entityType: AnalyticsEntityType;

  /** ID of the tracked entity (ArticleId, RedditPostId, etc.) */
  entityId: string;

  /** Customer who owns this content */
  customerId: CustomerId;

  /** Number of upvotes (Reddit) or likes */
  upvotes: number;

  /** Number of comments */
  comments: number;

  /** Number of shares or cross-posts */
  shares: number;

  /** Number of UTM-tracked clicks */
  clicks: number;

  /** Number of impressions/views */
  impressions: number;

  /** Calculated engagement rate */
  engagementRate: number;

  /** Engagement level classification based on targets */
  engagementLevel: EngagementLevel;

  /** Whether this content meets Phase 1 success targets */
  meetsTargets: boolean;

  /** Platform where engagement occurred */
  platform: Platform;

  /** When metrics were first recorded */
  firstRecordedAt: ISOTimestamp;

  /** When metrics were last updated */
  lastUpdatedAt: ISOTimestamp;

  /** Historical snapshots for trend analysis */
  history?: EngagementSnapshot[];
}

/**
 * Point-in-time snapshot of engagement metrics.
 */
export interface EngagementSnapshot {
  /** When this snapshot was taken */
  timestamp: ISOTimestamp;

  /** Metrics at this point in time */
  upvotes: number;
  comments: number;
  shares: number;
  clicks: number;
  impressions: number;
}
```

### PerformanceReport

```typescript
/**
 * Comprehensive performance report for a customer.
 * Aggregates all metrics across content and time periods.
 */
export interface PerformanceReport {
  /** Unique report identifier */
  id: string;

  /** Customer this report is for */
  customerId: CustomerId;

  /** Reference to the customer entity */
  customerRef: CustomerRef;

  /** Report period type */
  period: ReportPeriod;

  /** Report start date */
  startDate: ISOTimestamp;

  /** Report end date */
  endDate: ISOTimestamp;

  /** Summary statistics */
  summary: {
    /** Total articles published in period */
    totalArticles: number;

    /** Total Reddit posts made in period */
    totalRedditPosts: number;

    /** Total engagement across all content */
    totalEngagement: {
      upvotes: number;
      comments: number;
      shares: number;
      clicks: number;
      impressions: number;
    };

    /** Total LLM mentions detected in period */
    totalLlmMentions: number;

    /** Average engagement per piece of content */
    averageEngagement: number;

    /** Content success rate (meeting targets) */
    successRate: number;
  };

  /** Performance against Phase 1 targets */
  targets: {
    /** LLM mention change percentage vs baseline */
    llmMentionChange: number;

    /** Target: 20% increase */
    llmMentionTarget: number;

    /** Whether LLM mention target is met */
    llmMentionTargetMet: boolean;

    /** Traffic change percentage vs baseline */
    trafficChange: number;

    /** Target: 50% increase */
    trafficTarget: number;

    /** Whether traffic target is met */
    trafficTargetMet: boolean;

    /** Percentage of posts meeting upvote target */
    upvoteTargetRate: number;

    /** Percentage of posts meeting comment target */
    commentTargetRate: number;
  };

  /** Article performance breakdown */
  articles: ArticlePerformance[];

  /** Reddit post performance breakdown */
  redditPosts: RedditPostPerformance[];

  /** LLM mention breakdown by platform */
  llmMentionsByPlatform: LlmMentionBreakdown[];

  /** Traffic sources breakdown */
  trafficSources: TrafficSourceBreakdown[];

  /** When report was generated */
  generatedAt: ISOTimestamp;

  /** Report status */
  status: 'generating' | 'ready' | 'failed';
}

/**
 * Individual article performance within a report.
 */
export interface ArticlePerformance {
  /** Article reference */
  articleRef: ArticleRef;

  /** Total clicks from this article */
  clicks: number;

  /** Associated Reddit posts count */
  redditPostsCount: number;

  /** Total engagement from associated posts */
  totalEngagement: number;

  /** Whether this article's content meets targets */
  meetsTargets: boolean;
}

/**
 * Individual Reddit post performance within a report.
 */
export interface RedditPostPerformance {
  /** Reddit post reference */
  redditPostRef: RedditPostRef;

  /** Upvote count */
  upvotes: number;

  /** Comment count */
  comments: number;

  /** Click count (UTM tracked) */
  clicks: number;

  /** Engagement level */
  engagementLevel: EngagementLevel;

  /** Whether this post meets targets */
  meetsTargets: boolean;
}

/**
 * LLM mention breakdown by platform.
 */
export interface LlmMentionBreakdown {
  /** LLM platform */
  platform: LlmPlatform;

  /** Number of mentions on this platform */
  count: number;

  /** Percentage of total mentions */
  percentage: number;

  /** Change from previous period */
  changeFromPrevious: number;
}

/**
 * Traffic source breakdown.
 */
export interface TrafficSourceBreakdown {
  /** Traffic source name */
  source: string;

  /** Medium (social, organic, etc.) */
  medium: string;

  /** Number of visits */
  visits: number;

  /** Percentage of total traffic */
  percentage: number;
}
```

### MetricTimeSeries

```typescript
/**
 * Time series data for a specific metric.
 * Used for charting and trend analysis.
 */
export interface MetricTimeSeries {
  /** Type of metric being tracked */
  metric: MetricType;

  /** Entity being measured (or 'all' for aggregate) */
  entityType: AnalyticsEntityType | 'all';

  /** Entity ID if specific entity (null for aggregate) */
  entityId: string | null;

  /** Customer ID for this time series */
  customerId: CustomerId;

  /** Aggregation granularity */
  granularity: AggregationGranularity;

  /** Data points in chronological order */
  dataPoints: TimeSeriesDataPoint[];

  /** Statistical summary */
  statistics: {
    /** Minimum value in series */
    min: number;

    /** Maximum value in series */
    max: number;

    /** Average value */
    average: number;

    /** Median value */
    median: number;

    /** Standard deviation */
    stdDev: number;

    /** Trend direction */
    trend: 'increasing' | 'decreasing' | 'stable';

    /** Percentage change over period */
    changePercent: number;
  };
}

/**
 * Individual data point in a time series.
 */
export interface TimeSeriesDataPoint {
  /** Timestamp for this data point */
  timestamp: ISOTimestamp;

  /** Metric value at this timestamp */
  value: number;

  /** Optional breakdown of value components */
  breakdown?: Record<string, number>;
}
```

### AnalyticsQuery

```typescript
/**
 * Query parameters for retrieving analytics data.
 * Supports flexible filtering and aggregation.
 */
export interface AnalyticsQuery {
  /** Customer to query data for */
  customerId: CustomerId;

  /** Start of query date range */
  startDate: ISOTimestamp;

  /** End of query date range */
  endDate: ISOTimestamp;

  /** Metrics to retrieve */
  metrics?: MetricType[];

  /** Entity types to include */
  entityTypes?: AnalyticsEntityType[];

  /** Specific entity IDs to query */
  entityIds?: string[];

  /** Grouping dimension */
  groupBy?: 'day' | 'week' | 'month' | 'entity' | 'platform';

  /** Platforms to filter by */
  platforms?: Platform[];

  /** Whether to include comparison to previous period */
  includeComparison?: boolean;

  /** Pagination parameters */
  pagination?: PaginationParams;

  /** Sort field and direction */
  sort?: {
    field: MetricType | 'date' | 'entityId';
    direction: 'asc' | 'desc';
  };
}
```

### DashboardStats

```typescript
/**
 * Real-time dashboard statistics for a customer.
 * Provides quick overview of current performance.
 */
export interface DashboardStats {
  /** Customer ID */
  customerId: CustomerId;

  /** Current period summary */
  currentPeriod: {
    /** Period label (e.g., "This Week", "Today") */
    label: string;

    /** Start date of period */
    startDate: ISOTimestamp;

    /** End date of period */
    endDate: ISOTimestamp;
  };

  /** Key performance indicators */
  kpis: {
    /** Total content pieces published */
    totalContent: number;

    /** Total engagement across all content */
    totalEngagement: number;

    /** Total LLM mentions detected */
    totalMentions: number;

    /** Total UTM-tracked clicks */
    totalClicks: number;

    /** Content success rate */
    successRate: number;

    /** Average engagement per post */
    avgEngagement: number;
  };

  /** Comparison to previous period */
  comparison: {
    /** Engagement change percentage */
    engagementChange: number;

    /** Mentions change percentage */
    mentionsChange: number;

    /** Clicks change percentage */
    clicksChange: number;

    /** Success rate change */
    successRateChange: number;
  };

  /** Phase 1 target progress */
  targetProgress: {
    /** LLM mention increase (target: 20%) */
    llmMentionProgress: number;

    /** Traffic increase (target: 50%) */
    trafficProgress: number;

    /** Days since baseline measurement */
    daysSinceBaseline: number;
  };

  /** Recent activity feed */
  recentActivity: RecentActivity[];

  /** When stats were calculated */
  calculatedAt: ISOTimestamp;
}

/**
 * Recent activity item for dashboard feed.
 */
export interface RecentActivity {
  /** Activity type */
  type: 'article_published' | 'post_created' | 'mention_detected' | 'milestone_reached';

  /** Activity description */
  description: string;

  /** When activity occurred */
  timestamp: ISOTimestamp;

  /** Associated entity reference */
  entityRef?: ArticleRef | RedditPostRef | LlmMention;
}
```

### TopPerformingContent

```typescript
/**
 * Top performing content analysis.
 */
export interface TopPerformingContent {
  /** Customer ID */
  customerId: CustomerId;

  /** Analysis period */
  period: {
    startDate: ISOTimestamp;
    endDate: ISOTimestamp;
  };

  /** Top performing articles by engagement */
  topArticles: Array<{
    articleRef: ArticleRef;
    totalEngagement: number;
    clicks: number;
    redditPosts: number;
    rank: number;
  }>;

  /** Top performing Reddit posts by engagement */
  topRedditPosts: Array<{
    redditPostRef: RedditPostRef;
    upvotes: number;
    comments: number;
    clicks: number;
    engagementLevel: EngagementLevel;
    rank: number;
  }>;

  /** Top performing Clear Stories by content performance */
  topClearStories: Array<{
    clearStoryRef: ClearStoryRef;
    articlesGenerated: number;
    totalEngagement: number;
    rank: number;
  }>;

  /** Insights and recommendations */
  insights: string[];
}
```

### CampaignStats

```typescript
/**
 * Statistics for a UTM campaign.
 */
export interface CampaignStats {
  /** Campaign reference */
  campaign: UtmCampaign;

  /** Total clicks */
  totalClicks: number;

  /** Unique visitors (by IP hash) */
  uniqueVisitors: number;

  /** Clicks by device type */
  clicksByDevice: {
    mobile: number;
    desktop: number;
    tablet: number;
  };

  /** Clicks by country (top 10) */
  clicksByCountry: Array<{
    country: string;
    clicks: number;
    percentage: number;
  }>;

  /** Clicks over time */
  clickTimeSeries: TimeSeriesDataPoint[];

  /** Top referrers */
  topReferrers: Array<{
    referrer: string;
    clicks: number;
    percentage: number;
  }>;

  /** Conversion rate if available */
  conversionRate?: number;
}
```

### PerformanceComparison

```typescript
/**
 * Performance comparison between two periods or entities.
 */
export interface PerformanceComparison {
  /** First period/entity being compared */
  baseline: {
    label: string;
    startDate: ISOTimestamp;
    endDate: ISOTimestamp;
    metrics: Record<MetricType, number>;
  };

  /** Second period/entity being compared */
  comparison: {
    label: string;
    startDate: ISOTimestamp;
    endDate: ISOTimestamp;
    metrics: Record<MetricType, number>;
  };

  /** Calculated differences */
  differences: Record<MetricType, {
    absolute: number;
    percentage: number;
    improved: boolean;
  }>;

  /** Overall assessment */
  assessment: 'improved' | 'declined' | 'stable';

  /** Key insights from comparison */
  insights: string[];
}
```

---

## Service Interface

```typescript
/**
 * Analytics domain service interface.
 * All methods are async and return Promises.
 */
export interface IAnalyticsService {
  // ─────────────────────────────────────────────────────────────
  // UTM Campaign Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new UTM tracking campaign.
   * Generates tracking URL with UTM parameters.
   *
   * @param input - Campaign creation parameters
   * @returns The created campaign with tracking URL
   */
  createCampaign(input: CreateCampaignInput): Promise<UtmCampaign>;

  /**
   * Get a campaign by ID.
   *
   * @param campaignId - Campaign identifier
   * @returns The campaign or null if not found
   */
  getCampaign(campaignId: UtmCampaignId): Promise<UtmCampaign | null>;

  /**
   * Get all campaigns for a customer.
   *
   * @param customerId - Customer identifier
   * @param options - Filter and pagination options
   * @returns Paginated list of campaigns
   */
  getCampaigns(
    customerId: CustomerId,
    options?: {
      isActive?: boolean;
      source?: string;
      pagination?: PaginationParams;
    }
  ): Promise<PaginatedResponse<UtmCampaign>>;

  /**
   * Track a click event for a campaign.
   * Called when UTM-tracked link is visited.
   *
   * @param campaignId - Campaign that received the click
   * @param clickData - Click event data
   * @returns The recorded click
   */
  trackClick(
    campaignId: UtmCampaignId,
    clickData: Omit<UtmClick, 'id' | 'campaignId'>
  ): Promise<UtmClick>;

  /**
   * Get comprehensive statistics for a campaign.
   *
   * @param campaignId - Campaign to get stats for
   * @param options - Date range and granularity options
   * @returns Campaign statistics
   */
  getCampaignStats(
    campaignId: UtmCampaignId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      granularity?: AggregationGranularity;
    }
  ): Promise<CampaignStats>;

  // ─────────────────────────────────────────────────────────────
  // Engagement Metrics
  // ─────────────────────────────────────────────────────────────

  /**
   * Record or update engagement metrics for an entity.
   * Typically called from event handlers when engagement changes.
   *
   * @param entityType - Type of entity
   * @param entityId - Entity identifier
   * @param metrics - Updated metric values
   * @returns The updated engagement metric record
   */
  recordEngagement(
    entityType: AnalyticsEntityType,
    entityId: string,
    metrics: Partial<{
      upvotes: number;
      comments: number;
      shares: number;
      clicks: number;
      impressions: number;
    }>
  ): Promise<EngagementMetric>;

  /**
   * Get engagement metrics for a specific entity.
   *
   * @param entityType - Type of entity
   * @param entityId - Entity identifier
   * @returns Engagement metrics or null if not found
   */
  getEngagementByEntity(
    entityType: AnalyticsEntityType,
    entityId: string
  ): Promise<EngagementMetric | null>;

  /**
   * Aggregate engagement metrics across multiple entities.
   *
   * @param customerId - Customer to aggregate for
   * @param options - Filter and grouping options
   * @returns Aggregated engagement data
   */
  aggregateEngagement(
    customerId: CustomerId,
    options?: {
      entityTypes?: AnalyticsEntityType[];
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      groupBy?: 'day' | 'week' | 'month' | 'entity';
    }
  ): Promise<{
    total: Omit<EngagementMetric, 'id' | 'entityType' | 'entityId'>;
    byGroup?: Record<string, Omit<EngagementMetric, 'id' | 'entityType' | 'entityId'>>;
  }>;

  // ─────────────────────────────────────────────────────────────
  // LLM Mention Tracking (peec.ai Integration)
  // ─────────────────────────────────────────────────────────────

  /**
   * Synchronize LLM mentions from peec.ai for a customer.
   * Fetches new mentions since last sync.
   *
   * @param customerId - Customer to sync mentions for
   * @returns Sync result with new mentions count
   */
  syncLlmMentions(customerId: CustomerId): Promise<{
    newMentions: number;
    lastSyncedAt: ISOTimestamp;
    mentions: LlmMention[];
  }>;

  /**
   * Get LLM mentions for a customer.
   *
   * @param customerId - Customer identifier
   * @param options - Filter and pagination options
   * @returns Paginated list of mentions
   */
  getLlmMentions(
    customerId: CustomerId,
    options?: {
      platform?: LlmPlatform;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      sentiment?: 'positive' | 'neutral' | 'negative';
      pagination?: PaginationParams;
    }
  ): Promise<PaginatedResponse<LlmMention>>;

  /**
   * Get LLM mention trend over time.
   * Used to measure progress toward 20% increase target.
   *
   * @param customerId - Customer identifier
   * @param options - Analysis options
   * @returns Trend analysis data
   */
  getLlmMentionTrend(
    customerId: CustomerId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      granularity?: AggregationGranularity;
      platforms?: LlmPlatform[];
    }
  ): Promise<{
    timeSeries: MetricTimeSeries;
    baselineCount: number;
    currentCount: number;
    changePercent: number;
    targetMet: boolean;
    projectedTimeToTarget?: number;
  }>;

  // ─────────────────────────────────────────────────────────────
  // Performance Reports
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate a performance report for a customer.
   * May be async operation for large data sets.
   *
   * @param customerId - Customer to generate report for
   * @param options - Report configuration
   * @returns The generated report
   */
  generateReport(
    customerId: CustomerId,
    options: {
      period: ReportPeriod;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<PerformanceReport>;

  /**
   * Get a previously generated report by ID.
   *
   * @param reportId - Report identifier
   * @returns The report or null if not found
   */
  getReport(reportId: string): Promise<PerformanceReport | null>;

  /**
   * Get report history for a customer.
   *
   * @param customerId - Customer identifier
   * @param options - Pagination options
   * @returns Paginated list of reports
   */
  getReportHistory(
    customerId: CustomerId,
    options?: {
      period?: ReportPeriod;
      pagination?: PaginationParams;
    }
  ): Promise<PaginatedResponse<PerformanceReport>>;

  // ─────────────────────────────────────────────────────────────
  // Time Series & Comparisons
  // ─────────────────────────────────────────────────────────────

  /**
   * Get time series data for a specific metric.
   *
   * @param query - Query parameters
   * @returns Time series data
   */
  getTimeSeries(query: AnalyticsQuery): Promise<MetricTimeSeries[]>;

  /**
   * Compare performance between two periods.
   *
   * @param customerId - Customer identifier
   * @param baselinePeriod - First period for comparison
   * @param comparisonPeriod - Second period for comparison
   * @returns Comparison analysis
   */
  comparePerformance(
    customerId: CustomerId,
    baselinePeriod: { startDate: ISOTimestamp; endDate: ISOTimestamp },
    comparisonPeriod: { startDate: ISOTimestamp; endDate: ISOTimestamp }
  ): Promise<PerformanceComparison>;

  // ─────────────────────────────────────────────────────────────
  // Dashboard & Summaries
  // ─────────────────────────────────────────────────────────────

  /**
   * Get real-time dashboard statistics for a customer.
   *
   * @param customerId - Customer identifier
   * @param period - Time period for stats (default: weekly)
   * @returns Dashboard statistics
   */
  getDashboardStats(
    customerId: CustomerId,
    period?: ReportPeriod
  ): Promise<DashboardStats>;

  /**
   * Get top performing content for a customer.
   *
   * @param customerId - Customer identifier
   * @param options - Analysis options
   * @returns Top performing content analysis
   */
  getTopPerformingContent(
    customerId: CustomerId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      limit?: number;
    }
  ): Promise<TopPerformingContent>;

  // ─────────────────────────────────────────────────────────────
  // Baseline Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Set baseline metrics for a customer.
   * Used as reference point for measuring Phase 1 targets.
   *
   * @param customerId - Customer identifier
   * @param baseline - Baseline metric values
   * @returns The stored baseline
   */
  setBaseline(
    customerId: CustomerId,
    baseline: {
      llmMentions: number;
      monthlyTraffic: number;
      recordedAt: ISOTimestamp;
    }
  ): Promise<CustomerBaseline>;

  /**
   * Get baseline metrics for a customer.
   *
   * @param customerId - Customer identifier
   * @returns Baseline metrics or null if not set
   */
  getBaseline(customerId: CustomerId): Promise<CustomerBaseline | null>;
}

/**
 * Customer baseline metrics for Phase 1 target tracking.
 */
export interface CustomerBaseline {
  customerId: CustomerId;
  llmMentions: number;
  monthlyTraffic: number;
  recordedAt: ISOTimestamp;
  createdAt: ISOTimestamp;
}
```

---

## Repository Interfaces

### IUtmCampaignRepository

```typescript
/**
 * Repository interface for UtmCampaign persistence.
 */
export interface IUtmCampaignRepository {
  /**
   * Create a new UTM campaign.
   *
   * @param input - Campaign data
   * @returns Created campaign
   */
  create(input: CreateCampaignInput): Promise<UtmCampaign>;

  /**
   * Find a campaign by ID.
   *
   * @param id - Campaign identifier
   * @returns Campaign or null
   */
  findById(id: UtmCampaignId): Promise<UtmCampaign | null>;

  /**
   * Find campaigns by customer.
   *
   * @param customerId - Customer identifier
   * @param options - Filter options
   * @returns Array of campaigns
   */
  findByCustomer(
    customerId: CustomerId,
    options?: {
      isActive?: boolean;
      source?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<UtmCampaign[]>;

  /**
   * Count campaigns for a customer.
   *
   * @param customerId - Customer identifier
   * @param options - Filter options
   * @returns Count
   */
  countByCustomer(
    customerId: CustomerId,
    options?: {
      isActive?: boolean;
      source?: string;
    }
  ): Promise<number>;

  /**
   * Update a campaign.
   *
   * @param id - Campaign identifier
   * @param updates - Fields to update
   * @returns Updated campaign
   */
  update(id: UtmCampaignId, updates: Partial<UtmCampaign>): Promise<UtmCampaign>;

  /**
   * Find campaign by tracking URL.
   *
   * @param trackingUrl - Full tracking URL
   * @returns Campaign or null
   */
  findByTrackingUrl(trackingUrl: string): Promise<UtmCampaign | null>;

  /**
   * Find campaigns by associated entity.
   *
   * @param entityType - 'article' or 'redditPost'
   * @param entityId - Entity identifier
   * @returns Array of campaigns
   */
  findByEntity(
    entityType: 'article' | 'redditPost',
    entityId: string
  ): Promise<UtmCampaign[]>;
}
```

### IUtmClickRepository

```typescript
/**
 * Repository interface for UtmClick persistence.
 */
export interface IUtmClickRepository {
  /**
   * Create a new click record.
   *
   * @param input - Click data
   * @returns Created click
   */
  create(input: Omit<UtmClick, 'id'>): Promise<UtmClick>;

  /**
   * Find clicks by campaign.
   *
   * @param campaignId - Campaign identifier
   * @param options - Filter and pagination options
   * @returns Array of clicks
   */
  findByCampaign(
    campaignId: UtmCampaignId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      limit?: number;
      offset?: number;
    }
  ): Promise<UtmClick[]>;

  /**
   * Count clicks for a campaign.
   *
   * @param campaignId - Campaign identifier
   * @param options - Filter options
   * @returns Click count
   */
  countByCampaign(
    campaignId: UtmCampaignId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<number>;

  /**
   * Count unique visitors for a campaign (by IP hash).
   *
   * @param campaignId - Campaign identifier
   * @param options - Filter options
   * @returns Unique visitor count
   */
  countUniqueVisitors(
    campaignId: UtmCampaignId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<number>;

  /**
   * Aggregate clicks by device type.
   *
   * @param campaignId - Campaign identifier
   * @param options - Filter options
   * @returns Clicks grouped by device
   */
  aggregateByDevice(
    campaignId: UtmCampaignId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<Record<'mobile' | 'desktop' | 'tablet', number>>;

  /**
   * Aggregate clicks by country.
   *
   * @param campaignId - Campaign identifier
   * @param options - Filter options
   * @returns Clicks grouped by country
   */
  aggregateByCountry(
    campaignId: UtmCampaignId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      limit?: number;
    }
  ): Promise<Array<{ country: string; clicks: number }>>;

  /**
   * Get click time series for a campaign.
   *
   * @param campaignId - Campaign identifier
   * @param granularity - Time grouping
   * @param options - Date range
   * @returns Time series data
   */
  getTimeSeries(
    campaignId: UtmCampaignId,
    granularity: AggregationGranularity,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<TimeSeriesDataPoint[]>;
}
```

### ILlmMentionRepository

```typescript
/**
 * Repository interface for LlmMention persistence.
 */
export interface ILlmMentionRepository {
  /**
   * Create a new LLM mention record.
   *
   * @param input - Mention data
   * @returns Created mention
   */
  create(input: Omit<LlmMention, 'id'>): Promise<LlmMention>;

  /**
   * Create multiple mention records (batch insert).
   *
   * @param inputs - Array of mention data
   * @returns Created mentions
   */
  createMany(inputs: Omit<LlmMention, 'id'>[]): Promise<LlmMention[]>;

  /**
   * Find a mention by ID.
   *
   * @param id - Mention identifier
   * @returns Mention or null
   */
  findById(id: string): Promise<LlmMention | null>;

  /**
   * Find a mention by peec.ai reference ID.
   * Used to avoid duplicate imports.
   *
   * @param peecReferenceId - peec.ai internal ID
   * @returns Mention or null
   */
  findByPeecReferenceId(peecReferenceId: string): Promise<LlmMention | null>;

  /**
   * Find mentions by customer.
   *
   * @param customerId - Customer identifier
   * @param options - Filter and pagination options
   * @returns Array of mentions
   */
  findByCustomer(
    customerId: CustomerId,
    options?: {
      platform?: LlmPlatform;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      sentiment?: 'positive' | 'neutral' | 'negative';
      limit?: number;
      offset?: number;
    }
  ): Promise<LlmMention[]>;

  /**
   * Count mentions for a customer.
   *
   * @param customerId - Customer identifier
   * @param options - Filter options
   * @returns Mention count
   */
  countByCustomer(
    customerId: CustomerId,
    options?: {
      platform?: LlmPlatform;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      sentiment?: 'positive' | 'neutral' | 'negative';
    }
  ): Promise<number>;

  /**
   * Aggregate mentions by platform.
   *
   * @param customerId - Customer identifier
   * @param options - Filter options
   * @returns Mentions grouped by platform
   */
  aggregateByPlatform(
    customerId: CustomerId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<Array<{ platform: LlmPlatform; count: number }>>;

  /**
   * Get mention time series.
   *
   * @param customerId - Customer identifier
   * @param granularity - Time grouping
   * @param options - Filter options
   * @returns Time series data
   */
  getTimeSeries(
    customerId: CustomerId,
    granularity: AggregationGranularity,
    options?: {
      platform?: LlmPlatform;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<TimeSeriesDataPoint[]>;

  /**
   * Get latest sync timestamp for a customer.
   *
   * @param customerId - Customer identifier
   * @returns Latest detected timestamp or null
   */
  getLatestSyncTimestamp(customerId: CustomerId): Promise<ISOTimestamp | null>;
}
```

### IEngagementMetricRepository

```typescript
/**
 * Repository interface for EngagementMetric persistence.
 */
export interface IEngagementMetricRepository {
  /**
   * Create or update engagement metrics for an entity.
   * Uses upsert behavior.
   *
   * @param entityType - Entity type
   * @param entityId - Entity identifier
   * @param metrics - Metric values
   * @returns Updated metric record
   */
  upsert(
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
  ): Promise<EngagementMetric>;

  /**
   * Find metrics by entity.
   *
   * @param entityType - Entity type
   * @param entityId - Entity identifier
   * @returns Metrics or null
   */
  findByEntity(
    entityType: AnalyticsEntityType,
    entityId: string
  ): Promise<EngagementMetric | null>;

  /**
   * Find metrics by customer.
   *
   * @param customerId - Customer identifier
   * @param options - Filter and pagination options
   * @returns Array of metrics
   */
  findByCustomer(
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
  ): Promise<EngagementMetric[]>;

  /**
   * Aggregate metrics for a customer.
   *
   * @param customerId - Customer identifier
   * @param options - Filter and grouping options
   * @returns Aggregated metrics
   */
  aggregate(
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
  }>;

  /**
   * Record a historical snapshot.
   *
   * @param entityType - Entity type
   * @param entityId - Entity identifier
   * @param snapshot - Snapshot data
   */
  recordSnapshot(
    entityType: AnalyticsEntityType,
    entityId: string,
    snapshot: EngagementSnapshot
  ): Promise<void>;

  /**
   * Get top performing entities.
   *
   * @param customerId - Customer identifier
   * @param options - Filter and ranking options
   * @returns Top entities by engagement
   */
  getTopPerforming(
    customerId: CustomerId,
    options?: {
      entityType?: AnalyticsEntityType;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      orderBy?: 'upvotes' | 'comments' | 'clicks' | 'total';
      limit?: number;
    }
  ): Promise<EngagementMetric[]>;

  /**
   * Count entities meeting targets.
   *
   * @param customerId - Customer identifier
   * @param options - Filter options
   * @returns Count of entities meeting targets
   */
  countMeetingTargets(
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
  }>;
}
```

### IPerformanceReportRepository

```typescript
/**
 * Repository interface for PerformanceReport persistence.
 */
export interface IPerformanceReportRepository {
  /**
   * Create a new report.
   *
   * @param input - Report data
   * @returns Created report
   */
  create(input: Omit<PerformanceReport, 'id'>): Promise<PerformanceReport>;

  /**
   * Find a report by ID.
   *
   * @param id - Report identifier
   * @returns Report or null
   */
  findById(id: string): Promise<PerformanceReport | null>;

  /**
   * Find reports by customer.
   *
   * @param customerId - Customer identifier
   * @param options - Filter and pagination options
   * @returns Array of reports
   */
  findByCustomer(
    customerId: CustomerId,
    options?: {
      period?: ReportPeriod;
      status?: 'generating' | 'ready' | 'failed';
      limit?: number;
      offset?: number;
    }
  ): Promise<PerformanceReport[]>;

  /**
   * Update report status.
   *
   * @param id - Report identifier
   * @param status - New status
   * @returns Updated report
   */
  updateStatus(
    id: string,
    status: 'generating' | 'ready' | 'failed'
  ): Promise<PerformanceReport>;

  /**
   * Get the most recent report for a customer.
   *
   * @param customerId - Customer identifier
   * @param period - Optional period filter
   * @returns Most recent report or null
   */
  findMostRecent(
    customerId: CustomerId,
    period?: ReportPeriod
  ): Promise<PerformanceReport | null>;
}
```

---

## API Routes

### Route Definitions

```yaml
# ─────────────────────────────────────────────────────────────
# UTM Campaign Endpoints
# ─────────────────────────────────────────────────────────────

# POST /analytics/campaigns
# Create a new UTM tracking campaign
POST /analytics/campaigns:
  auth: required
  body:
    customerId: CustomerId (required)
    source: string (required)
    medium: string (required)
    campaign: string (required)
    content: string (optional)
    term: string (optional)
    articleId: ArticleId (optional)
    redditPostId: RedditPostId (optional)
    baseUrl: string (required) - Customer's website URL
  response:
    201:
      campaign: UtmCampaign
    400: Validation error
    409: Campaign already exists

# GET /analytics/campaigns
# List campaigns for a customer
GET /analytics/campaigns:
  auth: required
  query:
    customerId: CustomerId (required)
    isActive: boolean (optional)
    source: string (optional)
    page: number (default: 1)
    pageSize: number (default: 20)
  response:
    200: PaginatedResponse<UtmCampaign>

# GET /analytics/campaigns/:id
# Get a specific campaign
GET /analytics/campaigns/:id:
  auth: required
  params:
    id: UtmCampaignId
  response:
    200: UtmCampaign
    404: Campaign not found

# GET /analytics/campaigns/:id/stats
# Get campaign statistics
GET /analytics/campaigns/:id/stats:
  auth: required
  params:
    id: UtmCampaignId
  query:
    startDate: ISOTimestamp (optional)
    endDate: ISOTimestamp (optional)
    granularity: AggregationGranularity (default: daily)
  response:
    200: CampaignStats
    404: Campaign not found

# POST /analytics/campaigns/:id/clicks
# Track a click event (typically called via redirect)
POST /analytics/campaigns/:id/clicks:
  auth: none (public endpoint with rate limiting)
  params:
    id: UtmCampaignId
  body:
    referrer: string (optional)
    userAgent: string (optional)
    ipHash: string (optional - generated server-side if not provided)
    landingPage: string (required)
  response:
    201: UtmClick
    404: Campaign not found
    429: Rate limited

# ─────────────────────────────────────────────────────────────
# Engagement Metrics Endpoints
# ─────────────────────────────────────────────────────────────

# POST /analytics/engagement
# Record engagement metrics for an entity
POST /analytics/engagement:
  auth: required (system or admin)
  body:
    entityType: AnalyticsEntityType (required)
    entityId: string (required)
    customerId: CustomerId (required)
    upvotes: number (optional)
    comments: number (optional)
    shares: number (optional)
    clicks: number (optional)
    impressions: number (optional)
    platform: Platform (optional)
  response:
    200: EngagementMetric
    400: Validation error

# GET /analytics/engagement/:entityType/:entityId
# Get engagement metrics for a specific entity
GET /analytics/engagement/:entityType/:entityId:
  auth: required
  params:
    entityType: AnalyticsEntityType
    entityId: string
  response:
    200: EngagementMetric
    404: Entity not found

# GET /analytics/engagement/aggregate
# Get aggregated engagement metrics
GET /analytics/engagement/aggregate:
  auth: required
  query:
    customerId: CustomerId (required)
    entityTypes: AnalyticsEntityType[] (optional)
    startDate: ISOTimestamp (optional)
    endDate: ISOTimestamp (optional)
    groupBy: 'day' | 'week' | 'month' | 'entity' (optional)
  response:
    200:
      total: EngagementTotals
      byGroup: Record<string, EngagementTotals> (if groupBy specified)

# ─────────────────────────────────────────────────────────────
# LLM Mention Endpoints
# ─────────────────────────────────────────────────────────────

# POST /analytics/llm-mentions/sync
# Sync LLM mentions from peec.ai
POST /analytics/llm-mentions/sync:
  auth: required
  body:
    customerId: CustomerId (required)
  response:
    200:
      newMentions: number
      lastSyncedAt: ISOTimestamp
      mentions: LlmMention[]
    502: peec.ai API error
    503: Service unavailable

# GET /analytics/llm-mentions
# Get LLM mentions for a customer
GET /analytics/llm-mentions:
  auth: required
  query:
    customerId: CustomerId (required)
    platform: LlmPlatform (optional)
    startDate: ISOTimestamp (optional)
    endDate: ISOTimestamp (optional)
    sentiment: 'positive' | 'neutral' | 'negative' (optional)
    page: number (default: 1)
    pageSize: number (default: 20)
  response:
    200: PaginatedResponse<LlmMention>

# GET /analytics/llm-mentions/trend
# Get LLM mention trend analysis
GET /analytics/llm-mentions/trend:
  auth: required
  query:
    customerId: CustomerId (required)
    startDate: ISOTimestamp (optional)
    endDate: ISOTimestamp (optional)
    granularity: AggregationGranularity (default: daily)
    platforms: LlmPlatform[] (optional)
  response:
    200:
      timeSeries: MetricTimeSeries
      baselineCount: number
      currentCount: number
      changePercent: number
      targetMet: boolean
      projectedTimeToTarget: number (optional, days)

# ─────────────────────────────────────────────────────────────
# Performance Report Endpoints
# ─────────────────────────────────────────────────────────────

# POST /analytics/reports
# Generate a new performance report
POST /analytics/reports:
  auth: required
  body:
    customerId: CustomerId (required)
    period: ReportPeriod (required)
    startDate: ISOTimestamp (optional, required for custom period)
    endDate: ISOTimestamp (optional, required for custom period)
  response:
    202:
      reportId: string
      status: 'generating'
      estimatedCompletionTime: number (seconds)
    400: Validation error

# GET /analytics/reports/:id
# Get a specific report
GET /analytics/reports/:id:
  auth: required
  params:
    id: string
  response:
    200: PerformanceReport
    404: Report not found

# GET /analytics/reports
# Get report history for a customer
GET /analytics/reports:
  auth: required
  query:
    customerId: CustomerId (required)
    period: ReportPeriod (optional)
    page: number (default: 1)
    pageSize: number (default: 10)
  response:
    200: PaginatedResponse<PerformanceReport>

# ─────────────────────────────────────────────────────────────
# Time Series & Analytics Query Endpoints
# ─────────────────────────────────────────────────────────────

# POST /analytics/query
# Execute a flexible analytics query
POST /analytics/query:
  auth: required
  body: AnalyticsQuery
  response:
    200:
      timeSeries: MetricTimeSeries[]
      summary: Record<MetricType, number>

# GET /analytics/time-series
# Get time series for specific metrics
GET /analytics/time-series:
  auth: required
  query:
    customerId: CustomerId (required)
    metrics: MetricType[] (required)
    startDate: ISOTimestamp (required)
    endDate: ISOTimestamp (required)
    granularity: AggregationGranularity (default: daily)
    entityType: AnalyticsEntityType (optional)
    entityId: string (optional)
  response:
    200: MetricTimeSeries[]

# POST /analytics/compare
# Compare performance between periods
POST /analytics/compare:
  auth: required
  body:
    customerId: CustomerId (required)
    baselinePeriod:
      startDate: ISOTimestamp (required)
      endDate: ISOTimestamp (required)
    comparisonPeriod:
      startDate: ISOTimestamp (required)
      endDate: ISOTimestamp (required)
  response:
    200: PerformanceComparison

# ─────────────────────────────────────────────────────────────
# Dashboard & Summary Endpoints
# ─────────────────────────────────────────────────────────────

# GET /analytics/dashboard
# Get dashboard statistics
GET /analytics/dashboard:
  auth: required
  query:
    customerId: CustomerId (required)
    period: ReportPeriod (default: weekly)
  response:
    200: DashboardStats

# GET /analytics/top-content
# Get top performing content
GET /analytics/top-content:
  auth: required
  query:
    customerId: CustomerId (required)
    startDate: ISOTimestamp (optional)
    endDate: ISOTimestamp (optional)
    limit: number (default: 10)
  response:
    200: TopPerformingContent

# ─────────────────────────────────────────────────────────────
# Baseline Management Endpoints
# ─────────────────────────────────────────────────────────────

# POST /analytics/baseline
# Set baseline metrics for a customer
POST /analytics/baseline:
  auth: required (admin)
  body:
    customerId: CustomerId (required)
    llmMentions: number (required)
    monthlyTraffic: number (required)
    recordedAt: ISOTimestamp (optional, defaults to now)
  response:
    201: CustomerBaseline
    409: Baseline already exists (use PUT to update)

# GET /analytics/baseline/:customerId
# Get baseline metrics for a customer
GET /analytics/baseline/:customerId:
  auth: required
  params:
    customerId: CustomerId
  response:
    200: CustomerBaseline
    404: Baseline not found

# PUT /analytics/baseline/:customerId
# Update baseline metrics for a customer
PUT /analytics/baseline/:customerId:
  auth: required (admin)
  params:
    customerId: CustomerId
  body:
    llmMentions: number (optional)
    monthlyTraffic: number (optional)
    recordedAt: ISOTimestamp (optional)
  response:
    200: CustomerBaseline
    404: Baseline not found
```

### TypeScript Route Types

```typescript
/**
 * POST /analytics/campaigns request body
 */
export interface CreateCampaignRequest {
  customerId: CustomerId;
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
  articleId?: ArticleId;
  redditPostId?: RedditPostId;
  baseUrl: string;
}

/**
 * POST /analytics/campaigns response
 */
export interface CreateCampaignResponse {
  campaign: UtmCampaign;
}

/**
 * POST /analytics/campaigns/:id/clicks request body
 */
export interface TrackClickRequest {
  referrer?: string;
  userAgent?: string;
  ipHash?: string;
  landingPage: string;
}

/**
 * POST /analytics/engagement request body
 */
export interface RecordEngagementRequest {
  entityType: AnalyticsEntityType;
  entityId: string;
  customerId: CustomerId;
  upvotes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  impressions?: number;
  platform?: Platform;
}

/**
 * GET /analytics/engagement/aggregate response
 */
export interface AggregateEngagementResponse {
  total: {
    upvotes: number;
    comments: number;
    shares: number;
    clicks: number;
    impressions: number;
    engagementRate: number;
  };
  byGroup?: Record<string, {
    upvotes: number;
    comments: number;
    shares: number;
    clicks: number;
    impressions: number;
  }>;
}

/**
 * POST /analytics/llm-mentions/sync request body
 */
export interface SyncLlmMentionsRequest {
  customerId: CustomerId;
}

/**
 * POST /analytics/llm-mentions/sync response
 */
export interface SyncLlmMentionsResponse {
  newMentions: number;
  lastSyncedAt: ISOTimestamp;
  mentions: LlmMention[];
}

/**
 * GET /analytics/llm-mentions/trend response
 */
export interface LlmMentionTrendResponse {
  timeSeries: MetricTimeSeries;
  baselineCount: number;
  currentCount: number;
  changePercent: number;
  targetMet: boolean;
  projectedTimeToTarget?: number;
}

/**
 * POST /analytics/reports request body
 */
export interface GenerateReportRequest {
  customerId: CustomerId;
  period: ReportPeriod;
  startDate?: ISOTimestamp;
  endDate?: ISOTimestamp;
}

/**
 * POST /analytics/reports response
 */
export interface GenerateReportResponse {
  reportId: string;
  status: 'generating';
  estimatedCompletionTime: number;
}

/**
 * POST /analytics/query request body
 */
export interface AnalyticsQueryRequest extends AnalyticsQuery {}

/**
 * POST /analytics/query response
 */
export interface AnalyticsQueryResponse {
  timeSeries: MetricTimeSeries[];
  summary: Record<MetricType, number>;
}

/**
 * POST /analytics/compare request body
 */
export interface ComparePerformanceRequest {
  customerId: CustomerId;
  baselinePeriod: {
    startDate: ISOTimestamp;
    endDate: ISOTimestamp;
  };
  comparisonPeriod: {
    startDate: ISOTimestamp;
    endDate: ISOTimestamp;
  };
}

/**
 * POST /analytics/baseline request body
 */
export interface SetBaselineRequest {
  customerId: CustomerId;
  llmMentions: number;
  monthlyTraffic: number;
  recordedAt?: ISOTimestamp;
}
```

---

## Validation Schemas

```typescript
import { z } from 'zod';

/**
 * ISO timestamp validation
 */
const isoTimestamp = z.string().datetime({ message: 'Must be valid ISO 8601 timestamp' });

/**
 * Customer ID validation
 */
const customerIdSchema = z.string().regex(
  /^cust_[a-f0-9-]{36}$/,
  'Customer ID must be in format cust_{uuid}'
);

/**
 * UTM Campaign ID validation
 */
const utmCampaignIdSchema = z.string().regex(
  /^utm_[a-f0-9-]{36}$/,
  'UTM Campaign ID must be in format utm_{uuid}'
);

/**
 * Article ID validation
 */
const articleIdSchema = z.string().regex(
  /^art_[a-f0-9-]{36}$/,
  'Article ID must be in format art_{uuid}'
);

/**
 * Reddit Post ID validation
 */
const redditPostIdSchema = z.string().regex(
  /^rp_[a-f0-9-]{36}$/,
  'Reddit Post ID must be in format rp_{uuid}'
);

/**
 * UTM Campaign creation validation
 */
export const CreateCampaignSchema = z.object({
  customerId: customerIdSchema,
  source: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/i, 'Source must be alphanumeric'),
  medium: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/i, 'Medium must be alphanumeric'),
  campaign: z.string().min(1).max(200),
  content: z.string().max(200).optional(),
  term: z.string().max(200).optional(),
  articleId: articleIdSchema.optional(),
  redditPostId: redditPostIdSchema.optional(),
  baseUrl: z.string().url('Must be a valid URL')
});

/**
 * Click tracking validation
 */
export const TrackClickSchema = z.object({
  referrer: z.string().url().optional().or(z.literal('')),
  userAgent: z.string().max(500).optional(),
  ipHash: z.string().max(64).optional(),
  landingPage: z.string().url('Landing page must be a valid URL')
});

/**
 * Engagement recording validation
 */
export const RecordEngagementSchema = z.object({
  entityType: z.nativeEnum(AnalyticsEntityType),
  entityId: z.string().min(1).max(100),
  customerId: customerIdSchema,
  upvotes: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  impressions: z.number().int().min(0).optional(),
  platform: z.nativeEnum(Platform).optional()
});

/**
 * LLM mention sync validation
 */
export const SyncLlmMentionsSchema = z.object({
  customerId: customerIdSchema
});

/**
 * Report generation validation
 */
export const GenerateReportSchema = z.object({
  customerId: customerIdSchema,
  period: z.nativeEnum(ReportPeriod),
  startDate: isoTimestamp.optional(),
  endDate: isoTimestamp.optional()
}).refine(
  (data) => {
    if (data.period === ReportPeriod.custom) {
      return data.startDate && data.endDate;
    }
    return true;
  },
  { message: 'startDate and endDate are required for custom period' }
).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  },
  { message: 'startDate must be before endDate' }
);

/**
 * Analytics query validation
 */
export const AnalyticsQuerySchema = z.object({
  customerId: customerIdSchema,
  startDate: isoTimestamp,
  endDate: isoTimestamp,
  metrics: z.array(z.nativeEnum(MetricType)).optional(),
  entityTypes: z.array(z.nativeEnum(AnalyticsEntityType)).optional(),
  entityIds: z.array(z.string()).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'entity', 'platform']).optional(),
  platforms: z.array(z.nativeEnum(Platform)).optional(),
  includeComparison: z.boolean().optional(),
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20)
  }).optional(),
  sort: z.object({
    field: z.union([z.nativeEnum(MetricType), z.enum(['date', 'entityId'])]),
    direction: z.enum(['asc', 'desc'])
  }).optional()
}).refine(
  (data) => new Date(data.startDate) < new Date(data.endDate),
  { message: 'startDate must be before endDate' }
).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 365;
  },
  { message: 'Date range cannot exceed 365 days' }
);

/**
 * Performance comparison validation
 */
export const ComparePerformanceSchema = z.object({
  customerId: customerIdSchema,
  baselinePeriod: z.object({
    startDate: isoTimestamp,
    endDate: isoTimestamp
  }),
  comparisonPeriod: z.object({
    startDate: isoTimestamp,
    endDate: isoTimestamp
  })
}).refine(
  (data) => new Date(data.baselinePeriod.startDate) < new Date(data.baselinePeriod.endDate),
  { message: 'Baseline startDate must be before endDate' }
).refine(
  (data) => new Date(data.comparisonPeriod.startDate) < new Date(data.comparisonPeriod.endDate),
  { message: 'Comparison startDate must be before endDate' }
);

/**
 * Baseline setting validation
 */
export const SetBaselineSchema = z.object({
  customerId: customerIdSchema,
  llmMentions: z.number().int().min(0),
  monthlyTraffic: z.number().int().min(0),
  recordedAt: isoTimestamp.optional()
});

/**
 * Time series query validation
 */
export const TimeSeriesQuerySchema = z.object({
  customerId: customerIdSchema,
  metrics: z.array(z.nativeEnum(MetricType)).min(1),
  startDate: isoTimestamp,
  endDate: isoTimestamp,
  granularity: z.nativeEnum(AggregationGranularity).default(AggregationGranularity.daily),
  entityType: z.nativeEnum(AnalyticsEntityType).optional(),
  entityId: z.string().optional()
});

/**
 * Dashboard query validation
 */
export const DashboardQuerySchema = z.object({
  customerId: customerIdSchema,
  period: z.nativeEnum(ReportPeriod).default(ReportPeriod.weekly)
});

/**
 * LLM mention query validation
 */
export const LlmMentionQuerySchema = z.object({
  customerId: customerIdSchema,
  platform: z.nativeEnum(LlmPlatform).optional(),
  startDate: isoTimestamp.optional(),
  endDate: isoTimestamp.optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20)
});
```

---

## Error Codes

```typescript
/**
 * Analytics domain-specific error codes.
 */
export const AnalyticsErrorCodes = {
  // ─────────────────────────────────────────────────────────────
  // Campaign Errors
  // ─────────────────────────────────────────────────────────────

  /** UTM campaign not found */
  CAMPAIGN_NOT_FOUND: 'ANALYTICS_CAMPAIGN_NOT_FOUND',

  /** Campaign with same parameters already exists */
  CAMPAIGN_DUPLICATE: 'ANALYTICS_CAMPAIGN_DUPLICATE',

  /** Campaign creation failed */
  CAMPAIGN_CREATION_FAILED: 'ANALYTICS_CAMPAIGN_CREATION_FAILED',

  /** Invalid UTM parameters */
  INVALID_UTM_PARAMS: 'ANALYTICS_INVALID_UTM_PARAMS',

  // ─────────────────────────────────────────────────────────────
  // Engagement Errors
  // ─────────────────────────────────────────────────────────────

  /** Entity not found for engagement tracking */
  ENTITY_NOT_FOUND: 'ANALYTICS_ENTITY_NOT_FOUND',

  /** Engagement recording failed */
  ENGAGEMENT_RECORD_FAILED: 'ANALYTICS_ENGAGEMENT_RECORD_FAILED',

  /** Invalid entity type */
  INVALID_ENTITY_TYPE: 'ANALYTICS_INVALID_ENTITY_TYPE',

  // ─────────────────────────────────────────────────────────────
  // LLM Mention / peec.ai Errors
  // ─────────────────────────────────────────────────────────────

  /** peec.ai API error */
  PEEC_API_ERROR: 'ANALYTICS_PEEC_API_ERROR',

  /** peec.ai API authentication failed */
  PEEC_AUTH_FAILED: 'ANALYTICS_PEEC_AUTH_FAILED',

  /** peec.ai API rate limited */
  PEEC_RATE_LIMITED: 'ANALYTICS_PEEC_RATE_LIMITED',

  /** peec.ai sync in progress */
  PEEC_SYNC_IN_PROGRESS: 'ANALYTICS_PEEC_SYNC_IN_PROGRESS',

  /** LLM mention not found */
  MENTION_NOT_FOUND: 'ANALYTICS_MENTION_NOT_FOUND',

  // ─────────────────────────────────────────────────────────────
  // Report Errors
  // ─────────────────────────────────────────────────────────────

  /** Report not found */
  REPORT_NOT_FOUND: 'ANALYTICS_REPORT_NOT_FOUND',

  /** Report generation failed */
  REPORT_GENERATION_FAILED: 'ANALYTICS_REPORT_GENERATION_FAILED',

  /** Report still generating */
  REPORT_PENDING: 'ANALYTICS_REPORT_PENDING',

  /** Report generation timed out */
  REPORT_TIMEOUT: 'ANALYTICS_REPORT_TIMEOUT',

  // ─────────────────────────────────────────────────────────────
  // Query/Date Range Errors
  // ─────────────────────────────────────────────────────────────

  /** Invalid date range specified */
  INVALID_DATE_RANGE: 'ANALYTICS_INVALID_DATE_RANGE',

  /** Date range too large */
  DATE_RANGE_TOO_LARGE: 'ANALYTICS_DATE_RANGE_TOO_LARGE',

  /** Query execution failed */
  QUERY_FAILED: 'ANALYTICS_QUERY_FAILED',

  /** Invalid query parameters */
  INVALID_QUERY_PARAMS: 'ANALYTICS_INVALID_QUERY_PARAMS',

  // ─────────────────────────────────────────────────────────────
  // Baseline Errors
  // ─────────────────────────────────────────────────────────────

  /** Baseline not found for customer */
  BASELINE_NOT_FOUND: 'ANALYTICS_BASELINE_NOT_FOUND',

  /** Baseline already exists (use update) */
  BASELINE_EXISTS: 'ANALYTICS_BASELINE_EXISTS',

  /** Insufficient data for analysis */
  INSUFFICIENT_DATA: 'ANALYTICS_INSUFFICIENT_DATA',

  // ─────────────────────────────────────────────────────────────
  // Authorization Errors
  // ─────────────────────────────────────────────────────────────

  /** Unauthorized access to analytics data */
  UNAUTHORIZED_ACCESS: 'ANALYTICS_UNAUTHORIZED_ACCESS',

  /** Customer not found */
  CUSTOMER_NOT_FOUND: 'ANALYTICS_CUSTOMER_NOT_FOUND'
} as const;

/**
 * Type for analytics error codes
 */
export type AnalyticsErrorCode = typeof AnalyticsErrorCodes[keyof typeof AnalyticsErrorCodes];
```

---

## Integration Points

### Events Consumed (from other domains)

The Analytics domain is primarily an event consumer, aggregating data from across the platform.

```typescript
/**
 * Events the Analytics domain consumes from other domains.
 * These events trigger metric recording and aggregation.
 */
export interface ConsumedEvents {
  // ─────────────────────────────────────────────────────────────
  // Article Domain Events
  // ─────────────────────────────────────────────────────────────

  /**
   * From Article domain - article has been published.
   * Creates tracking campaign and initializes engagement metrics.
   */
  'article.published': {
    articleId: ArticleId;
    customerId: CustomerId;
    title: string;
    publishedUrl: string;
    publishedAt: ISOTimestamp;
    clearStoryIds: ClearStoryId[];
  };

  /**
   * From Article domain - article status changed.
   * Updates internal references.
   */
  'article.status_changed': {
    articleId: ArticleId;
    customerId: CustomerId;
    previousStatus: ArticleStatus;
    newStatus: ArticleStatus;
    changedAt: ISOTimestamp;
  };

  // ─────────────────────────────────────────────────────────────
  // Reddit Distribution Domain Events
  // ─────────────────────────────────────────────────────────────

  /**
   * From Reddit Distribution domain - post has been created.
   * Creates tracking campaign and initializes engagement metrics.
   */
  'reddit_post.posted': {
    redditPostId: RedditPostId;
    redditExternalId: string;
    customerId: CustomerId;
    articleId?: ArticleId;
    subreddit: string;
    permalink: string;
    postedAt: ISOTimestamp;
  };

  /**
   * From Reddit Distribution domain - engagement metrics updated.
   * Records new engagement snapshot.
   */
  'reddit_post.engagement_updated': {
    redditPostId: RedditPostId;
    customerId: CustomerId;
    upvotes: number;
    comments: number;
    shares: number;
    previousUpvotes: number;
    previousComments: number;
    updatedAt: ISOTimestamp;
  };

  /**
   * From Reddit Distribution domain - post removed or deleted.
   * Marks engagement tracking as inactive.
   */
  'reddit_post.removed': {
    redditPostId: RedditPostId;
    customerId: CustomerId;
    reason: 'moderator' | 'user' | 'spam' | 'unknown';
    removedAt: ISOTimestamp;
  };

  // ─────────────────────────────────────────────────────────────
  // Clear Story Domain Events
  // ─────────────────────────────────────────────────────────────

  /**
   * From Clear Story domain - story selected for content.
   * Links Clear Story to downstream content for attribution.
   */
  'clear_story.selected': {
    clearStoryId: ClearStoryId;
    customerId: CustomerId;
    articleId?: ArticleId;
    selectedAt: ISOTimestamp;
  };

  // ─────────────────────────────────────────────────────────────
  // Customer Domain Events
  // ─────────────────────────────────────────────────────────────

  /**
   * From Customer domain - new customer onboarded.
   * May trigger baseline measurement.
   */
  'customer.onboarded': {
    customerId: CustomerId;
    companyName: string;
    onboardedAt: ISOTimestamp;
  };

  /**
   * From Customer domain - customer subscription changed.
   * May affect analytics features available.
   */
  'customer.tier_changed': {
    customerId: CustomerId;
    previousTier: string;
    newTier: string;
    changedAt: ISOTimestamp;
  };
}
```

### Events Published (to other domains)

```typescript
/**
 * Events the Analytics domain publishes for other domains to consume.
 */
export interface PublishedEvents {
  /**
   * Emitted when engagement targets are met.
   * May trigger notifications or celebrate milestones.
   */
  'analytics.targets_met': {
    customerId: CustomerId;
    targetType: 'upvotes' | 'comments' | 'llm_mentions' | 'traffic';
    entityType?: AnalyticsEntityType;
    entityId?: string;
    currentValue: number;
    targetValue: number;
    metAt: ISOTimestamp;
  };

  /**
   * Emitted when a performance report is ready.
   * May trigger email notifications.
   */
  'analytics.report_ready': {
    reportId: string;
    customerId: CustomerId;
    period: ReportPeriod;
    generatedAt: ISOTimestamp;
  };

  /**
   * Emitted when significant LLM mention change detected.
   * Useful for alerting on mention spikes or drops.
   */
  'analytics.mention_trend_alert': {
    customerId: CustomerId;
    changePercent: number;
    direction: 'increase' | 'decrease';
    period: string;
    detectedAt: ISOTimestamp;
  };

  /**
   * Emitted when content performance is exceptional.
   * May trigger case study or best practice identification.
   */
  'analytics.high_performer': {
    customerId: CustomerId;
    entityType: AnalyticsEntityType;
    entityId: string;
    engagementLevel: EngagementLevel;
    metrics: {
      upvotes: number;
      comments: number;
      clicks: number;
    };
    detectedAt: ISOTimestamp;
  };
}
```

### External Integrations

```typescript
/**
 * peec.ai Integration Configuration
 * External service for LLM mention tracking.
 */
export interface PeecAiConfig {
  /** peec.ai API base URL */
  baseUrl: string;

  /** API key for authentication */
  apiKey: string;

  /** Webhook URL for real-time mentions (optional) */
  webhookUrl?: string;

  /** Sync frequency in minutes (default: 60) */
  syncFrequencyMinutes: number;

  /** Maximum mentions to fetch per request */
  maxMentionsPerRequest: number;
}

/**
 * peec.ai API Response Types
 */
export interface PeecApiMention {
  id: string;
  brand: string;
  platform: string;
  query: string;
  response_text: string;
  context: string;
  sentiment: string;
  detected_at: string;
  confidence: number;
  keywords: string[];
}

export interface PeecApiResponse {
  success: boolean;
  data: PeecApiMention[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    has_more: boolean;
  };
  meta: {
    request_id: string;
    rate_limit_remaining: number;
  };
}
```

---

## Notes for Implementers

1. **Engagement Level Calculation**: Use the following thresholds based on Phase 1 targets:
   ```typescript
   function calculateEngagementLevel(upvotes: number, comments: number): EngagementLevel {
     if (upvotes >= TARGET_REDDIT_UPVOTES * 5 && comments >= TARGET_REDDIT_COMMENTS * 5) {
       return EngagementLevel.viral;
     }
     if (upvotes >= TARGET_REDDIT_UPVOTES * 2 && comments >= TARGET_REDDIT_COMMENTS * 2) {
       return EngagementLevel.high;
     }
     if (upvotes >= TARGET_REDDIT_UPVOTES && comments >= TARGET_REDDIT_COMMENTS) {
       return EngagementLevel.medium;
     }
     return EngagementLevel.low;
   }
   ```

2. **Target Success Calculation**: Content meets targets when:
   - Reddit posts: `upvotes >= 10 AND comments >= 2`
   - LLM mentions: `currentCount / baselineCount >= 1.20` (20% increase)
   - Traffic: `currentTraffic / baselineTraffic >= 1.50` (50% increase)

3. **Time Series Aggregation**: When aggregating time series:
   - `hourly`: Group by hour, max 7 days range
   - `daily`: Group by day, max 90 days range
   - `weekly`: Group by ISO week, max 365 days range
   - `monthly`: Group by month, max 3 years range

4. **peec.ai Sync Strategy**:
   - Poll every 60 minutes for new mentions
   - Use `peecReferenceId` to deduplicate
   - Store `lastSyncedAt` per customer for incremental sync
   - Handle rate limits with exponential backoff

5. **Privacy Considerations**:
   - Hash IP addresses before storage
   - Do not store raw user agents for more than 30 days
   - Aggregate click data after 90 days

6. **Report Generation**:
   - Use async job processing for reports
   - Cache dashboard stats for 5 minutes
   - Pre-compute common aggregations nightly

7. **Event Processing**:
   - Process engagement events within 5 minutes
   - Batch LLM mention syncs to avoid rate limits
   - Use idempotent handlers with event deduplication

---

*Contract Version: 1.0.0 | Generated: 2026-01-18*
