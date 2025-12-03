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
 * Formats a Bible verse with MINIMAL intervention to preserve exact translation text
 * @param verse - The verse text to format
 * @returns Verse text with original translation elements completely preserved
 */
export const formatBibleVerse = (verse: string): string => {
  if (!verse) {return '';}

  // MINIMAL CLEANUP - Only remove truly problematic characters that break display
  // Preserve ALL translation elements including brackets, quotes, punctuation
  let formatted = verse
    // Only normalize line breaks and excessive whitespace
    .replace(/\n+/g, ' ') // Convert line breaks to spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .trim(); // Remove leading/trailing whitespace only

  return formatted;
};
