import { buildMomentTimeline } from '../momentTimelineService';
import type { LocalJournalEntry } from '../../storage/journalStorage';
import type { LocalReflectionEntry } from '../../storage/reflectionStorage';
import type { LocalPrayerEntry } from '../../storage/prayerStorage';

jest.mock('../api/prayerApi', () => ({ PrayerApi: { getAllPrayers: jest.fn() } }));

const date = '2026-09-14';
const journal = (id: string, content_type: LocalJournalEntry['content_type'], content: any, selected_date = date): LocalJournalEntry => ({
  id, content_type, content: JSON.stringify(content), selected_date,
  created_at: '2026-09-17T10:00:00Z', updated_at: '2026-09-17T10:00:00Z',
});
const reflection = (id: string, type: string, source: string, content: any = '', metadata: Record<string, any> = {}, selected_date = date): LocalReflectionEntry => ({
  id, type, source, title: id, content: typeof content === 'string' ? content : JSON.stringify(content), metadata, selected_date,
  created_at: '2026-09-17T10:00:00Z', updated_at: '2026-09-17T10:00:00Z',
});
const prayer = (id: string, extra: Partial<LocalPrayerEntry> = {}): LocalPrayerEntry => ({
  id, content: `Prayer ${id}`, prayer_type: 'journal', selected_date: date,
  created_at: '2026-09-17T10:00:00Z', updated_at: '2026-09-17T10:00:00Z', ...extra,
});
const build = (journalEntries: LocalJournalEntry[] = [], reflections: LocalReflectionEntry[] = [], prayers: LocalPrayerEntry[] = [], bibleStudies: LocalReflectionEntry[] = []) =>
  buildMomentTimeline({ journalEntries, reflections, prayers, bibleStudies });

describe('canonical Moments timeline', () => {
  it('does not create routine Moments from empty canonical shells', () => {
    expect(build([journal('check', 'morning_check_in', { scripture: { reference: 'Psalm 1' } }), journal('gratitude', 'gratitude', { items: ['', ' '] })])).toEqual([]);
  });

  it('creates one Morning group with only the meaningful Check-In presentation', () => {
    const items = build([journal('check', 'morning_check_in', { feeling: 'Peaceful' })]);
    expect(items).toHaveLength(1);
    expect(items[0].preview.sections?.map(section => section.kind)).toEqual(['check_in']);
    expect(items[0].preview.sections?.[0].presentation?.id).toBe('check');
  });

  it('creates one Morning group with separate Check-In and Focus presentations', () => {
    const items = build([
      journal('check', 'morning_check_in', { underneathIt: 'I need rest' }),
      journal('focus', 'todays_focus', { focusCategory: 'faith', personalText: 'Pray first' }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].preview.sections?.map(section => section.kind)).toEqual(['check_in', 'focus']);
  });

  it('groups every meaningful Morning section once and retains canonical IDs', () => {
    const rows = [
      journal('check', 'morning_check_in', { feeling: 'Hopeful' }),
      journal('focus', 'todays_focus', { focusCategory: 'work', personalText: 'Finish proposal', priorities: [{ text: 'Call Ana' }] }),
      journal('todo', 'todo', { text: 'Send email' }),
    ];
    const psalm = reflection('psalm', 'scripture', 'morning_psalm', '', { psalmRead: true });
    const items = build(rows, [psalm]);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe(`morning:${date}`);
    expect(items[0].preview.sections?.map(section => section.kind)).toEqual(['check_in', 'psalm', 'focus', 'priorities']);
    expect(items[0].canonicalIds).toEqual(expect.arrayContaining(['check', 'psalm', 'focus', 'todo']));
  });

  it('retains completed and incomplete priority state in the canonical Morning section', () => {
    const focus = journal('focus', 'todays_focus', { focusCategory: 'work', priorities: [
      { id: 'done', text: 'Completed priority', completed: true },
      { id: 'open', text: 'Incomplete priority', completed: false },
    ] });
    const section = build([focus])[0].preview.sections?.find(item => item.kind === 'priorities');
    expect(section?.canonicalIds).toContain('focus');
    expect(JSON.parse(section?.journalEntries?.[0].content || '{}').priorities).toEqual([
      expect.objectContaining({ id: 'done', completed: true }),
      expect.objectContaining({ id: 'open', completed: false }),
    ]);
  });

  it('keeps Morning, focus, priority, and Todo identity stable across completion toggles', () => {
    const makeRows = (priorityCompleted: boolean, todoCompleted: boolean) => [
      journal('focus-stable', 'todays_focus', { focusCategory: 'work', priorities: [
        { id: 'priority-stable', text: 'Priority', completed: priorityCompleted },
      ] }),
      journal('todo-stable', 'todo', { text: 'Todo', completed: todoCompleted }),
    ];
    const before = build(makeRows(false, false))[0];
    const after = build(makeRows(true, true))[0];

    expect(after.key).toBe(before.key);
    expect(after.canonicalIds).toEqual(before.canonicalIds);
    expect(after.preview.sections?.find(section => section.kind === 'priorities')?.canonicalIds)
      .toEqual(['focus-stable', 'todo-stable']);
    expect(JSON.parse(after.preview.sections?.find(section => section.kind === 'priorities')?.journalEntries?.[0].content || '{}').priorities[0].id)
      .toBe('priority-stable');
  });

  it('does not include empty Psalm or priorities and includes an explicitly read Psalm or meaningful Todo', () => {
    expect(build([], [reflection('empty', 'scripture', 'morning_psalm')])).toEqual([]);
    const items = build([journal('todo', 'todo', { text: 'One task' })], [reflection('read', 'scripture', 'morning_psalm', '', { psalmRead: true })]);
    expect(items[0].preview.sections?.map(section => section.kind)).toEqual(['psalm', 'priorities']);
  });

  it('groups every meaningful Evening section once and retains canonical IDs', () => {
    const rows = [
      journal('thanks', 'gratitude', { items: ['Family'] }),
      journal('win', 'today_win', { winType: 'courage', winTypeName: 'Courage' }),
      journal('ahead', 'looking_forward', { emotionId: 'hopeful', emotionName: 'Hopeful' }),
    ];
    const proverb = reflection('proverb', 'scripture', 'evening_proverbs', '', { proverbRead: true });
    const items = build(rows, [proverb]);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe(`evening:${date}`);
    expect(items[0].preview.sections?.map(section => section.kind)).toEqual(['gratitude', 'win', 'proverbs', 'looking_forward']);
    expect(items[0].canonicalIds).toEqual(expect.arrayContaining(['thanks', 'win', 'proverb', 'ahead']));
  });

  it('omits empty Evening sections and does not create an Evening heading item', () => {
    expect(build([
      journal('thanks', 'gratitude', { items: [] }),
      journal('win', 'today_win', { winType: 'other', quietWin: '' }),
      journal('ahead', 'looking_forward', { emotionId: 'other', customEmotion: '' }),
    ], [reflection('proverb', 'scripture', 'evening_proverbs')])).toEqual([]);
  });

  it('keeps selected_date when records were created or edited later', () => {
    const item = build([journal('check', 'morning_check_in', { feeling: 'Tired' }, '2025-01-03')])[0];
    expect(item.selectedDate).toBe('2025-01-03');
    expect(item.key).toBe('morning:2025-01-03');
  });

  it('preserves two Sermons and two general reflections on the same date', () => {
    const items = build([], [
      reflection('sermon-a', 'sermon', 'sermon_notes', 'A'), reflection('sermon-b', 'sermon', 'sermon_notes', 'B'),
      reflection('reflection-a', 'free', 'freeform', 'A'), reflection('reflection-b', 'free', 'freeform', 'B'),
    ]);
    expect(items.map(item => item.key)).toEqual(expect.arrayContaining([
      'reflection:sermon:sermon-a', 'reflection:sermon:sermon-b',
      'reflection:journal:reflection-a', 'reflection:journal:reflection-b',
    ]));
  });

  it('preserves exact Bible Study identity and navigation', () => {
    const study = reflection('study', 'scripture', 'bible_study', { format: 'bible_study_v1', observation: { text: 'Grace' }, highlights: [] }, { bibleStudyCompleted: true });
    const item = build([], [study], [], [study])[0];
    expect(item.key).toBe('reflection:bible-study:study');
    expect(item.canonicalIds).toEqual(['study']);
    expect(item.navigation?.params).toMatchObject({ reflectionId: 'study', selectedDate: date });
  });

  it('shows standalone Scripture Notes as their own Moments entries', () => {
    const note = reflection('scripture-note', 'scripture', 'scripture_note', 'God created everything');
    const item = build([], [note])[0];
    expect(item).toMatchObject({
      key: 'reflection:scripture-note:scripture-note',
      kind: 'scripture_note',
      canonicalIds: ['scripture-note'],
      navigation: { screen: 'ScriptureNoteEditor', params: { reflectionId: 'scripture-note', selectedDate: date } },
    });
    expect(item.searchText).toContain('scripture note');
  });

  it('preserves distinct prayers and current status without moving historical date', () => {
    const items = build([], [], [prayer('one'), prayer('two', { status: 'answered', answered_date: '2026-09-17' })]);
    expect(items.map(item => item.key)).toEqual(expect.arrayContaining(['prayer:one', 'prayer:two']));
    expect(items.find(item => item.key === 'prayer:two')).toMatchObject({ selectedDate: date, metadata: { answered: true } });
  });

  it('groups CAST display while retaining every underlying prayer ID', () => {
    const cast = (id: string, category: any) => prayer(id, { journal_category: category, metadata: { prayer_style: 'cast', prayer_session_id: 'session' } });
    const item = build([], [], [cast('c', 'confession'), cast('s', 'supplication')])[0];
    expect(item.key).toBe('prayer:cast:session');
    expect(item.canonicalIds).toEqual(expect.arrayContaining(['c', 's']));
  });

  it('search text belongs to the exact normalized item', () => {
    const items = build([], [reflection('a', 'sermon', 'sermon_notes', 'Unique alpha'), reflection('b', 'sermon', 'sermon_notes', 'Different beta')]);
    expect(items.filter(item => item.searchText.includes('unique alpha')).map(item => item.key)).toEqual(['reflection:sermon:a']);
  });

  it('includes the display label for a classified Heart Journal entry in search text', () => {
    const item = build([], [reflection('classified', 'free', 'freeform', 'Private content', {journalClassification: 'brain_dump'})])[0];
    expect(item.searchText).toContain('brain dump');
    expect(item.key).toBe('reflection:journal:classified');
  });

  it('derives the Moments label and search text from sessionNoteType', () => {
    const untitled = (id: string, sessionNoteType: string) => ({
      ...reflection(id, 'sermon', 'sermon_notes', { format: 'sermon_notes_v1', blocks: [] }, { sessionNoteType }),
      title: '',
    });
    const items = build([], [untitled('conf', 'conference'), untitled('meet', 'meeting'), untitled('misc', 'other')]);
    expect(items.find(item => item.key === 'reflection:sermon:conf')).toMatchObject({ kind: 'sermon', preview: { title: 'Conference Notes' } });
    expect(items.find(item => item.key === 'reflection:sermon:meet')).toMatchObject({ kind: 'sermon', preview: { title: 'Meeting Notes' } });
    expect(items.find(item => item.key === 'reflection:sermon:misc')).toMatchObject({ kind: 'sermon', preview: { title: 'Session Notes' } });
    expect(items.find(item => item.key === 'reflection:sermon:conf')?.searchText).toContain('conference');
    // An explicit user title always wins over the document label
    const titled = build([], [reflection('named', 'sermon', 'sermon_notes', '', { sessionNoteType: 'workshop' })])[0];
    expect(titled.preview.title).toBe('named');
    expect(titled.searchText).toContain('workshop notes');
  });

  it('keeps a legacy Sermon Moment labeled Sermon Notes', () => {
    const legacy = { ...reflection('legacy', 'sermon', 'sermon_notes', 'Captured', { is_complete: true }), title: '' };
    const item = build([], [legacy])[0];
    expect(item).toMatchObject({ kind: 'sermon', preview: { title: 'Sermon Notes' } });
    expect(item.searchText).toContain('sermon notes');
    expect(item.navigation).toMatchObject({ screen: 'SermonNotes', params: { reflectionId: 'legacy', selectedDate: date } });
  });
});
