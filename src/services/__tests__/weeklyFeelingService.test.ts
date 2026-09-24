import {getLocalJournalSingleton} from '../../storage/journalStorage';
import {getLocalReviewsByType} from '../../storage/reviewStorage';
import {
  getMonthlyCheckInFeelings,
  getMonthlyLifeCheckInSummary,
  getMonthlyLookingForwardFeelings,
  getMonthlyWeeklyReviewFeelings,
  getWeeklyCheckInFeelings,
} from '../weeklyFeelingService';

jest.mock('../../storage/journalStorage', () => ({
  getLocalJournalSingleton: jest.fn(),
}));
jest.mock('../../storage/reviewStorage', () => ({
  getLocalReviewsByType: jest.fn(),
}));

describe('weekly check-in feelings', () => {
  beforeEach(() => jest.resetAllMocks());

  it('collects canonical Morning feeling choices and orders them by frequency', async () => {
    const byDate: Record<string, string> = {
      '2026-12-28': 'Hopeful',
      '2026-12-29': 'Overwhelmed',
      '2026-12-30': 'Hopeful',
      '2027-01-01': 'Tired',
    };
    (getLocalJournalSingleton as jest.Mock).mockImplementation(
      async (_type: string, date: string) =>
        byDate[date]
          ? {content: JSON.stringify({feeling: byDate[date]})}
          : null,
    );
    await expect(
      getWeeklyCheckInFeelings('2026-12-28', '2027-01-03'),
    ).resolves.toEqual([
      {name: 'Hopeful', count: 2, dates: ['2026-12-28', '2026-12-30']},
      {name: 'Overwhelmed', count: 1, dates: ['2026-12-29']},
      {name: 'Tired', count: 1, dates: ['2027-01-01']},
    ]);
    expect(getLocalJournalSingleton).toHaveBeenCalledTimes(7);
  });

  it('ignores missing, blank, and malformed check-ins', async () => {
    (getLocalJournalSingleton as jest.Mock)
      .mockResolvedValueOnce({content: 'not-json'})
      .mockResolvedValueOnce({content: JSON.stringify({feeling: '  '})})
      .mockResolvedValue(null);
    await expect(
      getWeeklyCheckInFeelings('2026-12-28', '2027-01-03'),
    ).resolves.toEqual([]);
  });

  it('collates every monthly feeling with its dated underneath reflection', async () => {
    const byDate: Record<string, Record<string, string>> = {
      '2026-08-02': {
        feeling: 'Hopeful',
        underneathIt: 'A fresh start',
        feelingIcon: 'weather-sunny',
        feelingIconType: 'material',
      },
      '2026-08-14': {feeling: 'Tired', underneathIt: 'A long week'},
      '2026-08-25': {feeling: 'hopeful', underneathIt: 'Clarity is returning'},
    };
    (getLocalJournalSingleton as jest.Mock).mockImplementation(
      async (_type: string, date: string) =>
        byDate[date] ? {content: JSON.stringify(byDate[date])} : null,
    );

    await expect(
      getMonthlyCheckInFeelings('2026-08-01', '2026-08-31'),
    ).resolves.toEqual([
      {
        name: 'Hopeful',
        count: 2,
        dates: ['2026-08-02', '2026-08-25'],
        entries: [
          {
            date: '2026-08-02',
            underneathIt: 'A fresh start',
            feelingIcon: 'weather-sunny',
            feelingIconType: 'material',
          },
          {date: '2026-08-25', underneathIt: 'Clarity is returning'},
        ],
      },
      {
        name: 'Tired',
        count: 1,
        dates: ['2026-08-14'],
        entries: [{date: '2026-08-14', underneathIt: 'A long week'}],
      },
    ]);
    expect(getLocalJournalSingleton).toHaveBeenCalledTimes(31);
  });

  it('collates weekly retrospective feelings separately by completed week', async () => {
    (getLocalReviewsByType as jest.Mock).mockResolvedValue([
      {
        status: 'completed',
        periodEnd: '2026-08-09',
        answers: {week_feelings: 'Peaceful|Hopeful'},
      },
      {
        status: 'completed',
        periodEnd: '2026-08-16',
        answers: {
          week_feelings: 'Peaceful|Other',
          week_feeling_other: 'Stretched',
        },
      },
      {
        status: 'draft',
        periodEnd: '2026-08-23',
        answers: {week_feelings: 'Tired'},
      },
      {
        status: 'completed',
        periodEnd: '2026-09-06',
        answers: {week_feelings: 'Joyful'},
      },
    ]);

    await expect(
      getMonthlyWeeklyReviewFeelings('2026-08-01', '2026-08-31'),
    ).resolves.toEqual({
      reviewCount: 2,
      feelings: [
        {
          name: 'Peaceful',
          count: 2,
          dates: ['2026-08-09', '2026-08-16'],
        },
        {name: 'Hopeful', count: 1, dates: ['2026-08-09']},
        {name: 'Stretched', count: 1, dates: ['2026-08-16']},
      ],
    });
  });

  it('interprets Weekly Whole-life answers as monthly area patterns', async () => {
    (getLocalReviewsByType as jest.Mock).mockResolvedValue([
      {
        status: 'completed',
        periodEnd: '2026-08-16',
        answers: {
          week_check_in_mind: 'struggling',
          week_check_in_rest: 'struggling',
        },
      },
      {
        status: 'completed',
        periodEnd: '2026-08-09',
        answers: {
          week_check_in_mind: 'okay',
          week_check_in_rest: 'struggling',
        },
      },
      {
        status: 'completed',
        periodEnd: '2026-08-23',
        answers: {
          week_check_in_mind: 'well',
          week_check_in_rest: 'okay',
        },
      },
      {
        status: 'completed',
        periodEnd: '2026-08-30',
        answers: {
          week_check_in_mind: 'well',
          week_check_in_rest: 'well',
        },
      },
    ]);

    const summary = await getMonthlyLifeCheckInSummary(
      '2026-08-01',
      '2026-08-31',
    );

    expect(summary.reviewCount).toBe(4);
    expect(summary.areas.find(area => area.key === 'mind')).toMatchObject({
      values: ['okay', 'struggling', 'well', 'well'],
      counts: {struggling: 1, okay: 1, well: 2},
      interpretation: 'Mostly well',
      trend: 'improving',
      trendLabel: 'Improved by month’s end',
    });
    expect(summary.areas.find(area => area.key === 'rest')).toMatchObject({
      counts: {struggling: 2, okay: 1, well: 1},
      interpretation: 'Often needed care',
      trend: 'improving',
    });
    expect(summary.insight).toBe(
      'Mind was the most supported. Rest needed the most care. Rest strengthened by month’s end.',
    );
  });

  it('keeps missing Weekly Whole-life answers visible without inventing a pattern', async () => {
    (getLocalReviewsByType as jest.Mock).mockResolvedValue([
      {
        status: 'completed',
        periodEnd: '2026-08-09',
        answers: {
          week_check_in_mind: 'well',
          week_check_in_body: 'well',
        },
      },
      {
        status: 'completed',
        periodEnd: '2026-08-16',
        answers: {},
      },
      {
        status: 'completed',
        periodEnd: '2026-08-23',
        answers: {week_check_in_mind: 'okay'},
      },
    ]);

    const summary = await getMonthlyLifeCheckInSummary(
      '2026-08-01',
      '2026-08-31',
    );

    expect(summary.areas.find(area => area.key === 'mind')).toMatchObject({
      values: ['well', null, 'okay'],
      answeredWeeks: 2,
      interpretation: 'Mixed through the month',
      trend: 'declining',
    });
    expect(summary.areas.find(area => area.key === 'body')).toMatchObject({
      values: ['well', null, null],
      answeredWeeks: 1,
      interpretation: 'One check-in only',
      trend: 'insufficient',
      trendLabel: 'Not enough to see a pattern',
    });
    expect(summary.areas.find(area => area.key === 'rest')).toMatchObject({
      values: [null, null, null],
      answeredWeeks: 0,
      interpretation: 'No check-ins yet',
      trend: 'insufficient',
    });
    expect(summary.insight).toBe(
      'Mind was the only area with enough weekly answers to interpret this month.',
    );
  });

  it('collates daily Looking Forward emotions for the month', async () => {
    const byDate: Record<string, string> = {
      '2026-08-03': 'Hopeful',
      '2026-08-11': 'Trusting',
      '2026-08-17': 'Hopeful',
    };
    (getLocalJournalSingleton as jest.Mock).mockImplementation(
      async (type: string, date: string) =>
        type === 'looking_forward' && byDate[date]
          ? {content: JSON.stringify({emotionName: byDate[date]})}
          : null,
    );

    await expect(
      getMonthlyLookingForwardFeelings('2026-08-01', '2026-08-31'),
    ).resolves.toEqual([
      {
        name: 'Hopeful',
        count: 2,
        dates: ['2026-08-03', '2026-08-17'],
      },
      {name: 'Trusting', count: 1, dates: ['2026-08-11']},
    ]);
  });
});
