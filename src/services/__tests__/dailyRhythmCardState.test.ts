import {
  getDailyRhythmCardState,
  hasMeaningfulCheckIn,
  hasMeaningfulFocus,
  hasMeaningfulGratitude,
  hasMeaningfulLookingForward,
  hasMeaningfulPriorities,
  hasMeaningfulScriptureReflection,
  hasMeaningfulWin,
} from '../dailyRhythmCardState';

const journalEntry = (content: Record<string, any>) => ({ content: JSON.stringify(content) } as any);
const reflectionEntry = (content: string, metadata: Record<string, any>) => ({ content, metadata } as any);

const state = (overrides: Partial<Parameters<typeof getDailyRhythmCardState>[0]> = {}) =>
  getDailyRhythmCardState({
    relation: 'today', period: 'morning', dayOffset: 0, hasContent: false,
    started: false, completed: false, hasFocusPlan: false, hasTodoPlan: false,
    ...overrides,
  });

describe('daily rhythm card state', () => {
  it.each([
    [{}, 'Begin'],
    [{ started: true }, 'Continue'],
    [{ completed: true }, 'Continue'],
    [{ completed: true, allDisplayedContent: true }, 'View'],
  ] as const)('preserves today vocabulary', (overrides, cta) => {
    expect(state(overrides).cta).toBe(cta);
  });

  it('derives Morning meaning from intentional canonical content', () => {
    expect(hasMeaningfulCheckIn(journalEntry({ scripture: { reference: 'Psalm 1:1' } }))).toBe(false);
    expect(hasMeaningfulCheckIn(journalEntry({ feeling: 'Hopeful' }))).toBe(true);
    expect(hasMeaningfulFocus(journalEntry({ focusCategory: 'work', focus: 'Work' }))).toBe(true);
    expect(hasMeaningfulFocus(journalEntry({ focusCategory: 'other', customFocus: ' ' }))).toBe(false);
    expect(hasMeaningfulPriorities(journalEntry({ priorities: [{ text: 'Finish proposal' }] }), [])).toBe(true);
    expect(hasMeaningfulPriorities(null, [journalEntry({ text: 'Send deck' })])).toBe(true);
    expect(hasMeaningfulScriptureReflection(reflectionEntry('', { source: 'morning_psalm', psalmNumber: 17 }), 'psalmRead')).toBe(false);
    expect(hasMeaningfulScriptureReflection(reflectionEntry('', { psalmRead: true }), 'psalmRead')).toBe(true);
    expect(hasMeaningfulScriptureReflection(reflectionEntry('Nothing selected', {}), 'psalmRead')).toBe(false);
  });

  it('derives Evening meaning without counting empty shells', () => {
    expect(hasMeaningfulGratitude([journalEntry({ items: ['', '  '] })])).toBe(false);
    expect(hasMeaningfulGratitude([journalEntry({ items: ['Grace today'] })])).toBe(true);
    expect(hasMeaningfulWin(journalEntry({ winType: 'other', winTypeName: '' }))).toBe(false);
    expect(hasMeaningfulWin(journalEntry({ quietWin: 'I kept going' }))).toBe(true);
    expect(hasMeaningfulScriptureReflection(reflectionEntry('', { proverbNumber: 15 }), 'proverbRead')).toBe(false);
    expect(hasMeaningfulScriptureReflection(reflectionEntry('', { selectedWisdomIds: ['gentle-answer'] }), 'proverbRead')).toBe(true);
    expect(hasMeaningfulLookingForward(journalEntry({ emotionId: '', entry: { text: '' } }))).toBe(false);
    expect(hasMeaningfulLookingForward(journalEntry({ emotionId: 'hopeful', entry: { text: '' } }))).toBe(true);
  });

  it.each([
    ['morning', false, 'Reflect on this morning.', 'Reflect'],
    ['morning', true, 'Revisit this morning.', 'Revisit'],
    ['evening', false, 'Reflect on this evening.', 'Reflect'],
    ['evening', true, 'Revisit this evening.', 'Revisit'],
  ] as const)('uses truthful past language', (period, hasContent, title, cta) => {
    expect(state({ relation: 'past', period, dayOffset: -1, hasContent })).toEqual(expect.objectContaining({ title, cta }));
  });

  it.each([
    [1, false, false, 'Plan tomorrow.', 'Plan'],
    [1, true, false, 'Tomorrow is planned.', 'Edit'],
    [1, false, true, 'Tomorrow is planned.', 'Edit'],
    [1, true, true, 'Tomorrow is planned.', 'Edit'],
    [3, false, false, 'Plan ahead.', 'Plan'],
    [3, true, false, 'This day is planned.', 'Edit'],
  ] as const)('derives future plan state from canonical parts', (dayOffset, focus, todos, title, cta) => {
    expect(state({ relation: 'future', dayOffset, hasFocusPlan: focus, hasTodoPlan: todos })).toEqual(expect.objectContaining({ title, cta }));
  });
});
