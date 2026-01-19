# USER-CUSTOMER Domain Contract

> **Version**: 1.0.0
> **Domain**: User/Customer
> **Owner**: User/Customer Agent
> **Last Updated**: 2026-01-18

This contract defines the complete interface for the User/Customer domain in the LEO Automation Platform. This is a foundational domain that manages user authentication, customer accounts, brand guidelines, and usage quotas. All implementations must adhere to these types and interfaces.

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
  UserId,
  CustomerId,
  BrandGuidelineId,

  // Enums
  CustomerTier,
  ContentTone,

  // Cross-Domain References
  UserRef,
  CustomerRef,

  // API Patterns
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  AuditInfo,
  ISOTimestamp,

  // Constants
  ARTICLES_PER_DAY_STARTER,    // 10
  ARTICLES_PER_DAY_GROWTH,     // 50
  ARTICLES_PER_DAY_ENTERPRISE  // unlimited
} from '../shared-primitives';
```

---

## Cross-Domain References

This is a **foundational domain**. It does not consume references from other domains. Instead, it exports `UserRef` and `CustomerRef` for use by all other domains.

### Exported References

```typescript
/**
 * Minimal user reference for cross-domain use.
 * Other domains should use this instead of full User objects.
 */
export interface UserRef {
  /** Unique user identifier */
  id: UserId;
  /** User's email address */
  email: string;
  /** User's display name */
  displayName: string;
}

/**
 * Minimal customer reference for cross-domain use.
 * Other domains should use this instead of full Customer objects.
 */
export interface CustomerRef {
  /** Unique customer identifier */
  id: CustomerId;
  /** Company/organization name */
  companyName: string;
  /** Current subscription tier */
  tier: CustomerTier;
}
```

---

## Domain-Specific Types

### UserRole Enum

```typescript
/**
 * Roles that define user permissions within a customer account.
 */
export enum UserRole {
  /** Full administrative access - can manage users, billing, and all settings */
  admin = 'admin',

  /** Can create, edit, and approve content - cannot manage users or billing */
  editor = 'editor',

  /** Read-only access - can view content and analytics */
  viewer = 'viewer'
}
```

### OnboardingStatus Enum

```typescript
/**
 * Status tracking for customer onboarding workflow.
 */
export enum OnboardingStatus {
  /** Just signed up, no setup completed */
  not_started = 'not_started',

  /** Basic account setup in progress */
  in_progress = 'in_progress',

  /** Brand guidelines being configured */
  awaiting_brand_setup = 'awaiting_brand_setup',

  /** Awaiting first Clear Story upload */
  awaiting_content = 'awaiting_content',

  /** All setup completed, ready to generate content */
  completed = 'completed'
}
```

### User Interface

```typescript
/**
 * Full user entity representing a platform user.
 * Users belong to customer accounts and have specific roles.
 */
export interface User {
  /** Unique identifier in format usr_${uuid} */
  id: UserId;

  /** User's email address - must be unique across platform */
  email: string;

  /** Display name shown in UI and attribution */
  displayName: string;

  /** Bcrypt-hashed password - never expose in API responses */
  passwordHash: string;

  /** Customer account this user belongs to */
  customerId: CustomerId;

  /** User's role within their customer account */
  role: UserRole;

  /** Whether the user can log in */
  isActive: boolean;

  /** Whether email has been verified */
  isEmailVerified: boolean;

  /** Timestamp of last successful login */
  lastLoginAt: ISOTimestamp | null;

  /** Number of failed login attempts (for lockout) */
  failedLoginAttempts: number;

  /** When account was locked due to failed attempts */
  lockedUntil: ISOTimestamp | null;

  /** User's timezone preference (IANA format) */
  timezone: string;

  /** User's preferred language (ISO 639-1) */
  preferredLanguage: string;

  /** Profile image URL */
  avatarUrl: string | null;

  /** Audit trail information */
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}
```

### Customer Interface

```typescript
/**
 * Customer/company account entity.
 * Customers have subscription tiers, usage quotas, and associated users.
 */
export interface Customer {
  /** Unique identifier in format cust_${uuid} */
  id: CustomerId;

  /** Company/organization name */
  companyName: string;

  /** Current subscription tier */
  tier: CustomerTier;

  /** Company website URL */
  website: string;

  /** Industry/vertical for content targeting */
  industry: string;

  /** Company description for AI context */
  description: string | null;

  /** Primary contact email for billing and notifications */
  billingEmail: string;

  /** Usage quota limits based on tier */
  usageQuota: UsageQuota;

  /** Current period usage tracking */
  currentUsage: UsageTracking;

  /** Current onboarding status */
  onboardingStatus: OnboardingStatus;

  /** When onboarding was completed */
  onboardingCompletedAt: ISOTimestamp | null;

  /** Stripe customer ID for billing integration */
  stripeCustomerId: string | null;

  /** Current subscription period start */
  subscriptionStartDate: ISOTimestamp | null;

  /** Current subscription period end */
  subscriptionEndDate: ISOTimestamp | null;

  /** Whether the account is active */
  isActive: boolean;

  /** Reason if account is suspended */
  suspendedReason: string | null;

  /** Audit trail information */
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}
```

### UsageQuota Interface

```typescript
/**
 * Usage limits based on customer tier.
 */
export interface UsageQuota {
  /** Maximum articles per day */
  articlesPerDay: number | 'unlimited';

  /** Maximum Reddit posts per day */
  redditPostsPerDay: number | 'unlimited';

  /** Maximum Clear Stories in library */
  clearStoriesMax: number | 'unlimited';

  /** Maximum users on account */
  usersMax: number;

  /** Whether API access is enabled */
  apiAccessEnabled: boolean;

  /** Whether analytics dashboard is available */
  analyticsEnabled: boolean;

  /** Whether priority support is available */
  prioritySupportEnabled: boolean;
}

/**
 * Default quotas by tier.
 */
export const TIER_QUOTAS: Record<CustomerTier, UsageQuota> = {
  trial: {
    articlesPerDay: 3,
    redditPostsPerDay: 2,
    clearStoriesMax: 10,
    usersMax: 1,
    apiAccessEnabled: false,
    analyticsEnabled: false,
    prioritySupportEnabled: false
  },
  starter: {
    articlesPerDay: 10,  // ARTICLES_PER_DAY_STARTER
    redditPostsPerDay: 10,
    clearStoriesMax: 50,
    usersMax: 3,
    apiAccessEnabled: false,
    analyticsEnabled: true,
    prioritySupportEnabled: false
  },
  growth: {
    articlesPerDay: 50,  // ARTICLES_PER_DAY_GROWTH
    redditPostsPerDay: 50,
    clearStoriesMax: 200,
    usersMax: 10,
    apiAccessEnabled: true,
    analyticsEnabled: true,
    prioritySupportEnabled: false
  },
  enterprise: {
    articlesPerDay: 'unlimited',  // ARTICLES_PER_DAY_ENTERPRISE
    redditPostsPerDay: 'unlimited',
    clearStoriesMax: 'unlimited',
    usersMax: 'unlimited' as any,  // Represented as number in type
    apiAccessEnabled: true,
    analyticsEnabled: true,
    prioritySupportEnabled: true
  }
} as const;
```

### UsageTracking Interface

```typescript
/**
 * Tracks current usage within a billing period.
 */
export interface UsageTracking {
  /** Articles generated today */
  articlesToday: number;

  /** Reddit posts made today */
  redditPostsToday: number;

  /** Total Clear Stories in library */
  clearStoriesCount: number;

  /** Total users on account */
  usersCount: number;

  /** When daily counters were last reset */
  lastResetAt: ISOTimestamp;

  /** Total articles this billing period */
  articlesPeriodTotal: number;

  /** Total Reddit posts this billing period */
  redditPostsPeriodTotal: number;
}
```

### BrandGuideline Interface

```typescript
/**
 * Brand guidelines for content generation.
 * Used by AI agents to maintain consistent voice and messaging.
 */
export interface BrandGuideline {
  /** Unique identifier in format bg_${uuid} */
  id: BrandGuidelineId;

  /** Customer this guideline belongs to */
  customerId: CustomerId;

  /** Display name for this guideline set (e.g., "Primary Brand Voice") */
  name: string;

  /** Whether this is the default guideline for the customer */
  isDefault: boolean;

  /** Brand voice characteristics */
  voiceTone: VoiceTone;

  /** Preferred content tone from platform options */
  preferredTone: ContentTone;

  /** Keywords to emphasize in content */
  keywords: string[];

  /** Words/phrases to avoid in content */
  avoidWords: string[];

  /** Competitor names/products to never mention positively */
  competitors: string[];

  /** Target audience description */
  targetAudience: TargetAudience;

  /** Key messaging points to include */
  keyMessages: string[];

  /** Brand-specific terminology and definitions */
  terminology: TerminologyEntry[];

  /** Example content snippets demonstrating brand voice */
  contentExamples: ContentExample[];

  /** Additional AI prompt context */
  additionalContext: string | null;

  /** Audit trail information */
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  createdBy: UserId;
  updatedBy: UserId;
}
```

### VoiceTone Interface

```typescript
/**
 * Detailed voice and tone characteristics for brand guidelines.
 */
export interface VoiceTone {
  /** Primary personality trait (e.g., "friendly", "expert", "innovative") */
  primaryTrait: string;

  /** Secondary personality traits */
  secondaryTraits: string[];

  /** Formality level: 1 (casual) to 5 (formal) */
  formalityLevel: 1 | 2 | 3 | 4 | 5;

  /** Technical level: 1 (layperson) to 5 (expert) */
  technicalLevel: 1 | 2 | 3 | 4 | 5;

  /** Humor usage: 'none' | 'subtle' | 'moderate' | 'frequent' */
  humorLevel: 'none' | 'subtle' | 'moderate' | 'frequent';

  /** Emoji usage: 'none' | 'minimal' | 'moderate' | 'frequent' */
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'frequent';

  /** Sample phrases that exemplify the voice */
  samplePhrases: string[];
}
```

### TargetAudience Interface

```typescript
/**
 * Target audience definition for content personalization.
 */
export interface TargetAudience {
  /** Primary job titles/roles */
  roles: string[];

  /** Industries they work in */
  industries: string[];

  /** Company sizes (e.g., "startup", "enterprise") */
  companySizes: string[];

  /** Pain points to address */
  painPoints: string[];

  /** Goals they want to achieve */
  goals: string[];

  /** How they prefer to consume content */
  contentPreferences: string[];

  /** Additional demographic notes */
  notes: string | null;
}
```

### TerminologyEntry Interface

```typescript
/**
 * Brand-specific terminology with definitions.
 */
export interface TerminologyEntry {
  /** The term */
  term: string;

  /** How to use/define this term */
  definition: string;

  /** Alternative terms that should be replaced with this term */
  alternatives: string[];
}
```

### ContentExample Interface

```typescript
/**
 * Example content snippet demonstrating brand voice.
 */
export interface ContentExample {
  /** Type of content (e.g., "headline", "paragraph", "social_post") */
  type: 'headline' | 'paragraph' | 'social_post' | 'email_subject' | 'call_to_action';

  /** The example content */
  content: string;

  /** Why this is a good example */
  notes: string | null;
}
```

### Authentication Types

```typescript
/**
 * Credentials for user authentication.
 */
export interface AuthCredentials {
  /** User's email address */
  email: string;

  /** User's plaintext password (never store) */
  password: string;

  /** Optional: Remember this session longer */
  rememberMe?: boolean;
}

/**
 * JWT token structure returned after authentication.
 */
export interface AuthToken {
  /** JWT access token - short-lived (15 minutes) */
  accessToken: string;

  /** JWT refresh token - longer-lived (7 days, or 30 if rememberMe) */
  refreshToken: string;

  /** When the access token expires */
  expiresAt: ISOTimestamp;

  /** Token type (always "Bearer") */
  tokenType: 'Bearer';
}

/**
 * Active user session information.
 */
export interface AuthSession {
  /** Unique session identifier */
  sessionId: string;

  /** User reference */
  user: UserRef;

  /** Customer reference */
  customer: CustomerRef;

  /** User's role in the customer account */
  role: UserRole;

  /** When the session was created */
  createdAt: ISOTimestamp;

  /** When the session expires */
  expiresAt: ISOTimestamp;

  /** Last activity timestamp */
  lastActivityAt: ISOTimestamp;

  /** IP address of session origin */
  ipAddress: string;

  /** User agent string */
  userAgent: string;

  /** Whether session is still valid */
  isValid: boolean;
}
```

### Input Types

```typescript
/**
 * Input for creating a new user.
 */
export interface CreateUserInput {
  /** User's email address */
  email: string;

  /** User's display name */
  displayName: string;

  /** Initial password */
  password: string;

  /** Customer account to add user to */
  customerId: CustomerId;

  /** Role assignment */
  role: UserRole;

  /** Optional: User's timezone (defaults to customer's timezone) */
  timezone?: string;

  /** Optional: Preferred language (defaults to 'en') */
  preferredLanguage?: string;
}

/**
 * Input for updating an existing user.
 */
export interface UpdateUserInput {
  /** Updated display name */
  displayName?: string;

  /** Updated email (requires re-verification) */
  email?: string;

  /** Updated role */
  role?: UserRole;

  /** Updated active status */
  isActive?: boolean;

  /** Updated timezone */
  timezone?: string;

  /** Updated language preference */
  preferredLanguage?: string;

  /** Updated avatar URL */
  avatarUrl?: string | null;
}

/**
 * Input for creating a new customer account.
 */
export interface CreateCustomerInput {
  /** Company name */
  companyName: string;

  /** Company website URL */
  website: string;

  /** Industry/vertical */
  industry: string;

  /** Company description */
  description?: string;

  /** Billing contact email */
  billingEmail: string;

  /** Initial subscription tier (defaults to 'trial') */
  tier?: CustomerTier;
}

/**
 * Input for updating an existing customer.
 */
export interface UpdateCustomerInput {
  /** Updated company name */
  companyName?: string;

  /** Updated website URL */
  website?: string;

  /** Updated industry */
  industry?: string;

  /** Updated description */
  description?: string | null;

  /** Updated billing email */
  billingEmail?: string;

  /** Updated subscription tier */
  tier?: CustomerTier;

  /** Updated onboarding status */
  onboardingStatus?: OnboardingStatus;

  /** Updated active status */
  isActive?: boolean;

  /** Suspension reason (required if isActive is set to false) */
  suspendedReason?: string | null;
}

/**
 * Input for creating brand guidelines.
 */
export interface CreateBrandGuidelineInput {
  /** Customer this guideline belongs to */
  customerId: CustomerId;

  /** Display name for this guideline set */
  name: string;

  /** Whether this is the default guideline */
  isDefault?: boolean;

  /** Voice tone configuration */
  voiceTone: VoiceTone;

  /** Preferred content tone */
  preferredTone: ContentTone;

  /** Keywords to emphasize */
  keywords: string[];

  /** Words to avoid */
  avoidWords?: string[];

  /** Competitor names */
  competitors?: string[];

  /** Target audience definition */
  targetAudience: TargetAudience;

  /** Key messaging points */
  keyMessages?: string[];

  /** Terminology entries */
  terminology?: TerminologyEntry[];

  /** Content examples */
  contentExamples?: ContentExample[];

  /** Additional context for AI */
  additionalContext?: string;
}

/**
 * Input for updating brand guidelines.
 */
export interface UpdateBrandGuidelineInput {
  /** Updated name */
  name?: string;

  /** Updated default status */
  isDefault?: boolean;

  /** Updated voice tone */
  voiceTone?: Partial<VoiceTone>;

  /** Updated preferred tone */
  preferredTone?: ContentTone;

  /** Updated keywords */
  keywords?: string[];

  /** Updated avoid words */
  avoidWords?: string[];

  /** Updated competitors */
  competitors?: string[];

  /** Updated target audience */
  targetAudience?: Partial<TargetAudience>;

  /** Updated key messages */
  keyMessages?: string[];

  /** Updated terminology */
  terminology?: TerminologyEntry[];

  /** Updated content examples */
  contentExamples?: ContentExample[];

  /** Updated additional context */
  additionalContext?: string | null;
}

/**
 * Input for user password change.
 */
export interface ChangePasswordInput {
  /** Current password for verification */
  currentPassword: string;

  /** New password */
  newPassword: string;
}

/**
 * Input for password reset request.
 */
export interface PasswordResetRequestInput {
  /** Email address for reset link */
  email: string;
}

/**
 * Input for completing password reset.
 */
export interface PasswordResetInput {
  /** Reset token from email */
  token: string;

  /** New password */
  newPassword: string;
}
```

---

## Service Interface

### IUserService

```typescript
/**
 * User management service interface.
 * Handles user CRUD operations and authentication.
 */
export interface IUserService {
  // ─────────────────────────────────────────────────────────────
  // User CRUD Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new user account.
   * Hashes password and sends verification email.
   *
   * @param input - User creation data
   * @param createdBy - User performing the action (for audit)
   * @returns Created user (without passwordHash)
   * @throws CUSTOMER_NOT_FOUND if customerId is invalid
   * @throws EMAIL_ALREADY_EXISTS if email is taken
   * @throws USER_LIMIT_EXCEEDED if customer is at user limit
   */
  create(input: CreateUserInput, createdBy: UserId): Promise<Omit<User, 'passwordHash'>>;

  /**
   * Get a user by ID.
   *
   * @param id - User ID
   * @returns User or null if not found
   */
  getById(id: UserId): Promise<Omit<User, 'passwordHash'> | null>;

  /**
   * Get a user by email address.
   *
   * @param email - Email address
   * @returns User or null if not found
   */
  getByEmail(email: string): Promise<Omit<User, 'passwordHash'> | null>;

  /**
   * Get all users for a customer account.
   *
   * @param customerId - Customer ID
   * @param pagination - Pagination parameters
   * @returns Paginated list of users
   */
  getByCustomer(
    customerId: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Omit<User, 'passwordHash'>>>;

  /**
   * Update a user's profile.
   *
   * @param id - User ID to update
   * @param input - Update data
   * @param updatedBy - User performing the action
   * @returns Updated user
   * @throws USER_NOT_FOUND if user doesn't exist
   * @throws EMAIL_ALREADY_EXISTS if new email is taken
   */
  update(
    id: UserId,
    input: UpdateUserInput,
    updatedBy: UserId
  ): Promise<Omit<User, 'passwordHash'>>;

  /**
   * Soft delete a user (deactivate).
   *
   * @param id - User ID to delete
   * @param deletedBy - User performing the action
   * @throws USER_NOT_FOUND if user doesn't exist
   * @throws CANNOT_DELETE_LAST_ADMIN if user is last admin
   */
  delete(id: UserId, deletedBy: UserId): Promise<void>;

  // ─────────────────────────────────────────────────────────────
  // Authentication Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Authenticate a user with email and password.
   *
   * @param credentials - Login credentials
   * @param metadata - Request metadata (IP, user agent)
   * @returns Auth tokens and session
   * @throws INVALID_CREDENTIALS if email/password is wrong
   * @throws ACCOUNT_LOCKED if too many failed attempts
   * @throws ACCOUNT_INACTIVE if user is deactivated
   * @throws CUSTOMER_SUSPENDED if customer account is suspended
   */
  authenticate(
    credentials: AuthCredentials,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<{ tokens: AuthToken; session: AuthSession }>;

  /**
   * Refresh an access token using a refresh token.
   *
   * @param refreshToken - Valid refresh token
   * @returns New auth tokens
   * @throws INVALID_TOKEN if refresh token is invalid/expired
   * @throws SESSION_REVOKED if session was invalidated
   */
  refreshToken(refreshToken: string): Promise<AuthToken>;

  /**
   * Logout a user and invalidate their session.
   *
   * @param sessionId - Session to invalidate
   * @param allSessions - If true, invalidate all user sessions
   */
  logout(sessionId: string, allSessions?: boolean): Promise<void>;

  /**
   * Get all active sessions for a user.
   *
   * @param userId - User ID
   * @returns List of active sessions
   */
  getSessions(userId: UserId): Promise<AuthSession[]>;

  /**
   * Verify a user's email with verification token.
   *
   * @param token - Email verification token
   * @throws INVALID_TOKEN if token is invalid/expired
   */
  verifyEmail(token: string): Promise<void>;

  /**
   * Request a password reset email.
   *
   * @param input - Email for reset
   * @returns Success (always returns true to prevent email enumeration)
   */
  requestPasswordReset(input: PasswordResetRequestInput): Promise<boolean>;

  /**
   * Reset password using reset token.
   *
   * @param input - Reset token and new password
   * @throws INVALID_TOKEN if token is invalid/expired
   */
  resetPassword(input: PasswordResetInput): Promise<void>;

  /**
   * Change a user's password.
   *
   * @param userId - User ID
   * @param input - Current and new password
   * @throws INVALID_CREDENTIALS if current password is wrong
   */
  changePassword(userId: UserId, input: ChangePasswordInput): Promise<void>;
}
```

### ICustomerService

```typescript
/**
 * Customer management service interface.
 * Handles customer accounts, onboarding, and tier management.
 */
export interface ICustomerService {
  // ─────────────────────────────────────────────────────────────
  // Customer CRUD Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new customer account.
   * Initializes with trial tier and default usage quotas.
   *
   * @param input - Customer creation data
   * @param createdBy - System or user creating the account
   * @returns Created customer
   */
  create(input: CreateCustomerInput, createdBy?: UserId): Promise<Customer>;

  /**
   * Get a customer by ID.
   *
   * @param id - Customer ID
   * @returns Customer or null if not found
   */
  getById(id: CustomerId): Promise<Customer | null>;

  /**
   * Get customers by tier.
   *
   * @param tier - Customer tier to filter by
   * @param pagination - Pagination parameters
   * @returns Paginated list of customers
   */
  getByTier(
    tier: CustomerTier,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Customer>>;

  /**
   * Update a customer account.
   *
   * @param id - Customer ID
   * @param input - Update data
   * @param updatedBy - User performing the update
   * @returns Updated customer
   * @throws CUSTOMER_NOT_FOUND if customer doesn't exist
   */
  update(
    id: CustomerId,
    input: UpdateCustomerInput,
    updatedBy: UserId
  ): Promise<Customer>;

  /**
   * Soft delete a customer (suspend with reason).
   *
   * @param id - Customer ID
   * @param reason - Reason for suspension
   * @param deletedBy - User performing the action
   * @throws CUSTOMER_NOT_FOUND if customer doesn't exist
   */
  delete(id: CustomerId, reason: string, deletedBy: UserId): Promise<void>;

  // ─────────────────────────────────────────────────────────────
  // Onboarding Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Initialize customer onboarding workflow.
   *
   * @param customerId - Customer to onboard
   * @returns Onboarding progress state
   */
  initializeOnboarding(customerId: CustomerId): Promise<OnboardingProgress>;

  /**
   * Get current onboarding progress.
   *
   * @param customerId - Customer ID
   * @returns Onboarding progress state
   */
  getOnboardingProgress(customerId: CustomerId): Promise<OnboardingProgress>;

  /**
   * Complete an onboarding step.
   *
   * @param customerId - Customer ID
   * @param step - Step that was completed
   * @returns Updated onboarding progress
   */
  completeOnboardingStep(
    customerId: CustomerId,
    step: OnboardingStep
  ): Promise<OnboardingProgress>;

  /**
   * Mark onboarding as complete.
   *
   * @param customerId - Customer ID
   * @returns Updated customer
   */
  completeOnboarding(customerId: CustomerId): Promise<Customer>;

  // ─────────────────────────────────────────────────────────────
  // Tier Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Upgrade or downgrade customer tier.
   * Adjusts usage quotas accordingly.
   *
   * @param customerId - Customer ID
   * @param newTier - Target tier
   * @param updatedBy - User performing the action
   * @returns Updated customer with new quotas
   * @throws TIER_DOWNGRADE_NOT_ALLOWED if usage exceeds new tier limits
   */
  changeTier(
    customerId: CustomerId,
    newTier: CustomerTier,
    updatedBy: UserId
  ): Promise<Customer>;
}

/**
 * Onboarding step identifiers.
 */
export type OnboardingStep =
  | 'account_created'
  | 'first_user_added'
  | 'brand_guidelines_set'
  | 'first_clear_story_uploaded'
  | 'first_article_generated'
  | 'first_reddit_post';

/**
 * Onboarding progress tracking.
 */
export interface OnboardingProgress {
  /** Customer being onboarded */
  customerId: CustomerId;

  /** Current onboarding status */
  status: OnboardingStatus;

  /** Steps that have been completed */
  completedSteps: OnboardingStep[];

  /** Next recommended step */
  nextStep: OnboardingStep | null;

  /** Completion percentage (0-100) */
  completionPercentage: number;

  /** When each step was completed */
  stepTimestamps: Partial<Record<OnboardingStep, ISOTimestamp>>;
}
```

### IBrandGuidelineService

```typescript
/**
 * Brand guideline management service interface.
 */
export interface IBrandGuidelineService {
  /**
   * Create new brand guidelines for a customer.
   *
   * @param input - Brand guideline data
   * @param createdBy - User creating the guidelines
   * @returns Created brand guidelines
   * @throws CUSTOMER_NOT_FOUND if customer doesn't exist
   */
  create(input: CreateBrandGuidelineInput, createdBy: UserId): Promise<BrandGuideline>;

  /**
   * Get brand guidelines by ID.
   *
   * @param id - Brand guideline ID
   * @returns Brand guidelines or null
   */
  getById(id: BrandGuidelineId): Promise<BrandGuideline | null>;

  /**
   * Get all brand guidelines for a customer.
   *
   * @param customerId - Customer ID
   * @returns Array of brand guidelines
   */
  getByCustomer(customerId: CustomerId): Promise<BrandGuideline[]>;

  /**
   * Get the default brand guidelines for a customer.
   *
   * @param customerId - Customer ID
   * @returns Default brand guidelines or null
   */
  getDefault(customerId: CustomerId): Promise<BrandGuideline | null>;

  /**
   * Update brand guidelines.
   *
   * @param id - Brand guideline ID
   * @param input - Update data
   * @param updatedBy - User performing the update
   * @returns Updated brand guidelines
   * @throws BRAND_GUIDELINE_NOT_FOUND if guidelines don't exist
   */
  update(
    id: BrandGuidelineId,
    input: UpdateBrandGuidelineInput,
    updatedBy: UserId
  ): Promise<BrandGuideline>;

  /**
   * Delete brand guidelines.
   *
   * @param id - Brand guideline ID
   * @param deletedBy - User performing the deletion
   * @throws BRAND_GUIDELINE_NOT_FOUND if guidelines don't exist
   * @throws CANNOT_DELETE_DEFAULT if guidelines are the default
   */
  delete(id: BrandGuidelineId, deletedBy: UserId): Promise<void>;

  /**
   * Set brand guidelines as the default for the customer.
   *
   * @param id - Brand guideline ID to make default
   * @param updatedBy - User performing the action
   * @returns Updated brand guidelines
   */
  setAsDefault(id: BrandGuidelineId, updatedBy: UserId): Promise<BrandGuideline>;
}
```

### IUsageService

```typescript
/**
 * Usage tracking and quota management service.
 */
export interface IUsageService {
  /**
   * Check if customer has quota remaining for an action.
   *
   * @param customerId - Customer ID
   * @param resourceType - Type of resource being consumed
   * @returns Whether quota is available
   */
  checkQuota(
    customerId: CustomerId,
    resourceType: 'article' | 'reddit_post' | 'clear_story' | 'user'
  ): Promise<{ allowed: boolean; remaining: number | 'unlimited'; limit: number | 'unlimited' }>;

  /**
   * Increment usage counter for a resource.
   *
   * @param customerId - Customer ID
   * @param resourceType - Type of resource consumed
   * @param amount - Amount to increment (default 1)
   * @returns Updated usage tracking
   * @throws QUOTA_EXCEEDED if limit would be exceeded
   */
  incrementUsage(
    customerId: CustomerId,
    resourceType: 'article' | 'reddit_post' | 'clear_story' | 'user',
    amount?: number
  ): Promise<UsageTracking>;

  /**
   * Decrement usage counter (e.g., when deleting a Clear Story).
   *
   * @param customerId - Customer ID
   * @param resourceType - Type of resource
   * @param amount - Amount to decrement (default 1)
   * @returns Updated usage tracking
   */
  decrementUsage(
    customerId: CustomerId,
    resourceType: 'clear_story' | 'user',
    amount?: number
  ): Promise<UsageTracking>;

  /**
   * Get detailed usage statistics for a customer.
   *
   * @param customerId - Customer ID
   * @returns Detailed usage stats
   */
  getUsageStats(customerId: CustomerId): Promise<UsageStats>;

  /**
   * Reset daily usage counters.
   * Called by scheduled job at midnight UTC.
   *
   * @param customerId - Optional specific customer to reset
   */
  resetDailyUsage(customerId?: CustomerId): Promise<void>;

  /**
   * Reset period usage counters.
   * Called when subscription period renews.
   *
   * @param customerId - Customer ID
   */
  resetPeriodUsage(customerId: CustomerId): Promise<void>;
}

/**
 * Detailed usage statistics.
 */
export interface UsageStats {
  /** Customer ID */
  customerId: CustomerId;

  /** Current usage tracking */
  current: UsageTracking;

  /** Usage quotas for comparison */
  quota: UsageQuota;

  /** Daily usage over past 30 days */
  dailyHistory: {
    date: string;  // YYYY-MM-DD
    articles: number;
    redditPosts: number;
  }[];

  /** Usage percentages */
  utilization: {
    articlesToday: number;      // percentage of daily limit
    redditPostsToday: number;
    clearStories: number;
    users: number;
  };

  /** Projected usage for current period */
  projectedPeriodUsage: {
    articles: number;
    redditPosts: number;
  };
}
```

---

## Repository Interface

### IUserRepository

```typescript
/**
 * Repository interface for User persistence.
 */
export interface IUserRepository {
  /**
   * Create a new user.
   */
  create(input: CreateUserInput & { passwordHash: string }): Promise<User>;

  /**
   * Find user by ID.
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Find user by email (case-insensitive).
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Find all users for a customer.
   */
  findByCustomer(
    customerId: CustomerId,
    options?: PaginationParams & { role?: UserRole; isActive?: boolean }
  ): Promise<{ users: User[]; total: number }>;

  /**
   * Update a user.
   */
  update(id: UserId, input: Partial<User>): Promise<User>;

  /**
   * Soft delete a user (set isActive to false).
   */
  softDelete(id: UserId): Promise<void>;

  /**
   * Count users for a customer.
   */
  countByCustomer(customerId: CustomerId): Promise<number>;

  /**
   * Check if email exists.
   */
  emailExists(email: string, excludeUserId?: UserId): Promise<boolean>;

  /**
   * Update login tracking (lastLoginAt, failedLoginAttempts).
   */
  updateLoginAttempt(
    id: UserId,
    success: boolean
  ): Promise<void>;

  /**
   * Lock/unlock user account.
   */
  setLockStatus(id: UserId, lockedUntil: ISOTimestamp | null): Promise<void>;
}
```

### ICustomerRepository

```typescript
/**
 * Repository interface for Customer persistence.
 */
export interface ICustomerRepository {
  /**
   * Create a new customer.
   */
  create(input: CreateCustomerInput & { usageQuota: UsageQuota }): Promise<Customer>;

  /**
   * Find customer by ID.
   */
  findById(id: CustomerId): Promise<Customer | null>;

  /**
   * Find customers by tier.
   */
  findByTier(
    tier: CustomerTier,
    options?: PaginationParams & { isActive?: boolean }
  ): Promise<{ customers: Customer[]; total: number }>;

  /**
   * Find all customers with optional filters.
   */
  findAll(
    options?: PaginationParams & {
      tier?: CustomerTier;
      isActive?: boolean;
      onboardingStatus?: OnboardingStatus;
      search?: string;  // Search company name
    }
  ): Promise<{ customers: Customer[]; total: number }>;

  /**
   * Update a customer.
   */
  update(id: CustomerId, input: Partial<Customer>): Promise<Customer>;

  /**
   * Update customer usage tracking.
   */
  updateUsage(id: CustomerId, usage: Partial<UsageTracking>): Promise<Customer>;

  /**
   * Suspend a customer.
   */
  suspend(id: CustomerId, reason: string): Promise<void>;

  /**
   * Reactivate a suspended customer.
   */
  reactivate(id: CustomerId): Promise<void>;

  /**
   * Find customers with expiring trials.
   */
  findExpiringTrials(withinDays: number): Promise<Customer[]>;

  /**
   * Find customers approaching quota limits.
   */
  findApproachingLimits(thresholdPercentage: number): Promise<Customer[]>;
}
```

### IBrandGuidelineRepository

```typescript
/**
 * Repository interface for BrandGuideline persistence.
 */
export interface IBrandGuidelineRepository {
  /**
   * Create new brand guidelines.
   */
  create(input: CreateBrandGuidelineInput): Promise<BrandGuideline>;

  /**
   * Find brand guidelines by ID.
   */
  findById(id: BrandGuidelineId): Promise<BrandGuideline | null>;

  /**
   * Find all brand guidelines for a customer.
   */
  findByCustomer(customerId: CustomerId): Promise<BrandGuideline[]>;

  /**
   * Find the default brand guidelines for a customer.
   */
  findDefault(customerId: CustomerId): Promise<BrandGuideline | null>;

  /**
   * Update brand guidelines.
   */
  update(id: BrandGuidelineId, input: Partial<BrandGuideline>): Promise<BrandGuideline>;

  /**
   * Delete brand guidelines.
   */
  delete(id: BrandGuidelineId): Promise<void>;

  /**
   * Set a brand guideline as default (unsets previous default).
   */
  setAsDefault(id: BrandGuidelineId, customerId: CustomerId): Promise<void>;

  /**
   * Count brand guidelines for a customer.
   */
  countByCustomer(customerId: CustomerId): Promise<number>;
}
```

### IAuthSessionRepository

```typescript
/**
 * Repository interface for AuthSession persistence.
 */
export interface IAuthSessionRepository {
  /**
   * Create a new session.
   */
  create(session: Omit<AuthSession, 'sessionId'>): Promise<AuthSession>;

  /**
   * Find session by ID.
   */
  findById(sessionId: string): Promise<AuthSession | null>;

  /**
   * Find session by refresh token.
   */
  findByRefreshToken(refreshToken: string): Promise<AuthSession | null>;

  /**
   * Find all active sessions for a user.
   */
  findByUser(userId: UserId): Promise<AuthSession[]>;

  /**
   * Update session (lastActivityAt, isValid).
   */
  update(sessionId: string, input: Partial<AuthSession>): Promise<AuthSession>;

  /**
   * Invalidate a session.
   */
  invalidate(sessionId: string): Promise<void>;

  /**
   * Invalidate all sessions for a user.
   */
  invalidateAllForUser(userId: UserId): Promise<void>;

  /**
   * Clean up expired sessions.
   */
  cleanupExpired(): Promise<number>;
}
```

---

## API Routes

### Route Definitions

```yaml
# ─────────────────────────────────────────────────────────────
# Authentication Routes
# ─────────────────────────────────────────────────────────────

# POST /auth/login
# Authenticate user and create session
POST /auth/login:
  auth: none
  body:
    email: string (required)
    password: string (required)
    rememberMe: boolean (optional, default: false)
  response:
    200:
      tokens: AuthToken
      session: AuthSession
    400: Validation error
    401: Invalid credentials
    403: Account locked or inactive

# POST /auth/refresh
# Refresh access token
POST /auth/refresh:
  auth: none
  body:
    refreshToken: string (required)
  response:
    200: AuthToken
    401: Invalid or expired token

# POST /auth/logout
# Logout and invalidate session
POST /auth/logout:
  auth: required
  body:
    allSessions: boolean (optional, default: false)
  response:
    204: No content

# GET /auth/sessions
# Get all active sessions for current user
GET /auth/sessions:
  auth: required
  response:
    200: AuthSession[]

# DELETE /auth/sessions/:sessionId
# Revoke a specific session
DELETE /auth/sessions/:sessionId:
  auth: required
  params:
    sessionId: string
  response:
    204: No content
    404: Session not found

# POST /auth/verify-email
# Verify email with token
POST /auth/verify-email:
  auth: none
  body:
    token: string (required)
  response:
    200: { message: "Email verified" }
    400: Invalid token

# POST /auth/forgot-password
# Request password reset email
POST /auth/forgot-password:
  auth: none
  body:
    email: string (required)
  response:
    200: { message: "If email exists, reset link sent" }

# POST /auth/reset-password
# Reset password with token
POST /auth/reset-password:
  auth: none
  body:
    token: string (required)
    newPassword: string (required)
  response:
    200: { message: "Password reset successful" }
    400: Invalid token or password requirements

# POST /auth/change-password
# Change password for authenticated user
POST /auth/change-password:
  auth: required
  body:
    currentPassword: string (required)
    newPassword: string (required)
  response:
    200: { message: "Password changed" }
    400: Current password incorrect

# ─────────────────────────────────────────────────────────────
# User Routes
# ─────────────────────────────────────────────────────────────

# GET /users/me
# Get current authenticated user
GET /users/me:
  auth: required
  response:
    200: User (without passwordHash)

# PATCH /users/me
# Update current user's profile
PATCH /users/me:
  auth: required
  body:
    displayName: string (optional)
    timezone: string (optional)
    preferredLanguage: string (optional)
    avatarUrl: string (optional)
  response:
    200: User (without passwordHash)
    400: Validation error

# GET /users
# Get all users for customer (admin only)
GET /users:
  auth: required (admin)
  query:
    page: number (default: 1)
    pageSize: number (default: 20, max: 100)
    role: UserRole (optional)
    isActive: boolean (optional)
  response:
    200: PaginatedResponse<User>

# POST /users
# Create a new user (admin only)
POST /users:
  auth: required (admin)
  body:
    email: string (required)
    displayName: string (required)
    password: string (required)
    role: UserRole (required)
    timezone: string (optional)
  response:
    201: User (without passwordHash)
    400: Validation error
    409: Email already exists
    403: User limit exceeded

# GET /users/:id
# Get a specific user (admin or self)
GET /users/:id:
  auth: required
  params:
    id: UserId
  response:
    200: User (without passwordHash)
    403: Unauthorized
    404: User not found

# PATCH /users/:id
# Update a user (admin only, or self for limited fields)
PATCH /users/:id:
  auth: required
  params:
    id: UserId
  body:
    displayName: string (optional)
    email: string (optional, admin only)
    role: UserRole (optional, admin only)
    isActive: boolean (optional, admin only)
    timezone: string (optional)
    preferredLanguage: string (optional)
    avatarUrl: string (optional)
  response:
    200: User (without passwordHash)
    400: Validation error
    403: Unauthorized
    404: User not found
    409: Email already exists

# DELETE /users/:id
# Deactivate a user (admin only)
DELETE /users/:id:
  auth: required (admin)
  params:
    id: UserId
  response:
    204: No content
    403: Cannot delete last admin
    404: User not found

# ─────────────────────────────────────────────────────────────
# Customer Routes
# ─────────────────────────────────────────────────────────────

# GET /customers/me
# Get current customer account
GET /customers/me:
  auth: required
  response:
    200: Customer

# PATCH /customers/me
# Update current customer (admin only)
PATCH /customers/me:
  auth: required (admin)
  body:
    companyName: string (optional)
    website: string (optional)
    industry: string (optional)
    description: string (optional)
    billingEmail: string (optional)
  response:
    200: Customer
    400: Validation error

# POST /customers
# Create a new customer (signup flow)
POST /customers:
  auth: none
  body:
    companyName: string (required)
    website: string (required)
    industry: string (required)
    description: string (optional)
    billingEmail: string (required)
    adminUser:
      email: string (required)
      displayName: string (required)
      password: string (required)
  response:
    201:
      customer: Customer
      user: User (without passwordHash)
      tokens: AuthToken
    400: Validation error
    409: Email or company already exists

# GET /customers (platform admin only)
# List all customers
GET /customers:
  auth: required (platform_admin)
  query:
    page: number (default: 1)
    pageSize: number (default: 20, max: 100)
    tier: CustomerTier (optional)
    isActive: boolean (optional)
    onboardingStatus: OnboardingStatus (optional)
    search: string (optional, search company name)
  response:
    200: PaginatedResponse<Customer>

# GET /customers/:id (platform admin only)
# Get a specific customer
GET /customers/:id:
  auth: required (platform_admin)
  params:
    id: CustomerId
  response:
    200: Customer
    404: Customer not found

# ─────────────────────────────────────────────────────────────
# Onboarding Routes
# ─────────────────────────────────────────────────────────────

# GET /onboarding/progress
# Get onboarding progress for current customer
GET /onboarding/progress:
  auth: required
  response:
    200: OnboardingProgress

# POST /onboarding/complete-step
# Mark an onboarding step as complete
POST /onboarding/complete-step:
  auth: required
  body:
    step: OnboardingStep (required)
  response:
    200: OnboardingProgress
    400: Invalid step or already completed

# ─────────────────────────────────────────────────────────────
# Brand Guidelines Routes
# ─────────────────────────────────────────────────────────────

# GET /brand-guidelines
# Get all brand guidelines for current customer
GET /brand-guidelines:
  auth: required
  response:
    200: BrandGuideline[]

# GET /brand-guidelines/default
# Get default brand guidelines for current customer
GET /brand-guidelines/default:
  auth: required
  response:
    200: BrandGuideline
    404: No default guidelines set

# POST /brand-guidelines
# Create new brand guidelines (admin/editor)
POST /brand-guidelines:
  auth: required (admin, editor)
  body:
    name: string (required)
    isDefault: boolean (optional)
    voiceTone: VoiceTone (required)
    preferredTone: ContentTone (required)
    keywords: string[] (required)
    avoidWords: string[] (optional)
    competitors: string[] (optional)
    targetAudience: TargetAudience (required)
    keyMessages: string[] (optional)
    terminology: TerminologyEntry[] (optional)
    contentExamples: ContentExample[] (optional)
    additionalContext: string (optional)
  response:
    201: BrandGuideline
    400: Validation error

# GET /brand-guidelines/:id
# Get specific brand guidelines
GET /brand-guidelines/:id:
  auth: required
  params:
    id: BrandGuidelineId
  response:
    200: BrandGuideline
    404: Not found

# PATCH /brand-guidelines/:id
# Update brand guidelines (admin/editor)
PATCH /brand-guidelines/:id:
  auth: required (admin, editor)
  params:
    id: BrandGuidelineId
  body:
    name: string (optional)
    isDefault: boolean (optional)
    voiceTone: Partial<VoiceTone> (optional)
    preferredTone: ContentTone (optional)
    keywords: string[] (optional)
    avoidWords: string[] (optional)
    competitors: string[] (optional)
    targetAudience: Partial<TargetAudience> (optional)
    keyMessages: string[] (optional)
    terminology: TerminologyEntry[] (optional)
    contentExamples: ContentExample[] (optional)
    additionalContext: string (optional)
  response:
    200: BrandGuideline
    400: Validation error
    404: Not found

# DELETE /brand-guidelines/:id
# Delete brand guidelines (admin only)
DELETE /brand-guidelines/:id:
  auth: required (admin)
  params:
    id: BrandGuidelineId
  response:
    204: No content
    400: Cannot delete default guidelines
    404: Not found

# POST /brand-guidelines/:id/set-default
# Set brand guidelines as default (admin/editor)
POST /brand-guidelines/:id/set-default:
  auth: required (admin, editor)
  params:
    id: BrandGuidelineId
  response:
    200: BrandGuideline
    404: Not found

# ─────────────────────────────────────────────────────────────
# Usage Routes
# ─────────────────────────────────────────────────────────────

# GET /usage
# Get usage statistics for current customer
GET /usage:
  auth: required
  response:
    200: UsageStats

# GET /usage/quota
# Check quota for a specific resource type
GET /usage/quota:
  auth: required
  query:
    resourceType: 'article' | 'reddit_post' | 'clear_story' | 'user' (required)
  response:
    200:
      allowed: boolean
      remaining: number | 'unlimited'
      limit: number | 'unlimited'
```

### TypeScript Route Types

```typescript
/**
 * POST /auth/login request body
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * POST /auth/login response
 */
export interface LoginResponse {
  tokens: AuthToken;
  session: AuthSession;
}

/**
 * POST /auth/refresh request body
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * POST /customers signup request body
 */
export interface SignupRequest {
  companyName: string;
  website: string;
  industry: string;
  description?: string;
  billingEmail: string;
  adminUser: {
    email: string;
    displayName: string;
    password: string;
  };
}

/**
 * POST /customers signup response
 */
export interface SignupResponse {
  customer: Customer;
  user: Omit<User, 'passwordHash'>;
  tokens: AuthToken;
}

/**
 * POST /users request body
 */
export interface CreateUserRequest {
  email: string;
  displayName: string;
  password: string;
  role: UserRole;
  timezone?: string;
  preferredLanguage?: string;
}

/**
 * PATCH /users/:id request body
 */
export interface UpdateUserRequest {
  displayName?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  timezone?: string;
  preferredLanguage?: string;
  avatarUrl?: string | null;
}

/**
 * PATCH /customers/me request body
 */
export interface UpdateCustomerRequest {
  companyName?: string;
  website?: string;
  industry?: string;
  description?: string | null;
  billingEmail?: string;
}

/**
 * POST /brand-guidelines request body
 */
export interface CreateBrandGuidelineRequest {
  name: string;
  isDefault?: boolean;
  voiceTone: VoiceTone;
  preferredTone: ContentTone;
  keywords: string[];
  avoidWords?: string[];
  competitors?: string[];
  targetAudience: TargetAudience;
  keyMessages?: string[];
  terminology?: TerminologyEntry[];
  contentExamples?: ContentExample[];
  additionalContext?: string;
}

/**
 * PATCH /brand-guidelines/:id request body
 */
export interface UpdateBrandGuidelineRequest {
  name?: string;
  isDefault?: boolean;
  voiceTone?: Partial<VoiceTone>;
  preferredTone?: ContentTone;
  keywords?: string[];
  avoidWords?: string[];
  competitors?: string[];
  targetAudience?: Partial<TargetAudience>;
  keyMessages?: string[];
  terminology?: TerminologyEntry[];
  contentExamples?: ContentExample[];
  additionalContext?: string | null;
}

/**
 * GET /usage/quota response
 */
export interface QuotaCheckResponse {
  allowed: boolean;
  remaining: number | 'unlimited';
  limit: number | 'unlimited';
}
```

---

## Validation Schemas

```typescript
import { z } from 'zod';

/**
 * Email validation
 */
const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email must be at most 255 characters')
  .transform(val => val.toLowerCase());

/**
 * Password validation
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * Display name validation
 */
const displayNameSchema = z.string()
  .min(2, 'Display name must be at least 2 characters')
  .max(100, 'Display name must be at most 100 characters')
  .regex(/^[a-zA-Z0-9\s\-'\.]+$/, 'Display name contains invalid characters');

/**
 * URL validation
 */
const urlSchema = z.string()
  .url('Invalid URL format')
  .max(500, 'URL must be at most 500 characters');

/**
 * Login credentials validation
 */
export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false)
});

/**
 * User creation validation
 */
export const CreateUserSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  role: z.nativeEnum(UserRole),
  timezone: z.string().max(50).optional().default('UTC'),
  preferredLanguage: z.string().length(2).optional().default('en')
});

/**
 * User update validation
 */
export const UpdateUserSchema = z.object({
  displayName: displayNameSchema.optional(),
  email: emailSchema.optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  timezone: z.string().max(50).optional(),
  preferredLanguage: z.string().length(2).optional(),
  avatarUrl: urlSchema.nullable().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

/**
 * Customer creation validation
 */
export const CreateCustomerSchema = z.object({
  companyName: z.string()
    .min(2, 'Company name must be at least 2 characters')
    .max(200, 'Company name must be at most 200 characters'),
  website: urlSchema,
  industry: z.string()
    .min(2, 'Industry must be at least 2 characters')
    .max(100, 'Industry must be at most 100 characters'),
  description: z.string().max(2000).optional(),
  billingEmail: emailSchema,
  tier: z.nativeEnum(CustomerTier).optional().default(CustomerTier.trial)
});

/**
 * Signup validation (customer + admin user)
 */
export const SignupSchema = CreateCustomerSchema.extend({
  adminUser: z.object({
    email: emailSchema,
    displayName: displayNameSchema,
    password: passwordSchema
  })
});

/**
 * Customer update validation
 */
export const UpdateCustomerSchema = z.object({
  companyName: z.string().min(2).max(200).optional(),
  website: urlSchema.optional(),
  industry: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  billingEmail: emailSchema.optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

/**
 * Voice tone validation
 */
export const VoiceToneSchema = z.object({
  primaryTrait: z.string().min(2).max(50),
  secondaryTraits: z.array(z.string().min(2).max(50)).max(5),
  formalityLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  technicalLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  humorLevel: z.enum(['none', 'subtle', 'moderate', 'frequent']),
  emojiUsage: z.enum(['none', 'minimal', 'moderate', 'frequent']),
  samplePhrases: z.array(z.string().max(200)).max(10)
});

/**
 * Target audience validation
 */
export const TargetAudienceSchema = z.object({
  roles: z.array(z.string().max(100)).min(1).max(10),
  industries: z.array(z.string().max(100)).max(10),
  companySizes: z.array(z.string().max(50)).max(5),
  painPoints: z.array(z.string().max(200)).max(10),
  goals: z.array(z.string().max(200)).max(10),
  contentPreferences: z.array(z.string().max(100)).max(5),
  notes: z.string().max(1000).nullable().optional()
});

/**
 * Terminology entry validation
 */
export const TerminologyEntrySchema = z.object({
  term: z.string().min(1).max(100),
  definition: z.string().min(1).max(500),
  alternatives: z.array(z.string().max(100)).max(10)
});

/**
 * Content example validation
 */
export const ContentExampleSchema = z.object({
  type: z.enum(['headline', 'paragraph', 'social_post', 'email_subject', 'call_to_action']),
  content: z.string().min(1).max(2000),
  notes: z.string().max(500).nullable().optional()
});

/**
 * Brand guideline creation validation
 */
export const CreateBrandGuidelineSchema = z.object({
  name: z.string().min(2).max(100),
  isDefault: z.boolean().optional().default(false),
  voiceTone: VoiceToneSchema,
  preferredTone: z.nativeEnum(ContentTone),
  keywords: z.array(z.string().max(50)).min(1).max(50),
  avoidWords: z.array(z.string().max(50)).max(50).optional().default([]),
  competitors: z.array(z.string().max(100)).max(20).optional().default([]),
  targetAudience: TargetAudienceSchema,
  keyMessages: z.array(z.string().max(500)).max(10).optional().default([]),
  terminology: z.array(TerminologyEntrySchema).max(50).optional().default([]),
  contentExamples: z.array(ContentExampleSchema).max(20).optional().default([]),
  additionalContext: z.string().max(5000).optional()
});

/**
 * Brand guideline update validation
 */
export const UpdateBrandGuidelineSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  isDefault: z.boolean().optional(),
  voiceTone: VoiceToneSchema.partial().optional(),
  preferredTone: z.nativeEnum(ContentTone).optional(),
  keywords: z.array(z.string().max(50)).min(1).max(50).optional(),
  avoidWords: z.array(z.string().max(50)).max(50).optional(),
  competitors: z.array(z.string().max(100)).max(20).optional(),
  targetAudience: TargetAudienceSchema.partial().optional(),
  keyMessages: z.array(z.string().max(500)).max(10).optional(),
  terminology: z.array(TerminologyEntrySchema).max(50).optional(),
  contentExamples: z.array(ContentExampleSchema).max(20).optional(),
  additionalContext: z.string().max(5000).nullable().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

/**
 * Password change validation
 */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword']
});

/**
 * Password reset request validation
 */
export const PasswordResetRequestSchema = z.object({
  email: emailSchema
});

/**
 * Password reset validation
 */
export const PasswordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema
});

/**
 * Pagination parameters validation
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
```

---

## Error Codes

```typescript
/**
 * User/Customer domain-specific error codes.
 */
export const UserCustomerErrorCodes = {
  // ─────────────────────────────────────────────────────────────
  // User Errors
  // ─────────────────────────────────────────────────────────────

  /** User with given ID not found */
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  /** Email address already in use */
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',

  /** Cannot delete the last admin of an account */
  CANNOT_DELETE_LAST_ADMIN: 'CANNOT_DELETE_LAST_ADMIN',

  /** User account is inactive/deactivated */
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',

  /** User account is locked due to failed login attempts */
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',

  /** User has exceeded maximum allowed for customer tier */
  USER_LIMIT_EXCEEDED: 'USER_LIMIT_EXCEEDED',

  // ─────────────────────────────────────────────────────────────
  // Authentication Errors
  // ─────────────────────────────────────────────────────────────

  /** Email or password is incorrect */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  /** JWT token is invalid or malformed */
  INVALID_TOKEN: 'INVALID_TOKEN',

  /** Token has expired */
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  /** Session has been revoked or invalidated */
  SESSION_REVOKED: 'SESSION_REVOKED',

  /** Session not found */
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',

  /** Email verification required before login */
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',

  /** Password reset token is invalid or expired */
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',

  // ─────────────────────────────────────────────────────────────
  // Customer Errors
  // ─────────────────────────────────────────────────────────────

  /** Customer with given ID not found */
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',

  /** Customer account is suspended */
  CUSTOMER_SUSPENDED: 'CUSTOMER_SUSPENDED',

  /** Company name already in use */
  COMPANY_ALREADY_EXISTS: 'COMPANY_ALREADY_EXISTS',

  /** Cannot downgrade tier due to current usage exceeding new limits */
  TIER_DOWNGRADE_NOT_ALLOWED: 'TIER_DOWNGRADE_NOT_ALLOWED',

  /** Trial period has expired */
  TRIAL_EXPIRED: 'TRIAL_EXPIRED',

  // ─────────────────────────────────────────────────────────────
  // Brand Guideline Errors
  // ─────────────────────────────────────────────────────────────

  /** Brand guidelines with given ID not found */
  BRAND_GUIDELINE_NOT_FOUND: 'BRAND_GUIDELINE_NOT_FOUND',

  /** Cannot delete default brand guidelines */
  CANNOT_DELETE_DEFAULT: 'CANNOT_DELETE_DEFAULT',

  /** Customer must have at least one brand guideline */
  MINIMUM_GUIDELINES_REQUIRED: 'MINIMUM_GUIDELINES_REQUIRED',

  // ─────────────────────────────────────────────────────────────
  // Quota/Usage Errors
  // ─────────────────────────────────────────────────────────────

  /** Usage quota has been exceeded */
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  /** Daily limit for resource has been reached */
  DAILY_LIMIT_REACHED: 'DAILY_LIMIT_REACHED',

  /** Feature not available on current tier */
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',

  // ─────────────────────────────────────────────────────────────
  // Onboarding Errors
  // ─────────────────────────────────────────────────────────────

  /** Onboarding step already completed */
  STEP_ALREADY_COMPLETED: 'STEP_ALREADY_COMPLETED',

  /** Cannot complete step - prerequisite not met */
  PREREQUISITE_NOT_MET: 'PREREQUISITE_NOT_MET',

  /** Onboarding already completed */
  ONBOARDING_ALREADY_COMPLETE: 'ONBOARDING_ALREADY_COMPLETE',

  // ─────────────────────────────────────────────────────────────
  // Authorization Errors
  // ─────────────────────────────────────────────────────────────

  /** User does not have permission for this action */
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',

  /** User role insufficient for this action */
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS'
} as const;

export type UserCustomerErrorCode = typeof UserCustomerErrorCodes[keyof typeof UserCustomerErrorCodes];

/**
 * Error response structure for this domain.
 */
export interface UserCustomerError {
  code: UserCustomerErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

/**
 * Helper to create domain errors.
 */
export function createError(
  code: UserCustomerErrorCode,
  message: string,
  details?: Record<string, unknown>,
  retryable = false
): UserCustomerError {
  return { code, message, details, retryable };
}
```

---

## Integration Points

### Events Published

```typescript
/**
 * Events the User/Customer domain publishes for other domains to consume.
 * These events are published to the event bus when significant state changes occur.
 */
export interface UserCustomerEvents {
  // ─────────────────────────────────────────────────────────────
  // User Events
  // ─────────────────────────────────────────────────────────────

  /**
   * Emitted when a new user is created.
   * Subscribers: Analytics (for tracking), Onboarding (for progress)
   */
  'user.created': {
    userId: UserId;
    customerId: CustomerId;
    email: string;
    displayName: string;
    role: UserRole;
    createdAt: ISOTimestamp;
    createdBy: UserId;
  };

  /**
   * Emitted when a user is updated.
   * Subscribers: Audit logging
   */
  'user.updated': {
    userId: UserId;
    customerId: CustomerId;
    changes: Partial<UpdateUserInput>;
    updatedAt: ISOTimestamp;
    updatedBy: UserId;
  };

  /**
   * Emitted when a user is deactivated.
   * Subscribers: Session management (invalidate sessions)
   */
  'user.deactivated': {
    userId: UserId;
    customerId: CustomerId;
    reason?: string;
    deactivatedAt: ISOTimestamp;
    deactivatedBy: UserId;
  };

  /**
   * Emitted when a user logs in successfully.
   * Subscribers: Analytics, Security monitoring
   */
  'user.logged_in': {
    userId: UserId;
    customerId: CustomerId;
    sessionId: string;
    ipAddress: string;
    userAgent: string;
    loggedInAt: ISOTimestamp;
  };

  /**
   * Emitted when a user's role changes.
   * Subscribers: Permission cache invalidation
   */
  'user.role_changed': {
    userId: UserId;
    customerId: CustomerId;
    previousRole: UserRole;
    newRole: UserRole;
    changedAt: ISOTimestamp;
    changedBy: UserId;
  };

  // ─────────────────────────────────────────────────────────────
  // Customer Events
  // ─────────────────────────────────────────────────────────────

  /**
   * Emitted when a new customer signs up.
   * Subscribers: Onboarding, Email service, Analytics
   */
  'customer.created': {
    customerId: CustomerId;
    companyName: string;
    tier: CustomerTier;
    industry: string;
    adminUserId: UserId;
    createdAt: ISOTimestamp;
  };

  /**
   * Emitted when a customer is updated.
   * Subscribers: Audit logging, Search indexing
   */
  'customer.updated': {
    customerId: CustomerId;
    changes: Partial<UpdateCustomerInput>;
    updatedAt: ISOTimestamp;
    updatedBy: UserId;
  };

  /**
   * Emitted when a customer's tier changes.
   * Subscribers: Billing, Feature flags, Analytics, All domain services (for quota updates)
   */
  'customer.tier_changed': {
    customerId: CustomerId;
    previousTier: CustomerTier;
    newTier: CustomerTier;
    previousQuota: UsageQuota;
    newQuota: UsageQuota;
    changedAt: ISOTimestamp;
    changedBy: UserId;
    reason?: 'upgrade' | 'downgrade' | 'trial_conversion' | 'trial_expiry';
  };

  /**
   * Emitted when a customer is suspended.
   * Subscribers: Session management, Email service, All domain services
   */
  'customer.suspended': {
    customerId: CustomerId;
    reason: string;
    suspendedAt: ISOTimestamp;
    suspendedBy: UserId;
  };

  /**
   * Emitted when a customer is reactivated.
   * Subscribers: Email service, All domain services
   */
  'customer.reactivated': {
    customerId: CustomerId;
    reactivatedAt: ISOTimestamp;
    reactivatedBy: UserId;
  };

  /**
   * Emitted when customer completes onboarding.
   * Subscribers: Analytics, Email service (welcome sequence)
   */
  'customer.onboarding_completed': {
    customerId: CustomerId;
    completedAt: ISOTimestamp;
    durationDays: number;
    completedSteps: OnboardingStep[];
  };

  // ─────────────────────────────────────────────────────────────
  // Brand Guideline Events
  // ─────────────────────────────────────────────────────────────

  /**
   * Emitted when brand guidelines are created.
   * Subscribers: Content generation service (cache refresh)
   */
  'brand_guideline.created': {
    guidelineId: BrandGuidelineId;
    customerId: CustomerId;
    name: string;
    isDefault: boolean;
    createdAt: ISOTimestamp;
    createdBy: UserId;
  };

  /**
   * Emitted when brand guidelines are updated.
   * Subscribers: Content generation service (cache refresh)
   */
  'brand_guideline.updated': {
    guidelineId: BrandGuidelineId;
    customerId: CustomerId;
    changes: string[];  // List of changed field names
    updatedAt: ISOTimestamp;
    updatedBy: UserId;
  };

  /**
   * Emitted when default brand guideline changes.
   * Subscribers: Content generation service
   */
  'brand_guideline.default_changed': {
    customerId: CustomerId;
    previousDefaultId: BrandGuidelineId | null;
    newDefaultId: BrandGuidelineId;
    changedAt: ISOTimestamp;
    changedBy: UserId;
  };

  // ─────────────────────────────────────────────────────────────
  // Usage Events
  // ─────────────────────────────────────────────────────────────

  /**
   * Emitted when customer approaches quota limit (80% threshold).
   * Subscribers: Email service (warning), Dashboard notifications
   */
  'usage.quota_warning': {
    customerId: CustomerId;
    resourceType: 'article' | 'reddit_post' | 'clear_story' | 'user';
    currentUsage: number;
    limit: number;
    percentUsed: number;
    warningAt: ISOTimestamp;
  };

  /**
   * Emitted when customer exceeds quota.
   * Subscribers: All domain services (to block new resource creation)
   */
  'usage.quota_exceeded': {
    customerId: CustomerId;
    resourceType: 'article' | 'reddit_post' | 'clear_story' | 'user';
    attemptedAt: ISOTimestamp;
    currentUsage: number;
    limit: number;
  };

  /**
   * Emitted when daily usage is reset (midnight UTC).
   * Subscribers: Analytics (for daily summaries)
   */
  'usage.daily_reset': {
    customerId: CustomerId;
    previousDayUsage: {
      articles: number;
      redditPosts: number;
    };
    resetAt: ISOTimestamp;
  };
}
```

### Events Consumed

```typescript
/**
 * Events the User/Customer domain consumes from other domains.
 * These handlers update usage tracking and onboarding progress.
 */
export interface ConsumedEvents {
  /**
   * From Article domain - increment article usage counter.
   */
  'article.created': {
    articleId: string;
    customerId: CustomerId;
    createdBy: UserId;
  };

  /**
   * From Reddit Distribution domain - increment post usage counter.
   */
  'reddit_post.posted': {
    postId: string;
    customerId: CustomerId;
    postedBy: UserId;
  };

  /**
   * From Clear Story domain - update Clear Story count.
   */
  'clear_story.created': {
    clearStoryId: string;
    customerId: CustomerId;
    createdBy: UserId;
  };

  /**
   * From Clear Story domain - decrement Clear Story count.
   */
  'clear_story.deleted': {
    clearStoryId: string;
    customerId: CustomerId;
  };

  /**
   * From Article domain - update onboarding progress.
   */
  'article.generated': {
    articleId: string;
    customerId: CustomerId;
  };

  /**
   * From Reddit Distribution domain - update onboarding progress.
   */
  'reddit_post.first_post': {
    postId: string;
    customerId: CustomerId;
  };

  /**
   * From Billing domain - handle subscription changes.
   */
  'subscription.renewed': {
    customerId: CustomerId;
    tier: CustomerTier;
    periodStart: ISOTimestamp;
    periodEnd: ISOTimestamp;
  };

  /**
   * From Billing domain - handle subscription cancellation.
   */
  'subscription.cancelled': {
    customerId: CustomerId;
    effectiveDate: ISOTimestamp;
    reason?: string;
  };
}
```

### Event Handler Signatures

```typescript
/**
 * Event handler interface for consumed events.
 */
export interface IUserCustomerEventHandler {
  /**
   * Handle article creation - increment usage.
   */
  handleArticleCreated(event: ConsumedEvents['article.created']): Promise<void>;

  /**
   * Handle Reddit post - increment usage.
   */
  handleRedditPostPosted(event: ConsumedEvents['reddit_post.posted']): Promise<void>;

  /**
   * Handle Clear Story creation - increment count.
   */
  handleClearStoryCreated(event: ConsumedEvents['clear_story.created']): Promise<void>;

  /**
   * Handle Clear Story deletion - decrement count.
   */
  handleClearStoryDeleted(event: ConsumedEvents['clear_story.deleted']): Promise<void>;

  /**
   * Handle subscription renewal - reset period usage.
   */
  handleSubscriptionRenewed(event: ConsumedEvents['subscription.renewed']): Promise<void>;

  /**
   * Handle subscription cancellation - suspend or downgrade.
   */
  handleSubscriptionCancelled(event: ConsumedEvents['subscription.cancelled']): Promise<void>;
}
```

---

## Notes for Implementers

1. **Password Security**: Always use bcrypt with a cost factor of at least 12 for password hashing. Never log or return password hashes in API responses.

2. **Token Management**:
   - Access tokens: 15-minute expiry, signed with RS256
   - Refresh tokens: 7 days (30 if rememberMe), stored hashed in database
   - Invalidate all tokens on password change

3. **Account Lockout**:
   - Lock after 5 failed login attempts
   - Lockout duration: 15 minutes
   - Implement exponential backoff for repeated lockouts

4. **Usage Tracking**:
   - Daily counters reset at midnight UTC
   - Check quotas BEFORE creating resources to prevent race conditions
   - Use database transactions for quota checks + increments

5. **Onboarding Progress**:
   - Steps should be completed in order but allow flexibility
   - Auto-complete `first_user_added` when admin user is created
   - Send progress reminder emails at 3, 7, and 14 days if incomplete

6. **Brand Guidelines**:
   - Ensure exactly one default per customer at all times
   - When deleting default, auto-promote another if exists
   - Cache guidelines with 5-minute TTL for content generation

7. **Multi-tenancy**:
   - All queries MUST filter by customerId
   - Never expose data from other customers
   - Use Row-Level Security in PostgreSQL

8. **Rate Limiting**:
   - Login: 5 attempts per minute per email
   - Password reset: 3 requests per hour per email
   - API general: 100 requests per minute per user

---

*Contract Version: 1.0.0 | Generated: 2026-01-18*
