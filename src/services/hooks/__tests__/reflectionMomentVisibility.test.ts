import {
  findLocalReflection,
  getLocalReflections,
  type LocalReflectionEntry,
} from '../../../storage/reflectionStorage';
import {loadLocalReflectionData} from '../useReflectionData';

jest.mock('../../../context/IndustryStandardAuthContext', () => ({
  useAuth: () => ({user: null}),
}));

jest.mock('../../../storage/reflectionStorage', () => ({
  createLocalReflection: jest.fn(),
  deleteLocalReflection: jest.fn(),
  findLocalReflection: jest.fn(),
  getLocalReflections: jest.fn(),
  updateLocalReflection: jest.fn(),
}));

const testimony: LocalReflectionEntry = {
  id: 'for-me-day-testimony',
  title: 'My 3rd New Life Day',
  content: 'God met me with grace.',
  type: 'gospel_anniversary',
  source: 'for_me_day',
  selected_date: '2026-09-24',
  created_at: '2026-09-24T08:00:00.000Z',
  updated_at: '2026-09-24T08:00:00.000Z',
  metadata: {journalClassification: 'milestone'},
};

describe('reflection Moments data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads a For Me Day testimony by its canonical Moments ID', async () => {
    (findLocalReflection as jest.Mock).mockResolvedValue(testimony);

    await expect(loadLocalReflectionData('2026-09-24', [testimony.id])).resolves.toEqual([
      expect.objectContaining({
        id: testimony.id,
        type: 'gospel_anniversary',
        source: 'for_me_day',
        content: testimony.content,
      }),
    ]);
    expect(findLocalReflection).toHaveBeenCalledWith(testimony.id);
    expect(getLocalReflections).not.toHaveBeenCalled();
  });

  it('keeps the standard Heart Journal loader limited to free and guided entries', async () => {
    (getLocalReflections as jest.Mock).mockResolvedValue([]);

    await loadLocalReflectionData('2026-09-24');

    expect(getLocalReflections).toHaveBeenNthCalledWith(1, 'free', '2026-09-24');
    expect(getLocalReflections).toHaveBeenNthCalledWith(2, 'guided', '2026-09-24');
  });
});
