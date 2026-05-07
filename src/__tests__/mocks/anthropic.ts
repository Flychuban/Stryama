import { vi } from 'vitest';

/**
 * Mock responses from Anthropic Claude API
 */

/**
 * Mock successful Claude API response
 */
export const mockClaudeSuccessResponse = {
  content: [
    {
      type: 'text',
      text: `Here's a simple React component:

\`\`\`tsx
// src/App.tsx
import React from 'react';

export default function App() {
  return (
    <div className="app">
      <h1>Hello World</h1>
      <p>This is a test component</p>
    </div>
  );
}
\`\`\``,
    },
  ],
  usage: {
    input_tokens: 150,
    output_tokens: 250,
  },
  model: 'claude-haiku-4-5',
  stop_reason: 'end_turn',
};

/**
 * Mock Claude streaming events
 */
export const mockClaudeStreamEvents = {
  contentDelta: {
    type: 'content_delta',
    delta: { type: 'text', text: 'Generated code...' },
  },
  thinking: {
    type: 'thinking_delta',
    delta: { type: 'thinking', thinking: 'Analyzing the request...' },
  },
  toolUse: {
    type: 'tool_use',
    tool: 'E2B_Write',
    input: { path: 'src/App.tsx', content: 'code content' },
  },
  complete: {
    type: 'complete',
    usage: { input_tokens: 100, output_tokens: 200 },
    stop_reason: 'end_turn',
  },
};

/**
 * Mock the @anthropic-ai/claude-agent-sdk module
 */
export function mockAnthropicSDK() {
  vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
    query: vi.fn(() => Promise.resolve(mockClaudeSuccessResponse)),
    stream: vi.fn(() => ({
      async *[Symbol.asyncIterator]() {
        yield mockClaudeStreamEvents.contentDelta;
        yield mockClaudeStreamEvents.complete;
      },
    })),
  }));
}

/**
 * Mock Claude SDK error response
 */
export const mockClaudeErrorResponse = {
  error: {
    type: 'invalid_request_error',
    message: 'Invalid API key provided',
  },
};

/**
 * Mock for testing rate limiting
 */
export function mockClaudeRateLimitError() {
  vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
    query: vi.fn(() =>
      Promise.reject(new Error('Rate limit exceeded. Please try again later.'))
    ),
  }));
}
