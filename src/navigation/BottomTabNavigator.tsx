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

// Custom tab bar — floating centered pill, mirroring the UserInput expanded nav style
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
  const translateY = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(1)).current;
  const [showLabels, setShowLabels] = React.useState(experiencePreferences.showTabLabelsEnabled);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: showTabBar ? 0 : 120,
        useNativeDriver: true,
        bounciness: 0,
      }),
      Animated.timing(opacity, {
        toValue: showTabBar ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showTabBar, translateY, opacity]);

  // Sync showLabels with persisted preference and listen for live changes
  useEffect(() => {
    let isMounted = true;
    (async () => {
      await experiencePreferences.loadOnce();
      if (isMounted) { setShowLabels(experiencePreferences.showTabLabelsEnabled); }
    })();
    const unsub = experiencePreferences.subscribe(() => {
      setShowLabels(experiencePreferences.showTabLabelsEnabled);
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const { onTabPress } = React.useContext(TabPressContext);

  // Hide pill when Reflect (UserInput) tab is active — that screen has its own nav
  const currentRouteName = state.routes[state.index].name;
  if (currentRouteName === 'Reflect') {
    return null;
  }

  return (
    // Wrapper: full-width absolute anchor, transparent — centers the pill
    <Animated.View
      style={[
        styles.pillWrapper,
        {
          // Sit flush at the safe-area boundary (home indicator edge).
          // Math.max ensures at least 8pt gap on phones with no home indicator.
          bottom: Math.max(insets.bottom, 8),
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const iconColor = isFocused ? theme.colors.alertCoral : 'rgba(255,255,255,0.55)';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            onTabPress(route.name);
            if (!event.defaultPrevented) {
              if (route.name === 'Overview') {
                navigation.navigate('Overview', { screen: 'DashboardHome' });
              } else {
                navigation.navigate(route.name);
              }
            }
          };

          const LABELS: Record<string, string> = {
            Reflect: 'Reflect',
            Overview: 'Home',
            Playbooks: 'Playbooks',
            Devotionals: 'Devotionals',
            Journal: 'Journal',
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
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.75}
              style={[styles.pillTab, isFocused && styles.pillTabActive]}
            >
              {icon}
              {showLabels && (
                <Text style={[styles.pillLabel, { color: iconColor, fontFamily: fontRegular }]}>
                  {LABELS[route.name] ?? route.name}
                </Text>
              )}
            </TouchableOpacity>
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
    borderRadius: 32,
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
  // Each tab takes equal share — column layout for icon + label
  pillTab: {
    flex: 1,
    height: 56,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
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
