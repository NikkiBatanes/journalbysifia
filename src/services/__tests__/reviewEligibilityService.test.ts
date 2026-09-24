import { getReviewEligibility } from '../reviewEligibilityService';
import { getValidJournalHistoryStart } from '../reviewHistoryService';
import { getLocalReviewForPeriod } from '../../storage/reviewStorage';
import { getReviewSettings } from '../../storage/reviewSettingsStorage';

jest.mock('../reviewHistoryService', () => ({getValidJournalHistoryStart: jest.fn()}));
jest.mock('../../storage/reviewStorage', () => ({getLocalReviewForPeriod: jest.fn()}));
jest.mock('../../storage/reviewSettingsStorage', () => ({getReviewSettings: jest.fn()}));

const settings = {
  weekEndsOn: 0,
  reminderTime: '19:00',
  enabledCadences: {weekly: true, monthly: true, quarterly: true, year_end: true, begin_year: true},
};

describe('read-only Review eligibility', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getReviewSettings as jest.Mock).mockResolvedValue(settings);
    (getLocalReviewForPeriod as jest.Mock).mockResolvedValue(null);
  });

  it.each([
    ['2026-09-21', '2026-09-21'], // Monday
    ['2026-09-23', '2026-09-23'], // Wednesday
    ['2026-09-27', '2026-09-27'], // Sunday
  ])('does not offer a week beginning before history (%s)', async (historyStart, anchor) => {
    (getValidJournalHistoryStart as jest.Mock).mockResolvedValue(historyStart);
    expect((await getReviewEligibility(anchor, 'monday')).allActive).toHaveLength(0);
  });

  it('does not offer a partial start month, quarter, or year', async () => {
    (getValidJournalHistoryStart as jest.Mock).mockResolvedValue('2026-09-21');
    const october = await getReviewEligibility('2026-10-01', 'monday');
    expect(october.allActive.map(item => item.type)).not.toContain('monthly');

    (getValidJournalHistoryStart as jest.Mock).mockResolvedValue('2026-12-30');
    const january = await getReviewEligibility('2027-01-01', 'monday');
    expect(january.allActive.map(item => item.type)).not.toContain('year_end');
  });

  it('allows Beginning Year only when history starts no later than target-year start', async () => {
    (getValidJournalHistoryStart as jest.Mock).mockResolvedValue('2027-01-01');
    expect((await getReviewEligibility('2027-01-01')).allActive.map(item => item.type)).toContain('begin_year');
    (getValidJournalHistoryStart as jest.Mock).mockResolvedValue('2027-01-02');
    expect((await getReviewEligibility('2027-01-02')).allActive.map(item => item.type)).not.toContain('begin_year');
  });

  it('reads records without creating them', async () => {
    (getValidJournalHistoryStart as jest.Mock).mockResolvedValue('2025-01-01');
    await getReviewEligibility('2026-10-01');
    expect(getLocalReviewForPeriod).toHaveBeenCalled();
  });

  it('supports an explicit QA anchor context without reading or changing production settings', async () => {
    const monthlyOnly = {...settings, enabledCadences: {...settings.enabledCadences, weekly: false, quarterly: false, year_end: false, begin_year: false}};
    const result = await getReviewEligibility('2027-01-05', undefined, {
      settingsOverride: monthlyOnly,
      historyStartOverride: '2026-01-02',
    });
    expect(result.allActive.map(item => item.type)).toEqual(['monthly']);
    expect(getReviewSettings).not.toHaveBeenCalled();
    expect(getValidJournalHistoryStart).not.toHaveBeenCalled();
  });

  it('keeps the prior monthly review actionable only through the first seven days', async () => {
    const monthlyOnly = {...settings, enabledCadences: {...settings.enabledCadences, weekly: false, quarterly: false, year_end: false, begin_year: false}};
    const options = {settingsOverride: monthlyOnly, historyStartOverride: '2025-01-01'};

    expect((await getReviewEligibility('2026-10-07', undefined, options)).allActive.map(item => item.type)).toEqual(['monthly']);
    expect((await getReviewEligibility('2026-10-08', undefined, options)).allActive.map(item => item.type)).toEqual([]);
  });

  it('does not delete or return an expired monthly draft as actionable', async () => {
    const monthlyOnly = {...settings, enabledCadences: {...settings.enabledCadences, weekly: false, quarterly: false, year_end: false, begin_year: false}};
    (getLocalReviewForPeriod as jest.Mock).mockResolvedValue({
      id: 'monthly-draft',
      type: 'monthly',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      status: 'draft',
    });

    const result = await getReviewEligibility('2026-10-08', undefined, {
      settingsOverride: monthlyOnly,
      historyStartOverride: '2025-01-01',
    });

    expect(result.allActive).toEqual([]);
    expect(getLocalReviewForPeriod).not.toHaveBeenCalled();
  });

  it('removes completed higher-priority Reviews before selecting main', async () => {
    (getValidJournalHistoryStart as jest.Mock).mockResolvedValue('2025-01-01');
    (getLocalReviewForPeriod as jest.Mock).mockImplementation(async (type: string, start: string, end: string) =>
      type === 'quarterly' ? {id: 'q', type, periodStart: start, periodEnd: end, status: 'completed'} : null,
    );
    expect((await getReviewEligibility('2026-10-01')).main?.type).toBe('monthly');

    (getLocalReviewForPeriod as jest.Mock).mockImplementation(async (type: string, start: string, end: string) =>
      type === 'monthly' ? {id: 'm', type, periodStart: start, periodEnd: end, status: 'completed'} : null,
    );
    expect((await getReviewEligibility('2026-10-01')).main?.type).toBe('quarterly');
  });
});
