export const WEEKLY_CHALLENGE_OPTIONS = [
  {key: 'overcommitting', label: 'Overcommitting'},
  {key: 'staying_up_late', label: 'Staying up late'},
  {key: 'anxiety', label: 'Anxiety'},
  {key: 'comparing_myself', label: 'Comparing myself'},
  {key: 'low_energy', label: 'Low energy'},
  {key: 'distractions', label: 'Distractions'},
  {key: 'putting_things_off', label: 'Putting things off'},
  {key: 'deadlines', label: 'Deadlines'},
  {key: 'money_worries', label: 'Money worries'},
  {key: 'relationship_tension', label: 'Relationship tension'},
  {key: 'people_pleasing', label: 'People pleasing'},
  {key: 'uncertainty', label: 'Uncertainty'},
  {key: 'impatience', label: 'Impatience'},
  {key: 'struggling_to_trust_god', label: 'Struggling to trust God'},
  {key: 'trying_to_control_everything', label: 'Trying to control everything'},
  {key: 'not_making_time_for_god', label: 'Not making time for God'},
  {key: 'feeling_far_from_god', label: 'Feeling far from God'},
  {key: 'holding_on_to_resentment', label: 'Holding on to resentment'},
  {key: 'other', label: 'Other'},
] as const;

export type WeeklyChallengeKey = typeof WEEKLY_CHALLENGE_OPTIONS[number]['key'];

// Keep the full catalog above readable for answers saved with earlier suggestions.
export const WEEKLY_CHALLENGE_SUGGESTED_KEYS: readonly WeeklyChallengeKey[] = [
  'overcommitting',
  'staying_up_late',
  'anxiety',
  'comparing_myself',
  'distractions',
  'impatience',
  'struggling_to_trust_god',
  'other',
];
