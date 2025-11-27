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

  // 3) Remove ALL quotes from Bible verses
  // This ensures clean verse display without any quote marks
  formatted = formatted
    .replace(/"/g, '') // Remove all double quotes
    .replace(/'/g, '') // Remove all single quotes
    .trim();

  // 4) Remove leading punctuation (colons, dashes)
  formatted = formatted
    .replace(/^[:—\s]+/, '') // Remove leading colons, dashes, spaces
    .trim();

  // 5) Handle multiple verses separated by parentheses
  // If there's a "(" that's not at the very end (not just version info),
  // it likely means there are two verses. Take only the first one.
  const parenIndex = formatted.indexOf('(');
  if (parenIndex > 0) {
    // Check if this looks like a second verse (has substantial text before the paren)
    // and not just a version marker at the end
    const beforeParen = formatted.substring(0, parenIndex).trim();
    const afterParen = formatted.substring(parenIndex);
    
    // If there's substantial text before the paren and the paren isn't just a version marker
    // (version markers are usually short like "(NASB)" at the very end)
    if (beforeParen.length > 20 && !afterParen.match(/^\(\s*[A-Z]{2,5}\s*\)$/)) {
      // Take only the first verse (before the parenthesis)
      formatted = beforeParen;
    }
  }

  // 6) Fix spacing around punctuation
  formatted = formatted
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([.,!?;:])([^\s])/g, '$1 $2');

  // 7) Strip trailing empty `()` artifacts in a few variants
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
