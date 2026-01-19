/**
 * @fileoverview Analytics Domain Service Implementation
 * @description Implementation of IAnalyticsService for the Analytics domain.
 * @module analytics/analytics.service
 * @version 1.0.0
 */

import {
  CustomerId,
  ISOTimestamp,
  EngagementLevel,
  Platform,
  UtmCampaign,
  UtmClick,
  LlmMention,
  EngagementMetric,
  PerformanceReport,
  CustomerBaseline,
  CreateCampaignInput,
  ReportPeriod,
  LlmPlatform,
  AnalyticsEntityType,
  AggregationGranularity,
  MetricType,
  MetricTimeSeries,
  TimeSeriesDataPoint,
  PerformanceComparison,
  DashboardStats,
  TopPerformingContent,
  CampaignStats,
  UtmCampaignId,
  PaginationParams,
  PaginatedResponse,
  AnalyticsQuery,
  IAnalyticsService,
  IUtmCampaignRepository,
  IUtmClickRepository,
  ILlmMentionRepository,
  IEngagementMetricRepository,
  IPerformanceReportRepository,
  TARGET_LLM_MENTION_INCREASE,
  TARGET_TRAFFIC_INCREASE,
  TARGET_REDDIT_UPVOTES,
  TARGET_REDDIT_COMMENTS,
} from '../domains/analytics/analytics.types';

import {
  InMemoryUtmCampaignRepository,
  InMemoryUtmClickRepository,
  InMemoryLlmMentionRepository,
  InMemoryEngagementMetricRepository,
  InMemoryPerformanceReportRepository,
  InMemoryCustomerBaselineRepository,
  ICustomerBaselineRepository,
} from './analytics.repository';

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
 * Build paginated response
 */
function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination?: PaginationParams
): PaginatedResponse<T> {
  const page = pagination?.page || 1;
  const pageSize = pagination?.pageSize || 20;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

/**
 * Get date N days ago
 */
function daysAgo(days: number): ISOTimestamp {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString() as ISOTimestamp;
}

/**
 * Get start date for a report period
 */
function getStartDateForPeriod(period: ReportPeriod, endDate: ISOTimestamp): ISOTimestamp {
  const end = new Date(endDate);
  const start = new Date(end);

  switch (period) {
    case ReportPeriod.daily:
      start.setDate(end.getDate() - 1);
      break;
    case ReportPeriod.weekly:
      start.setDate(end.getDate() - 7);
      break;
    case ReportPeriod.biweekly:
      start.setDate(end.getDate() - 14);
      break;
    case ReportPeriod.monthly:
      start.setDate(end.getDate() - 30);
      break;
    case ReportPeriod.quarterly:
      start.setDate(end.getDate() - 90);
      break;
    default:
      start.setDate(end.getDate() - 7);
  }

  return start.toISOString() as ISOTimestamp;
}

// ============================================================================
// ANALYTICS SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Implementation of IAnalyticsService
 */
export class AnalyticsService implements IAnalyticsService {
  private readonly campaignRepository: IUtmCampaignRepository;
  private readonly clickRepository: IUtmClickRepository;
  private readonly mentionRepository: ILlmMentionRepository;
  private readonly engagementRepository: IEngagementMetricRepository;
  private readonly reportRepository: IPerformanceReportRepository;
  private readonly baselineRepository: ICustomerBaselineRepository;

  constructor(
    campaignRepository?: IUtmCampaignRepository,
    clickRepository?: IUtmClickRepository,
    mentionRepository?: ILlmMentionRepository,
    engagementRepository?: IEngagementMetricRepository,
    reportRepository?: IPerformanceReportRepository,
    baselineRepository?: ICustomerBaselineRepository
  ) {
    this.campaignRepository = campaignRepository || new InMemoryUtmCampaignRepository();
    this.clickRepository = clickRepository || new InMemoryUtmClickRepository();
    this.mentionRepository = mentionRepository || new InMemoryLlmMentionRepository();
    this.engagementRepository = engagementRepository || new InMemoryEngagementMetricRepository();
    this.reportRepository = reportRepository || new InMemoryPerformanceReportRepository();
    this.baselineRepository = baselineRepository || new InMemoryCustomerBaselineRepository();
  }

  // =========================================================================
  // UTM Campaign Management
  // =========================================================================

  async createCampaign(input: CreateCampaignInput): Promise<UtmCampaign> {
    return this.campaignRepository.create(input);
  }

  async getCampaign(campaignId: UtmCampaignId): Promise<UtmCampaign | null> {
    return this.campaignRepository.findById(campaignId);
  }

  async getCampaigns(
    customerId: CustomerId,
    options?: {
      isActive?: boolean;
      source?: string;
      pagination?: PaginationParams;
    }
  ): Promise<PaginatedResponse<UtmCampaign>> {
    const limit = options?.pagination?.pageSize || 20;
    const offset = options?.pagination ? (options.pagination.page - 1) * options.pagination.pageSize : 0;

    const campaigns = await this.campaignRepository.findByCustomer(customerId, {
      isActive: options?.isActive,
      source: options?.source,
      limit,
      offset,
    });

    const total = await this.campaignRepository.countByCustomer(customerId, {
      isActive: options?.isActive,
      source: options?.source,
    });

    return buildPaginatedResponse(campaigns, total, options?.pagination);
  }

  async trackClick(
    campaignId: UtmCampaignId,
    clickData: Omit<UtmClick, 'id' | 'campaignId'>
  ): Promise<UtmClick> {
    return this.clickRepository.create({
      ...clickData,
      campaignId,
    });
  }

  async getCampaignStats(
    campaignId: UtmCampaignId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      granularity?: AggregationGranularity;
    }
  ): Promise<CampaignStats> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    const granularity = options?.granularity || AggregationGranularity.daily;
    const dateOptions = {
      startDate: options?.startDate,
      endDate: options?.endDate,
    };

    const [totalClicks, uniqueVisitors, clicksByDevice, clicksByCountry, clickTimeSeries] =
      await Promise.all([
        this.clickRepository.countByCampaign(campaignId, dateOptions),
        this.clickRepository.countUniqueVisitors(campaignId, dateOptions),
        this.clickRepository.aggregateByDevice(campaignId, dateOptions),
        this.clickRepository.aggregateByCountry(campaignId, { ...dateOptions, limit: 10 }),
        this.clickRepository.getTimeSeries(campaignId, granularity, dateOptions),
      ]);

    // Calculate percentages for country breakdown
    const countryWithPercentage = clicksByCountry.map((c) => ({
      ...c,
      percentage: totalClicks > 0 ? (c.clicks / totalClicks) * 100 : 0,
    }));

    // Get top referrers (stub - would need additional repository method)
    const topReferrers: Array<{ referrer: string; clicks: number; percentage: number }> = [];

    return {
      campaign,
      totalClicks,
      uniqueVisitors,
      clicksByDevice,
      clicksByCountry: countryWithPercentage,
      clickTimeSeries,
      topReferrers,
    };
  }

  // =========================================================================
  // Engagement Metrics
  // =========================================================================

  async recordEngagement(
    entityType: AnalyticsEntityType,
    entityId: string,
    metrics: Partial<{
      upvotes: number;
      comments: number;
      shares: number;
      clicks: number;
      impressions: number;
    }>
  ): Promise<EngagementMetric> {
    return this.engagementRepository.upsert(entityType, entityId, metrics);
  }

  async getEngagementByEntity(
    entityType: AnalyticsEntityType,
    entityId: string
  ): Promise<EngagementMetric | null> {
    return this.engagementRepository.findByEntity(entityType, entityId);
  }

  async aggregateEngagement(
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
  }> {
    const groupByMapping: Record<string, 'entityType' | 'platform' | 'day' | 'week'> = {
      day: 'day',
      week: 'week',
      entity: 'entityType',
    };

    const result = await this.engagementRepository.aggregate(customerId, {
      entityTypes: options?.entityTypes,
      startDate: options?.startDate,
      endDate: options?.endDate,
      groupBy: options?.groupBy ? groupByMapping[options.groupBy] : undefined,
    });

    // Build the total metric object
    const total: Omit<EngagementMetric, 'id' | 'entityType' | 'entityId'> = {
      customerId,
      upvotes: result.totals.upvotes,
      comments: result.totals.comments,
      shares: result.totals.shares,
      clicks: result.totals.clicks,
      impressions: result.totals.impressions,
      engagementRate:
        result.totals.impressions > 0
          ? ((result.totals.upvotes + result.totals.comments + result.totals.shares) /
              result.totals.impressions) *
            100
          : 0,
      engagementLevel: EngagementLevel.medium, // Simplified
      meetsTargets:
        result.totals.upvotes >= TARGET_REDDIT_UPVOTES &&
        result.totals.comments >= TARGET_REDDIT_COMMENTS,
      platform: Platform.reddit,
      firstRecordedAt: now(),
      lastUpdatedAt: now(),
    };

    const response: {
      total: Omit<EngagementMetric, 'id' | 'entityType' | 'entityId'>;
      byGroup?: Record<string, Omit<EngagementMetric, 'id' | 'entityType' | 'entityId'>>;
    } = { total };

    if (result.byGroup) {
      response.byGroup = {};
      for (const [key, value] of Object.entries(result.byGroup)) {
        response.byGroup[key] = {
          customerId,
          upvotes: value.upvotes,
          comments: value.comments,
          shares: value.shares,
          clicks: value.clicks,
          impressions: value.impressions,
          engagementRate:
            value.impressions > 0
              ? ((value.upvotes + value.comments + value.shares) / value.impressions) * 100
              : 0,
          engagementLevel: EngagementLevel.medium,
          meetsTargets:
            value.upvotes >= TARGET_REDDIT_UPVOTES && value.comments >= TARGET_REDDIT_COMMENTS,
          platform: Platform.reddit,
          firstRecordedAt: now(),
          lastUpdatedAt: now(),
        };
      }
    }

    return response;
  }

  // =========================================================================
  // LLM Mention Tracking
  // =========================================================================

  async syncLlmMentions(customerId: CustomerId): Promise<{
    newMentions: number;
    lastSyncedAt: ISOTimestamp;
    mentions: LlmMention[];
  }> {
    // Stub implementation - in production this would call peec.ai API
    // For now, return empty result indicating no new mentions
    const lastSyncedAt = (await this.mentionRepository.getLatestSyncTimestamp(customerId)) || now();

    return {
      newMentions: 0,
      lastSyncedAt,
      mentions: [],
    };
  }

  async getLlmMentions(
    customerId: CustomerId,
    options?: {
      platform?: LlmPlatform;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      sentiment?: 'positive' | 'neutral' | 'negative';
      pagination?: PaginationParams;
    }
  ): Promise<PaginatedResponse<LlmMention>> {
    const limit = options?.pagination?.pageSize || 20;
    const offset = options?.pagination ? (options.pagination.page - 1) * options.pagination.pageSize : 0;

    const mentions = await this.mentionRepository.findByCustomer(customerId, {
      platform: options?.platform,
      startDate: options?.startDate,
      endDate: options?.endDate,
      sentiment: options?.sentiment,
      limit,
      offset,
    });

    const total = await this.mentionRepository.countByCustomer(customerId, {
      platform: options?.platform,
      startDate: options?.startDate,
      endDate: options?.endDate,
      sentiment: options?.sentiment,
    });

    return buildPaginatedResponse(mentions, total, options?.pagination);
  }

  async getLlmMentionTrend(
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
  }> {
    const granularity = options?.granularity || AggregationGranularity.daily;
    const endDate = options?.endDate || now();
    const startDate = options?.startDate || daysAgo(30);

    const dataPoints = await this.mentionRepository.getTimeSeries(customerId, granularity, {
      startDate,
      endDate,
    });

    // Get baseline from repository
    const baseline = await this.baselineRepository.get(customerId);
    const baselineCount = baseline?.llmMentions || 0;

    // Calculate current count
    const currentCount = await this.mentionRepository.countByCustomer(customerId, {
      startDate,
      endDate,
    });

    // Calculate change percentage
    const changePercent = baselineCount > 0 ? ((currentCount - baselineCount) / baselineCount) * 100 : 0;

    // Check if target is met (20% increase)
    const targetMet = changePercent >= TARGET_LLM_MENTION_INCREASE * 100;

    // Build time series response
    const timeSeries: MetricTimeSeries = {
      metric: MetricType.llmMentions,
      entityType: 'all',
      entityId: null,
      customerId,
      granularity,
      dataPoints,
      statistics: {
        min: dataPoints.length > 0 ? Math.min(...dataPoints.map((d) => d.value)) : 0,
        max: dataPoints.length > 0 ? Math.max(...dataPoints.map((d) => d.value)) : 0,
        average:
          dataPoints.length > 0
            ? dataPoints.reduce((sum, d) => sum + d.value, 0) / dataPoints.length
            : 0,
        median: this.calculateMedian(dataPoints.map((d) => d.value)),
        stdDev: this.calculateStdDev(dataPoints.map((d) => d.value)),
        trend: changePercent > 5 ? 'increasing' : changePercent < -5 ? 'decreasing' : 'stable',
        changePercent,
      },
    };

    return {
      timeSeries,
      baselineCount,
      currentCount,
      changePercent,
      targetMet,
    };
  }

  // =========================================================================
  // Performance Reports
  // =========================================================================

  async generateReport(
    customerId: CustomerId,
    options: {
      period: ReportPeriod;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }
  ): Promise<PerformanceReport> {
    const endDate = options.endDate || now();
    const startDate =
      options.startDate || getStartDateForPeriod(options.period, endDate);

    // Get aggregated engagement metrics
    const engagement = await this.engagementRepository.aggregate(customerId, {
      startDate,
      endDate,
    });

    // Get LLM mention count
    const mentionCount = await this.mentionRepository.countByCustomer(customerId, {
      startDate,
      endDate,
    });

    // Get baseline for target comparison
    const baseline = await this.baselineRepository.get(customerId);

    // Get mention breakdown by platform
    const mentionsByPlatform = await this.mentionRepository.aggregateByPlatform(customerId, {
      startDate,
      endDate,
    });

    const totalMentions = mentionsByPlatform.reduce((sum, p) => sum + p.count, 0);
    const llmMentionChange = baseline?.llmMentions
      ? ((totalMentions - baseline.llmMentions) / baseline.llmMentions) * 100
      : 0;

    // Build the report
    const report = await this.reportRepository.create({
      customerId,
      customerRef: {
        id: customerId,
        companyName: 'Customer', // Would be fetched from customer domain
      },
      period: options.period,
      startDate,
      endDate,
      summary: {
        totalArticles: 0, // Would come from article domain
        totalRedditPosts: 0, // Would come from reddit domain
        totalEngagement: {
          upvotes: engagement.totals.upvotes,
          comments: engagement.totals.comments,
          shares: engagement.totals.shares,
          clicks: engagement.totals.clicks,
          impressions: engagement.totals.impressions,
        },
        totalLlmMentions: mentionCount,
        averageEngagement:
          engagement.totals.upvotes + engagement.totals.comments + engagement.totals.clicks,
        successRate: 0, // Would be calculated from targets
      },
      targets: {
        llmMentionChange,
        llmMentionTarget: TARGET_LLM_MENTION_INCREASE * 100,
        llmMentionTargetMet: llmMentionChange >= TARGET_LLM_MENTION_INCREASE * 100,
        trafficChange: 0, // Would come from traffic tracking
        trafficTarget: TARGET_TRAFFIC_INCREASE * 100,
        trafficTargetMet: false,
        upvoteTargetRate: 0,
        commentTargetRate: 0,
      },
      articles: [],
      redditPosts: [],
      llmMentionsByPlatform: mentionsByPlatform.map((p) => ({
        platform: p.platform,
        count: p.count,
        percentage: totalMentions > 0 ? (p.count / totalMentions) * 100 : 0,
        changeFromPrevious: 0, // Would require historical comparison
      })),
      trafficSources: [],
      generatedAt: now(),
      status: 'ready',
    });

    return report;
  }

  async getReport(reportId: string): Promise<PerformanceReport | null> {
    return this.reportRepository.findById(reportId);
  }

  async getReportHistory(
    customerId: CustomerId,
    options?: {
      period?: ReportPeriod;
      pagination?: PaginationParams;
    }
  ): Promise<PaginatedResponse<PerformanceReport>> {
    const limit = options?.pagination?.pageSize || 20;
    const offset = options?.pagination ? (options.pagination.page - 1) * options.pagination.pageSize : 0;

    const reports = await this.reportRepository.findByCustomer(customerId, {
      period: options?.period,
      limit,
      offset,
    });

    // For pagination, we need total count
    const allReports = await this.reportRepository.findByCustomer(customerId, {
      period: options?.period,
    });

    return buildPaginatedResponse(reports, allReports.length, options?.pagination);
  }

  // =========================================================================
  // Time Series & Comparisons
  // =========================================================================

  async getTimeSeries(query: AnalyticsQuery): Promise<MetricTimeSeries[]> {
    const results: MetricTimeSeries[] = [];
    const granularity = this.mapGroupByToGranularity(query.groupBy);

    for (const metric of query.metrics || [MetricType.clicks]) {
      let dataPoints: TimeSeriesDataPoint[] = [];

      // Get time series data based on metric type
      switch (metric) {
        case MetricType.llmMentions:
          dataPoints = await this.mentionRepository.getTimeSeries(
            query.customerId,
            granularity,
            { startDate: query.startDate, endDate: query.endDate }
          );
          break;
        // Other metrics would be handled similarly
        default:
          // Stub for other metrics
          break;
      }

      const values = dataPoints.map((d) => d.value);
      results.push({
        metric,
        entityType: query.entityTypes?.[0] || 'all',
        entityId: query.entityIds?.[0] || null,
        customerId: query.customerId,
        granularity,
        dataPoints,
        statistics: {
          min: values.length > 0 ? Math.min(...values) : 0,
          max: values.length > 0 ? Math.max(...values) : 0,
          average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
          median: this.calculateMedian(values),
          stdDev: this.calculateStdDev(values),
          trend: 'stable',
          changePercent: 0,
        },
      });
    }

    return results;
  }

  async comparePerformance(
    customerId: CustomerId,
    baselinePeriod: { startDate: ISOTimestamp; endDate: ISOTimestamp },
    comparisonPeriod: { startDate: ISOTimestamp; endDate: ISOTimestamp }
  ): Promise<PerformanceComparison> {
    // Get baseline period metrics
    const baselineEngagement = await this.engagementRepository.aggregate(customerId, {
      startDate: baselinePeriod.startDate,
      endDate: baselinePeriod.endDate,
    });
    const baselineMentions = await this.mentionRepository.countByCustomer(customerId, {
      startDate: baselinePeriod.startDate,
      endDate: baselinePeriod.endDate,
    });

    // Get comparison period metrics
    const comparisonEngagement = await this.engagementRepository.aggregate(customerId, {
      startDate: comparisonPeriod.startDate,
      endDate: comparisonPeriod.endDate,
    });
    const comparisonMentions = await this.mentionRepository.countByCustomer(customerId, {
      startDate: comparisonPeriod.startDate,
      endDate: comparisonPeriod.endDate,
    });

    // Build metrics records
    const baselineMetrics: Partial<Record<MetricType, number>> = {
      [MetricType.upvotes]: baselineEngagement.totals.upvotes,
      [MetricType.comments]: baselineEngagement.totals.comments,
      [MetricType.shares]: baselineEngagement.totals.shares,
      [MetricType.clicks]: baselineEngagement.totals.clicks,
      [MetricType.impressions]: baselineEngagement.totals.impressions,
      [MetricType.llmMentions]: baselineMentions,
    };

    const comparisonMetrics: Partial<Record<MetricType, number>> = {
      [MetricType.upvotes]: comparisonEngagement.totals.upvotes,
      [MetricType.comments]: comparisonEngagement.totals.comments,
      [MetricType.shares]: comparisonEngagement.totals.shares,
      [MetricType.clicks]: comparisonEngagement.totals.clicks,
      [MetricType.impressions]: comparisonEngagement.totals.impressions,
      [MetricType.llmMentions]: comparisonMentions,
    };

    // Calculate differences
    const differences: Partial<Record<MetricType, { absolute: number; percentage: number; improved: boolean }>> = {};
    let improvementCount = 0;
    let declineCount = 0;

    for (const metric of Object.values(MetricType)) {
      const baseVal = baselineMetrics[metric] || 0;
      const compVal = comparisonMetrics[metric] || 0;
      const absolute = compVal - baseVal;
      const percentage = baseVal > 0 ? (absolute / baseVal) * 100 : 0;
      const improved = absolute > 0;

      differences[metric] = { absolute, percentage, improved };
      if (improved) improvementCount++;
      else if (absolute < 0) declineCount++;
    }

    const assessment: 'improved' | 'declined' | 'stable' =
      improvementCount > declineCount ? 'improved' : declineCount > improvementCount ? 'declined' : 'stable';

    return {
      baseline: {
        label: 'Baseline Period',
        startDate: baselinePeriod.startDate,
        endDate: baselinePeriod.endDate,
        metrics: baselineMetrics as Record<MetricType, number>,
      },
      comparison: {
        label: 'Comparison Period',
        startDate: comparisonPeriod.startDate,
        endDate: comparisonPeriod.endDate,
        metrics: comparisonMetrics as Record<MetricType, number>,
      },
      differences: differences as Record<MetricType, { absolute: number; percentage: number; improved: boolean }>,
      assessment,
      insights: this.generateComparisonInsights(differences, assessment),
    };
  }

  // =========================================================================
  // Dashboard & Summaries
  // =========================================================================

  async getDashboardStats(
    customerId: CustomerId,
    period?: ReportPeriod
  ): Promise<DashboardStats> {
    const reportPeriod = period || ReportPeriod.weekly;
    const endDate = now();
    const startDate = getStartDateForPeriod(reportPeriod, endDate);

    // Get current period metrics
    const engagement = await this.engagementRepository.aggregate(customerId, {
      startDate,
      endDate,
    });
    const mentionCount = await this.mentionRepository.countByCustomer(customerId, {
      startDate,
      endDate,
    });
    const targetStats = await this.engagementRepository.countMeetingTargets(customerId, {
      startDate,
      endDate,
    });

    // Get previous period for comparison
    const prevEndDate = startDate;
    const prevStartDate = getStartDateForPeriod(reportPeriod, startDate);
    const prevEngagement = await this.engagementRepository.aggregate(customerId, {
      startDate: prevStartDate,
      endDate: prevEndDate,
    });
    const prevMentionCount = await this.mentionRepository.countByCustomer(customerId, {
      startDate: prevStartDate,
      endDate: prevEndDate,
    });

    // Calculate changes
    const currentTotalEngagement =
      engagement.totals.upvotes + engagement.totals.comments + engagement.totals.clicks;
    const prevTotalEngagement =
      prevEngagement.totals.upvotes + prevEngagement.totals.comments + prevEngagement.totals.clicks;
    const engagementChange =
      prevTotalEngagement > 0
        ? ((currentTotalEngagement - prevTotalEngagement) / prevTotalEngagement) * 100
        : 0;
    const mentionsChange =
      prevMentionCount > 0 ? ((mentionCount - prevMentionCount) / prevMentionCount) * 100 : 0;

    // Get baseline for target progress
    const baseline = await this.baselineRepository.get(customerId);
    const llmMentionProgress = baseline?.llmMentions
      ? ((mentionCount - baseline.llmMentions) / baseline.llmMentions) * 100
      : 0;

    return {
      customerId,
      currentPeriod: {
        label: this.getPeriodLabel(reportPeriod),
        startDate,
        endDate,
      },
      kpis: {
        totalContent: targetStats.total,
        totalEngagement: currentTotalEngagement,
        totalMentions: mentionCount,
        totalClicks: engagement.totals.clicks,
        successRate: targetStats.rate * 100,
        avgEngagement: targetStats.total > 0 ? currentTotalEngagement / targetStats.total : 0,
      },
      comparison: {
        engagementChange,
        mentionsChange,
        clicksChange:
          prevEngagement.totals.clicks > 0
            ? ((engagement.totals.clicks - prevEngagement.totals.clicks) /
                prevEngagement.totals.clicks) *
              100
            : 0,
        successRateChange: 0, // Would need previous rate
      },
      targetProgress: {
        llmMentionProgress,
        trafficProgress: 0, // Would need traffic tracking
        daysSinceBaseline: baseline
          ? Math.floor(
              (new Date().getTime() - new Date(baseline.recordedAt).getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0,
      },
      recentActivity: [], // Would be populated from event log
      calculatedAt: now(),
    };
  }

  async getTopPerformingContent(
    customerId: CustomerId,
    options?: {
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
      limit?: number;
    }
  ): Promise<TopPerformingContent> {
    const limit = options?.limit || 10;
    const startDate = options?.startDate || daysAgo(30);
    const endDate = options?.endDate || now();

    const topMetrics = await this.engagementRepository.getTopPerforming(customerId, {
      startDate,
      endDate,
      limit,
    });

    // Separate by entity type
    const articles = topMetrics
      .filter((m) => m.entityType === AnalyticsEntityType.article)
      .map((m, idx) => ({
        articleRef: {
          id: m.entityId as any,
          title: `Article ${m.entityId}`,
          status: 'published' as any,
        },
        totalEngagement: m.upvotes + m.comments + m.clicks,
        clicks: m.clicks,
        redditPosts: 0,
        rank: idx + 1,
      }));

    const redditPosts = topMetrics
      .filter((m) => m.entityType === AnalyticsEntityType.redditPost)
      .map((m, idx) => ({
        redditPostRef: {
          id: m.entityId as any,
          subreddit: 'unknown',
          status: 'posted' as any,
        },
        upvotes: m.upvotes,
        comments: m.comments,
        clicks: m.clicks,
        engagementLevel: m.engagementLevel,
        rank: idx + 1,
      }));

    const clearStories = topMetrics
      .filter((m) => m.entityType === AnalyticsEntityType.clearStory)
      .map((m, idx) => ({
        clearStoryRef: {
          id: m.entityId as any,
          topic: 'Topic',
          beliefSummary: 'Summary',
        },
        articlesGenerated: 0,
        totalEngagement: m.upvotes + m.comments + m.clicks,
        rank: idx + 1,
      }));

    return {
      customerId,
      period: { startDate, endDate },
      topArticles: articles,
      topRedditPosts: redditPosts,
      topClearStories: clearStories,
      insights: this.generatePerformanceInsights(topMetrics),
    };
  }

  // =========================================================================
  // Baseline Management
  // =========================================================================

  async setBaseline(
    customerId: CustomerId,
    baseline: {
      llmMentions: number;
      monthlyTraffic: number;
      recordedAt: ISOTimestamp;
    }
  ): Promise<CustomerBaseline> {
    return this.baselineRepository.set(customerId, baseline);
  }

  async getBaseline(customerId: CustomerId): Promise<CustomerBaseline | null> {
    return this.baselineRepository.get(customerId);
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private mapGroupByToGranularity(
    groupBy?: 'day' | 'week' | 'month' | 'entity' | 'platform'
  ): AggregationGranularity {
    switch (groupBy) {
      case 'day':
        return AggregationGranularity.daily;
      case 'week':
        return AggregationGranularity.weekly;
      case 'month':
        return AggregationGranularity.monthly;
      default:
        return AggregationGranularity.daily;
    }
  }

  private getPeriodLabel(period: ReportPeriod): string {
    switch (period) {
      case ReportPeriod.daily:
        return 'Today';
      case ReportPeriod.weekly:
        return 'This Week';
      case ReportPeriod.biweekly:
        return 'Last 2 Weeks';
      case ReportPeriod.monthly:
        return 'This Month';
      case ReportPeriod.quarterly:
        return 'This Quarter';
      default:
        return 'Custom Period';
    }
  }

  private generateComparisonInsights(
    differences: Partial<Record<MetricType, { absolute: number; percentage: number; improved: boolean }>>,
    assessment: 'improved' | 'declined' | 'stable'
  ): string[] {
    const insights: string[] = [];

    if (assessment === 'improved') {
      insights.push('Overall performance has improved compared to the previous period.');
    } else if (assessment === 'declined') {
      insights.push('Performance has declined compared to the previous period. Consider reviewing your content strategy.');
    } else {
      insights.push('Performance has remained stable compared to the previous period.');
    }

    const upvoteDiff = differences[MetricType.upvotes];
    if (upvoteDiff && upvoteDiff.improved && upvoteDiff.percentage > 20) {
      insights.push(`Upvotes increased by ${upvoteDiff.percentage.toFixed(1)}% - content is resonating well with audiences.`);
    }

    const mentionDiff = differences[MetricType.llmMentions];
    if (mentionDiff && mentionDiff.improved && mentionDiff.percentage >= TARGET_LLM_MENTION_INCREASE * 100) {
      insights.push('LLM mention target of 20% increase has been achieved!');
    }

    return insights;
  }

  private generatePerformanceInsights(metrics: EngagementMetric[]): string[] {
    const insights: string[] = [];

    const viralContent = metrics.filter((m) => m.engagementLevel === EngagementLevel.viral);
    if (viralContent.length > 0) {
      insights.push(`${viralContent.length} piece(s) of content achieved viral status.`);
    }

    const meetingTargets = metrics.filter((m) => m.meetsTargets);
    const rate = metrics.length > 0 ? (meetingTargets.length / metrics.length) * 100 : 0;
    insights.push(`${rate.toFixed(1)}% of content is meeting engagement targets.`);

    const avgUpvotes = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.upvotes, 0) / metrics.length
      : 0;
    if (avgUpvotes >= TARGET_REDDIT_UPVOTES * 2) {
      insights.push('Average upvotes are significantly exceeding targets.');
    }

    return insights;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new AnalyticsService instance with default in-memory repositories
 */
export function createAnalyticsService(): AnalyticsService {
  return new AnalyticsService();
}
