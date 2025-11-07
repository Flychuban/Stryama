import { useCallback } from 'react';
import { type Framework } from '@prisma/client';

const STORAGE_KEYS = {
  PROMPT: 'stryama_pending_prompt',
  FRAMEWORK: 'stryama_pending_framework',
  TIMESTAMP: 'stryama_pending_timestamp',
} as const;

// Prompt expires after 1 hour
const EXPIRY_MS = 60 * 60 * 1000;

interface StoredPromptData {
  prompt: string;
  framework: Framework;
}

export function usePromptHandoff() {
  const clearPrompt = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEYS.PROMPT);
      sessionStorage.removeItem(STORAGE_KEYS.FRAMEWORK);
      sessionStorage.removeItem(STORAGE_KEYS.TIMESTAMP);
    } catch (error) {
      console.error('Failed to clear prompt:', error);
    }
  }, []);

  const storePrompt = useCallback((prompt: string, framework: Framework) => {
    try {
      sessionStorage.setItem(STORAGE_KEYS.PROMPT, prompt);
      sessionStorage.setItem(STORAGE_KEYS.FRAMEWORK, framework);
      sessionStorage.setItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString());
    } catch (error) {
      console.error('Failed to store prompt:', error);
    }
  }, []);

  const retrievePrompt = useCallback((): StoredPromptData | null => {
    try {
      const prompt = sessionStorage.getItem(STORAGE_KEYS.PROMPT);
      const framework = sessionStorage.getItem(STORAGE_KEYS.FRAMEWORK);
      const timestamp = sessionStorage.getItem(STORAGE_KEYS.TIMESTAMP);

      if (!prompt || !framework || !timestamp) {
        return null;
      }

      // Check if expired
      const age = Date.now() - parseInt(timestamp, 10);
      if (age > EXPIRY_MS) {
        clearPrompt();
        return null;
      }

      return {
        prompt,
        framework: framework as Framework,
      };
    } catch (error) {
      console.error('Failed to retrieve prompt:', error);
      return null;
    }
  }, [clearPrompt]);

  const hasStoredPrompt = useCallback((): boolean => {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.PROMPT) !== null;
    } catch {
      return false;
    }
  }, []);

  return {
    storePrompt,
    retrievePrompt,
    clearPrompt,
    hasStoredPrompt,
  };
}
