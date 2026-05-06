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
 * @param currentFirstName - The current user's first name
 * @param oldDisplayName - The old user's display name to replace (optional)
 * @returns Text with old names replaced with current name
 */
export function replaceHardcodedNames(text: string, currentFirstName: string, oldDisplayName?: string): string {
  if (!text || !currentFirstName) {
    return text;
  }

  let processedText = text;

  // If we have the old display name, replace it directly with first name only
  if (oldDisplayName && oldDisplayName !== currentFirstName) {
    // Replace exact matches of the old name with first name
    const oldNameRegex = new RegExp(`\\b${escapeRegExp(oldDisplayName)}\\b`, 'g');
    processedText = processedText.replace(oldNameRegex, currentFirstName);
  }

  // ENHANCED approach: Replace various name patterns while preserving context
  // Check both at start AND throughout the text for names that look like the old user's name
  const namePatterns = [
    // Pattern: "Name, you" - replace "Name" but preserve ", you"
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+(you\s+)/i,
    // Pattern: "name, rest" - handle lowercase names like "loaer, rest"
    /^([a-z]+),\s+(.*)/i,
    // Pattern: "Name, " at start - replace name but preserve comma and space
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+/,
    // Pattern: "Name " at start (without comma) - replace first word if it looks like a name
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+/,
  ];

  // First, try patterns at the start (for backward compatibility)
  for (const pattern of namePatterns) {
    const match = processedText.match(pattern);
    if (match && match[1]) {
      const detectedName = match[1];
      const followingText = match[2] || ''; // Preserve following text if exists

      // Replace if it looks like a name and is different from current name
      if (detectedName !== currentFirstName && (isLikelyName(detectedName) || detectedName.toLowerCase() === 'loaer')) {
        if (followingText) {
          processedText = processedText.replace(pattern, `${currentFirstName}, ${followingText}`);
        } else {
          processedText = processedText.replace(pattern, `${currentFirstName} `);
        }

        break; // Only replace the first occurrence
      }
    }
  }

  // If no start pattern matched, try replacing throughout the text
  // This catches names in the middle of paragraphs
  if (processedText === text) {
    // Split into words and look for capitalized names that could be the user's name
    const words = processedText.split(/(\s+)/);
    let replaced = false;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Check if this word looks like a name (capitalized, letters only, not common words)
      // More lenient: just check if it's capitalized and not a common word
      if (/^[A-Z]/.test(word) && word.length > 2 && word.length < 30 && /^[A-Za-z]+$/.test(word)) {
        // Check if it's a common word
        const commonWords = ['The', 'This', 'That', 'These', 'Those', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'With', 'Without', 'But', 'And', 'Or', 'So', 'However', 'Therefore', 'Moreover', 'Furthermore', 'Nevertheless', 'Nonetheless', 'Thus', 'Hence', 'Consequently', 'Accordingly', 'As', 'When', 'While', 'Since', 'Because', 'Although', 'Though', 'Even', 'If', 'Unless', 'Until', 'While', 'God', 'Lord', 'Jesus', 'Christ', 'Spirit', 'Father', 'Son', 'Holy'];
        if (!commonWords.includes(word) && word !== currentFirstName) {
          console.log('[NameReplacement] Found likely name to replace:', word, '->', currentFirstName);
          // Replace it with current first name
          words[i] = currentFirstName;
          replaced = true;
          break; // Only replace the first occurrence to be safe
        }
      }
    }

    if (replaced) {
      processedText = words.join('');
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
  const commonWords = ['The', 'This', 'That', 'These', 'Those', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'With', 'Without', 'But', 'And', 'Or', 'So', 'However', 'Therefore', 'Moreover', 'Furthermore', 'Nevertheless', 'Nonetheless', 'Thus', 'Hence', 'Consequently', 'Accordingly', 'As', 'When', 'While', 'Since', 'Because', 'Although', 'Though', 'Even', 'If', 'Unless', 'Until', 'While'];
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

  if (!text) {
    return text;
  }

  let processedText = text;

  // Use first name only for more natural text flow
  const firstName = user.firstName || (user.displayName ? user.displayName.split(' ')[0] : '');

  if (firstName) {
    // First, replace [User's Name] placeholder with first name only
    processedText = processedText.replace(/\[User's Name\]/g, firstName);

    // Then, try to replace hardcoded names from old playbooks (disabled by default to prevent text cutting)
    if (options?.replaceHardcodedNames === true) {
      const afterHardcoded = replaceHardcodedNames(processedText, firstName, options?.oldDisplayName);

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
