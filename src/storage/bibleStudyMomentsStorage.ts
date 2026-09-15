import { getAllLocalReflectionsByType, LocalReflectionEntry } from './reflectionStorage';
import { BibleStudyContent, getBibleStudySession } from './bibleStudyStorage';
import { safeJsonParse } from '../utils/safeJsonParse';

export const parseSavedBibleStudy = (entry: LocalReflectionEntry): BibleStudyContent | null => {
  const content = safeJsonParse<BibleStudyContent>(entry.content, { fallback: null });
  if (content?.format !== 'bible_study_v1') {return null;}
  // The format marker does not guarantee every section exists in older records.
  // Normalize in memory so one partial study cannot crash the entire Moments list.
  const text = (section: unknown): string => {
    if (typeof section === 'string') {return section;}
    if (section && typeof section === 'object' && 'text' in section && typeof section.text === 'string') {
      return section.text;
    }
    return '';
  };
  return {
    ...content,
    passageRead: content.passageRead === true,
    highlights: Array.isArray(content.highlights) ? content.highlights.filter(highlight =>
      highlight && typeof highlight.text === 'string',
    ) : [],
    observation: {
      ...content.observation,
      text: text(content.observation),
      tags: Array.isArray(content.observation?.tags) ? content.observation.tags : [],
    },
    understanding: { ...content.understanding, text: text(content.understanding) },
    response: { ...content.response, text: text(content.response) },
    prayer: {
      ...content.prayer,
      text: text(content.prayer),
      saveToPrayerJournal: content.prayer?.saveToPrayerJournal === true,
    },
  };
};

// Discover canonical reflections, not flow sessions. Older reflections predate
// completion metadata, so their linked session is consulted only for eligibility.
export const getSavedBibleStudyReflections = async (): Promise<LocalReflectionEntry[]> => {
  const reflections = (await getAllLocalReflectionsByType('scripture'))
    .filter(entry => !entry.deleted && entry.source === 'bible_study' && parseSavedBibleStudy(entry));
  const saved: LocalReflectionEntry[] = [];
  for (const entry of reflections) {
    if (entry.metadata?.bibleStudyCompleted === true) {
      saved.push(entry);
    } else if (entry.metadata?.bibleStudyCompleted === undefined && entry.metadata?.bibleStudySessionId) {
      const session = await getBibleStudySession(entry.metadata.bibleStudySessionId);
      if (session?.completed) {
        saved.push({ ...entry, metadata: { ...entry.metadata, bibleStudyCompleted: true, bibleStudyCompletedAt: session.completed_at } });
      }
    }
  }
  return saved.sort((a, b) =>
    new Date(b.updated_at || b.metadata?.bibleStudyCompletedAt || b.created_at).getTime() -
    new Date(a.updated_at || a.metadata?.bibleStudyCompletedAt || a.created_at).getTime(),
  );
};
