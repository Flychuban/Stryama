// Editor-related types
export type EditorStatus = 'idle' | 'loading' | 'success' | 'error';

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
  thinking?: string[];
  files?: string[];
};

export type DeviceType = 'desktop' | 'tablet' | 'mobile';

export type ExamplePrompt = {
  title: string;
  prompt: string;
};

export type PromptHistoryItem = {
  id: number;
  prompt: string;
  timestamp: Date;
};
