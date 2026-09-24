import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  BibleStudyContent,
  BibleStudyPassage,
  BibleStudySession,
} from '../../storage/bibleStudyStorage';
import type {LocalReflectionEntry} from '../../storage/reflectionStorage';
import {
  REVIEW_QA_PREVIOUS_WEEK_DATES,
  REVIEW_QA_WEEKLY_DATES,
} from './reviewQAClock';
import {REVIEW_QA_PREFIX, type ReviewQAScenario} from './reviewQAFixtures';
import {
  type ReviewQASeedManifest,
} from './reviewQAWeeklyMorningData';

type BibleStudySeed = {
  date: string;
  time: string;
  passage: BibleStudyPassage;
  content: BibleStudyContent;
};

export type ReviewQABibleStudyFixture = {
  session: BibleStudySession;
  reflection: LocalReflectionEntry;
};

const STUDY_WEEK: BibleStudySeed[] = [
  {
    date: '2026-09-14',
    time: '07:45',
    passage: {
      reference: 'Psalm 46:1–3',
      book: 'Psalm',
      chapter: 46,
      verseStart: 1,
      verseEnd: 3,
      translation: 'NASB',
    },
    content: {
      format: 'bible_study_v1',
      passageRead: true,
      highlights: [
        {
          id: 'refuge-highlight',
          verseNumber: '1',
          text: 'God is our refuge and strength, a very ready help in trouble.',
          color: '#E8B4A2',
        },
      ],
      observation: {
        text: 'The psalm begins with who God is before it names what is shaking.',
        tags: ['God', 'Promise'],
        byHighlight: {
          'refuge-highlight': 'God is present help, not distant reassurance.',
        },
        promptsByHighlight: {
          'refuge-highlight': ['What does this show me about God?'],
        },
        promptNotesByHighlight: {
          'refuge-highlight': {
            'What does this show me about God?':
              'He is steady and available in the middle of trouble.',
          },
        },
      },
      understanding: {
        text: 'Security is rooted in God’s character rather than calm circumstances.',
        prompts: ['What truth is being emphasized?'],
        byPrompt: {
          'What truth is being emphasized?':
            'Because God is refuge and strength, fear does not have the final word.',
        },
      },
      response: {
        text: 'I will pause before reacting and name God as my refuge today.',
        prompts: ['What is one faithful response?'],
        byPrompt: {
          'What is one faithful response?':
            'Bring the unsettled decision to God before trying to control it.',
        },
      },
      prayer: {
        text: 'God, steady my heart and help me trust Your nearness today.',
        saveToPrayerJournal: false,
        trackAnswered: false,
      },
    },
  },
  {
    date: '2026-09-15',
    time: '19:20',
    passage: {
      reference: 'Matthew 11:28–30',
      book: 'Matthew',
      chapter: 11,
      verseStart: 28,
      verseEnd: 30,
      translation: 'NASB',
    },
    content: {
      format: 'bible_study_v1',
      passageRead: true,
      highlights: [
        {
          id: 'rest-highlight',
          verseNumber: '28',
          text: 'Come to Me, all who are weary and burdened, and I will give you rest.',
          color: '#A8B9A0',
        },
        {
          id: 'learn-highlight',
          verseNumber: '29',
          text: 'Learn from Me, for I am gentle and humble in heart.',
          color: '#D8C8A9',
        },
      ],
      observation: {
        text: 'Jesus offers both rest and a new way to carry responsibility.',
        tags: ['Jesus', 'Invitation', 'Rest'],
        byHighlight: {
          'rest-highlight': 'The invitation is for weary people, not polished people.',
          'learn-highlight': 'Rest includes learning the gentle pace of Jesus.',
        },
        promptsByHighlight: {},
        promptNotesByHighlight: {},
      },
      understanding: {
        text: 'Following Jesus does not remove every burden; it changes whose pace and strength shape me.',
        prompts: [],
        byPrompt: {},
      },
      response: {
        text: 'I can end work on time tonight and receive rest without earning it.',
        prompts: ['What do I need to release?'],
        byPrompt: {
          'What do I need to release?':
            'The belief that everything depends on me finishing one more task.',
        },
      },
      prayer: {
        text: 'Jesus, teach me Your unhurried and gentle way.',
        saveToPrayerJournal: false,
        trackAnswered: false,
      },
    },
  },
  {
    date: '2026-09-16',
    time: '12:15',
    passage: {
      reference: 'James 1:19–20',
      book: 'James',
      chapter: 1,
      verseStart: 19,
      verseEnd: 20,
      translation: 'NASB',
    },
    content: {
      format: 'bible_study_v1',
      passageRead: true,
      highlights: [
        {
          id: 'listen-highlight',
          verseNumber: '19',
          text: 'Everyone must be quick to hear, slow to speak and slow to anger.',
          color: '#B7C5D8',
        },
      ],
      observation: {
        text: 'James connects careful listening with restraint in speech and anger.',
        tags: ['Wisdom', 'Relationships'],
        byHighlight: {},
        promptsByHighlight: {},
        promptNotesByHighlight: {},
      },
      understanding: {
        text: 'Listening is not passivity; it creates room for a response shaped by God’s righteousness.',
        prompts: ['Where does this meet my life?'],
        byPrompt: {
          'Where does this meet my life?':
            'I often prepare a defense before I understand what the other person means.',
        },
      },
      response: {
        text: 'In my next hard conversation, I will ask one clarifying question before answering.',
        prompts: [],
        byPrompt: {},
      },
      prayer: {
        text: 'Give me a listening heart and words that make room for peace.',
        saveToPrayerJournal: false,
        trackAnswered: false,
      },
    },
  },
  {
    date: '2026-09-17',
    time: '08:05',
    passage: {
      reference: 'John 15:4–5',
      book: 'John',
      chapter: 15,
      verseStart: 4,
      verseEnd: 5,
      translation: 'NASB',
    },
    content: {
      format: 'bible_study_v1',
      passageRead: true,
      highlights: [
        {
          id: 'abide-highlight',
          verseNumber: '5',
          text: 'The one who remains in Me, and I in him, bears much fruit.',
          color: '#A8B9A0',
        },
      ],
      observation: {
        text: 'Fruit is the result of abiding, not frantic self-production.',
        tags: ['Jesus', 'Growth', 'Abiding'],
        byHighlight: {
          'abide-highlight': 'Dependence comes before fruitfulness.',
        },
        promptsByHighlight: {},
        promptNotesByHighlight: {},
      },
      understanding: {
        text: 'Jesus describes ongoing relationship with Him as the source of lasting spiritual fruit.',
        prompts: [],
        byPrompt: {},
      },
      response: {
        text: 'I will begin the next work block with five quiet minutes in God’s presence.',
        prompts: ['What will help me remain?'],
        byPrompt: {
          'What will help me remain?':
            'Returning to a short prayer whenever I notice myself striving.',
        },
      },
      prayer: {
        text: 'Jesus, keep me close to You and grow fruit I cannot manufacture.',
        saveToPrayerJournal: false,
        trackAnswered: false,
      },
    },
  },
  {
    date: '2026-09-18',
    time: '21:10',
    passage: {
      reference: 'Philippians 4:6–7',
      book: 'Philippians',
      chapter: 4,
      verseStart: 6,
      verseEnd: 7,
      translation: 'NASB',
    },
    content: {
      format: 'bible_study_v1',
      passageRead: true,
      highlights: [
        {
          id: 'peace-highlight',
          verseNumber: '7',
          text: 'The peace of God, which surpasses all comprehension, will guard your hearts and minds.',
          color: '#D6C2DA',
        },
      ],
      observation: {
        text: 'Prayer and thanksgiving turn anxiety into honest dependence, not denial.',
        tags: ['Prayer', 'Peace'],
        byHighlight: {},
        promptsByHighlight: {},
        promptNotesByHighlight: {},
      },
      understanding: {
        text: 'God promises guarding peace while circumstances may still be unresolved.',
        prompts: [],
        byPrompt: {},
      },
      response: {
        text: 'I will name the concern clearly, thank God for today’s provision, and release the outcome.',
        prompts: [],
        byPrompt: {},
      },
      prayer: {
        text: 'Father, guard my mind as I place this unresolved situation in Your hands.',
        saveToPrayerJournal: false,
        trackAnswered: false,
      },
    },
  },
  {
    date: '2026-09-19',
    time: '09:30',
    passage: {
      reference: 'Micah 6:8',
      book: 'Micah',
      chapter: 6,
      verseStart: 8,
      verseEnd: 8,
      translation: 'NASB',
    },
    content: {
      format: 'bible_study_v1',
      passageRead: true,
      highlights: [],
      observation: {
        text: 'Justice, mercy, and humble walking belong together in a faithful life.',
        tags: ['Faithfulness', 'Justice', 'Mercy'],
        byHighlight: {},
        promptsByHighlight: {},
        promptNotesByHighlight: {},
      },
      understanding: {
        text: 'God’s desire is not performative spirituality but a life ordered by His character.',
        prompts: ['What does this reveal about faithfulness?'],
        byPrompt: {
          'What does this reveal about faithfulness?':
            'Faithfulness is visible in how I treat people and how humbly I walk with God.',
        },
      },
      response: {
        text: 'I will make the kind phone call I have delayed and listen without defending myself.',
        prompts: [],
        byPrompt: {},
      },
      prayer: {
        text: 'Shape my choices with justice, mercy, and humility.',
        saveToPrayerJournal: false,
        trackAnswered: false,
      },
    },
  },
  {
    date: '2026-09-20',
    time: '18:25',
    passage: {
      reference: 'Proverbs 3:5–6',
      book: 'Proverbs',
      chapter: 3,
      verseStart: 5,
      verseEnd: 6,
      translation: 'NASB',
    },
    content: {
      format: 'bible_study_v1',
      passageRead: true,
      highlights: [
        {
          id: 'trust-highlight',
          verseNumber: '5',
          text: 'Trust in the Lord with all your heart and do not lean on your own understanding.',
          color: '#E8B4A2',
        },
      ],
      observation: {
        text: 'Trust includes acknowledging the limits of my own perspective.',
        tags: ['Trust', 'Guidance'],
        byHighlight: {
          'trust-highlight': 'My understanding can inform a decision without becoming my god.',
        },
        promptsByHighlight: {},
        promptNotesByHighlight: {},
      },
      understanding: {
        text: 'God’s guidance is relational: acknowledge Him in the path, not only at the destination.',
        prompts: [],
        byPrompt: {},
      },
      response: {
        text: 'I will make a wise plan for the week and hold it with open hands.',
        prompts: ['Where do I need guidance?'],
        byPrompt: {
          'Where do I need guidance?':
            'I need direction about which commitment deserves my best attention.',
        },
      },
      prayer: {
        text: 'Direct my path this week and keep me teachable when plans change.',
        saveToPrayerJournal: false,
        trackAnswered: false,
      },
    },
  },
];

const MONTHLY_BIBLE_STUDY_DATES = Array.from(
  {length: 31},
  (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`,
);

export const buildReviewQABibleStudyFixtures = (
  scenarioId: ReviewQAScenario,
): ReviewQABibleStudyFixture[] => {
  const dates =
    scenarioId === 'weekly'
      ? [...REVIEW_QA_PREVIOUS_WEEK_DATES, ...REVIEW_QA_WEEKLY_DATES]
      : MONTHLY_BIBLE_STUDY_DATES;
  const namespace =
    scenarioId === 'weekly' ? 'weekly-bible-studies' : 'monthly-bible-studies';
  return dates.map((selectedDate, index) => {
    const seed = STUDY_WEEK[index % STUDY_WEEK.length];
    const timestamp = `${selectedDate}T${seed.time}:00.000Z`;
    const sessionId = `${REVIEW_QA_PREFIX}${namespace}:bible-study:${selectedDate}:${
      index + 1
    }`;
    const reflectionId = `${sessionId}:reflection`;
    const session: BibleStudySession = {
      id: sessionId,
      selected_date: selectedDate,
      passage: seed.passage,
      current_stage: 'saved',
      current_step: 'respond',
      completed_steps: [
        'passage',
        'read',
        'observe',
        'understand',
        'respond',
      ],
      reflection_ref: {
        domain: 'reflection',
        content_type: 'scripture',
        local_id: reflectionId,
      },
      completed: true,
      started_at: timestamp,
      updated_at: timestamp,
      completed_at: timestamp,
      version: 1,
    };
    const reflection: LocalReflectionEntry = {
      id: reflectionId,
      server_id: null,
      title: seed.passage.reference,
      content: JSON.stringify(seed.content),
      type: 'scripture',
      source: 'bible_study',
      selected_date: selectedDate,
      tags: ['bible-study', 'review-qa'],
      metadata: {
        bibleStudySessionId: sessionId,
        bibleStudyCompleted: true,
        bibleStudyCompletedAt: timestamp,
        passage: seed.passage,
      },
      created_at: timestamp,
      updated_at: timestamp,
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    };
    return {session, reflection};
  });
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

/** Adds complete, linked Bible Study sessions and canonical reflections. */
export const seedReviewQABibleStudies = async (
  manifest: ReviewQASeedManifest,
  scenarioId: ReviewQAScenario,
): Promise<number> => {
  const fixtures = buildReviewQABibleStudyFixtures(scenarioId);
  for (const {session, reflection} of fixtures) {
    const sessionKey = `bible_study_session:${session.id}`;
    const reflectionKey = `reflection_local:scripture:${reflection.selected_date}:${reflection.id}`;
    const reflectionIndexKey = `reflection_local_index:scripture:${reflection.selected_date}`;
    for (const key of [sessionKey, reflectionKey]) {
      if (!manifest.keys.includes(key)) {
        manifest.keys.push(key);
      }
    }
    await AsyncStorage.setItem(sessionKey, JSON.stringify(session));
    await AsyncStorage.setItem(reflectionKey, JSON.stringify(reflection));
    await addToIndex(reflectionIndexKey, reflection.id);
  }
  return fixtures.length;
};
