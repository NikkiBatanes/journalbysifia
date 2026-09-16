import { getWeeklyRhythm } from '../weeklyRhythmService';
import { getReviewCapture } from '../reviewCaptureService';
import { getRoutineState } from '../../storage/routineStateStorage';
import { getLocalJournalSingleton } from '../../storage/journalStorage';
import { getLocalPrayers } from '../../storage/prayerStorage';

jest.mock('../reviewCaptureService', () => ({ getReviewCapture: jest.fn() }));
jest.mock('../../storage/routineStateStorage', () => ({ getRoutineState: jest.fn() }));
jest.mock('../../storage/journalStorage', () => ({ getLocalJournalSingleton: jest.fn() }));
jest.mock('../../storage/prayerStorage', () => ({ getLocalPrayers: jest.fn() }));

describe('weekly rhythm', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getReviewCapture as jest.Mock).mockResolvedValue({ items: [] });
    (getRoutineState as jest.Mock).mockResolvedValue(null);
    (getLocalJournalSingleton as jest.Mock).mockResolvedValue(null);
    (getLocalPrayers as jest.Mock).mockResolvedValue([]);
  });

  it('counts unique days, completed routines, and one CAST session with edits', async () => {
    (getReviewCapture as jest.Mock).mockResolvedValue({ items: [
      { id: 'routine-ref', kind: 'journal', selectedDate: '2026-09-07' },
      { id: 'entry', kind: 'reflection', selectedDate: '2026-09-07' },
      { id: 'entry', kind: 'reflection', selectedDate: '2026-09-07' },
    ] });
    (getRoutineState as jest.Mock).mockImplementation(async (routine, date) => date === '2026-09-07'
      ? { completed: routine === 'morning', content_refs: { focus: { local_id: 'routine-ref' } } } : null);
    (getLocalPrayers as jest.Mock).mockImplementation(async date => date === '2026-09-08' ? [
      { id: 'cast-1', content: 'Confession', metadata: { prayer_style: 'cast', prayer_session_id: 'session' } },
      { id: 'cast-2', content: 'Adoration', metadata: { prayer_style: 'cast', prayer_session_id: 'session' } },
      { id: 'cast-3', content: 'Edited confession', metadata: { prayer_style: 'cast', prayer_session_id: 'session' } },
      { id: 'original-request', content: 'Request', is_prayer_request: true, prayed: true },
    ] : []);
    const result = await getWeeklyRhythm('2026-09-07', '2026-09-13');
    expect(result).toMatchObject({ activeDays: 2, morning: 1, evening: 0, prayers: 1, journal: 1 });
    expect(result.days).toHaveLength(7);
    expect(result.days[0]).toEqual({ date: '2026-09-07', active: true });
    expect(result.days[6]).toEqual({ date: '2026-09-13', active: false });
    expect(getReviewCapture).toHaveBeenCalledWith('2026-09-07', '2026-09-13');
  });

  it('shows zero for an empty week and follows the supplied Sunday start', async () => {
    const result = await getWeeklyRhythm('2026-09-06', '2026-09-12');
    expect(result).toMatchObject({ activeDays: 0, morning: 0, evening: 0, prayers: 0, journal: 0 });
    expect(result.days[0].date).toBe('2026-09-06');
    expect(result.days.every(day => !day.active)).toBe(true);
  });

  it('includes a saved check-in in active days without inflating completed routines', async () => {
    (getLocalJournalSingleton as jest.Mock).mockImplementation(async (_type, date) => date === '2026-09-09' ? { id: 'check-in' } : null);
    expect(await getWeeklyRhythm('2026-09-07', '2026-09-13')).toMatchObject({ activeDays: 1, morning: 0 });
  });
});
