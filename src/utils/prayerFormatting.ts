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
export function normalizePrayerText(
  raw: string,
  options?: {
    // Number of BLANK lines BEFORE the closing phrase ("In Jesus' Name, Amen").
    // 1 means two newlines (blank gap). 0 means a single newline (no blank gap).
    blankLinesBeforeClosing?: 0 | 1;
    // Number of BLANK lines AFTER the opening ("Heavenly Father,"). Default 1.
    blankLinesAfterOpening?: 0 | 1;
  }
): string {
  if (!raw) { return raw; }

  const beforeClosingBlankLines = options?.blankLinesBeforeClosing ?? 1; // default: 1 blank line
  const afterOpeningBlankLines = options?.blankLinesAfterOpening ?? 1;   // default: 1 blank line

  // Desired delimiters
  const beforeClosingDelim = '\n'.repeat(beforeClosingBlankLines + 1);
  const afterOpeningDelim = '\n'.repeat(afterOpeningBlankLines + 1);

  return raw
    // Remove markdown bold markers
    .replace(/\*\*/g, '')
    // Convert CRLF to LF
    .replace(/\r\n/g, '\n')
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Remove any spaces/tabs at line starts
    .replace(/^[\t ]+/gm, '')
    // Normalize apostrophes to curly for consistency
    .replace(/Jesus[''\u2019]\s*Name/gi, (m) => m.replace(/[''\u2019]/, '\u2019'))
    // Ensure configured blank lines after "Heavenly Father,"
    .replace(/(Heavenly\s+Father,)\s*/gi, `$1${afterOpeningDelim}`)
    // Ensure configured blank lines before the closing phrase
    // Case A: No whitespace or space-only before phrase (e.g., "You.In Jesus'" or "You. In Jesus'")
    .replace(/(\S)\s*((?:In\s+Jesus[''\u2019]?\s*Name)(?:,?\s*Amen)?)/gi, `$1${beforeClosingDelim}$2`)
    // Case B: One or more newlines before phrase (e.g., "You.\nIn Jesus'" or "You.\n\nIn Jesus'")
    // Replace any sequence of newlines with the desired delimiter
    .replace(/\n+\s*((?:In\s+Jesus[''\u2019]?\s*Name)(?:,?\s*Amen)?)/gi, `${beforeClosingDelim}$1`)
    // Trim trailing spaces on lines
    .replace(/[\t ]+$/gm, '');
}
