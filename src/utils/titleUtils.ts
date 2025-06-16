/**
 * Utility functions for handling devotional titles consistently across the app
 */

/**
 * Maximum length for devotional titles
 * Titles longer than this will be truncated
 */
export const MAX_TITLE_LENGTH = 32;

/**
 * Extracts and cleans a devotional title from potentially prefixed formats
 * Handles various title formats like "DEVOTIONAL TITLE: My Title" or "SERIES TITLE: My Title"
 * Ensures titles are no longer than MAX_TITLE_LENGTH characters
 *
 * @param title The raw title string that might contain prefixes
 * @param fallback Optional fallback title if extraction fails
 * @returns A clean title without prefixes, truncated if necessary
 */
export const extractCleanTitle = (title: string | undefined, fallback: string = 'Devotional'): string => {
  if (!title) {return fallback;}

  // First check for common title prefixes
  const prefixMatch = title.match(/^(DEVOTIONAL TITLE:|SERIES TITLE:|TITLE:)\s*(.*)$/i);
  let cleanedTitle = '';

  if (prefixMatch && prefixMatch[2]) {
    cleanedTitle = prefixMatch[2].trim();
  } else {
    // If no match with regex, try splitting by known prefixes
    if (title.includes('TITLE:')) {
      const parts = title.split('TITLE:');
      cleanedTitle = parts[parts.length - 1].trim();
    } else if (title.includes('SERIES TITLE:')) {
      const parts = title.split('SERIES TITLE:');
      cleanedTitle = parts[parts.length - 1].trim();
    } else if (title.includes('DEVOTIONAL TITLE:')) {
      const parts = title.split('DEVOTIONAL TITLE:');
      cleanedTitle = parts[parts.length - 1].trim();
    } else {
      // If no prefix found, use the original title
      cleanedTitle = title.trim();
    }
  }

  // Remove any quotes that might be wrapping the title
  cleanedTitle = cleanedTitle.replace(/^"(.*)"$/, '$1').trim();

  // Ensure title is not empty
  if (!cleanedTitle) {
    return fallback;
  }

  // Truncate title if it's too long
  if (cleanedTitle.length > MAX_TITLE_LENGTH) {
    // Try to cut at a word boundary
    let truncated = cleanedTitle.substring(0, MAX_TITLE_LENGTH).trim();
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncated = truncated.substring(0, lastSpace);
    }
    return truncated;
  }

  return cleanedTitle;
};

/**
 * Determines if a title is generic or not meaningful
 *
 * @param title The title to check
 * @param userInput Optional user input to compare against
 * @returns Boolean indicating if the title is generic
 */
export const isGenericTitle = (title: string | undefined, userInput?: string): boolean => {
  if (!title) {return true;}

  const cleanTitle = title.toLowerCase().trim();

  // List of generic titles to check against
  const genericTitles = [
    'devotional',
    'daily devotional',
    'devotionals',
    'series',
    'devotional series',
    'bible study',
    'reflection',
    'reflections',
  ];

  // Fixed TypeScript error by ensuring all conditions return boolean values
  const isGeneric = genericTitles.includes(cleanTitle);
  const isTooShort = cleanTitle.length < 3;
  const matchesUserInput = userInput ? cleanTitle === userInput.toLowerCase().trim() : false;

  return isGeneric || isTooShort || matchesUserInput;
};
