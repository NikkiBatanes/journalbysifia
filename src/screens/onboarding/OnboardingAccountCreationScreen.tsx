/**
 * OnboardingAccountCreationScreen.tsx
 * Enhanced: Modal layout + comprehensive user data collection
 * Collects: Name, age group, email, and important personal data
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  ageGroup: string;
  password: string;
  confirmPassword: string;
}

const OnboardingAccountCreationScreen: React.FC = () => {
  const navigation = useNavigation();
  const [userData, setUserData] = useState<UserData>({
    firstName: '',
    lastName: '',
    email: '',
    ageGroup: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0: Personal Info, 1: Account Setup
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setIsLoading(true);

    try {
      console.log(`🔐 ${provider} login initiated`);

      // Simulate social login
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Navigate to faith journey assessment
      navigation.navigate('OnboardingFaithJourney' as any);
    } catch (error) {
      Alert.alert('Login Error', `Unable to sign in with ${provider}`);
    } finally {
      setIsLoading(false);
    }
  };

  const validatePersonalInfo = () => {
    if (!userData.firstName || !userData.lastName || !userData.ageGroup) {
      Alert.alert('Missing Information', 'Please fill in all personal information fields');
      return false;
    }
    return true;
  };

  const validateAccountInfo = () => {
    if (!userData.email || !userData.password || !userData.confirmPassword) {
      Alert.alert('Missing Information', 'Please fill in all account fields');
      return false;
    }

    if (userData.password !== userData.confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return false;
    }

    if (userData.password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 0) {
      if (validatePersonalInfo()) {
        setCurrentStep(1);
      }
    } else {
      handleEmailSignup();
    }
  };

  const handleEmailSignup = async () => {
    if (!validateAccountInfo()) return;

    setIsLoading(true);

    try {
      console.log('📧 Email signup initiated:', userData.email);
      console.log('👤 User data:', { 
        name: `${userData.firstName} ${userData.lastName}`,
        ageGroup: userData.ageGroup 
      });

      // Simulate email signup
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Navigate to faith journey assessment
      navigation.navigate('OnboardingFaithJourney' as any);
    } catch (error) {
      Alert.alert('Signup Error', 'Unable to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipForNow = () => {
    // Continue as guest for demo purposes
    navigation.navigate('OnboardingFaithJourney' as any);
  };

  const updateUserData = (field: keyof UserData, value: string) => {
    setUserData(prev => ({ ...prev, [field]: value }));
  };

  const ageGroups = [
    { label: '13-17 years', value: 'teen' },
    { label: '18-25 years', value: 'young_adult' },
    { label: '26-35 years', value: 'adult' },
    { label: '36-50 years', value: 'middle_age' },
    { label: '51+ years', value: 'senior' },
  ];

  const renderPersonalInfoStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Tell us about yourself</Text>
      <Text style={styles.stepSubtitle}>Help us personalize your faith journey</Text>

      <View style={styles.nameRow}>
        <View style={[styles.inputContainer, styles.nameInput]}>
          <Ionicons name="person-outline" size={20} color={Colors.anchorBlue} />
          <TextInput
            style={styles.textInput}
            placeholder="First name"
            placeholderTextColor={Colors.mediumGray}
            value={userData.firstName}
            onChangeText={(value) => updateUserData('firstName', value)}
            autoCapitalize="words"
          />
        </View>
        <View style={[styles.inputContainer, styles.nameInput]}>
          <TextInput
            style={styles.textInput}
            placeholder="Last name"
            placeholderTextColor={Colors.mediumGray}
            value={userData.lastName}
            onChangeText={(value) => updateUserData('lastName', value)}
            autoCapitalize="words"
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Age Group</Text>
      <View style={styles.ageGroupContainer}>
        {ageGroups.map((group) => (
          <TouchableOpacity
            key={group.value}
            style={[
              styles.ageGroupButton,
              userData.ageGroup === group.value && styles.ageGroupButtonSelected,
            ]}
            onPress={() => updateUserData('ageGroup', group.value)}
          >
            <Text
              style={[
                styles.ageGroupText,
                userData.ageGroup === group.value && styles.ageGroupTextSelected,
              ]}
            >
              {group.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderAccountSetupStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create your account</Text>
      <Text style={styles.stepSubtitle}>Secure your personalized experience</Text>

      <View style={styles.inputContainer}>
        <Ionicons name="mail-outline" size={20} color={Colors.anchorBlue} />
        <TextInput
          style={styles.textInput}
          placeholder="Email address"
          placeholderTextColor={Colors.mediumGray}
          value={userData.email}
          onChangeText={(value) => updateUserData('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color={Colors.anchorBlue} />
        <TextInput
          style={styles.textInput}
          placeholder="Password"
          placeholderTextColor={Colors.mediumGray}
          value={userData.password}
          onChangeText={(value) => updateUserData('password', value)}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons
            name={showPassword ? 'eye-outline' : 'eye-off-outline'}
            size={20}
            color={Colors.anchorBlue}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color={Colors.anchorBlue} />
        <TextInput
          style={styles.textInput}
          placeholder="Confirm password"
          placeholderTextColor={Colors.mediumGray}
          value={userData.confirmPassword}
          onChangeText={(value) => updateUserData('confirmPassword', value)}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
      
      {/* Upper Animation Area */}
      <View style={styles.animationArea}>
        <Animated.View
          style={[
            styles.logoAnimationContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: slideAnim.interpolate({
                inputRange: [0, 30],
                outputRange: [1, 0.8],
              }) }],
            },
          ]}
        >
          <View style={styles.logoPlaceholder}>
            <Ionicons name="person-add" size={40} color={Colors.white} />
          </View>
        </Animated.View>
      </View>

      {/* Modal-like Bottom Content */}
      <Animated.View
        style={[
          styles.modalContent,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, styles.progressStep1]} />
          </View>
          <Text style={styles.progressText}>Step 1 of 6</Text>
        </View>

        <KeyboardAvoidingView
          style={styles.formContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {currentStep === 0 ? renderPersonalInfoStep() : renderAccountSetupStep()}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {currentStep > 0 && (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setCurrentStep(0)}
                >
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.nextButton, isLoading && styles.buttonDisabled]}
                onPress={handleNextStep}
                disabled={isLoading}
              >
                <Text style={styles.nextButtonText}>
                  {isLoading ? 'Creating...' : (currentStep === 0 ? 'Next' : 'Create Account')}
                </Text>
                {!isLoading && (
                  <Ionicons name="chevron-forward" size={20} color={Colors.white} />
                )}
              </TouchableOpacity>
            </View>

            {/* Skip option */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkipForNow}
              disabled={isLoading}
            >
              <Text style={styles.skipButtonText}>Continue as Guest</Text>
            </TouchableOpacity>

            {/* Terms */}
            <Text style={styles.termsText}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  // Upper animation area (30% of screen)
  animationArea: {
    height: height * 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logoAnimationContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  // Modal-like bottom content (70% of screen)
  modalContent: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  // Progress bar at top of modal
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.anchorBlue,
    borderRadius: 2,
  },
  progressStep1: {
    width: '16.67%',
  },
  progressText: {
    fontSize: 12,
    color: Colors.anchorBlue,
    fontWeight: '500',
  },
  // Form container
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContent: {
    paddingTop: 10,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.anchorBlue,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  // Personal info step styles
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  nameInput: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginBottom: 12,
    marginTop: 8,
  },
  ageGroupContainer: {
    marginBottom: 32,
  },
  ageGroupButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.lightGray,
    marginBottom: 12,
    backgroundColor: Colors.white,
  },
  ageGroupButtonSelected: {
    borderColor: Colors.anchorBlue,
    backgroundColor: Colors.anchorBlueLight,
  },
  ageGroupText: {
    fontSize: 16,
    color: Colors.darkGray,
    textAlign: 'center',
    fontWeight: '500',
  },
  ageGroupTextSelected: {
    color: Colors.anchorBlue,
    fontWeight: '600',
  },
  // Input styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.darkerGray,
    marginLeft: 12,
  },
  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.anchorBlue,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  nextButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.anchorBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Skip and terms
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  skipButtonText: {
    fontSize: 16,
    color: Colors.mediumGray,
    fontWeight: '500',
  },
  termsText: {
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
  },

});

export default OnboardingAccountCreationScreen;
