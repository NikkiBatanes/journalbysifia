import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';

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
    // clear previous error
    setError('');

    const emailTrim = email.trim();

    if (!emailTrim || !password) {
      setError('Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) {
      setError('Please enter a valid email address');
      return;
    }

    const { error: signInError } = await signIn(emailTrim, password);
    if (signInError) {
      setError(signInError.message || 'Login failed. Please try again.');
      return;
    }
  };

  const handleBackToSocial = () => {
    navigation.goBack();
  };

  const handleSignUp = () => {
    navigation.navigate('EmailRegister');
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
          <TouchableOpacity style={styles.backButton} onPress={handleBackToSocial}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>

          <Image
            source={require('../../assets/icons/siFiaTransparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Login</Text>
          <Text style={styles.subtitle}>Welcome back to siFia</Text>
        </View>

        {/* Inline Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#FF6B6B" style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#FF6B6B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#FF6B6B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError('');
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

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#274673" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Up Link */}
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <TouchableOpacity onPress={handleSignUp}>
            <Text style={styles.signUpLink}>Sign Up</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  backButton: {
    marginRight: 20,
  },
  logo: {
    width: 140,
    height: 140,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.semiBold,
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
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.8)',
  },
  signUpLink: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#FF6B6B',
    fontWeight: '600',
    textDecorationLine: 'none',
  },
});

export default EmailLoginScreen;
