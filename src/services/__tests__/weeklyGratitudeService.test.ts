import {
  deleteLocalJournalSingleton,
  saveLocalJournalSingleton,
} from '../../storage/journalStorage';
import {emitMomentsStructuralRefresh} from '../../utils/momentsRefresh';
import {saveWeeklyGratitudeMoment} from '../weeklyGratitudeService';

jest.mock('../../storage/journalStorage', () => ({
  deleteLocalJournalSingleton: jest.fn(),
  saveLocalJournalSingleton: jest.fn(),
}));
jest.mock('../../utils/momentsRefresh', () => ({
  emitMomentsStructuralRefresh: jest.fn(),
}));

const saveSingleton = saveLocalJournalSingleton as jest.MockedFunction<typeof saveLocalJournalSingleton>;
const deleteSingleton = deleteLocalJournalSingleton as jest.MockedFunction<typeof deleteLocalJournalSingleton>;
const emitRefresh = emitMomentsStructuralRefresh as jest.MockedFunction<typeof emitMomentsStructuralRefresh>;

describe('Weekly Gratitude persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    saveSingleton.mockResolvedValue({
      id: 'weekly-1',
      content_type: 'weekly_gratitude',
      selected_date: '2026-09-21',
      content: '{}',
      created_at: '2026-09-21T20:00:00.000Z',
      updated_at: '2026-09-21T20:00:00.000Z',
    });
  });

  it('saves a distinct Weekly Gratitude singleton for the reviewed week', async () => {
    await saveWeeklyGratitudeMoment({
      items: [
        '  God gave our family peace.  ',
        'A needed conversation.',
        'Strength for each day.',
      ],
      periodStart: '2026-09-14',
      periodEnd: '2026-09-21',
      reviewId: 'review-1',
    });

    expect(saveSingleton).toHaveBeenCalledWith(
      'weekly_gratitude',
      '2026-09-21',
      JSON.stringify({
        text: 'God gave our family peace.',
        items: [
          'God gave our family peace.',
          'A needed conversation.',
          'Strength for each day.',
        ],
        periodStart: '2026-09-14',
        periodEnd: '2026-09-21',
      }),
      expect.objectContaining({source: 'weekly_review', reviewId: 'review-1'}),
    );
    expect(emitRefresh).toHaveBeenCalledWith('weekly_gratitude', '2026-09-21', ['weekly-1']);
  });

  it('removes the Weekly Gratitude Moment when its response is cleared', async () => {
    await saveWeeklyGratitudeMoment({
      items: ['   ', ''],
      periodStart: '2026-09-14',
      periodEnd: '2026-09-21',
      reviewId: 'review-1',
    });

    expect(deleteSingleton).toHaveBeenCalledWith('weekly_gratitude', '2026-09-21');
    expect(saveSingleton).not.toHaveBeenCalled();
    expect(emitRefresh).toHaveBeenCalledWith('weekly_gratitude_deleted', '2026-09-21');
  });
});
