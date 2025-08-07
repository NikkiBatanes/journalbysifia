import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';

interface Props {
  navigation: any;
}

interface SocialButtonProps {
  onPress: () => void;
  icon: string;
  title: string;
  backgroundColor: string;
  textColor?: string;
  loading?: boolean;
}

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

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn, signInWithGoogle, signInWithApple, loading } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const passwordRef = useRef<TextInput>(null);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    const { error } = await signIn(
      formData.email.trim().toLowerCase(),
      formData.password
    );

    if (error) {
      Alert.alert('Login Failed', error.message || 'Please try again');
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      Alert.alert('Google Sign In Failed', error.message || 'Please try again');
    }
  };

  const handleAppleLogin = async () => {
    const { error } = await signInWithApple();
    if (error) {
      Alert.alert('Apple Sign In Failed', error.message || 'Please try again');
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  const handleSignUp = () => {
    navigation.navigate('Register');
  };



  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      {/* Top Section with Logo and Illustration */}
      <View style={styles.topSection}>
        {/* Logo */}
        <Image
          source={require('../../assets/icons/siFiaTransparent.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Illustration Placeholder */}
        <View style={styles.illustrationContainer}>
          <View style={styles.illustrationPlaceholder}>
            <Ionicons name="laptop-outline" size={80} color="rgba(255,255,255,0.3)" />
            <Ionicons name="phone-portrait-outline" size={40} color="rgba(255,255,255,0.2)" style={styles.phoneIcon} />
            <Ionicons name="cloud-outline" size={30} color="rgba(255,255,255,0.2)" style={styles.cloudIcon} />
          </View>
        </View>

        {/* Header Text */}
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue your spiritual journey</Text>
      </View>

      {/* Bottom Section with Form */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.bottomSection}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Social Login Buttons */}
          <View style={styles.socialContainer}>
            <SocialButton
              onPress={handleGoogleLogin}
              icon="logo-google"
              title="Continue with Google"
              backgroundColor="#fff"
              textColor="#000"
              loading={loading}
            />

            {Platform.OS === 'ios' && (
              <SocialButton
                onPress={handleAppleLogin}
                icon="logo-apple"
                title="Continue with Apple"
                backgroundColor="#000"
                textColor="#fff"
                loading={loading}
              />
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={[styles.inputWrapper, formErrors.email && styles.inputError]}>
              <Ionicons name="mail-outline" size={20} color={Colors.gray} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Enter your email"
                placeholderTextColor={Colors.gray}
                value={formData.email}
                onChangeText={(text) => {
                  setFormData(prev => ({ ...prev, email: text }));
                  if (formErrors.email) {
                    setFormErrors(prev => ({ ...prev, email: '' }));
                  }
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>
            {formErrors.email && (
              <Text style={styles.errorText}>{formErrors.email}</Text>
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={[styles.inputWrapper, formErrors.password && styles.inputError]}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.gray} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={styles.textInput}
                placeholder="Enter your password"
                placeholderTextColor={Colors.gray}
                value={formData.password}
                onChangeText={(text) => {
                  setFormData(prev => ({ ...prev, password: text }));
                  if (formErrors.password) {
                    setFormErrors(prev => ({ ...prev, password: '' }));
                  }
                }}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={Colors.gray}
                />
              </TouchableOpacity>
            </View>
            {formErrors.password && (
              <Text style={styles.errorText}>{formErrors.password}</Text>
            )}
          </View>

          {/* Remember Me & Forgot Password */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberMeContainer}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
              <Text style={styles.rememberMeText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity onPress={handleSignUp}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  topSection: {
    flex: 0.6,
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  illustrationContainer: {
    width: '100%',
    height: 200,
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationPlaceholder: {
    width: 250,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  phoneIcon: {
    position: 'absolute',
    top: 20,
    right: 30,
  },
  cloudIcon: {
    position: 'absolute',
    top: 10,
    left: 20,
  },
  bottomSection: {
    flex: 0.4,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    marginBottom: 0,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  socialContainer: {
    marginBottom: 32,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: Colors.gray,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  rememberMeText: {
    fontSize: 14,
    color: Colors.text,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 14,
    color: Colors.gray,
  },
  signUpLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default LoginScreen;
