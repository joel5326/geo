/**
 * Agent Orchestration Repository Implementations
 *
 * In-memory repository implementations for the Agent Orchestration domain.
 * These provide data persistence for agent sessions, workflows, and invocations.
 *
 * @module agent-orchestration/repository
 * @version 1.0.0
 */

import {
  UserId,
  CustomerId,
  AgentSessionId,
  ISOTimestamp,
  PaginatedResponse,
  PaginationParams,
} from '../shared/shared.types';

import {
  AgentSession,
  AgentWorkflow,
  WorkflowExecution,
  AgentInvocation,
  AgentToolCallRecord,
  WorkflowStepExecution,
  WorkflowId,
  WorkflowExecutionId,
  ToolCallId,
  InvocationId,
  AgentSessionStatus,
  WorkflowExecutionStatus,
  SessionQueryFilters,
  WorkflowQueryFilters,
  MetricsQueryFilters,
  IAgentSessionRepository,
  IAgentWorkflowRepository,
  IWorkflowExecutionRepository,
  IAgentInvocationRepository,
} from '../domains/agent-orchestration/agent-orchestration.types';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Gets the current timestamp in ISO format.
 */
function now(): ISOTimestamp {
  return new Date().toISOString();
}

/**
 * Applies pagination to an array of items.
 */
function paginate<T>(
  items: T[],
  pagination?: PaginationParams
): PaginatedResponse<T> {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const data = items.slice(startIndex, endIndex);

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

// =============================================================================
// IN-MEMORY AGENT SESSION REPOSITORY
// =============================================================================

/**
 * In-memory implementation of the Agent Session Repository.
 * Stores sessions and tool calls in Maps for efficient lookup.
 */
export class InMemoryAgentSessionRepository implements IAgentSessionRepository {
  private sessions: Map<AgentSessionId, AgentSession> = new Map();
  private toolCalls: Map<ToolCallId, AgentToolCallRecord> = new Map();

  async create(session: Omit<AgentSession, 'id'>): Promise<AgentSession> {
    const id = `sess_${crypto.randomUUID()}` as AgentSessionId;
    const newSession: AgentSession = {
      ...session,
      id,
    };
    this.sessions.set(id, newSession);
    return newSession;
  }

  async findById(id: AgentSessionId): Promise<AgentSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async update(
    id: AgentSessionId,
    updates: Partial<AgentSession>
  ): Promise<AgentSession> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }
    const updatedSession: AgentSession = {
      ...session,
      ...updates,
      id, // Ensure ID cannot be changed
      audit: {
        ...session.audit,
        updatedAt: now(),
        updatedBy: updates.audit?.updatedBy ?? session.audit.updatedBy,
      },
    };
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }

  async delete(id: AgentSessionId): Promise<boolean> {
    return this.sessions.delete(id);
  }

  async findByFilters(
    filters: SessionQueryFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<AgentSession>> {
    let sessions = Array.from(this.sessions.values());

    // Apply filters
    if (filters.userId) {
      sessions = sessions.filter((s) => s.userId === filters.userId);
    }
    if (filters.customerId) {
      sessions = sessions.filter((s) => s.customerId === filters.customerId);
    }
    if (filters.agentType) {
      sessions = sessions.filter((s) => s.agentType === filters.agentType);
    }
    if (filters.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      sessions = sessions.filter((s) => statuses.includes(s.status));
    }
    if (filters.workflowExecutionId) {
      sessions = sessions.filter(
        (s) => s.workflowExecutionId === filters.workflowExecutionId
      );
    }
    if (filters.dateRange) {
      sessions = sessions.filter((s) => {
        const startedAt = new Date(s.startedAt).getTime();
        const start = new Date(filters.dateRange!.startDate).getTime();
        const end = new Date(filters.dateRange!.endDate).getTime();
        return startedAt >= start && startedAt <= end;
      });
    }
    if (filters.activeOnly) {
      sessions = sessions.filter(
        (s) =>
          s.status === 'active' ||
          s.status === 'awaiting_input' ||
          s.status === 'processing'
      );
    }

    // Sort by startedAt descending
    sessions.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    return paginate(sessions, pagination);
  }

  async findActive(): Promise<AgentSession[]> {
    return Array.from(this.sessions.values()).filter(
      (s) =>
        s.status === 'active' ||
        s.status === 'awaiting_input' ||
        s.status === 'processing'
    );
  }

  async findTimedOut(): Promise<AgentSession[]> {
    const currentTime = Date.now();
    return Array.from(this.sessions.values()).filter((s) => {
      const isActive =
        s.status === 'active' ||
        s.status === 'awaiting_input' ||
        s.status === 'processing';
      const timeoutAt = new Date(s.timeoutAt).getTime();
      return isActive && currentTime > timeoutAt;
    });
  }

  async count(filters?: SessionQueryFilters): Promise<number> {
    if (!filters) {
      return this.sessions.size;
    }
    const result = await this.findByFilters(filters);
    return result.pagination.totalItems;
  }

  async addToolCall(
    sessionId: AgentSessionId,
    toolCall: Omit<AgentToolCallRecord, 'id'>
  ): Promise<AgentToolCallRecord> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const id = `tc_${crypto.randomUUID()}` as ToolCallId;
    const newToolCall: AgentToolCallRecord = {
      ...toolCall,
      id,
    };

    this.toolCalls.set(id, newToolCall);

    // Update session with new tool call
    const updatedToolCalls = [...session.toolCalls, newToolCall];
    await this.update(sessionId, { toolCalls: updatedToolCalls });

    return newToolCall;
  }

  async updateToolCall(
    toolCallId: ToolCallId,
    updates: Partial<AgentToolCallRecord>
  ): Promise<AgentToolCallRecord> {
    const toolCall = this.toolCalls.get(toolCallId);
    if (!toolCall) {
      throw new Error(`Tool call not found: ${toolCallId}`);
    }

    const updatedToolCall: AgentToolCallRecord = {
      ...toolCall,
      ...updates,
      id: toolCallId, // Ensure ID cannot be changed
    };

    this.toolCalls.set(toolCallId, updatedToolCall);

    // Update session's tool calls array
    const session = this.sessions.get(toolCall.sessionId);
    if (session) {
      const updatedToolCalls = session.toolCalls.map((tc) =>
        tc.id === toolCallId ? updatedToolCall : tc
      );
      await this.update(toolCall.sessionId, { toolCalls: updatedToolCalls });
    }

    return updatedToolCall;
  }

  async getToolCalls(sessionId: AgentSessionId): Promise<AgentToolCallRecord[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return [...session.toolCalls].sort(
      (a, b) => a.sequenceNumber - b.sequenceNumber
    );
  }

  /**
   * Clears all sessions (useful for testing).
   */
  clear(): void {
    this.sessions.clear();
    this.toolCalls.clear();
  }
}

// =============================================================================
// IN-MEMORY WORKFLOW REPOSITORY
// =============================================================================

/**
 * In-memory implementation of the Agent Workflow Repository.
 * Stores workflow templates in a Map.
 */
export class InMemoryAgentWorkflowRepository
  implements IAgentWorkflowRepository
{
  private workflows: Map<WorkflowId, AgentWorkflow> = new Map();

  async findById(id: WorkflowId): Promise<AgentWorkflow | null> {
    return this.workflows.get(id) ?? null;
  }

  async findAllActive(): Promise<AgentWorkflow[]> {
    return Array.from(this.workflows.values()).filter((w) => w.isActive);
  }

  async create(workflow: Omit<AgentWorkflow, 'id'>): Promise<AgentWorkflow> {
    const id = `wf_${crypto.randomUUID()}` as WorkflowId;
    const newWorkflow: AgentWorkflow = {
      ...workflow,
      id,
    };
    this.workflows.set(id, newWorkflow);
    return newWorkflow;
  }

  async update(
    id: WorkflowId,
    updates: Partial<AgentWorkflow>
  ): Promise<AgentWorkflow> {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      throw new Error(`Workflow not found: ${id}`);
    }
    const updatedWorkflow: AgentWorkflow = {
      ...workflow,
      ...updates,
      id, // Ensure ID cannot be changed
      audit: {
        ...workflow.audit,
        updatedAt: now(),
        updatedBy: updates.audit?.updatedBy ?? workflow.audit.updatedBy,
      },
    };
    this.workflows.set(id, updatedWorkflow);
    return updatedWorkflow;
  }

  async deactivate(id: WorkflowId): Promise<boolean> {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      return false;
    }
    await this.update(id, { isActive: false });
    return true;
  }

  /**
   * Seeds the repository with default workflows (useful for initialization).
   */
  seed(workflows: AgentWorkflow[]): void {
    for (const workflow of workflows) {
      this.workflows.set(workflow.id, workflow);
    }
  }

  /**
   * Clears all workflows (useful for testing).
   */
  clear(): void {
    this.workflows.clear();
  }
}

// =============================================================================
// IN-MEMORY WORKFLOW EXECUTION REPOSITORY
// =============================================================================

/**
 * In-memory implementation of the Workflow Execution Repository.
 * Stores workflow executions in a Map.
 */
export class InMemoryWorkflowExecutionRepository
  implements IWorkflowExecutionRepository
{
  private executions: Map<WorkflowExecutionId, WorkflowExecution> = new Map();

  async create(
    execution: Omit<WorkflowExecution, 'id'>
  ): Promise<WorkflowExecution> {
    const id = `wfx_${crypto.randomUUID()}` as WorkflowExecutionId;
    const newExecution: WorkflowExecution = {
      ...execution,
      id,
    };
    this.executions.set(id, newExecution);
    return newExecution;
  }

  async findById(id: WorkflowExecutionId): Promise<WorkflowExecution | null> {
    return this.executions.get(id) ?? null;
  }

  async update(
    id: WorkflowExecutionId,
    updates: Partial<WorkflowExecution>
  ): Promise<WorkflowExecution> {
    const execution = this.executions.get(id);
    if (!execution) {
      throw new Error(`Workflow execution not found: ${id}`);
    }
    const updatedExecution: WorkflowExecution = {
      ...execution,
      ...updates,
      id, // Ensure ID cannot be changed
      audit: {
        ...execution.audit,
        updatedAt: now(),
        updatedBy: updates.audit?.updatedBy ?? execution.audit.updatedBy,
      },
    };
    this.executions.set(id, updatedExecution);
    return updatedExecution;
  }

  async findByFilters(
    filters: WorkflowQueryFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<WorkflowExecution>> {
    let executions = Array.from(this.executions.values());

    // Apply filters
    if (filters.userId) {
      executions = executions.filter((e) => e.userId === filters.userId);
    }
    if (filters.customerId) {
      executions = executions.filter(
        (e) => e.customerId === filters.customerId
      );
    }
    if (filters.workflowId) {
      executions = executions.filter(
        (e) => e.workflowId === filters.workflowId
      );
    }
    if (filters.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      executions = executions.filter((e) => statuses.includes(e.status));
    }
    if (filters.dateRange) {
      executions = executions.filter((e) => {
        const startedAt = new Date(e.startedAt).getTime();
        const start = new Date(filters.dateRange!.startDate).getTime();
        const end = new Date(filters.dateRange!.endDate).getTime();
        return startedAt >= start && startedAt <= end;
      });
    }

    // Sort by startedAt descending
    executions.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    return paginate(executions, pagination);
  }

  async findTimedOut(): Promise<WorkflowExecution[]> {
    const currentTime = Date.now();
    return Array.from(this.executions.values()).filter((e) => {
      const isRunning = e.status === 'running' || e.status === 'pending';
      const timeoutAt = new Date(e.timeoutAt).getTime();
      return isRunning && currentTime > timeoutAt;
    });
  }

  async updateStep(
    executionId: WorkflowExecutionId,
    stepNumber: number,
    updates: Partial<WorkflowStepExecution>
  ): Promise<WorkflowExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Workflow execution not found: ${executionId}`);
    }

    const updatedSteps = execution.steps.map((step) =>
      step.stepNumber === stepNumber ? { ...step, ...updates } : step
    );

    return this.update(executionId, { steps: updatedSteps });
  }

  /**
   * Clears all executions (useful for testing).
   */
  clear(): void {
    this.executions.clear();
  }
}

// =============================================================================
// IN-MEMORY AGENT INVOCATION REPOSITORY
// =============================================================================

/**
 * In-memory implementation of the Agent Invocation Repository.
 * Stores invocations for tracking and metrics.
 */
export class InMemoryAgentInvocationRepository
  implements IAgentInvocationRepository
{
  private invocations: Map<InvocationId, AgentInvocation> = new Map();

  async create(
    invocation: Omit<AgentInvocation, 'id'>
  ): Promise<AgentInvocation> {
    const id = `inv_${crypto.randomUUID()}` as InvocationId;
    const newInvocation: AgentInvocation = {
      ...invocation,
      id,
    };
    this.invocations.set(id, newInvocation);
    return newInvocation;
  }

  async findBySession(sessionId: AgentSessionId): Promise<AgentInvocation[]> {
    return Array.from(this.invocations.values())
      .filter((inv) => inv.sessionId === sessionId)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  async getMetrics(filters: MetricsQueryFilters): Promise<{
    totalInvocations: number;
    totalTokens: number;
    averageLatencyMs: number;
    successRate: number;
  }> {
    let invocations = Array.from(this.invocations.values());

    // Apply date range filter
    if (filters.dateRange) {
      invocations = invocations.filter((inv) => {
        const startedAt = new Date(inv.startedAt).getTime();
        const start = new Date(filters.dateRange.startDate).getTime();
        const end = new Date(filters.dateRange.endDate).getTime();
        return startedAt >= start && startedAt <= end;
      });
    }

    const totalInvocations = invocations.length;
    const totalTokens = invocations.reduce(
      (sum, inv) => sum + inv.totalTokens,
      0
    );
    const totalLatency = invocations.reduce(
      (sum, inv) => sum + inv.latencyMs,
      0
    );
    const successfulInvocations = invocations.filter((inv) => inv.success).length;

    return {
      totalInvocations,
      totalTokens,
      averageLatencyMs:
        totalInvocations > 0 ? totalLatency / totalInvocations : 0,
      successRate:
        totalInvocations > 0 ? successfulInvocations / totalInvocations : 0,
    };
  }

  /**
   * Clears all invocations (useful for testing).
   */
  clear(): void {
    this.invocations.clear();
  }
}
