// src/navigation/BottomTabNavigator.tsx
import React, { useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Pressable, TouchableOpacity, Animated, NativeModules, View, Text, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScroll } from '../context/ScrollContext';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { JournalScreenRef } from '../screens/JournalScreen';

import ThemedText from '../components/common/ThemedText';
import { Colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { getFontFamily } from '../theme/fonts';
import { TabBarIcons } from './TabBarIcons';
import TodayScreen from '../screens/TodayScreen';
import PrayerListScreen from '../screens/PrayerListScreen';
import UserProfileScreen from '../screens/UserProfileScreen';

// import JournalScreen from '../screens/JournalScreen'; // Unused - using JournalStackNavigator
import JournalStackNavigator from './JournalStackNavigator';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { experiencePreferences } from '../services/experiencePreferences';
import { triggerLightHaptic } from '../utils/haptics';

const Tab = createBottomTabNavigator();
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Define the props for our custom tab bar
type CustomTabBarProps = {
  state: TabNavigationState<ParamListBase>;
  descriptors: Record<string, any>;
  navigation: any;
};


// Glass-looking pill background - opaque blue with glass-like border
const PILL_BG = Colors.sage;

// Pill now occupies the full screen width
const PILL_WIDTH = Dimensions.get('window').width;
const PILL_HEIGHT = 56;
const TAB_CIRCLE_SIZE = 40;
const CIRCLE_SIZE = 48;

const LABELS: Record<string, string> = {
  Today: 'Today',
  Prayer: 'Prayer',
  Journal: 'Journal',
  More: 'More',
};

const TAB_ROOT_ROUTES: Record<string, string[]> = {
  Journal: ['JournalMain'],
};

// Custom tab bar — floating pill with smooth entrance/exit and per-tab bounce
const CustomTabBarComponent = ({
  state,
  descriptors: _descriptors,
  navigation,
}: CustomTabBarProps) => {
  const { showTabBar, setShowTabBar, setCollapsedTabBarCenterY } = useScroll();
  const theme = useTheme();
  const currentFont = theme.currentFont || 'lexend';
  const fontRegular = getFontFamily(currentFont, 'regular');
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const [showLabels, setShowLabels] = React.useState(experiencePreferences.showTabLabelsEnabled);
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const menuAnim = React.useRef(new Animated.Value(0)).current;
  const addButtonLayout = React.useRef({ x: 0, width: 0 });
  const collapsedCircleRef = React.useRef<any>(null);

  const publishCollapsedCircleCenter = React.useCallback(() => {
    requestAnimationFrame(() => {
      collapsedCircleRef.current?.measureInWindow?.(
        (_x: number, y: number, _width: number, height: number) => {
          setCollapsedTabBarCenterY(y + height / 2);
        },
      );
    });
  }, [setCollapsedTabBarCenterY]);

  React.useEffect(() => {
    Animated.spring(menuAnim, {
      toValue: showAddMenu ? 1 : 0,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [showAddMenu, menuAnim]);

  const addMenuItems = React.useMemo(
    () => [
      { icon: '▤', title: 'Sermon Notes', subtitle: 'Message, Scripture & reflection', target: 'Journal', params: { screen: 'SermonNotes' } },
      { icon: '✎', title: 'Heart Journal', subtitle: 'Write freely', target: 'Journal', params: { screen: 'ReflectionEditor' } },
      { icon: '◌', title: 'Emotional Check-In', subtitle: 'Notice and name how you feel', target: 'MorningFlow', params: { screen: 'EmotionCheckIn' } },
      { icon: '♡', title: 'Gratitude', subtitle: 'Remember what you\'re thankful for', target: 'Journal', params: { screen: 'JournalMoments' } },
      { icon: '☼', title: 'Reflection', subtitle: 'Choose a prompt', target: 'Journal', params: { screen: 'ReflectionEditor' } },
      { icon: '▱', title: 'Scripture Note', subtitle: 'Write about a passage', target: 'Journal', params: { screen: 'ScriptureNoteEditor' } },
      { icon: '♧', title: 'Prayer', subtitle: 'Open · CAST · Someone', target: 'Prayer' },
    ],
    []
  );

  const handleAddItem = (item: typeof addMenuItems[0]) => {
    triggerLightHaptic();
    setShowAddMenu(false);
    if (item.params) {
      navigation.navigate(item.target as any, item.params as any);
    } else {
      navigation.navigate(item.target as any);
    }
  };

  // Move the shared sliding selector under the add button when the menu is open
  React.useEffect(() => {
    if (showAddMenu) {
      updateSelectorPosition(addButtonLayout.current.x);
    } else {
      updateSelectorPosition(tabLayouts[state.index]?.x ?? 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddMenu]);

  const currentRouteName = state.routes[state.index].name;
  const activeTabRoute = state.routes[state.index] as any;
  const nestedState = activeTabRoute.state;
  const activeNestedRouteName = nestedState?.routes?.[nestedState.index ?? 0]?.name;
  const allowedRootRoutes = TAB_ROOT_ROUTES[currentRouteName];
  const isNestedDetailRoute = Boolean(
    activeNestedRouteName &&
    allowedRootRoutes &&
    !allowedRootRoutes.includes(activeNestedRouteName)
  );
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

  const updateSelectorPosition = React.useCallback((targetX: number) => {
    if (targetX === undefined || targetX === null) {return;}
    Animated.parallel([
      Animated.spring(selectorPosition, {
        toValue: targetX,
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
  }, [selectorPosition, selectorScaleX, selectorScaleY]);

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

  useEffect(() => {
    if (showTabBar || isReflect) {
      return;
    }
    const timer = setTimeout(publishCollapsedCircleCenter, 350);
    return () => clearTimeout(timer);
  }, [isReflect, publishCollapsedCircleCenter, showTabBar]);

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
      updateSelectorPosition(tabLayouts[state.index]?.x ?? 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, updateSelectorPosition]);

  const { onTabPress } = React.useContext(TabPressContext);

  // Animate the pill out for nested detail routes (e.g. SermonNotes)
  useEffect(() => {
    if (isReflect) {
      return;
    }
    if (isNestedDetailRoute) {
      Animated.spring(pillAnim, {
        toValue: 0,
        tension: 55,
        friction: 14,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(pillAnim, {
        toValue: 1,
        tension: 55,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }
  }, [isNestedDetailRoute, isReflect, pillAnim]);

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
  const CIRCLE_RATIO = CIRCLE_SIZE / PILL_WIDTH;
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
    if (name === 'Today')       { return <Ionicons name="sunny-outline" size={22} color={INACTIVE_CIRCLE_COLOR} />; }
    if (name === 'Prayer')      { return <Ionicons name="hand-left-outline" size={22} color={INACTIVE_CIRCLE_COLOR} />; }
    if (name === 'Journal')     { return <MaterialCommunityIcons name="notebook-edit" size={22} color={INACTIVE_CIRCLE_COLOR} />; }
    if (name === 'More')        { return <Ionicons name="ellipsis-horizontal" size={22} color={INACTIVE_CIRCLE_COLOR} />; }
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
      {/* ── Add menu dim — behind the pill and menu ───────── */}
      <AnimatedPressable
        style={[
          styles.addMenuDim,
          { top: -(screenHeight - insets.bottom - 64), bottom: -insets.bottom, opacity: menuAnim },
        ]}
        pointerEvents={showAddMenu ? 'auto' : 'none'}
        onPress={() => setShowAddMenu(false)}
      />

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
              { width: `${100 / (state.routes.length + 1)}%` },
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
          {state.routes.flatMap((route, index) => {
            const isFocused = state.index === index;
            const iconColor = Colors.hopeWhite;

            const onPress = () => {
              setShowAddMenu(false);
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              updateSelectorPosition(tabLayouts[index]?.x ?? 0);
              onTabPress(route.name);
              if (!event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const icon = (() => {
              if (route.name === 'Today')       { return <Ionicons name={isFocused ? 'sunny' : 'sunny-outline'} size={20} color={iconColor} />; }
              if (route.name === 'Prayer')      { return <Ionicons name={isFocused ? 'hand-left' : 'hand-left-outline'} size={20} color={iconColor} />; }
              if (route.name === 'Journal')     { return <MaterialCommunityIcons name={isFocused ? 'notebook-edit' : 'notebook'} size={20} color={iconColor} />; }
              if (route.name === 'More')        { return <Ionicons name={isFocused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'} size={20} color={iconColor} />; }
              const iconName = isFocused
                ? TabBarIcons[route.name as keyof typeof TabBarIcons]?.focused
                : TabBarIcons[route.name as keyof typeof TabBarIcons]?.name;
              return <Ionicons name={iconName} size={20} color={iconColor} />;
            })();

            return [
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
              </Animated.View>,
              index === 1 && (
                <View
                  key="add"
                  style={styles.pillTab}
                  onLayout={(e) => {
                    addButtonLayout.current.x = e.nativeEvent.layout.x;
                    addButtonLayout.current.width = e.nativeEvent.layout.width;
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      triggerLightHaptic();
                      setShowAddMenu(!showAddMenu);
                    }}
                    activeOpacity={0.8}
                    style={styles.pillTabTouchable}
                  >
                    <MaterialCommunityIcons name="pencil-plus-outline" size={24} color={Colors.hopeWhite} />
                  </TouchableOpacity>
                </View>
              ),
            ];
          })}
          </Animated.View>
        </View>
      </Animated.View>

      {/* ── Add menu — appears above the tab bar ─────────── */}
      <Animated.View
        style={[
          styles.addMenu,
          {
            opacity: menuAnim,
            transform: [
              { translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
            ],
          },
        ]}
        pointerEvents={showAddMenu ? 'auto' : 'none'}
      >
        <ThemedText weight="bold" style={styles.addMenuTitle}>
          What would you like to write?
        </ThemedText>
        <ThemedText style={styles.addMenuSubtitle}>
          Jump straight into a full-screen journal.
        </ThemedText>
        {addMenuItems.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.addMenuItem}
            onPress={() => handleAddItem(item)}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.addMenuIcon}>{item.icon}</ThemedText>
            <View style={styles.addMenuItemText}>
              <ThemedText weight="semiBold" style={styles.addMenuItemTitle}>{item.title}</ThemedText>
              <ThemedText style={styles.addMenuItemSubtitle}>{item.subtitle}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.hopeWhite} />
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* ── Collapsed circle (fades in from left as pill collapses) ─────── */}
      <Animated.View
        style={[styles.collapsedCircle, { opacity: circleOpacity }]}
        pointerEvents={showTabBar ? 'none' : 'box-none'}
      >
        <TouchableOpacity
          ref={collapsedCircleRef}
          onLayout={publishCollapsedCircleCenter}
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
      initialRouteName="Today"
      // anchorBlue scene container fills the full screen behind every tab screen,
      // so scrollable content gaps and the safe-area floor never show white.
      // tabBarStyle position:absolute stops RN from reserving space for the floating pill.
      // @ts-ignore — sceneContainerStyle works at runtime; type added in a later @react-navigation/bottom-tabs version
      sceneContainerStyle={{ backgroundColor: Colors.sage }}
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
        name="Today"
        component={TodayScreen}
        options={{
          tabBarLabel: 'Today',
          title: 'Today',
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
      <Tab.Screen
        name="Prayer"
        component={PrayerListScreen as React.ComponentType<any>}
        options={{
          tabBarLabel: 'Prayer',
          title: 'Prayer',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="More"
        component={UserProfileScreen as React.ComponentType<any>}
        options={{
          tabBarLabel: 'More',
          title: 'More',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  // Full-width absolute anchor (no side margins)
  pillWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  // Floating pill — full width, slightly smaller to fit icon + label
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    backgroundColor: PILL_BG,
    borderWidth: 1,
    borderColor: Colors.sageMuted,
    paddingHorizontal: 4,
    shadowColor: Colors.darkBackground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  // Shared container — selector and tabs both reference x=0 from here
  pillInner: {
    flex: 1,
    height: TAB_CIRCLE_SIZE,
  },
  // Each tab: Animated.View takes equal share, scale bounce applies here
  pillTab: {
    flex: 1,
    height: TAB_CIRCLE_SIZE,
    borderRadius: TAB_CIRCLE_SIZE / 2,
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
    height: TAB_CIRCLE_SIZE,
    borderRadius: TAB_CIRCLE_SIZE / 2,
    backgroundColor: Colors.sageMuted,
  },
  pillLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  // Add menu — appears above the tab bar
  addMenuDim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -500,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  addMenu: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 76,
    backgroundColor: PILL_BG,
    borderRadius: 22,
    padding: 16,
    shadowColor: Colors.darkBackground,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
  },
  addMenuTitle: {
    color: Colors.hopeWhite,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
  },
  addMenuSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 4,
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  addMenuIcon: {
    width: 28,
    textAlign: 'center',
    fontSize: 20,
    color: Colors.hopeWhite,
  },
  addMenuItemText: {
    flex: 1,
  },
  addMenuItemTitle: {
    color: Colors.hopeWhite,
    fontSize: 15,
    lineHeight: 20,
  },
  addMenuItemSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  // Collapsed circle — sits at left edge of pillWrapper
  collapsedCircle: {
    position: 'absolute',
    left: 0,
    top: (PILL_HEIGHT - CIRCLE_SIZE) / 2,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: PILL_BG,
    borderWidth: 1,
    borderColor: Colors.sageMuted,
    shadowColor: Colors.darkBackground,
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
