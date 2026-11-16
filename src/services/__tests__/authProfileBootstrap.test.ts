import { authApi } from '../authApi';
import { supabase } from '../supabaseClient';
import { Logger } from '../../utils/ProductionLogger';

jest.mock('../supabaseClient', () => ({
  supabase: { auth: { getUser: jest.fn() }, rpc: jest.fn() },
}));
jest.mock('../../utils/ProductionLogger', () => ({
  Logger: { warn: jest.fn(), error: jest.fn() },
}));

const bootstrap = (userId = 'account-a') =>
  (authApi as unknown as { createDefaultProfile(id: string): Promise<unknown> }).createDefaultProfile(userId);
const getUser = supabase.auth.getUser as jest.Mock;
const rpc = supabase.rpc as jest.Mock;
const privateMarker = 'PRIVATE-PROFILE-MARKER-81';

beforeEach(() => {
  jest.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'account-a', email: 'owner@example.invalid' } }, error: null });
  rpc.mockResolvedValue({ data: { id: 'account-a', first_name: 'Owner' }, error: null });
});

function expectPrivateFailure() {
  expect(JSON.stringify((Logger.warn as jest.Mock).mock.calls)).not.toContain(privateMarker);
  expect(Logger.error).not.toHaveBeenCalled();
}

it('requests a profile only for the verified Auth user and preserves the owned response', async () => {
  const profile = { id: 'account-a', first_name: 'Owner', preferences: { unknown_future_field: true } };
  rpc.mockResolvedValue({ data: profile, error: null });
  await expect(bootstrap()).resolves.toBe(profile);
  expect(getUser).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('create_default_user_profile', {
    p_user_id: 'account-a', p_email: 'owner@example.invalid',
  });
  expect(Logger.warn).not.toHaveBeenCalled();
});

it.each([
  { data: { user: null }, error: null },
  { data: { user: { id: 'account-b', email: privateMarker } }, error: null },
  { data: { user: { id: 'account-a', email: 'owner@example.invalid' } }, error: { message: privateMarker } },
  { data: { user: { id: 'account-a', email: null } }, error: null },
  { data: { user: { id: 'account-a', email: '' } }, error: null },
])('makes no RPC request when identity is missing, mismatched, or unverified', async response => {
  getUser.mockResolvedValue(response);
  await expect(bootstrap()).resolves.toBeNull();
  expect(rpc).not.toHaveBeenCalled();
  expectPrivateFailure();
});

it('does not request another account profile from an otherwise valid session', async () => {
  await expect(bootstrap('account-b')).resolves.toBeNull();
  expect(rpc).not.toHaveBeenCalled();
});

it('handles rejected identity verification without retaining the original exception', async () => {
  getUser.mockRejectedValue(new Error(privateMarker));
  await expect(bootstrap()).resolves.toBeNull();
  expect(rpc).not.toHaveBeenCalled();
  expectPrivateFailure();
});

it('preserves a server denial after an account switch instead of retrying with different credentials', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '42501', message: privateMarker, details: privateMarker } });
  await expect(bootstrap()).resolves.toBeNull();
  expect(rpc).toHaveBeenCalledTimes(1);
  expectPrivateFailure();
});

it.each([null, [], { id: 'account-b', content: privateMarker }, { first_name: privateMarker }, privateMarker])(
  'rejects absent, malformed, and cross-account profile responses',
  async data => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(bootstrap()).resolves.toBeNull();
    expectPrivateFailure();
  },
);

it('handles rejected profile requests without logging personal data', async () => {
  rpc.mockRejectedValue(new Error(privateMarker));
  await expect(bootstrap()).resolves.toBeNull();
  expectPrivateFailure();
});
