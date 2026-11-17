import {toJournalCloudServerEntitlement} from '../journalCloudEntitlementService';

jest.mock('../supabaseClient', () => ({
  supabase: {},
}));

describe('Journal Cloud server entitlement projection', () => {
  const now = new Date('2026-11-17T12:00:00.000Z');

  it('does not authorize a missing projection', () => {
    expect(toJournalCloudServerEntitlement(null, now)).toEqual({
      state: 'none',
      storageLimitBytes: 0,
      expiresAt: null,
      lastVerifiedAt: null,
      serverAuthorized: false,
    });
  });

  it('authorizes only a current production active projection', () => {
    expect(
      toJournalCloudServerEntitlement(
        {
          state: 'active',
          storage_limit_bytes: 5368709120,
          source_environment: 'PRODUCTION',
          expires_at: '2026-12-17T12:00:00.000Z',
          last_verified_at: '2026-11-17T11:59:00.000Z',
        },
        now,
      ),
    ).toMatchObject({state: 'active', serverAuthorized: true});
  });

  it('never authorizes sandbox, inactive, or expired projections', () => {
    const base = {
      state: 'active' as const,
      storage_limit_bytes: 5368709120,
      source_environment: 'PRODUCTION' as const,
      expires_at: '2026-12-17T12:00:00.000Z',
      last_verified_at: '2026-11-17T11:59:00.000Z',
    };

    expect(
      toJournalCloudServerEntitlement(
        {...base, source_environment: 'SANDBOX'},
        now,
      ).serverAuthorized,
    ).toBe(false);
    expect(
      toJournalCloudServerEntitlement({...base, state: 'inactive'}, now)
        .serverAuthorized,
    ).toBe(false);
    expect(
      toJournalCloudServerEntitlement(
        {...base, expires_at: '2026-11-17T11:59:59.000Z'},
        now,
      ).serverAuthorized,
    ).toBe(false);
  });
});
