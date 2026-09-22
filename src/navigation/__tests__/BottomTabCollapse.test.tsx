import React from 'react';
import {Animated, StyleSheet, Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import {CustomTabBarComponent} from '../BottomTabNavigator';
import {Colors} from '../../theme/colors';

let mockShowTabBar = true;
const mockSetShowTabBar = jest.fn();
jest.mock('../../context/ScrollContext', () => ({
  useScroll: () => ({showTabBar: mockShowTabBar, setShowTabBar: mockSetShowTabBar}),
}));
jest.mock('../../theme/ThemeContext', () => ({useTheme: () => ({currentFont: 'lexend'})}));
jest.mock('../../context/IndustryStandardAuthContext', () => ({useAuth: () => ({user: null})}));
jest.mock('../../services/experiencePreferences', () => ({
  experiencePreferences: {
    showTabLabelsEnabled: true,
    loadOnce: () => Promise.resolve(),
    subscribe: () => () => {},
  },
}));
jest.mock('../../components/common/ThemedText', () => 'ThemedText');
jest.mock('../../components/common/PrayerHandsIcon', () => 'PrayerHandsIcon');
// Reproduce the missing native glass surface without depending on UIKit in Jest.
jest.mock('../../components/common/LiquidGlassView', () => () => null);
jest.mock('@react-native-community/blur', () => ({BlurView: 'BlurView'}));
jest.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 62, bottom: 34, left: 0, right: 0})}));
jest.mock('react-native-svg', () => ({__esModule: true, default: 'Svg', Line: 'Line'}));
jest.mock('lucide-react-native', () => ({BookHeart: 'BookHeart', Feather: 'Feather', Heart: 'Heart', ListTodo: 'ListTodo', Pencil: 'Pencil', Sun: 'Sun'}));
jest.mock('@react-navigation/bottom-tabs', () => ({createBottomTabNavigator: () => ({})}));
jest.mock('../TodayStackNavigator', () => () => null);
jest.mock('../JournalStackNavigator', () => () => null);
jest.mock('../../screens/PrayerListScreen', () => () => null);
jest.mock('../../screens/UserProfileScreen', () => () => null);
jest.mock('../../utils/haptics', () => ({triggerLightHaptic: jest.fn()}));
jest.mock('../openPrayerFlow', () => ({openPrayerFlow: jest.fn()}));

const routes = ['Today', 'Journal', 'Prayer', 'More'].map(name => ({key: name, name}));
const navigation = {navigate: jest.fn(), emit: jest.fn(() => ({defaultPrevented: false}))};
const renderBar = (index = 1) => (
  <CustomTabBarComponent
    state={{key: 'tabs', type: 'tab', stale: false, index, routes, routeNames: routes.map(route => route.name), history: [], preloadedRouteKeys: []}}
    descriptors={{}}
    navigation={navigation}
  />
);
const opacity = (renderer: TestRenderer.ReactTestRenderer) => {
  const value = StyleSheet.flatten(renderer.root.findByProps({testID: 'expanded-tab-bar'}).props.style).opacity;
  return typeof value === 'number' ? value : value.__getValue();
};
let renderer: TestRenderer.ReactTestRenderer;

beforeEach(() => {
  jest.useFakeTimers();
  // Complete springs at start while keeping requestAnimationFrame queued, so
  // a stale collapse scheduled before an expand is observable deterministically.
  jest.spyOn(Animated, 'spring').mockImplementation(
    jest.requireActual('react-native/Libraries/Animated/AnimatedMock').default.spring,
  );
  mockShowTabBar = true;
  mockSetShowTabBar.mockClear();
});
afterEach(() => {
  act(() => {renderer?.unmount();});
  jest.clearAllTimers();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('keeps the latest expanded state when a collapse is immediately reversed', async () => {
  await act(async () => {renderer = TestRenderer.create(renderBar());});
  mockShowTabBar = false;
  act(() => {renderer.update(renderBar());});
  mockShowTabBar = true;
  act(() => {renderer.update(renderBar());});
  act(() => {jest.runOnlyPendingTimers();});

  expect(opacity(renderer)).toBe(1);
  expect(renderer.root.findAllByProps({testID: 'collapsed-tab-bar'})).toHaveLength(0);
});

it('mounts consistently when navigation is already collapsed', async () => {
  mockShowTabBar = false;
  await act(async () => {renderer = TestRenderer.create(renderBar());});
  expect(opacity(renderer)).toBe(0);
  expect(renderer.root.findAllByProps({testID: 'collapsed-tab-bar'})).not.toHaveLength(0);
});

it.each(routes.map((route, index) => [route.name, index] as const))(
  'keeps the %s capsule and label visible even when native glass is unavailable', async (name, index) => {
    mockShowTabBar = false;
    await act(async () => {renderer = TestRenderer.create(renderBar(index));});
    const capsule = renderer.root.findByProps({testID: 'collapsed-tab-bar'});
    expect(StyleSheet.flatten(capsule.props.style).backgroundColor).toBe(Colors.sage);
    expect(capsule.findByType(Text).props.children).toBe(name === 'Journal' ? 'Moments' : name === 'Prayer' ? 'Prayers' : name);
    act(() => {capsule.findByProps({accessibilityLabel: 'Expand navigation'}).props.onPress();});
    expect(mockSetShowTabBar).toHaveBeenCalledWith(true);
  },
);
