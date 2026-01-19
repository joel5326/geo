/**
 * Scheduling API Routes
 *
 * REST endpoints for managing scheduled tasks in the GEO Platform.
 * Includes CRUD operations, task lifecycle, and scheduling suggestions.
 *
 * @module api/routes/scheduling.routes
 * @version 1.0.0
 */

import { Hono } from 'hono';
import {
  SchedulingService,
  createSchedulingService,
} from '../../scheduling/scheduling.service';
import {
  InMemoryScheduledTaskRepository,
} from '../../scheduling/scheduling.repository';
import type {
  ScheduleId,
  CustomerId,
  UserId,
  ISOTimestamp,
  ScheduleStatus,
  PaginationParams,
  UserRef,
} from '../../shared/shared.types';
import type {
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
  SchedulingPreferences,
} from '../../scheduling/scheduling.repository';

const app = new Hono();

// Initialize service with in-memory repository
const repository = new InMemoryScheduledTaskRepository();
const service = createSchedulingService(repository);

/**
 * Helper to create a UserRef from request headers
 */
function getUserRef(c: { req: { header: (name: string) => string | undefined } }): UserRef {
  const userId = c.req.header('X-User-Id') || 'usr_anonymous';
  const userEmail = c.req.header('X-User-Email') || 'anonymous@example.com';
  const userName = c.req.header('X-User-Name') || 'Anonymous User';

  return {
    id: userId as UserId,
    email: userEmail,
    displayName: userName,
  };
}

// =============================================================================
// CRUD ENDPOINTS
// =============================================================================

/**
 * GET / - List scheduled tasks with pagination
 */
app.get('/', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId | undefined;
    const status = c.req.query('status') as ScheduleStatus | undefined;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

    if (status) {
      const tasks = await service.getTasksByStatus(status, customerId);
      return c.json({
        data: tasks,
        pagination: {
          page: 1,
          pageSize: tasks.length,
          totalItems: tasks.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    }

    if (customerId) {
      const pagination: PaginationParams = { page, pageSize };
      const result = await service.getTasksByCustomer(customerId, pagination);
      return c.json(result);
    }

    return c.json({
      data: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /pending - Get pending tasks within lookahead window
 */
app.get('/pending', async (c) => {
  try {
    const lookaheadHours = parseInt(c.req.query('lookaheadHours') || '168', 10);

    const tasks = await service.getPendingTasks(lookaheadHours);
    return c.json({ data: tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:id - Get scheduled task by ID
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id') as ScheduleId;
    const task = await service.getTaskById(id);

    if (!task) {
      return c.json({ error: 'Scheduled task not found' }, 404);
    }

    return c.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST / - Create a new scheduled task
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json<Omit<CreateScheduledTaskInput, 'createdBy'>>();
    const userRef = getUserRef(c);

    const input: CreateScheduledTaskInput = {
      ...body,
      createdBy: userRef,
    };

    const task = await service.createScheduledTask(input);
    return c.json(task, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

/**
 * PUT /:id - Update a scheduled task
 */
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id') as ScheduleId;
    const body = await c.req.json<Omit<UpdateScheduledTaskInput, 'updatedBy'>>();
    const userRef = getUserRef(c);

    const input: UpdateScheduledTaskInput = {
      ...body,
      updatedBy: userRef,
    };

    const task = await service.updateTask(id, input);
    return c.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * DELETE /:id - Delete a scheduled task
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id') as ScheduleId;

    const deleted = await service.deleteTask(id);
    if (!deleted) {
      return c.json({ error: 'Scheduled task not found' }, 404);
    }

    return c.json({ success: true, message: 'Scheduled task deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// TASK LIFECYCLE
// =============================================================================

/**
 * POST /:id/pause - Pause a pending task
 */
app.post('/:id/pause', async (c) => {
  try {
    const id = c.req.param('id') as ScheduleId;

    const task = await service.pauseTask(id);
    return c.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /:id/resume - Resume a paused task
 */
app.post('/:id/resume', async (c) => {
  try {
    const id = c.req.param('id') as ScheduleId;

    const task = await service.resumeTask(id);
    return c.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /:id/cancel - Cancel a task
 */
app.post('/:id/cancel', async (c) => {
  try {
    const id = c.req.param('id') as ScheduleId;
    const body = await c.req.json<{ reason: string }>();

    if (!body.reason) {
      return c.json({ error: 'Cancellation reason is required' }, 400);
    }

    const task = await service.cancelTask(id, body.reason);
    return c.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /:id/execute - Execute a scheduled task
 */
app.post('/:id/execute', async (c) => {
  try {
    const id = c.req.param('id') as ScheduleId;

    const result = await service.executeTask(id);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

// =============================================================================
// QUERY ENDPOINTS
// =============================================================================

/**
 * GET /next - Get next task to execute
 */
app.get('/next', async (c) => {
  try {
    const task = await service.getNextTaskToExecute();

    if (!task) {
      return c.json({ data: null, message: 'No tasks ready for execution' });
    }

    return c.json({ data: task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /time-range - Get tasks in a time range
 */
app.get('/time-range', async (c) => {
  try {
    const startTime = c.req.query('startTime') as ISOTimestamp;
    const endTime = c.req.query('endTime') as ISOTimestamp;
    const customerId = c.req.query('customerId') as CustomerId | undefined;

    if (!startTime || !endTime) {
      return c.json({ error: 'Start time and end time are required' }, 400);
    }

    const tasks = await service.getTasksInTimeRange(startTime, endTime, customerId);
    return c.json({ data: tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// SCHEDULING SUGGESTIONS
// =============================================================================

/**
 * POST /suggest-time - Get optimal scheduling time
 */
app.post('/suggest-time', async (c) => {
  try {
    const body = await c.req.json<{
      customerId: CustomerId;
      preferences: SchedulingPreferences;
    }>();

    if (!body.customerId || !body.preferences) {
      return c.json({ error: 'Customer ID and preferences are required' }, 400);
    }

    const suggestedTime = await service.suggestOptimalTime(
      body.customerId,
      body.preferences
    );
    return c.json({ suggestedTime });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /conflicts - Check for scheduling conflicts
 */
app.get('/conflicts', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;
    const proposedTime = c.req.query('proposedTime') as ISOTimestamp;

    if (!customerId || !proposedTime) {
      return c.json({ error: 'Customer ID and proposed time are required' }, 400);
    }

    const conflicts = await service.getScheduleConflicts(customerId, proposedTime);
    return c.json({ conflicts, hasConflicts: conflicts.length > 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export default app;
