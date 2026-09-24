import AsyncStorage from '@react-native-async-storage/async-storage';

import {REVIEW_QA_PREFIX} from './reviewQAFixtures';
import {
  mapReviewQADate,
  type ReviewQASeedManifest,
  type ReviewQASeedScope,
} from './reviewQAWeeklyMorningData';

type EveningDay = {
  date: string;
  gratitude: string[];
  win: {id: string; name: string; quietWin: string};
  proverb: {
    number: number;
    read: boolean;
    insights: Array<{
      id: string;
      label: string;
      verses: string;
      application: string;
    }>;
  };
  lookingForward: {
    emotionId: string;
    emotionName: string;
    emotionIcon: string;
    text: string;
  };
};

const EVENING_WEEK: EveningDay[] = [
  {
    date: '2026-09-14',
    gratitude: [
      'A clear first step on the project',
      'A thoughtful message from Maya',
      'Enough energy to finish the afternoon well',
      'Dinner already waiting at home',
      'A quiet ten minutes without my phone',
      'The courage to ask one honest question',
      'God meeting me before I had everything figured out',
    ],
    win: {
      id: 'followed-through',
      name: 'I followed through',
      quietWin:
        'I finished the project outline without trying to perfect every sentence.',
    },
    proverb: {
      number: 1,
      read: true,
      insights: [
        {
          id: '1-1',
          label: 'Honor the LORD',
          verses: 'Proverbs 1:7',
          application:
            'Begin tomorrow by asking God for wisdom before opening my task list.',
        },
      ],
    },
    lookingForward: {
      emotionId: 'hopeful',
      emotionName: 'Hopeful',
      emotionIcon: 'heart',
      text: 'A focused morning and an unhurried conversation after work.',
    },
  },
  {
    date: '2026-09-15',
    gratitude: [
      'Help arriving before I asked twice',
      'A simple dinner together',
      'The reminder that not everything belongs to me',
    ],
    win: {
      id: 'asked-for-help',
      name: 'I asked for help',
      quietWin:
        'I named that I was overwhelmed instead of pretending I could carry everything.',
    },
    proverb: {
      number: 2,
      read: true,
      insights: [
        {
          id: '2-2',
          label: 'Walk with integrity',
          verses: 'Proverbs 2:7–9',
          application:
            'Be honest about what I can finish and follow through on what I promise.',
        },
      ],
    },
    lookingForward: {
      emotionId: 'trusting',
      emotionName: 'Trusting',
      emotionIcon: 'shield-check-outline',
      text: 'Clarity about the next decision, even if I do not have the whole plan.',
    },
  },
  {
    date: '2026-09-16',
    gratitude: [
      'Mom laughing on the phone',
      'A hard conversation becoming gentler',
      'Fresh air during the afternoon break',
    ],
    win: {
      id: 'reached-out',
      name: 'I reached out',
      quietWin:
        'I called Mom and listened without trying to rush the conversation.',
    },
    proverb: {
      number: 3,
      read: true,
      insights: [
        {
          id: '3-1',
          label: 'Trust the LORD',
          verses: 'Proverbs 3:5–6',
          application:
            'Take the next faithful step without demanding certainty about the outcome.',
        },
      ],
    },
    lookingForward: {
      emotionId: 'open-handed',
      emotionName: 'Open-handed',
      emotionIcon: 'hand-coin',
      text: 'Making room for God to redirect tomorrow’s plans.',
    },
  },
  {
    date: '2026-09-17',
    gratitude: [
      'Permission to move more slowly',
      'A short restorative nap',
      'Work that could wait until tomorrow',
    ],
    win: {
      id: 'rested-needed',
      name: 'I rested when I needed to',
      quietWin:
        'I stopped before I was completely depleted and let rest be enough.',
    },
    proverb: {
      number: 4,
      read: true,
      insights: [
        {
          id: '4-2',
          label: 'Guard your heart',
          verses: 'Proverbs 4:23',
          application:
            'Protect the first quiet part of tomorrow instead of filling it with notifications.',
        },
      ],
    },
    lookingForward: {
      emotionId: 'calm',
      emotionName: 'Calm',
      emotionIcon: 'weather-sunny',
      text: 'A gentler pace and enough space to notice what matters.',
    },
  },
  {
    date: '2026-09-18',
    gratitude: [
      'The relief of submitting the final notes',
      'A teammate who caught an important detail',
      'Peace that did not depend on finishing everything',
    ],
    win: {
      id: 'finished-hard-work',
      name: 'I finished something hard',
      quietWin:
        'I submitted the final project notes and released the need to keep revising.',
    },
    proverb: {
      number: 5,
      read: false,
      insights: [
        {
          id: '5-3',
          label: 'Remember that the LORD sees your ways',
          verses: 'Proverbs 5:21',
          application:
            'Choose faithfulness in the small private decisions no one else notices.',
        },
      ],
    },
    lookingForward: {
      emotionId: 'thankful',
      emotionName: 'Thankful',
      emotionIcon: 'flower',
      text: 'Entering the weekend without carrying unfinished work into every moment.',
    },
  },
  {
    date: '2026-09-19',
    gratitude: [
      'An unhurried breakfast',
      'Worship music filling the house',
      'Time outside with no agenda',
    ],
    win: {
      id: 'made-space-breathe',
      name: 'I made space to breathe',
      quietWin:
        'I protected Sabbath time instead of turning it into another catch-up day.',
    },
    proverb: {
      number: 6,
      read: true,
      insights: [
        {
          id: '6-1',
          label: 'Learn diligence from the ant',
          verses: 'Proverbs 6:6–11',
          application:
            'Prepare one small thing for Monday, then return to rest.',
        },
      ],
    },
    lookingForward: {
      emotionId: 'prayerful',
      emotionName: 'Prayerful',
      emotionIcon: 'hands-pray',
      text: 'Listening for what God wants me to carry into the new week.',
    },
  },
  {
    date: '2026-09-20',
    gratitude: [
      'A week that held more grace than I first noticed',
      'Clean clothes and breakfast ready for Monday',
      'Hope for a fresh beginning',
    ],
    win: {
      id: 'stayed-faithful',
      name: 'I stayed faithful',
      quietWin: 'I kept returning to God throughout an imperfect week.',
    },
    proverb: {
      number: 7,
      read: true,
      insights: [
        {
          id: '7-2',
          label: 'Keep wisdom close',
          verses: 'Proverbs 7:4–5',
          application:
            'Carry one clear truth into each decision instead of reacting from pressure.',
        },
      ],
    },
    lookingForward: {
      emotionId: 'ready',
      emotionName: 'Ready',
      emotionIcon: 'check-circle-outline',
      text: 'Beginning Monday grounded, prepared, and willing to adjust.',
    },
  },
];

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

const putSingleton = async (
  manifest: ReviewQASeedManifest,
  contentType: string,
  day: EveningDay,
  content: Record<string, unknown>,
  namespace: string,
): Promise<string> => {
  const key = `journal_local_singleton:${contentType}:${day.date}`;
  const id = `${REVIEW_QA_PREFIX}${namespace}:${contentType}:${day.date}`;
  await rememberReplacement(manifest, key);
  await AsyncStorage.setItem(
    key,
    JSON.stringify({
      id,
      server_id: null,
      content_type: contentType,
      selected_date: day.date,
      content: JSON.stringify(content),
      created_at: `${day.date}T20:00:00.000Z`,
      updated_at: `${day.date}T20:15:00.000Z`,
      version: 1,
      sync_status: 'local',
      deleted: false,
    }),
  );
  return id;
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

const putIndexedRecord = async (
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

export const seedWeeklyEveningFlow = async (
  manifest: ReviewQASeedManifest,
  scope: ReviewQASeedScope = {},
): Promise<void> => {
  const namespace = scope.namespace ?? 'weekly';
  const sourceDays = scope.dates
    ? EVENING_WEEK.slice(0, scope.dates.length)
    : EVENING_WEEK;
  for (const sourceDay of sourceDays) {
    const day = {
      ...sourceDay,
      date: mapReviewQADate(sourceDay.date, scope.dates),
    };
    const gratitudeId = `${REVIEW_QA_PREFIX}${namespace}:gratitude:${day.date}`;
    await putIndexedRecord(
      manifest,
      `journal_local:gratitude:${day.date}:${gratitudeId}`,
      `journal_local_index:gratitude:${day.date}`,
      gratitudeId,
      {
        id: gratitudeId,
        server_id: null,
        content_type: 'gratitude',
        selected_date: day.date,
        content: JSON.stringify({items: day.gratitude}),
        metadata: {source: 'evening'},
        created_at: `${day.date}T20:00:00.000Z`,
        updated_at: `${day.date}T20:10:00.000Z`,
        version: 1,
        sync_status: 'local',
        deleted: false,
      },
    );

    const winId = await putSingleton(
      manifest,
      'today_win',
      day,
      {
        winType: day.win.id,
        winTypeName: day.win.name,
        quietWin: day.win.quietWin,
      },
      namespace,
    );

    const proverbId = `${REVIEW_QA_PREFIX}${namespace}:evening-proverb:${day.date}`;
    const selectedWisdom = day.proverb.insights.map(
      ({application: _application, ...insight}) => insight,
    );
    const wisdomApplications = Object.fromEntries(
      day.proverb.insights.map(insight => [insight.id, insight.application]),
    );
    const proverbContent = day.proverb.insights
      .map(
        insight =>
          `${insight.label} (${insight.verses})\n${insight.application}`,
      )
      .join('\n\n');
    await putIndexedRecord(
      manifest,
      `reflection_local:scripture:${day.date}:${proverbId}`,
      `reflection_local_index:scripture:${day.date}`,
      proverbId,
      {
        id: proverbId,
        server_id: null,
        title: `Proverbs ${day.proverb.number}`,
        content: proverbContent,
        type: 'scripture',
        source: 'evening_proverbs',
        selected_date: day.date,
        tags: ['evening', 'proverbs'],
        metadata: {
          source: 'evening_proverbs',
          proverbNumber: day.proverb.number,
          proverbRead: day.proverb.read,
          proverbReference: `Proverbs ${day.proverb.number}`,
          selectedWisdomIds: day.proverb.insights.map(insight => insight.id),
          selectedWisdom,
          customWisdom: '',
          wisdomApplication: '',
          wisdomApplications,
        },
        created_at: `${day.date}T20:20:00.000Z`,
        updated_at: `${day.date}T20:35:00.000Z`,
        version: 1,
        sync_status: 'local',
        deleted: false,
      },
    );

    const lookingForwardId = await putSingleton(
      manifest,
      'looking_forward',
      day,
      {
        entry: {text: day.lookingForward.text},
        emotionId: day.lookingForward.emotionId,
        emotionIcon: day.lookingForward.emotionIcon,
        emotionName: day.lookingForward.emotionName,
        customEmotion: '',
      },
      namespace,
    );

    const routineKey = `routine_state:evening:${day.date}`;
    await rememberReplacement(manifest, routineKey);
    await AsyncStorage.setItem(
      routineKey,
      JSON.stringify({
        id: `${REVIEW_QA_PREFIX}${namespace}:evening-routine:${day.date}`,
        routine: 'evening',
        selected_date: day.date,
        completed: true,
        completed_steps: [
          'gratitude',
          'win',
          'proverbs',
          'wisdom',
          'looking_forward',
        ],
        started_at: `${day.date}T19:55:00.000Z`,
        completed_at: `${day.date}T20:45:00.000Z`,
        content_refs: {
          gratitude: {
            domain: 'journal',
            content_type: 'gratitude',
            local_id: gratitudeId,
          },
          win: {domain: 'journal', content_type: 'today_win', local_id: winId},
          proverbs: {
            domain: 'reflection',
            content_type: 'scripture',
            local_id: proverbId,
          },
          wisdom: {
            domain: 'reflection',
            content_type: 'scripture',
            local_id: proverbId,
          },
          looking_forward: {
            domain: 'journal',
            content_type: 'looking_forward',
            local_id: lookingForwardId,
          },
        },
      }),
    );
  }
};
