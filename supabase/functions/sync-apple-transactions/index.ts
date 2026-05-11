// Automated Apple Transaction History Sync
// Queries Apple's PRODUCTION API to find paid subscriptions and auto-upgrade users
// Solves: Webhook failures leaving paid users stuck on seeker tier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppleTransactionHistoryResponse {
  signedTransactions: string[];
  hasMore: boolean;
  revision: string;
}

interface DecodedTransaction {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate: number;
  expiresDate?: number;
  transactionReason?: string;
  offerType?: number;
  storefront?: string; // ISO 3166-1 alpha-3 country code e.g. "PHL", "USA"
}

function storefrontToLocale(storefront: string | undefined): string | null {
  if (!storefront) { return null; }
  const map: Record<string, string> = {
    PHL: 'en-PH',
    USA: 'en-US',
    GBR: 'en-GB',
    AUS: 'en-AU',
    CAN: 'en-CA',
    SGP: 'en-SG',
    MYS: 'ms-MY',
    IDN: 'id-ID',
    JPN: 'ja-JP',
    KOR: 'ko-KR',
    HKG: 'zh-HK',
    TWN: 'zh-TW',
    CHN: 'zh-CN',
    IND: 'en-IN',
    ARE: 'ar-AE',
    SAU: 'ar-SA',
    DEU: 'de-DE',
    FRA: 'fr-FR',
    ESP: 'es-ES',
    ITA: 'it-IT',
    BRA: 'pt-BR',
    MEX: 'es-MX',
    NLD: 'nl-NL',
    SWE: 'sv-SE',
    NOR: 'nb-NO',
    DNK: 'da-DK',
    FIN: 'fi-FI',
    POL: 'pl-PL',
    RUS: 'ru-RU',
    TUR: 'tr-TR',
    ZAF: 'en-ZA',
    NGA: 'en-NG',
    GHA: 'en-GH',
    KEN: 'en-KE',
  };
  return map[storefront.toUpperCase()] ?? `en-${storefront.toUpperCase().slice(0, 2)}`;
}

interface ValidatedReceiptRow {
  user_id: string;
  transaction_id: string | null;
  product_id: string | null;
  validated_at: string;
  validation_response?: {
    originalTransactionId?: string;
    transactionId?: string;
    productId?: string;
  } | null;
}

function decodeJWT(token: string): DecodedTransaction | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {return null;}
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch (error) {
    console.error('[SyncApple] Failed to decode JWT:', error);
    return null;
  }
}

function getTierFromProductId(productId: string): string {
  const isAnnual = productId.includes('annual');
  if (productId.includes('spark')) {return isAnnual ? 'spark_annual' : 'spark';}
  if (productId.includes('growth')) {return isAnnual ? 'growth_annual' : 'growth';}
  if (productId.includes('transformation')) {return isAnnual ? 'transformation_annual' : 'transformation';}
  return 'spark';
}

function getTierLimits(tier: string): { playbooks_limit: number; devotionals_limit: number; smart_journaling_enabled: boolean } {
  const baseTier = tier.replace('_annual', '');
  switch (baseTier) {
    case 'spark': return { playbooks_limit: 10, devotionals_limit: 10, smart_journaling_enabled: true };
    case 'growth': return { playbooks_limit: 25, devotionals_limit: 25, smart_journaling_enabled: true };
    case 'transformation': return { playbooks_limit: 60, devotionals_limit: 60, smart_journaling_enabled: true };
    default: return { playbooks_limit: 2, devotionals_limit: 1, smart_journaling_enabled: false };
  }
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[SyncApple] Starting Apple Transaction History sync...');

    // Get Apple credentials
    const appleKeyId = Deno.env.get('APPLE_KEY_ID');
    const appleIssuerId = Deno.env.get('APPLE_ISSUER_ID');
    const applePrivateKey = Deno.env.get('APPLE_PRIVATE_KEY');

    if (!appleKeyId || !appleIssuerId || !applePrivateKey) {
      throw new Error('Missing Apple API credentials. Set APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY in environment.');
    }

    // Find ALL users with receipts from validated_receipts table
    // This is the source of truth for what Apple sent us
    const { data: receipts, error: findError } = await supabaseClient
      .from('validated_receipts')
      .select('user_id, transaction_id, product_id, validated_at, validation_response')
      .eq('is_valid', true)
      .order('validated_at', { ascending: false });

    if (findError) {
      console.error('[SyncApple] Error finding receipts:', findError);
      return new Response(
        JSON.stringify({ success: false, error: findError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!receipts || receipts.length === 0) {
      console.log('[SyncApple] No receipts found');
      return new Response(
        JSON.stringify({ success: true, checked: 0, message: 'No receipts to check' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch current subscription status for all users to avoid overwriting cancelled/expired ones
    const userIds = [...new Set((receipts as ValidatedReceiptRow[]).map(r => r.user_id))];
    const { data: subscriptions } = await supabaseClient
      .from('user_subscriptions_new')
      .select('user_id, tier, status, cancellation_date, subscription_end_date, auto_renew_enabled')
      .in('user_id', userIds);

    const subMap = new Map((subscriptions || []).map((s: any) => [s.user_id, s]));

    // Group receipts by user and get their original transaction IDs
    const userTransactions = new Map();
    for (const receipt of receipts as ValidatedReceiptRow[]) {
      const originalTransactionId =
        receipt.validation_response?.originalTransactionId ||
        receipt.validation_response?.transactionId ||
        receipt.transaction_id;

      if (!originalTransactionId) {
        console.log(`[SyncApple] Skipping receipt without transaction ID for user ${receipt.user_id}`);
        continue;
      }

      const sub = subMap.get(receipt.user_id);

      // Skip users who cancelled and are already expired — nothing to recover
      if (
        sub?.cancellation_date &&
        sub?.subscription_end_date &&
        new Date(sub.subscription_end_date) < new Date()
      ) {
        console.log(`[SyncApple] Skipping cancelled+expired user ${receipt.user_id}`);
        continue;
      }

      if (!userTransactions.has(receipt.user_id)) {
        userTransactions.set(receipt.user_id, {
          user_id: receipt.user_id,
          original_transaction_id: originalTransactionId,
          tier: sub?.tier,
          receipts: [],
        });
      }
      userTransactions.get(receipt.user_id).receipts.push(receipt);
    }

    const suspiciousUsers = Array.from(userTransactions.values());

    if (!suspiciousUsers || suspiciousUsers.length === 0) {
      console.log('[SyncApple] No suspicious users found - all synced');
      return new Response(
        JSON.stringify({
          success: true,
          checked: 0,
          upgraded: 0,
          message: 'No users need syncing',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SyncApple] Found ${suspiciousUsers.length} users to check with Apple`);

    const results = [];

    // Check each user with Apple's Transaction History API
    for (const user of suspiciousUsers) {
      const originalTxnId = user.original_transaction_id;

      console.log(`[SyncApple] Checking user ${user.user_id}, originalTxnId: ${originalTxnId}`);

      try {
        // Generate JWT token for Apple API using ES256
        // Convert PEM private key to CryptoKey
        const pemHeader = '-----BEGIN PRIVATE KEY-----';
        const pemFooter = '-----END PRIVATE KEY-----';
        const pemContents = applePrivateKey
          .replace(pemHeader, '')
          .replace(pemFooter, '')
          .replace(/\s/g, '');

        const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

        const cryptoKey = await crypto.subtle.importKey(
          'pkcs8',
          binaryKey,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['sign']
        );

        // Create JWT token for Apple App Store Connect API
        const jwtToken = await create(
          { alg: 'ES256', kid: appleKeyId, typ: 'JWT' },
          {
            iss: appleIssuerId,
            iat: getNumericDate(0),
            exp: getNumericDate(60 * 60), // 1 hour
            aud: 'appstoreconnect-v1',
            bid: 'app.sifia.com', // Bundle ID
          },
          cryptoKey
        );

        // Determine environment (sandbox vs production)
        const isSandbox = originalTxnId.startsWith('2') || originalTxnId.startsWith('3');
        const apiEndpoint = isSandbox
          ? 'https://api.storekit-sandbox.itunes.apple.com'
          : 'https://api.storekit.itunes.apple.com';

        console.log(`[SyncApple] Querying ${isSandbox ? 'SANDBOX' : 'PRODUCTION'} API for user ${user.user_id}`);

        // Query Apple Transaction History API
        const response = await fetch(
          `${apiEndpoint}/inApps/v1/history/${originalTxnId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${jwtToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          console.error(`[SyncApple] Apple API error for user ${user.user_id}:`, response.status);
          results.push({
            user_id: user.user_id,
            success: false,
            error: `Apple API returned ${response.status}`,
          });
          continue;
        }

        const data: AppleTransactionHistoryResponse = await response.json();

        if (!data.signedTransactions || data.signedTransactions.length === 0) {
          console.log(`[SyncApple] No transactions found for user ${user.user_id}`);
          results.push({
            user_id: user.user_id,
            success: true,
            action: 'no_transactions',
            message: 'No Apple transactions found - trial expired without payment',
          });
          continue;
        }

        // Decode transactions
        const transactions = data.signedTransactions
          .map(token => decodeJWT(token))
          .filter(t => t !== null) as DecodedTransaction[];

        const nowMs = Date.now();

        // All live StoreKit products may carry the ".freetrial" suffix. Do not use the
        // product ID to decide whether money was collected. Apple's offerType=1 marks
        // the introductory/free-trial transaction; later renewals or direct paid buys
        // generally have no trial offerType.
        const paidTransactions = transactions.filter(t =>
          t.productId &&
          t.offerType !== 1 &&
          (!t.expiresDate || t.expiresDate > nowMs)
        );

        if (paidTransactions.length === 0) {
          console.log(`[SyncApple] User ${user.user_id} only has trial transactions - not paid`);
          results.push({
            user_id: user.user_id,
            success: true,
            action: 'no_payment',
            message: 'Only trial transactions - user did not pay',
          });
          continue;
        }

        // User HAS paid! Get latest paid transaction
        const latestPaid = paidTransactions.sort((a, b) => b.purchaseDate - a.purchaseDate)[0];

        console.log(`[SyncApple] 🎉 User ${user.user_id} HAS PAID! Product: ${latestPaid.productId}`);

        // Extract tier and billing cycle
        const tier = getTierFromProductId(latestPaid.productId);
        const limits = getTierLimits(tier);
        const billingCycle = latestPaid.productId.includes('annual') ? 'annual' : 'monthly';

        // Calculate subscription_end_date — prefer Apple's actual expiresDate
        const now = new Date();
        let subscriptionEndDate: Date;
        if (latestPaid.expiresDate) {
          subscriptionEndDate = new Date(latestPaid.expiresDate);
        } else {
          subscriptionEndDate = new Date(now);
          if (billingCycle === 'annual') {
            subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
          } else {
            subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);
          }
        }

        // Upgrade user to paid tier
        const { error: updateError } = await supabaseClient
          .from('user_subscriptions_new')
          .update({
            tier,
            subscription_display_name: getTierDisplayName(tier),
            status: 'active',
            billing_cycle: billingCycle,
            playbooks_limit: limits.playbooks_limit,
            devotionals_limit: limits.devotionals_limit,
            playbooks_used: 0,
            devotionals_used: 0,
            smart_journaling_enabled: limits.smart_journaling_enabled,
            subscription_start_date: new Date(latestPaid.purchaseDate).toISOString(),
            subscription_end_date: subscriptionEndDate.toISOString(),
            trial_converted_date: new Date(latestPaid.purchaseDate).toISOString(),
            platform_transaction_id: latestPaid.transactionId,
            original_transaction_id: latestPaid.originalTransactionId,
            billing_issue: false,
            grace_period_end_date: null,
            auto_renew_enabled: true,
            updated_at: now.toISOString(),
          })
          .eq('user_id', user.user_id);

        if (updateError) {
          console.error(`[SyncApple] Failed to upgrade user ${user.user_id}:`, updateError);
          results.push({
            user_id: user.user_id,
            success: false,
            error: updateError.message,
          });
        } else {
          console.log(`[SyncApple] ✅ Successfully upgraded user ${user.user_id} to ${tier}`);

          // Save locale from Apple storefront so market detection works in admin dashboard
          const locale = storefrontToLocale(latestPaid.storefront);
          if (locale) {
            await supabaseClient
              .from('user_profiles')
              .update({ locale })
              .eq('id', user.user_id);
            console.log(`[SyncApple] 🌍 Set locale ${locale} for user ${user.user_id} (storefront: ${latestPaid.storefront})`);
          }

          results.push({
            user_id: user.user_id,
            success: true,
            action: 'upgraded',
            from_tier: user.tier,
            to_tier: tier,
            product_id: latestPaid.productId,
            billing_cycle: billingCycle,
            storefront: latestPaid.storefront ?? null,
            locale: locale ?? null,
          });
        }

      } catch (error) {
        console.error(`[SyncApple] Error processing user ${user.user_id}:`, error);
        results.push({
          user_id: user.user_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const upgraded = results.filter(r => r.action === 'upgraded').length;
    const checked = results.length;

    console.log(`[SyncApple] Sync complete: checked ${checked}, upgraded ${upgraded}`);

    return new Response(
      JSON.stringify({
        success: true,
        checked,
        upgraded,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SyncApple] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
