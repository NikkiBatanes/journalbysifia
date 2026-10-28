import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../supabaseClient';
import { getCachedScripturePassage, getScripturePassage, hydrateStoredScripturePassages, preloadScripturePassages } from '../scriptureReaderService';

jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn() }));
jest.mock('../supabaseClient', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
});

it('returns downloaded text without waiting for disk and exposes it synchronously by translation', async () => {
  (AsyncStorage.setItem as jest.Mock).mockReturnValue(new Promise(() => {}));
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { text: 'Long amplified passage', version: 'AMP' } });

  const result = await getScripturePassage('Isaiah 50:4', 'AMP');
  expect(result.text).toBe('Long amplified passage');
  expect(getCachedScripturePassage('Isaiah 50:4', 'amp')).toBe(result);
  expect(getCachedScripturePassage('Isaiah 50:4', 'NASB')).toBeNull();
  await expect(getScripturePassage('Isaiah 50:4', 'AMP')).resolves.toBe(result);
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
});

it('removes asterisk markup from passage text and verse lines', async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: {
      text: '*Jesus said,* “Follow Me.” ***',
      version: 'NASB',
      verses: [{ number: '19', lines: ['*Jesus said,* “Follow Me.”', '***'] }],
    },
  });

  const result = await getScripturePassage('Matthew 4:19', 'NASB');

  expect(result.text).toBe('Jesus said, “Follow Me.”');
  expect(result.verses).toEqual([{ number: '19', lines: ['Jesus said, “Follow Me.”'] }]);
});

it('preserves words-of-Jesus segments from the passage response', async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: {
      text: 'Jesus said, “I am the good shepherd.”',
      version: 'NASB',
      verses: [{
        number: '11',
        lines: ['Jesus said, “I am the good shepherd.”'],
        segments: [[
          {text: 'Jesus said, '},
          {text: '“I am the good shepherd.”', wordsOfJesus: true},
        ]],
      }],
    },
  });

  const result = await getScripturePassage('John 10:11', 'NASB');

  expect(result.verses?.[0].segments?.[0]).toEqual([
    {text: 'Jesus said, '},
    {text: '“I am the good shepherd.”', wordsOfJesus: true},
  ]);
});

it('restores a saved daily verse while offline without contacting the server', async () => {
  const saved = { text: 'Saved verse', reference: 'Psalm 4:8', version: 'AMP' };
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(saved));
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

  await expect(getScripturePassage('Psalm 4:8', 'AMP')).resolves.toEqual(saved);
  expect(getCachedScripturePassage('Psalm 4:8', 'AMP')).toEqual(saved);
  expect(NetInfo.fetch).not.toHaveBeenCalled();
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});

it('shares requests between preloading and opening Today', async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { text: 'Upcoming verse' } });
  await Promise.all([
    preloadScripturePassages(['Psalm 62:5'], 'AMP'),
    getScripturePassage('Psalm 62:5', 'AMP'),
  ]);
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
  expect(getCachedScripturePassage('Psalm 62:5', 'AMP')?.text).toBe('Upcoming verse');
});

it('hydrates saved passages for first-frame rendering without using the network', async () => {
  const saved = { text: 'Ready at launch', reference: 'Psalm 121:4', version: 'NLT' };
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(saved));

  await hydrateStoredScripturePassages(['Psalm 121:4'], 'NLT');

  expect(getCachedScripturePassage('Psalm 121:4', 'NLT')).toEqual(saved);
  expect(NetInfo.fetch).not.toHaveBeenCalled();
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
