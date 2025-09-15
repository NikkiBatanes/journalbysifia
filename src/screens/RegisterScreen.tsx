import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native';

import { useAuth } from '../context/IndustryStandardAuthContext';
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
  const [error, setError] = React.useState<string>('');
  const [activeProvider, setActiveProvider] = React.useState<null | 'apple' | 'google'>(null);

  // Set post-auth redirect for splash screen to handle navigation
  React.useEffect(() => {
    if (user) {
      console.log('✅ User authenticated via OAuth, setting post-auth redirect');
      // Extract name from user metadata or email
      let displayName = '';
      if (user.user_metadata) {
        displayName = (
          user.user_metadata.first_name ||
          user.user_metadata.given_name ||
          user.user_metadata.full_name ||
          user.user_metadata.name ||
          user.email?.split('@')[0] ||
          ''
        ).trim();
      } else {
        displayName = user.email?.split('@')[0] || '';
      }

      // Let splash screen handle navigation to avoid conflicts
      console.log('🧭 OAuth user detected, splash screen will route to personalization');
      // No direct navigation - let the auth state change trigger splash screen routing
    }
  }, [user, navigation]);

  // When global loading ends (success or error), clear local active provider
  React.useEffect(() => {
    if (!loading && activeProvider) {
      setActiveProvider(null);
    }
  }, [loading]);

  const handleGoogleSignUp = async () => {
    triggerLightHaptic();
    setError('');
    console.log('🔄 Starting Google sign up...');

    setActiveProvider('google');
    const { error: googleError } = await signInWithGoogle();
    if (googleError) {
      console.error('Google Sign-In Error:', googleError);
      triggerErrorHaptic();
      // Hide cancellation errors to allow choosing other methods
      const msg = googleError.message?.toLowerCase?.() || '';
      if (msg.includes('cancel') || msg.includes('cancelled')) {
        setActiveProvider(null);
        return;
      }
      setError(googleError.message || 'Google sign up failed. Please try again.');
      setActiveProvider(null);
      return;
    }
    console.log('✅ Google sign up successful, waiting for auth state change...');
    // Navigation will be handled by useEffect when user state changes
  };

  const handleAppleSignUp = async () => {
    triggerLightHaptic();
    setError('');
    console.log('🔄 Starting Apple sign up...');

    setActiveProvider('apple');
    const { error: appleError } = await signInWithApple();
    if (appleError) {
      console.error('Apple Sign-In Error:', appleError);
      triggerErrorHaptic();
      // Hide cancellation errors to allow choosing other methods
      const msg = appleError.message?.toLowerCase?.() || '';
      if (msg.includes('cancel') || msg.includes('cancelled')) {
        setActiveProvider(null);
        return;
      }
      setError(appleError.message || 'Apple sign up failed. Please try again.');
      setActiveProvider(null);
      return;
    }
    console.log('✅ Apple sign up successful, waiting for auth state change...');
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <View style={styles.contentContainer}>
        {/* Logo */}
        <Image
          source={require('../../assets/icons/siFiaTransparent.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Illustration Placeholder */}
        <View style={[
          styles.illustrationContainer,
          error ? styles.illustrationContainerCompressed : null,
        ]}>
          <View style={styles.illustrationPlaceholder}>
            <Ionicons name="laptop-outline" size={100} color="rgba(255,255,255,0.3)" />
            <Ionicons name="phone-portrait-outline" size={50} color="rgba(255,255,255,0.2)" style={styles.phoneIcon} />
            <Ionicons name="cloud-outline" size={40} color="rgba(255,255,255,0.2)" style={styles.cloudIcon} />
            <Ionicons name="server-outline" size={30} color="rgba(255,255,255,0.15)" style={styles.serverIcon} />
          </View>
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
        <View style={styles.buttonContainer}>
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
      </View>

      {/* Login Link */}
      <View style={styles.loginContainer}>
        <ThemedText style={styles.loginText}>Already a member? </ThemedText>
        <TouchableOpacity onPress={handleSignIn}>
          <ThemedText weight="semiBold" style={styles.loginLink}>Login</ThemedText>
        </TouchableOpacity>
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
    justifyContent: 'space-between',
  },
  contentContainer: {
    flex: 1,
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: 'flex-start',
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
  illustrationPlaceholder: {
    width: 300,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  phoneIcon: {
    position: 'absolute',
    top: 40,
    right: 50,
  },
  cloudIcon: {
    position: 'absolute',
    top: 20,
    left: 40,
  },
  serverIcon: {
    position: 'absolute',
    bottom: 30,
    right: 30,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 10,
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
    marginBottom: 10,
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
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.system.regular,
    color: Colors.holyGlow,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
    // Keep buttons fixed toward the bottom even when error appears
    marginTop: 'auto',
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
    marginTop: 'auto',
    paddingTop: 20,
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
});

export default RegisterScreen;
