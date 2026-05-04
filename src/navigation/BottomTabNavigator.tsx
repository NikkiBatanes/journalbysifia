// src/navigation/BottomTabNavigator.tsx
import React, { useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, TouchableOpacity, Animated, NativeModules, View, Text, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScroll } from '../context/ScrollContext';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { JournalScreenRef } from '../screens/JournalScreen';

import { Colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { getFontFamily } from '../theme/fonts';
import { TabBarIcons } from './TabBarIcons';
import PlaybookListScreen from '../screens/PlaybookListScreen';

import DevotionalsScreen from '../screens/DevotionalsScreen';
// import JournalScreen from '../screens/JournalScreen'; // Unused - using JournalStackNavigator
import JournalStackNavigator from './JournalStackNavigator';
import HomeStackNavigator from './HomeStackNavigator';
import UserInputScreen from '../screens/UserInputScreen';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { experiencePreferences } from '../services/experiencePreferences';
import { triggerLightHaptic } from '../utils/haptics';

const Tab = createBottomTabNavigator();

// Define the props for our custom tab bar
type CustomTabBarProps = {
  state: TabNavigationState<ParamListBase>;
  descriptors: Record<string, any>;
  navigation: any;
};


// Glass-looking pill background - opaque blue with glass-like border
const PILL_BG = '#264777';

// Pill occupies screen width minus 16px margin on each side
const PILL_WIDTH = Dimensions.get('window').width - 32;

const LABELS: Record<string, string> = {
  Reflect: 'Reflect',
  Overview: 'Overview',
  Playbooks: 'Playbooks',
  Devotionals: 'Devotionals',
  Journal: 'Journal',
};

// Custom tab bar — floating pill with smooth entrance/exit and per-tab bounce
const CustomTabBarComponent = ({
  state,
  descriptors: _descriptors,
  navigation,
}: CustomTabBarProps) => {
  const { showTabBar, setShowTabBar } = useScroll();
  const theme = useTheme();
  const currentFont = theme.currentFont || 'lexend';
  const fontRegular = getFontFamily(currentFont, 'regular');
  const insets = useSafeAreaInsets();
  const [showLabels, setShowLabels] = React.useState(experiencePreferences.showTabLabelsEnabled);

  const currentRouteName = state.routes[state.index].name;
  const isReflect = currentRouteName === 'Reflect';

  // ── Pill visibility: opacity + translateY ────────────────────────────────
  // 0 = hidden below screen, 1 = visible in place
  const pillAnim = React.useRef(new Animated.Value(isReflect ? 0 : 1)).current;

  // ── Collapse-to-circle: 0 = full pill, 1 = collapsed circle ──────────────
  // Starts collapsed if already on Reflect
  const collapseAnim = React.useRef(new Animated.Value(isReflect ? 1 : 0)).current;

  // ── Sliding selector position ───────────────────────────────────────────────
  const selectorPosition = React.useRef(new Animated.Value(0)).current;
  const selectorScaleX = React.useRef(new Animated.Value(1)).current;
  const selectorScaleY = React.useRef(new Animated.Value(1)).current;
  const tabLayouts = React.useRef<{ x: number; width: number }[]>([]).current;

  const updateSelectorPosition = React.useCallback((index: number) => {
    if (tabLayouts.length === 0) {return;}
    const tab = tabLayouts[index];
    Animated.parallel([
      Animated.spring(selectorPosition, {
        toValue: tab.x,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.parallel([
          Animated.spring(selectorScaleX, { toValue: 1.15, tension: 200, friction: 8, useNativeDriver: true }),
          Animated.spring(selectorScaleY, { toValue: 1.05, tension: 200, friction: 8, useNativeDriver: true }),
        ]),
        Animated.delay(100),
        Animated.parallel([
          Animated.spring(selectorScaleX, { toValue: 1,    tension: 180, friction: 10, useNativeDriver: true }),
          Animated.spring(selectorScaleY, { toValue: 1,    tension: 200, friction: 12, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, [selectorPosition, selectorScaleX, selectorScaleY, tabLayouts]);

  const handleTabLayout = React.useCallback((index: number) => (event: any) => {
    const { x } = event.nativeEvent.layout;
    tabLayouts[index] = { x, width: event.nativeEvent.layout.width };
    if (state.index === index) {
      selectorPosition.setValue(x);
    }
  }, [state.index, selectorPosition, tabLayouts]);

  // ── Sync show-labels preference ────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    (async () => {
      await experiencePreferences.loadOnce();
      if (isMounted) { setShowLabels(experiencePreferences.showTabLabelsEnabled); }
    })();
    const unsub = experiencePreferences.subscribe(() => {
      setShowLabels(experiencePreferences.showTabLabelsEnabled);
    });
    return () => { isMounted = false; unsub(); };
  }, []);

  // ── Scroll-driven collapse-to-circle (only when not on Reflect) ──────────
  useEffect(() => {
    if (isReflect) { return; }
    if (!showTabBar) {
      // Collapse: pill shape fades + contracts leftward. Selector stays in place
      // (invisible because pillShapeOpacity → 0) — no separate slide animation.
      Animated.spring(collapseAnim, {
        toValue: 1,
        tension: 55,
        friction: 14,
        useNativeDriver: true,
      }).start();
    } else {
      // Expand: snap selector to active tab BEFORE pill grows so it's already
      // in place when it becomes visible — no sliding artifact.
      const target = tabLayouts[state.index];
      if (target) { selectorPosition.setValue(target.x); }
      Animated.spring(collapseAnim, {
        toValue: 0,
        tension: 65,
        friction: 13,
        useNativeDriver: true,
      }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTabBar, isReflect]);

  // ── Route-change animations ────────────────────────────────────────────────
  const prevRouteRef = React.useRef<string>(currentRouteName);
  const isFirstRenderRef = React.useRef(true);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevRouteRef.current = currentRouteName;
      return;
    }

    const prev = prevRouteRef.current;
    prevRouteRef.current = currentRouteName;

    if (isReflect) {
      // Going TO Reflect — collapse to circle, then slide UP and fade out (mirrors entrance)
      Animated.sequence([
        Animated.spring(collapseAnim, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(pillAnim, { toValue: 0, tension: 55, friction: 14, useNativeDriver: true }),
      ]).start();

    } else if (prev === 'Reflect') {
      // Coming FROM Reflect — slide circle up from below, then expand into full pill
      collapseAnim.setValue(1);
      pillAnim.setValue(0);
      const target = tabLayouts[state.index];
      if (target) { selectorPosition.setValue(target.x); }
      Animated.sequence([
        Animated.delay(120),
        Animated.spring(pillAnim, { toValue: 1, tension: 55, friction: 12, useNativeDriver: true }),
      ]).start(() => {
        Animated.spring(collapseAnim, {
          toValue: 0,
          tension: 65,
          friction: 13,
          useNativeDriver: true,
        }).start();
      });
    } else {
      // Normal tab→tab: move selector smoothly
      updateSelectorPosition(state.index);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, updateSelectorPosition]);

  const { onTabPress } = React.useContext(TabPressContext);

  // pillAnim 0→1 drives: opacity 0→1 + translateY 28→0 (entrance/exit mirror)
  const pillOpacity   = pillAnim;
  const pillTranslateY = pillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  // collapseAnim 0→1: content fades early, pill shape fades+contracts, circle fades in late
  const pillContentOpacity = collapseAnim.interpolate({
    inputRange: [0, 0.35],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  // Pill shape (background/border) fades out as it collapses so no ghost remains
  const pillShapeOpacity = collapseAnim.interpolate({
    inputRange: [0, 0.7],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const circleOpacity = collapseAnim.interpolate({
    inputRange: [0.5, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  // Pill shape grows left→right on expand: scaleX from circle ratio → 1, pinned at left edge
  const CIRCLE_RATIO = 56 / PILL_WIDTH;
  const pillShapeScaleX = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, CIRCLE_RATIO],
    extrapolate: 'clamp',
  });
  // translateX compensation to pin the left edge during scale
  const pillShapeTranslateX = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(PILL_WIDTH / 2) * (1 - CIRCLE_RATIO)],
    extrapolate: 'clamp',
  });

  // Icon for the collapsed circle — active tab in inactive color
  const INACTIVE_CIRCLE_COLOR = Colors.hopeWhite;
  const circleIcon = (() => {
    const name = state.routes[state.index].name;
    if (name === 'Reflect')     { return <MaterialIcons name="auto-fix-high" size={22} color={INACTIVE_CIRCLE_COLOR} />; }
    if (name === 'Overview')    { return <MaterialIcons name="space-dashboard" size={22} color={INACTIVE_CIRCLE_COLOR} />; }
    if (name === 'Playbooks')   { return <MaterialCommunityIcons name="clipboard-text-play" size={22} color={INACTIVE_CIRCLE_COLOR} />; }
    if (name === 'Devotionals') { return <MaterialCommunityIcons name="book" size={22} color={INACTIVE_CIRCLE_COLOR} />; }
    if (name === 'Journal')     { return <MaterialCommunityIcons name="notebook-edit" size={22} color={INACTIVE_CIRCLE_COLOR} />; }
    return <Ionicons name="apps-outline" size={22} color={INACTIVE_CIRCLE_COLOR} />;
  })();

  return (
    <Animated.View
      style={[
        styles.pillWrapper,
        {
          bottom: Math.max(insets.bottom, 8),
          opacity: pillOpacity,
          transform: [{ translateY: pillTranslateY }],
        },
      ]}
      pointerEvents={isReflect ? 'none' : 'box-none'}
    >
      {/* ── Full pill: shape scales left→right, content fades separately ─── */}
      <Animated.View
        style={[
          styles.pill,
          {
            opacity: pillShapeOpacity,
            transform: [
              { translateX: pillShapeTranslateX },
              { scaleX: pillShapeScaleX },
            ],
          },
        ]}
        pointerEvents="box-none"
      >
        {/* pillInner: shared coordinate system for selector + tabs.
            Selector is absolute here; tabs fill the same space via absoluteFillObject.
            Both use x=0 as origin → onLayout x values align with selector translateX. */}
        <View style={styles.pillInner}>
          {/* Sliding selector — absolute within pillInner */}
          <Animated.View
            style={[
              styles.slidingSelector,
              {
                transform: [
                  { translateX: selectorPosition },
                  { scaleX: selectorScaleX },
                  { scaleY: selectorScaleY },
                ],
              },
            ]}
          />
          {/* Tabs overlay — same bounds as pillInner, fade independently */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { flexDirection: 'row', opacity: pillContentOpacity }]}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const iconColor = isFocused ? theme.colors.alertCoral : Colors.hopeWhite;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              updateSelectorPosition(index);
              onTabPress(route.name);
              if (!event.defaultPrevented) {
                if (route.name === 'Overview') {
                  navigation.navigate('Overview', { screen: 'DashboardHome' });
                } else {
                  navigation.navigate(route.name);
                }
              }
            };

            const icon = (() => {
              if (route.name === 'Reflect')     { return <MaterialIcons name="auto-fix-high" size={20} color={iconColor} />; }
              if (route.name === 'Overview')    { return <MaterialIcons name="space-dashboard" size={20} color={iconColor} />; }
              if (route.name === 'Playbooks')   { return <MaterialCommunityIcons name="clipboard-text-play" size={20} color={iconColor} />; }
              if (route.name === 'Devotionals') { return <MaterialCommunityIcons name="book" size={20} color={iconColor} />; }
              if (route.name === 'Journal')     { return <MaterialCommunityIcons name="notebook-edit" size={20} color={iconColor} />; }
              const iconName = isFocused
                ? TabBarIcons[route.name as keyof typeof TabBarIcons]?.focused
                : TabBarIcons[route.name as keyof typeof TabBarIcons]?.name;
              return <Ionicons name={iconName} size={20} color={iconColor} />;
            })();

            return (
              <Animated.View
                key={route.key}
                style={[styles.pillTab, isFocused && styles.pillTabActive]}
                onLayout={handleTabLayout(index)}
              >
                <TouchableOpacity
                  onPress={onPress}
                  activeOpacity={0.8}
                  style={styles.pillTabTouchable}
                >
                  {icon}
                  {showLabels && (
                    <Text style={[styles.pillLabel, { color: iconColor, fontFamily: fontRegular }]}>
                      {LABELS[route.name] ?? route.name}
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
          </Animated.View>
        </View>
      </Animated.View>

      {/* ── Collapsed circle (fades in from left as pill collapses) ─────── */}
      <Animated.View
        style={[styles.collapsedCircle, { opacity: circleOpacity }]}
        pointerEvents={showTabBar ? 'none' : 'box-none'}
      >
        <TouchableOpacity
          style={styles.collapsedCircleTouchable}
          activeOpacity={0.8}
          onPress={() => { try { triggerLightHaptic(); } catch {} setShowTabBar(true); }}
        >
          {circleIcon}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

// Main App Tabs
interface BottomTabNavigatorProps {
  onLogout: () => void;
}


// Create a context to share tab press handlers
const TabPressContext = React.createContext<{
  onTabPress: (tabName: string) => void;
}>({ onTabPress: () => {} });

export default function BottomTabNavigator({ onLogout: _onLogout }: BottomTabNavigatorProps) {
  const theme = useTheme();
  const { user } = useAuth();
  const currentTabRef = React.useRef<string>('UserInput');
  const journalScreenRef = React.useRef<JournalScreenRef>(null);

  // Subtle haptic feedback, gated by user preference
  const triggerTabHaptic = React.useCallback(() => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) { return; }
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) { return; }
      // dynamic require to avoid TurboModule issues
      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      }
    } catch {}
  }, [user]);

  // Handle tab press — uses ref for currentTab so handleTabPress stays stable and
  // renderTabBar never gets a new reference on every press (prevents full navigator re-render)
  const handleTabPress = React.useCallback((tabName: string) => {
    triggerLightHaptic();
    if (tabName === 'Journal' && currentTabRef.current === 'Journal' && journalScreenRef.current) {
      journalScreenRef.current.resetToCurrentDate();
    }
    currentTabRef.current = tabName;
    triggerTabHaptic();
  }, [triggerTabHaptic]);

  // Move tabBar render function outside
  const renderTabBar = React.useCallback(
    (props: any) => (
      <TabPressContext.Provider value={{ onTabPress: handleTabPress }}>
        <CustomTabBarComponent {...props} />
      </TabPressContext.Provider>
    ),
    [handleTabPress]
  );

  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      // anchorBlue scene container fills the full screen behind every tab screen,
      // so scrollable content gaps and the safe-area floor never show white.
      // tabBarStyle position:absolute stops RN from reserving space for the floating pill.
      // @ts-ignore — sceneContainerStyle works at runtime; type added in a later @react-navigation/bottom-tabs version
      sceneContainerStyle={{ backgroundColor: Colors.anchorBlue }}
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: theme.colors.anchorBlue,
        },
        headerTintColor: theme.colors.hopeWhite,
        headerTitleStyle: {
          color: theme.colors.hopeWhite,
        },
        tabBarStyle: { position: 'absolute' },
      }}
    >
      <Tab.Screen
        name="Reflect"
        component={UserInputScreen}
        options={{
          tabBarLabel: 'Reflect',
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="Overview"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Overview',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Playbooks"
        component={PlaybookListScreen}
        options={{
          tabBarLabel: 'Playbooks',
          title: 'Playbooks',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Devotionals"
        component={DevotionalsScreen}
        options={{
          tabBarLabel: 'Devotionals',
          title: 'Devotionals',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Journal"
        component={JournalStackNavigator}
        options={{
          tabBarLabel: 'Journal',
          title: 'Journal',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  // Full-width absolute anchor with side margins
  pillWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  // Floating pill — full width, taller to fit icon + label
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderRadius: 32,
    backgroundColor: PILL_BG,
    borderWidth: 1,
    borderColor: '#3d5e8d',
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  // Shared container — selector and tabs both reference x=0 from here
  pillInner: {
    flex: 1,
    height: 48,
  },
  // Each tab: Animated.View takes equal share, scale bounce applies here
  pillTab: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // TouchableOpacity fills the tab, lays out icon + label
  pillTabTouchable: {
    flex: 1,
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  pillTabActive: {
    backgroundColor: 'transparent',
  },
  slidingSelector: {
    position: 'absolute',
    height: 48,
    width: '20%',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
  },
  pillLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  // Collapsed circle — sits at left edge of pillWrapper
  collapsedCircle: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PILL_BG,
    borderWidth: 1,
    borderColor: '#3d5e8d',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapsedCircleTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
