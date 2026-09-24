import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import { gospelShareService } from '../gospelShareService';

jest.mock('../supabaseClient', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    functions: { invoke: jest.fn() },
  },
}));
jest.mock('../journalImpactAnalyticsService', () => ({
  queueGospelImpactForShare: jest.fn().mockResolvedValue(undefined),
  queueGospelImpactRetraction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'random-owner-key') }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  jest.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as any);
  jest.mocked(supabase.functions.invoke).mockResolvedValue({ data: { token: 'token', url: 'https://example.com/gospel' }, error: null } as any);
});

it('sends the profile first and last name with a Gospel link', async () => {
  jest.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { user_metadata: { first_name: 'Nikki Mae', last_name: 'Batanes' } } },
    error: null,
  } as any);

  await gospelShareService.createLink('anna');

  expect(supabase.functions.invoke).toHaveBeenCalledWith('create-gospel-share', {
    body: expect.objectContaining({ senderName: 'Nikki Mae Batanes' }),
  });
});

it('uses the local onboarding first and last name without an account', async () => {
  jest.mocked(AsyncStorage.getItem).mockImplementation(async key => key === 'journal:onboarding:setup:v1'
    ? JSON.stringify({ firstName: 'Nikki', lastName: 'Batanes' })
    : null);

  await gospelShareService.createLink();

  expect(supabase.functions.invoke).toHaveBeenCalledWith('create-gospel-share', {
    body: expect.objectContaining({ senderName: 'Nikki Batanes' }),
  });
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

it('connects a shared response to a person using the private owner key', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('saved-owner-key');
  jest.mocked(supabase.functions.invoke).mockResolvedValue({data: {linked: true}, error: null} as any);

  await gospelShareService.linkResponseToPerson('link-1', 'person-mara');

  expect(supabase.functions.invoke).toHaveBeenCalledWith('create-gospel-share', {
    body: {
      action: 'link-person',
      linkId: 'link-1',
      personId: 'person-mara',
      ownerKey: 'saved-owner-key',
    },
  });
});
