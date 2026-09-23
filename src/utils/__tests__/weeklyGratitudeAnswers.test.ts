import {
  getWeeklyGratitudeInputCount,
  getWeeklyGratitudeItems,
  isWeeklyGratitudeAnswerKey,
  weeklyGratitudeAnswerKey,
} from '../weeklyGratitudeAnswers';

describe('Weekly Gratitude review answers', () => {
  it('starts with one reflection while preserving the legacy first answer', () => {
    const answers = {notice: 'Family time'};

    expect(getWeeklyGratitudeInputCount({})).toBe(1);
    expect(getWeeklyGratitudeInputCount(answers)).toBe(1);
    expect(getWeeklyGratitudeItems(answers)).toEqual(['Family time']);
    expect([0, 1, 2].map(weeklyGratitudeAnswerKey)).toEqual([
      'notice',
      'weekly_gratitude_2',
      'weekly_gratitude_3',
    ]);
  });

  it('does not restore empty extra fields from an older gratitude list', () => {
    const answers = {
      notice: 'God, thank You for the people who kept showing up.\nI felt cared for this week.',
      weekly_gratitude_2: '',
      weekly_gratitude_3: '  ',
    };

    expect(getWeeklyGratitudeInputCount(answers)).toBe(1);
    expect(getWeeklyGratitudeItems(answers)).toEqual([answers.notice]);
  });

  it('restores added inputs and returns only filled gratitude items', () => {
    const answers = {
      notice: 'Family time',
      weekly_gratitude_2: '',
      weekly_gratitude_3: 'Unexpected provision',
      weekly_gratitude_4: 'A quiet morning',
    };

    expect(getWeeklyGratitudeInputCount(answers)).toBe(4);
    expect(getWeeklyGratitudeItems(answers)).toEqual([
      'Family time',
      'Unexpected provision',
      'A quiet morning',
    ]);
    expect(isWeeklyGratitudeAnswerKey('weekly_gratitude_4')).toBe(true);
    expect(isWeeklyGratitudeAnswerKey('notice_month')).toBe(false);
  });
});
