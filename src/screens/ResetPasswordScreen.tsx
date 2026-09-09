import React, { useState, useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
  Alert,
} from 'react-native';

import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic, triggerErrorHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { Logger } from '../utils/ProductionLogger';
import ThemedText from '../components/common/ThemedText';
import ThemedTextInput from '../components/common/ThemedTextInput';

interface Props {
  navigation: any;
  route: any;
}

const ResetPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { updatePassword } = useAuth();

  // Get access token and refresh token from route params (from deep link)
  const accessToken = route?.params?.access_token;
  const refreshToken = route?.params?.refresh_token;

  useEffect(() => {
    Logger.info('ResetPassword: Screen mounted with tokens:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    });

    if (!accessToken || !refreshToken) {
      Alert.alert(
        'Invalid Reset Link',
        'This password reset link is invalid or has expired. Please request a new one.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('EmailLogin'),
          },
        ]
      );
    }
  }, [accessToken, refreshToken, navigation]);

  const validatePassword = (passwordInput: string) => {
    if (passwordInput.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(passwordInput)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(passwordInput)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(passwordInput)) {
      return 'Password must contain at least one number';
    }
    if (!/(?=.*[@$!%*?&#])/.test(passwordInput)) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  const handleResetPassword = async () => {
    triggerLightHaptic();
    setError('');

    if (!password || !confirmPassword) {
      triggerErrorHaptic();
      setError('Please fill in all fields');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      triggerErrorHaptic();
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      triggerErrorHaptic();
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      Logger.info('ResetPassword: Attempting to update password with tokens');
      const { error: updateError } = await updatePassword(password);

      if (updateError) {
        Logger.error('ResetPassword: Password update failed:', updateError);
        triggerErrorHaptic();
        setError(updateError.message || 'Failed to reset password. Please try again.');
        setLoading(false);
        return;
      }

      Logger.info('ResetPassword: Password updated successfully');

      triggerSuccessHaptic();
      Alert.alert(
        'Password Reset Successful',
        'Your password has been updated successfully. You can now login with your new password.',
        [
          {
            text: 'Continue to Login',
            onPress: () => navigation.navigate('EmailLogin'),
          },
        ]
      );
    } catch (catchError) {
      triggerErrorHaptic();
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    triggerLightHaptic();
    navigation.navigate('EmailLogin');
  };

  if (!accessToken) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.sage} />
        <ActivityIndicator size="large" color={Colors.alertCoral} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.sage} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/icons/siFia-logo-white.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <ThemedText weight="bold" style={styles.title}>Reset Password</ThemedText>
          <ThemedText style={styles.subtitle}>Enter your new password below</ThemedText>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          {/* Inline Error */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Colors.alertCoral} style={styles.errorIconMargin} />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}

          {/* New Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color={Colors.alertCoral} style={styles.inputIcon} />
            <ThemedTextInput
              style={styles.input}
              placeholder="New Password"
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
                color={Colors.alertCoral}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color={Colors.alertCoral} style={styles.inputIcon} />
            <ThemedTextInput
              style={styles.input}
              placeholder="Confirm New Password"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                if (error) {setError('');}
              }}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye' : 'eye-off'}
                size={20}
                color={Colors.alertCoral}
              />
            </TouchableOpacity>
          </View>

          {/* Password Requirements */}
          <View style={styles.requirementsContainer}>
            <ThemedText style={styles.requirementsTitle}>Password Requirements:</ThemedText>
            <ThemedText style={styles.requirementText}>• At least 8 characters long</ThemedText>
            <ThemedText style={styles.requirementText}>• One uppercase letter</ThemedText>
            <ThemedText style={styles.requirementText}>• One lowercase letter</ThemedText>
            <ThemedText style={styles.requirementText}>• One number</ThemedText>
          </View>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.sage} />
            ) : (
              <ThemedText weight="bold" style={styles.resetButtonText}>Update Password</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        {/* Back to Login Link */}
        <View style={styles.backToLoginContainer}>
          <ThemedText style={styles.backToLoginText}>Remember your password? </ThemedText>
          <TouchableOpacity onPress={handleBackToLogin}>
            <ThemedText weight="semiBold" style={styles.backToLoginLink}>Login</ThemedText>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.sage,
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
    color: '#FFFEFA',
  },
  eyeIcon: {
    padding: 4,
  },
  requirementsContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 14,
    fontFamily: Fonts.system.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 13,
    fontFamily: Fonts.system.regular,
    color: Colors.holyGlow,
    marginBottom: 4,
  },
  resetButton: {
    backgroundColor: Colors.alertCoral,
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
  resetButtonText: {
    fontSize: 18,
    fontFamily: Fonts.system.semiBold,
    fontWeight: '600',
    color: Colors.sage,
  },
  backToLoginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  backToLoginText: {
    fontSize: 16,
    fontFamily: Fonts.system.regular,
    color: Colors.holyGlow,
  },
  backToLoginLink: {
    fontSize: 16,
    fontFamily: Fonts.system.bold,
    color: Colors.alertCoral,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
  errorIconMargin: {
    marginRight: 8,
  },
});

export default withErrorBoundary(ResetPasswordScreen, 'ResetPasswordScreen');
