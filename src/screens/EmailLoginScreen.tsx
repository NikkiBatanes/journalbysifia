import React, { useState, useMemo, useRef, useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LottieView from 'lottie-react-native';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Image,
  Dimensions,
  Keyboard,
} from 'react-native';

import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic, triggerErrorHaptic } from '../utils/haptics';
import { clearLoginFlowRedirect, setUserInputLoginRedirect } from '../utils/postAuthRedirect';
import ThemedText from '../components/common/ThemedText';
import ThemedTextInput from '../components/common/ThemedTextInput';

// Pre-load Lottie animation
const JC6_ANIMATION = require('../../assets/animations/JC 6.json');

interface Props {
  navigation: any;
}

const EmailLoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasAutoScrolled, setHasAutoScrolled] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const { signIn, loading } = useAuth();

  // Responsive logo sizing for different devices
  const { width, height } = Dimensions.get('window');
  const isTablet = width >= 768;
  const isVerySmallPhone = !isTablet && height <= 700; // iPhone SE 2nd/3rd gen (667)
  const logoSize = isVerySmallPhone ? 100 : (isTablet ? 120 : 100); // iPad (120), iPhone (100)

  // Create dynamic styles based on screen size
  const dynamicStyles = useMemo(() => StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: isVerySmallPhone ? 16 : 24,
      paddingTop: isVerySmallPhone ? 25 : 60,
      paddingBottom: isVerySmallPhone ? 25 : 40,
      alignSelf: 'center',
      width: '100%',
      maxWidth: 720,
    },
    lottieAnimation: {
      width: isVerySmallPhone ? 220 : 260,
      height: isVerySmallPhone ? 220 : 260,
      marginTop: isVerySmallPhone ? -80 : -100,
    },
    titleContainer: {
      alignItems: 'center',
      marginBottom: isVerySmallPhone ? 12 : 40,
      marginTop: isVerySmallPhone ? -45 : -90,
    },
    title: {
      fontSize: isVerySmallPhone ? 22 : 28,
      fontWeight: 'bold',
      color: Colors.white,
      textAlign: 'center',
      marginBottom: isVerySmallPhone ? 4 : 16,
    },
    subtitle: {
      fontSize: isVerySmallPhone ? 13 : 16,
      color: Colors.white,
      textAlign: 'center',
      marginBottom: isVerySmallPhone ? -4 : 0,
      opacity: 0.8,
    },
    formContainer: {
      marginBottom: isVerySmallPhone ? 12 : 32,
    },
    inputContainer: {
      marginBottom: isVerySmallPhone ? 8 : 16,
    },
    buttonContainer: {
      marginTop: isVerySmallPhone ? 8 : 24,
      marginBottom: isVerySmallPhone ? 6 : 24,
    },
    signUpContainer: {
      marginTop: isVerySmallPhone ? 6 : 16,
      marginBottom: isVerySmallPhone ? 2 : 8,
      width: '100%',
      alignSelf: 'center',
      position: 'absolute',
      bottom: isVerySmallPhone ? 20 : 30,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
  }), [isVerySmallPhone]);

  // Keyboard event listeners for scroll functionality
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = () => {
      // Keyboard show event
    };

    const onHide = () => {
      setHasAutoScrolled(false);
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const handleLogin = async () => {
    triggerLightHaptic();
    // clear previous error
    setError('');

    const emailTrim = email.trim();

    if (!emailTrim || !password) {
      triggerErrorHaptic();
      setError('Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) {
      triggerErrorHaptic();
      setError('Please enter a valid email address');
      return;
    }

    try {
      await setUserInputLoginRedirect();
    } catch {}

    const { error: signInError } = await signIn(emailTrim, password);
    if (signInError) {
      try {
        await clearLoginFlowRedirect('EmailLoginScreen:signInError');
      } catch {}
      // Map common auth errors to a friendly inline message
      const raw = (signInError.message || '').toLowerCase();

      let message = 'Incorrect email or password';

      if (raw.includes('too many') || raw.includes('rate limit')) {
        message = 'Too many attempts. Please wait and try again.';
      } else if (raw.includes('invalid') || raw.includes('not found') || raw.includes('user not found')) {
        message = 'No account found. Please register.';
      }

      triggerErrorHaptic();
      setError(message);
      return;
    }

    // Successful login - let the app's natural navigation flow handle routing

  };

  const handleSignUp = () => {
    triggerLightHaptic();
    navigation.navigate('Register');
  };

  const handleForgotPassword = () => {
    triggerLightHaptic();
    navigation.navigate('ForgotPassword');
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle="light-content" backgroundColor={Colors.sage} />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={dynamicStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/icons/siFia-logo-white.png')}
              style={[styles.logo, { width: logoSize, height: logoSize }]}
              resizeMode="contain"
            />
            <LottieView
              source={JC6_ANIMATION}
              autoPlay
              loop
              style={dynamicStyles.lottieAnimation}
            />
          </View>

          {/* Title */}
          <View style={dynamicStyles.titleContainer}>
            <ThemedText weight="bold" style={dynamicStyles.title}>Login</ThemedText>
            <ThemedText style={dynamicStyles.subtitle}>Welcome back to siFia</ThemedText>
          </View>

          {/* Form */}
          <View style={dynamicStyles.formContainer}>
            {/* Inline Error (shown inside form) */}
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#D97872" style={styles.errorIconMargin} />
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            ) : null}
            {/* Removed inline Create Account CTA as requested */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color="#D97872" style={styles.inputIcon} />
              <ThemedTextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) {setError('');}
                }}
                onFocus={() => {
                  if (!hasAutoScrolled) {
                    setHasAutoScrolled(true);
                    setTimeout(() => {
                      scrollRef.current?.scrollTo({ y: 14, animated: true });
                    }, 140);
                  }
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardAppearance="dark"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#D97872" style={styles.inputIcon} />
              <ThemedTextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) {setError('');}
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardAppearance="dark"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#D97872"
                />
              </TouchableOpacity>
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity onPress={handleForgotPassword}>
              <ThemedText style={styles.forgotPassword}>Forgot password?</ThemedText>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.primaryButton, styles.finishButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="Colors.sage" />
              ) : (
                <ThemedText weight="semiBold" style={styles.primaryButtonText}>Login</ThemedText>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sign Up Link - Outside constrained content for proper centering */}
      <View style={dynamicStyles.signUpContainer}>
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
    backgroundColor: Colors.sage,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
  },
  header: {
    marginBottom: 10,
    alignItems: 'center',
  },
  lottieAnimation: {
    width: 350,
    height: 350,
    marginTop: -100,
  },
  backButton: {
    marginRight: 20,
  },
  logo: {
    alignSelf: 'flex-start',
    marginTop: 0,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: -90,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: Fonts.system.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.system.regular,
    color: Colors.holyGlow,
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
    color: '#D97872',
    fontSize: 14,
    flexShrink: 1,
  },
  formContainer: {
    marginBottom: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 50,
    marginBottom: 16,
    paddingHorizontal: 28,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.system.regular,
    color: '#FFFEFA',
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    fontSize: 14,
    fontFamily: Fonts.system.regular,
    color: Colors.holyGlow,
    textDecorationLine: 'none',
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: Fonts.system.regular,
    color: Colors.holyGlow,
    textDecorationLine: 'none',
  },
  loginButton: {
    backgroundColor: '#D97872',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#29342E',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    marginTop: 8,
  },
  loginButtonText: {
    fontSize: 18,
    fontFamily: Fonts.system.semiBold,
    fontWeight: '600',
    color: '#FFFEFA',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 'auto',
  },
  finishButton: {
    marginTop: 2,
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  signUpText: {
    fontSize: 16,
    fontFamily: Fonts.system.regular,
    color: Colors.holyGlow,
  },
  signUpLink: {
    fontSize: 16,
    fontFamily: Fonts.system.bold,
    color: '#D97872',
    fontWeight: '600',
    textDecorationLine: 'none',
  },
  errorIconMargin: {
    marginRight: 8,
  },
});

export default withErrorBoundary(EmailLoginScreen, 'EmailLoginScreen');
