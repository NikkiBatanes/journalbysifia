import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const hashToken = async (token: string) => {
  const bytes = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')
}

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

type SenderNameFields = {
  first_name?: unknown
  last_name?: unknown
  full_name?: unknown
  display_name?: unknown
}

const cleanName = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''

const joinedName = (source?: SenderNameFields | null) => {
  const firstName = cleanName(source?.first_name)
  const lastName = cleanName(source?.last_name)
  return firstName && lastName ? `${firstName} ${lastName}` : ''
}

const resolveSenderName = (provided: unknown, profile?: SenderNameFields | null, metadata?: SenderNameFields | null) => {
  const providedName = cleanName(provided)
  const candidates = [
    joinedName(profile),
    joinedName(metadata),
    providedName.includes(' ') ? providedName : '',
    cleanName(profile?.full_name),
    cleanName(metadata?.full_name),
    cleanName(profile?.display_name),
    cleanName(metadata?.display_name),
    providedName,
    cleanName(profile?.first_name),
    cleanName(metadata?.first_name),
  ]
  return candidates.find(Boolean)?.slice(0, 80) || ''
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const body = await req.json().catch(() => ({})) as { action?: 'responses' | 'link-person'; personId?: string; linkId?: string; ownerKey?: string; senderName?: string }
  // Older app builds did not send an owner key. They can still share safely;
  // current builds persist one locally so future sender-response views can use it.
  const ownerKey = body.ownerKey && body.ownerKey.length >= 32 ? body.ownerKey : randomToken()

  const authorization = req.headers.get('Authorization')
  const authClient = createClient(url, anonKey)
  const accessToken = authorization?.replace(/^Bearer\s+/i, '')
  const { data: { user } } = accessToken ? await authClient.auth.getUser(accessToken) : { data: { user: null } }
  const admin = createClient(url, serviceKey)

  if (body.action === 'link-person') {
    if (!body.linkId || !body.personId) return json({ error: 'A response and person are required' }, 400)
    const { data: linked, error: linkError } = await admin
      .from('gospel_share_links')
      .update({ person_id: body.personId })
      .eq('id', body.linkId)
      .eq('owner_key_hash', await hashToken(ownerKey))
      .select('id')
      .maybeSingle()
    if (linkError) return json({ error: 'Unable to connect this response' }, 500)
    if (!linked) return json({ error: 'Response not found' }, 404)
    return json({ linked: true })
  }

  if (body.action === 'responses') {
    const { data: links, error: linksError } = await admin
      .from('gospel_share_links')
      .select('id,person_id,created_at')
      .eq('owner_key_hash', await hashToken(ownerKey))
    if (linksError) return json({ error: 'Unable to load shared responses' }, 500)
    if (!links?.length) return json({ responses: [] })
    const linkById = new Map(links.map(link => [link.id, link]))
    const { data: responses, error: responsesError } = await admin
      .from('gospel_shared_responses')
      .select('id,share_link_id,response,responder_name,spiritual_birthday,optional_message,consented_at,created_at')
      .in('share_link_id', links.map(link => link.id))
      .order('created_at', { ascending: false })
    if (responsesError) return json({ error: 'Unable to load shared responses' }, 500)
    return json({ responses: (responses || []).map(response => ({ ...response, gospel_share_links: linkById.get(response.share_link_id) })) })
  }

  const token = randomToken()
  const { data: profile } = user ? await admin
    .from('user_profiles')
    .select('first_name,last_name,full_name,display_name')
    .eq('id', user.id)
    .maybeSingle() : { data: null }
  const displayName = resolveSenderName(body.senderName, profile, user?.user_metadata)
  if (!displayName) return json({ error: 'Add your first and last name in Profile before sharing the Gospel.' }, 400)
  const { error } = await admin.from('gospel_share_links').insert({
    sender_user_id: user?.id || null,
    sender_display_name: displayName,
    person_id: body.personId || null,
    owner_key_hash: await hashToken(ownerKey),
    token_hash: await hashToken(token),
  })
  if (error) {
    console.error('Unable to create Gospel link', { code: error.code, message: error.message })
    return json({ error: 'Unable to create Gospel link' }, 500)
  }

  return json({ token, url: `https://go.sifia.app/gospel/${token}` })
})
