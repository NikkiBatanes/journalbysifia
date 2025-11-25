import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme';
import ThemedText from './common/ThemedText';
import { faithPointsService, Badge } from '../services/faithPointsService';

// Extended type for badge with unlock status
interface BadgeWithStatus extends Badge {
  unlocked?: boolean;
}
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useTheme } from '../theme/ThemeContext';
import { triggerLightHaptic } from '../utils/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BadgesModalProps {
  visible: boolean;
  onClose: () => void;
}

const BadgesModal: React.FC<BadgesModalProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const font = useMemo(() => ({ fontFamily: theme.fontFamily }), [theme.fontFamily]);
  const [userBadges, setUserBadges] = useState<Badge[]>([]);
  const [availableBadges, setAvailableBadges] = useState<BadgeWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (visible && user) {
      loadBadges();
    }
  }, [visible, user]);

  // Debug: Log when badges change
  useEffect(() => {
    console.log('Rendering badges, availableBadges:', availableBadges);
  }, [availableBadges]);

  const loadBadges = async () => {
    if (!user) {
      console.log('No user found, skipping badge loading');
      return;
    }
    
    console.log('Starting badge loading for user:', user.id);
    setLoading(true);
    try {
      // Get user's unlocked badges from database
      const { data: badgeRows, error: badgeError } = await supabase
        .from('user_badges')
        .select('*')  // Get all columns to see what's available
        .eq('user_id', user.id);

      if (badgeError) {
        console.error('Error fetching user badges:', badgeError);
        return;
      }

      console.log('User badge rows from database:', badgeRows);

      // Parse user badges from database
      let unlockedBadges: (Badge & { unlockedAt: string })[] = [];
      
      if (badgeRows && badgeRows.length > 0) {
        console.log('Database columns found:', Object.keys(badgeRows[0] || {}));
        
        // First, get all available badges once if we need them
        let allBadges: Badge[] = [];
        const needsServiceLookup = badgeRows.some(row => row.badge_id && !row.badge_data);
        if (needsServiceLookup) {
          allBadges = await faithPointsService.getAvailableBadges();
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
              const fullBadge = allBadges.find(b => b.id === row.badge_id);
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
              console.warn('No badge data found in row:', row);
              return null;
            }
            
            return {
              ...badgeData,
              unlockedAt: unlockedAt,
            };
          } catch (parseError) {
            console.error('Error parsing badge data:', parseError);
            return null;
          }
        }).filter(Boolean);
      } else {
        console.log('No unlocked badges found in database for user');
      }

      console.log('Parsed unlocked badges:', unlockedBadges);
      console.log('Badge icons in unlocked badges:', unlockedBadges.map(b => ({ id: b.id, icon: b.icon })));

      // Get all available badges
      console.log('Calling faithPointsService.getAvailableBadges()');
      const allBadges = await faithPointsService.getAvailableBadges();
      console.log('All available badges:', allBadges);
      
      if (!allBadges || allBadges.length === 0) {
        console.error('No badges returned from getAvailableBadges(), using fallback badges');
        // Use fallback badges for testing
        const fallbackBadges = [
          {
            id: 'test_badge_1',
            name: 'Test Badge 1',
            description: 'This is a test badge',
            icon: '⭐',
            rarity: 'common' as const,
            pointsRequired: 10,
            unlocked: false,
          },
          {
            id: 'test_badge_2',
            name: 'Test Badge 2',
            description: 'Another test badge',
            icon: '🎯',
            rarity: 'rare' as const,
            pointsRequired: 25,
            unlocked: false,
          },
        ];
        setAvailableBadges(fallbackBadges);
        setUserBadges([]);
        return;
      }
      
      // Mark which badges are unlocked
      const availableWithStatus = allBadges.map(badge => ({
        ...badge,
        unlocked: unlockedBadges.some(ub => ub.id === badge.id),
        unlockedAt: unlockedBadges.find(ub => ub.id === badge.id)?.unlockedAt,
      }));

      console.log('Available badges with status:', availableWithStatus);
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

  const renderBadge = ({ item }: { item: BadgeWithStatus }) => (
    <View style={[
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
          { backgroundColor: getRarityColor(item.rarity) }
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
          <TouchableOpacity onPress={() => handleClose()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <ThemedText weight="bold" style={styles.title}>
            My Badges
          </ThemedText>
          <View style={styles.placeholder} />
        </View>

        {/* Stats Row */}
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

        {/* Badges List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: (insets?.bottom || 0) + 20 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {availableBadges.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No badges available</Text>
            </View>
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
                  { backgroundColor: getRarityColor(item.rarity) }
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
          ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    paddingTop: 20,
    paddingBottom: 16,
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
  title: {
    fontSize: 24,
    color: Colors.hopeWhite,
    textAlign: 'center',
    flex: 1,
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
    width: 75,
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
  badgeDescription: {
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
    color: 'rgba(242, 245, 247, 0.8)',
  },
  unlockedDate: {
    fontSize: 11,
    color: 'rgba(242, 245, 247, 0.6)',
    fontStyle: 'italic',
  },
});

export default BadgesModal;
