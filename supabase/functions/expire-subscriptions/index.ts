import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const seekerLimits = {
    tier: 'seeker',
    subscription_display_name: 'siFia Seeker',
    playbooks_limit: 0,
    devotionals_limit: 0,
    smart_journaling_enabled: false,
    billing_cycle: null,
    status: 'expired',
    updated_at: new Date().toISOString(),
  };

  const now = new Date();

  // For trials: downgrade immediately after trial_end_date
  const trialThreshold = now.toISOString();

  // For paid subscriptions: give 3-day grace period after subscription_end_date
  const gracePeriodDays = 3;
  const paidThreshold = new Date(now);
  paidThreshold.setDate(paidThreshold.getDate() - gracePeriodDays);
  const paidThresholdIso = paidThreshold.toISOString();

  // 1. Downgrade expired free trials (no grace period — trial is already the grace period)
  const { data: expiredTrials, error: trialsError } = await supabase
    .from('user_subscriptions_new')
    .update(seekerLimits)
    .eq('tier', 'free_trial')
    .lt('trial_end_date', trialThreshold)
    .select('user_id');

  if (trialsError) {
    console.error('[ExpireSubscriptions] Failed to expire trials:', trialsError);
  }

  // 2. Downgrade expired paid subscriptions AFTER 3-day grace period
  // This covers GCash and any payment method where Apple went silent
  const { data: expiredPaid, error: paidError } = await supabase
    .from('user_subscriptions_new')
    .update(seekerLimits)
    .not('tier', 'in', '("seeker","free_trial")')
    .not('subscription_end_date', 'is', null)
    .lt('subscription_end_date', paidThresholdIso) // must be 3+ days ago
    .select('user_id');

  if (paidError) {
    console.error('[ExpireSubscriptions] Failed to expire paid subs:', paidError);
  }

  const totalExpired =
    (expiredTrials?.length || 0) + (expiredPaid?.length || 0);

  console.log(`[ExpireSubscriptions] ✅ Downgraded ${totalExpired} users`);
  console.log(`  - Expired trials: ${expiredTrials?.length || 0}`);
  console.log(`  - Expired paid: ${expiredPaid?.length || 0}`);

  return new Response(
    JSON.stringify({
      success: true,
      expired_trials: expiredTrials?.length || 0,
      expired_paid: expiredPaid?.length || 0,
      total: totalExpired,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
