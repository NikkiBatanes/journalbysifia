// =====================================================
// EXAMPLE: How to integrate trial access into your Journaling screen
// =====================================================
// This shows how to import React, { useState } from 'react';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
// Import trial hooks and components
import { useTrialAccess, useFeatureAccess } from '../hooks/useTrialAccess';
import { FeatureLockOverlay, FeatureLockCard } from '../components/FeatureLockOverlay';

// Your existing components
import { JournalEntry } from '../components/JournalEntry';
import { TemplateCard } from '../components/TemplateCard';

export const JournalingScreen = () => {
  const [showSmartJournalingLock, setShowSmartJournalingLock] = useState(false);
  const [showTemplateLock, setShowTemplateLock] = useState(false);

  // Trial access hooks
  const { hasActiveAccess, daysRemaining, hasExpired } = useTrialAccess();
  const { hasAccess: hasSmartJournaling } = useFeatureAccess('smartJournalingEnabled');
  const { hasAccess: hasAllTemplates } = useFeatureAccess('journalTemplatesAccess');

  // Mock data - replace with your actual data
  const freeTemplates = [
    { id: 1, name: 'Daily Gratitude', isPremium: false },
    { id: 2, name: 'Simple Prayer', isPremium: false },
    { id: 3, name: 'Bible Reflection', isPremium: false },
  ];

  const premiumTemplates = [
    { id: 4, name: 'Deep Prayer Journey', isPremium: true },
    { id: 5, name: 'Spiritual Warfare', isPremium: true },
    { id: 6, name: 'Prophetic Journaling', isPremium: true },
  ];

  const handleSmartJournalingPress = () => {
    if (!hasSmartJournaling) {
      setShowSmartJournalingLock(true);
      return;
    }

    // Navigate to smart journaling
    console.log('Navigate to smart journaling');
  };

  const handlePremiumTemplatePress = (template: any) => {
    if (hasAllTemplates !== 'all') {
      setShowTemplateLock(true);
      return;
    }

    // Navigate to template
    console.log('Navigate to template:', template.name);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Trial Status Display */}
      {hasActiveAccess && (
        <View style={styles.trialBanner}>
          <Text style={styles.trialText}>
            🎉 Trial Active: {daysRemaining} days remaining - Full access to all features!
          </Text>
        </View>
      )}

      {/* Smart Journaling Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Smart Journaling</Text>
        <TouchableOpacity
          style={[styles.featureCard, !hasSmartJournaling && styles.lockedCard]}
          onPress={handleSmartJournalingPress}
        >
          <View style={styles.featureHeader}>
            <Ionicons
              name="bulb"
              size={24}
              color={hasSmartJournaling ? Colors.wisdomIndigo : Colors.contemplationGray}
            />
            <Text style={[styles.featureTitle, !hasSmartJournaling && styles.lockedText]}>
              AI-Powered Journaling
            </Text>
            {!hasSmartJournaling && <Ionicons name="lock-closed" size={20} color={Colors.contemplationGray} />}
          </View>
          <Text style={[styles.featureDescription, !hasSmartJournaling && styles.lockedText]}>
            Get personalized prompts and insights for deeper spiritual reflection
          </Text>
          {hasExpired && !hasSmartJournaling && (
            <Text style={styles.upgradePrompt}>
              Upgrade to siFia SPARK to unlock smart journaling
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Free Templates - Always Available */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Free Templates</Text>
        {freeTemplates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            onPress={() => console.log('Navigate to template:', template.name)}
          />
        ))}
      </View>

      {/* Premium Templates - Locked after trial */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Premium Templates</Text>
        <FeatureLockCard
          feature="journalTemplates"
          isLocked={hasAllTemplates !== 'all'}
        >
          {premiumTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onPress={() => handlePremiumTemplatePress(template)}
            />
          ))}
        </FeatureLockCard>
      </View>

      {/* Recent Entries */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Entries</Text>
        {/* Your existing journal entries component */}
        <JournalEntry />
      </View>

      {/* Feature Lock Modals */}
      <FeatureLockOverlay
        visible={showSmartJournalingLock}
        feature="smartJournaling"
        onClose={() => setShowSmartJournalingLock(false)}
      />

      <FeatureLockOverlay
        visible={showTemplateLock}
        feature="journalTemplates"
        onClose={() => setShowTemplateLock(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.sanctuaryWhite,
  },
  trialBanner: {
    backgroundColor: Colors.anchorBlueLight,
    padding: 12,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.playbookBlue,
  },
  trialText: {
    color: Colors.wisdomIndigo,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  lockedCard: {
    opacity: 0.7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  lockedText: {
    color: Colors.contemplationGray,
  },
  featureDescription: {
    fontSize: 14,
    color: Colors.journeyGray,
    lineHeight: 20,
  },
  upgradePrompt: {
    fontSize: 12,
    color: Colors.wisdomIndigo,
    fontWeight: '500',
    marginTop: 8,
  },
});

// =====================================================
// TEMPLATE CARD COMPONENT EXAMPLE
// =====================================================

interface TemplateCardProps {
  template: {
    id: number;
    name: string;
    isPremium: boolean;
  };
  onPress: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onPress }) => {
  return (
    <TouchableOpacity style={templateStyles.card} onPress={onPress}>
      <View style={templateStyles.header}>
        <Text style={templateStyles.name}>{template.name}</Text>
        {template.isPremium && (
          <View style={templateStyles.premiumBadge}>
            <Text style={templateStyles.premiumText}>PRO</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const templateStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  premiumBadge: {
    backgroundColor: Colors.wisdomIndigo,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  premiumText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '600',
  },
});
