/**
 * Supabase Edge Function: Validate Apple/Google Receipt
 * Enterprise-grade server-side receipt validation
 * 
 * NOTE: This file runs in Deno runtime on Supabase Edge Functions.
 * TypeScript errors about Deno and HTTP imports are expected in IDE but are valid in Deno.
 */

// @ts-nocheck - This is a Deno edge function, not Node.js TypeScript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  receipt?: any;
  latest_receipt_info?: any[];
  pending_renewal_info?: any[];
  environment?: string;
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

    console.log('[ValidateReceipt] Request:', { userId, platform, productId });

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

    // Store validated receipt in database
    const { data: receiptRecord, error: dbError } = await supabase
      .from('validated_receipts')
      .insert({
        user_id: userId,
        platform,
        receipt_data: receiptData,
        validation_response: validationResult.data,
        product_id: productId || validationResult.data?.productId,
        transaction_id: validationResult.data?.transactionId,
        expires_at: validationResult.data?.expiresAt,
        is_valid: true,
        validated_at: new Date().toISOString(),
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

    // Update user subscription status
    await updateUserSubscription(supabase, userId, validationResult.data);

    console.log('[ValidateReceipt] Success:', { userId, transactionId: validationResult.data?.transactionId });

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
async function validateAppleReceipt(receiptData: string): Promise<any> {
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

  const body: any = {
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

  return await response.json();
}

/**
 * Validate Google Play receipt
 */
async function validateGoogleReceipt(_receiptData: string): Promise<any> {
  // TODO: Implement Google Play validation
  // Requires Google Play Developer API setup
  console.log('[ValidateReceipt] Google Play validation not yet implemented');

  return {
    success: false,
    error: 'Google Play validation not yet implemented',
  };
}

/**
 * Update user subscription in database
 */
async function updateUserSubscription(supabase: any, userId: string, validationData: any): Promise<void> {
  try {
    // Get or create subscription
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    const subscriptionData = {
      user_id: userId,
      tier: mapProductIdToTier(validationData.productId),
      status: 'active',
      current_period_end: validationData.expiresAt,
      platform: 'ios',
      transaction_id: validationData.transactionId,
      product_id: validationData.productId,
      is_trial: validationData.isTrialPeriod,
      updated_at: new Date().toISOString(),
    };

    if (existingSub) {
      await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('id', existingSub.id);
    } else {
      await supabase
        .from('subscriptions')
        .insert({
          ...subscriptionData,
          created_at: new Date().toISOString(),
        });
    }

    console.log('[ValidateReceipt] Subscription updated for user:', userId);
  } catch (error) {
    console.error('[ValidateReceipt] Failed to update subscription:', error);
    throw error;
  }
}

/**
 * Map product ID to subscription tier
 */
function mapProductIdToTier(productId: string): string {
  if (productId.includes('spark')) {return 'spark';}
  if (productId.includes('growth')) {return 'growth';}
  if (productId.includes('transformation')) {return 'transformation';}
  if (productId.includes('family')) {return 'family';}
  return 'seeker';
}
