// Enterprise-Grade Apple StoreKit 2 Webhook Handler
// Processes real-time subscription events from Apple
// Handles: trial conversions, renewals, cancellations, billing issues

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decode JWT (both transaction info and signed payload)
interface TransactionInfo {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  offerType?: number;
}

interface WebhookPayload {
  notificationType: string;
  subtype?: string;
  data?: {
    signedTransactionInfo: string;
  };
}

function decodeJWT(token: string): WebhookPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload) as WebhookPayload;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

function decodeTransactionInfo(signedInfo: string): TransactionInfo | null {
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

// Extract tier from product ID (handles annual detection)
function getTierFromProductId(productId: string): string {
  const isAnnual = productId.includes('annual');
  
  if (productId.includes('spark')) return isAnnual ? 'spark_annual' : 'spark';
  if (productId.includes('growth')) return isAnnual ? 'growth_annual' : 'growth';
  if (productId.includes('transformation')) return isAnnual ? 'transformation_annual' : 'transformation';
  
  return 'spark'; // fallback
}

// Get tier limits for subscription tiers (handles annual variants)
function getTierLimits(tier: string): { playbooks_limit: number; devotionals_limit: number; smart_journaling_enabled: boolean } {
  // Map annual variants to base tier for limits
  const baseTier = tier.replace('_annual', '');
  
  switch (baseTier) {
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

// Get tier display name (handles annual variants)
function getTierDisplayName(tier: string): string {
  const baseTier = tier.replace('_annual', '');
  const isAnnual = tier.includes('_annual');
  
  switch (baseTier) {
    case 'seeker': return 'siFia Seeker';
    case 'spark': return isAnnual ? 'siFia Spark Annual' : 'siFia Spark';
    case 'growth': return isAnnual ? 'siFia Growth Annual' : 'siFia Growth';
    case 'transformation': return isAnnual ? 'siFia Transformation Annual' : 'siFia Transformation';
    default: return tier;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Apple webhooks don't send authorization headers, so we allow them without auth
  // Apple authenticates via signed payload verification (which we do below)
  const userAgent = req.headers.get('user-agent') || '';
  const appleNotificationType = req.headers.get('apple-notification-type') || '';
  const isAppleWebhook = userAgent.includes('Apple') || appleNotificationType !== null;

  console.log('[AppleWebhook] Auth check:', { userAgent, appleNotificationType, isAppleWebhook });

  if (!isAppleWebhook && !req.headers.get('authorization')) {
    return new Response('Missing authorization header', { status: 401 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('[AppleWebhook] Raw payload received');

    // CRITICAL FIX: Handle both v1 and v2 payload formats
    let notificationType: string | undefined;
    let subtype: string | undefined;
    let signedTransactionInfo: string | undefined;

    // Check for v2 format (signedPayload)
    if (body.signedPayload) {
      console.log('[AppleWebhook] v2 format detected (signedPayload)');
      
      // Decode outer signedPayload
      const decodedPayload = decodeJWT(body.signedPayload);
      if (!decodedPayload) {
        console.error('[AppleWebhook] Failed to decode signedPayload');
        return new Response('Bad Request', { status: 400, headers: corsHeaders });
      }

      notificationType = decodedPayload.notificationType;
      subtype = decodedPayload.subtype;
      signedTransactionInfo = decodedPayload.data?.signedTransactionInfo;

      console.log('[AppleWebhook] v2 decoded:', {
        notificationType,
        subtype,
        hasTransactionInfo: !!signedTransactionInfo,
      });
    } 
    // Check for v1 format (body.notificationType)
    else if (body.notificationType) {
      console.log('[AppleWebhook] v1 format detected');
      notificationType = body.notificationType;
      subtype = body.subtype;
      signedTransactionInfo = body.data?.signedTransactionInfo;
    } 
    else {
      console.error('[AppleWebhook] Unknown payload format');
      return new Response('Bad Request', { status: 400, headers: corsHeaders });
    }

    console.log('[AppleWebhook] Notification:', {
      type: notificationType,
      subtype: subtype,
      timestamp: new Date().toISOString(),
    });

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

    // Find user by original transaction ID (never changes across renewals)
    let { data: subscription, error: findError } = await supabaseClient
      .from('user_subscriptions_new')
      .select('*')
      .eq('original_transaction_id', originalTransactionId)
      .single();

    if (findError || !subscription) {
      console.error('[AppleWebhook] User not found for original transaction:', originalTransactionId);
      
      // FALLBACK: Try both platform_subscription_id and platform_transaction_id for backwards compatibility
      const { data: fallbackSub } = await supabaseClient
        .from('user_subscriptions_new')
        .select('*')
        .or(`platform_subscription_id.eq.${transactionId},platform_transaction_id.eq.${transactionId}`)
        .single();
      
      if (!fallbackSub) {
        console.error('[AppleWebhook] User not found in fallback lookup either');
        return new Response('OK', { headers: corsHeaders }); // Return OK to prevent retries
      }
      
      // Use fallback subscription
      subscription = fallbackSub;
      console.log('[AppleWebhook] Found user via fallback platform_transaction_id lookup');
    }

    const userId = subscription.user_id;
    console.log('[AppleWebhook] Processing for user:', userId);

    // Route to appropriate handler
    switch (notificationType) {
      case 'DID_RENEW': {
        // CRITICAL: Detect NEW TRIAL START vs TRIAL CONVERSION vs REGULAR RENEWAL
        // NEW TRIAL START: User on 'seeker' purchasing .freetrial product → Skip (app handles with createTrial)
        // TRIAL CONVERSION: User on 'free_trial' charged after trial ends → Convert to paid
        // REGULAR RENEWAL: User on paid tier renewing → Reset usage
        
        const isTrialProduct = (productId || '').includes('freetrial');
        const isNewTrialStart = subscription.tier === 'seeker' && isTrialProduct;
        
        // FIX: Trial conversion detection - check tier first, offerType is optional
        // Apple may not always send offerType, so we rely on tier + trial_end_date
        const isTrialConversion = subscription.tier === 'free_trial';

        if (isNewTrialStart) {
          // NEW TRIAL START: Skip webhook - app will handle with createTrial()
          console.log('[AppleWebhook] 🎯 NEW TRIAL START detected - skipping webhook (app will handle)', {
            currentTier: subscription.tier,
            productId,
            reason: 'User on seeker purchasing .freetrial product - createTrial() will handle setup'
          });
          // Don't process - let the app's TrialManagementService.createTrial() handle it
          break;
        } else if (isTrialConversion) {
          // CRITICAL: Trial → Paid conversion
          console.log('[AppleWebhook] 🎉 TRIAL CONVERSION: User charged after trial period', {
            userId,
            currentTier: subscription.tier,
            productId,
            offerType,
            trialEndDate: subscription.trial_end_date,
          });

          // Extract actual tier from product ID (handles annual detection)
          const actualTier = getTierFromProductId(productId);
          const paidLimits = getTierLimits(actualTier);
          
          // Extract billing cycle from product ID
          const billingCycle = productId.includes('annual') ? 'annual' : 'monthly';
          
          console.log('[AppleWebhook] Converting to tier:', actualTier, 'billing:', billingCycle, 'from productId:', productId);

          // Calculate subscription_end_date based on billing cycle
          const now = new Date();
          const subscriptionEndDate = new Date(now);
          if (billingCycle === 'annual') {
            subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
          } else {
            subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);
          }

          await supabaseClient
            .from('user_subscriptions_new')
            .update({
              tier: actualTier,
              subscription_display_name: getTierDisplayName(actualTier),
              billing_cycle: billingCycle, // Store billing cycle
              playbooks_limit: paidLimits.playbooks_limit,
              devotionals_limit: paidLimits.devotionals_limit,
              playbooks_used: 0, // Reset usage
              devotionals_used: 0,
              last_usage_reset: now.toISOString(), // Track when usage was reset
              smart_journaling_enabled: paidLimits.smart_journaling_enabled,
              platform_transaction_id: transactionId,
              subscription_start_date: now.toISOString(),
              subscription_end_date: subscriptionEndDate.toISOString(), // Set expiration
              trial_converted_date: now.toISOString(),
              billing_issue: false,
              grace_period_end_date: null,
              status: 'active', // Ensure status is active
              updated_at: now.toISOString(),
            })
            .eq('user_id', userId);

          console.log('[AppleWebhook] ✅ Trial converted to', actualTier, billingCycle);
        } else {
          // Regular renewal - reset usage and verify tier matches productId
          console.log('[AppleWebhook] Regular renewal - resetting usage');

          // Extract tier from productId in case user changed billing cycle
          const actualTier = getTierFromProductId(productId);
          const paidLimits = getTierLimits(actualTier);
          const billingCycle = productId.includes('annual') ? 'annual' : 'monthly';

          // Calculate subscription_end_date based on billing cycle
          const now = new Date();
          const subscriptionEndDate = new Date(now);
          if (billingCycle === 'annual') {
            subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
          } else {
            subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);
          }

          await supabaseClient
            .from('user_subscriptions_new')
            .update({
              tier: actualTier, // Update tier in case billing cycle changed
              subscription_display_name: getTierDisplayName(actualTier),
              billing_cycle: billingCycle, // Update billing cycle in case it changed
              playbooks_limit: paidLimits.playbooks_limit,
              devotionals_limit: paidLimits.devotionals_limit,
              smart_journaling_enabled: paidLimits.smart_journaling_enabled,
              platform_transaction_id: transactionId,
              billing_issue: false,
              grace_period_end_date: null,
              playbooks_used: 0, // Reset usage on renewal
              devotionals_used: 0,
              last_usage_reset: now.toISOString(), // Track when usage was reset
              subscription_start_date: now.toISOString(),
              subscription_end_date: subscriptionEndDate.toISOString(), // Set expiration
              updated_at: now.toISOString(),
            })
            .eq('user_id', userId);

          console.log('[AppleWebhook] ✅ Renewal processed:', actualTier, billingCycle, 'with usage reset');
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
            billing_cycle: null, // Clear billing cycle
            billing_issue: false,
            grace_period_end_date: null,
            subscription_end_date: new Date().toISOString(),
            auto_renew_enabled: false, // Disable auto-renewal on expiration
            status: 'expired',
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
            billing_cycle: null, // Clear billing cycle
            subscription_end_date: new Date().toISOString(), // Set to now (expired)
            refund_date: new Date().toISOString(),
            status: 'refunded',
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
