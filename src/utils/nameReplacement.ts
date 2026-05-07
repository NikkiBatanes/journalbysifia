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

  // Common words that should NEVER be replaced at the start of text
  const startCommonWords = [
    'Your', 'You', 'Yours', 'Yourself',
    'He', 'Him', 'His', 'Himself',
    'She', 'Her', 'Hers', 'Herself',
    'It', 'Its', 'Itself',
    'They', 'Them', 'Their', 'Theirs', 'Themselves',
    'We', 'Us', 'Our', 'Ours', 'Ourselves',
    'I', 'Me', 'My', 'Mine', 'Myself',
    'The', 'This', 'That', 'These', 'Those', 'A', 'An',
    'In', 'On', 'At', 'By', 'For', 'With', 'Without', 'From', 'To', 'Of',
    'But', 'And', 'Or', 'So', 'However', 'Therefore', 'Moreover', 'Furthermore',
    'Nevertheless', 'Nonetheless', 'Thus', 'Hence', 'Consequently', 'Accordingly',
    'As', 'When', 'While', 'Since', 'Because', 'Although', 'Though', 'Even', 'If', 'Unless', 'Until',
    'God', 'Lord', 'Jesus', 'Christ', 'Spirit', 'Father', 'Son', 'Holy',
    'What', 'Which', 'Who', 'Where', 'When', 'Why', 'How',
    'Something', 'Nothing', 'Everything', 'Anything',
    'Someone', 'Anyone', 'Everyone', 'Noone',
    'Some', 'Any', 'Every', 'All', 'None',
    'Each', 'Both', 'Either', 'Neither',
    'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'First', 'Second', 'Third', 'Next', 'Last',
    'Now', 'Then', 'Today', 'Tomorrow', 'Yesterday',
    'Here', 'There', 'Everywhere', 'Nowhere',
    'Always', 'Never', 'Sometimes', 'Often',
    'Just', 'Only', 'Still', 'Already', 'Yet',
    'Very', 'Too', 'Quite', 'Rather', 'Really',
    'Well', 'So', 'Then', 'Now',
  ];

  const namePatterns = [
    // Pattern: "Name, you" - replace "Name" but preserve ", you"
    { pattern: /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+(you\s+)/i, hasComma: true },
    // Pattern: "name, rest" - handle lowercase names like "loaer, rest"
    { pattern: /^([a-z]+),\s+(.*)/i, hasComma: true },
    // Pattern: "Name, " at start - replace name but preserve comma and space
    { pattern: /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+/, hasComma: true },
    // Pattern: "Name " at start (without comma) - replace first word if it looks like a name
    { pattern: /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+/, hasComma: false },
  ];

  // First, try patterns at the start (for backward compatibility)
  for (const { pattern, hasComma } of namePatterns) {
    const match = processedText.match(pattern);
    if (match && match[1]) {
      const detectedName = match[1];
      const followingText = match[2] || ''; // Preserve following text if exists

      console.log('[NameReplacement] Start pattern match:', detectedName, 'isCommonWord:', startCommonWords.includes(detectedName), 'isLikelyName:', isLikelyName(detectedName));

      // Replace if it looks like a name, is different from current name, AND is not a common word
      if (detectedName !== currentFirstName &&
          !startCommonWords.includes(detectedName) &&
          (isLikelyName(detectedName) || detectedName.toLowerCase() === 'loaer')) {
        console.log('[NameReplacement] REPLACING via start pattern:', detectedName, '->', currentFirstName);
        if (followingText) {
          // Preserve the original punctuation structure
          const separator = hasComma ? ', ' : ' ';
          processedText = processedText.replace(pattern, `${currentFirstName}${separator}${followingText}`);
        } else {
          // If no following text, preserve original structure
          const separator = hasComma ? ', ' : ' ';
          processedText = processedText.replace(pattern, `${currentFirstName}${separator}`);
        }

        break; // Only replace the first occurrence
      }
    }
  }

  // If no start pattern matched, try replacing throughout the text
  // This catches names in the middle of paragraphs
  if (processedText === text) {
    // Use word boundary regex to preserve exact spacing
    // Exclude common pronouns and words that start sentences but aren't names
    const wordBoundaryRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    let replaced = false;

    processedText = processedText.replace(wordBoundaryRegex, (match) => {
      if (replaced) {
        return match; // Only replace first occurrence
      }

      // Comprehensive list of common words and pronouns that should NEVER be replaced
      const commonWords = [
        // Articles and determiners
        'The', 'This', 'That', 'These', 'Those', 'A', 'An',
        // Prepositions
        'In', 'On', 'At', 'By', 'For', 'With', 'Without', 'From', 'To', 'Of', 'About', 'Between', 'Among',
        // Conjunctions
        'But', 'And', 'Or', 'So', 'However', 'Therefore', 'Moreover', 'Furthermore', 'Nevertheless', 'Nonetheless', 'Thus', 'Hence', 'Consequently', 'Accordingly',
        // Subordinating conjunctions
        'As', 'When', 'While', 'Since', 'Because', 'Although', 'Though', 'Even', 'If', 'Unless', 'Until',
        // Religious terms
        'God', 'Lord', 'Jesus', 'Christ', 'Spirit', 'Father', 'Son', 'Holy',
        // Pronouns - capitalized at sentence starts
        'Your', 'You', 'Yours', 'Yourself',
        'He', 'Him', 'His', 'Himself',
        'She', 'Her', 'Hers', 'Herself',
        'It', 'Its', 'Itself',
        'They', 'Them', 'Their', 'Theirs', 'Themselves',
        'We', 'Us', 'Our', 'Ours', 'Ourselves',
        'I', 'Me', 'My', 'Mine', 'Myself',
        // Common sentence starters
        'What', 'Which', 'Who', 'Where', 'When', 'Why', 'How',
        'Something', 'Nothing', 'Everything', 'Anything',
        'Someone', 'Anyone', 'Everyone', 'Noone',
        'Some', 'Any', 'Every', 'All', 'None',
        'Each', 'Both', 'Either', 'Neither',
        'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'First', 'Second', 'Third', 'Next', 'Last',
        'Now', 'Then', 'Today', 'Tomorrow', 'Yesterday',
        'Here', 'There', 'Everywhere', 'Nowhere',
        'Always', 'Never', 'Sometimes', 'Often',
        'Just', 'Only', 'Still', 'Already', 'Yet',
        'Very', 'Too', 'Quite', 'Rather', 'Really',
        'Well', 'So', 'Then', 'Now',
        // Words that commonly start sentences but aren't names
        'But', 'And', 'Or', 'So', 'Yet', 'However',
      ];

      if (!commonWords.includes(match) && match !== currentFirstName && isLikelyName(match)) {
        console.log('[NameReplacement] Found likely name to replace:', match, '->', currentFirstName);
        replaced = true;
        return currentFirstName;
      }
      return match;
    });
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
  const commonWords = ['The', 'This', 'That', 'These', 'Those', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'With', 'Without', 'But', 'And', 'Or', 'So', 'However', 'Therefore', 'Moreover', 'Furthermore', 'Nevertheless', 'Nonetheless', 'Thus', 'Hence', 'Consequently', 'Accordingly', 'As', 'When', 'While', 'Since', 'Because', 'Although', 'Though', 'Even', 'If', 'Unless', 'Until', 'While', 'God', 'Lord', 'Jesus', 'Christ', 'Spirit', 'Father', 'Son', 'Holy', 'Your', 'You', 'Youre', 'Yours', 'Yourself', 'He', 'Him', 'His', 'Himself', 'She', 'Her', 'Hers', 'Herself', 'It', 'Its', 'Itself', 'They', 'Them', 'Their', 'Theirs', 'Themselves', 'We', 'Us', 'Our', 'Ours', 'Ourselves'];
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
