#!/usr/bin/env ts-node
import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

type PaidTier = 'spark' | 'growth' | 'transformation';
type Tier = 'seeker' | 'free_trial' | PaidTier;

type SubscriptionRow = {
  user_id: string;
  tier: Tier;
  subscription_display_name: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  trial_chosen_tier: PaidTier | null;
  trial_converted_date: string | null;
  trial_cancelled_date: string | null;
  billing_issue: boolean | null;
  grace_period_end_date: string | null;
  playbooks_limit: number | null;
  devotionals_limit: number | null;
  playbooks_used: number | null;
  devotionals_used: number | null;
  smart_journaling_enabled: boolean | null;
  platform_subscription_id: string | null;
  platform_transaction_id: string | null;
};

const TIER_DISPLAY_NAME: Record<PaidTier, string> = {
  spark: 'Spark',
  growth: 'Growth',
  transformation: 'Transformation',
};

const TIER_LIMITS: Record<Tier, { playbooks: number; devotionals: number; smartJournaling: boolean }> = {
  seeker: { playbooks: 0, devotionals: 0, smartJournaling: false },
  free_trial: { playbooks: 2, devotionals: 2, smartJournaling: false },
  spark: { playbooks: 8, devotionals: 8, smartJournaling: false },
  growth: { playbooks: 20, devotionals: 20, smartJournaling: true },
  transformation: { playbooks: -1, devotionals: -1, smartJournaling: true },
};

interface CliOptions {
  userId: string;
  action: string;
  tier?: PaidTier;
  days?: number;
  transactionId?: string;
  subscriptionId?: string;
}

const parseArgs = (argv: string[]): CliOptions => {
  const options: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.split('=');
      if (value !== undefined) {
        options[key.replace('--', '')] = value;
      } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        options[key.replace('--', '')] = argv[i + 1];
        i += 1;
      } else {
        options[key.replace('--', '')] = 'true';
      }
    }
  }

  const userId = options.user || options.u;
  const action = options.action || options.a || 'status';

  if (!userId) {
    throw new Error('Missing required --user argument.');
  }

  return {
    userId,
    action,
    tier: (options.tier as PaidTier) || 'growth',
    days: options.days ? Number(options.days) : 3,
    transactionId: options.transaction || options.txn,
    subscriptionId: options.subscription || options.sub,
  };
};

const formatDate = (value: string | null) => (value ? new Date(value).toISOString() : '—');

class TrialLifecycleTester {
  private supabase: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.supabase = client;
  }

  async fetchSubscription(userId: string): Promise<SubscriptionRow | null> {
    const { data, error } = await this.supabase
      .from('user_subscriptions_new')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch subscription:', error.message);
      return null;
    }

    return data as SubscriptionRow;
  }

  async printUserState(userId: string): Promise<void> {
    const subscription = await this.fetchSubscription(userId);
    if (!subscription) {
      console.log('No subscription record found for', userId);
      return;
    }

    console.log('\nCurrent subscription state');
    console.table({
      tier: subscription.tier,
      displayName: subscription.subscription_display_name,
      trialStart: formatDate(subscription.trial_start_date),
      trialEnd: formatDate(subscription.trial_end_date),
      trialChosenTier: subscription.trial_chosen_tier ?? '—',
      trialConverted: formatDate(subscription.trial_converted_date),
      trialCancelled: formatDate(subscription.trial_cancelled_date),
      billingIssue: subscription.billing_issue ?? false,
      gracePeriodEnd: formatDate(subscription.grace_period_end_date),
      playbooks: `${subscription.playbooks_used}/${subscription.playbooks_limit}`,
      devotionals: `${subscription.devotionals_used}/${subscription.devotionals_limit}`,
      smartJournaling: subscription.smart_journaling_enabled ?? false,
    });
  }

  private getSubscriptionDisplayName(tier: PaidTier, isTrial = false) {
    const base = `siFia ${TIER_DISPLAY_NAME[tier]}`;
    return isTrial ? `${base} Trial` : base;
  }

  async createTrial(userId: string, chosenTier: PaidTier, subscriptionId?: string, transactionId?: string) {
    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + 3);

    const { playbooks, devotionals, smartJournaling } = TIER_LIMITS.free_trial;

    const payload = {
      tier: 'free_trial' as const,
      subscription_display_name: this.getSubscriptionDisplayName(chosenTier, true),
      trial_start_date: trialStart.toISOString(),
      trial_end_date: trialEnd.toISOString(),
      trial_chosen_tier: chosenTier,
      playbooks_limit: playbooks,
      devotionals_limit: devotionals,
      playbooks_used: 0,
      devotionals_used: 0,
      smart_journaling_enabled: smartJournaling,
      platform_subscription_id: subscriptionId ?? `TEST-SUB-${Date.now()}`,
      platform_transaction_id: transactionId ?? `TEST-TXN-${randomUUID()}`,
      subscription_start_date: trialStart.toISOString(),
      trial_converted_date: null,
      trial_cancelled_date: null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from('user_subscriptions_new')
      .update(payload)
      .eq('user_id', userId);

    if (error) {
      console.error('Trial creation failed:', error.message);
      return;
    }

    console.log('✅ Trial created successfully');
  }

  async simulatePaymentFailure(userId: string, gracePeriodDays = 3) {
    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + gracePeriodDays);

    const { error } = await this.supabase
      .from('user_subscriptions_new')
      .update({
        billing_issue: true,
        grace_period_end_date: graceEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to mark billing issue:', error.message);
      return;
    }

    console.log(`⚠️  Billing issue registered. Grace period ends ${graceEnd.toISOString()}`);
  }

  async clearGracePeriod(userId: string) {
    const { error } = await this.supabase
      .from('user_subscriptions_new')
      .update({
        billing_issue: false,
        grace_period_end_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to clear grace period:', error.message);
      return;
    }

    console.log('✅ Grace period cleared');
  }

  async convertTrial(userId: string, transactionId?: string) {
    const subscription = await this.fetchSubscription(userId);
    if (!subscription) {
      return;
    }

    if (subscription.tier !== 'free_trial' || !subscription.trial_chosen_tier) {
      console.error('User is not currently on a free trial. No conversion performed.');
      return;
    }

    const chosenTier = subscription.trial_chosen_tier;
    const { playbooks, devotionals, smartJournaling } = TIER_LIMITS[chosenTier];

    const { error } = await this.supabase
      .from('user_subscriptions_new')
      .update({
        tier: chosenTier,
        subscription_display_name: this.getSubscriptionDisplayName(chosenTier),
        playbooks_limit: playbooks,
        devotionals_limit: devotionals,
        playbooks_used: 0,
        devotionals_used: 0,
        smart_journaling_enabled: smartJournaling,
        trial_converted_date: new Date().toISOString(),
        platform_transaction_id: transactionId ?? `PAID-TXN-${randomUUID()}`,
        billing_issue: false,
        grace_period_end_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Trial conversion failed:', error.message);
      return;
    }

    console.log('🎉 Trial converted to paid tier:', chosenTier);
  }

  async cancelTrial(userId: string) {
    const { playbooks, devotionals, smartJournaling } = TIER_LIMITS.seeker;

    const { error } = await this.supabase
      .from('user_subscriptions_new')
      .update({
        tier: 'seeker',
        subscription_display_name: 'siFia Seeker',
        playbooks_limit: playbooks,
        devotionals_limit: devotionals,
        playbooks_used: 0,
        devotionals_used: 0,
        smart_journaling_enabled: smartJournaling,
        trial_cancelled_date: new Date().toISOString(),
        billing_issue: false,
        grace_period_end_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Trial cancellation failed:', error.message);
      return;
    }

    console.log('🛑 Trial cancelled and user reverted to seeker tier');
  }

  async forceTrialExpiration(userId: string) {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { error } = await this.supabase
      .from('user_subscriptions_new')
      .update({ trial_end_date: pastDate })
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to backdate trial end date:', error.message);
      return;
    }

    const { data: cleaned, error: rpcError } = await this.supabase.rpc('check_and_handle_expired_trials');

    if (rpcError) {
      console.error('Expired trial handler failed:', rpcError.message);
      return;
    }

    console.log(`🕒 Forced trial expiration. Rows affected: ${cleaned}`);
  }

  async forceGracePeriodCleanup() {
    const { data, error } = await this.supabase.rpc('check_and_handle_grace_period_expiry');

    if (error) {
      console.error('Grace period cleanup failed:', error.message);
      return;
    }

    console.log(`🧹 Grace period cleanup executed. Rows affected: ${data}`);
  }

  async runFullFlow(userId: string, tier: PaidTier) {
    console.log('\n🚀 Starting full trial lifecycle simulation');
    await this.createTrial(userId, tier);
    await this.printUserState(userId);

    await this.simulatePaymentFailure(userId, 3);
    await this.printUserState(userId);

    await this.convertTrial(userId);
    await this.printUserState(userId);

    await this.cancelTrial(userId);
    await this.printUserState(userId);

    console.log('✅ Full flow completed');
  }
}

(async () => {
  try {
    const options = parseArgs(process.argv.slice(2));

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your environment.');
    }

    const client = createClient(supabaseUrl, serviceKey);
    const tester = new TrialLifecycleTester(client);

    switch (options.action) {
      case 'status':
        await tester.printUserState(options.userId);
        break;
      case 'create':
        await tester.createTrial(options.userId, options.tier ?? 'growth', options.subscriptionId, options.transactionId);
        await tester.printUserState(options.userId);
        break;
      case 'payment-failure':
        await tester.simulatePaymentFailure(options.userId, options.days);
        await tester.printUserState(options.userId);
        break;
      case 'clear-grace':
        await tester.clearGracePeriod(options.userId);
        await tester.printUserState(options.userId);
        break;
      case 'convert':
        await tester.convertTrial(options.userId, options.transactionId);
        await tester.printUserState(options.userId);
        break;
      case 'cancel':
        await tester.cancelTrial(options.userId);
        await tester.printUserState(options.userId);
        break;
      case 'expire-trial':
        await tester.forceTrialExpiration(options.userId);
        await tester.printUserState(options.userId);
        break;
      case 'expire-grace':
        await tester.forceGracePeriodCleanup();
        await tester.printUserState(options.userId);
        break;
      case 'full':
        await tester.runFullFlow(options.userId, options.tier ?? 'growth');
        break;
      default:
        console.error('Unknown action. Supported actions: status, create, payment-failure, clear-grace, convert, cancel, expire-trial, expire-grace, full');
    }
  } catch (error) {
    console.error('Trial tester failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
