import AsyncStorage from '@react-native-async-storage/async-storage';
import {createLocalJournalEntry, saveLocalJournalSingleton} from '../storage/journalStorage';
import {createLocalPrayer} from '../storage/prayerStorage';
import {createLocalReflection} from '../storage/reflectionStorage';
import {
  createLocalReview,
  getOrCreateLocalReviewForPeriod,
  updateLocalReview,
} from '../storage/reviewStorage';
import {toLocalDateString} from '../utils/date';
import {getReviewCapture} from '../services/reviewCaptureService';
import {getWeeklyPeriodFor} from '../services/reviewPeriodService';
import {getReviewSettings} from '../storage/reviewSettingsStorage';
import {saveRoutineState} from '../storage/routineStateStorage';
import {DeviceEventEmitter} from 'react-native';

const PREVIEW_DATA_KEY = 'journal_preview_data:v1';

const dateDaysAgo = (days: number): string => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return toLocalDateString(date);
};

/**
 * Populates development builds once with representative local-first content.
 * It never runs in release builds and never deletes or overwrites user content.
 */
export const seedJournalPreviewData = async (): Promise<boolean> => {
  if (!__DEV__ || await AsyncStorage.getItem(PREVIEW_DATA_KEY)) {return false;}

  const today = dateDaysAgo(0);
  const yesterday = dateDaysAgo(1);
  const threeDaysAgo = dateDaysAgo(3);
  const sixDaysAgo = dateDaysAgo(6);

  const gratitude = await createLocalJournalEntry({
    content_type: 'gratitude',
    selected_date: yesterday,
    content: JSON.stringify({
      items: [
        'A quiet morning and the chance to begin again',
        'A thoughtful conversation with someone I love',
        'God meeting me in the ordinary parts of today',
      ],
    }),
  });

  await createLocalJournalEntry({
    content_type: 'todo',
    selected_date: today,
    content: JSON.stringify({text: 'Call Mom and check in', completed: false, priority: true}),
    completed: false,
    priority: 'high',
  });
  await createLocalJournalEntry({
    content_type: 'todo',
    selected_date: today,
    content: JSON.stringify({text: 'Take a prayer walk after lunch', completed: true, priority: false}),
    completed: true,
  });

  await saveLocalJournalSingleton('morning_check_in', today, JSON.stringify({
    feeling: 'Hopeful',
    feelingIcon: 'sunny-outline',
    feelingIconType: 'ionicon',
    underneathIt: 'I feel rested and ready to pay attention to what God is doing today.',
    scripture: {reference: 'Psalm 46:10', translation: 'NIV'},
  }));
  await saveLocalJournalSingleton('todays_focus', today, JSON.stringify({
    focus: 'Be present',
    category: 'Be present',
    categoryName: 'Be present',
    personalText: 'Move slowly enough to notice people, not only tasks.',
    priorities: [
      {id: 'preview-priority-1', text: 'Finish the project proposal', completed: false},
      {id: 'preview-priority-2', text: 'Make space for prayer', completed: true},
      {id: 'preview-priority-3', text: 'Share dinner without phones', completed: false},
    ],
  }));
  await saveLocalJournalSingleton('today_win', yesterday, JSON.stringify({
    winTypeName: 'A faithful step',
    quietWin: 'I paused before reacting and chose a gentler response.',
  }));
  await saveLocalJournalSingleton('looking_forward', yesterday, JSON.stringify({
    emotionName: 'Peaceful',
    emotionIcon: 'leaf-outline',
    entry: {text: 'Coffee and an unhurried Saturday morning with my family.'},
  }));

  const prayer = await createLocalPrayer({
    title: 'Wisdom for this season',
    content: 'Lord, help me recognize what deserves my attention and release what does not.',
    prayer_type: 'journal',
    journal_category: 'supplication',
    selected_date: today,
    prayed: true,
    prayer_count: 4,
    status: 'pending',
  });
  await createLocalPrayer({
    title: 'For Maya',
    content: 'Peace, strength, and the right support as she begins her new role.',
    prayer_type: 'people',
    selected_date: threeDaysAgo,
    person_name: 'Maya',
    prayed: true,
    prayer_count: 7,
    status: 'pending',
  });
  await createLocalPrayer({
    title: 'An answered prayer',
    content: 'Thank You for opening the door we had been waiting for.',
    prayer_type: 'journal',
    journal_category: 'thanksgiving',
    selected_date: sixDaysAgo,
    prayed: true,
    prayer_count: 9,
    status: 'answered',
    answered_date: yesterday,
  });

  const scripture = await createLocalReflection({
    title: 'Psalm 23',
    content: 'I do not have to rush ahead of the Shepherd. Today I can receive guidance one step at a time.',
    type: 'scripture',
    source: 'morning_psalm',
    selected_date: today,
    tags: ['peace', 'trust'],
    metadata: {
      source: 'morning_psalm',
      psalmNumber: 23,
      psalmRead: true,
      selectedAttributes: ['God guides me', 'God restores me'],
      carry: 'I have what I need for this step.',
    },
  });
  await createLocalReflection({
    title: 'Grace for today',
    content: 'I noticed that I was measuring the day by output. Grace invited me to measure it by presence and faithfulness instead.',
    type: 'free',
    source: 'reflection_log',
    selected_date: threeDaysAgo,
    tags: ['grace', 'presence'],
    metadata: {prompt: 'Where did you notice grace today?'},
  });
  const sermon = await createLocalReflection({
    title: 'Rooted in Love',
    content: JSON.stringify({
      speaker: 'Pastor James',
      scripture: 'Ephesians 3:16–19',
      notes: 'Spiritual strength grows from being rooted in love, not from proving ourselves.',
      keyTakeaway: 'Live this week from belovedness, not for approval.',
    }),
    type: 'sermon',
    source: 'sermon_notes',
    selected_date: sixDaysAgo,
    tags: ['love', 'identity'],
    metadata: {sessionNoteType: 'sermon', speaker: 'Pastor James'},
  });

  await createLocalReview({
    type: 'weekly',
    periodStart: dateDaysAgo(7),
    periodEnd: yesterday,
    status: 'completed',
    memorableItems: [
      {kind: 'gratitude', id: gratitude.id, selectedDate: gratitude.selected_date},
      {kind: 'prayer', id: prayer.id, selectedDate: prayer.selected_date},
      {kind: 'scripture', id: scripture.id, selectedDate: scripture.selected_date},
      {kind: 'sermon', id: sermon.id, selectedDate: sermon.selected_date},
    ],
    answers: {
      notice: 'The best moments happened when I stopped hurrying.',
      god: 'God was faithful through encouragement from people at exactly the right time.',
      heart: 'I felt stretched, but also more willing to trust.',
      scripture: 'I have what I need for this step.',
      prayer: 'Keep teaching me to choose presence over pressure.',
      priority: 'Be present with my family; finish the proposal; protect time with God.',
      faithful_step: 'Begin each workday with ten quiet minutes before opening messages.',
    },
  });

  await AsyncStorage.setItem(PREVIEW_DATA_KEY, new Date().toISOString());
  return true;
};

const periodDate = (periodStart: string, offset: number): string => {
  const [year, month, day] = periodStart.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return toLocalDateString(date);
};

/** Adds a discoverable review for the user's configured week with prayer totals. */
export const seedWeeklyReviewPreviewData = async (weekStart = 'monday'): Promise<boolean> => {
  const settings = await getReviewSettings(weekStart);
  const {periodStart, periodEnd} = getWeeklyPeriodFor(settings.weekEndsOn);
  const weeklyPreviewKey = `journal_preview_data:weekly-review:v4:${periodStart}`;
  if (!__DEV__) {return false;}
  const marker = await AsyncStorage.getItem(weeklyPreviewKey);
  if (marker) {
    const capture = await getReviewCapture(periodStart, periodEnd);
    if (capture.prayerStats.total >= 8 && capture.prayerStats.answered >= 3
      && capture.summary.gratitude >= 3 && capture.summary.reflection >= 2) {
      return false;
    }
  }
  const prayerSeeds = [
    {day: 0, title: 'Clarity for a decision', content: 'Show me the faithful next step.', answered: false, count: 5},
    {day: 1, title: 'Healing for Dad', content: 'Bring strength, rest, and good care.', answered: false, count: 8},
    {day: 2, title: 'A new work opportunity', content: 'Thank You for opening the right door.', answered: true, count: 6},
    {day: 4, title: 'Peace for Maya', content: 'Let her feel held and supported this week.', answered: false, count: 3},
    {day: 6, title: 'Reconciliation', content: 'Thank You for making an honest conversation possible.', answered: true, count: 11},
    {day: 1, title: 'Direction for our family', content: 'Lead us with unity and wisdom in the decision ahead.', answered: false, count: 4},
    {day: 3, title: 'Strength for work', content: 'Thank You for providing the help I needed at the right time.', answered: true, count: 7},
    {day: 5, title: 'Comfort for a friend', content: 'Stay close to Anna in grief and surround her with caring people.', answered: false, count: 2},
  ];

  const prayers = [];
  for (const seed of prayerSeeds) {
    prayers.push(await createLocalPrayer({
      title: seed.title,
      content: seed.content,
      prayer_type: seed.day === 4 ? 'people' : 'journal',
      journal_category: seed.day === 4 ? undefined : 'supplication',
      selected_date: periodDate(periodStart, seed.day),
      person_name: seed.day === 4 ? 'Maya' : undefined,
      prayed: true,
      prayer_count: seed.count,
      last_prayed_at: `${periodDate(periodStart, seed.day)}T19:00:00.000Z`,
      status: seed.answered ? 'answered' : 'pending',
      answered_date: seed.answered ? periodDate(periodStart, seed.day) : undefined,
      metadata: {
        track_answered: true,
        tracking_status: seed.answered ? 'answered' : 'active',
        is_active: !seed.answered,
        prayer_updates: seed.answered ? [{date: periodDate(periodStart, seed.day), text: 'I saw God answer this in a clear and gentle way.'}] : [],
      },
    }));
  }

  const gratitude = await createLocalJournalEntry({
    content_type: 'gratitude',
    selected_date: periodDate(periodStart, 1),
    content: JSON.stringify({
      gratitude: 'Unexpected encouragement from a friend when I needed it most.',
      items: ['Unexpected encouragement from a friend', 'A peaceful walk', 'Enough energy for today'],
    }),
  });
  await createLocalJournalEntry({
    content_type: 'gratitude', selected_date: periodDate(periodStart, 3),
    content: JSON.stringify({gratitude: 'A calm conversation that brought understanding.', items: ['Understanding', 'Good health', 'A shared meal']}),
  });
  await createLocalJournalEntry({
    content_type: 'gratitude', selected_date: periodDate(periodStart, 5),
    content: JSON.stringify({gratitude: 'Rest, laughter, and time outside.', items: ['Deep rest', 'Family laughter', 'Sunlight']}),
  });
  await createLocalJournalEntry({
    content_type: 'todo', selected_date: periodDate(periodStart, 2), completed: true,
    content: JSON.stringify({text: 'Send the encouraging message to Maya', completed: true}),
  });
  const win = await saveLocalJournalSingleton('today_win', periodDate(periodStart, 4), JSON.stringify({
    win: 'I completed the difficult conversation I had been avoiding.',
    text: 'I completed the difficult conversation I had been avoiding.',
    winTypeName: 'Courage',
    quietWin: 'I stayed honest and kind.',
  }));
  await saveLocalJournalSingleton('morning_check_in', periodDate(periodStart, 0), JSON.stringify({
    feeling: 'Open', underneathIt: 'Ready to receive the week instead of controlling it.',
  }));
  await saveLocalJournalSingleton('morning_check_in', periodDate(periodStart, 2), JSON.stringify({
    feeling: 'Stretched', underneathIt: 'There is a lot to hold, and I need grace.',
  }));
  await saveLocalJournalSingleton('morning_check_in', periodDate(periodStart, 5), JSON.stringify({
    feeling: 'Rested', underneathIt: 'Slowing down helped me feel present again.',
  }));
  await saveLocalJournalSingleton('looking_forward', periodDate(periodStart, 3), JSON.stringify({
    text: 'An unhurried dinner with the people I love.',
    looking_forward: 'An unhurried dinner with the people I love.',
    emotionName: 'Hopeful',
    entry: {text: 'An unhurried dinner with the people I love.'},
  }));

  const reflection = await createLocalReflection({
    title: 'What I noticed this week',
    content: 'I am more grounded when prayer is my first response instead of my last resort.',
    type: 'free',
    source: 'reflection_log',
    selected_date: periodDate(periodStart, 5),
    tags: ['prayer', 'trust'],
  });
  await createLocalReflection({
    title: 'Held in uncertainty',
    content: 'I do not need every answer before I can take the next faithful step.',
    type: 'guided', source: 'guided_reflection', selected_date: periodDate(periodStart, 2),
    tags: ['trust', 'guidance'], metadata: {prompt: 'What are you learning to release?'},
  });
  await createLocalReflection({
    title: 'Psalm 46',
    content: 'Stillness is not inactivity; it is remembering who God is.',
    type: 'scripture', source: 'morning_psalm', selected_date: periodDate(periodStart, 4),
    tags: ['stillness'], metadata: {psalmNumber: 46, psalmRead: true, carry: 'Be still and know.'},
  });

  for (const day of [0, 2, 4, 5]) {
    await saveRoutineState('morning', periodDate(periodStart, day), {
      completed: true,
      completed_steps: ['check_in', 'psalm', 'focus', 'priorities'],
    });
  }
  for (const day of [1, 3, 5]) {
    await saveRoutineState('evening', periodDate(periodStart, day), {
      completed: true,
      completed_steps: ['gratitude', 'win', 'proverbs', 'reflection'],
    });
  }

  // A broader history makes Moments, Prayer filters, past reviews, and
  // calendar browsing representative without relying on cloud data.
  const historicalPrayers = [
    {days: 10, title: 'Provision for the next season', content: 'Provide what we need and teach me to trust Your timing.', category: 'supplication' as const, status: 'pending' as const},
    {days: 13, title: 'Thank You for restored energy', content: 'I can see the answer arriving through rest and wise care.', category: 'thanksgiving' as const, status: 'answered' as const},
    {days: 17, title: 'A heart that listens', content: 'Help me listen before speaking and respond with grace.', category: 'confession' as const, status: 'pending' as const},
    {days: 21, title: 'God’s steady character', content: 'You are faithful, patient, and present in every season.', category: 'adoration' as const, status: 'pending' as const},
  ];
  for (const item of historicalPrayers) {
    const selectedDate = dateDaysAgo(item.days);
    await createLocalPrayer({
      title: item.title, content: item.content, prayer_type: 'journal',
      journal_category: item.category, selected_date: selectedDate, prayed: true,
      prayer_count: Math.max(2, 12 - Math.floor(item.days / 3)),
      last_prayed_at: `${selectedDate}T07:30:00.000Z`, status: item.status,
      answered_date: item.status === 'answered' ? dateDaysAgo(9) : undefined,
      metadata: {track_answered: true, tracking_status: item.status === 'answered' ? 'answered' : 'active', is_active: item.status !== 'answered'},
    });
  }
  await createLocalPrayer({
    title: 'Prayer request from Elena', content: 'Please pray for peace and wisdom during my interview process.',
    prayer_type: 'people', person_name: 'Elena', is_prayer_request: true,
    requested_by: 'Elena', selected_date: dateDaysAgo(8), prayed: false,
    prayer_count: 0, status: 'pending',
    metadata: {track_answered: true, tracking_status: 'active', is_active: true},
  });
  await createLocalPrayer({
    title: 'For Daniel and his family', content: 'Give Daniel courage, and bring practical help to his family.',
    prayer_type: 'people', person_name: 'Daniel', selected_date: dateDaysAgo(12),
    prayed: true, prayer_count: 6, last_prayed_at: `${dateDaysAgo(4)}T08:00:00.000Z`, status: 'pending',
    metadata: {
      track_answered: true, tracking_status: 'active', is_active: true,
      prayer_needs: [
        {id: 'preview-need-1', text: 'Courage for Daniel', status: 'active', active: true},
        {id: 'preview-need-2', text: 'Practical support for the family', status: 'active', active: true},
      ],
    },
  });

  const historyEntries = [
    {days: 9, type: 'gratitude', value: {gratitude: 'A solution arrived after I stopped forcing it.', items: ['Good counsel', 'Patience', 'An open door']}},
    {days: 14, type: 'today_win', value: {win: 'I kept a healthy boundary without guilt.', text: 'I kept a healthy boundary without guilt.', winTypeName: 'Growth'}},
    {days: 18, type: 'looking_forward', value: {text: 'A slow weekend and time to read.', looking_forward: 'A slow weekend and time to read.'}},
  ] as const;
  for (const item of historyEntries) {
    if (item.type === 'gratitude') {
      await createLocalJournalEntry({content_type: item.type, selected_date: dateDaysAgo(item.days), content: JSON.stringify(item.value)});
    } else {
      await saveLocalJournalSingleton(item.type, dateDaysAgo(item.days), JSON.stringify(item.value));
    }
  }
  await createLocalReflection({
    title: 'Rooted Before Fruitful', type: 'sermon', source: 'sermon_notes', selected_date: dateDaysAgo(8),
    content: JSON.stringify({speaker: 'Pastor Grace', scripture: 'John 15:1–8', notes: 'Fruit grows from abiding, not striving.', keyTakeaway: 'Stay connected before trying to be productive.'}),
    tags: ['abiding', 'identity'], metadata: {sessionNoteType: 'sermon', speaker: 'Pastor Grace'},
  });
  await createLocalReflection({
    title: 'Choosing peace', type: 'free', source: 'reflection_log', selected_date: dateDaysAgo(11),
    content: 'Peace became possible when I named what was mine to carry and released the rest.', tags: ['peace', 'surrender'],
  });
  await createLocalReflection({
    title: 'Proverbs 3:5–6', type: 'scripture', source: 'evening_proverbs', selected_date: dateDaysAgo(15),
    content: 'Trust is a daily direction, not a single dramatic decision.', tags: ['wisdom', 'trust'],
    metadata: {reference: 'Proverbs 3:5–6', carry: 'Acknowledge Him in every path.'},
  });
  const tomorrow = (() => {
    const value = new Date();
    value.setDate(value.getDate() + 1);
    return toLocalDateString(value);
  })();
  await saveLocalJournalSingleton('todays_focus', tomorrow, JSON.stringify({
    focus: 'Lead with peace', personalText: 'Prepare well, then release the outcome.',
    priorities: [
      {id: 'preview-future-1', text: 'Review the proposal', completed: false},
      {id: 'preview-future-2', text: 'Call Dad after the appointment', completed: false},
      {id: 'preview-future-3', text: 'Protect an hour for rest', completed: false},
    ],
  }));
  for (const days of [8, 10, 12, 15, 18]) {
    await saveRoutineState('morning', dateDaysAgo(days), {completed: true, completed_steps: ['check_in', 'psalm', 'focus', 'priorities']});
  }
  for (const days of [9, 11, 14, 17]) {
    await saveRoutineState('evening', dateDaysAgo(days), {completed: true, completed_steps: ['gratitude', 'win', 'proverbs', 'reflection']});
  }

  const priorStart = periodDate(periodStart, -7);
  const priorEnd = periodDate(periodStart, -1);
  const priorReview = await getOrCreateLocalReviewForPeriod({type: 'weekly', periodStart: priorStart, periodEnd: priorEnd});
  await updateLocalReview({
    ...priorReview, status: 'completed',
    answers: {
      notice: 'I was strongest when I let support in.',
      god: 'God provided through wise counsel and an unexpected open door.',
      heart: 'Less hurried, more honest, and ready to receive help.',
      scripture: 'Trust in the Lord with all your heart. — Proverbs 3:5',
      prayer: 'Thank You for provision; keep forming patience in me.',
      priority_1: 'Keep the boundary that protects rest.', priority_2: 'Follow up with Elena.', priority_3: 'Make the next decision prayerfully.',
      faithful_step: 'Ask for help before I reach exhaustion.',
    },
    memorableItems: [],
  });

  const review = await getOrCreateLocalReviewForPeriod({
    type: 'weekly',
    periodStart,
    periodEnd,
  });
  await updateLocalReview({
    ...review,
    status: 'draft',
    memorableItems: [
      {kind: 'prayer', id: prayers[2].id, selectedDate: prayers[2].selected_date},
      {kind: 'prayer', id: prayers[4].id, selectedDate: prayers[4].selected_date},
      {kind: 'gratitude', id: gratitude.id, selectedDate: gratitude.selected_date},
      {kind: 'win', id: win.id, selectedDate: win.selected_date},
      {kind: 'reflection', id: reflection.id, selectedDate: reflection.selected_date},
    ],
    answers: {
      notice: 'I felt most alive when I stopped rushing and paid attention.',
      god: 'God answered through timely people, an open door, and renewed peace.',
      heart: 'I began the week anxious and ended it more open-handed.',
      scripture: 'Be still, and know that I am God. — Psalm 46:10',
      prayer: 'I am still praying for healing, clarity, and peace for Maya.',
      priority_1: 'Protect quiet time with God.',
      priority_2: 'Be fully present with family.',
      priority_3: 'Finish the work that matters most.',
      dont_forget: 'Follow up on Dad’s appointment.',
      people: 'Make room for Maya and Mom.',
      rest: 'Keep Saturday morning unscheduled.',
      faithful_step: 'Start each morning with ten minutes of prayer before messages.',
    },
  });

  await AsyncStorage.setItem(weeklyPreviewKey, new Date().toISOString());
  DeviceEventEmitter.emit('prayerSaved');
  DeviceEventEmitter.emit('reflection_saved');
  return true;
};
