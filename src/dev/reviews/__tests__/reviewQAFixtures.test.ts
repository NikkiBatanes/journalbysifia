import fs from 'fs';
import path from 'path';
import {formatReviewQAPeriod, REVIEW_QA_SCENARIOS, getReviewQAScenario} from '../reviewQAFixtures';

describe('Review QA period continuity and DEV boundary',()=>{
  it('contains only the Monday-start September Weekly period',()=>{
    expect(REVIEW_QA_SCENARIOS).toHaveLength(1);
    expect(REVIEW_QA_SCENARIOS.map(item=>item.id)).toEqual(['weekly']);
    expect(getReviewQAScenario('weekly')).toMatchObject({referenceDate:'2026-09-21',period:{periodStart:'2026-09-14',periodEnd:'2026-09-20'}});
  });
  it('uses the same Weekly dates in its human label and Review route data',()=>{
    expect(formatReviewQAPeriod(getReviewQAScenario('weekly'))).toContain('September 14');
    expect(formatReviewQAPeriod(getReviewQAScenario('weekly'))).toContain('September 20, 2026');
    expect(getReviewQAScenario('weekly')).toMatchObject({density:'rich',status:'FULL WEEK · 10 GUIDED · 7 SCRIPTURE · PRAYER V2'});
  });
  it('registers the screen only inside a DEV guard',()=>{
    const source=fs.readFileSync(path.resolve(__dirname,'../../../navigation/JournalStackNavigator.tsx'),'utf8');
    expect(source).toMatch(/__DEV__\s*&&\s*<Stack\.Screen\s*\n\s*name="ReviewQA"/);
  });
});
