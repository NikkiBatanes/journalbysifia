// src/navigation/BottomTabNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { Spacing, FontSizes } from '../theme/styles';
import { TabBarIcons } from './TabBarIcons';
import PlaybookListScreen from '../screens/PlaybookListScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import UserInputScreen from '../screens/UserInputScreen';
import DevotionalsScreen from '../screens/DevotionalsScreen';

const Tab = createBottomTabNavigator();

// Define the props for our custom tab bar
type CustomTabBarProps = {
  state: TabNavigationState<ParamListBase>;
  descriptors: Record<string, any>;
  navigation: any;
};

// Logout button component
const LogoutButton = ({ onPress }: { onPress: () => void }) => (
  <Text style={styles.logoutButton} onPress={onPress}>
    🚪
  </Text>
);

// Custom tab bar component with proper TypeScript types
const CustomTabBarComponent = ({
  state,
  descriptors: _descriptors, // Prefix with underscore to indicate intentionally unused
  navigation,
}: CustomTabBarProps) => {
  return (
    <View style={styles.tabBarContainer}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
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
            <Ionicons
              name={iconName}
              size={28}
              color={isFocused ? Colors.alertCoral : Colors.anchorBlueLight}
              style={styles.icon}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Main App Tabs
interface BottomTabNavigatorProps {
  onLogout: () => void;
}

// Memoized profile header component
const ProfileHeader = React.memo(({ onLogout }: { onLogout: () => void }) => (
  <LogoutButton onPress={onLogout} />
));

// Profile screen options with memoized header
const useProfileScreenOptions = (onLogout: () => void) => {
  return React.useMemo(
    () => ({
      tabBarLabel: 'Profile',
      title: 'Profile',
      headerRight: () => <ProfileHeader onLogout={onLogout} />,
    }),
    [onLogout]
  );
};

export default function BottomTabNavigator({ onLogout }: BottomTabNavigatorProps) {
  const profileScreenOptions = useProfileScreenOptions(onLogout);
  // Move tabBar render function outside
  const renderTabBar = React.useCallback(
    (props: any) => <CustomTabBarComponent {...props} />,
    []
  );

  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: Colors.anchorBlue,
        },
        headerTintColor: Colors.hopeWhite,
        headerTitleStyle: {
          color: Colors.hopeWhite,
        },
      }}
    >
      <Tab.Screen
        name="UserInput"
        component={UserInputScreen}
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
        name="Profile"
        component={UserProfileScreen}
        options={profileScreenOptions}
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
    paddingHorizontal: 10,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 15,  // Increased padding at the bottom
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
  logoutButton: {
    fontSize: FontSizes.profileLogout,
    color: Colors.dangerRed,
    marginRight: Spacing.profileLogoutMarginRight,
    padding: 10,
  },
});
