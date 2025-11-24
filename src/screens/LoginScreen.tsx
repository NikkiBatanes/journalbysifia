import React from 'react';
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
  Dimensions,
} from 'react-native';

import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic, triggerErrorHaptic } from '../utils/haptics';
import ThemedText from '../components/common/ThemedText';

interface Props {
  navigation: any;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { signInWithGoogle, signInWithApple, loading } = useAuth();
  const win = Dimensions.get('window');
  const [screen, setScreen] = React.useState({ width: win.width, height: win.height });
  const isLandscape = screen.width > screen.height;
  const isTablet = screen.width >= 768;
  // Treat SE-class and other very small phones as small; threshold mirrors onboarding/register screens
  const isSmallPhone = !isTablet && screen.height <= 850;
  const contentWidth = Math.min(isLandscape ? screen.width * 0.6 : screen.width * 0.92, 600);
  const [error, setError] = React.useState<string>('');
  const [activeProvider, setActiveProvider] = React.useState<null | 'apple' | 'google'>(null);

  // When global loading ends (success or error), clear local active provider
  React.useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreen({ width: window.width, height: window.height });
    });
    return () => sub?.remove();
  }, []);

  React.useEffect(() => {
    if (!loading && activeProvider) {
      setActiveProvider(null);
    }
  }, [loading, activeProvider]);

  const handleGoogleLogin = async () => {
    triggerLightHaptic();
    setError('');
    setActiveProvider('google');
    const { error: googleError } = await signInWithGoogle();
    if (googleError) {
      // Hide cancellation errors
      const msg = googleError.message?.toLowerCase?.() || '';
      if (msg.includes('cancel') || msg.includes('cancelled')) {
        setActiveProvider(null);
        return;
      }
      triggerErrorHaptic();
      setError(googleError.message || 'Google login failed. Please try again.');
      setActiveProvider(null);
    }
  };

  const handleAppleLogin = async () => {
    triggerLightHaptic();
    setError('');
    setActiveProvider('apple');
    const { error: appleError } = await signInWithApple();
    if (appleError) {
      // Hide cancellation errors
      const msg = appleError.message?.toLowerCase?.() || '';
      if (msg.includes('cancel') || msg.includes('cancelled')) {
        setActiveProvider(null);
        return;
      }
      triggerErrorHaptic();
      setError(appleError.message || 'Apple login failed. Please try again.');
      setActiveProvider(null);
    }
  };

  const handleEmailLogin = () => {
    triggerLightHaptic();
    // Navigate to email login form or handle email login
    navigation.navigate('EmailLogin');
  };

  const handleSignUp = () => {
    triggerLightHaptic();
    navigation.navigate('Register');
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
          ]}
        >
          <LottieView
            source={require('../../assets/animations/JC 2.json')}
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
          <ThemedText weight="bold" style={styles.title}>Login</ThemedText>

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
          isLandscape ? styles.buttonContainerLandscape : null,
        ]}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.appleButton}
              onPress={handleAppleLogin}
              disabled={loading}
            >
              {activeProvider === 'apple' ? (
                <ActivityIndicator size="small" color={Colors.alertCoral} />
              ) : (
                <Ionicons name="logo-apple" size={20} color={Colors.alertCoral} />
              )}
              <ThemedText weight="medium" style={styles.buttonText}>
                {activeProvider === 'apple' ? 'Signing in...' : 'Continue with Apple'}
              </ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            {activeProvider === 'google' ? (
              <ActivityIndicator size="small" color="#FF6B6B" />
            ) : (
              <Ionicons name="logo-google" size={20} color={Colors.alertCoral} />
            )}
            <ThemedText weight="medium" style={styles.buttonText}>
              {activeProvider === 'google' ? 'Signing in...' : 'Continue with Google'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.emailButton}
            onPress={handleEmailLogin}
            disabled={loading}
          >
            <Ionicons name="mail" size={20} color={Colors.alertCoral} />
            <ThemedText weight="medium" style={styles.buttonText}>Continue with Email</ThemedText>
          </TouchableOpacity>
        </View>
        {/* Sign Up Link (moved inside content like Register screen) */}
        <View style={styles.loginContainer}>
          <ThemedText style={styles.loginText}>Not yet a member? </ThemedText>
          <TouchableOpacity onPress={handleSignUp}>
            <ThemedText weight="semiBold" style={styles.loginLink}>Sign Up</ThemedText>
          </TouchableOpacity>
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
    justifyContent: 'flex-start',
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
    width: 300,
    height: 250,
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
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.divineVeil,
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
    backgroundColor: Colors.divineVeil,
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
    backgroundColor: Colors.divineVeil,
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
  // Match RegisterScreen link row styles
  containerSmallPhone: {
    paddingTop: 40,
    paddingBottom: 24,
  },
  illustrationContainerSmallPhone: {
    height: 240,
    marginVertical: 12,
  },
  loginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 0,
  },
  loginText: {
    color: 'rgba(255,255,255,0.8)',
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
  signUpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingTop: 20,
  },
  signUpText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontFamily: Fonts.system.regular,
  },
  signUpLink: {
    color: '#FF6B6B',
    fontSize: 16,
    fontFamily: Fonts.system.bold,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
  contentContainerPortrait: {
    alignSelf: 'center',
    marginTop: 0,
  },
  contentContainerLandscape: {
    alignSelf: 'center',
    marginTop: 24,
  },
  buttonContainerLandscape: {
    marginTop: 64,
    marginBottom: 32,
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
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontFamily: Fonts.system.regular,
    flexShrink: 1,
  },
});

export default withErrorBoundary(LoginScreen, 'LoginScreen');
