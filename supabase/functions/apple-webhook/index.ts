import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('Apple webhook received:', JSON.stringify(body, null, 2))

    // Handle different notification types
    const notificationType = body.notificationType
    const subtype = body.subtype
    const transactionInfo = body.data?.transactionInfo
    const originalTransactionId = transactionInfo?.originalTransactionId

    if (!originalTransactionId) {
      console.log('No originalTransactionId found, skipping')
      return new Response('OK', { headers: corsHeaders })
    }

    // Map notification types to subscription status
    let newStatus = 'active'
    let shouldUpdate = true

    switch (notificationType) {
      case 'SUBSCRIBED':
        newStatus = 'active'
        break
      case 'DID_RENEW':
        newStatus = 'active'
        break
      case 'EXPIRED':
        newStatus = 'expired'
        break
      case 'DID_FAIL_TO_RENEW':
        newStatus = 'past_due'
        break
      case 'GRACE_PERIOD_EXPIRED':
        newStatus = 'expired'
        break
      case 'REFUND':
        newStatus = 'refunded'
        break
      case 'REVOKE':
        newStatus = 'revoked'
        break
      default:
        console.log(`Unhandled notification type: ${notificationType}`)
        shouldUpdate = false
    }

    if (shouldUpdate) {
      // Update subscription status in database
      const { error } = await supabaseClient
        .from('subscriptions')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          apple_original_transaction_id: originalTransactionId,
          last_webhook_notification: {
            type: notificationType,
            subtype: subtype,
            received_at: new Date().toISOString(),
            transaction_info: transactionInfo
          }
        })
        .eq('apple_original_transaction_id', originalTransactionId)

      if (error) {
        console.error('Error updating subscription:', error)
        return new Response('Database Error', { status: 500, headers: corsHeaders })
      }

      console.log(`Updated subscription ${originalTransactionId} to status: ${newStatus}`)
    }

    return new Response('OK', { headers: corsHeaders })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders })
  }
})
