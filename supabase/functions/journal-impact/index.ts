import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
import {corsHeaders} from '../_shared/cors.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store'},
})

const ADMIN_EMAILS = new Set([
  'nikki.batanes@sifia.app',
  'nikkibatanes@gmail.com',
  'bynikkib@gmail.com',
  'pzgttqh2gh@privaterelay.appleid.com',
])
const ADMIN_USER_IDS = new Set(['f683eb02-c824-4c24-991c-69b8b5397ca3'])
const EVENT_TYPES = new Set([
  'gospel_shared',
  'accepted_jesus',
  'morning_completed',
  'evening_completed',
  'prayer_created',
  'prayer_answered',
  'bible_study_created',
  'bible_study_completed',
  'gratitude_saved',
  'win_saved',
])
const ACTIONS = new Set(['upsert', 'delete'])

const hash = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

const validDate = (value: unknown) => {
  if (typeof value !== 'string') return false
  const timestamp = new Date(value).getTime()
  const now = Date.now()
  return Number.isFinite(timestamp)
    && timestamp >= now - (20 * 366 * 24 * 60 * 60 * 1000)
    && timestamp <= now + (24 * 60 * 60 * 1000)
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: corsHeaders})
  if (req.method !== 'POST') return json({error: 'Method not allowed'}, 405)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const admin = createClient(url, serviceKey)
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const authorization = req.headers.get('Authorization')
  const accessToken = authorization?.replace(/^Bearer\s+/i, '')
  const authClient = createClient(url, anonKey)
  const {data: {user}} = accessToken
    ? await authClient.auth.getUser(accessToken)
    : {data: {user: null}}

  if (body.action === 'summary') {
    const email = user?.email?.toLocaleLowerCase() || ''
    if (!user || (!ADMIN_EMAILS.has(email) && !ADMIN_USER_IDS.has(user.id))) {
      return json({error: 'Forbidden'}, 403)
    }
    if (!validDate(body.start) || !validDate(body.end)) return json({error: 'Invalid date range'}, 400)
    const start = new Date(body.start as string).toISOString()
    const end = new Date(body.end as string).toISOString()
    if (new Date(start) > new Date(end)) return json({error: 'Invalid date range'}, 400)

    const count = (eventType: string) => admin.from('journal_impact_events')
      .select('id', {count: 'exact', head: true})
      .eq('event_type', eventType)
      .gte('occurred_at', start)
      .lte('occurred_at', end)
    const [
      shared,
      accepted,
      morning,
      evening,
      prayers,
      answeredPrayers,
      bibleStudiesCreated,
      bibleStudiesCompleted,
      gratitudeSaved,
      winsSaved,
    ] = await Promise.all([
      count('gospel_shared'),
      count('accepted_jesus'),
      count('morning_completed'),
      count('evening_completed'),
      count('prayer_created'),
      count('prayer_answered'),
      count('bible_study_created'),
      count('bible_study_completed'),
      count('gratitude_saved'),
      count('win_saved'),
    ])
    const results = [
      shared,
      accepted,
      morning,
      evening,
      prayers,
      answeredPrayers,
      bibleStudiesCreated,
      bibleStudiesCompleted,
      gratitudeSaved,
      winsSaved,
    ]
    if (results.some(result => result.error)) return json({error: 'Unable to load Journal impact'}, 500)
    return json({
      gospelShared: shared.count || 0,
      acceptedJesus: accepted.count || 0,
      morningCompleted: morning.count || 0,
      eveningCompleted: evening.count || 0,
      prayersCreated: prayers.count || 0,
      prayersAnswered: answeredPrayers.count || 0,
      bibleStudiesCreated: bibleStudiesCreated.count || 0,
      bibleStudiesCompleted: bibleStudiesCompleted.count || 0,
      gratitudeSaved: gratitudeSaved.count || 0,
      winsSaved: winsSaved.count || 0,
    })
  }

  if (body.action !== 'sync') return json({error: 'Invalid action'}, 400)
  const installId = typeof body.installId === 'string' ? body.installId : ''
  const commands = Array.isArray(body.commands) ? body.commands.slice(0, 100) : []
  if (installId.length < 16 || installId.length > 100 || !commands.length) {
    return json({error: 'Invalid sync payload'}, 400)
  }

  const processedCommandIds: string[] = []
  const installIdHash = await hash(installId)
  for (const raw of commands) {
    if (!raw || typeof raw !== 'object') continue
    const command = raw as Record<string, any>
    if (typeof command.id !== 'string' || !ACTIONS.has(command.action)) continue

    if (command.action === 'delete') {
      const eventIds = Array.isArray(command.clientEventIds)
        ? command.clientEventIds.filter((id: unknown) => typeof id === 'string' && id.length <= 200).slice(0, 2)
        : []
      if (!eventIds.length) continue
      const scopedEventIds = await Promise.all(eventIds.map(
        (eventId: string) => hash(`${installIdHash}:${eventId}`).then(value => `device:${value}`),
      ))
      const {error} = await admin.from('journal_impact_events')
        .delete().in('client_event_id', scopedEventIds).eq('install_id_hash', installIdHash)
      if (error) return json({error: 'Unable to sync Journal impact'}, 500)
      processedCommandIds.push(command.id)
      continue
    }

    const event = command.event as Record<string, unknown> | undefined
    if (!event
      || typeof event.clientEventId !== 'string'
      || event.clientEventId.length > 200
      || !EVENT_TYPES.has(String(event.eventType))
      || !validDate(event.occurredAt)
      || typeof event.method !== 'string'
      || event.method.length > 40) continue
    const scopedClientEventId = `device:${await hash(`${installIdHash}:${event.clientEventId}`)}`
    const {error} = await admin.from('journal_impact_events').upsert({
      client_event_id: scopedClientEventId,
      event_type: event.eventType,
      occurred_at: new Date(event.occurredAt as string).toISOString(),
      method: event.method,
      platform: typeof event.platform === 'string' ? event.platform.slice(0, 20) : null,
      install_id_hash: installIdHash,
      user_id: user?.id || null,
    }, {onConflict: 'client_event_id', ignoreDuplicates: true})
    if (error) return json({error: 'Unable to sync Journal impact'}, 500)
    processedCommandIds.push(command.id)
  }

  return json({processedCommandIds})
})
