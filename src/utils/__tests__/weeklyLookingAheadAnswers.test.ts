import {formatWeeklySupportAnswer, getLegacyWeeklyLookingAheadSections, getWeeklyLookingAheadSummary, getWeeklySupportChoices} from '../weeklyLookingAheadAnswers';
import {formatWeeklyLookingAheadPeriod} from '../weeklyLookingAheadPeriod';

describe('Weekly Looking Ahead', () => {
  it('allows every answer to be skipped without inventing a response', () => {
    expect(getWeeklyLookingAheadSummary({})).toEqual([]);
    expect(getWeeklySupportChoices({})).toEqual([]);
    expect(formatWeeklySupportAnswer({})).toBe('');
  });

  it('keeps earlier saved word choices readable without requiring a written prayer', () => {
    expect(formatWeeklySupportAnswer({week_support_choices: 'strength|peace'})).toBe('• Peace\n• Strength');
  });

  it('keeps existing prayer text and formats a saved Other choice without duplicating the note', () => {
    const saved = Object.freeze({prayer_ahead: 'Help me listen to my family.'});
    const selected = {...saved, week_support_choices: 'other'};
    expect(formatWeeklySupportAnswer(selected)).toBe(saved.prayer_ahead);
    expect(formatWeeklySupportAnswer(saved)).toBe(saved.prayer_ahead);
    expect(formatWeeklySupportAnswer({week_support_choices: 'other', prayer_ahead: ''})).toBe('• Other');
  });

  it('builds the recap from the answers, trims blank priorities, and ignores unrelated reflection text', () => {
    const summary = getWeeklyLookingAheadSummary({
      priority_1: ' Time with family ', priority_2: ' ', priority_3: 'Rest',
      week_care_areas: 'finances|other', week_care_other: 'Moving home', dont_forget: 'Ask for help packing.',
      week_challenge_choices: 'anxiety', week_support_choices: 'wisdom|wisdom|unknown',
      week_looking_forward: 'Dinner with my sister.', prayer_ahead: 'Help me choose well.', week_learning: 'This belongs in Looking Back.',
    });
    expect(summary.map(section => section.value)).toEqual([
      '• Time with family\n• Rest',
      '• Finances\n• Other: Moving home\n\nAsk for help packing.',
      '• Anxiety',
      'Dinner with my sister.',
      '• Wisdom\n\nHelp me choose well.',
    ]);
  });

  it('keeps answers from the removed questions readable without changing storage', () => {
    const answers = Object.freeze({people: 'My sister', rest: 'Sunday afternoon', faithful_step: 'Listen first', prayer_ahead: 'Help me trust You'});
    expect(getLegacyWeeklyLookingAheadSections(answers).map(section => section.value)).toEqual(['My sister', 'Sunday afternoon', 'Listen first']);
    expect(formatWeeklySupportAnswer(answers)).toBe('Help me trust You');
    expect(getLegacyWeeklyLookingAheadSections({people: ' ', rest: ''})).toEqual([]);
  });

  it.each([
    ['2026-09-20', 'Sep 21–27, 2026'],
    ['2026-09-27', 'Sep 28–Oct 4, 2026'],
    ['2026-12-27', 'Dec 28, 2026–Jan 3, 2027'],
    ['2026-03-07', 'Mar 8–14, 2026'],
    ['2026-10-31', 'Nov 1–7, 2026'],
    ['', ''],
  ])('shows the seven calendar days following %s', (periodEnd, expected) => {
    expect(formatWeeklyLookingAheadPeriod(periodEnd)).toBe(expected);
  });
});
