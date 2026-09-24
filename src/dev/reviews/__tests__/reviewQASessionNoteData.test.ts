import {
  buildReviewQASessionNoteFixtures,
  seedReviewQASessionNotes,
} from '../reviewQASessionNoteData';

const mockData = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockData.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockData.set(key, value);
  }),
}));

describe('Review QA Session Notes data', () => {
  beforeEach(() => mockData.clear());

  it('covers both requested September weeks with only one or two notes per day', () => {
    const fixtures = buildReviewQASessionNoteFixtures('weekly');
    const dates = fixtures.reduce<Record<string, typeof fixtures>>(
      (grouped, fixture) => ({
        ...grouped,
        [fixture.selected_date]: [
          ...(grouped[fixture.selected_date] || []),
          fixture,
        ],
      }),
      {},
    );

    expect(fixtures).toHaveLength(18);
    expect(Object.keys(dates)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
    Object.values(dates).forEach(notes => {
      expect(notes.length).toBeGreaterThanOrEqual(1);
      expect(notes.length).toBeLessThanOrEqual(2);
    });
    expect(dates['2026-09-20']).toHaveLength(1);
    expect(dates['2026-09-27']).toHaveLength(1);
    expect(dates['2026-09-20'][0].metadata.sessionNoteType).toBe('sermon');
    expect(dates['2026-09-27'][0].metadata.sessionNoteType).toBe('sermon');
  });

  it('covers every August day and uses only sermons on Sundays', () => {
    const fixtures = buildReviewQASessionNoteFixtures('monthly');
    const grouped = fixtures.reduce<Map<string, typeof fixtures>>(
      (dates, fixture) => {
        dates.set(fixture.selected_date, [
          ...(dates.get(fixture.selected_date) || []),
          fixture,
        ]);
        return dates;
      },
      new Map(),
    );

    expect(fixtures).toHaveLength(40);
    expect(grouped.size).toBe(31);
    for (const [date, notes] of grouped) {
      expect(notes.length).toBeGreaterThanOrEqual(1);
      expect(notes.length).toBeLessThanOrEqual(2);
      const [year, month, day] = date.split('-').map(Number);
      if (new Date(year, month - 1, day, 12).getDay() === 0) {
        expect(notes).toHaveLength(1);
        expect(notes[0].metadata.sessionNoteType).toBe('sermon');
      }
    }
  });

  it('seeds canonical sermon-note records and tracks them for cleanup', async () => {
    const manifest = {keys: [] as string[], restores: []};
    const count = await seedReviewQASessionNotes(manifest, 'weekly');

    expect(count).toBe(buildReviewQASessionNoteFixtures('weekly').length);
    expect(manifest.keys).toHaveLength(count);
    const first = buildReviewQASessionNoteFixtures('weekly')[0];
    const stored = JSON.parse(
      mockData.get(
        `reflection_local:sermon:${first.selected_date}:${first.id}`,
      )!,
    );
    expect(stored).toMatchObject({
      type: 'sermon',
      source: 'sermon_notes',
      metadata: {is_complete: true},
    });
    expect(JSON.parse(stored.content)).toMatchObject({
      format: 'sermon_notes_v1',
      blocks: expect.any(Array),
    });
  });
});
