/**
 * Claude Integration - Usage Examples
 *
 * This file demonstrates how to use the Claude AI integration.
 * These are examples only - not meant to be executed directly.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  claudeClient,
  PromptBuilder,
  PromptTemplateType,
  rateLimiter,
  validatePrompt,
  ClaudeModel,
  FrameworkType,
  ProgrammingLanguage,
} from './index';
import type { AIGenerationRequest, PromptContext } from './index';

/**
 * Example 1: Basic code generation
 */
async function example1_basicGeneration(): Promise<void> {
  const request: AIGenerationRequest = {
    prompt:
      'Create a modern landing page for a SaaS product with hero section and pricing',
    options: {
      model: ClaudeModel.SONNET_4,
      maxTurns: 5,
    },
  };

  const result = await claudeClient.generateCode(request);

  if (result.success && result.data) {
    console.log('Generation ID:', result.data.id);
    console.log('Status:', result.data.status);
    console.log('Files generated:', result.data.files.length);
    console.log('Explanation:', result.data.explanation);
    console.log('Tokens used:', result.data.tokensUsed);
    console.log('Duration:', result.data.duration, 'ms');
  } else {
    console.error('Generation failed:', result.error);
  }
}

/**
 * Example 2: Using prompt templates
 */
async function example2_promptTemplates(): Promise<void> {
  // Auto-detect template type
  const userInput = 'Create a dashboard with analytics charts';
  const templateType = PromptBuilder.detectTemplateType(userInput);
  console.log('Detected template:', templateType); // DASHBOARD

  // Build prompt from template
  const context: PromptContext = {
    userInput,
    framework: FrameworkType.NEXTJS,
    dependencies: ['recharts', 'date-fns', '@tanstack/react-table'],
  };

  const prompt = PromptBuilder.buildPrompt(
    PromptTemplateType.DASHBOARD,
    context
  );
  console.log('Built prompt:', prompt);

  // Use the prompt for generation
  const result = await claudeClient.generateCode({
    prompt,
    options: {
      model: ClaudeModel.SONNET_4,
    },
  });
}

/**
 * Example 3: Prompt validation
 */
async function example3_promptValidation(): Promise<void> {
  const userInput = 'Build me a website';

  // Validate prompt
  const validation = validatePrompt(userInput);

  if (!validation.valid) {
    console.error('Validation errors:', validation.errors);
    return;
  }

  if (validation.warnings.length > 0) {
    console.warn('Validation warnings:', validation.warnings);
    // Continue anyway, but show warnings to user
  }

  // Proceed with generation
  const result = await claudeClient.generateCode({
    prompt: userInput,
  });
}

/**
 * Example 4: Rate limiting
 */
async function example4_rateLimiting(userId: string): Promise<void> {
  // Check rate limit before making request
  const rateLimit = await rateLimiter.checkRateLimit(userId, 'free');

  if (!rateLimit.allowed) {
    console.error(
      `Rate limit exceeded. Try again at ${rateLimit.resetAt.toLocaleString()}`
    );
    return;
  }

  console.log(`Remaining requests: ${rateLimit.remaining}/${rateLimit.limit}`);

  // Make the request
  const result = await claudeClient.generateCode({
    prompt: 'Create a login form component',
  });

  // Increment rate limit counter after successful request
  if (result.success) {
    await rateLimiter.incrementCount(userId);
  }
}

/**
 * Example 5: Generation with project context
 */
async function example5_withContext(): Promise<void> {
  const request: AIGenerationRequest = {
    prompt: 'Add a bio field to the user profile component',
    projectId: 'proj_123',
    context: {
      framework: FrameworkType.NEXTJS,
      existingFiles: [
        {
          path: 'components/UserProfile.tsx',
          content: `
export type UserProfileProps = {
  name: string;
  email: string;
};

export function UserProfile({ name, email }: UserProfileProps) {
  return (
    <div className="profile">
      <h2>{name}</h2>
      <p>{email}</p>
    </div>
  );
}`,
          language: ProgrammingLanguage.TYPESCRIPT,
        },
      ],
      dependencies: ['react', 'next'],
    },
    options: {
      model: ClaudeModel.SONNET_4,
      maxTurns: 3,
    },
  };

  const result = await claudeClient.generateCode(request);

  if (result.success && result.data) {
    console.log('Modified files:', result.data.files);
  }
}

/**
 * Example 6: Template examples
 */
function example6_templateExamples(): void {
  // Get examples for a specific template
  const landingPageExamples = PromptBuilder.getTemplateExamples(
    PromptTemplateType.LANDING_PAGE
  );
  console.log('Landing page examples:', landingPageExamples);

  // Get all available templates
  const allTemplates = PromptBuilder.getAvailableTemplates();
  console.log('Available templates:', allTemplates);
}

/**
 * Example 7: Complete workflow with error handling
 */
async function example7_completeWorkflow(userId: string): Promise<void> {
  const userInput = 'Create a blog post management dashboard';

  // Step 1: Validate prompt
  const validation = validatePrompt(userInput);
  if (!validation.valid) {
    throw new Error(`Invalid prompt: ${validation.errors.join(', ')}`);
  }

  // Step 2: Check rate limit
  const rateLimit = await rateLimiter.checkRateLimit(userId, 'pro');
  if (!rateLimit.allowed) {
    throw new Error(
      `Rate limit exceeded. Try again at ${rateLimit.resetAt.toLocaleString()}`
    );
  }

  // Step 3: Build prompt with template
  const templateType = PromptBuilder.detectTemplateType(userInput);
  const prompt = PromptBuilder.buildPrompt(templateType, {
    userInput,
    framework: FrameworkType.NEXTJS,
    dependencies: ['@tanstack/react-table', 'date-fns'],
  });

  // Step 4: Generate code
  const result = await claudeClient.generateCode({
    prompt,
    options: {
      model: ClaudeModel.SONNET_4,
      maxTurns: 5,
    },
  });

  // Step 5: Handle result
  if (result.success && result.data) {
    // Increment rate limit counter
    await rateLimiter.incrementCount(userId);

    console.log('✅ Generation successful!');
    console.log('Generated files:', result.data.files.length);
    console.log('Tokens used:', result.data.tokensUsed);

    // Return void, but result.data is available for use
  } else {
    console.error('❌ Generation failed:', result.error);
    throw new Error(result.error ?? 'Unknown error');
  }
}

/**
 * Example 8: Get usage statistics
 */
async function example8_usageStats(userId: string): Promise<void> {
  const stats = await rateLimiter.getUsageStats(userId, 'free');

  console.log('Usage Statistics:');
  console.log('- Requests this minute:', stats.minuteCount);
  console.log('- Requests today:', stats.dayCount);
  console.log('- Minute limit:', stats.limits.requestsPerMinute);
  console.log('- Daily limit:', stats.limits.requestsPerDay);
  console.log('- Max tokens per request:', stats.limits.maxTokensPerRequest);
}

// Export examples for reference
export {
  example1_basicGeneration,
  example2_promptTemplates,
  example3_promptValidation,
  example4_rateLimiting,
  example5_withContext,
  example6_templateExamples,
  example7_completeWorkflow,
  example8_usageStats,
};
