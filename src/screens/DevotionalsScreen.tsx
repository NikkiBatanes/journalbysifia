import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil } from 'lucide-react-native';
import {
  View,
  StyleSheet,
  SectionList,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  NativeModules,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useDevotionalOperations } from '../services/hooks/useDevotionalDataSimplified';
import { usePlaybooksData } from '../services/hooks/usePlaybookData';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import DevotionalModal from '../components/DevotionalModal';
import { useQueryClient } from '@tanstack/react-query';

import { Devotional } from '../interfaces/devotional';
import { format } from 'date-fns';
import { Swipeable, RectButton } from 'react-native-gesture-handler';

import { extractCleanTitle } from '../utils/titleUtils';
import { Colors, Fonts } from '../theme';
import 'react-native-gesture-handler';
import DevotionalSkeleton from '../components/SkeletonLoader/DevotionalSkeleton';
import BlueSheet from '../components/layout/BlueSheet';
import ThemedText from '../components/common/ThemedText';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';

type DevotionalsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Devotionals'>;

type FilterType = 'all' | 'ongoing' | 'completed';

const DevotionalsScreen = () => {
  const navigation = useNavigation<DevotionalsScreenNavigationProp>();
  const { user } = useAuth();
  const userId = user?.id;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>('ongoing');
  const [showDevotionalModal, setShowDevotionalModal] = useState(false);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);
  const [selectedPlaybookInfo, setSelectedPlaybookInfo] = useState<string | null>(null);
  const {
    devotionals,
    deleteDevotional,
    fetchPlaybookById,
    isLoading,
  } = useDevotionalOperations(userId || '');

  // Fetch user's playbooks to suggest creating devotionals
  const { data: playbooks = [], isLoading: isLoadingPlaybooks, refetch: refetchPlaybooks } = usePlaybooksData(userId || '');

  // Ensure latest playbooks are shown when returning to this screen
  useFocusEffect(
    useCallback(() => {
      // Force a refetch regardless of staleTime, so newly created playbooks are visible
      refetchPlaybooks();
    }, [refetchPlaybooks])
  );

  // Subtle haptic feedback, gated by user preference
  const triggerLightHaptic = useCallback(() => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) { return; }
      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      }
    } catch {}
  }, []);

  // Trigger a gentle haptic when the Devotional creation modal opens
  useEffect(() => {
    if (showDevotionalModal) {
      try { triggerLightHaptic(); } catch {}
    }
  }, [showDevotionalModal, triggerLightHaptic]);

  const handleDevotionalPress = (devotional: Devotional) => {
    // Log title extraction
    createTitleExtractionMemory(devotional);

    // Logging for user state issue

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
      Logger.error('Error fetching playbook', error as Error, { component: 'DevotionalsScreen' });
    }
  };

  const handleDeleteDevotional = async (devotionalId: string) => {
    try {
      await deleteDevotional(devotionalId);
    } catch (error) {
      Logger.error('Error deleting devotional', error as Error, { component: 'DevotionalsScreen' });
    }
  };

  // Use any type for rowRefs to avoid TypeScript errors with Swipeable
  const rowRefs = useRef<{ [key: string]: any }>({});
  // Ref for SectionList to allow programmatic scrolling to top
  const sectionListRef = useRef<SectionList<any>>(null);

  // Reset logic moved below after 'sections' is declared

  const renderRightActions = (devotionalId: string) => {
    return (
      <RectButton
        style={styles.deleteButton}
        onPress={() => {
          try { triggerLightHaptic(); } catch {}
          Alert.alert(
            'Delete Devotional',
            'Are you sure you want to delete this devotional?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  try { triggerLightHaptic(); } catch {}
                  await handleDeleteDevotional(devotionalId);
                },
              },
            ]
          );
        }}
      >
        <Ionicons name="trash-outline" size={24} color="white" />
      </RectButton>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const currentYear = new Date().getFullYear();
    const year = date.getFullYear();
    const formatString = year === currentYear ? 'EEEE, MMMM d' : 'EEEE, MMMM d, yyyy';
    return format(date, formatString).toUpperCase();
  };

  // Animation values map (declared early so render function can use it)
  const animatedValues = useRef<Record<string, Animated.Value>>({});

  // (animation setup moved below sortedDevotionals)

  const renderDevotionalItem = ({ item }: { item: Devotional }) => {
    // Calculate progress percentage (0-100)
    const completedDays = item.days?.filter(day => day.completed).length || 0;
    const progress = (completedDays / item.totalDays) * 100;
    // Find the first incomplete day or use the last day if all are complete
    // currentDayIndex was previously calculated but not used
    const isComplete = progress >= 100;
    const formattedDate = formatDate(item.createdAt);

    // Log the entire item for debugging

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

    // Per-item animation values with safe fallbacks
    const anim = animatedValues.current[item.id] || new Animated.Value(1);
    const translateY = anim.interpolate?.({ inputRange: [0, 1], outputRange: [50, 0] }) || new Animated.Value(0);

    return (
      <Animated.View
        style={[
          styles.swipeableContainer,
          {
            opacity: anim,
            transform: [{ translateY }],
          },
        ]}
      >
        <Swipeable
          ref={(ref) => {
            if (ref) {rowRefs.current[item.id] = ref;}
          }}
          onSwipeableWillOpen={() => { try { triggerLightHaptic(); } catch {} }}
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
              <ThemedText weight="medium" style={styles.date}>{formattedDate}</ThemedText>

              {/* Series Title or Devotional Title */}
              <ThemedText weight="semiBold" style={styles.devotionalTitle} numberOfLines={1}>{cleanTitle}</ThemedText>

              {/* Description */}
              {item.description && (
                <ThemedText style={styles.description} numberOfLines={2}>
                  {item.description.replace(/^CATEGORY:[^\n]*\n?/i, '')}
                </ThemedText>
              )}

              {/* Categories + From Playbook Buttons */}
              <View style={styles.tagRow}>
                <View style={styles.tagList}>
                  {item.category && (
                    <View style={item.playbookId ? styles.categoryBadgeWithPlaybook : styles.categoryBadge}>
                      <Ionicons name="pricetag-outline" size={10} color={Colors.hopeWhite} style={styles.tagIcon} />
                      <ThemedText weight="medium" style={styles.categoryText}>{item.category}</ThemedText>
                    </View>
                  )}
                  {item.playbookId && (
                    <TouchableOpacity
                      style={styles.playbookBadge}
                      onPress={() => handlePlaybookPress(item.playbookId!)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="book-outline" size={12} color={Colors.hopeWhite} style={styles.playbookIcon} />
                      <ThemedText weight="medium" style={styles.playbookText}>From Playbook</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={styles.progressHeader}>
                  <View style={styles.progressLabel}>
                    <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={16} color={Colors.secondaryText} style={styles.progressIcon} />
                    <ThemedText weight="semiBold" style={styles.progressLabelText}>Progress</ThemedText>
                  </View>
                  <ThemedText weight="medium" style={styles.dayCounter}>
                    {completedDays}/{item.totalDays} {item.totalDays === 1 ? 'Day' : 'Days'} Completed
                  </ThemedText>
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
                        <ThemedText weight="semiBold" style={styles.nextDayText}>
                          NEXT: Day {nextIdx + 1}
                        </ThemedText>
                      );
                    }
                    return null;
                  })()}
                </View>
              </View>

              {/* Rating (Completed tab only) */}
              {filter === 'completed' && item.completed && typeof item.rating === 'number' && item.rating > 0 && (
                <View style={styles.ratingContainer}>
                  <View style={styles.ratingRow}>
                    {Array.from({ length: 5 }).map((_, idx) => {
                      const isFilled = idx < Math.round(item.rating || 0);
                      return (
                        <MaterialCommunityIcons
                          key={idx}
                          name={isFilled ? 'star' : 'star-outline'}
                          size={18}
                          color={isFilled ? Colors.faithGold : Colors.secondaryText}
                          style={styles.ratingStar}
                        />
                      );
                    })}
                    <ThemedText weight="medium" style={styles.ratingValueText}>
                      {Math.round(item.rating || 0)}/5
                    </ThemedText>
                  </View>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Swipeable>
      </Animated.View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color={Colors.anchorBlue} />
          <ThemedText style={styles.emptyStateText}>Loading devotionals...</ThemedText>
        </View>
      );
    }

    const hasPlaybooks = !isLoadingPlaybooks && (playbooks?.length ?? 0) > 0;
    const totalDevotionals = Array.isArray(devotionals) ? devotionals.length : 0;

    // If there are some devotionals overall but none in the selected filter,
    // show a filter-specific empty hero (match PlaybookListScreen behavior)
    if (totalDevotionals > 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyHeroContainer}>
            <View style={styles.heroCard}>
              {filter === 'ongoing' ? (
                <MaterialCommunityIcons
                  name="clipboard-text-clock"
                  size={32}
                  color={Colors.holyGlow}
                  style={styles.heroIcon}
                />
              ) : (
                <MaterialCommunityIcons
                  name="trophy-outline"
                  size={32}
                  color={Colors.holyGlow}
                  style={styles.heroIcon}
                />
              )}
              <ThemedText weight="bold" style={styles.heroOverline}>{filter === 'ongoing' ? 'IN PROGRESS LIST' : 'COMPLETED LIST'}</ThemedText>
              <ThemedText weight="bold" style={styles.heroTitle}>
                {filter === 'ongoing' ? 'All your devotionals are completed' : 'No completed devotionals yet'}
              </ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                {filter === 'ongoing'
                  ? 'Great job finishing your devotionals. Review a completed devotional or start a new one.'
                  : 'Keep going! Your finished devotionals will appear here.'}
              </ThemedText>
              <TouchableOpacity
                onPress={() => { try { triggerLightHaptic(); } catch {} setFilter(filter === 'ongoing' ? 'completed' : 'ongoing'); }}
                activeOpacity={0.85}
                style={styles.heroTextButton}
              >
                <ThemedText weight="medium" style={styles.heroLinkText}>
                  {filter === 'ongoing' ? 'Review Completed' : 'See In Progress'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // Otherwise, no devotionals at all: show the original full empty-collection hero
    return (
      <View style={styles.emptyStateContainer}>
        {/* Hero (centered card) */}
        <View style={styles.emptyHeroContainer}>
          <View style={styles.heroCard}>
            <MaterialCommunityIcons
              name="book"
              size={32}
              color={Colors.holyGlow}
              style={styles.heroIcon}
            />
            <ThemedText weight="bold" style={styles.heroOverline}>No Devotionals</ThemedText>
            <ThemedText weight="bold" style={styles.heroTitle}>Start with Scripture</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {(() => {
                const count = !isLoadingPlaybooks && Array.isArray(playbooks) ? playbooks.length : 0;
                if (count > 0) {
                  return count === 1
                    ? 'You already have a playbook—turn it into a daily devotional.'
                    : 'You already have playbooks—turn one into a daily devotional.';
                }
                return "Create a playbook for what you're facing, then build a daily devotional from it.";
              })()}
            </ThemedText>

            {/* Create Playbook CTA (only when there are no playbooks) */}
            {!hasPlaybooks && (
              <TouchableOpacity
                onPress={() => { triggerLightHaptic(); (navigation as any).navigate('UserInput'); }}
                activeOpacity={0.85}
                style={styles.heroOutlineButton}
              >
                <Pencil size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                <ThemedText weight="medium" style={styles.heroOutlineButtonText}>Create a Playbook</ThemedText>
              </TouchableOpacity>
            )}

            {/* Guided steps */}
            <View style={styles.stepsContainer}>
              {hasPlaybooks ? (
                <>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}><ThemedText weight="bold" style={styles.stepBadgeText}>1</ThemedText></View>
                    <ThemedText style={styles.stepText}>Pick a Playbook</ThemedText>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}><ThemedText weight="bold" style={styles.stepBadgeText}>2</ThemedText></View>
                    <ThemedText style={styles.stepText}>Create Your Devotional</ThemedText>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}><ThemedText weight="bold" style={styles.stepBadgeText}>3</ThemedText></View>
                    <ThemedText style={styles.stepText}>Return each day—read, reflect, pray</ThemedText>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}><ThemedText weight="bold" style={styles.stepBadgeText}>1</ThemedText></View>
                    <ThemedText style={styles.stepText}>Create a Playbook</ThemedText>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}><ThemedText weight="bold" style={styles.stepBadgeText}>2</ThemedText></View>
                    <ThemedText style={styles.stepText}>Add Scriptures and prompts</ThemedText>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}><ThemedText weight="bold" style={styles.stepBadgeText}>3</ThemedText></View>
                    <ThemedText style={styles.stepText}>Start your Daily Devotional</ThemedText>
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
                <ThemedText weight="bold" style={styles.carouselTitle}>
                  {suggested.length === 1
                    ? 'Start a devotional from this playbook'
                    : 'Start a devotional from these playbooks'}
                </ThemedText>
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
                      <MaterialCommunityIcons name="clipboard-text-play" size={22} color={Colors.alertCoral} style={styles.cardIcon} />
                      <ThemedText weight="bold" style={styles.cardTitle}>{extractCleanTitle(item.title, 'Playbook')}</ThemedText>
                      {item.truthInLove?.summary ? (
                        <ThemedText style={styles.cardSubtitle} numberOfLines={3}>{replaceAllNamePlaceholders(
                          item.truthInLove.summary,
                          {
                            displayName: (user as any)?.displayName || (user as any)?.user_metadata?.full_name,
                            firstName: (user as any)?.firstName || (user as any)?.user_metadata?.first_name,
                            lastName: (user as any)?.lastName || (user as any)?.user_metadata?.last_name,
                          }
                        )}</ThemedText>
                      ) : null}
                      <TouchableOpacity
                        style={styles.cardCTA}
                        activeOpacity={0.9}
                        onPress={() => {

                          try { triggerLightHaptic(); } catch {}
                          setSelectedPlaybookId(item.id);
                          // Use the actual user input captured when creating the playbook
                          setSelectedPlaybookInfo(item.userInput);
                          setShowDevotionalModal(true);
                        }}
                      >
                        <ThemedText weight="bold" style={styles.cardCTAText}>Create a Devotional</ThemedText>
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

  // Filtering
  const filteredDevotionals = useMemo(() => {
    if (!Array.isArray(devotionals)) {return [];}
    switch (filter) {
      case 'ongoing':
        return devotionals.filter(d => !d.completed);
      case 'completed':
        return devotionals.filter(d => d.completed);
      default:
        return devotionals;
    }
  }, [devotionals, filter]);

  // Sorting by updatedAt desc (fallback createdAt)
  const sortedDevotionals = useMemo(() => {
    return [...filteredDevotionals].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [filteredDevotionals]);

  const initAnimations = useCallback(() => {
    try {
      // Collect ids from currently visible list (sorted)
      const ids: string[] = (Array.isArray(sortedDevotionals) ? sortedDevotionals : []).map(d => d.id);
      ids.forEach(id => {
        if (!animatedValues.current[id]) {
          animatedValues.current[id] = new Animated.Value(0);
        } else {
          animatedValues.current[id].setValue(0);
        }
      });
      if (ids.length > 0) {
        const animations = ids.map((id, index) =>
          Animated.spring(animatedValues.current[id], {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
            bounciness: 8,
            delay: index * 100,
          })
        );
        Animated.stagger(100, animations).start();
      }
    } catch (err) {
      Logger.warn('[DevotionalsScreen] initAnimations error', {
        component: 'DevotionalsScreen',
        error: err as Error,
      });
    }
  }, [sortedDevotionals]);

  // Restart animations whenever list changes or screen focuses
  useEffect(() => { initAnimations(); }, [initAnimations]);
  useEffect(() => {
    const unsub = (navigation as any)?.addListener?.('focus', () => { initAnimations(); });
    return () => { if (typeof unsub === 'function') { unsub(); } };
  }, [navigation, initAnimations]);

  // Grouping by Month Year
  const sections = useMemo(() => {
    const groups: Record<string, Devotional[]> = {};
    for (const d of sortedDevotionals) {
      const key = format(new Date(d.updatedAt || d.createdAt), 'MMMM yyyy').toUpperCase();
      if (!groups[key]) { groups[key] = []; }
      groups[key].push(d);
    }
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [sortedDevotionals]);

  // Reset: always start at the top when navigating to Devotionals from bottom tab
  const resetToTop = useCallback(() => {
    try {
      const hasData = Array.isArray(sections) && sections.length > 0 && Array.isArray(sections[0]?.data) && sections[0].data.length > 0;
      if (hasData) {
        sectionListRef.current?.scrollToLocation?.({ sectionIndex: 0, itemIndex: 0, animated: false, viewPosition: 0 });
      } else {
        sectionListRef.current?.scrollToLocation?.({ sectionIndex: 0, itemIndex: 0, animated: false, viewPosition: 0 });
      }
    } catch {}
    // Close swipeables
    try {
      Object.values(rowRefs.current || {}).forEach((ref: any) => {
        if (ref && typeof ref.close === 'function') { ref.close(); }
      });
    } catch {}
    // Reset UI filter and modal
    setFilter('ongoing');
    setShowDevotionalModal(false);
  }, [sections]);

  // Listen for tab presses to reset
  useEffect(() => {
    const subSelf = (navigation as any)?.addListener?.('tabPress', resetToTop);
    const subParent = (navigation as any)?.getParent?.()?.addListener?.('tabPress', resetToTop);
    return () => {
      if (typeof subSelf === 'function') {
        subSelf();
      }
      if (typeof subParent === 'function') {
        subParent();
      }
    };
  }, [navigation, resetToTop]);

  // Fallback: whenever this screen gains focus, ensure it's at the top
  useFocusEffect(
    useCallback(() => {
      try {
        const hasData = Array.isArray(sections) && sections.length > 0 && Array.isArray(sections[0]?.data) && sections[0].data.length > 0;
        if (hasData) {
          sectionListRef.current?.scrollToLocation?.({ sectionIndex: 0, itemIndex: 0, animated: false, viewPosition: 0 });
        }
      } catch {}
      return () => {};
    }, [sections])
  );

  const totalDevotionalsAll = Array.isArray(devotionals) ? devotionals.length : 0;
  // Treat screen as loading until BOTH queries have settled to avoid flashing the no-playbooks empty state
  const isInitialLoading = isLoading || isLoadingPlaybooks;
  const isTrulyEmpty = !isInitialLoading && totalDevotionalsAll === 0;

  useScreenStatusBar(isTrulyEmpty ? 'light' : 'auto', isTrulyEmpty ? Colors.anchorBlue : undefined);

  // Prefetch detail data for visible items
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: Devotional }> }) => {
    try {
      const ids = viewableItems.map(v => v.item?.id).filter(Boolean) as string[];
      ids.slice(0, 6).forEach((id) => {
        const key = ['devotionals', 'detail', userId || '', id];
        if (!queryClient.getQueryData(key)) {
          queryClient.prefetchQuery({
            queryKey: key,
            queryFn: async () => {
              // lightweight prefetch: return existing cached list item if any
              const fromList = (devotionals || []).find(d => d.id === id);
              return fromList || null;
            },
            staleTime: 10 * 60 * 1000,
          });
        }
      });
    } catch {}
  }).current;

  return (
    <SafeAreaView style={[styles.container, isTrulyEmpty && styles.containerBlue]} edges={['left','right','bottom']}>
      <StatusBar barStyle={isTrulyEmpty ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }, isTrulyEmpty && styles.headerBlue]}>
        <View style={styles.pageInner}>
          {isTrulyEmpty ? (
            <View style={styles.headerSpacer} />
          ) : (
            <ThemedText weight="bold" style={styles.headerTitle}>Devotionals</ThemedText>
          )}
          {/* Filters */}
          {!isTrulyEmpty && (
            <View style={[styles.filterTabsOnWhite, { paddingRight: Math.max(insets.right, 16) }]}>
              {([
                { key: 'all', label: 'All' },
                { key: 'ongoing', label: 'In Progress' },
                { key: 'completed', label: 'Completed' },
              ] as const).map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    setFilter(tab.key);
                  }}
                  style={[
                    styles.filterTabOnWhite,
                    filter === tab.key && (
                      tab.key === 'completed'
                        ? styles.filterTabActiveCompletedOnWhite
                        : tab.key === 'ongoing'
                        ? styles.filterTabActiveOngoingOnWhite
                        : styles.filterTabActiveOnWhite
                    ),
                  ]}
                  activeOpacity={0.9}
                >
                  <ThemedText weight="semiBold" style={[styles.filterTabTextOnWhite, filter === tab.key && styles.filterTabTextActiveOnWhite]}>
                    {tab.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Content area within BlueSheet for consistent blue background layout */}
      <BlueSheet style={styles.contentSheet}>
        {isInitialLoading ? (
          <View style={[styles.listContent, styles.pageInner]}>
            <DevotionalSkeleton />
          </View>
        ) : (
          <SectionList
            ref={sectionListRef}
            style={styles.sectionList}
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={({ item }: { item: Devotional }) => renderDevotionalItem({ item })}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <ThemedText weight="bold" style={styles.sectionHeaderText}>{title}</ThemedText>
              </View>
            )}
            stickySectionHeadersEnabled
            scrollEnabled={!isTrulyEmpty}
            bounces={!isTrulyEmpty}
            contentContainerStyle={
              isTrulyEmpty
                ? styles.emptyListContent
                : [
                    styles.listContent,
                    styles.pageInner,
                    styles.listContentPadding,
                    { paddingBottom: Math.max(insets.bottom, 12) + 8 },
                  ]
            }
            ListEmptyComponent={renderEmptyState}
            onViewableItemsChanged={onViewableItemsChanged}
            showsVerticalScrollIndicator={false}
          />
        )}
      </BlueSheet>

      {/* Devotional creation modal triggered from empty-state playbook cards */}
      <DevotionalModal
        visible={showDevotionalModal}
        onClose={() => setShowDevotionalModal(false)}
        playbookId={selectedPlaybookId || undefined}
        playbookInfo={selectedPlaybookInfo || undefined}
        userInput={selectedPlaybookInfo || undefined}
        onDevotionalCreated={(devotionalId) => {
          // Navigate straight to the newly created devotional
          navigation.navigate('DevotionalDetail', { devotionalId });
        }}
      />
    </SafeAreaView>
  );
};

// Create a memory of the title extraction logic for debugging purposes
const createTitleExtractionMemory = (devotional: Devotional) => {
  if (!devotional) {return;}

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  // Empty state: make entire screen blue including header area
  containerBlue: {
    backgroundColor: Colors.anchorBlue,
  },
  swipeableContainer: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 26, // Increased border radius to 26
    overflow: 'hidden',
    minHeight: 200, // Minimum height
    backgroundColor: 'transparent', // Keep background clean on BlueSheet
  },
  swipeableInner: {
    width: '100%',
    borderRadius: 26, // Increased border radius to 26
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  headerBlue: {
    backgroundColor: Colors.anchorBlue,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.anchorBlue,
    marginBottom: 8,
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
  // Match Playbook header-on-white tabs
  filterTabsOnWhite: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
    gap: 6,
  },
  filterTabOnWhite: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: Colors.restfulShadow,
  },
  filterTabActiveOnWhite: {
    backgroundColor: Colors.anchorBlue,
  },
  filterTabTextOnWhite: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.anchorBlue,
    letterSpacing: 0.2,
    fontWeight: '400',
  },
  filterTabTextActiveOnWhite: {
    color: Colors.hopeWhite,
  },
  // Per-tab active colors on white header
  filterTabActiveCompletedOnWhite: {
    backgroundColor: Colors.growthGreen,
  },
  filterTabActiveOngoingOnWhite: {
    backgroundColor: Colors.alertCoral,
  },
  pageInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  contentSheet: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionList: {
    flex: 1,
  },
  listContentPadding: {
    paddingTop: 20,
    paddingBottom: 8,
  },
  emptyListContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 2,
  },
  sectionHeader: {
    backgroundColor: Colors.modalBlue,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  sectionHeaderText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  devotionalCard: {
    backgroundColor: Colors.subtleOverlay, // Match Playbook card tint on BlueSheet
    borderRadius: 26, // Increased border radius to 26
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
    backgroundColor: Colors.lightBorder,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  categoryBadgeWithPlaybook: {
    backgroundColor: Colors.lightBorder,
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
    backgroundColor: Colors.lightBorder,
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
    borderRadius: 26, // Increased border radius to 26
    marginLeft: 8,
    height: '100%',
  },
  date: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: Colors.secondaryText,
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
    color: Colors.holyGlow,
    marginBottom: 8,
    lineHeight: 20,
  },
  progressBarContainer: {
    width: '100%',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.lightBorder,
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
    color: Colors.holyGlow,
    marginLeft: 4,
    fontFamily: Fonts.medium,
  },
  progressIcon: {
    marginRight: 4,
  },
  dayCounter: {
    fontSize: 12,
    color: Colors.secondaryText,
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
    color: Colors.holyGlow,
    fontFamily: Fonts.medium,
  },
  ratingContainer: {
    marginTop: 10,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingIcon: {
    marginRight: 4,
  },
  ratingLabelText: {
    fontSize: 13,
    color: Colors.holyGlow,
    fontFamily: Fonts.medium,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStar: {
    marginRight: 2,
  },
  ratingValueText: {
    marginLeft: 8,
    fontSize: 12,
    color: Colors.faithGold,
    fontFamily: Fonts.medium,
  },
  progressWrapper: {
    flex: 1,
  },
  barBg: {
    width: '100%',
    height: 12, // Thicker bar for better visibility
    backgroundColor: Colors.mediumOverlay,
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
    fontFamily: Fonts.medium,
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
    backgroundColor: Colors.subtleOverlay,
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
    color: Colors.holyGlow,
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
    color: Colors.tertiaryText,
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
  // Link-style text button below hero CTA (to switch filters)
  heroTextButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  heroLinkText: {
    color: Colors.hopeWhite,
    opacity: 0.9,
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
    backgroundColor: Colors.lightOverlay,
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
    backgroundColor: Colors.lightBorder,
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
    color: Colors.holyGlow,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.medium,
  },
  emptyAura: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.restfulShadow,
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
    color: Colors.text,
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
    backgroundColor: Colors.restfulShadow,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginHorizontal: 4,
  },
  emptyBadgeText: {
    marginLeft: 6,
    fontSize: 12,
    color: Colors.text,
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
    color: Colors.hopeWhite,
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
    backgroundColor: Colors.subtleOverlay, // match empty state hero card tint
    borderRadius: 30,
    padding: 16,
    // remove light border for dark card style
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
  cardIcon: {
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.hopeWhite,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.hopeWhite,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardCTA: {
    alignSelf: 'center',
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

export default withErrorBoundary(DevotionalsScreen, 'DevotionalsScreen');
