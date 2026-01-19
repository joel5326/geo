/**
 * Clear Story Service Implementation
 *
 * This module provides the service implementation for the Clear Story domain
 * in the GEO Platform. It implements IClearStoryService and
 * orchestrates repository operations with business logic.
 *
 * @module clear-story/service
 * @version 1.0.0
 */

import {
  ClearStoryId,
  CustomerId,
  KolId,
  UserId,
  ClearStorySource,
  ContentTone,
  ISOTimestamp,
  PaginatedResponse,
  PaginationParams,
  UserRef,
  DEFAULT_PAGE_SIZE
} from '../shared/shared.types';

import {
  ClearStory,
  ClearStoryStatus,
  ClearStoryCategory,
  ClearStorySearchParams,
  ClearStoryStats,
  ClearStoryBulkOperation,
  CreateClearStoryInput,
  UpdateClearStoryInput,
  IClearStoryService,
  IClearStoryRepository,
  ConfidenceLevel,
  CONFIDENCE_THRESHOLDS,
  CLEAR_STORY_CONSTANTS,
  SupportingEvidence
} from '../domains/clear-story/clear-story.types';

/**
 * Clear Story Service implementation.
 * Provides business logic for managing Clear Stories.
 */
export class ClearStoryService implements IClearStoryService {
  constructor(private repository: IClearStoryRepository) {}

  /**
   * Get current timestamp in ISO format.
   */
  private now(): ISOTimestamp {
    return new Date().toISOString();
  }

  /**
   * Create a mock UserRef for the given user ID.
   * In a real implementation, this would fetch from the User domain.
   */
  private createUserRef(userId: UserId): UserRef {
    return {
      id: userId,
      email: `user-${userId}@example.com`,
      displayName: `User ${userId}`
    };
  }

  /**
   * Calculate confidence score from confidence level.
   */
  private getConfidenceScore(level: ConfidenceLevel): number {
    return CONFIDENCE_THRESHOLDS[level];
  }

  /**
   * Create pagination response structure.
   */
  private createPaginatedResponse<T>(
    data: T[],
    total: number,
    pagination?: PaginationParams
  ): PaginatedResponse<T> {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  async create(
    input: CreateClearStoryInput,
    userId: UserId
  ): Promise<ClearStory> {
    const userRef = this.createUserRef(userId);
    const confidence = input.confidence ?? 'medium';
    const status = input.status ?? ClearStoryStatus.draft;
    const timestamp = this.now();

    // Process evidence to add collectedAt
    const evidence: SupportingEvidence[] = (input.evidence ?? []).map(e => ({
      ...e,
      collectedAt: timestamp
    }));

    const clearStoryData = {
      customerId: input.customerId,
      topic: input.topic,
      belief: input.belief,
      source: input.source,
      category: input.category,
      status,
      confidence,
      confidenceScore: this.getConfidenceScore(confidence),
      supportingKols: input.supportingKols ?? [],
      evidence,
      tags: input.tags ?? [],
      competitors: input.competitors,
      targetAudiences: input.targetAudiences,
      recommendedTones: input.recommendedTones ?? [ContentTone.authoritative],
      expiresAt: input.expiresAt,
      internalNotes: input.internalNotes,
      createdBy: userRef,
      updatedBy: userRef
    };

    return this.repository.create(clearStoryData);
  }

  async getById(id: ClearStoryId): Promise<ClearStory | null> {
    return this.repository.findById(id);
  }

  async getByIds(ids: ClearStoryId[]): Promise<ClearStory[]> {
    return this.repository.findByIds(ids);
  }

  async search(params: ClearStorySearchParams): Promise<PaginatedResponse<ClearStory>> {
    const { data, total } = await this.repository.search(params);
    return this.createPaginatedResponse(data, total, params.pagination);
  }

  async update(
    id: ClearStoryId,
    input: UpdateClearStoryInput,
    userId: UserId
  ): Promise<ClearStory> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Clear Story not found: ${id}`);
    }

    const userRef = this.createUserRef(userId);
    const timestamp = this.now();

    // Build update data
    const updateData: Partial<ClearStory> = {
      updatedBy: userRef,
      updatedAt: timestamp
    };

    // Simple field updates
    if (input.topic !== undefined) updateData.topic = input.topic;
    if (input.belief !== undefined) updateData.belief = input.belief;
    if (input.source !== undefined) updateData.source = input.source;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.expiresAt !== undefined) updateData.expiresAt = input.expiresAt;
    if (input.internalNotes !== undefined) updateData.internalNotes = input.internalNotes;
    if (input.competitors !== undefined) updateData.competitors = input.competitors;
    if (input.targetAudiences !== undefined) updateData.targetAudiences = input.targetAudiences;
    if (input.recommendedTones !== undefined) updateData.recommendedTones = input.recommendedTones;

    // Handle confidence update
    if (input.confidence !== undefined) {
      updateData.confidence = input.confidence;
      updateData.confidenceScore = this.getConfidenceScore(input.confidence);
    }

    // Handle KOL updates
    if (input.supportingKols !== undefined) {
      updateData.supportingKols = input.supportingKols;
    } else if (input.addKols || input.removeKolIds) {
      let kols = [...existing.supportingKols];

      if (input.removeKolIds) {
        kols = kols.filter(k => !input.removeKolIds!.includes(k.id));
      }

      if (input.addKols) {
        kols = [...kols, ...input.addKols];
      }

      updateData.supportingKols = kols;
    }

    // Handle evidence updates
    if (input.evidence !== undefined) {
      updateData.evidence = input.evidence;
    } else if (input.addEvidence) {
      const newEvidence: SupportingEvidence[] = input.addEvidence.map(e => ({
        ...e,
        collectedAt: timestamp
      }));
      updateData.evidence = [...existing.evidence, ...newEvidence];
    }

    // Handle tag updates
    if (input.tags !== undefined) {
      updateData.tags = input.tags;
    } else if (input.addTags || input.removeTags) {
      let tags = [...existing.tags];

      if (input.removeTags) {
        tags = tags.filter(t => !input.removeTags!.includes(t));
      }

      if (input.addTags) {
        tags = [...new Set([...tags, ...input.addTags])];
      }

      updateData.tags = tags;
    }

    return this.repository.update(id, updateData);
  }

  async delete(id: ClearStoryId, userId: UserId): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Clear Story not found: ${id}`);
    }

    // Soft delete - archive the story
    const userRef = this.createUserRef(userId);
    await this.repository.update(id, {
      status: ClearStoryStatus.archived,
      updatedBy: userRef,
      updatedAt: this.now()
    });
  }

  async hardDelete(id: ClearStoryId): Promise<void> {
    await this.repository.hardDelete(id);
  }

  // -------------------------------------------------------------------------
  // Finder Methods
  // -------------------------------------------------------------------------

  async findByTopic(
    topic: string,
    customerId?: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ClearStory>> {
    const limit = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
    const data = await this.repository.findByTopic(topic, customerId, limit);
    return this.createPaginatedResponse(data, data.length, pagination);
  }

  async findBySource(
    source: ClearStorySource,
    customerId?: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ClearStory>> {
    const limit = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
    const data = await this.repository.findBySource(source, customerId, limit);
    return this.createPaginatedResponse(data, data.length, pagination);
  }

  async findByCustomer(
    customerId: CustomerId,
    activeOnly?: boolean,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ClearStory>> {
    const status = activeOnly !== false ? ClearStoryStatus.active : undefined;
    const limit = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = pagination ? (pagination.page - 1) * pagination.pageSize : 0;

    const data = await this.repository.findByCustomer(customerId, {
      status,
      limit,
      offset
    });

    const total = await this.repository.countByCustomer(customerId, status);
    return this.createPaginatedResponse(data, total, pagination);
  }

  async findByKol(
    kolId: KolId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ClearStory>> {
    const limit = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
    const data = await this.repository.findByKol(kolId, limit);
    return this.createPaginatedResponse(data, data.length, pagination);
  }

  async findByCategory(
    category: ClearStoryCategory,
    customerId?: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ClearStory>> {
    // Use search with category filter
    const params: ClearStorySearchParams = {
      categories: [category],
      customerId,
      pagination
    };

    return this.search(params);
  }

  async findByTags(
    tags: string[],
    customerId?: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ClearStory>> {
    const limit = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
    const data = await this.repository.findByTags(tags, customerId, limit);
    return this.createPaginatedResponse(data, data.length, pagination);
  }

  // -------------------------------------------------------------------------
  // Usage Tracking
  // -------------------------------------------------------------------------

  async incrementUsageCount(id: ClearStoryId): Promise<ClearStory> {
    await this.repository.incrementUsage(id);
    const updated = await this.repository.findById(id);
    if (!updated) {
      throw new Error(`Clear Story not found: ${id}`);
    }
    return updated;
  }

  async recordUsageWithMetrics(
    id: ClearStoryId,
    metrics: {
      engagement: number;
      ctr?: number;
      mentionSuccess: boolean;
    }
  ): Promise<ClearStory> {
    await this.repository.incrementUsage(id);
    await this.repository.updateMetrics(id, metrics);

    const updated = await this.repository.findById(id);
    if (!updated) {
      throw new Error(`Clear Story not found: ${id}`);
    }
    return updated;
  }

  // -------------------------------------------------------------------------
  // Analytics & Discovery
  // -------------------------------------------------------------------------

  async getPopular(
    customerId: CustomerId,
    limit?: number
  ): Promise<ClearStory[]> {
    return this.repository.findTopUsed(
      customerId,
      limit ?? CLEAR_STORY_CONSTANTS.DEFAULT_POPULAR_LIMIT
    );
  }

  async getRecent(
    customerId: CustomerId,
    limit?: number
  ): Promise<ClearStory[]> {
    return this.repository.findRecent(
      customerId,
      limit ?? CLEAR_STORY_CONSTANTS.DEFAULT_RECENT_LIMIT
    );
  }

  async getTopPerforming(
    customerId: CustomerId,
    limit?: number
  ): Promise<ClearStory[]> {
    // Search for stories with performance metrics, sorted by engagement
    const { data } = await this.repository.search({
      customerId,
      statuses: [ClearStoryStatus.active],
      sortBy: 'engagement',
      sortOrder: 'desc',
      pagination: { page: 1, pageSize: limit ?? CLEAR_STORY_CONSTANTS.DEFAULT_POPULAR_LIMIT }
    });

    return data;
  }

  async getUnderutilized(
    customerId: CustomerId,
    limit?: number
  ): Promise<ClearStory[]> {
    return this.repository.findLeastUsed(
      customerId,
      limit ?? CLEAR_STORY_CONSTANTS.DEFAULT_POPULAR_LIMIT
    );
  }

  async getExpiringSoon(
    customerId: CustomerId,
    withinDays?: number
  ): Promise<ClearStory[]> {
    const days = withinDays ?? CLEAR_STORY_CONSTANTS.DEFAULT_EXPIRING_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    return this.repository.findExpiring(customerId, cutoffDate.toISOString());
  }

  async getStats(customerId: CustomerId): Promise<ClearStoryStats> {
    const stats = await this.repository.getStats(customerId);

    // Find most used story
    const topUsed = await this.repository.findTopUsed(customerId, 1);
    const mostUsedId = topUsed.length > 0 ? topUsed[0].id : undefined;

    // Find most recent
    const recent = await this.repository.findRecent(customerId, 1);
    const lastCreatedAt = recent.length > 0 ? recent[0].createdAt : undefined;

    return {
      customerId,
      totalCount: stats.totalCount,
      byStatus: stats.byStatus as Record<ClearStoryStatus, number>,
      bySource: stats.bySource as Record<ClearStorySource, number>,
      byCategory: stats.byCategory as Record<ClearStoryCategory, number>,
      avgConfidence: stats.avgConfidence,
      totalUsage: stats.totalUsage,
      mostUsedId,
      lastCreatedAt,
      calculatedAt: this.now()
    };
  }

  // -------------------------------------------------------------------------
  // Bulk Operations
  // -------------------------------------------------------------------------

  async bulkOperation(
    operation: ClearStoryBulkOperation,
    userId: UserId
  ): Promise<{ affected: number }> {
    const userRef = this.createUserRef(userId);
    const timestamp = this.now();

    let affected = 0;

    switch (operation.operation) {
      case 'activate':
        affected = await this.repository.bulkUpdate(operation.ids, {
          status: ClearStoryStatus.active,
          updatedBy: userRef,
          updatedAt: timestamp
        });
        break;

      case 'pause':
        affected = await this.repository.bulkUpdate(operation.ids, {
          status: ClearStoryStatus.paused,
          updatedBy: userRef,
          updatedAt: timestamp
        });
        break;

      case 'archive':
        affected = await this.repository.bulkUpdate(operation.ids, {
          status: ClearStoryStatus.archived,
          updatedBy: userRef,
          updatedAt: timestamp
        });
        break;

      case 'delete':
        for (const id of operation.ids) {
          try {
            await this.repository.hardDelete(id);
            affected++;
          } catch {
            // Skip if not found
          }
        }
        break;

      case 'addTags':
        if (operation.data?.tags) {
          for (const id of operation.ids) {
            const existing = await this.repository.findById(id);
            if (existing) {
              const newTags = [...new Set([...existing.tags, ...operation.data.tags])];
              await this.repository.update(id, {
                tags: newTags,
                updatedBy: userRef,
                updatedAt: timestamp
              });
              affected++;
            }
          }
        }
        break;

      case 'removeTags':
        if (operation.data?.tags) {
          for (const id of operation.ids) {
            const existing = await this.repository.findById(id);
            if (existing) {
              const newTags = existing.tags.filter(t => !operation.data!.tags!.includes(t));
              await this.repository.update(id, {
                tags: newTags,
                updatedBy: userRef,
                updatedAt: timestamp
              });
              affected++;
            }
          }
        }
        break;
    }

    return { affected };
  }

  async bulkImport(
    customerId: CustomerId,
    stories: CreateClearStoryInput[],
    userId: UserId
  ): Promise<{
    created: number;
    failed: number;
    errors: { index: number; error: string }[];
  }> {
    const errors: { index: number; error: string }[] = [];
    let created = 0;

    for (let i = 0; i < stories.length; i++) {
      try {
        const input = { ...stories[i], customerId };
        await this.create(input, userId);
        created++;
      } catch (err) {
        errors.push({
          index: i,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    return {
      created,
      failed: errors.length,
      errors
    };
  }

  // -------------------------------------------------------------------------
  // Content Selection
  // -------------------------------------------------------------------------

  async getRecommendedForContent(
    customerId: CustomerId,
    options?: {
      topic?: string;
      category?: ClearStoryCategory;
      tone?: ContentTone;
      excludeIds?: ClearStoryId[];
      limit?: number;
    }
  ): Promise<ClearStory[]> {
    const limit = options?.limit ?? CLEAR_STORY_CONSTANTS.DEFAULT_RECOMMENDED_LIMIT;

    const searchParams: ClearStorySearchParams = {
      customerId,
      statuses: [ClearStoryStatus.active],
      minConfidence: 'medium',
      sortBy: 'confidence',
      sortOrder: 'desc',
      pagination: { page: 1, pageSize: limit * 2 } // Fetch extra to filter
    };

    if (options?.topic) {
      searchParams.topic = options.topic;
    }

    if (options?.category) {
      searchParams.categories = [options.category];
    }

    if (options?.tone) {
      searchParams.tone = options.tone;
    }

    const { data } = await this.repository.search(searchParams);

    // Filter out excluded IDs
    let results = data;
    if (options?.excludeIds && options.excludeIds.length > 0) {
      results = results.filter(s => !options.excludeIds!.includes(s.id));
    }

    // Balance by usage - prefer less used stories
    results.sort((a, b) => {
      // Primary: confidence (higher is better)
      const confidenceDiff = b.confidenceScore - a.confidenceScore;
      if (Math.abs(confidenceDiff) > 0.1) {
        return confidenceDiff;
      }

      // Secondary: usage count (lower is better for variety)
      return a.usageCount - b.usageCount;
    });

    return results.slice(0, limit);
  }

  async getRandomSelection(
    customerId: CustomerId,
    count: number,
    excludeIds?: ClearStoryId[]
  ): Promise<ClearStory[]> {
    const limit = Math.min(count, CLEAR_STORY_CONSTANTS.MAX_RANDOM_SELECTION);

    // Get all active stories
    const { data } = await this.repository.search({
      customerId,
      statuses: [ClearStoryStatus.active],
      pagination: { page: 1, pageSize: 100 }
    });

    // Filter out excluded IDs
    let candidates = data;
    if (excludeIds && excludeIds.length > 0) {
      candidates = candidates.filter(s => !excludeIds.includes(s.id));
    }

    if (candidates.length <= limit) {
      return candidates;
    }

    // Weighted random selection (higher confidence = higher probability)
    const totalWeight = candidates.reduce((sum, s) => sum + s.confidenceScore, 0);
    const selected: ClearStory[] = [];
    const usedIndices = new Set<number>();

    while (selected.length < limit && usedIndices.size < candidates.length) {
      let random = Math.random() * totalWeight;
      let index = 0;

      for (let i = 0; i < candidates.length; i++) {
        if (usedIndices.has(i)) continue;

        random -= candidates[i].confidenceScore;
        if (random <= 0) {
          index = i;
          break;
        }
        index = i;
      }

      if (!usedIndices.has(index)) {
        usedIndices.add(index);
        selected.push(candidates[index]);
      }
    }

    return selected;
  }
}
