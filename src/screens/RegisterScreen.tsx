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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';

interface Props {
  navigation: any;
}

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { signUp, signInWithGoogle, signInWithApple, loading } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    } else if (formData.firstName.trim().length < 2) {
      errors.firstName = 'First name must be at least 2 characters';
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    } else if (formData.lastName.trim().length < 2) {
      errors.lastName = 'Last name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain uppercase, lowercase, and number';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      errors.terms = 'You must accept the Terms of Service';
    }

    if (!acceptPrivacy) {
      errors.privacy = 'You must accept the Privacy Policy';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    const { error } = await signUp(
      formData.email.trim().toLowerCase(),
      formData.password,
      {
        firstName: formData.firstName,
        lastName: formData.lastName,
      }
    );

    if (error) {
      Alert.alert('Registration Failed', error.message || 'Please try again');
    }
  };

  const handleGoogleSignUp = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      Alert.alert('Google Sign Up Failed', error.message || 'Please try again');
    }
  };

  const handleAppleSignUp = async () => {
    const { error } = await signInWithApple();
    if (error) {
      Alert.alert('Apple Sign Up Failed', error.message || 'Please try again');
    }
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  const handleTermsPress = () => {
    // Navigate to terms screen or open web view
    Alert.alert('Terms of Service', 'Terms of Service content would be displayed here.');
  };

  const handlePrivacyPress = () => {
    // Navigate to privacy screen or open web view
    Alert.alert('Privacy Policy', 'Privacy Policy content would be displayed here.');
  };

  const SocialButton = ({
    onPress,
    icon,
    title,
    backgroundColor,
    textColor = '#000',
  }: {
    onPress: () => void;
    icon: string;
    title: string;
    backgroundColor: string;
    textColor?: string;
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

  const CheckboxRow = ({
    checked,
    onPress,
    children,
    error,
  }: {
    checked: boolean;
    onPress: () => void;
    children: React.ReactNode;
    error?: string;
  }) => (
    <View style={styles.checkboxContainer}>
      <TouchableOpacity style={styles.checkboxRow} onPress={onPress}>
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && (
            <Ionicons name="checkmark" size={14} color="#fff" />
          )}
        </View>
        <View style={styles.checkboxTextContainer}>
          {children}
        </View>
      </TouchableOpacity>
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join us on your spiritual journey</Text>
          </View>

          {/* Social Sign Up Buttons */}
          <View style={styles.socialContainer}>
            <SocialButton
              onPress={handleGoogleSignUp}
              icon="logo-google"
              title="Sign up with Google"
              backgroundColor="#fff"
              textColor="#000"
            />

            {Platform.OS === 'ios' && (
              <SocialButton
                onPress={handleAppleSignUp}
                icon="logo-apple"
                title="Sign up with Apple"
                backgroundColor="#000"
                textColor="#fff"
              />
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Name Inputs */}
          <View style={styles.nameRow}>
            <View style={[styles.inputContainer, styles.nameInput]}>
              <Text style={styles.inputLabel}>First Name</Text>
              <View style={[styles.inputWrapper, formErrors.firstName && styles.inputError]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="First name"
                  placeholderTextColor={Colors.gray}
                  value={formData.firstName}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, firstName: text }));
                    if (formErrors.firstName) {
                      setFormErrors(prev => ({ ...prev, firstName: '' }));
                    }
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </View>
              {formErrors.firstName && (
                <Text style={styles.errorText}>{formErrors.firstName}</Text>
              )}
            </View>

            <View style={[styles.inputContainer, styles.nameInput]}>
              <Text style={styles.inputLabel}>Last Name</Text>
              <View style={[styles.inputWrapper, formErrors.lastName && styles.inputError]}>
                <TextInput
                  ref={lastNameRef}
                  style={styles.textInput}
                  placeholder="Last name"
                  placeholderTextColor={Colors.gray}
                  value={formData.lastName}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, lastName: text }));
                    if (formErrors.lastName) {
                      setFormErrors(prev => ({ ...prev, lastName: '' }));
                    }
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
              {formErrors.lastName && (
                <Text style={styles.errorText}>{formErrors.lastName}</Text>
              )}
            </View>
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={[styles.inputWrapper, formErrors.email && styles.inputError]}>
              <Ionicons name="mail-outline" size={20} color={Colors.gray} style={styles.inputIcon} />
              <TextInput
                ref={emailRef}
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
                placeholder="Create a password"
                placeholderTextColor={Colors.gray}
                value={formData.password}
                onChangeText={(text) => {
                  setFormData(prev => ({ ...prev, password: text }));
                  if (formErrors.password) {
                    setFormErrors(prev => ({ ...prev, password: '' }));
                  }
                }}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
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

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={[styles.inputWrapper, formErrors.confirmPassword && styles.inputError]}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.gray} style={styles.inputIcon} />
              <TextInput
                ref={confirmPasswordRef}
                style={styles.textInput}
                placeholder="Confirm your password"
                placeholderTextColor={Colors.gray}
                value={formData.confirmPassword}
                onChangeText={(text) => {
                  setFormData(prev => ({ ...prev, confirmPassword: text }));
                  if (formErrors.confirmPassword) {
                    setFormErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }
                }}
                secureTextEntry={!showConfirmPassword}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={Colors.gray}
                />
              </TouchableOpacity>
            </View>
            {formErrors.confirmPassword && (
              <Text style={styles.errorText}>{formErrors.confirmPassword}</Text>
            )}
          </View>

          {/* Terms and Privacy Checkboxes */}
          <CheckboxRow
            checked={acceptTerms}
            onPress={() => setAcceptTerms(!acceptTerms)}
            error={formErrors.terms}
          >
            <Text style={styles.checkboxText}>
              I agree to the{' '}
              <Text style={styles.linkText} onPress={handleTermsPress}>
                Terms of Service
              </Text>
            </Text>
          </CheckboxRow>

          <CheckboxRow
            checked={acceptPrivacy}
            onPress={() => setAcceptPrivacy(!acceptPrivacy)}
            error={formErrors.privacy}
          >
            <Text style={styles.checkboxText}>
              I agree to the{' '}
              <Text style={styles.linkText} onPress={handlePrivacyPress}>
                Privacy Policy
              </Text>
            </Text>
          </CheckboxRow>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.registerButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity onPress={handleSignIn}>
              <Text style={styles.signInLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.gray,
    textAlign: 'center',
  },
  socialContainer: {
    marginBottom: 24,
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
    marginBottom: 24,
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
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nameInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  inputContainer: {
    marginBottom: 16,
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
  checkboxContainer: {
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  linkText: {
    color: Colors.primary,
    fontWeight: '500',
  },
  registerButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    fontSize: 14,
    color: Colors.gray,
  },
  signInLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default RegisterScreen;
