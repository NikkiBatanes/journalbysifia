/**
 * Playbook completeness guard.
 *
 * The backend's `generate-guided-playbook` function already retries on missing
 * content (prayer, words_to_speak, completion, closing), but if anything still
 * slips through (network truncation, parser race, model regression, etc.) we
 * must refuse to persist the partial playbook — otherwise the walkthrough
 * renders blank Prayer / Word-to-Speak / Completion screens.
 *
 * This utility inspects a generation response and returns the names of any
 * required fields that are empty or too short to render meaningfully.
 */

export interface PlaybookGenerationResult {
  title?: unknown;
  actionSteps?: unknown;
  prayer?: unknown;
  wordToSpeak?: unknown;
  wordsToSpeak?: unknown;
  directChallenge?: unknown;
  bibleVerse?: unknown;
  truthInLove?: unknown;
}

const MIN_PRAYER_CHARS = 50;
const MIN_WORDS_COUNT = 4;
const MIN_WORDS_FALLBACK_CHARS = 10;
const MIN_COMPLETION_AFTER_HEADER = 10;
const MIN_TITLE_CHARS = 3;
const MIN_ACTION_STEPS = 3;

/**
 * Returns the names of fields that are missing or too short to render the
 * walkthrough. Empty array means the playbook is complete enough to save.
 */
export function findIncompletePlaybookFields(result: PlaybookGenerationResult): string[] {
  const incompleteFields: string[] = [];

  const titleStr = String(result.title ?? '').trim();
  if (titleStr.length < MIN_TITLE_CHARS) {
    incompleteFields.push('title');
  }

  if (!Array.isArray(result.actionSteps) || result.actionSteps.length < MIN_ACTION_STEPS) {
    incompleteFields.push('actionSteps');
  }

  const prayerStr = String(result.prayer ?? '').trim();
  if (prayerStr.length < MIN_PRAYER_CHARS) {
    incompleteFields.push('prayer');
  }

  const wordsArr = Array.isArray(result.wordsToSpeak) ? result.wordsToSpeak : [];
  const wordToSpeakStr = String(result.wordToSpeak ?? '').trim();
  if (wordsArr.length < MIN_WORDS_COUNT && wordToSpeakStr.length < MIN_WORDS_FALLBACK_CHARS) {
    incompleteFields.push('wordsToSpeak');
  }

  // v1.4.6 beat-based playbooks do not use the legacy directChallenge points list.
  // The pastoral closing is stored in challenge_cta, so completion is not required.
  const isBeatBased =
    result.truthInLove && typeof result.truthInLove === 'object' &&
    Array.isArray((result.truthInLove as { beats?: unknown }).beats) &&
    (result.truthInLove as { beats?: any[] }).beats!.length > 0;

  if (!isBeatBased) {
    const dc = result.directChallenge;
    const dcText = typeof dc === 'string'
      ? dc
      : (dc && typeof dc === 'object' ? String((dc as { text?: unknown }).text ?? '') : '');
    // The backend serializes completion as "Before you close:\n{question}\n\n{lines}".
    // A header-only string ("Before you close:" with nothing after) means completion is empty.
    const dcAfterHeader = dcText.replace(/^before you close:\s*/i, '').trim();
    if (dcAfterHeader.length < MIN_COMPLETION_AFTER_HEADER) {
      incompleteFields.push('completion');
    }
  }

  return incompleteFields;
}

/**
 * Throws a retryable error if the result is missing required content.
 * Use right before persisting a generated playbook.
 */
export function assertPlaybookComplete(result: PlaybookGenerationResult): void {
  const incompleteFields = findIncompletePlaybookFields(result);
  if (incompleteFields.length === 0) {
    return;
  }
  const err = new Error('We received an incomplete playbook. Please try generating again.') as Error & {
    retryable: boolean;
    incompleteFields: string[];
  };
  err.retryable = true;
  err.incompleteFields = incompleteFields;
  throw err;
}
