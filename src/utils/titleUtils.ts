/**
 * Utility functions for handling devotional titles consistently across the app
 */

/**
 * Extracts and cleans a devotional title from potentially prefixed formats
 * Handles various title formats like "DEVOTIONAL TITLE: My Title" or "SERIES TITLE: My Title"
 *
 * @param title The raw title string that might contain prefixes
 * @param fallback Optional fallback title if extraction fails
 * @returns A clean title without prefixes
 */
export const extractCleanTitle = (title: string | undefined, fallback: string = 'Devotional'): string => {
  if (!title) {return fallback;}

  // First check for common title prefixes
  const prefixMatch = title.match(/^(DEVOTIONAL TITLE:|SERIES TITLE:|TITLE:)\s*(.*)$/i);
  if (prefixMatch && prefixMatch[2]) {
    return prefixMatch[2].trim();
  }

  // If no match with regex, try splitting by known prefixes
  if (title.includes('TITLE:')) {
    const parts = title.split('TITLE:');
    return parts[parts.length - 1].trim();
  }

  if (title.includes('SERIES TITLE:')) {
    const parts = title.split('SERIES TITLE:');
    return parts[parts.length - 1].trim();
  }

  if (title.includes('DEVOTIONAL TITLE:')) {
    const parts = title.split('DEVOTIONAL TITLE:');
    return parts[parts.length - 1].trim();
  }

  // Remove any quotes that might be wrapping the title
  const cleanedTitle = title.replace(/^"(.*)"$/, '$1').trim();

  return cleanedTitle || fallback;
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
