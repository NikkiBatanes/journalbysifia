/**
 * OnboardingPersonalizationScreen.tsx
 * Tell Us About Yourself - Multi-step form with solid anchor blue background
 * Uses inline page view pagination styling and card container styling
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
  Platform,
  Alert,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

const { width, height } = Dimensions.get('window');

interface PersonalizationData {
  name: string;
  ageGroup: string;
}

const OnboardingPersonalizationScreen: React.FC = () => {
  const navigation = useNavigation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<PersonalizationData>({
    name: '',
    ageGroup: '',
  });
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const ageGroups = [
    { label: '13-17 years', value: 'teen' },
    { label: '18-25 years', value: 'young_adult' },
    { label: '26-35 years', value: 'adult' },
    { label: '36-50 years', value: 'middle_age' },
    { label: '51+ years', value: 'senior' },
  ];

  useEffect(() => {
    // Set status bar
    StatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#1e3a8a');
    }

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

  const handleContinue = async () => {
    if (currentStep === 0) {
      // Name step validation
      if (!data.name.trim()) {
        Alert.alert('Missing Information', 'Please enter your name');
        return;
      }
      setCurrentStep(1);
      return;
    }

    if (currentStep === 1) {
      // Age group step validation
      if (!data.ageGroup) {
        Alert.alert('Missing Information', 'Please select your age group');
        return;
      }
      
      // Complete personalization
      setIsLoading(true);
      try {
        console.log('🎯 Personalization completed:', data);
        
        // Simulate saving data
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Navigate to next screen (you can change this to your desired destination)
        navigation.navigate('OnboardingComplete' as any);
      } catch (error) {
        Alert.alert('Error', 'Unable to save your information');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const renderNameStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your name?</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Enter your name"
          placeholderTextColor="rgba(255,255,255,0.6)"
          value={data.name}
          onChangeText={(text) => setData({ ...data, name: text })}
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>
    </View>
  );

  const renderAgeGroupStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Your Age Group</Text>
      
      <View style={styles.ageGroupContainer}>
        {ageGroups.map((group) => (
          <TouchableOpacity
            key={group.value}
            style={[
              styles.ageGroupButton,
              data.ageGroup === group.value && styles.ageGroupButtonSelected
            ]}
            onPress={() => setData({ ...data, ageGroup: group.value })}
          >
            <Text style={[
              styles.ageGroupText,
              data.ageGroup === group.value && styles.ageGroupTextSelected
            ]}>
              {group.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>

      {/* Top Section - Logo and Title */}
      <Animated.View
        style={[
          styles.topSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/icons/siFiaTransparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Main Title */}
        <Text style={styles.mainTitle}>Tell us about yourself</Text>
        <Text style={styles.subtitle}>
          Help us craft your personalized faith journey with siFia: Faith in Action
        </Text>
      </Animated.View>

      {/* Bottom Section - Card Container - Floating */}
      <View style={styles.bottomSection}>
        <View style={styles.cardContainer}>
          {/* Progress Indicator - Inline Page View Style */}
          <View style={styles.progressContainer}>
            <View style={styles.progressDots}>
              <View style={[styles.progressDot, currentStep >= 0 && styles.progressDotActive]} />
              <View style={[styles.progressDot, currentStep >= 1 && styles.progressDotActive]} />
            </View>
          </View>

          {/* Step Content */}
          <ScrollView 
            style={styles.stepContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.stepContentContainer}
          >
            {currentStep === 0 ? renderNameStep() : renderAgeGroupStep()}
          </ScrollView>

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.continueButton, isLoading && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={isLoading}
          >
            <Text style={styles.continueButtonText}>
              {isLoading ? 'Saving...' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    marginBottom: 0,
  },
  backButton: {
    padding: 0,
  },
  topSection: {
    height: 400, // much taller to ensure all content is visible above modal
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  bottomSection: {
    position: 'absolute',
    top: 360, // start much lower to avoid covering content
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#274673', // new modal color
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#274673', // match modal background
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logo: {
    width: 140,
    height: 140,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(30, 58, 138, 0.2)',
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: Colors.anchorBlue,
    width: 24,
    borderRadius: 4,
  },
  stepContent: {
    flex: 1,
  },
  stepContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite, // white text on dark background
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  ageGroupContainer: {
    width: '100%',
  },
  ageGroupButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  ageGroupButtonSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  ageGroupText: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.hopeWhite,
    fontWeight: '500',
  },
  ageGroupTextSelected: {
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
  },
});

export default OnboardingPersonalizationScreen;
