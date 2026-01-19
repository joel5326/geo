/**
 * User/Customer API Routes
 *
 * REST endpoints for managing Users, Customers, Brand Guidelines, and Usage
 * in the GEO Platform.
 *
 * @module api/routes/user-customer.routes
 * @version 1.0.0
 */

import { Hono } from 'hono';
import {
  createInMemoryServices,
} from '../../user-customer/user-customer.service';
import type {
  UserId,
  CustomerId,
  BrandGuidelineId,
  CustomerTier,
  PaginationParams,
} from '../../shared/shared.types';
import type {
  CreateUserInput,
  UpdateUserInput,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateBrandGuidelineInput,
  UpdateBrandGuidelineInput,
  AuthCredentials,
  OnboardingStep,
} from '../../domains/user-customer/user-customer.types';

// Create separate Hono apps for users and customers
const usersApp = new Hono();
const customersApp = new Hono();

// Initialize services with in-memory repositories
const {
  userService,
  customerService,
  brandGuidelineService,
  usageService,
} = createInMemoryServices();

// =============================================================================
// USER ENDPOINTS
// =============================================================================

/**
 * GET / - List users by customer
 */
usersApp.get('/', async (c) => {
  try {
    const customerId = c.req.query('customerId') as CustomerId;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const pagination: PaginationParams = { page, pageSize };
    const result = await userService.getByCustomer(customerId, pagination);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:id - Get user by ID
 */
usersApp.get('/:id', async (c) => {
  try {
    const id = c.req.param('id') as UserId;
    const user = await userService.getById(id);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /by-email/:email - Get user by email
 */
usersApp.get('/by-email/:email', async (c) => {
  try {
    const email = c.req.param('email');
    const user = await userService.getByEmail(email);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST / - Create a new user
 */
usersApp.post('/', async (c) => {
  try {
    const body = await c.req.json<CreateUserInput>();
    const createdBy = c.req.header('X-User-Id') as UserId || 'usr_system' as UserId;

    const user = await userService.create(body, createdBy);
    return c.json(user, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('EMAIL_ALREADY_EXISTS')) {
      return c.json({ error: 'Email already exists' }, 409);
    }
    if (message.includes('CUSTOMER_NOT_FOUND')) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * PUT /:id - Update a user
 */
usersApp.put('/:id', async (c) => {
  try {
    const id = c.req.param('id') as UserId;
    const body = await c.req.json<UpdateUserInput>();
    const updatedBy = c.req.header('X-User-Id') as UserId || 'usr_system' as UserId;

    const user = await userService.update(id, body, updatedBy);
    return c.json(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('USER_NOT_FOUND')) {
      return c.json({ error: 'User not found' }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * DELETE /:id - Delete (deactivate) a user
 */
usersApp.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id') as UserId;
    const deletedBy = c.req.header('X-User-Id') as UserId || 'usr_system' as UserId;

    await userService.delete(id, deletedBy);
    return c.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('USER_NOT_FOUND')) {
      return c.json({ error: 'User not found' }, 404);
    }
    if (message.includes('CANNOT_DELETE_LAST_ADMIN')) {
      return c.json({ error: 'Cannot delete the last admin' }, 400);
    }
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// AUTHENTICATION ENDPOINTS
// =============================================================================

/**
 * POST /auth/login - Authenticate user
 */
usersApp.post('/auth/login', async (c) => {
  try {
    const body = await c.req.json<AuthCredentials>();
    const ipAddress = c.req.header('X-Forwarded-For') || '127.0.0.1';
    const userAgent = c.req.header('User-Agent') || 'Unknown';

    const result = await userService.authenticate(body, { ipAddress, userAgent });
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('INVALID_CREDENTIALS')) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    if (message.includes('ACCOUNT_LOCKED')) {
      return c.json({ error: 'Account is locked' }, 403);
    }
    if (message.includes('ACCOUNT_INACTIVE')) {
      return c.json({ error: 'Account is inactive' }, 403);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /auth/refresh - Refresh access token
 */
usersApp.post('/auth/refresh', async (c) => {
  try {
    const body = await c.req.json<{ refreshToken: string }>();

    if (!body.refreshToken) {
      return c.json({ error: 'Refresh token is required' }, 400);
    }

    const tokens = await userService.refreshToken(body.refreshToken);
    return c.json(tokens);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('INVALID_TOKEN')) {
      return c.json({ error: 'Invalid token' }, 401);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /auth/logout - Logout user
 */
usersApp.post('/auth/logout', async (c) => {
  try {
    const body = await c.req.json<{ sessionId: string; allSessions?: boolean }>();

    if (!body.sessionId) {
      return c.json({ error: 'Session ID is required' }, 400);
    }

    await userService.logout(body.sessionId, body.allSessions);
    return c.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// CUSTOMER ENDPOINTS
// =============================================================================

/**
 * GET / - List customers by tier
 */
customersApp.get('/', async (c) => {
  try {
    const tier = c.req.query('tier') as CustomerTier | undefined;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

    if (tier) {
      const pagination: PaginationParams = { page, pageSize };
      const result = await customerService.getByTier(tier, pagination);
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
 * GET /:id - Get customer by ID
 */
customersApp.get('/:id', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;
    const customer = await customerService.getById(id);

    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    return c.json(customer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST / - Create a new customer
 */
customersApp.post('/', async (c) => {
  try {
    const body = await c.req.json<CreateCustomerInput>();
    const createdBy = c.req.header('X-User-Id') as UserId | undefined;

    const customer = await customerService.create(body, createdBy);
    return c.json(customer, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

/**
 * PUT /:id - Update a customer
 */
customersApp.put('/:id', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;
    const body = await c.req.json<UpdateCustomerInput>();
    const updatedBy = c.req.header('X-User-Id') as UserId || 'usr_system' as UserId;

    const customer = await customerService.update(id, body, updatedBy);
    return c.json(customer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('CUSTOMER_NOT_FOUND')) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * DELETE /:id - Suspend a customer
 */
customersApp.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;
    const body = await c.req.json<{ reason: string }>();
    const deletedBy = c.req.header('X-User-Id') as UserId || 'usr_system' as UserId;

    if (!body.reason) {
      return c.json({ error: 'Suspension reason is required' }, 400);
    }

    await customerService.delete(id, body.reason, deletedBy);
    return c.json({ success: true, message: 'Customer suspended' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('CUSTOMER_NOT_FOUND')) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// ONBOARDING ENDPOINTS
// =============================================================================

/**
 * GET /:id/onboarding - Get onboarding progress
 */
customersApp.get('/:id/onboarding', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;

    const progress = await customerService.getOnboardingProgress(id);
    return c.json(progress);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/onboarding/complete-step - Complete an onboarding step
 */
customersApp.post('/:id/onboarding/complete-step', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;
    const body = await c.req.json<{ step: OnboardingStep }>();

    if (!body.step) {
      return c.json({ error: 'Step is required' }, 400);
    }

    const progress = await customerService.completeOnboardingStep(id, body.step);
    return c.json(progress);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('STEP_ALREADY_COMPLETED')) {
      return c.json({ error: 'Step already completed' }, 400);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/onboarding/complete - Mark onboarding as complete
 */
customersApp.post('/:id/onboarding/complete', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;

    const customer = await customerService.completeOnboarding(id);
    return c.json(customer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('CUSTOMER_NOT_FOUND')) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// TIER MANAGEMENT
// =============================================================================

/**
 * POST /:id/change-tier - Change customer tier
 */
customersApp.post('/:id/change-tier', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;
    const body = await c.req.json<{ newTier: CustomerTier }>();
    const updatedBy = c.req.header('X-User-Id') as UserId || 'usr_system' as UserId;

    if (!body.newTier) {
      return c.json({ error: 'New tier is required' }, 400);
    }

    const customer = await customerService.changeTier(id, body.newTier, updatedBy);
    return c.json(customer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('CUSTOMER_NOT_FOUND')) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    if (message.includes('TIER_DOWNGRADE_NOT_ALLOWED')) {
      return c.json({ error: 'Tier downgrade not allowed - usage exceeds new limits' }, 400);
    }
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// BRAND GUIDELINES ENDPOINTS
// =============================================================================

/**
 * GET /:id/brand-guidelines - Get brand guidelines for customer
 */
customersApp.get('/:id/brand-guidelines', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;

    const guidelines = await brandGuidelineService.getByCustomer(id);
    return c.json({ data: guidelines });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:id/brand-guidelines/default - Get default brand guidelines
 */
customersApp.get('/:id/brand-guidelines/default', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;

    const guideline = await brandGuidelineService.getDefault(id);
    if (!guideline) {
      return c.json({ error: 'No default brand guideline found' }, 404);
    }

    return c.json(guideline);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/brand-guidelines - Create brand guidelines
 */
customersApp.post('/:id/brand-guidelines', async (c) => {
  try {
    const customerId = c.req.param('id') as CustomerId;
    const body = await c.req.json<Omit<CreateBrandGuidelineInput, 'customerId'>>();
    const createdBy = c.req.header('X-User-Id') as UserId || 'usr_system' as UserId;

    const guideline = await brandGuidelineService.create(
      { ...body, customerId },
      createdBy
    );
    return c.json(guideline, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('CUSTOMER_NOT_FOUND')) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * PUT /brand-guidelines/:guidelineId - Update brand guidelines
 */
customersApp.put('/brand-guidelines/:guidelineId', async (c) => {
  try {
    const guidelineId = c.req.param('guidelineId') as BrandGuidelineId;
    const body = await c.req.json<UpdateBrandGuidelineInput>();
    const updatedBy = c.req.header('X-User-Id') as UserId || 'usr_system' as UserId;

    const guideline = await brandGuidelineService.update(guidelineId, body, updatedBy);
    return c.json(guideline);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('BRAND_GUIDELINE_NOT_FOUND')) {
      return c.json({ error: 'Brand guideline not found' }, 404);
    }
    return c.json({ error: message }, 400);
  }
});

/**
 * DELETE /brand-guidelines/:guidelineId - Delete brand guidelines
 */
customersApp.delete('/brand-guidelines/:guidelineId', async (c) => {
  try {
    const guidelineId = c.req.param('guidelineId') as BrandGuidelineId;
    const deletedBy = c.req.header('X-User-Id') as UserId || 'usr_system' as UserId;

    await brandGuidelineService.delete(guidelineId, deletedBy);
    return c.json({ success: true, message: 'Brand guideline deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('BRAND_GUIDELINE_NOT_FOUND')) {
      return c.json({ error: 'Brand guideline not found' }, 404);
    }
    if (message.includes('CANNOT_DELETE_DEFAULT')) {
      return c.json({ error: 'Cannot delete default brand guideline' }, 400);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /brand-guidelines/:guidelineId/set-default - Set as default
 */
customersApp.post('/brand-guidelines/:guidelineId/set-default', async (c) => {
  try {
    const guidelineId = c.req.param('guidelineId') as BrandGuidelineId;
    const updatedBy = c.req.header('X-User-Id') as UserId || 'usr_system' as UserId;

    const guideline = await brandGuidelineService.setAsDefault(guidelineId, updatedBy);
    return c.json(guideline);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('BRAND_GUIDELINE_NOT_FOUND')) {
      return c.json({ error: 'Brand guideline not found' }, 404);
    }
    return c.json({ error: message }, 500);
  }
});

// =============================================================================
// USAGE ENDPOINTS
// =============================================================================

/**
 * GET /:id/usage - Get usage statistics
 */
customersApp.get('/:id/usage', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;

    const stats = await usageService.getUsageStats(id);
    return c.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('CUSTOMER_NOT_FOUND')) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:id/usage/quota - Check quota for a resource
 */
customersApp.get('/:id/usage/quota', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;
    const resourceType = c.req.query('resourceType') as 'article' | 'reddit_post' | 'clear_story' | 'user';

    if (!resourceType) {
      return c.json({ error: 'Resource type is required' }, 400);
    }

    const quota = await usageService.checkQuota(id, resourceType);
    return c.json(quota);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('CUSTOMER_NOT_FOUND')) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/usage/increment - Increment usage
 */
customersApp.post('/:id/usage/increment', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;
    const body = await c.req.json<{
      resourceType: 'article' | 'reddit_post' | 'clear_story' | 'user';
      amount?: number;
    }>();

    if (!body.resourceType) {
      return c.json({ error: 'Resource type is required' }, 400);
    }

    const usage = await usageService.incrementUsage(id, body.resourceType, body.amount);
    return c.json(usage);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('CUSTOMER_NOT_FOUND')) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    if (message.includes('QUOTA_EXCEEDED')) {
      return c.json({ error: 'Quota exceeded' }, 429);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/usage/reset-daily - Reset daily usage counters
 */
customersApp.post('/:id/usage/reset-daily', async (c) => {
  try {
    const id = c.req.param('id') as CustomerId;

    await usageService.resetDailyUsage(id);
    return c.json({ success: true, message: 'Daily usage reset' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export { usersApp, customersApp };
export default usersApp;
