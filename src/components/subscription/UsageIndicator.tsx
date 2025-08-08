/**
 * Usage Indicator Component
 * Shows remaining generations with beautiful progress bars
 * Simple, user-friendly display (no costs or tokens)
 */

import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../../hooks/useSubscription';

interface UsageIndicatorProps {
  type: 'playbook' | 'devotional';
  onUpgradePress?: () => void;
  showIntelligenceBadge?: boolean;
}

export const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  type,
  onUpgradePress,
  showIntelligenceBadge = true,
}) => {
  const { canGenerate, hasIntelligence, loading } = useSubscription();

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBar} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const generationData = canGenerate(type);
  const { allowed, remaining, limit, used } = generationData;

  // Calculate progress for visual display
  const isUnlimited = remaining === 'Unlimited';
  const progress = isUnlimited ? 1 : (used / (limit as number));
  const remainingCount = isUnlimited ? '∞' : remaining;

  // Determine color scheme based on usage
  const getColorScheme = () => {
    if (isUnlimited) {
      return {
        gradient: ['#4F46E5', '#7C3AED'],
        background: '#EEF2FF',
        text: '#4F46E5',
        warning: false,
      };
    }

    const usagePercent = progress;
    if (usagePercent >= 1) {
      return {
        gradient: ['#EF4444', '#DC2626'],
        background: '#FEF2F2',
        text: '#EF4444',
        warning: true,
      };
    } else if (usagePercent >= 0.8) {
      return {
        gradient: ['#F59E0B', '#D97706'],
        background: '#FFFBEB',
        text: '#F59E0B',
        warning: true,
      };
    } else {
      return {
        gradient: ['#10B981', '#059669'],
        background: '#ECFDF5',
        text: '#10B981',
        warning: false,
      };
    }
  };

  const colorScheme = getColorScheme();
  const contentType = type === 'playbook' ? 'Playbooks' : 'Devotionals';

  return (
    <View style={[styles.container, { backgroundColor: colorScheme.background }]}>
      {/* Header with intelligence badge */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colorScheme.text }]}>
            {contentType} Remaining
          </Text>
          {hasIntelligence && showIntelligenceBadge && (
            <View style={styles.intelligenceBadge}>
              <Ionicons name="sparkles" size={12} color="#7C3AED" />
              <Text style={styles.intelligenceText}>AI Enhanced</Text>
            </View>
          )}
        </View>

        <Text style={[styles.count, { color: colorScheme.text }]}>
          {remainingCount}
        </Text>
      </View>

      {/* Progress bar */}
      {!isUnlimited && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <LinearGradient
              colors={colorScheme.gradient}
              style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          <Text style={styles.progressText}>
            {used} of {limit} used
          </Text>
        </View>
      )}

      {/* Upgrade prompt for limited users */}
      {!allowed && onUpgradePress && (
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={onUpgradePress}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            style={styles.upgradeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="arrow-up-circle" size={16} color="white" />
            <Text style={styles.upgradeText}>Upgrade for More</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Warning message */}
      {colorScheme.warning && allowed && (
        <View style={styles.warningContainer}>
          <Ionicons
            name={progress >= 1 ? 'alert-circle' : 'warning'}
            size={14}
            color={colorScheme.text}
          />
          <Text style={[styles.warningText, { color: colorScheme.text }]}>
            {progress >= 1
              ? `No ${contentType.toLowerCase()} left this month`
              : `Running low on ${contentType.toLowerCase()}`
            }
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  loadingBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  intelligenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  intelligenceText: {
    fontSize: 10,
    color: '#7C3AED',
    fontWeight: '500',
    marginLeft: 2,
  },
  count: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressBackground: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  upgradeButton: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  upgradeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  warningText: {
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
});

// Compact version for smaller spaces
export const CompactUsageIndicator: React.FC<UsageIndicatorProps> = ({
  type,
  onUpgradePress,
}) => {
  const { canGenerate, hasIntelligence } = useSubscription();
  const generationData = canGenerate(type);
  const { remaining, allowed } = generationData;

  const isUnlimited = remaining === 'Unlimited';
  const remainingCount = isUnlimited ? '∞' : remaining;

  const getColor = () => {
    if (isUnlimited) {return '#4F46E5';}
    if (!allowed) {return '#EF4444';}
    if ((remaining as number) <= 2) {return '#F59E0B';}
    return '#10B981';
  };

  return (
    <TouchableOpacity
      style={[styles.compactContainer, { borderColor: getColor() }]}
      onPress={!allowed ? onUpgradePress : undefined}
      disabled={allowed}
    >
      <View style={styles.compactContent}>
        <Text style={[styles.compactCount, { color: getColor() }]}>
          {remainingCount}
        </Text>
        <Text style={styles.compactLabel}>
          {type === 'playbook' ? 'PB' : 'DEV'}
        </Text>
        {hasIntelligence && (
          <Ionicons name="sparkles" size={10} color="#7C3AED" />
        )}
      </View>
      {!allowed && (
        <View style={[styles.compactUpgrade, { backgroundColor: getColor() }]}>
          <Ionicons name="add" size={12} color="white" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const compactStyles = StyleSheet.create({
  compactContainer: {
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 8,
    minWidth: 60,
    position: 'relative',
  },
  compactContent: {
    alignItems: 'center',
  },
  compactCount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  compactLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  compactUpgrade: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Merge styles
Object.assign(styles, compactStyles);
