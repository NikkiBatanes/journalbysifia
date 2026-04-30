// src/navigation/AuthStackNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import EmailLoginScreen from '../screens/EmailLoginScreen';
import EmailRegisterScreen from '../screens/EmailRegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

const Stack = createNativeStackNavigator();

interface AuthStackNavigatorProps {
  onLogin: () => void;
}

export default function AuthStackNavigator({ onLogin: _onLogin }: AuthStackNavigatorProps) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 300,
        gestureEnabled: true,
      }}
      initialRouteName="Register"
    >
      {/* Enhanced Authentication Screens */}
      <Stack.Screen
        name="Login"
        component={LoginScreen as any}
        options={{ title: 'Login' }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen as any}
        options={{ title: 'Create an Account' }}
      />
      <Stack.Screen
        name="EmailLogin"
        component={EmailLoginScreen as any}
        options={{ title: 'Email Login' }}
      />
      <Stack.Screen
        name="EmailRegister"
        component={EmailRegisterScreen as any}
        options={{ title: 'Create an Account', animation: 'fade' }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen as any}
        options={{ title: 'Reset Password' }}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ title: 'Reset Password' }}
      />
    </Stack.Navigator>
  );
}
