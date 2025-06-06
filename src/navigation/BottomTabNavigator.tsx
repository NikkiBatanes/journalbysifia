// src/navigation/BottomTabNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing, FontSizes } from '../theme/styles';
import { TabBarIcons } from './TabBarIcons';
import PlaybookListScreen from '../screens/PlaybookListScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import UserInputScreen from '../screens/UserInputScreen';

const Tab = createBottomTabNavigator();

// Main App Tabs
export default function BottomTabNavigator({ onLogout }: { onLogout: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          const iconName = focused
            ? TabBarIcons[route.name as keyof typeof TabBarIcons].focused
            : TabBarIcons[route.name as keyof typeof TabBarIcons].name;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.anchorBlue,
        tabBarInactiveTintColor: Colors.trustGrey,
        tabBarStyle: {
          paddingTop: Spacing.tabBarPaddingTop,
          paddingBottom: Spacing.tabBarPaddingBottom,
          height: Spacing.tabBarHeight,
        },
        headerShown: true,
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={UserInputScreen}
        options={{ title: 'New Playbook' }}
      />
      <Tab.Screen
        name="Playbooks"
        component={PlaybookListScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Profile"
        component={UserProfileScreen}
        options={{
          title: 'Profile',
          headerShown: true,
          headerRight: () => (
            <Text
              style={{ fontSize: FontSizes.profileLogout, color: Colors.dangerRed, marginRight: Spacing.profileLogoutMarginRight }}
              onPress={onLogout}
            >
              🚪
            </Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
