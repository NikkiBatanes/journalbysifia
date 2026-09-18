import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabaseClient';

export interface ScriptureReaderResult {
  text: string;
  reference: string;
  version: string;
  verses?: { number: string; lines: string[] }[];
}

export const SCRIPTURE_OFFLINE_MESSAGE = 'This passage is not saved on this device yet. Connect to the internet and try again.';

const passageCache = new Map<string, ScriptureReaderResult>();
const pendingPassages = new Map<string, Promise<ScriptureReaderResult>>();

function toCacheKey(reference: string, version: string): string {
  return `${version.toUpperCase()}:${reference.toLowerCase().replace(/\s+/g, '')}`;
}

async function getStoredPassage(key: string): Promise<ScriptureReaderResult | null> {
  try {
    const stored = await AsyncStorage.getItem(`scripture-passage:${key}`);
    if (!stored) { return null; }
    return JSON.parse(stored) as ScriptureReaderResult;
  } catch {
    return null;
  }
}

async function storePassage(key: string, result: ScriptureReaderResult): Promise<void> {
  try {
    await AsyncStorage.setItem(`scripture-passage:${key}`, JSON.stringify(result));
  } catch {
    // Non-fatal: the in-memory cache is still warm.
  }
}

export async function getScripturePassage(
  reference: string,
  version = 'NASB',
): Promise<ScriptureReaderResult> {
  const cacheKey = toCacheKey(reference, version);

  const cached = passageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = pendingPassages.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    const stored = await getStoredPassage(cacheKey);
    if (stored) {
      passageCache.set(cacheKey, stored);
      return stored;
    }

    const network = await NetInfo.fetch();
    if (network.isConnected === false || network.isInternetReachable === false) {
      throw new Error(SCRIPTURE_OFFLINE_MESSAGE);
    }

    const { data, error } = await supabase.functions.invoke('get-scripture-passage', {
      body: { reference, version },
    });

    if (error || !data?.text) {
      throw new Error(data?.message || error?.message || 'This passage could not be loaded right now.');
    }

    const result: ScriptureReaderResult = {
      text: String(data.text).trim(),
      reference: String(data.reference || reference).trim(),
      version: String(data.version || version).trim().toUpperCase(),
      verses: data.verses,
    };

    passageCache.set(cacheKey, result);
    await storePassage(cacheKey, result);
    return result;
  })();

  pendingPassages.set(cacheKey, request);
  try {
    return await request;
  } finally {
    pendingPassages.delete(cacheKey);
  }
}

export async function preloadScripturePassages(
  references: string[],
  version = 'NASB',
): Promise<void> {
  await Promise.all(references.map(reference => getScripturePassage(reference, version).catch(() => null)));
}
