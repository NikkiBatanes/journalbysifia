export type RoutineType = 'morning' | 'evening';

const ROUTINE_STEPS = {
  morning: [
    ['emotion', 'EmotionCheckIn'],
    ['underneath', 'UnderneathIt'],
    ['psalm', 'PsalmOfTheDay'],
    ['carry', 'CarryIt'],
    ['todays_focus', 'TodaysFocus'],
    ['todos', 'Todos'],
  ],
  evening: [
    ['gratitude', 'Gratitude'],
    ['win', 'Win'],
    ['proverbs', 'Proverbs'],
    ['wisdom', 'CarryWisdom'],
    ['looking_forward', 'LookingForward'],
  ],
} as const;

export const getRoutineResumeScreen = (
  routine: RoutineType,
  completedSteps: string[],
  completed: boolean,
): string => {
  if (completed) {
    return routine === 'morning' ? 'MorningClosing' : 'EveningClosing';
  }

  const completedSet = new Set(completedSteps);
  const orderedSteps: ReadonlyArray<readonly [string, string]> = ROUTINE_STEPS[routine];
  const firstIncomplete = orderedSteps.find(([step]) => !completedSet.has(step));
  return firstIncomplete?.[1]
    ?? (routine === 'morning' ? 'MorningClosing' : 'EveningClosing');
};

export const getRoutineStepIds = (routine: RoutineType): readonly string[] =>
  ROUTINE_STEPS[routine].map(([step]) => step);

export const getRoutineResumeRoutes = (
  routine: RoutineType,
  completedSteps: string[],
  completed: boolean,
): string[] => {
  const target = getRoutineResumeScreen(routine, completedSteps, completed);
  const screens = ROUTINE_STEPS[routine].map(([, screen]) => screen) as string[];
  const closing = routine === 'morning' ? 'MorningClosing' : 'EveningClosing';
  const ordered = [...screens, closing];
  return ordered.slice(0, ordered.indexOf(target) + 1);
};
