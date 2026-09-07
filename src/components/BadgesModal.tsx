import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme';
import ThemedText from './common/ThemedText';
import { faithPointsService, Badge } from '../services/faithPointsService';
import BadgeSkeletonLoader from './ui/BadgeSkeletonLoader';

// Extended type for badge with unlock status
interface BadgeWithStatus extends Badge {
  unlocked?: boolean;
}
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useTheme } from '../theme/ThemeContext';
import { triggerLightHaptic } from '../utils/haptics';
import PlatformPageSheetModal from './common/PlatformPageSheetModal';


interface BadgesModalProps {
  visible: boolean;
  onClose: () => void;
}

const BadgesModal: React.FC<BadgesModalProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const font = useMemo(() => ({ fontFamily: theme.fontFamily }), [theme.fontFamily]);
  const [_userBadges, setUserBadges] = useState<Badge[]>([]);
  const [availableBadges, setAvailableBadges] = useState<BadgeWithStatus[]>([]);
  const [badgeCount, setBadgeCount] = useState(0); // Store consistent count
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadBadges = useCallback(async () => {
    if (!user) {
            return;
    }

        setLoading(true);
    try {
      // Retroactively award level badges for existing users
      await faithPointsService.retroactivelyAwardLevelBadges(user.id);

      // Get user's unlocked badges from database
      const { data: badgeRows, error: badgeError } = await supabase
        .from('user_badges')
        .select('*')  // Get all columns to see what's available
        .eq('user_id', user.id);

      if (badgeError) {
                return;
      }


      // Parse user badges from database
      let unlockedBadges: (Badge & { unlockedAt?: string })[] = [];

      if (badgeRows && badgeRows.length > 0) {

        // First, get all available badges once if we need them
        let dbAllBadges: Badge[] = [];
        const needsServiceLookup = badgeRows.some(row => row.badge_id && !row.badge_data);
        if (needsServiceLookup) {
          dbAllBadges = await faithPointsService.getAvailableBadges();
        }

        unlockedBadges = badgeRows.map(row => {
          try {
            // Try different possible column names
            let badgeData = null;
            let unlockedAt = null;

            if (row.badge_data) {
              badgeData = typeof row.badge_data === 'string' ? JSON.parse(row.badge_data) : row.badge_data;
            } else if (row.badge_id) {
              // If only badge_id exists, get the full badge data from the service
              const fullBadge = dbAllBadges.find(b => b.id === row.badge_id);
              if (fullBadge) {
                badgeData = fullBadge;
              } else {
                badgeData = { id: row.badge_id };
              }
            }

            if (row.unlocked_at) {
              unlockedAt = row.unlocked_at;
            } else if (row.created_at) {
              unlockedAt = row.created_at;
            }

            if (!badgeData) {
                            return null;
            }

            return {
              ...badgeData,
              unlockedAt: unlockedAt || undefined,
            };
          } catch (parseError) {
                        return null;
          }
        }).filter(Boolean);
      }

      // Match userApi fallback: if no user_badges, try legacy user_profiles.badges
      if (unlockedBadges.length === 0) {
        try {
          const { data: profileRow, error: profileError } = await supabase
            .from('user_profiles')
            .select('badges')
            .eq('id', user.id)
            .single();

          if (!profileError && profileRow && Array.isArray(profileRow.badges) && profileRow.badges.length > 0) {
            unlockedBadges = profileRow.badges.map((b: any) => ({
              id: b.id || `legacy_${Math.random().toString(36).slice(2)}`,
              name: b.name || 'Badge',
              description: b.description || '',
              icon: b.icon || '⭐',
              rarity: b.rarity || 'common',
              pointsRequired: b.pointsRequired || 0,
              unlockedAt: b.unlockedAt || b.earned_at || undefined,
            }));
          } else {
            // Final fallback: every user has the Beginning badge
            unlockedBadges = [{
              id: 'beginning',
              name: 'Beginning',
              description: 'Beginning your faith journey',
              icon: '🌱',
              rarity: 'common' as const,
              pointsRequired: 0,
              unlockedAt: undefined,
            }];
          }
        } catch {
          // Defensive: ensure at least the Beginning badge is unlocked
          unlockedBadges = [{
            id: 'beginning',
            name: 'Beginning',
            description: 'Beginning your faith journey',
            icon: '🌱',
            rarity: 'common' as const,
            pointsRequired: 0,
            unlockedAt: undefined,
          }];
        }
      }

      // Get all available badges
      const allBadges = await faithPointsService.getAvailableBadges();

      // Build a full list that includes any unlocked badges missing from the service list,
      // matching by id, name, or description to avoid duplicates (e.g., two "Beginning" badges).
      const normalize = (str?: string) => (str || '').trim().toLowerCase();
      const badgeMatches = (a: Badge, b: Badge) => {
        if (a.id && a.id === b.id) {return true;}
        const aName = normalize(a.name);
        const bName = normalize(b.name);
        const aDesc = normalize(a.description);
        const bDesc = normalize(b.description);
        if (aName && bName && aName === bName) {return true;}
        if (aName && bDesc && aName === bDesc) {return true;}
        if (bName && aDesc && bName === aDesc) {return true;}
        if (aDesc && bDesc && aDesc === bDesc) {return true;}
        return false;
      };

      const mergedAllBadges: Badge[] = allBadges && allBadges.length > 0 ? [...allBadges] : [];
      for (const ub of unlockedBadges) {
        const existing = mergedAllBadges.find(b => badgeMatches(ub, b));
        if (!existing) {
          mergedAllBadges.push(ub);
        }
      }

      // If no badges are available at all, use the unlocked badges as the fallback list
      const finalAllBadges = mergedAllBadges.length > 0 ? mergedAllBadges : unlockedBadges;

      const isUnlocked = (badge: Badge) => unlockedBadges.some(ub => badgeMatches(ub, badge));
      const getUnlockedAt = (badge: Badge) => unlockedBadges.find(ub => badgeMatches(ub, badge))?.unlockedAt;

      // Mark which badges are unlocked
      const availableWithStatus = finalAllBadges.map(badge => ({
        ...badge,
        unlocked: isUnlocked(badge),
        unlockedAt: getUnlockedAt(badge),
      }));

      const count = availableWithStatus.filter(b => b.unlocked).length;
      setBadgeCount(count); // Store in state for display

      setAvailableBadges(availableWithStatus);
      setUserBadges(unlockedBadges);
    } catch (error) {
      Logger.error('Error loading badges:', error as Error, {
        component: 'BadgesModal',
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (visible && user) {
      loadBadges();
    }
  }, [visible, user, loadBadges]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return Colors.growthGreen;
      case 'rare': return Colors.playbookBlue;
      case 'epic': return '#9B59B6';
      case 'legendary': return '#FF6B6B';
      default: return Colors.growthGreen;
    }
  };

  const handleClose = () => {
    triggerLightHaptic();
    onClose();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBadges();
    setRefreshing(false);
  };


  return (
    <PlatformPageSheetModal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => handleClose()}
    >
      <SafeAreaView
        edges={['top']}
        style={[
          styles.container,
          { backgroundColor: Colors.anchorBlue },
        ]}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => { triggerLightHaptic(); handleClose(); }} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
          <ThemedText weight="bold" style={styles.title}>
            My Badges
          </ThemedText>
          <View style={styles.placeholder} />
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, font]}>{badgeCount}</Text>
            <ThemedText style={styles.statLabel}>Unlocked</ThemedText>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, font]}>{availableBadges.length}</Text>
            <ThemedText style={styles.statLabel}>Total</ThemedText>
          </View>
        </View>

        {/* Badges List */}
        {loading ? (
            <BadgeSkeletonLoader count={8} />
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: (insets?.bottom || 0) + 20 }]}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              showsVerticalScrollIndicator={false}
            >
              {availableBadges.length === 0 ? (
                <BadgeSkeletonLoader count={8} />
              ) : (
              availableBadges.map((item: BadgeWithStatus) => (
                    <View key={item.id} style={[
                      styles.badgeItem,
                      item.unlocked ? styles.unlockedBadge : styles.lockedBadge,
                    ]}>
                      {/* Left side - Icon */}
                      <View style={styles.iconContainer}>
                        <View style={styles.badgeIconContainer}>
                          {item.unlocked ? (
                            <Text style={styles.badgeIcon}>{item.icon || '⭐'}</Text>
                          ) : (
                            <Image
                              source={require('../../assets/icons/padlock-3.png')}
                              style={styles.lockIcon}
                              resizeMode="contain"
                            />
                          )}
                        </View>

                        {/* Rarity Badge */}
                        <View style={[
                          styles.rarityBadge,
                          { backgroundColor: getRarityColor(item.rarity) },
                        ]}>
                          <ThemedText style={styles.rarityText}>
                            {item.rarity.toUpperCase()}
                          </ThemedText>
                        </View>
                      </View>

                      {/* Right side - Content */}
                      <View style={styles.contentContainer}>
                        <ThemedText
                          weight="bold"
                          style={[
                            styles.badgeName,
                            !item.unlocked && styles.badgeNameLocked,
                          ]}
                        >
                          {item.name}
                        </ThemedText>

                        <ThemedText
                          style={[
                            styles.badgeDescription,
                            !item.unlocked && styles.badgeDescriptionLocked,
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
                  ))
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </PlatformPageSheetModal>
    );
  };

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    color: Colors.hopeWhite,
    flex: 1,
    textAlign: 'center',
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
    color: '#FF6B6B',
  },
  statLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginTop: 4,
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    opacity: 0.6,
  },
  badgeItem: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 80,
  },
  unlockedBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  lockedBadge: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  iconContainer: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  badgeIconContainer: {
    alignItems: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  badgeIcon: {
    fontSize: 32,
    textAlign: 'center',
  },
  lockIcon: {
    width: 32,
    height: 32,
    tintColor: 'rgba(242, 245, 247, 0.4)',
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'center',
  },
  rarityText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textAlign: 'center',
    flexWrap: 'nowrap',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  badgeName: {
    fontSize: 16,
    marginBottom: 4,
    color: Colors.hopeWhite,
  },
  badgeNameLocked: {
    color: 'rgba(242, 245, 247, 0.6)',
  },
  badgeDescription: {
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
    color: 'rgba(242, 245, 247, 0.8)',
  },
  badgeDescriptionLocked: {
    color: 'rgba(242, 245, 247, 0.5)',
  },
  unlockedDate: {
    fontSize: 11,
    color: 'rgba(242, 245, 247, 0.6)',
    fontStyle: 'italic',
  },
});

export default BadgesModal;
