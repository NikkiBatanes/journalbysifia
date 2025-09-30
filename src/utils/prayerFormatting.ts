/**
 * prayerFormatting.ts
 * Shared utility for consistent prayer text formatting across the app
 */

/**
 * Normalize prayer text formatting for consistent display
 * - Converts CRLF to LF
 * - Collapses 2+ newlines to 1
 * - Ensures exactly one newline before "In Jesus' Name, Amen"
 * - Ensures exactly one newline after "Heavenly Father,"
 * - Handles curly apostrophes and optional comma/amen, case-insensitive
 * - Removes markdown bold markers (**)
 * - Trims trailing spaces on lines
 */
export function normalizePrayerText(raw: string): string {
  if (!raw) { return raw; }
  
  let result = raw;
  
  // Remove markdown bold markers
  result = result.replace(/\*\*/g, '');
  
  // Convert CRLF to LF
  result = result.replace(/\r\n/g, '\n');
  
  // Remove any spaces/tabs at line starts
  result = result.replace(/^[\t ]+/gm, '');
  
  // Normalize apostrophes to curly for consistency
  result = result.replace(/Jesus[''\u2019]\s*Name/gi, (m) => m.replace(/[''\u2019]/, '\u2019'));
  
  // First collapse excessive newlines (3+ to 2)
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // Ensure at least one newline after "Heavenly Father," - preserve if already has 2
  result = result.replace(/(Heavenly\s+Father,)(?!\n)/gi, '$1\n');
  
  // Ensure at least one newline before "In Jesus' Name" - preserve if already has 2
  result = result.replace(/(\S)(?!\n)\s*((?:In\s+Jesus[''\u2019]?\s*Name)(?:,?\s*Amen)?)/gi, '$1\n$2');
  
  // Trim trailing spaces on lines
  result = result.replace(/[\t ]+$/gm, '');
  
  return result;
}
