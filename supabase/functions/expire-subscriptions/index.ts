import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  // 2. Downgrade expired paid subscriptions AFTER 3-day grace period
  // This covers GCash and any payment method where Apple went silent
  const { data: expiredPaid, error: paidError } = await supabase
    .from('user_subscriptions_new')
    .update(paidSeekerLimits)
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
