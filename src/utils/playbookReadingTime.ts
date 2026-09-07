import type { Playbook } from '../interfaces/playbook';

// An approximate reading pace, not time spent carrying out the suggested actions.
const WORDS_PER_MINUTE = 220;

export function getPlaybookReadingMinutes(playbook: Partial<Playbook>): number {
  const truth = playbook.truthInLove;
  const beats = truth?.beats;
  const parts: unknown[] = [
    playbook.cover?.title || playbook.title,
    playbook.cover?.subtitle,
    truth?.summary,
    playbook.bibleVerse?.text,
    playbook.bibleVerseReflection,
    playbook.faithfulActionsIntro,
    playbook.prayer,
  ];
  if (Array.isArray(beats) && beats.length) {
    for (const beat of beats) {
      parts.push(beat.primaryTruth, beat.supportingTruth);
      // Collapsed explanations are optional reading, not part of the default route.
      if (beat.enhancement && beat.enhancement.kind !== 'explanation') {
        parts.push(beat.enhancement.text, ...beat.enhancement.items);
      }
    }
  } else {
    parts.push(typeof truth === 'string' ? truth : truth?.text);
  }
  if (truth?.summaryEnhancement && truth.summaryEnhancement.kind !== 'explanation') {
    parts.push(truth.summaryEnhancement.text, ...truth.summaryEnhancement.items);
  }
  for (const action of playbook.actionSteps || []) {
    parts.push(action.title, action.description || action.subTasks?.map(task => task.text).join(' '));
  }
  parts.push(playbook.wordsToSpeak?.length ? playbook.wordsToSpeak.join(' ') : playbook.wordToSpeak);
  const wordCount = parts.filter((part): part is string => typeof part === 'string')
    .join(' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}
