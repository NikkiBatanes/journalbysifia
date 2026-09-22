import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabaseClient';
import { gospelStorage, GospelResponse } from '../storage/gospelStorage';

const GOSPEL_SHARE_OWNER_KEY = '@sifia/gospel-share-owner-key';
let ownerKeyRequest: Promise<string> | null = null;

const loadOwnerKey = async () => {
  const existing = await AsyncStorage.getItem(GOSPEL_SHARE_OWNER_KEY);
  if (existing) return existing;
  const ownerKey = `${uuidv4()}-${uuidv4()}`;
  await AsyncStorage.setItem(GOSPEL_SHARE_OWNER_KEY, ownerKey);
  return ownerKey;
};

const getOwnerKey = (): Promise<string> => {
  // Recipient changes can prepare several links at once. They must all use
  // the same persisted owner key, including on the first share from a device.
  if (!ownerKeyRequest) {
    ownerKeyRequest = loadOwnerKey().finally(() => { ownerKeyRequest = null; });
  }
  return ownerKeyRequest;
};

export interface GospelShareLink {
  token: string;
  url: string;
}

export interface SharedGospelResponse {
  id: string;
  response: 'trusted_jesus_today' | 'has_questions' | 'not_ready' | 'already_follows_jesus';
  responder_name: string | null;
  spiritual_birthday: string | null;
  optional_message: string | null;
  consented_at: string;
  created_at: string;
  gospel_share_links: {
    id: string;
    person_id: string | null;
    created_at: string;
  };
}

export const gospelShareService = {
  async createLink(personId?: string): Promise<GospelShareLink> {
    const [ownerKey, savedName] = await Promise.all([
      getOwnerKey(),
      AsyncStorage.getItem('user_name'),
    ]);
    const { data, error } = await supabase.functions.invoke('create-gospel-share', {
      body: {
        personId: personId || undefined,
        ownerKey,
        senderName: savedName?.trim().slice(0, 80) || undefined,
      },
    });
    if (error || !data?.url || !data?.token) {
      throw new Error(error?.message || 'Unable to create Gospel link');
    }
    return data as GospelShareLink;
  },

  async getSharedResponses(): Promise<SharedGospelResponse[]> {
    const ownerKey = await getOwnerKey();
    const { data, error } = await supabase.functions.invoke('create-gospel-share', {
      body: { action: 'responses', ownerKey },
    });
    if (error || !Array.isArray(data?.responses)) throw new Error(error?.message || 'Unable to load shared responses');
    return data.responses as SharedGospelResponse[];
  },

  async claimResponse(claimToken: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('gospel-share-public', {
      body: { action: 'claim', claimToken },
    });
    const validResponses: GospelResponse[] = ['trusted_jesus_today', 'has_questions', 'not_ready', 'already_follows_jesus'];
    if (error || !validResponses.includes(data?.response)) throw new Error(error?.message || 'Unable to save your Gospel response');
    await gospelStorage.saveResponse(data.response, 'app_self', data.spiritualBirthday || undefined);
  },
};
