import { getMomentsListStructureKey, hasMomentsListStructureChanged } from '../momentsListIdentity';

describe('Moments list identity', () => {
  it('does not reset the viewport when completion content changes inside the same date group', () => {
    const before = getMomentsListStructureKey('date', ['date-2026-09-17']);
    const after = getMomentsListStructureKey('date', ['date-2026-09-17']);

    expect(after).toBe(before);
    expect(hasMomentsListStructureChanged(before, after)).toBe(false);
  });

  it('resets for an actual grouping or date-section structure change', () => {
    const before = getMomentsListStructureKey('date', ['date-2026-09-17']);
    const regrouped = getMomentsListStructureKey('week', ['week-2026-38']);
    const addedDate = getMomentsListStructureKey('date', ['date-2026-09-17', 'date-2026-09-16']);

    expect(hasMomentsListStructureChanged(before, regrouped)).toBe(true);
    expect(hasMomentsListStructureChanged(before, addedDate)).toBe(true);
  });
});
