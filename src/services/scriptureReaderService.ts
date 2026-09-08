import { supabase } from './supabaseClient';

export interface ScriptureReaderResult {
  text: string;
  reference: string;
  version: string;
}

const passageCache = new Map<string, ScriptureReaderResult>();

export async function getScripturePassage(
  reference: string,
  version = 'NASB',
): Promise<ScriptureReaderResult> {
  const cacheKey = `${version.toUpperCase()}:${reference.toLowerCase().replace(/\s+/g, '')}`;
  const cached = passageCache.get(cacheKey);
  if (cached) {
    return cached;
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
  };
  passageCache.set(cacheKey, result);
  return result;
}
