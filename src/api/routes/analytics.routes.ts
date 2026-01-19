/**
 * Analytics API Routes
 *
 * REST endpoints for analytics, reporting, and metrics in the GEO Platform.
 * Includes UTM campaigns, engagement metrics, LLM mentions, and performance reports.
 *
 * @module api/routes/analytics.routes
 * @version 1.0.0
 */

import { Hono } from 'hono';
import { AnalyticsService } from '../../analytics/analytics.service';
import type {
  CustomerId,
  PaginationParams,
} from '../../shared/shared.types';
import type {
  ISOTimestamp,
  UtmCampaignId,
  ReportPeriod,
  CreateCampaignInput,
  AnalyticsEntityType,
  AggregationGranularity,
  LlmPlatform,
  MetricType,
} from '../../domains/analytics/analytics.types';

/**
 * Helper to cast string to ISOTimestamp
 */
function toISOTimestamp(value: string | undefined): ISOTimestamp | undefined {
  return value as ISOTimestamp | undefined;
}

function toISOTimestampRequired(value: string): ISOTimestamp {
  return value as ISOTimestamp;
}

const app = new Hono();

// Initialize service with in-memory repositories
const service = new AnalyticsService();

// =============================================================================
// UTM CAMPAIGN ENDPOINTS
// =============================================================================

/**
 * GET /campaigns - List UTM campaigns for a customer
 */
app.get('/campaigns', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;
    const isActive = c.req.query('isActive') === 'true' ? true : c.req.query('isActive') === 'false' ? false : undefined;
    const source = c.req.query('source');
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const pagination: PaginationParams = { page, pageSize };
    const result = await service.getCampaigns(customerId, {
      isActive,
      source,
      pagination,
    });
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /campaigns/:id - Get campaign by ID
 */
app.get('/campaigns/:id', async (c) => {
  try {
    const id = c.req.param('id') as UtmCampaignId;
    const campaign = await service.getCampaign(id);

    if (!campaign) {
      return c.json({ error: 'Campaign not found' }, 404);
    }

    return c.json(campaign);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /campaigns - Create a new UTM campaign
 */
app.post('/campaigns', async (c) => {
  try {
    const body = await c.req.json<CreateCampaignInput>();
    const campaign = await service.createCampaign(body);
    return c.json(campaign, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /campaigns/:id/stats - Get campaign statistics
 */
app.get('/campaigns/:id/stats', async (c) => {
  try {
    const id = c.req.param('id') as UtmCampaignId;
    const startDate = toISOTimestamp(c.req.query('startDate'));
    const endDate = toISOTimestamp(c.req.query('endDate'));
    const granularity = c.req.query('granularity') as AggregationGranularity | undefined;

    const stats = await service.getCampaignStats(id, {
      startDate,
      endDate,
      granularity,
    });
    return c.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /campaigns/:id/clicks - Track a click
 */
app.post('/campaigns/:id/clicks', async (c) => {
  try {
    const id = c.req.param('id') as UtmCampaignId;
    const body = await c.req.json<{
      timestamp: ISOTimestamp;
      referrer?: string;
      userAgent?: string;
      ipAddress?: string;
      device?: string;
      browser?: string;
      os?: string;
      country?: string;
      region?: string;
      city?: string;
      sessionId?: string;
      isUniqueVisitor: boolean;
      landingPage: string;
    }>();

    const click = await service.trackClick(id, body);
    return c.json(click, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

// =============================================================================
// ENGAGEMENT ENDPOINTS
// =============================================================================

/**
 * GET /engagement/:entityType/:entityId - Get engagement for an entity
 */
app.get('/engagement/:entityType/:entityId', async (c) => {
  try {
    const entityType = c.req.param('entityType') as AnalyticsEntityType;
    const entityId = c.req.param('entityId');

    const engagement = await service.getEngagementByEntity(entityType, entityId);
    if (!engagement) {
      return c.json({ error: 'Engagement metrics not found' }, 404);
    }

    return c.json(engagement);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /engagement/:entityType/:entityId - Record engagement
 */
app.post('/engagement/:entityType/:entityId', async (c) => {
  try {
    const entityType = c.req.param('entityType') as AnalyticsEntityType;
    const entityId = c.req.param('entityId');
    const body = await c.req.json<{
      upvotes?: number;
      comments?: number;
      shares?: number;
      clicks?: number;
      impressions?: number;
    }>();

    const engagement = await service.recordEngagement(entityType, entityId, body);
    return c.json(engagement);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /engagement/aggregate - Aggregate engagement metrics
 */
app.get('/engagement/aggregate', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;
    const entityTypes = c.req.query('entityTypes')?.split(',') as AnalyticsEntityType[] | undefined;
    const startDate = toISOTimestamp(c.req.query('startDate'));
    const endDate = toISOTimestamp(c.req.query('endDate'));
    const groupBy = c.req.query('groupBy') as 'day' | 'week' | 'month' | 'entity' | undefined;

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const result = await service.aggregateEngagement(customerId, {
      entityTypes,
      startDate,
      endDate,
      groupBy,
    });
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// LLM MENTIONS ENDPOINTS
// =============================================================================

/**
 * GET /llm-mentions - Get LLM mentions for a customer
 */
app.get('/llm-mentions', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;
    const platform = c.req.query('platform') as LlmPlatform | undefined;
    const startDate = toISOTimestamp(c.req.query('startDate'));
    const endDate = toISOTimestamp(c.req.query('endDate'));
    const sentiment = c.req.query('sentiment') as 'positive' | 'neutral' | 'negative' | undefined;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const pagination: PaginationParams = { page, pageSize };
    const result = await service.getLlmMentions(customerId, {
      platform,
      startDate,
      endDate,
      sentiment,
      pagination,
    });
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /llm-mentions/sync - Sync LLM mentions from peec.ai
 */
app.post('/llm-mentions/sync', async (c) => {
  try {
    const body = await c.req.json<{ customerId: CustomerId }>();

    if (!body.customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const result = await service.syncLlmMentions(body.customerId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /llm-mentions/trend - Get LLM mention trend
 */
app.get('/llm-mentions/trend', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;
    const startDate = toISOTimestamp(c.req.query('startDate'));
    const endDate = toISOTimestamp(c.req.query('endDate'));
    const granularity = c.req.query('granularity') as AggregationGranularity | undefined;
    const platforms = c.req.query('platforms')?.split(',') as LlmPlatform[] | undefined;

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const trend = await service.getLlmMentionTrend(customerId, {
      startDate,
      endDate,
      granularity,
      platforms,
    });
    return c.json(trend);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// PERFORMANCE REPORTS ENDPOINTS
// =============================================================================

/**
 * GET /reports - Get report history for a customer
 */
app.get('/reports', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;
    const period = c.req.query('period') as ReportPeriod | undefined;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const pagination: PaginationParams = { page, pageSize };
    const result = await service.getReportHistory(customerId, {
      period,
      pagination,
    });
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /reports/:id - Get a specific report
 */
app.get('/reports/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const report = await service.getReport(id);

    if (!report) {
      return c.json({ error: 'Report not found' }, 404);
    }

    return c.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /reports/generate - Generate a new report
 */
app.post('/reports/generate', async (c) => {
  try {
    const body = await c.req.json<{
      customerId: CustomerId;
      period: ReportPeriod;
      startDate?: ISOTimestamp;
      endDate?: ISOTimestamp;
    }>();

    if (!body.customerId || !body.period) {
      return c.json({ error: 'Customer ID and period are required' }, 400);
    }

    const report = await service.generateReport(body.customerId, {
      period: body.period,
      startDate: body.startDate,
      endDate: body.endDate,
    });
    return c.json(report, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// TIME SERIES & COMPARISONS
// =============================================================================

/**
 * GET /time-series - Get time series metrics
 */
app.get('/time-series', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;
    const metrics = c.req.query('metrics')?.split(',') as MetricType[] | undefined;
    const entityTypes = c.req.query('entityTypes')?.split(',') as AnalyticsEntityType[] | undefined;
    const startDateStr = c.req.query('startDate');
    const endDateStr = c.req.query('endDate');
    const groupBy = c.req.query('groupBy') as 'day' | 'week' | 'month' | undefined;

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    // Default to last 30 days if no date range provided
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = (startDateStr || thirtyDaysAgo.toISOString()) as ISOTimestamp;
    const endDate = (endDateStr || now.toISOString()) as ISOTimestamp;

    const result = await service.getTimeSeries({
      customerId,
      metrics,
      entityTypes,
      startDate,
      endDate,
      groupBy,
    });
    return c.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /compare - Compare performance between periods
 */
app.post('/compare', async (c) => {
  try {
    const body = await c.req.json<{
      customerId: CustomerId;
      baselinePeriod: { startDate: ISOTimestamp; endDate: ISOTimestamp };
      comparisonPeriod: { startDate: ISOTimestamp; endDate: ISOTimestamp };
    }>();

    if (!body.customerId || !body.baselinePeriod || !body.comparisonPeriod) {
      return c.json({ error: 'Customer ID, baseline period, and comparison period are required' }, 400);
    }

    const result = await service.comparePerformance(
      body.customerId,
      body.baselinePeriod,
      body.comparisonPeriod
    );
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// DASHBOARD & SUMMARY ENDPOINTS
// =============================================================================

/**
 * GET /dashboard - Get dashboard stats
 */
app.get('/dashboard', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;
    const period = c.req.query('period') as ReportPeriod | undefined;

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const stats = await service.getDashboardStats(customerId, period);
    return c.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /top-performing - Get top performing content
 */
app.get('/top-performing', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;
    const startDate = toISOTimestamp(c.req.query('startDate'));
    const endDate = toISOTimestamp(c.req.query('endDate'));
    const limit = parseInt(c.req.query('limit') || '10', 10);

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const result = await service.getTopPerformingContent(customerId, {
      startDate,
      endDate,
      limit,
    });
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// BASELINE ENDPOINTS
// =============================================================================

/**
 * GET /baseline - Get customer baseline
 */
app.get('/baseline', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const baseline = await service.getBaseline(customerId);
    if (!baseline) {
      return c.json({ error: 'Baseline not found' }, 404);
    }

    return c.json(baseline);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /baseline - Set customer baseline
 */
app.post('/baseline', async (c) => {
  try {
    const body = await c.req.json<{
      customerId: CustomerId;
      llmMentions: number;
      monthlyTraffic: number;
      recordedAt: ISOTimestamp;
    }>();

    if (!body.customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const baseline = await service.setBaseline(body.customerId, {
      llmMentions: body.llmMentions,
      monthlyTraffic: body.monthlyTraffic,
      recordedAt: body.recordedAt,
    });
    return c.json(baseline, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

export default app;
