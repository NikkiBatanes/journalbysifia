import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export type DiscountState = {
  discountPolicyVersion: number;
  optOutCount: number;
  lastShownAt?: string | null;
  lastDiscountPct?: number | null;
  redeemed?: boolean;
  blockedUntil?: string | null;
  shownByTier?: Record<string, string>; // tierId -> ISO date when shown
};

const DEVICE_ID_KEY = 'discount_device_id_v1';

async function getDeviceId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = uuidv4();
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // Fallback if AsyncStorage fails
    return 'device-fallback';
  }
}

function storageKeyFor(userId?: string | null) {
  if (userId) {return `discount_state:user:${userId}`;}
  return `discount_state:guest:${guestCacheDeviceId}`;
}

let guestCacheDeviceId = 'guest-unknown';
(async () => {
  guestCacheDeviceId = await getDeviceId();
})();

export async function loadDiscountState(userId?: string | null): Promise<DiscountState | null> {
  try {
    const key = storageKeyFor(userId);
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as DiscountState) : null;
  } catch {
    return null;
  }
}

export async function saveDiscountState(state: DiscountState, userId?: string | null): Promise<void> {
  try {
    const key = storageKeyFor(userId);
    await AsyncStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// Trial opt-out persistence
function trialOptOutKeyFor(userId?: string | null) {
  if (userId) {return `trial_opt_out:user:${userId}`;}
  return `trial_opt_out:guest:${guestCacheDeviceId}`;
}

export async function setTrialOptOut(userId: string | null | undefined, optedOut: boolean): Promise<void> {
  try {
    const key = trialOptOutKeyFor(userId || undefined);
    await AsyncStorage.setItem(key, optedOut ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

export async function getTrialOptOut(userId: string | null | undefined): Promise<boolean> {
  try {
    const key = trialOptOutKeyFor(userId || undefined);
    const val = await AsyncStorage.getItem(key);
    return val === '1';
  } catch {
    return false;
  }
}

export async function mergeGuestToUser(userId: string): Promise<void> {
  try {
    const guestKey = storageKeyFor(null);
    const userKey = storageKeyFor(userId);
    const guestRaw = await AsyncStorage.getItem(guestKey);
    if (!guestRaw) {return;}

    const guestState = JSON.parse(guestRaw) as DiscountState;
    const userRaw = await AsyncStorage.getItem(userKey);
    const userState = userRaw ? (JSON.parse(userRaw) as DiscountState) : null;

    // Simple merge: keep max optOutCount and most recent lastShownAt/lastDiscountPct
    const merged: DiscountState = {
      discountPolicyVersion: 1,
      optOutCount: Math.max(guestState.optOutCount || 0, userState?.optOutCount || 0),
      lastShownAt: guestState.lastShownAt || userState?.lastShownAt || null,
      lastDiscountPct: guestState.lastDiscountPct ?? userState?.lastDiscountPct ?? null,
      redeemed: userState?.redeemed || guestState.redeemed || false,
      blockedUntil: guestState.blockedUntil || userState?.blockedUntil || null,
    };

    await AsyncStorage.setItem(userKey, JSON.stringify(merged));
    // Optionally clear guest
    // await AsyncStorage.removeItem(guestKey);
  } catch {
    // ignore
  }
}
