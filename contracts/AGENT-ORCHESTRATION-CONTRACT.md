# AGENT-ORCHESTRATION Domain Contract

| Field | Value |
|-------|-------|
| **Version** | 1.0.0 |
| **Domain** | Agent Orchestration |
| **Owner** | Platform Team |
| **Last Updated** | 2026-01-18 |
| **Status** | Draft |

---

## Overview

The Agent Orchestration domain manages Claude agent coordination, tool execution, context management, and workflow state for the LEO Automation Platform. It serves as the central nervous system that coordinates the flow of data between specialized agents (Story Selector, Article Generator, Reddit Poster, Scheduler) to automate content creation and distribution.

### Domain Responsibilities

- Manage agent workflow sessions with full lifecycle tracking
- Coordinate between different agent types in sequence
- Track tool calls and their results for debugging and optimization
- Handle context passing between agents in a workflow
- Manage session state, timeouts, and cleanup
- Provide retry and error recovery mechanisms
- Log all agent interactions for debugging and analytics
- Expose metrics for monitoring agent performance

---

## Imports from Shared Primitives

```typescript
// =============================================================================
// IMPORTS FROM SHARED PRIMITIVES (shared-primitives.md)
// =============================================================================

// Identity Types
import type {
  UserId,           // Format: usr_${uuid}
  CustomerId,       // Format: cust_${uuid}
  ClearStoryId,     // Format: cs_${uuid}
  ArticleId,        // Format: art_${uuid}
  RedditPostId,     // Format: rp_${uuid}
  AgentSessionId,   // Format: sess_${uuid}
  BrandGuidelineId, // Format: bg_${uuid}
} from './shared-primitives';

// Enums
import type {
  AgentType,          // 'story_selector' | 'article_generator' | 'reddit_poster' | 'scheduler'
  AgentSessionStatus, // 'active' | 'awaiting_input' | 'processing' | 'completed' | 'failed' | 'timeout'
  ArticleStatus,
  RedditPostStatus,
  ContentTone,
  CustomerTier,
} from './shared-primitives';

// Cross-References
import type {
  UserRef,
  CustomerRef,
  ClearStoryRef,
  ArticleRef,
  RedditPostRef,
  AgentSessionRef,
} from './shared-primitives';

// Shared Patterns
import type {
  ApiResponse,
  ApiError,
  PaginationParams,
  PaginatedResponse,
  AuditInfo,
  AgentToolCall,
  ISOTimestamp,
  UnixTimestamp,
} from './shared-primitives';

// Constants
import {
  ARTICLE_GENERATION_TIMEOUT_MS,  // 30000
  SESSION_TIMEOUT_MS,             // 1800000 (30 minutes)
  REDDIT_POST_MAX_RETRIES,        // 3
  REDDIT_POST_RETRY_DELAY_MS,     // 60000
} from './shared-primitives';
```

---

## Cross-Domain References

These lightweight reference types allow the Agent Orchestration domain to link to entities owned by other domains without tight coupling.

```typescript
// =============================================================================
// CROSS-DOMAIN REFERENCES
// =============================================================================

/**
 * Reference to a Clear Story entity from the Clear Story domain.
 * Used when an agent selects or references a Clear Story.
 */
interface ClearStoryRef {
  id: ClearStoryId;
  topic: string;
  beliefSummary: string;  // First 200 chars of belief
}

/**
 * Reference to an Article entity from the Article domain.
 * Used when tracking article generation in workflows.
 */
interface ArticleRef {
  id: ArticleId;
  title: string;
  status: ArticleStatus;
  publishedUrl?: string;
}

/**
 * Reference to a Reddit Post entity from the Reddit Distribution domain.
 * Used when tracking post creation in workflows.
 */
interface RedditPostRef {
  id: RedditPostId;
  redditExternalId?: string;
  subreddit: string;
  status: RedditPostStatus;
  permalink?: string;
}

/**
 * Reference to Brand Guidelines from the User/Customer domain.
 * Used for context when generating content.
 */
interface BrandGuidelineRef {
  id: BrandGuidelineId;
  companyName: string;
  voiceTone: ContentTone;
  keywords: string[];
}
```

---

## Domain-Specific Types

### Core Session Types

```typescript
// =============================================================================
// DOMAIN-SPECIFIC TYPES
// =============================================================================

/**
 * Unique identifier for an agent workflow.
 * Format: wf_${uuid}
 */
type WorkflowId = `wf_${string}`;

/**
 * Unique identifier for a workflow execution instance.
 * Format: wfx_${uuid}
 */
type WorkflowExecutionId = `wfx_${string}`;

/**
 * Unique identifier for a tool call within a session.
 * Format: tc_${uuid}
 */
type ToolCallId = `tc_${string}`;

/**
 * Unique identifier for an agent invocation.
 * Format: inv_${uuid}
 */
type InvocationId = `inv_${string}`;

/**
 * Supported Claude models for agent invocations.
 */
type ClaudeModel =
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-5-20251101'
  | 'claude-3-5-haiku-20241022';

/**
 * Status of a workflow step execution.
 */
type WorkflowStepStatus =
  | 'pending'      // Not yet started
  | 'in_progress'  // Currently executing
  | 'completed'    // Successfully finished
  | 'failed'       // Execution failed
  | 'skipped';     // Skipped due to condition

/**
 * Tool execution status within a session.
 */
type ToolCallStatus =
  | 'pending'   // Queued for execution
  | 'running'   // Currently executing
  | 'success'   // Completed successfully
  | 'error';    // Failed with error
```

### Agent Session

```typescript
/**
 * Represents a single agent session - one invocation of a Claude agent
 * to perform a specific task within the platform.
 *
 * Sessions track the complete lifecycle from creation to completion,
 * including all tool calls, context, and results.
 */
interface AgentSession {
  /** Unique session identifier */
  id: AgentSessionId;

  /** Type of agent handling this session */
  agentType: AgentType;

  /** User who initiated the session */
  userId: UserId;

  /** Customer account context */
  customerId: CustomerId;

  /** Current session status */
  status: AgentSessionStatus;

  /** When the session started */
  startedAt: ISOTimestamp;

  /** When the session completed (success or failure) */
  completedAt?: ISOTimestamp;

  /** Context passed to and maintained by the agent */
  context: AgentContext;

  /** All tool calls made during this session */
  toolCalls: AgentToolCallRecord[];

  /** Final result of the session (if completed successfully) */
  result?: AgentSessionResult;

  /** Error information (if session failed) */
  error?: AgentSessionError;

  /** Parent workflow execution (if part of a workflow) */
  workflowExecutionId?: WorkflowExecutionId;

  /** Step number within workflow (if applicable) */
  workflowStepNumber?: number;

  /** Timeout timestamp - session fails if not completed by this time */
  timeoutAt: ISOTimestamp;

  /** Metadata for filtering and searching */
  metadata: Record<string, string | number | boolean>;

  /** Audit information */
  audit: AuditInfo;
}

/**
 * Extended tool call record with additional tracking fields.
 */
interface AgentToolCallRecord extends AgentToolCall {
  /** Unique identifier for this tool call */
  id: ToolCallId;

  /** Session this tool call belongs to */
  sessionId: AgentSessionId;

  /** Sequence number within the session */
  sequenceNumber: number;

  /** Duration in milliseconds */
  durationMs?: number;

  /** Retry count (if retried) */
  retryCount: number;
}
```

### Agent Context

```typescript
/**
 * Context object passed between agents and maintained throughout a workflow.
 * Contains all information needed for agents to perform their tasks.
 */
interface AgentContext {
  /** User performing the operation */
  userId: UserId;

  /** Customer account for content generation */
  customerId: CustomerId;

  /** Selected Clear Story (after story selection step) */
  clearStoryId?: ClearStoryId;

  /** Generated article (after article generation step) */
  articleId?: ArticleId;

  /** Created Reddit post (after Reddit posting step) */
  redditPostId?: RedditPostId;

  /** Brand guidelines for content generation */
  brandGuidelines: BrandGuidelinesContext;

  /** Conversation history for multi-turn interactions */
  conversationHistory: ConversationMessage[];

  /** Target subreddits for distribution */
  targetSubreddits?: string[];

  /** Scheduling preferences */
  schedulingPreferences?: SchedulingPreferences;

  /** Custom variables set during workflow execution */
  variables: Record<string, unknown>;
}

/**
 * Brand guidelines context for content generation.
 */
interface BrandGuidelinesContext {
  /** Company name for mentions */
  companyName: string;

  /** Product/service description */
  productDescription: string;

  /** Desired content tone */
  voiceTone: ContentTone;

  /** Keywords to include naturally */
  keywords: string[];

  /** Topics or phrases to avoid */
  avoidTopics: string[];

  /** Example content snippets for style reference */
  styleExamples?: string[];

  /** Company website URL for linking */
  websiteUrl: string;
}

/**
 * A single message in the conversation history.
 */
interface ConversationMessage {
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system';

  /** Message content */
  content: string;

  /** When the message was sent */
  timestamp: ISOTimestamp;

  /** Tool calls made in this turn (for assistant messages) */
  toolCalls?: AgentToolCall[];
}

/**
 * Scheduling preferences for content distribution.
 */
interface SchedulingPreferences {
  /** Preferred posting timezone */
  timezone: string;

  /** Preferred days of week (0=Sunday, 6=Saturday) */
  preferredDays?: number[];

  /** Preferred hours (0-23) */
  preferredHours?: number[];

  /** Minimum gap between posts in minutes */
  minimumGapMinutes: number;

  /** Whether to auto-schedule or require manual approval */
  autoSchedule: boolean;
}
```

### Agent Workflow

```typescript
/**
 * Defines a workflow template - a sequence of agent steps to accomplish
 * a complex task like full content generation and distribution.
 */
interface AgentWorkflow {
  /** Unique workflow identifier */
  id: WorkflowId;

  /** Human-readable workflow name */
  name: string;

  /** Description of what this workflow accomplishes */
  description: string;

  /** Ordered list of steps in the workflow */
  steps: WorkflowStepDefinition[];

  /** Whether this workflow is active and can be executed */
  isActive: boolean;

  /** Default timeout for the entire workflow in milliseconds */
  defaultTimeoutMs: number;

  /** Retry configuration for the workflow */
  retryConfig: WorkflowRetryConfig;

  /** Audit information */
  audit: AuditInfo;
}

/**
 * Definition of a single step within a workflow template.
 */
interface WorkflowStepDefinition {
  /** Step number (1-indexed) */
  stepNumber: number;

  /** Agent type that handles this step */
  agentType: AgentType;

  /** Human-readable step name */
  name: string;

  /** Description of what this step does */
  description: string;

  /** Conditions that must be met to execute this step */
  conditions?: WorkflowCondition[];

  /** Whether to continue workflow if this step fails */
  continueOnFailure: boolean;

  /** Step-specific timeout (overrides workflow default) */
  timeoutMs?: number;

  /** Maximum retries for this step */
  maxRetries: number;

  /** Input mapping from context to step input */
  inputMapping: Record<string, string>;

  /** Output mapping from step result to context */
  outputMapping: Record<string, string>;
}

/**
 * Condition for workflow step execution.
 */
interface WorkflowCondition {
  /** Context field to evaluate */
  field: string;

  /** Comparison operator */
  operator: 'equals' | 'not_equals' | 'exists' | 'not_exists' | 'contains' | 'greater_than' | 'less_than';

  /** Value to compare against (for operators that need it) */
  value?: unknown;
}

/**
 * Retry configuration for workflows.
 */
interface WorkflowRetryConfig {
  /** Maximum retry attempts for failed steps */
  maxRetries: number;

  /** Base delay between retries in milliseconds */
  retryDelayMs: number;

  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;

  /** Maximum delay between retries */
  maxRetryDelayMs: number;
}
```

### Workflow Execution

```typescript
/**
 * Represents a running instance of a workflow.
 * Tracks progress through workflow steps and maintains execution state.
 */
interface WorkflowExecution {
  /** Unique execution identifier */
  id: WorkflowExecutionId;

  /** Reference to the workflow template */
  workflowId: WorkflowId;

  /** User who started the execution */
  userId: UserId;

  /** Customer account context */
  customerId: CustomerId;

  /** Current execution status */
  status: WorkflowExecutionStatus;

  /** Current step being executed (1-indexed) */
  currentStepNumber: number;

  /** Execution state for each step */
  steps: WorkflowStepExecution[];

  /** Shared context across all steps */
  context: AgentContext;

  /** When execution started */
  startedAt: ISOTimestamp;

  /** When execution completed */
  completedAt?: ISOTimestamp;

  /** Final result of the workflow */
  result?: WorkflowExecutionResult;

  /** Error information if workflow failed */
  error?: WorkflowExecutionError;

  /** Timeout timestamp for entire workflow */
  timeoutAt: ISOTimestamp;

  /** Audit information */
  audit: AuditInfo;
}

/**
 * Status of a workflow execution.
 */
type WorkflowExecutionStatus =
  | 'pending'       // Created but not started
  | 'running'       // Currently executing
  | 'paused'        // Paused (awaiting input or manual resume)
  | 'completed'     // All steps completed successfully
  | 'failed'        // Execution failed
  | 'cancelled'     // Cancelled by user
  | 'timeout';      // Execution timed out

/**
 * Execution state for a single workflow step.
 */
interface WorkflowStepExecution {
  /** Step number from the workflow definition */
  stepNumber: number;

  /** Agent type for this step */
  agentType: AgentType;

  /** Current status */
  status: WorkflowStepStatus;

  /** Session ID for the agent handling this step */
  sessionId?: AgentSessionId;

  /** Input provided to this step */
  input?: Record<string, unknown>;

  /** Output from this step */
  output?: Record<string, unknown>;

  /** When step execution started */
  startedAt?: ISOTimestamp;

  /** When step execution completed */
  completedAt?: ISOTimestamp;

  /** Error information if step failed */
  error?: AgentSessionError;

  /** Number of retry attempts */
  retryCount: number;
}

/**
 * Result of a completed workflow execution.
 */
interface WorkflowExecutionResult {
  /** Whether the workflow completed successfully */
  success: boolean;

  /** Created Clear Story reference (if applicable) */
  clearStory?: ClearStoryRef;

  /** Generated Article reference (if applicable) */
  article?: ArticleRef;

  /** Created Reddit Post reference (if applicable) */
  redditPost?: RedditPostRef;

  /** Total duration in milliseconds */
  totalDurationMs: number;

  /** Total tokens used across all steps */
  totalTokensUsed: number;

  /** Summary of what was accomplished */
  summary: string;
}

/**
 * Error information for a failed workflow execution.
 */
interface WorkflowExecutionError {
  /** Error code */
  code: AgentErrorCode;

  /** Human-readable error message */
  message: string;

  /** Step where the error occurred */
  failedAtStep: number;

  /** Underlying error details */
  details?: Record<string, unknown>;

  /** Whether the error is recoverable */
  recoverable: boolean;

  /** Suggested recovery action */
  recoveryAction?: string;
}
```

### Agent Invocation

```typescript
/**
 * Detailed record of a single Claude API invocation.
 * Used for tracking, debugging, and cost analysis.
 */
interface AgentInvocation {
  /** Unique invocation identifier */
  id: InvocationId;

  /** Session this invocation belongs to */
  sessionId: AgentSessionId;

  /** Sequence number within the session */
  sequenceNumber: number;

  /** Claude model used */
  model: ClaudeModel;

  /** Input sent to Claude */
  input: AgentInvocationInput;

  /** Output received from Claude */
  output?: AgentInvocationOutput;

  /** Input token count */
  inputTokens: number;

  /** Output token count */
  outputTokens: number;

  /** Total tokens used */
  totalTokens: number;

  /** Latency in milliseconds */
  latencyMs: number;

  /** When the invocation started */
  startedAt: ISOTimestamp;

  /** When the invocation completed */
  completedAt: ISOTimestamp;

  /** Whether the invocation succeeded */
  success: boolean;

  /** Error message if invocation failed */
  error?: string;

  /** Cache hit status for prompt caching */
  cacheStatus?: 'hit' | 'miss' | 'partial';

  /** Cached tokens (if applicable) */
  cachedTokens?: number;
}

/**
 * Input structure for a Claude invocation.
 */
interface AgentInvocationInput {
  /** System prompt */
  systemPrompt: string;

  /** User messages */
  messages: ConversationMessage[];

  /** Available tools for this invocation */
  tools: ToolDefinition[];

  /** Maximum tokens to generate */
  maxTokens: number;

  /** Temperature setting */
  temperature: number;
}

/**
 * Output structure from a Claude invocation.
 */
interface AgentInvocationOutput {
  /** Generated text response */
  textResponse?: string;

  /** Tool calls requested by the model */
  toolCalls?: AgentToolCall[];

  /** Stop reason */
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

/**
 * Definition of a tool available to agents.
 */
interface ToolDefinition {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** JSON Schema for input parameters */
  inputSchema: Record<string, unknown>;
}
```

### Session Results and Errors

```typescript
/**
 * Result of a successfully completed agent session.
 */
interface AgentSessionResult {
  /** Type-specific result data */
  data: StorySelectorResult | ArticleGeneratorResult | RedditPosterResult | SchedulerResult;

  /** Summary of what was accomplished */
  summary: string;

  /** Tokens used in this session */
  tokensUsed: number;

  /** Total duration in milliseconds */
  durationMs: number;
}

/**
 * Result from the Story Selector agent.
 */
interface StorySelectorResult {
  type: 'story_selector';

  /** Selected Clear Story */
  selectedStory: ClearStoryRef;

  /** Relevance score (0-1) */
  relevanceScore: number;

  /** Explanation of why this story was selected */
  selectionReasoning: string;

  /** Alternative stories considered */
  alternatives?: ClearStoryRef[];
}

/**
 * Result from the Article Generator agent.
 */
interface ArticleGeneratorResult {
  type: 'article_generator';

  /** Generated article */
  article: ArticleRef;

  /** Word count */
  wordCount: number;

  /** Keywords included */
  keywordsIncluded: string[];

  /** SEO metadata generated */
  seoMetadata: {
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
  };
}

/**
 * Result from the Reddit Poster agent.
 */
interface RedditPosterResult {
  type: 'reddit_poster';

  /** Created Reddit post */
  redditPost: RedditPostRef;

  /** Generated summary/post content */
  generatedContent: {
    title: string;
    body: string;
    subreddit: string;
  };

  /** Whether the post was published or queued */
  action: 'posted' | 'queued' | 'pending_approval';
}

/**
 * Result from the Scheduler agent.
 */
interface SchedulerResult {
  type: 'scheduler';

  /** Scheduled time */
  scheduledFor: ISOTimestamp;

  /** Posts scheduled */
  scheduledPosts: RedditPostRef[];

  /** Scheduling strategy used */
  strategy: string;

  /** Rationale for chosen times */
  schedulingRationale: string;
}

/**
 * Error information for a failed session.
 */
interface AgentSessionError {
  /** Error code */
  code: AgentErrorCode;

  /** Human-readable error message */
  message: string;

  /** Additional error details */
  details?: Record<string, unknown>;

  /** Stack trace (for debugging, not exposed to users) */
  stackTrace?: string;

  /** Whether this error is retryable */
  retryable: boolean;

  /** Suggested user action */
  userAction?: string;

  /** When the error occurred */
  occurredAt: ISOTimestamp;
}
```

### Input/Output Types

```typescript
/**
 * Input for creating a new agent session.
 */
interface CreateSessionInput {
  /** Type of agent to invoke */
  agentType: AgentType;

  /** User initiating the session */
  userId: UserId;

  /** Customer account context */
  customerId: CustomerId;

  /** Initial context for the agent */
  initialContext: Partial<AgentContext>;

  /** Optional workflow execution ID if part of a workflow */
  workflowExecutionId?: WorkflowExecutionId;

  /** Optional workflow step number */
  workflowStepNumber?: number;

  /** Custom timeout (uses default if not specified) */
  timeoutMs?: number;

  /** Metadata for tagging/filtering */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Input for starting a new workflow execution.
 */
interface StartWorkflowInput {
  /** Workflow template to execute */
  workflowId: WorkflowId;

  /** User initiating the workflow */
  userId: UserId;

  /** Customer account context */
  customerId: CustomerId;

  /** Initial context for the workflow */
  initialContext: Partial<AgentContext>;

  /** Custom timeout for the entire workflow */
  timeoutMs?: number;

  /** Whether to start execution immediately */
  startImmediately: boolean;
}

/**
 * Input for advancing a workflow to the next step.
 */
interface AdvanceWorkflowInput {
  /** Workflow execution ID */
  executionId: WorkflowExecutionId;

  /** Optional user input for the next step */
  userInput?: Record<string, unknown>;

  /** Whether to skip the current step */
  skipCurrentStep?: boolean;
}

/**
 * Input for updating session status.
 */
interface UpdateSessionStatusInput {
  /** Session ID to update */
  sessionId: AgentSessionId;

  /** New status */
  status: AgentSessionStatus;

  /** Reason for status change */
  reason?: string;
}

/**
 * Session query filters.
 */
interface SessionQueryFilters {
  /** Filter by user */
  userId?: UserId;

  /** Filter by customer */
  customerId?: CustomerId;

  /** Filter by agent type */
  agentType?: AgentType;

  /** Filter by status */
  status?: AgentSessionStatus | AgentSessionStatus[];

  /** Filter by workflow execution */
  workflowExecutionId?: WorkflowExecutionId;

  /** Filter by date range */
  dateRange?: {
    startDate: ISOTimestamp;
    endDate: ISOTimestamp;
  };

  /** Include only active sessions */
  activeOnly?: boolean;
}

/**
 * Workflow query filters.
 */
interface WorkflowQueryFilters {
  /** Filter by user */
  userId?: UserId;

  /** Filter by customer */
  customerId?: CustomerId;

  /** Filter by workflow template */
  workflowId?: WorkflowId;

  /** Filter by status */
  status?: WorkflowExecutionStatus | WorkflowExecutionStatus[];

  /** Filter by date range */
  dateRange?: {
    startDate: ISOTimestamp;
    endDate: ISOTimestamp;
  };
}
```

---

## Service Interface

```typescript
// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Main service interface for the Agent Orchestration domain.
 * Provides all operations for managing agent sessions and workflows.
 */
interface IAgentOrchestrationService {
  // -------------------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------------------

  /**
   * Creates a new agent session.
   * @param input - Session creation parameters
   * @returns The created session
   */
  createSession(input: CreateSessionInput): Promise<ApiResponse<AgentSession>>;

  /**
   * Retrieves a session by ID.
   * @param sessionId - Session identifier
   * @returns The session if found
   */
  getSession(sessionId: AgentSessionId): Promise<ApiResponse<AgentSession>>;

  /**
   * Updates the status of a session.
   * @param input - Status update parameters
   * @returns The updated session
   */
  updateSessionStatus(input: UpdateSessionStatusInput): Promise<ApiResponse<AgentSession>>;

  /**
   * Marks a session as completed with a result.
   * @param sessionId - Session identifier
   * @param result - Session result
   * @returns The completed session
   */
  completeSession(
    sessionId: AgentSessionId,
    result: AgentSessionResult
  ): Promise<ApiResponse<AgentSession>>;

  /**
   * Marks a session as failed with an error.
   * @param sessionId - Session identifier
   * @param error - Error information
   * @returns The failed session
   */
  failSession(
    sessionId: AgentSessionId,
    error: AgentSessionError
  ): Promise<ApiResponse<AgentSession>>;

  /**
   * Cancels an active session.
   * @param sessionId - Session identifier
   * @param reason - Cancellation reason
   * @returns The cancelled session
   */
  cancelSession(
    sessionId: AgentSessionId,
    reason: string
  ): Promise<ApiResponse<AgentSession>>;

  // -------------------------------------------------------------------------
  // Agent Invocation
  // -------------------------------------------------------------------------

  /**
   * Invokes an agent for a session, sending a message to Claude.
   * @param sessionId - Session identifier
   * @param input - Invocation input
   * @returns The invocation result
   */
  invokeAgent(
    sessionId: AgentSessionId,
    input: AgentInvocationInput
  ): Promise<ApiResponse<AgentInvocation>>;

  /**
   * Records a tool call made during a session.
   * @param sessionId - Session identifier
   * @param toolCall - Tool call details
   * @returns The recorded tool call
   */
  recordToolCall(
    sessionId: AgentSessionId,
    toolCall: Omit<AgentToolCallRecord, 'id' | 'sessionId' | 'sequenceNumber'>
  ): Promise<ApiResponse<AgentToolCallRecord>>;

  /**
   * Updates the result of a tool call.
   * @param toolCallId - Tool call identifier
   * @param result - Tool execution result
   * @returns The updated tool call
   */
  updateToolCallResult(
    toolCallId: ToolCallId,
    result: {
      output: Record<string, unknown>;
      status: ToolCallStatus;
      error?: string;
      durationMs: number;
    }
  ): Promise<ApiResponse<AgentToolCallRecord>>;

  // -------------------------------------------------------------------------
  // Session Queries
  // -------------------------------------------------------------------------

  /**
   * Gets all sessions for a user.
   * @param userId - User identifier
   * @param pagination - Pagination parameters
   * @returns Paginated list of sessions
   */
  getSessionsByUser(
    userId: UserId,
    filters?: SessionQueryFilters,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<AgentSession>>>;

  /**
   * Gets all sessions for a customer.
   * @param customerId - Customer identifier
   * @param pagination - Pagination parameters
   * @returns Paginated list of sessions
   */
  getSessionsByCustomer(
    customerId: CustomerId,
    filters?: SessionQueryFilters,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<AgentSession>>>;

  /**
   * Gets all currently active sessions.
   * @returns List of active sessions
   */
  getActiveSessions(): Promise<ApiResponse<AgentSession[]>>;

  /**
   * Gets sessions that have timed out and need cleanup.
   * @returns List of timed-out sessions
   */
  getTimedOutSessions(): Promise<ApiResponse<AgentSession[]>>;

  // -------------------------------------------------------------------------
  // Workflow Management
  // -------------------------------------------------------------------------

  /**
   * Gets a workflow template by ID.
   * @param workflowId - Workflow identifier
   * @returns The workflow template
   */
  getWorkflow(workflowId: WorkflowId): Promise<ApiResponse<AgentWorkflow>>;

  /**
   * Lists all available workflow templates.
   * @returns List of workflows
   */
  listWorkflows(): Promise<ApiResponse<AgentWorkflow[]>>;

  /**
   * Starts a new workflow execution.
   * @param input - Workflow start parameters
   * @returns The created workflow execution
   */
  startWorkflow(input: StartWorkflowInput): Promise<ApiResponse<WorkflowExecution>>;

  /**
   * Gets the current status of a workflow execution.
   * @param executionId - Workflow execution identifier
   * @returns The workflow execution
   */
  getWorkflowStatus(executionId: WorkflowExecutionId): Promise<ApiResponse<WorkflowExecution>>;

  /**
   * Advances a workflow to the next step.
   * @param input - Advance parameters
   * @returns The updated workflow execution
   */
  advanceWorkflow(input: AdvanceWorkflowInput): Promise<ApiResponse<WorkflowExecution>>;

  /**
   * Pauses a running workflow execution.
   * @param executionId - Workflow execution identifier
   * @param reason - Reason for pausing
   * @returns The paused workflow execution
   */
  pauseWorkflow(
    executionId: WorkflowExecutionId,
    reason: string
  ): Promise<ApiResponse<WorkflowExecution>>;

  /**
   * Resumes a paused workflow execution.
   * @param executionId - Workflow execution identifier
   * @returns The resumed workflow execution
   */
  resumeWorkflow(executionId: WorkflowExecutionId): Promise<ApiResponse<WorkflowExecution>>;

  /**
   * Cancels a workflow execution.
   * @param executionId - Workflow execution identifier
   * @param reason - Cancellation reason
   * @returns The cancelled workflow execution
   */
  cancelWorkflow(
    executionId: WorkflowExecutionId,
    reason: string
  ): Promise<ApiResponse<WorkflowExecution>>;

  /**
   * Retries a failed workflow from the failed step.
   * @param executionId - Workflow execution identifier
   * @returns The retrying workflow execution
   */
  retryWorkflow(executionId: WorkflowExecutionId): Promise<ApiResponse<WorkflowExecution>>;

  /**
   * Gets workflow executions matching filters.
   * @param filters - Query filters
   * @param pagination - Pagination parameters
   * @returns Paginated list of workflow executions
   */
  queryWorkflowExecutions(
    filters: WorkflowQueryFilters,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<WorkflowExecution>>>;

  // -------------------------------------------------------------------------
  // Metrics and Analytics
  // -------------------------------------------------------------------------

  /**
   * Gets aggregated metrics for agent performance.
   * @param filters - Query filters
   * @returns Agent performance metrics
   */
  getAgentMetrics(filters: MetricsQueryFilters): Promise<ApiResponse<AgentMetrics>>;

  /**
   * Gets average latency for agent invocations.
   * @param agentType - Optional filter by agent type
   * @param dateRange - Date range for the query
   * @returns Average latency in milliseconds
   */
  getAverageLatency(
    agentType?: AgentType,
    dateRange?: { startDate: ISOTimestamp; endDate: ISOTimestamp }
  ): Promise<ApiResponse<{ averageLatencyMs: number; p50Ms: number; p95Ms: number; p99Ms: number }>>;

  /**
   * Gets success rate for sessions and workflows.
   * @param agentType - Optional filter by agent type
   * @param dateRange - Date range for the query
   * @returns Success rate metrics
   */
  getSuccessRate(
    agentType?: AgentType,
    dateRange?: { startDate: ISOTimestamp; endDate: ISOTimestamp }
  ): Promise<ApiResponse<{ successRate: number; totalSessions: number; successfulSessions: number; failedSessions: number }>>;

  /**
   * Gets token usage statistics.
   * @param filters - Query filters
   * @returns Token usage metrics
   */
  getTokenUsage(filters: MetricsQueryFilters): Promise<ApiResponse<TokenUsageMetrics>>;
}

/**
 * Filters for metrics queries.
 */
interface MetricsQueryFilters {
  /** Filter by user */
  userId?: UserId;

  /** Filter by customer */
  customerId?: CustomerId;

  /** Filter by agent type */
  agentType?: AgentType;

  /** Date range for metrics */
  dateRange: {
    startDate: ISOTimestamp;
    endDate: ISOTimestamp;
  };

  /** Granularity for time-series data */
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Aggregated agent performance metrics.
 */
interface AgentMetrics {
  /** Total sessions in the period */
  totalSessions: number;

  /** Sessions by status */
  sessionsByStatus: Record<AgentSessionStatus, number>;

  /** Sessions by agent type */
  sessionsByAgentType: Record<AgentType, number>;

  /** Average session duration */
  averageSessionDurationMs: number;

  /** Success rate (completed / total) */
  successRate: number;

  /** Total tokens used */
  totalTokensUsed: number;

  /** Average tokens per session */
  averageTokensPerSession: number;

  /** Total tool calls made */
  totalToolCalls: number;

  /** Tool calls by tool name */
  toolCallsByName: Record<string, number>;

  /** Time series data */
  timeSeries: {
    timestamp: ISOTimestamp;
    sessions: number;
    successRate: number;
    averageLatencyMs: number;
    tokensUsed: number;
  }[];
}

/**
 * Token usage metrics.
 */
interface TokenUsageMetrics {
  /** Total input tokens */
  totalInputTokens: number;

  /** Total output tokens */
  totalOutputTokens: number;

  /** Total tokens (input + output) */
  totalTokens: number;

  /** Cached tokens */
  cachedTokens: number;

  /** Cache hit rate */
  cacheHitRate: number;

  /** Tokens by agent type */
  tokensByAgentType: Record<AgentType, { input: number; output: number; total: number }>;

  /** Tokens by model */
  tokensByModel: Record<ClaudeModel, { input: number; output: number; total: number }>;

  /** Estimated cost (in USD) */
  estimatedCostUsd: number;
}
```

---

## Agent Interfaces

```typescript
// =============================================================================
// AGENT INTERFACES
// =============================================================================

/**
 * Base interface that all Claude agents must implement.
 * Provides common functionality for session management and invocation.
 */
interface IAgent {
  /** The type of this agent */
  readonly agentType: AgentType;

  /** System prompt for this agent */
  readonly systemPrompt: string;

  /** Available tools for this agent */
  readonly tools: ToolDefinition[];

  /** Default model for this agent */
  readonly defaultModel: ClaudeModel;

  /**
   * Processes input and generates a response.
   * @param session - Current session
   * @param input - Agent-specific input
   * @returns Agent-specific result
   */
  process(session: AgentSession, input: unknown): Promise<AgentSessionResult>;

  /**
   * Handles a tool call request from Claude.
   * @param session - Current session
   * @param toolCall - Tool call to execute
   * @returns Tool execution result
   */
  executeToolCall(session: AgentSession, toolCall: AgentToolCall): Promise<Record<string, unknown>>;

  /**
   * Validates input before processing.
   * @param input - Input to validate
   * @returns Validation result
   */
  validateInput(input: unknown): { valid: boolean; errors?: string[] };
}

// -----------------------------------------------------------------------------
// Story Selector Agent
// -----------------------------------------------------------------------------

/**
 * Input for the Story Selector agent.
 */
interface StorySelectorInput {
  /** User's query or topic of interest */
  query: string;

  /** Optional filters for story selection */
  filters?: {
    /** Filter by source type */
    sourceTypes?: string[];

    /** Filter by tags */
    tags?: string[];

    /** Filter by recency */
    maxAgeDays?: number;
  };

  /** Number of stories to consider */
  maxCandidates?: number;

  /** Whether to include alternatives in the result */
  includeAlternatives?: boolean;
}

/**
 * Interface for the Story Selector agent.
 * Helps users find the most relevant Clear Story for their content needs.
 */
interface IStorySelectorAgent extends IAgent {
  readonly agentType: 'story_selector';

  /**
   * Searches for relevant Clear Stories based on user query.
   * @param session - Current session
   * @param input - Story selection input
   * @returns Selected story with reasoning
   */
  process(session: AgentSession, input: StorySelectorInput): Promise<AgentSessionResult>;

  /**
   * Tools available to this agent:
   * - search_clear_stories: Search the belief library
   * - get_clear_story_details: Get full details of a story
   * - compare_stories: Compare multiple stories for relevance
   */
}

// -----------------------------------------------------------------------------
// Article Generator Agent
// -----------------------------------------------------------------------------

/**
 * Input for the Article Generator agent.
 */
interface ArticleGeneratorInput {
  /** Clear Story to base the article on */
  clearStoryId: ClearStoryId;

  /** Target article type */
  articleType: 'blog_post' | 'thought_leadership' | 'how_to_guide' | 'case_study';

  /** Target word count range */
  wordCountRange: {
    min: number;
    max: number;
  };

  /** SEO focus keyword */
  focusKeyword?: string;

  /** Additional keywords to include */
  secondaryKeywords?: string[];

  /** Specific angle or perspective to take */
  angle?: string;

  /** Whether to generate SEO metadata */
  generateSeoMetadata: boolean;
}

/**
 * Interface for the Article Generator agent.
 * Generates blog articles from Clear Stories.
 */
interface IArticleGeneratorAgent extends IAgent {
  readonly agentType: 'article_generator';

  /**
   * Generates an article based on a Clear Story.
   * @param session - Current session
   * @param input - Article generation input
   * @returns Generated article
   */
  process(session: AgentSession, input: ArticleGeneratorInput): Promise<AgentSessionResult>;

  /**
   * Tools available to this agent:
   * - get_clear_story: Retrieve the source Clear Story
   * - get_brand_guidelines: Get customer brand guidelines
   * - create_article_draft: Save a draft article
   * - check_keyword_density: Analyze keyword usage
   * - generate_seo_metadata: Generate title/description
   */
}

// -----------------------------------------------------------------------------
// Reddit Poster Agent
// -----------------------------------------------------------------------------

/**
 * Input for the Reddit Poster agent.
 */
interface RedditPosterInput {
  /** Article to create a Reddit post for */
  articleId: ArticleId;

  /** Target subreddit */
  targetSubreddit: string;

  /** Post format preference */
  postFormat: 'link_post' | 'text_post' | 'cross_post';

  /** Whether to include the full article or a summary */
  contentStyle: 'full_summary' | 'teaser' | 'discussion_starter';

  /** Maximum summary length in words */
  maxSummaryWords?: number;

  /** Whether to queue for scheduling or post immediately */
  action: 'post_now' | 'queue_for_scheduling' | 'draft_only';
}

/**
 * Interface for the Reddit Poster agent.
 * Creates and posts Reddit summaries of articles.
 */
interface IRedditPosterAgent extends IAgent {
  readonly agentType: 'reddit_poster';

  /**
   * Creates a Reddit post for an article.
   * @param session - Current session
   * @param input - Reddit posting input
   * @returns Created Reddit post
   */
  process(session: AgentSession, input: RedditPosterInput): Promise<AgentSessionResult>;

  /**
   * Tools available to this agent:
   * - get_article: Retrieve the source article
   * - get_subreddit_rules: Get subreddit posting rules
   * - analyze_subreddit_style: Analyze successful posts
   * - create_reddit_draft: Create a draft post
   * - submit_to_reddit: Actually post to Reddit
   * - queue_for_scheduling: Add to the scheduling queue
   */
}

// -----------------------------------------------------------------------------
// Scheduler Agent
// -----------------------------------------------------------------------------

/**
 * Input for the Scheduler agent.
 */
interface SchedulerInput {
  /** Reddit posts to schedule */
  redditPostIds: RedditPostId[];

  /** Scheduling strategy */
  strategy: 'optimal_engagement' | 'spread_evenly' | 'asap' | 'custom';

  /** Custom schedule (for 'custom' strategy) */
  customSchedule?: {
    postId: RedditPostId;
    scheduledFor: ISOTimestamp;
  }[];

  /** Date range for scheduling */
  dateRange?: {
    startDate: ISOTimestamp;
    endDate: ISOTimestamp;
  };

  /** Whether to respect existing scheduled posts */
  avoidConflicts: boolean;
}

/**
 * Interface for the Scheduler agent.
 * Manages posting queue and timing for Reddit posts.
 */
interface ISchedulerAgent extends IAgent {
  readonly agentType: 'scheduler';

  /**
   * Schedules Reddit posts for optimal timing.
   * @param session - Current session
   * @param input - Scheduling input
   * @returns Scheduling result
   */
  process(session: AgentSession, input: SchedulerInput): Promise<AgentSessionResult>;

  /**
   * Tools available to this agent:
   * - get_subreddit_analytics: Get engagement patterns
   * - get_scheduled_posts: Get existing schedule
   * - find_optimal_times: Calculate best posting times
   * - create_schedule: Create/update schedule entries
   * - validate_schedule: Check for conflicts
   */
}
```

---

## Repository Interfaces

```typescript
// =============================================================================
// REPOSITORY INTERFACES
// =============================================================================

/**
 * Repository interface for agent session persistence.
 */
interface IAgentSessionRepository {
  /**
   * Creates a new session record.
   * @param session - Session to create
   * @returns Created session with generated ID
   */
  create(session: Omit<AgentSession, 'id'>): Promise<AgentSession>;

  /**
   * Finds a session by ID.
   * @param id - Session identifier
   * @returns Session if found, null otherwise
   */
  findById(id: AgentSessionId): Promise<AgentSession | null>;

  /**
   * Updates an existing session.
   * @param id - Session identifier
   * @param updates - Partial session updates
   * @returns Updated session
   */
  update(id: AgentSessionId, updates: Partial<AgentSession>): Promise<AgentSession>;

  /**
   * Deletes a session (soft delete).
   * @param id - Session identifier
   * @returns True if deleted
   */
  delete(id: AgentSessionId): Promise<boolean>;

  /**
   * Finds sessions matching filters.
   * @param filters - Query filters
   * @param pagination - Pagination options
   * @returns Paginated sessions
   */
  findByFilters(
    filters: SessionQueryFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<AgentSession>>;

  /**
   * Finds all active sessions.
   * @returns Active sessions
   */
  findActive(): Promise<AgentSession[]>;

  /**
   * Finds sessions that have exceeded their timeout.
   * @returns Timed out sessions
   */
  findTimedOut(): Promise<AgentSession[]>;

  /**
   * Counts sessions matching filters.
   * @param filters - Query filters
   * @returns Session count
   */
  count(filters?: SessionQueryFilters): Promise<number>;

  /**
   * Adds a tool call to a session.
   * @param sessionId - Session identifier
   * @param toolCall - Tool call to add
   * @returns Updated tool call with ID
   */
  addToolCall(
    sessionId: AgentSessionId,
    toolCall: Omit<AgentToolCallRecord, 'id'>
  ): Promise<AgentToolCallRecord>;

  /**
   * Updates a tool call result.
   * @param toolCallId - Tool call identifier
   * @param updates - Tool call updates
   * @returns Updated tool call
   */
  updateToolCall(
    toolCallId: ToolCallId,
    updates: Partial<AgentToolCallRecord>
  ): Promise<AgentToolCallRecord>;

  /**
   * Gets tool calls for a session.
   * @param sessionId - Session identifier
   * @returns Tool calls in sequence order
   */
  getToolCalls(sessionId: AgentSessionId): Promise<AgentToolCallRecord[]>;
}

/**
 * Repository interface for workflow persistence.
 */
interface IAgentWorkflowRepository {
  /**
   * Finds a workflow template by ID.
   * @param id - Workflow identifier
   * @returns Workflow if found
   */
  findById(id: WorkflowId): Promise<AgentWorkflow | null>;

  /**
   * Lists all active workflow templates.
   * @returns Active workflows
   */
  findAllActive(): Promise<AgentWorkflow[]>;

  /**
   * Creates a new workflow template.
   * @param workflow - Workflow to create
   * @returns Created workflow
   */
  create(workflow: Omit<AgentWorkflow, 'id'>): Promise<AgentWorkflow>;

  /**
   * Updates a workflow template.
   * @param id - Workflow identifier
   * @param updates - Partial workflow updates
   * @returns Updated workflow
   */
  update(id: WorkflowId, updates: Partial<AgentWorkflow>): Promise<AgentWorkflow>;

  /**
   * Deactivates a workflow template.
   * @param id - Workflow identifier
   * @returns True if deactivated
   */
  deactivate(id: WorkflowId): Promise<boolean>;
}

/**
 * Repository interface for workflow execution persistence.
 */
interface IWorkflowExecutionRepository {
  /**
   * Creates a new workflow execution.
   * @param execution - Execution to create
   * @returns Created execution with ID
   */
  create(execution: Omit<WorkflowExecution, 'id'>): Promise<WorkflowExecution>;

  /**
   * Finds an execution by ID.
   * @param id - Execution identifier
   * @returns Execution if found
   */
  findById(id: WorkflowExecutionId): Promise<WorkflowExecution | null>;

  /**
   * Updates an execution.
   * @param id - Execution identifier
   * @param updates - Partial execution updates
   * @returns Updated execution
   */
  update(
    id: WorkflowExecutionId,
    updates: Partial<WorkflowExecution>
  ): Promise<WorkflowExecution>;

  /**
   * Finds executions matching filters.
   * @param filters - Query filters
   * @param pagination - Pagination options
   * @returns Paginated executions
   */
  findByFilters(
    filters: WorkflowQueryFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<WorkflowExecution>>;

  /**
   * Finds running executions that have timed out.
   * @returns Timed out executions
   */
  findTimedOut(): Promise<WorkflowExecution[]>;

  /**
   * Updates a specific step within an execution.
   * @param executionId - Execution identifier
   * @param stepNumber - Step number to update
   * @param updates - Step updates
   * @returns Updated execution
   */
  updateStep(
    executionId: WorkflowExecutionId,
    stepNumber: number,
    updates: Partial<WorkflowStepExecution>
  ): Promise<WorkflowExecution>;
}

/**
 * Repository interface for agent invocation logging.
 */
interface IAgentInvocationRepository {
  /**
   * Records a new invocation.
   * @param invocation - Invocation to record
   * @returns Recorded invocation with ID
   */
  create(invocation: Omit<AgentInvocation, 'id'>): Promise<AgentInvocation>;

  /**
   * Finds invocations for a session.
   * @param sessionId - Session identifier
   * @returns Invocations in sequence order
   */
  findBySession(sessionId: AgentSessionId): Promise<AgentInvocation[]>;

  /**
   * Gets aggregated metrics for invocations.
   * @param filters - Query filters
   * @returns Aggregated metrics
   */
  getMetrics(filters: MetricsQueryFilters): Promise<{
    totalInvocations: number;
    totalTokens: number;
    averageLatencyMs: number;
    successRate: number;
  }>;
}
```

---

## API Routes

```yaml
# =============================================================================
# API ROUTES
# =============================================================================

# Base path: /api/v1/orchestration

# -----------------------------------------------------------------------------
# Session Endpoints
# -----------------------------------------------------------------------------

sessions:
  # Create a new agent session
  create:
    method: POST
    path: /sessions
    description: Create a new agent session
    request: CreateSessionRequest
    response: ApiResponse<AgentSession>
    status_codes:
      201: Session created successfully
      400: Invalid input
      401: Unauthorized
      403: Customer quota exceeded

  # Get session by ID
  get:
    method: GET
    path: /sessions/{sessionId}
    description: Get a session by ID
    params:
      sessionId: AgentSessionId
    response: ApiResponse<AgentSession>
    status_codes:
      200: Session found
      404: Session not found

  # Update session status
  updateStatus:
    method: PATCH
    path: /sessions/{sessionId}/status
    description: Update session status
    params:
      sessionId: AgentSessionId
    request: UpdateSessionStatusRequest
    response: ApiResponse<AgentSession>
    status_codes:
      200: Status updated
      400: Invalid status transition
      404: Session not found

  # Complete session
  complete:
    method: POST
    path: /sessions/{sessionId}/complete
    description: Mark session as completed
    params:
      sessionId: AgentSessionId
    request: CompleteSessionRequest
    response: ApiResponse<AgentSession>
    status_codes:
      200: Session completed
      400: Session cannot be completed
      404: Session not found

  # Fail session
  fail:
    method: POST
    path: /sessions/{sessionId}/fail
    description: Mark session as failed
    params:
      sessionId: AgentSessionId
    request: FailSessionRequest
    response: ApiResponse<AgentSession>
    status_codes:
      200: Session marked as failed
      404: Session not found

  # Cancel session
  cancel:
    method: POST
    path: /sessions/{sessionId}/cancel
    description: Cancel an active session
    params:
      sessionId: AgentSessionId
    request: CancelSessionRequest
    response: ApiResponse<AgentSession>
    status_codes:
      200: Session cancelled
      400: Session cannot be cancelled
      404: Session not found

  # List sessions by user
  listByUser:
    method: GET
    path: /users/{userId}/sessions
    description: Get sessions for a user
    params:
      userId: UserId
    query:
      status?: AgentSessionStatus
      agentType?: AgentType
      page?: number
      pageSize?: number
    response: ApiResponse<PaginatedResponse<AgentSession>>
    status_codes:
      200: Sessions retrieved
      404: User not found

  # List sessions by customer
  listByCustomer:
    method: GET
    path: /customers/{customerId}/sessions
    description: Get sessions for a customer
    params:
      customerId: CustomerId
    query:
      status?: AgentSessionStatus
      agentType?: AgentType
      page?: number
      pageSize?: number
    response: ApiResponse<PaginatedResponse<AgentSession>>
    status_codes:
      200: Sessions retrieved
      404: Customer not found

  # Get active sessions
  getActive:
    method: GET
    path: /sessions/active
    description: Get all active sessions
    response: ApiResponse<AgentSession[]>
    status_codes:
      200: Active sessions retrieved

# -----------------------------------------------------------------------------
# Invocation Endpoints
# -----------------------------------------------------------------------------

invocations:
  # Invoke agent
  invoke:
    method: POST
    path: /sessions/{sessionId}/invoke
    description: Invoke the agent for a session
    params:
      sessionId: AgentSessionId
    request: InvokeAgentRequest
    response: ApiResponse<AgentInvocation>
    status_codes:
      200: Invocation completed
      400: Invalid input
      404: Session not found
      408: Invocation timeout
      500: Agent error

  # Record tool call
  recordToolCall:
    method: POST
    path: /sessions/{sessionId}/tool-calls
    description: Record a tool call
    params:
      sessionId: AgentSessionId
    request: RecordToolCallRequest
    response: ApiResponse<AgentToolCallRecord>
    status_codes:
      201: Tool call recorded
      404: Session not found

  # Update tool call result
  updateToolCall:
    method: PATCH
    path: /tool-calls/{toolCallId}
    description: Update tool call result
    params:
      toolCallId: ToolCallId
    request: UpdateToolCallRequest
    response: ApiResponse<AgentToolCallRecord>
    status_codes:
      200: Tool call updated
      404: Tool call not found

  # Get session invocations
  getSessionInvocations:
    method: GET
    path: /sessions/{sessionId}/invocations
    description: Get all invocations for a session
    params:
      sessionId: AgentSessionId
    response: ApiResponse<AgentInvocation[]>
    status_codes:
      200: Invocations retrieved
      404: Session not found

# -----------------------------------------------------------------------------
# Workflow Endpoints
# -----------------------------------------------------------------------------

workflows:
  # List workflow templates
  list:
    method: GET
    path: /workflows
    description: List all workflow templates
    response: ApiResponse<AgentWorkflow[]>
    status_codes:
      200: Workflows retrieved

  # Get workflow by ID
  get:
    method: GET
    path: /workflows/{workflowId}
    description: Get a workflow template
    params:
      workflowId: WorkflowId
    response: ApiResponse<AgentWorkflow>
    status_codes:
      200: Workflow found
      404: Workflow not found

  # Start workflow execution
  start:
    method: POST
    path: /workflows/{workflowId}/execute
    description: Start a new workflow execution
    params:
      workflowId: WorkflowId
    request: StartWorkflowRequest
    response: ApiResponse<WorkflowExecution>
    status_codes:
      201: Workflow started
      400: Invalid input
      404: Workflow not found

  # Get execution status
  getExecution:
    method: GET
    path: /executions/{executionId}
    description: Get workflow execution status
    params:
      executionId: WorkflowExecutionId
    response: ApiResponse<WorkflowExecution>
    status_codes:
      200: Execution found
      404: Execution not found

  # Advance workflow
  advance:
    method: POST
    path: /executions/{executionId}/advance
    description: Advance workflow to next step
    params:
      executionId: WorkflowExecutionId
    request: AdvanceWorkflowRequest
    response: ApiResponse<WorkflowExecution>
    status_codes:
      200: Workflow advanced
      400: Cannot advance
      404: Execution not found

  # Pause workflow
  pause:
    method: POST
    path: /executions/{executionId}/pause
    description: Pause workflow execution
    params:
      executionId: WorkflowExecutionId
    request: PauseWorkflowRequest
    response: ApiResponse<WorkflowExecution>
    status_codes:
      200: Workflow paused
      400: Cannot pause
      404: Execution not found

  # Resume workflow
  resume:
    method: POST
    path: /executions/{executionId}/resume
    description: Resume paused workflow
    params:
      executionId: WorkflowExecutionId
    response: ApiResponse<WorkflowExecution>
    status_codes:
      200: Workflow resumed
      400: Workflow not paused
      404: Execution not found

  # Cancel workflow
  cancel:
    method: POST
    path: /executions/{executionId}/cancel
    description: Cancel workflow execution
    params:
      executionId: WorkflowExecutionId
    request: CancelWorkflowRequest
    response: ApiResponse<WorkflowExecution>
    status_codes:
      200: Workflow cancelled
      400: Cannot cancel
      404: Execution not found

  # Retry failed workflow
  retry:
    method: POST
    path: /executions/{executionId}/retry
    description: Retry failed workflow
    params:
      executionId: WorkflowExecutionId
    response: ApiResponse<WorkflowExecution>
    status_codes:
      200: Workflow retrying
      400: Workflow not failed
      404: Execution not found

  # List executions
  listExecutions:
    method: GET
    path: /executions
    description: List workflow executions
    query:
      userId?: UserId
      customerId?: CustomerId
      workflowId?: WorkflowId
      status?: WorkflowExecutionStatus
      page?: number
      pageSize?: number
    response: ApiResponse<PaginatedResponse<WorkflowExecution>>
    status_codes:
      200: Executions retrieved

# -----------------------------------------------------------------------------
# Metrics Endpoints
# -----------------------------------------------------------------------------

metrics:
  # Get agent metrics
  getAgentMetrics:
    method: GET
    path: /metrics/agents
    description: Get aggregated agent metrics
    query:
      userId?: UserId
      customerId?: CustomerId
      agentType?: AgentType
      startDate: ISOTimestamp
      endDate: ISOTimestamp
      granularity?: 'hour' | 'day' | 'week' | 'month'
    response: ApiResponse<AgentMetrics>
    status_codes:
      200: Metrics retrieved
      400: Invalid date range

  # Get latency metrics
  getLatency:
    method: GET
    path: /metrics/latency
    description: Get latency percentiles
    query:
      agentType?: AgentType
      startDate: ISOTimestamp
      endDate: ISOTimestamp
    response: ApiResponse<LatencyMetrics>
    status_codes:
      200: Latency metrics retrieved

  # Get success rate
  getSuccessRate:
    method: GET
    path: /metrics/success-rate
    description: Get success rate metrics
    query:
      agentType?: AgentType
      startDate: ISOTimestamp
      endDate: ISOTimestamp
    response: ApiResponse<SuccessRateMetrics>
    status_codes:
      200: Success rate retrieved

  # Get token usage
  getTokenUsage:
    method: GET
    path: /metrics/tokens
    description: Get token usage metrics
    query:
      userId?: UserId
      customerId?: CustomerId
      startDate: ISOTimestamp
      endDate: ISOTimestamp
    response: ApiResponse<TokenUsageMetrics>
    status_codes:
      200: Token usage retrieved
```

### Request/Response Types

```typescript
// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

// Session Requests
interface CreateSessionRequest {
  agentType: AgentType;
  customerId: CustomerId;
  initialContext: Partial<AgentContext>;
  workflowExecutionId?: WorkflowExecutionId;
  workflowStepNumber?: number;
  timeoutMs?: number;
  metadata?: Record<string, string | number | boolean>;
}

interface UpdateSessionStatusRequest {
  status: AgentSessionStatus;
  reason?: string;
}

interface CompleteSessionRequest {
  result: AgentSessionResult;
}

interface FailSessionRequest {
  error: AgentSessionError;
}

interface CancelSessionRequest {
  reason: string;
}

// Invocation Requests
interface InvokeAgentRequest {
  messages: ConversationMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: ClaudeModel;
}

interface RecordToolCallRequest {
  toolName: string;
  input: Record<string, unknown>;
}

interface UpdateToolCallRequest {
  output?: Record<string, unknown>;
  status: ToolCallStatus;
  error?: string;
  durationMs?: number;
}

// Workflow Requests
interface StartWorkflowRequest {
  customerId: CustomerId;
  initialContext: Partial<AgentContext>;
  timeoutMs?: number;
  startImmediately?: boolean;
}

interface AdvanceWorkflowRequest {
  userInput?: Record<string, unknown>;
  skipCurrentStep?: boolean;
}

interface PauseWorkflowRequest {
  reason: string;
}

interface CancelWorkflowRequest {
  reason: string;
}

// Metrics Responses
interface LatencyMetrics {
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
}

interface SuccessRateMetrics {
  successRate: number;
  totalSessions: number;
  successfulSessions: number;
  failedSessions: number;
  timeoutSessions: number;
}
```

---

## Validation Schemas

```typescript
// =============================================================================
// VALIDATION SCHEMAS (Zod)
// =============================================================================

import { z } from 'zod';

// -----------------------------------------------------------------------------
// ID Schemas
// -----------------------------------------------------------------------------

const AgentSessionIdSchema = z.string().regex(/^sess_[a-f0-9-]{36}$/, 'Invalid session ID format');
const WorkflowIdSchema = z.string().regex(/^wf_[a-f0-9-]{36}$/, 'Invalid workflow ID format');
const WorkflowExecutionIdSchema = z.string().regex(/^wfx_[a-f0-9-]{36}$/, 'Invalid execution ID format');
const ToolCallIdSchema = z.string().regex(/^tc_[a-f0-9-]{36}$/, 'Invalid tool call ID format');
const UserIdSchema = z.string().regex(/^usr_[a-f0-9-]{36}$/, 'Invalid user ID format');
const CustomerIdSchema = z.string().regex(/^cust_[a-f0-9-]{36}$/, 'Invalid customer ID format');
const ClearStoryIdSchema = z.string().regex(/^cs_[a-f0-9-]{36}$/, 'Invalid clear story ID format');
const ArticleIdSchema = z.string().regex(/^art_[a-f0-9-]{36}$/, 'Invalid article ID format');
const RedditPostIdSchema = z.string().regex(/^rp_[a-f0-9-]{36}$/, 'Invalid reddit post ID format');

// -----------------------------------------------------------------------------
// Enum Schemas
// -----------------------------------------------------------------------------

const AgentTypeSchema = z.enum([
  'story_selector',
  'article_generator',
  'reddit_poster',
  'scheduler'
]);

const AgentSessionStatusSchema = z.enum([
  'active',
  'awaiting_input',
  'processing',
  'completed',
  'failed',
  'timeout'
]);

const WorkflowExecutionStatusSchema = z.enum([
  'pending',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'timeout'
]);

const WorkflowStepStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped'
]);

const ToolCallStatusSchema = z.enum([
  'pending',
  'running',
  'success',
  'error'
]);

const ContentToneSchema = z.enum([
  'authoritative',
  'conversational',
  'educational',
  'empathetic',
  'professional'
]);

const ClaudeModelSchema = z.enum([
  'claude-sonnet-4-20250514',
  'claude-opus-4-5-20251101',
  'claude-3-5-haiku-20241022'
]);

// -----------------------------------------------------------------------------
// Timestamp Schema
// -----------------------------------------------------------------------------

const ISOTimestampSchema = z.string().datetime({ message: 'Invalid ISO 8601 timestamp' });

// -----------------------------------------------------------------------------
// Context Schemas
// -----------------------------------------------------------------------------

const BrandGuidelinesContextSchema = z.object({
  companyName: z.string().min(1).max(200),
  productDescription: z.string().min(1).max(2000),
  voiceTone: ContentToneSchema,
  keywords: z.array(z.string().max(100)).max(50),
  avoidTopics: z.array(z.string().max(200)).max(20),
  styleExamples: z.array(z.string().max(5000)).max(5).optional(),
  websiteUrl: z.string().url()
});

const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(100000),
  timestamp: ISOTimestampSchema,
  toolCalls: z.array(z.object({
    toolName: z.string(),
    input: z.record(z.unknown()),
    output: z.record(z.unknown()).optional(),
    startedAt: ISOTimestampSchema,
    completedAt: ISOTimestampSchema.optional(),
    status: ToolCallStatusSchema,
    error: z.string().optional()
  })).optional()
});

const SchedulingPreferencesSchema = z.object({
  timezone: z.string().min(1).max(50),
  preferredDays: z.array(z.number().min(0).max(6)).optional(),
  preferredHours: z.array(z.number().min(0).max(23)).optional(),
  minimumGapMinutes: z.number().min(5).max(1440),
  autoSchedule: z.boolean()
});

const AgentContextSchema = z.object({
  userId: UserIdSchema,
  customerId: CustomerIdSchema,
  clearStoryId: ClearStoryIdSchema.optional(),
  articleId: ArticleIdSchema.optional(),
  redditPostId: RedditPostIdSchema.optional(),
  brandGuidelines: BrandGuidelinesContextSchema,
  conversationHistory: z.array(ConversationMessageSchema).max(100),
  targetSubreddits: z.array(z.string().max(50)).max(10).optional(),
  schedulingPreferences: SchedulingPreferencesSchema.optional(),
  variables: z.record(z.unknown())
});

// -----------------------------------------------------------------------------
// Request Validation Schemas
// -----------------------------------------------------------------------------

const CreateSessionRequestSchema = z.object({
  agentType: AgentTypeSchema,
  customerId: CustomerIdSchema,
  initialContext: AgentContextSchema.partial(),
  workflowExecutionId: WorkflowExecutionIdSchema.optional(),
  workflowStepNumber: z.number().int().min(1).optional(),
  timeoutMs: z.number().int().min(5000).max(3600000).optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const UpdateSessionStatusRequestSchema = z.object({
  status: AgentSessionStatusSchema,
  reason: z.string().max(500).optional()
});

const InvokeAgentRequestSchema = z.object({
  messages: z.array(ConversationMessageSchema).min(1).max(100),
  maxTokens: z.number().int().min(1).max(8192).optional(),
  temperature: z.number().min(0).max(1).optional(),
  model: ClaudeModelSchema.optional()
});

const RecordToolCallRequestSchema = z.object({
  toolName: z.string().min(1).max(100),
  input: z.record(z.unknown())
});

const UpdateToolCallRequestSchema = z.object({
  output: z.record(z.unknown()).optional(),
  status: ToolCallStatusSchema,
  error: z.string().max(5000).optional(),
  durationMs: z.number().int().min(0).optional()
});

const StartWorkflowRequestSchema = z.object({
  customerId: CustomerIdSchema,
  initialContext: AgentContextSchema.partial(),
  timeoutMs: z.number().int().min(60000).max(7200000).optional(),
  startImmediately: z.boolean().optional()
});

const AdvanceWorkflowRequestSchema = z.object({
  userInput: z.record(z.unknown()).optional(),
  skipCurrentStep: z.boolean().optional()
});

// -----------------------------------------------------------------------------
// Agent Input Schemas
// -----------------------------------------------------------------------------

const StorySelectorInputSchema = z.object({
  query: z.string().min(1).max(1000),
  filters: z.object({
    sourceTypes: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    maxAgeDays: z.number().int().min(1).max(365).optional()
  }).optional(),
  maxCandidates: z.number().int().min(1).max(20).optional(),
  includeAlternatives: z.boolean().optional()
});

const ArticleGeneratorInputSchema = z.object({
  clearStoryId: ClearStoryIdSchema,
  articleType: z.enum(['blog_post', 'thought_leadership', 'how_to_guide', 'case_study']),
  wordCountRange: z.object({
    min: z.number().int().min(500).max(5000),
    max: z.number().int().min(500).max(5000)
  }).refine(data => data.max >= data.min, 'max must be >= min'),
  focusKeyword: z.string().max(100).optional(),
  secondaryKeywords: z.array(z.string().max(100)).max(10).optional(),
  angle: z.string().max(500).optional(),
  generateSeoMetadata: z.boolean()
});

const RedditPosterInputSchema = z.object({
  articleId: ArticleIdSchema,
  targetSubreddit: z.string().min(1).max(50),
  postFormat: z.enum(['link_post', 'text_post', 'cross_post']),
  contentStyle: z.enum(['full_summary', 'teaser', 'discussion_starter']),
  maxSummaryWords: z.number().int().min(50).max(1000).optional(),
  action: z.enum(['post_now', 'queue_for_scheduling', 'draft_only'])
});

const SchedulerInputSchema = z.object({
  redditPostIds: z.array(RedditPostIdSchema).min(1).max(50),
  strategy: z.enum(['optimal_engagement', 'spread_evenly', 'asap', 'custom']),
  customSchedule: z.array(z.object({
    postId: RedditPostIdSchema,
    scheduledFor: ISOTimestampSchema
  })).optional(),
  dateRange: z.object({
    startDate: ISOTimestampSchema,
    endDate: ISOTimestampSchema
  }).optional(),
  avoidConflicts: z.boolean()
});

// Export all schemas
export {
  // ID Schemas
  AgentSessionIdSchema,
  WorkflowIdSchema,
  WorkflowExecutionIdSchema,
  ToolCallIdSchema,
  UserIdSchema,
  CustomerIdSchema,

  // Enum Schemas
  AgentTypeSchema,
  AgentSessionStatusSchema,
  WorkflowExecutionStatusSchema,
  WorkflowStepStatusSchema,
  ToolCallStatusSchema,
  ContentToneSchema,
  ClaudeModelSchema,

  // Context Schemas
  AgentContextSchema,
  BrandGuidelinesContextSchema,
  ConversationMessageSchema,
  SchedulingPreferencesSchema,

  // Request Schemas
  CreateSessionRequestSchema,
  UpdateSessionStatusRequestSchema,
  InvokeAgentRequestSchema,
  RecordToolCallRequestSchema,
  UpdateToolCallRequestSchema,
  StartWorkflowRequestSchema,
  AdvanceWorkflowRequestSchema,

  // Agent Input Schemas
  StorySelectorInputSchema,
  ArticleGeneratorInputSchema,
  RedditPosterInputSchema,
  SchedulerInputSchema
};
```

---

## Error Codes

```typescript
// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Domain-specific error codes for the Agent Orchestration domain.
 */
type AgentErrorCode =
  // Session Errors
  | 'SESSION_NOT_FOUND'
  | 'SESSION_ALREADY_COMPLETED'
  | 'SESSION_ALREADY_FAILED'
  | 'SESSION_TIMEOUT'
  | 'SESSION_CANCELLED'
  | 'INVALID_SESSION_STATUS_TRANSITION'

  // Agent Errors
  | 'AGENT_ERROR'
  | 'AGENT_INVOCATION_FAILED'
  | 'AGENT_TIMEOUT'
  | 'AGENT_RATE_LIMITED'
  | 'AGENT_CONTEXT_TOO_LARGE'
  | 'AGENT_INVALID_RESPONSE'

  // Tool Errors
  | 'TOOL_NOT_FOUND'
  | 'TOOL_EXECUTION_FAILED'
  | 'TOOL_TIMEOUT'
  | 'TOOL_INVALID_INPUT'
  | 'TOOL_INVALID_OUTPUT'

  // Workflow Errors
  | 'WORKFLOW_NOT_FOUND'
  | 'WORKFLOW_EXECUTION_NOT_FOUND'
  | 'WORKFLOW_ALREADY_RUNNING'
  | 'WORKFLOW_FAILED'
  | 'WORKFLOW_TIMEOUT'
  | 'WORKFLOW_CANCELLED'
  | 'WORKFLOW_STEP_FAILED'
  | 'WORKFLOW_INVALID_STEP'
  | 'WORKFLOW_CONDITION_NOT_MET'
  | 'WORKFLOW_CANNOT_ADVANCE'
  | 'WORKFLOW_CANNOT_RETRY'

  // Context Errors
  | 'CONTEXT_VALIDATION_FAILED'
  | 'CONTEXT_MISSING_REQUIRED_FIELD'
  | 'BRAND_GUIDELINES_NOT_FOUND'

  // External Service Errors
  | 'CLAUDE_API_ERROR'
  | 'CLAUDE_API_RATE_LIMITED'
  | 'CLAUDE_API_TIMEOUT'
  | 'CLEAR_STORY_SERVICE_ERROR'
  | 'ARTICLE_SERVICE_ERROR'
  | 'REDDIT_SERVICE_ERROR'
  | 'SCHEDULER_SERVICE_ERROR'

  // General Errors
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'QUOTA_EXCEEDED';

/**
 * Error code details with descriptions and recovery actions.
 */
const AgentErrorCodeDetails: Record<AgentErrorCode, {
  httpStatus: number;
  description: string;
  retryable: boolean;
  userAction?: string;
}> = {
  // Session Errors
  SESSION_NOT_FOUND: {
    httpStatus: 404,
    description: 'The specified session does not exist',
    retryable: false,
    userAction: 'Start a new session'
  },
  SESSION_ALREADY_COMPLETED: {
    httpStatus: 400,
    description: 'Session has already been completed',
    retryable: false,
    userAction: 'Start a new session for additional operations'
  },
  SESSION_ALREADY_FAILED: {
    httpStatus: 400,
    description: 'Session has already failed',
    retryable: false,
    userAction: 'Review the error and start a new session'
  },
  SESSION_TIMEOUT: {
    httpStatus: 408,
    description: 'Session exceeded the maximum allowed duration',
    retryable: true,
    userAction: 'Start a new session and try again'
  },
  SESSION_CANCELLED: {
    httpStatus: 400,
    description: 'Session was cancelled',
    retryable: false,
    userAction: 'Start a new session if needed'
  },
  INVALID_SESSION_STATUS_TRANSITION: {
    httpStatus: 400,
    description: 'Invalid status transition for the current session state',
    retryable: false
  },

  // Agent Errors
  AGENT_ERROR: {
    httpStatus: 500,
    description: 'Agent encountered an unexpected error',
    retryable: true,
    userAction: 'Try again in a few moments'
  },
  AGENT_INVOCATION_FAILED: {
    httpStatus: 500,
    description: 'Failed to invoke the Claude agent',
    retryable: true,
    userAction: 'Try again in a few moments'
  },
  AGENT_TIMEOUT: {
    httpStatus: 408,
    description: 'Agent invocation timed out',
    retryable: true,
    userAction: 'Try with a simpler request or try again later'
  },
  AGENT_RATE_LIMITED: {
    httpStatus: 429,
    description: 'Agent API rate limit exceeded',
    retryable: true,
    userAction: 'Wait a moment and try again'
  },
  AGENT_CONTEXT_TOO_LARGE: {
    httpStatus: 400,
    description: 'Context exceeds maximum allowed size',
    retryable: false,
    userAction: 'Reduce the conversation history or context size'
  },
  AGENT_INVALID_RESPONSE: {
    httpStatus: 500,
    description: 'Agent returned an invalid or malformed response',
    retryable: true
  },

  // Tool Errors
  TOOL_NOT_FOUND: {
    httpStatus: 404,
    description: 'The requested tool does not exist',
    retryable: false
  },
  TOOL_EXECUTION_FAILED: {
    httpStatus: 500,
    description: 'Tool execution failed',
    retryable: true
  },
  TOOL_TIMEOUT: {
    httpStatus: 408,
    description: 'Tool execution timed out',
    retryable: true
  },
  TOOL_INVALID_INPUT: {
    httpStatus: 400,
    description: 'Invalid input provided to tool',
    retryable: false
  },
  TOOL_INVALID_OUTPUT: {
    httpStatus: 500,
    description: 'Tool returned invalid output',
    retryable: true
  },

  // Workflow Errors
  WORKFLOW_NOT_FOUND: {
    httpStatus: 404,
    description: 'The specified workflow does not exist',
    retryable: false
  },
  WORKFLOW_EXECUTION_NOT_FOUND: {
    httpStatus: 404,
    description: 'The specified workflow execution does not exist',
    retryable: false
  },
  WORKFLOW_ALREADY_RUNNING: {
    httpStatus: 409,
    description: 'A workflow is already running for this context',
    retryable: false,
    userAction: 'Wait for the current workflow to complete'
  },
  WORKFLOW_FAILED: {
    httpStatus: 500,
    description: 'Workflow execution failed',
    retryable: true,
    userAction: 'Review the error and retry the workflow'
  },
  WORKFLOW_TIMEOUT: {
    httpStatus: 408,
    description: 'Workflow execution exceeded maximum duration',
    retryable: true
  },
  WORKFLOW_CANCELLED: {
    httpStatus: 400,
    description: 'Workflow was cancelled',
    retryable: false
  },
  WORKFLOW_STEP_FAILED: {
    httpStatus: 500,
    description: 'A workflow step failed to execute',
    retryable: true,
    userAction: 'Review step error and retry the workflow'
  },
  WORKFLOW_INVALID_STEP: {
    httpStatus: 400,
    description: 'Invalid workflow step specified',
    retryable: false
  },
  WORKFLOW_CONDITION_NOT_MET: {
    httpStatus: 400,
    description: 'Workflow step condition was not satisfied',
    retryable: false,
    userAction: 'Ensure required context is provided'
  },
  WORKFLOW_CANNOT_ADVANCE: {
    httpStatus: 400,
    description: 'Workflow cannot be advanced in its current state',
    retryable: false
  },
  WORKFLOW_CANNOT_RETRY: {
    httpStatus: 400,
    description: 'Workflow cannot be retried in its current state',
    retryable: false,
    userAction: 'Start a new workflow execution'
  },

  // Context Errors
  CONTEXT_VALIDATION_FAILED: {
    httpStatus: 400,
    description: 'Context validation failed',
    retryable: false,
    userAction: 'Fix the context data and try again'
  },
  CONTEXT_MISSING_REQUIRED_FIELD: {
    httpStatus: 400,
    description: 'Required context field is missing',
    retryable: false,
    userAction: 'Provide the missing field'
  },
  BRAND_GUIDELINES_NOT_FOUND: {
    httpStatus: 404,
    description: 'Brand guidelines not found for customer',
    retryable: false,
    userAction: 'Set up brand guidelines for the customer'
  },

  // External Service Errors
  CLAUDE_API_ERROR: {
    httpStatus: 502,
    description: 'Error communicating with Claude API',
    retryable: true,
    userAction: 'Try again in a few moments'
  },
  CLAUDE_API_RATE_LIMITED: {
    httpStatus: 429,
    description: 'Claude API rate limit exceeded',
    retryable: true,
    userAction: 'Wait and try again'
  },
  CLAUDE_API_TIMEOUT: {
    httpStatus: 504,
    description: 'Claude API request timed out',
    retryable: true
  },
  CLEAR_STORY_SERVICE_ERROR: {
    httpStatus: 502,
    description: 'Error communicating with Clear Story service',
    retryable: true
  },
  ARTICLE_SERVICE_ERROR: {
    httpStatus: 502,
    description: 'Error communicating with Article service',
    retryable: true
  },
  REDDIT_SERVICE_ERROR: {
    httpStatus: 502,
    description: 'Error communicating with Reddit service',
    retryable: true
  },
  SCHEDULER_SERVICE_ERROR: {
    httpStatus: 502,
    description: 'Error communicating with Scheduler service',
    retryable: true
  },

  // General Errors
  VALIDATION_ERROR: {
    httpStatus: 400,
    description: 'Request validation failed',
    retryable: false,
    userAction: 'Check request format and try again'
  },
  INTERNAL_ERROR: {
    httpStatus: 500,
    description: 'An unexpected internal error occurred',
    retryable: true,
    userAction: 'Try again later'
  },
  QUOTA_EXCEEDED: {
    httpStatus: 403,
    description: 'Customer quota exceeded',
    retryable: false,
    userAction: 'Upgrade your plan or wait for quota reset'
  }
};

export { AgentErrorCode, AgentErrorCodeDetails };
```

---

## Integration Points

```typescript
// =============================================================================
// INTEGRATION POINTS
// =============================================================================

/**
 * Events published by the Agent Orchestration domain.
 * Other domains can subscribe to these events for coordination.
 */

// -----------------------------------------------------------------------------
// Session Events
// -----------------------------------------------------------------------------

/**
 * Published when a new agent session is created.
 */
interface SessionStartedEvent {
  eventType: 'orchestration.session.started';
  timestamp: ISOTimestamp;
  payload: {
    sessionId: AgentSessionId;
    agentType: AgentType;
    userId: UserId;
    customerId: CustomerId;
    workflowExecutionId?: WorkflowExecutionId;
    workflowStepNumber?: number;
  };
}

/**
 * Published when a session status changes.
 */
interface SessionStatusChangedEvent {
  eventType: 'orchestration.session.status_changed';
  timestamp: ISOTimestamp;
  payload: {
    sessionId: AgentSessionId;
    previousStatus: AgentSessionStatus;
    newStatus: AgentSessionStatus;
    reason?: string;
  };
}

/**
 * Published when a session completes successfully.
 */
interface SessionCompletedEvent {
  eventType: 'orchestration.session.completed';
  timestamp: ISOTimestamp;
  payload: {
    sessionId: AgentSessionId;
    agentType: AgentType;
    userId: UserId;
    customerId: CustomerId;
    result: AgentSessionResult;
    durationMs: number;
    tokensUsed: number;
  };
}

/**
 * Published when a session fails.
 */
interface SessionFailedEvent {
  eventType: 'orchestration.session.failed';
  timestamp: ISOTimestamp;
  payload: {
    sessionId: AgentSessionId;
    agentType: AgentType;
    userId: UserId;
    customerId: CustomerId;
    error: AgentSessionError;
    durationMs: number;
  };
}

/**
 * Published when a session times out.
 */
interface SessionTimeoutEvent {
  eventType: 'orchestration.session.timeout';
  timestamp: ISOTimestamp;
  payload: {
    sessionId: AgentSessionId;
    agentType: AgentType;
    userId: UserId;
    customerId: CustomerId;
    timeoutAfterMs: number;
  };
}

// -----------------------------------------------------------------------------
// Workflow Events
// -----------------------------------------------------------------------------

/**
 * Published when a workflow execution starts.
 */
interface WorkflowStartedEvent {
  eventType: 'orchestration.workflow.started';
  timestamp: ISOTimestamp;
  payload: {
    executionId: WorkflowExecutionId;
    workflowId: WorkflowId;
    workflowName: string;
    userId: UserId;
    customerId: CustomerId;
    totalSteps: number;
  };
}

/**
 * Published when a workflow step completes.
 */
interface WorkflowStepCompletedEvent {
  eventType: 'orchestration.workflow.step_completed';
  timestamp: ISOTimestamp;
  payload: {
    executionId: WorkflowExecutionId;
    stepNumber: number;
    agentType: AgentType;
    sessionId: AgentSessionId;
    result: unknown;
    durationMs: number;
  };
}

/**
 * Published when a workflow step fails.
 */
interface WorkflowStepFailedEvent {
  eventType: 'orchestration.workflow.step_failed';
  timestamp: ISOTimestamp;
  payload: {
    executionId: WorkflowExecutionId;
    stepNumber: number;
    agentType: AgentType;
    sessionId?: AgentSessionId;
    error: AgentSessionError;
    willRetry: boolean;
    retryCount: number;
  };
}

/**
 * Published when a workflow execution completes.
 */
interface WorkflowCompletedEvent {
  eventType: 'orchestration.workflow.completed';
  timestamp: ISOTimestamp;
  payload: {
    executionId: WorkflowExecutionId;
    workflowId: WorkflowId;
    workflowName: string;
    userId: UserId;
    customerId: CustomerId;
    result: WorkflowExecutionResult;
    totalDurationMs: number;
    totalTokensUsed: number;
  };
}

/**
 * Published when a workflow execution fails.
 */
interface WorkflowFailedEvent {
  eventType: 'orchestration.workflow.failed';
  timestamp: ISOTimestamp;
  payload: {
    executionId: WorkflowExecutionId;
    workflowId: WorkflowId;
    workflowName: string;
    userId: UserId;
    customerId: CustomerId;
    error: WorkflowExecutionError;
    failedAtStep: number;
    totalDurationMs: number;
  };
}

/**
 * Published when a workflow is paused.
 */
interface WorkflowPausedEvent {
  eventType: 'orchestration.workflow.paused';
  timestamp: ISOTimestamp;
  payload: {
    executionId: WorkflowExecutionId;
    currentStep: number;
    reason: string;
  };
}

/**
 * Published when a workflow is resumed.
 */
interface WorkflowResumedEvent {
  eventType: 'orchestration.workflow.resumed';
  timestamp: ISOTimestamp;
  payload: {
    executionId: WorkflowExecutionId;
    currentStep: number;
  };
}

// -----------------------------------------------------------------------------
// Tool Call Events
// -----------------------------------------------------------------------------

/**
 * Published when a tool call completes.
 */
interface ToolCallCompletedEvent {
  eventType: 'orchestration.tool_call.completed';
  timestamp: ISOTimestamp;
  payload: {
    toolCallId: ToolCallId;
    sessionId: AgentSessionId;
    toolName: string;
    success: boolean;
    durationMs: number;
  };
}

// -----------------------------------------------------------------------------
// All Published Events
// -----------------------------------------------------------------------------

type AgentOrchestrationEvent =
  | SessionStartedEvent
  | SessionStatusChangedEvent
  | SessionCompletedEvent
  | SessionFailedEvent
  | SessionTimeoutEvent
  | WorkflowStartedEvent
  | WorkflowStepCompletedEvent
  | WorkflowStepFailedEvent
  | WorkflowCompletedEvent
  | WorkflowFailedEvent
  | WorkflowPausedEvent
  | WorkflowResumedEvent
  | ToolCallCompletedEvent;

// -----------------------------------------------------------------------------
// Events Consumed from Other Domains
// -----------------------------------------------------------------------------

/**
 * Events this domain subscribes to from other domains.
 */

/** From Clear Story Domain */
interface ClearStorySelectedEvent {
  eventType: 'clear_story.selected';
  payload: {
    clearStoryId: ClearStoryId;
    topic: string;
    userId: UserId;
    customerId: CustomerId;
  };
}

/** From Article Domain */
interface ArticleCreatedEvent {
  eventType: 'article.created';
  payload: {
    articleId: ArticleId;
    clearStoryId: ClearStoryId;
    title: string;
    status: ArticleStatus;
    customerId: CustomerId;
  };
}

interface ArticleApprovedEvent {
  eventType: 'article.approved';
  payload: {
    articleId: ArticleId;
    approvedBy: UserId;
    publishedUrl?: string;
  };
}

interface ArticlePublishedEvent {
  eventType: 'article.published';
  payload: {
    articleId: ArticleId;
    publishedUrl: string;
    publishedAt: ISOTimestamp;
  };
}

/** From Reddit Distribution Domain */
interface RedditPostCreatedEvent {
  eventType: 'reddit_post.created';
  payload: {
    redditPostId: RedditPostId;
    articleId: ArticleId;
    subreddit: string;
    status: RedditPostStatus;
  };
}

interface RedditPostPostedEvent {
  eventType: 'reddit_post.posted';
  payload: {
    redditPostId: RedditPostId;
    redditExternalId: string;
    permalink: string;
    postedAt: ISOTimestamp;
  };
}

interface RedditPostFailedEvent {
  eventType: 'reddit_post.failed';
  payload: {
    redditPostId: RedditPostId;
    error: string;
    retryable: boolean;
  };
}

/** From Scheduling Domain */
interface ScheduleExecutedEvent {
  eventType: 'schedule.executed';
  payload: {
    scheduleId: string;
    redditPostId: RedditPostId;
    executedAt: ISOTimestamp;
    success: boolean;
  };
}

interface ScheduleFailedEvent {
  eventType: 'schedule.failed';
  payload: {
    scheduleId: string;
    redditPostId: RedditPostId;
    error: string;
  };
}

/** From User/Customer Domain */
interface CustomerBrandGuidelinesUpdatedEvent {
  eventType: 'customer.brand_guidelines_updated';
  payload: {
    customerId: CustomerId;
    brandGuidelineId: BrandGuidelineId;
    updatedAt: ISOTimestamp;
  };
}

interface CustomerQuotaExceededEvent {
  eventType: 'customer.quota_exceeded';
  payload: {
    customerId: CustomerId;
    quotaType: 'articles' | 'sessions' | 'tokens';
    currentUsage: number;
    limit: number;
  };
}

/**
 * All events consumed by this domain.
 */
type ConsumedEvent =
  | ClearStorySelectedEvent
  | ArticleCreatedEvent
  | ArticleApprovedEvent
  | ArticlePublishedEvent
  | RedditPostCreatedEvent
  | RedditPostPostedEvent
  | RedditPostFailedEvent
  | ScheduleExecutedEvent
  | ScheduleFailedEvent
  | CustomerBrandGuidelinesUpdatedEvent
  | CustomerQuotaExceededEvent;

// -----------------------------------------------------------------------------
// Event Handler Interface
// -----------------------------------------------------------------------------

/**
 * Interface for handling consumed events.
 */
interface IAgentOrchestrationEventHandler {
  /**
   * Handle a Clear Story selection event.
   * May trigger workflow continuation if waiting for story selection.
   */
  handleClearStorySelected(event: ClearStorySelectedEvent): Promise<void>;

  /**
   * Handle an Article creation event.
   * Updates workflow context with created article.
   */
  handleArticleCreated(event: ArticleCreatedEvent): Promise<void>;

  /**
   * Handle an Article approval event.
   * May trigger workflow continuation for Reddit posting.
   */
  handleArticleApproved(event: ArticleApprovedEvent): Promise<void>;

  /**
   * Handle an Article published event.
   * Updates workflow context with published URL.
   */
  handleArticlePublished(event: ArticlePublishedEvent): Promise<void>;

  /**
   * Handle a Reddit Post creation event.
   * Updates workflow context with created post.
   */
  handleRedditPostCreated(event: RedditPostCreatedEvent): Promise<void>;

  /**
   * Handle a Reddit Post posted event.
   * May complete workflow if this was the final step.
   */
  handleRedditPostPosted(event: RedditPostPostedEvent): Promise<void>;

  /**
   * Handle a Reddit Post failure event.
   * May trigger retry logic or fail the workflow.
   */
  handleRedditPostFailed(event: RedditPostFailedEvent): Promise<void>;

  /**
   * Handle a Schedule execution event.
   * Updates workflow tracking for scheduled posts.
   */
  handleScheduleExecuted(event: ScheduleExecutedEvent): Promise<void>;

  /**
   * Handle a Schedule failure event.
   * May trigger retry or notification.
   */
  handleScheduleFailed(event: ScheduleFailedEvent): Promise<void>;

  /**
   * Handle brand guidelines update event.
   * Invalidates cached guidelines for active sessions.
   */
  handleBrandGuidelinesUpdated(event: CustomerBrandGuidelinesUpdatedEvent): Promise<void>;

  /**
   * Handle customer quota exceeded event.
   * Pauses active sessions/workflows for the customer.
   */
  handleQuotaExceeded(event: CustomerQuotaExceededEvent): Promise<void>;
}

export {
  // Published Events
  SessionStartedEvent,
  SessionStatusChangedEvent,
  SessionCompletedEvent,
  SessionFailedEvent,
  SessionTimeoutEvent,
  WorkflowStartedEvent,
  WorkflowStepCompletedEvent,
  WorkflowStepFailedEvent,
  WorkflowCompletedEvent,
  WorkflowFailedEvent,
  WorkflowPausedEvent,
  WorkflowResumedEvent,
  ToolCallCompletedEvent,
  AgentOrchestrationEvent,

  // Consumed Events
  ClearStorySelectedEvent,
  ArticleCreatedEvent,
  ArticleApprovedEvent,
  ArticlePublishedEvent,
  RedditPostCreatedEvent,
  RedditPostPostedEvent,
  RedditPostFailedEvent,
  ScheduleExecutedEvent,
  ScheduleFailedEvent,
  CustomerBrandGuidelinesUpdatedEvent,
  CustomerQuotaExceededEvent,
  ConsumedEvent,

  // Handler Interface
  IAgentOrchestrationEventHandler
};
```

---

## Predefined Workflows

```typescript
// =============================================================================
// PREDEFINED WORKFLOWS
// =============================================================================

/**
 * Standard workflow definitions shipped with the platform.
 */

/**
 * Full Content Pipeline Workflow
 * Story Selection -> Article Generation -> Reddit Posting -> Scheduling
 */
const FULL_CONTENT_PIPELINE_WORKFLOW: AgentWorkflow = {
  id: 'wf_full-content-pipeline' as WorkflowId,
  name: 'Full Content Pipeline',
  description: 'Complete workflow from story selection through scheduled Reddit distribution',
  isActive: true,
  defaultTimeoutMs: 300000, // 5 minutes
  retryConfig: {
    maxRetries: 2,
    retryDelayMs: 5000,
    exponentialBackoff: true,
    maxRetryDelayMs: 30000
  },
  steps: [
    {
      stepNumber: 1,
      agentType: 'story_selector',
      name: 'Select Clear Story',
      description: 'Find the most relevant Clear Story for the content request',
      continueOnFailure: false,
      maxRetries: 2,
      inputMapping: {
        'query': 'context.initialQuery',
        'filters': 'context.storyFilters'
      },
      outputMapping: {
        'clearStoryId': 'result.selectedStory.id',
        'storyTopic': 'result.selectedStory.topic'
      }
    },
    {
      stepNumber: 2,
      agentType: 'article_generator',
      name: 'Generate Article',
      description: 'Generate a blog article from the selected Clear Story',
      conditions: [
        { field: 'context.clearStoryId', operator: 'exists' }
      ],
      continueOnFailure: false,
      timeoutMs: ARTICLE_GENERATION_TIMEOUT_MS,
      maxRetries: 2,
      inputMapping: {
        'clearStoryId': 'context.clearStoryId',
        'articleType': 'context.articleType',
        'wordCountRange': 'context.wordCountRange'
      },
      outputMapping: {
        'articleId': 'result.article.id',
        'articleTitle': 'result.article.title'
      }
    },
    {
      stepNumber: 3,
      agentType: 'reddit_poster',
      name: 'Create Reddit Post',
      description: 'Create a Reddit post summarizing the article',
      conditions: [
        { field: 'context.articleId', operator: 'exists' }
      ],
      continueOnFailure: false,
      maxRetries: 2,
      inputMapping: {
        'articleId': 'context.articleId',
        'targetSubreddit': 'context.targetSubreddits[0]',
        'postFormat': 'context.postFormat',
        'action': 'context.postAction'
      },
      outputMapping: {
        'redditPostId': 'result.redditPost.id'
      }
    },
    {
      stepNumber: 4,
      agentType: 'scheduler',
      name: 'Schedule Distribution',
      description: 'Schedule the Reddit post for optimal timing',
      conditions: [
        { field: 'context.redditPostId', operator: 'exists' },
        { field: 'context.schedulingPreferences.autoSchedule', operator: 'equals', value: true }
      ],
      continueOnFailure: true, // Workflow succeeds even if scheduling fails
      maxRetries: 1,
      inputMapping: {
        'redditPostIds': '[context.redditPostId]',
        'strategy': 'context.schedulingStrategy',
        'avoidConflicts': 'true'
      },
      outputMapping: {
        'scheduledFor': 'result.scheduledFor'
      }
    }
  ],
  audit: {
    createdAt: '2026-01-18T00:00:00Z' as ISOTimestamp,
    createdBy: { id: 'usr_system' as UserId, email: 'system@leo.ai', displayName: 'System' },
    updatedAt: '2026-01-18T00:00:00Z' as ISOTimestamp,
    updatedBy: { id: 'usr_system' as UserId, email: 'system@leo.ai', displayName: 'System' }
  }
};

/**
 * Article Only Workflow
 * Story Selection -> Article Generation (no distribution)
 */
const ARTICLE_ONLY_WORKFLOW: AgentWorkflow = {
  id: 'wf_article-only' as WorkflowId,
  name: 'Article Generation Only',
  description: 'Generate an article from a Clear Story without distribution',
  isActive: true,
  defaultTimeoutMs: 120000, // 2 minutes
  retryConfig: {
    maxRetries: 2,
    retryDelayMs: 5000,
    exponentialBackoff: true,
    maxRetryDelayMs: 30000
  },
  steps: [
    {
      stepNumber: 1,
      agentType: 'story_selector',
      name: 'Select Clear Story',
      description: 'Find the most relevant Clear Story',
      continueOnFailure: false,
      maxRetries: 2,
      inputMapping: {
        'query': 'context.initialQuery'
      },
      outputMapping: {
        'clearStoryId': 'result.selectedStory.id'
      }
    },
    {
      stepNumber: 2,
      agentType: 'article_generator',
      name: 'Generate Article',
      description: 'Generate a blog article',
      conditions: [
        { field: 'context.clearStoryId', operator: 'exists' }
      ],
      continueOnFailure: false,
      timeoutMs: ARTICLE_GENERATION_TIMEOUT_MS,
      maxRetries: 2,
      inputMapping: {
        'clearStoryId': 'context.clearStoryId'
      },
      outputMapping: {
        'articleId': 'result.article.id'
      }
    }
  ],
  audit: {
    createdAt: '2026-01-18T00:00:00Z' as ISOTimestamp,
    createdBy: { id: 'usr_system' as UserId, email: 'system@leo.ai', displayName: 'System' },
    updatedAt: '2026-01-18T00:00:00Z' as ISOTimestamp,
    updatedBy: { id: 'usr_system' as UserId, email: 'system@leo.ai', displayName: 'System' }
  }
};

/**
 * Reddit Distribution Workflow
 * Takes an existing article and distributes to Reddit
 */
const REDDIT_DISTRIBUTION_WORKFLOW: AgentWorkflow = {
  id: 'wf_reddit-distribution' as WorkflowId,
  name: 'Reddit Distribution',
  description: 'Distribute an existing article to Reddit',
  isActive: true,
  defaultTimeoutMs: 120000, // 2 minutes
  retryConfig: {
    maxRetries: 3,
    retryDelayMs: REDDIT_POST_RETRY_DELAY_MS,
    exponentialBackoff: false,
    maxRetryDelayMs: 180000
  },
  steps: [
    {
      stepNumber: 1,
      agentType: 'reddit_poster',
      name: 'Create Reddit Post',
      description: 'Create and optionally post to Reddit',
      conditions: [
        { field: 'context.articleId', operator: 'exists' }
      ],
      continueOnFailure: false,
      maxRetries: REDDIT_POST_MAX_RETRIES,
      inputMapping: {
        'articleId': 'context.articleId',
        'targetSubreddit': 'context.targetSubreddits[0]'
      },
      outputMapping: {
        'redditPostId': 'result.redditPost.id'
      }
    },
    {
      stepNumber: 2,
      agentType: 'scheduler',
      name: 'Schedule Post',
      description: 'Schedule the post for optimal timing',
      conditions: [
        { field: 'context.redditPostId', operator: 'exists' },
        { field: 'context.postAction', operator: 'equals', value: 'queue_for_scheduling' }
      ],
      continueOnFailure: true,
      maxRetries: 1,
      inputMapping: {
        'redditPostIds': '[context.redditPostId]',
        'strategy': 'optimal_engagement'
      },
      outputMapping: {
        'scheduledFor': 'result.scheduledFor'
      }
    }
  ],
  audit: {
    createdAt: '2026-01-18T00:00:00Z' as ISOTimestamp,
    createdBy: { id: 'usr_system' as UserId, email: 'system@leo.ai', displayName: 'System' },
    updatedAt: '2026-01-18T00:00:00Z' as ISOTimestamp,
    updatedBy: { id: 'usr_system' as UserId, email: 'system@leo.ai', displayName: 'System' }
  }
};

export {
  FULL_CONTENT_PIPELINE_WORKFLOW,
  ARTICLE_ONLY_WORKFLOW,
  REDDIT_DISTRIBUTION_WORKFLOW
};
```

---

## Database Schema

```sql
-- =============================================================================
-- DATABASE SCHEMA
-- =============================================================================

-- Agent Sessions Table
CREATE TABLE agent_sessions (
    id VARCHAR(50) PRIMARY KEY,  -- sess_uuid format
    agent_type VARCHAR(30) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    timeout_at TIMESTAMP WITH TIME ZONE NOT NULL,
    context JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    error JSONB,
    workflow_execution_id VARCHAR(50),
    workflow_step_number INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(50) NOT NULL,

    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_session_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_session_workflow_execution FOREIGN KEY (workflow_execution_id)
        REFERENCES workflow_executions(id)
);

-- Indexes for agent_sessions
CREATE INDEX idx_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX idx_sessions_customer_id ON agent_sessions(customer_id);
CREATE INDEX idx_sessions_status ON agent_sessions(status);
CREATE INDEX idx_sessions_agent_type ON agent_sessions(agent_type);
CREATE INDEX idx_sessions_workflow_execution ON agent_sessions(workflow_execution_id);
CREATE INDEX idx_sessions_timeout ON agent_sessions(timeout_at) WHERE status IN ('active', 'processing');
CREATE INDEX idx_sessions_customer_created ON agent_sessions(customer_id, created_at DESC);

-- Tool Calls Table
CREATE TABLE tool_calls (
    id VARCHAR(50) PRIMARY KEY,  -- tc_uuid format
    session_id VARCHAR(50) NOT NULL,
    sequence_number INTEGER NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,

    CONSTRAINT fk_tool_call_session FOREIGN KEY (session_id) REFERENCES agent_sessions(id)
);

-- Indexes for tool_calls
CREATE INDEX idx_tool_calls_session ON tool_calls(session_id);
CREATE INDEX idx_tool_calls_session_sequence ON tool_calls(session_id, sequence_number);
CREATE INDEX idx_tool_calls_tool_name ON tool_calls(tool_name);

-- Agent Invocations Table
CREATE TABLE agent_invocations (
    id VARCHAR(50) PRIMARY KEY,  -- inv_uuid format
    session_id VARCHAR(50) NOT NULL,
    sequence_number INTEGER NOT NULL,
    model VARCHAR(50) NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    error TEXT,
    cache_status VARCHAR(20),
    cached_tokens INTEGER DEFAULT 0,

    CONSTRAINT fk_invocation_session FOREIGN KEY (session_id) REFERENCES agent_sessions(id)
);

-- Indexes for agent_invocations
CREATE INDEX idx_invocations_session ON agent_invocations(session_id);
CREATE INDEX idx_invocations_model ON agent_invocations(model);
CREATE INDEX idx_invocations_started ON agent_invocations(started_at);

-- Workflows Table
CREATE TABLE workflows (
    id VARCHAR(50) PRIMARY KEY,  -- wf_uuid format
    name VARCHAR(200) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    default_timeout_ms INTEGER NOT NULL DEFAULT 300000,
    retry_config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(50) NOT NULL
);

-- Indexes for workflows
CREATE INDEX idx_workflows_active ON workflows(is_active) WHERE is_active = true;

-- Workflow Executions Table
CREATE TABLE workflow_executions (
    id VARCHAR(50) PRIMARY KEY,  -- wfx_uuid format
    workflow_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    current_step_number INTEGER NOT NULL DEFAULT 1,
    steps JSONB NOT NULL DEFAULT '[]',
    context JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    timeout_at TIMESTAMP WITH TIME ZONE NOT NULL,
    result JSONB,
    error JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(50) NOT NULL,

    CONSTRAINT fk_execution_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id),
    CONSTRAINT fk_execution_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_execution_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Indexes for workflow_executions
CREATE INDEX idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_executions_user ON workflow_executions(user_id);
CREATE INDEX idx_executions_customer ON workflow_executions(customer_id);
CREATE INDEX idx_executions_status ON workflow_executions(status);
CREATE INDEX idx_executions_timeout ON workflow_executions(timeout_at)
    WHERE status IN ('pending', 'running', 'paused');
CREATE INDEX idx_executions_customer_created ON workflow_executions(customer_id, created_at DESC);
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-18 | Initial contract definition |

---

## Appendix: Type Exports

```typescript
// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Re-export all types for consumers
export type {
  // Identity Types
  WorkflowId,
  WorkflowExecutionId,
  ToolCallId,
  InvocationId,

  // Enums
  ClaudeModel,
  WorkflowStepStatus,
  ToolCallStatus,
  WorkflowExecutionStatus,
  AgentErrorCode,

  // Core Types
  AgentSession,
  AgentContext,
  AgentWorkflow,
  WorkflowExecution,
  WorkflowStepDefinition,
  WorkflowStepExecution,
  WorkflowCondition,
  WorkflowRetryConfig,
  AgentInvocation,
  AgentToolCallRecord,

  // Result Types
  AgentSessionResult,
  StorySelectorResult,
  ArticleGeneratorResult,
  RedditPosterResult,
  SchedulerResult,
  WorkflowExecutionResult,

  // Error Types
  AgentSessionError,
  WorkflowExecutionError,

  // Context Types
  BrandGuidelinesContext,
  ConversationMessage,
  SchedulingPreferences,

  // Input Types
  CreateSessionInput,
  StartWorkflowInput,
  AdvanceWorkflowInput,
  UpdateSessionStatusInput,
  StorySelectorInput,
  ArticleGeneratorInput,
  RedditPosterInput,
  SchedulerInput,

  // Query Types
  SessionQueryFilters,
  WorkflowQueryFilters,
  MetricsQueryFilters,

  // Metrics Types
  AgentMetrics,
  TokenUsageMetrics,

  // Service Interfaces
  IAgentOrchestrationService,
  IAgent,
  IStorySelectorAgent,
  IArticleGeneratorAgent,
  IRedditPosterAgent,
  ISchedulerAgent,

  // Repository Interfaces
  IAgentSessionRepository,
  IAgentWorkflowRepository,
  IWorkflowExecutionRepository,
  IAgentInvocationRepository,

  // Event Types
  AgentOrchestrationEvent,
  ConsumedEvent,
  IAgentOrchestrationEventHandler
};
```
