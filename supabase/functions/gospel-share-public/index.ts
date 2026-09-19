import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const body = await req.json().catch(() => ({})) as { token?: string; action?: string; response?: string; optionalMessage?: string; responderName?: string; shareName?: boolean; claimToken?: string; consent?: boolean }
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  if (body.action === 'claim') {
    if (!body.claimToken || body.claimToken.length < 32) return json({ error: 'Invalid invitation' }, 400)
    const { data: response } = await admin
      .from('gospel_shared_responses')
      .select('id,response,spiritual_birthday,claimed_at')
      .eq('claim_token_hash', await hashToken(body.claimToken))
      .maybeSingle()
    if (!response || response.claimed_at) return json({ error: 'This invitation is no longer available' }, 404)
    await admin.from('gospel_shared_responses').update({ claimed_at: new Date().toISOString() }).eq('id', response.id)
    return json({ response: response.response, spiritualBirthday: response.spiritual_birthday })
  }

  if (!body.token || body.token.length < 32) return json({ error: 'Invalid link' }, 400)
  const { data: link } = await admin.from('gospel_share_links').select('id,sender_display_name,expires_at,revoked_at').eq('token_hash', await hashToken(body.token)).maybeSingle()
  if (!link || link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) return json({ error: 'This Gospel link is no longer available' }, 404)

  if (body.action === 'resolve') return json({ senderDisplayName: link.sender_display_name || 'Someone' })
  if (body.action !== 'respond') return json({ error: 'Invalid action' }, 400)
  if (!body.consent) return json({ shared: false })

  const allowed = ['trusted_jesus_today', 'has_questions', 'not_ready', 'already_follows_jesus']
  if (!body.response || !allowed.includes(body.response)) return json({ error: 'Invalid response' }, 400)
  const message = body.optionalMessage?.trim().slice(0, 1000) || null
  const responderName = body.shareName ? body.responderName?.trim().slice(0, 80) || null : null
  const spiritualBirthday = body.response === 'trusted_jesus_today' ? new Date().toISOString().slice(0, 10) : null
  const claimToken = crypto.getRandomValues(new Uint8Array(32))
  const rawClaimToken = btoa(String.fromCharCode(...claimToken)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const { error } = await admin.from('gospel_shared_responses').upsert({
    share_link_id: link.id,
    response: body.response,
    optional_message: message,
    responder_name: responderName,
    spiritual_birthday: spiritualBirthday,
    claim_token_hash: await hashToken(rawClaimToken),
    claimed_at: null,
    consented_at: new Date().toISOString(),
  }, { onConflict: 'share_link_id' })
  if (error) return json({ error: 'Unable to share response' }, 500)
  return json({ shared: true, claimUrl: `sifia://gospel/claim/${rawClaimToken}` })
})
