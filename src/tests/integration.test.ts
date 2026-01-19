/**
 * GEO Platform - Integration Test
 *
 * End-to-end integration test that exercises all 7 domain services
 * with their in-memory repositories. Tests the complete content
 * workflow from customer creation through analytics tracking.
 *
 * @module tests/integration.test
 * @version 1.0.0
 */

// =============================================================================
// IMPORTS - Services and Factories
// =============================================================================

// User/Customer Domain
import {
  UserService,
  CustomerService,
  BrandGuidelineService,
  UsageService,
} from '../user-customer/user-customer.service';
import {
  InMemoryUserRepository,
  InMemoryCustomerRepository,
  InMemoryBrandGuidelineRepository,
} from '../user-customer/user-customer.repository';

// Clear Story Domain
import { ClearStoryService } from '../clear-story/clear-story.service';
import { InMemoryClearStoryRepository } from '../clear-story/clear-story.repository';

// Article Domain
import {
  ArticleService,
  InMemoryArticleRepository,
  InMemoryArticleVersionRepository,
} from '../article/article.service';

// Reddit Distribution Domain
import {
  RedditDistributionService,
} from '../reddit-distribution/reddit-distribution.service';
import {
  InMemoryRedditPostRepository,
  InMemorySubredditRepository,
  InMemoryRedditRateLimitRepository,
} from '../reddit-distribution/reddit-distribution.repository';

// Scheduling Domain
import { SchedulingService } from '../scheduling/scheduling.service';
import { InMemoryScheduledTaskRepository } from '../scheduling/scheduling.repository';

// Analytics Domain
import { AnalyticsService } from '../analytics/analytics.service';

// Agent Orchestration Domain
import { AgentOrchestrationService } from '../agent-orchestration/agent-orchestration.service';
import {
  InMemoryAgentSessionRepository,
  InMemoryAgentWorkflowRepository,
  InMemoryWorkflowExecutionRepository,
  InMemoryAgentInvocationRepository,
} from '../agent-orchestration/agent-orchestration.repository';

// Shared Types
import {
  UserId,
  CustomerId,
  ClearStoryId,
  ArticleId,
  RedditPostId,
  ScheduleId,
  AgentSessionId,
  ISOTimestamp,
  UserRef,
  CustomerRef,
  ArticleStatus,
  ScheduleStatus,
  ContentTone,
  ClearStorySource,
  CustomerTier,
  AgentType,
} from '../shared/shared.types';

// Domain-specific Types
import {
  ClearStoryStatus,
  ClearStoryCategory,
} from '../domains/clear-story/clear-story.types';
import {
  AnalyticsEntityType,
  ReportPeriod,
  ISOTimestamp as AnalyticsISOTimestamp,
} from '../domains/analytics/analytics.types';
import {
  UserRole,
} from '../domains/user-customer/user-customer.types';
import {
  ArticleGeneratorResult,
  ArticleRef,
  ToolCallStatus,
} from '../domains/agent-orchestration/agent-orchestration.types';

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Generates a current ISO timestamp.
 */
function now(): ISOTimestamp {
  return new Date().toISOString() as ISOTimestamp;
}

/**
 * Generates a future ISO timestamp (hours from now).
 */
function futureTime(hoursFromNow: number): ISOTimestamp {
  const future = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  return future.toISOString() as ISOTimestamp;
}

/**
 * Simple assertion helper that throws on failure.
 */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Log step progress with formatting.
 */
function logStep(stepNumber: number, description: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STEP ${stepNumber}: ${description}`);
  console.log('='.repeat(60));
}

/**
 * Log success message.
 */
function logSuccess(message: string): void {
  console.log(`  [SUCCESS] ${message}`);
}

/**
 * Log info message.
 */
function logInfo(message: string): void {
  console.log(`  [INFO] ${message}`);
}

// =============================================================================
// SERVICE INITIALIZATION
// =============================================================================

/**
 * Initialize all domain services with in-memory repositories.
 */
function initializeServices() {
  // User/Customer Domain
  const userRepository = new InMemoryUserRepository();
  const customerRepository = new InMemoryCustomerRepository();
  const brandGuidelineRepository = new InMemoryBrandGuidelineRepository();

  const userService = new UserService(userRepository, customerRepository);
  const customerService = new CustomerService(customerRepository);
  const brandGuidelineService = new BrandGuidelineService(brandGuidelineRepository, customerRepository);
  const usageService = new UsageService(customerRepository);

  // Clear Story Domain
  const clearStoryRepository = new InMemoryClearStoryRepository();
  const clearStoryService = new ClearStoryService(clearStoryRepository);

  // Article Domain
  const articleRepository = new InMemoryArticleRepository();
  const articleVersionRepository = new InMemoryArticleVersionRepository();
  const articleService = new ArticleService(articleRepository, articleVersionRepository);

  // Reddit Distribution Domain
  const redditPostRepository = new InMemoryRedditPostRepository();
  const subredditRepository = new InMemorySubredditRepository();
  const rateLimitRepository = new InMemoryRedditRateLimitRepository();
  const redditService = new RedditDistributionService(
    redditPostRepository,
    subredditRepository,
    rateLimitRepository
  );

  // Scheduling Domain
  const scheduledTaskRepository = new InMemoryScheduledTaskRepository();
  const schedulingService = new SchedulingService(scheduledTaskRepository);

  // Analytics Domain
  const analyticsService = new AnalyticsService();

  // Agent Orchestration Domain
  const sessionRepository = new InMemoryAgentSessionRepository();
  const workflowRepository = new InMemoryAgentWorkflowRepository();
  const executionRepository = new InMemoryWorkflowExecutionRepository();
  const invocationRepository = new InMemoryAgentInvocationRepository();
  const agentService = new AgentOrchestrationService(
    sessionRepository,
    workflowRepository,
    executionRepository,
    invocationRepository
  );

  return {
    userService,
    customerService,
    brandGuidelineService,
    usageService,
    clearStoryService,
    articleService,
    redditService,
    schedulingService,
    analyticsService,
    agentService,
  };
}

// =============================================================================
// INTEGRATION TEST
// =============================================================================

/**
 * Main integration test function.
 * Runs through the complete GEO Platform workflow.
 */
async function runIntegrationTest(): Promise<void> {
  console.log('\n');
  console.log('#'.repeat(70));
  console.log('#  GEO AUTOMATION PLATFORM - INTEGRATION TEST');
  console.log('#  Testing all 7 domain services with end-to-end workflow');
  console.log('#'.repeat(70));

  // Initialize all services
  const services = initializeServices();
  logInfo('All 7 domain services initialized with in-memory repositories');

  // Track created IDs for cross-domain references
  let customerId: CustomerId;
  let userId: UserId;
  let userRef: UserRef;
  let customerRef: CustomerRef;
  let clearStoryId: ClearStoryId;
  let articleId: ArticleId;
  let redditPostId: RedditPostId;
  let scheduleId: ScheduleId;
  let agentSessionId: AgentSessionId;

  // =========================================================================
  // STEP 1: User/Customer Domain - Create Customer and User
  // =========================================================================
  logStep(1, 'User/Customer Domain - Create Customer and User');

  // 1a. Create Customer
  const customer = await services.customerService.create({
    companyName: 'Test Company Inc.',
    website: 'https://testcompany.com',
    industry: 'Technology',
    billingEmail: 'billing@testcompany.com',
    tier: CustomerTier.growth,
  });

  customerId = customer.id;
  customerRef = {
    id: customer.id,
    companyName: customer.companyName,
    tier: customer.tier,
  };

  logSuccess(`Customer created: ${customer.companyName} (ID: ${customerId})`);
  logInfo(`Tier: ${customer.tier}, Industry: ${customer.industry}`);

  assert(customer.id !== undefined, 'Customer ID should be defined');
  assert(customer.companyName === 'Test Company Inc.', 'Company name should match');

  // 1b. Create User
  const user = await services.userService.create(
    {
      customerId,
      email: 'user@testcompany.com',
      displayName: 'Test User',
      password: 'securePassword123!',
      role: UserRole.admin,
    },
    'usr_system' as UserId
  );

  userId = user.id;
  userRef = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };

  logSuccess(`User created: ${user.displayName} (ID: ${userId})`);
  logInfo(`Email: ${user.email}, Role: ${user.role}`);

  assert(user.id !== undefined, 'User ID should be defined');
  assert(user.customerId === customerId, 'User should belong to the customer');

  // =========================================================================
  // STEP 2: Clear Story Domain - Create Clear Story with Beliefs
  // =========================================================================
  logStep(2, 'Clear Story Domain - Create Clear Story with Beliefs');

  const clearStory = await services.clearStoryService.create(
    {
      customerId,
      topic: 'AI-Powered Code Review',
      belief:
        'Teams using AI-assisted code review tools ship 40% faster while maintaining higher code quality, because AI catches common issues before human reviewers even see the code.',
      source: ClearStorySource.customer_interview,
      category: ClearStoryCategory.product_capability,
      confidence: 'high',
      tags: ['AI', 'code-review', 'developer-productivity', 'software-quality'],
      targetAudiences: ['Software Engineers', 'Engineering Managers', 'CTOs'],
      recommendedTones: [ContentTone.authoritative, ContentTone.educational],
      evidence: [
        {
          type: 'statistic',
          content: '40% reduction in code review cycle time reported by enterprise customers',
          sourceUrl: 'https://testcompany.com/case-studies',
          credibility: 0.9,
        },
      ],
    },
    userId
  );

  clearStoryId = clearStory.id;

  logSuccess(`Clear Story created: ${clearStory.topic} (ID: ${clearStoryId})`);
  logInfo(`Belief: "${clearStory.belief.substring(0, 80)}..."`);
  logInfo(`Source: ${clearStory.source}, Category: ${clearStory.category}`);
  logInfo(`Confidence: ${clearStory.confidence}, Tags: ${clearStory.tags.join(', ')}`);

  assert(clearStory.id !== undefined, 'Clear Story ID should be defined');
  assert(clearStory.customerId === customerId, 'Clear Story should belong to the customer');
  assert(clearStory.status === ClearStoryStatus.draft, 'Initial status should be draft');

  // Activate the Clear Story
  const activatedClearStory = await services.clearStoryService.update(
    clearStoryId,
    { status: ClearStoryStatus.active },
    userId
  );

  logSuccess(`Clear Story activated: status = ${activatedClearStory.status}`);
  assert(activatedClearStory.status === ClearStoryStatus.active, 'Status should be active');

  // =========================================================================
  // STEP 3: Article Domain - Generate Article from Clear Story
  // =========================================================================
  logStep(3, 'Article Domain - Generate Article from Clear Story');

  // Generate article content (simulating AI generation) - Must be at least 1200 words
  const articleBody = `
# How AI-Powered Code Review is Transforming Software Development: A Comprehensive Guide

In the fast-paced world of software development, code review remains one of the most critical yet time-consuming processes that teams face on a daily basis. The traditional approach to code review, while essential for maintaining code quality and knowledge sharing, has often been a bottleneck in the development pipeline. However, a new generation of AI-powered tools is fundamentally changing how teams approach code quality, offering unprecedented speed and consistency in the review process while freeing up valuable engineering time for more complex tasks.

## The Challenge of Traditional Code Review

Traditional code review processes often create significant bottlenecks in development workflows that can slow down entire teams. Engineers spend considerable time reviewing pull requests, sometimes spending hours examining code for potential issues, security vulnerabilities, and style inconsistencies. The quality of these reviews can vary dramatically based on several factors including reviewer fatigue, individual expertise levels, time constraints, and the complexity of the code being reviewed.

When a senior engineer spends three hours reviewing a large pull request, that represents a significant investment of time that could have been spent on architecture decisions, mentoring junior developers, or working on critical features. Moreover, the asynchronous nature of traditional code review means that developers often context-switch multiple times per day, reducing their overall productivity and flow state effectiveness.

The human element in code review, while valuable for catching complex logical errors and providing mentorship, also introduces inconsistency. A reviewer who has been working long hours might miss issues they would normally catch. Different reviewers might have varying standards for what constitutes acceptable code, leading to inconsistent feedback across the codebase. These variations can lead to technical debt accumulation and reduced code maintainability over time.

Furthermore, as codebases grow larger and teams scale, the burden of code review increases exponentially. What worked for a small team of five engineers becomes unsustainable when the team grows to fifty. The review queue grows longer, merge conflicts become more common, and the pressure to approve code quickly can lead to reduced review quality and more bugs making it to production.

## AI-Assisted Review: A Game Changer for Modern Development Teams

Modern AI code review tools leverage sophisticated machine learning algorithms and large language models to automatically detect common issues with remarkable accuracy. These tools can process thousands of lines of code in seconds, providing instant feedback that would take a human reviewer considerably longer to compile. The consistency of AI-powered review ensures that every piece of code receives the same thorough examination, regardless of time of day or team workload.

The capabilities of these AI systems include comprehensive analysis across multiple dimensions:

- **Security vulnerabilities and potential exploits**: AI systems can identify common security issues such as SQL injection vulnerabilities, cross-site scripting risks, authentication weaknesses, and improper input validation. These tools are trained on vast databases of known security vulnerabilities and can recognize patterns that might escape human notice during a quick review.

- **Performance bottlenecks and inefficient patterns**: The AI can detect inefficient algorithms, unnecessary database queries, memory leaks, and other performance issues that could impact application responsiveness and resource utilization. This includes identifying O(n^2) algorithms that could be optimized, unnecessary object allocations, and inefficient data structures.

- **Style inconsistencies and maintainability concerns**: Maintaining consistent code style across a large codebase is challenging, but AI tools can ensure adherence to coding standards, naming conventions, and documentation requirements with perfect consistency. This leads to more readable and maintainable codebases that are easier for new team members to understand.

- **Potential bugs and edge cases**: AI can identify common programming mistakes such as null pointer exceptions, off-by-one errors, race conditions, and incomplete error handling. By analyzing patterns from millions of bugs found in open-source repositories, these tools can predict where issues are likely to occur.

- **Code complexity analysis**: AI tools can measure cyclomatic complexity, cognitive complexity, and other metrics that indicate when code might be difficult to understand or maintain. This helps teams refactor complex sections before they become technical debt.

- **Test coverage gaps**: Modern AI review tools can analyze code changes and suggest which tests might be missing, helping ensure comprehensive test coverage for new features and bug fixes.

## Real-World Impact: Quantifiable Benefits for Engineering Organizations

Teams adopting AI-assisted code review have reported remarkable improvements across multiple key performance indicators. These benefits extend beyond simple time savings to fundamentally improve how engineering teams operate and deliver value:

1. **40% faster review cycles** - AI pre-filters issues before human review, allowing human reviewers to focus on high-level concerns rather than syntax errors and style issues. This reduction in review time accelerates the entire development pipeline, enabling faster feature delivery and more responsive bug fixes. Teams report that pull requests that previously sat in review for days now move through the pipeline in hours.

2. **Higher code quality and fewer production incidents** - The consistent detection of patterns that humans often miss leads to higher code quality standards across the board. Organizations report 30-50% reductions in production bugs after implementing AI-assisted review, with particularly significant improvements in security-related issues. This translates to better user experiences, reduced operational costs, and improved team morale.

3. **Reduced reviewer fatigue and improved job satisfaction** - By handling routine checks automatically, AI allows human reviewers to focus on more intellectually stimulating aspects of review such as architecture decisions, algorithm improvements, and mentorship opportunities. This leads to higher job satisfaction among senior engineers and better utilization of their expertise.

4. **Improved knowledge sharing** - AI review tools often include explanations for their suggestions, serving as educational resources for less experienced developers. Junior engineers learn best practices through consistent, high-quality feedback on their code.

5. **Standardized coding practices** - With AI enforcing style guides and best practices consistently, teams develop more uniform codebases that are easier to navigate and maintain. This standardization reduces onboarding time for new team members and improves collaboration across teams.

## Implementation Best Practices for Successful AI Code Review Adoption

For organizations looking to adopt AI code review tools, a thoughtful implementation strategy is essential for maximizing benefits while minimizing disruption to existing workflows:

1. **Start with a pilot team to validate effectiveness**: Begin implementation with a single team that is open to experimentation. This allows the organization to learn how the tool integrates with existing processes, identify potential issues, and develop best practices before rolling out to the broader organization. Choose a team working on a representative codebase to ensure findings are applicable organization-wide.

2. **Integrate seamlessly into existing CI/CD pipelines**: AI code review tools should fit naturally into existing development workflows rather than creating additional steps. Configure the tools to run automatically on pull request creation and update, providing feedback without requiring developers to take extra action. This seamless integration ensures consistent adoption and maximizes the tool's impact.

3. **Configure rules aligned with team standards**: Take time to customize the AI tool's rules to match your organization's coding standards and priorities. Disable rules that generate false positives for your codebase and enable additional checks for areas that are particularly important to your team. This customization improves the signal-to-noise ratio of the tool's feedback.

4. **Maintain human oversight for critical decisions**: While AI can handle routine checks effectively, complex architectural decisions, business logic validation, and security-critical code still benefit from human judgment. Establish clear guidelines for when human review is required in addition to AI analysis, and ensure that AI suggestions are treated as recommendations rather than mandates.

5. **Measure and iterate**: Track key metrics such as review cycle time, bug discovery rates, and developer satisfaction to quantify the impact of AI-assisted review. Use this data to continuously refine your implementation and demonstrate value to stakeholders.

6. **Provide training and change management support**: Help developers understand how to interpret AI feedback and when to override suggestions. Clear communication about the purpose and limitations of AI review helps ensure successful adoption and prevents frustration.

## The Future of Code Review: Human-AI Collaboration

As AI models continue to improve with advances in large language models and machine learning techniques, we can expect even deeper integration into development workflows. The goal is not to replace human reviewers but to augment their capabilities and free them to focus on higher-level architectural decisions that require creativity, domain expertise, and nuanced judgment.

Future developments may include AI systems that can understand business requirements and validate that code implementations correctly address those requirements. We may see AI that can suggest not just what's wrong with code, but how to refactor it for better performance, maintainability, and extensibility. Integration with project management tools could enable AI to understand the context of changes and provide more relevant feedback.

The evolution of AI code review represents a shift in how we think about software quality assurance. Rather than being a gate that slows development, code review becomes an accelerator that helps teams move faster while maintaining high standards. The combination of AI efficiency and human insight creates a review process that is greater than the sum of its parts.

## Conclusion: Embracing the AI-Assisted Future of Software Development

AI-powered code review represents a significant leap forward in software development practices that forward-thinking organizations cannot afford to ignore. Teams that embrace these tools position themselves for faster delivery cycles, higher-quality software, and improved developer experience. The competitive advantage of faster, more reliable software delivery compounds over time, allowing organizations to respond more quickly to market opportunities and customer needs.

The transition to AI-assisted code review is not just about adopting a new tool; it's about reimagining how teams collaborate to produce excellent software. By combining the speed and consistency of AI analysis with the creativity and judgment of human reviewers, organizations can achieve levels of software quality and development velocity that were previously unattainable.

As you evaluate AI code review tools for your organization, consider starting small, measuring carefully, and scaling based on demonstrated results. The evidence from early adopters is clear: AI-assisted code review is not just the future of software development; it's rapidly becoming the present standard for high-performing engineering teams across the industry.
`.trim();

  const article = await services.articleService.createArticle({
    customerId,
    clearStoryId,
    title: 'How AI-Powered Code Review Delivers 40% Faster Development Cycles',
    content: {
      body: articleBody,
      summary: 'Discover how teams using AI-assisted code review tools are shipping 40% faster while maintaining higher code quality standards.',
      keyPoints: [
        'AI code review reduces review cycle time by 40%',
        'Automated detection catches issues before human reviewers',
        'Teams maintain higher code quality with less reviewer fatigue',
        'Best practices for adopting AI-assisted code review',
      ],
    },
    tone: ContentTone.authoritative,
    seoMetadata: {
      metaTitle: 'AI Code Review: 40% Faster Development | Test Company',
      metaDescription: 'Learn how AI-powered code review tools help teams ship 40% faster while improving code quality. Practical guide for engineering teams.',
      focusKeyword: 'AI code review',
      keywords: ['AI code review', 'code quality', 'developer productivity', 'CI/CD'],
    },
    createdBy: userRef,
  });

  articleId = article.id;

  logSuccess(`Article created: ${article.title} (ID: ${articleId})`);
  logInfo(`Status: ${article.status}, Word Count: ${article.wordCount}`);
  logInfo(`Clear Story Reference: ${article.clearStoryId}`);

  assert(article.id !== undefined, 'Article ID should be defined');
  assert(article.clearStoryId === clearStoryId, 'Article should reference the Clear Story');
  assert(article.status === ArticleStatus.draft, 'Initial status should be draft');
  assert(article.wordCount >= 200, 'Word count should meet minimum requirements');

  // =========================================================================
  // STEP 4: Article Domain - Submit for Review, Approve, and Publish
  // =========================================================================
  logStep(4, 'Article Domain - Submit for Review, Approve, and Publish');

  // Submit for review
  const submittedArticle = await services.articleService.submitForReview(articleId, userRef);
  logSuccess(`Article submitted for review: status = ${submittedArticle.status}`);
  assert(submittedArticle.status === ArticleStatus.review, 'Status should be review');

  // Approve
  const approvedArticle = await services.articleService.approve(articleId, userRef);
  logSuccess(`Article approved: status = ${approvedArticle.status}`);
  assert(approvedArticle.status === ArticleStatus.approved, 'Status should be approved');

  // Publish
  const publishedUrl = 'https://testcompany.com/blog/ai-code-review-40-percent-faster';
  const publishedArticle = await services.articleService.publish(articleId, publishedUrl);
  logSuccess(`Article published: status = ${publishedArticle.status}`);
  logInfo(`Published URL: ${publishedArticle.publishedUrl}`);
  assert(publishedArticle.status === ArticleStatus.published, 'Status should be published');
  assert(publishedArticle.publishedUrl === publishedUrl, 'Published URL should match');

  // =========================================================================
  // STEP 5: Reddit Distribution Domain - Create Reddit Post from Article
  // =========================================================================
  logStep(5, 'Reddit Distribution Domain - Create Reddit Post from Article');

  const redditPost = await services.redditService.createPost({
    customerId,
    articleId,
    title: 'How AI Code Review Tools Help Teams Ship 40% Faster',
    body: `Just published a deep-dive into AI-powered code review tools and their impact on development velocity.

Key findings:
- 40% reduction in review cycle time
- Higher code quality with automated issue detection
- Less reviewer fatigue = better focus on architecture

Full article: ${publishedUrl}

Has anyone else experienced similar results with AI code review tools? Would love to hear about your experiences!`,
    subreddit: 'programming',
    flair: 'Discussion',
    utmParams: {
      source: 'reddit',
      medium: 'social',
      campaign: 'ai-code-review-launch',
      content: 'programming-subreddit',
    },
    createdBy: userRef,
  });

  redditPostId = redditPost.id;

  logSuccess(`Reddit Post created: ${redditPost.title.substring(0, 50)}... (ID: ${redditPostId})`);
  logInfo(`Subreddit: r/${redditPost.subreddit}, Status: ${redditPost.status}`);
  logInfo(`Article Reference: ${redditPost.articleId}`);

  assert(redditPost.id !== undefined, 'Reddit Post ID should be defined');
  assert(redditPost.articleId === articleId, 'Reddit Post should reference the Article');
  assert(redditPost.status === 'pending_approval', 'Initial status should be pending_approval');

  // =========================================================================
  // STEP 6: Reddit Distribution Domain - Approve and Queue the Post
  // =========================================================================
  logStep(6, 'Reddit Distribution Domain - Approve and Queue the Post');

  // Approve the post
  const approvedRedditPost = await services.redditService.approvePost({
    postId: redditPostId,
    approvedBy: userRef,
  });

  logSuccess(`Reddit Post approved: status = ${approvedRedditPost.status}`);
  assert(approvedRedditPost.status === 'approved', 'Status should be approved');

  // Queue the post for posting
  const scheduledTime = futureTime(2); // Schedule for 2 hours from now
  const queuedRedditPost = await services.redditService.queuePost({
    postId: redditPostId,
    scheduledFor: scheduledTime,
    priority: 1,
  });

  logSuccess(`Reddit Post queued: status = ${queuedRedditPost.status}`);
  logInfo(`Scheduled for: ${queuedRedditPost.scheduledFor}`);
  assert(queuedRedditPost.status === 'queued', 'Status should be queued');

  // =========================================================================
  // STEP 7: Scheduling Domain - Schedule the Post
  // =========================================================================
  logStep(7, 'Scheduling Domain - Schedule the Post');

  const scheduledTask = await services.schedulingService.createScheduledTask({
    customerId,
    taskType: 'reddit_post',
    targetId: redditPostId,
    scheduledFor: scheduledTime,
    priority: 1,
    maxRetries: 3,
    metadata: {
      subreddit: 'programming',
      articleId,
    },
    createdBy: userRef,
  });

  scheduleId = scheduledTask.id;

  logSuccess(`Scheduled Task created (ID: ${scheduleId})`);
  logInfo(`Task Type: ${scheduledTask.taskType}, Target: ${scheduledTask.targetId}`);
  logInfo(`Scheduled For: ${scheduledTask.scheduledFor}`);
  logInfo(`Status: ${scheduledTask.status}, Priority: ${scheduledTask.priority}`);

  assert(scheduledTask.id !== undefined, 'Schedule ID should be defined');
  assert(scheduledTask.status === ScheduleStatus.pending, 'Status should be pending');
  assert(scheduledTask.targetId === redditPostId, 'Target ID should be Reddit Post ID');

  // Get pending tasks to verify
  const pendingTasks = await services.schedulingService.getPendingTasks(48);
  logInfo(`Total pending tasks in next 48 hours: ${pendingTasks.length}`);
  assert(pendingTasks.length >= 1, 'Should have at least 1 pending task');

  // =========================================================================
  // STEP 8: Analytics Domain - Create UTM Campaign and Track Analytics
  // =========================================================================
  logStep(8, 'Analytics Domain - Create UTM Campaign and Track Analytics');

  // Create UTM Campaign
  const campaign = await services.analyticsService.createCampaign({
    customerId,
    source: 'reddit',
    medium: 'social',
    campaign: 'ai-code-review-launch',
    content: 'programming-subreddit',
    articleId,
    baseUrl: publishedUrl,
  });

  logSuccess(`UTM Campaign created (ID: ${campaign.id})`);
  logInfo(`Source: ${campaign.source}, Medium: ${campaign.medium}`);
  logInfo(`Campaign: ${campaign.campaign}, Content: ${campaign.content}`);

  assert(campaign.id !== undefined, 'Campaign ID should be defined');
  assert(campaign.customerId === customerId, 'Campaign should belong to customer');

  // Record engagement metrics for the Reddit post
  const engagement = await services.analyticsService.recordEngagement(
    AnalyticsEntityType.redditPost,
    redditPostId,
    {
      upvotes: 45,
      comments: 12,
      shares: 3,
      clicks: 87,
      impressions: 1250,
    }
  );

  logSuccess('Engagement metrics recorded for Reddit post');
  logInfo(`Upvotes: ${engagement.upvotes}, Comments: ${engagement.comments}`);
  logInfo(`Clicks: ${engagement.clicks}, Impressions: ${engagement.impressions}`);
  logInfo(`Engagement Level: ${engagement.engagementLevel}`);

  // Set baseline for the customer
  const baseline = await services.analyticsService.setBaseline(customerId, {
    llmMentions: 5,
    monthlyTraffic: 10000,
    recordedAt: new Date().toISOString() as AnalyticsISOTimestamp,
  });

  logSuccess('Customer baseline set for analytics tracking');
  logInfo(`LLM Mentions Baseline: ${baseline.llmMentions}`);
  logInfo(`Monthly Traffic Baseline: ${baseline.monthlyTraffic}`);

  // Get dashboard stats
  const dashboardStats = await services.analyticsService.getDashboardStats(customerId, ReportPeriod.weekly);
  logSuccess('Dashboard stats retrieved');
  logInfo(`Total Engagement: ${dashboardStats.kpis.totalEngagement}`);
  logInfo(`Total Clicks: ${dashboardStats.kpis.totalClicks}`);

  // =========================================================================
  // STEP 9: Agent Orchestration Domain - Create Agent Session to Log Workflow
  // =========================================================================
  logStep(9, 'Agent Orchestration Domain - Create Agent Session to Log Workflow');

  // Create an agent session
  const sessionResult = await services.agentService.createSession({
    agentType: AgentType.article_generator,
    userId,
    customerId,
    initialContext: {
      userId,
      customerId,
      brandGuidelines: {
        companyName: 'Test Company Inc.',
        productDescription: 'AI-powered code review platform',
        voiceTone: ContentTone.authoritative,
        keywords: ['AI', 'code review', 'developer tools'],
        avoidTopics: [],
        websiteUrl: 'https://testcompany.com',
      },
      conversationHistory: [],
      variables: {
        clearStoryId,
        articleId,
        redditPostId,
      },
    },
  });

  assert(sessionResult.success, 'Session creation should succeed');
  const session = sessionResult.data!;
  agentSessionId = session.id;

  logSuccess(`Agent Session created (ID: ${agentSessionId})`);
  logInfo(`Agent Type: ${session.agentType}`);
  logInfo(`Status: ${session.status}`);
  logInfo(`User: ${session.userId}, Customer: ${session.customerId}`);

  assert(session.id !== undefined, 'Session ID should be defined');
  assert(session.status === 'active', 'Session status should be active');

  // Record a tool call (simulating the article generation process)
  const toolCallResult = await services.agentService.recordToolCall(agentSessionId, {
    toolName: 'generate_article',
    input: {
      clearStoryId,
      tone: ContentTone.authoritative,
      targetWords: 1500,
    },
    output: {
      articleId,
      wordCount: 1452,
      title: 'How AI-Powered Code Review Delivers 40% Faster Development Cycles',
    },
    status: 'success' as ToolCallStatus,
    startedAt: now(),
    completedAt: now(),
    retryCount: 0,
  });

  assert(toolCallResult.success, 'Tool call recording should succeed');
  logSuccess('Tool call recorded: generate_article');
  logInfo(`Duration: ${toolCallResult.data?.durationMs}ms`);

  // Complete the session with results
  const articleRef: ArticleRef = {
    id: articleId,
    title: 'How AI-Powered Code Review Delivers 40% Faster Development Cycles',
    status: ArticleStatus.published,
  };

  const sessionResultData: ArticleGeneratorResult = {
    type: 'article_generator',
    article: articleRef,
    wordCount: 1452,
    keywordsIncluded: ['AI', 'code review', 'developer productivity'],
    seoMetadata: {
      metaTitle: 'AI Code Review: 40% Faster Development | Test Company',
      metaDescription: 'Learn how AI-powered code review tools help teams ship 40% faster.',
      focusKeyword: 'AI code review',
    },
  };

  const completeResult = await services.agentService.completeSession(agentSessionId, {
    data: sessionResultData,
    tokensUsed: 12500,
    durationMs: 45678,
    summary: 'Successfully generated article and created Reddit post from Clear Story',
  });

  assert(completeResult.success, 'Session completion should succeed');
  const completedSession = completeResult.data!;
  logSuccess(`Agent Session completed: status = ${completedSession.status}`);
  logInfo(`Tokens Used: ${completedSession.result?.tokensUsed}`);
  logInfo(`Total Duration: ${completedSession.result?.durationMs}ms`);
  logInfo(`Summary: ${completedSession.result?.summary}`);

  // =========================================================================
  // STEP 10: Verify Cross-Domain Data Flow
  // =========================================================================
  logStep(10, 'Verify Cross-Domain Data Flow');

  // Verify Customer
  const verifyCustomer = await services.customerService.getById(customerId);
  assert(verifyCustomer !== null, 'Customer should exist');
  logSuccess(`Customer verified: ${verifyCustomer?.companyName}`);

  // Verify User belongs to Customer
  const verifyUser = await services.userService.getById(userId);
  assert(verifyUser !== null, 'User should exist');
  assert(verifyUser?.customerId === customerId, 'User should belong to customer');
  logSuccess(`User verified: ${verifyUser?.displayName} -> Customer: ${verifyUser?.customerId}`);

  // Verify Clear Story
  const verifyClearStory = await services.clearStoryService.getById(clearStoryId);
  assert(verifyClearStory !== null, 'Clear Story should exist');
  assert(verifyClearStory?.customerId === customerId, 'Clear Story should belong to customer');
  logSuccess(`Clear Story verified: ${verifyClearStory?.topic}`);

  // Verify Article references Clear Story
  const verifyArticle = await services.articleService.getArticleById(articleId);
  assert(verifyArticle !== null, 'Article should exist');
  assert(verifyArticle?.clearStoryId === clearStoryId, 'Article should reference Clear Story');
  assert(verifyArticle?.customerId === customerId, 'Article should belong to customer');
  logSuccess(`Article verified: ${verifyArticle?.title.substring(0, 40)}...`);
  logInfo(`  -> Clear Story: ${verifyArticle?.clearStoryId}`);

  // Verify Reddit Post references Article
  const verifyRedditPost = await services.redditService.getPostById(redditPostId);
  assert(verifyRedditPost !== null, 'Reddit Post should exist');
  assert(verifyRedditPost?.articleId === articleId, 'Reddit Post should reference Article');
  assert(verifyRedditPost?.customerId === customerId, 'Reddit Post should belong to customer');
  logSuccess(`Reddit Post verified: r/${verifyRedditPost?.subreddit}`);
  logInfo(`  -> Article: ${verifyRedditPost?.articleId}`);

  // Verify Scheduled Task references Reddit Post
  const verifyTask = await services.schedulingService.getTaskById(scheduleId);
  assert(verifyTask !== null, 'Scheduled Task should exist');
  assert(verifyTask?.targetId === redditPostId, 'Task should target Reddit Post');
  assert(verifyTask?.customerId === customerId, 'Task should belong to customer');
  logSuccess(`Scheduled Task verified: ${verifyTask?.taskType}`);
  logInfo(`  -> Target: ${verifyTask?.targetId}`);

  // Verify Analytics Campaign
  const verifyCampaign = await services.analyticsService.getCampaign(campaign.id);
  assert(verifyCampaign !== null, 'Campaign should exist');
  assert(verifyCampaign?.customerId === customerId, 'Campaign should belong to customer');
  logSuccess(`Analytics Campaign verified: ${verifyCampaign?.campaign}`);

  // Verify Engagement was recorded
  const verifyEngagement = await services.analyticsService.getEngagementByEntity(
    AnalyticsEntityType.redditPost,
    redditPostId
  );
  assert(verifyEngagement !== null, 'Engagement should exist');
  logSuccess(`Engagement metrics verified: ${verifyEngagement?.upvotes} upvotes, ${verifyEngagement?.comments} comments`);

  // Verify Agent Session
  const verifySession = await services.agentService.getSession(agentSessionId);
  assert(verifySession.success, 'Session should be retrievable');
  assert(verifySession.data?.status === 'completed', 'Session should be completed');
  logSuccess(`Agent Session verified: ${verifySession.data?.status}`);

  // =========================================================================
  // TEST COMPLETE
  // =========================================================================
  console.log('\n');
  console.log('#'.repeat(70));
  console.log('#  INTEGRATION TEST COMPLETE - ALL ASSERTIONS PASSED');
  console.log('#'.repeat(70));
  console.log('\nWorkflow Summary:');
  console.log(`  - Customer: ${customerId}`);
  console.log(`  - User: ${userId}`);
  console.log(`  - Clear Story: ${clearStoryId}`);
  console.log(`  - Article: ${articleId}`);
  console.log(`  - Reddit Post: ${redditPostId}`);
  console.log(`  - Scheduled Task: ${scheduleId}`);
  console.log(`  - UTM Campaign: ${campaign.id}`);
  console.log(`  - Agent Session: ${agentSessionId}`);
  console.log('\nAll 7 domains successfully integrated and tested!');
  console.log('\n');
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

// Run the integration test
runIntegrationTest()
  .then(() => {
    console.log('Integration test completed successfully.');
  })
  .catch((error: Error) => {
    console.error('\n');
    console.error('!'.repeat(70));
    console.error('!  INTEGRATION TEST FAILED');
    console.error('!'.repeat(70));
    console.error('\nError:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    throw error;
  });
