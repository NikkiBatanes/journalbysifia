// src/navigation/RootStackNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, View, Image, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme';
import BottomTabNavigator from './BottomTabNavigator';
import PlaybookDetailScreen from '../screens/PlaybookDetailScreen';
import CardDetailScreen from '../screens/CardDetailScreen';
import GeneratingPlaybookScreen from '../screens/GeneratingPlaybookScreen';

const Stack = createNativeStackNavigator();

interface RootStackNavigatorProps {
  isAuthenticated: boolean;
  handleLogout: () => void;
  handleLogin: () => void;
  AuthStack: React.ComponentType<{ onLogin: () => void }>;
}

export default function RootStackNavigator({
  isAuthenticated,
  handleLogout,
  handleLogin,
  AuthStack,
}: RootStackNavigatorProps) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="MainTabs">
            {() => <BottomTabNavigator onLogout={handleLogout} />}
          </Stack.Screen>
          <Stack.Screen
            name="GeneratingPlaybook"
            component={GeneratingPlaybookScreen as React.ComponentType}
          />
          <Stack.Screen
            name="PlaybookDetail"
            component={PlaybookDetailScreen as React.ComponentType}
            options={({ navigation }) => ({
              headerShown: true,
              title: '',
              headerBackVisible: false,
              headerLeft: () => (
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.backButton}
                >
                  <Ionicons name="chevron-back" size={24} color={Colors.anchorBlue} />
                </TouchableOpacity>
              ),
              headerRight: () => (
                <View style={styles.profileImageContainer}>
                  <Image
                    source={{ uri: 'https://randomuser.me/api/portraits/women/44.jpg' }}
                    style={styles.profileImage}
                    resizeMode="cover"
                  />
                </View>
              ),
              headerStyle: styles.headerStyle,
              headerTitleAlign: 'center',
              headerTitleStyle: styles.headerTitle,
              headerTitleContainerStyle: styles.headerTitleContainer,
              headerShadowVisible: false,
            })}
          />
          <Stack.Screen
            name="CardDetail"
            component={CardDetailScreen as React.ComponentType}
            options={({ navigation }) => ({
              headerShown: true,
              title: '',
              headerBackVisible: false,
              headerLeft: () => (
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.backButton}
                >
                  <Ionicons name="chevron-back" size={24} color={Colors.hopeWhite} />
                </TouchableOpacity>
              ),
              headerRight: () => (
                <View style={styles.whiteProfileImageContainer}>
                  <Image
                    source={{ uri: 'https://randomuser.me/api/portraits/women/44.jpg' }}
                    style={styles.profileImage}
                    resizeMode="cover"
                  />
                </View>
              ),
              headerStyle: styles.darkHeaderStyle,
              headerTintColor: Colors.hopeWhite,
              headerShadowVisible: false,
            })}
          />
        </>
      ) : (
        <Stack.Screen name="AuthStack">
          {() => <AuthStack onLogin={handleLogin} />}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  backButton: {
    marginLeft: 0,
    padding: 8,
    paddingLeft: 0,
  },
  profileImageContainer: {
    marginRight: 16,
    overflow: 'hidden',
    borderRadius: 16,
  },
  whiteProfileImageContainer: {
    marginRight: 16,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.anchorBlue,
    textAlign: 'center',
    marginTop: 2,
    maxWidth: '70%',
  },
  headerStyle: {
    backgroundColor: '#f2f5f7',
  },
  headerTitleContainer: {
    width: '100%',
    paddingHorizontal: 16,
  },
  darkHeaderStyle: {
    backgroundColor: Colors.anchorBlue,
  },
});
