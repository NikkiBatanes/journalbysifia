/**
 * Cleans and formats text by removing unwanted quote characters and extra spaces
 * @param text - The input text to clean
 * @returns Cleaned and formatted text
 */
export const cleanText = (text: string): string => {
  if (!text) {return '';}

  return text
    // Replace escaped quotes with regular quotes
    .replace(/\\"/g, '"')
    // Remove any remaining backslashes before quotes
    .replace(/\\"/g, '"')
    // Replace smart quotes with straight quotes
    .replace(/[“”]/g, '"')
    // Replace single smart quotes
    .replace(/[‘’]/g, "'")
    // Remove any remaining backslashes
    .replace(/\\/g, '')
    // Clean up any double spaces that might result
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Formats a Bible verse by cleaning the text and ensuring proper formatting
 * @param verse - The verse text to format
 * @returns Formatted verse text
 */
export const formatBibleVerse = (verse: string): string => {
  if (!verse) {return '';}

  // 1) Clean base text
  let formatted = cleanText(verse);

  // 2) Normalize quotes and spaces
  formatted = formatted
    .replace(/"/g, '"')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  // 3) Only remove wrapping quotes if they enclose the ENTIRE verse
  // This preserves quotes that are part of the actual verse text (e.g., "Father and I are one")
  if (formatted.startsWith('"') && formatted.endsWith('"') && formatted.length > 2) {
    // Check if this is a wrapping quote (not part of the verse)
    // by seeing if removing them leaves valid text
    const withoutWrappers = formatted.slice(1, -1).trim();
    if (withoutWrappers.length > 0 && !withoutWrappers.startsWith('"')) {
      formatted = withoutWrappers;
    }
  }

  // 4) Remove orphaned trailing quotes (quotes at end without matching opening quote)
  // Example: "And we know that..." → "And we know that..."
  if (!formatted.startsWith('"') && formatted.endsWith('"')) {
    formatted = formatted.slice(0, -1).trim();
  }

  // 5) Remove orphaned leading quotes (quotes at start without matching closing quote)
  // Example: "Father and I are one → Father and I are one
  if (formatted.startsWith('"') && !formatted.endsWith('"')) {
    formatted = formatted.slice(1).trim();
  }

  // 6) Remove leading punctuation (colons, dashes) but NOT quotes
  // Quotes might be part of the actual verse text
  formatted = formatted
    .replace(/^[:—\s]+/, '') // Remove leading colons, dashes, spaces (but NOT quotes)
    .trim();

  // 4) Fix spacing around punctuation
  formatted = formatted
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([.,!?;:])([^\s])/g, '$1 $2');

  // 5) Strip trailing empty `()` artifacts in a few variants
  formatted = formatted
    // Case 1: " ... " () or " ... " ()! etc.
    .replace(/"\s*\(\)\s*([.,!?;:]*)\s*$/g, '$1')
    // Case 2: ... () or ... ()! etc.
    .replace(/\(\)\s*([.,!?;:]*)\s*$/g, '$1')
    // Case 3: Remove "(, NASB)" and similar version artifacts
    .replace(/\s*\(\s*,\s*[A-Z]+\s*\)\s*([.,!?;:]*)\s*$/g, '$1')
    // Final safety: if any bare () remains at the very end, drop it
    .replace(/\s*\(\)\s*$/g, '');

  return formatted;
};
