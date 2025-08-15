import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useUserState } from '../hooks/useUserState';
import { Colors } from '../theme';

interface AIValueDemonstrationProps {
  feature: 'playbook_generation' | 'smart_journaling' | 'intelligence' | 'analytics';
  onUpgrade?: () => void;
  compact?: boolean;
}

const AIValueDemonstration: React.FC<AIValueDemonstrationProps> = ({
  feature,
  onUpgrade,
  compact = false,
}) => {
  const { userState, canAccessFeature } = useUserState();
  const [currentDemo, setCurrentDemo] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));

  const demoContent = {
    playbook_generation: {
      title: 'AI-Powered Playbook Generation',
      icon: 'book-outline',
      description: 'Watch AI create personalized spiritual guidance in real-time',
      demos: [
        {
          step: 'Analyzing your challenge...',
          insight: 'AI identifies key spiritual and emotional patterns',
          value: 'Personalized understanding of your unique situation',
        },
        {
          step: 'Finding relevant scripture...',
          insight: 'Connects biblical wisdom to your specific needs',
          value: 'Contextual spiritual guidance that speaks to your heart',
        },
        {
          step: 'Creating action steps...',
          insight: 'Generates practical, faith-based solutions',
          value: 'Clear pathway from struggle to breakthrough',
        },
      ],
      upgradeMessage: 'Unlock unlimited AI-generated playbooks',
    },
    smart_journaling: {
      title: 'Smart Journaling with AI Insights',
      icon: 'create-outline',
      description: 'AI analyzes your spiritual journey and provides personalized insights',
      demos: [
        {
          step: 'Writing reflection...',
          insight: 'AI detects emotional patterns and spiritual themes',
          value: 'Deeper self-awareness and spiritual growth tracking',
        },
        {
          step: 'Generating insights...',
          insight: 'Provides biblical perspective on your thoughts',
          value: 'Divine wisdom applied to your daily experiences',
        },
        {
          step: 'Suggesting next steps...',
          insight: 'Recommends prayers, actions, and scripture',
          value: 'Guided spiritual development tailored to you',
        },
      ],
      upgradeMessage: 'Access smart journaling with AI insights',
    },
    intelligence: {
      title: 'Advanced AI Intelligence',
      icon: 'bulb-outline',
      description: 'Experience next-level spiritual guidance with premium AI',
      demos: [
        {
          step: 'Deep pattern analysis...',
          insight: 'Identifies recurring spiritual challenges and victories',
          value: 'Breakthrough insights for lasting transformation',
        },
        {
          step: 'Predictive guidance...',
          insight: 'Anticipates spiritual needs and growth opportunities',
          value: 'Proactive spiritual development and preparation',
        },
        {
          step: 'Personalized recommendations...',
          insight: 'Curates content based on your spiritual DNA',
          value: 'Perfectly tailored spiritual nutrition for your soul',
        },
      ],
      upgradeMessage: 'Unlock advanced AI intelligence features',
    },
    analytics: {
      title: 'Spiritual Growth Analytics',
      icon: 'analytics-outline',
      description: 'Track your spiritual journey with AI-powered insights',
      demos: [
        {
          step: 'Analyzing prayer patterns...',
          insight: 'Discovers your most effective prayer times and styles',
          value: 'Optimized prayer life for deeper connection with God',
        },
        {
          step: 'Tracking breakthrough moments...',
          insight: 'Identifies what triggers spiritual breakthroughs',
          value: 'Replicate conditions that lead to spiritual growth',
        },
        {
          step: 'Measuring transformation...',
          insight: 'Quantifies your spiritual growth over time',
          value: 'Celebrate progress and stay motivated in your journey',
        },
      ],
      upgradeMessage: 'Access advanced spiritual analytics',
    },
  };

  const currentFeature = demoContent[feature];
  const hasAccess = canAccessFeature(feature);

  useEffect(() => {
    if (!hasAccess) {
      const interval = setInterval(() => {
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();

        setCurrentDemo(prev => (prev + 1) % currentFeature.demos.length);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [hasAccess, fadeAnim, currentFeature.demos.length]);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Ionicons name={currentFeature.icon} size={20} color={Colors.faithGold} />
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle}>{currentFeature.title}</Text>
          <Text style={styles.compactDescription}>{currentFeature.description}</Text>
        </View>
        {!hasAccess && (
          <TouchableOpacity style={styles.compactUpgradeButton} onPress={onUpgrade}>
            <Text style={styles.compactUpgradeText}>Unlock</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, !hasAccess && styles.lockedContainer]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name={currentFeature.icon} size={24} color={Colors.faithGold} />
          <Text style={styles.title}>{currentFeature.title}</Text>
          {!hasAccess && (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={12} color={Colors.hopeWhite} />
            </View>
          )}
        </View>
        <Text style={styles.description}>{currentFeature.description}</Text>
      </View>

      <Animated.View style={[styles.demoSection, { opacity: fadeAnim }]}>
        <View style={styles.demoCard}>
          <View style={styles.demoHeader}>
            <View style={styles.loadingDots}>
              <View style={[styles.dot, styles.dotActive]} />
              <View style={[styles.dot, styles.dotActive]} />
              <View style={[styles.dot, styles.dotActive]} />
            </View>
            <Text style={styles.demoStep}>
              {currentFeature.demos[currentDemo].step}
            </Text>
          </View>

          <View style={styles.demoContent}>
            <Text style={styles.demoInsight}>
              {currentFeature.demos[currentDemo].insight}
            </Text>
            <View style={styles.valueHighlight}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreen} />
              <Text style={styles.demoValue}>
                {currentFeature.demos[currentDemo].value}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.demoIndicators}>
          {currentFeature.demos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentDemo && styles.activeIndicator,
              ]}
            />
          ))}
        </View>
      </Animated.View>

      {!hasAccess && (
        <View style={styles.upgradeSection}>
          <Text style={styles.upgradeMessage}>{currentFeature.upgradeMessage}</Text>
          <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
            <Text style={styles.upgradeButtonText}>
              {(userState.tier === 'basic' || userState.tier === 'seeker') ? 'Start Free Trial' : 'Upgrade Now'}
            </Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </View>
      )}

      {hasAccess && (
        <View style={styles.accessGranted}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
          <Text style={styles.accessText}>Feature Unlocked</Text>
        </View>
      )}
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
  lockedContainer: {
    borderWidth: 1,
    borderColor: Colors.faithGold,
    borderStyle: 'dashed',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    gap: 12,
  },
  compactContent: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: 2,
  },
  compactDescription: {
    fontSize: 12,
    color: Colors.textGray,
  },
  compactUpgradeButton: {
    backgroundColor: Colors.faithGold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  compactUpgradeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  header: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textDark,
    flex: 1,
  },
  lockBadge: {
    backgroundColor: Colors.faithGold,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 20,
  },
  demoSection: {
    marginBottom: 16,
  },
  demoCard: {
    backgroundColor: Colors.darkBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textGray,
  },
  dotActive: {
    backgroundColor: Colors.faithGold,
  },
  demoStep: {
    fontSize: 12,
    color: Colors.faithGold,
    fontWeight: '500',
  },
  demoContent: {
    gap: 8,
  },
  demoInsight: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  valueHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 8,
    borderRadius: 6,
  },
  demoValue: {
    fontSize: 12,
    color: Colors.growthGreen,
    fontWeight: '500',
    flex: 1,
  },
  demoIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textLight,
  },
  activeIndicator: {
    backgroundColor: Colors.faithGold,
  },
  upgradeSection: {
    alignItems: 'center',
    gap: 12,
  },
  upgradeMessage: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
  },
  upgradeButton: {
    backgroundColor: Colors.faithGold,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  accessGranted: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
  },
  accessText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.growthGreen,
  },
});

export default AIValueDemonstration;
