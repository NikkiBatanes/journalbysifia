import AsyncStorage from '@react-native-async-storage/async-storage';
import {Image} from 'react-native';

import type {LocalPrayerEntry} from '../../storage/prayerStorage';
import type {LocalReflectionEntry} from '../../storage/reflectionStorage';
import type {JournalBlock} from '../../components/journal/shared/journalBlocks';
import {REVIEW_QA_PREFIX} from './reviewQAFixtures';
import {
  seedWeeklyMorningFlow,
  type ReviewQASeedManifest,
} from './reviewQAWeeklyMorningData';
import {seedWeeklyEveningFlow} from './reviewQAWeeklyEveningData';

export const MOCKUP_DATA_LABEL = 'Mockup data';
export const MOCKUP_DATA_PERIOD_START = '2026-09-21';
export const MOCKUP_DATA_PERIOD_END = '2026-09-27';
export const MOCKUP_DATA_PERIOD_LABEL = 'September 21–27, 2026';

const addToIndex = async (key: string, id: string): Promise<void> => {
  let ids: string[] = [];
  try {
    ids = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
  } catch {}
  if (!ids.includes(id)) {
    await AsyncStorage.setItem(key, JSON.stringify([...ids, id]));
  }
};

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

const putIndexedRecord = async (
  manifest: ReviewQASeedManifest,
  key: string,
  indexKey: string,
  id: string,
  value: unknown,
): Promise<void> => {
  if (!manifest.keys.includes(key)) {
    manifest.keys.push(key);
  }
  await AsyncStorage.setItem(key, JSON.stringify(value));
  await addToIndex(indexKey, id);
};

const putReflection = async (
  manifest: ReviewQASeedManifest,
  entry: LocalReflectionEntry,
): Promise<void> => {
  await putIndexedRecord(
    manifest,
    `reflection_local:${entry.type}:${entry.selected_date}:${entry.id}`,
    `reflection_local_index:${entry.type}:${entry.selected_date}`,
    entry.id,
    entry,
  );
};

const putPrayer = async (
  manifest: ReviewQASeedManifest,
  entry: LocalPrayerEntry,
): Promise<void> => {
  await putIndexedRecord(
    manifest,
    `prayer_local:${entry.selected_date}:${entry.id}`,
    `prayer_local_index:${entry.selected_date}`,
    entry.id,
    entry,
  );
};

/**
 * The small, intentional dataset used to capture the early-access website.
 * It uses production record shapes and remains isolated by REVIEW_QA_PREFIX.
 */
export const seedReviewQAMockupData = async (
  manifest: ReviewQASeedManifest,
): Promise<void> => {
  const morningScope = {
    dates: ['2026-09-21', '2026-09-22', '2026-09-24', '2026-09-26'] as const,
    namespace: 'mockup-rhythm',
  };
  const eveningScope = {
    dates: [
      '2026-09-21',
      '2026-09-22',
      '2026-09-24',
      '2026-09-25',
      '2026-09-27',
    ] as const,
    namespace: 'mockup-rhythm',
  };
  await seedWeeklyMorningFlow(manifest, morningScope);
  await seedWeeklyEveningFlow(manifest, eveningScope);

  const gratitudeKey =
    'journal_local:gratitude:2026-09-24:' +
    `${REVIEW_QA_PREFIX}mockup-rhythm:gratitude:2026-09-24`;
  const gratitude = JSON.parse(
    (await AsyncStorage.getItem(gratitudeKey)) || '{}',
  );
  await AsyncStorage.setItem(
    gratitudeKey,
    JSON.stringify({
      ...gratitude,
      content: JSON.stringify({
        items: [
          'The calm that came after I stopped rehearsing every possible outcome.',
        ],
      }),
    }),
  );

  const listeningId = `${REVIEW_QA_PREFIX}mockup-heart-listening`;
  await putReflection(manifest, {
    id: listeningId,
    server_id: null,
    title: 'Listening without fixing',
    content:
      'Mom didn’t need a solution from me today. She needed time, attention, and room to finish.',
    type: 'free',
    source: 'freeform',
    selected_date: '2026-09-21',
    tags: ['heart-journal'],
    metadata: {journalClassification: 'thoughts'},
    created_at: '2026-09-21T13:05:00.000Z',
    updated_at: '2026-09-21T13:05:00.000Z',
    version: 1,
    sync_status: 'local',
    deleted: false,
    linked_account_id: null,
  });

  const presentationId = `${REVIEW_QA_PREFIX}mockup-heart-presentation`;
  await putReflection(manifest, {
    id: presentationId,
    server_id: null,
    title: 'The presentation is done',
    content:
      'I was nervous for the first few minutes, then found my rhythm. The questions were thoughtful, and I handled the one I couldn’t answer without pretending.\n\nThe part I keep replaying is the moment I stopped trying to sound polished and answered plainly. The room relaxed when I did, and so did I.\n\nOn the way home, I listened to “Yet Not I but Through Christ in Me.” It reminded me that I didn’t have to carry the room by myself. I could serve the people in front of me, tell the truth, and leave the outcome with Jesus.\n\nPreparation mattered, but perfection wasn’t what carried me. Listening carefully helped me respond with more confidence than rehearsing one more version ever could. I want to remember that for the next room I walk into.\n\nI’m proud that I prepared well and still let the room be human. Tonight I want dinner, a shower, and absolutely no slides.',
    type: 'free',
    source: 'freeform',
    selected_date: '2026-09-25',
    tags: ['heart-journal'],
    metadata: {
      journalClassification: 'thoughts',
      journalBlocks: [
        {
          id: `${presentationId}:photo:presentation-done`,
          kind: 'photo',
          text: 'The room after everyone left—and the relief of knowing it was done.',
          uri:
            Image.resolveAssetSource(
              require('../../../assets/images/mockup/heart-presentation-done.jpg'),
            )?.uri || 'review-qa://heart-presentation-done',
        },
        {
          id: `${presentationId}:key-point`,
          kind: 'key',
          text: 'I found my rhythm when I stopped trying to control every moment.',
        },
        {
          id: `${presentationId}:what-helped`,
          kind: 'bullets',
          text: 'What helped today',
          points: [
            'Preparing the story instead of memorizing every sentence',
            'Pausing before answering questions',
            'Being honest when I needed to follow up later',
          ],
        },
        {
          id: `${presentationId}:worship-song`,
          kind: 'song',
          text: 'Yet Not I but Through Christ in Me',
          secondary: 'CityAlight',
        },
        {
          id: `${presentationId}:remember`,
          kind: 'remember',
          text: 'I can prepare carefully without needing to perform perfectly.',
        },
      ] satisfies JournalBlock[],
    },
    created_at: '2026-09-25T15:42:00.000Z',
    updated_at: '2026-09-25T15:42:00.000Z',
    version: 1,
    sync_status: 'local',
    deleted: false,
    linked_account_id: null,
  });

  const leaseId = `${REVIEW_QA_PREFIX}mockup-heart-lease`;
  await putReflection(manifest, {
    id: leaseId,
    server_id: null,
    title: 'Signed the lease, finally',
    content:
      'The renewal email sat in my inbox for two weeks. Today I printed the lease, sat at the table, and read every page with a pen in my hand.\n\nThe math works if I keep one freelance project a month. The neighborhood still feels like mine—the bakery knows my order, and Mom is twenty minutes away.\n\nI kept waiting for a dramatic sign. Mostly it was a quiet afternoon of arithmetic and the feeling that I wasn’t done here yet.\n\nSigned, scanned, sent before I could reopen the debate. God is so faithful—two weeks of circling, and the answer was just: stay. Ordered Thai food to celebrate like a person who makes decisions.',
    type: 'free',
    source: 'freeform',
    selected_date: '2026-09-25',
    tags: ['heart-journal'],
    metadata: {
      journalClassification: 'thoughts',
      journalBlocks: [
        {
          id: `${leaseId}:voice-memo`,
          kind: 'voice',
          text: 'Talked it through out loud on the drive to the water—it helped more than the spreadsheet did.',
          uri: 'bundle://streak_celebration.mp3',
          durationMillis: 83000,
        },
        {
          id: `${leaseId}:photo:coastline`,
          kind: 'photo',
          text: 'Drove out to the water after I sent it. God, You are such a painter. Ten minutes of waves beat two weeks of circling an inbox.',
          uri:
            Image.resolveAssetSource(
              require('../../../assets/images/share/sifiashare_1.png'),
            )?.uri || 'review-qa://heart-coastline',
        },
        {
          id: `${leaseId}:quote`,
          kind: 'quote',
          text: 'Where we love is home—home that our feet may leave, but not our hearts.',
          secondary: 'Oliver Wendell Holmes Sr.',
        },
        {
          id: `${leaseId}:action`,
          kind: 'action',
          text: 'Email the signed lease back before Monday',
          completed: true,
        },
        {
          id: `${leaseId}:question`,
          kind: 'question',
          text: 'What would make this place feel more like home this year?',
        },
        {
          id: `${leaseId}:book`,
          kind: 'book',
          text: 'The Next Right Thing',
          secondary: 'Emily P. Freeman',
        },
      ] satisfies JournalBlock[],
    },
    created_at: '2026-09-25T20:18:00.000Z',
    updated_at: '2026-09-25T20:18:00.000Z',
    version: 1,
    sync_status: 'local',
    deleted: false,
    linked_account_id: null,
  });

  const focusKey = 'journal_local_singleton:todays_focus:2026-09-25';
  await rememberReplacement(manifest, focusKey);
  await AsyncStorage.setItem(
    focusKey,
    JSON.stringify({
      id: `${REVIEW_QA_PREFIX}mockup-focus-2026-09-25`,
      server_id: null,
      content_type: 'todays_focus',
      selected_date: '2026-09-25',
      content: JSON.stringify({
        focus: 'Work',
        focusCategory: 'work',
        focusIcon: 'briefcase',
        focusIconType: 'ionicons',
        customFocus: '',
        personalText: 'Give my best attention to the work that matters most.',
        priorities: [],
      }),
      created_at: '2026-09-25T07:15:00.000Z',
      updated_at: '2026-09-25T07:15:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
    }),
  );

  const mayaId = `${REVIEW_QA_PREFIX}mockup-prayer-maya`;
  await putPrayer(manifest, {
    id: mayaId,
    server_id: null,
    linked_account_id: null,
    content:
      'Lord, give Maya peace for the interview and wisdom to know whether this role is right for her.',
    prayer_type: 'people',
    person_name: 'Maya',
    selected_date: '2026-09-21',
    prayed: true,
    prayer_count: 3,
    last_prayed_at: '2026-09-23T09:00:00.000Z',
    status: 'answered',
    answered_date: '2026-09-25T09:00:00.000Z',
    metadata: {
      track_answered: true,
      is_active: false,
      tracking_status: 'answered',
      prayer_updates: [
        {
          id: `${mayaId}:update:1`,
          date: '2026-09-23T09:00:00.000Z',
          text: 'The interview went well. She’s waiting to hear back next week.',
          kind: 'situation-changed',
        },
      ],
      answer_history: [
        {
          id: `${mayaId}:answer:1`,
          date: '2026-09-25T09:00:00.000Z',
          note: 'Maya received an offer, and the schedule fits the responsibilities she was concerned about.',
        },
      ],
    },
    created_at: '2026-09-21T08:30:00.000Z',
    updated_at: '2026-09-25T09:00:00.000Z',
    version: 1,
    sync_status: 'local',
    deleted: false,
  });

  const weeklyPrayerId = `${REVIEW_QA_PREFIX}mockup-weekly-prayer-maya`;
  await putPrayer(manifest, {
    id: weeklyPrayerId,
    server_id: null,
    linked_account_id: null,
    content: 'The interview went well. She’s waiting to hear back next week.',
    prayer_type: 'people',
    person_name: 'Maya',
    selected_date: '2026-09-23',
    prayed: true,
    prayer_count: 1,
    last_prayed_at: '2026-09-23T09:00:00.000Z',
    status: 'pending',
    metadata: {
      track_answered: true,
      is_active: true,
      tracking_status: 'pending',
    },
    created_at: '2026-09-23T09:00:00.000Z',
    updated_at: '2026-09-23T09:00:00.000Z',
    version: 1,
    sync_status: 'local',
    deleted: false,
  });

  const sermonId = `${REVIEW_QA_PREFIX}mockup-sermon-waiting`;
  const sermonBlocks: JournalBlock[] = [
    {
      id: `${sermonId}:outline`,
      kind: 'outline',
      text: 'When God gives you a vision',
      outlineStyle: 'numbered',
      points: [
        'Carry the burden to God first',
        'Pray, inspect, and make a faithful plan',
        'Take the next step even when the whole path is not visible',
      ],
    },
    {
      id: `${sermonId}:language`,
      kind: 'language',
      text: 'חָזוֹן',
      englishWord: 'vision',
      languageKind: 'hebrew',
      languageDetails: ['meaning', 'transliteration'],
      meaning:
        'Vision or revelation—what God shows before He asks His people to build.',
      secondary: 'khah-ZONE',
      reference: 'Nehemiah 2:12',
    },
    {
      id: `${sermonId}:response`,
      kind: 'response',
      text: 'Pray before planning. Write down the next faithful step, then take it without waiting to see the whole path.',
    },
  ];
  await putReflection(manifest, {
    id: sermonId,
    server_id: null,
    linked_account_id: null,
    title: 'When God Gives You a Vision',
    content: JSON.stringify({format: 'sermon_notes_v1', blocks: sermonBlocks}),
    type: 'sermon',
    source: 'sermon_notes',
    tags: ['sermon'],
    selected_date: '2026-09-27',
    metadata: {
      is_complete: true,
      sessionNoteType: 'sermon',
      main_scripture: 'Nehemiah 2:11–20',
      speaker: 'PTR. Jeremy Brylle',
      church: 'Grace Community Church',
      notice:
        'God’s vision came with a burden, a plan, and opposition—and Nehemiah still built.',
      carry:
        '“The God of heaven will give us success; therefore we His servants will arise and build.” — Nehemiah 2:20',
      prayer:
        'God, shape the vision before I build. Give me Nehemiah’s patience to pray, plan, and then act. Amen.',
      prayer_answer: '',
    },
    created_at: '2026-09-27T09:15:00.000Z',
    updated_at: '2026-09-27T10:30:00.000Z',
    version: 1,
    sync_status: 'local',
    deleted: false,
  });

  const restSermonId = `${REVIEW_QA_PREFIX}mockup-sermon-rest`;
  const restColumnId = `${restSermonId}:column:stillness`;
  const restSermonBlocks: JournalBlock[] = [
    {
      id: `${restSermonId}:section:text`,
      kind: 'section',
      text: 'The text',
    },
    {
      id: `${restSermonId}:text:introduction`,
      kind: 'text',
      text: 'Stillness is not an empty life. It is a life that has stopped trying to do God’s part.',
    },
    {
      id: `${restSermonId}:scripture:psalm46`,
      kind: 'scripture',
      text: 'Psalm 46:10',
      scriptureText:
        'Cease striving and know that I am God; I will be exalted among the nations, I will be exalted on the earth.',
      scriptureReference: 'Psalm 46:10',
      scriptureVersion: 'NASB',
    },
    {
      id: `${restSermonId}:scripture:matt11`,
      kind: 'scripture',
      text: 'Matthew 11:28–30',
      scriptureText:
        'Come to Me, all who are weary and burdened, and I will give you rest. Take My yoke upon you and learn from Me, for I am gentle and humble in heart, and you will find rest for your souls.',
      scriptureReference: 'Matthew 11:28–30',
      scriptureVersion: 'NASB',
    },
    {
      id: `${restSermonId}:language:raphah`,
      kind: 'language',
      text: 'רָפָה',
      englishWord: 'be still',
      languageKind: 'hebrew',
      languageDetails: ['meaning', 'transliteration', 'scripture'],
      meaning:
        'To let go, to loosen the grip, to stop striving—the word behind "be still."',
      secondary: 'rah-FAH',
      origin: 'Strength that arrives when your own hands finally open.',
      reference: 'Psalm 46:10',
    },
    {
      id: `${restSermonId}:history:siege`,
      kind: 'history',
      text: '',
      historyTypes: ['era', 'politics'],
      secondary: 'Eighth century',
      eraPeriod: 'BC',
      note: 'Psalm 46 was likely sung while Jerusalem was under Assyrian siege. "Be still" was spoken to a city surrounded by an army—not to someone having a quiet morning.',
      reference: 'Psalm 46:1–11',
    },
    {
      id: `${restSermonId}:section:message`,
      kind: 'section',
      text: 'The message',
    },
    {
      id: `${restSermonId}:outline`,
      kind: 'outline',
      text: 'The rest that trusts',
      outlineStyle: 'numbered',
      points: [
        'Striving says: it all depends on me',
        'Stillness says: it all depends on Him',
        'Exaltation is His job, not ours',
      ],
    },
    {
      id: `${restSermonId}:section:point-1`,
      kind: 'section',
      text: 'Striving says: it all depends on me',
      sectionSource: 'outline',
    },
    {
      id: `${restSermonId}:bullets:striving`,
      kind: 'bullets',
      text: 'Where I strive instead of trust',
      points: [
        'Refreshing the inbox at red lights',
        'Reopening decisions I already made',
        'Calling exhaustion "faithfulness"',
      ],
    },
    {
      id: `${restSermonId}:question`,
      kind: 'question',
      text: 'What am I carrying this week that was never mine to hold?',
    },
    {
      id: `${restSermonId}:section:point-2`,
      kind: 'section',
      text: 'Stillness says: it all depends on Him',
      sectionSource: 'outline',
    },
    {
      id: `${restSermonId}:key`,
      kind: 'key',
      text: 'Rest is not the absence of work; it is the presence of trust.',
    },
    {
      id: `${restSermonId}:quote:augustine`,
      kind: 'quote',
      text: 'You have made us for Yourself, O Lord, and our heart is restless until it rests in You.',
      secondary: 'Augustine, Confessions',
    },
    {
      id: `${restSermonId}:character:korah`,
      kind: 'character',
      text: 'The sons of Korah',
      note: 'Descendants of a rebel who became temple singers. God writes new songs out of old failures.',
      secondary: 'Psalm 46 superscription',
    },
    {
      id: `${restSermonId}:section:point-3`,
      kind: 'section',
      text: 'Exaltation is His job, not ours',
      sectionSource: 'outline',
    },
    {
      id: `${restSermonId}:table`,
      kind: 'table',
      text: '',
      tableRows: [
        ['Striving', 'Stillness'],
        ['It all depends on me', 'It all depends on Him'],
        ['Peace only when finished', 'Peace before I begin'],
        ['Collapse at the end', 'Rest along the way'],
      ],
      tableCellAlignments: [
        ['left', 'left'],
        ['left', 'left'],
        ['left', 'left'],
        ['left', 'left'],
      ],
    },
    {
      id: restColumnId,
      kind: 'column',
      text: '',
    },
    {
      id: `${restSermonId}:photo:sanctuary`,
      kind: 'photo',
      text: 'Second service, back row—the light through the windows was doing something.',
      uri:
        Image.resolveAssetSource(
          require('../../../assets/images/mockup/sermon-church-pews.jpg'),
        )?.uri || 'review-qa://sermon-rest-pews',
      parentColumnId: restColumnId,
      columnSide: 'left',
    },
    {
      id: `${restSermonId}:column-bullets`,
      kind: 'bullets',
      text: 'What stillness is not',
      points: ['Laziness', 'Escape', 'Doing nothing forever'],
      parentColumnId: restColumnId,
      columnSide: 'right',
    },
    {
      id: `${restSermonId}:remember`,
      kind: 'remember',
      text: 'He does not need me to hold the world up.',
    },
    {
      id: `${restSermonId}:section:response`,
      kind: 'section',
      text: 'My response',
    },
    {
      id: `${restSermonId}:reflection-question`,
      kind: 'reflection_question',
      text: 'Where did I confuse motion with faithfulness?',
      note: 'The commute, the inbox, replaying the same decision three times.',
    },
    {
      id: `${restSermonId}:numbered:practice`,
      kind: 'numbered',
      text: 'Sabbath practice this week',
      points: [
        'One unhurried hour—phone in a drawer',
        'A walk without a podcast',
        'End the day naming three things God held without me',
      ],
    },
    {
      id: `${restSermonId}:action`,
      kind: 'action',
      text: 'Protect one unhurried hour Saturday morning—no errands, no inbox',
      completed: false,
    },
    {
      id: `${restSermonId}:voice:benediction`,
      kind: 'voice',
      text: 'Recorded the benediction to replay midweek when the noise comes back.',
      uri: 'bundle://streak_celebration.mp3',
      durationMillis: 41000,
    },
    {
      id: `${restSermonId}:song`,
      kind: 'song',
      text: 'Be Still My Soul',
      secondary: 'Kari Jobe',
    },
    {
      id: `${restSermonId}:book`,
      kind: 'book',
      text: 'The Ruthless Elimination of Hurry',
      secondary: 'John Mark Comer',
    },
    {
      id: `${restSermonId}:link`,
      kind: 'link',
      text: 'bible.com/bible/100/PSA.46.NASB1995',
    },
    {
      id: `${restSermonId}:revisit`,
      kind: 'revisit',
      text: 'Come back to the striving vs. stillness table when the week starts sprinting.',
      secondary: 'Next Sabbath',
    },
    {
      id: `${restSermonId}:response`,
      kind: 'response',
      text: 'Stop reopening settled decisions. When I notice the loop, say the verse out loud and hand it back.',
    },
    {
      id: `${restSermonId}:prayer`,
      kind: 'prayer',
      text: 'Father, my hands are tired from gripping. I release what was never mine to hold. Teach me the stillness that trusts. Amen.',
    },
  ];
  await putReflection(manifest, {
    id: restSermonId,
    server_id: null,
    linked_account_id: null,
    title: 'The Rest That Trusts',
    content: JSON.stringify({
      format: 'sermon_notes_v1',
      blocks: restSermonBlocks,
    }),
    type: 'sermon',
    source: 'sermon_notes',
    tags: ['sermon'],
    selected_date: '2026-09-27',
    metadata: {
      is_complete: true,
      sessionNoteType: 'sermon',
      main_scripture: 'Psalm 46:10',
      series: 'Rhythms of Grace',
      part: 'Part 3',
      speaker: 'Pastor Daniel Whitfield',
      church: 'Grace Community Church',
      notice:
        'God is exalted over the nations and over my to-do list. Stillness is not surrendering control—it is admitting I never had it.',
      carry:
        '"Be still" is not a personality trait reserved for calm people. It is a command backed by His sovereignty—I can stop because He does not.',
      prayer:
        'Practice stopping on purpose—one unhurried Sabbath hour this week, no errands, no inbox.',
      prayer_answer:
        'Lord, quiet the part of me that believes everything depends on my effort. Teach me to be still and know that You are God. Amen.',
    },
    created_at: '2026-09-27T11:48:00.000Z',
    updated_at: '2026-09-27T13:05:00.000Z',
    version: 1,
    sync_status: 'local',
    deleted: false,
  });

  const weekPrefix = `${REVIEW_QA_PREFIX}mockup-week`;
  const weekReflections: LocalReflectionEntry[] = [
    {
      id: `${weekPrefix}-heart-commute`,
      server_id: null,
      title: 'The commute did me a favor',
      content:
        'Traffic stacked up on the bridge and I just sat in it instead of fighting it. Forty minutes of nothing to do but notice the light on the water.\n\nCalled Mom from the car. She was mid-recipe and talked with her hands anyway, like I could see her through the phone.\n\nI keep saying I have no margin. Apparently I had forty minutes of it, parked on the bridge.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-21',
      tags: ['heart-journal'],
      metadata: {journalClassification: 'thoughts'},
      created_at: '2026-09-21T08:47:00.000Z',
      updated_at: '2026-09-21T08:47:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
    {
      id: `${weekPrefix}-heart-hardware`,
      server_id: null,
      title: 'Hardware store list',
      content:
        'Collecting it here so Saturday-me doesn’t wander the aisles like a tourist.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-21',
      tags: ['heart-journal'],
      metadata: {
        journalClassification: 'notes',
        journalBlocks: [
          {
            id: `${weekPrefix}-heart-hardware:list`,
            kind: 'bullets',
            text: 'Saturday run',
            points: [
              'Weatherstripping for the back door',
              'Molly bolts for the hallway shelf',
              'Paint tape and one good brush',
              'Ask about the drawer slide that keeps sticking',
            ],
          },
        ] satisfies JournalBlock[],
      },
      created_at: '2026-09-21T19:22:00.000Z',
      updated_at: '2026-09-21T19:22:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
    {
      id: `${weekPrefix}-heart-meeting`,
      server_id: null,
      title: 'The meeting I almost skipped',
      content:
        'I nearly declined the Tuesday touch-base because nothing was on fire. Turned out to be the first honest conversation we’ve had about the roadmap in months.\n\nI said the quiet part out loud—that the timeline only works if we stop pretending it does. Nobody gasped. Priya actually laughed and said she’d been waiting for someone to name it.\n\nNote to self: the meetings I want to skip are usually the ones worth keeping.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-22',
      tags: ['heart-journal'],
      metadata: {
        journalClassification: 'reflection',
        journalBlocks: [
          {
            id: `${weekPrefix}-heart-meeting:key`,
            kind: 'key',
            text: 'Saying the quiet part out loud was the whole meeting.',
          },
          {
            id: `${weekPrefix}-heart-meeting:quote`,
            kind: 'quote',
            text: 'I’ve been waiting for someone to name it.',
            secondary: 'Priya, in the meeting I almost skipped',
          },
        ] satisfies JournalBlock[],
      },
      created_at: '2026-09-22T17:05:00.000Z',
      updated_at: '2026-09-22T17:05:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
    {
      id: `${weekPrefix}-heart-called-it-early`,
      server_id: null,
      title: 'Called it early',
      content:
        'Nothing dramatic. A workday that ended on time, soup for dinner, and forty pages of the book I’m pretending I’m not racing to finish.\n\nI keep grading days by what they produce. This one produced nothing but calm and I’m calling it good.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-23',
      tags: ['heart-journal'],
      metadata: {journalClassification: 'thoughts'},
      created_at: '2026-09-23T21:12:00.000Z',
      updated_at: '2026-09-23T21:12:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
    {
      id: `${weekPrefix}-heart-head`,
      server_id: null,
      title: 'Everything in my head at 11pm',
      content: 'Just emptying the pockets of the day before bed.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-23',
      tags: ['heart-journal'],
      metadata: {
        journalClassification: 'brain_dump',
        journalBlocks: [
          {
            id: `${weekPrefix}-heart-head:list`,
            kind: 'bullets',
            text: 'Loose ends',
            points: [
              'Text June back—it’s been nine days',
              'The drawer still sticks',
              'Book the dentist, finally',
              'Mom’s birthday is in three weeks—think of something real',
            ],
          },
        ] satisfies JournalBlock[],
      },
      created_at: '2026-09-23T23:04:00.000Z',
      updated_at: '2026-09-23T23:04:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
    {
      id: `${weekPrefix}-heart-shelves`,
      server_id: null,
      title: 'Shelves for the hallway',
      content:
        'The hallway wall has been blank for a year. Two floating shelves, plants on top, the framed prints that never got hung.\n\nIf the anchors hold, it changes the whole walk from the door to the kitchen.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-23',
      tags: ['heart-journal'],
      metadata: {
        journalClassification: 'idea',
        journalBlocks: [
          {
            id: `${weekPrefix}-heart-shelves:steps`,
            kind: 'numbered',
            text: 'Order of operations',
            points: [
              'Measure the wall and mark the studs',
              'Buy shelves that fit the 30-inch gap',
              'Borrow the level from Marcus',
              'Hang plants last so they don’t get bumped',
            ],
          },
          {
            id: `${weekPrefix}-heart-shelves:action`,
            kind: 'action',
            text: 'Borrow the level from Marcus this weekend',
            completed: false,
          },
        ] satisfies JournalBlock[],
      },
      created_at: '2026-09-23T13:40:00.000Z',
      updated_at: '2026-09-23T13:40:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
    {
      id: `${weekPrefix}-heart-flat-tire`,
      server_id: null,
      title: 'What the flat tire taught me',
      content:
        'Right rear, completely flat, discovered at 7:40 in the morning when I was already behind.\n\nAAA took forty minutes. I spent twenty of them annoyed and the last twenty sitting on the curb watching the neighborhood actually wake up. The dog walkers. The sprinkler timing on the corner house. I never see any of it because I’m always already gone.\n\nThe tire was $180 and the lesson was free: I don’t have a margin problem, I have a pace problem. God is so faithful in the small logistics too—the spare was actually inflated.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-24',
      tags: ['heart-journal'],
      metadata: {journalClassification: 'lesson'},
      created_at: '2026-09-24T09:15:00.000Z',
      updated_at: '2026-09-24T09:15:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
    {
      id: `${weekPrefix}-heart-letter-june`,
      server_id: null,
      title: 'Dear June',
      content:
        'Dear June,\n\nI owe you a real reply, not the emoji I sent at midnight. The job news deserved a phone call and I gave you a thumbs up. I’m sorry.\n\nI’m proud of you for leaving. I know it cost you something to walk away from the safe seat.\n\nDinner soon. My place, my cooking, which means we might end up ordering pizza anyway, and that’s fine.\n\n— N',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-24',
      tags: ['heart-journal'],
      metadata: {journalClassification: 'letter'},
      created_at: '2026-09-24T22:31:00.000Z',
      updated_at: '2026-09-24T22:31:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
    {
      id: `${weekPrefix}-heart-slow-saturday`,
      server_id: null,
      title: 'Slow Saturday',
      content:
        'Farmers market before the crowds. Peaches, eggs, the bread guy remembering my name—which is embarrassing how good it felt.\n\nCame home and did nothing impressive. Laundry. An hour on the couch with a book I keep restarting.\n\nNothing to optimize today. It was enough.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-26',
      tags: ['heart-journal'],
      metadata: {journalClassification: 'thoughts'},
      created_at: '2026-09-26T11:08:00.000Z',
      updated_at: '2026-09-26T11:08:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
    {
      id: `${weekPrefix}-heart-dream-house`,
      server_id: null,
      title: 'The old house on Delaney',
      content:
        'Dreamed I was back in the Delaney Street house, except all the rooms kept going—every door opened into another room I’d never seen. Mom was cooking in a kitchen that doesn’t exist and it smelled like her cooking anyway.\n\nWoke up missing a house that isn’t ours anymore. Called it a dream but it felt like a visit.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-26',
      tags: ['heart-journal'],
      metadata: {journalClassification: 'other:Dream'},
      created_at: '2026-09-26T07:41:00.000Z',
      updated_at: '2026-09-26T07:41:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
    {
      id: `${weekPrefix}-heart-quiet-sunday`,
      server_id: null,
      title: 'A quiet Sunday',
      content:
        'Church, then the long way home because the morning deserved a few extra minutes.\n\nThe line from the sermon kept circling all afternoon. I’m still thinking about what rest actually is—not collapse, but trust. The kind that lets the work wait because it isn’t mine to hold the world up.\n\nI want more Sundays that feel like Sunday.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-27',
      tags: ['heart-journal'],
      metadata: {
        journalClassification: 'reflection',
        journalBlocks: [
          {
            id: `${weekPrefix}-heart-quiet-sunday:scripture`,
            kind: 'scripture',
            text: 'Psalm 46:10',
            scriptureText: 'Be still, and know that I am God.',
            scriptureReference: 'Psalm 46:10',
            scriptureVersion: 'NASB',
          },
          {
            id: `${weekPrefix}-heart-quiet-sunday:remember`,
            kind: 'remember',
            text: 'Rest is trust, not collapse.',
          },
        ] satisfies JournalBlock[],
      },
      created_at: '2026-09-27T15:26:00.000Z',
      updated_at: '2026-09-27T15:26:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
    {
      id: `${weekPrefix}-heart-lines`,
      server_id: null,
      title: 'Lines I don’t want to lose',
      content: 'Collected the ones I kept rereading this week.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-27',
      tags: ['heart-journal'],
      metadata: {
        journalClassification: 'notes',
        journalBlocks: [
          {
            id: `${weekPrefix}-heart-lines:quote`,
            kind: 'quote',
            text: 'You can only become really accomplished at something you love. Don’t make money your goal.',
            secondary: 'Maya Angelou',
          },
        ] satisfies JournalBlock[],
      },
      created_at: '2026-09-27T20:02:00.000Z',
      updated_at: '2026-09-27T20:02:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
  ];
  for (const entry of weekReflections) {
    await putReflection(manifest, entry);
  }

  const weekPrayers: LocalPrayerEntry[] = [
    {
      id: `${weekPrefix}-prayer-dad`,
      server_id: null,
      linked_account_id: null,
      content:
        'Lord, give Dad strength for the appointment Tuesday and peace about whatever the results say.',
      prayer_type: 'people',
      person_name: 'Dad',
      selected_date: '2026-09-21',
      prayed: true,
      prayer_count: 1,
      last_prayed_at: '2026-09-21T21:00:00.000Z',
      status: 'pending',
      metadata: {
        track_answered: true,
        is_active: true,
        tracking_status: 'pending',
      },
      created_at: '2026-09-21T21:00:00.000Z',
      updated_at: '2026-09-21T21:00:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
    },
    {
      id: `${weekPrefix}-prayer-margin`,
      server_id: null,
      linked_account_id: null,
      content:
        'God, teach me to move slower this week. Let me leave margin instead of stealing it.',
      prayer_type: 'journal',
      journal_category: 'personal_prayer',
      selected_date: '2026-09-21',
      prayed: true,
      prayer_count: 1,
      last_prayed_at: '2026-09-21T07:50:00.000Z',
      status: 'pending',
      metadata: {
        track_answered: true,
        is_active: true,
        tracking_status: 'pending',
      },
      created_at: '2026-09-21T07:50:00.000Z',
      updated_at: '2026-09-21T07:50:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
    },
    {
      id: `${weekPrefix}-prayer-jordan`,
      server_id: null,
      linked_account_id: null,
      content:
        'Be close to Jordan while the job hunt drags on. Open the right door, not just any door.',
      prayer_type: 'people',
      person_name: 'Jordan',
      selected_date: '2026-09-22',
      prayed: true,
      prayer_count: 2,
      last_prayed_at: '2026-09-25T08:10:00.000Z',
      status: 'pending',
      metadata: {
        track_answered: true,
        is_active: true,
        tracking_status: 'pending',
      },
      created_at: '2026-09-22T20:14:00.000Z',
      updated_at: '2026-09-25T08:10:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
    },
    {
      id: `${weekPrefix}-prayer-lease`,
      server_id: null,
      linked_account_id: null,
      content:
        'Thank You for the peace about the apartment. Help me know whether staying is right.',
      prayer_type: 'journal',
      journal_category: 'thanksgiving',
      selected_date: '2026-09-23',
      prayed: true,
      prayer_count: 3,
      last_prayed_at: '2026-09-25T12:00:00.000Z',
      status: 'answered',
      answered_date: '2026-09-25T20:30:00.000Z',
      metadata: {
        track_answered: true,
        is_active: false,
        tracking_status: 'answered',
        answer_history: [
          {
            id: `${weekPrefix}-prayer-lease:answer:1`,
            date: '2026-09-25T20:30:00.000Z',
            note: 'Signed the lease Friday. It wasn’t dramatic—it was just settled.',
          },
        ],
      },
      created_at: '2026-09-23T21:40:00.000Z',
      updated_at: '2026-09-25T20:30:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
    },
    {
      id: `${weekPrefix}-prayer-car`,
      server_id: null,
      linked_account_id: null,
      content:
        'For the car repair and the week ahead—provide, and help me not panic over $180.',
      prayer_type: 'journal',
      journal_category: 'supplication',
      selected_date: '2026-09-24',
      prayed: true,
      prayer_count: 1,
      last_prayed_at: '2026-09-24T09:30:00.000Z',
      status: 'pending',
      metadata: {
        track_answered: true,
        is_active: true,
        tracking_status: 'pending',
      },
      created_at: '2026-09-24T09:30:00.000Z',
      updated_at: '2026-09-24T09:30:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
    },
    {
      id: `${weekPrefix}-prayer-aunt-lorna`,
      server_id: null,
      linked_account_id: null,
      content:
        'Hold Aunt Lorna through recovery. Let the surgery be the end of it.',
      prayer_type: 'people',
      person_name: 'Aunt Lorna',
      selected_date: '2026-09-24',
      prayed: true,
      prayer_count: 4,
      last_prayed_at: '2026-09-27T10:00:00.000Z',
      status: 'answered',
      answered_date: '2026-09-27T10:05:00.000Z',
      metadata: {
        track_answered: true,
        is_active: false,
        tracking_status: 'answered',
        prayer_updates: [
          {
            id: `${weekPrefix}-prayer-aunt-lorna:update:1`,
            date: '2026-09-26T14:00:00.000Z',
            text: 'Surgery went well; she’s home and resting.',
            kind: 'situation-changed',
          },
        ],
        answer_history: [
          {
            id: `${weekPrefix}-prayer-aunt-lorna:answer:1`,
            date: '2026-09-27T10:05:00.000Z',
            note: 'The doctor said the scans came back clean.',
          },
        ],
      },
      created_at: '2026-09-24T18:22:00.000Z',
      updated_at: '2026-09-27T10:05:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
    },
    {
      id: `${weekPrefix}-prayer-soft-words`,
      server_id: null,
      linked_account_id: null,
      content:
        'I was short with Mom on the phone Thursday. Forgive me, and give me softer words tomorrow.',
      prayer_type: 'journal',
      journal_category: 'confession',
      selected_date: '2026-09-26',
      prayed: true,
      prayer_count: 1,
      last_prayed_at: '2026-09-26T22:47:00.000Z',
      status: 'pending',
      metadata: {
        track_answered: true,
        is_active: true,
        tracking_status: 'pending',
      },
      created_at: '2026-09-26T22:47:00.000Z',
      updated_at: '2026-09-26T22:47:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
    },
    {
      id: `${weekPrefix}-prayer-coastline`,
      server_id: null,
      linked_account_id: null,
      content:
        'You are the God who paints coastlines and numbers hairs. I saw it Friday at the water and I don’t want to unsee it.',
      prayer_type: 'journal',
      journal_category: 'adoration',
      selected_date: '2026-09-27',
      prayed: true,
      prayer_count: 1,
      last_prayed_at: '2026-09-27T08:15:00.000Z',
      status: 'pending',
      metadata: {
        track_answered: true,
        is_active: true,
        tracking_status: 'pending',
      },
      created_at: '2026-09-27T08:15:00.000Z',
      updated_at: '2026-09-27T08:15:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
    },
  ];
  for (const prayer of weekPrayers) {
    await putPrayer(manifest, prayer);
  }

  // A finished Weekly Review for the same Sept 21–27 period, plus the three
  // records a real completion writes: the gratitude + looking-forward Moments
  // and the canonical open prayer for the week ahead.
  const reviewId = `${REVIEW_QA_PREFIX}mockup-weekly-review`;
  const prayerAheadText =
    'God, as I enter this week, teach me the stillness of Psalm 46. Keep my hands open—for Jordan’s search, Dad’s results, and my own settling in. You hold the week; I don’t. Amen.';
  const gratitudeItems = [
    'Maya’s offer and the way the whole week bent toward good news.',
    'A spare tire that was actually inflated.',
    'The sermon landing exactly where the week was sore.',
  ];

  await putIndexedRecord(
    manifest,
    `review_local:weekly:${reviewId}`,
    'review_local_index:weekly',
    reviewId,
    {
      id: reviewId,
      type: 'weekly',
      periodStart: MOCKUP_DATA_PERIOD_START,
      periodEnd: MOCKUP_DATA_PERIOD_END,
      status: 'completed',
      lastStageKey: 'ready',
      memorableItems: [
        {
          kind: 'morning',
          id: `${REVIEW_QA_PREFIX}mockup-rhythm:morning_check_in:2026-09-21`,
          selectedDate: '2026-09-21',
        },
        {
          kind: 'reflection',
          id: listeningId,
          selectedDate: '2026-09-21',
        },
        {
          kind: 'scripture',
          id: `${REVIEW_QA_PREFIX}mockup-rhythm:evening-proverb:2026-09-22`,
          selectedDate: '2026-09-22',
        },
        {
          kind: 'gratitude',
          id: `${REVIEW_QA_PREFIX}mockup-rhythm:gratitude:2026-09-24`,
          selectedDate: '2026-09-24',
        },
        {
          kind: 'reflection',
          id: `${weekPrefix}-heart-flat-tire`,
          selectedDate: '2026-09-24',
        },
        {
          kind: 'win',
          id: `${REVIEW_QA_PREFIX}mockup-rhythm:today_win:2026-09-25`,
          selectedDate: '2026-09-25',
        },
        {
          kind: 'reflection',
          id: presentationId,
          selectedDate: '2026-09-25',
        },
        {
          kind: 'reflection',
          id: leaseId,
          selectedDate: '2026-09-25',
        },
        {
          kind: 'prayer',
          id: mayaId,
          selectedDate: '2026-09-21',
        },
        {
          kind: 'prayer',
          id: `${weekPrefix}-prayer-aunt-lorna`,
          selectedDate: '2026-09-24',
        },
        {
          kind: 'sermon',
          id: restSermonId,
          selectedDate: '2026-09-27',
        },
      ],
      prayerSnapshot: [
        {
          id: `prayer-review:new_prayer:${mayaId}::2026-09-21`,
          prayerId: mayaId,
          eventType: 'new_prayer',
          eventDate: '2026-09-21',
          title: 'Maya',
          subtitle: 'New in prayer',
          text: 'Lord, give Maya peace for the interview and wisdom to know whether this role is right for her.',
        },
        {
          id: `prayer-review:new_prayer:${weekPrefix}-prayer-dad::2026-09-21`,
          prayerId: `${weekPrefix}-prayer-dad`,
          eventType: 'new_prayer',
          eventDate: '2026-09-21',
          title: 'Dad',
          subtitle: 'New in prayer',
          text: 'Lord, give Dad strength for the appointment Tuesday and peace about whatever the results say.',
        },
        {
          id: `prayer-review:new_prayer:${weekPrefix}-prayer-jordan::2026-09-22`,
          prayerId: `${weekPrefix}-prayer-jordan`,
          eventType: 'new_prayer',
          eventDate: '2026-09-22',
          title: 'Jordan',
          subtitle: 'New in prayer',
          text: 'Be close to Jordan while the job hunt drags on. Open the right door, not just any door.',
        },
        {
          id: `prayer-review:update:${mayaId}:${mayaId}:update:1:2026-09-23`,
          prayerId: mayaId,
          eventType: 'update',
          eventDate: '2026-09-23',
          title: 'Maya',
          subtitle: 'Something changed',
          text: 'The interview went well. She’s waiting to hear back next week.',
        },
        {
          id: `prayer-review:thanksgiving:${weekPrefix}-prayer-lease::2026-09-23`,
          prayerId: `${weekPrefix}-prayer-lease`,
          eventType: 'thanksgiving',
          eventDate: '2026-09-23',
          title:
            'Thank You for the peace about the apartment. Help me know whe…',
          subtitle: 'What you wrote in Thanksgiving',
          text: 'Thank You for the peace about the apartment. Help me know whether staying is right.',
        },
        {
          id: `prayer-review:new_prayer:${weekPrefix}-prayer-car::2026-09-24`,
          prayerId: `${weekPrefix}-prayer-car`,
          eventType: 'new_prayer',
          eventDate: '2026-09-24',
          title:
            'For the car repair and the week ahead—provide, and help me not …',
          subtitle: 'New in prayer',
          text: 'For the car repair and the week ahead—provide, and help me not panic over $180.',
        },
        {
          id: `prayer-review:new_prayer:${weekPrefix}-prayer-aunt-lorna::2026-09-24`,
          prayerId: `${weekPrefix}-prayer-aunt-lorna`,
          eventType: 'new_prayer',
          eventDate: '2026-09-24',
          title: 'Aunt Lorna',
          subtitle: 'New in prayer',
          text: 'Hold Aunt Lorna through recovery. Let the surgery be the end of it.',
        },
        {
          id: `prayer-review:answer_recorded:${mayaId}:${mayaId}:answer:1:2026-09-25`,
          prayerId: mayaId,
          eventType: 'answer_recorded',
          eventDate: '2026-09-25',
          title: 'Maya',
          subtitle: 'You recorded an answer',
          text: 'Maya received an offer, and the schedule fits the responsibilities she was concerned about.',
        },
        {
          id: `prayer-review:answer_recorded:${weekPrefix}-prayer-lease:${weekPrefix}-prayer-lease:answer:1:2026-09-25`,
          prayerId: `${weekPrefix}-prayer-lease`,
          eventType: 'answer_recorded',
          eventDate: '2026-09-25',
          title:
            'Thank You for the peace about the apartment. Help me know whe…',
          subtitle: 'You recorded an answer',
          text: 'Signed the lease Friday. It wasn’t dramatic—it was just settled.',
        },
        {
          id: `prayer-review:update:${weekPrefix}-prayer-aunt-lorna:${weekPrefix}-prayer-aunt-lorna:update:1:2026-09-26`,
          prayerId: `${weekPrefix}-prayer-aunt-lorna`,
          eventType: 'update',
          eventDate: '2026-09-26',
          title: 'Aunt Lorna',
          subtitle: 'Something changed',
          text: 'Surgery went well; she’s home and resting.',
        },
        {
          id: `prayer-review:answer_recorded:${weekPrefix}-prayer-aunt-lorna:${weekPrefix}-prayer-aunt-lorna:answer:1:2026-09-27`,
          prayerId: `${weekPrefix}-prayer-aunt-lorna`,
          eventType: 'answer_recorded',
          eventDate: '2026-09-27',
          title: 'Aunt Lorna',
          subtitle: 'You recorded an answer',
          text: 'The doctor said the scans came back clean.',
        },
        {
          id: `prayer-review:still_carrying:${weekPrefix}-prayer-dad::2026-09-27`,
          prayerId: `${weekPrefix}-prayer-dad`,
          eventType: 'still_carrying',
          eventDate: '2026-09-27',
          title: 'Dad',
          subtitle: 'Still carrying',
          text: 'Lord, give Dad strength for the appointment Tuesday and peace about whatever the results say.',
        },
        {
          id: `prayer-review:still_carrying:${weekPrefix}-prayer-jordan::2026-09-27`,
          prayerId: `${weekPrefix}-prayer-jordan`,
          eventType: 'still_carrying',
          eventDate: '2026-09-27',
          title: 'Jordan',
          subtitle: 'Still carrying',
          text: 'Be close to Jordan while the job hunt drags on. Open the right door, not just any door.',
        },
      ],
      answers: {
        week_feelings: 'Grateful|Stretched|Settled',
        week_check_in_mind: 'okay',
        week_check_in_body: 'struggling',
        week_check_in_relationships: 'well',
        week_check_in_work: 'well',
        week_check_in_finances: 'okay',
        week_check_in_responsibilities: 'well',
        week_check_in_rest: 'struggling',
        week_check_in_with_god: 'well',
        week_memory_other:
          'The light on the water while I was parked in bridge traffic. Forty minutes of margin I didn’t plan.',
        week_difficulty:
          'The lease decision circled for two weeks before Friday. Thursday’s flat tire ate the morning, and I was shorter with Mom than I want to be.',
        notice: gratitudeItems[0],
        weekly_gratitude_2: gratitudeItems[1],
        weekly_gratitude_3: gratitudeItems[2],
        god: 'Answered a prayer|Gave me peace|In the ordinary',
        week_learning:
          'I keep grading days by what they produce. This week taught me that margin isn’t wasted time—it’s where I actually notice things.',
        priority_1: 'Settle into the apartment on purpose',
        priority_2: 'Practice the Sabbath hour the sermon asked for',
        priority_3: 'Call June back—for real this time',
        week_care_areas: 'rest|relationships',
        dont_forget:
          'Mom’s birthday is in three weeks. Plan something real, not a last-minute card.',
        week_challenge_choices: 'overcommitting|putting_things_off',
        week_looking_forward_emotion: 'calm',
        week_looking_forward:
          'Slower mornings in a home I chose on purpose, shelves finally going up Saturday, and Mom’s birthday call turning into an actual visit.',
        prayer_ahead: prayerAheadText,
      },
      createdAt: '2026-09-28T19:40:00.000Z',
      updatedAt: '2026-09-28T20:15:00.000Z',
      completedAt: '2026-09-28T20:15:00.000Z',
    },
  );

  const reviewMomentMetadata = {
    source: 'weekly_review',
    reviewId,
    periodStart: MOCKUP_DATA_PERIOD_START,
    periodEnd: MOCKUP_DATA_PERIOD_END,
  };
  const gratitudeMomentKey = `journal_local_singleton:weekly_gratitude:${MOCKUP_DATA_PERIOD_END}`;
  await rememberReplacement(manifest, gratitudeMomentKey);
  await AsyncStorage.setItem(
    gratitudeMomentKey,
    JSON.stringify({
      id: `${REVIEW_QA_PREFIX}mockup-weekly-gratitude`,
      server_id: null,
      content_type: 'weekly_gratitude',
      selected_date: MOCKUP_DATA_PERIOD_END,
      content: JSON.stringify({
        text: gratitudeItems[0],
        items: gratitudeItems,
        periodStart: MOCKUP_DATA_PERIOD_START,
        periodEnd: MOCKUP_DATA_PERIOD_END,
      }),
      metadata: reviewMomentMetadata,
      created_at: '2026-09-28T19:58:00.000Z',
      updated_at: '2026-09-28T19:58:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
    }),
  );

  const lookingForwardKey = `journal_local_singleton:weekly_looking_forward:${MOCKUP_DATA_PERIOD_END}`;
  await rememberReplacement(manifest, lookingForwardKey);
  await AsyncStorage.setItem(
    lookingForwardKey,
    JSON.stringify({
      id: `${REVIEW_QA_PREFIX}mockup-weekly-looking-forward`,
      server_id: null,
      content_type: 'weekly_looking_forward',
      selected_date: MOCKUP_DATA_PERIOD_END,
      content: JSON.stringify({
        title: 'Looking forward to this week',
        entry: {
          text: 'Slower mornings in a home I chose on purpose, shelves finally going up Saturday, and Mom’s birthday call turning into an actual visit.',
        },
        emotionId: 'calm',
        emotionIcon: 'weather-sunny',
        emotionName: 'Calm',
        customEmotion: '',
        periodStart: MOCKUP_DATA_PERIOD_START,
        periodEnd: MOCKUP_DATA_PERIOD_END,
      }),
      metadata: reviewMomentMetadata,
      created_at: '2026-09-28T20:02:00.000Z',
      updated_at: '2026-09-28T20:02:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
    }),
  );

  await putPrayer(manifest, {
    id: `${REVIEW_QA_PREFIX}mockup-weekly-open-prayer`,
    server_id: null,
    linked_account_id: null,
    content: prayerAheadText,
    prayer_type: 'journal',
    journal_category: 'personal_prayer',
    selected_date: MOCKUP_DATA_PERIOD_END,
    prayed: true,
    prayer_count: 1,
    last_prayed_at: '2026-09-28T20:10:00.000Z',
    status: 'pending',
    metadata: {
      prayer_style: 'open',
      source: 'weekly_review',
      origin: 'weekly_review',
      review_type: 'weekly',
      reviewId,
      weeklyReviewId: reviewId,
      periodStart: MOCKUP_DATA_PERIOD_START,
      periodEnd: MOCKUP_DATA_PERIOD_END,
      tags: ['weekly'],
      track_answered: true,
      is_active: true,
      tracking_status: 'pending',
    },
    created_at: '2026-09-28T20:10:00.000Z',
    updated_at: '2026-09-28T20:10:00.000Z',
    version: 1,
    sync_status: 'local',
    deleted: false,
  });

  // A finished Monthly Review for August 2026—the month that raised the
  // apartment question September answered. A few August moments are seeded so
  // the review's bookmarked items resolve to real records.
  const augPrefix = `${REVIEW_QA_PREFIX}mockup-aug`;
  const augReflections: LocalReflectionEntry[] = [
    {
      id: `${augPrefix}-heart-delaney`,
      server_id: null,
      title: 'Toured the place on Delaney',
      content:
        'Walked through a rental on Delaney Street on my lunch break. Good light, small kitchen, rent that only barely works.\n\nI keep collecting options like one of them will feel certain. None do. Home might just be where I stop looking.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-08-15',
      tags: ['heart-journal'],
      metadata: {journalClassification: 'thoughts'},
      created_at: '2026-08-15T13:20:00.000Z',
      updated_at: '2026-08-15T13:20:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
    {
      id: `${augPrefix}-heart-late-summer`,
      server_id: null,
      title: 'Last slow Friday of August',
      content:
        'Took the long way home past the water. The light does that late-August thing where everything looks like it’s already a memory.\n\nNothing happened. That was the point.',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-08-28',
      tags: ['heart-journal'],
      metadata: {journalClassification: 'reflection'},
      created_at: '2026-08-28T19:40:00.000Z',
      updated_at: '2026-08-28T19:40:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
      linked_account_id: null,
    },
  ];
  for (const entry of augReflections) {
    await putReflection(manifest, entry);
  }

  const augGratitudeId = `${augPrefix}:gratitude:2026-08-20`;
  await putIndexedRecord(
    manifest,
    `journal_local:gratitude:2026-08-20:${augGratitudeId}`,
    'journal_local_index:gratitude:2026-08-20',
    augGratitudeId,
    {
      id: augGratitudeId,
      server_id: null,
      content_type: 'gratitude',
      selected_date: '2026-08-20',
      content: JSON.stringify({
        items: [
          'Mom’s call landing exactly when I needed it',
          'A full night of sleep after a loud week',
          'The Delaney lead arriving the day I stopped refreshing listings',
        ],
      }),
      metadata: {source: 'evening'},
      created_at: '2026-08-20T20:05:00.000Z',
      updated_at: '2026-08-20T20:05:00.000Z',
      version: 1,
      sync_status: 'local',
      deleted: false,
    },
  );

  const augScriptureId = `${augPrefix}-scripture-proverbs-3`;
  await putReflection(manifest, {
    id: augScriptureId,
    server_id: null,
    linked_account_id: null,
    title: 'Proverbs 3',
    content:
      'Trust in the LORD with all your heart (Proverbs 3:5–6)\nKeep choosing trust in the rooms where I usually choose control.',
    type: 'scripture',
    source: 'evening_proverbs',
    selected_date: '2026-08-22',
    tags: ['evening', 'proverbs'],
    metadata: {
      source: 'evening_proverbs',
      proverbNumber: 3,
      proverbRead: true,
      proverbReference: 'Proverbs 3',
      selectedWisdomIds: ['3-1'],
      selectedWisdom: [
        {
          id: '3-1',
          label: 'Trust the LORD',
          verses: 'Proverbs 3:5–6',
        },
      ],
      customWisdom: '',
      wisdomApplication: '',
      wisdomApplications: {
        '3-1':
          'Take the next faithful step without demanding certainty about the outcome.',
      },
    },
    created_at: '2026-08-22T20:20:00.000Z',
    updated_at: '2026-08-22T20:35:00.000Z',
    version: 1,
    sync_status: 'local',
    deleted: false,
  });

  const augPrayerId = `${augPrefix}-prayer-home`;
  await putPrayer(manifest, {
    id: augPrayerId,
    server_id: null,
    linked_account_id: null,
    content:
      'Father, I don’t know whether staying is faithfulness or fear. Show me what home is supposed to be this year.',
    prayer_type: 'journal',
    journal_category: 'personal_prayer',
    selected_date: '2026-08-06',
    prayed: true,
    prayer_count: 5,
    last_prayed_at: '2026-08-29T08:00:00.000Z',
    status: 'pending',
    metadata: {
      track_answered: true,
      is_active: true,
      tracking_status: 'pending',
      prayer_updates: [
        {
          id: `${augPrayerId}:update:1`,
          date: '2026-08-19T21:00:00.000Z',
          text: 'Toured a rental on Delaney. It didn’t feel like the answer, but it clarified the question.',
          kind: 'situation-changed',
        },
      ],
    },
    created_at: '2026-08-06T22:10:00.000Z',
    updated_at: '2026-08-29T08:00:00.000Z',
    version: 1,
    sync_status: 'local',
    deleted: false,
  });

  const monthlyReviewId = `${REVIEW_QA_PREFIX}mockup-monthly-review`;
  const prayerForMonthText =
    'God, as I enter September, keep me honest about my pace. Let home be a place of rest, keep my hands open about the lease, and teach me to notice You in ordinary afternoons. Amen.';
  await putIndexedRecord(
    manifest,
    `review_local:monthly:${monthlyReviewId}`,
    'review_local_index:monthly',
    monthlyReviewId,
    {
      id: monthlyReviewId,
      type: 'monthly',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      status: 'completed',
      lastStageKey: 'ready',
      memorableItems: [
        {
          kind: 'reflection',
          id: `${augPrefix}-heart-delaney`,
          selectedDate: '2026-08-15',
        },
        {
          kind: 'gratitude',
          id: augGratitudeId,
          selectedDate: '2026-08-20',
        },
        {
          kind: 'scripture',
          id: augScriptureId,
          selectedDate: '2026-08-22',
        },
        {
          kind: 'reflection',
          id: `${augPrefix}-heart-late-summer`,
          selectedDate: '2026-08-28',
        },
        {
          kind: 'prayer',
          id: augPrayerId,
          selectedDate: '2026-08-06',
        },
      ],
      prayerSnapshot: [
        {
          id: `prayer-review:new_prayer:${augPrayerId}::2026-08-06`,
          prayerId: augPrayerId,
          eventType: 'new_prayer',
          eventDate: '2026-08-06',
          title:
            'Father, I don’t know whether staying is faithfulness or fear…',
          subtitle: 'New in prayer',
          text: 'Father, I don’t know whether staying is faithfulness or fear. Show me what home is supposed to be this year.',
        },
        {
          id: `prayer-review:update:${augPrayerId}:${augPrayerId}:update:1:2026-08-19`,
          prayerId: augPrayerId,
          eventType: 'update',
          eventDate: '2026-08-19',
          title:
            'Father, I don’t know whether staying is faithfulness or fear…',
          subtitle: 'Something changed',
          text: 'Toured a rental on Delaney. It didn’t feel like the answer, but it clarified the question.',
        },
        {
          id: `prayer-review:still_carrying:${augPrayerId}::2026-08-31`,
          prayerId: augPrayerId,
          eventType: 'still_carrying',
          eventDate: '2026-08-31',
          title:
            'Father, I don’t know whether staying is faithfulness or fear…',
          subtitle: 'Still carrying',
          text: 'Father, I don’t know whether staying is faithfulness or fear. Show me what home is supposed to be this year.',
        },
      ],
      answers: {
        month_feelings: 'Hopeful|Tired|Other',
        month_feeling_other: 'Held',
        remember_month:
          'The afternoon the Delaney tour made home feel like a decision instead of a search.',
        notice_month:
          'When I hurry, it’s usually because I feel uncertain. The slow mornings produced the clearest thinking all month.',
        month_life_giving:
          'Time with God|A simpler pace|Meaningful conversations',
        month_draining: 'Carrying too much|Financial pressure|Other',
        month_draining_other: 'Waiting on decisions',
        formation_month:
          'Patience that doesn’t feel passive. God may be forming the kind of trust that can sit with an unanswered question.',
        prayer_month:
          'One prayer carried all month, and it taught me more than a quick answer would have.',
        god_month:
          'In the Delaney lead arriving the week I stopped refreshing listings, and in how steady Mom sounded on the phone.',
        month_more_room: 'Rest|Family|Time with God',
        month_more_room_rest: 'Sabbath|Slower mornings',
        month_more_room_family: 'Quality time|Meaningful conversations',
        month_more_room_with_god: 'Prayer|Quiet time',
        month_care_areas: 'rest|finances|other',
        month_care_other: 'The lease paperwork and what comes after it',
        month_leave_behind:
          'Comparison|Striving and self-reliance|Overcommitting',
        month_leave_behind_comparison: 'Comparing timelines',
        month_leave_behind_self_reliance:
          'Carrying what belongs to God|Needing control',
        month_leave_behind_overcommitting:
          'Leaving no margin|Saying yes too quickly',
        next_month_priority_1:
          'Decide about the apartment with peace, not pressure',
        next_month_priority_2: 'Keep one unhurried Sabbath each week',
        next_month_priority_3:
          'Make room for the people I keep meaning to call',
        prayer_for_month: prayerForMonthText,
        month_prayer_ids: augPrayerId,
        release_month:
          'The need to have the whole answer before taking the next step.',
        attention: 'The conversation with Mom I keep softening.',
        continue: 'Morning pages before email.',
        simplify_or_stop: 'Overcommitting weekends.',
        intentional_with: 'June.',
        rhythm: 'An unhurried Sabbath.',
      },
      createdAt: '2026-09-03T19:00:00.000Z',
      updatedAt: '2026-09-03T20:10:00.000Z',
      completedAt: '2026-09-03T20:10:00.000Z',
    },
  );

  // A completed Monthly Review writes its closing prayer as a canonical open
  // prayer dated to the first day of the month ahead.
  await putPrayer(manifest, {
    id: `${REVIEW_QA_PREFIX}mockup-monthly-open-prayer`,
    server_id: null,
    linked_account_id: null,
    content: prayerForMonthText,
    prayer_type: 'journal',
    journal_category: 'personal_prayer',
    selected_date: '2026-09-01',
    prayed: true,
    prayer_count: 1,
    last_prayed_at: '2026-09-03T20:05:00.000Z',
    status: 'pending',
    metadata: {
      prayer_style: 'open',
      source: 'monthly_review',
      origin: 'monthly_review',
      review_type: 'monthly',
      reviewId: monthlyReviewId,
      monthlyReviewId,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      tags: ['monthly'],
      track_answered: true,
      is_active: true,
      tracking_status: 'pending',
    },
    created_at: '2026-09-03T20:05:00.000Z',
    updated_at: '2026-09-03T20:05:00.000Z',
    version: 1,
    sync_status: 'local',
    deleted: false,
  });
};
