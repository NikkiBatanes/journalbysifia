// src/navigation/BottomTabNavigator.tsx
import React, { useEffect, useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, TouchableOpacity, Platform, Animated, NativeModules } from 'react-native';
import { useScroll } from '../context/ScrollContext';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { JournalScreenRef } from '../screens/JournalScreen';

import { Colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { TabBarIcons } from './TabBarIcons';
import PlaybookListScreen from '../screens/PlaybookListScreen';

import DevotionalsScreen from '../screens/DevotionalsScreen';
import JournalScreen from '../screens/JournalScreen';
import JournalStackNavigator from './JournalStackNavigator';
import HomeStackNavigator from './HomeStackNavigator';
import { useAuth } from '../context/IndustryStandardAuthContext';

const Tab = createBottomTabNavigator();

// Define the props for our custom tab bar
type CustomTabBarProps = {
  state: TabNavigationState<ParamListBase>;
  descriptors: Record<string, any>;
  navigation: any;
};


// Custom tab bar component with proper TypeScript types
const CustomTabBarComponent = ({
  state,
  descriptors: _descriptors, // Prefix with underscore to indicate intentionally unused
  navigation,
}: CustomTabBarProps) => {
  const { showTabBar } = useScroll();
  const theme = useTheme();
  const translateY = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: showTabBar ? 0 : 80, // Slide down by 80px
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
  const { onTabPress } = React.useContext(TabPressContext);

  return (
    <Animated.View
      style={[
        styles.tabBarContainer,
        styles.animatedTabBar,
        {
          transform: [{ translateY }],
          opacity,
          backgroundColor: theme.colors.anchorBlue,
          borderTopColor: theme.colors.cardBorder,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          // Notify parent component about tab press
          onTabPress(route.name);

          if (!event.defaultPrevented) {
            if (route.name === 'Dashboard') {
              // Always route Home tab to the DashboardHome screen
              navigation.navigate('Dashboard', { screen: 'DashboardHome' });
            } else {
              // Default behavior for other tabs
              navigation.navigate(route.name);
            }
          }
        };

        // No special handling needed for UserInput tab - it will be rendered like other tabs

        const iconName = isFocused
          ? TabBarIcons[route.name as keyof typeof TabBarIcons]?.focused
          : TabBarIcons[route.name as keyof typeof TabBarIcons]?.name;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tab}
          >
            {route.name === 'Journal' ? (
              <MaterialCommunityIcons
                name={'notebook-edit'}
                size={28}
                color={isFocused ? theme.colors.alertCoral : theme.colors.anchorBlueLight}
                style={styles.icon}
              />
            ) : route.name === 'Devotionals' ? (
              <MaterialCommunityIcons
                name={'book'}
                size={30}
                color={isFocused ? theme.colors.alertCoral : theme.colors.anchorBlueLight}
                style={[styles.icon, { transform: [{ translateY: 1 }] }]}
              />
            ) : route.name === 'Playbooks' ? (
              <MaterialCommunityIcons
                name={'clipboard-text-play'}
                size={28}
                color={isFocused ? theme.colors.alertCoral : theme.colors.anchorBlueLight}
                style={styles.icon}
              />
            ) : route.name === 'Dashboard' ? (
              <MaterialIcons
                name={'space-dashboard'}
                size={28}
                color={isFocused ? theme.colors.alertCoral : theme.colors.anchorBlueLight}
                style={styles.icon}
              />
            ) : (
              <Ionicons
                name={iconName}
                size={28}
                color={isFocused ? theme.colors.alertCoral : theme.colors.anchorBlueLight}
                style={styles.icon}
              />
            )}
          </TouchableOpacity>
        );
      })}
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
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
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
  tabBarContainer: {
    flexDirection: 'row',
    height: 80,  // Increased from 60 to 80
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    paddingHorizontal: 24,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 15,  // Increased padding at the bottom
  },
  animatedTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  // Removed middle tab floating button styles
  label: {
    fontSize: 14,  // Slightly larger font
    marginTop: 6,   // More space between icon and text
    color: Colors.trustGrey,
    fontWeight: '500',  // Slightly bolder text
  },
  icon: {
    margin: 0,
    fontSize: 30,  // Slightly larger icons for better visibility without labels
  },
  // Removed profile header/logout button styles
});
