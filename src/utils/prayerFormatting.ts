/**
 * prayerFormatting.ts
 * Shared utility for consistent prayer text formatting across the app
 */

/**
 * Normalize prayer text formatting for consistent display
 * - Converts CRLF to LF
 * - Collapses 3+ newlines to 2
 * - Ensures exactly two newlines before "In Jesus' Name, Amen"
 * - Ensures exactly two newlines after "Heavenly Father,"
 * - Handles curly apostrophes and optional comma/amen, case-insensitive
 * - Removes markdown bold markers (**)
 * - Trims trailing spaces on lines
 */
export function normalizePrayerText(raw: string): string {
  if (!raw) { return raw; }
  
  console.log('[PrayerFormatting] Input:', raw.substring(raw.length - 50)); // Log last 50 chars
  
  const result = raw
    // Remove markdown bold markers
    .replace(/\*\*/g, '')
    // Convert CRLF to LF
    .replace(/\r\n/g, '\n')
    // Remove any spaces/tabs at line starts
    .replace(/^[\t ]+/gm, '')
    // Normalize apostrophes to curly for consistency
    .replace(/Jesus[''\u2019]\s*Name/gi, (m) => m.replace(/[''\u2019]/, '\u2019'))
    // Ensure exactly one blank line (two newlines) after "Heavenly Father,"
    .replace(/(Heavenly\s+Father,)\s*/gi, '$1\n\n')
    // Ensure exactly one blank line (two newlines) before the closing phrase
    // Match any amount of whitespace (including none) before "In Jesus' Name"
    // This handles cases like "You.In Jesus'" or "You. In Jesus'" or "You.\n\nIn Jesus'"
    .replace(/(\S)\s*((?:In\s+Jesus[''\u2019]?\s*Name)(?:,?\s*Amen)?)/gi, '$1\n\n$2')
    // NOW collapse 3+ newlines to 2 (after we've added our formatting)
    .replace(/\n{3,}/g, '\n\n')
    // Trim trailing spaces on lines
    .replace(/[\t ]+$/gm, '');
  
  console.log('[PrayerFormatting] Output:', result.substring(result.length - 50)); // Log last 50 chars
  return result;
}
