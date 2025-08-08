/**
 * OnboardingPlaybookNavigationScreen.tsx
 * Phase 4.2: Playbook Experience Demo
 * Navigate to actual generated playbook, show real features
 */

import React, { useState, useRef, useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Colors } from '../../theme/colors';

interface RouteParams {
  generatedPlaybook: any;
}

const OnboardingPlaybookNavigationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as RouteParams;

  const [selectedActionStep, setSelectedActionStep] = useState<number | null>(null);
  const [completedSubtasks, setCompletedSubtasks] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
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

  const handleSubtaskToggle = (subtask: string) => {
    const newCompleted = new Set(completedSubtasks);
    if (newCompleted.has(subtask)) {
      newCompleted.delete(subtask);
    } else {
      newCompleted.add(subtask);
    }
    setCompletedSubtasks(newCompleted);

    // Show encouraging feedback
    if (!completedSubtasks.has(subtask)) {
      // Haptic feedback would go here
      console.log('✅ Subtask completed:', subtask);
    }
  };

  const handleGenerateDevotional = () => {
    Alert.alert(
      'Generate Devotional',
      'This would create a personalized devotional based on your playbook progress. This feature will be available after onboarding!',
      [{ text: 'Got it!' }]
    );
  };

  const handleJournalReflection = () => {
    Alert.alert(
      'Journal Reflection',
      'This would open a guided journaling experience based on your action steps. Available after onboarding!',
      [{ text: 'Sounds great!' }]
    );
  };

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      console.log('🎯 Playbook navigation completed, proceeding to trial setup');

      // Navigate to trial setup
      navigation.navigate('OnboardingTrialSetup' as any);
    } catch (error) {
      console.error('Error proceeding to trial setup:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playbook = params?.generatedPlaybook;
  const totalSubtasks = playbook?.actionSteps?.reduce((total: number, step: any) => {
    return total + (step.subtasks?.length || 0);
  }, 0) || 0;
  const completedCount = completedSubtasks.size;
  const progressPercentage = totalSubtasks > 0 ? (completedCount / totalSubtasks) * 100 : 0;

  if (!playbook) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Playbook not found</Text>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Playbook in Action</Text>
          <Text style={styles.subtitle}>
            Experience how your personalized guidance works in practice
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Progress overview */}
          <View style={styles.progressOverview}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Your Progress</Text>
              <Text style={styles.progressStats}>
                {completedCount} of {totalSubtasks} tasks completed
              </Text>
            </View>

            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercentage}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressPercentage}>{Math.round(progressPercentage)}%</Text>
            </View>
          </View>

          {/* Playbook title */}
          <View style={styles.playbookHeader}>
            <Text style={styles.playbookTitle}>{playbook.title}</Text>
          </View>

          {/* Action steps */}
          <View style={styles.actionStepsSection}>
            <Text style={styles.sectionTitle}>Action Steps</Text>

            {playbook.actionSteps.map((step: any, stepIndex: number) => (
              <View key={stepIndex} style={styles.actionStepCard}>
                <TouchableOpacity
                  style={styles.actionStepHeader}
                  onPress={() => setSelectedActionStep(
                    selectedActionStep === stepIndex ? null : stepIndex
                  )}
                >
                  <View style={styles.stepNumberContainer}>
                    <Text style={styles.stepNumber}>{stepIndex + 1}</Text>
                  </View>

                  <View style={styles.stepTitleContainer}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDescription}>{step.description}</Text>
                  </View>

                  <Ionicons
                    name={selectedActionStep === stepIndex ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.white}
                  />
                </TouchableOpacity>

                {selectedActionStep === stepIndex && (
                  <Animated.View style={styles.subtasksContainer}>
                    <Text style={styles.subtasksTitle}>Tasks to complete:</Text>
                    {(step.subtasks || []).map((subtask: string, subtaskIndex: number) => {
                      const subtaskKey = `${stepIndex}-${subtaskIndex}`;
                      const isCompleted = completedSubtasks.has(subtaskKey);

                      return (
                        <TouchableOpacity
                          key={subtaskIndex}
                          style={[
                            styles.subtaskItem,
                            isCompleted && styles.subtaskCompleted,
                          ]}
                          onPress={() => handleSubtaskToggle(subtaskKey)}
                        >
                          <View style={[
                            styles.subtaskCheckbox,
                            isCompleted && styles.subtaskCheckboxCompleted,
                          ]}>
                            {isCompleted && (
                              <Ionicons name="checkmark" size={16} color={Colors.anchorBlue} />
                            )}
                          </View>
                          <Text style={[
                            styles.subtaskText,
                            isCompleted && styles.subtaskTextCompleted,
                          ]}>
                            {subtask}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </Animated.View>
                )}
              </View>
            ))}
          </View>

          {/* Quick actions */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            <View style={styles.quickActionsGrid}>
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={handleGenerateDevotional}
              >
                <Ionicons name="heart-outline" size={32} color={Colors.lightBlue} />
                <Text style={styles.quickActionTitle}>Generate Devotional</Text>
                <Text style={styles.quickActionDescription}>
                  Create a devotional from this playbook
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={handleJournalReflection}
              >
                <Ionicons name="journal-outline" size={32} color={Colors.lightBlue} />
                <Text style={styles.quickActionTitle}>Journal Reflection</Text>
                <Text style={styles.quickActionDescription}>
                  Reflect on your progress
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Encouragement */}
          <View style={styles.encouragementSection}>
            <Ionicons name="star" size={24} color={Colors.lightBlue} />
            <Text style={styles.encouragementText}>
              Great job exploring your playbook! This is how you'll track progress and stay motivated on your spiritual journey.
            </Text>
          </View>
        </ScrollView>

        {/* Continue button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.continueButton, isLoading && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={isLoading}
          >
            <Text style={styles.continueButtonText}>
              {isLoading ? 'Loading...' : 'Start My Free Trial'}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={Colors.anchorBlue}
              style={styles.buttonIcon}
            />
          </TouchableOpacity>
        </View>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>Step 6 of 6</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, styles.progressComplete]} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  progressOverview: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },
  progressStats: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginRight: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.lightBlue,
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    minWidth: 40,
  },
  playbookHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  playbookTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
  },
  actionStepsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.lightBlue,
    marginBottom: 16,
  },
  actionStepCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  actionStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  stepNumberContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.lightBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.anchorBlue,
  },
  stepTitleContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  subtasksContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  subtasksTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.lightBlue,
    marginBottom: 12,
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  subtaskCompleted: {
    opacity: 0.7,
  },
  subtaskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.hopeWhite,
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtaskCheckboxCompleted: {
    backgroundColor: Colors.lightBlue,
    borderColor: Colors.lightBlue,
  },
  subtaskText: {
    fontSize: 14,
    color: Colors.white,
    flex: 1,
    lineHeight: 20,
  },
  subtaskTextCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.hopeWhite,
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 6,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  quickActionDescription: {
    fontSize: 12,
    color: Colors.anchorBlue,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 16,
  },
  encouragementSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  encouragementText: {
    fontSize: 14,
    color: Colors.white,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    marginBottom: 24,
  },
  continueButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 18,
    color: Colors.white,
    marginBottom: 24,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
  progressComplete: {
    width: '100%',
  },
});

export default OnboardingPlaybookNavigationScreen;
