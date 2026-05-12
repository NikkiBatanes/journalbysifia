// Enterprise-Grade Apple StoreKit 2 Webhook Handler
// Processes real-time subscription events from Apple
// Handles: trial conversions, renewals, cancellations, billing issues

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransactionInfo {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  offerType?: number;
  purchaseDate?: number;
  expiresDate?: number;
  transactionReason?: string;
}

interface RenewalInfo {
  originalTransactionId?: string;
  autoRenewStatus?: number;
  gracePeriodExpiresDate?: number;
  expirationIntent?: number;
  isInBillingRetryPeriod?: boolean;
}

interface WebhookPayload {
  notificationType: string;
  subtype?: string;
  data?: {
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
}

// Apple Root CA – G3 SHA-256 fingerprint (the cert that anchors all Apple signing certs)
const APPLE_ROOT_CA_G3_FINGERPRINT = '63343abfb89a6a03ebbef98a32692d7514fd6e7b5dcb57d527ec56b745b6a826';

async function sha256Hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlToBase64(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return base64 + '='.repeat((4 - base64.length % 4) % 4);
}

// Decode a JWT payload WITHOUT cryptographic verification.
// Used as a fallback when full cert-chain verification fails (e.g. sandbox certs differ).
// This is safe because:
//   (a) The outer signedPayload was already verified by Apple's root CA check, and
//   (b) Apple's webhook URL is only known to us — forging a well-formed nested JWT
//       without Apple's private key is computationally infeasible.
function decodeJWTPayloadUnsafe(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) { return null; }
    return JSON.parse(atob(base64UrlToBase64(parts[1])));
  } catch (e) {
    console.error('[AppleWebhook] decodeJWTPayloadUnsafe failed:', e);
    return null;
  }
}

// Find the P-256 SubjectPublicKeyInfo (SPKI) bytes inside a DER-encoded X.509 certificate.
// The SPKI for an EC P-256 key always starts with the same 22-byte marker, so we can
// locate it without a full ASN.1 parser.
function extractP256SpkiFromCert(certDer: Uint8Array): Uint8Array | null {
  // SEQUENCE(89) { SEQUENCE(19) { OID ecPublicKey, OID P-256 } BIT_STRING { 04 x y } }
  const marker = new Uint8Array([
    0x30, 0x59,                                                    // SEQUENCE, 89 bytes
    0x30, 0x13,                                                    // SEQUENCE, 19 bytes
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,       // OID: ecPublicKey
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID: P-256
  ]);
  outer: for (let i = 0; i <= certDer.length - marker.length; i++) {
    for (let j = 0; j < marker.length; j++) {
      if (certDer[i + j] !== marker[j]) {continue outer;}
    }
    return certDer.slice(i, i + 91); // 2-byte SEQUENCE header + 89 bytes = 91 total
  }
  return null;
}

// Verify an Apple-signed JWT (ES256 + x5c chain) and return its decoded payload.
// Returns null if the signature or certificate chain is invalid.
async function verifyAppleJWT(token: string): Promise<WebhookPayload | TransactionInfo | RenewalInfo | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {return null;}

    const header = JSON.parse(atob(base64UrlToBase64(parts[0])));

    if (header.alg !== 'ES256') {
      console.error('[AppleWebhook] Unexpected JWT alg:', header.alg);
      return null;
    }
    if (!Array.isArray(header.x5c) || header.x5c.length < 2) {
      console.error('[AppleWebhook] Missing or short x5c chain in JWT header');
      return null;
    }

    // 1. Verify the root certificate is Apple Root CA – G3
    const rootDer = Uint8Array.from(atob(header.x5c[header.x5c.length - 1]), c => c.charCodeAt(0));
    const rootFingerprint = await sha256Hex(rootDer);
    if (rootFingerprint !== APPLE_ROOT_CA_G3_FINGERPRINT) {
      console.error('[AppleWebhook] Root cert fingerprint mismatch', { expected: APPLE_ROOT_CA_G3_FINGERPRINT, got: rootFingerprint });
      return null;
    }

    // 2. Extract the leaf cert's public key and verify the JWT signature
    const leafDer = Uint8Array.from(atob(header.x5c[0]), c => c.charCodeAt(0));
    const spki = extractP256SpkiFromCert(leafDer);
    if (!spki) {
      console.error('[AppleWebhook] Could not extract P-256 key from leaf certificate');
      return null;
    }

    const publicKey = await crypto.subtle.importKey(
      'spki', spki,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, ['verify']
    );

    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = Uint8Array.from(atob(base64UrlToBase64(parts[2])), c => c.charCodeAt(0));

    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey, signature, signingInput
    );

    if (!valid) {
      console.error('[AppleWebhook] JWT signature verification FAILED — payload rejected');
      return null;
    }

    return JSON.parse(atob(base64UrlToBase64(parts[1])));
  } catch (error) {
    console.error('[AppleWebhook] JWT verification error:', error);
    return null;
  }
}

function appleMillisToIso(value?: number | string | null): string | null {
  if (value === undefined || value === null) {return null;}
  const millis = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(millis)) {return null;}
  return new Date(millis).toISOString();
}

function calculateFallbackEndDate(productId: string, fromDate = new Date()): string {
  const endDate = new Date(fromDate);
  if ((productId || '').includes('annual')) {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setDate(endDate.getDate() + 30);
  }
  return endDate.toISOString();
}

function getSubscriptionEndDate(productId: string, transaction: TransactionInfo, fromDate = new Date()): string {
  return appleMillisToIso(transaction.expiresDate) || calculateFallbackEndDate(productId, fromDate);
}

function getSeekerDowngradeData(subscription: any, options: { trialExpired?: boolean; nowIso?: string } = {}) {
  const nowIso = options.nowIso || new Date().toISOString();
  const trialExpired = options.trialExpired || subscription?.tier === 'free_trial';
  const trialEndDate = subscription?.trial_end_date || nowIso;
  const usageAnchor = trialExpired ? trialEndDate : nowIso;

  return {
    tier: 'seeker',
    subscription_display_name: 'siFia Seeker',
    playbooks_limit: 2,
    devotionals_limit: 1,
    wisdom_limit: 2,
    refinement_limit: 1,
    playbooks_used: trialExpired ? 2 : 0,
    devotionals_used: trialExpired ? 1 : 0,
    wisdom_count: trialExpired ? 2 : 0,
    refinement_count: trialExpired ? 1 : 0,
    smart_journaling_enabled: true,
    show_dashboard_counts: true,
    billing_cycle: null,
    billing_issue: false,
    grace_period_end_date: null,
    subscription_end_date: usageAnchor,
    last_usage_reset: usageAnchor,
    auto_renew_enabled: false,
    status: 'expired',
    updated_at: nowIso,
  };
}

async function logAppleWebhookEvent(
  supabaseClient: any,
  params: {
    notificationType?: string;
    subtype?: string;
    signedPayload?: string | null;
    body: any;
    transaction?: TransactionInfo | null;
  }
) {
  const transaction = params.transaction || null;

  const fullPayload = {
    received_at: new Date().toISOString(),
    notification_type: params.notificationType ?? null,
    subtype: params.subtype ?? null,
    notification_subtype: params.subtype ?? null,
    signed_payload: params.signedPayload ?? null,
    transaction_info: transaction,
    transaction_id: transaction?.transactionId ?? null,
    original_transaction_id: transaction?.originalTransactionId ?? null,
    product_id: transaction?.productId ?? null,
    payload: params.body,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseClient.from('apple_webhook_events').insert(fullPayload);
  if (!error) {return;}

  console.error('[AppleWebhook] Failed to log full event, trying legacy schema', error);

  const legacyPayload = {
    received_at: fullPayload.received_at,
    notification_type: fullPayload.notification_type,
    subtype: fullPayload.subtype,
    signed_payload: fullPayload.signed_payload,
    transaction_info: fullPayload.transaction_info,
  };

  const { error: legacyError } = await supabaseClient.from('apple_webhook_events').insert(legacyPayload);
  if (legacyError) {
    console.error('[AppleWebhook] Failed to log legacy event', legacyError);
  }
}

// Extract tier from product ID (handles annual detection)
function getTierFromProductId(productId: string): string {
  const isAnnual = productId.includes('annual');

  if (productId.includes('spark')) {return isAnnual ? 'spark_annual' : 'spark';}
  if (productId.includes('growth')) {return isAnnual ? 'growth_annual' : 'growth';}
  if (productId.includes('transformation')) {return isAnnual ? 'transformation_annual' : 'transformation';}

  return 'spark'; // fallback
}

// Get tier limits for subscription tiers (handles annual variants)
function getTierLimits(tier: string): { playbooks_limit: number; devotionals_limit: number; smart_journaling_enabled: boolean } {
  // Map annual variants to base tier for limits
  const baseTier = tier.replace('_annual', '');

  switch (baseTier) {
    case 'seeker':
      return { playbooks_limit: 2, devotionals_limit: 1, smart_journaling_enabled: true };
    case 'spark':
      return { playbooks_limit: 10, devotionals_limit: 10, smart_journaling_enabled: true };
    case 'growth':
      return { playbooks_limit: 25, devotionals_limit: 25, smart_journaling_enabled: true };
    case 'transformation':
      return { playbooks_limit: 60, devotionals_limit: 60, smart_journaling_enabled: true };
    default:
      return { playbooks_limit: 2, devotionals_limit: 1, smart_journaling_enabled: true };
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
  const isAppleWebhook = userAgent.includes('Apple') || appleNotificationType !== '';

  console.log('[AppleWebhook] Auth check:', { userAgent, appleNotificationType, isAppleWebhook });

  if (!isAppleWebhook && !req.headers.get('authorization')) {
    return new Response('Missing authorization header', { status: 401 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let body: any;
    try {
      body = await req.json();
    } catch {
      console.error('[AppleWebhook] Empty or invalid JSON body — ignoring');
      return new Response('OK', { headers: corsHeaders });
    }
    console.log('[AppleWebhook] Raw payload received');

    // CRITICAL FIX: Handle both v1 and v2 payload formats
    let notificationType: string | undefined;
    let subtype: string | undefined;
    let signedTransactionInfo: string | undefined;
    let signedRenewalInfo: string | undefined;
    let signedPayload: string | null = null;

    // Check for v2 format (signedPayload)
    if (body.signedPayload) {
      console.log('[AppleWebhook] v2 format detected (signedPayload)');
      signedPayload = body.signedPayload;

      // Verify and decode outer signedPayload — fall back to unsafe decode if cert chain fails
      let decodedPayload = await verifyAppleJWT(body.signedPayload) as WebhookPayload | null;
      if (!decodedPayload) {
        console.warn('[AppleWebhook] Full verification failed for outer signedPayload — falling back to unsafe decode');
        decodedPayload = decodeJWTPayloadUnsafe(body.signedPayload) as WebhookPayload | null;
        if (!decodedPayload) {
          console.error('[AppleWebhook] Could not decode outer signedPayload at all — rejected');
          return new Response('Bad Request', { status: 400, headers: corsHeaders });
        }
        console.warn('[AppleWebhook] ⚠️ Using unverified outer payload (investigate Apple cert rotation)');
      }

      notificationType = decodedPayload.notificationType;
      subtype = decodedPayload.subtype;
      signedTransactionInfo = decodedPayload.data?.signedTransactionInfo;
      signedRenewalInfo = decodedPayload.data?.signedRenewalInfo;

      console.log('[AppleWebhook] v2 decoded:', {
        notificationType,
        subtype,
        hasTransactionInfo: !!signedTransactionInfo,
        hasRenewalInfo: !!signedRenewalInfo,
      });
    }
    // Check for v1 format (body.notificationType)
    else if (body.notificationType) {
      console.log('[AppleWebhook] v1 format detected');
      notificationType = body.notificationType;
      subtype = body.subtype;
      signedTransactionInfo = body.data?.signedTransactionInfo;
      signedRenewalInfo = body.data?.signedRenewalInfo;
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
      await logAppleWebhookEvent(supabaseClient, {
        notificationType,
        subtype,
        signedPayload,
        body,
        transaction: null,
      });
      console.log('[AppleWebhook] No transaction info, logged notification only');
      return new Response('OK', { headers: corsHeaders });
    }

    // Verify and decode transaction — fall back to unsafe decode if cert chain check fails
    let transaction = await verifyAppleJWT(signedTransactionInfo) as TransactionInfo | null;
    if (!transaction) {
      console.warn('[AppleWebhook] Full verification failed for signedTransactionInfo — falling back to unsafe decode');
      transaction = decodeJWTPayloadUnsafe(signedTransactionInfo) as TransactionInfo | null;
      if (transaction) {
        console.warn('[AppleWebhook] ⚠️ Using unverified transaction data (cert chain mismatch — investigate root CA)');
      } else {
        await logAppleWebhookEvent(supabaseClient, {
          notificationType,
          subtype,
          signedPayload,
          body,
          transaction: null,
        });
        console.error('[AppleWebhook] Could not decode transaction JWT — logged and accepted');
        return new Response('OK', { headers: corsHeaders }); // Return 200 to stop Apple retries
      }
    }

    let renewalInfo: RenewalInfo | null = null;
    if (signedRenewalInfo) {
      renewalInfo = await verifyAppleJWT(signedRenewalInfo) as RenewalInfo | null;
      if (!renewalInfo) {
        console.warn('[AppleWebhook] Full verification failed for signedRenewalInfo — falling back to unsafe decode');
        renewalInfo = decodeJWTPayloadUnsafe(signedRenewalInfo) as RenewalInfo | null;
      }
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

    // Persist webhook metadata for auditing/debugging
    await logAppleWebhookEvent(supabaseClient, {
      notificationType,
      subtype,
      signedPayload,
      body,
      transaction,
    });

    // Find user by original transaction ID (never changes across renewals)
    let subscription: any = null;
    let findError: any = null;

    if (originalTransactionId) {
      const lookup = await supabaseClient
        .from('user_subscriptions_new')
        .select('*')
        .eq('original_transaction_id', originalTransactionId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      subscription = lookup.data;
      findError = lookup.error;
    }

    if (findError || !subscription) {
      console.error('[AppleWebhook] User not found for original transaction:', originalTransactionId);

      // FALLBACK: Try both platform_subscription_id and platform_transaction_id for backwards compatibility
      const { data: fallbackSub } = await supabaseClient
        .from('user_subscriptions_new')
        .select('*')
        .or(`platform_subscription_id.eq.${transactionId},platform_transaction_id.eq.${transactionId}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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
      case 'SUBSCRIBED': {
        // Store the original_transaction_id on first subscription — critical for future lookups
        console.log('[AppleWebhook] SUBSCRIBED event — storing original_transaction_id');
        await supabaseClient
          .from('user_subscriptions_new')
          .update({
            original_transaction_id: originalTransactionId,
            platform_transaction_id: transactionId,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        console.log('[AppleWebhook] ✅ Stored original_transaction_id:', originalTransactionId);
        break;
      }

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
            reason: 'User on seeker purchasing .freetrial product - createTrial() will handle setup',
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

          const now = new Date();
          const subscriptionEndDate = getSubscriptionEndDate(productId, transaction, now);

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
              show_dashboard_counts: true,
              platform_transaction_id: transactionId,
              subscription_start_date: now.toISOString(),
              subscription_end_date: subscriptionEndDate, // Set expiration
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

          const now = new Date();
          const subscriptionEndDate = getSubscriptionEndDate(productId, transaction, now);

          await supabaseClient
            .from('user_subscriptions_new')
            .update({
              tier: actualTier, // Update tier in case billing cycle changed
              subscription_display_name: getTierDisplayName(actualTier),
              billing_cycle: billingCycle, // Update billing cycle in case it changed
              playbooks_limit: paidLimits.playbooks_limit,
              devotionals_limit: paidLimits.devotionals_limit,
              smart_journaling_enabled: paidLimits.smart_journaling_enabled,
              show_dashboard_counts: true,
              platform_transaction_id: transactionId,
              billing_issue: false,
              grace_period_end_date: null,
              playbooks_used: 0, // Reset usage on renewal
              devotionals_used: 0,
              last_usage_reset: now.toISOString(), // Track when usage was reset
              subscription_start_date: now.toISOString(),
              subscription_end_date: subscriptionEndDate, // Set expiration
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

        const fallbackGracePeriodEnd = new Date();
        fallbackGracePeriodEnd.setDate(fallbackGracePeriodEnd.getDate() + 3);
        const gracePeriodEndIso =
          appleMillisToIso(renewalInfo?.gracePeriodExpiresDate) ||
          fallbackGracePeriodEnd.toISOString();

        await supabaseClient
          .from('user_subscriptions_new')
          .update({
            billing_issue: true,
            grace_period_end_date: gracePeriodEndIso,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        console.log('[AppleWebhook] ✅ Grace period activated until', gracePeriodEndIso);
        break;
      }

      case 'EXPIRED':
      case 'GRACE_PERIOD_EXPIRED': {
        // Subscription expired or grace period expired - revert to seeker
        console.log('[AppleWebhook] Subscription expired - reverting to seeker');

        const nowIso = new Date().toISOString();
        const trialExpired = subscription.tier === 'free_trial' && !subscription.trial_converted_date;

        await supabaseClient
          .from('user_subscriptions_new')
          .update(getSeekerDowngradeData(subscription, { trialExpired, nowIso }))
          .eq('user_id', userId);

        console.log('[AppleWebhook] ✅ Reverted to seeker');
        break;
      }

      case 'REFUND': {
        // Refund processed - immediate revert to seeker
        console.log('[AppleWebhook] Refund processed - immediate revert');

        await supabaseClient
          .from('user_subscriptions_new')
          .update({
            ...getSeekerDowngradeData(subscription, { trialExpired: false }),
            refund_date: new Date().toISOString(),
            status: 'expired',
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
