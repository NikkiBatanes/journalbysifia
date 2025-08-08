import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUserState } from '../hooks/useUserState';
import { Colors } from '../theme';

interface OnboardingProgressIndicatorProps {
  showPhaseInfo?: boolean;
  compact?: boolean;
}

const OnboardingProgressIndicator: React.FC<OnboardingProgressIndicatorProps> = ({
  showPhaseInfo = true,
  compact = false,
}) => {
  const { userState, getPhaseProgress } = useUserState();
  const { currentPhase, completedSteps } = userState.onboardingProgress;

  const phaseProgress = getPhaseProgress();
  const overallProgress = ((currentPhase - 1) * 20) + (phaseProgress * 0.2);

  const phaseNames = {
    1: 'First Impression',
    2: 'Account Setup',
    3: 'Challenge Selection',
    4: 'Exploration',
    5: 'Trial Conversion',
  };

  const phaseDescriptions = {
    1: 'Welcome & Value Proposition',
    2: 'Registration & Personalization',
    3: 'Faith Journey & Playbook Generation',
    4: 'Feature Discovery & Demonstration',
    5: 'Pricing & Free Trial Activation',
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactProgressBar}>
          <View
            style={[
              styles.compactProgressFill,
              { width: `${Math.min(overallProgress, 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.compactText}>
          Phase {currentPhase}/5 • {Math.round(overallProgress)}% Complete
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Onboarding Progress</Text>
        <Text style={styles.percentage}>{Math.round(overallProgress)}%</Text>
      </View>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(overallProgress, 100)}%` },
          ]}
        />
      </View>

      {showPhaseInfo && (
        <View style={styles.phaseInfo}>
          <Text style={styles.currentPhase}>
            Phase {currentPhase}: {phaseNames[currentPhase]}
          </Text>
          <Text style={styles.phaseDescription}>
            {phaseDescriptions[currentPhase]}
          </Text>
          <Text style={styles.stepsCompleted}>
            {completedSteps.length} steps completed
          </Text>
        </View>
      )}

      <View style={styles.phaseIndicators}>
        {[1, 2, 3, 4, 5].map((phase) => (
          <View
            key={phase}
            style={[
              styles.phaseIndicator,
              phase < currentPhase && styles.phaseCompleted,
              phase === currentPhase && styles.phaseCurrent,
            ]}
          >
            <Text
              style={[
                styles.phaseNumber,
                phase < currentPhase && styles.phaseNumberCompleted,
                phase === currentPhase && styles.phaseNumberCurrent,
              ]}
            >
              {phase}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: Colors.textDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
  },
  percentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.faithGold,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.textLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.faithGold,
    borderRadius: 4,
  },
  compactProgressBar: {
    height: 4,
    backgroundColor: Colors.textLight,
    borderRadius: 2,
    overflow: 'hidden',
    flex: 1,
  },
  compactProgressFill: {
    height: '100%',
    backgroundColor: Colors.faithGold,
    borderRadius: 2,
  },
  compactText: {
    fontSize: 12,
    color: Colors.textGray,
    fontWeight: '500',
  },
  phaseInfo: {
    marginBottom: 16,
  },
  currentPhase: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: 4,
  },
  phaseDescription: {
    fontSize: 12,
    color: Colors.textGray,
    marginBottom: 4,
  },
  stepsCompleted: {
    fontSize: 11,
    color: Colors.growthGreen,
    fontWeight: '500',
  },
  phaseIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.textLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.textLight,
  },
  phaseCompleted: {
    backgroundColor: Colors.growthGreen,
    borderColor: Colors.growthGreen,
  },
  phaseCurrent: {
    backgroundColor: Colors.faithGold,
    borderColor: Colors.faithGold,
  },
  phaseNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.textGray,
  },
  phaseNumberCompleted: {
    color: Colors.hopeWhite,
  },
  phaseNumberCurrent: {
    color: Colors.hopeWhite,
  },
});

export default OnboardingProgressIndicator;
