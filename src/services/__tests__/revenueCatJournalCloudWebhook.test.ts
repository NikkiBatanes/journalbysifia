import {webcrypto} from 'node:crypto';

import {
  decideJournalCloudWebhook,
  parseRevenueCatWebhookPayload,
  sha256Hex,
  verifyRevenueCatWebhookRequest,
  type RevenueCatWebhookPayload,
} from '../../../supabase/functions/_shared/revenueCatJournalCloud';

const cryptoProvider = webcrypto as unknown as Crypto;
const authorization = 'Bearer synthetic-webhook-authorization';
const signingSecret = 'synthetic-signing-secret';
const nowMs = 1_800_000_000_000;
const timestamp = Math.floor(nowMs / 1000);

const makePayload = (
  event: Partial<RevenueCatWebhookPayload['event']> = {},
): RevenueCatWebhookPayload => ({
  api_version: '1.0',
  event: {
    id: 'event-synthetic-1',
    type: 'INITIAL_PURCHASE',
    app_user_id: '18b0376c-0000-4000-8000-000000000001',
    original_app_user_id: '18b0376c-0000-4000-8000-000000000001',
    aliases: [],
    entitlement_ids: ['journal_cloud'],
    product_id: 'app.journal.sifia.cloud.monthly',
    environment: 'PRODUCTION',
    event_timestamp_ms: nowMs,
    ...event,
  },
});

const sign = async (rawBody: string, signedAt = timestamp): Promise<string> => {
  const key = await cryptoProvider.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const digest = await cryptoProvider.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${signedAt}.${rawBody}`),
  );
  const signature = [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  return `t=${signedAt},v1=${signature}`;
};

describe('RevenueCat Journal Cloud webhook verification', () => {
  const rawBody = JSON.stringify(makePayload());

  it('accepts exact authorization plus a current raw-body HMAC', async () => {
    await expect(verifyRevenueCatWebhookRequest({
      rawBody,
      authorizationHeader: authorization,
      signatureHeader: await sign(rawBody),
      expectedAuthorization: authorization,
      signingSecret,
      nowMs,
      cryptoProvider,
    })).resolves.toEqual({ok: true, signedAtSeconds: timestamp});
  });

  it('rejects an invalid authorization value before processing', async () => {
    await expect(verifyRevenueCatWebhookRequest({
      rawBody,
      authorizationHeader: 'Bearer wrong',
      signatureHeader: await sign(rawBody),
      expectedAuthorization: authorization,
      signingSecret,
      nowMs,
      cryptoProvider,
    })).resolves.toEqual({
      ok: false,
      reason: 'authorization_missing_or_invalid',
    });
  });

  it('rejects body tampering and stale delivery signatures', async () => {
    const signatureHeader = await sign(rawBody);
    await expect(verifyRevenueCatWebhookRequest({
      rawBody: `${rawBody} `,
      authorizationHeader: authorization,
      signatureHeader,
      expectedAuthorization: authorization,
      signingSecret,
      nowMs,
      cryptoProvider,
    })).resolves.toEqual({ok: false, reason: 'signature_mismatch'});

    const staleTimestamp = timestamp - 301;
    await expect(verifyRevenueCatWebhookRequest({
      rawBody,
      authorizationHeader: authorization,
      signatureHeader: await sign(rawBody, staleTimestamp),
      expectedAuthorization: authorization,
      signingSecret,
      nowMs,
      cryptoProvider,
    })).resolves.toEqual({ok: false, reason: 'signature_timestamp_stale'});
  });

  it('parses only the documented envelope and hashes without retaining the body', async () => {
    expect(parseRevenueCatWebhookPayload(rawBody)).toEqual(makePayload());
    expect(parseRevenueCatWebhookPayload('{"api_version":"1.0"}')).toBeNull();
    expect(parseRevenueCatWebhookPayload('not-json')).toBeNull();
    await expect(sha256Hex(rawBody, cryptoProvider)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('RevenueCat Journal Cloud webhook decisions', () => {
  it('reconciles a known product and one unambiguous authenticated owner', () => {
    expect(decideJournalCloudWebhook(makePayload(), 'PRODUCTION')).toMatchObject({
      disposition: 'reconcile',
      reason: 'journal_cloud_event',
      ownerUserId: '18b0376c-0000-4000-8000-000000000001',
    });
  });

  it('quarantines cross-account aliases instead of transferring ownership', () => {
    const payload = makePayload({
      aliases: [
        '18b0376c-0000-4000-8000-000000000001',
        'e3b6922c-0000-4000-8000-000000000002',
      ],
    });
    expect(decideJournalCloudWebhook(payload, 'PRODUCTION')).toMatchObject({
      disposition: 'quarantine',
      reason: 'owner_ambiguous',
      ownerUserId: null,
    });
  });

  it('quarantines anonymous owners, transfers, and temporary grants', () => {
    expect(decideJournalCloudWebhook(makePayload({
      app_user_id: '$RCAnonymousID:synthetic',
      original_app_user_id: '$RCAnonymousID:synthetic',
    }), 'PRODUCTION')).toMatchObject({
      disposition: 'quarantine',
      reason: 'owner_missing',
    });
    expect(decideJournalCloudWebhook(makePayload({type: 'TRANSFER'}), 'PRODUCTION'))
      .toMatchObject({disposition: 'quarantine', reason: 'transfer_requires_review'});
    expect(decideJournalCloudWebhook(makePayload({
      type: 'TEMPORARY_ENTITLEMENT_GRANT',
    }), 'PRODUCTION')).toMatchObject({
      disposition: 'quarantine',
      reason: 'temporary_grant_not_authoritative',
    });
  });

  it('isolates sandbox and unrelated or unknown products', () => {
    expect(decideJournalCloudWebhook(makePayload({
      environment: 'SANDBOX',
    }), 'PRODUCTION')).toMatchObject({
      disposition: 'quarantine',
      reason: 'environment_mismatch',
    });
    expect(decideJournalCloudWebhook(makePayload({
      entitlement_ids: ['sifia_growth'],
    }), 'PRODUCTION')).toMatchObject({
      disposition: 'ignore',
      reason: 'unrelated_entitlement',
    });
    expect(decideJournalCloudWebhook(makePayload({
      product_id: 'unexpected.product',
    }), 'PRODUCTION')).toMatchObject({
      disposition: 'quarantine',
      reason: 'unsupported_product',
    });
  });

  it('treats lifecycle events only as reconciliation triggers', () => {
    for (const type of ['RENEWAL', 'CANCELLATION', 'BILLING_ISSUE', 'EXPIRATION']) {
      expect(decideJournalCloudWebhook(makePayload({type}), 'PRODUCTION'))
        .toMatchObject({disposition: 'reconcile', reason: 'journal_cloud_event'});
    }
  });
});
