/**
 * Enhanced Generation Example
 * Shows how to integrate subscription system, intelligence, and queue management
 * Provides simple, beautiful user experience for playbook/devotional generation
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Import our new components and services
import { UsageIndicator, CompactUsageIndicator } from '../subscription/UsageIndicator';
import { UpgradeModal } from '../subscription/UpgradeModal';
import { QueueStatusCard } from '../subscription/QueueStatusCard';
import { useSubscription, useGeneration, useBehaviorTracking } from '../../hooks/useSubscription';
import { enhancedGenerationService } from '../../services/enhancedGenerationService';

export const EnhancedGenerationExample: React.FC = () => {
  const [userInput, setUserInput] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [activeGenerations, setActiveGenerations] = useState<string[]>([]);
  const [generationType, setGenerationType] = useState<'playbook' | 'devotional'>('playbook');

  // Hooks for subscription and generation management
  const { subscription, loading, hasIntelligence } = useSubscription();
  const { suggestions } = useGeneration();
  const { trackBehavior } = useBehaviorTracking();

  const handleGeneration = async () => {
    try {
      // Track user intent
      await trackBehavior('generation_initiated', 'generation', {
        type: generationType,
        input_length: userInput.length,
        has_suggestions: !!suggestions,
      });

      let result;
      if (generationType === 'playbook') {
        result = await enhancedGenerationService.generatePlaybook({
          userId: 'current-user-id', // Get from auth context
          userInput,
          userName: 'User Name', // Get from auth context
        });
      } else {
        result = await enhancedGenerationService.generateDevotional({
          userId: 'current-user-id',
          userName: 'User Name',
          userInput,
        });
      }

      if (result.success && result.queueId) {
        // Add to active generations for tracking
        setActiveGenerations(prev => [...prev, result.queueId!]);

        // Clear input
        setUserInput('');

        // Show success message
        Alert.alert(
          'Generation Started! 🚀',
          result.message,
          [{ text: 'OK' }]
        );
      } else if (result.upgradeRequired) {
        // Show upgrade modal
        setShowUpgradeModal(true);
      } else {
        // Show error
        Alert.alert('Generation Failed', result.message);
      }
    } catch (error) {
      console.error('Generation error:', error);
      Alert.alert('Error', 'Failed to start generation. Please try again.');
    }
  };

  const handleGenerationComplete = (queueId: string, resultId: string) => {
    // Remove from active generations
    setActiveGenerations(prev => prev.filter(id => id !== queueId));

    // Track completion
    trackBehavior('generation_completed', 'completion', {
      queue_id: queueId,
      result_id: resultId,
      type: generationType,
    });

    // Navigate to result (you'd implement this)
    Alert.alert(
      'Generation Complete! ✨',
      `Your ${generationType} is ready to view.`,
      [
        { text: 'View Now', onPress: () => console.log('Navigate to result:', resultId) },
        { text: 'Later', style: 'cancel' },
      ]
    );
  };

  const handleGenerationCancel = (queueId: string) => {
    setActiveGenerations(prev => prev.filter(id => id !== queueId));
    trackBehavior('generation_cancelled', 'engagement', { queue_id: queueId });
  };

  const handleGenerationError = (queueId: string, error: string) => {
    setActiveGenerations(prev => prev.filter(id => id !== queueId));
    trackBehavior('generation_failed', 'completion', {
      queue_id: queueId,
      error_message: error,
    }, { success: false });

    Alert.alert('Generation Failed', error);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading subscription data...</Text>
      </View>
    );
  }

  // Generation capabilities checked inline

  return (
    <ScrollView style={styles.container}>
      {/* Header with subscription info */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Generate Content</Text>
        <Text style={styles.headerSubtitle}>
          {subscription?.tier_display_name || 'Free Trial'} Plan
        </Text>

        {/* Compact usage indicators */}
        <View style={styles.compactUsageContainer}>
          <CompactUsageIndicator
            type="playbook"
            onUpgradePress={() => setShowUpgradeModal(true)}
          />
          <CompactUsageIndicator
            type="devotional"
            onUpgradePress={() => setShowUpgradeModal(true)}
          />
        </View>
      </View>

      {/* Usage Indicators */}
      <UsageIndicator
        type="playbook"
        onUpgradePress={() => setShowUpgradeModal(true)}
        showIntelligenceBadge={true}
      />

      <UsageIndicator
        type="devotional"
        onUpgradePress={() => setShowUpgradeModal(true)}
        showIntelligenceBadge={true}
      />

      {/* AI Suggestions (Premium Feature) */}
      {hasIntelligence && suggestions && (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeader}>
            <Ionicons name="sparkles" size={20} color="#7C3AED" />
            <Text style={styles.suggestionsTitle}>AI Suggestions for You</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {suggestions.suggestedTopics?.map((topic: string, index: number) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => setUserInput(topic)}
              >
                <Text style={styles.suggestionText}>{topic}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.suggestionsFooter}>
            Optimal time: {suggestions.optimalTiming} •
            Challenge level: {suggestions.challengeLevel}
          </Text>
        </View>
      )}

      {/* Generation Type Selector */}
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            generationType === 'playbook' && styles.typeButtonActive,
          ]}
          onPress={() => setGenerationType('playbook')}
        >
          <Ionicons
            name="book"
            size={20}
            color={generationType === 'playbook' ? 'white' : '#6B7280'}
          />
          <Text style={[
            styles.typeButtonText,
            generationType === 'playbook' && styles.typeButtonTextActive,
          ]}>
            Playbook
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeButton,
            generationType === 'devotional' && styles.typeButtonActive,
          ]}
          onPress={() => setGenerationType('devotional')}
        >
          <Ionicons
            name="heart"
            size={20}
            color={generationType === 'devotional' ? 'white' : '#6B7280'}
          />
          <Text style={[
            styles.typeButtonText,
            generationType === 'devotional' && styles.typeButtonTextActive,
          ]}>
            Devotional
          </Text>
        </TouchableOpacity>
      </View>

      {/* Input Section */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>
          What would you like guidance on?
        </Text>
        <TextInput
          style={styles.textInput}
          value={userInput}
          onChangeText={setUserInput}
          placeholder={
            generationType === 'playbook'
              ? "e.g., I'm struggling with comparison and jealousy..."
              : 'e.g., Help me grow in patience and understanding...'
          }
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Character count */}
        <Text style={styles.characterCount}>
          {userInput.length}/500 characters
        </Text>
      </View>

      {/* Generate Button */}
      <TouchableOpacity
        style={[
          styles.generateButton,
          (!userInput.trim() || userInput.length < 10) && styles.generateButtonDisabled,
        ]}
        onPress={handleGeneration}
        disabled={!userInput.trim() || userInput.length < 10}
      >
        <LinearGradient
          colors={
            (!userInput.trim() || userInput.length < 10)
              ? ['#E5E7EB', '#D1D5DB']
              : ['#4F46E5', '#7C3AED']
          }
          style={styles.generateGradient}
        >
          <Ionicons
            name={generationType === 'playbook' ? 'book' : 'heart'}
            size={20}
            color="white"
          />
          <Text style={styles.generateButtonText}>
            Generate {generationType === 'playbook' ? 'Playbook' : 'Devotional'}
          </Text>
          {hasIntelligence && (
            <Ionicons name="sparkles" size={16} color="white" />
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Active Generations */}
      {activeGenerations.length > 0 && (
        <View style={styles.activeGenerationsContainer}>
          <Text style={styles.activeGenerationsTitle}>
            Active Generations
          </Text>
          {activeGenerations.map((queueId) => (
            <QueueStatusCard
              key={queueId}
              queueId={queueId}
              type={generationType}
              onComplete={(resultId) => handleGenerationComplete(queueId, resultId)}
              onCancel={() => handleGenerationCancel(queueId)}
              onError={(error) => handleGenerationError(queueId, error)}
              intelligenceEnabled={hasIntelligence}
            />
          ))}
        </View>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={subscription?.tier}
        context="limit_reached"
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  compactUsageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  suggestionsContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  suggestionChip: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '500',
  },
  suggestionsFooter: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  typeSelector: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  typeButtonActive: {
    backgroundColor: '#4F46E5',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },
  typeButtonTextActive: {
    color: 'white',
  },
  inputContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 8,
  },
  generateButton: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  generateButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginHorizontal: 8,
  },
  activeGenerationsContainer: {
    margin: 16,
  },
  activeGenerationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
});
