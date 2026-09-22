import AsyncStorage from '@react-native-async-storage/async-storage';

import {REVIEW_QA_PREFIX} from './reviewQAFixtures';

export interface ReviewQASeedManifest {
  keys: string[];
  restores: Array<{key: string; value: string | null}>;
}

type MorningDay = {
  date: string;
  feeling: string;
  feelingIcon: string;
  feelingIconType: 'ionicons' | 'material';
  underneathIt: string;
  scripture: {reference: string; passageReference: string; poolKey: string};
  psalm?: {
    number: number;
    attributes: string[];
    customAttribute?: string;
  };
  focus?: {
    category: string;
    name: string;
    icon: string;
    iconType: 'ionicons' | 'material' | 'fontawesome';
    personalText: string;
  };
  todos?: Array<{text: string; completed: boolean; priority?: boolean}>;
};

const MORNING_WEEK: MorningDay[] = [
  {
    date: '2026-09-14', feeling: 'Hopeful', feelingIcon: 'sunny-outline', feelingIconType: 'ionicons',
    underneathIt: 'A new week feels like a fresh start. I want to move with purpose without rushing ahead of God.',
    scripture: {reference: 'Romans 15:13', passageReference: 'Romans 15:13', poolKey: 'hopeful'},
    psalm: {number: 1, attributes: ['Righteous', 'Knows His people']},
    focus: {category: 'work', name: 'Work', icon: 'briefcase', iconType: 'ionicons', personalText: 'Give my best attention to the work that matters most, one faithful step at a time.'},
    todos: [
      {text: 'Finish the project outline', completed: true, priority: true},
      {text: 'Send the follow-up email before lunch', completed: true},
      {text: 'Take a quiet ten-minute break', completed: false},
      {text: 'Review the notes from Friday’s meeting', completed: true},
      {text: 'Schedule the design check-in', completed: false},
      {text: 'Refill the water bottle before the afternoon block', completed: true},
      {text: 'Write down tomorrow’s first task', completed: false},
    ],
  },
  {
    date: '2026-09-15', feeling: 'Overwhelmed', feelingIcon: 'waves', feelingIconType: 'material',
    underneathIt: 'There are too many moving pieces in my head. I need help deciding what is actually mine to carry today.',
    scripture: {reference: 'Matthew 11:28', passageReference: 'Matthew 11:28-30', poolKey: 'overwhelmed'},
    psalm: {number: 2, attributes: ['Sovereign King', 'Refuge']},
    focus: {category: 'family', name: 'Family', icon: 'home-heart', iconType: 'material', personalText: 'Be present in the conversations at home instead of bringing every unfinished task with me.'},
    todos: [
      {text: 'Confirm the family appointment', completed: true, priority: true},
      {text: 'Plan a simple dinner', completed: true},
    ],
  },
  {
    date: '2026-09-16', feeling: 'Hopeful', feelingIcon: 'sunny-outline', feelingIconType: 'ionicons',
    underneathIt: 'Yesterday was heavy, but I can see a clear next step now. I feel supported and less alone in it.',
    scripture: {reference: 'Isaiah 40:31', passageReference: 'Isaiah 40:31', poolKey: 'hopeful'},
    psalm: {number: 3, attributes: ['Shield', 'Sustainer']},
    focus: {category: 'relationships', name: 'Relationships', icon: 'heart', iconType: 'material', personalText: 'Listen carefully and make room for an honest conversation.'},
    todos: [
      {text: 'Call Mom and listen without multitasking', completed: true, priority: true},
      {text: 'Reply to Maya with encouragement', completed: true},
      {text: 'Put the phone away during dinner', completed: true},
    ],
  },
  {
    date: '2026-09-17', feeling: 'Tired', feelingIcon: 'sleep', feelingIconType: 'material',
    underneathIt: 'My body feels slower this morning. I want to respect that instead of treating rest like something I have to earn.',
    scripture: {reference: 'Psalm 4:8', passageReference: 'Psalm 4:8', poolKey: 'tired'},
    psalm: {number: 4, attributes: ['Answers prayer', 'Gives safety']},
    focus: {category: 'rest', name: 'Rest', icon: 'bed', iconType: 'material', personalText: 'Choose a gentler pace and leave margin between responsibilities.'},
    todos: [
      {text: 'Move the nonessential meeting', completed: true, priority: true},
      {text: 'Take a short walk outside', completed: false},
    ],
  },
  {
    date: '2026-09-18', feeling: 'Calm', feelingIcon: 'water-outline', feelingIconType: 'ionicons',
    underneathIt: 'Things are not all finished, but my heart feels quieter. I can work from peace instead of pressure.',
    scripture: {reference: 'John 14:27', passageReference: 'John 14:27', poolKey: 'calm'},
    psalm: {number: 5, attributes: ['Hears', 'Guide and Protector']},
    focus: {category: 'follow-through', name: 'Follow-through', icon: 'check-circle', iconType: 'material', personalText: 'Complete the promises I already made before taking on something new.'},
    todos: [
      {text: 'Submit the final project notes', completed: true, priority: true},
      {text: 'Return the borrowed book', completed: true},
      {text: 'Prepare Monday’s first task', completed: false},
    ],
  },
  {
    date: '2026-09-19', feeling: 'Grateful', feelingIcon: 'hand-heart', feelingIconType: 'material',
    underneathIt: 'I am noticing how much goodness was tucked inside an imperfect week—help, laughter, enough strength, and small answers.',
    scripture: {reference: '1 Thessalonians 5:18', passageReference: '1 Thessalonians 5:16-18', poolKey: 'grateful'},
    psalm: {
      number: 6,
      attributes: ['Merciful'],
      customAttribute: 'Patient with me when I am worn down',
    },
    focus: {category: 'sabbath', name: 'Sabbath', icon: 'weather-night', iconType: 'material', personalText: 'Let today hold worship, delight, and rest instead of becoming another catch-up day.'},
    todos: [
      {text: 'Put away work notifications', completed: true, priority: true},
      {text: 'Take an unhurried walk', completed: true},
    ],
  },
  {
    date: '2026-09-20', feeling: 'Hopeful', feelingIcon: 'sunny-outline', feelingIconType: 'ionicons',
    underneathIt: 'I feel ready for the week ahead, but I want to begin by listening instead of immediately planning every detail.',
    scripture: {reference: 'Lamentations 3:22-23', passageReference: 'Lamentations 3:22-23', poolKey: 'hopeful'},
    psalm: {number: 7, attributes: ['Refuge', 'Righteous Judge']},
    focus: {category: 'worship', name: 'Worship', icon: 'music', iconType: 'material', personalText: 'Begin the new week by remembering who God is before deciding what I need to accomplish.'},
    todos: [
      {text: 'Prepare clothes and breakfast for Monday', completed: true, priority: true},
      {text: 'Write the three most important tasks for tomorrow', completed: false},
    ],
  },
];

const rememberReplacement = async (manifest: ReviewQASeedManifest, key: string): Promise<void> => {
  if (!manifest.restores.some(restore => restore.key === key)) {
    manifest.restores.push({key, value: await AsyncStorage.getItem(key)});
  }
  if (!manifest.keys.includes(key)) {manifest.keys.push(key);}
};

const putSingleton = async (
  manifest: ReviewQASeedManifest,
  contentType: string,
  day: MorningDay,
  content: Record<string, unknown>,
): Promise<string> => {
  const key = `journal_local_singleton:${contentType}:${day.date}`;
  const id = `${REVIEW_QA_PREFIX}weekly:${contentType}:${day.date}`;
  await rememberReplacement(manifest, key);
  await AsyncStorage.setItem(key, JSON.stringify({
    id,
    server_id: null,
    content_type: contentType,
    selected_date: day.date,
    content: JSON.stringify(content),
    created_at: `${day.date}T06:30:00.000Z`,
    updated_at: `${day.date}T06:45:00.000Z`,
    version: 1,
    sync_status: 'local',
    deleted: false,
  }));
  return id;
};

const addToIndex = async (key: string, id: string): Promise<void> => {
  let values: string[] = [];
  try {values = JSON.parse(await AsyncStorage.getItem(key) || '[]');} catch {}
  if (!values.includes(id)) {await AsyncStorage.setItem(key, JSON.stringify([...values, id]));}
};

const putIndexedRecord = async (
  manifest: ReviewQASeedManifest,
  key: string,
  indexKey: string,
  id: string,
  value: Record<string, unknown>,
): Promise<void> => {
  if (!manifest.keys.includes(key)) {manifest.keys.push(key);}
  await AsyncStorage.setItem(key, JSON.stringify(value));
  await addToIndex(indexKey, id);
};

export const seedWeeklyMorningFlow = async (manifest: ReviewQASeedManifest): Promise<void> => {
  for (const day of MORNING_WEEK) {
    const checkInId = await putSingleton(manifest, 'morning_check_in', day, {
      feeling: day.feeling,
      feelingIcon: day.feelingIcon,
      feelingIconType: day.feelingIconType,
      underneathIt: day.underneathIt,
      scripture: {...day.scripture, translation: 'NASB'},
    });

    const refs: Record<string, unknown> = {
      morning_check_in: {domain: 'journal', content_type: 'morning_check_in', local_id: checkInId},
    };
    const completedSteps = ['emotion', 'underneath'];

    if (day.psalm) {
      const psalmId = `${REVIEW_QA_PREFIX}weekly:morning-psalm:${day.date}`;
      const carry = [...day.psalm.attributes, day.psalm.customAttribute]
        .filter((observation): observation is string => Boolean(observation))
        .join(' · ');
      await putIndexedRecord(
        manifest,
        `reflection_local:scripture:${day.date}:${psalmId}`,
        `reflection_local_index:scripture:${day.date}`,
        psalmId,
        {
          id: psalmId,
          server_id: null,
          title: `Psalm ${day.psalm.number}`,
          content: carry,
          type: 'scripture',
          source: 'morning_psalm',
          selected_date: day.date,
          tags: ['morning', 'psalm'],
          metadata: {
            source: 'morning_psalm', psalmNumber: day.psalm.number, psalmReference: `Psalm ${day.psalm.number}`, psalmRead: true,
            selectedAttributes: day.psalm.attributes,
            customAttribute: day.psalm.customAttribute,
            carry,
          },
          created_at: `${day.date}T06:50:00.000Z`,
          updated_at: `${day.date}T07:00:00.000Z`,
          version: 1,
          sync_status: 'local',
          deleted: false,
        },
      );
      refs.psalm = {domain: 'reflection', content_type: 'scripture', local_id: psalmId};
      completedSteps.push('psalm', 'carry');
    }

    if (day.focus) {
      const focusId = await putSingleton(manifest, 'todays_focus', day, {
        focus: day.focus.name,
        focusCategory: day.focus.category,
        focusIcon: day.focus.icon,
        focusIconType: day.focus.iconType,
        customFocus: '',
        personalText: day.focus.personalText,
        priorities: (day.todos || []).slice(0, 3).map((todo, index) => ({
          id: `priority_${index + 1}`, text: todo.text, completed: todo.completed,
        })),
      });
      refs.todays_focus = {domain: 'journal', content_type: 'todays_focus', local_id: focusId};
      completedSteps.push('todays_focus');
    }

    if (day.todos?.length) {
      const todoRefs = [];
      for (const [index, todo] of day.todos.entries()) {
        const id = `${REVIEW_QA_PREFIX}weekly:todo:${day.date}:${index + 1}`;
        await putIndexedRecord(
          manifest,
          `journal_local:todo:${day.date}:${id}`,
          `journal_local_index:todo:${day.date}`,
          id,
          {
            id,
            server_id: null,
            content_type: 'todo',
            selected_date: day.date,
            content: JSON.stringify({text: todo.text, completed: todo.completed, priority: Boolean(todo.priority)}),
            completed: todo.completed,
            priority: todo.priority ? 'high' : undefined,
            created_at: `${day.date}T07:05:00.000Z`,
            updated_at: `${day.date}T18:00:00.000Z`,
            version: 1,
            sync_status: 'local',
            deleted: false,
          },
        );
        todoRefs.push({domain: 'journal', content_type: 'todo', local_id: id});
      }
      refs.todos = todoRefs;
      completedSteps.push('todos');
    }

    const routineKey = `routine_state:morning:${day.date}`;
    await rememberReplacement(manifest, routineKey);
    await AsyncStorage.setItem(routineKey, JSON.stringify({
      id: `${REVIEW_QA_PREFIX}weekly:morning-routine:${day.date}`,
      routine: 'morning',
      selected_date: day.date,
      completed: Boolean(day.psalm && day.focus && day.todos?.length),
      completed_steps: completedSteps,
      started_at: `${day.date}T06:25:00.000Z`,
      completed_at: day.psalm && day.focus && day.todos?.length ? `${day.date}T07:15:00.000Z` : undefined,
      content_refs: refs,
    }));
  }
};
