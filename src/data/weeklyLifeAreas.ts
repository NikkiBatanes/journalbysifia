export const WEEKLY_LIFE_AREAS = [
  {key: 'mind', label: 'Mind', icon: 'head-heart-outline', answerKey: 'week_check_in_mind'},
  {key: 'body', label: 'Body', icon: 'arm-flex-outline', answerKey: 'week_check_in_body'},
  {key: 'relationships', label: 'Relationships', icon: 'heart-multiple-outline', answerKey: 'week_check_in_relationships'},
  {key: 'work', label: 'Work / School', icon: 'school-outline', answerKey: 'week_check_in_work'},
  {key: 'finances', label: 'Finances', icon: 'wallet-outline', answerKey: 'week_check_in_finances'},
  {key: 'responsibilities', label: 'Responsibilities', icon: 'clipboard-list-outline', answerKey: 'week_check_in_responsibilities'},
  {key: 'rest', label: 'Rest', icon: 'bed-outline', answerKey: 'week_check_in_rest'},
  {key: 'faith', label: 'Life with God', icon: 'cross', answerKey: 'week_check_in_with_god'},
] as const;

export const WEEKLY_CARE_AREAS = [
  ...WEEKLY_LIFE_AREAS,
  {key: 'other', label: 'Other', icon: 'dots-horizontal'},
] as const;
