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
  
  console.log('[PrayerFormatting] Full Input:', raw);
  
  let result = raw;
  
  // Remove markdown bold markers
  result = result.replace(/\*\*/g, '');
  
  // Convert CRLF to LF
  result = result.replace(/\r\n/g, '\n');
  
  // Remove any spaces/tabs at line starts
  result = result.replace(/^[\t ]+/gm, '');
  
  // Normalize apostrophes to curly for consistency
  result = result.replace(/Jesus[''\u2019]\s*Name/gi, (m) => m.replace(/[''\u2019]/, '\u2019'));
  
  // Ensure exactly one blank line (two newlines) after "Heavenly Father,"
  const beforeHeavenly = result;
  result = result.replace(/(Heavenly\s+Father,)\s*/gi, '$1\n\n');
  if (beforeHeavenly !== result) {
    console.log('[PrayerFormatting] Added line break after Heavenly Father');
  }
  
  // Ensure exactly one blank line (two newlines) before the closing phrase
  const beforeJesus = result;
  result = result.replace(/(\S)\s*((?:In\s+Jesus[''\u2019]?\s*Name)(?:,?\s*Amen)?)/gi, '$1\n\n$2');
  if (beforeJesus !== result) {
    console.log('[PrayerFormatting] Added line break before In Jesus Name');
  } else {
    console.log('[PrayerFormatting] WARNING: No match for In Jesus Name pattern!');
    console.log('[PrayerFormatting] Last 100 chars:', result.substring(result.length - 100));
  }
  
  // NOW collapse 3+ newlines to 2 (after we've added our formatting)
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // Trim trailing spaces on lines
  result = result.replace(/[\t ]+$/gm, '');
  
  console.log('[PrayerFormatting] Full Output:', result);
  console.log('[PrayerFormatting] Output has newlines:', result.includes('\n'));
  console.log('[PrayerFormatting] Number of newlines:', (result.match(/\n/g) || []).length);
  return result;
}
