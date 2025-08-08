/**
 * OnboardingChallengeDetailsScreen.tsx
 * Screen for entering specific challenge details
 */

import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

interface Challenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  examples: string[];
}

interface PersonalizationData {
  name: string;
  ageGroup: string;
  faithJourney: string;
}

const OnboardingChallengeDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { challenge, personalizationData } = route.params as {
    challenge: Challenge;
    personalizationData: PersonalizationData;
  };

  const [challengeDetails, setChallengeDetails] = useState('');

  const handleContinue = () => {
    // Navigate to personalization summary with all data
    (navigation as any).navigate('OnboardingPersonalizationSummary', {
      personalizationData: {
        ...personalizationData,
        challenge: challenge.id,
        challengeDetails,
      },
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>siFia</Text>
          <Ionicons name="heart" size={16} color={Colors.alertCoral} />
        </View>
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.title}>Tell us more</Text>
        <Text style={styles.subtitle}>
          Help us understand your specific situation better
        </Text>
      </View>

      <View style={styles.contentContainer}>
        <TouchableOpacity style={styles.modalBackButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </TouchableOpacity>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.selectedChallengeCard}>
            <View style={styles.challengeHeader}>
              <View style={styles.challengeIcon}>
                <Ionicons name={challenge.icon} size={32} color={Colors.growthGreen} />
              </View>
              <View style={styles.challengeInfo}>
                <Text style={styles.challengeTitle}>{challenge.title}</Text>
                <Text style={styles.challengeDescription}>{challenge.description}</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsSection}>
            <Text style={styles.detailsTitle}>Tell us more about your specific situation:</Text>

            <Text style={styles.examplesLabel}>Examples:</Text>
            <View style={styles.exampleTags}>
              {challenge.examples.map((example, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.exampleTag}
                  onPress={() => setChallengeDetails(example)}
                >
                  <Text style={styles.exampleTagText}>{example}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.detailsInput}
              value={challengeDetails}
              onChangeText={setChallengeDetails}
              placeholder="Describe your specific challenge..."
              placeholderTextColor={Colors.mediumGray}
              multiline
              numberOfLines={4}
            />
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[
            styles.continueButton,
            challengeDetails.trim() ? styles.continueButtonActive : styles.continueButtonInactive,
          ]}
          onPress={handleContinue}
          disabled={!challengeDetails.trim()}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.white,
    marginRight: 4,
  },
  titleContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
    backgroundColor: Colors.anchorBlue,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.white,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 22,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: Colors.modalBlue,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 30,
  },
  modalBackButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  selectedChallengeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    borderWidth: 2,
    borderColor: Colors.growthGreen,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeIcon: {
    marginRight: 16,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.white,
    marginBottom: 4,
  },
  challengeDescription: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.white,
    opacity: 0.8,
  },
  detailsSection: {
    marginBottom: 30,
  },
  detailsTitle: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: Colors.white,
    marginBottom: 20,
  },
  examplesLabel: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.white,
    opacity: 0.8,
    marginBottom: 12,
  },
  exampleTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  exampleTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  exampleTagText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.white,
  },
  detailsInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.white,
    textAlignVertical: 'top',
    minHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  continueButton: {
    borderRadius: 12,
    padding: 16,
    margin: 20,
    alignItems: 'center',
  },
  continueButtonActive: {
    backgroundColor: Colors.alertCoral,
  },
  continueButtonInactive: {
    backgroundColor: 'rgba(255, 107, 107, 0.3)',
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.white,
  },
});

export default OnboardingChallengeDetailsScreen;
