/**
 * OnboardingAccountCreationScreen.tsx
 * Phase 2.1: Account Setup with Social Login Priority
 * Preserves existing auth patterns
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

const OnboardingAccountCreationScreen: React.FC = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setIsLoading(true);

    try {
      console.log(`🔐 ${provider} login initiated`);

      // Simulate social login
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Navigate to faith journey assessment
      navigation.navigate('OnboardingFaithJourney' as any);
    } catch (error) {
      Alert.alert('Login Error', `Unable to sign in with ${provider}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      console.log('📧 Email signup initiated:', email);

      // Simulate email signup
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Navigate to faith journey assessment
      navigation.navigate('OnboardingFaithJourney' as any);
    } catch (error) {
      Alert.alert('Signup Error', 'Unable to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipForNow = () => {
    // Continue as guest for demo purposes
    navigation.navigate('OnboardingFaithJourney' as any);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>
              Join thousands discovering their purpose through faith
            </Text>
          </View>

          {/* Social login options */}
          <View style={styles.socialSection}>
            <TouchableOpacity
              style={[styles.socialButton, isLoading && styles.buttonDisabled]}
              onPress={() => handleSocialLogin('google')}
              disabled={isLoading}
            >
              <Ionicons name="logo-google" size={20} color={Colors.anchorBlue} />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.socialButton, isLoading && styles.buttonDisabled]}
                onPress={() => handleSocialLogin('apple')}
                disabled={isLoading}
              >
                <Ionicons name="logo-apple" size={20} color={Colors.anchorBlue} />
                <Text style={styles.socialButtonText}>Continue with Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email form */}
          <View style={styles.formSection}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={Colors.hopeWhite} />
              <TextInput
                style={styles.textInput}
                placeholder="Email address"
                placeholderTextColor={Colors.hopeWhite}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.hopeWhite} />
              <TextInput
                style={styles.textInput}
                placeholder="Password"
                placeholderTextColor={Colors.hopeWhite}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={Colors.hopeWhite}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.hopeWhite} />
              <TextInput
                style={styles.textInput}
                placeholder="Confirm password"
                placeholderTextColor={Colors.hopeWhite}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.createAccountButton, isLoading && styles.buttonDisabled]}
              onPress={handleEmailSignup}
              disabled={isLoading}
            >
              <Text style={styles.createAccountButtonText}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Skip option */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipForNow}
            disabled={isLoading}
          >
            <Text style={styles.skipButtonText}>Continue as Guest</Text>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.termsText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>

          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>Step 1 of 6</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, styles.progressStep1]} />
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 22,
  },
  socialSection: {
    marginBottom: 24,
  },
  socialButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginLeft: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.hopeWhite,
    opacity: 0.3,
  },
  dividerText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginHorizontal: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.white,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  createAccountButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  createAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  skipButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textDecorationLine: 'underline',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  termsText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 32,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
  progressStep1: {
    width: '16.67%',
  },
});

export default OnboardingAccountCreationScreen;
