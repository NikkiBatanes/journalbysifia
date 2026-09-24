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

const resolveSenderName = (stored: unknown, profile?: SenderNameFields | null, metadata?: SenderNameFields | null) => {
  const storedName = cleanName(stored)
  return [
    joinedName(profile),
    joinedName(metadata),
    cleanName(profile?.full_name),
    cleanName(metadata?.full_name),
    cleanName(profile?.display_name),
    cleanName(metadata?.display_name),
    storedName === 'Someone' ? '' : storedName,
    cleanName(profile?.first_name),
    cleanName(metadata?.first_name),
  ].find(Boolean) || 'Someone'
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
  const { data: link } = await admin.from('gospel_share_links').select('id,sender_user_id,sender_display_name,expires_at,revoked_at').eq('token_hash', await hashToken(body.token)).maybeSingle()
  if (!link || link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) return json({ error: 'This Gospel link is no longer available' }, 404)

  if (body.action === 'resolve') {
    let profile: SenderNameFields | null = null
    let metadata: SenderNameFields | null = null
    if (link.sender_user_id) {
      const [profileResult, userResult] = await Promise.all([
        admin.from('user_profiles').select('first_name,last_name,full_name,display_name').eq('id', link.sender_user_id).maybeSingle(),
        admin.auth.admin.getUserById(link.sender_user_id),
      ])
      profile = profileResult.data
      metadata = userResult.data.user?.user_metadata as SenderNameFields | undefined || null
    }
    const senderDisplayName = resolveSenderName(link.sender_display_name, profile, metadata)
    if (senderDisplayName !== link.sender_display_name && senderDisplayName !== 'Someone') {
      await admin.from('gospel_share_links').update({ sender_display_name: senderDisplayName }).eq('id', link.id)
    }
    return json({ senderDisplayName })
  }
  if (body.action !== 'respond') return json({ error: 'Invalid action' }, 400)
  if (!body.consent) return json({ shared: false })

  const allowed = ['trusted_jesus_today', 'has_questions', 'not_ready', 'already_follows_jesus']
  if (!body.response || !allowed.includes(body.response)) return json({ error: 'Invalid response' }, 400)
  const message = body.optionalMessage?.trim().slice(0, 1000) || null
  const responderName = body.shareName ? body.responderName?.trim().slice(0, 80) || null : null
  const consentedAt = new Date().toISOString()
  const spiritualBirthday = body.response === 'trusted_jesus_today' ? consentedAt.slice(0, 10) : null
  const claimToken = crypto.getRandomValues(new Uint8Array(32))
  const rawClaimToken = btoa(String.fromCharCode(...claimToken)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const { data: savedResponse, error } = await admin.from('gospel_shared_responses').upsert({
    share_link_id: link.id,
    response: body.response,
    optional_message: message,
    responder_name: responderName,
    spiritual_birthday: spiritualBirthday,
    claim_token_hash: await hashToken(rawClaimToken),
    claimed_at: null,
    consented_at: consentedAt,
  }, { onConflict: 'share_link_id' }).select('id').single()
  if (error) return json({ error: 'Unable to share response' }, 500)
  const impactEventId = `gospel-web-response:${savedResponse.id}:accepted`
  if (body.response === 'trusted_jesus_today') {
    const { error: impactError } = await admin.from('journal_impact_events').upsert({
      client_event_id: impactEventId,
      event_type: 'accepted_jesus',
      occurred_at: consentedAt,
      method: 'link',
      platform: 'web',
      user_id: link.sender_user_id || null,
    }, { onConflict: 'client_event_id', ignoreDuplicates: true })
    if (impactError) console.error('Unable to record Gospel acceptance impact', impactError)
  } else {
    await admin.from('journal_impact_events').delete().eq('client_event_id', impactEventId)
  }
  return json({ shared: true, claimUrl: `sifia://gospel/claim/${rawClaimToken}` })
})
