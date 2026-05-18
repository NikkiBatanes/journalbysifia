import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestBody = {
  campaign_id?: string;
  dry_run?: boolean;
  reset_usage?: boolean;
  process_now?: boolean;
  limit?: number;
  test_user_id?: string;
};

const NOTIFICATION_TYPE = 'account_replenished';
const DEFAULT_CAMPAIGN_ID = 'launch_replenish_v1';
const CHUNK_SIZE = 500;

function chunk<T>(items: T[], size = CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authHeader = req.headers.get('authorization') ?? '';
    if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const campaignId = body.campaign_id || DEFAULT_CAMPAIGN_ID;
    const dryRun = body.dry_run === true;
    const resetUsage = body.reset_usage !== false;
    const processNow = body.process_now === true;

    let tokenQuery = supabase
      .from('device_tokens')
      .select('user_id')
      .eq('is_active', true);

    if (body.test_user_id) {
      tokenQuery = tokenQuery.eq('user_id', body.test_user_id);
    }

    const { data: tokenRows, error: tokenError } = await tokenQuery;

    if (tokenError) {
      throw new Error(`Failed to fetch active device tokens: ${tokenError.message}`);
    }

    const activeUserIds = [...new Set((tokenRows || []).map((row: any) => row.user_id).filter(Boolean))] as string[];
    if (activeUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, campaignId, dryRun, eligible: 0, queued: 0, message: 'No active device tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const seekerIds: string[] = [];
    for (const ids of chunk(activeUserIds)) {
      const { data: subscriptions, error: subscriptionError } = await supabase
        .from('user_subscriptions_new')
        .select('user_id, tier')
        .in('user_id', ids)
        .eq('tier', 'seeker');

      if (subscriptionError) {
        throw new Error(`Failed to fetch seeker subscriptions: ${subscriptionError.message}`);
      }

      seekerIds.push(...(subscriptions || []).map((sub: any) => sub.user_id));
    }

    const limitedSeekerIds = typeof body.limit === 'number' && body.limit > 0
      ? seekerIds.slice(0, body.limit)
      : seekerIds;

    const alreadyQueued = new Set<string>();
    for (const ids of chunk(limitedSeekerIds)) {
      const { data: existing, error: existingError } = await supabase
        .from('notification_queue')
        .select('user_id')
        .eq('type', NOTIFICATION_TYPE)
        .filter('data->>campaign_id', 'eq', campaignId)
        .in('user_id', ids);

      if (existingError) {
        throw new Error(`Failed to check existing replenish notifications: ${existingError.message}`);
      }

      for (const row of existing || []) {
        alreadyQueued.add(row.user_id);
      }
    }

    const targetIds = limitedSeekerIds.filter(userId => !alreadyQueued.has(userId));
    const now = new Date().toISOString();

    if (!dryRun && resetUsage && targetIds.length > 0) {
      for (const ids of chunk(targetIds)) {
        const { error: resetError } = await supabase
          .from('user_subscriptions_new')
          .update({
            playbooks_used: 0,
            devotionals_used: 0,
            wisdom_count: 0,
            refinement_count: 0,
            last_usage_reset: now,
            updated_at: now,
          })
          .in('user_id', ids)
          .eq('tier', 'seeker');

        if (resetError) {
          throw new Error(`Failed to replenish seeker usage: ${resetError.message}`);
        }
      }
    }

    if (!dryRun && targetIds.length > 0) {
      for (const ids of chunk(targetIds, 100)) {
        const rows = ids.map(userId => ({
          user_id: userId,
          type: NOTIFICATION_TYPE,
          title: 'Your siFia account has been refreshed',
          message: 'Your free playbook, devotional, How To, and refinement requests are available again.',
          data: {
            deep_link: 'sifia://dashboard',
            campaign_id: campaignId,
            reset_usage: resetUsage,
            notification_type: NOTIFICATION_TYPE,
          },
          scheduled_for: now,
          priority: 'normal',
          status: 'pending',
          created_at: now,
        }));

        const { error: insertError } = await supabase
          .from('notification_queue')
          .insert(rows);

        if (insertError) {
          throw new Error(`Failed to queue replenish notifications: ${insertError.message}`);
        }
      }
    }

    let processResult: unknown = null;
    if (!dryRun && processNow && targetIds.length > 0) {
      const response = await fetch(`${supabaseUrl}/functions/v1/process-notification-queue`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source: NOTIFICATION_TYPE, campaign_id: campaignId }),
      });
      processResult = await response.json().catch(() => ({ status: response.status }));
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaignId,
        dryRun,
        resetUsage,
        eligible: limitedSeekerIds.length,
        skippedAlreadyQueued: alreadyQueued.size,
        queued: dryRun ? 0 : targetIds.length,
        wouldQueue: targetIds.length,
        processResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[NotifyAccountReplenished] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
