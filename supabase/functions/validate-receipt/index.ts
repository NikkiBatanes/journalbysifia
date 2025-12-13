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
  isEligibleForTrial?: boolean;
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

interface CreateTrialParams {
  supabase: SupabaseClient;
  userId: string;
  chosenTier: string;
  platformSubscriptionId: string;
  transactionId: string;
  billingCycle?: 'monthly' | 'annual';
}

interface CreateTrialResult {
  success: boolean;
  tier: 'free_trial';
  chosenTier: string;
  trialEndDate: string;
  error?: string;
}

// Create trial function
async function createTrial(params: CreateTrialParams): Promise<CreateTrialResult> {
  try {
    const { supabase, userId, chosenTier, platformSubscriptionId, transactionId, billingCycle } = params;
    
    // Calculate trial end date (3 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 3);
    const trialEndDateIso = trialEndDate.toISOString();
    
    // Create trial subscription
    const { data, error } = await supabase
      .from('user_subscriptions_new')
      .upsert({
        user_id: userId,
        tier: 'free_trial',
        trial_chosen_tier: chosenTier,
        trial_start_date: new Date().toISOString(),
        trial_end_date: trialEndDateIso,
        platform_subscription_id: platformSubscriptionId,
        platform_transaction_id: transactionId,
        billing_cycle: billingCycle || 'monthly',
        auto_renew_enabled: true,
        status: 'active',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();
    
    if (error) {
      console.error('[createTrial] Database error:', error);
      return {
        success: false,
        tier: 'free_trial',
        chosenTier,
        trialEndDate: trialEndDateIso,
        error: error.message
      };
    }
    
    console.log('[createTrial] Trial created successfully:', data);
    return {
      success: true,
      tier: 'free_trial',
      chosenTier,
      trialEndDate: trialEndDateIso
    };
  } catch (error) {
    console.error('[createTrial] Error:', error);
    return {
      success: false,
      tier: 'free_trial',
      chosenTier: params.chosenTier,
      trialEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      error: error.message
    };
  }
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
    const { receiptData, userId, platform, productId, isEligibleForTrial }: ValidateReceiptRequest = await req.json();

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
      
      // CRITICAL: Use eligibility to distinguish between NEW TRIAL and PAID UPGRADE
      // - seeker + .freetrial + ELIGIBLE = NEW TRIAL → Skip (createTrial handles it)
      // - seeker + .freetrial + NOT ELIGIBLE = PAID PURCHASE → Process (no trial available)
      // - free_trial + .freetrial = TRIAL UPGRADE → Process (convert to paid immediately)
      // Only paid tiers + .freetrial = TIER UPGRADE → Process
      if (currentTier === 'seeker' || currentTier === 'free_trial') {
        const targetTier = mapProductIdToTier(validationResult.data?.productId || '');
        
        if (currentTier === 'seeker' && isEligibleForTrial === false) {
          // PAID PURCHASE: User not eligible for trial, process paid tier update
          console.log('[ValidateReceipt] PAID PURCHASE detected - processing subscription update', {
            currentTier,
            productId: validationResult.data?.productId,
            isEligibleForTrial,
            reason: 'User not eligible for trial - processing paid subscription'
          });
          await updateUserSubscription(supabase, userId, validationResult.data);
          console.log('[ValidateReceipt] Paid subscription activated successfully');
        } else if (currentTier === 'free_trial') {
          // TRIAL UPGRADE: User already on trial purchasing new tier - convert immediately
          console.log('[ValidateReceipt] TRIAL UPGRADE detected - processing immediate conversion', {
            currentTier,
            productId: validationResult.data?.productId,
            targetTier,
            isEligibleForTrial,
            reason: 'User on trial purchasing new tier - convert to paid immediately'
          });
          await updateUserSubscription(supabase, userId, validationResult.data);
          console.log('[ValidateReceipt] Trial upgraded to paid subscription successfully');
        } else {
          // NEW TRIAL: Eligible user starting trial - create trial now
          console.log('[ValidateReceipt] NEW TRIAL detected - creating trial', {
            currentTier,
            productId: validationResult.data?.productId,
            isEligibleForTrial,
            reason: 'New trial - creating now'
          });
          
          // Create the trial subscription
          const trialResult = await createTrial({
            supabase,
            userId,
            chosenTier: targetTier,
            platformSubscriptionId: validationResult.data?.subscriptionId || '',
            transactionId: validationResult.data?.transactionId || '',
            billingCycle: validationResult.data?.billingCycle as 'monthly' | 'annual' | undefined
          });
          
          if (!trialResult.success) {
            console.error('[ValidateReceipt] Trial creation failed:', trialResult.error);
            throw new Error(`Trial creation failed: ${trialResult.error}`);
          }
          
          console.log('[ValidateReceipt] Trial created successfully:', {
            tier: trialResult.tier,
            chosenTier: trialResult.chosenTier,
            trialEndDate: trialResult.trialEndDate
          });
        }
      } else {
        // TIER UPGRADE: User on paid tier purchasing .freetrial product (tier upgrade)
        console.log('[ValidateReceipt] TIER UPGRADE detected - processing subscription update', {
          currentTier,
          productId: validationResult.data?.productId,
          reason: 'Paid tier upgrade'
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

  // Extract subscription info - find the MOST RECENT transaction
  const receipts = response.latest_receipt_info || response.receipt?.in_app || [];
  
  if (receipts.length === 0) {
    return {
      success: false,
      error: 'No subscription info found in receipt',
    };
  }
  
  // Sort by purchase_date_ms descending to get the most recent transaction
  const latestReceipt = receipts.sort((a, b) => {
    const aTime = parseInt(a.purchase_date_ms || '0');
    const bTime = parseInt(b.purchase_date_ms || '0');
    return bTime - aTime; // Descending order (newest first)
  })[0];
  
  console.log('[ValidateReceipt] Selected most recent transaction:', {
    productId: latestReceipt.product_id,
    purchaseDate: latestReceipt.purchase_date,
    transactionId: latestReceipt.transaction_id?.substring(0, 10) + '...',
    totalTransactions: receipts.length,
  });

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

    // Check if this is a trial-to-paid conversion
    const isTrialConversion = existingSub?.tier === 'free_trial' && tier !== 'free_trial';
    
    // Prepare subscription data - clear limit columns so they get recalculated from tier
    const subscriptionData: any = {
      user_id: userId,
      tier: tier,
      status: 'active',
      subscription_end_date: validationData.expiresAt?.toISOString(),
      subscription_start_date: isTrialConversion ? new Date().toISOString() : (existingSub?.subscription_start_date || new Date().toISOString()),
      platform: 'apple',
      platform_subscription_id: validationData.transactionId,
      platform_transaction_id: validationData.transactionId,
      subscription_display_name: getTierDisplayName(tier),
      billing_cycle: tier.includes('_annual') ? 'annual' : 'monthly',
      trial_start_date: null, // Clear trial dates when converting to paid
      trial_end_date: null,
      trial_chosen_tier: null,
      updated_at: new Date().toISOString(),
    };
    
    // CRITICAL: Set limit columns to NULL if they exist in database
    // This forces enrichSubscriptionData to recalculate from tier instead of using stale values
    if (existingSub?.playbooks_limit !== undefined) {
      subscriptionData.playbooks_limit = null;
    }
    if (existingSub?.devotionals_limit !== undefined) {
      subscriptionData.devotionals_limit = null;
    }
    if (existingSub?.smart_journaling_enabled !== undefined) {
      subscriptionData.smart_journaling_enabled = null;
    }
    if (existingSub?.show_dashboard_counts !== undefined) {
      subscriptionData.show_dashboard_counts = null;
    }

    if (existingSub) {
      // Reset usage counters when upgrading from trial to paid
      const updateData = isTrialConversion 
        ? { ...subscriptionData, playbooks_used: 0, devotionals_used: 0 }
        : subscriptionData;
        
      const { error: updateError } = await supabaseClient
        .from('user_subscriptions_new')
        .update(updateData)
        .eq('user_id', userId);
      
      if (updateError) {
        console.error('[ValidateReceipt] Database update failed:', updateError);
        throw new Error(`Failed to update subscription: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabaseClient
        .from('user_subscriptions_new')
        .insert({
          ...subscriptionData,
          created_at: new Date().toISOString(),
          playbooks_used: 0,
          devotionals_used: 0,
        });
      
      if (insertError) {
        console.error('[ValidateReceipt] Database insert failed:', insertError);
        throw new Error(`Failed to insert subscription: ${insertError.message}`);
      }
    }

    console.log('[ValidateReceipt] Subscription updated:', { 
      tier, 
      isTrial: false, 
      productId: validationData.productId,
      wasTrialConversion: isTrialConversion 
    });
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
function _getTierLimits(tier: string): {
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
