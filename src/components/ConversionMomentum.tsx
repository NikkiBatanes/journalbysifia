import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useUserState } from '../hooks/useUserState';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme';

interface ConversionMomentumProps {
  trigger: 'playbook_generated' | 'feature_explored' | 'limit_reached' | 'trial_reminder';
  context?: string;
  compact?: boolean;
}

const ConversionMomentum: React.FC<ConversionMomentumProps> = ({
  trigger,
  context,
  compact = false,
}) => {
  const { userState, getFeatureLimits } = useUserState();
  const navigation = useNavigation();
  const [pulseAnim] = useState(new Animated.Value(1));
  const [showComponent, setShowComponent] = useState(true);

  const featureLimits = getFeatureLimits();

  useEffect(() => {
    // Pulse animation for attention
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [pulseAnim]);

  const getMomentumContent = () => {
    switch (trigger) {
      case 'playbook_generated':
        return {
          icon: 'rocket-outline',
          title: 'Amazing! Your First Playbook is Ready',
          subtitle: 'See what else siFia can do for your spiritual journey',
          highlights: [
            'Generate unlimited playbooks',
            'Access smart journaling with AI insights',
            'Get advanced spiritual analytics',
            'Unlock premium biblical intelligence',
          ],
          ctaText: 'Continue Your Journey',
          urgency: 'Start your 3-day free trial now',
          color: Colors.growthGreen,
        };

      case 'feature_explored':
        return {
          icon: 'star-outline',
          title: 'You\'re Experiencing the Power of siFia',
          subtitle: 'Ready to unlock your full spiritual potential?',
          highlights: [
            'Unlimited access to all features',
            'Priority support for your journey',
            'Advanced AI-powered insights',
            'Export and share your growth',
          ],
          ctaText: 'Unlock Everything',
          urgency: 'Limited time: 3 days free',
          color: Colors.faithGold,
        };

      case 'limit_reached':
        return {
          icon: 'warning-outline',
          title: 'You\'ve Reached Your Limit',
          subtitle: 'Don\'t let this stop your spiritual breakthrough',
          highlights: [
            `Only ${featureLimits?.playbooks.remaining || 0} playbooks remaining`,
            'Unlock unlimited spiritual guidance',
            'Continue your transformation journey',
            'Access premium AI features',
          ],
          ctaText: 'Remove Limits',
          urgency: 'Upgrade now to continue',
          color: Colors.alertCoral,
        };

      case 'trial_reminder':
        return {
          icon: 'time-outline',
          title: 'Your Trial is Almost Over',
          subtitle: 'Don\'t lose access to your spiritual growth tools',
          highlights: [
            'Keep your personalized playbooks',
            'Continue unlimited AI generation',
            'Maintain your spiritual momentum',
            'Access premium features forever',
          ],
          ctaText: 'Keep My Access',
          urgency: 'Trial ends soon',
          color: Colors.alertCoral,
        };

      default:
        return null;
    }
  };

  const content = getMomentumContent();
  if (!content || userState.tier === 'transformation' || userState.tier === 'family') {
    return null;
  }

  const handleUpgrade = () => {
    if (userState.tier === 'seeker') {
      navigation.navigate('OnboardingSalesOffer' as never);
    } else {
      navigation.navigate('SubscriptionManagement' as never);
    }
  };

  const handleDismiss = () => {
    setShowComponent(false);
  };

  if (!showComponent) {
    return null;
  }

  if (compact) {
    return (
      <Animated.View style={[styles.compactContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Ionicons name={content.icon} size={20} color={content.color} />
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle}>{content.title}</Text>
          <Text style={styles.compactUrgency}>{content.urgency}</Text>
        </View>
        <TouchableOpacity style={[styles.compactButton, { backgroundColor: content.color }]} onPress={handleUpgrade}>
          <Text style={styles.compactButtonText}>{content.ctaText}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { borderColor: content.color, transform: [{ scale: pulseAnim }] },
      ]}
    >
      <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
        <Ionicons name="close" size={20} color={Colors.textGray} />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: content.color }]}>
          <Ionicons name={content.icon} size={32} color={Colors.hopeWhite} />
        </View>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.subtitle}>{content.subtitle}</Text>
      </View>

      <View style={styles.highlightsSection}>
        {content.highlights.map((highlight, index) => (
          <View key={index} style={styles.highlightItem}>
            <Ionicons name="checkmark-circle" size={16} color={content.color} />
            <Text style={styles.highlightText}>{highlight}</Text>
          </View>
        ))}
      </View>

      <View style={styles.urgencyBanner}>
        <Ionicons name="flash" size={16} color={content.color} />
        <Text style={[styles.urgencyText, { color: content.color }]}>{content.urgency}</Text>
      </View>

      <TouchableOpacity
        style={[styles.ctaButton, { backgroundColor: content.color }]}
        onPress={handleUpgrade}
      >
        <Text style={styles.ctaButtonText}>{content.ctaText}</Text>
        <Ionicons name="arrow-forward" size={16} color={Colors.hopeWhite} />
      </TouchableOpacity>

      {context && (
        <Text style={styles.contextText}>{context}</Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 16,
    padding: 20,
    margin: 16,
    borderWidth: 2,
    shadowColor: Colors.textDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    position: 'relative',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    marginHorizontal: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.faithGold,
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
  compactUrgency: {
    fontSize: 12,
    color: Colors.faithGold,
    fontWeight: '500',
  },
  compactButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  compactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  dismissButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  highlightsSection: {
    marginBottom: 16,
    gap: 8,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  highlightText: {
    fontSize: 14,
    color: Colors.textDark,
    flex: 1,
  },
  urgencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 24,
    marginBottom: 8,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  contextText: {
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ConversionMomentum;
