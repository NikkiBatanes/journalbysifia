import {supabase} from './supabaseClient';

export type JournalCloudServerState = 'none' | 'active' | 'inactive';

export interface JournalCloudServerEntitlement {
  state: JournalCloudServerState;
  storageLimitBytes: number;
  expiresAt: string | null;
  lastVerifiedAt: string | null;
  serverAuthorized: boolean;
}

interface JournalCloudEntitlementRow {
  state: 'active' | 'inactive';
  storage_limit_bytes: number;
  source_environment: 'PRODUCTION' | 'SANDBOX';
  expires_at: string | null;
  last_verified_at: string;
}

const noEntitlement = (): JournalCloudServerEntitlement => ({
  state: 'none',
  storageLimitBytes: 0,
  expiresAt: null,
  lastVerifiedAt: null,
  serverAuthorized: false,
});

export const toJournalCloudServerEntitlement = (
  row: JournalCloudEntitlementRow | null,
  now = new Date(),
): JournalCloudServerEntitlement => {
  if (!row) {
    return noEntitlement();
  }

  const expirationIsCurrent = row.expires_at
    ? Number.isFinite(Date.parse(row.expires_at)) &&
      Date.parse(row.expires_at) > now.getTime()
    : true;
  const active =
    row.state === 'active' &&
    row.source_environment === 'PRODUCTION' &&
    expirationIsCurrent;

  return {
    state: active ? 'active' : 'inactive',
    storageLimitBytes: row.storage_limit_bytes,
    expiresAt: row.expires_at,
    lastVerifiedAt: row.last_verified_at,
    serverAuthorized: active,
  };
};

/**
 * Reads only the signed-in owner's server projection. RLS is the primary
 * boundary; deriving the UUID from Supabase Auth avoids accepting a target
 * account identifier from mobile UI code.
 */
export const getJournalCloudServerEntitlement =
  async (): Promise<JournalCloudServerEntitlement> => {
    const {
      data: {user},
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }
    if (!user) {
      return noEntitlement();
    }

    const {data, error} = await supabase
      .from('journal_cloud_entitlements')
      .select(
        'state,storage_limit_bytes,source_environment,expires_at,last_verified_at',
      )
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return toJournalCloudServerEntitlement(
      (data as JournalCloudEntitlementRow | null) ?? null,
    );
  };
