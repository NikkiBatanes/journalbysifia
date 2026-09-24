import type {ReviewType} from '../storage/reviewStorage';
import {WEEKLY_LIFE_AREAS} from '../data/weeklyLifeAreas';
import {
  MONTHLY_MORE_ROOM_DETAIL_LIMIT,
  MONTHLY_MORE_ROOM_OPTIONS,
} from '../data/monthlyMoreRoomChoices';
import {
  MONTHLY_LEAVE_BEHIND_DETAIL_LIMIT,
  MONTHLY_LEAVE_BEHIND_DETAILS,
  MONTHLY_LEAVE_BEHIND_PRIMARY_OPTIONS,
} from '../data/monthlyLeaveBehindChoices';

export type ReviewStageKind =
  | 'cover'
  | 'feelings'
  | 'life_check_in'
  | 'life_summary'
  | 'wins'
  | 'pill_choices'
  | 'captured'
  | 'remembered'
  | 'testimony'
  | 'question'
  | 'priorities'
  | 'transition'
  | 'ready';

export interface ReviewStageConfig {
  key: string;
  kind: ReviewStageKind;
  icon?: string;
  eyebrow?: string;
  title?: string;
  label?: string;
  question?: string;
  subtitle?: string;
  answerKey?: string;
  answerKeys?: string[];
  placeholder?: string;
  choices?: string[];
  selectionLimit?: number;
  otherAnswerKey?: string;
  choiceDetails?: Array<{
    choice: string;
    answerKey: string;
    choices: string[];
    selectionLimit?: number;
  }>;
}

const sharedCaptured: ReviewStageConfig = {
  key: 'captured',
  kind: 'captured',
  title: 'What you captured',
};

const sharedRemembered: ReviewStageConfig = {
  key: 'remembered',
  kind: 'remembered',
  title: 'What you want to remember',
};

const weeklyStages = (): ReviewStageConfig[] => [
  {
    key: 'cover',
    kind: 'cover',
    subtitle:
      'Begin by reflecting on the past week with God. Then, in this same review, prepare your heart for the week ahead.',
  },
  {
    key: 'feelings',
    kind: 'feelings',
    icon: 'leaf-outline',
    label: 'LOOKING BACK',
    question: 'How did this week feel?',
    subtitle: 'Choose up to 3 words.',
    answerKey: 'week_feelings',
  },
  {
    key: 'life_check_in',
    kind: 'life_check_in',
    icon: 'leaf-outline',
    label: 'LOOKING BACK',
    question: 'How did these areas of life feel this week?',
    subtitle: 'A quick check-in across areas of life.',
    answerKeys: WEEKLY_LIFE_AREAS.map(area => area.answerKey),
  },
  sharedCaptured,
  sharedRemembered,
  {
    key: 'difficulty',
    kind: 'question',
    icon: 'heart-outline',
    label: 'THE HARD PARTS',
    question: 'What felt difficult this week?',
    subtitle:
      'You can name what was hard without having to resolve it. Write if you want to, or simply continue.',
    placeholder: 'This week, what felt hard was…',
    answerKey: 'week_difficulty',
  },
  {
    key: 'notice',
    kind: 'question',
    icon: 'sparkles-outline',
    label: 'WEEKLY GRATITUDE',
    question: 'Looking back on this week, what do you want to thank God for?',
    subtitle:
      'A simple thank-you for something that mattered to you, however small.',
    placeholder: 'God, looking back on this week, thank You for…',
    answerKey: 'notice',
  },
  {
    key: 'god',
    kind: 'question',
    icon: 'sparkles-outline',
    label: 'GOD’S FAITHFULNESS',
    question: 'How did God meet you this week?',
    subtitle: 'Choose up to 3, or write your own.',
    answerKey: 'god',
  },
  {
    key: 'learning',
    kind: 'question',
    icon: 'leaf-outline',
    label: 'WHAT YOU’RE LEARNING',
    question: 'What are you learning through this week?',
    subtitle:
      'A pattern, a small realization, or something you’re still making sense of. It’s okay to leave this open.',
    placeholder: 'This week, I’m noticing…',
    answerKey: 'week_learning',
  },
  {
    key: 'looking_ahead',
    kind: 'transition',
    icon: 'leaf-outline',
    label: 'LOOKING AHEAD',
    title: 'Now, let’s look ahead.',
    subtitle:
      'Let what God has shown you shape how you step into the week ahead.',
  },
  {
    key: 'priority',
    kind: 'priorities',
    icon: 'star',
    label: 'PRIORITY',
    question: 'What matters most in the week ahead?',
    subtitle: 'One is enough. Add up to three if you’d like.',
    answerKeys: ['priority_1', 'priority_2', 'priority_3'],
  },
  {
    key: 'dont_forget',
    kind: 'question',
    icon: 'heart-outline',
    label: 'NEEDS CARE',
    question: 'What needs care this week?',
    subtitle: 'Choose the areas that need care this week.',
    placeholder: 'Anything you want to note?',
    answerKey: 'dont_forget',
    answerKeys: ['week_care_areas', 'week_care_other', 'dont_forget'],
  },
  {
    key: 'watch_for',
    kind: 'question',
    icon: 'arrow-forward-outline',
    label: 'LOOKING AHEAD',
    question: 'What could make this week difficult?',
    subtitle: 'What do you want to be mindful of?',
    placeholder: 'What else could make this week difficult?',
    answerKey: 'watch_for',
    answerKeys: ['week_challenge_choices', 'watch_for'],
  },
  {
    key: 'looking_forward_feeling',
    kind: 'question',
    label: 'LOOKING FORWARD TO THIS WEEK',
    question: 'How does this week feel right now?',
    answerKey: 'week_looking_forward_emotion',
    answerKeys: ['week_looking_forward_emotion', 'week_looking_forward_other'],
  },
  {
    key: 'looking_forward',
    kind: 'question',
    icon: 'sunny-outline',
    label: 'LOOKING FORWARD',
    question: 'What are you looking forward to this week?',
    placeholder: 'This week, I am looking forward to…',
    answerKey: 'week_looking_forward',
    answerKeys: [
      'week_looking_forward',
      'week_looking_forward_emotion',
      'week_looking_forward_other',
    ],
  },
  {
    key: 'prayer_ahead',
    kind: 'question',
    icon: 'heart-outline',
    label: 'WITH GOD',
    question: 'Pray over your week',
    subtitle: 'Bring what’s ahead to God.',
    placeholder: 'God, as I enter this week…',
    answerKey: 'prayer_ahead',
    answerKeys: ['prayer_ahead', 'week_support_choices'],
  },
  {
    key: 'ready',
    kind: 'ready',
    icon: 'checkmark-circle',
    label: 'WEEK AHEAD',
  },
];

export interface ReviewStageOptions {
  includeMonthlyTestimony?: boolean;
  includeMonthlyWins?: boolean;
}

const monthlyStages = (
  options: ReviewStageOptions = {},
): ReviewStageConfig[] => [
  {
    key: 'cover',
    kind: 'cover',
    subtitle:
      'Step back from the individual days. Notice the patterns, the grace, and what deserves to move forward.',
  },
  {
    key: 'monthly_feelings',
    kind: 'feelings',
    icon: 'leaf-outline',
    label: 'LOOKING BACK',
    question: 'How did this month feel?',
    subtitle:
      'Choose up to 3 words after looking across your morning check-ins.',
    answerKey: 'month_feelings',
  },
  sharedCaptured,
  {
    key: 'notice',
    kind: 'question',
    icon: 'leaf-outline',
    label: 'PATTERNS',
    question: 'What patterns do you notice?',
    subtitle: 'Look across every Morning Check-in from the month.',
    placeholder: 'Start writing…',
    answerKey: 'notice_month',
  },
  {
    key: 'monthly_life_summary',
    kind: 'life_summary',
    icon: 'leaf-outline',
    label: 'LOOKING BACK',
    question: 'How were you this month?',
    subtitle: 'A synthesis of your weekly Whole-life check-ins.',
  },
  ...(options.includeMonthlyWins
    ? [
        {
          key: 'monthly_wins',
          kind: 'wins' as const,
          icon: 'leaf-outline',
          label: 'LOOKING BACK',
          title: 'You had wins worth remembering.',
          subtitle:
            'Big or quiet, these are the wins you recorded along the way.',
        },
      ]
    : []),
  {
    key: 'monthly_life_giving',
    kind: 'pill_choices',
    icon: 'leaf-outline',
    label: 'LOOKING BACK',
    question: 'What gave you life this month?',
    subtitle: 'Choose up to 3 things that restored or strengthened you.',
    answerKey: 'month_life_giving',
    answerKeys: ['month_life_giving', 'month_life_giving_other'],
    otherAnswerKey: 'month_life_giving_other',
    selectionLimit: 3,
    choices: [
      'Time with God',
      'Time with family',
      'Walking or movement',
      'Sabbath or deep rest',
      'Creative work',
      'Meaningful conversations',
      'Being outdoors',
      'Progress that mattered',
      'Serving someone',
      'A simpler pace',
    ],
  },
  {
    key: 'monthly_draining',
    kind: 'pill_choices',
    icon: 'leaf-outline',
    label: 'LOOKING BACK',
    question: 'What drained you this month?',
    subtitle: 'Choose up to 3 things that seemed to take more from you.',
    answerKey: 'month_draining',
    answerKeys: ['month_draining', 'month_draining_other'],
    otherAnswerKey: 'month_draining_other',
    selectionLimit: 3,
    choices: [
      'Carrying too much',
      'Not enough rest',
      'Mental noise',
      'Relational tension',
      'Pressure to perform',
      'Comparison',
      'Financial pressure',
      'Unhealthy rhythms',
      'Feeling scattered',
      'Feeling spiritually dry',
    ],
  },
  {
    key: 'formation',
    kind: 'question',
    icon: 'leaf-outline',
    label: 'FORMATION',
    question: 'What might God be forming in you through this season?',
    subtitle: 'You do not need a finished answer. Name what may be growing.',
    placeholder: 'God may be forming…',
    answerKey: 'formation_month',
  },
  {
    key: 'prayer',
    kind: 'question',
    icon: 'leaf-outline',
    label: 'PRAYERS',
    question: 'This month in prayer',
    subtitle:
      'Receive what was answered with gratitude, and hold what remains with trust.',
    placeholder: 'This month in prayer…',
    answerKey: 'prayer_month',
  },
  ...(options.includeMonthlyTestimony
    ? [
        {
          key: 'monthly_testimony',
          kind: 'testimony' as const,
          icon: 'leaf-outline',
          label: 'GOD’S FAITHFULNESS',
          title: 'Also this month, you wrote your testimony.',
          subtitle:
            'You made space to remember how Jesus met you and where your life with Him began.',
        },
      ]
    : []),
  {
    key: 'god',
    kind: 'question',
    icon: 'leaf-outline',
    label: 'GOD’S FAITHFULNESS',
    question: 'Where did you see God’s faithfulness this month?',
    subtitle:
      'Name the provision, presence, protection, or grace you can see now.',
    placeholder: 'God, I saw Your faithfulness in…',
    answerKey: 'god_month',
  },
  {
    key: 'step_into',
    kind: 'transition',
    icon: 'leaf-outline',
    label: 'LOOKING AHEAD',
    title: 'Now, let’s look ahead.',
    subtitle:
      'Let what God has shown you shape how you step into the month ahead.',
  },
  {
    key: 'monthly_more_room',
    kind: 'pill_choices',
    icon: 'leaf-outline',
    label: 'LOOKING AHEAD',
    question: 'What do you want to make more room for?',
    subtitle: 'Choose up to 3.',
    answerKey: 'month_more_room',
    answerKeys: [
      'month_more_room',
      'month_more_room_other',
      ...MONTHLY_MORE_ROOM_OPTIONS.map(option => option.answerKey),
    ],
    otherAnswerKey: 'month_more_room_other',
    selectionLimit: 3,
    choices: MONTHLY_MORE_ROOM_OPTIONS.map(option => option.label),
    choiceDetails: MONTHLY_MORE_ROOM_OPTIONS.map(option => ({
      choice: option.label,
      answerKey: option.answerKey,
      choices: [...option.choices],
      selectionLimit: MONTHLY_MORE_ROOM_DETAIL_LIMIT,
    })),
  },
  {
    key: 'monthly_care',
    kind: 'question',
    icon: 'leaf-outline',
    label: 'LOOKING AHEAD',
    question: 'What needs care next month?',
    subtitle:
      'Based on your weekly Whole-life check-ins, these areas may need more attention next month. Choose up to 3.',
    answerKey: 'month_care_areas',
    answerKeys: ['month_care_areas', 'month_care_other'],
    otherAnswerKey: 'month_care_other',
    selectionLimit: 3,
  },
  {
    key: 'monthly_leave_behind',
    kind: 'pill_choices',
    icon: 'leaf-outline',
    label: 'LOOKING AHEAD',
    question: 'What do you want to leave behind?',
    subtitle: 'Choose up to 3 things you do not want to carry forward.',
    answerKey: 'month_leave_behind',
    answerKeys: [
      'month_leave_behind',
      'month_leave_behind_other',
      ...MONTHLY_LEAVE_BEHIND_DETAILS.map(option => option.answerKey),
    ],
    otherAnswerKey: 'month_leave_behind_other',
    selectionLimit: 3,
    choices: [...MONTHLY_LEAVE_BEHIND_PRIMARY_OPTIONS],
    choiceDetails: MONTHLY_LEAVE_BEHIND_DETAILS.map(option => ({
      choice: option.label,
      answerKey: option.answerKey,
      choices: [...option.choices],
      selectionLimit: MONTHLY_LEAVE_BEHIND_DETAIL_LIMIT,
    })),
  },
  {
    key: 'priority',
    kind: 'priorities',
    icon: 'leaf-outline',
    label: 'LOOKING AHEAD',
    question: 'What matters most next month?',
    subtitle: 'Choose up to 3 intentions.',
    answerKeys: [
      'next_month_priority_1',
      'next_month_priority_2',
      'next_month_priority_3',
    ],
  },
  {
    key: 'prayer_for_month',
    kind: 'question',
    icon: 'heart-outline',
    label: 'WITH GOD',
    question: 'Pray over your month',
    subtitle: 'Bring the month ahead to God.',
    placeholder: 'God, as I enter this month…',
    answerKey: 'prayer_for_month',
    answerKeys: ['month_prayer_ids', 'prayer_for_month'],
  },
  {
    key: 'ready',
    kind: 'ready',
    icon: 'checkmark-circle',
    label: 'MONTH IS READY',
  },
];

const quarterlyStages = (): ReviewStageConfig[] => [
  {
    key: 'cover',
    kind: 'cover',
    subtitle:
      'Take a little time to notice this season, the patterns that showed up, and what deserves attention next.',
  },
  sharedCaptured,
  sharedRemembered,
  {
    key: 'the_season',
    kind: 'question',
    icon: 'calendar',
    label: 'THE SEASON',
    question: 'If you had to describe this season, what would you call it?',
    answerKey: 'the_season',
  },
  {
    key: 'patterns',
    kind: 'question',
    icon: 'repeat',
    label: 'PATTERNS',
    question: 'What kept showing up?',
    answerKey: 'patterns',
  },
  {
    key: 'growth',
    kind: 'question',
    icon: 'trending-up',
    label: 'GROWTH',
    question: 'Where can you see change in yourself?',
    answerKey: 'growth',
  },
  {
    key: 'god',
    kind: 'question',
    icon: 'sunny',
    label: 'GOD',
    question: 'Where did you see God’s faithfulness?',
    answerKey: 'god_quarter',
  },
  {
    key: 'prayer',
    kind: 'question',
    icon: 'chatbubble',
    label: 'PRAYER',
    question: 'What changed in your prayers this season?',
    answerKey: 'prayer_quarter',
  },
  {
    key: 'release',
    kind: 'question',
    icon: 'trash',
    label: 'RELEASE',
    question: 'What needs to end here?',
    answerKey: 'release_quarter',
  },
  {
    key: 'continue',
    kind: 'question',
    icon: 'play',
    label: 'CONTINUE',
    question: 'What is worth carrying forward?',
    answerKey: 'continue_quarter',
  },
  {
    key: 'step_into',
    kind: 'transition',
    icon: 'arrow-forward',
    label: 'STEP INTO NEXT SEASON',
    title: 'You don’t need to map the whole quarter.',
    subtitle: 'What deserves your attention in the next three months?',
  },
  {
    key: 'priority',
    kind: 'priorities',
    icon: 'star',
    label: 'PRIORITY',
    question: 'What are the 3 things that deserve your attention this quarter?',
    subtitle: 'Choose up to three.',
    answerKeys: [
      'quarter_priority_1',
      'quarter_priority_2',
      'quarter_priority_3',
    ],
  },
  {
    key: 'less_attention',
    kind: 'question',
    icon: 'remove-circle',
    label: 'LESS ATTENTION',
    question: 'What needs less of your attention?',
    answerKey: 'less_attention',
  },
  {
    key: 'decision',
    kind: 'question',
    icon: 'git-branch',
    label: 'DECISION',
    question: 'What important decision needs to be made?',
    answerKey: 'decision',
  },
  {
    key: 'relationship',
    kind: 'question',
    icon: 'people',
    label: 'RELATIONSHIP',
    question: 'What relationship needs intentional care?',
    answerKey: 'relationship',
  },
  {
    key: 'rhythm',
    kind: 'question',
    icon: 'musical-notes',
    label: 'RHYTHM',
    question: 'What rhythm needs protecting?',
    answerKey: 'rhythm_quarter',
  },
  {
    key: 'postponing',
    kind: 'question',
    icon: 'time',
    label: 'POSTPONING',
    question: 'What have you been postponing?',
    answerKey: 'postponing',
  },
  {
    key: 'faithfulness',
    kind: 'question',
    icon: 'walk',
    label: 'FAITHFULNESS',
    question: 'What would faithfulness look like this quarter?',
    answerKey: 'faithfulness_quarter',
  },
  {
    key: 'ready',
    kind: 'ready',
    icon: 'checkmark-circle',
    label: 'QUARTER IS READY',
  },
];

const yearEndStages = (): ReviewStageConfig[] => [
  {
    key: 'cover',
    kind: 'cover',
    eyebrow: 'YOUR YEAR WITH GOD',
    subtitle: 'Before you move into another year, remember what this one held.',
  },
  sharedCaptured,
  sharedRemembered,
  {
    key: 'remember',
    kind: 'question',
    icon: 'bookmark',
    label: 'REMEMBER',
    question: 'What moments do you never want to forget?',
    answerKey: 'remember_year',
  },
  {
    key: 'god',
    kind: 'question',
    icon: 'sunny',
    label: 'GOD',
    question:
      'Where can you see God’s faithfulness now that you couldn’t see at the time?',
    answerKey: 'god_year',
  },
  {
    key: 'scripture',
    kind: 'question',
    icon: 'book',
    label: 'SCRIPTURE',
    question: 'What truths from Scripture anchored you this year?',
    answerKey: 'scripture_year',
  },
  {
    key: 'prayer',
    kind: 'question',
    icon: 'chatbubble',
    label: 'PRAYER',
    question: 'Which prayers were answered? Which are you still carrying?',
    answerKey: 'prayer_year',
  },
  {
    key: 'formation',
    kind: 'question',
    icon: 'leaf',
    label: 'FORMATION',
    question: 'How are you different from the person who entered this year?',
    answerKey: 'formation_year',
  },
  {
    key: 'hard_things',
    kind: 'question',
    icon: 'rainy',
    label: 'HARD THINGS',
    question: 'What was difficult, disappointing, or painful?',
    answerKey: 'hard_things',
  },
  {
    key: 'gratitude',
    kind: 'question',
    icon: 'heart',
    label: 'GRATITUDE',
    question: 'What are you deeply thankful for?',
    answerKey: 'gratitude_year',
  },
  {
    key: 'release',
    kind: 'question',
    icon: 'trash',
    label: 'RELEASE',
    question: 'What are you ready to leave here?',
    answerKey: 'release_year',
  },
  {
    key: 'carry',
    kind: 'question',
    icon: 'arrow-forward',
    label: 'CARRY',
    question:
      'What truth, prayer, relationship, lesson, or Scripture do you want to carry into the next year?',
    answerKey: 'carry',
  },
  {
    key: 'prayer_close',
    kind: 'question',
    icon: 'chatbubble',
    label: 'PRAYER',
    question: 'What do you want to say to God as you close this year?',
    answerKey: 'prayer_close',
  },
  {
    key: 'ready',
    kind: 'ready',
    icon: 'checkmark-circle',
    label: 'YEAR IS READY',
  },
];

const beginYearStages = (): ReviewStageConfig[] => [
  {
    key: 'cover',
    kind: 'cover',
    eyebrow: 'BEGIN THE YEAR',
    subtitle:
      'You don’t need to know everything this year will hold. Begin by noticing what matters and entrusting what is ahead to God.',
  },
  {
    key: 'from_year',
    kind: 'remembered',
    title: 'From last year',
    subtitle: 'Here’s what you said you wanted to carry forward.',
  },
  {
    key: 'posture',
    kind: 'question',
    icon: 'body',
    label: 'POSTURE',
    question: 'How do you want to enter this year with God?',
    answerKey: 'posture',
  },
  {
    key: 'carry',
    kind: 'question',
    icon: 'arrow-forward',
    label: 'CARRY',
    question: 'What from last year do you want to keep carrying?',
    answerKey: 'carry_begin',
  },
  {
    key: 'scripture',
    kind: 'question',
    icon: 'book',
    label: 'SCRIPTURE',
    question:
      'Is there a passage of Scripture you want to return to in this season?',
    answerKey: 'scripture_begin',
  },
  {
    key: 'formation',
    kind: 'question',
    icon: 'leaf',
    label: 'FORMATION',
    question: 'Who are you praying to become?',
    answerKey: 'formation_begin',
  },
  {
    key: 'faithfulness',
    kind: 'question',
    icon: 'walk',
    label: 'FAITHFULNESS',
    question: 'What might faithfulness look like in your ordinary days?',
    answerKey: 'faithfulness_begin',
  },
  {
    key: 'attention',
    kind: 'question',
    icon: 'eye',
    label: 'ATTENTION',
    question: 'What deserves your attention in this season?',
    answerKey: 'attention_begin',
  },
  {
    key: 'priorities',
    kind: 'priorities',
    icon: 'star',
    label: 'PRIORITIES',
    question:
      'If many things compete for your attention this year, what three do you especially want to remember?',
    subtitle: 'Choose up to three.',
    answerKeys: [
      'begin_year_priority_1',
      'begin_year_priority_2',
      'begin_year_priority_3',
    ],
  },
  {
    key: 'rhythms',
    kind: 'question',
    icon: 'musical-notes',
    label: 'RHYTHMS',
    question: 'What rhythms would help you live faithfully this year?',
    answerKey: 'rhythms_begin',
  },
  {
    key: 'people',
    kind: 'question',
    icon: 'people',
    label: 'PEOPLE',
    question: 'Who do you want to intentionally make room for?',
    answerKey: 'people_begin',
  },
  {
    key: 'prayer',
    kind: 'question',
    icon: 'chatbubble',
    label: 'PRAYER',
    question: 'What are you asking God for this year?',
    answerKey: 'prayer_begin',
  },
  {
    key: 'surrender',
    kind: 'question',
    icon: 'hand-left',
    label: 'SURRENDER',
    question: 'What are you choosing to entrust to God rather than control?',
    answerKey: 'surrender',
  },
  {
    key: 'faithfulness_year',
    kind: 'question',
    icon: 'flag',
    label: 'FAITHFULNESS',
    question:
      'At the end of this year, what would faithfulness matter more than achievement?',
    answerKey: 'faithfulness_year',
  },
  {
    key: 'ready',
    kind: 'ready',
    icon: 'checkmark-circle',
    label: 'YEAR IS READY',
  },
];

export const getReviewStages = (
  type: ReviewType,
  options: ReviewStageOptions = {},
): ReviewStageConfig[] => {
  switch (type) {
    case 'begin_year':
      return beginYearStages();
    case 'year_end':
      return yearEndStages();
    case 'quarterly':
      return quarterlyStages();
    case 'monthly':
      return monthlyStages(options);
    case 'weekly':
    default:
      return weeklyStages();
  }
};
