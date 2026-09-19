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

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const body = await req.json().catch(() => ({})) as { action?: 'responses'; personId?: string; ownerKey?: string; senderName?: string }
  // Older app builds did not send an owner key. They can still share safely;
  // current builds persist one locally so future sender-response views can use it.
  const ownerKey = body.ownerKey && body.ownerKey.length >= 32 ? body.ownerKey : randomToken()

  const authorization = req.headers.get('Authorization')
  const authClient = createClient(url, anonKey)
  const accessToken = authorization?.replace(/^Bearer\s+/i, '')
  const { data: { user } } = accessToken ? await authClient.auth.getUser(accessToken) : { data: { user: null } }
  const admin = createClient(url, serviceKey)

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
  const displayName = String(body.senderName || user?.user_metadata?.display_name || user?.user_metadata?.full_name || 'Someone').slice(0, 80)
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
