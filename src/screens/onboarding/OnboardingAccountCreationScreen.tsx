/**
 * OnboardingAccountCreationScreen.tsx
 * New Design: Blue gradient background with isometric illustration
 * Social login options: Apple, Google, Email
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Platform,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

const OnboardingAccountCreationScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const handleAppleSignup = async () => {
    console.log('🍎 Apple signup - navigating to register screen');
    navigation.navigate('Register' as any);
  };

  const handleGoogleSignup = async () => {
    console.log('🔍 Google signup - navigating to register screen');
    navigation.navigate('Register' as any);
  };

  const handleEmailSignup = async () => {
    console.log('📧 Email signup - navigating to register screen');
    navigation.navigate('Register' as any);
  };

  useEffect(() => {
    // Set status bar
    StatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#1e3a8a');
    }

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

  const handleSocialLogin = async (provider: 'apple' | 'google' | 'email') => {
    setIsLoading(true);

    try {
      if (provider === 'apple') {
        handleAppleSignup();
      } else if (provider === 'google') {
        handleGoogleSignup();
      } else if (provider === 'email') {
        handleEmailSignup();
      }
    } catch (error) {
      Alert.alert('Signup Error', `Unable to sign up with ${provider}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    navigation.navigate('OnboardingLogin' as any);
  };

  return (
    <LinearGradient
      colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/icons/siFiaTransparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Isometric Illustration Placeholder */}
        <View style={styles.illustrationContainer}>
          <View style={styles.illustrationPlaceholder}>
            <Ionicons name="laptop-outline" size={120} color="rgba(255,255,255,0.3)" />
            <Ionicons name="phone-portrait-outline" size={60} color="rgba(255,255,255,0.2)" style={styles.phoneIcon} />
            <Ionicons name="cloud-outline" size={40} color="rgba(255,255,255,0.2)" style={styles.cloudIcon} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Create an account</Text>

        {/* Social Login Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialLogin('apple')}
            disabled={isLoading}
          >
            <Ionicons name="logo-apple" size={20} color={Colors.hopeWhite} />
            <Text style={styles.socialButtonText}>Continue with Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialLogin('google')}
            disabled={isLoading}
          >
            <Ionicons name="logo-google" size={20} color={Colors.hopeWhite} />
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialLogin('email')}
            disabled={isLoading}
          >
            <Ionicons name="mail-outline" size={20} color={Colors.hopeWhite} />
            <Text style={styles.socialButtonText}>Continue with Email</Text>
          </TouchableOpacity>
        </View>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={handleLogin}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 40,
  },
  illustrationContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  illustrationPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  phoneIcon: {
    position: 'absolute',
    top: 20,
    right: -30,
  },
  cloudIcon: {
    position: 'absolute',
    top: -10,
    left: -40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 30,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 16,
    width: '100%',
  },
  socialButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  loginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  loginText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
  loginLink: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OnboardingAccountCreationScreen;
