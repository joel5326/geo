/**
 * GEO Platform - User/Customer Domain Services
 *
 * Service implementations for User, Customer, BrandGuideline, and Usage management.
 * These services implement the interfaces defined in user-customer.types.ts.
 *
 * @module user-customer/user-customer.service
 * @version 1.0.0
 */

import {
  UserId,
  CustomerId,
  BrandGuidelineId,
  CustomerTier,
  ISOTimestamp,
  PaginationParams,
  PaginatedResponse,
  UserRef,
  CustomerRef
} from '../shared/shared.types';

import {
  User,
  Customer,
  BrandGuideline,
  UserRole,
  OnboardingStatus,
  OnboardingStep,
  OnboardingProgress,
  UsageQuota,
  UsageTracking,
  UsageStats,
  AuthCredentials,
  AuthToken,
  AuthSession,
  CreateUserInput,
  UpdateUserInput,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateBrandGuidelineInput,
  UpdateBrandGuidelineInput,
  ChangePasswordInput,
  PasswordResetRequestInput,
  PasswordResetInput,
  IUserService,
  ICustomerService,
  IBrandGuidelineService,
  IUsageService,
  IUserRepository,
  ICustomerRepository,
  IBrandGuidelineRepository,
  UserCustomerErrorCodes,
  TIER_QUOTAS
} from '../domains/user-customer/user-customer.types';

import {
  InMemoryUserRepository,
  InMemoryCustomerRepository,
  InMemoryBrandGuidelineRepository,
  generateUserId,
  now,
  createDefaultUsageTracking
} from './user-customer.repository';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a user reference from a User entity.
 */
function toUserRef(user: User): UserRef {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName
  };
}

/**
 * Create a customer reference from a Customer entity.
 */
function toCustomerRef(customer: Customer): CustomerRef {
  return {
    id: customer.id,
    companyName: customer.companyName,
    tier: customer.tier
  };
}

/**
 * Remove passwordHash from user for safe return.
 */
function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Create a paginated response.
 */
function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pageSize);
  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
}

/**
 * Simple password hashing stub (in production, use bcrypt).
 */
function hashPassword(password: string): string {
  // In production, use bcrypt.hash(password, 10)
  return `hashed_${password}_${Date.now()}`;
}

/**
 * Simple password verification stub (in production, use bcrypt).
 */
function verifyPassword(password: string, hash: string): boolean {
  // In production, use bcrypt.compare(password, hash)
  return hash.startsWith('hashed_' + password);
}

// =============================================================================
// USER SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Implementation of IUserService.
 * Handles user CRUD operations and authentication.
 */
export class UserService implements IUserService {
  constructor(
    private userRepository: IUserRepository,
    private customerRepository: ICustomerRepository
  ) {}

  /**
   * Create a new user account.
   */
  async create(input: CreateUserInput, createdBy: UserId): Promise<Omit<User, 'passwordHash'>> {
    // Validate customer exists
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) {
      throw new Error(UserCustomerErrorCodes.CUSTOMER_NOT_FOUND);
    }

    // Check if email already exists
    const emailExists = await this.userRepository.emailExists(input.email);
    if (emailExists) {
      throw new Error(UserCustomerErrorCodes.EMAIL_ALREADY_EXISTS);
    }

    // Check user limit
    const userCount = await this.userRepository.countByCustomer(input.customerId);
    if (customer.usageQuota.usersMax !== Infinity && userCount >= customer.usageQuota.usersMax) {
      throw new Error(UserCustomerErrorCodes.USER_LIMIT_EXCEEDED);
    }

    // Hash password
    const passwordHash = hashPassword(input.password);

    // Create user
    const user = await this.userRepository.create({
      ...input,
      passwordHash
    });

    return sanitizeUser(user);
  }

  /**
   * Get a user by ID.
   */
  async getById(id: UserId): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.userRepository.findById(id);
    return user ? sanitizeUser(user) : null;
  }

  /**
   * Get a user by email address.
   */
  async getByEmail(email: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.userRepository.findByEmail(email);
    return user ? sanitizeUser(user) : null;
  }

  /**
   * Get all users for a customer account.
   */
  async getByCustomer(
    customerId: CustomerId,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Omit<User, 'passwordHash'>>> {
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;

    const { users, total } = await this.userRepository.findByCustomer(customerId, {
      page,
      pageSize
    });

    const sanitizedUsers = users.map(sanitizeUser);
    return createPaginatedResponse(sanitizedUsers, total, page, pageSize);
  }

  /**
   * Update a user's profile.
   */
  async update(
    id: UserId,
    input: UpdateUserInput,
    updatedBy: UserId
  ): Promise<Omit<User, 'passwordHash'>> {
    const existingUser = await this.userRepository.findById(id);
    if (!existingUser) {
      throw new Error(UserCustomerErrorCodes.USER_NOT_FOUND);
    }

    // Check if email is being changed and if it's available
    if (input.email && input.email !== existingUser.email) {
      const emailExists = await this.userRepository.emailExists(input.email, id);
      if (emailExists) {
        throw new Error(UserCustomerErrorCodes.EMAIL_ALREADY_EXISTS);
      }
    }

    const updatedUser = await this.userRepository.update(id, {
      ...input,
      updatedAt: now()
    });

    return sanitizeUser(updatedUser);
  }

  /**
   * Soft delete a user (deactivate).
   */
  async delete(id: UserId, deletedBy: UserId): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error(UserCustomerErrorCodes.USER_NOT_FOUND);
    }

    // Check if this is the last admin
    if (user.role === UserRole.admin) {
      const { users } = await this.userRepository.findByCustomer(user.customerId, {
        page: 1,
        pageSize: 1000,
        role: UserRole.admin,
        isActive: true
      });

      const activeAdmins = users.filter((u) => u.id !== id);
      if (activeAdmins.length === 0) {
        throw new Error(UserCustomerErrorCodes.CANNOT_DELETE_LAST_ADMIN);
      }
    }

    await this.userRepository.softDelete(id);
  }

  /**
   * Authenticate a user with email and password.
   * STUB: Returns mock tokens and session.
   */
  async authenticate(
    credentials: AuthCredentials,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<{ tokens: AuthToken; session: AuthSession }> {
    const user = await this.userRepository.findByEmail(credentials.email);
    if (!user) {
      throw new Error(UserCustomerErrorCodes.INVALID_CREDENTIALS);
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      throw new Error(UserCustomerErrorCodes.ACCOUNT_LOCKED);
    }

    // Check if account is active
    if (!user.isActive) {
      throw new Error(UserCustomerErrorCodes.ACCOUNT_INACTIVE);
    }

    // Verify password
    if (!verifyPassword(credentials.password, user.passwordHash)) {
      await this.userRepository.updateLoginAttempt(user.id, false);
      throw new Error(UserCustomerErrorCodes.INVALID_CREDENTIALS);
    }

    // Check customer status
    const customer = await this.customerRepository.findById(user.customerId);
    if (!customer || !customer.isActive) {
      throw new Error(UserCustomerErrorCodes.CUSTOMER_SUSPENDED);
    }

    // Update login tracking
    await this.userRepository.updateLoginAttempt(user.id, true);

    // Generate tokens (stub)
    const timestamp = now();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() as ISOTimestamp;

    const tokens: AuthToken = {
      accessToken: `access_${crypto.randomUUID()}`,
      refreshToken: `refresh_${crypto.randomUUID()}`,
      expiresAt,
      tokenType: 'Bearer'
    };

    const session: AuthSession = {
      sessionId: `sess_${crypto.randomUUID()}`,
      user: toUserRef(user),
      customer: toCustomerRef(customer),
      role: user.role,
      createdAt: timestamp,
      expiresAt: new Date(Date.now() + (credentials.rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000).toISOString() as ISOTimestamp,
      lastActivityAt: timestamp,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      isValid: true
    };

    return { tokens, session };
  }

  /**
   * Refresh an access token using a refresh token.
   * STUB: Returns mock new tokens.
   */
  async refreshToken(refreshToken: string): Promise<AuthToken> {
    // In production, validate refresh token from database
    if (!refreshToken.startsWith('refresh_')) {
      throw new Error(UserCustomerErrorCodes.INVALID_TOKEN);
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() as ISOTimestamp;

    return {
      accessToken: `access_${crypto.randomUUID()}`,
      refreshToken: `refresh_${crypto.randomUUID()}`,
      expiresAt,
      tokenType: 'Bearer'
    };
  }

  /**
   * Logout a user and invalidate their session.
   * STUB: In production, invalidate session in database.
   */
  async logout(sessionId: string, allSessions?: boolean): Promise<void> {
    // In production, invalidate session(s) in database
    // For now, this is a no-op stub
  }

  /**
   * Get all active sessions for a user.
   * STUB: Returns empty array.
   */
  async getSessions(userId: UserId): Promise<AuthSession[]> {
    // In production, fetch sessions from database
    return [];
  }

  /**
   * Verify a user's email with verification token.
   * STUB: In production, validate token and mark email verified.
   */
  async verifyEmail(token: string): Promise<void> {
    // In production, validate token and update user.isEmailVerified
    if (!token) {
      throw new Error(UserCustomerErrorCodes.INVALID_TOKEN);
    }
  }

  /**
   * Request a password reset email.
   * STUB: Always returns true to prevent email enumeration.
   */
  async requestPasswordReset(input: PasswordResetRequestInput): Promise<boolean> {
    // In production, send reset email if user exists
    return true;
  }

  /**
   * Reset password using reset token.
   * STUB: In production, validate token and update password.
   */
  async resetPassword(input: PasswordResetInput): Promise<void> {
    if (!input.token) {
      throw new Error(UserCustomerErrorCodes.INVALID_TOKEN);
    }
    // In production, validate token and update password
  }

  /**
   * Change a user's password.
   * STUB: Validates current password and updates.
   */
  async changePassword(userId: UserId, input: ChangePasswordInput): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error(UserCustomerErrorCodes.USER_NOT_FOUND);
    }

    if (!verifyPassword(input.currentPassword, user.passwordHash)) {
      throw new Error(UserCustomerErrorCodes.INVALID_CREDENTIALS);
    }

    const newHash = hashPassword(input.newPassword);
    await this.userRepository.update(userId, { passwordHash: newHash } as Partial<User>);
  }
}

// =============================================================================
// CUSTOMER SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Implementation of ICustomerService.
 * Handles customer accounts, onboarding, and tier management.
 */
export class CustomerService implements ICustomerService {
  // Store onboarding progress in memory
  private onboardingProgress: Map<CustomerId, OnboardingProgress> = new Map();

  constructor(private customerRepository: ICustomerRepository) {}

  /**
   * Create a new customer account.
   */
  async create(input: CreateCustomerInput, createdBy?: UserId): Promise<Customer> {
    const tier = input.tier || ('trial' as CustomerTier);
    const usageQuota = TIER_QUOTAS[tier];

    const customer = await this.customerRepository.create({
      ...input,
      tier,
      usageQuota
    });

    // Initialize onboarding
    await this.initializeOnboarding(customer.id);

    return customer;
  }

  /**
   * Get a customer by ID.
   */
  async getById(id: CustomerId): Promise<Customer | null> {
    return this.customerRepository.findById(id);
  }

  /**
   * Get customers by tier.
   */
  async getByTier(
    tier: CustomerTier,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Customer>> {
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;

    const { customers, total } = await this.customerRepository.findByTier(tier, {
      page,
      pageSize
    });

    return createPaginatedResponse(customers, total, page, pageSize);
  }

  /**
   * Update a customer account.
   */
  async update(
    id: CustomerId,
    input: UpdateCustomerInput,
    updatedBy: UserId
  ): Promise<Customer> {
    const existing = await this.customerRepository.findById(id);
    if (!existing) {
      throw new Error(UserCustomerErrorCodes.CUSTOMER_NOT_FOUND);
    }

    return this.customerRepository.update(id, {
      ...input,
      updatedAt: now()
    });
  }

  /**
   * Soft delete a customer (suspend with reason).
   */
  async delete(id: CustomerId, reason: string, deletedBy: UserId): Promise<void> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new Error(UserCustomerErrorCodes.CUSTOMER_NOT_FOUND);
    }

    await this.customerRepository.suspend(id, reason);
  }

  /**
   * Initialize customer onboarding workflow.
   */
  async initializeOnboarding(customerId: CustomerId): Promise<OnboardingProgress> {
    const progress: OnboardingProgress = {
      customerId,
      status: OnboardingStatus.not_started,
      completedSteps: ['account_created'],
      nextStep: 'first_user_added',
      completionPercentage: 16,
      stepTimestamps: {
        account_created: now()
      }
    };

    this.onboardingProgress.set(customerId, progress);
    return progress;
  }

  /**
   * Get current onboarding progress.
   */
  async getOnboardingProgress(customerId: CustomerId): Promise<OnboardingProgress> {
    const progress = this.onboardingProgress.get(customerId);
    if (!progress) {
      return this.initializeOnboarding(customerId);
    }
    return progress;
  }

  /**
   * Complete an onboarding step.
   */
  async completeOnboardingStep(
    customerId: CustomerId,
    step: OnboardingStep
  ): Promise<OnboardingProgress> {
    const progress = await this.getOnboardingProgress(customerId);

    if (progress.completedSteps.includes(step)) {
      throw new Error(UserCustomerErrorCodes.STEP_ALREADY_COMPLETED);
    }

    progress.completedSteps.push(step);
    progress.stepTimestamps[step] = now();

    // Calculate completion percentage and next step
    const allSteps: OnboardingStep[] = [
      'account_created',
      'first_user_added',
      'brand_guidelines_set',
      'first_clear_story_uploaded',
      'first_article_generated',
      'first_reddit_post'
    ];

    progress.completionPercentage = Math.round(
      (progress.completedSteps.length / allSteps.length) * 100
    );

    // Find next step
    const nextStepIndex = allSteps.findIndex(
      (s) => !progress.completedSteps.includes(s)
    );
    progress.nextStep = nextStepIndex >= 0 ? allSteps[nextStepIndex] : null;

    // Update status based on progress
    if (progress.completedSteps.includes('brand_guidelines_set')) {
      progress.status = OnboardingStatus.awaiting_content;
    } else if (progress.completedSteps.includes('first_user_added')) {
      progress.status = OnboardingStatus.awaiting_brand_setup;
    } else {
      progress.status = OnboardingStatus.in_progress;
    }

    if (progress.completionPercentage === 100) {
      progress.status = OnboardingStatus.completed;
    }

    this.onboardingProgress.set(customerId, progress);
    return progress;
  }

  /**
   * Mark onboarding as complete.
   */
  async completeOnboarding(customerId: CustomerId): Promise<Customer> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(UserCustomerErrorCodes.CUSTOMER_NOT_FOUND);
    }

    const progress = await this.getOnboardingProgress(customerId);
    progress.status = OnboardingStatus.completed;
    progress.completionPercentage = 100;
    progress.nextStep = null;
    this.onboardingProgress.set(customerId, progress);

    return this.customerRepository.update(customerId, {
      onboardingStatus: OnboardingStatus.completed,
      onboardingCompletedAt: now()
    });
  }

  /**
   * Upgrade or downgrade customer tier.
   */
  async changeTier(
    customerId: CustomerId,
    newTier: CustomerTier,
    updatedBy: UserId
  ): Promise<Customer> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(UserCustomerErrorCodes.CUSTOMER_NOT_FOUND);
    }

    const newQuota = TIER_QUOTAS[newTier];

    // Check if downgrade would exceed new limits
    const { currentUsage } = customer;
    if (
      newQuota.clearStoriesMax !== 'unlimited' &&
      currentUsage.clearStoriesCount > newQuota.clearStoriesMax
    ) {
      throw new Error(UserCustomerErrorCodes.TIER_DOWNGRADE_NOT_ALLOWED);
    }

    return this.customerRepository.update(customerId, {
      tier: newTier,
      usageQuota: newQuota,
      updatedAt: now()
    });
  }
}

// =============================================================================
// BRAND GUIDELINE SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Implementation of IBrandGuidelineService.
 * Handles brand guideline management.
 */
export class BrandGuidelineService implements IBrandGuidelineService {
  constructor(
    private guidelineRepository: IBrandGuidelineRepository,
    private customerRepository: ICustomerRepository
  ) {}

  /**
   * Create new brand guidelines for a customer.
   */
  async create(input: CreateBrandGuidelineInput, createdBy: UserId): Promise<BrandGuideline> {
    // Validate customer exists
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) {
      throw new Error(UserCustomerErrorCodes.CUSTOMER_NOT_FOUND);
    }

    // If no guidelines exist, make this the default
    const existingCount = await this.guidelineRepository.countByCustomer(input.customerId);
    const isDefault = input.isDefault ?? existingCount === 0;

    const guideline = await this.guidelineRepository.create({
      ...input,
      isDefault
    });

    // Update createdBy and updatedBy
    return this.guidelineRepository.update(guideline.id, {
      createdBy,
      updatedBy: createdBy
    });
  }

  /**
   * Get brand guidelines by ID.
   */
  async getById(id: BrandGuidelineId): Promise<BrandGuideline | null> {
    return this.guidelineRepository.findById(id);
  }

  /**
   * Get all brand guidelines for a customer.
   */
  async getByCustomer(customerId: CustomerId): Promise<BrandGuideline[]> {
    return this.guidelineRepository.findByCustomer(customerId);
  }

  /**
   * Get the default brand guidelines for a customer.
   */
  async getDefault(customerId: CustomerId): Promise<BrandGuideline | null> {
    return this.guidelineRepository.findDefault(customerId);
  }

  /**
   * Update brand guidelines.
   */
  async update(
    id: BrandGuidelineId,
    input: UpdateBrandGuidelineInput,
    updatedBy: UserId
  ): Promise<BrandGuideline> {
    const existing = await this.guidelineRepository.findById(id);
    if (!existing) {
      throw new Error(UserCustomerErrorCodes.BRAND_GUIDELINE_NOT_FOUND);
    }

    // Build update data with proper typing
    const updateData: Partial<BrandGuideline> = {
      updatedBy,
      updatedAt: now()
    };

    // Copy simple fields from input
    if (input.name !== undefined) updateData.name = input.name;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
    if (input.preferredTone !== undefined) updateData.preferredTone = input.preferredTone;
    if (input.keywords !== undefined) updateData.keywords = input.keywords;
    if (input.avoidWords !== undefined) updateData.avoidWords = input.avoidWords;
    if (input.competitors !== undefined) updateData.competitors = input.competitors;
    if (input.keyMessages !== undefined) updateData.keyMessages = input.keyMessages;
    if (input.terminology !== undefined) updateData.terminology = input.terminology;
    if (input.contentExamples !== undefined) updateData.contentExamples = input.contentExamples;
    if (input.additionalContext !== undefined) updateData.additionalContext = input.additionalContext;

    // Merge partial updates for nested objects
    if (input.voiceTone) {
      updateData.voiceTone = {
        ...existing.voiceTone,
        ...input.voiceTone
      };
    }

    if (input.targetAudience) {
      updateData.targetAudience = {
        ...existing.targetAudience,
        ...input.targetAudience
      };
    }

    return this.guidelineRepository.update(id, updateData);
  }

  /**
   * Delete brand guidelines.
   */
  async delete(id: BrandGuidelineId, deletedBy: UserId): Promise<void> {
    const guideline = await this.guidelineRepository.findById(id);
    if (!guideline) {
      throw new Error(UserCustomerErrorCodes.BRAND_GUIDELINE_NOT_FOUND);
    }

    if (guideline.isDefault) {
      throw new Error(UserCustomerErrorCodes.CANNOT_DELETE_DEFAULT);
    }

    await this.guidelineRepository.delete(id);
  }

  /**
   * Set brand guidelines as the default for the customer.
   */
  async setAsDefault(id: BrandGuidelineId, updatedBy: UserId): Promise<BrandGuideline> {
    const guideline = await this.guidelineRepository.findById(id);
    if (!guideline) {
      throw new Error(UserCustomerErrorCodes.BRAND_GUIDELINE_NOT_FOUND);
    }

    await this.guidelineRepository.setAsDefault(id, guideline.customerId);

    return this.guidelineRepository.update(id, {
      isDefault: true,
      updatedBy,
      updatedAt: now()
    });
  }
}

// =============================================================================
// USAGE SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Implementation of IUsageService.
 * Handles usage tracking and quota management.
 */
export class UsageService implements IUsageService {
  // Store daily history in memory
  private dailyHistory: Map<CustomerId, { date: string; articles: number; redditPosts: number }[]> =
    new Map();

  constructor(private customerRepository: ICustomerRepository) {}

  /**
   * Check if customer has quota remaining for an action.
   */
  async checkQuota(
    customerId: CustomerId,
    resourceType: 'article' | 'reddit_post' | 'clear_story' | 'user'
  ): Promise<{ allowed: boolean; remaining: number | 'unlimited'; limit: number | 'unlimited' }> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(UserCustomerErrorCodes.CUSTOMER_NOT_FOUND);
    }

    const { currentUsage, usageQuota } = customer;

    switch (resourceType) {
      case 'article': {
        const limit = usageQuota.articlesPerDay;
        if (limit === 'unlimited') {
          return { allowed: true, remaining: 'unlimited', limit: 'unlimited' };
        }
        const remaining = limit - currentUsage.articlesToday;
        return { allowed: remaining > 0, remaining: Math.max(0, remaining), limit };
      }
      case 'reddit_post': {
        const limit = usageQuota.redditPostsPerDay;
        if (limit === 'unlimited') {
          return { allowed: true, remaining: 'unlimited', limit: 'unlimited' };
        }
        const remaining = limit - currentUsage.redditPostsToday;
        return { allowed: remaining > 0, remaining: Math.max(0, remaining), limit };
      }
      case 'clear_story': {
        const limit = usageQuota.clearStoriesMax;
        if (limit === 'unlimited') {
          return { allowed: true, remaining: 'unlimited', limit: 'unlimited' };
        }
        const remaining = limit - currentUsage.clearStoriesCount;
        return { allowed: remaining > 0, remaining: Math.max(0, remaining), limit };
      }
      case 'user': {
        const limit = usageQuota.usersMax;
        if (limit === Infinity) {
          return { allowed: true, remaining: 'unlimited', limit: 'unlimited' };
        }
        const remaining = limit - currentUsage.usersCount;
        return { allowed: remaining > 0, remaining: Math.max(0, remaining), limit };
      }
    }
  }

  /**
   * Increment usage counter for a resource.
   */
  async incrementUsage(
    customerId: CustomerId,
    resourceType: 'article' | 'reddit_post' | 'clear_story' | 'user',
    amount: number = 1
  ): Promise<UsageTracking> {
    const quota = await this.checkQuota(customerId, resourceType);
    if (!quota.allowed) {
      throw new Error(UserCustomerErrorCodes.QUOTA_EXCEEDED);
    }

    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(UserCustomerErrorCodes.CUSTOMER_NOT_FOUND);
    }

    const usage = { ...customer.currentUsage };

    switch (resourceType) {
      case 'article':
        usage.articlesToday += amount;
        usage.articlesPeriodTotal += amount;
        break;
      case 'reddit_post':
        usage.redditPostsToday += amount;
        usage.redditPostsPeriodTotal += amount;
        break;
      case 'clear_story':
        usage.clearStoriesCount += amount;
        break;
      case 'user':
        usage.usersCount += amount;
        break;
    }

    await this.customerRepository.updateUsage(customerId, usage);
    return usage;
  }

  /**
   * Decrement usage counter.
   */
  async decrementUsage(
    customerId: CustomerId,
    resourceType: 'clear_story' | 'user',
    amount: number = 1
  ): Promise<UsageTracking> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(UserCustomerErrorCodes.CUSTOMER_NOT_FOUND);
    }

    const usage = { ...customer.currentUsage };

    switch (resourceType) {
      case 'clear_story':
        usage.clearStoriesCount = Math.max(0, usage.clearStoriesCount - amount);
        break;
      case 'user':
        usage.usersCount = Math.max(0, usage.usersCount - amount);
        break;
    }

    await this.customerRepository.updateUsage(customerId, usage);
    return usage;
  }

  /**
   * Get detailed usage statistics for a customer.
   */
  async getUsageStats(customerId: CustomerId): Promise<UsageStats> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(UserCustomerErrorCodes.CUSTOMER_NOT_FOUND);
    }

    const { currentUsage, usageQuota } = customer;

    // Calculate utilization percentages
    const calculatePercent = (current: number, limit: number | 'unlimited'): number => {
      if (limit === 'unlimited') return 0;
      return Math.round((current / limit) * 100);
    };

    const utilization = {
      articlesToday: calculatePercent(currentUsage.articlesToday, usageQuota.articlesPerDay),
      redditPostsToday: calculatePercent(
        currentUsage.redditPostsToday,
        usageQuota.redditPostsPerDay
      ),
      clearStories: calculatePercent(currentUsage.clearStoriesCount, usageQuota.clearStoriesMax),
      users: calculatePercent(currentUsage.usersCount, usageQuota.usersMax)
    };

    // Get or create daily history
    const history = this.dailyHistory.get(customerId) || [];

    // Calculate projected usage (simple linear projection)
    const daysInPeriod = 30;
    const daysSoFar = history.length || 1;
    const projectedPeriodUsage = {
      articles: Math.round((currentUsage.articlesPeriodTotal / daysSoFar) * daysInPeriod),
      redditPosts: Math.round((currentUsage.redditPostsPeriodTotal / daysSoFar) * daysInPeriod)
    };

    return {
      customerId,
      current: currentUsage,
      quota: usageQuota,
      dailyHistory: history,
      utilization,
      projectedPeriodUsage
    };
  }

  /**
   * Reset daily usage counters.
   */
  async resetDailyUsage(customerId?: CustomerId): Promise<void> {
    if (customerId) {
      await this.resetDailyForCustomer(customerId);
    } else {
      // Reset for all customers
      const { customers } = await this.customerRepository.findAll();
      for (const customer of customers) {
        await this.resetDailyForCustomer(customer.id);
      }
    }
  }

  /**
   * Reset period usage counters.
   */
  async resetPeriodUsage(customerId: CustomerId): Promise<void> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(UserCustomerErrorCodes.CUSTOMER_NOT_FOUND);
    }

    await this.customerRepository.updateUsage(customerId, {
      articlesToday: 0,
      redditPostsToday: 0,
      lastResetAt: now(),
      articlesPeriodTotal: 0,
      redditPostsPeriodTotal: 0
    });

    // Clear daily history
    this.dailyHistory.set(customerId, []);
  }

  /**
   * Helper to reset daily usage for a single customer.
   */
  private async resetDailyForCustomer(customerId: CustomerId): Promise<void> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) return;

    // Record today's usage in history
    const history = this.dailyHistory.get(customerId) || [];
    const today = new Date().toISOString().split('T')[0];

    history.push({
      date: today,
      articles: customer.currentUsage.articlesToday,
      redditPosts: customer.currentUsage.redditPostsToday
    });

    // Keep only last 30 days
    if (history.length > 30) {
      history.shift();
    }

    this.dailyHistory.set(customerId, history);

    // Reset daily counters
    await this.customerRepository.updateUsage(customerId, {
      articlesToday: 0,
      redditPostsToday: 0,
      lastResetAt: now()
    });
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create all services with in-memory repositories.
 * Useful for testing and development.
 */
export function createInMemoryServices(): {
  userService: UserService;
  customerService: CustomerService;
  brandGuidelineService: BrandGuidelineService;
  usageService: UsageService;
  repositories: {
    userRepository: InMemoryUserRepository;
    customerRepository: InMemoryCustomerRepository;
    brandGuidelineRepository: InMemoryBrandGuidelineRepository;
  };
} {
  const userRepository = new InMemoryUserRepository();
  const customerRepository = new InMemoryCustomerRepository();
  const brandGuidelineRepository = new InMemoryBrandGuidelineRepository();

  const userService = new UserService(userRepository, customerRepository);
  const customerService = new CustomerService(customerRepository);
  const brandGuidelineService = new BrandGuidelineService(
    brandGuidelineRepository,
    customerRepository
  );
  const usageService = new UsageService(customerRepository);

  return {
    userService,
    customerService,
    brandGuidelineService,
    usageService,
    repositories: {
      userRepository,
      customerRepository,
      brandGuidelineRepository
    }
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  toUserRef,
  toCustomerRef,
  sanitizeUser,
  createPaginatedResponse
};
