import React, { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil } from 'lucide-react-native';
import {
  View,
  StyleSheet,
  SectionList,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  NativeModules,
  Alert,
  Animated,
  TextInput,
  LayoutAnimation,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useScroll } from '../context/ScrollContext';
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
import PickerModal from '../components/PickerModal';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';

type DevotionalsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Devotionals'>;

type FilterType = 'ongoing' | 'completed';

const DevotionalsScreen = () => {
  const navigation = useNavigation<DevotionalsScreenNavigationProp>();
  const { user } = useAuth();
  const userId = user?.id;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { setShowTabBar } = useScroll();
  const tabBarCollapsedRef = useRef(false);

  // Status filter
  const [filter, setFilter] = useState<FilterType>('ongoing');
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // All picker/view state batched into one object — 
  // Picker state for advanced filtering
  // This state manages the advanced filter modal configuration:
  // - contentView: Determines what filter type is active (all/category/date)
  // - dateViewMode: Date range mode when contentView is 'date'
  // - selectedCategories: Array of selected category names
  // - customDateFrom/To: Custom date range boundaries
  const [pickerState, setPickerState] = useState<{
    contentView: 'all' | 'category' | 'date';
    dateViewMode: 'weekly' | 'monthly' | 'yearly' | 'custom';
    selectedCategories: string[];
    customDateFrom: Date;
    customDateTo: Date;
  }>({
    contentView: 'all',
    dateViewMode: 'monthly',
    selectedCategories: [],
    customDateFrom: (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d; })(),
    customDateTo: new Date(),
  });
  const { contentView, dateViewMode, selectedCategories, customDateFrom, customDateTo } = pickerState;

  // Deferred versions — content rendering uses these so expensive work is deferred
  // while pill visuals / modal state update instantly from the originals
  const deferredFilter = useDeferredValue(filter);
  const deferredSelectedCategories = useDeferredValue(selectedCategories);
  const deferredContentView = useDeferredValue(contentView);
  const deferredDateViewMode = useDeferredValue(dateViewMode);

  // Memoized style objects — prevents ScrollView layout recalculation on every render
  const scrollContentStyle = useMemo(() => ({ paddingBottom: 80 }), []);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const searchIconAnim = useRef(new Animated.Value(1)).current;

  // Search toggle callback
  const toggleSearch = useCallback(() => {
    const opening = !showSearch;

    // LayoutAnimation runs on the native thread — no JS-thread jank for height changes
    LayoutAnimation.configureNext({
      duration: 260,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });

    setShowSearch(opening);
    if (!opening) {
      setSearchQuery('');
    } else {
      // Focus after layout settles
      setTimeout(() => { searchInputRef.current?.focus(); }, 50);
    }

    // Subtle native-driver press pop on the icon button
    Animated.sequence([
      Animated.timing(searchIconAnim, { toValue: 0.88, duration: 80, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.spring(searchIconAnim, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 6 }),
    ]).start();
  }, [showSearch, searchIconAnim]);

  // PickerModal callbacks — close modal immediately, defer heavy state update until after fade animation
  const handlePickerApply = useCallback((
    cv: 'all' | 'category' | 'date',
    dm: 'weekly' | 'monthly' | 'yearly' | 'custom',
    cats: string[],
    from: Date,
    to: Date,
  ) => {
    // Close modal right away so fade animation isn't competing with re-render work
    setShowStatusPicker(false);
    // Wait for Modal's fade-out to finish (~250ms) before the heavy state update.
    // InteractionManager alone is unreliable here — Modal's animation isn't always
    // registered as an interaction, so it can fire immediately.
    setTimeout(() => {
      setPickerState({ contentView: cv, dateViewMode: dm, selectedCategories: cats, customDateFrom: from, customDateTo: to });
    }, 260);
  }, []);

  const handlePickerClose = useCallback(() => setShowStatusPicker(false), []);
  const handlePickerFilterChange = useCallback((f: 'ongoing' | 'completed') => setFilter(f), []);

  // Devotional modal state
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

  // Collapse bottom nav on scroll down, expand only when scrolling back to the very top
  const lastScrollYRef = useRef(0);
  const handleScroll = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const isScrollingUp = y < lastScrollYRef.current;
    lastScrollYRef.current = y;
    if (y > 60 && !tabBarCollapsedRef.current) {
      tabBarCollapsedRef.current = true;
      setShowTabBar(false);
    } else if (isScrollingUp && y <= 0 && tabBarCollapsedRef.current) {
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);
    }
  }, [setShowTabBar]);

  // Ensure latest playbooks are shown when returning to this screen
  useFocusEffect(
    useCallback(() => {
      // Always expand tab bar when screen gains focus
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);

      const focusTime = Date.now();
      Logger.debug('[DevotionalsScreen] Screen focused', { component: 'DevotionalsScreen', focusTime });

      // CRITICAL: Use InteractionManager to prevent VirtualizedList freeze
      // requestAnimationFrame doesn't wait for navigation animations to complete
      const { InteractionManager } = require('react-native');
      InteractionManager.runAfterInteractions(() => {
        const interactionTime = Date.now();
        Logger.debug('[DevotionalsScreen] InteractionManager fired, refetching playbooks', { component: 'DevotionalsScreen', delay: interactionTime - focusTime });
        // Force a refetch regardless of staleTime, so newly created playbooks are visible
        refetchPlaybooks();
        Logger.debug('[DevotionalsScreen] Playbooks refetch triggered', { component: 'DevotionalsScreen' });
      });
    }, [refetchPlaybooks, setShowTabBar])
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

  const handleDevotionalPress = useCallback((devotional: Devotional) => {
    // Log title extraction
    createTitleExtractionMemory(devotional);

    // Navigate to devotional detail
    navigation.navigate('DevotionalDetail', { devotionalId: devotional.id });
  }, [navigation]);

  const handlePlaybookPress = useCallback(async (playbookId: string) => {
    try {
      triggerLightHaptic();
      const playbookData = await fetchPlaybookById(playbookId);
      if (playbookData) {
        navigation.navigate('PlaybookDetail', { playbook: playbookData });
      }
    } catch (error) {
      Logger.error('Error fetching playbook', error as Error, { component: 'DevotionalsScreen' });
    }
  }, [triggerLightHaptic, fetchPlaybookById, navigation]);

  const handleDeleteDevotional = useCallback(async (devotionalId: string) => {
    try {
      // Perform the deletion
      await deleteDevotional(devotionalId);

      // Remove the row reference after successful deletion
      delete rowRefs.current[devotionalId];
    } catch (error) {
      Logger.error('Error deleting devotional', error as Error, { component: 'DevotionalsScreen' });
    }
  }, [deleteDevotional]);

  // Use any type for rowRefs to avoid TypeScript errors with Swipeable
  const rowRefs = useRef<{ [key: string]: any }>({});
  // Ref for SectionList to allow programmatic scrolling to top
  const sectionListRef = useRef<SectionList<any>>(null);

  // Reset logic moved below after 'sections' is declared

  const renderRightActions = useCallback((devotionalId: string) => {
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

                  // Close the swipeable row immediately for better UX
                  const rowRef = rowRefs.current[devotionalId];
                  if (rowRef && typeof rowRef.close === 'function') {
                    rowRef.close();
                  }

                  // Perform the deletion
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
  }, [triggerLightHaptic, handleDeleteDevotional]);

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

  const renderDevotionalItem = useCallback(({ item }: { item: Devotional }) => {
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
  }, [triggerLightHaptic, renderRightActions, handleDevotionalPress, handlePlaybookPress, filter]);

  // Filter-specific empty state component
  const renderFilterEmptyState = useCallback(() => {
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

    // Loading state
    if (isLoading) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color={Colors.anchorBlue} />
          <ThemedText style={styles.emptyStateText}>Loading devotionals...</ThemedText>
        </View>
      );
    }

    return null; // Should never reach here since empty state is handled above
  }, [devotionals, filter, isLoading, triggerLightHaptic]);

  // Extract available categories from devotionals
  const availableCategories = useMemo(() => {
    if (!Array.isArray(devotionals)) { return []; }
    const categories = new Set<string>();
    devotionals.forEach(d => {
      if (d.category) {
        categories.add(d.category);
      }
    });
    return Array.from(categories).sort();
  }, [devotionals]);

  // Filtering - respects status, content view, date view, categories, and search
  // This is the core filtering logic that combines multiple filter criteria:
  // 1. Status filter: ongoing vs completed devotionals
  // 2. Search filter: matches title or category (case-insensitive)
  // 3. Content view filter: category-based filtering
  // 4. Date view filter: weekly/monthly/yearly/custom date ranges
  const filteredDevotionals = useMemo(() => {
    if (!Array.isArray(devotionals)) {return [];}

    let result = devotionals;

    // Status filter - separates ongoing from completed devotionals
    switch (filter) {
      case 'ongoing':
        result = result.filter(d => !d.completed);
        break;
      case 'completed':
        result = result.filter(d => d.completed);
        break;
    }

    // Search filter - searches in title and category fields
    // Case-insensitive partial matching for better UX
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(d => {
        const title = d.title?.toLowerCase() || '';
        const category = d.category?.toLowerCase() || '';
        return title.includes(query) || category.includes(query);
      });
    }

    // Content view filter - category-based filtering
    // Only applies when contentView is 'category' and categories are selected
    if (contentView === 'category' && selectedCategories.length > 0) {
      result = result.filter(d => d.category && selectedCategories.includes(d.category));
    }

    // Date view filter - time-based filtering
    // Supports multiple date ranges: weekly, monthly, yearly, custom
    if (contentView === 'date') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (dateViewMode) {
        case 'weekly': {
          // Last 7 days from today
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          result = result.filter(d => d.createdAt && new Date(d.createdAt) >= weekAgo);
          break;
        }
        case 'monthly': {
          // Last 30 days from today
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          result = result.filter(d => d.createdAt && new Date(d.createdAt) >= monthAgo);
          break;
        }
        case 'yearly': {
          // Last 365 days from today
          const yearAgo = new Date(today);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          result = result.filter(d => d.createdAt && new Date(d.createdAt) >= yearAgo);
          break;
        }
        case 'custom': {
          // User-defined date range
          result = result.filter(d => {
            if (!d.createdAt) return false;
            const date = new Date(d.createdAt);
            return date >= customDateFrom && date <= customDateTo;
          });
          break;
        }
      }
    }

    return result;
  }, [devotionals, filter, searchQuery, contentView, selectedCategories, dateViewMode, customDateFrom, customDateTo]);

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
      const focusTime = Date.now();
      Logger.debug('[DevotionalsScreen] Scroll focus effect triggered', { component: 'DevotionalsScreen', focusTime });

      // ENTERPRISE-GRADE: Defer scroll operation to after navigation transition completes
      const raf = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: (time?: number) => void) => setTimeout(() => cb(), 16);
      raf(() => {
        const rafTime = Date.now();
        Logger.debug('[DevotionalsScreen] RAF fired for scroll', { component: 'DevotionalsScreen', delay: rafTime - focusTime });
        try {
          const hasData = Array.isArray(sections) && sections.length > 0 && Array.isArray(sections[0]?.data) && sections[0].data.length > 0;
          if (hasData) {
            Logger.debug('[DevotionalsScreen] Scrolling to top', { component: 'DevotionalsScreen' });
            sectionListRef.current?.scrollToLocation?.({ sectionIndex: 0, itemIndex: 0, animated: false, viewPosition: 0 });
            Logger.debug('[DevotionalsScreen] Scroll complete', { component: 'DevotionalsScreen' });
          } else {
            Logger.debug('[DevotionalsScreen] No data to scroll', { component: 'DevotionalsScreen' });
          }
        } catch (e) {
          Logger.error('[DevotionalsScreen] Scroll error', e as Error, { component: 'DevotionalsScreen' });
        }
      });
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

  // Show empty state when we have no devotionals and we're not in initial loading state
  if (totalDevotionalsAll === 0 && !isInitialLoading && userId) {
    const hasPlaybooks = !isLoadingPlaybooks && (playbooks?.length ?? 0) > 0;

    return (
      <SafeAreaView style={[styles.container, styles.containerBlue]} edges={['left','right']}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={[styles.container, styles.containerEmpty, { backgroundColor: Colors.anchorBlue }]}>
          <View style={[styles.headerBar, { paddingTop: insets.top, backgroundColor: Colors.anchorBlue }]}>
            <View style={styles.pageInner}>
              {/* Hide header when empty; keep layout with spacer (match PlaybookListScreen) */}
              <View style={styles.headerSpacer} />
            </View>
          </View>

          {/* Empty state hero on anchor blue background via BlueSheet */}
          <BlueSheet style={styles.contentSheet}>
            <View style={[styles.emptyStateContainer, styles.pageInner]}>
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
            </View>
          </BlueSheet>

          {/* Suggestions carousel from Playbooks (without devotionals) */}
          {!isLoadingPlaybooks && playbooks.length > 0 && (
            (() => {
              const existingDevotionalPBIds = new Set((devotionals || []).filter(d => d.playbookId).map(d => d.playbookId));
              const suggested = playbooks.filter(pb => !existingDevotionalPBIds.has(pb.id)).slice(0, 10);
              if (suggested.length === 0) { return null; }

              return (
                <BlueSheet style={styles.contentSheet}>
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
                            style={[styles.cardCTA, showDevotionalModal && styles.cardCTADisabled]}
                            activeOpacity={showDevotionalModal ? 1 : 0.9}
                            disabled={showDevotionalModal}
                            onPress={() => {
                              if (showDevotionalModal) {
                                return; // Prevent multiple taps
                              }
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
                </BlueSheet>
              );
            })()
          )}

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
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isTrulyEmpty && styles.containerBlue]} edges={['left','right']}>
      <StatusBar barStyle={isTrulyEmpty ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header */}
      {/* Header on white background - matching PlaybookListScreen structure */}
      <View pointerEvents="box-none" style={[styles.headerBar, { paddingTop: insets.top }]}>
        <View style={styles.pageInner}>
          {isTrulyEmpty ? (
            <View style={styles.headerSpacer} />
          ) : (
            <>
              {/* Row 1: Title left, actions right */}
              <View style={styles.headerTopRow}>
                <ThemedText weight="bold" style={styles.headerTitle}>Devotionals</ThemedText>
                <View style={styles.headerActions}>
                  {/* Status pill — shows current filter, not clickable */}
                  <View
                    style={[
                      styles.statusDropdownBtn,
                      filter === 'ongoing' && styles.statusDropdownBtnOngoing,
                      filter === 'completed' && styles.statusDropdownBtnCompleted,
                    ]}
                  >
                    <ThemedText weight="semiBold" style={[
                      styles.statusDropdownBtnText,
                      filter === 'ongoing' && styles.statusDropdownBtnTextOngoing,
                      filter === 'completed' && styles.statusDropdownBtnTextCompleted,
                    ]}>
                      {filter === 'ongoing' ? 'In Progress' : 'Completed'}
                    </ThemedText>
                  </View>

                  {/* Tune icon — opens status picker */}
                  <TouchableOpacity
                    style={styles.dateFilterCircleButton}
                    onPress={() => { try { triggerLightHaptic(); } catch {} setShowStatusPicker(true); }}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons name="tune" size={16} color={Colors.anchorBlue} />
                  </TouchableOpacity>

                  {/* Search circle */}
                  <TouchableOpacity
                    style={styles.searchCircleButton}
                    onPress={() => { try { triggerLightHaptic(); } catch {} toggleSearch(); }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={showSearch ? 'close' : 'search'} size={17} color={Colors.anchorBlue} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 2: Search bar — height animated by LayoutAnimation (native thread) */}
              {showSearch && (
                <View style={styles.searchBar}>
                  <Ionicons name="search-outline" size={16} color={'rgba(3,32,61,0.4)'} style={styles.searchIcon} />
                  <View style={styles.searchInputWrapper}>
                    <TextInput
                      ref={searchInputRef}
                      style={styles.searchInput}
                      placeholder="Search all devotionals..."
                      placeholderTextColor={'rgba(3,32,61,0.35)'}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                      keyboardAppearance="dark"
                    />
                  </View>
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={16} color={'rgba(3,32,61,0.3)'} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {!showSearch && <View style={styles.searchBarCollapsedSpacer} />}
            </>
          )}
        </View>
      </View>

      {/* Content area within BlueSheet for consistent blue background layout */}
      <BlueSheet style={styles.contentSheet}>
        {isInitialLoading ? (
          <View style={[styles.listContent, styles.pageInner]}>
            <DevotionalSkeleton />
          </View>
        ) : contentView === 'all' ? (
          // All view: SectionList grouped by month/year
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
                  ]
            }
            ListFooterComponent={<View style={{ height: Math.max(insets.bottom, 8) + 80 }} />}
            scrollIndicatorInsets={{ top: 0, bottom: Math.max(insets.bottom, 8) + 80, left: 0, right: 0 }}
            ListEmptyComponent={renderFilterEmptyState}
            onViewableItemsChanged={onViewableItemsChanged}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={100}
          />
        ) : contentView === 'category' ? (
          // Category view: Horizontal carousels per category
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.listContent, styles.pageInner, styles.listContentPadding]}
            scrollEnabled={!isTrulyEmpty}
            bounces={!isTrulyEmpty}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={100}
          >
            {sortedDevotionals.length > 0 ? (
              availableCategories.map(category => {
                const categoryDevotionals = sortedDevotionals.filter(d => d.category === category);
                if (categoryDevotionals.length === 0) return null;
                return (
                  <View key={category} style={styles.categorySection}>
                    <View style={styles.categorySectionHeader}>
                      <ThemedText weight="semiBold" style={styles.categorySectionTitle}>{category.toUpperCase()}</ThemedText>
                      <View style={styles.categorySectionCount}>
                        <ThemedText style={styles.categorySectionCountText}>{categoryDevotionals.length}</ThemedText>
                      </View>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryCarouselContent}
                    >
                      {categoryDevotionals.map((devotional) => renderDevotionalItem({ item: devotional }))}
                    </ScrollView>
                  </View>
                );
              })
            ) : (
              renderFilterEmptyState()
            )}
            <View style={{ height: Math.max(insets.bottom, 8) + 80 }} />
          </ScrollView>
        ) : (
          // Date view: FlatList
          <FlatList
            data={sortedDevotionals}
            keyExtractor={(item) => item.id}
            renderItem={({ item }: { item: Devotional }) => renderDevotionalItem({ item })}
            contentContainerStyle={[
              styles.listContent,
              styles.pageInner,
              styles.listContentPadding,
            ]}
            scrollEnabled={!isTrulyEmpty}
            bounces={!isTrulyEmpty}
            ListFooterComponent={<View style={{ height: Math.max(insets.bottom, 8) + 80 }} />}
            scrollIndicatorInsets={{ top: 0, bottom: Math.max(insets.bottom, 8) + 80, left: 0, right: 0 }}
            ListEmptyComponent={renderFilterEmptyState}
            onViewableItemsChanged={onViewableItemsChanged}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            // Performance optimizations
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={10}
            removeClippedSubviews={true}
          />
        )}
      </BlueSheet>

      {/* Devotional creation modal - available in both empty and non-empty states */}
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

      {/* Status picker modal */}
      <PickerModal
        visible={showStatusPicker}
        filter={filter}
        initContentView={contentView}
        initDateViewMode={dateViewMode}
        initSelectedCategories={selectedCategories}
        initCustomDateFrom={customDateFrom}
        initCustomDateTo={customDateTo}
        availableCategories={availableCategories}
        onClose={handlePickerClose}
        onFilterChange={handlePickerFilterChange}
        onApply={handlePickerApply}
        onHaptic={triggerLightHaptic}
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
  containerEmpty: {
    // Remove default container padding so heroCard width matches Devotionals (90% of screen)
    paddingHorizontal: 0,
    paddingTop: 0,
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 0,
    paddingBottom: 0,
    backgroundColor: Colors.hopeWhite,
  },
  // ── Header layout ────────────────────────────────────────────
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.anchorBlue,
    letterSpacing: 0.5,
    flex: 1,
  },
  // ── Header action buttons ─────────────────────────────────────
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Status dropdown pill beside search icon
  statusDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(3, 32, 61, 0.05)',
  },
  statusDropdownBtnOngoing: {
    backgroundColor: 'rgba(230, 90, 70, 0.07)',
  },
  statusDropdownBtnCompleted: {
    backgroundColor: 'rgba(95, 138, 104, 0.07)',
  },
  statusDropdownBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: 'rgba(3, 32, 61, 0.5)',
  },
  statusDropdownBtnTextOngoing: {
    color: Colors.alertCoral,
  },
  statusDropdownBtnTextCompleted: {
    color: Colors.growthGreen,
  },
  // Circle buttons for tune and search
  dateFilterCircleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(3, 32, 61, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchCircleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(3, 32, 61, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search row: bar + filter button side by side
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 2,
  },
  // Animated search bar (inside searchBarWrapper)
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(3, 32, 61, 0.055)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(3, 32, 61, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 0,
    marginTop: 6,
    marginBottom: 8,
    height: 42,
  },
  searchInputWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  searchIcon: {
    marginRight: 7,
  },
  searchBarCollapsedSpacer: {
    height: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.anchorBlue,
    paddingVertical: 0,
    fontFamily: Fonts.regular,
    letterSpacing: 0.1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  clearButton: {
    marginLeft: 6,
    padding: 2,
  },
  scrollView: {
    flex: 1,
  },
  categorySection: {
    marginBottom: 24,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categorySectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.anchorBlue,
    letterSpacing: 0.5,
  },
  categorySectionCount: {
    backgroundColor: 'rgba(3, 32, 61, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categorySectionCountText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.anchorBlue,
  },
  categoryCarouselContent: {
    paddingHorizontal: 0,
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
    paddingHorizontal: 16, // Add responsive padding to match PlaybookListScreen
  },
  contentSheet: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 70,
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
    marginTop: 12,
  },
  cardCTADisabled: {
    backgroundColor: Colors.anchorBlue,
    opacity: 0.6,
  },
  cardCTAText: {
    color: Colors.hopeWhite,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default withErrorBoundary(DevotionalsScreen, 'DevotionalsScreen');
