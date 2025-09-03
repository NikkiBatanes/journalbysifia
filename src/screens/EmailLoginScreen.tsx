import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';

import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic, triggerErrorHaptic } from '../utils/haptics';
import ThemedText from '../components/common/ThemedText';
import ThemedTextInput from '../components/common/ThemedTextInput';

interface Props {
  navigation: any;
}

const EmailLoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const { signIn, loading } = useAuth();

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

    const { error: signInError } = await signIn(emailTrim, password);
    if (signInError) {
      // Map common auth errors to a friendly inline message
      const raw = (signInError.message || '').toLowerCase();
      const isRateLimit = raw.includes('too many') || raw.includes('rate limit');
      const message = isRateLimit
        ? 'Too many attempts. Please wait a moment and try again.'
        : 'Incorrect email or password. Please try again.';

      // Note: We intentionally avoid checking user_profiles here because many
      // valid users may not have a profile row yet (or RLS may block reads).
      // Supabase does not expose account-existence via public APIs for security.

      triggerErrorHaptic();
      setError(message);
      return;
    }

    // Successful login - let the app's natural navigation flow handle routing
    console.log('✅ Login successful, auth state will trigger navigation');
  };

  const handleBackToSocial = () => {
    triggerLightHaptic();
    navigation.goBack();
  };

  const handleSignUp = () => {
    triggerLightHaptic();
    navigation.navigate('Register');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/icons/siFiaTransparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <ThemedText weight="bold" style={styles.title}>Login</ThemedText>
          <ThemedText style={styles.subtitle}>Welcome back to siFia</ThemedText>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          {/* Inline Error (shown inside form) */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#FF6B6B" style={styles.errorIconMargin} />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}
          {/* Removed inline Create Account CTA as requested */}
          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#FF6B6B" style={styles.inputIcon} />
            <ThemedTextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) {setError('');}
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#FF6B6B" style={styles.inputIcon} />
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
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye' : 'eye-off'}
                size={20}
                color="#FF6B6B"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.forgotPassword} 
            onPress={() => triggerLightHaptic()}
          >
            <ThemedText style={styles.forgotPasswordText}>Forgot Password?</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#274673" />
            ) : (
              <ThemedText weight="bold" style={styles.loginButtonText}>Login</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Up Link */}
        <View style={styles.signUpContainer}>
          <ThemedText style={styles.signUpText}>Not yet a member? </ThemedText>
          <TouchableOpacity onPress={handleSignUp}>
            <ThemedText weight="semiBold" style={styles.signUpLink}>Sign Up</ThemedText>
          </TouchableOpacity>
        </View>

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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 10,
  },
  backButton: {
    marginRight: 20,
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: 'flex-start',
    marginTop: 0,
    marginBottom: 10,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
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
    color: 'rgba(255,255,255,0.8)',
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
  formContainer: {
    marginBottom: 40,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: Fonts.system.regular,
    color: 'rgba(255,255,255,0.8)',
    textDecorationLine: 'none',
  },
  loginButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
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
    color: '#fff',
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
    color: 'rgba(255,255,255,0.8)',
  },
  signUpLink: {
    fontSize: 16,
    fontFamily: Fonts.system.bold,
    color: '#FF6B6B',
    fontWeight: '600',
    textDecorationLine: 'none',
  },
  errorIconMargin: {
    marginRight: 8,
  },
});

export default EmailLoginScreen;
