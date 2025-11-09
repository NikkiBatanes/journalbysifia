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
  const [error, setError] = React.useState<string>('');
  const [activeProvider, setActiveProvider] = React.useState<null | 'apple' | 'google'>(null);

  // When global loading ends (success or error), clear local active provider
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
        <View style={styles.buttonContainer}>
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
      </View>

      {/* Sign Up Link */}
      <View style={styles.signUpContainer}>
        <ThemedText style={styles.signUpText}>Not yet a member? </ThemedText>
        <TouchableOpacity onPress={handleSignUp}>
          <ThemedText weight="semiBold" style={styles.signUpLink}>Sign Up</ThemedText>
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
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
  },
  logo: {
    width: 120,
    height: 120,
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
