import { describe, it, expect } from 'vitest';
import { ModelSelectionService } from './modelSelection';
import { ClaudeModel } from '~/lib/integrations/claude/types';

describe('ModelSelectionService', () => {
  describe('selectModel', () => {
    describe('FREE plan restrictions', () => {
      it('should always select Haiku for FREE plan users regardless of prompt complexity', () => {
        // Arrange
        const simplePrompt = 'Add a button';
        const complexPrompt =
          'Create a dashboard with authentication and real-time updates';

        // Act
        const simpleResult = ModelSelectionService.selectModel(
          simplePrompt,
          'FREE'
        );
        const complexResult = ModelSelectionService.selectModel(
          complexPrompt,
          'FREE'
        );

        // Assert
        expect(simpleResult).toBe('haiku');
        expect(complexResult).toBe('haiku');
      });

      it('should select Haiku for FREE plan even with complex keywords', () => {
        // Arrange
        const prompt =
          'Build a payment system with OAuth authentication and encryption';

        // Act
        const result = ModelSelectionService.selectModel(prompt, 'FREE');

        // Assert
        expect(result).toBe('haiku');
      });
    });

    describe('BUILDER plan selection', () => {
      it('should select Haiku for simple prompts', () => {
        // Arrange
        const prompt = 'Change the button color to blue';

        // Act
        const result = ModelSelectionService.selectModel(prompt, 'BUILDER');

        // Assert
        expect(result).toBe('haiku');
      });

      it('should select Haiku for medium prompts', () => {
        // Arrange
        const prompt =
          'Create a form with validation for email and password fields. Add error messages.';

        // Act
        const result = ModelSelectionService.selectModel(prompt, 'BUILDER');

        // Assert
        expect(result).toBe('haiku');
      });

      it('should select Sonnet for complex prompts with keywords', () => {
        // Arrange
        const prompt =
          'Create a dashboard with authentication, real-time updates, and database integration';

        // Act
        const result = ModelSelectionService.selectModel(prompt, 'BUILDER');

        // Assert
        expect(result).toBe('sonnet');
      });

      it('should select Sonnet for long prompts', () => {
        // Arrange - Create a very long prompt (>500 tokens ≈ >2000 chars)
        const longPrompt = 'Create a component '.repeat(250);

        // Act
        const result = ModelSelectionService.selectModel(longPrompt, 'BUILDER');

        // Assert
        expect(result).toBe('sonnet');
      });
    });

    describe('PRO plan selection', () => {
      it('should select Haiku for simple prompts to optimize costs', () => {
        // Arrange
        const prompt = 'Fix typo in button text';

        // Act
        const result = ModelSelectionService.selectModel(prompt, 'PRO');

        // Assert
        expect(result).toBe('haiku');
      });

      it('should select Sonnet for complex architectural tasks', () => {
        // Arrange
        const prompt =
          'Design a system architecture with microservices, API gateway, and database sharding';

        // Act
        const result = ModelSelectionService.selectModel(prompt, 'PRO');

        // Assert
        expect(result).toBe('sonnet');
      });
    });
  });

  describe('analyzePromptComplexity', () => {
    it('should classify short prompts without keywords as simple', () => {
      // Arrange
      const prompts = [
        'Add a button',
        'Change color to red',
        'Update text',
        'Fix spacing',
      ];

      // Act & Assert
      prompts.forEach((prompt) => {
        expect(ModelSelectionService.analyzePromptComplexity(prompt)).toBe(
          'simple'
        );
      });
    });

    it('should classify medium-length prompts without keywords as medium', () => {
      // Arrange - Prompts between 200-500 tokens (800-2000 chars)
      const mediumPrompt =
        'Create a reusable button component with hover effects and click handlers. '.repeat(
          15
        );

      // Act
      const result =
        ModelSelectionService.analyzePromptComplexity(mediumPrompt);

      // Assert
      expect(result).toBe('medium');
    });

    it('should classify prompts with complex keywords as complex', () => {
      // Arrange
      const complexKeywordPrompts = [
        'Build a dashboard',
        'Implement authentication',
        'Add OAuth login',
        'Create real-time updates',
        'Design system architecture',
        'Add payment processing',
        'Implement state management with Redux',
        'Add websocket connection',
        'Create advanced algorithm',
        'Add encryption',
      ];

      // Act & Assert
      complexKeywordPrompts.forEach((prompt) => {
        const result = ModelSelectionService.analyzePromptComplexity(prompt);
        expect(result).toBe('complex');
      });
    });

    it('should be case-insensitive for keyword detection', () => {
      // Arrange
      const prompts = [
        'Add DASHBOARD functionality',
        'Implement AUTHENTICATION',
        'Create OAuth integration',
      ];

      // Act & Assert
      prompts.forEach((prompt) => {
        expect(ModelSelectionService.analyzePromptComplexity(prompt)).toBe(
          'complex'
        );
      });
    });

    it('should classify very long prompts as complex', () => {
      // Arrange - Create prompt >2000 characters
      const veryLongPrompt = 'a'.repeat(2500);

      // Act
      const result =
        ModelSelectionService.analyzePromptComplexity(veryLongPrompt);

      // Assert
      expect(result).toBe('complex');
    });

    it('should handle empty string', () => {
      // Arrange
      const prompt = '';

      // Act
      const result = ModelSelectionService.analyzePromptComplexity(prompt);

      // Assert
      expect(result).toBe('simple');
    });
  });

  describe('getModelId', () => {
    it('should return correct model ID for Haiku', () => {
      // Act
      const result = ModelSelectionService.getModelId('haiku');

      // Assert
      expect(result).toBe(ClaudeModel.HAIKU_4_5);
    });

    it('should return correct model ID for Sonnet', () => {
      // Act
      const result = ModelSelectionService.getModelId('sonnet');

      // Assert
      expect(result).toBe(ClaudeModel.SONNET_4_5);
    });
  });

  describe('getModelEnum', () => {
    it('should return correct enum for Haiku', () => {
      // Act
      const result = ModelSelectionService.getModelEnum('haiku');

      // Assert
      expect(result).toBe(ClaudeModel.HAIKU_4_5);
    });

    it('should return correct enum for Sonnet', () => {
      // Act
      const result = ModelSelectionService.getModelEnum('sonnet');

      // Assert
      expect(result).toBe(ClaudeModel.SONNET_4_5);
    });
  });

  describe('getModelDisplayName', () => {
    it('should return human-readable name for Haiku', () => {
      // Act
      const result = ModelSelectionService.getModelDisplayName('haiku');

      // Assert
      expect(result).toBe('Claude Haiku 4.5 (Fast)');
    });

    it('should return human-readable name for Sonnet', () => {
      // Act
      const result = ModelSelectionService.getModelDisplayName('sonnet');

      // Assert
      expect(result).toBe('Claude Sonnet 4.5 (Smart)');
    });
  });

  describe('canUseSonnet', () => {
    it('should return false for FREE plan', () => {
      // Act
      const result = ModelSelectionService.canUseSonnet('FREE');

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for BUILDER plan', () => {
      // Act
      const result = ModelSelectionService.canUseSonnet('BUILDER');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for PRO plan', () => {
      // Act
      const result = ModelSelectionService.canUseSonnet('PRO');

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('getUpgradeMessage', () => {
    it('should return upgrade message for FREE plan', () => {
      // Act
      const result = ModelSelectionService.getUpgradeMessage('FREE');

      // Assert
      expect(result).toBe(
        'Upgrade to Builder plan or higher to access Sonnet for complex tasks'
      );
    });

    it('should return null for BUILDER plan', () => {
      // Act
      const result = ModelSelectionService.getUpgradeMessage('BUILDER');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for PRO plan', () => {
      // Act
      const result = ModelSelectionService.getUpgradeMessage('PRO');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('edge cases and integration scenarios', () => {
    it('should handle prompts with multiple complex keywords', () => {
      // Arrange
      const prompt =
        'Create a dashboard with authentication, database integration, real-time updates, and payment processing';

      // Act
      const complexity = ModelSelectionService.analyzePromptComplexity(prompt);
      const modelForFree = ModelSelectionService.selectModel(prompt, 'FREE');
      const modelForPro = ModelSelectionService.selectModel(prompt, 'PRO');

      // Assert
      expect(complexity).toBe('complex');
      expect(modelForFree).toBe('haiku'); // FREE restricted
      expect(modelForPro).toBe('sonnet'); // PRO gets Sonnet for complex
    });

    it('should handle borderline token counts correctly', () => {
      // Arrange - Exactly 200 tokens (800 chars) with no keywords
      const borderlineSimple = 'a'.repeat(799);
      const borderlineMedium = 'a'.repeat(800);

      // Act
      const simpleResult =
        ModelSelectionService.analyzePromptComplexity(borderlineSimple);
      const mediumResult =
        ModelSelectionService.analyzePromptComplexity(borderlineMedium);

      // Assert
      expect(simpleResult).toBe('simple');
      expect(mediumResult).toBe('medium');
    });

    it('should maintain cost optimization by defaulting to Haiku when possible', () => {
      // Arrange
      const mediumPrompts = [
        'Create a form component',
        'Add validation logic',
        'Style the navigation bar',
      ];

      // Act & Assert - All these should use Haiku for cost optimization
      mediumPrompts.forEach((prompt) => {
        expect(ModelSelectionService.selectModel(prompt, 'BUILDER')).toBe(
          'haiku'
        );
        expect(ModelSelectionService.selectModel(prompt, 'PRO')).toBe('haiku');
      });
    });
  });
});
