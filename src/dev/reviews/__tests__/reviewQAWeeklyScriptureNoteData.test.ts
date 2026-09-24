import {buildWeeklyScriptureNoteFixtures} from '../reviewQAWeeklyScriptureNoteData';

describe('Weekly Review QA Scripture Note data', () => {
  it('adds one canonical standalone Scripture Note to every day of September 21–27', () => {
    const fixtures = buildWeeklyScriptureNoteFixtures();

    expect(fixtures).toHaveLength(7);
    expect(fixtures.map(item => item.selected_date)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
    expect(fixtures.every(item => (
      item.id.startsWith('dev-review-v2:weekly:scripture-note:')
      && item.type === 'scripture'
      && item.source === 'scripture_note'
      && item.title === item.metadata.reference
      && item.metadata.version === 'NASB'
      && item.metadata.journalBlocks.length >= 3
      && item.content.length > 0
    ))).toBe(true);
  });

  it('covers varied references and structured reflection blocks', () => {
    const fixtures = buildWeeklyScriptureNoteFixtures();
    const blockKinds = new Set(fixtures.flatMap(item => item.metadata.journalBlocks.map(block => block.kind)));

    expect(new Set(fixtures.map(item => item.title)).size).toBe(7);
    expect(blockKinds).toEqual(new Set(['text', 'key', 'response', 'question', 'remember', 'quote']));
    expect(fixtures.every(item => item.metadata.journalBlocks.length === 3)).toBe(true);
  });
});
