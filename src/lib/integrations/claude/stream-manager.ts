/**
 * Stream Manager for Claude Agent SDK
 *
 * Manages streaming events from the Claude Agent SDK and converts them
 * into structured events for consumption by tRPC subscriptions.
 */

import type {
  SDKMessage,
  SDKPartialAssistantMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { StreamEvent } from './types/stream-events';

// Import the stream event type from the SDK
// This is re-exported from the Claude Agent SDK internals
type BetaRawMessageStreamEvent = Extract<
  SDKPartialAssistantMessage['event'],
  { type: string }
>;

interface AssistantMessageContent {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  is_error?: boolean;
  content?: unknown;
}

interface ResultMessage {
  subtype: string;
  result?: string;
  session_id?: string;
  usage?: { input_tokens: number; output_tokens: number };
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
}

/**
 * Processes SDK messages and yields structured stream events
 */
export async function* processSDKStream(
  sdkMessages: AsyncIterable<SDKMessage>,
  sandboxId?: string
): AsyncGenerator<StreamEvent> {
  const currentToolUses = new Map<string, { name: string; input: unknown }>();

  try {
    for await (const message of sdkMessages) {
      const timestamp = Date.now();

      // Handle system initialization
      if (
        message.type === 'system' &&
        'subtype' in message &&
        message.subtype === 'init'
      ) {
        yield {
          type: 'session_init',
          sessionId: (message as { session_id: string }).session_id,
          model: (message as { model: string }).model,
          timestamp,
        };
        yield {
          type: 'status',
          status: 'initializing',
          message: 'Session initialized',
          timestamp,
        };
        continue;
      }

      // Handle streaming events (the main content)
      if (message.type === 'stream_event' && 'event' in message) {
        const partialMessage = message;
        if ('event' in partialMessage && partialMessage.event) {
          const processedEvent = processStreamEvent(
            partialMessage.event,
            timestamp
          );
          if (processedEvent) {
            yield processedEvent;
          }
        }
        continue;
      }

      // Handle assistant messages (full messages, not streaming)
      if (message.type === 'assistant' && 'message' in message) {
        const assistantMsg = message as {
          message: { content: AssistantMessageContent[] };
        };

        // Extract content
        for (const content of assistantMsg.message.content) {
          if (
            content.type === 'tool_use' &&
            'id' in content &&
            'name' in content &&
            typeof content.id === 'string' &&
            typeof content.name === 'string'
          ) {
            // Emit tool use event if we haven't already
            if (!currentToolUses.has(content.id)) {
              currentToolUses.set(content.id, {
                name: content.name,
                input: content.input,
              });
              yield {
                type: 'tool_use',
                toolName: content.name,
                toolUseId: content.id,
                toolInput: (content.input ?? {}) as Record<string, unknown>,
                timestamp,
              };
            }
          }
        }
        continue;
      }

      // Handle user messages (these contain tool results in the SDK)
      if (message.type === 'user' && 'message' in message) {
        const userMsg = message as { message?: { content?: Array<unknown> } };

        // Check if this is a tool result message
        if (
          userMsg.message?.content &&
          Array.isArray(userMsg.message.content)
        ) {
          for (const item of userMsg.message.content) {
            if (
              typeof item === 'object' &&
              item !== null &&
              'type' in item &&
              (item as { type: unknown }).type === 'tool_result' &&
              'tool_use_id' in item &&
              typeof (item as { tool_use_id: unknown }).tool_use_id === 'string'
            ) {
              const content = item as ToolResultContent;

              const toolInfo = currentToolUses.get(content.tool_use_id);
              const isError = content.is_error ?? false;
              const resultContent = content.content ?? '';

              yield {
                type: 'tool_result',
                toolName: toolInfo?.name ?? 'unknown',
                toolUseId: content.tool_use_id,
                isError,
                content:
                  typeof resultContent === 'string'
                    ? resultContent
                    : JSON.stringify(resultContent),
                timestamp,
              };

              // Clear from tracking
              currentToolUses.delete(content.tool_use_id);
            }
          }
        }
        continue;
      }

      // Handle result messages
      if (message.type === 'result' && 'subtype' in message) {
        const resultMsg = message as unknown as ResultMessage;

        if (
          resultMsg.subtype === 'success' &&
          resultMsg.result &&
          resultMsg.session_id &&
          resultMsg.usage
        ) {
          yield {
            type: 'complete',
            result: {
              content: resultMsg.result,
              sessionId: resultMsg.session_id,
              sandboxId,
              tokensUsed:
                Number(resultMsg.usage.input_tokens) +
                Number(resultMsg.usage.output_tokens),
              totalCost: resultMsg.total_cost_usd ?? 0,
              duration: resultMsg.duration_ms ?? 0,
            },
            timestamp,
          };
        } else if (resultMsg.subtype === 'error_max_turns') {
          yield {
            type: 'error',
            error: {
              message: 'Generation exceeded maximum conversation turns',
              code: 'MAX_TURNS',
              details: {
                numTurns: resultMsg.num_turns ?? 0,
              },
            },
            timestamp,
          };
        } else if (resultMsg.subtype === 'error_during_execution') {
          yield {
            type: 'error',
            error: {
              message: 'An error occurred during code generation',
              code: 'EXECUTION_ERROR',
            },
            timestamp,
          };
        }
        continue;
      }
    }
  } catch (error) {
    yield {
      type: 'error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'STREAM_ERROR',
      },
      timestamp: Date.now(),
    };
  }
}

/**
 * Process individual stream events from the SDK
 */
function processStreamEvent(
  event: BetaRawMessageStreamEvent,
  timestamp: number
): StreamEvent | null {
  // Type guard the event as a generic object first
  const eventObj = event as { type: string; [key: string]: unknown };

  // Message start - indicates beginning of a new message
  if (eventObj.type === 'message_start') {
    return {
      type: 'status',
      status: 'thinking',
      message: 'Claude is thinking',
      timestamp,
    };
  }

  // Content block start - new content block (text or tool use)
  if (eventObj.type === 'content_block_start' && 'content_block' in eventObj) {
    const block = eventObj.content_block as { type: string; name?: string };

    if (
      block.type === 'tool_use' &&
      'name' in block &&
      typeof block.name === 'string'
    ) {
      return {
        type: 'status',
        status: 'tool_use',
        message: `Using tool: ${block.name}`,
        timestamp,
      };
    }

    if (block.type === 'text') {
      return {
        type: 'status',
        status: 'thinking',
        message: 'Generating response',
        timestamp,
      };
    }

    // Extended thinking block
    if (block.type === 'thinking') {
      return {
        type: 'status',
        status: 'thinking',
        message: 'Deep thinking in progress',
        timestamp,
      };
    }
  }

  // Content block delta - streaming content
  if (
    eventObj.type === 'content_block_delta' &&
    'delta' in eventObj &&
    'index' in eventObj
  ) {
    const delta = eventObj.delta as {
      type: string;
      text?: string;
      thinking?: string;
    };
    const index = typeof eventObj.index === 'number' ? eventObj.index : 0;

    // Text delta
    if (
      delta.type === 'text_delta' &&
      'text' in delta &&
      typeof delta.text === 'string'
    ) {
      return {
        type: 'content_delta',
        delta: delta.text,
        index,
        timestamp,
      };
    }

    // Thinking delta (extended thinking)
    if (
      delta.type === 'thinking_delta' &&
      'thinking' in delta &&
      typeof delta.thinking === 'string'
    ) {
      return {
        type: 'thinking_delta',
        delta: delta.thinking,
        timestamp,
      };
    }

    // Input JSON delta (tool input streaming)
    if (delta.type === 'input_json_delta') {
      // We can accumulate this but for now just indicate progress
      return {
        type: 'status',
        status: 'tool_use',
        message: 'Preparing tool input',
        timestamp,
      };
    }
  }

  // Message delta - usage information updates
  if (eventObj.type === 'message_delta' && 'usage' in eventObj) {
    const usage = eventObj.usage as
      | { input_tokens?: number; output_tokens?: number }
      | undefined;
    if (usage) {
      return {
        type: 'usage',
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        timestamp,
      };
    }
  }

  // Content block stop - content block finished
  if (eventObj.type === 'content_block_stop') {
    return {
      type: 'status',
      status: 'thinking',
      message: 'Processing next step',
      timestamp,
    };
  }

  // Message stop - end of message
  if (eventObj.type === 'message_stop') {
    return {
      type: 'status',
      status: 'completing',
      message: 'Finalizing response',
      timestamp,
    };
  }

  return null;
}

/**
 * Helper function to create sandbox events
 */
export function createSandboxEvent(
  action:
    | 'creating'
    | 'created'
    | 'installing_deps'
    | 'deps_installed'
    | 'setup_complete',
  sandboxId?: string,
  message?: string
): StreamEvent {
  return {
    type: 'sandbox',
    action,
    sandboxId,
    message,
    timestamp: Date.now(),
  };
}

/**
 * Helper function to create status events
 */
export function createStatusEvent(
  status: Extract<StreamEvent, { type: 'status' }>['status'],
  message?: string
): StreamEvent {
  return {
    type: 'status',
    status,
    message,
    timestamp: Date.now(),
  };
}

/**
 * Helper function to create error events
 */
export function createErrorEvent(
  message: string,
  code: string,
  details?: Record<string, unknown>
): StreamEvent {
  return {
    type: 'error',
    error: {
      message,
      code,
      details,
    },
    timestamp: Date.now(),
  };
}
