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
  descriptors,
  navigation,
}: CustomTabBarProps) => {
  return (
    <View style={styles.tabBarContainer}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel || options.title || route.name;
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

        // Custom icon rendering for the middle tab
        if (route.name === 'UserInput') {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[styles.middleTab, isFocused && styles.middleTabActive]}
            >
              <Ionicons
                name="add-circle"
                size={36}
                color={isFocused ? Colors.hopeWhite : Colors.anchorBlue}
              />
            </TouchableOpacity>
          );
        }

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
              size={24}
              color={isFocused ? Colors.anchorBlue : Colors.trustGrey}
              style={styles.icon}
            />
            <Text style={[
              styles.label,
              { color: isFocused ? Colors.anchorBlue : Colors.trustGrey },
            ]}>
              {label}
            </Text>
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
    height: 80,
    backgroundColor: Colors.hopeWhite,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    paddingHorizontal: 10, // Reduced horizontal padding
    justifyContent: 'space-between', // Evenly distribute space
    alignItems: 'center',
    paddingLeft: 25, // Add left padding
    paddingRight: 25, // Add right padding
    paddingBottom: Platform.OS === 'ios' ? 25 : 15,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  middleTab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    borderWidth: 3,
    borderColor: Colors.hopeWhite,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    marginHorizontal: 10, // Add horizontal margin for better spacing
  },
  middleTabActive: {
    backgroundColor: Colors.anchorBlue,
  },
  label: {
    display: 'none', // Hide the label text
  },
  icon: {
    margin: 0, // Remove any margins
  },
  logoutButton: {
    fontSize: FontSizes.profileLogout,
    color: Colors.dangerRed,
    marginRight: Spacing.profileLogoutMarginRight,
    padding: 10,
  },
});
