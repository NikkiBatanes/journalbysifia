import {formatWeeklyChallengeAnswer, getWeeklyChallengeChoices, getWeeklyChallengeOptions, toggleWeeklyChallengeChoice} from '../weeklyChallengeAnswers';

describe('Weekly challenges ahead answers', () => {
  it('starts with no suggested challenges selected', () => {
    expect(getWeeklyChallengeChoices({})).toEqual([]);
    expect(formatWeeklyChallengeAnswer({})).toBe('');
  });

  it('supports choosing and removing multiple suggestions independently', () => {
    const first = {week_challenge_choices: toggleWeeklyChallengeChoice({}, 'anxiety')};
    const second = {week_challenge_choices: toggleWeeklyChallengeChoice(first, 'overcommitting')};
    const third = {week_challenge_choices: toggleWeeklyChallengeChoice(second, 'anxiety')};
    expect(getWeeklyChallengeChoices(second).map(option => option.key)).toEqual(['overcommitting', 'anxiety']);
    expect(formatWeeklyChallengeAnswer(second)).toBe('• Overcommitting\n• Anxiety');
    expect(getWeeklyChallengeChoices(third).map(option => option.key)).toEqual(['overcommitting']);
  });

  it('opens older Watch for text as Other without changing the saved response', () => {
    const answers = Object.freeze({watch_for: 'A difficult conversation\nA busy deadline'});
    expect(getWeeklyChallengeChoices(answers).map(option => option.key)).toEqual(['other']);
    expect(formatWeeklyChallengeAnswer(answers)).toBe('• A difficult conversation\nA busy deadline');
    expect(answers.watch_for).toBe('A difficult conversation\nA busy deadline');
  });

  it('keeps a legacy response when adding a suggested challenge', () => {
    const answers = {watch_for: 'A difficult conversation'};
    const updated = {...answers, week_challenge_choices: toggleWeeklyChallengeChoice(answers, 'staying_up_late')};
    expect(formatWeeklyChallengeAnswer(updated)).toBe('• Staying up late\n• A difficult conversation');
  });

  it('honors deselecting Other while retaining its text for re-selection', () => {
    const original = Object.freeze({watch_for: 'A busy deadline'});
    const deselected = {...original, week_challenge_choices: toggleWeeklyChallengeChoice(original, 'other')};
    expect(deselected.week_challenge_choices).toBe('');
    expect(getWeeklyChallengeChoices(deselected)).toEqual([]);
    expect(formatWeeklyChallengeAnswer(deselected)).toBe('');
    const restored = {...deselected, week_challenge_choices: toggleWeeklyChallengeChoice(deselected, 'other')};
    expect(formatWeeklyChallengeAnswer(restored)).toBe('• A busy deadline');
  });

  it('keeps Other open when its text is cleared and ignores unrelated answers', () => {
    const answers = {week_challenge_choices: 'other', watch_for: '', week_difficulty: 'Last week was tiring', prayer_ahead: 'Help me be patient'};
    expect(getWeeklyChallengeChoices(answers).map(option => option.key)).toEqual(['other']);
    expect(formatWeeklyChallengeAnswer(answers)).toBe('• Other');
  });

  it('reads supported saved choices once and ignores unknown keys', () => {
    expect(formatWeeklyChallengeAnswer({week_challenge_choices: 'anxiety|unknown|anxiety|comparing_myself'}))
      .toBe('• Anxiety\n• Comparing myself');
  });

  it('keeps an earlier suggestion visible and saved until the user removes it', () => {
    const earlierChoice = 'feeling_far_from_god';
    expect(getWeeklyChallengeOptions({}).map(option => option.key)).not.toContain(earlierChoice);

    const saved = Object.freeze({week_challenge_choices: earlierChoice});
    expect(getWeeklyChallengeOptions(saved).map(option => option.key)).toContain(earlierChoice);

    const updated = {...saved, week_challenge_choices: toggleWeeklyChallengeChoice(saved, 'impatience')};
    expect(formatWeeklyChallengeAnswer(updated)).toBe('• Impatience\n• Feeling far from God');

    const removed = {...updated, week_challenge_choices: toggleWeeklyChallengeChoice(updated, earlierChoice)};
    expect(getWeeklyChallengeOptions(removed).map(option => option.key)).not.toContain(earlierChoice);
    expect(formatWeeklyChallengeAnswer(removed)).toBe('• Impatience');
  });
});
