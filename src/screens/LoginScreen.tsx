import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
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

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { signInWithGoogle, signInWithApple, loading } = useAuth();

  const handleGoogleLogin = async () => {
    triggerLightHaptic();
    const { error } = await signInWithGoogle();
    if (error) {
      triggerErrorHaptic();
      Alert.alert('Google Login Failed', error.message || 'Please try again');
    }
  };

  const handleAppleLogin = async () => {
    triggerLightHaptic();
    const { error } = await signInWithApple();
    if (error) {
      triggerErrorHaptic();
      Alert.alert('Apple Login Failed', error.message || 'Please try again');
    }
  };

  const handleEmailLogin = () => {
    triggerLightHaptic();
    // Navigate to email login form or handle email login
    navigation.navigate('EmailLogin');
  };

  const handleSignUp = () => {
    triggerLightHaptic();
    navigation.navigate('Register');
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
          <Text style={styles.title}>Login</Text>
        </View>

        {/* Social Buttons */}
        <View style={styles.buttonContainer}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.appleButton}
              onPress={handleAppleLogin}
              disabled={loading}
            >
              <Ionicons name="logo-apple" size={20} color="#FF6B6B" />
              <Text style={styles.buttonText}>Continue with Apple</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={20} color="#FF6B6B" />
            <Text style={styles.buttonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.emailButton}
            onPress={handleEmailLogin}
            disabled={loading}
          >
            <Ionicons name="mail" size={20} color="#FF6B6B" />
            <Text style={styles.buttonText}>Continue with Email</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Up Link */}
      <View style={styles.signUpContainer}>
        <Text style={styles.signUpText}>Not yet a member? </Text>
        <TouchableOpacity onPress={handleSignUp}>
          <Text style={styles.signUpLink}>Sign Up</Text>
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
  signUpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingTop: 20,
  },
  signUpText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontFamily: Fonts.system.regular,
  },
  signUpLink: {
    color: '#FF6B6B',
    fontSize: 16,
    fontFamily: Fonts.system.bold,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
});

export default LoginScreen;
