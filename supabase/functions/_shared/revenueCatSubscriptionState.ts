import {JOURNAL_CLOUD_ENTITLEMENT_ID, type RevenueCatEnvironment} from './revenueCatJournalCloud.ts';

interface RevenueCatEntitlementReference {
  lookup_key?: unknown;
}

interface RevenueCatSubscription {
  id?: unknown;
  gives_access?: unknown;
  environment?: unknown;
  current_period_ends_at?: unknown;
  ends_at?: unknown;
  entitlements?: {items?: unknown} | null;
}

interface RevenueCatSubscriptionList {
  items?: unknown;
  next_page?: unknown;
}

export interface JournalCloudSubscriptionState {
  active: boolean;
  expiresAtMs: number | null;
}

export class RevenueCatApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'RevenueCatApiError';
  }
}

const readExpiration = (subscription: RevenueCatSubscription): number | null => {
  const candidates = [subscription.current_period_ends_at, subscription.ends_at]
    .filter((value): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0);
  return candidates.length > 0 ? Math.max(...candidates) : null;
};

const hasJournalCloudEntitlement = (subscription: RevenueCatSubscription): boolean => {
  const items = subscription.entitlements?.items;
  return Array.isArray(items) && items.some(item => {
    const entitlement = item as RevenueCatEntitlementReference;
    return entitlement?.lookup_key === JOURNAL_CLOUD_ENTITLEMENT_ID;
  });
};

export const fetchJournalCloudSubscriptionState = async (input: {
  projectId: string;
  customerId: string;
  apiKey: string;
  environment: RevenueCatEnvironment;
  fetchImpl?: typeof fetch;
  apiOrigin?: string;
  maxPages?: number;
}): Promise<JournalCloudSubscriptionState> => {
  const projectId = input.projectId.trim();
  const customerId = input.customerId.trim();
  const apiKey = input.apiKey.trim();
  if (!projectId || !customerId || !apiKey) {
    throw new RevenueCatApiError('RevenueCat reconciliation configuration is incomplete');
  }

  const apiOrigin = new URL(input.apiOrigin ?? 'https://api.revenuecat.com').origin;
  const encodedProject = encodeURIComponent(projectId);
  const encodedCustomer = encodeURIComponent(customerId);
  const expectedPath = `/v2/projects/${encodedProject}/customers/${encodedCustomer}/subscriptions`;
  const environment = input.environment.toLowerCase();
  let nextUrl = new URL(expectedPath, apiOrigin);
  nextUrl.searchParams.set('environment', environment);
  nextUrl.searchParams.set('limit', '100');

  const fetchImpl = input.fetchImpl ?? fetch;
  const maxPages = input.maxPages ?? 20;
  const visited = new Set<string>();
  const matchingExpirations: Array<number | null> = [];

  for (let page = 0; page < maxPages; page += 1) {
    if (visited.has(nextUrl.href)) {
      throw new RevenueCatApiError('RevenueCat pagination loop detected');
    }
    visited.add(nextUrl.href);

    const response = await fetchImpl(nextUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      throw new RevenueCatApiError('RevenueCat subscription lookup failed', response.status);
    }

    let body: RevenueCatSubscriptionList;
    try {
      body = await response.json() as RevenueCatSubscriptionList;
    } catch {
      throw new RevenueCatApiError('RevenueCat returned invalid JSON', response.status);
    }
    if (!Array.isArray(body.items)) {
      throw new RevenueCatApiError('RevenueCat returned an invalid subscription list', response.status);
    }

    for (const rawItem of body.items) {
      const subscription = rawItem as RevenueCatSubscription;
      if (
        subscription?.gives_access === true &&
        subscription.environment === environment &&
        hasJournalCloudEntitlement(subscription)
      ) {
        matchingExpirations.push(readExpiration(subscription));
      }
    }

    if (body.next_page === null || body.next_page === undefined || body.next_page === '') {
      const finiteExpirations = matchingExpirations.filter((value): value is number => value !== null);
      return {
        active: matchingExpirations.length > 0,
        expiresAtMs: finiteExpirations.length > 0 ? Math.max(...finiteExpirations) : null,
      };
    }
    if (typeof body.next_page !== 'string') {
      throw new RevenueCatApiError('RevenueCat returned an invalid pagination cursor');
    }

    const candidate = new URL(body.next_page, apiOrigin);
    const cursorEnvironment = candidate.searchParams.get('environment');
    if (
      candidate.origin !== apiOrigin ||
      candidate.pathname !== expectedPath ||
      (cursorEnvironment !== null && cursorEnvironment !== environment)
    ) {
      throw new RevenueCatApiError('RevenueCat returned an unsafe pagination URL');
    }
    // RevenueCat's documented next_page example omits the original environment
    // filter. Reapply it so later pages cannot broaden a production-only lookup.
    candidate.searchParams.set('environment', environment);
    nextUrl = candidate;
  }

  throw new RevenueCatApiError('RevenueCat pagination exceeded its safety limit');
};
