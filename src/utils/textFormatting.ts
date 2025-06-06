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
 * Formats a Bible verse by cleaning the text and ensuring proper quote usage
 * @param verse - The verse text to format
 * @returns Formatted verse text
 */
export const formatBibleVerse = (verse: string): string => {
  if (!verse) {return '';}

  // First clean the text
  let formatted = cleanText(verse);

  // Handle common verse formatting patterns
  // Remove quotes around the entire verse if they exist
  if ((formatted.startsWith('"') && formatted.endsWith('"')) ||
      (formatted.startsWith('"') && formatted.endsWith('"'))) {
    formatted = formatted.substring(1, formatted.length - 1);
  }

  // Ensure proper spacing around punctuation
  formatted = formatted
    .replace(/\s+([,.!?;:])/g, '$1')  // Remove space before punctuation
    .replace(/([a-z])"([A-Z])/g, '$1" $2')  // Add space after quote if missing before capital letter
    .replace(/([.,!?;:])"([^\s])/g, '$1" $2');  // Add space after quote following punctuation

  return formatted;
};
