// src/navigation/BottomTabNavigator.tsx
import React, { useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, TouchableOpacity, Animated, NativeModules, View, Text } from 'react-native';
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

const Tab = createBottomTabNavigator();

// Define the props for our custom tab bar
type CustomTabBarProps = {
  state: TabNavigationState<ParamListBase>;
  descriptors: Record<string, any>;
  navigation: any;
};


// Solid-color equivalent of rgba(255,255,255,0.15) composited on anchorBlue #1a3c6d
// R: 26*0.85+255*0.15=60  G: 60*0.85+255*0.15=89  B: 109*0.85+255*0.15=131
const PILL_BG = '#264777';

const LABELS: Record<string, string> = {
  Reflect: 'Reflect',
  Overview: 'Home',
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
  const { showTabBar } = useScroll();
  const theme = useTheme();
  const currentFont = theme.currentFont || 'lexend';
  const fontRegular = getFontFamily(currentFont, 'regular');
  const insets = useSafeAreaInsets();
  const [showLabels, setShowLabels] = React.useState(experiencePreferences.showTabLabelsEnabled);

  const currentRouteName = state.routes[state.index].name;
  const isReflect = currentRouteName === 'Reflect';

  // ── Pill visibility: fade + slide up/down ─────────────────────────────────
  // Single value drives both: 0 = hidden below screen, 1 = visible in place.
  const pillAnim = React.useRef(new Animated.Value(isReflect ? 0 : 1)).current;

  // ── Per-tab bounce on activation ──────────────────────────────────────────
  // Indexed by route position — wrap the whole tab item so icon+bg both bounce.
  const tabScaleAnims = React.useRef(
    state.routes.map(() => new Animated.Value(1))
  ).current;

  const bounceTab = React.useCallback((index: number) => {
    const anim = tabScaleAnims[index];
    anim.stopAnimation();
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.12, tension: 200, friction: 12, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1,    tension: 180, friction: 14, useNativeDriver: true }),
    ]).start();
  }, [tabScaleAnims]);

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

  // ── Scroll-driven hide/show (only when not on Reflect) ────────────────────
  useEffect(() => {
    if (isReflect) { return; }
    Animated.spring(pillAnim, {
      toValue: showTabBar ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 14,
    }).start();
  }, [showTabBar, isReflect, pillAnim]);

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
      // Going TO Reflect — slide pill down and fade out
      Animated.spring(pillAnim, {
        toValue: 0,
        tension: 70,
        friction: 14,
        useNativeDriver: true,
      }).start();

    } else if (prev === 'Reflect') {
      // Coming FROM Reflect — delay, slide pill up + fade in, then bounce the landed tab.
      // onPress won't fire for this case (navigation came from UserInput's own nav UI),
      // so this is the only place that triggers the bounce for it.
      pillAnim.setValue(0);
      Animated.sequence([
        Animated.delay(120),
        Animated.spring(pillAnim, {
          toValue: 1,
          tension: 55,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start(() => bounceTab(state.index));
    }
    // Normal tab→tab: bounce fires directly in onPress (correct index, no stale closure).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  const { onTabPress } = React.useContext(TabPressContext);

  // pillAnim 0→1 drives: opacity 0→1, translateY 28→0
  const pillOpacity   = pillAnim;
  const pillTranslateY = pillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

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
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const iconColor = isFocused ? theme.colors.alertCoral : Colors.hopeWhite;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            // Fire bounce immediately at press time — index is captured from
            // the map closure so it's always correct, no stale state.index risk.
            bounceTab(index);
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
            // Animated.View wraps the whole tab item so scale bounces
            // icon + label + active background together — not just the inner content.
            <Animated.View
              key={route.key}
              style={[
                styles.pillTab,
                isFocused && styles.pillTabActive,
                { transform: [{ scale: tabScaleAnims[index] }] },
              ]}
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
      </View>
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
  const [currentTab, setCurrentTab] = React.useState<string>('UserInput');
  const journalScreenRef = React.useRef<JournalScreenRef>(null);

  // Subtle haptic feedback, gated by user preference
  const triggerLightHaptic = React.useCallback(() => {
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

  // Handle tab press
  const handleTabPress = React.useCallback((tabName: string) => {
    // Fire subtle haptic on any tab press (if enabled)
    triggerLightHaptic();
    if (tabName === 'Journal' && currentTab === 'Journal' && journalScreenRef.current) {
      // Toggle between current date and last selected date
      journalScreenRef.current.resetToCurrentDate();
    }
    setCurrentTab(tabName);
  }, [currentTab, triggerLightHaptic]);

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
    borderRadius: 36,
    backgroundColor: PILL_BG,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 16,
  },
  // Each tab: Animated.View takes equal share, scale bounce applies here
  pillTab: {
    flex: 1,
    height: 56,
    borderRadius: 28,
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
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pillLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
