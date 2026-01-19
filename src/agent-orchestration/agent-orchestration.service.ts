/**
 * Agent Orchestration Service Implementation
 *
 * Service class implementing IAgentOrchestrationService for managing
 * Claude agent sessions, workflows, and invocations.
 *
 * @module agent-orchestration/service
 * @version 1.0.0
 */

import {
  UserId,
  CustomerId,
  AgentSessionId,
  ISOTimestamp,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  AuditInfo,
  UserRef,
  SESSION_TIMEOUT_MS,
  ContentTone,
} from '../shared/shared.types';

import {
  AgentSession,
  AgentWorkflow,
  WorkflowExecution,
  AgentInvocation,
  AgentToolCallRecord,
  AgentSessionResult,
  AgentSessionError,
  AgentContext,
  AgentInvocationInput,
  AgentInvocationOutput,
  WorkflowId,
  WorkflowExecutionId,
  ToolCallId,
  InvocationId,
  AgentType,
  AgentSessionStatus,
  WorkflowExecutionStatus,
  ToolCallStatus,
  WorkflowStepStatus,
  ClaudeModel,
  CreateSessionInput,
  StartWorkflowInput,
  AdvanceWorkflowInput,
  UpdateSessionStatusInput,
  SessionQueryFilters,
  WorkflowQueryFilters,
  MetricsQueryFilters,
  AgentMetrics,
  TokenUsageMetrics,
  IAgentOrchestrationService,
  IAgentSessionRepository,
  IAgentWorkflowRepository,
  IWorkflowExecutionRepository,
  IAgentInvocationRepository,
  WorkflowStepExecution,
  BrandGuidelinesContext,
  ConversationMessage,
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
 * Generates a unique request ID for API responses.
 */
function generateRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}

/**
 * Creates a successful API response.
 */
function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    requestId: generateRequestId(),
    timestamp: now(),
  };
}

/**
 * Creates an error API response.
 */
function errorResponse<T>(
  code: string,
  message: string,
  retryable: boolean = false
): ApiResponse<T> {
  return {
    success: false,
    error: {
      code,
      message,
      retryable,
    },
    requestId: generateRequestId(),
    timestamp: now(),
  };
}

/**
 * Creates a default brand guidelines context.
 */
function createDefaultBrandGuidelines(): BrandGuidelinesContext {
  return {
    companyName: '',
    productDescription: '',
    voiceTone: ContentTone.professional,
    keywords: [],
    avoidTopics: [],
    websiteUrl: '',
  };
}

/**
 * Creates a default agent context.
 */
function createDefaultContext(
  userId: UserId,
  customerId: CustomerId,
  partial?: Partial<AgentContext>
): AgentContext {
  return {
    userId,
    customerId,
    brandGuidelines: partial?.brandGuidelines ?? createDefaultBrandGuidelines(),
    conversationHistory: partial?.conversationHistory ?? [],
    variables: partial?.variables ?? {},
    ...partial,
  };
}

/**
 * Creates a default audit info with a system user.
 */
function createSystemAudit(): AuditInfo {
  const systemUser: UserRef = {
    id: 'usr_system' as UserId,
    email: 'system@geo.internal',
    displayName: 'System',
  };
  const timestamp = now();
  return {
    createdAt: timestamp,
    createdBy: systemUser,
    updatedAt: timestamp,
    updatedBy: systemUser,
  };
}

/**
 * Validates session status transitions.
 */
function isValidStatusTransition(
  current: AgentSessionStatus,
  next: AgentSessionStatus
): boolean {
  const validTransitions: Record<AgentSessionStatus, AgentSessionStatus[]> = {
    active: ['awaiting_input', 'processing', 'completed', 'failed', 'timeout'],
    awaiting_input: ['active', 'processing', 'completed', 'failed', 'timeout'],
    processing: ['active', 'awaiting_input', 'completed', 'failed', 'timeout'],
    completed: [], // Terminal state
    failed: [], // Terminal state
    timeout: [], // Terminal state
  };
  return validTransitions[current]?.includes(next) ?? false;
}

/**
 * Validates workflow execution status transitions.
 */
function isValidWorkflowTransition(
  current: WorkflowExecutionStatus,
  next: WorkflowExecutionStatus
): boolean {
  const validTransitions: Record<WorkflowExecutionStatus, WorkflowExecutionStatus[]> = {
    pending: ['running', 'cancelled'],
    running: ['paused', 'completed', 'failed', 'cancelled', 'timeout'],
    paused: ['running', 'cancelled'],
    completed: [], // Terminal state
    failed: ['running'], // Can retry
    cancelled: [], // Terminal state
    timeout: [], // Terminal state
  };
  return validTransitions[current]?.includes(next) ?? false;
}

// =============================================================================
// AGENT ORCHESTRATION SERVICE
// =============================================================================

/**
 * Main service implementation for the Agent Orchestration domain.
 * Manages agent sessions, workflows, and invocations.
 */
export class AgentOrchestrationService implements IAgentOrchestrationService {
  constructor(
    private sessionRepository: IAgentSessionRepository,
    private workflowRepository: IAgentWorkflowRepository,
    private executionRepository: IWorkflowExecutionRepository,
    private invocationRepository: IAgentInvocationRepository
  ) {}

  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================

  async createSession(
    input: CreateSessionInput
  ): Promise<ApiResponse<AgentSession>> {
    const timestamp = now();
    const timeoutMs = input.timeoutMs ?? SESSION_TIMEOUT_MS;
    const timeoutAt = new Date(Date.now() + timeoutMs).toISOString();

    const context = createDefaultContext(
      input.userId,
      input.customerId,
      input.initialContext
    );

    const session = await this.sessionRepository.create({
      agentType: input.agentType,
      userId: input.userId,
      customerId: input.customerId,
      status: 'active',
      startedAt: timestamp,
      context,
      toolCalls: [],
      workflowExecutionId: input.workflowExecutionId,
      workflowStepNumber: input.workflowStepNumber,
      timeoutAt,
      metadata: input.metadata ?? {},
      audit: createSystemAudit(),
    });

    return successResponse(session);
  }

  async getSession(
    sessionId: AgentSessionId
  ): Promise<ApiResponse<AgentSession>> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return errorResponse('SESSION_NOT_FOUND', `Session not found: ${sessionId}`);
    }
    return successResponse(session);
  }

  async updateSessionStatus(
    input: UpdateSessionStatusInput
  ): Promise<ApiResponse<AgentSession>> {
    const session = await this.sessionRepository.findById(input.sessionId);
    if (!session) {
      return errorResponse(
        'SESSION_NOT_FOUND',
        `Session not found: ${input.sessionId}`
      );
    }

    if (!isValidStatusTransition(session.status, input.status)) {
      return errorResponse(
        'INVALID_SESSION_STATUS_TRANSITION',
        `Cannot transition from ${session.status} to ${input.status}`
      );
    }

    const updates: Partial<AgentSession> = {
      status: input.status,
    };

    if (
      input.status === 'completed' ||
      input.status === 'failed' ||
      input.status === 'timeout'
    ) {
      updates.completedAt = now();
    }

    const updatedSession = await this.sessionRepository.update(
      input.sessionId,
      updates
    );
    return successResponse(updatedSession);
  }

  async completeSession(
    sessionId: AgentSessionId,
    result: AgentSessionResult
  ): Promise<ApiResponse<AgentSession>> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return errorResponse('SESSION_NOT_FOUND', `Session not found: ${sessionId}`);
    }

    if (session.status === 'completed') {
      return errorResponse(
        'SESSION_ALREADY_COMPLETED',
        'Session has already been completed'
      );
    }

    if (session.status === 'failed') {
      return errorResponse(
        'SESSION_ALREADY_FAILED',
        'Session has already failed'
      );
    }

    const updatedSession = await this.sessionRepository.update(sessionId, {
      status: 'completed',
      completedAt: now(),
      result,
    });

    return successResponse(updatedSession);
  }

  async failSession(
    sessionId: AgentSessionId,
    error: AgentSessionError
  ): Promise<ApiResponse<AgentSession>> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return errorResponse('SESSION_NOT_FOUND', `Session not found: ${sessionId}`);
    }

    if (session.status === 'completed') {
      return errorResponse(
        'SESSION_ALREADY_COMPLETED',
        'Session has already been completed'
      );
    }

    if (session.status === 'failed') {
      return errorResponse(
        'SESSION_ALREADY_FAILED',
        'Session has already failed'
      );
    }

    const updatedSession = await this.sessionRepository.update(sessionId, {
      status: 'failed',
      completedAt: now(),
      error,
    });

    return successResponse(updatedSession);
  }

  async cancelSession(
    sessionId: AgentSessionId,
    reason: string
  ): Promise<ApiResponse<AgentSession>> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return errorResponse('SESSION_NOT_FOUND', `Session not found: ${sessionId}`);
    }

    if (
      session.status === 'completed' ||
      session.status === 'failed' ||
      session.status === 'timeout'
    ) {
      return errorResponse(
        'SESSION_CANCELLED',
        'Cannot cancel a session that has already ended'
      );
    }

    const updatedSession = await this.sessionRepository.update(sessionId, {
      status: 'failed',
      completedAt: now(),
      error: {
        code: 'SESSION_CANCELLED',
        message: `Session cancelled: ${reason}`,
        retryable: false,
        occurredAt: now(),
      },
    });

    return successResponse(updatedSession);
  }

  // ===========================================================================
  // AGENT INVOCATION
  // ===========================================================================

  async invokeAgent(
    sessionId: AgentSessionId,
    input: AgentInvocationInput
  ): Promise<ApiResponse<AgentInvocation>> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return errorResponse('SESSION_NOT_FOUND', `Session not found: ${sessionId}`);
    }

    if (
      session.status !== 'active' &&
      session.status !== 'processing' &&
      session.status !== 'awaiting_input'
    ) {
      return errorResponse(
        'INVALID_SESSION_STATUS_TRANSITION',
        `Cannot invoke agent on session with status: ${session.status}`
      );
    }

    // Update session to processing status
    await this.sessionRepository.update(sessionId, { status: 'processing' });

    const startedAt = now();
    const existingInvocations = await this.invocationRepository.findBySession(
      sessionId
    );
    const sequenceNumber = existingInvocations.length + 1;

    // Stub Claude API call - in production this would call the actual API
    // For now, we simulate a response
    const simulatedLatencyMs = Math.floor(Math.random() * 500) + 100;
    const simulatedInputTokens = Math.floor(Math.random() * 1000) + 500;
    const simulatedOutputTokens = Math.floor(Math.random() * 500) + 100;

    const output: AgentInvocationOutput = {
      textResponse: 'This is a stubbed response from the Claude API.',
      stopReason: 'end_turn',
    };

    const invocation = await this.invocationRepository.create({
      sessionId,
      sequenceNumber,
      model: 'claude-sonnet-4-20250514' as ClaudeModel,
      input,
      output,
      inputTokens: simulatedInputTokens,
      outputTokens: simulatedOutputTokens,
      totalTokens: simulatedInputTokens + simulatedOutputTokens,
      latencyMs: simulatedLatencyMs,
      startedAt,
      completedAt: now(),
      success: true,
    });

    // Update session back to active
    await this.sessionRepository.update(sessionId, { status: 'active' });

    return successResponse(invocation);
  }

  async recordToolCall(
    sessionId: AgentSessionId,
    toolCall: Omit<AgentToolCallRecord, 'id' | 'sessionId' | 'sequenceNumber'>
  ): Promise<ApiResponse<AgentToolCallRecord>> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return errorResponse('SESSION_NOT_FOUND', `Session not found: ${sessionId}`);
    }

    const sequenceNumber = session.toolCalls.length + 1;

    const recordedToolCall = await this.sessionRepository.addToolCall(
      sessionId,
      {
        ...toolCall,
        sessionId,
        sequenceNumber,
      }
    );

    return successResponse(recordedToolCall);
  }

  async updateToolCallResult(
    toolCallId: ToolCallId,
    result: {
      output: Record<string, unknown>;
      status: ToolCallStatus;
      error?: string;
      durationMs: number;
    }
  ): Promise<ApiResponse<AgentToolCallRecord>> {
    try {
      const updatedToolCall = await this.sessionRepository.updateToolCall(
        toolCallId,
        {
          output: result.output,
          status: result.status,
          error: result.error,
          durationMs: result.durationMs,
          completedAt: now(),
        }
      );
      return successResponse(updatedToolCall);
    } catch (error) {
      return errorResponse(
        'TOOL_NOT_FOUND',
        `Tool call not found: ${toolCallId}`
      );
    }
  }

  // ===========================================================================
  // SESSION QUERIES
  // ===========================================================================

  async getSessionsByUser(
    userId: UserId,
    filters?: SessionQueryFilters,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<AgentSession>>> {
    const result = await this.sessionRepository.findByFilters(
      { ...filters, userId },
      pagination
    );
    return successResponse(result);
  }

  async getSessionsByCustomer(
    customerId: CustomerId,
    filters?: SessionQueryFilters,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<AgentSession>>> {
    const result = await this.sessionRepository.findByFilters(
      { ...filters, customerId },
      pagination
    );
    return successResponse(result);
  }

  async getActiveSessions(): Promise<ApiResponse<AgentSession[]>> {
    const sessions = await this.sessionRepository.findActive();
    return successResponse(sessions);
  }

  async getTimedOutSessions(): Promise<ApiResponse<AgentSession[]>> {
    const sessions = await this.sessionRepository.findTimedOut();
    return successResponse(sessions);
  }

  // ===========================================================================
  // WORKFLOW MANAGEMENT
  // ===========================================================================

  async getWorkflow(workflowId: WorkflowId): Promise<ApiResponse<AgentWorkflow>> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) {
      return errorResponse(
        'WORKFLOW_NOT_FOUND',
        `Workflow not found: ${workflowId}`
      );
    }
    return successResponse(workflow);
  }

  async listWorkflows(): Promise<ApiResponse<AgentWorkflow[]>> {
    const workflows = await this.workflowRepository.findAllActive();
    return successResponse(workflows);
  }

  async startWorkflow(
    input: StartWorkflowInput
  ): Promise<ApiResponse<WorkflowExecution>> {
    const workflow = await this.workflowRepository.findById(input.workflowId);
    if (!workflow) {
      return errorResponse(
        'WORKFLOW_NOT_FOUND',
        `Workflow not found: ${input.workflowId}`
      );
    }

    if (!workflow.isActive) {
      return errorResponse(
        'WORKFLOW_NOT_FOUND',
        `Workflow is not active: ${input.workflowId}`
      );
    }

    const timestamp = now();
    const timeoutMs = input.timeoutMs ?? workflow.defaultTimeoutMs;
    const timeoutAt = new Date(Date.now() + timeoutMs).toISOString();

    const context = createDefaultContext(
      input.userId,
      input.customerId,
      input.initialContext
    );

    // Initialize step executions
    const steps: WorkflowStepExecution[] = workflow.steps.map((step) => ({
      stepNumber: step.stepNumber,
      agentType: step.agentType,
      status: 'pending' as WorkflowStepStatus,
      retryCount: 0,
    }));

    const execution = await this.executionRepository.create({
      workflowId: input.workflowId,
      userId: input.userId,
      customerId: input.customerId,
      status: input.startImmediately ? 'running' : 'pending',
      currentStepNumber: 1,
      steps,
      context,
      startedAt: timestamp,
      timeoutAt,
      audit: createSystemAudit(),
    });

    // If starting immediately, mark the first step as in_progress
    if (input.startImmediately && steps.length > 0) {
      await this.executionRepository.updateStep(execution.id, 1, {
        status: 'in_progress',
        startedAt: timestamp,
      });
    }

    // Fetch the updated execution
    const updatedExecution = await this.executionRepository.findById(
      execution.id
    );

    return successResponse(updatedExecution!);
  }

  async getWorkflowStatus(
    executionId: WorkflowExecutionId
  ): Promise<ApiResponse<WorkflowExecution>> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      return errorResponse(
        'WORKFLOW_EXECUTION_NOT_FOUND',
        `Workflow execution not found: ${executionId}`
      );
    }
    return successResponse(execution);
  }

  async advanceWorkflow(
    input: AdvanceWorkflowInput
  ): Promise<ApiResponse<WorkflowExecution>> {
    const execution = await this.executionRepository.findById(input.executionId);
    if (!execution) {
      return errorResponse(
        'WORKFLOW_EXECUTION_NOT_FOUND',
        `Workflow execution not found: ${input.executionId}`
      );
    }

    if (execution.status !== 'running') {
      return errorResponse(
        'WORKFLOW_CANNOT_ADVANCE',
        `Cannot advance workflow in status: ${execution.status}`
      );
    }

    const workflow = await this.workflowRepository.findById(execution.workflowId);
    if (!workflow) {
      return errorResponse(
        'WORKFLOW_NOT_FOUND',
        `Workflow not found: ${execution.workflowId}`
      );
    }

    const currentStep = execution.steps.find(
      (s) => s.stepNumber === execution.currentStepNumber
    );

    if (!currentStep) {
      return errorResponse('WORKFLOW_INVALID_STEP', 'Current step not found');
    }

    const timestamp = now();

    // Handle skip current step
    if (input.skipCurrentStep) {
      await this.executionRepository.updateStep(
        input.executionId,
        execution.currentStepNumber,
        {
          status: 'skipped',
          completedAt: timestamp,
        }
      );
    } else {
      // Mark current step as completed
      await this.executionRepository.updateStep(
        input.executionId,
        execution.currentStepNumber,
        {
          status: 'completed',
          completedAt: timestamp,
          output: input.userInput,
        }
      );
    }

    // Check if there are more steps
    const nextStepNumber = execution.currentStepNumber + 1;
    const hasMoreSteps = nextStepNumber <= workflow.steps.length;

    if (hasMoreSteps) {
      // Advance to next step
      await this.executionRepository.update(input.executionId, {
        currentStepNumber: nextStepNumber,
      });

      await this.executionRepository.updateStep(
        input.executionId,
        nextStepNumber,
        {
          status: 'in_progress',
          startedAt: timestamp,
        }
      );
    } else {
      // Workflow completed
      await this.executionRepository.update(input.executionId, {
        status: 'completed',
        completedAt: timestamp,
        result: {
          success: true,
          totalDurationMs:
            Date.now() - new Date(execution.startedAt).getTime(),
          totalTokensUsed: 0, // Would be calculated from actual invocations
          summary: 'Workflow completed successfully',
        },
      });
    }

    const updatedExecution = await this.executionRepository.findById(
      input.executionId
    );
    return successResponse(updatedExecution!);
  }

  async pauseWorkflow(
    executionId: WorkflowExecutionId,
    reason: string
  ): Promise<ApiResponse<WorkflowExecution>> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      return errorResponse(
        'WORKFLOW_EXECUTION_NOT_FOUND',
        `Workflow execution not found: ${executionId}`
      );
    }

    if (!isValidWorkflowTransition(execution.status, 'paused')) {
      return errorResponse(
        'WORKFLOW_CANNOT_ADVANCE',
        `Cannot pause workflow in status: ${execution.status}`
      );
    }

    const updatedExecution = await this.executionRepository.update(executionId, {
      status: 'paused',
    });

    return successResponse(updatedExecution);
  }

  async resumeWorkflow(
    executionId: WorkflowExecutionId
  ): Promise<ApiResponse<WorkflowExecution>> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      return errorResponse(
        'WORKFLOW_EXECUTION_NOT_FOUND',
        `Workflow execution not found: ${executionId}`
      );
    }

    if (execution.status !== 'paused') {
      return errorResponse(
        'WORKFLOW_CANNOT_ADVANCE',
        `Cannot resume workflow in status: ${execution.status}`
      );
    }

    const updatedExecution = await this.executionRepository.update(executionId, {
      status: 'running',
    });

    return successResponse(updatedExecution);
  }

  async cancelWorkflow(
    executionId: WorkflowExecutionId,
    reason: string
  ): Promise<ApiResponse<WorkflowExecution>> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      return errorResponse(
        'WORKFLOW_EXECUTION_NOT_FOUND',
        `Workflow execution not found: ${executionId}`
      );
    }

    if (!isValidWorkflowTransition(execution.status, 'cancelled')) {
      return errorResponse(
        'WORKFLOW_CANCELLED',
        `Cannot cancel workflow in status: ${execution.status}`
      );
    }

    const updatedExecution = await this.executionRepository.update(executionId, {
      status: 'cancelled',
      completedAt: now(),
      error: {
        code: 'WORKFLOW_CANCELLED',
        message: `Workflow cancelled: ${reason}`,
        failedAtStep: execution.currentStepNumber,
        recoverable: false,
      },
    });

    return successResponse(updatedExecution);
  }

  async retryWorkflow(
    executionId: WorkflowExecutionId
  ): Promise<ApiResponse<WorkflowExecution>> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      return errorResponse(
        'WORKFLOW_EXECUTION_NOT_FOUND',
        `Workflow execution not found: ${executionId}`
      );
    }

    if (execution.status !== 'failed') {
      return errorResponse(
        'WORKFLOW_CANNOT_RETRY',
        `Cannot retry workflow in status: ${execution.status}`
      );
    }

    const timestamp = now();

    // Reset the failed step to in_progress
    await this.executionRepository.updateStep(
      executionId,
      execution.currentStepNumber,
      {
        status: 'in_progress',
        startedAt: timestamp,
        error: undefined,
        retryCount:
          (execution.steps[execution.currentStepNumber - 1]?.retryCount ?? 0) + 1,
      }
    );

    const updatedExecution = await this.executionRepository.update(executionId, {
      status: 'running',
      error: undefined,
    });

    return successResponse(updatedExecution);
  }

  async queryWorkflowExecutions(
    filters: WorkflowQueryFilters,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<WorkflowExecution>>> {
    const result = await this.executionRepository.findByFilters(
      filters,
      pagination
    );
    return successResponse(result);
  }

  // ===========================================================================
  // METRICS AND ANALYTICS
  // ===========================================================================

  async getAgentMetrics(
    filters: MetricsQueryFilters
  ): Promise<ApiResponse<AgentMetrics>> {
    // Get sessions matching filters
    const sessionFilters: SessionQueryFilters = {
      userId: filters.userId,
      customerId: filters.customerId,
      agentType: filters.agentType,
      dateRange: filters.dateRange,
    };

    const sessionsResult = await this.sessionRepository.findByFilters(
      sessionFilters
    );
    const sessions = sessionsResult.data;

    // Calculate metrics
    const sessionsByStatus: Record<AgentSessionStatus, number> = {
      active: 0,
      awaiting_input: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      timeout: 0,
    };

    const sessionsByAgentType: Record<AgentType, number> = {
      story_selector: 0,
      article_generator: 0,
      reddit_poster: 0,
      scheduler: 0,
    };

    let totalDuration = 0;
    let completedSessions = 0;
    let totalTokens = 0;
    let totalToolCalls = 0;
    const toolCallsByName: Record<string, number> = {};

    for (const session of sessions) {
      sessionsByStatus[session.status]++;
      sessionsByAgentType[session.agentType]++;

      if (session.completedAt) {
        const duration =
          new Date(session.completedAt).getTime() -
          new Date(session.startedAt).getTime();
        totalDuration += duration;
        completedSessions++;
      }

      if (session.result) {
        totalTokens += session.result.tokensUsed;
      }

      for (const toolCall of session.toolCalls) {
        totalToolCalls++;
        toolCallsByName[toolCall.toolName] =
          (toolCallsByName[toolCall.toolName] ?? 0) + 1;
      }
    }

    const totalSessions = sessions.length;
    const successfulSessions = sessionsByStatus.completed;
    const successRate =
      totalSessions > 0 ? successfulSessions / totalSessions : 0;
    const averageSessionDurationMs =
      completedSessions > 0 ? totalDuration / completedSessions : 0;
    const averageTokensPerSession =
      totalSessions > 0 ? totalTokens / totalSessions : 0;

    const metrics: AgentMetrics = {
      totalSessions,
      sessionsByStatus,
      sessionsByAgentType,
      averageSessionDurationMs,
      successRate,
      totalTokensUsed: totalTokens,
      averageTokensPerSession,
      totalToolCalls,
      toolCallsByName,
      timeSeries: [], // Would be calculated with proper time bucketing
    };

    return successResponse(metrics);
  }

  async getAverageLatency(
    agentType?: AgentType,
    dateRange?: { startDate: ISOTimestamp; endDate: ISOTimestamp }
  ): Promise<
    ApiResponse<{
      averageLatencyMs: number;
      p50Ms: number;
      p95Ms: number;
      p99Ms: number;
    }>
  > {
    // Get invocation metrics
    const metricsFilters: MetricsQueryFilters = {
      agentType,
      dateRange: dateRange ?? {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: now(),
      },
    };

    const invocationMetrics = await this.invocationRepository.getMetrics(
      metricsFilters
    );

    // For a proper implementation, we'd need to track latency percentiles
    // This is a simplified version using the average
    const averageLatencyMs = invocationMetrics.averageLatencyMs;

    return successResponse({
      averageLatencyMs,
      p50Ms: averageLatencyMs * 0.8, // Simplified approximation
      p95Ms: averageLatencyMs * 1.5, // Simplified approximation
      p99Ms: averageLatencyMs * 2.0, // Simplified approximation
    });
  }

  async getSuccessRate(
    agentType?: AgentType,
    dateRange?: { startDate: ISOTimestamp; endDate: ISOTimestamp }
  ): Promise<
    ApiResponse<{
      successRate: number;
      totalSessions: number;
      successfulSessions: number;
      failedSessions: number;
    }>
  > {
    const sessionFilters: SessionQueryFilters = {
      agentType,
      dateRange: dateRange ?? {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: now(),
      },
    };

    const sessionsResult = await this.sessionRepository.findByFilters(
      sessionFilters
    );
    const sessions = sessionsResult.data;

    const totalSessions = sessions.length;
    const successfulSessions = sessions.filter(
      (s) => s.status === 'completed'
    ).length;
    const failedSessions = sessions.filter(
      (s) => s.status === 'failed' || s.status === 'timeout'
    ).length;
    const successRate =
      totalSessions > 0 ? successfulSessions / totalSessions : 0;

    return successResponse({
      successRate,
      totalSessions,
      successfulSessions,
      failedSessions,
    });
  }

  async getTokenUsage(
    filters: MetricsQueryFilters
  ): Promise<ApiResponse<TokenUsageMetrics>> {
    // This would typically aggregate from invocations
    // Simplified implementation
    const invocationMetrics = await this.invocationRepository.getMetrics(
      filters
    );

    const tokensByAgentType: Record<
      AgentType,
      { input: number; output: number; total: number }
    > = {
      story_selector: { input: 0, output: 0, total: 0 },
      article_generator: { input: 0, output: 0, total: 0 },
      reddit_poster: { input: 0, output: 0, total: 0 },
      scheduler: { input: 0, output: 0, total: 0 },
    };

    const tokensByModel: Record<
      ClaudeModel,
      { input: number; output: number; total: number }
    > = {
      'claude-sonnet-4-20250514': { input: 0, output: 0, total: 0 },
      'claude-opus-4-5-20251101': { input: 0, output: 0, total: 0 },
      'claude-3-5-haiku-20241022': { input: 0, output: 0, total: 0 },
    };

    // Simplified metrics
    const totalTokens = invocationMetrics.totalTokens;
    const estimatedInputTokens = Math.floor(totalTokens * 0.7);
    const estimatedOutputTokens = totalTokens - estimatedInputTokens;

    const metrics: TokenUsageMetrics = {
      totalInputTokens: estimatedInputTokens,
      totalOutputTokens: estimatedOutputTokens,
      totalTokens,
      cachedTokens: 0,
      cacheHitRate: 0,
      tokensByAgentType,
      tokensByModel,
      estimatedCostUsd: totalTokens * 0.00001, // Simplified cost estimate
    };

    return successResponse(metrics);
  }
}
