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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
        <Text style={[
          styles.rarityText, 
          { 
            backgroundColor: getRarityColor(item.rarity),
            color: Colors.hopeWhite,
          }
        ]}>
          {item.rarity.toUpperCase()}
        </Text>
        {item.unlocked && item.unlockedAt && (
          <Text style={styles.unlockedDate}>
            Unlocked {new Date(item.unlockedAt).toLocaleDateString()}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContainer}>
              {/* Drag Handle */}
              <View style={styles.dragHandle} />
              
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

              <View style={styles.scrollContainer}>
                <FlatList
                  data={availableBadges}
                  renderItem={renderBadge}
                  keyExtractor={(item) => item.id}
                  numColumns={2}
                  contentContainerStyle={styles.badgesList}
                  showsVerticalScrollIndicator={false}
                  refreshing={loading}
                  onRefresh={loadBadges}
                  bounces={true}
                />
              </View>
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
    backgroundColor: 'rgba(26, 60, 109, 0.8)', // Anchor blue overlay
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: SCREEN_WIDTH,
    height: '85%',
    paddingTop: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
    opacity: 0.6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(242, 245, 247, 0.2)',
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
    marginHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(242, 245, 247, 0.1)',
    borderRadius: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.faithGold,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginTop: 4,
    opacity: 0.8,
  },
  scrollContainer: {
    flex: 1,
  },
  badgesList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  badgeItem: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 16,
    padding: 16,
    margin: 6,
    borderWidth: 3,
    flex: 1,
    minHeight: 160,
    shadowColor: Colors.anchorBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  unlockedBadge: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  lockedBadge: {
    opacity: 0.7,
    backgroundColor: 'rgba(242, 245, 247, 0.6)',
  },
  badgeIcon: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 12,
  },
  badgeName: {
    fontSize: 16,
    fontWeight: 'bold',
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  unlockedDate: {
    fontSize: 10,
    color: Colors.textGray,
    fontStyle: 'italic',
  },
});

export default BadgesModal;
