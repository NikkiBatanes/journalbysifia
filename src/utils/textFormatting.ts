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

  // First clean the text
  let formatted = cleanText(verse);

  // Remove any remaining escaped quotes or special characters
  formatted = formatted
    .replace(/"/g, '"')  // Convert escaped quotes to regular quotes
    .replace(/[\u201C\u201D]/g, '"')  // Replace smart quotes with straight quotes
    .replace(/[\u2018\u2019]/g, "'")  // Replace smart single quotes
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .trim();

  // Remove any duplicate spaces around punctuation
  formatted = formatted
    .replace(/\s+([.,!?;:])/g, '$1')  // Remove space before punctuation
    .replace(/([.,!?;:])([^\s])/g, '$1 $2');  // Add space after punctuation if missing

  return formatted;
};
