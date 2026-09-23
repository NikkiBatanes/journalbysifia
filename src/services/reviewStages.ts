import type { ReviewType } from '../storage/reviewStorage';
import {WEEKLY_LIFE_AREAS} from '../data/weeklyLifeAreas';

export type ReviewStageKind =
  | 'cover'
  | 'feelings'
  | 'life_check_in'
  | 'captured'
  | 'remembered'
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
    subtitle: 'You can name what was hard without having to resolve it. Write if you want to, or simply continue.',
    placeholder: 'This week, what felt hard was…',
    answerKey: 'week_difficulty',
  },
  {
    key: 'notice',
    kind: 'question',
    icon: 'sparkles-outline',
    label: 'WEEKLY GRATITUDE',
    question: 'Looking back on this week, what do you want to thank God for?',
    subtitle: 'A simple thank-you for something that mattered to you, however small.',
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
    subtitle: 'A pattern, a small realization, or something you’re still making sense of. It’s okay to leave this open.',
    placeholder: 'This week, I’m noticing…',
    answerKey: 'week_learning',
  },
  {
    key: 'looking_ahead',
    kind: 'transition',
    icon: 'leaf-outline',
    label: 'LOOKING AHEAD',
    title: 'Now, let’s look ahead.',
    subtitle: 'Let what God has shown you shape how you step into the week ahead.',
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
    answerKeys: ['week_looking_forward', 'week_looking_forward_emotion', 'week_looking_forward_other'],
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

const monthlyStages = (): ReviewStageConfig[] => [
  {
    key: 'cover',
    kind: 'cover',
    subtitle:
      'Take a little time to notice what happened this month, what mattered, and what you want to carry forward.',
  },
  sharedCaptured,
  sharedRemembered,
  {
    key: 'remember',
    kind: 'question',
    icon: 'bookmark',
    label: 'REMEMBER',
    question: 'What do you want to remember from this month?',
    answerKey: 'remember_month',
  },
  {
    key: 'notice',
    kind: 'question',
    icon: 'eye',
    label: 'NOTICE',
    question: 'What pattern are you beginning to notice?',
    answerKey: 'notice_month',
  },
  {
    key: 'god',
    kind: 'question',
    icon: 'sunny',
    label: 'GOD',
    question: 'Where did you see God’s faithfulness?',
    answerKey: 'god_month',
  },
  {
    key: 'formation',
    kind: 'question',
    icon: 'leaf',
    label: 'FORMATION',
    question: 'What might God be forming in you through this season?',
    answerKey: 'formation_month',
  },
  {
    key: 'prayer',
    kind: 'question',
    icon: 'chatbubble',
    label: 'PRAYER',
    question: 'What prayers were answered? What are you still waiting on?',
    answerKey: 'prayer_month',
  },
  {
    key: 'release',
    kind: 'question',
    icon: 'trash',
    label: 'RELEASE',
    question: 'What don’t you want to carry unnecessarily into another month?',
    answerKey: 'release_month',
  },
  {
    key: 'step_into',
    kind: 'transition',
    icon: 'arrow-forward',
    label: 'STEP INTO NEXT MONTH',
    title: 'You don’t need to have the whole month figured out.',
    subtitle: 'What deserves intentional attention?',
  },
  {
    key: 'priority',
    kind: 'priorities',
    icon: 'star',
    label: 'PRIORITY',
    question: 'What matters most next month?',
    subtitle: 'Choose up to three.',
    answerKeys: ['next_month_priority_1', 'next_month_priority_2', 'next_month_priority_3'],
  },
  {
    key: 'attention',
    kind: 'question',
    icon: 'list',
    label: 'ATTENTION',
    question:
      'What needs your attention? (a decision, responsibility, conversation, deadline, etc.)',
    answerKey: 'attention',
  },
  {
    key: 'continue',
    kind: 'question',
    icon: 'play',
    label: 'CONTINUE',
    question: 'What do you want to continue?',
    answerKey: 'continue',
  },
  {
    key: 'simplify_or_stop',
    kind: 'question',
    icon: 'remove-circle',
    label: 'SIMPLIFY OR STOP',
    question: 'What should you simplify or stop?',
    answerKey: 'simplify_or_stop',
  },
  {
    key: 'people',
    kind: 'question',
    icon: 'people',
    label: 'PEOPLE',
    question: 'Who do you want to be intentional with?',
    answerKey: 'intentional_with',
  },
  {
    key: 'rhythm',
    kind: 'question',
    icon: 'musical-notes',
    label: 'RHYTHM',
    question: 'What rhythm do you want to protect?',
    answerKey: 'rhythm',
  },
  {
    key: 'prayer_for_month',
    kind: 'question',
    icon: 'chatbubble',
    label: 'PRAYER',
    question: 'What are you praying for this month?',
    answerKey: 'prayer_for_month',
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
    answerKeys: ['quarter_priority_1', 'quarter_priority_2', 'quarter_priority_3'],
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
    subtitle:
      'Before you move into another year, remember what this one held.',
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
    question: 'Is there a passage of Scripture you want to return to in this season?',
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
    question: 'If many things compete for your attention this year, what three do you especially want to remember?',
    subtitle: 'Choose up to three.',
    answerKeys: ['begin_year_priority_1', 'begin_year_priority_2', 'begin_year_priority_3'],
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

export const getReviewStages = (type: ReviewType): ReviewStageConfig[] => {
  switch (type) {
    case 'begin_year':
      return beginYearStages();
    case 'year_end':
      return yearEndStages();
    case 'quarterly':
      return quarterlyStages();
    case 'monthly':
      return monthlyStages();
    case 'weekly':
    default:
      return weeklyStages();
  }
};
