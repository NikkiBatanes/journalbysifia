import {
  getAccountSequenceNumber,
  getDailyProverbNumber,
  getDailyPsalmNumber,
  resolveSavedPsalmNumber,
  resolveSavedProverbNumber,
} from '../dailyScriptureSequence';
import {getPsalmReflection} from '../../data/psalmReflections';
import {getProverbReflection} from '../../data/getProverbReflection';

describe('daily Scripture sequence', () => {
  const accountCreatedAt = '2026-09-14T08:30:00+08:00';

  it('starts both Psalm and Proverbs at chapter 1 on account creation day', () => {
    expect(getDailyPsalmNumber('2026-09-14', accountCreatedAt)).toBe(1);
    expect(getDailyProverbNumber('2026-09-14', accountCreatedAt)).toBe(1);
  });

  it('advances both books by the selected local calendar date', () => {
    expect(getDailyPsalmNumber('2026-09-15', accountCreatedAt)).toBe(2);
    expect(getDailyProverbNumber('2026-09-15', accountCreatedAt)).toBe(2);
    expect(getDailyPsalmNumber('2026-09-20', accountCreatedAt)).toBe(7);
    expect(getDailyProverbNumber('2026-09-20', accountCreatedAt)).toBe(7);
    expect(getDailyPsalmNumber('2026-09-22', accountCreatedAt)).toBe(9);
    expect(getDailyProverbNumber('2026-09-22', accountCreatedAt)).toBe(9);
  });

  it('cycles Psalms after 150 days and Proverbs after 31 days', () => {
    expect(getAccountSequenceNumber('2026-09-14', accountCreatedAt, 150)).toBe(1);
    expect(getAccountSequenceNumber('2027-02-11', accountCreatedAt, 150)).toBe(1);
    expect(getAccountSequenceNumber('2026-10-15', accountCreatedAt, 31)).toBe(1);
  });

  it('treats a missing creation date as day 1 for the selected date', () => {
    expect(getDailyPsalmNumber('2026-09-20', null)).toBe(1);
    expect(getDailyProverbNumber('2026-09-20', undefined)).toBe(1);
  });

  it('has selectable reflection pills for every Psalm and Proverbs chapter in each cycle', () => {
    for (let chapter = 1; chapter <= 150; chapter += 1) {
      const reflection = getPsalmReflection(chapter);
      expect(reflection.psalm).toBe(chapter);
      expect(reflection.attributes.length).toBeGreaterThan(0);
    }
    for (let chapter = 1; chapter <= 31; chapter += 1) {
      const reflection = getProverbReflection(chapter);
      expect(reflection?.chapter).toBe(chapter);
      expect(reflection?.insights.length).toBeGreaterThan(0);
    }
  });

  it('uses saved wisdom verses to recover a Proverbs chapter corrupted by revisit fallback', () => {
    expect(resolveSavedProverbNumber({
      title: 'Proverbs 1',
      metadata: {
        proverbNumber: 1,
        proverbReference: 'Proverbs 1',
        selectedWisdomIds: ['2-2'],
        selectedWisdom: [{id: '2-2', label: 'Walk with integrity', verses: 'Proverbs 2:7–9'}],
      },
    }, 1)).toBe(2);
  });

  it('uses saved reflection choices to recover a Psalm corrupted by revisit fallback', () => {
    expect(resolveSavedPsalmNumber({
      title: 'Psalm 1',
      content: 'Sovereign King · Refuge',
      metadata: {
        psalmNumber: 1,
        selectedAttributes: ['Sovereign King', 'Refuge'],
      },
    }, 1)).toBe(2);
  });

  it('uses the saved Proverbs reference before a newly calculated fallback', () => {
    expect(resolveSavedProverbNumber({
      title: 'Proverbs 2',
      metadata: {proverbReference: 'Proverbs 2', proverbNumber: 2},
    }, 1)).toBe(2);
  });
});
