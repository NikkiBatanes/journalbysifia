import fs from 'fs';
import path from 'path';
import {
  formatReviewQAPeriod,
  REVIEW_QA_SCENARIOS,
  getReviewQAScenario,
} from '../reviewQAFixtures';

describe('Review QA period continuity and DEV boundary', () => {
  it('contains the Weekly period and the August Monthly period', () => {
    expect(REVIEW_QA_SCENARIOS).toHaveLength(2);
    expect(REVIEW_QA_SCENARIOS.map(item => item.id)).toEqual([
      'weekly',
      'monthly',
    ]);
    expect(getReviewQAScenario('weekly')).toMatchObject({
      referenceDate: '2026-09-28',
      period: {periodStart: '2026-09-21', periodEnd: '2026-09-27'},
    });
    expect(getReviewQAScenario('monthly')).toMatchObject({
      referenceDate: '2026-09-01',
      period: {periodStart: '2026-08-01', periodEnd: '2026-08-31'},
    });
  });
  it('uses the August dates and expected monthly highlights in its label', () => {
    expect(formatReviewQAPeriod(getReviewQAScenario('monthly'))).toContain(
      'August 1',
    );
    expect(formatReviewQAPeriod(getReviewQAScenario('monthly'))).toContain(
      'August 31, 2026',
    );
    expect(getReviewQAScenario('monthly')).toMatchObject({
      density: 'rich',
      status:
        '31 COMPLETE DAYS · 5 WEEKLY CHECK-INS · 3 REMEMBERED · 1 TESTIMONY · 1 GOSPEL SHARE',
    });
  });
  it('uses the same Weekly dates in its human label and Review route data', () => {
    expect(formatReviewQAPeriod(getReviewQAScenario('weekly'))).toContain(
      'September 21',
    );
    expect(formatReviewQAPeriod(getReviewQAScenario('weekly'))).toContain(
      'September 27, 2026',
    );
    expect(getReviewQAScenario('weekly')).toMatchObject({
      density: 'rich',
      status: '7 COMPLETE DAYS · 10 GUIDED · 7 SCRIPTURE · PRAYER V2',
    });
  });
  it('registers the screen only inside a DEV guard', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../../navigation/JournalStackNavigator.tsx'),
      'utf8',
    );
    expect(source).toMatch(
      /__DEV__\s*&&\s*<Stack\.Screen\s*\n\s*name="ReviewQA"/,
    );
  });
});
