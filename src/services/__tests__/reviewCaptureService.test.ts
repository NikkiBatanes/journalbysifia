import { classifyReflection, getReflectionReviewText, getReviewCapture } from '../reviewCaptureService';
import { getLocalReflections } from '../../storage/reflectionStorage';
import { getLocalJournalEntries, getLocalJournalSingleton } from '../../storage/journalStorage';
import { getLocalPrayers } from '../../storage/prayerStorage';
import { Logger } from '../../utils/ProductionLogger';
import { getScripturePassage } from '../scriptureReaderService';

jest.mock('../../storage/reflectionStorage', () => ({ getLocalReflections: jest.fn() }));
jest.mock('../../storage/journalStorage', () => ({ getLocalJournalEntries: jest.fn(), getLocalJournalSingleton: jest.fn() }));
jest.mock('../../storage/prayerStorage', () => ({ getLocalPrayers: jest.fn() }));
jest.mock('../scriptureReaderService', () => ({ getScripturePassage: jest.fn() }));

const base = { id: 'reflection', type: 'scripture', source: 'morning_psalm', selected_date: '2026-09-17' };

beforeEach(() => {
  jest.clearAllMocks();
  (getLocalReflections as jest.Mock).mockResolvedValue([]);
  (getLocalJournalEntries as jest.Mock).mockResolvedValue([]);
  (getLocalJournalSingleton as jest.Mock).mockResolvedValue(null);
  (getLocalPrayers as jest.Mock).mockResolvedValue([]);
  (getScripturePassage as jest.Mock).mockResolvedValue({text: '', verses: []});
});

it.each([
  'Righteous · Knows His people · He loves us very much.',
  'Entrust your work to the LORD (Proverbs 16:3)\nHe holds everything together.',
  'Be a faithful friend (Proverbs 17:17)\nLifting them up, encouraging them to...',
  'Righteous · New',
])('classifies legitimate plain text without emitting a JSON parse error', content => {
  const error = jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
  expect(classifyReflection({ ...base, content })).toMatchObject({ text: content, kind: 'morning' });
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});

it('supports JSON objects and arrays', () => {
  expect(getReflectionReviewText('{"foo":"bar"}')).toBe('bar');
  expect(getReflectionReviewText('["Righteous","Faithful"]')).toBe('Righteous · Faithful');
  expect(getReflectionReviewText('{"text":"A direct reflection","blocks":[{"text":"ignored"}]}')).toBe('A direct reflection');
});

it('handles empty, null, undefined, and already-structured content', () => {
  expect(getReflectionReviewText('')).toBe('');
  expect(getReflectionReviewText(null)).toBe('');
  expect(getReflectionReviewText(undefined)).toBe('');
  expect(getReflectionReviewText({ text: 'Structured' })).toBe('Structured');
  expect(getReflectionReviewText(['One', { text: 'Two' }])).toBe('One · Two');
});

it('falls back deterministically for malformed JSON-looking legacy content without crashing', () => {
  const malformed = '{"text":"unfinished"} trailing}';
  expect(() => getReflectionReviewText(malformed)).not.toThrow();
  expect(getReflectionReviewText(malformed)).toBe(malformed);
});

it('preserves Weekly Review capture classification for plain-text Scripture', async () => {
  (getLocalReflections as jest.Mock).mockImplementation(async (type: string) => type === 'scripture' ? [{
    ...base, title: 'Psalm 1', content: 'Righteous · Knows His people', metadata: {psalmRead: true}, created_at: '2026-09-17T01:00:00Z', updated_at: '2026-09-17T01:00:00Z',
  }] : []);
  const capture = await getReviewCapture('2026-09-17', '2026-09-17');
  expect(capture.items).toHaveLength(1);
  expect(capture.items[0]).toMatchObject({ id: 'reflection', kind: 'morning', title: 'Psalm 1', text: 'Righteous · Knows His people', passageRead: true });
  expect(capture.summary.morning).toBe(1);
});

it('retains structured wisdom, responses, and read state for an Evening Proverbs chapter', () => {
  expect(classifyReflection({
    id: 'proverb',
    type: 'scripture',
    source: 'evening_proverbs',
    title: 'Proverbs 4',
    content: 'Guard your heart.',
    selected_date: '2026-09-17',
    metadata: {
      proverbRead: true,
      selectedWisdom: [{id: 'guard', label: 'Guard your heart', verses: 'Proverbs 4:23'}],
      wisdomApplications: {guard: 'I need stronger boundaries around what I consume.'},
      customWisdom: 'Choose wisdom over impulse',
      wisdomApplication: 'Pause and pray before making this decision.',
    },
  })).toMatchObject({
    presentation: 'evening_proverb',
    passageRead: true,
    wisdomItems: [
      {label: 'Guard your heart', verses: 'Proverbs 4:23', response: 'I need stronger boundaries around what I consume.'},
      {label: 'Choose wisdom over impulse'},
    ],
    wisdomResponse: 'Pause and pray before making this decision.',
  });
});

it('retains distinct presentation types for thoughts, guided reflections, Bible Study, and session notes', () => {
  expect(classifyReflection({
    id: 'thought', type: 'free', source: 'freeform', title: 'A thought', content: 'What I noticed', selected_date: '2026-09-17', metadata: {journalClassification: 'thoughts'},
  })).toMatchObject({kind: 'reflection', presentation: 'heart_journal', subtitle: 'Thoughts'});
  expect(classifyReflection({
    id: 'guided', type: 'guided', source: 'guided', title: 'Where is God inviting trust?', selected_date: '2026-09-17',
    content: JSON.stringify({format: 'guided_reflection_v1', pathId: 'trust', pathTitle: 'Trust', currentStepId: 'notice', completed: true, answers: [{stepId: 'notice', text: 'Release the outcome.', notes: []}]}),
  })).toMatchObject({kind: 'reflection', presentation: 'guided_reflection', title: 'Where is God inviting trust?', detail: 'Trust', text: 'Release the outcome.'});
  expect(classifyReflection({
    id: 'prompt', type: 'guided', source: 'guided_prompt', title: 'Where can you receive rest?', content: 'I can stop measuring the day by output.', selected_date: '2026-09-17',
  })).toMatchObject({kind: 'reflection', presentation: 'guided_reflection', subtitle: 'Guided prompt'});
  expect(classifyReflection({
    id: 'legacy-prompt', type: 'guided', title: 'What are you carrying?', content: 'A deadline I cannot control.', selected_date: '2026-09-17',
  })).toMatchObject({kind: 'reflection', presentation: 'guided_reflection', subtitle: 'Guided prompt'});
  expect(classifyReflection({
    id: 'chosen-question', type: 'guided', source: 'guided', title: 'Where have I noticed God at work?',
    content: 'In the clarity that came after I stopped forcing an answer.', selected_date: '2026-09-17',
    metadata: {prompt: 'Where have I noticed God at work?', questionTopic: 'With God'},
  })).toMatchObject({
    kind: 'reflection', presentation: 'guided_reflection', subtitle: 'Guided reflection',
    lifeArea: 'With God', text: 'In the clarity that came after I stopped forcing an answer.',
  });
  expect(classifyReflection({
    id: 'devotional', type: 'devotional', source: 'devotional', title: 'Remain in Me', content: 'Fruitfulness grows from staying close to Jesus.', selected_date: '2026-09-17', metadata: {devotional_title: 'Abide', day_title: 'Remain'},
  })).toMatchObject({kind: 'reflection', presentation: 'devotional_reflection', subtitle: 'Devotional reflection', detail: 'Abide · Remain'});
  expect(classifyReflection({
    id: 'study', type: 'scripture', source: 'bible_study', title: 'James 1:2–8', selected_date: '2026-09-17', metadata: {passage: {translation: 'NASB'}},
    content: JSON.stringify({format: 'bible_study_v1', highlights: [], observation: {text: 'God welcomes my request for wisdom.'}, understanding: {text: ''}, response: {text: ''}, prayer: {text: '', saveToPrayerJournal: false}}),
  })).toMatchObject({kind: 'scripture', presentation: 'bible_study', detail: 'NASB', text: 'God welcomes my request for wisdom.'});
  expect(classifyReflection({
    id: 'meeting', type: 'sermon', source: 'sermon_notes', title: 'Launch planning', selected_date: '2026-09-17',
    content: JSON.stringify({blocks: [{kind: 'key', text: 'Choose the next faithful priority.'}]}),
    metadata: {sessionNoteType: 'meeting', sessionNoteDetails: {meeting: {person: 'Product team', event: 'Weekly planning'}}},
  })).toMatchObject({kind: 'sermon', presentation: 'session_note', subtitle: 'Meeting Notes', detail: 'Weekly planning · Product team', text: 'Choose the next faithful priority.'});
});

it('preserves structured Heart Journal blocks for rich Weekly Review previews', () => {
  const journalBlocks = [
    {id: 'photo', kind: 'photo' as const, text: 'A meaningful afternoon', uri: 'file:///journal/photo.jpg'},
    {id: 'table', kind: 'table' as const, text: '', tableRows: [['Prayer', 'Answer'], ['Peace', 'Waiting']]},
  ];

  expect(classifyReflection({
    id: 'rich-journal',
    type: 'free',
    source: 'freeform',
    title: 'What I want to remember',
    content: 'A meaningful afternoon',
    selected_date: '2026-09-17',
    metadata: {journalClassification: 'thoughts', journalBlocks},
  })).toMatchObject({
    kind: 'reflection',
    presentation: 'heart_journal',
    journalBlocks,
  });
});

it('reads modern Gratitude lists and Today Win payloads without flattening them into generic Journal cards', async () => {
  (getLocalJournalSingleton as jest.Mock).mockImplementation(async (type: string) => {
    if (type === 'gratitude') {
      return {id: 'gratitude', content_type: type, selected_date: '2026-09-17', content: JSON.stringify({items: [{id: '1', text: 'A quiet morning'}, {id: '2', text: 'Timely help'}]})};
    }
    if (type === 'today_win') {
      return {id: 'win', content_type: type, selected_date: '2026-09-17', content: JSON.stringify({winType: 'faithfulness', winTypeName: 'Faithfulness', quietWin: 'I sent the proposal even though I felt uncertain.'})};
    }
    if (type === 'todays_focus') {
      return {id: 'focus', content_type: type, selected_date: '2026-09-17', content: JSON.stringify({
        focus: 'Be present',
        focusIcon: 'hands-pray',
        focusIconType: 'material',
        personalText: 'Listen before responding.',
        priorities: [
          {text: 'Listen well', completed: true},
          {text: 'Call Mom', completed: true},
          {text: 'Rest', completed: false},
        ],
      })};
    }
    if (type === 'looking_forward') {
      return {id: 'looking-forward', content_type: type, selected_date: '2026-09-17', content: JSON.stringify({entry: {text: 'A quiet dinner together'}, emotionName: 'Hopeful', emotionIcon: 'heart'})};
    }
    if (type === 'morning_check_in') {
      return {id: 'check-in', content_type: type, selected_date: '2026-09-17', content: JSON.stringify({feeling: 'Hopeful', feelingIcon: 'sunny-outline', feelingIconType: 'ionicons', underneathIt: 'I am trusting God with the outcome.', scripture: {reference: 'Isaiah 41:10'}})};
    }
    return null;
  });
  (getLocalJournalEntries as jest.Mock).mockImplementation(async (type: string) => type === 'todo' ? [
    {id: 'done-todo', content_type: 'todo', selected_date: '2026-09-17', content: JSON.stringify({text: 'Send the proposal', completed: true, priority: true}), completed: true, priority: 'high'},
    {id: 'pending-todo', content_type: 'todo', selected_date: '2026-09-17', content: JSON.stringify({text: 'Review the checklist', completed: false}), completed: false},
  ] : []);
  (getScripturePassage as jest.Mock).mockResolvedValue({text: 'Do not fear, for I am with you.', verses: []});
  const capture = await getReviewCapture('2026-09-17', '2026-09-17');
  expect(capture.items.find(item => item.id === 'gratitude')).toMatchObject({
    kind: 'gratitude', presentation: 'gratitude_list', lines: ['A quiet morning', 'Timely help'],
  });
  expect(capture.items.find(item => item.id === 'win')).toMatchObject({
    kind: 'win', presentation: 'today_win', detail: 'Faithfulness', text: 'I sent the proposal even though I felt uncertain.',
  });
  expect(capture.items.find(item => item.id === 'focus')).toMatchObject({
    kind: 'journal', presentation: 'focus', title: 'Be present', text: 'Listen before responding.', focusIcon: 'hands-pray', focusIconType: 'material', completedPriorityCount: 2,
    focusPriorities: [
      {text: 'Listen well', completed: true},
      {text: 'Call Mom', completed: true},
      {text: 'Rest', completed: false},
    ],
  });
  expect(capture.items.find(item => item.id === 'looking-forward')).toMatchObject({
    kind: 'journal', presentation: 'looking_forward', title: 'A quiet dinner together', detail: 'Hopeful', feelingIcon: 'heart', feelingIconType: 'material',
  });
  expect(capture.items.find(item => item.id === 'check-in')).toMatchObject({
    kind: 'morning', presentation: 'morning_check_in', title: 'Hopeful', text: 'I am trusting God with the outcome.', detail: 'Isaiah 41:10', scriptureText: 'Do not fear, for I am with you.', feelingIcon: 'sunny-outline', feelingIconType: 'ionicons',
  });
  expect(getScripturePassage).toHaveBeenCalledWith('Isaiah 41:10', 'NASB');
  expect(capture.items.find(item => item.id === 'done-todo')).toMatchObject({kind: 'journal', presentation: 'todo', completed: true, priority: true});
  expect(capture.items.find(item => item.id === 'pending-todo')).toMatchObject({kind: 'journal', presentation: 'todo', completed: false});
});
