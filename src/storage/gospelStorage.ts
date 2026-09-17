import AsyncStorage from '@react-native-async-storage/async-storage';
import { GOSPEL_CONTENT_VERSION } from '../data/gospelContent';

const PEOPLE_KEY = 'journal:gospel:people:v1';
const RESPONSE_KEY = 'journal:gospel:self-response:v1';

export type GospelResponse = 'trusted_jesus_today' | 'has_questions' | 'not_ready' | 'already_follows_jesus';

export type GospelPerson = {
  id: string;
  displayName: string;
  note?: string;
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

const parseArray = (value: string | null): GospelPerson[] => {
  if (!value) { return []; }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const gospelStorage = {
  async getPeople(): Promise<GospelPerson[]> {
    return parseArray(await AsyncStorage.getItem(PEOPLE_KEY));
  },

  async addPerson(displayName: string, note?: string): Promise<GospelPerson> {
    const now = new Date().toISOString();
    const person: GospelPerson = {
      id: `gospel-person-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      displayName: displayName.trim() || 'Someone',
      note: note?.trim() || undefined,
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
    return record;
  },
};
