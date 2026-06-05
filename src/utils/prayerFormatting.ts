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
 * - Removes generated section-missing validation lines
 * - Trims trailing spaces on lines
 */
export function normalizePrayerText(raw: string): string {
  if (!raw) { return raw; }

  return raw
    // Remove markdown bold markers
    .replace(/\*\*/g, '')
    // Convert CRLF to LF
    .replace(/\r\n/g, '\n')
    // Remove generated validation artifacts that can be embedded in prayers.
    .replace(/(^|\n)[\t ]*["']?(?:(?:[A-Z][A-Z0-9 _/-]{0,40})[\t ]*:[\t ]*(?:\n[\t ]*)*)?This section is missing\.?(?:\s*Please ensure all required sections are included\.?)?["']?[\t ]*(?=\n|$)/gi, '$1')
    .replace(/(^|\n)[\t ]*["']?[A-Z][A-Z0-9 _/-]{0,40}:[\t ]*["']?[\t ]*(?=\n\s*In\s+Jesus(?:[''\u2019]s?)?\s*Name(?:,?\s*Amen)?)/gi, '$1')
    // Remove generated list markers directly before the closing prayer.
    .replace(/(^|\n)\s*\d+[.)]?\s*\n\s*(?=In\s+Jesus(?:[''\u2019]s?)?\s*Name(?:,?\s*Amen)?)/gi, '$1')
    .replace(/(^|\n)\s*(?:\d+[.)]?|[-*•])\s*(?=In\s+Jesus(?:[''\u2019]s?)?\s*Name(?:,?\s*Amen)?)/gi, '$1')
    .replace(/([.!?])\s+\d+[.)]?\s+(?=In\s+Jesus(?:[''\u2019]s?)?\s*Name(?:,?\s*Amen)?)/gi, '$1 ')
    .replace(/(?:\s*In\s+Jesus(?:[''\u2019]s?)?\s*Name,?\s*Amen\.?){2,}\s*$/i, '\n\nIn Jesus’ Name, Amen')
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Remove any spaces/tabs at line starts
    .replace(/^[\t ]+/gm, '')
    // Normalize apostrophes to curly for consistency
    .replace(/Jesus[''\u2019]\s*Name/gi, (m) => m.replace(/[''\u2019]/, '\u2019'))
    // Ensure exactly one blank line (two newlines) after "Heavenly Father,"
    .replace(/(Heavenly\s+Father,)\s*/gi, '$1\n\n')
    // Ensure exactly one blank line (two newlines) before the closing phrase
    // Case A: No newline before phrase (e.g., "You.In Jesus'")
    .replace(/(\S)\s*((?:In\s+Jesus(?:[''\u2019]s?)?\s*Name)(?:,?\s*Amen)?)/gi, '$1\n\n$2')
    // Case B: Exactly one newline before phrase (e.g., "You.\nIn Jesus'")
    .replace(/\n(?!\n)\s*((?:In\s+Jesus(?:[''\u2019]s?)?\s*Name)(?:,?\s*Amen)?)/gi, '\n\n$1')
    // Normalize closing phrase variants such as "Jesus's Name".
    .replace(/Jesus(?:[''\u2019]s?)?\s*Name/gi, 'Jesus’ Name')
    // Trim trailing spaces on lines
    .replace(/[\t ]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(?:\s*In\s+Jesus(?:[''\u2019]s?)?\s*Name,?\s*Amen\.?){2,}\s*$/i, '\n\nIn Jesus’ Name, Amen');
}
