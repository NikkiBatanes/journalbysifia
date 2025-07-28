/**
 * Utility functions for dynamic name replacement in playbook content
 * This allows user names to be updated dynamically when they change their profile
 */

/**
 * Replace [User's Name] placeholder with the current user's display name
 * @param text - The text containing [User's Name] placeholders
 * @param displayName - The current user's display name
 * @returns Text with placeholders replaced with actual name
 */
export function replaceUserNamePlaceholder(text: string, displayName: string): string {
  if (!text || !displayName) {
    return text;
  }

  return text.replace(/\[User's Name\]/g, displayName);
}

/**
 * Replace multiple name-related placeholders in text
 * @param text - The text containing placeholders
 * @param user - User object containing name information
 * @returns Text with all placeholders replaced
 */
export function replaceAllNamePlaceholders(text: string, user: { displayName?: string; firstName?: string; lastName?: string }): string {
  if (!text) {
    return text;
  }

  let processedText = text;

  // Replace [User's Name] with display name or constructed name
  const displayName = user.displayName || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}`.trim() : '');
  if (displayName) {
    processedText = replaceUserNamePlaceholder(processedText, displayName);
  }

  // Replace [First Name] if it exists
  if (user.firstName) {
    processedText = processedText.replace(/\[First Name\]/g, user.firstName);
  }

  // Replace [Last Name] if it exists
  if (user.lastName) {
    processedText = processedText.replace(/\[Last Name\]/g, user.lastName);
  }

  return processedText;
}

/**
 * Check if text contains any name placeholders
 * @param text - The text to check
 * @returns True if text contains name placeholders
 */
export function hasNamePlaceholders(text: string): boolean {
  if (!text) {
    return false;
  }

  return /\[User's Name\]|\[First Name\]|\[Last Name\]/g.test(text);
}
