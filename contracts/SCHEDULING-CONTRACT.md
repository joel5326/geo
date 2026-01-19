# SCHEDULING Domain Contract

> **Version**: 1.0.0
> **Domain**: Scheduling
> **Owner**: Scheduling Agent
> **Last Updated**: 2026-01-18

This contract defines the complete interface for the Scheduling domain in the LEO Automation Platform. The Scheduling domain is responsible for managing scheduled tasks for post distribution, queue management, task execution, timing optimization, and the complete task lifecycle. All implementations must adhere to these types and interfaces.

---

## Table of Contents

1. [Imports from Shared Primitives](#imports-from-shared-primitives)
2. [Cross-Domain References](#cross-domain-references)
3. [Domain-Specific Types](#domain-specific-types)
4. [Service Interface](#service-interface)
5. [Repository Interface](#repository-interface)
6. [API Routes](#api-routes)
7. [Validation Schemas](#validation-schemas)
8. [Error Codes](#error-codes)
9. [Integration Points](#integration-points)

---

## Imports from Shared Primitives

```typescript
import {
  // Identity Types
  ScheduleId,
  RedditPostId,
  ArticleId,
  CustomerId,
  UserId,

  // Enums
  ScheduleStatus,
  Platform,

  // Cross-Domain References
  RedditPostRef,
  ArticleRef,
  CustomerRef,
  UserRef,

  // API Patterns
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  AuditInfo,

  // Timestamp Types
  ISOTimestamp,
  UnixTimestamp
} from './shared.types';

// Constants
export const SCHEDULE_LOOKAHEAD_HOURS = 168;  // 1 week scheduling window
export const DEFAULT_SCHEDULE_BUFFER_MINUTES = 15;  // Buffer between scheduled posts
export const SCHEDULE_EXECUTION_WINDOW_MINUTES = 5;  // Time window for task execution
export const MAX_RETRY_ATTEMPTS = 3;  // Maximum retry attempts for failed tasks
export const RETRY_DELAY_MINUTES = 15;  // Delay between retry attempts
```

---

## Cross-Domain References

### RedditPostRef

Reference to Reddit posts from the Reddit Distribution domain. The Scheduling domain reads this but does not own it.

```typescript
/**
 * Minimal Reddit post reference used by Scheduling domain.
 * The Reddit Distribution domain owns the full RedditPost entity.
 */
export interface RedditPostRef {
  /** Internal Reddit post ID */
  id: RedditPostId;

  /** Reddit's native post ID (t3_xxxxx format) */
  redditExternalId?: string;

  /** Target subreddit */
  subreddit: string;

  /** Current post status */
  status: RedditPostStatus;

  /** Reddit permalink (if posted) */
  permalink?: string;
}
```

### ArticleRef

Reference to articles from the Article domain. The Scheduling domain reads this but does not own it.

```typescript
/**
 * Minimal article reference used by Scheduling domain.
 * The Article domain owns the full Article entity.
 */
export interface ArticleRef {
  /** Article ID */
  id: ArticleId;

  /** Article title */
  title: string;

  /** Current article status */
  status: ArticleStatus;

  /** Published URL (if published) */
  publishedUrl?: string;
}
```

---

## Domain-Specific Types

### EntityType Enum

```typescript
/**
 * Types of entities that can be scheduled.
 * Determines which domain handles the actual execution.
 */
export enum ScheduledEntityType {
  /** Reddit post to be published */
  reddit_post = 'reddit_post',

  /** Article to be published */
  article = 'article',

  /** Generic task (future extensibility) */
  generic_task = 'generic_task'
}
```

### TaskPriority Enum

```typescript
/**
 * Priority levels for scheduled tasks.
 * Higher priority tasks are executed first when multiple tasks
 * are ready at the same time.
 */
export enum TaskPriority {
  /** Background tasks, executed when system is idle */
  low = 'low',

  /** Standard priority for most scheduled content */
  normal = 'normal',

  /** Time-sensitive content, prioritized execution */
  high = 'high',

  /** Critical tasks that bypass normal queuing */
  urgent = 'urgent'
}
```

### RecurrencePattern

```typescript
/**
 * Recurrence configuration for repeating schedules.
 * Used for automated recurring content distribution.
 */
export interface RecurrencePattern {
  /** Type of recurrence */
  type: 'once' | 'daily' | 'weekly' | 'monthly';

  /** For weekly: days of week (0=Sunday, 6=Saturday) */
  daysOfWeek?: number[];

  /** For monthly: day of month (1-31) */
  dayOfMonth?: number;

  /** Time of day in HH:MM format (24-hour) */
  timeOfDay: string;

  /** Timezone for scheduling (IANA format, e.g., "America/New_York") */
  timezone: string;

  /** End date for recurring schedule (optional) */
  endsAt?: ISOTimestamp;

  /** Maximum number of occurrences (optional) */
  maxOccurrences?: number;
}
```

### ExecutionResult

```typescript
/**
 * Result of a task execution attempt.
 * Stored for audit trail and retry logic.
 */
export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Timestamp of execution attempt */
  executedAt: ISOTimestamp;

  /** Duration of execution in milliseconds */
  durationMs: number;

  /** External ID returned (e.g., Reddit post ID) */
  externalId?: string;

  /** External URL returned (e.g., permalink) */
  externalUrl?: string;

  /** Error details if failed */
  error?: {
    /** Error code from the executing domain */
    code: string;

    /** Human-readable error message */
    message: string;

    /** Whether this error is retryable */
    retryable: boolean;

    /** Additional error context */
    details?: Record<string, unknown>;
  };
}
```

### ScheduledTask

```typescript
/**
 * Scheduled task entity.
 * Represents a content item queued for future execution.
 */
export interface ScheduledTask {
  /** Unique schedule identifier */
  id: ScheduleId;

  /** Customer who owns this scheduled task */
  customerId: CustomerId;

  /** Target platform for distribution */
  platform: Platform;

  /** Type of entity being scheduled */
  entityType: ScheduledEntityType;

  /** ID of the entity to be executed (RedditPostId, ArticleId, etc.) */
  entityId: string;

  /** Reference to the entity for display purposes */
  entityRef: RedditPostRef | ArticleRef;

  /** When the task is scheduled to execute */
  scheduledFor: ISOTimestamp;

  /** Current task status */
  status: ScheduleStatus;

  /** Task priority level */
  priority: TaskPriority;

  /** When task was actually executed (if executed) */
  executedAt?: ISOTimestamp;

  /** Result of the execution (if attempted) */
  result?: ExecutionResult;

  /** Number of retry attempts made */
  retryCount: number;

  /** Next retry scheduled for (if applicable) */
  nextRetryAt?: ISOTimestamp;

  /** Recurrence pattern for repeating schedules */
  recurrence?: RecurrencePattern;

  /** Parent schedule ID (for recurring task instances) */
  parentScheduleId?: ScheduleId;

  /** User-provided notes or context */
  notes?: string;

  /** Tags for categorization and filtering */
  tags?: string[];

  /** Audit information */
  audit: AuditInfo;
}
```

### ScheduleSlot

```typescript
/**
 * Represents a time slot for scheduling.
 * Used for availability checking and conflict detection.
 */
export interface ScheduleSlot {
  /** Start time of the slot */
  startTime: ISOTimestamp;

  /** End time of the slot (startTime + buffer) */
  endTime: ISOTimestamp;

  /** Whether this slot is available for scheduling */
  isAvailable: boolean;

  /** Tasks that conflict with this slot */
  conflictingTasks: Array<{
    scheduleId: ScheduleId;
    entityType: ScheduledEntityType;
    platform: Platform;
  }>;

  /** Reason slot is unavailable (if not available) */
  unavailableReason?: 'conflict' | 'rate_limit' | 'blackout_period' | 'outside_window';
}
```

### OptimalTimeRecommendation

```typescript
/**
 * AI-generated recommendation for optimal posting time.
 * Based on historical engagement data and platform-specific patterns.
 */
export interface OptimalTimeRecommendation {
  /** Recommended posting time */
  suggestedTime: ISOTimestamp;

  /** Expected engagement score (0-100) */
  expectedEngagement: number;

  /** Confidence level in the recommendation (0-1) */
  confidence: number;

  /** Reasoning behind the recommendation */
  reasoning: string;

  /** Factors that influenced the recommendation */
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
  }>;

  /** Alternative times ranked by expected engagement */
  alternatives: Array<{
    time: ISOTimestamp;
    expectedEngagement: number;
    confidence: number;
  }>;

  /** Platform-specific insights */
  platformInsights?: {
    /** Best days of week for this platform/subreddit */
    bestDays: number[];

    /** Best hours of day (0-23) */
    bestHours: number[];

    /** Audience timezone distribution */
    audienceTimezones: Record<string, number>;
  };
}
```

### ScheduleConflict

```typescript
/**
 * Details about a scheduling conflict.
 */
export interface ScheduleConflict {
  /** The conflicting schedule ID */
  conflictingScheduleId: ScheduleId;

  /** Type of conflict */
  conflictType: 'same_time' | 'buffer_violation' | 'rate_limit' | 'platform_limit';

  /** Severity of the conflict */
  severity: 'warning' | 'blocking';

  /** Human-readable description */
  description: string;

  /** Suggested resolution */
  suggestedResolution: {
    action: 'reschedule' | 'cancel' | 'merge' | 'force';
    suggestedTime?: ISOTimestamp;
    reason: string;
  };
}
```

### CreateScheduleInput

```typescript
/**
 * Input for creating a new scheduled task.
 */
export interface CreateScheduleInput {
  /** Customer ID (derived from auth context if not provided) */
  customerId?: CustomerId;

  /** Target platform */
  platform: Platform;

  /** Type of entity being scheduled */
  entityType: ScheduledEntityType;

  /** ID of the entity to schedule */
  entityId: string;

  /** When to execute the task */
  scheduledFor: ISOTimestamp;

  /** Task priority (default: normal) */
  priority?: TaskPriority;

  /** Recurrence pattern for repeating schedules */
  recurrence?: RecurrencePattern;

  /** User notes */
  notes?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Force scheduling even with conflicts (requires elevated permissions) */
  forceSchedule?: boolean;
}
```

### UpdateScheduleInput

```typescript
/**
 * Input for updating an existing scheduled task.
 */
export interface UpdateScheduleInput {
  /** New scheduled time */
  scheduledFor?: ISOTimestamp;

  /** New priority */
  priority?: TaskPriority;

  /** Updated recurrence pattern */
  recurrence?: RecurrencePattern;

  /** Updated notes */
  notes?: string;

  /** Updated tags */
  tags?: string[];
}
```

### ScheduleSearchParams

```typescript
/**
 * Parameters for searching/filtering scheduled tasks.
 */
export interface ScheduleSearchParams {
  /** Filter by customer */
  customerId?: CustomerId;

  /** Filter by platform */
  platform?: Platform;

  /** Filter by entity type */
  entityType?: ScheduledEntityType;

  /** Filter by status(es) */
  status?: ScheduleStatus | ScheduleStatus[];

  /** Filter by priority */
  priority?: TaskPriority | TaskPriority[];

  /** Filter by scheduled time range start */
  scheduledFrom?: ISOTimestamp;

  /** Filter by scheduled time range end */
  scheduledTo?: ISOTimestamp;

  /** Filter by tags (any match) */
  tags?: string[];

  /** Include recurring schedule templates */
  includeRecurring?: boolean;

  /** Sort field */
  sortBy?: 'scheduledFor' | 'createdAt' | 'priority' | 'status';

  /** Sort order */
  sortOrder?: 'asc' | 'desc';

  /** Pagination */
  pagination?: PaginationParams;
}
```

### BulkScheduleInput

```typescript
/**
 * Input for bulk scheduling multiple tasks.
 */
export interface BulkScheduleInput {
  /** Array of tasks to schedule */
  tasks: CreateScheduleInput[];

  /** Distribution strategy for timing */
  distribution?: {
    /** How to distribute tasks over time */
    strategy: 'sequential' | 'spread' | 'optimal';

    /** Start time for distribution window */
    windowStart: ISOTimestamp;

    /** End time for distribution window */
    windowEnd: ISOTimestamp;

    /** Minimum buffer between tasks (minutes) */
    minBuffer?: number;
  };

  /** Skip conflicts and schedule valid tasks only */
  skipConflicts?: boolean;
}
```

### BulkScheduleResult

```typescript
/**
 * Result of a bulk schedule operation.
 */
export interface BulkScheduleResult {
  /** Successfully scheduled tasks */
  scheduled: ScheduledTask[];

  /** Tasks that failed to schedule */
  failed: Array<{
    input: CreateScheduleInput;
    error: string;
    conflicts?: ScheduleConflict[];
  }>;

  /** Summary statistics */
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}
```

### ScheduleStatistics

```typescript
/**
 * Statistics and metrics for scheduled tasks.
 */
export interface ScheduleStatistics {
  /** Total tasks by status */
  byStatus: Record<ScheduleStatus, number>;

  /** Total tasks by platform */
  byPlatform: Record<Platform, number>;

  /** Upcoming tasks in next 24 hours */
  upcomingNext24Hours: number;

  /** Upcoming tasks in next 7 days */
  upcomingNext7Days: number;

  /** Success rate (completed / (completed + failed)) */
  successRate: number;

  /** Average execution time in ms */
  avgExecutionTimeMs: number;

  /** Tasks awaiting retry */
  pendingRetries: number;

  /** Paused tasks */
  pausedTasks: number;
}
```

---

## Service Interface

```typescript
/**
 * Scheduling domain service interface.
 * All methods are async and return Promises.
 */
export interface ISchedulingService {
  // ─────────────────────────────────────────────────────────────
  // Schedule Creation & Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Schedule a new task for execution.
   * Validates conflicts and returns the created schedule.
   *
   * @param input - Schedule creation parameters
   * @returns The created scheduled task
   * @throws SCHEDULE_CONFLICT if time conflicts exist and forceSchedule is false
   * @throws ENTITY_NOT_FOUND if the referenced entity doesn't exist
   * @throws ENTITY_NOT_READY if the entity is not in an approved/ready state
   */
  schedule(input: CreateScheduleInput): Promise<ScheduledTask>;

  /**
   * Reschedule an existing task to a new time.
   * Validates the new time for conflicts.
   *
   * @param scheduleId - The schedule to reschedule
   * @param newTime - New scheduled execution time
   * @param force - Force reschedule even with conflicts
   * @returns The updated scheduled task
   * @throws TASK_NOT_FOUND if schedule doesn't exist
   * @throws ALREADY_EXECUTED if task has already been executed
   * @throws SCHEDULE_CONFLICT if new time conflicts and force is false
   */
  reschedule(
    scheduleId: ScheduleId,
    newTime: ISOTimestamp,
    force?: boolean
  ): Promise<ScheduledTask>;

  /**
   * Cancel a scheduled task.
   * Cannot cancel tasks that are currently running.
   *
   * @param scheduleId - The schedule to cancel
   * @param reason - Optional cancellation reason
   * @returns The cancelled scheduled task
   * @throws TASK_NOT_FOUND if schedule doesn't exist
   * @throws ALREADY_EXECUTED if task has already been executed
   * @throws TASK_RUNNING if task is currently executing
   */
  cancel(scheduleId: ScheduleId, reason?: string): Promise<ScheduledTask>;

  /**
   * Pause a scheduled task.
   * Prevents execution until resumed.
   *
   * @param scheduleId - The schedule to pause
   * @returns The paused scheduled task
   * @throws TASK_NOT_FOUND if schedule doesn't exist
   * @throws INVALID_STATE if task is not in pending status
   */
  pause(scheduleId: ScheduleId): Promise<ScheduledTask>;

  /**
   * Resume a paused scheduled task.
   * May require rescheduling if original time has passed.
   *
   * @param scheduleId - The schedule to resume
   * @param newTime - New execution time (required if original time passed)
   * @returns The resumed scheduled task
   * @throws TASK_NOT_FOUND if schedule doesn't exist
   * @throws INVALID_STATE if task is not paused
   * @throws TIME_PASSED if original time passed and newTime not provided
   */
  resume(scheduleId: ScheduleId, newTime?: ISOTimestamp): Promise<ScheduledTask>;

  /**
   * Schedule multiple tasks in bulk.
   * Supports different distribution strategies.
   *
   * @param input - Bulk schedule parameters
   * @returns Results for each task
   */
  bulkSchedule(input: BulkScheduleInput): Promise<BulkScheduleResult>;

  // ─────────────────────────────────────────────────────────────
  // Schedule Retrieval
  // ─────────────────────────────────────────────────────────────

  /**
   * Get a schedule by its ID.
   *
   * @param scheduleId - The schedule ID
   * @returns The scheduled task or null
   */
  getScheduleById(scheduleId: ScheduleId): Promise<ScheduledTask | null>;

  /**
   * Get all schedules for a customer.
   *
   * @param customerId - The customer ID
   * @param params - Optional search/filter parameters
   * @returns Paginated list of scheduled tasks
   */
  getSchedulesByCustomer(
    customerId: CustomerId,
    params?: Omit<ScheduleSearchParams, 'customerId'>
  ): Promise<PaginatedResponse<ScheduledTask>>;

  /**
   * Get schedules by status.
   *
   * @param status - Status or array of statuses
   * @param params - Optional search/filter parameters
   * @returns Paginated list of scheduled tasks
   */
  getSchedulesByStatus(
    status: ScheduleStatus | ScheduleStatus[],
    params?: ScheduleSearchParams
  ): Promise<PaginatedResponse<ScheduledTask>>;

  /**
   * Get upcoming schedules within the lookahead window.
   * Returns tasks scheduled within SCHEDULE_LOOKAHEAD_HOURS.
   *
   * @param customerId - Optional customer filter
   * @param limit - Maximum number of results (default: 50)
   * @returns Array of upcoming scheduled tasks
   */
  getUpcoming(customerId?: CustomerId, limit?: number): Promise<ScheduledTask[]>;

  /**
   * Get tasks that are pending execution (ready to run).
   * Returns tasks with scheduledFor <= now and status = pending.
   *
   * @param limit - Maximum number of results (default: 100)
   * @returns Array of tasks ready for execution
   */
  getPendingExecution(limit?: number): Promise<ScheduledTask[]>;

  /**
   * Search schedules with advanced filters.
   *
   * @param params - Search parameters
   * @returns Paginated list of matching schedules
   */
  searchSchedules(params: ScheduleSearchParams): Promise<PaginatedResponse<ScheduledTask>>;

  // ─────────────────────────────────────────────────────────────
  // Task Execution
  // ─────────────────────────────────────────────────────────────

  /**
   * Execute a scheduled task.
   * Triggers the appropriate domain handler based on entityType.
   * This method is typically called by the scheduler worker.
   *
   * @param scheduleId - The schedule to execute
   * @returns The updated schedule with execution result
   * @throws TASK_NOT_FOUND if schedule doesn't exist
   * @throws INVALID_STATE if task is not in pending/paused status
   * @throws EXECUTION_FAILED if execution fails (will set up retry if applicable)
   */
  executeTask(scheduleId: ScheduleId): Promise<ScheduledTask>;

  /**
   * Mark a task as successfully completed.
   * Called by domain handlers after successful execution.
   *
   * @param scheduleId - The schedule to mark complete
   * @param result - Execution result details
   * @returns The completed scheduled task
   */
  markCompleted(scheduleId: ScheduleId, result: ExecutionResult): Promise<ScheduledTask>;

  /**
   * Mark a task as failed.
   * Sets up retry if applicable based on retry policy.
   *
   * @param scheduleId - The schedule to mark failed
   * @param result - Execution result with error details
   * @returns The updated scheduled task (may be queued for retry)
   */
  markFailed(scheduleId: ScheduleId, result: ExecutionResult): Promise<ScheduledTask>;

  /**
   * Retry a failed task immediately.
   * Bypasses normal retry delay.
   *
   * @param scheduleId - The schedule to retry
   * @returns The task queued for immediate retry
   * @throws TASK_NOT_FOUND if schedule doesn't exist
   * @throws INVALID_STATE if task is not in failed status
   * @throws MAX_RETRIES_EXCEEDED if retry limit reached
   */
  retryTask(scheduleId: ScheduleId): Promise<ScheduledTask>;

  // ─────────────────────────────────────────────────────────────
  // Slot Management & Optimization
  // ─────────────────────────────────────────────────────────────

  /**
   * Get available time slots for scheduling.
   *
   * @param customerId - Customer ID for slot lookup
   * @param platform - Target platform
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @param slotDurationMinutes - Duration of each slot (default: 15)
   * @returns Array of time slots with availability info
   */
  getAvailableSlots(
    customerId: CustomerId,
    platform: Platform,
    startTime: ISOTimestamp,
    endTime: ISOTimestamp,
    slotDurationMinutes?: number
  ): Promise<ScheduleSlot[]>;

  /**
   * Get optimal posting times based on engagement data.
   * Uses historical data and AI to recommend best times.
   *
   * @param customerId - Customer ID for recommendations
   * @param platform - Target platform
   * @param entityType - Type of content being scheduled
   * @param options - Optional recommendation parameters
   * @returns Array of optimal time recommendations
   */
  getOptimalTimes(
    customerId: CustomerId,
    platform: Platform,
    entityType: ScheduledEntityType,
    options?: {
      /** Subreddit for Reddit-specific optimization */
      subreddit?: string;

      /** Number of recommendations to return (default: 5) */
      count?: number;

      /** Time range to consider */
      startTime?: ISOTimestamp;
      endTime?: ISOTimestamp;

      /** Exclude times with conflicts */
      excludeConflicts?: boolean;
    }
  ): Promise<OptimalTimeRecommendation[]>;

  // ─────────────────────────────────────────────────────────────
  // Conflict Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Check for conflicts at a proposed time.
   *
   * @param customerId - Customer ID
   * @param platform - Target platform
   * @param proposedTime - Time to check
   * @param excludeScheduleId - Schedule ID to exclude (for reschedule checks)
   * @returns Array of conflicts (empty if no conflicts)
   */
  checkConflicts(
    customerId: CustomerId,
    platform: Platform,
    proposedTime: ISOTimestamp,
    excludeScheduleId?: ScheduleId
  ): Promise<ScheduleConflict[]>;

  /**
   * Resolve a scheduling conflict.
   *
   * @param scheduleId - The schedule with conflict
   * @param resolution - How to resolve the conflict
   * @returns The resolved scheduled task
   */
  resolveConflict(
    scheduleId: ScheduleId,
    resolution: {
      action: 'reschedule' | 'cancel' | 'force';
      newTime?: ISOTimestamp;
    }
  ): Promise<ScheduledTask>;

  // ─────────────────────────────────────────────────────────────
  // Statistics & Analytics
  // ─────────────────────────────────────────────────────────────

  /**
   * Get scheduling statistics for a customer.
   *
   * @param customerId - Customer ID
   * @param timeRange - Optional time range filter
   * @returns Schedule statistics
   */
  getStatistics(
    customerId: CustomerId,
    timeRange?: { from: ISOTimestamp; to: ISOTimestamp }
  ): Promise<ScheduleStatistics>;
}
```

---

## Repository Interface

```typescript
/**
 * Repository interface for ScheduledTask persistence.
 * Extends base repository pattern with scheduling-specific queries.
 */
export interface IScheduledTaskRepository {
  // ─────────────────────────────────────────────────────────────
  // Basic CRUD
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new scheduled task.
   *
   * @param input - Task creation input
   * @returns Created scheduled task
   */
  create(input: CreateScheduleInput & { audit: AuditInfo }): Promise<ScheduledTask>;

  /**
   * Find a scheduled task by ID.
   *
   * @param id - Schedule ID
   * @returns The scheduled task or null
   */
  findById(id: ScheduleId): Promise<ScheduledTask | null>;

  /**
   * Update a scheduled task.
   *
   * @param id - Schedule ID
   * @param input - Update input
   * @returns Updated scheduled task
   */
  update(id: ScheduleId, input: Partial<ScheduledTask>): Promise<ScheduledTask>;

  /**
   * Delete a scheduled task.
   * Typically used for cleanup of old completed/cancelled tasks.
   *
   * @param id - Schedule ID
   * @returns Whether deletion was successful
   */
  delete(id: ScheduleId): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────
  // Query Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Find schedules by customer ID.
   *
   * @param customerId - Customer ID
   * @param options - Query options
   * @returns Array of scheduled tasks
   */
  findByCustomer(
    customerId: CustomerId,
    options?: {
      status?: ScheduleStatus | ScheduleStatus[];
      platform?: Platform;
      entityType?: ScheduledEntityType;
      limit?: number;
      offset?: number;
    }
  ): Promise<ScheduledTask[]>;

  /**
   * Find schedules by status.
   *
   * @param status - Status or array of statuses
   * @param options - Query options
   * @returns Array of scheduled tasks
   */
  findByStatus(
    status: ScheduleStatus | ScheduleStatus[],
    options?: {
      customerId?: CustomerId;
      limit?: number;
      offset?: number;
    }
  ): Promise<ScheduledTask[]>;

  /**
   * Find schedules within a time range.
   *
   * @param startTime - Range start
   * @param endTime - Range end
   * @param options - Query options
   * @returns Array of scheduled tasks
   */
  findByTimeRange(
    startTime: ISOTimestamp,
    endTime: ISOTimestamp,
    options?: {
      customerId?: CustomerId;
      platform?: Platform;
      status?: ScheduleStatus | ScheduleStatus[];
    }
  ): Promise<ScheduledTask[]>;

  /**
   * Find tasks ready for execution.
   * Returns pending tasks where scheduledFor <= now.
   *
   * @param limit - Maximum number to return
   * @returns Array of executable tasks
   */
  findPendingExecution(limit?: number): Promise<ScheduledTask[]>;

  /**
   * Find tasks pending retry.
   * Returns failed tasks with nextRetryAt <= now.
   *
   * @param limit - Maximum number to return
   * @returns Array of tasks ready for retry
   */
  findPendingRetry(limit?: number): Promise<ScheduledTask[]>;

  /**
   * Find schedules by entity reference.
   *
   * @param entityType - Type of entity
   * @param entityId - Entity ID
   * @returns Array of schedules for this entity
   */
  findByEntity(
    entityType: ScheduledEntityType,
    entityId: string
  ): Promise<ScheduledTask[]>;

  /**
   * Count schedules matching criteria.
   *
   * @param criteria - Filter criteria
   * @returns Count of matching schedules
   */
  count(criteria: {
    customerId?: CustomerId;
    status?: ScheduleStatus | ScheduleStatus[];
    platform?: Platform;
    scheduledFrom?: ISOTimestamp;
    scheduledTo?: ISOTimestamp;
  }): Promise<number>;

  // ─────────────────────────────────────────────────────────────
  // Specialized Queries
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if a time slot has conflicts.
   *
   * @param customerId - Customer ID
   * @param platform - Target platform
   * @param scheduledFor - Time to check
   * @param bufferMinutes - Buffer around the time
   * @param excludeId - Schedule ID to exclude
   * @returns Conflicting schedules
   */
  findConflicts(
    customerId: CustomerId,
    platform: Platform,
    scheduledFor: ISOTimestamp,
    bufferMinutes: number,
    excludeId?: ScheduleId
  ): Promise<ScheduledTask[]>;

  /**
   * Get aggregated statistics for a customer.
   *
   * @param customerId - Customer ID
   * @param timeRange - Optional time range
   * @returns Aggregated statistics
   */
  getStatistics(
    customerId: CustomerId,
    timeRange?: { from: ISOTimestamp; to: ISOTimestamp }
  ): Promise<ScheduleStatistics>;

  /**
   * Bulk update status for multiple schedules.
   *
   * @param ids - Array of schedule IDs
   * @param status - New status
   * @returns Number of updated records
   */
  bulkUpdateStatus(ids: ScheduleId[], status: ScheduleStatus): Promise<number>;

  /**
   * Archive old completed/cancelled schedules.
   *
   * @param olderThan - Archive schedules older than this date
   * @returns Number of archived records
   */
  archiveOld(olderThan: ISOTimestamp): Promise<number>;
}
```

---

## API Routes

### Route Definitions

```yaml
# POST /schedules
# Create a new scheduled task
POST /schedules:
  auth: required
  body: CreateScheduleInput
  response:
    201:
      schedule: ScheduledTask
      conflicts: ScheduleConflict[] (empty if no warnings)
    400: Validation error
    409: Schedule conflict (when forceSchedule is false)

# POST /schedules/bulk
# Create multiple scheduled tasks
POST /schedules/bulk:
  auth: required
  body: BulkScheduleInput
  response:
    200: BulkScheduleResult
    400: Validation error

# GET /schedules/:id
# Get schedule by ID
GET /schedules/:id:
  auth: required
  params:
    id: ScheduleId
  response:
    200: ScheduledTask
    404: Schedule not found

# PATCH /schedules/:id
# Update a scheduled task
PATCH /schedules/:id:
  auth: required
  params:
    id: ScheduleId
  body: UpdateScheduleInput
  response:
    200: ScheduledTask
    400: Validation error
    404: Schedule not found
    409: Schedule conflict

# DELETE /schedules/:id
# Cancel a scheduled task
DELETE /schedules/:id:
  auth: required
  params:
    id: ScheduleId
  query:
    reason: string (optional)
  response:
    200: ScheduledTask (with status: cancelled)
    404: Schedule not found
    409: Task already executed or running

# POST /schedules/:id/reschedule
# Reschedule a task to a new time
POST /schedules/:id/reschedule:
  auth: required
  params:
    id: ScheduleId
  body:
    scheduledFor: ISOTimestamp
    force: boolean (optional, default: false)
  response:
    200: ScheduledTask
    400: Validation error
    404: Schedule not found
    409: Schedule conflict (when force is false)

# POST /schedules/:id/pause
# Pause a scheduled task
POST /schedules/:id/pause:
  auth: required
  params:
    id: ScheduleId
  response:
    200: ScheduledTask (with status: paused)
    404: Schedule not found
    409: Invalid state (not pending)

# POST /schedules/:id/resume
# Resume a paused task
POST /schedules/:id/resume:
  auth: required
  params:
    id: ScheduleId
  body:
    scheduledFor: ISOTimestamp (optional, required if original time passed)
  response:
    200: ScheduledTask (with status: pending)
    400: Time passed and no new time provided
    404: Schedule not found
    409: Invalid state (not paused)

# POST /schedules/:id/retry
# Retry a failed task
POST /schedules/:id/retry:
  auth: required
  params:
    id: ScheduleId
  response:
    200: ScheduledTask
    404: Schedule not found
    409: Invalid state (not failed) or max retries exceeded

# GET /schedules
# Search and list schedules
GET /schedules:
  auth: required
  query:
    customerId: CustomerId (optional, admin only)
    platform: Platform (optional)
    entityType: ScheduledEntityType (optional)
    status: ScheduleStatus | ScheduleStatus[] (optional)
    priority: TaskPriority | TaskPriority[] (optional)
    scheduledFrom: ISOTimestamp (optional)
    scheduledTo: ISOTimestamp (optional)
    tags: string[] (optional)
    sortBy: string (optional, default: "scheduledFor")
    sortOrder: "asc" | "desc" (optional, default: "asc")
    page: number (optional, default: 1)
    pageSize: number (optional, default: 20, max: 100)
  response:
    200: PaginatedResponse<ScheduledTask>

# GET /schedules/upcoming
# Get upcoming scheduled tasks
GET /schedules/upcoming:
  auth: required
  query:
    customerId: CustomerId (optional, admin only)
    limit: number (optional, default: 50)
  response:
    200:
      schedules: ScheduledTask[]

# GET /schedules/slots
# Get available time slots
GET /schedules/slots:
  auth: required
  query:
    customerId: CustomerId (optional, admin only)
    platform: Platform (required)
    startTime: ISOTimestamp (required)
    endTime: ISOTimestamp (required)
    slotDurationMinutes: number (optional, default: 15)
  response:
    200:
      slots: ScheduleSlot[]

# GET /schedules/optimal-times
# Get optimal posting time recommendations
GET /schedules/optimal-times:
  auth: required
  query:
    customerId: CustomerId (optional, admin only)
    platform: Platform (required)
    entityType: ScheduledEntityType (required)
    subreddit: string (optional, for Reddit)
    count: number (optional, default: 5)
    startTime: ISOTimestamp (optional)
    endTime: ISOTimestamp (optional)
    excludeConflicts: boolean (optional, default: true)
  response:
    200:
      recommendations: OptimalTimeRecommendation[]

# POST /schedules/check-conflicts
# Check for conflicts at a proposed time
POST /schedules/check-conflicts:
  auth: required
  body:
    platform: Platform
    scheduledFor: ISOTimestamp
    excludeScheduleId: ScheduleId (optional)
  response:
    200:
      hasConflicts: boolean
      conflicts: ScheduleConflict[]

# GET /schedules/statistics
# Get scheduling statistics
GET /schedules/statistics:
  auth: required
  query:
    customerId: CustomerId (optional, admin only)
    from: ISOTimestamp (optional)
    to: ISOTimestamp (optional)
  response:
    200: ScheduleStatistics

# ─────────────────────────────────────────────────────────────
# Internal/Worker Endpoints (not exposed to public API)
# ─────────────────────────────────────────────────────────────

# POST /internal/schedules/:id/execute
# Execute a scheduled task (called by worker)
POST /internal/schedules/:id/execute:
  auth: internal service auth
  params:
    id: ScheduleId
  response:
    200: ScheduledTask
    404: Schedule not found
    409: Invalid state

# POST /internal/schedules/:id/complete
# Mark task as completed (called by domain handlers)
POST /internal/schedules/:id/complete:
  auth: internal service auth
  params:
    id: ScheduleId
  body: ExecutionResult
  response:
    200: ScheduledTask

# POST /internal/schedules/:id/fail
# Mark task as failed (called by domain handlers)
POST /internal/schedules/:id/fail:
  auth: internal service auth
  params:
    id: ScheduleId
  body: ExecutionResult
  response:
    200: ScheduledTask
```

### TypeScript Route Types

```typescript
/**
 * POST /schedules request body
 */
export interface CreateScheduleRequest extends CreateScheduleInput {}

/**
 * POST /schedules response
 */
export interface CreateScheduleResponse {
  schedule: ScheduledTask;
  conflicts: ScheduleConflict[];
}

/**
 * POST /schedules/bulk request body
 */
export interface BulkScheduleRequest extends BulkScheduleInput {}

/**
 * POST /schedules/bulk response
 */
export interface BulkScheduleResponse extends BulkScheduleResult {}

/**
 * PATCH /schedules/:id request body
 */
export interface UpdateScheduleRequest extends UpdateScheduleInput {}

/**
 * POST /schedules/:id/reschedule request body
 */
export interface RescheduleRequest {
  scheduledFor: ISOTimestamp;
  force?: boolean;
}

/**
 * POST /schedules/:id/resume request body
 */
export interface ResumeScheduleRequest {
  scheduledFor?: ISOTimestamp;
}

/**
 * GET /schedules query parameters
 */
export interface ListSchedulesQuery {
  customerId?: CustomerId;
  platform?: Platform;
  entityType?: ScheduledEntityType;
  status?: ScheduleStatus | ScheduleStatus[];
  priority?: TaskPriority | TaskPriority[];
  scheduledFrom?: ISOTimestamp;
  scheduledTo?: ISOTimestamp;
  tags?: string[];
  sortBy?: 'scheduledFor' | 'createdAt' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/**
 * GET /schedules/slots query parameters
 */
export interface GetSlotsQuery {
  customerId?: CustomerId;
  platform: Platform;
  startTime: ISOTimestamp;
  endTime: ISOTimestamp;
  slotDurationMinutes?: number;
}

/**
 * GET /schedules/slots response
 */
export interface GetSlotsResponse {
  slots: ScheduleSlot[];
}

/**
 * GET /schedules/optimal-times query parameters
 */
export interface GetOptimalTimesQuery {
  customerId?: CustomerId;
  platform: Platform;
  entityType: ScheduledEntityType;
  subreddit?: string;
  count?: number;
  startTime?: ISOTimestamp;
  endTime?: ISOTimestamp;
  excludeConflicts?: boolean;
}

/**
 * GET /schedules/optimal-times response
 */
export interface GetOptimalTimesResponse {
  recommendations: OptimalTimeRecommendation[];
}

/**
 * POST /schedules/check-conflicts request body
 */
export interface CheckConflictsRequest {
  platform: Platform;
  scheduledFor: ISOTimestamp;
  excludeScheduleId?: ScheduleId;
}

/**
 * POST /schedules/check-conflicts response
 */
export interface CheckConflictsResponse {
  hasConflicts: boolean;
  conflicts: ScheduleConflict[];
}

/**
 * GET /schedules/statistics query parameters
 */
export interface GetStatisticsQuery {
  customerId?: CustomerId;
  from?: ISOTimestamp;
  to?: ISOTimestamp;
}

/**
 * Internal execution result request body
 */
export interface ExecutionResultRequest extends ExecutionResult {}
```

---

## Validation Schemas

```typescript
import { z } from 'zod';

/**
 * ISO timestamp validation
 */
const ISOTimestampSchema = z.string().datetime({
  message: 'Must be a valid ISO 8601 timestamp'
});

/**
 * Schedule ID validation
 */
const ScheduleIdSchema = z.string().regex(
  /^sched_[a-f0-9-]{36}$/,
  'Schedule ID must be in format sched_uuid'
);

/**
 * Customer ID validation
 */
const CustomerIdSchema = z.string().regex(
  /^cust_[a-f0-9-]{36}$/,
  'Customer ID must be in format cust_uuid'
);

/**
 * Platform enum validation
 */
const PlatformSchema = z.enum(['reddit', 'quora', 'forum', 'linkedin']);

/**
 * Schedule status enum validation
 */
const ScheduleStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'paused'
]);

/**
 * Entity type enum validation
 */
const ScheduledEntityTypeSchema = z.enum([
  'reddit_post',
  'article',
  'generic_task'
]);

/**
 * Task priority enum validation
 */
const TaskPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

/**
 * Time of day validation (HH:MM format)
 */
const TimeOfDaySchema = z.string().regex(
  /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  'Time must be in HH:MM format (24-hour)'
);

/**
 * Timezone validation (IANA format)
 */
const TimezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  'Must be a valid IANA timezone'
);

/**
 * Recurrence pattern validation
 */
export const RecurrencePatternSchema = z.object({
  type: z.enum(['once', 'daily', 'weekly', 'monthly']),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  timeOfDay: TimeOfDaySchema,
  timezone: TimezoneSchema,
  endsAt: ISOTimestampSchema.optional(),
  maxOccurrences: z.number().int().positive().optional()
}).refine(
  (data) => {
    if (data.type === 'weekly' && (!data.daysOfWeek || data.daysOfWeek.length === 0)) {
      return false;
    }
    if (data.type === 'monthly' && !data.dayOfMonth) {
      return false;
    }
    return true;
  },
  'Weekly recurrence requires daysOfWeek, monthly requires dayOfMonth'
);

/**
 * Create schedule input validation
 */
export const CreateScheduleInputSchema = z.object({
  customerId: CustomerIdSchema.optional(),
  platform: PlatformSchema,
  entityType: ScheduledEntityTypeSchema,
  entityId: z.string().min(1).max(100),
  scheduledFor: ISOTimestampSchema.refine(
    (date) => new Date(date) > new Date(),
    'Scheduled time must be in the future'
  ),
  priority: TaskPrioritySchema.optional().default('normal'),
  recurrence: RecurrencePatternSchema.optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  forceSchedule: z.boolean().optional().default(false)
});

/**
 * Update schedule input validation
 */
export const UpdateScheduleInputSchema = z.object({
  scheduledFor: ISOTimestampSchema.refine(
    (date) => new Date(date) > new Date(),
    'Scheduled time must be in the future'
  ).optional(),
  priority: TaskPrioritySchema.optional(),
  recurrence: RecurrencePatternSchema.optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one field must be provided for update'
);

/**
 * Reschedule input validation
 */
export const RescheduleInputSchema = z.object({
  scheduledFor: ISOTimestampSchema.refine(
    (date) => new Date(date) > new Date(),
    'Scheduled time must be in the future'
  ),
  force: z.boolean().optional().default(false)
});

/**
 * Resume schedule input validation
 */
export const ResumeScheduleInputSchema = z.object({
  scheduledFor: ISOTimestampSchema.refine(
    (date) => new Date(date) > new Date(),
    'Scheduled time must be in the future'
  ).optional()
});

/**
 * Bulk schedule input validation
 */
export const BulkScheduleInputSchema = z.object({
  tasks: z.array(CreateScheduleInputSchema).min(1).max(100),
  distribution: z.object({
    strategy: z.enum(['sequential', 'spread', 'optimal']),
    windowStart: ISOTimestampSchema,
    windowEnd: ISOTimestampSchema,
    minBuffer: z.number().int().min(1).max(1440).optional()
  }).optional(),
  skipConflicts: z.boolean().optional().default(false)
}).refine(
  (data) => {
    if (data.distribution) {
      return new Date(data.distribution.windowEnd) > new Date(data.distribution.windowStart);
    }
    return true;
  },
  'Distribution window end must be after start'
);

/**
 * Search params validation
 */
export const ScheduleSearchParamsSchema = z.object({
  customerId: CustomerIdSchema.optional(),
  platform: PlatformSchema.optional(),
  entityType: ScheduledEntityTypeSchema.optional(),
  status: z.union([ScheduleStatusSchema, z.array(ScheduleStatusSchema)]).optional(),
  priority: z.union([TaskPrioritySchema, z.array(TaskPrioritySchema)]).optional(),
  scheduledFrom: ISOTimestampSchema.optional(),
  scheduledTo: ISOTimestampSchema.optional(),
  tags: z.array(z.string().max(50)).optional(),
  includeRecurring: z.boolean().optional(),
  sortBy: z.enum(['scheduledFor', 'createdAt', 'priority', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  pagination: z.object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().min(1).max(100).default(20)
  }).optional()
});

/**
 * Check conflicts input validation
 */
export const CheckConflictsInputSchema = z.object({
  platform: PlatformSchema,
  scheduledFor: ISOTimestampSchema,
  excludeScheduleId: ScheduleIdSchema.optional()
});

/**
 * Get slots query validation
 */
export const GetSlotsQuerySchema = z.object({
  customerId: CustomerIdSchema.optional(),
  platform: PlatformSchema,
  startTime: ISOTimestampSchema,
  endTime: ISOTimestampSchema,
  slotDurationMinutes: z.number().int().min(5).max(60).optional().default(15)
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  'End time must be after start time'
).refine(
  (data) => {
    const diffHours = (new Date(data.endTime).getTime() - new Date(data.startTime).getTime()) / (1000 * 60 * 60);
    return diffHours <= SCHEDULE_LOOKAHEAD_HOURS;
  },
  `Time range cannot exceed ${SCHEDULE_LOOKAHEAD_HOURS} hours`
);

/**
 * Execution result validation
 */
export const ExecutionResultSchema = z.object({
  success: z.boolean(),
  executedAt: ISOTimestampSchema,
  durationMs: z.number().int().nonnegative(),
  externalId: z.string().optional(),
  externalUrl: z.string().url().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    details: z.record(z.unknown()).optional()
  }).optional()
});
```

---

## Error Codes

```typescript
/**
 * Scheduling domain-specific error codes.
 */
export const SchedulingErrorCodes = {
  // Task errors
  TASK_NOT_FOUND: 'SCHEDULING_TASK_NOT_FOUND',
  TASK_RUNNING: 'SCHEDULING_TASK_RUNNING',
  ALREADY_EXECUTED: 'SCHEDULING_ALREADY_EXECUTED',
  INVALID_STATE: 'SCHEDULING_INVALID_STATE',

  // Schedule conflict errors
  SCHEDULE_CONFLICT: 'SCHEDULING_SCHEDULE_CONFLICT',
  BUFFER_VIOLATION: 'SCHEDULING_BUFFER_VIOLATION',
  RATE_LIMIT_CONFLICT: 'SCHEDULING_RATE_LIMIT_CONFLICT',
  PLATFORM_LIMIT: 'SCHEDULING_PLATFORM_LIMIT',

  // Time-related errors
  TIME_IN_PAST: 'SCHEDULING_TIME_IN_PAST',
  TIME_PASSED: 'SCHEDULING_TIME_PASSED',
  OUTSIDE_WINDOW: 'SCHEDULING_OUTSIDE_WINDOW',
  BLACKOUT_PERIOD: 'SCHEDULING_BLACKOUT_PERIOD',

  // Entity errors
  ENTITY_NOT_FOUND: 'SCHEDULING_ENTITY_NOT_FOUND',
  ENTITY_NOT_READY: 'SCHEDULING_ENTITY_NOT_READY',
  ENTITY_ALREADY_SCHEDULED: 'SCHEDULING_ENTITY_ALREADY_SCHEDULED',

  // Execution errors
  EXECUTION_FAILED: 'SCHEDULING_EXECUTION_FAILED',
  EXECUTION_TIMEOUT: 'SCHEDULING_EXECUTION_TIMEOUT',
  MAX_RETRIES_EXCEEDED: 'SCHEDULING_MAX_RETRIES_EXCEEDED',
  HANDLER_NOT_FOUND: 'SCHEDULING_HANDLER_NOT_FOUND',

  // Recurrence errors
  INVALID_RECURRENCE: 'SCHEDULING_INVALID_RECURRENCE',
  RECURRENCE_ENDED: 'SCHEDULING_RECURRENCE_ENDED',

  // Bulk operation errors
  BULK_PARTIAL_FAILURE: 'SCHEDULING_BULK_PARTIAL_FAILURE',
  BULK_ALL_FAILED: 'SCHEDULING_BULK_ALL_FAILED',

  // Authorization errors
  UNAUTHORIZED_ACCESS: 'SCHEDULING_UNAUTHORIZED_ACCESS',
  CUSTOMER_MISMATCH: 'SCHEDULING_CUSTOMER_MISMATCH',

  // Quota errors
  QUOTA_EXCEEDED: 'SCHEDULING_QUOTA_EXCEEDED',
  DAILY_LIMIT_REACHED: 'SCHEDULING_DAILY_LIMIT_REACHED'
} as const;

/**
 * Error code type
 */
export type SchedulingErrorCode = typeof SchedulingErrorCodes[keyof typeof SchedulingErrorCodes];

/**
 * Scheduling-specific error class
 */
export class SchedulingError extends Error {
  constructor(
    public code: SchedulingErrorCode,
    message: string,
    public details?: Record<string, unknown>,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'SchedulingError';
  }
}
```

---

## Integration Points

### Events Published (to other domains)

```typescript
/**
 * Events the Scheduling domain publishes for other domains to consume.
 */
export interface SchedulingEvents {
  /**
   * Emitted when a new task is scheduled.
   */
  'schedule.created': {
    scheduleId: ScheduleId;
    customerId: CustomerId;
    platform: Platform;
    entityType: ScheduledEntityType;
    entityId: string;
    scheduledFor: ISOTimestamp;
    priority: TaskPriority;
  };

  /**
   * Emitted when a task is rescheduled.
   */
  'schedule.rescheduled': {
    scheduleId: ScheduleId;
    customerId: CustomerId;
    previousTime: ISOTimestamp;
    newTime: ISOTimestamp;
    reason?: string;
  };

  /**
   * Emitted when a task execution begins.
   */
  'schedule.executing': {
    scheduleId: ScheduleId;
    customerId: CustomerId;
    platform: Platform;
    entityType: ScheduledEntityType;
    entityId: string;
    startedAt: ISOTimestamp;
  };

  /**
   * Emitted when a task is successfully executed.
   */
  'schedule.executed': {
    scheduleId: ScheduleId;
    customerId: CustomerId;
    platform: Platform;
    entityType: ScheduledEntityType;
    entityId: string;
    executedAt: ISOTimestamp;
    durationMs: number;
    externalId?: string;
    externalUrl?: string;
  };

  /**
   * Emitted when a task execution fails.
   */
  'schedule.failed': {
    scheduleId: ScheduleId;
    customerId: CustomerId;
    platform: Platform;
    entityType: ScheduledEntityType;
    entityId: string;
    failedAt: ISOTimestamp;
    error: {
      code: string;
      message: string;
      retryable: boolean;
    };
    retryCount: number;
    willRetry: boolean;
    nextRetryAt?: ISOTimestamp;
  };

  /**
   * Emitted when a task is cancelled.
   */
  'schedule.cancelled': {
    scheduleId: ScheduleId;
    customerId: CustomerId;
    entityType: ScheduledEntityType;
    entityId: string;
    cancelledAt: ISOTimestamp;
    reason?: string;
  };

  /**
   * Emitted when a task is paused.
   */
  'schedule.paused': {
    scheduleId: ScheduleId;
    customerId: CustomerId;
    pausedAt: ISOTimestamp;
  };

  /**
   * Emitted when a task is resumed.
   */
  'schedule.resumed': {
    scheduleId: ScheduleId;
    customerId: CustomerId;
    resumedAt: ISOTimestamp;
    newScheduledFor: ISOTimestamp;
  };

  /**
   * Emitted when max retries are exhausted.
   */
  'schedule.retries_exhausted': {
    scheduleId: ScheduleId;
    customerId: CustomerId;
    entityType: ScheduledEntityType;
    entityId: string;
    totalAttempts: number;
    lastError: {
      code: string;
      message: string;
    };
  };
}
```

### Events Consumed (from other domains)

```typescript
/**
 * Events the Scheduling domain consumes from other domains.
 */
export interface ConsumedEvents {
  /**
   * From Reddit Distribution domain - Reddit post approved for posting.
   * Triggers schedule creation or update.
   */
  'reddit_post.approved': {
    postId: RedditPostId;
    customerId: CustomerId;
    subreddit: string;
    suggestedPostTime?: ISOTimestamp;
  };

  /**
   * From Article domain - Article approved for publishing.
   * May trigger schedule creation for article publishing.
   */
  'article.approved': {
    articleId: ArticleId;
    customerId: CustomerId;
    title: string;
    suggestedPublishTime?: ISOTimestamp;
  };

  /**
   * From Reddit Distribution domain - Reddit post status changed.
   * May require schedule cancellation or update.
   */
  'reddit_post.status_changed': {
    postId: RedditPostId;
    customerId: CustomerId;
    previousStatus: string;
    newStatus: string;
  };

  /**
   * From Article domain - Article status changed.
   * May require schedule cancellation or update.
   */
  'article.status_changed': {
    articleId: ArticleId;
    customerId: CustomerId;
    previousStatus: string;
    newStatus: string;
  };

  /**
   * From Customer domain - Customer tier or settings changed.
   * May affect rate limits and scheduling constraints.
   */
  'customer.settings_changed': {
    customerId: CustomerId;
    changes: {
      tier?: string;
      timezone?: string;
      postingPreferences?: {
        blackoutPeriods?: Array<{ start: string; end: string }>;
        preferredTimes?: string[];
      };
    };
  };

  /**
   * From Analytics domain - Engagement data updated.
   * Used to refine optimal time recommendations.
   */
  'analytics.engagement_updated': {
    customerId: CustomerId;
    platform: Platform;
    subreddit?: string;
    engagementByHour: Record<number, number>;
    engagementByDay: Record<number, number>;
    sampleSize: number;
    calculatedAt: ISOTimestamp;
  };
}
```

### Event Handlers

```typescript
/**
 * Handler implementations for consumed events.
 */
export interface ISchedulingEventHandler {
  /**
   * Handle Reddit post approval.
   * Creates a new schedule if suggestedPostTime is provided.
   */
  onRedditPostApproved(event: ConsumedEvents['reddit_post.approved']): Promise<void>;

  /**
   * Handle article approval.
   * Creates a new schedule if suggestedPublishTime is provided.
   */
  onArticleApproved(event: ConsumedEvents['article.approved']): Promise<void>;

  /**
   * Handle Reddit post status change.
   * Cancels schedules if post is no longer in postable state.
   */
  onRedditPostStatusChanged(event: ConsumedEvents['reddit_post.status_changed']): Promise<void>;

  /**
   * Handle article status change.
   * Cancels schedules if article is no longer in publishable state.
   */
  onArticleStatusChanged(event: ConsumedEvents['article.status_changed']): Promise<void>;

  /**
   * Handle customer settings change.
   * Updates scheduling constraints and preferences.
   */
  onCustomerSettingsChanged(event: ConsumedEvents['customer.settings_changed']): Promise<void>;

  /**
   * Handle engagement data update.
   * Updates optimal time calculation cache.
   */
  onEngagementUpdated(event: ConsumedEvents['analytics.engagement_updated']): Promise<void>;
}
```

---

## Database Schema

```typescript
/**
 * Suggested database schema for the scheduled_tasks table.
 * Implementations may adapt based on the chosen database.
 */
export interface ScheduledTasksTable {
  // Primary key
  id: string;  // ScheduleId

  // Core fields
  customer_id: string;  // CustomerId
  platform: string;  // Platform enum value
  entity_type: string;  // ScheduledEntityType enum value
  entity_id: string;  // Reference to the scheduled entity

  // Scheduling fields
  scheduled_for: Date;  // When to execute
  status: string;  // ScheduleStatus enum value
  priority: string;  // TaskPriority enum value

  // Execution tracking
  executed_at: Date | null;
  execution_result: string | null;  // JSON stringified ExecutionResult
  retry_count: number;
  next_retry_at: Date | null;

  // Recurrence
  recurrence_pattern: string | null;  // JSON stringified RecurrencePattern
  parent_schedule_id: string | null;  // For recurring instances

  // Metadata
  notes: string | null;
  tags: string | null;  // JSON stringified string[]

  // Audit fields
  created_at: Date;
  created_by: string;  // UserId
  updated_at: Date;
  updated_by: string;  // UserId
}

/**
 * Recommended indexes for the scheduled_tasks table.
 */
export const SCHEDULED_TASKS_INDEXES = [
  // Primary key
  { name: 'pk_scheduled_tasks', columns: ['id'], unique: true },

  // Customer queries
  { name: 'idx_scheduled_tasks_customer', columns: ['customer_id', 'scheduled_for'] },
  { name: 'idx_scheduled_tasks_customer_status', columns: ['customer_id', 'status'] },

  // Execution queries
  { name: 'idx_scheduled_tasks_pending', columns: ['status', 'scheduled_for'] },
  { name: 'idx_scheduled_tasks_retry', columns: ['status', 'next_retry_at'] },

  // Platform queries
  { name: 'idx_scheduled_tasks_platform', columns: ['platform', 'scheduled_for'] },

  // Entity lookup
  { name: 'idx_scheduled_tasks_entity', columns: ['entity_type', 'entity_id'] },

  // Recurring tasks
  { name: 'idx_scheduled_tasks_parent', columns: ['parent_schedule_id'] }
];
```

---

## Worker Configuration

```typescript
/**
 * Configuration for the scheduler worker process.
 */
export interface SchedulerWorkerConfig {
  /** How often to poll for pending tasks (ms) */
  pollIntervalMs: number;

  /** Maximum tasks to process in parallel */
  maxConcurrentTasks: number;

  /** Timeout for individual task execution (ms) */
  taskTimeoutMs: number;

  /** How far ahead to look for tasks (minutes) */
  lookaheadMinutes: number;

  /** Minimum buffer between tasks for same customer/platform (minutes) */
  taskBufferMinutes: number;

  /** Maximum retries for failed tasks */
  maxRetries: number;

  /** Base delay between retries (ms), multiplied by retry count */
  retryDelayBaseMs: number;

  /** Whether to use exponential backoff for retries */
  useExponentialBackoff: boolean;

  /** Platform-specific rate limits */
  platformRateLimits: Record<Platform, {
    maxPerHour: number;
    maxPerDay: number;
    minIntervalMs: number;
  }>;
}

/**
 * Default worker configuration.
 */
export const DEFAULT_WORKER_CONFIG: SchedulerWorkerConfig = {
  pollIntervalMs: 10000,  // 10 seconds
  maxConcurrentTasks: 10,
  taskTimeoutMs: 60000,  // 1 minute
  lookaheadMinutes: 5,
  taskBufferMinutes: DEFAULT_SCHEDULE_BUFFER_MINUTES,
  maxRetries: MAX_RETRY_ATTEMPTS,
  retryDelayBaseMs: RETRY_DELAY_MINUTES * 60 * 1000,
  useExponentialBackoff: true,
  platformRateLimits: {
    reddit: {
      maxPerHour: 60,
      maxPerDay: 1000,
      minIntervalMs: 60000  // 1 minute minimum between posts
    },
    quora: {
      maxPerHour: 30,
      maxPerDay: 500,
      minIntervalMs: 120000  // 2 minutes minimum
    },
    forum: {
      maxPerHour: 20,
      maxPerDay: 200,
      minIntervalMs: 180000  // 3 minutes minimum
    },
    linkedin: {
      maxPerHour: 10,
      maxPerDay: 50,
      minIntervalMs: 360000  // 6 minutes minimum
    }
  }
};
```

---

## Notes for Implementers

1. **Task Execution Flow**:
   - Worker polls for pending tasks where `scheduledFor <= now` and `status = pending`
   - Task status is set to `running` before execution begins
   - Appropriate domain handler is invoked based on `entityType`
   - On success: status -> `completed`, result is recorded
   - On failure: retry logic is evaluated, status -> `failed` or remains `pending` with `nextRetryAt` set

2. **Conflict Detection**:
   - Check for existing tasks within `DEFAULT_SCHEDULE_BUFFER_MINUTES` of proposed time
   - Consider platform rate limits when scheduling
   - Customer-specific blackout periods should be respected

3. **Optimal Time Calculation**:
   - Use historical engagement data from Analytics domain
   - Consider subreddit-specific patterns for Reddit
   - Weight recent data more heavily than older data
   - Factor in timezone of target audience

4. **Recurrence Handling**:
   - Recurring schedules create child instances
   - Child instances have `parentScheduleId` set
   - When parent is cancelled, all future children should be cancelled
   - Completed children are independent of parent

5. **Retry Policy**:
   - Only retry if `error.retryable` is true
   - Maximum of `MAX_RETRY_ATTEMPTS` retries
   - Use exponential backoff: `retryDelayBaseMs * 2^retryCount`
   - After max retries, emit `schedule.retries_exhausted` event

6. **Priority Handling**:
   - When multiple tasks are ready, process in priority order: urgent > high > normal > low
   - Within same priority, process by scheduled time (FIFO)

7. **Timezone Handling**:
   - All times stored in UTC
   - Customer timezone used for display and recurrence calculations
   - Optimal time recommendations consider audience timezone

8. **Idempotency**:
   - Task execution should be idempotent where possible
   - Use external IDs to detect duplicate executions
   - Store execution results for audit trail

---

*Contract Version: 1.0.0 | Generated: 2026-01-18*
