import { PROMPT_TEMPLATES } from './templates';
import { PromptTemplateType } from './types';
import type { PromptContext, PromptTemplate } from './types';

export class PromptBuilder {
  static buildPrompt(
    templateType: PromptTemplateType,
    context: PromptContext
  ): string {
    const template = PROMPT_TEMPLATES[templateType];

    if (!template) {
      throw new Error(`Unknown template type: ${templateType}`);
    }

    return this.constructPrompt(template, context);
  }

  static detectTemplateType(userInput: string): PromptTemplateType {
    const lowerInput = userInput.toLowerCase();

    if (
      lowerInput.includes('landing page') ||
      lowerInput.includes('landing') ||
      (lowerInput.includes('home') && lowerInput.includes('page'))
    ) {
      return PromptTemplateType.LANDING_PAGE;
    }

    if (
      lowerInput.includes('dashboard') ||
      lowerInput.includes('admin panel') ||
      lowerInput.includes('control panel')
    ) {
      return PromptTemplateType.DASHBOARD;
    }

    if (
      lowerInput.includes('crud') ||
      (lowerInput.includes('create') &&
        lowerInput.includes('update') &&
        lowerInput.includes('delete')) ||
      lowerInput.includes('database') ||
      lowerInput.includes('data management')
    ) {
      return PromptTemplateType.CRUD_APP;
    }

    if (
      lowerInput.includes('component') ||
      lowerInput.includes('reusable') ||
      (lowerInput.includes('button') && !lowerInput.includes('page')) ||
      (lowerInput.includes('form') && !lowerInput.includes('page')) ||
      (lowerInput.includes('modal') && !lowerInput.includes('page'))
    ) {
      return PromptTemplateType.COMPONENT;
    }

    if (
      lowerInput.includes('modify') ||
      lowerInput.includes('update') ||
      lowerInput.includes('change') ||
      lowerInput.includes('fix') ||
      lowerInput.includes('refactor') ||
      lowerInput.includes('edit')
    ) {
      return PromptTemplateType.FILE_MODIFICATION;
    }

    return PromptTemplateType.CUSTOM;
  }

  static buildPromptAuto(context: PromptContext): string {
    const templateType = this.detectTemplateType(context.userInput);
    return this.buildPrompt(templateType, context);
  }

  private static constructPrompt(
    template: PromptTemplate,
    context: PromptContext
  ): string {
    const userPrompt = template.userPromptBuilder(context);

    return `${template.systemPrompt}\n\n---\n\n${userPrompt}`;
  }

  static optimizePrompt(prompt: string): string {
    return prompt
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n');
  }

  static getTemplateExamples(
    templateType: PromptTemplateType
  ): readonly string[] {
    const template = PROMPT_TEMPLATES[templateType];
    return template?.examples ?? [];
  }

  static getAvailableTemplates(): readonly PromptTemplateType[] {
    return Object.values(PromptTemplateType);
  }
}
