import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

interface AppleStatusTransaction {
  signedTransactionInfo?: string;
  signedRenewalInfo?: string;
  status?: number;
}

interface DecodedAppleTransaction {
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  purchaseDate?: number;
  expiresDate?: number;
  environment?: string;
}

interface DecodedAppleRenewalInfo {
  autoRenewStatus?: number;
  productId?: string;
  gracePeriodExpiresDate?: number;
}

interface AppleEntitlement {
  status: number;
  transaction: DecodedAppleTransaction;
  renewalInfo: DecodedAppleRenewalInfo;
}

function decodeJWT(token?: string): any | null {
  if (!token) {return null;}
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {return null;}
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch (error) {
    console.error('[ExpireSubscriptions] Failed to decode Apple JWT:', error);
    return null;
  }
}

function getTierFromProductId(productId = ''): string {
  const isAnnual = productId.includes('annual');
  if (productId.includes('spark')) {return isAnnual ? 'spark_annual' : 'spark';}
  if (productId.includes('growth')) {return isAnnual ? 'growth_annual' : 'growth';}
  if (productId.includes('transformation')) {return isAnnual ? 'transformation_annual' : 'transformation';}
  return 'spark';
}

function getTierDisplayName(tier: string): string {
  const baseTier = tier.replace('_annual', '');
  const isAnnual = tier.includes('_annual');
  switch (baseTier) {
    case 'spark': return isAnnual ? 'siFia Spark Annual' : 'siFia Spark';
    case 'growth': return isAnnual ? 'siFia Growth Annual' : 'siFia Growth';
    case 'transformation': return isAnnual ? 'siFia Transformation Annual' : 'siFia Transformation';
    default: return tier;
  }
}

function getTierLimits(tier: string): { playbooks_limit: number; devotionals_limit: number; smart_journaling_enabled: boolean } {
  const baseTier = tier.replace('_annual', '');
  switch (baseTier) {
    case 'spark': return { playbooks_limit: 10, devotionals_limit: 10, smart_journaling_enabled: true };
    case 'growth': return { playbooks_limit: 25, devotionals_limit: 25, smart_journaling_enabled: true };
    case 'transformation': return { playbooks_limit: 60, devotionals_limit: 60, smart_journaling_enabled: true };
    default: return { playbooks_limit: 2, devotionals_limit: 1, smart_journaling_enabled: true };
  }
}

async function createAppleJWT(): Promise<string | null> {
  const appleKeyId = Deno.env.get('APP_STORE_CONNECT_KEY_ID') || Deno.env.get('APPLE_KEY_ID');
  const appleIssuerId = Deno.env.get('APP_STORE_CONNECT_ISSUER_ID') || Deno.env.get('APPLE_ISSUER_ID');
  const applePrivateKey = Deno.env.get('APP_STORE_CONNECT_PRIVATE_KEY') || Deno.env.get('APPLE_PRIVATE_KEY');

  if (!appleKeyId || !appleIssuerId || !applePrivateKey) {
    console.error('[ExpireSubscriptions] Missing Apple API credentials; Apple-backed rows will be skipped');
    return null;
  }

  const pemContents = applePrivateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  return await create(
    { alg: 'ES256', kid: appleKeyId, typ: 'JWT' },
    {
      iss: appleIssuerId,
      iat: getNumericDate(0),
      exp: getNumericDate(20 * 60),
      aud: 'appstoreconnect-v1',
      bid: Deno.env.get('APPLE_BUNDLE_ID') || 'app.sifia.com',
    },
    cryptoKey
  );
}

async function fetchAppleEntitlement(originalTransactionId: string, jwtToken: string): Promise<AppleEntitlement | null> {
  const endpoints = originalTransactionId.startsWith('2') || originalTransactionId.startsWith('3')
    ? ['https://api.storekit-sandbox.itunes.apple.com', 'https://api.storekit.itunes.apple.com']
    : ['https://api.storekit.itunes.apple.com', 'https://api.storekit-sandbox.itunes.apple.com'];

  for (const endpoint of endpoints) {
    const response = await fetch(
      `${endpoint}/inApps/v1/subscriptions/${originalTransactionId}`,
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 404) {continue;}
    if (!response.ok) {
      throw new Error(`Apple status API returned ${response.status}`);
    }

    const payload = await response.json();
    const lastTransactions = (payload?.data || [])
      .flatMap((group: any) => group.lastTransactions || []) as AppleStatusTransaction[];
    const decoded = lastTransactions
      .map(item => ({
        status: item.status || 0,
        transaction: decodeJWT(item.signedTransactionInfo) as DecodedAppleTransaction | null,
        renewalInfo: (decodeJWT(item.signedRenewalInfo) || {}) as DecodedAppleRenewalInfo,
      }))
      .filter(item => item.transaction?.transactionId) as AppleEntitlement[];

    return decoded.sort((a, b) => (b.transaction.expiresDate || 0) - (a.transaction.expiresDate || 0))[0] || null;
  }

  return null;
}

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const nowIso = now.toISOString();

  const paidSeekerLimits = {
    tier: 'seeker',
    subscription_display_name: 'siFia Seeker',
    playbooks_limit: 2,
    devotionals_limit: 1,
    wisdom_limit: 2,
    refinement_limit: 1,
    playbooks_used: 0,
    devotionals_used: 0,
    wisdom_count: 0,
    refinement_count: 0,
    smart_journaling_enabled: true,
    show_dashboard_counts: true,
    billing_cycle: null,
    billing_issue: false,
    grace_period_end_date: null,
    auto_renew_enabled: false,
    status: 'expired',
    updated_at: nowIso,
  };

  const trialSeekerCooldown = {
    ...paidSeekerLimits,
    playbooks_used: 2,
    devotionals_used: 1,
    wisdom_count: 2,
    refinement_count: 1,
  };

  // For trials: downgrade immediately after trial_end_date
  const trialThreshold = now.toISOString();

  // For paid subscriptions: give 3-day grace period after subscription_end_date
  const gracePeriodDays = 3;
  const paidThreshold = new Date(now);
  paidThreshold.setDate(paidThreshold.getDate() - gracePeriodDays);
  const paidThresholdIso = paidThreshold.toISOString();

  // 1. Downgrade expired free trials unless Apple has an active billing grace period.
  const { data: trialsToExpire, error: trialsError } = await supabase
    .from('user_subscriptions_new')
    .select('user_id, trial_end_date')
    .eq('tier', 'free_trial')
    .lt('trial_end_date', trialThreshold)
    .or(`grace_period_end_date.is.null,grace_period_end_date.lte.${trialThreshold}`);

  if (trialsError) {
    console.error('[ExpireSubscriptions] Failed to expire trials:', trialsError);
  }

  const expiredTrials = [];
  for (const trial of trialsToExpire || []) {
    const usageAnchor = trial.trial_end_date || nowIso;
    const { error: trialUpdateError } = await supabase
      .from('user_subscriptions_new')
      .update({
        ...trialSeekerCooldown,
        last_usage_reset: usageAnchor,
        subscription_end_date: usageAnchor,
      })
      .eq('user_id', trial.user_id);

    if (trialUpdateError) {
      console.error(`[ExpireSubscriptions] Failed to expire trial ${trial.user_id}:`, trialUpdateError);
    } else {
      expiredTrials.push(trial);
    }
  }

  // 2. Downgrade expired paid subscriptions AFTER 3-day grace period.
  // Apple-backed rows are reconciled against Apple first so a missed webhook
  // cannot downgrade a customer whose Apple entitlement is still active.
  const { data: paidToReview, error: paidFindError } = await supabase
    .from('user_subscriptions_new')
    .select('user_id, tier, subscription_end_date, platform_transaction_id, original_transaction_id')
    .not('tier', 'in', '("seeker","free_trial")')
    .not('subscription_end_date', 'is', null)
    .lt('subscription_end_date', paidThresholdIso);

  if (paidFindError) {
    console.error('[ExpireSubscriptions] Failed to find expired paid subs:', paidFindError);
  }

  const needsAppleCheck = (paidToReview || []).some(subscription => subscription.original_transaction_id);
  const appleJwt = needsAppleCheck ? await createAppleJWT() : null;
  const expiredPaid = [];
  const recoveredPaid = [];
  const skippedApple = [];

  for (const subscription of paidToReview || []) {
    if (subscription.original_transaction_id) {
      if (!appleJwt) {
        skippedApple.push(subscription);
        continue;
      }

      try {
        const entitlement = await fetchAppleEntitlement(subscription.original_transaction_id, appleJwt);
        if (!entitlement) {
          console.warn('[ExpireSubscriptions] Apple entitlement not found; expiring local row', {
            userId: subscription.user_id,
            originalTransactionId: subscription.original_transaction_id,
          });
        } else if (entitlement.status === 1 || entitlement.status === 4) {
          const tier = getTierFromProductId(entitlement.transaction.productId);
          const limits = getTierLimits(tier);
          const transactionChanged =
            entitlement.transaction.transactionId &&
            entitlement.transaction.transactionId !== subscription.platform_transaction_id;
          const purchaseDateIso = entitlement.transaction.purchaseDate
            ? new Date(entitlement.transaction.purchaseDate).toISOString()
            : nowIso;
          const effectiveEndDateMillis = Math.max(
            entitlement.transaction.expiresDate || 0,
            entitlement.renewalInfo.gracePeriodExpiresDate || 0
          );
          const updateData: Record<string, any> = {
            tier,
            subscription_display_name: getTierDisplayName(tier),
            billing_cycle: (entitlement.transaction.productId || '').includes('annual') ? 'annual' : 'monthly',
            playbooks_limit: limits.playbooks_limit,
            devotionals_limit: limits.devotionals_limit,
            smart_journaling_enabled: limits.smart_journaling_enabled,
            show_dashboard_counts: true,
            platform_transaction_id: entitlement.transaction.transactionId,
            original_transaction_id: entitlement.transaction.originalTransactionId || subscription.original_transaction_id,
            subscription_end_date: effectiveEndDateMillis
              ? new Date(effectiveEndDateMillis).toISOString()
              : subscription.subscription_end_date,
            billing_issue: entitlement.status === 4,
            grace_period_end_date: entitlement.renewalInfo.gracePeriodExpiresDate
              ? new Date(entitlement.renewalInfo.gracePeriodExpiresDate).toISOString()
              : null,
            auto_renew_enabled: entitlement.renewalInfo.autoRenewStatus !== 0,
            status: 'active',
            updated_at: nowIso,
          };

          if (transactionChanged) {
            updateData.playbooks_used = 0;
            updateData.devotionals_used = 0;
            updateData.last_usage_reset = purchaseDateIso;
            updateData.subscription_start_date = purchaseDateIso;
          }

          const { error: recoverError } = await supabase
            .from('user_subscriptions_new')
            .update(updateData)
            .eq('user_id', subscription.user_id);

          if (recoverError) {
            console.error(`[ExpireSubscriptions] Failed to recover Apple sub ${subscription.user_id}:`, recoverError);
            skippedApple.push(subscription);
          } else {
            recoveredPaid.push(subscription);
          }

          continue;
        } else if (entitlement.status === 3) {
          console.log('[ExpireSubscriptions] Apple reports billing retry; expiring after local grace window', {
            userId: subscription.user_id,
            originalTransactionId: subscription.original_transaction_id,
          });
        }
      } catch (error) {
        console.error(`[ExpireSubscriptions] Apple check failed for ${subscription.user_id}; skipping downgrade`, error);
        skippedApple.push(subscription);
        continue;
      }
    }

    const { error: paidUpdateError } = await supabase
      .from('user_subscriptions_new')
      .update(paidSeekerLimits)
      .eq('user_id', subscription.user_id);

    if (paidUpdateError) {
      console.error(`[ExpireSubscriptions] Failed to expire paid sub ${subscription.user_id}:`, paidUpdateError);
    } else {
      expiredPaid.push(subscription);
    }
  }

  const totalExpired =
    (expiredTrials?.length || 0) + (expiredPaid?.length || 0);

  console.log(`[ExpireSubscriptions] ✅ Downgraded ${totalExpired} users`);
  console.log(`  - Expired trials: ${expiredTrials?.length || 0}`);
  console.log(`  - Expired paid: ${expiredPaid?.length || 0}`);
  console.log(`  - Recovered paid from Apple: ${recoveredPaid.length}`);
  console.log(`  - Skipped Apple-backed paid: ${skippedApple.length}`);

  return new Response(
    JSON.stringify({
      success: true,
      expired_trials: expiredTrials?.length || 0,
      expired_paid: expiredPaid?.length || 0,
      recovered_paid: recoveredPaid.length,
      skipped_apple_paid: skippedApple.length,
      total: totalExpired,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
