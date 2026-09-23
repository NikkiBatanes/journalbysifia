import {formatWeeklyCareAnswer, formatWeeklyLifeCheckIn, getWeeklyCareAreas} from '../weeklyLifeAreaAnswers';

describe('Weekly life-area answers', () => {
  it('keeps saved attention notes readable without requiring selected areas', () => {
    expect(formatWeeklyCareAnswer({dont_forget: 'Call about the renewal'}))
      .toBe('Call about the renewal');
  });

  it('reads multiple selected areas, including finances, with one shared note', () => {
    const answers = Object.freeze({
      week_care_areas: 'finances|mind|finances|unknown',
      dont_forget: 'Make room to rest and review the budget.',
    });

    expect(getWeeklyCareAreas(answers).map(area => area.label)).toEqual(['Mind', 'Finances']);
    expect(formatWeeklyCareAnswer(answers))
      .toBe('• Mind\n• Finances\n\nMake room to rest and review the budget.');
    expect(answers.dont_forget).toBe('Make room to rest and review the budget.');
  });

  it('allows selected areas without a note and keeps them separate from the check-in ratings', () => {
    expect(formatWeeklyCareAnswer({
      week_care_areas: 'finances|rest',
      week_check_in_body: 'struggling',
      week_check_in_finances: 'well',
    })).toBe('• Finances\n• Rest');
  });

  it('includes finances in the check-in reader while accepting older partial answers', () => {
    expect(formatWeeklyLifeCheckIn({
      week_check_in_work: 'okay',
      week_check_in_finances: 'struggling',
    })).toBe('Work / School: Okay\nFinances: Struggling');
    expect(formatWeeklyLifeCheckIn({week_check_in_with_god: 'well'})).toBe('Life with God: Well');
  });

  it('keeps the renamed Life with God area selected in saved care answers', () => {
    expect(formatWeeklyCareAnswer({week_care_areas: 'faith'})).toBe('• Life with God');
    expect(getWeeklyCareAreas({week_care_areas: 'faith'})[0].key).toBe('faith');
  });

  it('omits unanswered sections', () => {
    expect(formatWeeklyCareAnswer({dont_forget: '  '})).toBe('');
    expect(formatWeeklyLifeCheckIn({})).toBe('');
  });

  it('restores Other alongside life areas and includes the shared note', () => {
    const answers = {
      week_care_areas: 'finances|other',
      dont_forget: 'Make space for creativity, too.',
    };
    expect(getWeeklyCareAreas(answers).map(area => area.key)).toEqual(['finances', 'other']);
    expect(formatWeeklyCareAnswer(answers)).toBe('• Finances\n• Other\n\nMake space for creativity, too.');
  });

  it('reads the custom Other area separately from the shared note', () => {
    expect(formatWeeklyCareAnswer({
      week_care_areas: 'mind|other',
      week_care_other: 'Creativity',
      dont_forget: 'Make time to draw this week.',
    })).toBe('• Mind\n• Other: Creativity\n\nMake time to draw this week.');
  });

  it('omits saved Other text while Other is deselected without modifying the draft', () => {
    const answers = Object.freeze({week_care_areas: 'mind', week_care_other: 'Creativity'});
    expect(formatWeeklyCareAnswer(answers)).toBe('• Mind');
    expect(formatWeeklyCareAnswer({...answers, week_care_areas: 'mind|other'}))
      .toBe('• Mind\n• Other: Creativity');
  });
});
