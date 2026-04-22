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
  Dimensions,
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
import CategoryCarouselRow from '../components/CategoryCarouselRow';
import { useQueryClient } from '@tanstack/react-query';

import { Devotional } from '../interfaces/devotional';
import { format } from 'date-fns';

import { extractCleanTitle } from '../utils/titleUtils';
import { Colors, Fonts } from '../theme';
import DevotionalCarouselSkeleton from '../components/SkeletonLoader/DevotionalCarouselSkeleton';
import BlueSheet from '../components/layout/BlueSheet';
import ThemedText from '../components/common/ThemedText';
import PickerModal from '../components/PickerModal';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';

type DevotionalsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Devotionals'>;

type FilterType = 'ongoing' | 'completed';

// Carousel constants - matching PlaybookListScreen for consistent spacing
const { width } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 16;
const VISIBLE_WIDTH = Math.max(0, width - CARD_HORIZONTAL_PADDING * 2);
const isTablet = width >= 768;
const ITEM_WIDTH = isTablet ? 384 : Math.round(VISIBLE_WIDTH * 0.8);
const ITEM_SPACING = 8;
const ITEM_SIZE = ITEM_WIDTH + ITEM_SPACING;
const SIDE_INSET = Math.max(
  0,
  isTablet ? 24 : Math.round((VISIBLE_WIDTH - ITEM_WIDTH) / 2),
);
const CAROUSEL_CONTENT_STYLE = { paddingHorizontal: SIDE_INSET };

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

  // Auto-close dropdown menu when navigating away
  useFocusEffect(
    useCallback(() => {
      return () => {
        setMenuVisible(null);
      };
    }, [])
  );

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
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
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
    } catch (error) {
      Logger.error('Error deleting devotional', error as Error, { component: 'DevotionalsScreen' });
    }
  }, [deleteDevotional]);

  const showDeleteConfirm = useCallback((devotionalId: string) => {
    setMenuVisible(null);
    Alert.alert(
      'Delete Devotional',
      'Are you sure you want to delete this devotional?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteDevotional(devotionalId),
        },
      ]
    );
  }, [handleDeleteDevotional]);

  // Ref for SectionList to allow programmatic scrolling to top
  const sectionListRef = useRef<SectionList<any>>(null);

  // Reset logic moved below after 'sections' is declared

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const currentYear = new Date().getFullYear();
    const year = date.getFullYear();
    const formatString = year === currentYear ? 'EEE, MMM d' : 'EEE, MMM d, yyyy';
    return format(date, formatString);
  };


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

    return (
      <View style={styles.devotionalCardContainer}>
        <TouchableOpacity
          style={styles.devotionalCard}
          onPress={() => handleDevotionalPress(item)}
          activeOpacity={1}
        >
            <View style={styles.cardContent}>
              {/* Gradient Container with Category, Tag, From Playbook, and Menu */}
              <View style={styles.gradientContainer}>
                <View style={styles.gradientTagRow}>
                  <View style={styles.categoryLabel}>
                    <ThemedText weight="bold" style={styles.categoryLabelText}>{item.category || 'Devotional'}</ThemedText>
                  </View>
                  {item.playbookId && (
                    <TouchableOpacity
                      style={styles.gradientPlaybookBadge}
                      onPress={() => handlePlaybookPress(item.playbookId!)}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="clipboard-text-play" size={10} color="rgba(255, 255, 255, 0.6)" style={styles.gradientPlaybookIcon} />
                      <ThemedText weight="medium" style={styles.gradientPlaybookText}>from Playbook</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    setMenuVisible(menuVisible === item.id ? null : item.id);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255, 255, 255, 0.7)" />
                </TouchableOpacity>
                {menuVisible === item.id && (
                  <View style={styles.dropdownMenu}>
                    <TouchableOpacity
                      style={[styles.dropdownItem, styles.dropdownItemLast]}
                      onPress={() => {
                        try { triggerLightHaptic(); } catch {}
                        showDeleteConfirm(item.id);
                      }}
                    >
                      <View style={styles.dropdownItemContent}>
                        <Ionicons name="trash-outline" size={16} color={Colors.alertCoral} />
                        <ThemedText weight="medium" style={[styles.dropdownItemText, styles.dropdownItemTextDelete]}>Delete</ThemedText>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
                {menuVisible === item.id && (
                  <TouchableOpacity
                    style={styles.menuBackdrop}
                    onPress={() => setMenuVisible(null)}
                    activeOpacity={1}
                  />
                )}
              </View>

              {/* Date */}
              <View style={styles.dateWithBadge}>
                <ThemedText weight="medium" style={styles.date}>{formattedDate}</ThemedText>
              </View>

              {/* Series Title or Devotional Title */}
              <ThemedText weight="semiBold" style={styles.devotionalTitle} numberOfLines={2}>{cleanTitle}</ThemedText>

              {/* Description */}
              {item.description && (
                <ThemedText style={styles.description} numberOfLines={2}>
                  {item.description.replace(/^CATEGORY:[^\n]*\n?/i, '')}
                </ThemedText>
              )}

              <View style={styles.progressBarContainer}>
                <View style={styles.progressHeader}>
                  <View style={styles.progressLabel}>
                    <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={16} color={Colors.secondaryText} style={styles.progressIcon} />
                    <ThemedText weight="semiBold" style={styles.progressLabelText}>Progress</ThemedText>
                  </View>
                  <ThemedText weight="medium" style={styles.dayCounter}>
                    {completedDays} of {item.totalDays} days completed
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
                      const nextDay = item.days[nextIdx];
                      // Calculate read time from all content: scripture, reflection, questions, prayer (~100 wpm for devotional reading)
                      const scriptureWords = nextDay.scripture?.text ? nextDay.scripture.text.trim().split(/\s+/).length : 0;
                      const reflectionWords = nextDay.reflection ? nextDay.reflection.trim().split(/\s+/).length : 0;
                      const questionsWords = nextDay.reflectionQuestions?.reduce((sum, q) => sum + (q.text ? q.text.trim().split(/\s+/).length : 0), 0) || 0;
                      const prayerWords = nextDay.prayer ? nextDay.prayer.trim().split(/\s+/).length : 0;
                      const totalWords = scriptureWords + reflectionWords + questionsWords + prayerWords;
                      const readTime = totalWords > 0 ? Math.max(1, Math.round(totalWords / 100)) : 0;
                      // For 1-day devotionals, don't show title, just "Day 1"
                      const isOneDay = item.totalDays === 1;
                      return (
                        <View style={styles.nextDayContentContainer}>
                          <ThemedText weight="bold" style={styles.nextDayLabel}>Next</ThemedText>
                          <ThemedText weight="medium" style={styles.nextDayTitle}>
                            Day {nextDay.dayNumber}{!isOneDay && `: ${nextDay.title}`}
                          </ThemedText>
                          <View style={styles.nextDayReadTimeContainer}>
                            <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.4)" style={styles.nextDayReadTimeIcon} />
                            <ThemedText style={styles.nextDayReadTime}>{readTime} min read</ThemedText>
                          </View>
                        </View>
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
      </View>
    );
  }, [triggerLightHaptic, handleDevotionalPress, handlePlaybookPress, filter]);

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

  // All devotionals sorted newest first (for date views)
  const allDevotionalsSorted = useMemo(() =>
    [...filteredDevotionals]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()),
    [filteredDevotionals],
  );

  const currentYear = new Date().getFullYear();

  // Weekly sections: group by year-week key, sorted newest first
  // RESPECT USER WEEK START SETTING - default to Sunday for now
  const weeklySections = useMemo(() => {
    const map = new Map<string, { label: string; weekStart: Date; devotionals: Devotional[] }>();
    allDevotionalsSorted.forEach(d => {
      const date = new Date(d.updatedAt || d.createdAt || 0);
      const dow = date.getDay(); // 0=Sunday
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - dow);
      weekStart.setHours(0, 0, 0, 0);
      const key = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
      if (!map.has(key)) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const isCurrentYear = weekStart.getFullYear() === currentYear;
        const label = `${format(weekStart, 'MMM d')} – ${format(weekEnd, isCurrentYear ? 'MMM d' : 'MMM d, yyyy')}`;
        map.set(key, { label, weekStart, devotionals: [] });
      }
      map.get(key)!.devotionals.push(d);
    });
    return Array.from(map.values()).sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  }, [allDevotionalsSorted, currentYear]);

  // Monthly sections: group by year-month, sorted newest first; showYear flags year-change rows
  const monthlySections = useMemo(() => {
    const map = new Map<string, { label: string; year: number; month: number; devotionals: Devotional[] }>();
    allDevotionalsSorted.forEach(d => {
      const date = new Date(d.updatedAt || d.createdAt || 0);
      const y = date.getFullYear();
      const m = date.getMonth();
      const key = `${y}-${m}`;
      if (!map.has(key)) {
        map.set(key, { label: format(date, 'MMMM'), year: y, month: m, devotionals: [] });
      }
      map.get(key)!.devotionals.push(d);
    });
    const sorted = Array.from(map.values()).sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
    // Compute showYear once per item so renderItem in FlatList doesn't need local state
    let lastSeenYear: number | null = null;
    return sorted.map(item => {
      const showYear = item.year !== currentYear && item.year !== lastSeenYear;
      if (item.year !== currentYear) { lastSeenYear = item.year; }
      return { ...item, showYear };
    });
  }, [allDevotionalsSorted, currentYear]);

  // Yearly sections: group by year, sorted newest first
  const yearlySections = useMemo(() => {
    const map = new Map<number, { year: number; devotionals: Devotional[] }>();
    allDevotionalsSorted.forEach(d => {
      const y = new Date(d.updatedAt || d.createdAt || 0).getFullYear();
      if (!map.has(y)) { map.set(y, { year: y, devotionals: [] }); }
      map.get(y)!.devotionals.push(d);
    });
    return Array.from(map.values()).sort((a, b) => b.year - a.year);
  }, [allDevotionalsSorted]);

  // Custom date range filtered devotionals
  const customDateDevotionals = useMemo(() => {
    const fromStart = new Date(customDateFrom); fromStart.setHours(0, 0, 0, 0);
    const toEnd = new Date(customDateTo); toEnd.setHours(23, 59, 59, 999);
    return allDevotionalsSorted.filter(d => {
      const date = new Date(d.updatedAt || d.createdAt || 0).getTime();
      return date >= fromStart.getTime() && date <= toEnd.getTime();
    });
  }, [allDevotionalsSorted, customDateFrom, customDateTo]);

  // Unified data array for the date-view FlatList — computed from the active mode
  type DateSectionItem = {
    key: string;
    category: string;
    devotionals: Devotional[];
    showYear: boolean;
    year?: number;
    isEmpty?: boolean;
  };
  const dateSectionItems = useMemo((): DateSectionItem[] => {
    switch (deferredDateViewMode) {
      case 'weekly':
        return weeklySections.map(s => ({
          key: `weekly-${s.weekStart.getTime()}`,
          category: s.label,
          devotionals: s.devotionals,
          showYear: false,
        }));
      case 'monthly':
        return monthlySections.map(s => ({
          key: `monthly-${s.year}-${s.month}`,
          category: s.label,
          devotionals: s.devotionals,
          showYear: s.showYear,
          year: s.year,
        }));
      case 'yearly':
        return yearlySections.map(s => ({
          key: `yearly-${s.year}`,
          category: s.year.toString(),
          devotionals: s.devotionals,
          showYear: false,
        }));
      case 'custom':
        return customDateDevotionals.length > 0 ? [{
          key: 'custom',
          category: 'Custom Range',
          devotionals: customDateDevotionals,
          showYear: false,
        }] : [];
      default:
        return [];
    }
  }, [deferredDateViewMode, weeklySections, monthlySections, yearlySections, customDateDevotionals]);

  // All devotionals grouped by category — both statuses, newest first per group
  // All unique categories the user actually has devotionals for
  const categorySections = useMemo(() => {
    const map = new Map<string, Devotional[]>();
    devotionals.forEach(d => {
      if (deferredFilter === 'ongoing' && d.completed) return;
      if (deferredFilter === 'completed' && !d.completed) return;
      const cat = d.category || 'Uncategorized';
      // If specific categories are selected, skip others
      if (deferredSelectedCategories.length > 0 && !deferredSelectedCategories.includes(cat)) return;
      if (!map.has(cat)) { map.set(cat, []); }
      map.get(cat)!.push(d);
    });
    const sections: { category: string; devotionals: Devotional[] }[] = [];
    map.forEach((devs, category) => {
      const sorted = [...devs].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      sections.push({ category, devotionals: sorted });
    });
    return sections.sort((a, b) => a.category.localeCompare(b.category));
  }, [devotionals, deferredFilter, deferredSelectedCategories]);

  // Sorting by updatedAt desc (fallback createdAt)
  const sortedDevotionals = useMemo(() => {
    return [...filteredDevotionals].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [filteredDevotionals]);


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
            <DevotionalCarouselSkeleton />
          </View>
        ) : contentView === 'all' ? (
          // All view: Continue devotionals carousel + Completed devotionals carousel
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContentPadding, scrollContentStyle]}
            scrollEnabled={!isTrulyEmpty}
            bounces={!isTrulyEmpty}
            onScroll={handleScroll}
            scrollEventThrottle={100}
          >
            {deferredFilter === 'ongoing' && (
              <CategoryCarouselRow
                category={`CONTINUE YOUR DEVOTIONAL${sortedDevotionals.length !== 1 ? 'S' : ''}`}
                items={sortedDevotionals}
                cardStyles={styles}
                renderItem={(item) => renderDevotionalItem({ item })}
                itemSize={ITEM_SIZE}
              />
            )}
            {deferredFilter === 'completed' && sortedDevotionals.length > 0 && (
              <CategoryCarouselRow
                category="COMPLETED DEVOTIONALS"
                items={sortedDevotionals}
                cardStyles={styles}
                renderItem={(item) => renderDevotionalItem({ item })}
                itemSize={ITEM_SIZE}
              />
            )}
            {sortedDevotionals.length === 0 && renderFilterEmptyState()}
            <View style={{ height: Math.max(insets.bottom, 8) + 80 }} />
          </ScrollView>
        ) : contentView === 'category' ? (
          // Category view: Horizontal carousels per category
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContentPadding, scrollContentStyle]}
            scrollEnabled={!isTrulyEmpty}
            bounces={!isTrulyEmpty}
            onScroll={handleScroll}
            scrollEventThrottle={100}
          >
            {categorySections.length === 0 ? (
              renderFilterEmptyState()
            ) : (
              <>
                <View style={{ paddingHorizontal: SIDE_INSET }}>
                  <ThemedText weight="bold" style={styles.carouselTitle}>
                    CONTINUE YOUR DEVOTIONAL{categorySections.reduce((total, section) => total + section.devotionals.length, 0) !== 1 ? 'S' : ''}
                  </ThemedText>
                </View>
                <View style={{ height: 32 }} />
                {categorySections.map(({ category, devotionals }) => (
                  <CategoryCarouselRow
                    key={category}
                    category={category}
                    items={devotionals}
                    cardStyles={styles}
                    renderItem={(item) => renderDevotionalItem({ item })}
                    itemSize={ITEM_SIZE}
                  />
                ))}
              </>
            )}
            <View style={{ height: Math.max(insets.bottom, 8) + 80 }} />
          </ScrollView>
        ) : (
          // Date view: FlatList with date sections
          <FlatList
            data={dateSectionItems}
            keyExtractor={(item) => item.key}
            renderItem={({ item }: { item: DateSectionItem }) => (
              <View>
                {item.showYear && item.year != null && (
                  <View style={styles.dateSectionYearHeader}>
                    <ThemedText weight="semiBold" style={styles.dateSectionYearText}>{item.year}</ThemedText>
                  </View>
                )}
                <CategoryCarouselRow
                  category={item.category}
                  items={item.devotionals}
                  cardStyles={styles}
                  renderItem={(devotional) => renderDevotionalItem({ item: devotional })}
                  itemSize={ITEM_SIZE}
                />
              </View>
            )}
            ListHeaderComponent={
              dateSectionItems.length > 0 ? (
                <View>
                  <View style={{ paddingHorizontal: SIDE_INSET }}>
                    <ThemedText weight="bold" style={styles.carouselTitle}>
                      CONTINUE YOUR DEVOTIONAL{dateSectionItems.reduce((total, section) => total + section.devotionals.length, 0) !== 1 ? 'S' : ''}
                    </ThemedText>
                  </View>
                  <View style={{ height: 32 }} />
                </View>
              ) : null
            }
            contentContainerStyle={[
              styles.listContentPadding,
              scrollContentStyle,
            ]}
            scrollEnabled={!isTrulyEmpty}
            bounces={!isTrulyEmpty}
            ListFooterComponent={<View style={{ height: Math.max(insets.bottom, 8) + 80 }} />}
            scrollIndicatorInsets={{ top: 0, bottom: Math.max(insets.bottom, 8) + 80, left: 0, right: 0 }}
            ListEmptyComponent={renderFilterEmptyState}
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
  devotionalCardContainer: {
    width: ITEM_WIDTH,
    marginRight: ITEM_SPACING,
    borderRadius: 26,
    overflow: 'hidden',
    minHeight: 200,
    backgroundColor: 'transparent',
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
    paddingHorizontal: SIDE_INSET,
    marginBottom: 12,
  },
  categorySectionTitle: {
    fontSize: 12,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  categorySectionCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categorySectionCountText: {
    fontSize: 11,
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
  },
  dateSectionYearHeader: {
    paddingHorizontal: SIDE_INSET,
    paddingTop: 24,
    paddingBottom: 4,
  },
  dateSectionYearText: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 0.5,
  },
  carouselTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  carouselTitle: {
    fontSize: 12,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
  },
  contentSheet: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
  },
  listContent: {
    paddingHorizontal: 0,
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
    width: '100%',
  },
  cardContent: {
    flex: 1,
  },
  gradientContainer: {
    height: 44,
    borderRadius: 14,
    marginBottom: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'linear-gradient(135deg, rgba(231, 238, 247, 0.2) 0%, rgba(219, 230, 244, 0.2) 45%, rgba(244, 239, 230, 0.2) 100%)',
    overflow: 'visible',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  categoryLabel: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
  categoryLabelText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.04,
    textTransform: 'uppercase',
    color: Colors.anchorBlue,
  },
  menuButton: {
    padding: 4,
    zIndex: 20,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    right: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 18,
    minWidth: 180,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    paddingVertical: 8,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownItemText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
  },
  dropdownItemTextDelete: {
    color: Colors.alertCoral,
  },
  gradientTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gradientPlaybookBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  gradientPlaybookIcon: {
    marginRight: 4,
  },
  gradientPlaybookText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
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
  date: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 0,
  },
  dateWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  devotionalTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 6,
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
  nextDayContentContainer: {
    gap: 2,
  },
  nextDayLabel: {
    fontSize: 13,
    color: Colors.holyGlow,
    fontWeight: 'bold',
  },
  nextDayTitle: {
    fontSize: 13,
    color: Colors.holyGlow,
    fontWeight: 'medium',
  },
  nextDayReadTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nextDayReadTimeIcon: {
    marginRight: 2,
  },
  nextDayReadTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  nextDayTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextDayValue: {
    fontSize: 13,
    color: Colors.holyGlow,
    fontWeight: 'medium',
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
    paddingHorizontal: SIDE_INSET, // gutters for section title and spacing
  },
  // FlatList should scroll edge-to-edge while cards have gutters
  carouselList: {
    marginHorizontal: -SIDE_INSET, // bleed the scrolling area to screen edges
  },
  carouselContent: {
    paddingHorizontal: SIDE_INSET, // gutters for first/last cards
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
