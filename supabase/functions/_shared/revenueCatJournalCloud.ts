export const JOURNAL_CLOUD_ENTITLEMENT_ID = 'journal_cloud';
export const JOURNAL_CLOUD_APPLE_PRODUCTS = new Set([
  'app.journal.sifia.cloud.monthly',
  'app.journal.sifia.cloud.annual',
]);

export type RevenueCatEnvironment = 'SANDBOX' | 'PRODUCTION';

export interface RevenueCatWebhookEvent {
  id: string;
  type: string;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  entitlement_ids?: string[] | null;
  product_id?: string | null;
  environment?: RevenueCatEnvironment | null;
  event_timestamp_ms?: number | null;
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
  [key: string]: unknown;
}

export interface RevenueCatWebhookPayload {
  api_version: string;
  event: RevenueCatWebhookEvent;
}

export type WebhookVerificationFailure =
  | 'authorization_missing_or_invalid'
  | 'signature_header_invalid'
  | 'signature_timestamp_invalid'
  | 'signature_timestamp_stale'
  | 'signature_mismatch'
  | 'signing_secret_missing';

export type WebhookVerificationResult =
  | {ok: true; signedAtSeconds: number}
  | {ok: false; reason: WebhookVerificationFailure};

export type WebhookDisposition =
  | 'reconcile'
  | 'ignore'
  | 'quarantine';

export interface JournalCloudWebhookDecision {
  disposition: WebhookDisposition;
  reason:
    | 'journal_cloud_event'
    | 'unrelated_entitlement'
    | 'unsupported_product'
    | 'environment_mismatch'
    | 'owner_missing'
    | 'owner_ambiguous'
    | 'transfer_requires_review'
    | 'temporary_grant_not_authoritative'
    | 'dashboard_test';
  eventId: string;
  eventType: string;
  ownerUserId: string | null;
  environment: RevenueCatEnvironment | null;
  productId: string | null;
  eventTimestampMs: number | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const encoder = new TextEncoder();

const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference += Number(left[index] !== right[index]);
  }
  return difference === 0;
};

const hexToBytes = (value: string): Uint8Array | null => {
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    return null;
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
};

const parseSignatureHeader = (
  header: string,
): {timestamp: string; signature: string} | null => {
  const values = new Map<string, string>();
  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      return null;
    }
    values.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }

  const timestamp = values.get('t');
  const signature = values.get('v1');
  return timestamp && signature ? {timestamp, signature} : null;
};

export const verifyRevenueCatWebhookRequest = async (input: {
  rawBody: string;
  authorizationHeader: string | null;
  signatureHeader: string | null;
  expectedAuthorization: string;
  signingSecret: string;
  nowMs?: number;
  toleranceSeconds?: number;
  cryptoProvider?: Crypto;
}): Promise<WebhookVerificationResult> => {
  const expectedAuthorization = input.expectedAuthorization.trim();
  if (
    !expectedAuthorization ||
    !input.authorizationHeader ||
    !constantTimeEqual(
      encoder.encode(input.authorizationHeader),
      encoder.encode(expectedAuthorization),
    )
  ) {
    return {ok: false, reason: 'authorization_missing_or_invalid'};
  }

  if (!input.signingSecret) {
    return {ok: false, reason: 'signing_secret_missing'};
  }

  if (!input.signatureHeader) {
    return {ok: false, reason: 'signature_header_invalid'};
  }

  const parsedHeader = parseSignatureHeader(input.signatureHeader);
  const expectedSignature = parsedHeader
    ? hexToBytes(parsedHeader.signature)
    : null;
  if (!parsedHeader || !expectedSignature) {
    return {ok: false, reason: 'signature_header_invalid'};
  }

  if (!/^\d{1,12}$/.test(parsedHeader.timestamp)) {
    return {ok: false, reason: 'signature_timestamp_invalid'};
  }
  const signedAtSeconds = Number(parsedHeader.timestamp);
  if (!Number.isSafeInteger(signedAtSeconds)) {
    return {ok: false, reason: 'signature_timestamp_invalid'};
  }

  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - signedAtSeconds) > toleranceSeconds) {
    return {ok: false, reason: 'signature_timestamp_stale'};
  }

  const cryptoProvider = input.cryptoProvider ?? globalThis.crypto;
  if (!cryptoProvider?.subtle) {
    return {ok: false, reason: 'signature_mismatch'};
  }

  const key = await cryptoProvider.subtle.importKey(
    'raw',
    encoder.encode(input.signingSecret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const digest = await cryptoProvider.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${parsedHeader.timestamp}.${input.rawBody}`),
  );

  if (!constantTimeEqual(new Uint8Array(digest), expectedSignature)) {
    return {ok: false, reason: 'signature_mismatch'};
  }

  return {ok: true, signedAtSeconds};
};

export const parseRevenueCatWebhookPayload = (
  rawBody: string,
): RevenueCatWebhookPayload | null => {
  try {
    const candidate = JSON.parse(rawBody) as Partial<RevenueCatWebhookPayload>;
    const event = candidate.event as RevenueCatWebhookEvent | undefined;
    if (
      candidate.api_version !== '1.0' ||
      !event ||
      typeof event.id !== 'string' ||
      !event.id.trim() ||
      event.id.length > 255 ||
      typeof event.type !== 'string' ||
      !event.type.trim() ||
      event.type.length > 80
    ) {
      return null;
    }

    return {api_version: '1.0', event};
  } catch {
    return null;
  }
};

const collectOwnerCandidates = (event: RevenueCatWebhookEvent): string[] => {
  const values = [
    event.app_user_id,
    event.original_app_user_id,
    ...(Array.isArray(event.aliases) ? event.aliases : []),
  ];

  return [...new Set(values.filter(
    (value): value is string => typeof value === 'string' && UUID_PATTERN.test(value),
  ).map(value => value.toLowerCase()))];
};

export const decideJournalCloudWebhook = (
  payload: RevenueCatWebhookPayload,
  expectedEnvironment: RevenueCatEnvironment,
): JournalCloudWebhookDecision => {
  const {event} = payload;
  const ownerCandidates = collectOwnerCandidates(event);
  const base = {
    eventId: event.id,
    eventType: event.type,
    ownerUserId: ownerCandidates.length === 1 ? ownerCandidates[0] : null,
    environment: event.environment ?? null,
    productId: event.product_id ?? null,
    eventTimestampMs:
      typeof event.event_timestamp_ms === 'number' &&
        Number.isSafeInteger(event.event_timestamp_ms)
        ? event.event_timestamp_ms
        : null,
  };

  if (event.type === 'TEST') {
    return {...base, disposition: 'ignore', reason: 'dashboard_test'};
  }
  if (event.type === 'TRANSFER') {
    return {...base, disposition: 'quarantine', reason: 'transfer_requires_review'};
  }
  if (event.type === 'TEMPORARY_ENTITLEMENT_GRANT') {
    return {
      ...base,
      disposition: 'quarantine',
      reason: 'temporary_grant_not_authoritative',
    };
  }

  const entitlementIds = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids
    : [];
  if (!entitlementIds.includes(JOURNAL_CLOUD_ENTITLEMENT_ID)) {
    return {...base, disposition: 'ignore', reason: 'unrelated_entitlement'};
  }
  if (
    !event.product_id ||
    !JOURNAL_CLOUD_APPLE_PRODUCTS.has(event.product_id)
  ) {
    return {...base, disposition: 'quarantine', reason: 'unsupported_product'};
  }
  if (event.environment !== expectedEnvironment) {
    return {...base, disposition: 'quarantine', reason: 'environment_mismatch'};
  }
  if (ownerCandidates.length === 0) {
    return {...base, disposition: 'quarantine', reason: 'owner_missing'};
  }
  if (ownerCandidates.length > 1) {
    return {...base, disposition: 'quarantine', reason: 'owner_ambiguous'};
  }

  return {...base, disposition: 'reconcile', reason: 'journal_cloud_event'};
};

export const sha256Hex = async (
  rawBody: string,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<string> => {
  const digest = await cryptoProvider.subtle.digest('SHA-256', encoder.encode(rawBody));
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};
