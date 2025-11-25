import React, { useState, useEffect, useMemo } from 'react';
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
import { useTheme } from '../theme/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BadgesModalProps {
  visible: boolean;
  onClose: () => void;
}

const BadgesModal: React.FC<BadgesModalProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const theme = useTheme();
  const font = useMemo(() => ({ fontFamily: theme.fontFamily }), [theme.fontFamily]);
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
      {/* Icon Section */}
      <View style={styles.iconSection}>
        <View style={styles.badgeIconContainer}>
          <Text style={styles.badgeIcon}>
            {item.unlocked ? item.icon : '🔐'}
          </Text>
          {!item.unlocked && <View style={styles.lockOverlay} />}
        </View>
        
        {/* Rarity Badge */}
        <View style={[
          styles.rarityBadge,
          { backgroundColor: getRarityColor(item.rarity) }
        ]}>
          <ThemedText style={styles.rarityText}>
            {item.rarity.toUpperCase()}
          </ThemedText>
        </View>
      </View>
      
      {/* Content Section */}
      <View style={styles.contentSection}>
        <ThemedText 
          weight="bold" 
          style={[
            styles.badgeName,
            { color: item.unlocked ? Colors.hopeWhite : 'rgba(242, 245, 247, 0.6)' }
          ]}
        >
          {item.name}
        </ThemedText>
        
        <ThemedText 
          style={[
            styles.badgeDescription,
            { color: item.unlocked ? 'rgba(242, 245, 247, 0.8)' : 'rgba(242, 245, 247, 0.5)' }
          ]}
        >
          {item.description}
        </ThemedText>
        
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
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.fullScreenContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <ThemedText weight="bold" style={styles.modalTitle}>
            My Badges
          </ThemedText>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, font]}>{userBadges.length}</Text>
            <ThemedText style={styles.statLabel}>Unlocked</ThemedText>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, font]}>{availableBadges.length}</Text>
            <ThemedText style={styles.statLabel}>Total</ThemedText>
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
    textAlign: 'center',
    flex: 1,
    color: Colors.hopeWhite,
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
  flatListStyle: {
    flex: 1,
    paddingHorizontal: 16,
  },
  badgesList: {
    paddingBottom: 40,
  },
  badgeItem: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    margin: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flex: 1,
    minHeight: 160,
    overflow: 'hidden',
  },
  unlockedBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  lockedBadge: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  iconSection: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  badgeIconContainer: {
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  badgeIcon: {
    fontSize: 40,
    textAlign: 'center',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  rarityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  rarityText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  contentSection: {
    padding: 16,
    flex: 1,
  },
  badgeName: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    color: Colors.hopeWhite,
  },
  badgeDescription: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
    color: 'rgba(242, 245, 247, 0.8)',
  },
  unlockedDate: {
    fontSize: 10,
    color: 'rgba(242, 245, 247, 0.6)',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 'auto',
  },
});

export default BadgesModal;
