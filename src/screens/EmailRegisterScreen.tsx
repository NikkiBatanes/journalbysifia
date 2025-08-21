import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic, triggerErrorHaptic } from '../utils/haptics';

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
  const { signUp, loading } = useAuth(); // Removed unused user variable

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

    console.log('🔄 Starting email registration...');
    const { error: signUpError } = await signUp(emailTrim, password, {
      firstName: first,
      lastName: last,
    });

    if (signUpError) {
      console.error('❌ Email registration failed:', signUpError);
      // Stay on this page and show inline error so user can fix inputs
      triggerErrorHaptic();
      setError(signUpError.message || 'Registration failed. Please try again.');
      return;
    }

    console.log('✅ Email registration successful!');
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
      console.log('🧭 Post-auth redirect set to OnboardingPersonalization');
    } catch (e) {
      console.warn('Could not set post-auth redirect flag:', e);
    }
    // Do not navigate here; the auth state change will switch stacks and Splash will redirect immediately
    return;
  };

  const handleBackToSocial = () => {
    triggerLightHaptic();
    navigation.goBack();
  };

  const handleLogin = () => {
    triggerLightHaptic();
    navigation.navigate('Login');
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
          <Text style={styles.title}>Create an Account</Text>
          <Text style={styles.subtitle}>Join siFia: Faith in Action</Text>
        </View>

        {/* Inline Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#FF6B6B" style={styles.errorIconMargin} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View style={styles.formContainer}>
          <View style={styles.nameRow}>
            <View style={[styles.inputContainer, styles.nameInput]}>
              <Ionicons name="person" size={20} color="#FF6B6B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={firstName}
                onChangeText={(t) => {
                  setFirstName(t);
                  if (error) {setError('');}
                }}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.inputContainer, styles.nameInput]}>
              <Ionicons name="person" size={20} color="#FF6B6B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={lastName}
                onChangeText={(t) => {
                  setLastName(t);
                  if (error) {setError('');}
                }}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#FF6B6B" style={styles.inputIcon} />
            <TextInput
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
            <TextInput
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
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#FF6B6B"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#274673" />
            ) : (
              <Text style={styles.registerButtonText}>Create an Account</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already a member? </Text>
          <TouchableOpacity onPress={handleLogin}>
            <Text style={styles.loginLink}>Login</Text>
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
    backgroundColor: '#FF6B6B',
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
    marginTop: 'auto',
  },
  loginText: {
    fontSize: 16,
    fontFamily: Fonts.system.regular,
    color: 'rgba(255,255,255,0.8)',
    textDecorationLine: 'none',
  },
  loginLink: {
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

export default EmailRegisterScreen;
