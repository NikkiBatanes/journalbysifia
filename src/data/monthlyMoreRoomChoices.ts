export const MONTHLY_MORE_ROOM_OPTIONS = [
  {
    label: 'Rest',
    answerKey: 'month_more_room_rest',
    choices: [
      'Better sleep',
      'Sabbath',
      'Slower mornings',
      'Unstructured time',
      'Recovery',
    ],
  },
  {
    label: 'Movement or health',
    answerKey: 'month_more_room_health',
    choices: [
      'Walking',
      'Exercise',
      'Nourishing meals',
      'Health appointments',
      'Recovery',
    ],
  },
  {
    label: 'Time with God',
    answerKey: 'month_more_room_with_god',
    choices: [
      'Prayer',
      'Scripture reading',
      'Quiet time',
      'Bible study',
      'Worship',
      'Church community',
      'Discipleship',
    ],
  },
  {
    label: 'Family',
    answerKey: 'month_more_room_family',
    choices: [
      'Quality time',
      'Meaningful conversations',
      'Shared routines',
      'Play and fun',
      'Caring for family',
    ],
  },
  {
    label: 'Friends',
    answerKey: 'month_more_room_friends',
    choices: [
      'Reconnecting',
      'Deeper conversations',
      'Community',
      'Hospitality',
      'Making new friends',
    ],
  },
  {
    label: 'Deep work',
    answerKey: 'month_more_room_deep_work',
    choices: [
      'Focused work blocks',
      'Finishing a project',
      'Learning',
      'Fewer distractions',
      'Strategic thinking',
    ],
  },
  {
    label: 'Creativity',
    answerKey: 'month_more_room_creativity',
    choices: ['Writing', 'Music', 'Art or design', 'Making', 'Experimenting'],
  },
  {
    label: 'Financial margin',
    answerKey: 'month_more_room_finances',
    choices: [
      'Budgeting',
      'Saving',
      'Reducing spending',
      'Giving',
      'Increasing income',
      'Planning ahead',
    ],
  },
] as const;

export const MONTHLY_MORE_ROOM_DETAIL_LIMIT = 3;
