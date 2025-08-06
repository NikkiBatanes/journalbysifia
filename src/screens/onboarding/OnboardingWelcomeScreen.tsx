/**
 * OnboardingWelcomeScreen.tsx
 * Phase 1.3: Welcome & Interest Capture
 * Individual growth focus, no community claims
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

const OnboardingWelcomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleCreateAccount = async () => {
    setIsLoading(true);

    // Navigate to Transform Your Life screen first
    setTimeout(() => {
      navigation.navigate('OnboardingFeatureShowcase' as any);
      setIsLoading(false);
    }, 500);
  };

  const handleLogin = async () => {
    setIsLoading(true);

    // Navigate to login screen
    setTimeout(() => {
      navigation.navigate('OnboardingLogin' as any);
      setIsLoading(false);
    }, 500);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Logo and Welcome */}
        <View style={styles.logoSection}>
          <Text style={styles.welcomeText}>Welcome to</Text>
          <Image
            source={require('../../../assets/icons/siFiaTransparent.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Where faith meets action</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.createButton, isLoading && styles.buttonDisabled]}
            onPress={handleCreateAccount}
            disabled={isLoading}
          >
            <Text style={styles.createButtonText}>
              Create an account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>
              Login
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{' '}
            <Text style={styles.linkText}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.linkText}>Privacy Policy</Text>
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingTop: 80,
    paddingBottom: 60,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '300',
    color: Colors.white,
    letterSpacing: -1,
  },
  logoPlus: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginLeft: 4,
    marginTop: -8,
  },
  tagline: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '400',
    textAlign: 'center',
  },
  buttonSection: {
    gap: 16,
    marginBottom: 40,
  },
  createButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: 'transparent',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  welcomeText: {
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '400',
  },
  logoImage: {
    width: 200,
    height: 200,
    marginBottom: 8,
  },
});

export default OnboardingWelcomeScreen;
