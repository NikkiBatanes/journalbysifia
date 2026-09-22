import {
  getBeginYearPeriodFor,
  getMonthlyPeriodFor,
  getQuarterlyPeriodFor,
  getWeeklyPeriodFor,
  getYearEndPeriodFor,
} from '../reviewPeriodService';

describe('Review periods close before becoming available', () => {
  it('uses the prior complete Monday-start week, including on Sunday', () => {
    expect(getWeeklyPeriodFor(0, '2026-09-20')).toMatchObject({
      periodStart: '2026-09-07', periodEnd: '2026-09-13', availableFrom: '2026-09-14',
    });
    expect(getWeeklyPeriodFor(0, '2026-09-21')).toMatchObject({
      periodStart: '2026-09-14', periodEnd: '2026-09-20', availableFrom: '2026-09-21',
    });
  });

  it('uses the prior complete Sunday-start week', () => {
    expect(getWeeklyPeriodFor(6, '2026-09-20')).toMatchObject({
      periodStart: '2026-09-13', periodEnd: '2026-09-19', availableFrom: '2026-09-20',
    });
  });

  it('does not expose month, quarter, or year before closure', () => {
    expect(getMonthlyPeriodFor('2026-09-30')).toMatchObject({periodStart: '2026-08-01', periodEnd: '2026-08-31'});
    expect(getMonthlyPeriodFor('2026-10-01')).toMatchObject({periodStart: '2026-09-01', periodEnd: '2026-09-30'});
    expect(getQuarterlyPeriodFor('2026-09-30')).toMatchObject({periodStart: '2026-04-01', periodEnd: '2026-06-30'});
    expect(getQuarterlyPeriodFor('2026-10-01')).toMatchObject({periodStart: '2026-07-01', periodEnd: '2026-09-30'});
    expect(getYearEndPeriodFor('2026-12-31')).toBeNull();
    expect(getYearEndPeriodFor('2027-01-01')).toMatchObject({periodStart: '2026-01-01', periodEnd: '2026-12-31'});
  });

  it('identifies Beginning Year by its full target year', () => {
    expect(getBeginYearPeriodFor('2027-01-01')).toMatchObject({periodStart: '2027-01-01', periodEnd: '2027-12-31'});
  });
});
