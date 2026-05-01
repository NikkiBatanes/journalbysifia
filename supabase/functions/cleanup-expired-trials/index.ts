// Backup mechanism: Cleanup expired trials when webhook fails
// Runs on schedule or can be called manually
// This ensures users stuck in expired trials are automatically reverted to seeker

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getTierLimits(tier: string): { playbooks_limit: number; devotionals_limit: number; smart_journaling_enabled: boolean } {
  switch (tier) {
    case 'seeker':
      return { playbooks_limit: 2, devotionals_limit: 1, smart_journaling_enabled: false };
    default:
      return { playbooks_limit: 2, devotionals_limit: 1, smart_journaling_enabled: false };
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

    console.log('[CleanupExpiredTrials] Starting cleanup...');

    // Find all expired trials (trial_end_date < NOW and still on free_trial)
    const { data: expiredTrials, error: findError } = await supabaseClient
      .from('user_subscriptions_new')
      .select('*')
      .eq('tier', 'free_trial')
      .lt('trial_end_date', new Date().toISOString());

    if (findError) {
      console.error('[CleanupExpiredTrials] Error finding expired trials:', findError);
      return new Response(
        JSON.stringify({ success: false, error: findError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!expiredTrials || expiredTrials.length === 0) {
      console.log('[CleanupExpiredTrials] No expired trials found');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No expired trials found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CleanupExpiredTrials] Found ${expiredTrials.length} expired trials to process`);

    const seekerLimits = getTierLimits('seeker');
    const results = [];

    for (const trial of expiredTrials) {
      console.log(`[CleanupExpiredTrials] Processing user ${trial.user_id}, trial ended: ${trial.trial_end_date}`);

      // Revert to seeker
      const { error: updateError } = await supabaseClient
        .from('user_subscriptions_new')
        .update({
          tier: 'seeker',
          subscription_display_name: 'siFia Seeker',
          playbooks_limit: seekerLimits.playbooks_limit,
          devotionals_limit: seekerLimits.devotionals_limit,
          playbooks_used: 0,
          devotionals_used: 0,
          smart_journaling_enabled: seekerLimits.smart_journaling_enabled,
          show_dashboard_counts: true,
          billing_cycle: null,
          billing_issue: false,
          grace_period_end_date: null,
          subscription_end_date: new Date().toISOString(),
          auto_renew_enabled: false,
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', trial.user_id);

      if (updateError) {
        console.error(`[CleanupExpiredTrials] Failed to revert user ${trial.user_id}:`, updateError);
        results.push({ user_id: trial.user_id, success: false, error: updateError.message });
      } else {
        console.log(`[CleanupExpiredTrials] ✅ Reverted user ${trial.user_id} to seeker`);
        results.push({ user_id: trial.user_id, success: true });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[CleanupExpiredTrials] Cleanup complete: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: expiredTrials.length,
        succeeded: successCount,
        failed: failureCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CleanupExpiredTrials] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
