import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabaseClient';
import { gospelStorage, GospelResponse } from '../storage/gospelStorage';
import { getJournalOnboardingSetup } from './journalOnboardingState';

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

type SenderNameFields = {
  first_name?: unknown;
  last_name?: unknown;
  full_name?: unknown;
  display_name?: unknown;
};

const cleanName = (value: unknown): string => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

const joinedName = (source?: SenderNameFields | null): string => {
  const firstName = cleanName(source?.first_name);
  const lastName = cleanName(source?.last_name);
  return firstName && lastName ? `${firstName} ${lastName}` : '';
};

const parseLocalProfile = (raw: string | null): SenderNameFields => {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value as SenderNameFields : {};
  } catch {
    return {};
  }
};

const getSenderName = async (): Promise<string | undefined> => {
  const [savedName, localProfileRaw, onboarding, authResult] = await Promise.all([
    AsyncStorage.getItem('user_name'),
    AsyncStorage.getItem('journal:local-profile'),
    getJournalOnboardingSetup(),
    supabase.auth.getUser().catch(() => ({ data: { user: null } })),
  ]);
  const metadata = authResult.data.user?.user_metadata as SenderNameFields | undefined;
  const localProfile = parseLocalProfile(localProfileRaw);
  const onboardingName = cleanName(`${onboarding.firstName} ${onboarding.lastName}`);
  const resolved = [
    joinedName(metadata),
    joinedName(localProfile),
    onboarding.firstName && onboarding.lastName ? onboardingName : '',
    cleanName(metadata?.full_name),
    cleanName(localProfile.full_name),
    cleanName(metadata?.display_name),
    onboardingName,
    cleanName(savedName),
    cleanName(metadata?.first_name),
    cleanName(localProfile.first_name),
  ].find(Boolean);
  return resolved?.slice(0, 80) || undefined;
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
    const [ownerKey, senderName] = await Promise.all([
      getOwnerKey(),
      getSenderName(),
    ]);
    const { data, error } = await supabase.functions.invoke('create-gospel-share', {
      body: {
        personId: personId || undefined,
        ownerKey,
        senderName,
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

  async linkResponseToPerson(linkId: string, personId: string): Promise<void> {
    const ownerKey = await getOwnerKey();
    const {data, error} = await supabase.functions.invoke('create-gospel-share', {
      body: {action: 'link-person', linkId, personId, ownerKey},
    });
    if (error || !data?.linked) {
      throw new Error(error?.message || 'Unable to connect this response');
    }
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
