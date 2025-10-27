import { PromptBuilder } from '../prompts/builder';
import { PromptTemplateType } from '../prompts/types';
import type {
  AIGenerationRequest,
  ServiceResult,
  AIGenerationResponse,
} from '../types';
import type { ClaudeClient } from '../client';

export class FallbackStrategy {
  static async trySimplifiedPrompt(
    originalRequest: AIGenerationRequest,
    client: ClaudeClient
  ): Promise<ServiceResult<AIGenerationResponse>> {
    console.log('[Fallback] Attempting simplified prompt strategy');

    const simplifiedPrompt = this.simplifyPrompt(originalRequest.prompt);

    const simplifiedRequest: AIGenerationRequest = {
      ...originalRequest,
      prompt: simplifiedPrompt,
      context: undefined,
      options: {
        ...originalRequest.options,
        maxTurns: 3,
      },
    };

    return client.generateCode(simplifiedRequest);
  }

  static async tryTemplateBasedGeneration(
    originalRequest: AIGenerationRequest,
    client: ClaudeClient
  ): Promise<ServiceResult<AIGenerationResponse>> {
    console.log('[Fallback] Attempting template-based generation');

    const templateType = PromptBuilder.detectTemplateType(
      originalRequest.prompt
    );

    if (templateType === PromptTemplateType.CUSTOM) {
      // If already custom, try landing page template as ultimate fallback
      const fallbackPrompt =
        'Create a simple landing page with a hero section and call-to-action button.';

      return client.generateCode({
        prompt: fallbackPrompt,
        options: {
          maxTurns: 2,
        },
      });
    }

    // Use detected template with simplified context
    const templatePrompt = PromptBuilder.buildPrompt(templateType, {
      userInput: this.extractKeywords(originalRequest.prompt),
    });

    return client.generateCode({
      prompt: templatePrompt,
      options: {
        maxTurns: 3,
      },
    });
  }

  private static simplifyPrompt(prompt: string): string {
    let simplified = prompt;

    // Remove complex requirements
    const complexPatterns = [
      /with authentication/gi,
      /with database/gi,
      /with real-time/gi,
      /with websocket/gi,
      /with api integration/gi,
    ];

    for (const pattern of complexPatterns) {
      simplified = simplified.replace(pattern, '');
    }

    // Add simplification note
    simplified = `${simplified}\n\nNote: Keep the implementation simple and focused on core functionality.`;

    return simplified.trim();
  }

  /**
   * Extract keywords from prompt
   */
  private static extractKeywords(prompt: string): string {
    const words = prompt.toLowerCase().split(' ');
    const importantWords = words.filter(
      (word) =>
        word.length > 4 &&
        !['create', 'build', 'make', 'with', 'that', 'this', 'have'].includes(
          word
        )
    );

    return importantWords.slice(0, 5).join(' ');
  }
}
