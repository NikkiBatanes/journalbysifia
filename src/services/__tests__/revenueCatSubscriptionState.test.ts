import {
  fetchJournalCloudSubscriptionState,
  RevenueCatApiError,
} from '../../../supabase/functions/_shared/revenueCatSubscriptionState';

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub-synthetic',
  gives_access: true,
  environment: 'production',
  current_period_ends_at: 1_900_000_000_000,
  ends_at: 1_900_000_000_000,
  entitlements: {items: [{lookup_key: 'journal_cloud'}]},
  ...overrides,
});

describe('RevenueCat authoritative subscription reconciliation', () => {
  it('returns active only for a matching access-giving subscription in the expected environment', async () => {
    const fetchImpl = jest.fn(async () => response({
      items: [
        subscription({environment: 'sandbox'}),
        subscription({gives_access: false}),
        subscription({entitlements: {items: [{lookup_key: 'other'}]}}),
        subscription({current_period_ends_at: 1_900_000_100_000}),
      ],
      next_page: null,
    }));

    await expect(fetchJournalCloudSubscriptionState({
      projectId: 'proj-synthetic',
      customerId: '18b0376c-0000-4000-8000-000000000001',
      apiKey: 'secret-synthetic',
      environment: 'PRODUCTION',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toEqual({active: true, expiresAtMs: 1_900_000_100_000});

    const requestUrl = new URL(fetchImpl.mock.calls[0][0] as unknown as string);
    expect(requestUrl.searchParams.get('environment')).toBe('production');
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: {Authorization: 'Bearer secret-synthetic'},
    });
  });

  it('returns inactive after following every safe pagination cursor', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response({
        items: [subscription({gives_access: false})],
        next_page: '/v2/projects/proj-synthetic/customers/user-synthetic/subscriptions?limit=100&starting_after=sub1',
      }))
      .mockResolvedValueOnce(response({items: [], next_page: null}));

    await expect(fetchJournalCloudSubscriptionState({
      projectId: 'proj-synthetic',
      customerId: 'user-synthetic',
      apiKey: 'secret-synthetic',
      environment: 'PRODUCTION',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toEqual({active: false, expiresAtMs: null});
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const secondPageUrl = new URL(fetchImpl.mock.calls[1][0] as unknown as string);
    expect(secondPageUrl.searchParams.get('environment')).toBe('production');
  });

  it('rejects provider failures and unsafe pagination URLs without inventing entitlement state', async () => {
    const denied = jest.fn(async () => response({error: 'denied'}, 403));
    await expect(fetchJournalCloudSubscriptionState({
      projectId: 'proj-synthetic',
      customerId: 'user-synthetic',
      apiKey: 'secret-synthetic',
      environment: 'PRODUCTION',
      fetchImpl: denied as unknown as typeof fetch,
    })).rejects.toEqual(expect.objectContaining<Partial<RevenueCatApiError>>({status: 403}));

    const redirected = jest.fn(async () => response({
      items: [],
      next_page: 'https://example.invalid/steal',
    }));
    await expect(fetchJournalCloudSubscriptionState({
      projectId: 'proj-synthetic',
      customerId: 'user-synthetic',
      apiKey: 'secret-synthetic',
      environment: 'PRODUCTION',
      fetchImpl: redirected as unknown as typeof fetch,
    })).rejects.toThrow('unsafe pagination URL');
  });
});
