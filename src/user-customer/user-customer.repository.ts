/**
 * GEO Platform - User/Customer Domain Repositories
 *
 * In-memory repository implementations for User, Customer, and BrandGuideline entities.
 * These implementations use Maps for storage and are suitable for testing and development.
 *
 * @module user-customer/user-customer.repository
 * @version 1.0.0
 */

import {
  UserId,
  CustomerId,
  BrandGuidelineId,
  CustomerTier,
  ContentTone,
  ISOTimestamp,
  PaginationParams
} from '../shared/shared.types';

import {
  User,
  Customer,
  BrandGuideline,
  UserRole,
  OnboardingStatus,
  UsageQuota,
  UsageTracking,
  VoiceTone,
  TargetAudience,
  TerminologyEntry,
  ContentExample,
  CreateUserInput,
  CreateCustomerInput,
  CreateBrandGuidelineInput,
  IUserRepository,
  ICustomerRepository,
  IBrandGuidelineRepository,
  TIER_QUOTAS
} from '../domains/user-customer/user-customer.types';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a branded UserId
 */
function generateUserId(): UserId {
  return `usr_${crypto.randomUUID()}` as UserId;
}

/**
 * Generate a branded CustomerId
 */
function generateCustomerId(): CustomerId {
  return `cust_${crypto.randomUUID()}` as CustomerId;
}

/**
 * Generate a branded BrandGuidelineId
 */
function generateBrandGuidelineId(): BrandGuidelineId {
  return `bg_${crypto.randomUUID()}` as BrandGuidelineId;
}

/**
 * Get current ISO timestamp
 */
function now(): ISOTimestamp {
  return new Date().toISOString() as ISOTimestamp;
}

/**
 * Create default usage tracking
 */
function createDefaultUsageTracking(): UsageTracking {
  return {
    articlesToday: 0,
    redditPostsToday: 0,
    clearStoriesCount: 0,
    usersCount: 0,
    lastResetAt: now(),
    articlesPeriodTotal: 0,
    redditPostsPeriodTotal: 0
  };
}

// =============================================================================
// IN-MEMORY USER REPOSITORY
// =============================================================================

/**
 * In-memory implementation of IUserRepository.
 * Uses a Map for storage with email index for fast lookups.
 */
export class InMemoryUserRepository implements IUserRepository {
  private users: Map<UserId, User> = new Map();
  private emailIndex: Map<string, UserId> = new Map();

  /**
   * Create a new user.
   */
  async create(input: CreateUserInput & { passwordHash: string }): Promise<User> {
    const id = generateUserId();
    const timestamp = now();

    const user: User = {
      id,
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      customerId: input.customerId,
      role: input.role,
      isActive: true,
      isEmailVerified: false,
      lastLoginAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      timezone: input.timezone || 'UTC',
      preferredLanguage: input.preferredLanguage || 'en',
      avatarUrl: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.users.set(id, user);
    this.emailIndex.set(user.email.toLowerCase(), id);

    return user;
  }

  /**
   * Find user by ID.
   */
  async findById(id: UserId): Promise<User | null> {
    return this.users.get(id) || null;
  }

  /**
   * Find user by email (case-insensitive).
   */
  async findByEmail(email: string): Promise<User | null> {
    const userId = this.emailIndex.get(email.toLowerCase());
    if (!userId) return null;
    return this.users.get(userId) || null;
  }

  /**
   * Find all users for a customer.
   */
  async findByCustomer(
    customerId: CustomerId,
    options?: PaginationParams & { role?: UserRole; isActive?: boolean }
  ): Promise<{ users: User[]; total: number }> {
    let users = Array.from(this.users.values()).filter(
      (user) => user.customerId === customerId
    );

    // Apply filters
    if (options?.role !== undefined) {
      users = users.filter((user) => user.role === options.role);
    }
    if (options?.isActive !== undefined) {
      users = users.filter((user) => user.isActive === options.isActive);
    }

    const total = users.length;

    // Apply pagination
    if (options?.page && options?.pageSize) {
      const start = (options.page - 1) * options.pageSize;
      users = users.slice(start, start + options.pageSize);
    }

    return { users, total };
  }

  /**
   * Update a user.
   */
  async update(id: UserId, input: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }

    // Update email index if email is changing
    if (input.email && input.email !== user.email) {
      this.emailIndex.delete(user.email.toLowerCase());
      this.emailIndex.set(input.email.toLowerCase(), id);
    }

    const updatedUser: User = {
      ...user,
      ...input,
      id, // Ensure ID cannot be changed
      updatedAt: now()
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  /**
   * Soft delete a user (set isActive to false).
   */
  async softDelete(id: UserId): Promise<void> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }

    user.isActive = false;
    user.updatedAt = now();
    this.users.set(id, user);
  }

  /**
   * Count users for a customer.
   */
  async countByCustomer(customerId: CustomerId): Promise<number> {
    return Array.from(this.users.values()).filter(
      (user) => user.customerId === customerId && user.isActive
    ).length;
  }

  /**
   * Check if email exists.
   */
  async emailExists(email: string, excludeUserId?: UserId): Promise<boolean> {
    const existingUserId = this.emailIndex.get(email.toLowerCase());
    if (!existingUserId) return false;
    if (excludeUserId && existingUserId === excludeUserId) return false;
    return true;
  }

  /**
   * Update login tracking (lastLoginAt, failedLoginAttempts).
   */
  async updateLoginAttempt(id: UserId, success: boolean): Promise<void> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }

    if (success) {
      user.lastLoginAt = now();
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
    } else {
      user.failedLoginAttempts += 1;
    }

    user.updatedAt = now();
    this.users.set(id, user);
  }

  /**
   * Lock/unlock user account.
   */
  async setLockStatus(id: UserId, lockedUntil: ISOTimestamp | null): Promise<void> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }

    user.lockedUntil = lockedUntil;
    user.updatedAt = now();
    this.users.set(id, user);
  }

  /**
   * Clear all data (for testing).
   */
  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
  }
}

// =============================================================================
// IN-MEMORY CUSTOMER REPOSITORY
// =============================================================================

/**
 * In-memory implementation of ICustomerRepository.
 * Uses a Map for storage.
 */
export class InMemoryCustomerRepository implements ICustomerRepository {
  private customers: Map<CustomerId, Customer> = new Map();

  /**
   * Create a new customer.
   */
  async create(input: CreateCustomerInput & { usageQuota: UsageQuota }): Promise<Customer> {
    const id = generateCustomerId();
    const timestamp = now();
    const tier = input.tier || ('trial' as CustomerTier);

    const customer: Customer = {
      id,
      companyName: input.companyName,
      tier,
      website: input.website,
      industry: input.industry,
      description: input.description || null,
      billingEmail: input.billingEmail,
      usageQuota: input.usageQuota,
      currentUsage: createDefaultUsageTracking(),
      onboardingStatus: OnboardingStatus.not_started,
      onboardingCompletedAt: null,
      stripeCustomerId: null,
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      isActive: true,
      suspendedReason: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.customers.set(id, customer);
    return customer;
  }

  /**
   * Find customer by ID.
   */
  async findById(id: CustomerId): Promise<Customer | null> {
    return this.customers.get(id) || null;
  }

  /**
   * Find customers by tier.
   */
  async findByTier(
    tier: CustomerTier,
    options?: PaginationParams & { isActive?: boolean }
  ): Promise<{ customers: Customer[]; total: number }> {
    let customers = Array.from(this.customers.values()).filter(
      (customer) => customer.tier === tier
    );

    if (options?.isActive !== undefined) {
      customers = customers.filter((c) => c.isActive === options.isActive);
    }

    const total = customers.length;

    if (options?.page && options?.pageSize) {
      const start = (options.page - 1) * options.pageSize;
      customers = customers.slice(start, start + options.pageSize);
    }

    return { customers, total };
  }

  /**
   * Find all customers with optional filters.
   */
  async findAll(
    options?: PaginationParams & {
      tier?: CustomerTier;
      isActive?: boolean;
      onboardingStatus?: OnboardingStatus;
      search?: string;
    }
  ): Promise<{ customers: Customer[]; total: number }> {
    let customers = Array.from(this.customers.values());

    if (options?.tier !== undefined) {
      customers = customers.filter((c) => c.tier === options.tier);
    }
    if (options?.isActive !== undefined) {
      customers = customers.filter((c) => c.isActive === options.isActive);
    }
    if (options?.onboardingStatus !== undefined) {
      customers = customers.filter((c) => c.onboardingStatus === options.onboardingStatus);
    }
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      customers = customers.filter((c) =>
        c.companyName.toLowerCase().includes(searchLower)
      );
    }

    const total = customers.length;

    if (options?.page && options?.pageSize) {
      const start = (options.page - 1) * options.pageSize;
      customers = customers.slice(start, start + options.pageSize);
    }

    return { customers, total };
  }

  /**
   * Update a customer.
   */
  async update(id: CustomerId, input: Partial<Customer>): Promise<Customer> {
    const customer = this.customers.get(id);
    if (!customer) {
      throw new Error(`Customer not found: ${id}`);
    }

    const updatedCustomer: Customer = {
      ...customer,
      ...input,
      id, // Ensure ID cannot be changed
      updatedAt: now()
    };

    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  /**
   * Update customer usage tracking.
   */
  async updateUsage(id: CustomerId, usage: Partial<UsageTracking>): Promise<Customer> {
    const customer = this.customers.get(id);
    if (!customer) {
      throw new Error(`Customer not found: ${id}`);
    }

    customer.currentUsage = {
      ...customer.currentUsage,
      ...usage
    };
    customer.updatedAt = now();

    this.customers.set(id, customer);
    return customer;
  }

  /**
   * Suspend a customer.
   */
  async suspend(id: CustomerId, reason: string): Promise<void> {
    const customer = this.customers.get(id);
    if (!customer) {
      throw new Error(`Customer not found: ${id}`);
    }

    customer.isActive = false;
    customer.suspendedReason = reason;
    customer.updatedAt = now();

    this.customers.set(id, customer);
  }

  /**
   * Reactivate a suspended customer.
   */
  async reactivate(id: CustomerId): Promise<void> {
    const customer = this.customers.get(id);
    if (!customer) {
      throw new Error(`Customer not found: ${id}`);
    }

    customer.isActive = true;
    customer.suspendedReason = null;
    customer.updatedAt = now();

    this.customers.set(id, customer);
  }

  /**
   * Find customers with expiring trials.
   */
  async findExpiringTrials(withinDays: number): Promise<Customer[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + withinDays);

    return Array.from(this.customers.values()).filter((customer) => {
      if (customer.tier !== ('trial' as CustomerTier)) return false;
      if (!customer.subscriptionEndDate) return false;
      const endDate = new Date(customer.subscriptionEndDate);
      return endDate <= cutoffDate && endDate > new Date();
    });
  }

  /**
   * Find customers approaching quota limits.
   */
  async findApproachingLimits(thresholdPercentage: number): Promise<Customer[]> {
    return Array.from(this.customers.values()).filter((customer) => {
      if (!customer.isActive) return false;

      const { currentUsage, usageQuota } = customer;

      // Check articles
      if (usageQuota.articlesPerDay !== 'unlimited') {
        const articlePercent = (currentUsage.articlesToday / usageQuota.articlesPerDay) * 100;
        if (articlePercent >= thresholdPercentage) return true;
      }

      // Check Reddit posts
      if (usageQuota.redditPostsPerDay !== 'unlimited') {
        const postPercent = (currentUsage.redditPostsToday / usageQuota.redditPostsPerDay) * 100;
        if (postPercent >= thresholdPercentage) return true;
      }

      // Check Clear Stories
      if (usageQuota.clearStoriesMax !== 'unlimited') {
        const storyPercent = (currentUsage.clearStoriesCount / usageQuota.clearStoriesMax) * 100;
        if (storyPercent >= thresholdPercentage) return true;
      }

      return false;
    });
  }

  /**
   * Clear all data (for testing).
   */
  clear(): void {
    this.customers.clear();
  }
}

// =============================================================================
// IN-MEMORY BRAND GUIDELINE REPOSITORY
// =============================================================================

/**
 * In-memory implementation of IBrandGuidelineRepository.
 * Uses a Map for storage.
 */
export class InMemoryBrandGuidelineRepository implements IBrandGuidelineRepository {
  private guidelines: Map<BrandGuidelineId, BrandGuideline> = new Map();

  /**
   * Create new brand guidelines.
   */
  async create(input: CreateBrandGuidelineInput): Promise<BrandGuideline> {
    const id = generateBrandGuidelineId();
    const timestamp = now();

    // If this is marked as default, unset other defaults for this customer
    if (input.isDefault) {
      await this.unsetDefaultsForCustomer(input.customerId);
    }

    const guideline: BrandGuideline = {
      id,
      customerId: input.customerId,
      name: input.name,
      isDefault: input.isDefault ?? false,
      voiceTone: input.voiceTone,
      preferredTone: input.preferredTone,
      keywords: input.keywords,
      avoidWords: input.avoidWords || [],
      competitors: input.competitors || [],
      targetAudience: input.targetAudience,
      keyMessages: input.keyMessages || [],
      terminology: input.terminology || [],
      contentExamples: input.contentExamples || [],
      additionalContext: input.additionalContext || null,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: 'system' as UserId, // Will be overwritten by service
      updatedBy: 'system' as UserId
    };

    this.guidelines.set(id, guideline);
    return guideline;
  }

  /**
   * Find brand guidelines by ID.
   */
  async findById(id: BrandGuidelineId): Promise<BrandGuideline | null> {
    return this.guidelines.get(id) || null;
  }

  /**
   * Find all brand guidelines for a customer.
   */
  async findByCustomer(customerId: CustomerId): Promise<BrandGuideline[]> {
    return Array.from(this.guidelines.values()).filter(
      (g) => g.customerId === customerId
    );
  }

  /**
   * Find the default brand guidelines for a customer.
   */
  async findDefault(customerId: CustomerId): Promise<BrandGuideline | null> {
    const guidelines = Array.from(this.guidelines.values());
    return guidelines.find((g) => g.customerId === customerId && g.isDefault) || null;
  }

  /**
   * Update brand guidelines.
   */
  async update(id: BrandGuidelineId, input: Partial<BrandGuideline>): Promise<BrandGuideline> {
    const guideline = this.guidelines.get(id);
    if (!guideline) {
      throw new Error(`Brand guideline not found: ${id}`);
    }

    // If setting as default, unset other defaults
    if (input.isDefault === true && !guideline.isDefault) {
      await this.unsetDefaultsForCustomer(guideline.customerId);
    }

    const updatedGuideline: BrandGuideline = {
      ...guideline,
      ...input,
      id, // Ensure ID cannot be changed
      customerId: guideline.customerId, // Ensure customerId cannot be changed
      updatedAt: now()
    };

    this.guidelines.set(id, updatedGuideline);
    return updatedGuideline;
  }

  /**
   * Delete brand guidelines.
   */
  async delete(id: BrandGuidelineId): Promise<void> {
    if (!this.guidelines.has(id)) {
      throw new Error(`Brand guideline not found: ${id}`);
    }
    this.guidelines.delete(id);
  }

  /**
   * Set a brand guideline as default (unsets previous default).
   */
  async setAsDefault(id: BrandGuidelineId, customerId: CustomerId): Promise<void> {
    const guideline = this.guidelines.get(id);
    if (!guideline) {
      throw new Error(`Brand guideline not found: ${id}`);
    }

    if (guideline.customerId !== customerId) {
      throw new Error('Brand guideline does not belong to this customer');
    }

    // Unset other defaults
    await this.unsetDefaultsForCustomer(customerId);

    // Set this one as default
    guideline.isDefault = true;
    guideline.updatedAt = now();
    this.guidelines.set(id, guideline);
  }

  /**
   * Count brand guidelines for a customer.
   */
  async countByCustomer(customerId: CustomerId): Promise<number> {
    return Array.from(this.guidelines.values()).filter(
      (g) => g.customerId === customerId
    ).length;
  }

  /**
   * Helper to unset all default flags for a customer.
   */
  private async unsetDefaultsForCustomer(customerId: CustomerId): Promise<void> {
    const guidelines = Array.from(this.guidelines.values()).filter(
      (g) => g.customerId === customerId && g.isDefault
    );

    for (const g of guidelines) {
      g.isDefault = false;
      g.updatedAt = now();
      this.guidelines.set(g.id, g);
    }
  }

  /**
   * Clear all data (for testing).
   */
  clear(): void {
    this.guidelines.clear();
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  generateUserId,
  generateCustomerId,
  generateBrandGuidelineId,
  now,
  createDefaultUsageTracking
};
