// src/navigation/BottomTabNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { Spacing, FontSizes } from '../theme/styles';
import { TabBarIcons } from './TabBarIcons';
import PlaybookListScreen from '../screens/PlaybookListScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import UserInputScreen from '../screens/UserInputScreen';
import DevotionalsScreen from '../screens/DevotionalsScreen';

const Tab = createBottomTabNavigator();

// Custom tab bar component
const CustomTabBar = ({ state, descriptors, navigation }: any) => {
  return (
    <View style={styles.tabBarContainer}>
      {state.routes.map((route: any, index: number) => {
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
              { color: isFocused ? Colors.anchorBlue : Colors.trustGrey }
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
export default function BottomTabNavigator({ onLogout }: { onLogout: () => void }) {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
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
        name="Playbooks"
        component={PlaybookListScreen}
        options={{
          tabBarLabel: 'Home',
          title: 'Playbooks',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="UserInput"
        component={UserInputScreen}
        options={{
          tabBarLabel: '',
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
        options={{
          tabBarLabel: 'Profile',
          title: 'Profile',
          headerRight: () => (
            <Text
              style={{ 
                fontSize: FontSizes.profileLogout, 
                color: Colors.dangerRed, 
                marginRight: Spacing.profileLogoutMarginRight,
                padding: 10
              }}
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

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    height: 80, // Slightly increased height for better touch targets
    backgroundColor: Colors.hopeWhite,
    borderTopLeftRadius: 30, // Increased corner radius
    borderTopRightRadius: 30, // Increased corner radius
    position: 'absolute',
    bottom: 0,
    left: 0, // Full width
    right: 0, // Full width
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    paddingHorizontal: 20, // Increased horizontal padding
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 25 : 15,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  middleTab: {
    width: 60, // Slightly larger for better visibility
    height: 60, // Slightly larger for better visibility
    borderRadius: 30, // Half of width/height for perfect circle
    backgroundColor: Colors.anchorBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -30, // Half of height to make it float
    elevation: 8,
    shadowColor: Colors.anchorBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
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
});
