/**
 * prayerFormatting.ts
 * Shared utility for consistent prayer text formatting across the app
 */

/**
 * Normalize prayer text formatting for consistent display
 * - Converts CRLF to LF
 * - Normalizes apostrophes to curly quotes
 * - Removes markdown bold markers (**)
 * - Preserves all line breaks as-is from AI generation
 */
export function normalizePrayerText(raw: string): string {
  if (!raw) { return raw; }
  
  return raw
    // Remove markdown bold markers
    .replace(/\*\*/g, '')
    // Convert CRLF to LF
    .replace(/\r\n/g, '\n')
    // Normalize apostrophes to curly for consistency
    .replace(/Jesus[''\u2019]\s*Name/gi, (m) => m.replace(/[''\u2019]/, '\u2019'))
    // Trim trailing spaces on lines
    .replace(/[\t ]+$/gm, '');
}
