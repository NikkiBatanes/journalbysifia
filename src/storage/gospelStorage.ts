import AsyncStorage from '@react-native-async-storage/async-storage';
import {GOSPEL_CONTENT_VERSION} from '../data/gospelContent';

const PEOPLE_KEY = 'journal:gospel:people:v1';
const RESPONSE_KEY = 'journal:gospel:self-response:v1';
const FOR_ME_DAY_SETTINGS_KEY = 'journal:gospel:for-me-day-settings:v1';

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
  reminderEnabled: boolean;
  reminderTime: string;
  showInMoments: boolean;
  includeYearWhenSharing: boolean;
  updatedAt: string;
};

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

export const gospelStorage = {
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
          return {
            ...defaultForMeDaySettings(parsed.spiritualBirthday),
            ...parsed,
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
    const saved = {...settings, updatedAt: new Date().toISOString()};
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
