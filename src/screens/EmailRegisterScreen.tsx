import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LottieView from 'lottie-react-native';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic, triggerErrorHaptic } from '../utils/haptics';
import ThemedText from '../components/common/ThemedText';
import ThemedTextInput from '../components/common/ThemedTextInput';

// Pre-load Lottie animation
const JC6_ANIMATION = require('../../assets/animations/JC 6.json');

interface Props {
  navigation: any;
}

const EmailRegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [hasAutoScrolled, setHasAutoScrolled] = useState(false);
  const [ctaY, setCtaY] = useState<number | null>(null);
  const [ctaH, setCtaH] = useState<number>(0);
  const [svH, setSvH] = useState<number>(0);
  const [contentH, setContentH] = useState<number>(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const { signUp, loading } = useAuth(); // Removed unused user variable

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
      width: isVerySmallPhone ? 280 : 350,
      height: isVerySmallPhone ? 280 : 350,
      marginTop: isVerySmallPhone ? -100 : -100,
    },
    titleContainer: {
      alignItems: 'center',
      marginBottom: isVerySmallPhone ? 6 : 20,
      marginTop: isVerySmallPhone ? -60 : -80,
    },
    title: {
      fontSize: isVerySmallPhone ? 22 : 28,
      fontWeight: 'bold',
      color: Colors.white,
      textAlign: 'center',
      marginBottom: isVerySmallPhone ? 1 : 8,
    },
    subtitle: {
      fontSize: isVerySmallPhone ? 13 : 16,
      color: Colors.white,
      textAlign: 'center',
      marginBottom: isVerySmallPhone ? 6 : 16,
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

  // Maximum scroll based on content size (prevents blank space past the end)
  const maxScrollableY = useMemo(() => Math.max(0, contentH - svH), [contentH, svH]);

  // Dynamic bottom padding for Android when keyboard is visible
  const keyboardPaddingStyle = useMemo(() => ({
    paddingBottom: 8 + Math.max(0, keyboardHeight - 8),
  }), [keyboardHeight]);

  const handleRegister = async () => {
    triggerLightHaptic();
    // Clear any previous error
    setError('');

    // Trim inputs to avoid trailing/leading spaces counting as valid
    const first = firstName.trim();
    const last = lastName.trim();
    const emailTrim = email.trim();

    if (!first || !last || !emailTrim || !password) {
      triggerErrorHaptic();
      setError('Please fill in all fields');
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) {
      triggerErrorHaptic();
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      triggerErrorHaptic();
      setError('Password must be at least 6 characters');
      return;
    }

    const { error: signUpError } = await signUp(emailTrim, password, {
      firstName: first,
      lastName: last,
    });

    if (signUpError) {
      Logger.error('❌ Email registration failed', signUpError as Error, {
        component: 'EmailRegisterScreen',
      });
      // Stay on this page and show inline error so user can fix inputs
      triggerErrorHaptic();
      setError(signUpError.message || 'Registration failed. Please try again.');
      return;
    }

    // Set a post-auth redirect so Root/Splash can route instantly without flicker
    const displayName = first || emailTrim.split('@')[0] || '';
    try {
      await AsyncStorage.setItem(
        'post_auth_redirect',
        JSON.stringify({
          target: 'OnboardingPersonalization',
          params: { name: displayName, registrationMethod: 'email' },
        })
      );

    } catch (e) {
      Logger.warn('Could not set post-auth redirect flag', { component: 'EmailRegisterScreen', data: e });
    }
    // Do not navigate here; the auth state change will switch stacks and Splash will redirect immediately
    return;
  };

  const handleLogin = () => {
    triggerLightHaptic();
    navigation.navigate('Login');
  };

  // Keep the form and button above the keyboard and allow tap-to-dismiss
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height ?? 0;
      setKeyboardHeight(h);
    };

    const onHide = () => {
      setKeyboardHeight(0);
      // Reset auto-scroll flag when keyboard is dismissed
      setHasAutoScrolled(false);
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.flexContainer}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[
              dynamicStyles.scrollContent,
              Platform.OS === 'ios' ? styles.pb8 : keyboardPaddingStyle,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              if (y > maxScrollableY) {
                scrollRef.current?.scrollTo({ y: maxScrollableY, animated: false });
              }
            }}
            scrollEventThrottle={16}
            onContentSizeChange={(_, h) => setContentH(h)}
            onLayout={(e) => setSvH(e.nativeEvent.layout.height)}
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
          <ThemedText weight="bold" style={dynamicStyles.title}>Create an Account</ThemedText>
          <ThemedText style={dynamicStyles.subtitle}>
            {'Join siFia: A quiet companion for faithful living'}
          </ThemedText>
        </View>

        {/* Inline Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={Colors.alertCoral} style={styles.errorIconMargin} />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}

        {/* Form */}
        <View style={dynamicStyles.formContainer}>
          <View style={styles.nameRow}>
            <View style={[styles.inputContainer, styles.nameInput]}>
              <Ionicons name="person" size={20} color={Colors.alertCoral} style={styles.inputIcon} />
              <ThemedTextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={firstName}
                onChangeText={(t) => {
                  setFirstName(t);
                  if (error) {setError('');}
                }}
                onFocus={() => {
                  if (!hasAutoScrolled) {
                    setHasAutoScrolled(true);
                    setTimeout(() => {
                      if (ctaY != null && svH > 0) {
                        const safety = 8;
                        const raw = ctaY - (svH - keyboardHeight - ctaH - safety);
                        const clamped = Math.min(Math.max(0, raw), maxScrollableY);
                        scrollRef.current?.scrollTo({ y: clamped, animated: true });
                      } else {
                        scrollRef.current?.scrollTo({ y: maxScrollableY, animated: true });
                      }
                    }, 140);
                  }
                }}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.inputContainer, styles.nameInput]}>
              <Ionicons name="person" size={20} color={Colors.alertCoral} style={styles.inputIcon} />
              <ThemedTextInput
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={lastName}
                onChangeText={(t) => {
                  setLastName(t);
                  if (error) {setError('');}
                }}
                onFocus={() => {
                  if (!hasAutoScrolled) {
                    setHasAutoScrolled(true);
                    setTimeout(() => {
                      if (ctaY != null && svH > 0) {
                        const safety = 8;
                        const raw = ctaY - (svH - keyboardHeight - ctaH - safety);
                        const clamped = Math.min(Math.max(0, raw), Math.max(0, ctaY - 8));
                        scrollRef.current?.scrollTo({ y: clamped, animated: true });
                      } else {
                        scrollRef.current?.scrollToEnd({ animated: true });
                      }
                    }, 140);
                  }
                }}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color={Colors.alertCoral} style={styles.inputIcon} />
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
                    if (ctaY != null && svH > 0) {
                      const safety = 8;
                      const raw = ctaY - (svH - keyboardHeight - ctaH - safety);
                      const clamped = Math.min(Math.max(0, raw), maxScrollableY);
                      scrollRef.current?.scrollTo({ y: clamped, animated: true });
                    } else {
                      scrollRef.current?.scrollTo({ y: maxScrollableY, animated: true });
                    }
                  }, 140);
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color={Colors.alertCoral} style={styles.inputIcon} />
            <ThemedTextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) {setError('');}
              }}
              onFocus={() => {
                if (!hasAutoScrolled) {
                  setHasAutoScrolled(true);
                  setTimeout(() => {
                    if (ctaY != null && svH > 0) {
                      const safety = 8;
                      const raw = ctaY - (svH - keyboardHeight - ctaH - safety);
                      const clamped = Math.min(Math.max(0, raw), Math.max(0, ctaY - 8));
                      scrollRef.current?.scrollTo({ y: clamped, animated: true });
                    } else {
                      scrollRef.current?.scrollToEnd({ animated: true });
                    }
                  }, 140);
                }
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={Colors.alertCoral}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={loading}
            onLayout={(e) => {
              setCtaY(e.nativeEvent.layout.y);
              setCtaH(e.nativeEvent.layout.height);
            }}
          >
            {loading ? (
              <ActivityIndicator color="#274673" />
            ) : (
              <ThemedText weight="bold" style={styles.registerButtonText}>Create an Account</ThemedText>
            )}
          </TouchableOpacity>
        </View>

          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {/* Login Link - Outside constrained content for proper centering */}
      <View style={dynamicStyles.signUpContainer}>
        <ThemedText style={styles.loginText}>Already a member? </ThemedText>
        <TouchableOpacity onPress={handleLogin}>
          <ThemedText weight="semiBold" style={styles.loginLink}>Login</ThemedText>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
  },
  pb8: {
    paddingBottom: 8,
  },
  header: {
    marginBottom: 0,
    marginTop: 20,
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
    // Remove fixed dimensions to allow dynamic sizing
    alignSelf: 'flex-start',
    marginTop: 0,
    marginBottom: 10,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: -80,
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
    color: Colors.alertCoral,
    fontSize: 14,
    flexShrink: 1,
  },
  formContainer: {
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  nameInput: {
    flex: 1,
    marginBottom: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.system.regular,
    color: '#fff',
  },
  eyeIcon: {
    padding: 4,
  },
  registerButton: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  registerButtonText: {
    fontSize: 18,
    fontFamily: Fonts.system.semiBold,
    fontWeight: '600',
    color: '#fff',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  loginText: {
    fontSize: 16,
    fontFamily: Fonts.system.regular,
    color: Colors.holyGlow,
    textDecorationLine: 'none',
  },
  loginLink: {
    fontSize: 16,
    fontFamily: Fonts.system.bold,
    color: Colors.alertCoral,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
  errorIconMargin: {
    marginRight: 8,
  },
  flexContainer: {
    flex: 1,
  },
});

export default withErrorBoundary(EmailRegisterScreen, 'EmailRegisterScreen');
