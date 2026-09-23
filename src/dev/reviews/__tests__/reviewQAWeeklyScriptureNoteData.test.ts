import {buildWeeklyScriptureNoteFixtures} from '../reviewQAWeeklyScriptureNoteData';

describe('Weekly Review QA Scripture Note data', () => {
  it('adds one canonical standalone Scripture Note to every day of September 14–20', () => {
    const fixtures = buildWeeklyScriptureNoteFixtures();

    expect(fixtures).toHaveLength(7);
    expect(fixtures.map(item => item.selected_date)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
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
