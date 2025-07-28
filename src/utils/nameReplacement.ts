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
 * Replace hardcoded names from old playbooks with current user's name
 * This handles existing playbooks that have hardcoded names instead of placeholders
 * @param text - The text that may contain hardcoded names
 * @param currentDisplayName - The current user's display name
 * @param oldDisplayName - The old user's display name to replace (optional)
 * @returns Text with old names replaced with current name
 */
export function replaceHardcodedNames(text: string, currentDisplayName: string, oldDisplayName?: string): string {
  if (!text || !currentDisplayName) {
    return text;
  }

  let processedText = text;

  // If we have the old display name, replace it directly
  if (oldDisplayName && oldDisplayName !== currentDisplayName) {
    // Replace exact matches of the old name
    const oldNameRegex = new RegExp(`\\b${escapeRegExp(oldDisplayName)}\\b`, 'g');
    processedText = processedText.replace(oldNameRegex, currentDisplayName);
  }

  // Also try to detect and replace common name patterns at the beginning of sentences
  // This handles cases where names appear at the start of Truth in Love content
  const namePatterns = [
    // Pattern: "Name, " (name followed by comma and space)
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+/,
    // Pattern: "Name " at the beginning (name followed by space)
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?=[a-z])/,
  ];

  for (const pattern of namePatterns) {
    const match = processedText.match(pattern);
    if (match && match[1]) {
      const detectedName = match[1];
      // Only replace if it looks like a name and is different from current name
      if (detectedName !== currentDisplayName && isLikelyName(detectedName)) {
        processedText = processedText.replace(pattern, `${currentDisplayName}, `);
        break; // Only replace the first occurrence
      }
    }
  }

  return processedText;
}

/**
 * Helper function to escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a string looks like a person's name
 * Simple heuristic: starts with capital letter, contains only letters and spaces
 */
function isLikelyName(text: string): boolean {
  // Must start with capital letter
  if (!/^[A-Z]/.test(text)) {
    return false;
  }

  // Must contain only letters, spaces, and common name characters
  if (!/^[A-Za-z\s'-]+$/.test(text)) {
    return false;
  }

  // Must be reasonable length (2-50 characters)
  if (text.length < 2 || text.length > 50) {
    return false;
  }

  // Should not be common words that might appear at the start of sentences
  const commonWords = ['The', 'This', 'That', 'These', 'Those', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'With', 'Without'];
  if (commonWords.includes(text)) {
    return false;
  }

  return true;
}

/**
 * Replace multiple name-related placeholders in text
 * @param text - The text containing placeholders
 * @param user - User object containing name information
 * @param options - Additional options for replacement
 * @returns Text with all placeholders replaced
 */
export function replaceAllNamePlaceholders(
  text: string,
  user: { displayName?: string; firstName?: string; lastName?: string },
  options?: { oldDisplayName?: string; replaceHardcodedNames?: boolean }
): string {
  console.log('[nameReplacement] Input:', { text, user, options });

  if (!text) {
    return text;
  }

  let processedText = text;
  const originalText = text;

  // Replace [User's Name] with display name or constructed name
  const displayName = user.displayName || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}`.trim() : '');
  console.log('[nameReplacement] Display name:', displayName);

  if (displayName) {
    // First, replace placeholder patterns
    const afterPlaceholder = replaceUserNamePlaceholder(processedText, displayName);
    console.log('[nameReplacement] After placeholder replacement:', { before: processedText, after: afterPlaceholder });
    processedText = afterPlaceholder;

    // Then, try to replace hardcoded names from old playbooks
    if (options?.replaceHardcodedNames !== false) {
      const afterHardcoded = replaceHardcodedNames(processedText, displayName, options?.oldDisplayName);
      console.log('[nameReplacement] After hardcoded replacement:', { before: processedText, after: afterHardcoded });
      processedText = afterHardcoded;
    }
  }

  // Replace [First Name] if it exists
  if (user.firstName) {
    processedText = processedText.replace(/\[First Name\]/g, user.firstName);
  }

  // Replace [Last Name] if it exists
  if (user.lastName) {
    processedText = processedText.replace(/\[Last Name\]/g, user.lastName);
  }

  console.log('[nameReplacement] Final result:', { originalText, processedText, changed: originalText !== processedText });
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
