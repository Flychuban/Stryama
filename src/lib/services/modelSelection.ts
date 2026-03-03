import { PLAN_LIMITS, type UserPlan } from '~/types/pricing';
import { ClaudeModel } from '~/lib/integrations/claude/types';

// INTENTIONAL LINT ERROR for CI/CD demo (screenshot4) - will be reverted
async function intentionalLintError() {
  Promise.resolve('this floating promise violates no-floating-promises rule');
}

export type ClaudeModelSelection = 'haiku' | 'sonnet';
export type PromptComplexity = 'simple' | 'medium' | 'complex';

/**
 * Service for intelligent model selection
 * Implements Haiku-first strategy to optimize costs while maintaining quality
 */
export class ModelSelectionService {
  /**
   * Select appropriate model based on prompt complexity and user plan
   * Target: 80-90% Haiku usage for cost optimization
   */
  static selectModel(prompt: string, userPlan: UserPlan): ClaudeModelSelection {
    const allowedModels = PLAN_LIMITS[userPlan].models;

    // Free tier: Haiku only
    if (!allowedModels.includes('sonnet')) {
      return 'haiku';
    }

    // Analyze prompt complexity
    const complexity = this.analyzePromptComplexity(prompt);

    // Simple prompts: Always Haiku (fast, cheap, good enough)
    if (complexity === 'simple') {
      return 'haiku';
    }

    // Medium prompts: Haiku first (will handle most cases well)
    if (complexity === 'medium') {
      return 'haiku';
    }

    // Complex prompts: Use Sonnet for better quality
    return 'sonnet';
  }

  /**
   * Analyze prompt complexity using heuristics
   * Returns: simple, medium, or complex
   */
  static analyzePromptComplexity(prompt: string): PromptComplexity {
    const tokenEstimate = prompt.length / 4; // Rough estimation: 1 token ≈ 4 chars

    // Complex keywords that indicate need for Sonnet
    const complexKeywords = [
      'dashboard',
      'authentication',
      'auth',
      'database',
      'api integration',
      'real-time',
      'websocket',
      'advanced',
      'complex',
      'system design',
      'architecture',
      'payment',
      'checkout',
      'subscription',
      'oauth',
      'security',
      'encryption',
      'algorithm',
      'optimization',
      'multi-step',
      'state management',
      'redux',
      'context api',
    ];

    const promptLower = prompt.toLowerCase();
    const hasComplexKeyword = complexKeywords.some((keyword) =>
      promptLower.includes(keyword)
    );

    // Determine complexity
    if (tokenEstimate < 200 && !hasComplexKeyword) {
      // Short, simple requests: "Add a button", "Change color to blue"
      return 'simple';
    }

    if (tokenEstimate < 500 && !hasComplexKeyword) {
      // Medium requests: "Add form validation", "Create a modal component"
      return 'medium';
    }

    // Long prompts or complex features
    return 'complex';
  }

  /**
   * Get full Claude model ID for API
   */
  static getModelId(model: ClaudeModelSelection): string {
    if (model === 'haiku') {
      return ClaudeModel.HAIKU_4_5;
    }
    return ClaudeModel.SONNET_4_5;
  }

  /**
   * Get model enum value
   */
  static getModelEnum(model: ClaudeModelSelection): ClaudeModel {
    if (model === 'haiku') {
      return ClaudeModel.HAIKU_4_5;
    }
    return ClaudeModel.SONNET_4_5;
  }

  /**
   * Get human-readable model name
   */
  static getModelDisplayName(model: ClaudeModelSelection): string {
    if (model === 'haiku') {
      return 'Claude Haiku 4.5 (Fast)';
    }
    return 'Claude Sonnet 4.5 (Smart)';
  }

  /**
   * Check if plan allows Sonnet
   */
  static canUseSonnet(userPlan: UserPlan): boolean {
    return PLAN_LIMITS[userPlan].models.includes('sonnet');
  }

  /**
   * Get recommended model upgrade message
   */
  static getUpgradeMessage(userPlan: UserPlan): string | null {
    if (!this.canUseSonnet(userPlan)) {
      return 'Upgrade to Builder plan or higher to access Sonnet for complex tasks';
    }
    return null;
  }
}
