import AsyncStorage from '@react-native-async-storage/async-storage';
import {DeviceEventEmitter} from 'react-native';
import {GOSPEL_CONTENT_VERSION} from '../data/gospelContent';
import {
  queueGospelImpactForShare,
  queueGospelImpactRetraction,
} from '../services/journalImpactAnalyticsService';

const PEOPLE_KEY = 'journal:gospel:people:v1';
const RESPONSE_KEY = 'journal:gospel:self-response:v1';
const FOR_ME_DAY_SETTINGS_KEY = 'journal:gospel:for-me-day-settings:v1';
export const GOSPEL_SHARE_EVENTS_KEY = 'journal:gospel:share-events:v1';

export type GospelResponse =
  | 'trusted_jesus_today'
  | 'has_questions'
  | 'not_ready'
  | 'already_follows_jesus';

export type GospelPerson = {
  id: string;
  displayName: string;
  note?: string;
  prayerStartedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedGospelResponse = {
  response: GospelResponse;
  sourceMode: 'app_self' | 'app_together';
  respondedAt: string;
  spiritualBirthday?: string;
  contentVersion: string;
};

export type ForMeDaySettings = {
  spiritualBirthday: string;
  originalStory?: string;
  testimonyWrittenAt?: string;
  testimonyUpdatedAt?: string;
  reminderEnabled: boolean;
  reminderTime: string;
  showInMoments: boolean;
  includeYearWhenSharing: boolean;
  updatedAt: string;
};

export type GospelShareMethod =
  | 'link'
  | 'together'
  | 'shared_openly'
  | 'outside_app'
  | 'in_person'
  | 'phone'
  | 'message'
  | 'other';

export type GospelShareEvent = {
  id: string;
  sharedAt: string;
  method: GospelShareMethod;
  personId?: string;
  responderName?: string;
  response?: GospelResponse;
  spiritualBirthday?: string;
};

export type GospelShareEventInput = {
  sharedAt?: string;
  method?: GospelShareMethod;
  personId?: string;
  responderName?: string;
  response?: GospelResponse;
  spiritualBirthday?: string;
};

const GOSPEL_SHARE_METHODS: GospelShareMethod[] = [
  'link',
  'together',
  'shared_openly',
  'outside_app',
  'in_person',
  'phone',
  'message',
  'other',
];

const defaultForMeDaySettings = (
  spiritualBirthday: string,
): ForMeDaySettings => ({
  spiritualBirthday,
  reminderEnabled: true,
  reminderTime: '09:00',
  showInMoments: true,
  includeYearWhenSharing: true,
  updatedAt: new Date().toISOString(),
});

const parseArray = (value: string | null): GospelPerson[] => {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(person => ({
      ...person,
      // Existing records already hold the correct historical date here.
      prayerStartedAt: person?.prayerStartedAt || person?.createdAt,
    }));
  } catch {
    return [];
  }
};

const parseShareEvents = (value: string | null): GospelShareEvent[] => {
  if (!value) {return [];}
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {return [];}
    return parsed
      .filter(event =>
        typeof event?.id === 'string' &&
        typeof event?.sharedAt === 'string' &&
        Number.isFinite(new Date(event.sharedAt).getTime()),
      )
      .map(event => ({
        id: event.id,
        sharedAt: event.sharedAt,
        // Every event stored before methods were introduced came from a link.
        method: GOSPEL_SHARE_METHODS.includes(event.method) ? event.method : 'link',
        ...(typeof event.personId === 'string' ? {personId: event.personId} : {}),
        ...(typeof event.responderName === 'string' && event.responderName.trim()
          ? {responderName: event.responderName.trim()}
          : {}),
        ...(['trusted_jesus_today', 'has_questions', 'not_ready', 'already_follows_jesus'].includes(event.response)
          ? {response: event.response as GospelResponse}
          : {}),
        ...(typeof event.spiritualBirthday === 'string'
          ? {spiritualBirthday: event.spiritualBirthday}
          : {}),
      }));
  } catch {
    return [];
  }
};

export const gospelStorage = {
  async getShareEvents(): Promise<GospelShareEvent[]> {
    return parseShareEvents(await AsyncStorage.getItem(GOSPEL_SHARE_EVENTS_KEY));
  },

  async recordShareEvent(input: GospelShareEventInput | string = {}): Promise<GospelShareEvent> {
    const details = typeof input === 'string' ? {sharedAt: input} : input;
    const event: GospelShareEvent = {
      id: `gospel-share-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sharedAt: details.sharedAt || new Date().toISOString(),
      method: details.method || 'link',
      ...(details.personId ? {personId: details.personId} : {}),
      ...(details.responderName?.trim() ? {responderName: details.responderName.trim()} : {}),
      ...(details.response ? {response: details.response} : {}),
      ...(details.spiritualBirthday ? {spiritualBirthday: details.spiritualBirthday} : {}),
    };
    const events = await this.getShareEvents();
    await AsyncStorage.setItem(GOSPEL_SHARE_EVENTS_KEY, JSON.stringify([event, ...events]));
    await queueGospelImpactForShare(event).catch(() => {});
    DeviceEventEmitter.emit('gospelShareChanged', event);
    return event;
  },

  async removeShareEvent(eventId: string): Promise<void> {
    const events = await this.getShareEvents();
    const removed = events.find(event => event.id === eventId);
    const remaining = events.filter(event => event.id !== eventId);
    if (remaining.length === events.length) {return;}
    await AsyncStorage.setItem(GOSPEL_SHARE_EVENTS_KEY, JSON.stringify(remaining));
    if (removed) {await queueGospelImpactRetraction(removed).catch(() => {});}
    DeviceEventEmitter.emit('gospelShareChanged', {id: eventId, removed: true});
  },

  async linkShareEventToPerson(eventId: string, personId: string): Promise<void> {
    const events = await this.getShareEvents();
    const index = events.findIndex(event => event.id === eventId);
    if (index < 0) {return;}
    const next = [...events];
    next[index] = {...next[index], personId};
    await AsyncStorage.setItem(GOSPEL_SHARE_EVENTS_KEY, JSON.stringify(next));
    DeviceEventEmitter.emit('gospelShareChanged', next[index]);
  },

  async getResponse(): Promise<SavedGospelResponse | null> {
    const raw = await AsyncStorage.getItem(RESPONSE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed.response === 'string' ? parsed : null;
    } catch {
      return null;
    }
  },

  async getForMeDaySettings(): Promise<ForMeDaySettings | null> {
    const [raw, response] = await Promise.all([
      AsyncStorage.getItem(FOR_ME_DAY_SETTINGS_KEY),
      this.getResponse(),
    ]);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.spiritualBirthday) {
          const settings = {
            ...defaultForMeDaySettings(parsed.spiritualBirthday),
            ...parsed,
          };
          return {
            ...settings,
            testimonyWrittenAt: settings.testimonyWrittenAt ||
              (settings.originalStory?.trim() ? settings.updatedAt : undefined),
          };
        }
      } catch {}
    }
    return response?.spiritualBirthday
      ? defaultForMeDaySettings(response.spiritualBirthday)
      : null;
  },

  async saveForMeDaySettings(
    settings: Omit<ForMeDaySettings, 'updatedAt'>,
  ): Promise<ForMeDaySettings> {
    const current = await this.getForMeDaySettings();
    const nextTestimony = settings.originalStory?.trim() || '';
    const currentTestimony = current?.originalStory?.trim() || '';
    const now = new Date().toISOString();
    const testimonyWrittenAt = nextTestimony
      ? settings.testimonyWrittenAt || current?.testimonyWrittenAt || now
      : undefined;
    const testimonyUpdatedAt = !nextTestimony
      ? undefined
      : currentTestimony && nextTestimony !== currentTestimony
        ? now
        : settings.testimonyUpdatedAt || current?.testimonyUpdatedAt;
    const saved = {
      ...settings,
      testimonyWrittenAt,
      testimonyUpdatedAt,
      updatedAt: now,
    };
    await AsyncStorage.setItem(FOR_ME_DAY_SETTINGS_KEY, JSON.stringify(saved));
    return saved;
  },
  async getPeople(): Promise<GospelPerson[]> {
    return parseArray(await AsyncStorage.getItem(PEOPLE_KEY));
  },

  async addPerson(displayName: string, note?: string): Promise<GospelPerson> {
    const now = new Date().toISOString();
    const person: GospelPerson = {
      id: `gospel-person-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      displayName: displayName.trim() || 'Someone',
      note: note?.trim() || undefined,
      prayerStartedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const people = await this.getPeople();
    await AsyncStorage.setItem(PEOPLE_KEY, JSON.stringify([person, ...people]));
    return person;
  },

  async saveResponse(
    response: GospelResponse,
    sourceMode: SavedGospelResponse['sourceMode'],
    spiritualBirthday?: string,
  ): Promise<SavedGospelResponse> {
    const record: SavedGospelResponse = {
      response,
      sourceMode,
      respondedAt: new Date().toISOString(),
      spiritualBirthday,
      contentVersion: GOSPEL_CONTENT_VERSION,
    };
    await AsyncStorage.setItem(RESPONSE_KEY, JSON.stringify(record));
    if (spiritualBirthday) {
      const current = await this.getForMeDaySettings();
      await this.saveForMeDaySettings({
        ...(current || defaultForMeDaySettings(spiritualBirthday)),
        spiritualBirthday,
      });
    }
    return record;
  },
};
