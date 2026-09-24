import AsyncStorage from '@react-native-async-storage/async-storage';

import type {SessionNoteType} from '../../types/sessionNotes';
import {
  REVIEW_QA_PREVIOUS_WEEK_DATES,
  REVIEW_QA_WEEKLY_DATES,
} from './reviewQAClock';
import {REVIEW_QA_PREFIX, type ReviewQAScenario} from './reviewQAFixtures';
import type {ReviewQASeedManifest} from './reviewQAWeeklyMorningData';

type SessionNoteFixture = {
  id: string;
  title: string;
  selected_date: string;
  content: string;
  type: 'sermon';
  source: 'sermon_notes';
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted: false;
  sync_status: 'local';
  version: 1;
  linked_account_id: null;
  metadata: Record<string, unknown>;
};

const SESSION_TEMPLATES: Record<
  Exclude<SessionNoteType, 'sermon'>,
  {
    titles: readonly string[];
    people: readonly string[];
    event: string;
    topic: string;
    location: string;
    takeaway: string;
  }
> = {
  conference: {
    titles: ['Leading with grace', 'Faithful in the ordinary'],
    people: ['Mara Santos', 'Pastor Eli Ramos'],
    event: 'Flourish Conference',
    topic: 'Leadership and formation',
    location: 'Main auditorium',
    takeaway:
      'Healthy leadership grows from a life that is rooted before it is visible.',
  },
  speaking: {
    titles: ['Tell the clearer story', 'Speak with courage and care'],
    people: ['Nina Reyes', 'David Lim'],
    event: 'Community gathering',
    topic: 'Communication',
    location: 'Fellowship hall',
    takeaway:
      'Clarity serves people when it makes the next faithful step easier to see.',
  },
  meeting: {
    titles: ['Weekly team sync', 'Ministry planning huddle'],
    people: ['Core team', 'Care ministry team'],
    event: 'Team meeting',
    topic: 'Priorities and follow-through',
    location: 'Conference room',
    takeaway:
      'Name the owner, the next step, and the care needed before the next check-in.',
  },
  workshop: {
    titles: ['Listening well', 'Building sustainable rhythms'],
    people: ['Ana Cruz', 'Jon Villanueva'],
    event: 'Formation workshop',
    topic: 'Practical discipleship',
    location: 'Workshop room',
    takeaway:
      'Small rhythms become meaningful when they make room for attention and love.',
  },
  other: {
    titles: ['Mentoring conversation', 'Ideas worth carrying forward'],
    people: ['A trusted friend', 'Small group'],
    event: 'Personal conversation',
    topic: 'Discernment and next steps',
    location: 'Coffee shop',
    takeaway: 'Pay attention to the invitation beneath the immediate decision.',
  },
};

const SERMON_TEMPLATES = [
  {
    title: 'A steady hope',
    speaker: 'Pastor Miguel Santos',
    series: 'Rooted',
    scripture: 'Romans 5:1–5',
    church: 'Grace Community Church',
    takeaway:
      'Hope is formed as God meets us with grace in the middle of endurance.',
  },
  {
    title: 'The way of peace',
    speaker: 'Pastor Leah Cruz',
    series: 'Life Together',
    scripture: 'Colossians 3:12–17',
    church: 'Grace Community Church',
    takeaway:
      'The peace of Christ reshapes both the posture of the heart and the life of the community.',
  },
] as const;

const WEEKDAY_TYPES: Array<Exclude<SessionNoteType, 'sermon'>> = [
  'meeting',
  'workshop',
  'conference',
  'speaking',
  'other',
];

const MONTHLY_SESSION_NOTE_DATES = Array.from(
  {length: 31},
  (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`,
);

const localDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

const shortDate = (value: string): string =>
  localDate(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

const noteCountForDate = (date: string): number => {
  const parsed = localDate(date);
  if (parsed.getDay() === 0) {
    return 1;
  }
  const day = parsed.getDate();
  return day % 4 === 0 || day % 7 === 0 ? 2 : 1;
};

const buildBlocks = (
  id: string,
  takeaway: string,
  ordinal: number,
): Array<Record<string, string>> => [
  {
    id: `${id}:block:1`,
    kind: 'text',
    text: takeaway,
  },
  {
    id: `${id}:block:2`,
    kind: ordinal === 0 ? 'remember' : 'quote',
    text:
      ordinal === 0
        ? 'Return to this idea during the next week and notice what changes.'
        : 'A useful question is often more memorable than a rushed answer.',
  },
];

const buildFixture = (
  scenarioId: ReviewQAScenario,
  date: string,
  ordinal: number,
  dateIndex: number,
): SessionNoteFixture => {
  const namespace =
    scenarioId === 'weekly' ? 'weekly-session-notes' : 'monthly-session-notes';
  const id = `${REVIEW_QA_PREFIX}${namespace}:${date}:${ordinal + 1}`;
  const timestamp = `${date}T${ordinal === 0 ? '09:15' : '15:30'}:00.000Z`;
  const isSunday = localDate(date).getDay() === 0;

  if (isSunday) {
    const template = SERMON_TEMPLATES[dateIndex % SERMON_TEMPLATES.length];
    return {
      id,
      title: `${template.title} · ${shortDate(date)}`,
      selected_date: date,
      content: JSON.stringify({
        format: 'sermon_notes_v1',
        blocks: buildBlocks(id, template.takeaway, ordinal),
      }),
      type: 'sermon',
      source: 'sermon_notes',
      tags: ['sermon'],
      created_at: timestamp,
      updated_at: timestamp,
      deleted: false,
      sync_status: 'local',
      version: 1,
      linked_account_id: null,
      metadata: {
        is_complete: true,
        sessionNoteType: 'sermon',
        main_scripture: template.scripture,
        series: template.series,
        speaker: template.speaker,
        church: template.church,
        notice: template.takeaway,
        carry: 'Practice this truth in one ordinary conversation this week.',
        prayer: 'God, help me live what I heard with humility and trust.',
        prayer_answer: '',
      },
    };
  }

  const sessionNoteType =
    WEEKDAY_TYPES[(dateIndex + ordinal) % WEEKDAY_TYPES.length];
  const template = SESSION_TEMPLATES[sessionNoteType];
  const variant = (dateIndex + ordinal) % template.titles.length;
  return {
    id,
    title: `${template.titles[variant]} · ${shortDate(date)}`,
    selected_date: date,
    content: JSON.stringify({
      format: 'sermon_notes_v1',
      blocks: buildBlocks(id, template.takeaway, ordinal),
    }),
    type: 'sermon',
    source: 'sermon_notes',
    tags: ['sermon'],
    created_at: timestamp,
    updated_at: timestamp,
    deleted: false,
    sync_status: 'local',
    version: 1,
    linked_account_id: null,
    metadata: {
      is_complete: true,
      sessionNoteType,
      sessionNoteDetails: {
        [sessionNoteType]: {
          person: template.people[variant],
          event: template.event,
          topic: template.topic,
          location: template.location,
        },
      },
      notice: template.takeaway,
      carry: 'Write down one next step before the details fade.',
      prayer: 'God, give me wisdom to respond faithfully to what I learned.',
      prayer_answer: '',
    },
  };
};

export const buildReviewQASessionNoteFixtures = (
  scenarioId: ReviewQAScenario,
): SessionNoteFixture[] => {
  const dates =
    scenarioId === 'weekly'
      ? [...REVIEW_QA_PREVIOUS_WEEK_DATES, ...REVIEW_QA_WEEKLY_DATES]
      : MONTHLY_SESSION_NOTE_DATES;

  return dates.flatMap((date, dateIndex) =>
    Array.from({length: noteCountForDate(date)}, (_, ordinal) =>
      buildFixture(scenarioId, date, ordinal, dateIndex),
    ),
  );
};

const addToIndex = async (key: string, id: string): Promise<void> => {
  let ids: string[] = [];
  try {
    ids = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
  } catch {}
  if (!ids.includes(id)) {
    await AsyncStorage.setItem(key, JSON.stringify([...ids, id]));
  }
};

export const seedReviewQASessionNotes = async (
  manifest: ReviewQASeedManifest,
  scenarioId: ReviewQAScenario,
): Promise<number> => {
  const fixtures = buildReviewQASessionNoteFixtures(scenarioId);
  for (const fixture of fixtures) {
    const key = `reflection_local:sermon:${fixture.selected_date}:${fixture.id}`;
    const indexKey = `reflection_local_index:sermon:${fixture.selected_date}`;
    if (!manifest.keys.includes(key)) {
      manifest.keys.push(key);
    }
    await AsyncStorage.setItem(key, JSON.stringify(fixture));
    await addToIndex(indexKey, fixture.id);
  }
  return fixtures.length;
};
