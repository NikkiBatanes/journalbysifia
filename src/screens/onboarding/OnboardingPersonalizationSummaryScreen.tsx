/**
 * OnboardingPersonalizationSummaryScreen.tsx
 * Summary screen showing all selected personalization options
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

interface PersonalizationData {
  name: string;
  ageGroup: string;
  faithJourney: string;
  challenge: string;
  challengeDetails: string;
}

const ageGroupLabels: { [key: string]: string } = {
  'teen': '13-17',
  'young-adult': '18-25',
  'adult': '26-35',
  'mid-adult': '36-45',
  'mature-adult': '46-55',
  'senior': '56-65',
  'elder': '65+',
};

const faithJourneyLabels: { [key: string]: string } = {
  'exploring': 'Exploring Faith',
  'new-believer': 'New Believer',
  'growing': 'Growing in Faith',
  'mature': 'Mature Believer',
};

const challengeLabels: { [key: string]: string } = {
  'relationships': 'Relationships & Family',
  'anxiety': 'Anxiety & Stress',
  'purpose': 'Purpose & Direction',
  'forgiveness': 'Forgiveness & Healing',
  'financial': 'Financial Stewardship',
  'spiritual': 'Spiritual Growth',
  'addiction': 'Addiction & Habits',
  'grief': 'Grief & Loss',
};

const OnboardingPersonalizationSummaryScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { personalizationData } = route.params as { personalizationData: PersonalizationData };

  const handleCreatePlaybook = () => {
    (navigation as any).navigate('OnboardingPlaybookGeneration', {
      personalizationData,
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
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../../assets/icons/siFiaTransparent.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.title}>Your Personalized Profile</Text>
        <Text style={styles.subtitle}>
          Review your selections and create your faith journey playbook
        </Text>
      </View>

      <View style={styles.contentContainer}>
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Name</Text>
              <Text style={styles.summaryValue}>{personalizationData.name}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Age Group</Text>
              <Text style={styles.summaryValue}>
                {ageGroupLabels[personalizationData.ageGroup] || personalizationData.ageGroup}
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Faith Journey</Text>
              <Text style={styles.summaryValue}>
                {faithJourneyLabels[personalizationData.faithJourney] || personalizationData.faithJourney}
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Main Challenge</Text>
              <Text style={styles.summaryValue}>
                {challengeLabels[personalizationData.challenge] || personalizationData.challenge}
              </Text>
            </View>

            {personalizationData.challengeDetails && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Specific Details</Text>
                <Text style={styles.summaryValue}>{personalizationData.challengeDetails}</Text>
              </View>
            )}
          </View>

          <View style={styles.nextStepsCard}>
            <Text style={styles.nextStepsTitle}>What's Next?</Text>
            <Text style={styles.nextStepsText}>
              We'll create a personalized faith journey playbook tailored specifically to your needs, 
              including scripture, prayers, and practical guidance for your current challenge.
            </Text>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreatePlaybook}
        >
          <Text style={styles.createButtonText}>Create My Playbook</Text>
          <Ionicons name="arrow-forward" size={20} color={Colors.white} />
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
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 1,
  },
  logoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 140,
    height: 140,
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
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryItem: {
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.white,
    opacity: 0.8,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.white,
  },
  nextStepsCard: {
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.faithGold,
  },
  nextStepsTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.faithGold,
    marginBottom: 12,
  },
  nextStepsText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.white,
    lineHeight: 20,
    opacity: 0.9,
  },
  createButton: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 12,
    padding: 16,
    margin: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.white,
    marginRight: 8,
  },
});

export default OnboardingPersonalizationSummaryScreen;
