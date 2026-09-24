import AsyncStorage from '@react-native-async-storage/async-storage';

import {GOSPEL_SHARE_EVENTS_KEY} from '../../storage/gospelStorage';
import {REVIEW_QA_PREFIX} from './reviewQAFixtures';
import {seedWeeklyEveningFlow} from './reviewQAWeeklyEveningData';
import {seedWeeklyGuidedReflections} from './reviewQAWeeklyGuidedReflectionData';
import {seedWeeklyHeartJournal} from './reviewQAWeeklyHeartJournalData';
import {
  seedWeeklyMorningFlow,
  type ReviewQASeedManifest,
  type ReviewQASeedScope,
} from './reviewQAWeeklyMorningData';
import {seedWeeklyPrayers} from './reviewQAWeeklyPrayerData';
import {seedWeeklyScriptureNotes} from './reviewQAWeeklyScriptureNoteData';

export const MONTHLY_QA_PERIOD = {
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
} as const;

export const MONTHLY_QA_WEEKLY_PERIODS = [
  {periodStart: '2026-07-27', periodEnd: '2026-08-02'},
  {periodStart: '2026-08-03', periodEnd: '2026-08-09'},
  {periodStart: '2026-08-10', periodEnd: '2026-08-16'},
  {periodStart: '2026-08-17', periodEnd: '2026-08-23'},
  {periodStart: '2026-08-24', periodEnd: '2026-08-30'},
] as const;

export const MONTHLY_QA_RICH_MOMENT_DATES = [
  '2026-08-24',
  '2026-08-25',
  '2026-08-26',
  '2026-08-27',
  '2026-08-28',
  '2026-08-29',
  '2026-08-30',
] as const;

const MONTHLY_RICH_SCOPE: ReviewQASeedScope = {
  dates: MONTHLY_QA_RICH_MOMENT_DATES,
  namespace: 'monthly-rich',
  referenceDate: new Date(2026, 7, 30, 12),
};

export const MONTHLY_QA_DAILY_DATES = Array.from(
  {length: 31},
  (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`,
);

const MONTHLY_QA_DAILY_SCOPES: ReviewQASeedScope[] = Array.from(
  {length: 5},
  (_, index) => ({
    dates: MONTHLY_QA_DAILY_DATES.slice(index * 7, index * 7 + 7),
    namespace: `monthly-daily-${index + 1}`,
  }),
);

const MORNING_DATES = MONTHLY_QA_DAILY_DATES;
const EVENING_DATES = MONTHLY_QA_DAILY_DATES;

const PRAYER_DATES = [
  '2026-08-01',
  '2026-08-02',
  '2026-08-03',
  '2026-08-04',
  '2026-08-05',
  '2026-08-06',
  '2026-08-07',
  '2026-08-08',
  '2026-08-09',
  '2026-08-10',
  '2026-08-11',
  '2026-08-12',
  '2026-08-13',
  '2026-08-15',
] as const;

const JOURNAL_DATES = [
  '2026-08-01',
  '2026-08-03',
  '2026-08-05',
  '2026-08-07',
  '2026-08-09',
  '2026-08-11',
  '2026-08-13',
  '2026-08-15',
  '2026-08-17',
  '2026-08-19',
  '2026-08-21',
] as const;

const JOURNAL_COPY = [
  'I began the month wanting to notice grace before urgency.',
  'A quiet conversation helped me name what I had been carrying.',
  'God provided clarity one faithful step at a time.',
  'Rest felt less like stopping and more like trusting.',
  'I saw growth in the way I responded instead of reacting.',
  'A hard decision became clearer after prayer and wise counsel.',
  'I want to remember the ordinary kindness that held this week together.',
  'The middle of the month invited me to simplify.',
  'I noticed how gratitude changed the atmosphere at home.',
  'An unfinished prayer was still worth bringing to God.',
  'I am ending this stretch more open-handed than I began it.',
] as const;

const REMEMBERED_JOURNAL_INDEXES = [0, 4, 7] as const;

export const MONTHLY_QA_TESTIMONY = {
  id: `${REVIEW_QA_PREFIX}monthly:testimony:1`,
  selectedDate: '2026-08-18',
  writtenAt: '2026-08-18T11:42:00.000Z',
  title: 'My testimony',
  content:
    'Jesus met me when I was tired of trying to hold everything together on my own. In His grace, I found forgiveness, a new beginning, and a steady hope that did not depend on my circumstances. I am still learning to trust Him one faithful step at a time, but I know my life is no longer mine alone. He has been patient, present, and faithful through every season.',
} as const;

const rememberReplacement = async (
  manifest: ReviewQASeedManifest,
  key: string,
): Promise<void> => {
  if (!manifest.restores.some(restore => restore.key === key)) {
    manifest.restores.push({key, value: await AsyncStorage.getItem(key)});
  }
  if (!manifest.keys.includes(key)) {
    manifest.keys.push(key);
  }
};

const addToIndex = async (key: string, id: string): Promise<void> => {
  let values: string[] = [];
  try {
    values = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
  } catch {}
  if (!values.includes(id)) {
    await AsyncStorage.setItem(key, JSON.stringify([...values, id]));
  }
};

const putNamespacedRecord = async (
  manifest: ReviewQASeedManifest,
  key: string,
  indexKey: string,
  id: string,
  value: Record<string, unknown>,
): Promise<void> => {
  if (!manifest.keys.includes(key)) {
    manifest.keys.push(key);
  }
  await AsyncStorage.setItem(key, JSON.stringify(value));
  await addToIndex(indexKey, id);
};

const seedRoutines = async (manifest: ReviewQASeedManifest): Promise<void> => {
  for (const [routine, dates] of [
    ['morning', MORNING_DATES],
    ['evening', EVENING_DATES],
  ] as const) {
    for (const date of dates) {
      const key = `routine_state:${routine}:${date}`;
      await rememberReplacement(manifest, key);
      await AsyncStorage.setItem(
        key,
        JSON.stringify({
          id: `${REVIEW_QA_PREFIX}monthly:${routine}-routine:${date}`,
          routine,
          selected_date: date,
          completed: true,
          completed_steps:
            routine === 'morning'
              ? ['emotion', 'underneath', 'psalm', 'carry', 'todays_focus']
              : ['gratitude', 'win', 'proverbs', 'wisdom', 'looking_forward'],
          started_at: `${date}T06:30:00.000Z`,
          completed_at: `${date}T07:00:00.000Z`,
          content_refs: {},
        }),
      );
    }
  }
};

const journalId = (index: number, date: string) =>
  `${REVIEW_QA_PREFIX}monthly:journal:${date}:${index + 1}`;

const seedJournalEntries = async (
  manifest: ReviewQASeedManifest,
): Promise<void> => {
  for (const [index, date] of JOURNAL_DATES.entries()) {
    const id = journalId(index, date);
    await putNamespacedRecord(
      manifest,
      `reflection_local:free:${date}:${id}`,
      `reflection_local_index:free:${date}`,
      id,
      {
        id,
        server_id: null,
        title: `August reflection ${index + 1}`,
        content: JOURNAL_COPY[index],
        type: 'free',
        source: 'freeform',
        selected_date: date,
        tags: ['monthly-review-qa'],
        metadata: {journalClassification: 'reflection'},
        created_at: `${date}T12:00:00.000Z`,
        updated_at: `${date}T12:10:00.000Z`,
        version: 1,
        sync_status: 'local',
        deleted: false,
      },
    );
  }
};

const seedTestimony = async (
  manifest: ReviewQASeedManifest,
): Promise<void> => {
  const testimony = MONTHLY_QA_TESTIMONY;
  await putNamespacedRecord(
    manifest,
    `reflection_local:gospel_anniversary:${testimony.selectedDate}:${testimony.id}`,
    `reflection_local_index:gospel_anniversary:${testimony.selectedDate}`,
    testimony.id,
    {
      id: testimony.id,
      server_id: null,
      title: testimony.title,
      content: testimony.content,
      type: 'gospel_anniversary',
      source: 'for_me_day',
      selected_date: testimony.selectedDate,
      tags: ['monthly-review-qa'],
      metadata: {
        journalClassification: 'milestone',
        forMeDayEntry: 'testimony',
        testimonyWrittenAt: testimony.writtenAt,
        spiritualBirthday: '2014-05-18',
      },
      created_at: testimony.writtenAt,
      updated_at: testimony.writtenAt,
      version: 1,
      sync_status: 'local',
      deleted: false,
    },
  );
};

const seedPrayers = async (manifest: ReviewQASeedManifest): Promise<void> => {
  for (const [index, date] of PRAYER_DATES.entries()) {
    const id = `${REVIEW_QA_PREFIX}monthly:prayer:${date}:${index + 1}`;
    const answered = index === 3 || index === 10;
    const answerDate = index === 3 ? '2026-08-12' : '2026-08-24';
    await putNamespacedRecord(
      manifest,
      `prayer_local:${date}:${id}`,
      `prayer_local_index:${date}`,
      id,
      {
        id,
        server_id: null,
        title: answered
          ? 'A prayer God answered'
          : `August prayer ${index + 1}`,
        content: answered
          ? 'Thank You for making a way where I could not see one.'
          : 'Help me stay present, faithful, and open to Your leading.',
        prayer_type: 'journal',
        journal_category: 'supplication',
        selected_date: date,
        status: answered ? 'answered' : 'pending',
        answered_date: answered ? answerDate : undefined,
        metadata: answered
          ? {
              track_answered: true,
              is_active: false,
              tracking_status: 'answered',
              answer_history: [
                {
                  id: `answer-${index + 1}`,
                  date: answerDate,
                  note: 'God opened the right door.',
                },
              ],
            }
          : {
              track_answered: false,
              is_active: false,
              tracking_status: 'saved',
            },
        created_at: `${date}T08:00:00.000Z`,
        updated_at: answered
          ? `${answerDate}T08:30:00.000Z`
          : `${date}T08:10:00.000Z`,
        version: 1,
        sync_status: 'local',
        deleted: false,
      },
    );
  }
};

const seedWeeklyMemories = async (
  manifest: ReviewQASeedManifest,
): Promise<void> => {
  const memoryGroups = [
    REMEMBERED_JOURNAL_INDEXES.slice(0, 1),
    REMEMBERED_JOURNAL_INDEXES.slice(1, 2),
    REMEMBERED_JOURNAL_INDEXES.slice(2),
    [],
    [],
  ];
  const weeklyReviewAnswers = [
    {
      week_feelings: 'Hopeful|Tired|Peaceful',
      week_check_in_mind: 'okay',
      week_check_in_body: 'okay',
      week_check_in_relationships: 'well',
      week_check_in_work: 'okay',
      week_check_in_finances: 'okay',
      week_check_in_responsibilities: 'well',
      week_check_in_rest: 'struggling',
      week_check_in_with_god: 'well',
    },
    {
      week_feelings: 'Hopeful|Overwhelmed|Growing',
      week_check_in_mind: 'struggling',
      week_check_in_body: 'okay',
      week_check_in_relationships: 'well',
      week_check_in_work: 'struggling',
      week_check_in_finances: 'okay',
      week_check_in_responsibilities: 'okay',
      week_check_in_rest: 'struggling',
      week_check_in_with_god: 'well',
    },
    {
      week_feelings: 'Peaceful|Grateful|Tired',
      week_check_in_mind: 'well',
      week_check_in_body: 'struggling',
      week_check_in_relationships: 'well',
      week_check_in_work: 'okay',
      week_check_in_finances: 'well',
      week_check_in_responsibilities: 'okay',
      week_check_in_rest: 'okay',
      week_check_in_with_god: 'well',
    },
    {
      week_feelings: 'Hopeful|Faithful|Overwhelmed',
      week_check_in_mind: 'okay',
      week_check_in_body: 'well',
      week_check_in_relationships: 'okay',
      week_check_in_work: 'well',
      week_check_in_finances: 'okay',
      week_check_in_responsibilities: 'well',
      week_check_in_rest: 'okay',
      week_check_in_with_god: 'well',
    },
    {
      week_feelings: 'Peaceful|Grateful|Hopeful',
      week_check_in_mind: 'well',
      week_check_in_body: 'well',
      week_check_in_relationships: 'well',
      week_check_in_work: 'well',
      week_check_in_finances: 'okay',
      week_check_in_responsibilities: 'okay',
      week_check_in_rest: 'well',
      week_check_in_with_god: 'well',
    },
  ];
  for (const [index, period] of MONTHLY_QA_WEEKLY_PERIODS.entries()) {
    const id = `${REVIEW_QA_PREFIX}monthly:weekly-review:${index + 1}`;
    const memorableItems = memoryGroups[index].map(journalIndex => ({
      kind: 'reflection' as const,
      id: journalId(journalIndex, JOURNAL_DATES[journalIndex]),
      selectedDate: JOURNAL_DATES[journalIndex],
    }));
    await putNamespacedRecord(
      manifest,
      `review_local:weekly:${id}`,
      'review_local_index:weekly',
      id,
      {
        id,
        type: 'weekly',
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        status: 'completed',
        memorableItems,
        answers: weeklyReviewAnswers[index],
        createdAt: `${period.periodEnd}T20:00:00.000Z`,
        updatedAt: `${period.periodEnd}T20:30:00.000Z`,
        completedAt: `${period.periodEnd}T20:30:00.000Z`,
      },
    );
  }
};

const seedGospelShare = async (
  manifest: ReviewQASeedManifest,
): Promise<void> => {
  await rememberReplacement(manifest, GOSPEL_SHARE_EVENTS_KEY);
  let events: unknown[] = [];
  try {
    const parsed = JSON.parse(
      (await AsyncStorage.getItem(GOSPEL_SHARE_EVENTS_KEY)) || '[]',
    );
    if (Array.isArray(parsed)) {
      events = parsed;
    }
  } catch {}
  await AsyncStorage.setItem(
    GOSPEL_SHARE_EVENTS_KEY,
    JSON.stringify([
      {
        id: `${REVIEW_QA_PREFIX}monthly:gospel-share:1`,
        sharedAt: '2026-08-20T10:00:00.000Z',
        method: 'in_person',
      },
      ...events,
    ]),
  );
};

export const seedMonthlyReviewData = async (
  manifest: ReviewQASeedManifest,
): Promise<void> => {
  await seedRoutines(manifest);
  await seedJournalEntries(manifest);
  await seedTestimony(manifest);
  await seedPrayers(manifest);
  for (const scope of MONTHLY_QA_DAILY_SCOPES) {
    await seedWeeklyMorningFlow(manifest, scope);
    await seedWeeklyEveningFlow(manifest, scope);
  }
  await seedWeeklyHeartJournal(manifest, MONTHLY_RICH_SCOPE);
  await seedWeeklyGuidedReflections(manifest, MONTHLY_RICH_SCOPE);
  await seedWeeklyPrayers(manifest, MONTHLY_RICH_SCOPE);
  await seedWeeklyScriptureNotes(manifest, MONTHLY_RICH_SCOPE);
  await seedWeeklyMemories(manifest);
  await seedGospelShare(manifest);
};
