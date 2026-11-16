import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearSessionNotesDraft,
  loadSessionNotesDraft,
  saveSessionNotesDraft,
  sessionNotesDraftKey,
  type SessionNotesDraftInput,
} from '../sessionNotesDraftStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

const draft: SessionNotesDraftInput = {
  selectedDate: '2026-11-16',
  reflectionId: null,
  sessionNoteType: 'meeting',
  title: 'Team gathering',
  mainScripture: '',
  mainScriptureInput: '',
  series: '',
  part: '',
  speaker: 'Nikki',
  church: '',
  blocks: [{id: 'note-1', kind: 'text', text: 'Do not lose this'}],
  notice: '',
  carry: '',
  prayer: '',
  prayerAnswer: '',
  showDetails: false,
  stage: 2,
  reflectionStep: 0,
};

describe('Session Notes draft storage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves and restores a complete local editor checkpoint', async () => {
    const saved = await saveSessionNotesDraft(draft);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(saved));

    expect(await loadSessionNotesDraft('2026-11-16', 'meeting')).toEqual(saved);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      sessionNotesDraftKey('2026-11-16', 'meeting'),
      expect.stringContaining('Do not lose this'),
    );
  });

  it('keeps drafts for existing records isolated by reflection identity', () => {
    expect(sessionNotesDraftKey('2026-11-16', 'sermon', 'reflection-1')).toBe(
      'session_notes_draft_v1:2026-11-16:record:reflection-1',
    );
    expect(sessionNotesDraftKey('2026-11-16', 'sermon', 'reflection-2')).not.toBe(
      sessionNotesDraftKey('2026-11-16', 'sermon', 'reflection-1'),
    );
  });

  it('ignores malformed drafts and clears only the requested checkpoint', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{"format":"old"}');
    expect(await loadSessionNotesDraft('2026-11-16', 'meeting')).toBeNull();

    await clearSessionNotesDraft('2026-11-16', 'meeting');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      sessionNotesDraftKey('2026-11-16', 'meeting'),
    );
  });
});
