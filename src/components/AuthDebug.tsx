import React from 'react';
import { View, TouchableOpacity, Platform, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { Colors } from '../theme/colors';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';

const AuthDebug: React.FC = () => {
  const testGoogleAuth = async () => {
    try {
      console.log('🔍 Testing Google Auth...');
      Alert.alert('Debug', 'Starting Google Sign-In test...');

      // Google Sign-In is configured in IndustryStandardAuthContext.tsx
      // No need to configure here to prevent conflicts

      // Check Play Services
      await GoogleSignin.hasPlayServices();
      console.log('✅ Play Services available');

      // Attempt sign in
      const result = await GoogleSignin.signIn();
      console.log('✅ Google sign-in result:', result);

      Alert.alert('Success', `Google Sign-In successful: ${result.data?.user.email}`);
    } catch (error: any) {
      console.error('❌ Google Auth Error:', error);
      Alert.alert('Error', `Google Sign-In failed: ${error.message}`);
    }
  };

  const testAppleAuth = async () => {
    try {
      console.log('🔍 Testing Apple Auth...');
      Alert.alert('Debug', 'Starting Apple Sign-In test...');

      if (Platform.OS !== 'ios') {
        Alert.alert('Error', 'Apple Sign-In only works on iOS');
        return;
      }

      if (!appleAuth.isSupported) {
        Alert.alert('Error', 'Apple Sign-In not supported');
        return;
      }

      const result = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      console.log('✅ Apple sign-in result:', result);
      Alert.alert('Success', 'Apple Sign-In successful');
    } catch (error: any) {
      console.error('❌ Apple Auth Error:', error);
      Alert.alert('Error', `Apple Sign-In failed: ${error.message}`);
    }
  };

  return (
    <View style={{ padding: 20, backgroundColor: '#f0f0f0', margin: 20 }}>
      <ThemedText style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
        Auth Debug Panel
      </ThemedText>

      <TouchableOpacity
        onPress={testGoogleAuth}
        style={{
          backgroundColor: '#4285f4',
          padding: 15,
          borderRadius: 8,
          marginBottom: 10,
        }}
      >
        <ThemedText style={{ color: Colors.hopeWhite, textAlign: 'center' }}>
          Test Google Sign-In
        </ThemedText>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <TouchableOpacity
          onPress={testAppleAuth}
          style={{
            backgroundColor: '#000',
            padding: 15,
            borderRadius: 8,
            marginBottom: 10,
          }}
        >
          <ThemedText style={{ color: Colors.hopeWhite, textAlign: 'center' }}>
            Test Apple Sign-In
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default AuthDebug;
