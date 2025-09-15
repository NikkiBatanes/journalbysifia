// =====================================================
// EXAMPLE: How to integrate trial access into your Playbook generation screen
// =====================================================
// This shows how to handle content generation limits and trial expiration

import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Colors } from '../theme/colors';
// Import trial hooks and components
import { useTrialAccess, useContentGeneration } from '../hooks/useTrialAccess';
import { FeatureLockOverlay } from '../components/FeatureLockOverlay';

// Your existing components
import { PlaybookCard } from '../components/PlaybookCard';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const PlaybookScreen = () => {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Trial access hooks
  const { hasActiveAccess, daysRemaining, hasExpired } = useTrialAccess();
  const {
    playbooksRemaining,
    checkCanGenerate,
    hasUnlimitedAccess,
  } = useContentGeneration();

  // Mock existing playbooks - replace with your actual data
  const [playbooks, setPlaybooks] = useState([
    { id: 1, title: 'Morning Prayer Routine', category: 'Prayer', createdAt: new Date() },
    { id: 2, title: 'Bible Study Plan', category: 'Study', createdAt: new Date() },
  ]);

  const handleGeneratePlaybook = async () => {
    try {
      // Check if user can generate content
      const result = await checkCanGenerate('playbook');

      if (!result.canGenerate) {
        if (result.reason === 'trial_expired') {
          setShowUpgradeModal(true);
          return;
        } else if (result.reason === 'limit_reached') {
          Alert.alert(
            'Limit Reached',
            'You\'ve reached your monthly playbook limit. Upgrade to generate more!',
            [
              { text: 'Maybe Later', style: 'cancel' },
              { text: 'Upgrade Now', onPress: () => setShowUpgradeModal(true) },
            ]
          );
          return;
        }
      }

      // Proceed with generation
      setIsGenerating(true);

      // Your existing playbook generation logic here
      await generatePlaybook();

      setIsGenerating(false);
    } catch (error) {
      setIsGenerating(false);
      Alert.alert('Error', 'Failed to generate playbook. Please try again.');
    }
  };

  const generatePlaybook = async () => {
    // Simulate API call - replace with your actual generation logic
    return new Promise(resolve => {
      setTimeout(() => {
        const newPlaybook = {
          id: Date.now(),
          title: 'New Spiritual Growth Plan',
          category: 'Growth',
          createdAt: new Date(),
        };
        setPlaybooks(prev => [newPlaybook, ...prev]);
        resolve(newPlaybook);
      }, 2000);
    });
  };

  const getRemainingText = () => {
    if (hasUnlimitedAccess) {
      return hasActiveAccess ? 'Unlimited (Trial)' : 'Unlimited';
    }
    return `${playbooksRemaining} remaining this month`;
  };

  const getGenerateButtonText = () => {
    if (isGenerating) {return 'Generating...';}
    if (hasExpired && playbooksRemaining === 0) {return 'Upgrade to Generate';}
    return 'Generate New Playbook';
  };

  return (
    <ScrollView style={styles.container}>
      {/* Trial Status */}
      {hasActiveAccess && (
        <View style={styles.trialBanner}>
          <Text style={styles.trialText}>
            🎉 Trial Active: Generate unlimited playbooks for {daysRemaining} more days!
          </Text>
        </View>
      )}

      {/* Generation Section */}
      <View style={styles.section}>
        <View style={styles.header}>
          <Text style={styles.title}>Spiritual Playbooks</Text>
          <View style={styles.limitBadge}>
            <Text style={styles.limitText}>{getRemainingText()}</Text>
          </View>
        </View>

        <Text style={styles.description}>
          Create personalized spiritual growth plans tailored to your journey and goals.
        </Text>

        <TouchableOpacity
          style={[
            styles.generateButton,
            (isGenerating || (hasExpired && playbooksRemaining === 0)) && styles.disabledButton,
          ]}
          onPress={handleGeneratePlaybook}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <LoadingSpinner size="small" color={Colors.white} />
          ) : (
            <Ionicons name="add-circle" size={24} color={Colors.white} />
          )}
          <Text style={styles.generateButtonText}>
            {getGenerateButtonText()}
          </Text>
        </TouchableOpacity>

        {/* Usage Warning */}
        {!hasUnlimitedAccess && playbooksRemaining <= 1 && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={20} color={Colors.treasureGold} />
            <Text style={styles.warningText}>
              {playbooksRemaining === 0
                ? 'You\'ve reached your monthly limit. Upgrade for unlimited generation!'
                : 'Only 1 playbook remaining this month. Consider upgrading for unlimited access.'
              }
            </Text>
          </View>
        )}
      </View>

      {/* Existing Playbooks */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Playbooks</Text>
        {playbooks.length > 0 ? (
          playbooks.map(playbook => (
            <PlaybookCard
              key={playbook.id}
              playbook={playbook}
              onPress={() => console.log('Open playbook:', playbook.title)}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color={Colors.contemplationGray} />
            <Text style={styles.emptyText}>No playbooks yet</Text>
            <Text style={styles.emptySubtext}>Generate your first spiritual growth plan!</Text>
          </View>
        )}
      </View>

      {/* Upgrade Modal */}
      <FeatureLockOverlay
        visible={showUpgradeModal}
        feature="playbooks"
        onClose={() => setShowUpgradeModal(false)}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.black,
  },
  limitBadge: {
    backgroundColor: Colors.lightPurple,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  limitText: {
    color: Colors.devotionalPurple,
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    color: Colors.journeyGray,
    lineHeight: 24,
    marginBottom: 20,
  },
  generateButton: {
    backgroundColor: Colors.wisdomIndigo,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  disabledButton: {
    backgroundColor: Colors.contemplationGray,
  },
  generateButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  warningBanner: {
    backgroundColor: Colors.winGold,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.treasureGold,
  },
  warningText: {
    color: Colors.alertCoral,
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.black,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
});

// =====================================================
// PLAYBOOK CARD COMPONENT EXAMPLE
// =====================================================

interface PlaybookCardProps {
  playbook: {
    id: number;
    title: string;
    category: string;
    createdAt: Date;
  };
  onPress: () => void;
}

const PlaybookCard: React.FC<PlaybookCardProps> = ({ playbook, onPress }) => {
  return (
    <TouchableOpacity style={cardStyles.container} onPress={onPress}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.title}>{playbook.title}</Text>
        <View style={cardStyles.categoryBadge}>
          <Text style={cardStyles.categoryText}>{playbook.category}</Text>
        </View>
      </View>
      <Text style={cardStyles.date}>
        Created {playbook.createdAt.toLocaleDateString()}
      </Text>
      <View style={cardStyles.footer}>
        <Ionicons name="chevron-forward" size={20} color={Colors.journeyGray} />
      </View>
    </TouchableOpacity>
  );
};

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.black,
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    backgroundColor: Colors.sanctuaryWhite,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 12,
    color: Colors.journeyGray,
    fontWeight: '500',
  },
  date: {
    fontSize: 14,
    color: Colors.contemplationGray,
    marginBottom: 8,
  },
  footer: {
    alignItems: 'flex-end',
  },
});
