import type { FrameworkType } from '../types';

export enum PromptTemplateType {
  LANDING_PAGE = 'landing_page',
  DASHBOARD = 'dashboard',
  CRUD_APP = 'crud_app',
  COMPONENT = 'component',
  FILE_MODIFICATION = 'file_modification',
  CUSTOM = 'custom',
}

export type PromptContext = {
  readonly userInput: string;
  readonly framework?: FrameworkType;
  readonly existingFiles?: readonly string[];
  readonly targetFiles?: readonly string[];
  readonly dependencies?: readonly string[];
};

export type PromptTemplate = {
  readonly type: PromptTemplateType;
  readonly systemPrompt: string;
  readonly userPromptBuilder: (context: PromptContext) => string;
  readonly examples?: readonly string[];
};

export type PromptValidationResult = {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
};
