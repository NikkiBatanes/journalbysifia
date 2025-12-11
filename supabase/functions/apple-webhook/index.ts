// Enterprise-Grade Apple StoreKit 2 Webhook Handler
// Processes real-time subscription events from Apple
// Handles: trial conversions, renewals, cancellations, billing issues

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decode JWT transaction info (simplified - production should verify signature)
function decodeTransactionInfo(signedInfo: string): any | null {
  try {
    const parts = signedInfo.split('.');
    if (parts.length !== 3) return null;
    
    const payload = atob(parts[1]);
    return JSON.parse(payload);
  } catch (error) {
    console.error('Failed to decode transaction:', error);
    return null;
  }
}

// Get tier limits for subscription tiers
function getTierLimits(tier: string): { playbooks_limit: number; devotionals_limit: number; smart_journaling_enabled: boolean } {
  switch (tier) {
    case 'seeker':
      return { playbooks_limit: 0, devotionals_limit: 0, smart_journaling_enabled: false };
    case 'spark':
      return { playbooks_limit: 8, devotionals_limit: 8, smart_journaling_enabled: true };
    case 'growth':
      return { playbooks_limit: 20, devotionals_limit: 20, smart_journaling_enabled: true };
    case 'transformation':
      return { playbooks_limit: 999999, devotionals_limit: 999999, smart_journaling_enabled: true };
    default:
      return { playbooks_limit: 0, devotionals_limit: 0, smart_journaling_enabled: false };
  }
}

// Get tier display name
function getTierDisplayName(tier: string): string {
  switch (tier) {
    case 'seeker': return 'siFia Seeker';
    case 'spark': return 'siFia Spark';
    case 'growth': return 'siFia Growth';
    case 'transformation': return 'siFia Transformation';
    default: return tier;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('[AppleWebhook] Received notification:', {
      type: body.notificationType,
      subtype: body.subtype,
      timestamp: new Date().toISOString(),
    });

    const notificationType = body.notificationType;
    const subtype = body.subtype;
    const signedTransactionInfo = body.data?.signedTransactionInfo;

    if (!signedTransactionInfo) {
      console.log('[AppleWebhook] No transaction info, skipping');
      return new Response('OK', { headers: corsHeaders });
    }

    // Decode transaction
    const transaction = decodeTransactionInfo(signedTransactionInfo);
    if (!transaction) {
      console.error('[AppleWebhook] Failed to decode transaction');
      return new Response('Bad Request', { status: 400, headers: corsHeaders });
    }

    const transactionId = transaction.transactionId;
    const originalTransactionId = transaction.originalTransactionId;
    const productId = transaction.productId;
    const offerType = transaction.offerType; // 1 = introductory/trial

    console.log('[AppleWebhook] Transaction decoded:', {
      transactionId: transactionId?.substring(0, 10) + '...',
      originalTransactionId: originalTransactionId?.substring(0, 10) + '...',
      productId,
      offerType,
    });

    // Find user by transaction ID
    const { data: subscription, error: findError } = await supabaseClient
      .from('user_subscriptions_new')
      .select('*')
      .eq('platform_transaction_id', originalTransactionId)
      .single();

    if (findError || !subscription) {
      console.error('[AppleWebhook] User not found for transaction:', originalTransactionId);
      return new Response('OK', { headers: corsHeaders }); // Return OK to prevent retries
    }

    const userId = subscription.user_id;
    console.log('[AppleWebhook] Processing for user:', userId);

    // Route to appropriate handler
    switch (notificationType) {
      case 'DID_RENEW': {
        // Check if this is trial conversion or regular renewal
        const isTrialConversion = subscription.tier === 'free_trial' && offerType === 1;

        if (isTrialConversion) {
          // CRITICAL: Trial → Paid conversion
          console.log('[AppleWebhook] 🎉 Trial converting to paid (Apple charged)');

          const chosenTier = subscription.trial_chosen_tier || 'spark';
          const paidLimits = getTierLimits(chosenTier);

          await supabaseClient
            .from('user_subscriptions_new')
            .update({
              tier: chosenTier,
              subscription_display_name: getTierDisplayName(chosenTier),
              playbooks_limit: paidLimits.playbooks_limit,
              devotionals_limit: paidLimits.devotionals_limit,
              playbooks_used: 0, // Reset usage
              devotionals_used: 0,
              smart_journaling_enabled: paidLimits.smart_journaling_enabled,
              platform_transaction_id: transactionId,
              subscription_start_date: new Date().toISOString(),
              trial_converted_date: new Date().toISOString(),
              billing_issue: false,
              grace_period_end_date: null,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          console.log('[AppleWebhook] ✅ Trial converted to', chosenTier);
        } else {
          // Regular renewal - reset monthly usage
          console.log('[AppleWebhook] Regular renewal - resetting usage');

          await supabaseClient
            .from('user_subscriptions_new')
            .update({
              platform_transaction_id: transactionId,
              billing_issue: false,
              grace_period_end_date: null,
              playbooks_used: 0, // Reset monthly usage
              devotionals_used: 0,
              subscription_start_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          console.log('[AppleWebhook] ✅ Renewal processed with usage reset');
        }
        break;
      }

      case 'DID_CHANGE_RENEWAL_STATUS': {
        if (subtype === 'AUTO_RENEW_DISABLED') {
          // User cancelled
          if (subscription.tier === 'free_trial') {
            // Trial cancelled - mark but keep access until trial_end_date
            await supabaseClient
              .from('user_subscriptions_new')
              .update({
                trial_cancelled_date: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);

            console.log('[AppleWebhook] ✅ Trial cancelled (keeps access until trial_end_date)');
          } else {
            // Paid cancelled - keep access until expiration
            await supabaseClient
              .from('user_subscriptions_new')
              .update({
                auto_renew_enabled: false,
                cancellation_date: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);

            console.log('[AppleWebhook] ✅ Auto-renewal disabled (keeps access until expiration)');
          }
        } else if (subtype === 'AUTO_RENEW_ENABLED') {
          // User re-enabled
          await supabaseClient
            .from('user_subscriptions_new')
            .update({
              auto_renew_enabled: true,
              cancellation_date: null,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          console.log('[AppleWebhook] ✅ Auto-renewal re-enabled');
        }
        break;
      }

      case 'DID_FAIL_TO_RENEW': {
        // Payment failure - enter grace period (3 days)
        console.log('[AppleWebhook] Payment failed - entering grace period');

        const gracePeriodEnd = new Date();
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);

        await supabaseClient
          .from('user_subscriptions_new')
          .update({
            billing_issue: true,
            grace_period_end_date: gracePeriodEnd.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        console.log('[AppleWebhook] ✅ Grace period activated until', gracePeriodEnd.toISOString());
        break;
      }

      case 'EXPIRED':
      case 'GRACE_PERIOD_EXPIRED': {
        // Subscription expired or grace period expired - revert to seeker
        console.log('[AppleWebhook] Subscription expired - reverting to seeker');

        const seekerLimits = getTierLimits('seeker');

        await supabaseClient
          .from('user_subscriptions_new')
          .update({
            tier: 'seeker',
            subscription_display_name: 'siFia Seeker',
            playbooks_limit: seekerLimits.playbooks_limit,
            devotionals_limit: seekerLimits.devotionals_limit,
            playbooks_used: 0,
            devotionals_used: 0,
            smart_journaling_enabled: seekerLimits.smart_journaling_enabled,
            billing_issue: false,
            grace_period_end_date: null,
            subscription_end_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        console.log('[AppleWebhook] ✅ Reverted to seeker');
        break;
      }

      case 'REFUND': {
        // Refund processed - immediate revert to seeker
        console.log('[AppleWebhook] Refund processed - immediate revert');

        const seekerLimits = getTierLimits('seeker');

        await supabaseClient
          .from('user_subscriptions_new')
          .update({
            tier: 'seeker',
            subscription_display_name: 'siFia Seeker',
            playbooks_limit: seekerLimits.playbooks_limit,
            devotionals_limit: seekerLimits.devotionals_limit,
            playbooks_used: 0,
            devotionals_used: 0,
            smart_journaling_enabled: seekerLimits.smart_journaling_enabled,
            refund_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        console.log('[AppleWebhook] ✅ Refund processed');
        break;
      }

      default:
        console.log('[AppleWebhook] Unhandled notification type:', notificationType);
    }

    return new Response('OK', { headers: corsHeaders });
  } catch (error) {
    console.error('[AppleWebhook] Error:', error);
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
  }
});
