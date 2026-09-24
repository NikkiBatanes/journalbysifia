const mockStoredValues = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStoredValues.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStoredValues.set(key, value);
  }),
}));

import {NoteBlockPreferencesService} from '../noteBlockPreferences';

describe('note block preferences', () => {
  beforeEach(() => mockStoredValues.clear());

  it('starts with every stable selectable kind and useful favorites', async () => {
    const service = new NoteBlockPreferencesService();
    await service.loadOnce();

    expect(service.getSnapshot()).toMatchObject({loaded: true, version: 2});
    expect(service.getSnapshot().enabledKinds).toHaveLength(24);
    expect(service.getSnapshot().favoriteKinds).toEqual([
      'section',
      'action',
      'scripture',
      'key',
      'quote',
    ]);
  });

  it('migrates legacy quick kinds into sanitized favorites', async () => {
    mockStoredValues.set(
      'prefs:noteBlocks:v1',
      JSON.stringify({
        version: 1,
        enabledKinds: ['quote', 'not-a-block'],
        quickKinds: ['not-a-block', 'quote', 'action'],
      }),
    );
    const service = new NoteBlockPreferencesService();
    await service.loadOnce();

    expect(service.getSnapshot().enabledKinds).toEqual(['quote']);
    expect(service.getSnapshot().favoriteKinds).toEqual(['quote']);
    expect(
      JSON.parse(mockStoredValues.get('prefs:noteBlocks:v2') || '{}'),
    ).toMatchObject({version: 2, favoriteKinds: ['quote']});
  });

  it('persists visibility and allows unlimited favorites', async () => {
    const service = new NoteBlockPreferencesService();
    await service.loadOnce();
    await service.setKindEnabled('photo', false);

    expect(service.isKindEnabled('photo')).toBe(false);
    expect(JSON.parse(mockStoredValues.get('prefs:noteBlocks:v2') || '{}').enabledKinds)
      .not.toContain('photo');

    for (const kind of [...service.getSnapshot().favoriteKinds]) {
      await service.toggleFavoriteKind(kind);
    }
    const favorites = [
      'bullets',
      'numbered',
      'remember',
      'response',
      'question',
      'prayer',
      'voice',
    ] as const;
    for (const kind of favorites) {
      expect(await service.toggleFavoriteKind(kind)).toBe(true);
    }
    expect(service.getSnapshot().favoriteKinds).toEqual(favorites);
    expect(
      JSON.parse(mockStoredValues.get('prefs:noteBlocks:v2') || '{}').favoriteKinds,
    ).toEqual(favorites);
  });

  it('replaces favorites with a sanitized onboarding selection', async () => {
    const service = new NoteBlockPreferencesService();
    await service.loadOnce();
    await service.setKindEnabled('photo', false);

    await service.setFavoriteKinds([
      'prayer',
      'remember',
      'prayer',
      'photo',
    ]);

    expect(service.getSnapshot().favoriteKinds).toEqual([
      'prayer',
      'remember',
    ]);
    expect(
      JSON.parse(mockStoredValues.get('prefs:noteBlocks:v2') || '{}').favoriteKinds,
    ).toEqual(['prayer', 'remember']);
  });

  it('never allows a context to lose its final available block', async () => {
    const service = new NoteBlockPreferencesService();
    await service.loadOnce();
    const kindsExceptResponse = service
      .getSnapshot()
      .enabledKinds.filter(kind => kind !== 'response');
    for (const kind of kindsExceptResponse) {
      expect(await service.setKindEnabled(kind, false)).toBe(true);
    }
    expect(await service.setKindEnabled('response', false)).toBe(false);
    expect(service.isKindEnabled('response')).toBe(true);
  });
});
