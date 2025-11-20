import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';

import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerErrorHaptic, triggerSuccessHaptic } from '../utils/haptics';
import ThemedText from '../components/common/ThemedText';
import ThemedTextInput from '../components/common/ThemedTextInput';

interface Props {
  navigation: any;
}

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { resetPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const validateEmail = (emailInput: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailInput);
  };

  const handleResetPassword = async () => {
    triggerLightHaptic();
    setEmailError('');

    if (!email.trim()) {
      triggerErrorHaptic();
      setEmailError('Email is required');
      return;
    }

    if (!validateEmail(email.trim())) {
      triggerErrorHaptic();
      setEmailError('Please enter a valid email address');
      return;
    }

    const { error } = await resetPassword(email.trim().toLowerCase());

    if (error) {
      triggerErrorHaptic();
      Alert.alert('Reset Failed', error.message || 'Please try again');
    } else {
      triggerSuccessHaptic();
      Alert.alert(
        'Check Your Email',
        'We\'ve sent password reset instructions to your email. Please check your inbox and follow the link to reset your password.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    }
  };

  const handleBackToLogin = () => {
    triggerLightHaptic();
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Logo */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/icons/siFiaTransparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed-outline" size={60} color={Colors.alertCoral} />
          </View>

          <ThemedText weight="bold" style={styles.title}>Forgot Password?</ThemedText>
          <ThemedText style={styles.subtitle}>
            Enter your email address and we'll send you a secure link to reset your password.
          </ThemedText>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <View style={[styles.inputWrapper, emailError ? styles.inputError : null]}>
                <Ionicons name="mail-outline" size={20} color={Colors.alertCoral} style={styles.inputIcon} />
                <ThemedTextInput
                  style={styles.textInput}
                  placeholder="Enter your email"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) {setEmailError('');}
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleResetPassword}
                />
              </View>
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>

            {/* Reset Button */}
            <TouchableOpacity
              style={[styles.resetButton, loading && styles.disabledButton]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.anchorBlue} />
              ) : (
                <ThemedText weight="bold" style={styles.resetButtonText}>
                  Send Reset Link
                </ThemedText>
              )}
            </TouchableOpacity>

            {/* Back to Login */}
            <TouchableOpacity style={styles.backToLoginButton} onPress={handleBackToLogin}>
              <ThemedText style={styles.backToLoginText}>
                Remember your password? <ThemedText weight="semiBold" style={styles.linkText}>Login</ThemedText>
              </ThemedText>
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 10,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'flex-start',
    marginTop: 0,
    marginBottom: 10,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: Fonts.system.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.system.regular,
    color: Colors.holyGlow,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 25,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    height: 56,
  },
  inputError: {
    borderColor: Colors.alertCoral,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.system.regular,
    color: Colors.hopeWhite,
  },
  errorText: {
    color: Colors.alertCoral,
    fontSize: 14,
    fontFamily: Fonts.system.regular,
    marginTop: 5,
  },
  resetButton: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: Colors.hopeWhite,
    fontSize: 18,
    fontFamily: Fonts.system.bold,
    fontWeight: '600',
  },
  backToLoginButton: {
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 'auto',
  },
  backToLoginText: {
    fontSize: 16,
    fontFamily: Fonts.system.regular,
    color: Colors.holyGlow,
  },
  linkText: {
    color: Colors.alertCoral,
    fontFamily: Fonts.system.bold,
    fontWeight: '600',
  },
});

export default withErrorBoundary(ForgotPasswordScreen, 'ForgotPasswordScreen');
