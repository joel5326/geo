/**
 * GEO Platform - Scheduling Domain Repository
 *
 * This module provides the repository interface and in-memory implementation
 * for ScheduledTask persistence. The repository pattern abstracts data access
 * from business logic, enabling easy swapping of storage backends.
 *
 * @module scheduling/scheduling.repository
 * @version 1.0.0
 */

import {
  ScheduleId,
  CustomerId,
  ISOTimestamp,
  AuditInfo,
  PaginatedResponse,
  PaginationParams,
  ScheduleStatus,
  UserRef,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SCHEDULE_LOOKAHEAD_HOURS,
  DEFAULT_SCHEDULE_BUFFER_MINUTES,
} from '../shared/shared.types';

// =============================================================================
// Domain Types
// =============================================================================

/**
 * Types of scheduled tasks in the system.
 */
export type ScheduledTaskType =
  | 'reddit_post'
  | 'engagement_refresh'
  | 'content_publish'
  | 'analytics_sync';

/**
 * Result of a task execution attempt.
 */
export interface TaskExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Human-readable message about the execution */
  message: string;
  /** Additional data from execution */
  data?: Record<string, unknown>;
  /** Duration of execution in milliseconds */
  durationMs: number;
  /** When the task was executed */
  executedAt: ISOTimestamp;
}

/**
 * Scheduled task entity.
 * Represents a content item queued for future execution.
 */
export interface ScheduledTask {
  /** Unique schedule identifier */
  id: ScheduleId;
  /** Customer who owns this scheduled task */
  customerId: CustomerId;
  /** Type of task being scheduled */
  taskType: ScheduledTaskType;
  /** ID of the target entity (RedditPostId, ArticleId, etc.) */
  targetId: string;
  /** When the task is scheduled to execute */
  scheduledFor: ISOTimestamp;
  /** Current task status */
  status: ScheduleStatus;
  /** Task priority (higher = more urgent) */
  priority: number;
  /** Number of retry attempts made */
  retryCount: number;
  /** Maximum allowed retry attempts */
  maxRetries: number;
  /** Last error message if failed */
  lastError?: string;
  /** When task was actually executed */
  executedAt?: ISOTimestamp;
  /** When task completed successfully */
  completedAt?: ISOTimestamp;
  /** Result of the last execution */
  result?: TaskExecutionResult;
  /** Additional task metadata */
  metadata: Record<string, unknown>;
  /** Audit information */
  audit: AuditInfo;
}

/**
 * User preferences for optimal scheduling.
 */
export interface SchedulingPreferences {
  /** User's timezone (IANA format) */
  timezone: string;
  /** Preferred days of week (0=Sunday, 6=Saturday) */
  preferredDays?: number[];
  /** Preferred hours of day (0-23) */
  preferredHours?: number[];
  /** Minimum gap between tasks in minutes */
  minimumGapMinutes: number;
  /** Whether to avoid scheduling on weekends */
  avoidWeekends?: boolean;
}

/**
 * Details about a scheduling conflict.
 */
export interface ScheduleConflict {
  /** ID of the existing conflicting task */
  existingTaskId: ScheduleId;
  /** When the existing task is scheduled */
  scheduledFor: ISOTimestamp;
  /** Type of the conflicting task */
  taskType: ScheduledTaskType;
  /** Human-readable reason for the conflict */
  reason: string;
}

/**
 * Input for creating a new scheduled task.
 */
export interface CreateScheduledTaskInput {
  /** Customer ID */
  customerId: CustomerId;
  /** Type of task */
  taskType: ScheduledTaskType;
  /** Target entity ID */
  targetId: string;
  /** When to execute */
  scheduledFor: ISOTimestamp;
  /** Priority (default: 0) */
  priority?: number;
  /** Maximum retries (default: 3) */
  maxRetries?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** User who created this task */
  createdBy: UserRef;
}

/**
 * Input for updating an existing scheduled task.
 */
export interface UpdateScheduledTaskInput {
  /** New scheduled time */
  scheduledFor?: ISOTimestamp;
  /** New priority */
  priority?: number;
  /** Updated metadata */
  metadata?: Record<string, unknown>;
  /** User who updated this task */
  updatedBy: UserRef;
}

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * Repository interface for ScheduledTask persistence.
 * Defines the contract for data access operations.
 */
export interface IScheduledTaskRepository {
  /**
   * Create a new scheduled task.
   * @param task - The task to create
   * @returns Created scheduled task with generated ID
   */
  create(task: ScheduledTask): Promise<ScheduledTask>;

  /**
   * Find a scheduled task by ID.
   * @param id - Schedule ID
   * @returns The scheduled task or null if not found
   */
  findById(id: ScheduleId): Promise<ScheduledTask | null>;

  /**
   * Update a scheduled task.
   * @param id - Schedule ID
   * @param updates - Partial task updates
   * @returns Updated scheduled task
   * @throws Error if task not found
   */
  update(id: ScheduleId, updates: Partial<ScheduledTask>): Promise<ScheduledTask>;

  /**
   * Delete a scheduled task.
   * @param id - Schedule ID
   * @returns True if deleted, false if not found
   */
  delete(id: ScheduleId): Promise<boolean>;

  /**
   * Find all tasks for a customer with pagination.
   * @param customerId - Customer ID
   * @param pagination - Pagination parameters
   * @returns Paginated list of tasks
   */
  findByCustomer(
    customerId: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ScheduledTask>>;

  /**
   * Find tasks by status, optionally filtered by customer.
   * @param status - Task status to filter by
   * @param customerId - Optional customer filter
   * @returns Array of matching tasks
   */
  findByStatus(
    status: ScheduleStatus,
    customerId?: CustomerId
  ): Promise<ScheduledTask[]>;

  /**
   * Find pending tasks scheduled within the lookahead window.
   * @param lookaheadHours - Hours to look ahead (default: SCHEDULE_LOOKAHEAD_HOURS)
   * @returns Array of pending tasks within the window
   */
  findPendingTasks(lookaheadHours?: number): Promise<ScheduledTask[]>;

  /**
   * Find tasks scheduled within a time range.
   * @param startTime - Range start
   * @param endTime - Range end
   * @param customerId - Optional customer filter
   * @returns Array of tasks within the range
   */
  findByTimeRange(
    startTime: ISOTimestamp,
    endTime: ISOTimestamp,
    customerId?: CustomerId
  ): Promise<ScheduledTask[]>;

  /**
   * Get the next task ready for execution.
   * Returns the earliest pending task that is due.
   * @returns Next executable task or null
   */
  findNextExecutable(): Promise<ScheduledTask | null>;

  /**
   * Find conflicting tasks at a given time for a customer.
   * @param customerId - Customer ID
   * @param scheduledFor - Proposed time
   * @param bufferMinutes - Buffer around the time
   * @param excludeTaskId - Task ID to exclude from check
   * @returns Array of conflicting tasks
   */
  findConflicts(
    customerId: CustomerId,
    scheduledFor: ISOTimestamp,
    bufferMinutes?: number,
    excludeTaskId?: ScheduleId
  ): Promise<ScheduledTask[]>;

  /**
   * Count tasks matching criteria.
   * @param criteria - Filter criteria
   * @returns Count of matching tasks
   */
  count(criteria: {
    customerId?: CustomerId;
    status?: ScheduleStatus;
    taskType?: ScheduledTaskType;
  }): Promise<number>;
}

// =============================================================================
// In-Memory Implementation
// =============================================================================

/**
 * In-memory implementation of the ScheduledTaskRepository.
 * Suitable for development, testing, and small-scale deployments.
 */
export class InMemoryScheduledTaskRepository implements IScheduledTaskRepository {
  private tasks: Map<string, ScheduledTask> = new Map();

  /**
   * Create a new scheduled task.
   */
  async create(task: ScheduledTask): Promise<ScheduledTask> {
    const copy = this.deepCopy(task);
    this.tasks.set(task.id, copy);
    return this.deepCopy(copy);
  }

  /**
   * Find a scheduled task by ID.
   */
  async findById(id: ScheduleId): Promise<ScheduledTask | null> {
    const task = this.tasks.get(id);
    return task ? this.deepCopy(task) : null;
  }

  /**
   * Update a scheduled task.
   */
  async update(id: ScheduleId, updates: Partial<ScheduledTask>): Promise<ScheduledTask> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`Task not found: ${id}`);
    }

    const updated: ScheduledTask = {
      ...existing,
      ...updates,
      id: existing.id, // Preserve ID
      audit: {
        ...existing.audit,
        ...updates.audit,
        updatedAt: new Date().toISOString() as ISOTimestamp,
      },
    };

    this.tasks.set(id, updated);
    return this.deepCopy(updated);
  }

  /**
   * Delete a scheduled task.
   */
  async delete(id: ScheduleId): Promise<boolean> {
    return this.tasks.delete(id);
  }

  /**
   * Find all tasks for a customer with pagination.
   */
  async findByCustomer(
    customerId: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ScheduledTask>> {
    const allTasks = Array.from(this.tasks.values())
      .filter((task) => task.customerId === customerId)
      .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime());

    const page = pagination?.page ?? 1;
    const pageSize = Math.min(pagination?.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const totalItems = allTasks.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    const startIndex = (page - 1) * pageSize;
    const data = allTasks.slice(startIndex, startIndex + pageSize).map((t) => this.deepCopy(t));

    return {
      data,
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

  /**
   * Find tasks by status, optionally filtered by customer.
   */
  async findByStatus(
    status: ScheduleStatus,
    customerId?: CustomerId
  ): Promise<ScheduledTask[]> {
    return Array.from(this.tasks.values())
      .filter((task) => {
        const statusMatch = task.status === status;
        const customerMatch = customerId ? task.customerId === customerId : true;
        return statusMatch && customerMatch;
      })
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
      .map((t) => this.deepCopy(t));
  }

  /**
   * Find pending tasks scheduled within the lookahead window.
   */
  async findPendingTasks(lookaheadHours?: number): Promise<ScheduledTask[]> {
    const now = new Date();
    const hours = lookaheadHours ?? SCHEDULE_LOOKAHEAD_HOURS;
    const endTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return Array.from(this.tasks.values())
      .filter((task) => {
        const scheduledTime = new Date(task.scheduledFor);
        return (
          task.status === ScheduleStatus.pending &&
          scheduledTime >= now &&
          scheduledTime <= endTime
        );
      })
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
      .map((t) => this.deepCopy(t));
  }

  /**
   * Find tasks scheduled within a time range.
   */
  async findByTimeRange(
    startTime: ISOTimestamp,
    endTime: ISOTimestamp,
    customerId?: CustomerId
  ): Promise<ScheduledTask[]> {
    const start = new Date(startTime);
    const end = new Date(endTime);

    return Array.from(this.tasks.values())
      .filter((task) => {
        const scheduledTime = new Date(task.scheduledFor);
        const timeMatch = scheduledTime >= start && scheduledTime <= end;
        const customerMatch = customerId ? task.customerId === customerId : true;
        return timeMatch && customerMatch;
      })
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
      .map((t) => this.deepCopy(t));
  }

  /**
   * Get the next task ready for execution.
   */
  async findNextExecutable(): Promise<ScheduledTask | null> {
    const now = new Date();

    const pendingTasks = Array.from(this.tasks.values())
      .filter((task) => {
        const scheduledTime = new Date(task.scheduledFor);
        return task.status === ScheduleStatus.pending && scheduledTime <= now;
      })
      .sort((a, b) => {
        // Sort by priority (descending) then by scheduled time (ascending)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
      });

    return pendingTasks.length > 0 ? this.deepCopy(pendingTasks[0]) : null;
  }

  /**
   * Find conflicting tasks at a given time for a customer.
   */
  async findConflicts(
    customerId: CustomerId,
    scheduledFor: ISOTimestamp,
    bufferMinutes?: number,
    excludeTaskId?: ScheduleId
  ): Promise<ScheduledTask[]> {
    const buffer = bufferMinutes ?? DEFAULT_SCHEDULE_BUFFER_MINUTES;
    const targetTime = new Date(scheduledFor);
    const bufferMs = buffer * 60 * 1000;

    const windowStart = new Date(targetTime.getTime() - bufferMs);
    const windowEnd = new Date(targetTime.getTime() + bufferMs);

    return Array.from(this.tasks.values())
      .filter((task) => {
        if (task.customerId !== customerId) return false;
        if (excludeTaskId && task.id === excludeTaskId) return false;
        if (
          task.status === ScheduleStatus.cancelled ||
          task.status === ScheduleStatus.completed ||
          task.status === ScheduleStatus.failed
        ) {
          return false;
        }

        const taskTime = new Date(task.scheduledFor);
        return taskTime >= windowStart && taskTime <= windowEnd;
      })
      .map((t) => this.deepCopy(t));
  }

  /**
   * Count tasks matching criteria.
   */
  async count(criteria: {
    customerId?: CustomerId;
    status?: ScheduleStatus;
    taskType?: ScheduledTaskType;
  }): Promise<number> {
    return Array.from(this.tasks.values()).filter((task) => {
      if (criteria.customerId && task.customerId !== criteria.customerId) return false;
      if (criteria.status && task.status !== criteria.status) return false;
      if (criteria.taskType && task.taskType !== criteria.taskType) return false;
      return true;
    }).length;
  }

  /**
   * Clear all tasks (for testing purposes).
   */
  async clear(): Promise<void> {
    this.tasks.clear();
  }

  /**
   * Get all tasks (for debugging purposes).
   */
  async getAll(): Promise<ScheduledTask[]> {
    return Array.from(this.tasks.values()).map((t) => this.deepCopy(t));
  }

  /**
   * Deep copy a task to prevent external mutations.
   */
  private deepCopy(task: ScheduledTask): ScheduledTask {
    return JSON.parse(JSON.stringify(task));
  }
}
