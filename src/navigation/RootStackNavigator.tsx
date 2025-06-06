// src/navigation/RootStackNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, View, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme';
import BottomTabNavigator from './BottomTabNavigator';
import PlaybookDetailScreen from '../screens/PlaybookDetailScreen';
import CardDetailScreen from '../screens/CardDetailScreen';

const Stack = createNativeStackNavigator();

interface RootStackNavigatorProps {
  isAuthenticated: boolean;
  handleLogout: () => void;
  handleLogin: () => void;
  AuthStack: React.ComponentType<{ onLogin: () => void }>;
} // (No change needed, prop type is already generic, just ensure usage is correct)

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
            name="PlaybookDetail"
            component={PlaybookDetailScreen as React.ComponentType}
            options={({ navigation }) => ({
              headerShown: true,
              title: '',
              headerBackVisible: false,
              headerLeft: () => (
  <TouchableOpacity
    onPress={() => navigation.goBack()}
    style={{ marginLeft: 0, padding: 8, paddingLeft: 0 }}
  >
    <Ionicons name="chevron-back" size={24} color={Colors.anchorBlue} />
  </TouchableOpacity>
),
              headerRight: () => (
                <View style={{ marginRight: 16, overflow: 'hidden', borderRadius: 16 }}>
                  <Image
                    source={{ uri: 'https://randomuser.me/api/portraits/women/44.jpg' }}
                    style={{ width: 32, height: 32, borderRadius: 16 }}
                    resizeMode="cover"
                  />
                </View>
              ),
              headerStyle: {
                backgroundColor: '#f2f5f7',
              },
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
                  style={{ marginLeft: 0, padding: 8, paddingLeft: 0 }}
                >
                  <Ionicons name="chevron-back" size={24} color={Colors.hopeWhite} />
                </TouchableOpacity>
              ),
              headerRight: () => (
                <View style={{ marginRight: 16, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                  <Image
                    source={{ uri: 'https://randomuser.me/api/portraits/women/44.jpg' }}
                    style={{ width: 32, height: 32, borderRadius: 16 }}
                    resizeMode="cover"
                  />
                </View>
              ),
              headerStyle: {
                backgroundColor: Colors.anchorBlue,
              },
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
