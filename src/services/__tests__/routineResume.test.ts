import { getRoutineResumeRoutes, getRoutineResumeScreen, getRoutineStepIds } from '../routineResume';

describe('routine resume', () => {
  it('uses the real Morning step order', () => {
    expect(getRoutineStepIds('morning')).toEqual(['emotion', 'underneath', 'psalm', 'todays_focus', 'todos', 'carry']);
    expect(getRoutineResumeScreen('morning', [], false)).toBe('EmotionCheckIn');
    expect(getRoutineResumeScreen('morning', ['emotion', 'underneath', 'psalm'], false)).toBe('TodaysFocus');
  });

  it('uses the real Evening step order', () => {
    expect(getRoutineStepIds('evening')).toEqual(['gratitude', 'win', 'proverbs', 'wisdom', 'looking_forward']);
    expect(getRoutineResumeScreen('evening', [], false)).toBe('Gratitude');
    expect(getRoutineResumeScreen('evening', ['gratitude', 'win'], false)).toBe('Proverbs');
  });

  it('opens the saved closing screen for completed routines', () => {
    expect(getRoutineResumeScreen('morning', [], true)).toBe('MorningClosing');
    expect(getRoutineResumeScreen('evening', [], true)).toBe('EveningClosing');
  });

  it('falls through to closing if every required step persisted before completion', () => {
    expect(getRoutineResumeScreen('morning', ['emotion', 'underneath', 'psalm', 'todays_focus', 'todos', 'carry'], false)).toBe('MorningClosing');
    expect(getRoutineResumeScreen('evening', ['gratitude', 'win', 'proverbs', 'wisdom', 'looking_forward'], false)).toBe('EveningClosing');
  });

  it('rebuilds prior routes so backward editing remains available after resume', () => {
    expect(getRoutineResumeRoutes('morning', ['emotion', 'underneath', 'psalm'], false)).toEqual([
      'EmotionCheckIn', 'UnderneathIt', 'PsalmOfTheDay', 'TodaysFocus',
    ]);
    expect(getRoutineResumeRoutes('evening', ['gratitude', 'win'], false)).toEqual([
      'Gratitude', 'Win', 'Proverbs',
    ]);
  });
});
