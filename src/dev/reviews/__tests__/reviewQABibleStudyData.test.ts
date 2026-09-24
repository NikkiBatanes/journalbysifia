import {
  buildReviewQABibleStudyFixtures,
  seedReviewQABibleStudies,
} from '../reviewQABibleStudyData';
import {
  REVIEW_QA_PREVIOUS_WEEK_DATES,
  REVIEW_QA_WEEKLY_DATES,
} from '../reviewQAClock';
import {classifyReflection} from '../../../services/reviewCaptureService';

const mockData = new Map<string, string>();
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({isConnected: false})),
  addEventListener: jest.fn(() => jest.fn()),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockData.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockData.set(key, value);
  }),
}));
jest.mock('../../../services/scriptureReaderService', () => ({
  getScripturePassage: jest.fn(async () => null),
}));

describe('Review QA Bible Study data', () => {
  beforeEach(() => {
    mockData.clear();
    jest.clearAllMocks();
  });

  it('builds complete linked studies for both September QA weeks', () => {
    const fixtures = buildReviewQABibleStudyFixtures('weekly');
    const prior = fixtures.slice(0, 7);
    const current = fixtures.slice(7);

    expect(prior.map(item => item.session.selected_date)).toEqual(
      REVIEW_QA_PREVIOUS_WEEK_DATES,
    );
    expect(current.map(item => item.session.selected_date)).toEqual(
      REVIEW_QA_WEEKLY_DATES,
    );
    expect(fixtures).toHaveLength(14);
    expect(
      fixtures.every(
        ({session, reflection}) =>
          session.completed &&
          session.reflection_ref?.local_id === reflection.id &&
          reflection.source === 'bible_study' &&
          reflection.metadata?.bibleStudyCompleted === true,
      ),
    ).toBe(true);
  });

  it('covers every day of the August Monthly QA period', () => {
    const fixtures = buildReviewQABibleStudyFixtures('monthly');

    expect(fixtures).toHaveLength(31);
    expect(new Set(fixtures.map(item => item.session.selected_date)).size).toBe(
      31,
    );
    expect(fixtures[0].session.selected_date).toBe('2026-08-01');
    expect(fixtures[30].session.selected_date).toBe('2026-08-31');
  });

  it('renders through Review capture as a rich Bible Study card', () => {
    const [{reflection}] = buildReviewQABibleStudyFixtures('weekly');

    expect(classifyReflection(reflection)).toMatchObject({
      id: reflection.id,
      kind: 'scripture',
      presentation: 'bible_study',
      subtitle: 'Bible Study',
      title: 'Psalm 46:1–3',
      detail: 'NASB',
      text: expect.stringContaining('who God is'),
    });
  });

  it('stores sessions, canonical reflections, and reflection indexes additively', async () => {
    const manifest = {keys: [], restores: []};
    mockData.set(
      'reflection_local_index:scripture:2026-09-21',
      JSON.stringify(['existing-scripture']),
    );

    await expect(
      seedReviewQABibleStudies(manifest, 'weekly'),
    ).resolves.toBe(14);

    expect(
      [...mockData.keys()].filter(key =>
        key.startsWith(
          'bible_study_session:dev-review-v2:weekly-bible-studies:',
        ),
      ),
    ).toHaveLength(14);
    expect(
      [...mockData.keys()].filter(key =>
        key.startsWith('reflection_local:scripture:2026-09-'),
      ),
    ).toHaveLength(14);
    expect(
      JSON.parse(
        mockData.get('reflection_local_index:scripture:2026-09-21')!,
      ),
    ).toEqual([
      'existing-scripture',
      'dev-review-v2:weekly-bible-studies:bible-study:2026-09-21:8:reflection',
    ]);
    expect(manifest.keys).toHaveLength(28);
  });
});
