import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

import {
  decideJournalCloudWebhook,
  parseRevenueCatWebhookPayload,
  sha256Hex,
  verifyRevenueCatWebhookRequest,
  type RevenueCatEnvironment,
} from './revenueCatJournalCloud.ts';
import {fetchJournalCloudSubscriptionState} from './revenueCatSubscriptionState.ts';

const MAX_BODY_BYTES = 256_000;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
});

const requiredSecret = (name: string): string | null => {
  const value = Deno.env.get(name)?.trim();
  return value ? value : null;
};

const toIsoTimestamp = (milliseconds: number | null): string | null => {
  if (milliseconds === null) return null;
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export const handleRevenueCatJournalCloudWebhook = async (
  request: Request,
  expectedEnvironment: RevenueCatEnvironment,
): Promise<Response> => {
  if (request.method !== 'POST') {
    return json({error: 'Method not allowed'}, 405);
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({error: 'Payload too large'}, 413);
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({error: 'Payload too large'}, 413);
  }

  const prefix = expectedEnvironment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
  const expectedAuthorization = requiredSecret(`REVENUECAT_${prefix}_WEBHOOK_AUTHORIZATION`);
  const signingSecret = requiredSecret(`REVENUECAT_${prefix}_WEBHOOK_SIGNING_SECRET`);
  const revenueCatApiKey = requiredSecret('REVENUECAT_V2_SECRET_API_KEY');
  const revenueCatProjectId = requiredSecret('REVENUECAT_PROJECT_ID');
  const supabaseUrl = requiredSecret('SUPABASE_URL');
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY');
  if (
    !expectedAuthorization || !signingSecret || !revenueCatApiKey ||
    !revenueCatProjectId || !supabaseUrl || !serviceRoleKey
  ) {
    console.error('[JournalCloudWebhook] Required server configuration is missing', {
      environment: expectedEnvironment,
    });
    return json({error: 'Service unavailable'}, 503);
  }

  const verification = await verifyRevenueCatWebhookRequest({
    rawBody,
    authorizationHeader: request.headers.get('authorization'),
    signatureHeader: request.headers.get('x-revenuecat-webhook-signature'),
    expectedAuthorization,
    signingSecret,
  });
  if (!verification.ok) {
    console.warn('[JournalCloudWebhook] Request verification failed', {
      environment: expectedEnvironment,
      reason: verification.reason,
    });
    return json({error: 'Unauthorized'}, 401);
  }

  const payload = parseRevenueCatWebhookPayload(rawBody);
  if (!payload) {
    return json({error: 'Invalid payload'}, 400);
  }
  const decision = decideJournalCloudWebhook(payload, expectedEnvironment);
  const payloadHash = await sha256Hex(rawBody);
  const storageEnvironment = decision.environment ?? expectedEnvironment;
  const reconciliationStartedAt = new Date().toISOString();
  let authoritativeActive: boolean | null = null;
  let authoritativeExpiresAt: string | null = null;

  if (decision.disposition === 'reconcile' && decision.ownerUserId) {
    try {
      const state = await fetchJournalCloudSubscriptionState({
        projectId: revenueCatProjectId,
        customerId: decision.ownerUserId,
        apiKey: revenueCatApiKey,
        environment: expectedEnvironment,
      });
      authoritativeActive = state.active;
      authoritativeExpiresAt = toIsoTimestamp(state.expiresAtMs);
    } catch (error) {
      console.error('[JournalCloudWebhook] Authoritative RevenueCat lookup failed', {
        environment: expectedEnvironment,
        eventId: decision.eventId,
        errorName: error instanceof Error ? error.name : 'unknown',
      });
      return json({error: 'Provider reconciliation unavailable'}, 503);
    }
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
  const {data, error} = await admin.rpc('reconcile_journal_cloud_entitlement', {
    p_event_id: decision.eventId,
    p_payload_sha256: payloadHash,
    p_event_type: decision.eventType,
    p_disposition: decision.disposition,
    p_reason: decision.reason,
    p_environment: storageEnvironment,
    p_owner_user_id: decision.ownerUserId,
    p_external_customer_id: decision.ownerUserId,
    p_product_id: decision.productId,
    p_event_occurred_at: toIsoTimestamp(decision.eventTimestampMs),
    p_authoritative_active: authoritativeActive,
    p_authoritative_expires_at: authoritativeExpiresAt,
    // The lookup start time, not network completion time, provides a stable
    // last-writer ordering when multiple provider events reconcile concurrently.
    p_reconciled_at: reconciliationStartedAt,
  });
  if (error) {
    console.error('[JournalCloudWebhook] Database reconciliation failed', {
      environment: expectedEnvironment,
      eventId: decision.eventId,
      code: error.code,
    });
    return json({error: 'Reconciliation unavailable'}, 503);
  }

  return json({received: true, result: data});
};
