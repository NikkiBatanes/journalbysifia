/**
 * Supabase Edge Function: Validate Apple/Google Receipt
 * Enterprise-grade server-side receipt validation
 * 
 * NOTE: This file runs in Deno runtime on Supabase Edge Functions.
 * TypeScript errors about Deno and HTTP imports are expected in IDE but are valid in Deno.
 */

// @ts-nocheck - This is a Deno edge function, not Node.js TypeScript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateReceiptRequest {
  receiptData: string;
  userId: string;
  platform: 'ios' | 'android';
  productId?: string;
}

interface AppleReceiptResponse {
  status: number;
  receipt?: AppleReceipt;
  latest_receipt_info?: AppleReceiptInfo[];
  pending_renewal_info?: PendingRenewalInfo[];
  environment?: string;
}

interface AppleReceipt {
  bundle_id?: string;
  application_version?: string;
  original_application_version?: string;
  in_app?: AppleReceiptInfo[];
}

interface AppleReceiptInfo {
  quantity?: string;
  product_id?: string;
  transaction_id?: string;
  original_transaction_id?: string;
  purchase_date?: string;
  purchase_date_ms?: string;
  original_purchase_date?: string;
  original_purchase_date_ms?: string;
  expires_date?: string;
  expires_date_ms?: string;
  web_order_line_item_id?: string;
  is_trial_period?: string;
  is_in_intro_offer_period?: string;
  in_app_ownership_type?: string;
}

interface PendingRenewalInfo {
  auto_renew_product_id?: string;
  original_transaction_id?: string;
  product_id?: string;
}

interface ValidationResult {
  success: boolean;
  data?: ValidationData;
  error?: string;
  statusCode?: number;
}

interface ValidationData {
  transactionId: string;
  productId: string;
  purchaseDate: Date | null;
  expiresAt: Date | null;
  isTrialPeriod: boolean;
  environment: string;
  rawResponse: AppleReceiptResponse;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request
    const { receiptData, userId, platform, productId }: ValidateReceiptRequest = await req.json();

    console.log('[ValidateReceipt] Request:', { platform, productId });

    // Validate input
    if (!receiptData || !userId || !platform) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: receiptData, userId, platform',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let validationResult;

    if (platform === 'ios') {
      validationResult = await validateAppleReceipt(receiptData);
    } else if (platform === 'android') {
      validationResult = await validateGoogleReceipt(receiptData);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid platform' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check validation status
    if (!validationResult.success) {
      console.error('[ValidateReceipt] Validation failed:', validationResult.error);
      return new Response(
        JSON.stringify(validationResult),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store validated receipt in database for audit trail
    // Use upsert to handle upgrades/renewals where transaction_id may already exist
    const { data: receiptRecord, error: dbError } = await supabase
      .from('validated_receipts')
      .upsert({
        user_id: userId,
        platform,
        receipt_data: receiptData,
        validation_response: validationResult.data,
        product_id: productId || validationResult.data?.productId,
        transaction_id: validationResult.data?.transactionId,
        expires_at: validationResult.data?.expiresAt?.toISOString(),
        is_valid: true,
        validated_at: new Date().toISOString(),
      }, {
        onConflict: 'transaction_id' // Update existing record if transaction_id already exists
      })
      .select()
      .single();

    if (dbError) {
      console.error('[ValidateReceipt] Database error:', dbError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to store receipt', details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Determine if this is a NEW TRIAL START or a PAID UPGRADE
    // All products have .freetrial suffix in App Store Connect
    // Logic: Check user's current tier to decide whether to skip or process
    const isTrialProduct = (productId || validationResult.data?.productId || '').includes('freetrial');
    
    if (isTrialProduct) {
      // Get user's current subscription tier
      const { data: currentSub } = await supabase
        .from('user_subscriptions_new')
        .select('tier')
        .eq('user_id', userId)
        .single();
      
      const currentTier = currentSub?.tier || 'seeker';
      
      // NEW TRIAL: User on 'seeker' tier purchasing .freetrial product
      // Skip update - let startFreeTrial() in app handle it
      if (currentTier === 'seeker') {
        console.log('[ValidateReceipt] NEW TRIAL detected - skipping update (will be handled by startFreeTrial())', {
          currentTier,
          productId: validationResult.data?.productId
        });
      } else {
        // PAID UPGRADE: User on 'free_trial' or paid tier purchasing .freetrial product
        // User will be charged by Apple - process the upgrade
        console.log('[ValidateReceipt] PAID UPGRADE detected - processing subscription update', {
          currentTier,
          productId: validationResult.data?.productId,
          reason: currentTier === 'free_trial' ? 'Trial to Paid upgrade' : 'Tier upgrade'
        });
        await updateUserSubscription(supabase, userId, validationResult.data);
        console.log('[ValidateReceipt] Subscription upgraded successfully');
      }
    } else {
      // Regular non-trial product (if they exist in the future)
      await updateUserSubscription(supabase, userId, validationResult.data);
      console.log('[ValidateReceipt] Subscription updated for non-trial product');
    }

    console.log('[ValidateReceipt] Success for platform:', platform);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          receiptId: receiptRecord.id,
          transactionId: validationResult.data?.transactionId,
          expiresAt: validationResult.data?.expiresAt,
          productId: validationResult.data?.productId,
          isValid: true,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ValidateReceipt] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Validate Apple receipt with Apple servers
 */
async function validateAppleReceipt(receiptData: string): Promise<ValidationResult> {
  const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET');

  // Try production first
  let response = await callAppleVerifyReceipt(receiptData, sharedSecret, false);

  // If production returns sandbox receipt, try sandbox
  if (response.status === 21007) {
    console.log('[ValidateReceipt] Sandbox receipt detected, trying sandbox endpoint');
    response = await callAppleVerifyReceipt(receiptData, sharedSecret, true);
  }

  // Check status
  if (response.status !== 0) {
    return {
      success: false,
      error: `Apple validation failed with status ${response.status}`,
      statusCode: response.status,
    };
  }

  // Extract subscription info
  const latestReceipt = response.latest_receipt_info?.[0] || response.receipt?.in_app?.[0];

  if (!latestReceipt) {
    return {
      success: false,
      error: 'No subscription info found in receipt',
    };
  }

  return {
    success: true,
    data: {
      transactionId: latestReceipt.transaction_id || latestReceipt.original_transaction_id,
      productId: latestReceipt.product_id,
      purchaseDate: latestReceipt.purchase_date_ms ? new Date(parseInt(latestReceipt.purchase_date_ms)) : null,
      expiresAt: latestReceipt.expires_date_ms ? new Date(parseInt(latestReceipt.expires_date_ms)) : null,
      isTrialPeriod: latestReceipt.is_trial_period === 'true',
      environment: response.environment,
      rawResponse: response,
    },
  };
}

/**
 * Call Apple's verifyReceipt API
 */
async function callAppleVerifyReceipt(
  receiptData: string,
  sharedSecret: string | undefined,
  isSandbox: boolean
): Promise<AppleReceiptResponse> {
  const endpoint = isSandbox
    ? 'https://sandbox.itunes.apple.com/verifyReceipt'
    : 'https://buy.itunes.apple.com/verifyReceipt';

  const body: Record<string, string | boolean> = {
    'receipt-data': receiptData,
    'exclude-old-transactions': true,
  };

  if (sharedSecret) {
    body.password = sharedSecret;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return await response.json() as AppleReceiptResponse;
}

/**
 * Validate Google Play receipt
 */
function validateGoogleReceipt(_receiptData: string): Promise<ValidationResult> {
  // TODO: Implement Google Play validation
  // Requires Google Play Developer API setup
  console.log('[ValidateReceipt] Google Play validation not yet implemented');

  return Promise.resolve({
    success: false,
    error: 'Google Play validation not yet implemented',
  });
}

/**
 * Update user subscription in database
 */
async function updateUserSubscription(
  supabaseClient: SupabaseClient, 
  userId: string, 
  validationData: ValidationData
): Promise<void> {
  try {
    // Get existing subscription from the correct table
    const { data: existingSub } = await supabaseClient
      .from('user_subscriptions_new')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Map product ID to subscription tier
    const tier = mapProductIdToTier(validationData.productId);
    
    // Get tier limits
    const tierLimits = getTierLimits(tier);

    const subscriptionData = {
      user_id: userId,
      tier: tier,
      status: 'active',
      subscription_end_date: validationData.expiresAt?.toISOString(),
      platform: 'apple',
      platform_subscription_id: validationData.transactionId,
      platform_transaction_id: validationData.transactionId,
      subscription_display_name: getTierDisplayName(tier),
      playbooks_limit: tierLimits.playbooks_limit,
      devotionals_limit: tierLimits.devotionals_limit,
      smart_journaling_enabled: tierLimits.smart_journaling_enabled,
      show_dashboard_counts: tierLimits.show_dashboard_counts,
      is_trial: validationData.isTrialPeriod,
      trial_start_date: validationData.isTrialPeriod ? new Date().toISOString() : null,
      trial_end_date: validationData.isTrialPeriod ? validationData.expiresAt?.toISOString() : null,
      trial_chosen_tier: validationData.isTrialPeriod ? tier : null,
      updated_at: new Date().toISOString(),
    };

    if (existingSub) {
      await supabaseClient
        .from('user_subscriptions_new')
        .update(subscriptionData)
        .eq('user_id', userId);
    } else {
      await supabaseClient
        .from('user_subscriptions_new')
        .insert({
          ...subscriptionData,
          created_at: new Date().toISOString(),
          playbooks_used: 0,
          devotionals_used: 0,
        });
    }

    console.log('[ValidateReceipt] Subscription updated:', { tier, isTrial: validationData.isTrialPeriod });
  } catch (error) {
    console.error('[ValidateReceipt] Failed to update subscription:', error);
    throw error;
  }
}

/**
 * Map product ID to subscription tier
 */
function mapProductIdToTier(productId: string): string {
  const isAnnual = productId.includes('annual');
  if (productId.includes('spark')) {return isAnnual ? 'spark_annual' : 'spark';}
  if (productId.includes('growth')) {return isAnnual ? 'growth_annual' : 'growth';}
  if (productId.includes('transformation')) {return isAnnual ? 'transformation_annual' : 'transformation';}
  if (productId.includes('family')) {return isAnnual ? 'family_annual' : 'family';}
  return 'seeker';
}

/**
 * Get tier limits for subscription
 */
function getTierLimits(tier: string): {
  playbooks_limit: number;
  devotionals_limit: number;
  smart_journaling_enabled: boolean;
  show_dashboard_counts: boolean;
} {
  switch (tier) {
    case 'seeker':
      return {
        playbooks_limit: 0,
        devotionals_limit: 0,
        smart_journaling_enabled: false,
        show_dashboard_counts: true,
      };
    case 'free_trial':
      return {
        playbooks_limit: 2,
        devotionals_limit: 2,
        smart_journaling_enabled: true,
        show_dashboard_counts: true,
      };
    case 'spark':
    case 'spark_annual':
      return {
        playbooks_limit: 8,
        devotionals_limit: 8,
        smart_journaling_enabled: true,
        show_dashboard_counts: true,
      };
    case 'growth':
    case 'growth_annual':
      return {
        playbooks_limit: 20,
        devotionals_limit: 20,
        smart_journaling_enabled: true,
        show_dashboard_counts: true,
      };
    case 'transformation':
    case 'transformation_annual':
      return {
        playbooks_limit: 999999,
        devotionals_limit: 999999,
        smart_journaling_enabled: true,
        show_dashboard_counts: false,
      };
    case 'family':
      return {
        playbooks_limit: 999999,
        devotionals_limit: 999999,
        smart_journaling_enabled: true,
        show_dashboard_counts: false,
      };
    default:
      return {
        playbooks_limit: 0,
        devotionals_limit: 0,
        smart_journaling_enabled: false,
        show_dashboard_counts: true,
      };
  }
}

/**
 * Get display name for tier
 */
function getTierDisplayName(tier: string): string {
  switch (tier) {
    case 'seeker': return 'siFia Seeker';
    case 'free_trial': return 'siFia Free Trial';
    case 'spark': return 'siFia Spark';
    case 'growth': return 'siFia Growth';
    case 'transformation': return 'siFia Transformation';
    case 'family': return 'siFia Family';
    default: return 'siFia';
  }
}
