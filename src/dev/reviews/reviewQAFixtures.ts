import type {ReviewType} from '../../storage/reviewStorage';
import {getWeeklyPeriodFor, type ReviewPeriod} from '../../services/reviewPeriodService';
import {REVIEW_QA_WEEKLY_REFERENCE_DATE} from './reviewQAClock';

export const REVIEW_QA_PREFIX = 'dev-review-v2:';
export type ReviewQAScenario = 'weekly';

export interface ReviewQADefinition { id: ReviewQAScenario; title: string; status: string; type: ReviewType; period: ReviewPeriod; density: 'rich' | 'sparse' | 'zero'; referenceDate:string; }

const required = <T>(value: T | null): T => { if (!value) throw new Error('QA reference date does not support this period.'); return value; };
const weekly = getWeeklyPeriodFor(0, REVIEW_QA_WEEKLY_REFERENCE_DATE);

export const REVIEW_QA_SCENARIOS: ReviewQADefinition[] = [
  {id:'weekly',title:'Weekly Review',status:'MORNING FLOW · 7 CHECK-INS',type:'weekly',period:weekly,density:'rich',referenceDate:REVIEW_QA_WEEKLY_REFERENCE_DATE},
];

export const getReviewQAScenario = (id: ReviewQAScenario) => required(REVIEW_QA_SCENARIOS.find(item => item.id === id) ?? null);

const localDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

/** Uses the same period object that is passed to the production Review screen. */
export const formatReviewQAPeriod = (scenario: ReviewQADefinition): string => {
  const start = localDate(scenario.period.periodStart);
  const end = localDate(scenario.period.periodEnd);
  return `${start.toLocaleDateString(undefined, {month: 'long', day: 'numeric'})}–${end.toLocaleDateString(undefined, {month: 'long', day: 'numeric', year: 'numeric'})}`;
};
