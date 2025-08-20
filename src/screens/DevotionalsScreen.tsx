import React, { useRef } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil } from 'lucide-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  NativeModules,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useDevotionalOperations } from '../services/hooks/useDevotionalDataSimplified';
import { usePlaybooksData } from '../services/hooks/usePlaybookData';
import { useAuth } from '../context/IndustryStandardAuthContext';

import { Devotional } from '../interfaces/devotional';
import { format } from 'date-fns';
import { Swipeable, RectButton } from 'react-native-gesture-handler';

import { extractCleanTitle } from '../utils/titleUtils';
import { Colors, Fonts } from '../theme';
import 'react-native-gesture-handler';

type DevotionalsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Devotionals'>;

const DevotionalsScreen = () => {
  const navigation = useNavigation<DevotionalsScreenNavigationProp>();
  const { user } = useAuth();
  const userId = user?.id;
  const insets = useSafeAreaInsets();
  const {
    devotionals,
    deleteDevotional,
    fetchPlaybookById,
    isLoading,
  } = useDevotionalOperations(userId || '');

  // Fetch user's playbooks to suggest creating devotionals
  const { data: playbooks = [], isLoading: isLoadingPlaybooks } = usePlaybooksData(userId || '');

  // Subtle haptic feedback, gated by user preference
  const triggerLightHaptic = () => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) return;
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) return;
      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      }
    } catch {}
  };

  const handleDevotionalPress = (devotional: Devotional) => {
    // Log title extraction for debugging
    createTitleExtractionMemory(devotional);
    triggerLightHaptic();
    navigation.navigate('DevotionalDetail', { devotionalId: devotional.id });
  };

  const handlePlaybookPress = async (playbookId: string) => {
    try {
      triggerLightHaptic();
      const playbookData = await fetchPlaybookById(playbookId);
      if (playbookData) {
        navigation.navigate('PlaybookDetail', { playbook: playbookData });
      }
    } catch (error) {
      console.error('Error fetching playbook:', error);
    }
  };

  const handleDeleteDevotional = async (devotionalId: string) => {
    try {
      await deleteDevotional(devotionalId);
    } catch (error) {
      console.error('Error deleting devotional:', error);
    }
  };

  // Use any type for rowRefs to avoid TypeScript errors with Swipeable
  const rowRefs = useRef<{ [key: string]: any }>({});

  const renderRightActions = (devotionalId: string) => {
    return (
      <RectButton
        style={styles.deleteButton}
        onPress={() => handleDeleteDevotional(devotionalId)}
      >
        <Ionicons name="trash-outline" size={24} color="white" />
      </RectButton>
    );
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'EEEE, MMM d, yyyy').toUpperCase();
  };

  const renderDevotionalItem = ({ item }: { item: Devotional }) => {
    // Calculate progress percentage (0-100)
    const completedDays = item.days?.filter(day => day.completed).length || 0;
    const progress = (completedDays / item.totalDays) * 100;
    // Find the first incomplete day or use the last day if all are complete
    // currentDayIndex was previously calculated but not used
    const isComplete = progress >= 100;
    const formattedDate = formatDate(item.createdAt);

    // Log the entire item for debugging
    console.log('Devotional item:', JSON.stringify(item, null, 2));

    // Format category - handle different possible formats
    const formatCategory = (category: string) => {
      // If it's already a valid category, return it as is
      const validCategories = ['Prayer', 'Growth', 'Healing', 'Wisdom', 'Relationships', 'Purpose', 'Career', 'Finances', 'Mental Health', 'Parenting', 'Health'];
      if (validCategories.includes(category)) {
        return category;
      }
      // Try to extract category from string like "CATEGORY: Relationships"
      const match = category.match(/^(?:category|categories)?[\s:]*([^\s:]+)/i);
      const extracted = match ? match[1] : category;
      // Capitalize first letter
      return extracted.charAt(0).toUpperCase() + extracted.slice(1).toLowerCase();
    };

    // Format category but don't store it since it's not used
    formatCategory(item.category);

    // Use the utility function to extract a clean title
    const cleanTitle = extractCleanTitle(item.title, 'Devotional');

    return (
      <View style={styles.swipeableContainer}>
        <Swipeable
          ref={(ref) => {
            if (ref) {rowRefs.current[item.id] = ref;}
          }}
          renderRightActions={() => renderRightActions(item.id)}
          rightThreshold={40}
          friction={2}
          overshootRight={false}
          containerStyle={styles.swipeableInner}
        >
          <TouchableOpacity
            style={styles.devotionalCard}
            onPress={() => handleDevotionalPress(item)}
            activeOpacity={1}
          >
            <View style={styles.cardContent}>
              {/* Date */}
              <Text style={styles.date}>{formattedDate}</Text>

              {/* Series Title or Devotional Title */}
              <Text style={styles.devotionalTitle} numberOfLines={1}>{cleanTitle}</Text>

              {/* Description */}
              {item.description && (
                <Text style={styles.description} numberOfLines={2}>
                  {item.description.replace(/^CATEGORY:[^\n]*\n?/i, '')}
                </Text>
              )}

              {/* Categories + From Playbook Buttons */}
              <View style={styles.tagRow}>
                <View style={styles.tagList}>
                  {item.category && (
                    <View style={item.playbookId ? styles.categoryBadgeWithPlaybook : styles.categoryBadge}>
                      <Ionicons name="pricetag-outline" size={10} color={Colors.hopeWhite} style={styles.tagIcon} />
                      <Text style={styles.categoryText}>{item.category}</Text>
                    </View>
                  )}
                  {item.playbookId && (
                    <TouchableOpacity
                      style={styles.playbookBadge}
                      onPress={() => handlePlaybookPress(item.playbookId!)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="book-outline" size={12} color={Colors.hopeWhite} style={styles.playbookIcon} />
                      <Text style={styles.playbookText}>From Playbook</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={styles.progressHeader}>
                  <View style={styles.progressLabel}>
                    <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={16} color="rgba(255, 255, 255, 0.8)" style={styles.progressIcon} />
                    <Text style={styles.progressLabelText}>Progress</Text>
                  </View>
                  <Text style={styles.dayCounter}>
                    {completedDays}/{item.totalDays} {item.totalDays === 1 ? 'Day' : 'Days'} Completed
                  </Text>
                </View>
                <View style={styles.progressBarRow}>
                  <View style={styles.progressWrapper}>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${progress}%` }]} />
                    </View>
                  </View>
                </View>
                <View style={styles.nextDayContainer}>
                  {/* Show NEXT: Day X only if not complete, and there is an incomplete day */}
                  {!isComplete && item.days && item.days.some(day => !day.completed) && (() => {
                    const nextIdx = item.days.findIndex(day => !day.completed);
                    if (nextIdx !== -1) {
                      return (
                        <Text style={styles.nextDayText}>
                          NEXT: Day {nextIdx + 1}
                        </Text>
                      );
                    }
                    return null;
                  })()}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </Swipeable>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color={Colors.anchorBlue} />
          <Text style={styles.emptyStateText}>Loading devotionals...</Text>
        </View>
      );
    }

    const hasPlaybooks = !isLoadingPlaybooks && (playbooks?.length ?? 0) > 0;

    return (
      <View style={styles.emptyStateContainer}>
        {/* Hero (centered card) */}
        <View style={styles.emptyHeroContainer}>
          <View style={styles.heroCard}>
            <MaterialCommunityIcons
              name="book"
              size={32}
              color="rgba(255,255,255,0.8)"
              style={styles.heroIcon}
            />
            <Text style={styles.heroOverline}>No Devotionals</Text>
            <Text style={styles.heroTitle}>Start with Scripture</Text>
            <Text style={styles.heroSubtitle}>
              {(() => {
                const count = !isLoadingPlaybooks && Array.isArray(playbooks) ? playbooks.length : 0;
                if (count > 0) {
                  return count === 1
                    ? 'You already have a playbook—turn it into a daily devotional.'
                    : 'You already have playbooks—turn one into a daily devotional.';
                }
                return "Create a playbook for what you're facing, then build a daily devotional from it.";
              })()}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (!hasPlaybooks) {
                  navigation.navigate('UserInput' as never);
                } else {
                  navigation.navigate('Playbooks' as never);
                }
              }}
              activeOpacity={0.85}
              style={styles.heroOutlineButton}
            >
              <Pencil size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
              <Text style={styles.heroOutlineButtonText}>{hasPlaybooks ? 'Create a Devotional' : 'Create a Playbook'}</Text>
            </TouchableOpacity>

            {/* Guided steps */}
            <View style={styles.stepsContainer}>
              {hasPlaybooks ? (
                <>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
                    <Text style={styles.stepText}>Pick a Playbook</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
                    <Text style={styles.stepText}>Create Your Devotional</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
                    <Text style={styles.stepText}>Return each day—read, reflect, pray</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
                    <Text style={styles.stepText}>Create a Playbook</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
                    <Text style={styles.stepText}>Add Scriptures and prompts</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
                    <Text style={styles.stepText}>Start your Daily Devotional</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Suggestions carousel from Playbooks (without devotionals) */}
        {!isLoadingPlaybooks && playbooks.length > 0 && (
          (() => {
            const existingDevotionalPBIds = new Set((devotionals || []).filter(d => d.playbookId).map(d => d.playbookId));
            const suggested = playbooks.filter(pb => !existingDevotionalPBIds.has(pb.id)).slice(0, 10);
            if (suggested.length === 0) { return null; }

            return (
              <View style={styles.carouselSection}>
                <Text style={styles.carouselTitle}>
                  {suggested.length === 1
                    ? 'Start a devotional from this playbook'
                    : 'Start a devotional from these playbooks'}
                </Text>
                <FlatList
                  data={suggested}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.carouselList}
                  contentContainerStyle={styles.carouselContent}
                  snapToInterval={272}
                  decelerationRate="fast"
                  snapToAlignment="start"
                  renderItem={({ item }) => (
                    <View style={styles.card}>
                      <View style={styles.cardIconCircle}>
                        <MaterialCommunityIcons name="clipboard-text-play" size={28} color={Colors.hopeWhite} />
                      </View>
                      <Text style={styles.cardTitle} numberOfLines={2}>{extractCleanTitle(item.title, 'Playbook')}</Text>
                      {item.truthInLove?.summary ? (
                        <Text style={styles.cardSubtitle} numberOfLines={3}>{item.truthInLove.summary}</Text>
                      ) : null}
                      <TouchableOpacity
                        style={styles.cardCTA}
                        activeOpacity={0.9}
                        onPress={() => handlePlaybookPress(item.id)}
                      >
                        <Text style={styles.cardCTAText}>Create a Devotional</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              </View>
            );
          })()
        )}

        {/* Secondary link removed per request */}
      </View>
    );
  };

  const isEmpty = !isLoading && (devotionals?.length ?? 0) === 0;

  return (
    <SafeAreaView style={styles.container} edges={['left','right','bottom']}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.pageInner}>
          {isEmpty ? (
            <View style={styles.headerSpacer} />
          ) : (
            <Text style={styles.headerTitle}>Devotionals</Text>
          )}
        </View>
      </View>

      <FlatList
        data={devotionals.sort((a: Devotional, b: Devotional) => {
          // Sort by updatedAt in descending order (newest first)
          // Fall back to createdAt if updatedAt is not available
          const dateA = new Date(a.updatedAt || a.createdAt).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt).getTime();
          return dateB - dateA;
        })}
        renderItem={renderDevotionalItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={isEmpty ? styles.emptyListContent : [styles.listContent, styles.pageInner]}
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
};

// Create a memory of the title extraction logic for debugging purposes
const createTitleExtractionMemory = (devotional: Devotional) => {
  if (!devotional) {return;}

  console.log('Title extraction debug:', {
    originalTitle: devotional.title,
    extractedTitle: extractCleanTitle(devotional.title),
    devotionalId: devotional.id,
  });
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  swipeableContainer: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 200, // Minimum height
    backgroundColor: Colors.alertCoral, // Match delete button color
  },
  swipeableInner: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.anchorBlue,
    marginBottom: 10,
    marginTop: 10,
    letterSpacing: 0.5,
    fontWeight: '800',
  },
  headerSpacer: {
    // keeps content pushed down similarly to when headerTitle is visible
    height: 44,
    marginTop: 10,
    marginBottom: 10,
  },
  pageInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  emptyListContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 2,
  },
  devotionalCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 16,
    padding: 16,
    position: 'relative',
  },
  cardContent: {
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  categoryBadgeWithPlaybook: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  categoryText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '500',
  },
  playbookBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  playbookIcon: {
    marginRight: 4,
  },
  tagIcon: {
    marginRight: 4,
  },
  playbookText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginLeft: 8,
    height: '100%',
  },
  date: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.8,
    lineHeight: 14,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  devotionalTitle: {
    fontSize: 22, // Larger font size for consistency
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    lineHeight: 28, // Increased line height
    paddingVertical: 2,
    fontWeight: '700',
    marginBottom: 8, // Increased margin
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    lineHeight: 20,
  },
  progressBarContainer: {
    width: '100%',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressLabelText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 4,
    fontFamily: Fonts.medium,
  },
  progressIcon: {
    marginRight: 4,
  },
  dayCounter: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: Fonts.medium,
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  nextDayContainer: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  nextDayText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.95)',
    fontFamily: Fonts.medium,
  },
  progressWrapper: {
    flex: 1,
  },
  barBg: {
    width: '100%',
    height: 12, // Thicker bar for better visibility
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,
  },
  progressTextContainer: {
    width: 50,
    alignItems: 'flex-end',
    marginLeft: 0,
  },
  progressText: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.hopeWhite,
    marginRight: 4,
    textAlign: 'right',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 0,
    minHeight: 300,
  },
  emptyHeroContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyHero: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  heroCard: {
    width: '90%',
    maxWidth: 720,
    backgroundColor: Colors.anchorBlue,
    borderRadius: 34,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroIcon: {
    marginBottom: 12,
    opacity: 0.8,
  },
  heroOverline: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 18,
    textAlign: 'center',
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  heroOutlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    minWidth: 120,
    marginBottom: 12,
  },
  heroButtonIcon: {
    marginRight: 8,
  },
  heroOutlineButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  heroBenefitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  heroBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  heroBenefitText: {
    marginLeft: 6,
    color: Colors.hopeWhite,
    fontSize: 12,
    fontFamily: Fonts.medium,
    opacity: 0.95,
  },
  stepsContainer: {
    width: '100%',
    marginTop: 16,
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 2,
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stepBadgeText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontFamily: Fonts.bold,
  },
  stepText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.medium,
  },
  emptyAura: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(20, 52, 96, 0.08)',
    top: 80,
  },
  emptyIconContainer: {
    position: 'relative',
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.faithGold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.hopeWhite,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  emptyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginHorizontal: 4,
  },
  emptyBadgeText: {
    marginLeft: 6,
    fontSize: 12,
    color: Colors.textDark,
    fontWeight: '600',
  },
  emptyCTAButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 8,
  },
  emptyCTAButtonText: {
    color: Colors.hopeWhite,
    fontWeight: '700',
    fontSize: 16,
  },
  emptySecondaryLink: {
    color: Colors.anchorBlue,
    fontWeight: '600',
    fontSize: 14,
  },
  linkContainer: {
    width: '100%',
    paddingHorizontal: 16, // match gutters
  },
  carouselSection: {
    width: '100%',
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 16, // gutters for section title and spacing
  },
  carouselTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.anchorBlue,
    marginBottom: 8,
    paddingLeft: 0,
  },
  // FlatList should scroll edge-to-edge while cards have gutters
  carouselList: {
    marginHorizontal: -16, // bleed the scrolling area to screen edges
  },
  carouselContent: {
    paddingHorizontal: 16, // gutters for first/last cards
  },
  card: {
    width: 256,
    marginRight: 16,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  cardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.anchorBlue,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardCTA: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.alertCoral,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  cardCTAText: {
    color: Colors.hopeWhite,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default DevotionalsScreen;
