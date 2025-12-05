/**
 * GitHub Commit Message Utility
 * Generates smart commit messages based on export context
 */

/**
 * Generate a commit message for GitHub export
 *
 * @param projectName - Name of the project being exported
 * @param isFirstExport - Whether this is the first export to this repository
 * @param customMessage - Optional custom message from user
 * @returns Generated commit message
 */
export function generateCommitMessage(
  projectName: string,
  isFirstExport: boolean,
  customMessage?: string
): string {
  // Use custom message if provided
  if (customMessage) {
    return addStryamaAttribution(customMessage);
  }

  // Generate smart message based on context
  if (isFirstExport) {
    return `Initial commit from Stryama - ${projectName}

Generated with Stryama AI Code Generator
https://stryama.com`;
  }

  // Subsequent exports
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });

  return `Update from Stryama - ${timestamp}

Generated with Stryama AI Code Generator
https://stryama.com`;
}

/**
 * Add Stryama attribution to a commit message
 *
 * @param message - Original commit message
 * @returns Commit message with attribution
 */
function addStryamaAttribution(message: string): string {
  // Check if attribution already exists
  if (message.includes('Stryama')) {
    return message;
  }

  return `${message}

Generated with Stryama AI Code Generator
https://stryama.com`;
}

/**
 * Sanitize commit message to ensure it's valid
 *
 * @param message - Raw commit message
 * @returns Sanitized commit message
 */
export function sanitizeCommitMessage(message: string): string {
  // Remove leading/trailing whitespace
  let sanitized = message.trim();

  // Ensure message is not empty
  if (!sanitized) {
    sanitized = 'Update from Stryama';
  }

  // Limit first line to 72 characters (GitHub best practice)
  const lines = sanitized.split('\n');
  if (lines[0] && lines[0].length > 72) {
    lines[0] = lines[0].substring(0, 69) + '...';
    sanitized = lines.join('\n');
  }

  return sanitized;
}
