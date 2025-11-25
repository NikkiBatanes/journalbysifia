import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Colors } from '../theme';
import ThemedText from './common/ThemedText';
import { faithPointsService, Badge } from '../services/faithPointsService';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/IndustryStandardAuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BadgesModalProps {
  visible: boolean;
  onClose: () => void;
}

const BadgesModal: React.FC<BadgesModalProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const [userBadges, setUserBadges] = useState<Badge[]>([]);
  const [availableBadges, setAvailableBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && user) {
      loadBadges();
    }
  }, [visible, user]);

  const loadBadges = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get user's unlocked badges from database
      const { data: badgeRows, error: badgeError } = await supabase
        .from('user_badges')
        .select('badge_data')
        .eq('user_id', user.id);

      let unlockedBadges: Badge[] = [];
      if (!badgeError && badgeRows) {
        unlockedBadges = badgeRows.map(row => row.badge_data);
      }

      // Get all available badges
      const allBadges = await faithPointsService.getAvailableBadges();
      
      // Mark which badges are unlocked
      const availableWithStatus = allBadges.map(badge => ({
        ...badge,
        unlocked: unlockedBadges.some(ub => ub.id === badge.id),
        unlockedAt: unlockedBadges.find(ub => ub.id === badge.id)?.unlockedAt,
      }));

      setAvailableBadges(availableWithStatus);
      setUserBadges(unlockedBadges);
    } catch (error) {
      console.error('Error loading badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return Colors.growthGreen;
      case 'rare': return Colors.playbookBlue;
      case 'epic': return Colors.devotionalPurple;
      case 'legendary': return '#FFD700'; // Gold
      default: return Colors.growthGreen;
    }
  };

  const renderBadge = ({ item }: { item: Badge & { unlocked?: boolean; unlockedAt?: string } }) => (
    <View style={[
      styles.badgeItem,
      item.unlocked ? styles.unlockedBadge : styles.lockedBadge,
      { borderColor: getRarityColor(item.rarity) }
    ]}>
      <Text style={styles.badgeIcon}>{item.unlocked ? item.icon : '🔒'}</Text>
      <ThemedText weight="medium" style={styles.badgeName}>
        {item.name}
      </ThemedText>
      <ThemedText style={styles.badgeDescription}>
        {item.description}
      </ThemedText>
      <View style={styles.badgeFooter}>
        <Text style={[styles.rarityText, { color: getRarityColor(item.rarity) }]}>
          {item.rarity.toUpperCase()}
        </Text>
        {item.unlocked && item.unlockedAt && (
          <Text style={styles.unlockedDate}>
            {new Date(item.unlockedAt).toLocaleDateString()}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <ThemedText weight="bold" style={styles.modalTitle}>
                  My Badges
                </ThemedText>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{userBadges.length}</Text>
                  <Text style={styles.statLabel}>Unlocked</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{availableBadges.length}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
              </View>

              <FlatList
                data={availableBadges}
                renderItem={renderBadge}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={styles.badgesList}
                showsVerticalScrollIndicator={false}
                refreshing={loading}
                onRefresh={loadBadges}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    width: SCREEN_WIDTH - 32,
    maxHeight: SCREEN_HEIGHT * 0.85, // Use screen height for better sizing
    padding: 24,
    flex: 0, // Don't expand to fill all available space
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: Colors.hopeWhite,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  badgesList: {
    paddingBottom: 20,
  },
  badgeItem: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 16,
    padding: 16,
    margin: 8,
    borderWidth: 2,
    flex: 1,
    minHeight: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unlockedBadge: {
    opacity: 1,
  },
  lockedBadge: {
    opacity: 0.7,
  },
  badgeIcon: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 12,
  },
  badgeName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    color: Colors.anchorBlue,
  },
  badgeDescription: {
    fontSize: 12,
    textAlign: 'center',
    color: Colors.textGray,
    marginBottom: 12,
    lineHeight: 16,
  },
  badgeFooter: {
    alignItems: 'center',
    marginTop: 'auto',
  },
  rarityText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  unlockedDate: {
    fontSize: 10,
    color: Colors.textGray,
  },
});

export default BadgesModal;
