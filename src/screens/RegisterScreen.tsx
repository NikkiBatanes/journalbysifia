import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,

  Platform,
  // ActivityIndicator, // unused
  Image,
  StatusBar,
} from 'react-native';

import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic, triggerErrorHaptic } from '../utils/haptics';

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

  const handleGoogleSignUp = async () => {
    triggerLightHaptic();
    setError('');
    console.log('🔄 Starting Google sign up...');

    // TEMPORARY: For testing, let's simulate successful OAuth and navigate directly
    // This helps us test the personalization screen while we debug OAuth
    const isTestMode = __DEV__; // Only in development

    if (isTestMode) {
      console.log('🧪 [TEST MODE] Simulating successful Google OAuth...');
      // Simulate a successful user for testing
      const testName = 'Test User';
      navigation.navigate('OnboardingPersonalization' as any, {
        name: testName,
        registrationMethod: 'oauth', // Flag for test mode OAuth
      });
      return;
    }

    const { error: googleError } = await signInWithGoogle();
    if (googleError) {
      console.error('Google Sign-In Error:', googleError);
      console.error('❌ Full error details:', JSON.stringify(googleError, null, 2));
      // Show inline banner and keep user on page
      triggerErrorHaptic();
      setError(googleError.message || 'Google sign up failed. Please try again.');
      return;
    }
    console.log('✅ Google sign up successful, waiting for auth state change...');
    // Navigation will be handled by useEffect when user state changes
  };

  const handleAppleSignUp = async () => {
    triggerLightHaptic();
    setError('');
    console.log('🔄 Starting Apple sign up...');

    // TEMPORARY: For testing, let's simulate successful OAuth and navigate directly
    const isTestMode = __DEV__; // Only in development

    if (isTestMode) {
      console.log('🧪 [TEST MODE] Simulating successful Apple OAuth...');
      const testName = 'Test User';
      navigation.navigate('OnboardingPersonalization' as any, {
        name: testName,
        registrationMethod: 'oauth', // Flag for test mode OAuth
      });
      return;
    }

    const { error: appleError } = await signInWithApple();
    if (appleError) {
      console.error('Apple Sign-In Error:', appleError);
      console.error('❌ Full error details:', JSON.stringify(appleError, null, 2));
      // Show inline banner and keep user on page
      triggerErrorHaptic();
      setError(appleError.message || 'Apple sign up failed. Please try again.');
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
        <View style={styles.illustrationContainer}>
          <View style={styles.illustrationPlaceholder}>
            <Ionicons name="laptop-outline" size={100} color="rgba(255,255,255,0.3)" />
            <Ionicons name="phone-portrait-outline" size={50} color="rgba(255,255,255,0.2)" style={styles.phoneIcon} />
            <Ionicons name="cloud-outline" size={40} color="rgba(255,255,255,0.2)" style={styles.cloudIcon} />
            <Ionicons name="server-outline" size={30} color="rgba(255,255,255,0.15)" style={styles.serverIcon} />
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Create an Account</Text>
        </View>

        {/* Inline Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#FF6B6B" style={styles.errorIconMargin} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Social Buttons */}
        <View style={styles.buttonContainer}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.appleButton}
              onPress={handleAppleSignUp}
              disabled={loading}
            >
              <Ionicons name="logo-apple" size={20} color="#FF6B6B" />
              <Text style={styles.buttonText}>Continue with Apple</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignUp}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={20} color="#FF6B6B" />
            <Text style={styles.buttonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.emailButton}
            onPress={handleEmailSignUp}
            disabled={loading}
          >
            <Ionicons name="mail" size={20} color="#FF6B6B" />
            <Text style={styles.buttonText}>Continue with Email</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Login Link */}
      <View style={styles.loginContainer}>
        <Text style={styles.loginText}>Already a member? </Text>
        <TouchableOpacity onPress={handleSignIn}>
          <Text style={styles.loginLink}>Login</Text>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: Fonts.system.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 10,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderColor: 'rgba(255,107,107,0.6)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.system.regular,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
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
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontFamily: Fonts.system.regular,
  },
  loginLink: {
    color: '#FF6B6B',
    fontSize: 16,
    fontFamily: Fonts.system.bold,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
  errorIconMargin: {
    marginRight: 8,
  },
});

export default RegisterScreen;
