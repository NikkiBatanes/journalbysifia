import AsyncStorage from '@react-native-async-storage/async-storage';
import {useEffect, useSyncExternalStore} from 'react';

import {
  NOTE_BLOCK_CONTEXTS,
  NOTE_BLOCK_REGISTRY,
  isJournalBlockKind,
  type JournalBlockKind,
  type SelectableJournalBlockKind,
} from '../components/journal/shared/noteBlockRegistry';

const STORAGE_KEY = 'prefs:noteBlocks:v2';
const LEGACY_STORAGE_KEY = 'prefs:noteBlocks:v1';
const SCHEMA_VERSION = 2;

const selectableKinds = Object.values(NOTE_BLOCK_REGISTRY)
  .filter(definition => definition.selectable)
  .map(definition => definition.kind) as SelectableJournalBlockKind[];

const selectableKindSet = new Set<JournalBlockKind>(selectableKinds);

export type NoteBlockPreferencesSnapshot = Readonly<{
  version: typeof SCHEMA_VERSION;
  loaded: boolean;
  enabledKinds: readonly SelectableJournalBlockKind[];
  favoriteKinds: readonly SelectableJournalBlockKind[];
}>;

type PersistedNoteBlockPreferences = {
  version: typeof SCHEMA_VERSION;
  enabledKinds: SelectableJournalBlockKind[];
  favoriteKinds: SelectableJournalBlockKind[];
  quickKinds?: SelectableJournalBlockKind[];
};

const DEFAULT_FAVORITE_KINDS: SelectableJournalBlockKind[] = [
  'section',
  'action',
  'scripture',
  'key',
  'quote',
];

const uniqueSelectableKinds = (value: unknown): SelectableJournalBlockKind[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value.filter(
        (kind): kind is SelectableJournalBlockKind =>
          isJournalBlockKind(kind) && selectableKindSet.has(kind),
      ),
    ),
  );
};

const sanitizePreferences = (value: unknown): PersistedNoteBlockPreferences => {
  const candidate = value && typeof value === 'object'
    ? (value as Partial<PersistedNoteBlockPreferences>)
    : {};
  const parsedEnabled = uniqueSelectableKinds(candidate.enabledKinds);
  const enabledKinds = parsedEnabled.length ? parsedEnabled : [...selectableKinds];
  const enabledSet = new Set(enabledKinds);
  const persistedFavorites = Array.isArray(candidate.favoriteKinds)
    ? candidate.favoriteKinds
    : candidate.quickKinds;
  const parsedFavorites = uniqueSelectableKinds(persistedFavorites).filter(
    kind => enabledSet.has(kind),
  );
  const favoriteKinds = Array.isArray(persistedFavorites)
    ? parsedFavorites
    : DEFAULT_FAVORITE_KINDS.filter(kind => enabledSet.has(kind));
  return {version: SCHEMA_VERSION, enabledKinds, favoriteKinds};
};

export class NoteBlockPreferencesService {
  private loaded = false;
  private listeners = new Set<() => void>();
  private preferences = sanitizePreferences(null);
  private snapshot: NoteBlockPreferencesSnapshot = this.createSnapshot();
  private persistenceQueue: Promise<void> = Promise.resolve();

  private createSnapshot(): NoteBlockPreferencesSnapshot {
    return Object.freeze({
      version: SCHEMA_VERSION,
      loaded: this.loaded,
      enabledKinds: Object.freeze([...this.preferences.enabledKinds]),
      favoriteKinds: Object.freeze([...this.preferences.favoriteKinds]),
    });
  }

  private publish() {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach(listener => listener());
  }

  private persist() {
    const payload = JSON.stringify(this.preferences);
    this.persistenceQueue = this.persistenceQueue
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(STORAGE_KEY, payload));
    return this.persistenceQueue;
  }

  loadOnce = async () => {
    if (this.loaded) {
      return;
    }
    try {
      const currentRaw = await AsyncStorage.getItem(STORAGE_KEY);
      const legacyRaw = currentRaw
        ? null
        : await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      const raw = currentRaw || legacyRaw;
      this.preferences = sanitizePreferences(raw ? JSON.parse(raw) : null);
      if (!currentRaw && legacyRaw) {
        await this.persist();
      }
    } catch {
      this.preferences = sanitizePreferences(null);
    } finally {
      this.loaded = true;
      this.publish();
    }
  };

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  isKindEnabled(kind: JournalBlockKind) {
    return kind === 'text' || this.preferences.enabledKinds.includes(kind as SelectableJournalBlockKind);
  }

  canDisableKind(kind: SelectableJournalBlockKind) {
    return NOTE_BLOCK_CONTEXTS.every(context => {
      if (!(context in NOTE_BLOCK_REGISTRY[kind].contextOrder)) {
        return true;
      }
      return this.preferences.enabledKinds.filter(
        enabledKind => context in NOTE_BLOCK_REGISTRY[enabledKind].contextOrder,
      ).length > 1;
    });
  }

  async setKindEnabled(kind: SelectableJournalBlockKind, enabled: boolean) {
    if (enabled === this.isKindEnabled(kind)) {
      return true;
    }
    if (!enabled && !this.canDisableKind(kind)) {
      return false;
    }
    this.preferences = sanitizePreferences({
      ...this.preferences,
      enabledKinds: enabled
        ? [...this.preferences.enabledKinds, kind]
        : this.preferences.enabledKinds.filter(item => item !== kind),
      favoriteKinds: enabled
        ? this.preferences.favoriteKinds
        : this.preferences.favoriteKinds.filter(item => item !== kind),
    });
    this.publish();
    try {
      await this.persist();
    } catch {
      // The in-memory preference remains usable for this session.
    }
    return true;
  }

  async toggleFavoriteKind(kind: SelectableJournalBlockKind) {
    if (!this.isKindEnabled(kind)) {
      return false;
    }
    const isFavorite = this.preferences.favoriteKinds.includes(kind);
    this.preferences = sanitizePreferences({
      ...this.preferences,
      favoriteKinds: isFavorite
        ? this.preferences.favoriteKinds.filter(item => item !== kind)
        : [...this.preferences.favoriteKinds, kind],
    });
    this.publish();
    try {
      await this.persist();
    } catch {
      // The in-memory preference remains usable for this session.
    }
    return true;
  }

  async setFavoriteKinds(kinds: readonly SelectableJournalBlockKind[]) {
    const enabledKindSet = new Set(this.preferences.enabledKinds);
    this.preferences = sanitizePreferences({
      ...this.preferences,
      favoriteKinds: uniqueSelectableKinds(kinds).filter(kind =>
        enabledKindSet.has(kind),
      ),
    });
    this.publish();
    try {
      await this.persist();
    } catch {
      // The in-memory preference remains usable for this session.
    }
  }

  async reset() {
    this.preferences = sanitizePreferences(null);
    this.publish();
    try {
      await this.persist();
    } catch {
      // The in-memory preference remains usable for this session.
    }
  }
}

export const noteBlockPreferences = new NoteBlockPreferencesService();

export const useNoteBlockPreferences = () => {
  useEffect(() => {
    noteBlockPreferences.loadOnce().catch(() => undefined);
  }, []);
  return useSyncExternalStore(
    noteBlockPreferences.subscribe,
    noteBlockPreferences.getSnapshot,
    noteBlockPreferences.getSnapshot,
  );
};
