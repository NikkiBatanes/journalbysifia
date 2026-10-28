import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_BODY_BYTES = 20_000
const ALLOWED_ORIGINS = new Set([
  'https://journal.sifia.app',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
])

const CURRENT_JOURNALING = new Set([
  'paper', 'notes', 'journal-app', 'mix', 'not-consistent', 'not-currently',
])
const FEATURE_INTERESTS = new Set([
  'guided-prompts', 'prayer-tracking', 'reviews', 'scripture-notes',
  'search', 'privacy', 'heart-journal', 'sermon-notes', 'keeping-together',
])
const PRICE_REGIONS = new Set(['ph', 'international'])
const PRICE_REACTIONS = new Set([
  'easy-decision', 'reasonable', 'try-first', 'too-expensive',
])

const corsHeaders = (request: Request) => {
  const origin = request.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://journal.sifia.app',
    'Access-Control-Allow-Headers': 'content-type, accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const json = (request: Request, body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  },
)

const cleanString = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return ''
  return String(value).trim().replace(/\s+/gu, ' ').slice(0, maxLength)
}

const cleanParagraph = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return ''
  return String(value).trim().replace(/\r\n?|\n/gu, '\n').slice(0, maxLength)
}

const cleanEnum = (value: unknown, allowed: Set<string>) => {
  const cleaned = cleanString(value, 80)
  return allowed.has(cleaned) ? cleaned : ''
}

const cleanList = (value: unknown, allowed: Set<string>, maxItems: number) => {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  for (const item of value) {
    const cleaned = cleanString(item, 80)
    if (allowed.has(cleaned) && !result.includes(cleaned)) result.push(cleaned)
    if (result.length >= maxItems) break
  }
  return result
}

const booleanValue = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true'

const nullable = (value: string) => value === '' ? null : value

const cleanPageUrl = (value: unknown, maxLength: number) => {
  const cleaned = cleanString(value, maxLength)
  try {
    const url = new URL(cleaned)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    return `${url.origin}${url.pathname}`.slice(0, maxLength)
  } catch {
    return ''
  }
}

const cleanOrigin = (value: unknown, maxLength: number) => {
  const cleaned = cleanString(value, maxLength)
  try {
    const url = new URL(cleaned)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    return url.origin.slice(0, maxLength)
  } catch {
    return ''
  }
}

const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)))
  .map(byte => byte.toString(16).padStart(2, '0'))
  .join('')

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)

const resolveServiceKey = () => {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>
      if (parsed.default) return parsed.default
    } catch {
      // Fall through to the legacy runtime key while the project migrates keys.
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

serve(async request => {
  const origin = request.headers.get('Origin') ?? ''
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(request, { success: false, error: 'Origin not allowed.' }, 403)
  }
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { success: false, error: 'Method not allowed.' }, 405)

  const declaredLength = Number(request.headers.get('Content-Length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(request, { success: false, error: 'Submission is too large.' }, 413)
  }

  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json(request, { success: false, error: 'Submission is too large.' }, 413)
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return json(request, { success: false, error: 'Invalid request.' }, 400)
  }
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return json(request, { success: false, error: 'Invalid request.' }, 400)
  }

  // Honeypot submissions receive a plausible response but are never stored.
  if (cleanString(payload.website, 120) !== '') {
    return json(request, { success: true, signup_token: randomToken() })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = resolveServiceKey()
  if (!supabaseUrl || !serviceKey) {
    console.error('Journal Early Access Supabase configuration is unavailable')
    return json(request, {
      success: false,
      error: 'The signup service is temporarily unavailable. Please try again shortly.',
    }, 503)
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const action = cleanEnum(payload.action, new Set(['start', 'survey']))
  try {
    if (action === 'start') {
      const email = cleanString(payload.email, 254).toLowerCase()
      const platform = cleanEnum(payload.platform, new Set(['iphone', 'android']))
      const consent = booleanValue(payload.email_consent)
      if (!validEmail(email)) return json(request, { success: false, error: 'Enter a valid email address.' }, 422)
      if (!platform) return json(request, { success: false, error: 'Choose iPhone or Android.' }, 422)
      if (!consent) return json(request, { success: false, error: 'Email consent is required to join.' }, 422)

      const token = randomToken()
      const { error } = await admin.rpc('journal_early_access_start', {
        p_email: email,
        p_platform: platform,
        p_source: cleanString(payload.source, 100) || 'journal-early-access',
        p_utm_source: nullable(cleanString(payload.utm_source, 120)),
        p_utm_medium: nullable(cleanString(payload.utm_medium, 120)),
        p_utm_campaign: nullable(cleanString(payload.utm_campaign, 160)),
        p_utm_content: nullable(cleanString(payload.utm_content, 160)),
        p_utm_term: nullable(cleanString(payload.utm_term, 160)),
        p_landing_page: nullable(cleanPageUrl(payload.landing_page, 500)),
        p_referrer_domain: nullable(cleanOrigin(payload.referrer_domain, 255)),
        p_consent_version: 'supabase-2026-10-12',
        p_founding_offer_version: 'founding-launch-v1',
        p_user_agent: nullable(cleanString(request.headers.get('User-Agent'), 500)),
        p_token_hash: await hashToken(token),
      })
      if (error) throw error
      return json(request, { success: true, signup_token: token })
    }

    if (action === 'survey') {
      const token = cleanString(payload.signup_token, 96)
      if (!/^[a-f0-9]{48}$/u.test(token)) {
        return json(request, { success: false, error: 'Your signup session expired. Please start again.' }, 422)
      }
      const currentJournaling = cleanEnum(payload.current_journaling, CURRENT_JOURNALING)
      const featureInterests = cleanList(payload.feature_interests, FEATURE_INTERESTS, 3)
      const priceRegion = cleanEnum(payload.price_region, PRICE_REGIONS)
      const priceReaction = priceRegion ? cleanEnum(payload.price_reaction, PRICE_REACTIONS) : ''
      const testerOptIn = booleanValue(payload.tester_opt_in)
      const anythingElse = cleanParagraph(payload.anything_else, 1000)

      const { data: saved, error } = await admin.rpc('journal_early_access_save_survey', {
        p_token_hash: await hashToken(token),
        p_current_journaling: nullable(currentJournaling),
        p_feature_interests: featureInterests.length ? featureInterests : null,
        p_price_region: nullable(priceRegion),
        p_survey_version: 'founding-supabase-2026-10-12',
        p_price_reaction: nullable(priceReaction),
        p_tester_opt_in: testerOptIn,
        p_anything_else: nullable(anythingElse),
      })
      if (error) throw error
      if (!saved) {
        return json(request, { success: false, error: 'Your signup session expired. Please start again.' }, 422)
      }
      return json(request, { success: true })
    }

    return json(request, { success: false, error: 'Invalid action.' }, 400)
  } catch (error) {
    console.error('Journal Early Access error', error)
    return json(request, {
      success: false,
      error: 'The signup service is temporarily unavailable. Please try again shortly.',
    }, 503)
  }
})

