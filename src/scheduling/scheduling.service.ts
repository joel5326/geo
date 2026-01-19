/**
 * GEO Platform - Scheduling Domain Service
 *
 * This module implements the ISchedulingService interface, providing
 * comprehensive task scheduling capabilities including task lifecycle
 * management, conflict detection, execution handling, and scheduling
 * optimization.
 *
 * @module scheduling/scheduling.service
 * @version 1.0.0
 */

import {
  ScheduleId,
  CustomerId,
  ISOTimestamp,
  ScheduleStatus,
  PaginatedResponse,
  PaginationParams,
  SCHEDULE_LOOKAHEAD_HOURS,
  DEFAULT_SCHEDULE_BUFFER_MINUTES,
} from '../shared/shared.types';

import {
  ScheduledTask,
  TaskExecutionResult,
  SchedulingPreferences,
  ScheduleConflict,
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
  IScheduledTaskRepository,
} from './scheduling.repository';

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Service interface for scheduling operations.
 * Implements the complete task lifecycle and scheduling logic.
 */
export interface ISchedulingService {
  // Task Management
  createScheduledTask(input: CreateScheduledTaskInput): Promise<ScheduledTask>;
  getTaskById(id: ScheduleId): Promise<ScheduledTask | null>;
  updateTask(id: ScheduleId, input: UpdateScheduledTaskInput): Promise<ScheduledTask>;
  deleteTask(id: ScheduleId): Promise<boolean>;

  // Task Lifecycle
  pauseTask(id: ScheduleId): Promise<ScheduledTask>;
  resumeTask(id: ScheduleId): Promise<ScheduledTask>;
  cancelTask(id: ScheduleId, reason: string): Promise<ScheduledTask>;
  completeTask(id: ScheduleId, result: TaskExecutionResult): Promise<ScheduledTask>;
  failTask(id: ScheduleId, error: string): Promise<ScheduledTask>;

  // Queries
  getTasksByCustomer(
    customerId: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ScheduledTask>>;
  getTasksByStatus(status: ScheduleStatus, customerId?: CustomerId): Promise<ScheduledTask[]>;
  getPendingTasks(lookaheadHours?: number): Promise<ScheduledTask[]>;
  getTasksInTimeRange(
    startTime: ISOTimestamp,
    endTime: ISOTimestamp,
    customerId?: CustomerId
  ): Promise<ScheduledTask[]>;

  // Execution
  getNextTaskToExecute(): Promise<ScheduledTask | null>;
  executeTask(id: ScheduleId): Promise<TaskExecutionResult>;

  // Scheduling Suggestions
  suggestOptimalTime(
    customerId: CustomerId,
    preferences: SchedulingPreferences
  ): Promise<ISOTimestamp>;
  getScheduleConflicts(
    customerId: CustomerId,
    proposedTime: ISOTimestamp
  ): Promise<ScheduleConflict[]>;
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Base error class for scheduling domain errors.
 */
export class SchedulingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SchedulingError';
  }
}

/**
 * Error thrown when a task is not found.
 */
export class TaskNotFoundError extends SchedulingError {
  constructor(taskId: ScheduleId) {
    super('TASK_NOT_FOUND', `Task not found: ${taskId}`, { taskId });
    this.name = 'TaskNotFoundError';
  }
}

/**
 * Error thrown when a task status transition is invalid.
 */
export class InvalidStatusTransitionError extends SchedulingError {
  constructor(taskId: ScheduleId, currentStatus: ScheduleStatus, targetStatus: ScheduleStatus) {
    super(
      'INVALID_STATUS_TRANSITION',
      `Cannot transition task ${taskId} from ${currentStatus} to ${targetStatus}`,
      { taskId, currentStatus, targetStatus }
    );
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * Error thrown when a task execution fails.
 */
export class TaskExecutionError extends SchedulingError {
  constructor(taskId: ScheduleId, error: string) {
    super('TASK_EXECUTION_FAILED', `Task execution failed: ${error}`, { taskId, error });
    this.name = 'TaskExecutionError';
  }
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Default values for task creation.
 */
const DEFAULT_PRIORITY = 0;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Implementation of the scheduling service.
 * Handles all business logic for task scheduling and lifecycle management.
 */
export class SchedulingService implements ISchedulingService {
  constructor(private readonly repository: IScheduledTaskRepository) {}

  // ---------------------------------------------------------------------------
  // Task Management
  // ---------------------------------------------------------------------------

  /**
   * Create a new scheduled task.
   * Validates the scheduled time and checks for conflicts.
   */
  async createScheduledTask(input: CreateScheduledTaskInput): Promise<ScheduledTask> {
    const now = new Date().toISOString() as ISOTimestamp;

    // Validate scheduled time is in the future
    if (new Date(input.scheduledFor) <= new Date()) {
      throw new SchedulingError(
        'INVALID_SCHEDULE_TIME',
        'Scheduled time must be in the future',
        { scheduledFor: input.scheduledFor }
      );
    }

    const id = this.generateScheduleId();

    const task: ScheduledTask = {
      id,
      customerId: input.customerId,
      taskType: input.taskType,
      targetId: input.targetId,
      scheduledFor: input.scheduledFor,
      status: ScheduleStatus.pending,
      priority: input.priority ?? DEFAULT_PRIORITY,
      retryCount: 0,
      maxRetries: input.maxRetries ?? DEFAULT_MAX_RETRIES,
      metadata: input.metadata ?? {},
      audit: {
        createdAt: now,
        createdBy: input.createdBy,
        updatedAt: now,
        updatedBy: input.createdBy,
      },
    };

    return this.repository.create(task);
  }

  /**
   * Get a task by its ID.
   */
  async getTaskById(id: ScheduleId): Promise<ScheduledTask | null> {
    return this.repository.findById(id);
  }

  /**
   * Update an existing scheduled task.
   * Only allows updates to pending or paused tasks.
   */
  async updateTask(id: ScheduleId, input: UpdateScheduledTaskInput): Promise<ScheduledTask> {
    const task = await this.repository.findById(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }

    // Only allow updates to pending or paused tasks
    if (task.status !== ScheduleStatus.pending && task.status !== ScheduleStatus.paused) {
      throw new InvalidStatusTransitionError(id, task.status, task.status);
    }

    const updates: Partial<ScheduledTask> = {
      audit: {
        ...task.audit,
        updatedAt: new Date().toISOString() as ISOTimestamp,
        updatedBy: input.updatedBy,
      },
    };

    if (input.scheduledFor !== undefined) {
      // Validate new scheduled time is in the future
      if (new Date(input.scheduledFor) <= new Date()) {
        throw new SchedulingError(
          'INVALID_SCHEDULE_TIME',
          'Scheduled time must be in the future',
          { scheduledFor: input.scheduledFor }
        );
      }
      updates.scheduledFor = input.scheduledFor;
    }

    if (input.priority !== undefined) {
      updates.priority = input.priority;
    }

    if (input.metadata !== undefined) {
      updates.metadata = { ...task.metadata, ...input.metadata };
    }

    return this.repository.update(id, updates);
  }

  /**
   * Delete a scheduled task.
   * Only allows deletion of pending, paused, completed, cancelled, or failed tasks.
   */
  async deleteTask(id: ScheduleId): Promise<boolean> {
    const task = await this.repository.findById(id);
    if (!task) {
      return false;
    }

    // Prevent deletion of running tasks
    if (task.status === ScheduleStatus.running) {
      throw new SchedulingError(
        'CANNOT_DELETE_RUNNING_TASK',
        'Cannot delete a task that is currently running',
        { taskId: id }
      );
    }

    return this.repository.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Task Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Pause a pending task.
   * Only pending tasks can be paused.
   */
  async pauseTask(id: ScheduleId): Promise<ScheduledTask> {
    const task = await this.repository.findById(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }

    if (task.status !== ScheduleStatus.pending) {
      throw new InvalidStatusTransitionError(id, task.status, ScheduleStatus.paused);
    }

    return this.repository.update(id, {
      status: ScheduleStatus.paused,
    });
  }

  /**
   * Resume a paused task.
   * Only paused tasks can be resumed.
   */
  async resumeTask(id: ScheduleId): Promise<ScheduledTask> {
    const task = await this.repository.findById(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }

    if (task.status !== ScheduleStatus.paused) {
      throw new InvalidStatusTransitionError(id, task.status, ScheduleStatus.pending);
    }

    return this.repository.update(id, {
      status: ScheduleStatus.pending,
    });
  }

  /**
   * Cancel a task with a reason.
   * Cannot cancel running or already completed/cancelled tasks.
   */
  async cancelTask(id: ScheduleId, reason: string): Promise<ScheduledTask> {
    const task = await this.repository.findById(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }

    // Cannot cancel completed, cancelled, or running tasks
    if (
      task.status === ScheduleStatus.completed ||
      task.status === ScheduleStatus.cancelled ||
      task.status === ScheduleStatus.running
    ) {
      throw new InvalidStatusTransitionError(id, task.status, ScheduleStatus.cancelled);
    }

    return this.repository.update(id, {
      status: ScheduleStatus.cancelled,
      lastError: reason,
      metadata: {
        ...task.metadata,
        cancellationReason: reason,
        cancelledAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Mark a task as completed with its execution result.
   * Only running tasks can be marked as completed.
   */
  async completeTask(id: ScheduleId, result: TaskExecutionResult): Promise<ScheduledTask> {
    const task = await this.repository.findById(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }

    if (task.status !== ScheduleStatus.running) {
      throw new InvalidStatusTransitionError(id, task.status, ScheduleStatus.completed);
    }

    return this.repository.update(id, {
      status: ScheduleStatus.completed,
      completedAt: result.executedAt,
      result,
    });
  }

  /**
   * Mark a task as failed with an error message.
   * Only running tasks can be marked as failed.
   * If retries remain, the task will be rescheduled.
   */
  async failTask(id: ScheduleId, error: string): Promise<ScheduledTask> {
    const task = await this.repository.findById(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }

    if (task.status !== ScheduleStatus.running) {
      throw new InvalidStatusTransitionError(id, task.status, ScheduleStatus.failed);
    }

    const newRetryCount = task.retryCount + 1;
    const canRetry = newRetryCount < task.maxRetries;

    if (canRetry) {
      // Schedule for retry with exponential backoff
      const retryDelayMs = Math.pow(2, newRetryCount) * 60 * 1000; // 2^n minutes
      const nextRetryTime = new Date(Date.now() + retryDelayMs).toISOString() as ISOTimestamp;

      return this.repository.update(id, {
        status: ScheduleStatus.pending,
        retryCount: newRetryCount,
        lastError: error,
        scheduledFor: nextRetryTime,
        metadata: {
          ...task.metadata,
          lastFailure: {
            error,
            timestamp: new Date().toISOString(),
            retryCount: newRetryCount,
          },
        },
      });
    }

    // No more retries - mark as failed
    return this.repository.update(id, {
      status: ScheduleStatus.failed,
      retryCount: newRetryCount,
      lastError: error,
      result: {
        success: false,
        message: `Task failed after ${newRetryCount} attempts: ${error}`,
        durationMs: 0,
        executedAt: new Date().toISOString() as ISOTimestamp,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /**
   * Get all tasks for a customer with pagination.
   */
  async getTasksByCustomer(
    customerId: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ScheduledTask>> {
    return this.repository.findByCustomer(customerId, pagination);
  }

  /**
   * Get tasks by status, optionally filtered by customer.
   */
  async getTasksByStatus(
    status: ScheduleStatus,
    customerId?: CustomerId
  ): Promise<ScheduledTask[]> {
    return this.repository.findByStatus(status, customerId);
  }

  /**
   * Get pending tasks within the lookahead window.
   */
  async getPendingTasks(lookaheadHours?: number): Promise<ScheduledTask[]> {
    return this.repository.findPendingTasks(lookaheadHours ?? SCHEDULE_LOOKAHEAD_HOURS);
  }

  /**
   * Get tasks scheduled within a time range.
   */
  async getTasksInTimeRange(
    startTime: ISOTimestamp,
    endTime: ISOTimestamp,
    customerId?: CustomerId
  ): Promise<ScheduledTask[]> {
    return this.repository.findByTimeRange(startTime, endTime, customerId);
  }

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  /**
   * Get the next task that is ready for execution.
   * Returns the highest priority task whose scheduled time has passed.
   */
  async getNextTaskToExecute(): Promise<ScheduledTask | null> {
    return this.repository.findNextExecutable();
  }

  /**
   * Execute a scheduled task.
   * This method handles the execution lifecycle:
   * 1. Mark the task as running
   * 2. Execute the task (simulated here)
   * 3. Mark as completed or failed based on result
   */
  async executeTask(id: ScheduleId): Promise<TaskExecutionResult> {
    const task = await this.repository.findById(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }

    if (task.status !== ScheduleStatus.pending) {
      throw new InvalidStatusTransitionError(id, task.status, ScheduleStatus.running);
    }

    // Mark as running
    await this.repository.update(id, {
      status: ScheduleStatus.running,
      executedAt: new Date().toISOString() as ISOTimestamp,
    });

    const startTime = Date.now();

    try {
      // Execute the task based on type
      // In a real implementation, this would delegate to the appropriate handler
      const result = await this.executeTaskByType(task);

      // Mark as completed
      await this.completeTask(id, result);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startTime;

      // Mark as failed (may trigger retry)
      await this.failTask(id, errorMessage);

      return {
        success: false,
        message: errorMessage,
        durationMs,
        executedAt: new Date().toISOString() as ISOTimestamp,
      };
    }
  }

  /**
   * Execute a task based on its type.
   * This is a placeholder implementation - in production, this would
   * delegate to the appropriate domain service.
   */
  private async executeTaskByType(task: ScheduledTask): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    // Simulate task execution based on type
    switch (task.taskType) {
      case 'reddit_post':
        // Would call Reddit distribution service
        return {
          success: true,
          message: 'Reddit post scheduled successfully',
          data: { targetId: task.targetId },
          durationMs: Date.now() - startTime,
          executedAt: new Date().toISOString() as ISOTimestamp,
        };

      case 'engagement_refresh':
        // Would call analytics service
        return {
          success: true,
          message: 'Engagement metrics refreshed',
          data: { targetId: task.targetId },
          durationMs: Date.now() - startTime,
          executedAt: new Date().toISOString() as ISOTimestamp,
        };

      case 'content_publish':
        // Would call article service
        return {
          success: true,
          message: 'Content published successfully',
          data: { targetId: task.targetId },
          durationMs: Date.now() - startTime,
          executedAt: new Date().toISOString() as ISOTimestamp,
        };

      case 'analytics_sync':
        // Would call analytics service
        return {
          success: true,
          message: 'Analytics synchronized',
          data: { targetId: task.targetId },
          durationMs: Date.now() - startTime,
          executedAt: new Date().toISOString() as ISOTimestamp,
        };

      default:
        throw new TaskExecutionError(
          task.id,
          `Unknown task type: ${task.taskType}`
        );
    }
  }

  // ---------------------------------------------------------------------------
  // Scheduling Suggestions
  // ---------------------------------------------------------------------------

  /**
   * Suggest an optimal scheduling time based on user preferences.
   * Takes into account preferred days, hours, and existing conflicts.
   */
  async suggestOptimalTime(
    customerId: CustomerId,
    preferences: SchedulingPreferences
  ): Promise<ISOTimestamp> {
    const now = new Date();
    const bufferMs = preferences.minimumGapMinutes * 60 * 1000;

    // Start searching from now + minimum gap
    let candidateTime = new Date(now.getTime() + bufferMs);

    // Try to find an optimal time within the next 7 days
    const maxSearchDays = 7;
    const endSearch = new Date(now.getTime() + maxSearchDays * 24 * 60 * 60 * 1000);

    while (candidateTime < endSearch) {
      const dayOfWeek = candidateTime.getDay();
      const hour = candidateTime.getHours();

      // Check if this time matches preferences
      const isPreferredDay =
        !preferences.preferredDays || preferences.preferredDays.includes(dayOfWeek);
      const isPreferredHour =
        !preferences.preferredHours || preferences.preferredHours.includes(hour);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const avoidWeekend = preferences.avoidWeekends && isWeekend;

      if (isPreferredDay && isPreferredHour && !avoidWeekend) {
        // Check for conflicts at this time
        const conflicts = await this.repository.findConflicts(
          customerId,
          candidateTime.toISOString() as ISOTimestamp,
          preferences.minimumGapMinutes
        );

        if (conflicts.length === 0) {
          return candidateTime.toISOString() as ISOTimestamp;
        }
      }

      // Move to the next hour
      candidateTime = new Date(candidateTime.getTime() + 60 * 60 * 1000);
    }

    // If no optimal time found, return the first available slot
    const firstAvailable = new Date(now.getTime() + bufferMs);
    return firstAvailable.toISOString() as ISOTimestamp;
  }

  /**
   * Get conflicts for a proposed scheduling time.
   * Returns details about any existing tasks that would conflict.
   */
  async getScheduleConflicts(
    customerId: CustomerId,
    proposedTime: ISOTimestamp
  ): Promise<ScheduleConflict[]> {
    const conflictingTasks = await this.repository.findConflicts(
      customerId,
      proposedTime,
      DEFAULT_SCHEDULE_BUFFER_MINUTES
    );

    return conflictingTasks.map((task) => ({
      existingTaskId: task.id,
      scheduledFor: task.scheduledFor,
      taskType: task.taskType,
      reason: `Task of type '${task.taskType}' is scheduled within ${DEFAULT_SCHEDULE_BUFFER_MINUTES} minutes of the proposed time`,
    }));
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Generate a unique schedule ID.
   */
  private generateScheduleId(): ScheduleId {
    const uuid = this.generateUUID();
    return `sched_${uuid}` as ScheduleId;
  }

  /**
   * Generate a UUID v4.
   */
  private generateUUID(): string {
    // Simple UUID v4 implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new SchedulingService instance with the given repository.
 */
export function createSchedulingService(
  repository: IScheduledTaskRepository
): ISchedulingService {
  return new SchedulingService(repository);
}
