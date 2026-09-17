import { getSavedBibleStudyReflections, parseSavedBibleStudy } from '../bibleStudyMomentsStorage';
import { getAllLocalReflectionsByType, LocalReflectionEntry } from '../reflectionStorage';
import { getBibleStudySession } from '../bibleStudyStorage';

jest.mock('../reflectionStorage', () => ({ getAllLocalReflectionsByType: jest.fn() }));
jest.mock('../bibleStudyStorage', () => ({ getBibleStudySession: jest.fn() }));

const loadReflections = getAllLocalReflectionsByType as jest.Mock;
const loadSession = getBibleStudySession as jest.Mock;
const entry = (id: string, metadata: Record<string, unknown> = {}): LocalReflectionEntry => ({
  id,
  type: 'scripture',
  source: 'bible_study',
  title: 'Psalm 23',
  selected_date: '2026-09-15',
  created_at: '2026-09-15T01:00:00Z',
  updated_at: '2026-09-15T01:00:00Z',
  metadata,
  content: JSON.stringify({ format: 'bible_study_v1', highlights: [], observation: { text: 'My observation' } }),
});

beforeEach(() => { jest.clearAllMocks(); });

it('shows passage read only when explicitly saved, not merely when the study is completed', () => {
  const reflection = entry('read', { bibleStudyCompleted: true });
  expect(parseSavedBibleStudy(reflection)?.passageRead).toBe(false);
  for (const passageRead of [true, false, 'true']) {
    const content = JSON.stringify({ ...JSON.parse(reflection.content), passageRead });
    expect(parseSavedBibleStudy({ ...reflection, content })?.passageRead).toBe(passageRead === true);
  }
});

it('returns the most recently saved study first, including an edited older study', async () => {
  loadReflections.mockResolvedValue([
    { ...entry('older', { bibleStudyCompleted: true }), updated_at: '2026-09-15T01:00:00Z' },
    { ...entry('latest', { bibleStudyCompleted: true }), updated_at: '2026-09-15T03:00:00Z' },
    { ...entry('middle', { bibleStudyCompleted: true }), updated_at: '2026-09-15T02:00:00Z' },
  ]);
  expect((await getSavedBibleStudyReflections()).map(reflection => reflection.id)).toEqual(['latest', 'middle', 'older']);
});

it('normalizes partial saved records without losing existing text or modifying storage', () => {
  const reflection = entry('partial');
  const original = reflection.content;
  const content = parseSavedBibleStudy(reflection)!;
  expect(content.observation.text).toBe('My observation');
  expect(content.understanding.text).toBe('');
  expect(content.response.text).toBe('');
  expect(content.prayer.text).toBe('');
  expect(content.highlights).toEqual([]);
  expect(reflection.content).toBe(original);
});

it('handles null sections, missing highlights, and legacy plain-text sections', () => {
  const reflection = { ...entry('legacy'), content: JSON.stringify({
    format: 'bible_study_v1', observation: null, understanding: 'God is faithful', response: {}, prayer: null,
  }) };
  const content = parseSavedBibleStudy(reflection)!;
  expect(content.observation.text).toBe('');
  expect(content.understanding.text).toBe('God is faithful');
  expect(content.response.text).toBe('');
  expect(content.prayer.text).toBe('');
  expect(content.highlights.map(highlight => highlight.text)).toEqual([]);
});

it('discovers canonical saved reflections without requiring sessions, including two on one date', async () => {
  loadReflections.mockResolvedValue([
    entry('first', { bibleStudyCompleted: true }),
    entry('second', { bibleStudyCompleted: true }),
  ]);
  const saved = await getSavedBibleStudyReflections();
  expect(saved.map(reflection => reflection.id)).toEqual(['first', 'second']);
  expect(loadReflections).toHaveBeenCalledWith('scripture');
  expect(loadSession).not.toHaveBeenCalled();
  expect(parseSavedBibleStudy(saved[0])?.observation.text).toBe('My observation');
});

it('excludes drafts, deleted records, other Scripture sources, and invalid content', async () => {
  loadReflections.mockResolvedValue([
    entry('draft', { bibleStudyCompleted: false }),
    { ...entry('deleted', { bibleStudyCompleted: true }), deleted: true },
    { ...entry('other', { bibleStudyCompleted: true }), source: 'scripture_note' },
    { ...entry('invalid', { bibleStudyCompleted: true }), content: '{}' },
  ]);
  expect(await getSavedBibleStudyReflections()).toEqual([]);
  expect(loadSession).not.toHaveBeenCalled();
});

it('uses linked sessions only for legacy completion eligibility and preserves reflection content', async () => {
  loadReflections.mockResolvedValue([
    entry('saved', { bibleStudySessionId: 'completed-session' }),
    entry('draft', { bibleStudySessionId: 'draft-session' }),
    entry('missing', { bibleStudySessionId: 'missing-session' }),
  ]);
  loadSession.mockImplementation(async id => id === 'completed-session'
    ? { completed: true, completed_at: '2026-09-15T02:00:00Z' }
    : id === 'draft-session' ? { completed: false } : null);
  const saved = await getSavedBibleStudyReflections();
  expect(saved.map(reflection => reflection.id)).toEqual(['saved', 'missing']);
  expect(saved[0].metadata?.bibleStudyCompletedAt).toBe('2026-09-15T02:00:00Z');
  expect(parseSavedBibleStudy(saved[0])?.observation.text).toBe('My observation');
});

it('keeps a valid oldest-format canonical study with no session reference', async () => {
  loadReflections.mockResolvedValue([entry('oldest')]);
  expect((await getSavedBibleStudyReflections()).map(reflection => reflection.id)).toEqual(['oldest']);
  expect(loadSession).not.toHaveBeenCalled();
});
