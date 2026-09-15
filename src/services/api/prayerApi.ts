// src/services/api/prayerApi.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalDateString } from '../../utils/date';
import { Logger } from '../../utils/ProductionLogger';
import {
  createLocalPrayer,
  getLocalPrayer,
  getLocalPrayers,
  getLocalPrayersByType,
  getLocalPeoplePrayers,
  updateLocalPrayer,
  deleteLocalPrayer,
  LocalPrayerEntry,
  PrayerType,
  JournalCategory,
  PrayerStatus,
} from '../../storage/prayerStorage';

export interface PrayerApiEntry {
  id: string;
  user_id?: string;
  prayer_type: PrayerType;
  journal_category?: JournalCategory | 'personal_prayer';
  content: string;
  metadata?: Record<string, any>;
  selected_date: string;
  created_at: string;
  updated_at: string;
  status?: PrayerStatus;
  answered_date?: string | null;
  person_name?: string;
  is_prayer_request?: boolean;
  requested_by?: string;
  prayed?: boolean;
  prayer_count?: number;
  last_prayed_at?: string;
  notes?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
  question_number?: number;
  // Legacy compatibility - computed fields
  type?: 'adoration' | 'confession' | 'thanksgiving' | 'supplication' | 'people' | 'freeform';
  is_answered?: boolean;
  is_request?: boolean;
  is_prayed?: boolean;
}

const toApiFormat = (prayer: LocalPrayerEntry): PrayerApiEntry => ({
  ...prayer,
  user_id: prayer.linked_account_id || prayer.user_id || '',
  type:
    prayer.journal_category ||
    (prayer.prayer_type === 'people' ? 'people' : 'freeform') as any,
  is_answered: prayer.status === 'answered',
  is_request: prayer.is_prayer_request,
  is_prayed: prayer.prayed,
});

const toLocalFormat = (
  prayer: Omit<PrayerApiEntry, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): any => {
  const result: any = { ...prayer };
  if (result.user_id !== undefined) {delete result.user_id;}
  if (result.type !== undefined) {delete result.type;}
  if (result.is_answered !== undefined) {delete result.is_answered;}
  if (result.is_request !== undefined) {delete result.is_request;}
  if (result.is_prayed !== undefined) {delete result.is_prayed;}
  if (prayer.type && prayer.type !== 'people' && prayer.type !== 'freeform') {
    result.journal_category = prayer.type as JournalCategory;
  }
  if (prayer.is_answered !== undefined && !prayer.status) {
    result.status = prayer.is_answered ? 'answered' : 'pending';
  }
  if (prayer.is_request !== undefined && prayer.is_prayer_request === undefined) {
    result.is_prayer_request = prayer.is_request;
  }
  if (prayer.is_prayed !== undefined && prayer.prayed === undefined) {
    result.prayed = prayer.is_prayed;
  }
  return result;
};

const listAllPrayerIds = async (): Promise<string[]> => {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter(key => key.startsWith('prayer_local_index:'));
};

const listAllPrayerEntries = async (): Promise<LocalPrayerEntry[]> => {
  const indexKeys = await listAllPrayerIds();
  if (indexKeys.length === 0) {return [];}
  const indexValues = await AsyncStorage.multiGet(indexKeys);
  const ids: { date: string; id: string }[] = [];
  for (const [key, raw] of indexValues) {
    if (!raw) {continue;}
    const date = key.replace('prayer_local_index:', '');
    const list = JSON.parse(raw) as string[];
    for (const id of list) {
      ids.push({ date, id });
    }
  }
  const dataKeys = ids.map(({ date, id }) => `prayer_local:${date}:${id}`);
  const dataValues = dataKeys.length > 0 ? await AsyncStorage.multiGet(dataKeys) : [];
  const entries: LocalPrayerEntry[] = [];
  for (const [, raw] of dataValues) {
    if (!raw) {continue;}
    try {
      const parsed = JSON.parse(raw) as LocalPrayerEntry;
      if (!parsed.deleted) {
        entries.push(parsed);
      }
    } catch {
      // ignore invalid entries
    }
  }
  return entries;
};

export class PrayerApi {
  static async getPrayers(_userId: string, date: string): Promise<PrayerApiEntry[]> {
    const prayers = await getLocalPrayers(date);
    return prayers.map(toApiFormat);
  }

  static async getACTSPrayers(_userId: string, date: string): Promise<{
    adoration: PrayerApiEntry[];
    confession: PrayerApiEntry[];
    thanksgiving: PrayerApiEntry[];
    supplication: PrayerApiEntry[];
    freeform: PrayerApiEntry[];
  }> {
    const prayers = await getLocalPrayersByType(date, 'journal');
    const mapped = prayers.map(toApiFormat);
    return {
      adoration: mapped.filter(p => p.journal_category === 'adoration'),
      confession: mapped.filter(p => p.journal_category === 'confession'),
      thanksgiving: mapped.filter(p => p.journal_category === 'thanksgiving'),
      supplication: mapped.filter(p => p.journal_category === 'supplication'),
      freeform: mapped.filter(p => p.journal_category === 'personal_prayer'),
    };
  }

  static async getPeoplePrayers(_userId: string, date: string): Promise<PrayerApiEntry[]> {
    const prayers = await getLocalPeoplePrayers(date);
    return prayers.map(toApiFormat);
  }

  static async getAllPeoplePrayers(_userId: string): Promise<PrayerApiEntry[]> {
    const all = await listAllPrayerEntries();
    return all.filter(p => p.prayer_type === 'people').map(toApiFormat);
  }

  static async getAllPrayers(_userId: string): Promise<PrayerApiEntry[]> {
    const all = await listAllPrayerEntries();
    return all
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(toApiFormat);
  }

  static async getUnprayedPrayerRequests(_userId: string): Promise<PrayerApiEntry[]> {
    const all = await listAllPrayerEntries();
    return all
      .filter(p => p.prayer_type === 'people' && p.is_prayer_request && !p.prayed)
      .map(toApiFormat);
  }

  static async getPrayersByType(
    _userId: string,
    date: string,
    type: PrayerApiEntry['type']
  ): Promise<PrayerApiEntry[]> {
    if (type === 'people') {
      const prayers = await getLocalPeoplePrayers(date);
      return prayers.map(toApiFormat);
    }
    if (['adoration', 'confession', 'thanksgiving', 'supplication'].includes(type || '')) {
      const prayers = await getLocalPrayers(date);
      return prayers
        .filter(p => p.journal_category === (type as JournalCategory))
        .map(toApiFormat);
    }
    const prayers = await getLocalPrayers(date);
    return prayers.map(toApiFormat);
  }

  static async createPrayer(
    prayer: Omit<PrayerApiEntry, 'id' | 'created_at' | 'updated_at'>
  ): Promise<PrayerApiEntry> {
    const localData = toLocalFormat(prayer);
    const newPrayer = await createLocalPrayer(localData);
    return toApiFormat(newPrayer);
  }

  static async updatePrayer(
    id: string,
    updates: Partial<Omit<PrayerApiEntry, 'id' | 'user_id' | 'created_at'>>
  ): Promise<PrayerApiEntry> {
    const all = await listAllPrayerEntries();
    const existing = all.find(p => p.id === id);
    if (!existing) {
      throw new Error('Prayer not found');
    }
    const localUpdates = toLocalFormat({ ...updates, ...(updates.metadata ? { metadata: { ...existing.metadata, ...updates.metadata } } : {}), id } as any);
    const updated = await updateLocalPrayer({ ...existing, ...localUpdates });
    return toApiFormat(updated);
  }

  static async deletePrayer(id: string): Promise<void> {
    const all = await listAllPrayerEntries();
    const existing = all.find(p => p.id === id);
    if (!existing) {
      throw new Error('Prayer not found');
    }
    await deleteLocalPrayer(id, existing.selected_date);
  }

  static async searchPrayers(_userId: string, searchTerm: string, limit: number = 20): Promise<PrayerApiEntry[]> {
    const all = await listAllPrayerEntries();
    const lowerTerm = searchTerm.toLowerCase();
    return all
      .filter(
        p =>
          (p.content && p.content.toLowerCase().includes(lowerTerm)) ||
          (p.title && p.title.toLowerCase().includes(lowerTerm)) ||
          (p.person_name && p.person_name.toLowerCase().includes(lowerTerm)) ||
          (p.notes && p.notes.toLowerCase().includes(lowerTerm))
      )
      .slice(0, limit)
      .map(toApiFormat);
  }

  static async markSupplicationAnswered(
    id: string,
    isAnswered: boolean
  ): Promise<PrayerApiEntry> {
    const all = await listAllPrayerEntries();
    const existing = all.find(p => p.id === id);
    if (!existing) {throw new Error('Prayer not found');}
    const updated = await updateLocalPrayer({
      ...existing,
      status: isAnswered ? 'answered' : 'pending',
      answered_date: isAnswered ? new Date().toISOString() : undefined,
    });
    return toApiFormat(updated);
  }

  static async markPrayerRequestPrayed(id: string, isPrayed: boolean = true): Promise<PrayerApiEntry> {
    const all = await listAllPrayerEntries();
    const existing = all.find(p => p.id === id);
    if (!existing) {throw new Error('Prayer not found');}
    const previousCount = existing.prayer_count ?? (existing.prayed ? 1 : 0);
    const updated = await updateLocalPrayer({
      ...existing,
      prayed: isPrayed,
      prayer_count: isPrayed ? previousCount + 1 : previousCount,
      last_prayed_at: isPrayed ? new Date().toISOString() : existing.last_prayed_at,
    });
    return toApiFormat(updated);
  }

  static async getPrayerStats(
    _userId: string,
    startDate: string,
    endDate: string
  ): Promise<{ total: number; answered: number; requests: number; prayed: number }> {
    const all = await listAllPrayerEntries();
    const filtered = all.filter(
      p => p.selected_date >= startDate && p.selected_date <= endDate
    );
    return {
      total: filtered.length,
      answered: filtered.filter(p => p.status === 'answered').length,
      requests: filtered.filter(p => p.is_prayer_request).length,
      prayed: filtered.filter(p => p.prayed).length,
    };
  }
}
