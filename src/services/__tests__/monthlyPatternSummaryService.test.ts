import {summarizeMonthlyPatterns} from '../monthlyPatternSummaryService';

describe('summarizeMonthlyPatterns', () => {
  it('summarizes the most repeated feeling from every monthly source', () => {
    expect(
      summarizeMonthlyPatterns({
        morning: [
          {name: 'Hopeful', count: 4, dates: []},
          {name: 'Tired', count: 2, dates: []},
        ],
        weekly: {
          reviewCount: 4,
          feelings: [
            {name: 'Peaceful', count: 3, dates: []},
            {name: 'Wrestling', count: 1, dates: []},
          ],
        },
        lookingForward: [
          {name: 'Hopeful', count: 5, dates: []},
          {name: 'Trusting', count: 2, dates: []},
        ],
      }),
    ).toBe(
      'Hopeful appeared most often in your mornings (4 days). Across your weekly check-ins, Peaceful showed up most often (3×). Looking toward the next day, Hopeful appeared most often (5 days).',
    );
  });

  it('describes ties and varied data without inventing a diagnosis', () => {
    expect(
      summarizeMonthlyPatterns({
        morning: [
          {name: 'Hopeful', count: 2, dates: []},
          {name: 'Tired', count: 2, dates: []},
        ],
        weekly: {
          reviewCount: 2,
          feelings: [
            {name: 'Peaceful', count: 1, dates: []},
            {name: 'Wrestling', count: 1, dates: []},
          ],
        },
        lookingForward: [],
      }),
    ).toBe(
      'Hopeful and Tired appeared most often in your mornings (2 days each). Your weekly check-ins varied, with no feeling repeating.',
    );
  });

  it('returns no summary when there is no feeling data', () => {
    expect(
      summarizeMonthlyPatterns({
        morning: [],
        weekly: {reviewCount: 0, feelings: []},
        lookingForward: [],
      }),
    ).toBe('');
  });
});
