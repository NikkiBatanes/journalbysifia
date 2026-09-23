export type FilterKey =
  | 'upcoming'
  | 'remembered'
  | 'unansweredPrayers'
  | 'answeredPrayers'
  | 'morningCheckIns'
  | 'morningPsalms'
  | 'todaysFocus'
  | 'todos'
  | 'eveningProverbs'
  | 'lookingForward'
  | 'reflectionJournals'
  | 'bibleStudy'
  | 'scriptureNotes'
  | 'sessionNotes'
  | 'prayers'
  | 'prayerRequests'
  | 'gratitude'
  | 'todaysWin'
  | 'planCarousel';

export const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'remembered', label: 'Remembered' },
  { key: 'morningCheckIns', label: 'Morning Check-ins' },
  { key: 'morningPsalms', label: 'Morning Psalms' },
  { key: 'todaysFocus', label: "Today's Focus" },
  { key: 'todos', label: 'To-dos' },
  { key: 'gratitude', label: 'Gratitude' },
  { key: 'todaysWin', label: 'Wins' },
  { key: 'eveningProverbs', label: 'Evening Proverbs' },
  { key: 'lookingForward', label: 'Looking Forward' },
  { key: 'reflectionJournals', label: 'Heart Journal' },
  { key: 'bibleStudy', label: 'Bible Studies' },
  { key: 'scriptureNotes', label: 'Scripture Notes' },
  { key: 'sessionNotes', label: 'Session Notes' },
  { key: 'planCarousel', label: 'All Planning' },
  { key: 'prayers', label: 'Prayers' },
  { key: 'prayerRequests', label: 'Prayer Requests' },
  { key: 'unansweredPrayers', label: 'Unanswered Prayers' },
  { key: 'answeredPrayers', label: 'Answered Prayers' },
];
