import AsyncStorage from '@react-native-async-storage/async-storage';
import {Image} from 'react-native';

import {REVIEW_QA_PREFIX} from './reviewQAFixtures';
import {
  mapReviewQADate,
  type ReviewQASeedManifest,
  type ReviewQASeedScope,
} from './reviewQAWeeklyMorningData';
import type {GuidedReflectionNote} from '../../types/guidedReflection';

type HeartJournalEntry = {
  date: string;
  time: string;
  classification: string;
  title: string;
  content: string;
  journalBlocks?: GuidedReflectionNote[];
};

type ChosenQuestionEntry = {
  date: string;
  time: string;
  topic: string;
  question: string;
  response: string;
};

/**
 * Direct Heart Journal writing only. Guided prompts and Guided Reflections are
 * intentionally absent so they can be introduced and reviewed separately.
 */
const HEART_JOURNAL_WEEK: HeartJournalEntry[] = [
  {
    date: '2026-09-14',
    time: '09:20',
    classification: 'thoughts',
    title: 'Start smaller than the pressure says',
    content:
      'I keep thinking the whole week has to be solved today. Maybe faithfulness looks like choosing the next clear step and giving it my full attention.',
  },
  {
    date: '2026-09-14',
    time: '14:10',
    classification: 'notes',
    title: 'Notes from Monday’s planning call',
    content:
      'Confirm the final scope before designing. Keep the first version simple. Ask Maya to review the handoff before Friday.',
  },
  {
    date: '2026-09-15',
    time: '11:35',
    classification: 'brain_dump',
    title: '',
    content:
      'Call the clinic. Reply to the school email. Decide what can move to next week. I am worried I will disappoint someone if I say no, but I cannot keep treating every request like an emergency.',
  },
  {
    date: '2026-09-15',
    time: '18:25',
    classification: 'reflection',
    title: 'What is actually mine to carry?',
    content:
      'I felt overwhelmed because I was holding my responsibilities, other people’s reactions, and outcomes I cannot control. I can be honest, do my part, and leave the rest with God.',
  },
  {
    date: '2026-09-16',
    time: '13:05',
    classification: 'lesson',
    title: 'Listening without fixing',
    content:
      'Mom did not need a solution from me today. She needed time, attention, and room to finish what she was saying. Presence was more loving than advice.',
  },
  {
    date: '2026-09-16',
    time: '21:10',
    classification: 'letter',
    title: 'To the version of me that keeps rushing',
    content:
      'You do not have to prove that you deserve rest. Slow down enough to notice the people beside you and the grace already carrying you.',
  },
  {
    date: '2026-09-17',
    time: '15:40',
    classification: 'notes',
    title: 'What helped me rest today',
    content:
      'Moving one meeting. Eating before I became exhausted. Ten quiet minutes by the window. Letting one unfinished task remain unfinished.',
  },
  {
    date: '2026-09-17',
    time: '19:30',
    classification: 'thoughts',
    title: 'Rest is not wasted time',
    content:
      'My slower pace did not ruin the day. I was kinder, clearer, and more present after I stopped forcing myself through the tiredness.',
  },
  {
    date: '2026-09-18',
    time: '10:15',
    classification: 'idea',
    title: 'A gentler Monday reset',
    content:
      'Prepare one visible next step on Friday, close the laptop with a short note to myself, and begin Monday without reopening the entire week at once.',
  },
  {
    date: '2026-09-18',
    time: '16:50',
    classification: 'brain_dump',
    title: '',
    content:
      'The notes are submitted. The kitchen still needs attention. I want to answer two messages, return the book, and stop carrying work into the weekend. Not all of this has to happen tonight.',
  },
  {
    date: '2026-09-19',
    time: '12:20',
    classification: 'reflection',
    title: 'What Sabbath uncovered',
    content:
      'When I stopped producing, I noticed how quickly I reach for noise. The quiet felt uncomfortable at first, then it began to feel like being welcomed home.',
  },
  {
    date: '2026-09-19',
    time: '20:05',
    classification: 'thoughts',
    title: 'Small things I want to remember',
    content:
      'Warm light across the table. Worship music from the other room. An unhurried breakfast. Laughing before anyone checked the time.',
  },
  {
    date: '2026-09-20',
    time: '15:15',
    classification: 'lesson',
    title: 'Preparation can come from peace',
    content:
      'Getting ready for Monday felt different when I treated it as care for my future self instead of fear about everything that could go wrong.',
  },
  {
    date: '2026-09-20',
    time: '19:10',
    classification: 'thoughts',
    title: 'Begin by listening',
    content:
      'I have ideas for the new week, but I do not want planning to become another way of controlling the outcome. I want to listen before I decide what matters most.',
  },
  {
    date: '2026-09-18',
    time: '18:10',
    classification: 'notes',
    title: 'Notes for a gentler week',
    content:
      'A few practical notes for protecting attention, choosing a clear order, and noticing what helps.',
    journalBlocks: [
      {id: 'review-notes-section', kind: 'section', text: 'What matters most'},
      {
        id: 'review-notes-text',
        kind: 'text',
        text: 'I do not need a perfect plan. I need enough clarity to take the next faithful step without rushing past the people in front of me.',
      },
      {
        id: 'review-notes-bullets',
        kind: 'bullets',
        text: 'Keep close',
        points: [
          'Begin the morning without notifications',
          'Leave room between commitments',
          'End work before I am completely depleted',
        ],
      },
      {
        id: 'review-notes-numbered',
        kind: 'numbered',
        text: 'A simple order',
        points: [
          'Pray before planning',
          'Choose one essential task',
          'Review the day with gratitude',
        ],
      },
      {
        id: 'review-notes-table',
        kind: 'table',
        text: '',
        tableRows: [
          ['Rhythm', 'When'],
          ['Quiet start', '7:00 AM'],
          ['Short walk', 'After lunch'],
          ['Phone away', '9:00 PM'],
        ],
      },
    ],
  },
  {
    date: '2026-09-19',
    time: '16:30',
    classification: 'thoughts',
    title: 'Peace grows when I make room',
    content:
      'A quote, Scripture, and a few truths I want to carry into the coming week.',
    journalBlocks: [
      {
        id: 'review-thoughts-quote',
        kind: 'quote',
        text: 'Never be afraid to trust an unknown future to a known God.',
        secondary: 'Corrie ten Boom',
      },
      {
        id: 'review-thoughts-scripture',
        kind: 'scripture',
        text: 'John 14:27',
        reference: 'John 14:27',
        scriptureReference: 'John 14:27',
        scriptureText: 'Peace I leave with you; my peace I give you.',
      },
      {
        id: 'review-thoughts-key',
        kind: 'key',
        text: 'Peace is not the reward for controlling every outcome.',
      },
      {
        id: 'review-thoughts-remember',
        kind: 'remember',
        text: 'The quiet moments were not empty. They helped me hear what urgency had been hiding.',
      },
    ],
  },
  {
    date: '2026-09-20',
    time: '21:20',
    classification: 'brain_dump',
    title: 'Clear the noise before Monday',
    content:
      'Everything circling in my mind, gathered in one place so I can release it for tonight.',
    journalBlocks: [
      {
        id: 'review-dump-action',
        kind: 'action',
        text: 'Write tomorrow’s first task on a sticky note',
        completed: false,
      },
      {
        id: 'review-dump-question',
        kind: 'question',
        text: 'What am I afraid will happen if I leave something unfinished?',
      },
      {
        id: 'review-dump-response',
        kind: 'response',
        text: 'I will choose the next clear step, communicate what needs more time, and let enough be enough.',
      },
      {
        id: 'review-dump-photo',
        kind: 'photo',
        text: 'A quiet path reminding me that I only need light for the next few steps.',
        uri:
          Image.resolveAssetSource(
            require('../../../assets/images/share/sifiashare_19.png'),
          )?.uri || 'review-qa://autumn-path',
      },
      {
        id: 'review-dump-voice',
        kind: 'voice',
        text: 'A short spoken reminder to slow down and receive the evening.',
        uri: 'bundle://today_opening.mp3',
        durationMillis: 12000,
      },
    ],
  },
];

/** Completed from Guided Reflection → Choose a question. */
const CHOSEN_QUESTION_WEEK: ChosenQuestionEntry[] = [
  {
    date: '2026-09-14',
    time: '17:35',
    topic: 'With God',
    question: 'Where have I noticed God at work in my life lately?',
    response:
      'I noticed God in the clarity that came after I stopped forcing an answer. The project still needs work, but I received enough light for the next step and help through Maya’s timely message.',
  },
  {
    date: '2026-09-15',
    time: '21:05',
    topic: 'My Heart',
    question:
      'What do I need to receive, release, or bring honestly before God?',
    response:
      'I need to receive permission to be limited, release the fear of disappointing everyone, and bring God the pressure I have been hiding behind competence.',
  },
  {
    date: '2026-09-17',
    time: '20:20',
    topic: 'Health',
    question: 'Am I treating my limits as wisdom or as an inconvenience?',
    response:
      'Mostly as an inconvenience. Today reminded me that my body was giving useful information, not interrupting my plans. Moving more slowly helped me respond with patience instead of resentment.',
  },
  {
    date: '2026-09-20',
    time: '20:30',
    topic: 'Rest & Rhythms',
    question: 'What would meaningful rest look like for me this week?',
    response:
      'Meaningful rest would look like one evening without catching up, leaving my phone outside the bedroom, and receiving quiet time with God without turning it into another task to complete.',
  },
];

const addToIndex = async (key: string, id: string): Promise<void> => {
  let values: string[] = [];
  try {
    values = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
  } catch {}
  if (!values.includes(id)) {
    await AsyncStorage.setItem(key, JSON.stringify([...values, id]));
  }
};

export const seedWeeklyHeartJournal = async (
  manifest: ReviewQASeedManifest,
  scope: ReviewQASeedScope = {},
): Promise<void> => {
  const namespace = scope.namespace ?? 'weekly';
  for (const [index, sourceEntry] of HEART_JOURNAL_WEEK.entries()) {
    const entry = {
      ...sourceEntry,
      date: mapReviewQADate(sourceEntry.date, scope.dates),
    };
    const id = `${REVIEW_QA_PREFIX}${namespace}:heart-journal:${entry.date}:${
      index + 1
    }`;
    const key = `reflection_local:free:${entry.date}:${id}`;
    const indexKey = `reflection_local_index:free:${entry.date}`;
    if (!manifest.keys.includes(key)) {
      manifest.keys.push(key);
    }
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        id,
        server_id: null,
        linked_account_id: null,
        title: entry.title,
        content: entry.content,
        type: 'free',
        source: 'freeform',
        selected_date: entry.date,
        tags: [],
        metadata: {
          journalClassification: entry.classification,
          ...(entry.journalBlocks ? {journalBlocks: entry.journalBlocks} : {}),
        },
        created_at: `${entry.date}T${entry.time}:00.000Z`,
        updated_at: `${entry.date}T${entry.time}:00.000Z`,
        version: 1,
        sync_status: 'local',
        deleted: false,
      }),
    );
    await addToIndex(indexKey, id);
  }

  for (const [index, sourceEntry] of CHOSEN_QUESTION_WEEK.entries()) {
    const entry = {
      ...sourceEntry,
      date: mapReviewQADate(sourceEntry.date, scope.dates),
    };
    const id = `${REVIEW_QA_PREFIX}${namespace}:chosen-question:${entry.date}:${
      index + 1
    }`;
    const key = `reflection_local:guided:${entry.date}:${id}`;
    const indexKey = `reflection_local_index:guided:${entry.date}`;
    if (!manifest.keys.includes(key)) {
      manifest.keys.push(key);
    }
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        id,
        server_id: null,
        linked_account_id: null,
        title: entry.question,
        content: entry.response,
        type: 'guided',
        source: 'guided',
        selected_date: entry.date,
        tags: ['guided'],
        metadata: {prompt: entry.question, questionTopic: entry.topic},
        created_at: `${entry.date}T${entry.time}:00.000Z`,
        updated_at: `${entry.date}T${entry.time}:00.000Z`,
        version: 1,
        sync_status: 'local',
        deleted: false,
      }),
    );
    await addToIndex(indexKey, id);
  }
};
