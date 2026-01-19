/**
 * Agent Orchestration Domain Types
 *
 * This file defines all types, interfaces, and enums for the Agent Orchestration
 * domain of the GEO Platform. It manages Claude agent coordination,
 * tool execution, context management, and workflow state.
 *
 * @version 1.0.0
 * @domain Agent Orchestration
 * @owner Platform Team
 */

// =============================================================================
// IMPORTS FROM SHARED PRIMITIVES
// =============================================================================

import type {
  // Identity Types
  UserId,
  CustomerId,
  ClearStoryId,
  ArticleId,
  RedditPostId,
  // Enums/Types
  ContentTone,
  // Cross-References
  ClearStoryRef,
  // Shared Patterns
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  AuditInfo,
  ISOTimestamp,
} from '../../shared/shared.types.js';

// Re-export imported types for convenience
export type {
  UserId,
  CustomerId,
  ClearStoryId,
  ArticleId,
  RedditPostId,
  ContentTone,
  ClearStoryRef,
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  AuditInfo,
  ISOTimestamp,
};

// =============================================================================
// DOMAIN-SPECIFIC BRANDED ID TYPES
// =============================================================================

/**
 * Unique identifier for agent workflow sessions.
 * Format: sess_${uuid}
 */
export type AgentSessionId = string & { readonly __brand: 'AgentSessionId' };

/**
 * Unique identifier for brand guideline documents.
 * Format: bg_${uuid}
 */
export type BrandGuidelineId = string & { readonly __brand: 'BrandGuidelineId' };

/**
 * Unique identifier for an agent workflow.
 * Format: wf_${uuid}
 */
export type WorkflowId = `wf_${string}`;

/**
 * Unique identifier for a workflow execution instance.
 * Format: wfx_${uuid}
 */
export type WorkflowExecutionId = `wfx_${string}`;

/**
 * Unique identifier for a tool call within a session.
 * Format: tc_${uuid}
 */
export type ToolCallId = `tc_${string}`;

/**
 * Unique identifier for an agent invocation.
 * Format: inv_${uuid}
 */
export type InvocationId = `inv_${string}`;

// =============================================================================
// DOMAIN-SPECIFIC ENUMS AND TYPE UNIONS
// =============================================================================

/**
 * Types of Claude agents in the system.
 */
export type AgentType =
  | 'story_selector'      // Helps user find appropriate Clear Story
  | 'article_generator'   // Generates blog articles from Clear Stories
  | 'reddit_poster'       // Creates and posts Reddit summaries
  | 'scheduler';          // Manages posting queue and timing

/**
 * States for agent workflow sessions.
 */
export type AgentSessionStatus =
  | 'active'          // Session in progress
  | 'awaiting_input'  // Waiting for user input
  | 'processing'      // Agent executing tools
  | 'completed'       // Session finished successfully
  | 'failed'          // Session encountered error
  | 'timeout';        // Session timed out

/**
 * Lifecycle states for generated articles.
 */
export type ArticleStatus =
  | 'draft'              // Initial generation, not reviewed
  | 'review'             // Under human review
  | 'revision_requested' // User requested changes/regeneration
  | 'approved'           // Approved for distribution
  | 'published'          // Published to customer's blog/site
  | 'archived';          // No longer active

/**
 * Lifecycle states for Reddit distribution.
 */
export type RedditPostStatus =
  | 'pending_approval'  // Generated, awaiting human approval
  | 'approved'          // Approved, ready for posting
  | 'queued'            // In scheduler queue
  | 'posting'           // Currently being posted
  | 'posted'            // Successfully posted to Reddit
  | 'failed'            // Post attempt failed
  | 'removed'           // Removed by Reddit/moderators
  | 'deleted';          // Deleted by user

/**
 * Supported Claude models for agent invocations.
 */
export type ClaudeModel =
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-5-20251101'
  | 'claude-3-5-haiku-20241022';

/**
 * Status of a workflow step execution.
 */
export type WorkflowStepStatus =
  | 'pending'      // Not yet started
  | 'in_progress'  // Currently executing
  | 'completed'    // Successfully finished
  | 'failed'       // Execution failed
  | 'skipped';     // Skipped due to condition

/**
 * Tool execution status within a session.
 */
export type ToolCallStatus =
  | 'pending'   // Queued for execution
  | 'running'   // Currently executing
  | 'success'   // Completed successfully
  | 'error';    // Failed with error

/**
 * Status of a workflow execution.
 */
export type WorkflowExecutionStatus =
  | 'pending'       // Created but not started
  | 'running'       // Currently executing
  | 'paused'        // Paused (awaiting input or manual resume)
  | 'completed'     // All steps completed successfully
  | 'failed'        // Execution failed
  | 'cancelled'     // Cancelled by user
  | 'timeout';      // Execution timed out

/**
 * Domain-specific error codes for the Agent Orchestration domain.
 */
export type AgentErrorCode =
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

// =============================================================================
// CROSS-DOMAIN REFERENCES
// =============================================================================

/**
 * Reference to Brand Guidelines from the User/Customer domain.
 * Used for context when generating content.
 */
export interface BrandGuidelineRef {
  id: BrandGuidelineId;
  companyName: string;
  voiceTone: ContentTone;
  keywords: string[];
}

/**
 * Minimal article reference for scheduling and analytics.
 */
export interface ArticleRef {
  id: ArticleId;
  title: string;
  status: ArticleStatus;
  publishedUrl?: string;
}

/**
 * Minimal Reddit post reference for analytics.
 */
export interface RedditPostRef {
  id: RedditPostId;
  redditExternalId?: string;
  subreddit: string;
  status: RedditPostStatus;
  permalink?: string;
}

/**
 * Minimal session reference for tracking.
 */
export interface AgentSessionRef {
  id: AgentSessionId;
  agentType: AgentType;
  status: AgentSessionStatus;
  startedAt: ISOTimestamp;
}

// =============================================================================
// AGENT TOOL CALL INTERFACE
// =============================================================================

/**
 * Agent tool call tracking structure.
 */
export interface AgentToolCall {
  toolName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedAt: ISOTimestamp;
  completedAt?: ISOTimestamp;
  status: ToolCallStatus;
  error?: string;
}

// =============================================================================
// AGENT CONTEXT INTERFACES
// =============================================================================

/**
 * Brand guidelines context for content generation.
 */
export interface BrandGuidelinesContext {
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
export interface ConversationMessage {
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
export interface SchedulingPreferences {
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

/**
 * Context object passed between agents and maintained throughout a workflow.
 * Contains all information needed for agents to perform their tasks.
 */
export interface AgentContext {
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

// =============================================================================
// TOOL CALL INTERFACES
// =============================================================================

/**
 * Extended tool call record with additional tracking fields.
 */
export interface AgentToolCallRecord extends AgentToolCall {
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

/**
 * Definition of a tool available to agents.
 */
export interface ToolDefinition {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** JSON Schema for input parameters */
  inputSchema: Record<string, unknown>;
}

// =============================================================================
// AGENT SESSION INTERFACES
// =============================================================================

/**
 * Represents a single agent session - one invocation of a Claude agent
 * to perform a specific task within the platform.
 *
 * Sessions track the complete lifecycle from creation to completion,
 * including all tool calls, context, and results.
 */
export interface AgentSession {
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

// =============================================================================
// SESSION RESULT INTERFACES
// =============================================================================

/**
 * Result from the Story Selector agent.
 */
export interface StorySelectorResult {
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
export interface ArticleGeneratorResult {
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
export interface RedditPosterResult {
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
export interface SchedulerResult {
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
 * Result of a successfully completed agent session.
 */
export interface AgentSessionResult {
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
 * Error information for a failed session.
 */
export interface AgentSessionError {
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

// =============================================================================
// AGENT INVOCATION INTERFACES
// =============================================================================

/**
 * Input structure for a Claude invocation.
 */
export interface AgentInvocationInput {
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
export interface AgentInvocationOutput {
  /** Generated text response */
  textResponse?: string;
  /** Tool calls requested by the model */
  toolCalls?: AgentToolCall[];
  /** Stop reason */
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

/**
 * Detailed record of a single Claude API invocation.
 * Used for tracking, debugging, and cost analysis.
 */
export interface AgentInvocation {
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

// =============================================================================
// WORKFLOW DEFINITION INTERFACES
// =============================================================================

/**
 * Condition for workflow step execution.
 */
export interface WorkflowCondition {
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
export interface WorkflowRetryConfig {
  /** Maximum retry attempts for failed steps */
  maxRetries: number;
  /** Base delay between retries in milliseconds */
  retryDelayMs: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
  /** Maximum delay between retries */
  maxRetryDelayMs: number;
}

/**
 * Definition of a single step within a workflow template.
 */
export interface WorkflowStepDefinition {
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
 * Defines a workflow template - a sequence of agent steps to accomplish
 * a complex task like full content generation and distribution.
 */
export interface AgentWorkflow {
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

// =============================================================================
// WORKFLOW EXECUTION INTERFACES
// =============================================================================

/**
 * Execution state for a single workflow step.
 */
export interface WorkflowStepExecution {
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
export interface WorkflowExecutionResult {
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
export interface WorkflowExecutionError {
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

/**
 * Represents a running instance of a workflow.
 * Tracks progress through workflow steps and maintains execution state.
 */
export interface WorkflowExecution {
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

// =============================================================================
// INPUT/OUTPUT TYPES
// =============================================================================

/**
 * Input for creating a new agent session.
 */
export interface CreateSessionInput {
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
export interface StartWorkflowInput {
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
export interface AdvanceWorkflowInput {
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
export interface UpdateSessionStatusInput {
  /** Session ID to update */
  sessionId: AgentSessionId;
  /** New status */
  status: AgentSessionStatus;
  /** Reason for status change */
  reason?: string;
}

// =============================================================================
// QUERY FILTER INTERFACES
// =============================================================================

/**
 * Session query filters.
 */
export interface SessionQueryFilters {
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
export interface WorkflowQueryFilters {
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

/**
 * Filters for metrics queries.
 */
export interface MetricsQueryFilters {
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

// =============================================================================
// METRICS INTERFACES
// =============================================================================

/**
 * Aggregated agent performance metrics.
 */
export interface AgentMetrics {
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
  timeSeries: Array<{
    timestamp: ISOTimestamp;
    sessions: number;
    successRate: number;
    averageLatencyMs: number;
    tokensUsed: number;
  }>;
}

/**
 * Token usage metrics.
 */
export interface TokenUsageMetrics {
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

/**
 * Latency metrics.
 */
export interface LatencyMetrics {
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
}

/**
 * Success rate metrics.
 */
export interface SuccessRateMetrics {
  successRate: number;
  totalSessions: number;
  successfulSessions: number;
  failedSessions: number;
  timeoutSessions: number;
}

// =============================================================================
// AGENT INPUT INTERFACES
// =============================================================================

/**
 * Input for the Story Selector agent.
 */
export interface StorySelectorInput {
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
 * Input for the Article Generator agent.
 */
export interface ArticleGeneratorInput {
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
 * Input for the Reddit Poster agent.
 */
export interface RedditPosterInput {
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
 * Input for the Scheduler agent.
 */
export interface SchedulerInput {
  /** Reddit posts to schedule */
  redditPostIds: RedditPostId[];
  /** Scheduling strategy */
  strategy: 'optimal_engagement' | 'spread_evenly' | 'asap' | 'custom';
  /** Custom schedule (for 'custom' strategy) */
  customSchedule?: Array<{
    postId: RedditPostId;
    scheduledFor: ISOTimestamp;
  }>;
  /** Date range for scheduling */
  dateRange?: {
    startDate: ISOTimestamp;
    endDate: ISOTimestamp;
  };
  /** Whether to respect existing scheduled posts */
  avoidConflicts: boolean;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Request to create a new session.
 */
export interface CreateSessionRequest {
  agentType: AgentType;
  customerId: CustomerId;
  initialContext: Partial<AgentContext>;
  workflowExecutionId?: WorkflowExecutionId;
  workflowStepNumber?: number;
  timeoutMs?: number;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Request to update session status.
 */
export interface UpdateSessionStatusRequest {
  status: AgentSessionStatus;
  reason?: string;
}

/**
 * Request to complete a session.
 */
export interface CompleteSessionRequest {
  result: AgentSessionResult;
}

/**
 * Request to fail a session.
 */
export interface FailSessionRequest {
  error: AgentSessionError;
}

/**
 * Request to cancel a session.
 */
export interface CancelSessionRequest {
  reason: string;
}

/**
 * Request to invoke an agent.
 */
export interface InvokeAgentRequest {
  messages: ConversationMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: ClaudeModel;
}

/**
 * Request to record a tool call.
 */
export interface RecordToolCallRequest {
  toolName: string;
  input: Record<string, unknown>;
}

/**
 * Request to update a tool call.
 */
export interface UpdateToolCallRequest {
  output?: Record<string, unknown>;
  status: ToolCallStatus;
  error?: string;
  durationMs?: number;
}

/**
 * Request to start a workflow.
 */
export interface StartWorkflowRequest {
  customerId: CustomerId;
  initialContext: Partial<AgentContext>;
  timeoutMs?: number;
  startImmediately?: boolean;
}

/**
 * Request to advance a workflow.
 */
export interface AdvanceWorkflowRequest {
  userInput?: Record<string, unknown>;
  skipCurrentStep?: boolean;
}

/**
 * Request to pause a workflow.
 */
export interface PauseWorkflowRequest {
  reason: string;
}

/**
 * Request to cancel a workflow.
 */
export interface CancelWorkflowRequest {
  reason: string;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Main service interface for the Agent Orchestration domain.
 * Provides all operations for managing agent sessions and workflows.
 */
export interface IAgentOrchestrationService {
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
   * @param filters - Optional query filters
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
   * @param filters - Optional query filters
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

// =============================================================================
// AGENT INTERFACES
// =============================================================================

/**
 * Base interface that all Claude agents must implement.
 * Provides common functionality for session management and invocation.
 */
export interface IAgent {
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

/**
 * Interface for the Story Selector agent.
 * Helps users find the most relevant Clear Story for their content needs.
 *
 * Tools available to this agent:
 * - search_clear_stories: Search the belief library
 * - get_clear_story_details: Get full details of a story
 * - compare_stories: Compare multiple stories for relevance
 */
export interface IStorySelectorAgent extends IAgent {
  readonly agentType: 'story_selector';

  /**
   * Searches for relevant Clear Stories based on user query.
   * @param session - Current session
   * @param input - Story selection input
   * @returns Selected story with reasoning
   */
  process(session: AgentSession, input: StorySelectorInput): Promise<AgentSessionResult>;
}

/**
 * Interface for the Article Generator agent.
 * Generates blog articles from Clear Stories.
 *
 * Tools available to this agent:
 * - get_clear_story: Retrieve the source Clear Story
 * - get_brand_guidelines: Get customer brand guidelines
 * - create_article_draft: Save a draft article
 * - check_keyword_density: Analyze keyword usage
 * - generate_seo_metadata: Generate title/description
 */
export interface IArticleGeneratorAgent extends IAgent {
  readonly agentType: 'article_generator';

  /**
   * Generates an article based on a Clear Story.
   * @param session - Current session
   * @param input - Article generation input
   * @returns Generated article
   */
  process(session: AgentSession, input: ArticleGeneratorInput): Promise<AgentSessionResult>;
}

/**
 * Interface for the Reddit Poster agent.
 * Creates and posts Reddit summaries of articles.
 *
 * Tools available to this agent:
 * - get_article: Retrieve the source article
 * - get_subreddit_rules: Get subreddit posting rules
 * - analyze_subreddit_style: Analyze successful posts
 * - create_reddit_draft: Create a draft post
 * - submit_to_reddit: Actually post to Reddit
 * - queue_for_scheduling: Add to the scheduling queue
 */
export interface IRedditPosterAgent extends IAgent {
  readonly agentType: 'reddit_poster';

  /**
   * Creates a Reddit post for an article.
   * @param session - Current session
   * @param input - Reddit posting input
   * @returns Created Reddit post
   */
  process(session: AgentSession, input: RedditPosterInput): Promise<AgentSessionResult>;
}

/**
 * Interface for the Scheduler agent.
 * Manages posting queue and timing for Reddit posts.
 *
 * Tools available to this agent:
 * - get_subreddit_analytics: Get engagement patterns
 * - get_scheduled_posts: Get existing schedule
 * - find_optimal_times: Calculate best posting times
 * - create_schedule: Create/update schedule entries
 * - validate_schedule: Check for conflicts
 */
export interface ISchedulerAgent extends IAgent {
  readonly agentType: 'scheduler';

  /**
   * Schedules Reddit posts for optimal timing.
   * @param session - Current session
   * @param input - Scheduling input
   * @returns Scheduling result
   */
  process(session: AgentSession, input: SchedulerInput): Promise<AgentSessionResult>;
}

// =============================================================================
// REPOSITORY INTERFACES
// =============================================================================

/**
 * Repository interface for agent session persistence.
 */
export interface IAgentSessionRepository {
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
export interface IAgentWorkflowRepository {
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
export interface IWorkflowExecutionRepository {
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
export interface IAgentInvocationRepository {
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

// =============================================================================
// ERROR CODE DETAILS
// =============================================================================

/**
 * Error code details with descriptions and recovery actions.
 */
export const AgentErrorCodeDetails: Record<AgentErrorCode, {
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
    description: 'The conversation context is too large',
    retryable: false,
    userAction: 'Start a new session with less context'
  },
  AGENT_INVALID_RESPONSE: {
    httpStatus: 500,
    description: 'Agent returned an invalid response',
    retryable: true,
    userAction: 'Try again'
  },

  // Tool Errors
  TOOL_NOT_FOUND: {
    httpStatus: 404,
    description: 'The specified tool does not exist',
    retryable: false
  },
  TOOL_EXECUTION_FAILED: {
    httpStatus: 500,
    description: 'Tool execution failed',
    retryable: true,
    userAction: 'Try again'
  },
  TOOL_TIMEOUT: {
    httpStatus: 408,
    description: 'Tool execution timed out',
    retryable: true,
    userAction: 'Try again'
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
    description: 'A workflow execution is already running',
    retryable: false,
    userAction: 'Wait for the current execution to complete'
  },
  WORKFLOW_FAILED: {
    httpStatus: 500,
    description: 'Workflow execution failed',
    retryable: true,
    userAction: 'Review the error and retry'
  },
  WORKFLOW_TIMEOUT: {
    httpStatus: 408,
    description: 'Workflow execution timed out',
    retryable: true,
    userAction: 'Start a new workflow execution'
  },
  WORKFLOW_CANCELLED: {
    httpStatus: 400,
    description: 'Workflow was cancelled',
    retryable: false,
    userAction: 'Start a new workflow if needed'
  },
  WORKFLOW_STEP_FAILED: {
    httpStatus: 500,
    description: 'A workflow step failed',
    retryable: true,
    userAction: 'Retry the workflow from the failed step'
  },
  WORKFLOW_INVALID_STEP: {
    httpStatus: 400,
    description: 'Invalid step in workflow',
    retryable: false
  },
  WORKFLOW_CONDITION_NOT_MET: {
    httpStatus: 400,
    description: 'Workflow step condition was not met',
    retryable: false
  },
  WORKFLOW_CANNOT_ADVANCE: {
    httpStatus: 400,
    description: 'Cannot advance workflow in current state',
    retryable: false
  },
  WORKFLOW_CANNOT_RETRY: {
    httpStatus: 400,
    description: 'Workflow cannot be retried in current state',
    retryable: false
  },

  // Context Errors
  CONTEXT_VALIDATION_FAILED: {
    httpStatus: 400,
    description: 'Context validation failed',
    retryable: false,
    userAction: 'Review and correct the input'
  },
  CONTEXT_MISSING_REQUIRED_FIELD: {
    httpStatus: 400,
    description: 'Required context field is missing',
    retryable: false,
    userAction: 'Provide all required fields'
  },
  BRAND_GUIDELINES_NOT_FOUND: {
    httpStatus: 404,
    description: 'Brand guidelines not found for customer',
    retryable: false,
    userAction: 'Set up brand guidelines first'
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
    userAction: 'Wait a moment and try again'
  },
  CLAUDE_API_TIMEOUT: {
    httpStatus: 408,
    description: 'Claude API request timed out',
    retryable: true,
    userAction: 'Try again'
  },
  CLEAR_STORY_SERVICE_ERROR: {
    httpStatus: 502,
    description: 'Error communicating with Clear Story service',
    retryable: true,
    userAction: 'Try again'
  },
  ARTICLE_SERVICE_ERROR: {
    httpStatus: 502,
    description: 'Error communicating with Article service',
    retryable: true,
    userAction: 'Try again'
  },
  REDDIT_SERVICE_ERROR: {
    httpStatus: 502,
    description: 'Error communicating with Reddit service',
    retryable: true,
    userAction: 'Try again'
  },
  SCHEDULER_SERVICE_ERROR: {
    httpStatus: 502,
    description: 'Error communicating with Scheduler service',
    retryable: true,
    userAction: 'Try again'
  },

  // General Errors
  VALIDATION_ERROR: {
    httpStatus: 400,
    description: 'Input validation failed',
    retryable: false,
    userAction: 'Review and correct the input'
  },
  INTERNAL_ERROR: {
    httpStatus: 500,
    description: 'An internal error occurred',
    retryable: true,
    userAction: 'Try again or contact support'
  },
  QUOTA_EXCEEDED: {
    httpStatus: 429,
    description: 'Account quota exceeded',
    retryable: false,
    userAction: 'Upgrade your plan or wait for quota reset'
  }
};
