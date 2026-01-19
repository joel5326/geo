/**
 * Clear Story Repository - In-Memory Implementation
 *
 * This module provides an in-memory implementation of the IClearStoryRepository
 * interface for the GEO Platform. It uses a Map for storage and
 * implements all required CRUD and query operations.
 *
 * @module clear-story/repository
 * @version 1.0.0
 */

import {
  ClearStoryId,
  CustomerId,
  KolId,
  ISOTimestamp,
  ClearStorySource,
  DEFAULT_PAGE_SIZE
} from '../shared/shared.types';

import {
  ClearStory,
  ClearStoryStatus,
  ClearStorySearchParams,
  IClearStoryRepository,
  CONFIDENCE_THRESHOLDS,
  CLEAR_STORY_CONSTANTS
} from '../domains/clear-story/clear-story.types';

/**
 * In-memory implementation of the Clear Story repository.
 * Suitable for development, testing, and demonstration purposes.
 */
export class InMemoryClearStoryRepository implements IClearStoryRepository {
  private stories = new Map<ClearStoryId, ClearStory>();

  /**
   * Generate a new Clear Story ID with the cs_ prefix.
   */
  private generateId(): ClearStoryId {
    return `cs_${crypto.randomUUID()}` as ClearStoryId;
  }

  /**
   * Get current timestamp in ISO format.
   */
  private now(): ISOTimestamp {
    return new Date().toISOString();
  }

  /**
   * Generate belief summary from full belief text.
   */
  private generateBeliefSummary(belief: string): string {
    if (belief.length <= CLEAR_STORY_CONSTANTS.BELIEF_SUMMARY_LENGTH) {
      return belief;
    }
    return belief.substring(0, CLEAR_STORY_CONSTANTS.BELIEF_SUMMARY_LENGTH - 3) + '...';
  }

  // -------------------------------------------------------------------------
  // Basic CRUD
  // -------------------------------------------------------------------------

  async create(
    data: Omit<ClearStory, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'beliefSummary'>
  ): Promise<ClearStory> {
    const id = this.generateId();
    const timestamp = this.now();

    const clearStory: ClearStory = {
      ...data,
      id,
      beliefSummary: this.generateBeliefSummary(data.belief),
      usageCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.stories.set(id, clearStory);
    return clearStory;
  }

  async findById(id: ClearStoryId): Promise<ClearStory | null> {
    return this.stories.get(id) ?? null;
  }

  async findByIds(ids: ClearStoryId[]): Promise<ClearStory[]> {
    const results: ClearStory[] = [];
    for (const id of ids) {
      const story = this.stories.get(id);
      if (story) {
        results.push(story);
      }
    }
    return results;
  }

  async update(id: ClearStoryId, data: Partial<ClearStory>): Promise<ClearStory> {
    const existing = this.stories.get(id);
    if (!existing) {
      throw new Error(`Clear Story not found: ${id}`);
    }

    const updated: ClearStory = {
      ...existing,
      ...data,
      id: existing.id, // Preserve original ID
      createdAt: existing.createdAt, // Preserve creation timestamp
      createdBy: existing.createdBy, // Preserve creator
      updatedAt: this.now()
    };

    // Regenerate belief summary if belief was updated
    if (data.belief && data.belief !== existing.belief) {
      updated.beliefSummary = this.generateBeliefSummary(data.belief);
    }

    this.stories.set(id, updated);
    return updated;
  }

  async softDelete(id: ClearStoryId): Promise<void> {
    const existing = this.stories.get(id);
    if (!existing) {
      throw new Error(`Clear Story not found: ${id}`);
    }

    const updated: ClearStory = {
      ...existing,
      status: ClearStoryStatus.archived,
      updatedAt: this.now()
    };

    this.stories.set(id, updated);
  }

  async hardDelete(id: ClearStoryId): Promise<void> {
    if (!this.stories.has(id)) {
      throw new Error(`Clear Story not found: ${id}`);
    }
    this.stories.delete(id);
  }

  // -------------------------------------------------------------------------
  // Query Methods
  // -------------------------------------------------------------------------

  async findByCustomer(
    customerId: CustomerId,
    options?: {
      status?: ClearStoryStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<ClearStory[]> {
    const results: ClearStory[] = [];
    const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = options?.offset ?? 0;

    for (const story of this.stories.values()) {
      if (story.customerId === customerId) {
        if (options?.status && story.status !== options.status) {
          continue;
        }
        results.push(story);
      }
    }

    // Sort by creation date descending
    results.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return results.slice(offset, offset + limit);
  }

  async countByCustomer(customerId: CustomerId, status?: ClearStoryStatus): Promise<number> {
    let count = 0;
    for (const story of this.stories.values()) {
      if (story.customerId === customerId) {
        if (status && story.status !== status) {
          continue;
        }
        count++;
      }
    }
    return count;
  }

  async search(params: ClearStorySearchParams): Promise<{
    data: ClearStory[];
    total: number;
  }> {
    let results: ClearStory[] = [];

    for (const story of this.stories.values()) {
      // Apply filters
      if (params.customerId && story.customerId !== params.customerId) {
        continue;
      }

      if (params.query) {
        const queryLower = params.query.toLowerCase();
        const matchesTopic = story.topic.toLowerCase().includes(queryLower);
        const matchesBelief = story.belief.toLowerCase().includes(queryLower);
        if (!matchesTopic && !matchesBelief) {
          continue;
        }
      }

      if (params.topic && !story.topic.toLowerCase().includes(params.topic.toLowerCase())) {
        continue;
      }

      if (params.sources && params.sources.length > 0) {
        if (!params.sources.includes(story.source)) {
          continue;
        }
      }

      if (params.categories && params.categories.length > 0) {
        if (!params.categories.includes(story.category)) {
          continue;
        }
      }

      if (params.statuses && params.statuses.length > 0) {
        if (!params.statuses.includes(story.status)) {
          continue;
        }
      } else if (!params.includeArchived && story.status === ClearStoryStatus.archived) {
        continue;
      }

      if (params.minConfidence) {
        const threshold = CONFIDENCE_THRESHOLDS[params.minConfidence];
        if (story.confidenceScore < threshold) {
          continue;
        }
      }

      if (params.kolIds && params.kolIds.length > 0) {
        const storyKolIds = story.supportingKols.map(k => k.id);
        if (!params.kolIds.some(kolId => storyKolIds.includes(kolId))) {
          continue;
        }
      }

      if (params.tags && params.tags.length > 0) {
        if (!params.tags.some(tag => story.tags.includes(tag))) {
          continue;
        }
      }

      if (params.competitors && params.competitors.length > 0) {
        if (!story.competitors || !params.competitors.some(c => story.competitors?.includes(c))) {
          continue;
        }
      }

      if (params.targetAudience) {
        if (!story.targetAudiences || !story.targetAudiences.includes(params.targetAudience)) {
          continue;
        }
      }

      if (params.tone) {
        if (!story.recommendedTones.includes(params.tone)) {
          continue;
        }
      }

      if (params.excludeUsedWithinDays && story.lastUsedAt) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - params.excludeUsedWithinDays);
        if (new Date(story.lastUsedAt) > daysAgo) {
          continue;
        }
      }

      if (params.minEngagement && story.performanceMetrics) {
        if (story.performanceMetrics.avgEngagement < params.minEngagement) {
          continue;
        }
      }

      if (!params.includeExpired && story.expiresAt) {
        if (new Date(story.expiresAt) < new Date()) {
          continue;
        }
      }

      results.push(story);
    }

    // Sort
    const sortBy = params.sortBy ?? 'createdAt';
    const sortOrder = params.sortOrder ?? 'desc';
    const multiplier = sortOrder === 'desc' ? -1 : 1;

    results.sort((a, b) => {
      switch (sortBy) {
        case 'usageCount':
          return (a.usageCount - b.usageCount) * multiplier;
        case 'createdAt':
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * multiplier;
        case 'lastUsedAt':
          const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
          const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
          return (aTime - bTime) * multiplier;
        case 'confidence':
          return (a.confidenceScore - b.confidenceScore) * multiplier;
        case 'engagement':
          const aEng = a.performanceMetrics?.avgEngagement ?? 0;
          const bEng = b.performanceMetrics?.avgEngagement ?? 0;
          return (aEng - bEng) * multiplier;
        default: // relevance - use created date as fallback
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * multiplier;
      }
    });

    const total = results.length;

    // Paginate
    const page = params.pagination?.page ?? 1;
    const pageSize = params.pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;
    results = results.slice(offset, offset + pageSize);

    return { data: results, total };
  }

  async findByTopic(
    topic: string,
    customerId?: CustomerId,
    limit?: number
  ): Promise<ClearStory[]> {
    const results: ClearStory[] = [];
    const topicLower = topic.toLowerCase();
    const maxResults = limit ?? DEFAULT_PAGE_SIZE;

    for (const story of this.stories.values()) {
      if (customerId && story.customerId !== customerId) {
        continue;
      }
      if (story.topic.toLowerCase().includes(topicLower)) {
        results.push(story);
        if (results.length >= maxResults) {
          break;
        }
      }
    }

    return results;
  }

  async findBySource(
    source: ClearStorySource,
    customerId?: CustomerId,
    limit?: number
  ): Promise<ClearStory[]> {
    const results: ClearStory[] = [];
    const maxResults = limit ?? DEFAULT_PAGE_SIZE;

    for (const story of this.stories.values()) {
      if (customerId && story.customerId !== customerId) {
        continue;
      }
      if (story.source === source) {
        results.push(story);
        if (results.length >= maxResults) {
          break;
        }
      }
    }

    return results;
  }

  async findByKol(kolId: KolId, limit?: number): Promise<ClearStory[]> {
    const results: ClearStory[] = [];
    const maxResults = limit ?? DEFAULT_PAGE_SIZE;

    for (const story of this.stories.values()) {
      if (story.supportingKols.some(kol => kol.id === kolId)) {
        results.push(story);
        if (results.length >= maxResults) {
          break;
        }
      }
    }

    return results;
  }

  async findByTags(
    tags: string[],
    customerId?: CustomerId,
    limit?: number
  ): Promise<ClearStory[]> {
    const results: ClearStory[] = [];
    const maxResults = limit ?? DEFAULT_PAGE_SIZE;

    for (const story of this.stories.values()) {
      if (customerId && story.customerId !== customerId) {
        continue;
      }
      if (tags.some(tag => story.tags.includes(tag))) {
        results.push(story);
        if (results.length >= maxResults) {
          break;
        }
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Aggregation Methods
  // -------------------------------------------------------------------------

  async findTopUsed(customerId: CustomerId, limit: number): Promise<ClearStory[]> {
    const results: ClearStory[] = [];

    for (const story of this.stories.values()) {
      if (story.customerId === customerId && story.status === ClearStoryStatus.active) {
        results.push(story);
      }
    }

    results.sort((a, b) => b.usageCount - a.usageCount);
    return results.slice(0, limit);
  }

  async findRecent(customerId: CustomerId, limit: number): Promise<ClearStory[]> {
    const results: ClearStory[] = [];

    for (const story of this.stories.values()) {
      if (story.customerId === customerId) {
        results.push(story);
      }
    }

    results.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return results.slice(0, limit);
  }

  async findLeastUsed(customerId: CustomerId, limit: number): Promise<ClearStory[]> {
    const results: ClearStory[] = [];

    for (const story of this.stories.values()) {
      if (story.customerId === customerId && story.status === ClearStoryStatus.active) {
        results.push(story);
      }
    }

    results.sort((a, b) => a.usageCount - b.usageCount);
    return results.slice(0, limit);
  }

  async findExpiring(customerId: CustomerId, beforeDate: ISOTimestamp): Promise<ClearStory[]> {
    const results: ClearStory[] = [];
    const cutoff = new Date(beforeDate);

    for (const story of this.stories.values()) {
      if (story.customerId === customerId && story.expiresAt) {
        const expiresAt = new Date(story.expiresAt);
        if (expiresAt <= cutoff && expiresAt > new Date()) {
          results.push(story);
        }
      }
    }

    results.sort((a, b) =>
      new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime()
    );
    return results;
  }

  async getStats(customerId: CustomerId): Promise<{
    totalCount: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
    byCategory: Record<string, number>;
    avgConfidence: number;
    totalUsage: number;
  }> {
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalCount = 0;
    let totalConfidence = 0;
    let totalUsage = 0;

    for (const story of this.stories.values()) {
      if (story.customerId !== customerId) {
        continue;
      }

      totalCount++;
      totalConfidence += story.confidenceScore;
      totalUsage += story.usageCount;

      byStatus[story.status] = (byStatus[story.status] ?? 0) + 1;
      bySource[story.source] = (bySource[story.source] ?? 0) + 1;
      byCategory[story.category] = (byCategory[story.category] ?? 0) + 1;
    }

    return {
      totalCount,
      byStatus,
      bySource,
      byCategory,
      avgConfidence: totalCount > 0 ? totalConfidence / totalCount : 0,
      totalUsage
    };
  }

  // -------------------------------------------------------------------------
  // Bulk Operations
  // -------------------------------------------------------------------------

  async bulkUpdate(ids: ClearStoryId[], data: Partial<ClearStory>): Promise<number> {
    let count = 0;
    const timestamp = this.now();

    for (const id of ids) {
      const existing = this.stories.get(id);
      if (existing) {
        const updated: ClearStory = {
          ...existing,
          ...data,
          id: existing.id,
          createdAt: existing.createdAt,
          createdBy: existing.createdBy,
          updatedAt: timestamp
        };

        if (data.belief && data.belief !== existing.belief) {
          updated.beliefSummary = this.generateBeliefSummary(data.belief);
        }

        this.stories.set(id, updated);
        count++;
      }
    }

    return count;
  }

  async bulkInsert(stories: Omit<ClearStory, 'id'>[]): Promise<ClearStory[]> {
    const results: ClearStory[] = [];
    const timestamp = this.now();

    for (const storyData of stories) {
      const id = this.generateId();
      const clearStory: ClearStory = {
        ...storyData,
        id,
        createdAt: storyData.createdAt ?? timestamp,
        updatedAt: storyData.updatedAt ?? timestamp
      };

      this.stories.set(id, clearStory);
      results.push(clearStory);
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Usage Tracking
  // -------------------------------------------------------------------------

  async incrementUsage(id: ClearStoryId): Promise<number> {
    const existing = this.stories.get(id);
    if (!existing) {
      throw new Error(`Clear Story not found: ${id}`);
    }

    const updated: ClearStory = {
      ...existing,
      usageCount: existing.usageCount + 1,
      lastUsedAt: this.now(),
      updatedAt: this.now()
    };

    this.stories.set(id, updated);
    return updated.usageCount;
  }

  async updateMetrics(
    id: ClearStoryId,
    metrics: {
      engagement?: number;
      ctr?: number;
      mentionSuccess?: boolean;
    }
  ): Promise<void> {
    const existing = this.stories.get(id);
    if (!existing) {
      throw new Error(`Clear Story not found: ${id}`);
    }

    const currentMetrics = existing.performanceMetrics ?? {
      avgEngagement: 0,
      successfulMentions: 0,
      avgCtr: 0
    };

    // Calculate running averages
    const usageCount = existing.usageCount || 1;

    const updated: ClearStory = {
      ...existing,
      performanceMetrics: {
        avgEngagement: metrics.engagement !== undefined
          ? (currentMetrics.avgEngagement * (usageCount - 1) + metrics.engagement) / usageCount
          : currentMetrics.avgEngagement,
        successfulMentions: metrics.mentionSuccess
          ? currentMetrics.successfulMentions + 1
          : currentMetrics.successfulMentions,
        avgCtr: metrics.ctr !== undefined
          ? (currentMetrics.avgCtr * (usageCount - 1) + metrics.ctr) / usageCount
          : currentMetrics.avgCtr
      },
      updatedAt: this.now()
    };

    this.stories.set(id, updated);
  }
}
