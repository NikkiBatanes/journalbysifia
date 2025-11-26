import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LottieView from 'lottie-react-native';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  StatusBar,
  Linking,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic, triggerErrorHaptic } from '../utils/haptics';
import ThemedText from '../components/common/ThemedText';

interface Props {
  navigation: any;
}

// Removed unused SocialButtonProps interface

// Unused SocialButton component - commented out to fix lint
/*
const SocialButton: React.FC<SocialButtonProps> = ({
  onPress,
  icon,
  title,
  backgroundColor,
  textColor = '#000',
  loading = false,
}) => (
  <TouchableOpacity
    style={[styles.socialButton, { backgroundColor }]}
    onPress={onPress}
    disabled={loading}
  >
    <Ionicons name={icon} size={20} color={textColor} />
    <Text style={[styles.socialButtonText, { color: textColor }]}>{title}</Text>
  </TouchableOpacity>
);
*/

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { signInWithGoogle, signInWithApple, loading, user } = useAuth();
  const insets = useSafeAreaInsets();
  const win = Dimensions.get('window');
  const [screen, setScreen] = React.useState({ width: win.width, height: win.height });
  const isLandscape = screen.width > screen.height;
  const isTablet = screen.width >= 768;
  // Treat SE-class and other very small phones as small; threshold mirrors onboarding welcome screen
  const isSmallPhone = !isTablet && screen.height <= 850;
  const contentWidth = Math.min(isLandscape ? screen.width * 0.6 : screen.width * 0.92, 600);
  const [error, setError] = React.useState<string>('');
  const [activeProvider, setActiveProvider] = React.useState<null | 'apple' | 'google'>(null);

  // Set post-auth redirect for splash screen to handle navigation
  React.useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreen({ width: window.width, height: window.height });
    });
    return () => sub?.remove();
  }, []);

  React.useEffect(() => {
    if (user) {

      // Let splash screen handle navigation to avoid conflicts

      // No direct navigation - let the auth state change trigger splash screen routing
    }
  }, [user, navigation]);

  // When global loading ends (success or error), clear local active provider
  React.useEffect(() => {
    if (!loading && activeProvider) {
      setActiveProvider(null);
    }
  }, [loading, activeProvider]);

  const handleGoogleSignUp = async () => {
    triggerLightHaptic();
    setError('');

    setActiveProvider('google');
    // Pre-set redirect so Splash honors Personalization immediately after auth
    try {
      await AsyncStorage.setItem(
        'post_auth_redirect',
        JSON.stringify({ target: 'OnboardingPersonalization', params: { registrationMethod: 'oauth', name: '' } })
      );
    } catch {}
    const { error: googleError } = await signInWithGoogle();
    if (googleError) {
      Logger.error('Google Sign-In Error', googleError as Error, {
  component: 'RegisterScreen',
});
      triggerErrorHaptic();
      // Hide cancellation errors to allow choosing other methods
      const msg = googleError.message?.toLowerCase?.() || '';
      if (msg.includes('cancel') || msg.includes('cancelled')) {
        setActiveProvider(null);
        return;
      }
      setError(googleError.message || 'Google sign up failed. Please try again.');
      setActiveProvider(null);
      try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
      return;
    }

    // Navigation will be handled by useEffect when user state changes
  };

  const handleAppleSignUp = async () => {
    triggerLightHaptic();
    setError('');

    setActiveProvider('apple');
    // Pre-set redirect so Splash honors Personalization immediately after auth
    try {
      await AsyncStorage.setItem(
        'post_auth_redirect',
        JSON.stringify({ target: 'OnboardingPersonalization', params: { registrationMethod: 'oauth', name: '' } })
      );
    } catch {}
    const { error: appleError } = await signInWithApple();
    if (appleError) {
      Logger.error('Apple Sign-In Error', appleError as Error, {
  component: 'RegisterScreen',
});
      triggerErrorHaptic();
      // Hide cancellation errors to allow choosing other methods
      const msg = appleError.message?.toLowerCase?.() || '';
      if (msg.includes('cancel') || msg.includes('cancelled')) {
        setActiveProvider(null);
        return;
      }
      setError(appleError.message || 'Apple sign up failed. Please try again.');
      setActiveProvider(null);
      try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
      return;
    }

    // Navigation will be handled by useEffect when user state changes
  };

  const handleEmailSignUp = () => {
    triggerLightHaptic();
    // Navigate to full registration form or handle email signup
    navigation.navigate('EmailRegister');
  };

  const handleSignIn = () => {
    triggerLightHaptic();
    navigation.navigate('Login');
  };

  const openExternalLink = async (url: string) => {
    try { triggerLightHaptic(); } catch {}

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Unable to open link', 'Please try again later.');
        return;
      }
      await Linking.openURL(url);
    } catch (linkError) {
      Logger.error('Failed to open external link', linkError as Error, {
        component: 'RegisterScreen',
        url,
      });
      Alert.alert('Unable to open link', 'Please try again later.');
    }
  };

  return (
    <View
      style={[
        styles.container,
        // On small phones, reduce top/bottom padding slightly so the content and buttons fit comfortably
        isSmallPhone && styles.containerSmallPhone,
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <View style={[styles.contentContainer, { width: contentWidth }, isLandscape ? styles.contentContainerLandscape : styles.contentContainerPortrait]}>
        {/* Logo */}
        <Image
          source={require('../../assets/icons/siFiaTransparent.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Illustration */}
        <View
          style={[
            styles.illustrationContainer,
            error ? styles.illustrationContainerCompressed : null,
            // On small phones, make the illustration a bit shorter and tighten vertical margins
            isSmallPhone && styles.illustrationContainerSmallPhone,
            // Move up Lottie animation in landscape mode
            isLandscape && styles.illustrationContainerLandscape,
          ]}
        >
          <LottieView
            source={require('../../assets/animations/JC 1.json')}
            autoPlay
            loop
            style={styles.lottieAnimation}
          />
        </View>

        {/* Title */}
        <View style={[
          styles.titleContainer,
          error ? styles.titleContainerCompressed : null,
        ]}>
          <ThemedText weight="bold" style={styles.title}>Create an Account</ThemedText>

          {/* Inline Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={Colors.alertCoral} style={styles.errorIcon} />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}
        </View>

        {/* Social Buttons */}
        <View style={[
          styles.buttonContainer,
          styles.buttonContainerCentered,
          isLandscape ? styles.buttonContainerLandscape : null,
        ]}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.appleButton}
              onPress={handleAppleSignUp}
              disabled={loading}
            >
              {activeProvider === 'apple' ? (
                <ActivityIndicator size="small" color={Colors.alertCoral} />
              ) : (
                <Ionicons name="logo-apple" size={20} color={Colors.alertCoral} />
              )}
              <ThemedText weight="medium" style={styles.buttonText}>
                {activeProvider === 'apple' ? 'Signing up...' : 'Continue with Apple'}
              </ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignUp}
            disabled={loading}
          >
            {activeProvider === 'google' ? (
              <ActivityIndicator size="small" color={Colors.alertCoral} />
            ) : (
              <Ionicons name="logo-google" size={20} color={Colors.alertCoral} />
            )}
            <ThemedText weight="medium" style={styles.buttonText}>
              {activeProvider === 'google' ? 'Signing up...' : 'Continue with Google'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.emailButton}
            onPress={handleEmailSignUp}
            disabled={loading}
          >
            <Ionicons name="mail" size={20} color={Colors.alertCoral} />
            <ThemedText weight="medium" style={styles.buttonText}>Continue with Email</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <ThemedText style={styles.loginText}>Already a member? </ThemedText>
          <TouchableOpacity onPress={handleSignIn}>
            <ThemedText weight="semiBold" style={styles.loginLink}>Login</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Terms and Privacy */}
        <View style={[styles.termsContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <ThemedText style={styles.termsText}>
            By continuing, you agree to our{' '}
            <ThemedText
              style={styles.termsLink}
              onPress={() => openExternalLink('https://sifia.app/legal/terms')}
            >
              Terms of Service
            </ThemedText>
            {' '}and{' '}
            <ThemedText
              style={styles.termsLink}
              onPress={() => openExternalLink('https://sifia.app/legal/privacy')}
            >
              Privacy Policy
            </ThemedText>
          </ThemedText>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  contentContainer: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: 10,
  },
  illustrationContainer: {
    width: '100%',
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  illustrationContainerCompressed: {
    height: 240,
    marginVertical: 10,
  },
  lottieAnimation: {
    width: 350,
    height: 350,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 6,
    width: '100%',
  },
  titleContainerCompressed: {
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: Fonts.system.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 4,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 0,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.15)',
    borderColor: 'rgba(255,107,107,0.8)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  errorText: {
    color: Colors.alertCoral,
    fontSize: 14,
    fontFamily: Fonts.system.regular,
    flexShrink: 1,
  },
  containerSmallPhone: {
    paddingTop: 40,
    paddingBottom: 24,
  },
  illustrationContainerSmallPhone: {
    height: 240,
    marginVertical: 12,
  },
  illustrationContainerLandscape: {
    marginVertical: -60, // Negative margin to move Lottie animation even higher in landscape
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: Fonts.system.medium,
    marginLeft: 12,
    fontWeight: '500',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  socialButtonText: {
    fontSize: 16,
    fontFamily: Fonts.system.medium,
    marginLeft: 12,
  },
  loginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 0,
  },
  loginText: {
    color: Colors.holyGlow,
    fontSize: 16,
    fontFamily: Fonts.system.regular,
  },
  loginLink: {
    color: Colors.alertCoral,
    fontSize: 16,
    fontFamily: Fonts.system.bold,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.15)',
    borderColor: 'rgba(255,107,107,0.8)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorIconMargin: {
    marginRight: 8,
  },
  termsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingHorizontal: 8,
  },
  termsText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: Fonts.system.regular,
    textAlign: 'center',
    lineHeight: 16,
  },
  termsLink: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontFamily: Fonts.system.medium,
    textDecorationLine: 'underline',
  },
  contentContainerPortrait: {
    alignSelf: 'center',
    marginTop: 0,
  },
  contentContainerLandscape: {
    alignSelf: 'center',
    marginTop: 24,
  },
  buttonContainerCentered: {
    alignSelf: 'center',
    width: '100%',
  },
  buttonContainerLandscape: {
    marginTop: 64,
    marginBottom: 32,
  },
});

export default withErrorBoundary(RegisterScreen, 'RegisterScreen');
