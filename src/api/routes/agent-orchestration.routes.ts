/**
 * Agent Orchestration API Routes
 *
 * REST endpoints for managing Claude agent sessions, workflows, and invocations
 * in the GEO Platform.
 *
 * @module api/routes/agent-orchestration.routes
 * @version 1.0.0
 */

import { Hono } from 'hono';
import { AgentOrchestrationService } from '../../agent-orchestration/agent-orchestration.service';
import {
  InMemoryAgentSessionRepository,
  InMemoryAgentWorkflowRepository,
  InMemoryWorkflowExecutionRepository,
  InMemoryAgentInvocationRepository,
} from '../../agent-orchestration/agent-orchestration.repository';
import type {
  UserId,
  CustomerId,
  PaginationParams,
} from '../../shared/shared.types';
import type {
  AgentSessionId,
  WorkflowId,
  WorkflowExecutionId,
  ToolCallId,
  AgentType,
  AgentSessionStatus,
  WorkflowExecutionStatus,
  ToolCallStatus,
  CreateSessionInput,
  StartWorkflowInput,
  AdvanceWorkflowInput,
  AgentInvocationInput,
  MetricsQueryFilters,
  ISOTimestamp,
  AgentErrorCode,
} from '../../domains/agent-orchestration/agent-orchestration.types';

const app = new Hono();

// Initialize service with in-memory repositories
const sessionRepository = new InMemoryAgentSessionRepository();
const workflowRepository = new InMemoryAgentWorkflowRepository();
const executionRepository = new InMemoryWorkflowExecutionRepository();
const invocationRepository = new InMemoryAgentInvocationRepository();

const service = new AgentOrchestrationService(
  sessionRepository,
  workflowRepository,
  executionRepository,
  invocationRepository
);

// =============================================================================
// SESSION MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * GET / - List sessions with filters
 */
app.get('/', async (c) => {
  try {
    const userId = c.req.query('userId') as UserId | undefined;
    const customerId = c.req.query('customerId') as CustomerId | undefined;
    const agentType = c.req.query('agentType') as AgentType | undefined;
    const status = c.req.query('status') as AgentSessionStatus | undefined;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

    const pagination: PaginationParams = { page, pageSize };
    const filters = { agentType, status };

    if (userId) {
      const result = await service.getSessionsByUser(userId, filters, pagination);
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      return c.json(result.data);
    }

    if (customerId) {
      const result = await service.getSessionsByCustomer(customerId, filters, pagination);
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      return c.json(result.data);
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
 * GET /active - Get all active sessions
 */
app.get('/active', async (c) => {
  try {
    const result = await service.getActiveSessions();
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    return c.json({ data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /timed-out - Get timed out sessions
 */
app.get('/timed-out', async (c) => {
  try {
    const result = await service.getTimedOutSessions();
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    return c.json({ data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:id - Get session by ID
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id') as AgentSessionId;
    const result = await service.getSession(id);

    if (!result.success) {
      if (result.error?.code === 'SESSION_NOT_FOUND') {
        return c.json({ error: 'Session not found' }, 404);
      }
      return c.json({ error: result.error }, 500);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST / - Create a new session
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json<CreateSessionInput>();

    const result = await service.createSession(body);
    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

/**
 * PUT /:id/status - Update session status
 */
app.put('/:id/status', async (c) => {
  try {
    const id = c.req.param('id') as AgentSessionId;
    const body = await c.req.json<{ status: AgentSessionStatus }>();

    if (!body.status) {
      return c.json({ error: 'Status is required' }, 400);
    }

    const result = await service.updateSessionStatus({
      sessionId: id,
      status: body.status,
    });

    if (!result.success) {
      if (result.error?.code === 'SESSION_NOT_FOUND') {
        return c.json({ error: 'Session not found' }, 404);
      }
      if (result.error?.code === 'INVALID_SESSION_STATUS_TRANSITION') {
        return c.json({ error: result.error.message }, 400);
      }
      return c.json({ error: result.error }, 500);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/complete - Complete a session
 */
app.post('/:id/complete', async (c) => {
  try {
    const id = c.req.param('id') as AgentSessionId;
    const body = await c.req.json<{
      summary?: string;
      data?: Record<string, unknown>;
      tokensUsed?: number;
      durationMs?: number;
    }>();

    const result = await service.completeSession(id, {
      summary: body.summary || 'Session completed',
      data: body.data || {},
      tokensUsed: body.tokensUsed || 0,
      durationMs: body.durationMs || 0,
    } as any);

    if (!result.success) {
      if (result.error?.code === 'SESSION_NOT_FOUND') {
        return c.json({ error: 'Session not found' }, 404);
      }
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/fail - Fail a session
 */
app.post('/:id/fail', async (c) => {
  try {
    const id = c.req.param('id') as AgentSessionId;
    const body = await c.req.json<{
      code: string;
      message: string;
      details?: Record<string, unknown>;
      retryable?: boolean;
    }>();

    if (!body.code || !body.message) {
      return c.json({ error: 'Error code and message are required' }, 400);
    }

    const result = await service.failSession(id, {
      code: body.code as AgentErrorCode,
      message: body.message,
      details: body.details,
      retryable: body.retryable || false,
      occurredAt: new Date().toISOString() as ISOTimestamp,
    });

    if (!result.success) {
      if (result.error?.code === 'SESSION_NOT_FOUND') {
        return c.json({ error: 'Session not found' }, 404);
      }
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/cancel - Cancel a session
 */
app.post('/:id/cancel', async (c) => {
  try {
    const id = c.req.param('id') as AgentSessionId;
    const body = await c.req.json<{ reason: string }>();

    if (!body.reason) {
      return c.json({ error: 'Cancellation reason is required' }, 400);
    }

    const result = await service.cancelSession(id, body.reason);

    if (!result.success) {
      if (result.error?.code === 'SESSION_NOT_FOUND') {
        return c.json({ error: 'Session not found' }, 404);
      }
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// AGENT INVOCATION ENDPOINTS
// =============================================================================

/**
 * POST /:id/invoke - Invoke the agent
 */
app.post('/:id/invoke', async (c) => {
  try {
    const id = c.req.param('id') as AgentSessionId;
    const body = await c.req.json<AgentInvocationInput>();

    const result = await service.invokeAgent(id, body);

    if (!result.success) {
      if (result.error?.code === 'SESSION_NOT_FOUND') {
        return c.json({ error: 'Session not found' }, 404);
      }
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/tool-calls - Record a tool call
 */
app.post('/:id/tool-calls', async (c) => {
  try {
    const id = c.req.param('id') as AgentSessionId;
    const body = await c.req.json<{
      toolName: string;
      toolInput: Record<string, unknown>;
      invocationId?: string;
    }>();

    if (!body.toolName) {
      return c.json({ error: 'Tool name is required' }, 400);
    }

    const result = await service.recordToolCall(id, {
      toolName: body.toolName,
      input: body.toolInput || {},
      status: 'pending' as ToolCallStatus,
      startedAt: new Date().toISOString() as ISOTimestamp,
      retryCount: 0,
    });

    if (!result.success) {
      if (result.error?.code === 'SESSION_NOT_FOUND') {
        return c.json({ error: 'Session not found' }, 404);
      }
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * PUT /tool-calls/:toolCallId - Update tool call result
 */
app.put('/tool-calls/:toolCallId', async (c) => {
  try {
    const toolCallId = c.req.param('toolCallId') as ToolCallId;
    const body = await c.req.json<{
      output: Record<string, unknown>;
      status: ToolCallStatus;
      error?: string;
      durationMs: number;
    }>();

    if (!body.status || body.durationMs === undefined) {
      return c.json({ error: 'Status and duration are required' }, 400);
    }

    const result = await service.updateToolCallResult(toolCallId, {
      output: body.output || {},
      status: body.status,
      error: body.error,
      durationMs: body.durationMs,
    });

    if (!result.success) {
      if (result.error?.code === 'TOOL_NOT_FOUND') {
        return c.json({ error: 'Tool call not found' }, 404);
      }
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// WORKFLOW MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * GET /workflows - List all active workflows
 */
app.get('/workflows', async (c) => {
  try {
    const result = await service.listWorkflows();
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    return c.json({ data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /workflows/:id - Get workflow by ID
 */
app.get('/workflows/:id', async (c) => {
  try {
    const id = c.req.param('id') as WorkflowId;
    const result = await service.getWorkflow(id);

    if (!result.success) {
      if (result.error?.code === 'WORKFLOW_NOT_FOUND') {
        return c.json({ error: 'Workflow not found' }, 404);
      }
      return c.json({ error: result.error }, 500);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /workflows/start - Start a workflow execution
 */
app.post('/workflows/start', async (c) => {
  try {
    const body = await c.req.json<StartWorkflowInput>();

    const result = await service.startWorkflow(body);
    if (!result.success) {
      if (result.error?.code === 'WORKFLOW_NOT_FOUND') {
        return c.json({ error: 'Workflow not found' }, 404);
      }
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /executions/:id - Get workflow execution status
 */
app.get('/executions/:id', async (c) => {
  try {
    const id = c.req.param('id') as WorkflowExecutionId;
    const result = await service.getWorkflowStatus(id);

    if (!result.success) {
      if (result.error?.code === 'WORKFLOW_EXECUTION_NOT_FOUND') {
        return c.json({ error: 'Workflow execution not found' }, 404);
      }
      return c.json({ error: result.error }, 500);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /executions - Query workflow executions
 */
app.get('/executions', async (c) => {
  try {
    const userId = c.req.query('userId') as UserId | undefined;
    const customerId = c.req.query('customerId') as CustomerId | undefined;
    const workflowId = c.req.query('workflowId') as WorkflowId | undefined;
    const status = c.req.query('status') as WorkflowExecutionStatus | undefined;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

    const pagination: PaginationParams = { page, pageSize };
    const filters = { userId, customerId, workflowId, status };

    const result = await service.queryWorkflowExecutions(filters, pagination);
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /executions/:id/advance - Advance workflow to next step
 */
app.post('/executions/:id/advance', async (c) => {
  try {
    const id = c.req.param('id') as WorkflowExecutionId;
    const body = await c.req.json<{
      userInput?: Record<string, unknown>;
      skipCurrentStep?: boolean;
    }>();

    const result = await service.advanceWorkflow({
      executionId: id,
      userInput: body.userInput,
      skipCurrentStep: body.skipCurrentStep,
    });

    if (!result.success) {
      if (result.error?.code === 'WORKFLOW_EXECUTION_NOT_FOUND') {
        return c.json({ error: 'Workflow execution not found' }, 404);
      }
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /executions/:id/pause - Pause workflow execution
 */
app.post('/executions/:id/pause', async (c) => {
  try {
    const id = c.req.param('id') as WorkflowExecutionId;
    const body = await c.req.json<{ reason: string }>();

    if (!body.reason) {
      return c.json({ error: 'Pause reason is required' }, 400);
    }

    const result = await service.pauseWorkflow(id, body.reason);

    if (!result.success) {
      if (result.error?.code === 'WORKFLOW_EXECUTION_NOT_FOUND') {
        return c.json({ error: 'Workflow execution not found' }, 404);
      }
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /executions/:id/resume - Resume paused workflow
 */
app.post('/executions/:id/resume', async (c) => {
  try {
    const id = c.req.param('id') as WorkflowExecutionId;

    const result = await service.resumeWorkflow(id);

    if (!result.success) {
      if (result.error?.code === 'WORKFLOW_EXECUTION_NOT_FOUND') {
        return c.json({ error: 'Workflow execution not found' }, 404);
      }
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /executions/:id/cancel - Cancel workflow execution
 */
app.post('/executions/:id/cancel', async (c) => {
  try {
    const id = c.req.param('id') as WorkflowExecutionId;
    const body = await c.req.json<{ reason: string }>();

    if (!body.reason) {
      return c.json({ error: 'Cancellation reason is required' }, 400);
    }

    const result = await service.cancelWorkflow(id, body.reason);

    if (!result.success) {
      if (result.error?.code === 'WORKFLOW_EXECUTION_NOT_FOUND') {
        return c.json({ error: 'Workflow execution not found' }, 404);
      }
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /executions/:id/retry - Retry failed workflow
 */
app.post('/executions/:id/retry', async (c) => {
  try {
    const id = c.req.param('id') as WorkflowExecutionId;

    const result = await service.retryWorkflow(id);

    if (!result.success) {
      if (result.error?.code === 'WORKFLOW_EXECUTION_NOT_FOUND') {
        return c.json({ error: 'Workflow execution not found' }, 404);
      }
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// METRICS ENDPOINTS
// =============================================================================

/**
 * GET /metrics - Get agent metrics
 */
app.get('/metrics', async (c) => {
  try {
    const userId = c.req.query('userId') as UserId | undefined;
    const customerId = c.req.query('customerId') as CustomerId | undefined;
    const agentType = c.req.query('agentType') as AgentType | undefined;
    const startDateStr = c.req.query('startDate');
    const endDateStr = c.req.query('endDate');

    // Default to last 24 hours if no date range provided
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startDate = (startDateStr || yesterday.toISOString()) as ISOTimestamp;
    const endDate = (endDateStr || now.toISOString()) as ISOTimestamp;

    const filters: MetricsQueryFilters = {
      userId,
      customerId,
      agentType,
      dateRange: { startDate, endDate },
    };

    const result = await service.getAgentMetrics(filters);
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /metrics/latency - Get latency metrics
 */
app.get('/metrics/latency', async (c) => {
  try {
    const agentType = c.req.query('agentType') as AgentType | undefined;
    const startDateStr = c.req.query('startDate');
    const endDateStr = c.req.query('endDate');

    // Default to last 24 hours if no date range provided
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startDate = (startDateStr || yesterday.toISOString()) as ISOTimestamp;
    const endDate = (endDateStr || now.toISOString()) as ISOTimestamp;

    const result = await service.getAverageLatency(
      agentType,
      { startDate, endDate }
    );

    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /metrics/success-rate - Get success rate metrics
 */
app.get('/metrics/success-rate', async (c) => {
  try {
    const agentType = c.req.query('agentType') as AgentType | undefined;
    const startDateStr = c.req.query('startDate');
    const endDateStr = c.req.query('endDate');

    // Default to last 24 hours if no date range provided
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startDate = (startDateStr || yesterday.toISOString()) as ISOTimestamp;
    const endDate = (endDateStr || now.toISOString()) as ISOTimestamp;

    const result = await service.getSuccessRate(
      agentType,
      { startDate, endDate }
    );

    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /metrics/tokens - Get token usage metrics
 */
app.get('/metrics/tokens', async (c) => {
  try {
    const userId = c.req.query('userId') as UserId | undefined;
    const customerId = c.req.query('customerId') as CustomerId | undefined;
    const agentType = c.req.query('agentType') as AgentType | undefined;
    const startDateStr = c.req.query('startDate');
    const endDateStr = c.req.query('endDate');

    // Default to last 24 hours if no date range provided
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startDate = (startDateStr || yesterday.toISOString()) as ISOTimestamp;
    const endDate = (endDateStr || now.toISOString()) as ISOTimestamp;

    const filters: MetricsQueryFilters = {
      userId,
      customerId,
      agentType,
      dateRange: { startDate, endDate },
    };

    const result = await service.getTokenUsage(filters);
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    return c.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export default app;
