/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { bibleGatewayScraper } from '../_shared/bibleGatewayScraper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const allowedVersions = new Set(['AMP', 'CSB', 'ESV', 'KJV', 'MSG', 'NASB', 'NIV', 'NKJV', 'NLT']);
const referencePattern = /^[1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d{1,3}(?::\d{1,3}(?:\s*[-–]\s*\d{1,3})?)?$/;

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
);

serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  try {
    const body = await request.json();
    const reference = String(body?.reference || '').replace(/\s+/g, ' ').trim();
    const requestedVersion = String(body?.version || 'NASB').trim().toUpperCase();
    const version = allowedVersions.has(requestedVersion) ? requestedVersion : 'NASB';

    if (!referencePattern.test(reference)) {
      return jsonResponse({ error: 'INVALID_REFERENCE', message: 'Enter a valid Bible reference.' }, 400);
    }

    const passage = await bibleGatewayScraper.scrapeVerse(reference, version);
    return jsonResponse({
      text: passage.text,
      reference: passage.reference || reference,
      version: passage.version || version,
    });
  } catch (error) {
    console.error('[Get-Scripture-Passage] Fetch failed:', error);
    return jsonResponse({
      error: 'PASSAGE_UNAVAILABLE',
      message: 'This passage could not be loaded right now.',
    }, 502);
  }
});
