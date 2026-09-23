import AsyncStorage from '@react-native-async-storage/async-storage';

import type {GuidedReflectionNote} from '../../types/guidedReflection';
import {REVIEW_QA_PREFIX} from './reviewQAFixtures';
import type {ReviewQASeedManifest} from './reviewQAWeeklyMorningData';

export type WeeklyScriptureNoteFixture = {
  id: string;
  title: string;
  content: string;
  type: 'scripture';
  source: 'scripture_note';
  selected_date: string;
  tags: string[];
  metadata: {
    book: string;
    reference: string;
    chapter_verse: string;
    version: 'NASB';
    journalBlocks: GuidedReflectionNote[];
  };
  created_at: string;
  updated_at: string;
  version: number;
  sync_status: 'local';
  deleted: false;
  server_id: null;
  linked_account_id: null;
};

type ScriptureNoteSeed = {
  date: string;
  time: string;
  reference: string;
  book: string;
  chapterVerse: string;
  content: string;
  blocks: GuidedReflectionNote[];
};

const SCRIPTURE_NOTE_WEEK: ScriptureNoteSeed[] = [
  {
    date: '2026-09-14',
    time: '08:40',
    reference: 'Psalm 37:5',
    book: 'Psalm',
    chapterVerse: '37:5',
    content: 'Commit the work, then release the outcome. I can plan carefully without asking the plan to carry what belongs to God.',
    blocks: [
      {id: 'weekly-scripture-0914-text', kind: 'text', text: 'Commit the work, then release the outcome. I can plan carefully without asking the plan to carry what belongs to God.'},
      {id: 'weekly-scripture-0914-key', kind: 'key', text: 'Faithful preparation and surrendered trust can live together.'},
      {id: 'weekly-scripture-0914-response', kind: 'response', text: 'I will begin with the next clear step and leave the result with God.'},
    ],
  },
  {
    date: '2026-09-15',
    time: '20:10',
    reference: '2 Corinthians 12:9',
    book: '2 Corinthians',
    chapterVerse: '12:9',
    content: 'I keep treating limitation like failure. This passage reminds me that weakness can become the place where I stop performing and receive grace.',
    blocks: [
      {id: 'weekly-scripture-0915-text', kind: 'text', text: 'I keep treating limitation like failure. This passage reminds me that weakness can become the place where I stop performing and receive grace.'},
      {id: 'weekly-scripture-0915-question', kind: 'question', text: 'Where am I trying to appear strong instead of asking God for help?'},
      {id: 'weekly-scripture-0915-remember', kind: 'remember', text: 'Grace is present before I have everything under control.'},
    ],
  },
  {
    date: '2026-09-16',
    time: '12:45',
    reference: 'James 1:19',
    book: 'James',
    chapterVerse: '1:19',
    content: 'Listening is an act of love. I do not need to prepare an answer while someone is still sharing their heart.',
    blocks: [
      {id: 'weekly-scripture-0916-text', kind: 'text', text: 'Listening is an act of love. I do not need to prepare an answer while someone is still sharing their heart.'},
      {id: 'weekly-scripture-0916-key', kind: 'key', text: 'Presence before advice.'},
      {id: 'weekly-scripture-0916-response', kind: 'response', text: 'Pause, listen to the whole story, and answer gently.'},
    ],
  },
  {
    date: '2026-09-17',
    time: '17:25',
    reference: 'Mark 6:31',
    book: 'Mark',
    chapterVerse: '6:31',
    content: 'Jesus noticed the disciples were tired and invited them away to rest. Rest can be an act of obedience, not a reward for finally finishing everything.',
    blocks: [
      {id: 'weekly-scripture-0917-text', kind: 'text', text: 'Jesus noticed the disciples were tired and invited them away to rest. Rest can be an act of obedience, not a reward for finally finishing everything.'},
      {id: 'weekly-scripture-0917-question', kind: 'question', text: 'What would receiving Jesus’ invitation to rest look like tonight?'},
      {id: 'weekly-scripture-0917-response', kind: 'response', text: 'Close the laptop after dinner and let the unfinished work wait until tomorrow.'},
    ],
  },
  {
    date: '2026-09-18',
    time: '09:35',
    reference: 'Colossians 3:23–24',
    book: 'Colossians',
    chapterVerse: '3:23–24',
    content: 'Wholehearted work is different from frantic work. I can offer care, honesty, and attention without making achievement my identity.',
    blocks: [
      {id: 'weekly-scripture-0918-text', kind: 'text', text: 'Wholehearted work is different from frantic work. I can offer care, honesty, and attention without making achievement my identity.'},
      {id: 'weekly-scripture-0918-key', kind: 'key', text: 'Work from belonging, not for belonging.'},
      {id: 'weekly-scripture-0918-remember', kind: 'remember', text: 'Faithfulness can be quiet, careful, and complete enough.'},
    ],
  },
  {
    date: '2026-09-19',
    time: '10:50',
    reference: 'Hebrews 4:9–11',
    book: 'Hebrews',
    chapterVerse: '4:9–11',
    content: 'Sabbath exposes how much I depend on productivity to feel secure. God’s rest invites me to trust that the world is held even when I stop.',
    blocks: [
      {id: 'weekly-scripture-0919-text', kind: 'text', text: 'Sabbath exposes how much I depend on productivity to feel secure. God’s rest invites me to trust that the world is held even when I stop.'},
      {id: 'weekly-scripture-0919-quote', kind: 'quote', text: 'The world is held even when I stop.', secondary: 'Sabbath reflection'},
      {id: 'weekly-scripture-0919-response', kind: 'response', text: 'Receive today as a gift instead of turning it into a catch-up day.'},
    ],
  },
  {
    date: '2026-09-20',
    time: '18:40',
    reference: 'Proverbs 16:9',
    book: 'Proverbs',
    chapterVerse: '16:9',
    content: 'I can make a thoughtful plan for the new week while staying open to God’s direction. A changed plan does not mean the day has been lost.',
    blocks: [
      {id: 'weekly-scripture-0920-text', kind: 'text', text: 'I can make a thoughtful plan for the new week while staying open to God’s direction. A changed plan does not mean the day has been lost.'},
      {id: 'weekly-scripture-0920-question', kind: 'question', text: 'Where do I need direction more than certainty this week?'},
      {id: 'weekly-scripture-0920-remember', kind: 'remember', text: 'Plan with open hands.'},
    ],
  },
];

export const buildWeeklyScriptureNoteFixtures = (): WeeklyScriptureNoteFixture[] =>
  SCRIPTURE_NOTE_WEEK.map((note, index) => ({
    id: `${REVIEW_QA_PREFIX}weekly:scripture-note:${note.date}:${index + 1}`,
    title: note.reference,
    content: note.content,
    type: 'scripture',
    source: 'scripture_note',
    selected_date: note.date,
    tags: ['scripture-note', 'weekly-qa'],
    metadata: {
      book: note.book,
      reference: note.reference,
      chapter_verse: note.chapterVerse,
      version: 'NASB',
      journalBlocks: note.blocks,
    },
    created_at: `${note.date}T${note.time}:00.000Z`,
    updated_at: `${note.date}T${note.time}:00.000Z`,
    version: 1,
    sync_status: 'local',
    deleted: false,
    server_id: null,
    linked_account_id: null,
  }));

const addToIndex = async (key: string, id: string): Promise<void> => {
  let values: string[] = [];
  try {values = JSON.parse(await AsyncStorage.getItem(key) || '[]');} catch {}
  if (!values.includes(id)) {
    await AsyncStorage.setItem(key, JSON.stringify([...values, id]));
  }
};

/** Adds one standalone Scripture Note to every day in the standard Weekly Review QA period. */
export const seedWeeklyScriptureNotes = async (
  manifest: ReviewQASeedManifest,
): Promise<void> => {
  for (const fixture of buildWeeklyScriptureNoteFixtures()) {
    const key = `reflection_local:scripture:${fixture.selected_date}:${fixture.id}`;
    const indexKey = `reflection_local_index:scripture:${fixture.selected_date}`;
    if (!manifest.keys.includes(key)) {manifest.keys.push(key);}
    await AsyncStorage.setItem(key, JSON.stringify(fixture));
    await addToIndex(indexKey, fixture.id);
  }
};
