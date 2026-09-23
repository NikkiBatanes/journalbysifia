import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearPrayerV2DemoData, loadPrayerV2DemoScenario } from '../prayerV2DemoLoader';
import { PRAYER_V2_DEMO_PREFIX } from '../prayerV2DemoFixtures';

describe('Prayer V2 demo safety', () => {
  const data = new Map<string, string>();
  beforeEach(() => {
    data.clear();
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => { data.set(key, value); });
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => data.get(key) ?? null);
    (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(async () => [...data.keys()]);
    (AsyncStorage.multiRemove as jest.Mock).mockImplementation(async (keys: string[]) => { keys.forEach(key => data.delete(key)); });
    (AsyncStorage.clear as jest.Mock).mockImplementation(async () => { data.clear(); });
  });

  it('clears every demo Prayer and preserves normal Prayer and resurfacing state', async () => {
    await AsyncStorage.setItem('prayer_local_index:2026-09-20', JSON.stringify(['normal-prayer']));
    await AsyncStorage.setItem('prayer_local:2026-09-20:normal-prayer', JSON.stringify({ id: 'normal-prayer', content: 'Keep me' }));
    await AsyncStorage.setItem('review_local:weekly:normal-review', JSON.stringify({ id: 'normal-review' }));
    await AsyncStorage.setItem('gospel:normal', 'keep gospel');
    await AsyncStorage.setItem('bible_study_session:normal-session', JSON.stringify({ id: 'normal-session' }));
    await AsyncStorage.setItem('prayer-intelligence:local', JSON.stringify({ items: { 'normal-prayer:': { lastResurfacedAt: '2026-09-20' }, [`${PRAYER_V2_DEMO_PREFIX}return:`]: { dismissedUntil: '2026-09-22' } }, recentIds: ['normal-prayer:', `${PRAYER_V2_DEMO_PREFIX}return:`] }));
    await loadPrayerV2DemoScenario('full', new Date('2026-09-20T12:00:00.000Z'));
    expect((await AsyncStorage.getAllKeys()).some(key => key.includes(PRAYER_V2_DEMO_PREFIX))).toBe(true);
    await clearPrayerV2DemoData();
    expect(await AsyncStorage.getItem('prayer_local:2026-09-20:normal-prayer')).not.toBeNull();
    expect(await AsyncStorage.getItem('review_local:weekly:normal-review')).not.toBeNull();
    expect(await AsyncStorage.getItem('gospel:normal')).toBe('keep gospel');
    expect(await AsyncStorage.getItem('bible_study_session:normal-session')).not.toBeNull();
    expect((await AsyncStorage.getAllKeys()).filter(key => key.startsWith('prayer_local:') && key.includes(PRAYER_V2_DEMO_PREFIX))).toEqual([]);
    const state = JSON.parse(await AsyncStorage.getItem('prayer-intelligence:local') || '{}');
    expect(state.items['normal-prayer:']).toBeDefined();
    expect(state.items[`${PRAYER_V2_DEMO_PREFIX}return:`]).toBeUndefined();
  });

  it('has no Supabase, network, sync, notification, or cloud Prayer API dependency', () => {
    const root = path.resolve(__dirname, '..');
    const sources = ['prayerV2DemoFixtures.ts', 'prayerV2DemoLoader.ts'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
    expect(sources).not.toMatch(/supabase|fetch\(|axios|syncService|PrayerApi|notification/i);
  });

  it('keeps the gallery DEV-only, interactive through real flows, and on the production presentation', () => {
    const root = path.resolve(__dirname, '../..');
    const navigator = fs.readFileSync(path.join(root, 'navigation/JournalStackNavigator.tsx'), 'utf8');
    const demo = fs.readFileSync(path.join(root, 'dev/PrayerV2DemoScreen.tsx'), 'utf8');
    const gallery = fs.readFileSync(path.join(root, 'dev/TodayPrayerCardGalleryScreen.tsx'), 'utf8');
    const typeGallery = fs.readFileSync(path.join(root, 'dev/TodayPrayerTypeGallery.tsx'), 'utf8');
    const interactions = fs.readFileSync(path.join(root, 'dev/prayerV2DemoInteractions.ts'), 'utf8');
    const today = fs.readFileSync(path.join(root, 'screens/TodayScreen.tsx'), 'utf8');
    expect(navigator).toMatch(/\{__DEV__ && <Stack\.Screen[\s\S]*name="TodayPrayerCardGallery"/);
    expect(demo).toContain("navigation.navigate('TodayPrayerCardGallery')");
    expect(gallery).toContain('if (!__DEV__) return null');
    expect(gallery).toContain('<PrayerIntelligenceCardPresentation');
    expect(gallery).toContain('<TodayPrayerTypeGallery');
    expect(typeGallery).toContain('PRAYER TYPES');
    expect(typeGallery).toContain('PRAYER NEED CATEGORIES');
    expect(typeGallery).toContain('PRAYER REQUEST STATES');
    expect(typeGallery).toContain('SOURCE PRAYERS');
    for (const fixtureSuffix of ['return', 'cast-supplication', 'cast-thanksgiving', 'person-greg', 'request-unprayed', 'request-charles-response', 'mixed-needs', 'bible-study', 'playbook', 'devotional', 'let-go']) expect(typeGallery).toContain(`'${fixtureSuffix}'`);
    expect(typeGallery).toContain('PRAYER_V2_DEMO_NEED_TOPICS.flatMap');
    expect(typeGallery).toContain('DEV TYPE PREVIEW ONLY — NOT TODAY ELIGIBLE');
    expect(gallery).toContain('<PrayerTrackingModal');
    expect(gallery).toContain('<PrayerResponseSheet');
    expect(typeGallery).toContain("'request-unprayed'");
    expect(gallery).toContain('createPrayerV2DemoRequestResponse');
    expect(gallery).toContain('prayAgainPrayerV2Demo');
    expect(gallery).toContain('reloadPrayerV2DemoScenario');
    expect(interactions).toContain('persistPrayerUpdate');
    expect(interactions).toContain('assertPrayerV2DemoId');
    expect(gallery).toContain("request-prayed-response");
    expect(gallery).toContain('setOpen({ prayer, mode: \'details\', needId: candidate.needId })');
    expect(gallery).not.toMatch(/supabase|AsyncStorage|fetch\(/i);
    expect(interactions).not.toMatch(/supabase|fetch\(|axios|syncService|notification/i);
    expect(today.match(/<PrayerToRevisit/g)).toHaveLength(1);
  });

  it('offers the required DEV shortcuts for Needs, CAST, and Request states', () => {
    const root = path.resolve(__dirname, '..');
    const demo = fs.readFileSync(path.join(root, 'PrayerV2DemoScreen.tsx'), 'utf8');
    for (const label of ['Open Mixed Prayer Needs', 'Open CAST Demo', 'Open Unprayed Request', 'Open Prayed Request', 'Open Recently Followed-Up Request']) expect(demo).toContain(label);
  });

  it('routes gallery actions to exact fixture IDs and real flows', () => {
    const root = path.resolve(__dirname, '..');
    const gallery = fs.readFileSync(path.join(root, 'TodayPrayerCardGalleryScreen.tsx'), 'utf8');
    expect(gallery).toContain("return: 'return', check_in: 'check-in', follow_up: 'request-prayed-response', remember: 'remember', celebrate: 'one-answer'");
    expect(gallery).toContain('openRequestJourney(requestId)');
    expect(gallery).toContain("onView={() => setOpen({ prayer, mode: 'details', needId: candidate.needId })}");
    expect(gallery).toContain("mixed: `${PRAYER_V2_DEMO_PREFIX}mixed-needs`");
    expect(gallery).toContain("recent: `${PRAYER_V2_DEMO_PREFIX}request-recent`");
    expect(gallery).toContain('Prayer Request Journey');
    expect(gallery).toContain('requestJourney.request');
    expect(gallery).toContain('requestJourney.prayer');
    expect(gallery).toContain('useFocusEffect(useCallback(() => { void refresh(); }, [refresh]))');
    expect(gallery).toContain("DeviceEventEmitter.addListener('prayerSaved'");
    expect(gallery).toContain("onView={() => setOpen({ prayer, mode: 'details', needId: candidate.needId })}");
    expect(gallery).toContain('groupedEntries: castEntries');
    expect(gallery).toContain('PrayerCard prayer=');
    expect(gallery).toContain('onSave={changes => save(open.prayer, changes)}');
  });

  it('keeps the demo route DEV-only without exposing a Today launcher', () => {
    const root = path.resolve(__dirname, '../..');
    const today = fs.readFileSync(path.join(root, 'screens/TodayScreen.tsx'), 'utf8');
    const navigator = fs.readFileSync(path.join(root, 'navigation/JournalStackNavigator.tsx'), 'utf8');
    const screen = fs.readFileSync(path.join(root, 'dev/PrayerV2DemoScreen.tsx'), 'utf8');
    expect(today).not.toContain('prayer-v2-demo');
    expect(today).not.toContain('Prayer V2 demo data');
    expect(today).not.toContain("screen: 'PrayerV2Demo'");
    expect(navigator).toMatch(/\{__DEV__ && <Stack\.Screen[\s\S]*name="PrayerV2Demo"/);
    expect(screen).toContain('if (!__DEV__) return null');
    expect(screen).toContain("['return', 'Load Return Scenario']");
    expect(screen).toContain("['check_in', 'Load Check In Scenario']");
    expect(screen).toContain("['follow_up', 'Load Follow Up Scenario']");
    expect(screen).toContain("['remember', 'Load Remember Scenario']");
    expect(screen).toContain("['celebrate', 'Load Celebrate Scenario']");
  });
});
