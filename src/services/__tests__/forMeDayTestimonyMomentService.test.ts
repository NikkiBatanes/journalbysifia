import {
  createLocalReflection,
  getAllLocalReflectionsByType,
  updateLocalReflection,
} from '../../storage/reflectionStorage';
import {emitMomentsStructuralRefresh} from '../../utils/momentsRefresh';
import {syncForMeDayTestimonyMoment} from '../forMeDayTestimonyMomentService';

jest.mock('../../storage/reflectionStorage', () => ({
  createLocalReflection: jest.fn(),
  getAllLocalReflectionsByType: jest.fn(),
  updateLocalReflection: jest.fn(),
}));

jest.mock('../../utils/momentsRefresh', () => ({
  emitMomentsStructuralRefresh: jest.fn(),
}));

const settings = {
  spiritualBirthday: '2018-09-18',
  originalStory: 'Jesus met me with grace.',
  testimonyWrittenAt: '2026-09-24T07:42:00.000Z',
  testimonyUpdatedAt: '2026-09-25T08:15:00.000Z',
};

describe('For Me Day testimony Moment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a milestone Moment on the day the testimony was written', async () => {
    jest.mocked(getAllLocalReflectionsByType).mockResolvedValue([]);
    jest.mocked(createLocalReflection).mockResolvedValue({
      id: 'testimony-moment',
      title: 'My testimony',
      content: settings.originalStory,
      type: 'gospel_anniversary',
      source: 'for_me_day',
      selected_date: '2026-09-24',
      created_at: settings.testimonyWrittenAt,
      updated_at: settings.testimonyWrittenAt,
      metadata: {forMeDayEntry: 'testimony'},
    });

    await syncForMeDayTestimonyMoment(settings);

    expect(createLocalReflection).toHaveBeenCalledWith(expect.objectContaining({
      title: 'My testimony',
      content: settings.originalStory,
      type: 'gospel_anniversary',
      source: 'for_me_day',
      selected_date: '2026-09-24',
      metadata: expect.objectContaining({
        journalClassification: 'milestone',
        forMeDayEntry: 'testimony',
        testimonyWrittenAt: settings.testimonyWrittenAt,
        testimonyUpdatedAt: settings.testimonyUpdatedAt,
      }),
    }));
    expect(emitMomentsStructuralRefresh).toHaveBeenCalledWith(
      'gospel_anniversary',
      '2026-09-24',
      ['testimony-moment'],
    );
  });

  it('updates the existing testimony Moment instead of creating a duplicate', async () => {
    const existing = {
      id: 'testimony-moment',
      title: 'My testimony',
      content: 'Earlier wording.',
      type: 'gospel_anniversary',
      source: 'for_me_day',
      selected_date: '2026-09-24',
      created_at: settings.testimonyWrittenAt,
      updated_at: settings.testimonyWrittenAt,
      metadata: {
        journalClassification: 'milestone',
        forMeDayEntry: 'testimony',
        testimonyWrittenAt: settings.testimonyWrittenAt,
        spiritualBirthday: settings.spiritualBirthday,
      },
    };
    jest.mocked(getAllLocalReflectionsByType).mockResolvedValue([existing]);
    jest.mocked(updateLocalReflection).mockResolvedValue({
      ...existing,
      content: settings.originalStory,
    });

    await syncForMeDayTestimonyMoment(settings);

    expect(updateLocalReflection).toHaveBeenCalledWith(expect.objectContaining({
      id: existing.id,
      content: settings.originalStory,
    }));
    expect(createLocalReflection).not.toHaveBeenCalled();
  });

  it('does not create a Moment when no testimony has been written', async () => {
    await expect(syncForMeDayTestimonyMoment({
      ...settings,
      originalStory: '  ',
    })).resolves.toBeNull();

    expect(getAllLocalReflectionsByType).not.toHaveBeenCalled();
    expect(createLocalReflection).not.toHaveBeenCalled();
  });
});
