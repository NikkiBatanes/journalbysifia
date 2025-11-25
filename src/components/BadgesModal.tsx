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
// import ThemedText from './common/ThemedText';
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
    ]}>
      <View style={styles.badgeIconContainer}>
        <Text style={styles.badgeIcon}>
          {item.unlocked ? item.icon : '🔐'}
        </Text>
        {!item.unlocked && <View style={styles.lockOverlay} />}
      </View>
      
      <Text style={[
        styles.badgeName,
        { color: item.unlocked ? Colors.hopeWhite : 'rgba(242, 245, 247, 0.6)' }
      ]}>
        {item.name}
      </Text>
      
      <Text style={[
        styles.badgeDescription,
        { color: item.unlocked ? 'rgba(242, 245, 247, 0.8)' : 'rgba(242, 245, 247, 0.5)' }
      ]}>
        {item.description}
      </Text>
      
      <View style={styles.badgeFooter}>
        <View style={[
          styles.rarityBadge,
          { backgroundColor: getRarityColor(item.rarity) }
        ]}>
          <Text style={styles.rarityText}>
            {item.rarity.toUpperCase()}
          </Text>
        </View>
        
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
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.fullScreenContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            My Badges
          </Text>
          <View style={styles.placeholder} />
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
          bounces={true}
          style={styles.flatListStyle}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(242, 245, 247, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: Colors.hopeWhite,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
    marginHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(242, 245, 247, 0.1)',
    borderRadius: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.faithGold,
  },
  statLabel: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginTop: 6,
    opacity: 0.8,
  },
  flatListStyle: {
    flex: 1,
    paddingHorizontal: 20,
  },
  badgesList: {
    paddingBottom: 40,
  },
  badgeItem: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 24,
    margin: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flex: 1,
    minHeight: 200,
    justifyContent: 'space-between',
  },
  unlockedBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  lockedBadge: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  badgeIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  badgeIcon: {
    fontSize: 56,
    textAlign: 'center',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 28,
  },
  badgeName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  badgeDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    flex: 1,
  },
  badgeFooter: {
    alignItems: 'center',
  },
  rarityBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 10,
  },
  rarityText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  unlockedDate: {
    fontSize: 12,
    color: 'rgba(242, 245, 247, 0.7)',
    fontStyle: 'italic',
  },
});

export default BadgesModal;
