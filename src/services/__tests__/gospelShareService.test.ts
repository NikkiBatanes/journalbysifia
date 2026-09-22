import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import { gospelShareService } from '../gospelShareService';

jest.mock('../supabaseClient', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'random-owner-key') }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  jest.mocked(supabase.functions.invoke).mockResolvedValue({ data: { token: 'token', url: 'https://example.com/gospel' }, error: null } as any);
});

it('shares one persisted owner key across concurrent links for different recipients', async () => {
  await Promise.all([gospelShareService.createLink('anna'), gospelShareService.createLink('ben'), gospelShareService.createLink()]);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  const ownerKey = jest.mocked(AsyncStorage.setItem).mock.calls[0][1];
  for (const personId of ['anna', 'ben', undefined]) {
    expect(supabase.functions.invoke).toHaveBeenCalledWith('create-gospel-share', {
      body: { personId, ownerKey, senderName: undefined },
    });
  }
});

it('retries owner-key initialization after storage fails', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(gospelShareService.createLink('anna')).rejects.toThrow('Storage unavailable');
  await expect(gospelShareService.createLink('anna')).resolves.toMatchObject({ token: 'token' });
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
});
