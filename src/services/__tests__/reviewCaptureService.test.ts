import { classifyReflection, getReflectionReviewText, getReviewCapture } from '../reviewCaptureService';
import { getLocalReflections } from '../../storage/reflectionStorage';
import { getLocalJournalEntries, getLocalJournalSingleton } from '../../storage/journalStorage';
import { getLocalPrayers } from '../../storage/prayerStorage';
import { Logger } from '../../utils/ProductionLogger';

jest.mock('../../storage/reflectionStorage', () => ({ getLocalReflections: jest.fn() }));
jest.mock('../../storage/journalStorage', () => ({ getLocalJournalEntries: jest.fn(), getLocalJournalSingleton: jest.fn() }));
jest.mock('../../storage/prayerStorage', () => ({ getLocalPrayers: jest.fn() }));

const base = { id: 'reflection', type: 'scripture', source: 'morning_psalm', selected_date: '2026-09-17' };

beforeEach(() => {
  jest.clearAllMocks();
  (getLocalReflections as jest.Mock).mockResolvedValue([]);
  (getLocalJournalEntries as jest.Mock).mockResolvedValue([]);
  (getLocalJournalSingleton as jest.Mock).mockResolvedValue(null);
  (getLocalPrayers as jest.Mock).mockResolvedValue([]);
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
    ...base, title: 'Psalm 1', content: 'Righteous · Knows His people', created_at: '2026-09-17T01:00:00Z', updated_at: '2026-09-17T01:00:00Z',
  }] : []);
  const capture = await getReviewCapture('2026-09-17', '2026-09-17');
  expect(capture.items).toHaveLength(1);
  expect(capture.items[0]).toMatchObject({ id: 'reflection', kind: 'morning', title: 'Psalm 1', text: 'Righteous · Knows His people' });
  expect(capture.summary.morning).toBe(1);
});
