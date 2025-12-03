import { useRef, useCallback, useState, useEffect, useMemo, createRef } from 'react';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil } from 'lucide-react-native';
import {
  View,
  StyleSheet,
  Alert,
  SectionList,
  Animated,
  Pressable,
  TouchableOpacity,
  NativeModules,
  Image,
  PanResponder,
} from 'react-native';

import { format } from 'date-fns';

import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import PlaybookCard from '../components/PlaybookCard';
import DevotionalModal from '../components/DevotionalModal';
import BlueSheet from '../components/layout/BlueSheet';
import { Colors, Fonts } from '../theme';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import ThemedText from '../components/common/ThemedText';
import { useTheme } from '../theme/ThemeContext';
import type { Playbook } from '../interfaces/playbook';
import { deletePlaybook, getPlaybooks } from '../services/apiIntegration';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useQuery } from '@tanstack/react-query';
import { useIntelligentPrefetching } from '../services/hooks/useAdvancedPlaybookData';
import { PlaybookSkeleton } from '../components/SkeletonLoader/PlaybookSkeleton';

// Import gesture handler at the top level
import 'react-native-gesture-handler'; // This is needed for gesture handling

interface TaskStats {
  completed: number;
  total: number;
}

// Calculate completed and total tasks for a playbook's action steps (optimized)
export const calculateTaskStats = (actionSteps: any[] = []): TaskStats => {
  // Early return for empty or invalid input
  if (!Array.isArray(actionSteps) || actionSteps.length === 0) {
    return { completed: 0, total: 0 };
  }

  let completed = 0;
  let total = 0;

  for (const step of actionSteps) {
    if (!step) {continue;}

    if (Array.isArray(step.subTasks) && step.subTasks.length > 0) {
      // Count sub-tasks for steps that have them
      for (const subTask of step.subTasks) {
        if (subTask?.completed) {completed++;}
        total++;
      }
    } else {
      // Count regular steps that don't have sub-tasks
      if (step.completed) {completed++;}
      total++;
    }
  }

  return { completed, total };
};

/**
 * Formats a date into a human-readable month and year string
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string in 'Month YYYY' format (e.g., 'June 2023')
 */
const formatDate = (date: Date): string => {
  return format(date, 'MMMM yyyy');
};

const PlaybookListScreen = ({ navigation }: any) => {
  // Get user info with fallback mechanisms
  const { user, session, isAuthenticated } = useAuth();
  const theme = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  // Visible bar height excluding safe area bottom, plus a small cushion
  const bottomClearance = Math.max(12, Math.max(0, tabBarHeight - insets.bottom) + 12);

  // State for creating a devotional from a playbook via long-press
  const [devotionalModalVisible, setDevotionalModalVisible] = useState(false);
  const [selectedPlaybookForDevotional, setSelectedPlaybookForDevotional] = useState<Playbook | null>(null);

  // Multiple fallback mechanisms for userId
  const userId = user?.id || session?.user?.id;

  // Subtle haptic feedback, gated by user preference
  const triggerLightHaptic = useCallback(() => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) {return;}
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) {return;}
      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      }
    } catch {}
  }, [user]);

  // Logging for user state

  // Fetch playbooks from database using React Query with proper caching
  const { data: playbooks = [], isLoading, refetch, isFetching } = useQuery<Playbook[]>({
    queryKey: ['playbooks', userId, 'lightweight'],
    queryFn: () => {
      // Use lightweight mode for list view (80% data reduction)
      return getPlaybooks(userId || '', { lightweight: true });
    },
    enabled: !!userId && isAuthenticated, // Only run when we have a valid userId and are authenticated
    staleTime: 2 * 60 * 1000, // 2 minutes - reduced for more frequent updates
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: false, // Disable automatic refetch on focus (we handle manually)
    retry: (failureCount) => {

      return failureCount < 3;
    },
  });

  // Advanced prefetching for lightning-fast navigation
  const { prefetchVisiblePlaybooks } = useIntelligentPrefetching(userId || '');

  // Set filter to 'all' by default to show all playbooks
  const [filter, setFilter] = useState<'all' | 'ongoing' | 'completed'>('all');

  // Subtle selection animation for filter tabs
  const tabKeys = useMemo(() => (['all', 'ongoing', 'completed'] as const), []);
  const tabScales = useRef<Record<'all' | 'ongoing' | 'completed', Animated.Value>>({
    all: new Animated.Value(1),
    ongoing: new Animated.Value(1),
    completed: new Animated.Value(1),
  });

  // Floating Create a Playbook button animations (match Dashboard)
  const buttonWidth = useRef(new Animated.Value(56)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textWidth = textOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 180] });
  const fabPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const fabPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        fabPan.setOffset({ x: (fabPan as any).x._value || 0, y: (fabPan as any).y._value || 0 });
        fabPan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_evt, gesture) => {
        fabPan.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: () => {
        fabPan.flattenOffset();
      },
      onPanResponderTerminate: () => {
        fabPan.flattenOffset();
      },
    })
  ).current;

  const expandButton = useCallback(() => {
    let animationCount = 0;
    const maxAnimations = 2;
    const runAnimation = () => {
      if (animationCount >= maxAnimations) { return; }
      animationCount++;
      Animated.parallel([
        Animated.timing(buttonWidth, { toValue: 220, duration: 400, useNativeDriver: false }),
        Animated.timing(textOpacity, { toValue: 1, duration: 300, delay: 150, useNativeDriver: false }),
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(textOpacity, { toValue: 0, duration: 250, useNativeDriver: false }),
            Animated.timing(buttonWidth, { toValue: 56, duration: 350, useNativeDriver: false }),
          ]).start(() => {
            if (animationCount < maxAnimations) {
              setTimeout(() => { runAnimation(); }, 3000);
            }
          });
        }, 2500);
      });
    };
    runAnimation();
  }, [buttonWidth, textOpacity]);

  const handleTabPressIn = useCallback((tab: 'all' | 'ongoing' | 'completed') => {
    try {
      Animated.spring(tabScales.current[tab], {
        toValue: 0.96,
        useNativeDriver: true,
        speed: 20,
        bounciness: 0,
      }).start();
    } catch {}
  }, []);

  const handleTabPressOut = useCallback((tab: 'all' | 'ongoing' | 'completed') => {
    try {
      Animated.spring(tabScales.current[tab], {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 0,
      }).start();
    } catch {}
  }, []);

  // Component renders with current state

  // Refs
  const animatedValues = useRef<Animated.Value[]>([]);
  const rowRefs = useRef<{ [key: string]: any }>({});

  // Initialize animation values
  const initAnimations = (count: number) => {
    try {
      // Clear any existing animations
      if (animatedValues.current) {
        animatedValues.current.forEach(value => {
          if (value && typeof value.stopAnimation === 'function') {
            value.stopAnimation();
          }
        });
      }

      // Create new animated values
      const initialValues = Array(Math.max(0, count)).fill(0).map(() => new Animated.Value(0));
      animatedValues.current = initialValues;

      // Only start animations if we have values to animate
      if (initialValues.length > 0) {
        // Start animations after a small delay
        const timer = setTimeout(() => {
          const animations = initialValues.map((value, index) =>
            Animated.spring(value, {
              toValue: 1,
              useNativeDriver: true,
              delay: index * 100,
            })
          );
          Animated.stagger(100, animations).start();
        }, 100);

        return () => clearTimeout(timer);
      }

      return () => {}; // No-op cleanup function
    } catch (err) {
      Logger.error('Error initializing animations', err as Error, { component: 'PlaybookListScreen' });
      return () => {}; // Ensure we always return a cleanup function
    }
  };

  // Removed loadPlaybooksCallback - React Query handles data fetching automatically

  // Initialize animations on mount and when playbooks change
  useEffect(() => {
    if (playbooks.length > 0) {
      initAnimations(playbooks.length);
    }
  }, [playbooks.length]);

  // Reset animations when screen comes into focus and set to In Progress tab
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {

      // Don't reset filter - preserve user's selection when navigating back
      // setFilter('ongoing'); // REMOVED: This was resetting filter on every focus

      // Safely reset animation values if they exist
      if (animatedValues.current && Array.isArray(animatedValues.current)) {
        animatedValues.current.forEach(value => {
          if (value && typeof value.setValue === 'function') {
            value.setValue(0);
          }
        });
      }

      // Reinitialize animations after a short delay
      const timer = setTimeout(() => {
        if (playbooks.length > 0) {
          initAnimations(playbooks.length);
        }

        // Force refetch on focus to ensure fresh data
        // This bypasses React Query's stale time and ensures we always get fresh data
        if (userId) {

          refetch();
        }
        // Reset and run floating button expand animation
        buttonWidth.setValue(56);
        textOpacity.setValue(0);
        setTimeout(() => { expandButton(); }, 1000);
      }, 150);

      return () => clearTimeout(timer);
    });

    return () => {
      unsubscribe();
    };
  }, [navigation, playbooks.length, refetch, userId, buttonWidth, textOpacity, expandButton]);

  // Additional effect to handle userId changes and ensure data loading
  useEffect(() => {

    // If we have a userId and are authenticated but no playbooks and we're not currently loading, force a refetch
    if (userId && isAuthenticated && playbooks.length === 0 && !isLoading && !isFetching) {

      const timer = setTimeout(() => {
        refetch();
      }, 100);

      return () => clearTimeout(timer);
    }

    // If we lost authentication, clear any cached data
    if (!isAuthenticated && playbooks.length > 0) {

    }
  }, [userId, isAuthenticated, playbooks.length, isLoading, isFetching, refetch]);

  // React Query will automatically refetch when userId changes due to queryKey dependency

  // OPTIMIZED: Cache progress calculations to avoid recalculating on every filter change
  const playbooksWithProgress = useMemo(() => {
    if (!Array.isArray(playbooks) || playbooks.length === 0) {
      return [];
    }

    return playbooks.map(playbook => {
      if (!playbook?.actionSteps) {
        return { playbook, progress: 0, isCompleted: false };
      }

      const { completed, total } = calculateTaskStats(playbook.actionSteps);
      const progress = total > 0 ? (completed / total) * 100 : 0;
      const isCompleted = progress >= 100;

      return { playbook, progress, isCompleted };
    });
  }, [playbooks]);

  // Filter and sort playbooks by completion status (optimized with cached progress)
  const filteredPlaybooks = useMemo(() => {
    // Early return for empty playbooks
    if (playbooksWithProgress.length === 0) {
      return [];
    }

    // Simple filtering logic using cached progress
    const filtered = playbooksWithProgress.filter(({ isCompleted }) => {
      switch (filter) {
        case 'all':
          return true;
        case 'ongoing':
          return !isCompleted;
        case 'completed':
          return isCompleted;
        default:
          return false;
      }
    });

    // Sort by most recent
    const sorted = filtered.sort((a, b) => {
      const dateA = new Date(a.playbook.updatedAt || a.playbook.createdAt || 0).getTime();
      const dateB = new Date(b.playbook.updatedAt || b.playbook.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return sorted.map(({ playbook }) => playbook);
  }, [playbooksWithProgress, filter]);

  // Intelligent prefetching: prefetch visible playbooks for instant navigation
  useEffect(() => {
    if (filteredPlaybooks.length > 0 && userId) {
      // Prefetch the first 5 visible playbooks for instant navigation
      const visiblePlaybookIds = filteredPlaybooks.slice(0, 5).map(p => p.id);
      prefetchVisiblePlaybooks(visiblePlaybookIds).catch(error => {
        Logger.warn('[PlaybookListScreen] Prefetching failed', { component: 'PlaybookListScreen', data: error });
      });
    }
  }, [filteredPlaybooks, userId, prefetchVisiblePlaybooks]);

  // (Remove any other filteredPlaybooks declarations below this point)

  // Group playbooks by month/year (optimized)
  const groupPlaybooksByMonth = useCallback((playbooksList: Playbook[]) => {
    const groups: Record<string, Playbook[]> = {};

    try {
      if (!Array.isArray(playbooksList)) {
        return [];
      }

      // Helper function to get the most relevant date for sorting
      const getSortDate = (pb: Playbook) => {
        if (filter === 'completed' && pb.completedAt) {
          return new Date(pb.completedAt).getTime();
        }
        if (pb.updatedAt) {
          return new Date(pb.updatedAt).getTime();
        }
        return new Date(pb.createdAt || 0).getTime();
      };

      // First, sort all playbooks by date (newest first)
      const sortedPlaybooks = [...playbooksList]
        .filter(pb => pb?.createdAt) // Filter out playbooks without createdAt
        .sort((a, b) => getSortDate(b) - getSortDate(a)); // Sort by most recent first

      // Group the sorted playbooks by month/year
      for (const pb of sortedPlaybooks) {
        const date = new Date(pb.createdAt!);
        const key = formatDate(date);
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(pb);
      }

      // Convert to array of sections and sort them by the most recent playbook in each section
      return Object.entries(groups)
        .map(([title, data]) => ({
          title,
          data,
          // Get the most recent date in this section for sorting
          latestDate: Math.max(...data.map(pb => getSortDate(pb))),
        }))
        .sort((a, b) => b.latestDate - a.latestDate) // Sort sections by most recent first
        .map(({ title, data }) => ({ title, data })); // Remove the temporary latestDate property
    } catch (err) {
      Logger.error('Error in groupPlaybooksByMonth', err as Error, { component: 'PlaybookListScreen' });
      return [];
    }
  }, [filter]);

  const sections = useMemo(() => {
    const grouped = groupPlaybooksByMonth(filteredPlaybooks);
    return grouped
      .map(group => ({
        title: group.title,
        data: group.data,
      }))
      .filter(section => section.data.length > 0);
  }, [filteredPlaybooks, groupPlaybooksByMonth]);

  const isEmptyState = playbooks.length === 0 && !isLoading && !!userId;

  useScreenStatusBar(isEmptyState ? 'light' : 'auto', isEmptyState ? Colors.anchorBlue : undefined);

  const handleDelete = async (id: string) => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try { triggerLightHaptic(); } catch {}
    Alert.alert(
      'Delete Playbook',
      'Are you sure you want to delete this playbook?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try { triggerLightHaptic(); } catch {}
            try {
              // Delete from database
              await deletePlaybook(id, user?.id || '');
              // Refresh the list after successful deletion
              await refetch();
            } catch (err) {
              Logger.error('Error deleting playbook', err as Error, { component: 'PlaybookListScreen' });
              // If there was an error, reload the playbooks to restore the correct state
              await refetch();
              Alert.alert('Error', 'Failed to delete playbook. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Move handleCardPress outside of renderItem
  const handleCardPress = useCallback((playbook: Playbook) => {
    triggerLightHaptic();
    navigation.navigate('PlaybookDetail', { playbook });
  }, [navigation, triggerLightHaptic]);

  const handleCardLongPress = useCallback((playbook: Playbook) => {
    try { triggerLightHaptic(); } catch {}
    setSelectedPlaybookForDevotional(playbook);
    setDevotionalModalVisible(true);
  }, [triggerLightHaptic]);

  // OPTIMIZED: Memoize renderRightActions to avoid recreation
  const renderRightActions = useCallback((itemId: string) => () => (
    <RectButton
      style={styles.deleteButton}
      onPress={() => { try { triggerLightHaptic(); } catch {} handleDelete(itemId); }}
    >
      <Ionicons name="trash-outline" size={24} color="white" />
    </RectButton>
  ), [handleDelete, styles.deleteButton]);

  const renderItem = useCallback(({ item, index }: { item: Playbook; index: number }) => {
    // Safety check for item
    if (!item || typeof item !== 'object') {
      Logger.warn('Invalid item in renderItem', { component: 'PlaybookListScreen', data: item });
      return null;
    }

    // Ensure a persistent ref for each row
    if (item.id && !rowRefs.current[item.id]) {
      rowRefs.current[item.id] = createRef();
    }

    // FIXED: Reuse animated values, don't create new ones
    const currentAnimatedValue = Array.isArray(animatedValues.current) ? animatedValues.current[index] : null;
    const hasAnimation = currentAnimatedValue !== null && currentAnimatedValue !== undefined;
    const translateY = hasAnimation ? currentAnimatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [50, 0],
    }) : 0;

    const opacity = hasAnimation ? currentAnimatedValue : 1;

    return (
      <Animated.View
        style={[
          styles.swipeableContainer,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Swipeable
          ref={rowRefs.current[item.id]}
          onSwipeableWillOpen={() => { try { triggerLightHaptic(); } catch {} }}
          renderRightActions={renderRightActions(item.id)}
          rightThreshold={40}
          friction={2}
          overshootRight={false}
          enabled={true}
          containerStyle={styles.swipeableContainer}
        >
          <PlaybookCard
            playbook={item}
            onPress={() => handleCardPress(item)}
            onLongPress={() => handleCardLongPress(item)}
            style={styles.card}
          />
        </Swipeable>
      </Animated.View>
    );
  }, [handleCardPress, handleCardLongPress, renderRightActions, styles]);

  // Logging for render states

  // Show loading state when we don't have a userId yet (auth loading) or not authenticated
  if (!userId || !isAuthenticated) {

    return (
      <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
        <View style={styles.container}>
          <View style={[styles.listContent, styles.pageInner]}>
            <PlaybookSkeleton />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Show empty state when we have no playbooks and we're not in initial loading state
  // Allow isFetching to be true (for pull-to-refresh) as long as we're not in initial loading
  if (playbooks.length === 0 && !isLoading && userId) {

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.anchorBlue }]} edges={['left','right','bottom']}>
        <View style={[styles.container, styles.containerEmpty, { backgroundColor: Colors.anchorBlue }]}>
          <View style={[styles.headerBar, { paddingTop: insets.top, backgroundColor: Colors.anchorBlue }]}>
            <View style={styles.pageInner}>
              {/* Hide header when empty; keep layout with spacer (match Devotionals) */}
              <View style={styles.headerSpacer} />
            </View>
          </View>

          {/* Empty state hero on anchor blue background via BlueSheet */}
          <BlueSheet style={styles.contentSheet}>
            <View style={[styles.emptyStateContainer, styles.pageInner]}>
              <View style={styles.emptyHeroContainer}>
                <View style={styles.heroCard}>
              <MaterialCommunityIcons
                name="clipboard-text-play"
                size={32}
                color="rgba(255,255,255,0.8)"
                style={styles.heroIcon}
              />
              <ThemedText weight="semiBold" style={styles.heroOverline}>No Playbooks</ThemedText>
              <ThemedText weight="semiBold" style={styles.heroTitle}>Create a New Playbook</ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                Share what you're going through in detail. The more context, the better we can help.
              </ThemedText>

              <TouchableOpacity
                onPress={() => { triggerLightHaptic(); navigation.navigate('UserInput'); }}
                activeOpacity={0.85}
                style={styles.heroOutlineButton}
              >
                <Pencil size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                <ThemedText weight="medium" style={styles.heroOutlineButtonText}>Create a Playbook</ThemedText>
              </TouchableOpacity>

                {/* Hint before bullets */}
                <ThemedText weight="semiBold" style={styles.stepsHint}>Helpful details to include:</ThemedText>

                {/* Guided steps */}
                <View style={styles.stepsContainer}>
                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}><ThemedText weight="semiBold" style={styles.stepBadgeText}>1</ThemedText></View>
                  <ThemedText style={styles.stepText}>What happened</ThemedText>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}><ThemedText weight="semiBold" style={styles.stepBadgeText}>2</ThemedText></View>
                  <ThemedText style={styles.stepText}>Your pain</ThemedText>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}><ThemedText weight="semiBold" style={styles.stepBadgeText}>3</ThemedText></View>
                  <ThemedText style={styles.stepText}>A situation or struggle</ThemedText>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}><ThemedText weight="semiBold" style={styles.stepBadgeText}>4</ThemedText></View>
                  <ThemedText style={styles.stepText}>A decision you need to make</ThemedText>
                </View>
                </View>
                {/* Subtle deliverable hint below bullets */}
                <ThemedText weight="medium" style={styles.stepsFootnote}>We’ll turn this into a personalized playbook.</ThemedText>
                </View>
              </View>
            </View>
          </BlueSheet>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
      <View style={styles.container}>
        {/* Header on white background with tabs */}
        <View pointerEvents="box-none" style={[styles.headerBar, { paddingTop: insets.top }]}>
          <View style={styles.pageInner}>
            <ThemedText weight="bold" style={styles.headerTitle}>Playbooks</ThemedText>
            <View style={[styles.filterTabsOnWhite, { paddingRight: Math.max(insets.right, 16) }]}>
              {tabKeys.map((tab) => (
                <Pressable
                  key={tab}
                  style={[
                    styles.filterTabOnWhite,
                    filter === tab && (
                      tab === 'completed'
                        ? styles.filterTabActiveCompleted
                        : tab === 'ongoing'
                          ? styles.filterTabActiveOngoing
                          : styles.filterTabActiveOnWhite
                    ),
                  ]}
                  onPressIn={() => handleTabPressIn(tab)}
                  onPressOut={() => handleTabPressOut(tab)}
                  onPress={() => {
                    triggerLightHaptic();
                    setFilter(tab);
                  }}
                >
                  <Animated.View style={{ transform: [{ scale: tabScales.current[tab] }] }}>
                    <ThemedText
                      weight="semiBold"
                      style={[
                        styles.filterTabTextOnWhite,
                        filter === tab && styles.filterTabTextActiveOnWhite,
                      ]}
                    >
                      {tab === 'all' ? 'All' : tab === 'ongoing' ? 'In Progress' : 'Completed'}
                    </ThemedText>
                  </Animated.View>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Rounded content area standardized via BlueSheet (matches Journal) */}
        <BlueSheet style={styles.contentSheet}>

          {isLoading ? (
            <View style={[styles.listContent, styles.pageInner]}>
              <PlaybookSkeleton />
            </View>
          ) : filteredPlaybooks.length === 0 ? (
            <View style={[styles.containerEmpty]}>
              <View style={[styles.emptyStateContainer, styles.pageInner, styles.listContentPadding]}>
                <View style={styles.emptyHeroContainer}>
                  <View style={styles.heroCard}>
                    {filter === 'ongoing' ? (
                      <MaterialCommunityIcons
                        name="clipboard-text-clock"
                        size={32}
                        color="rgba(255,255,255,0.8)"
                        style={styles.heroIcon}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="trophy-outline"
                        size={32}
                        color="rgba(255,255,255,0.8)"
                        style={styles.heroIcon}
                      />
                    )}
                    <ThemedText weight="semiBold" style={styles.heroOverline}>{filter === 'ongoing' ? 'IN PROGRESS LIST' : 'COMPLETED LIST'}</ThemedText>
                    <ThemedText weight="semiBold" style={styles.heroTitle}>
                      {filter === 'ongoing' ? 'All your playbooks are completed' : 'No completed playbooks yet'}
                    </ThemedText>
                    <ThemedText style={styles.heroSubtitle}>
                      {filter === 'ongoing'
                        ? 'Great job finishing your tasks. Review a completed playbook or start a new one.'
                        : 'Keep going! Your finished playbooks will appear here.'}
                    </ThemedText>
                    {filter !== 'completed' && (
                      <TouchableOpacity
                        onPress={() => { triggerLightHaptic(); navigation.navigate('UserInput'); }}
                        activeOpacity={0.85}
                        style={styles.heroOutlineButton}
                      >
                        <Pencil size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                        <ThemedText weight="medium" style={styles.heroOutlineButtonText}>
                          Create a Playbook
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => { triggerLightHaptic(); setFilter(filter === 'ongoing' ? 'completed' : 'ongoing'); }}
                      activeOpacity={0.85}
                      style={styles.heroTextButton}
                    >
                      <ThemedText style={styles.heroLinkText}>
                        {filter === 'ongoing' ? 'Review Completed' : 'See In Progress'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <SectionList
              style={styles.sectionList}
              key={`${filter}-${sections.length}`}
              sections={sections}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              renderSectionHeader={({ section: { title } }) => (
                <View style={styles.sectionHeader}><ThemedText weight="bold" style={styles.sectionHeaderText}>{title}</ThemedText></View>
              )}
              contentContainerStyle={[
                styles.listContent,
                styles.pageInner,
                styles.listContentPadding,
              ]}
              ListFooterComponent={<View style={{ height: bottomClearance }} />}
              scrollIndicatorInsets={{ top: 0, bottom: bottomClearance, left: 0, right: 0 }}
              stickySectionHeadersEnabled
              showsVerticalScrollIndicator={false}
              bounces
              alwaysBounceVertical
              contentInsetAdjustmentBehavior="never"
              overScrollMode="always"
              removeClippedSubviews={false}
              keyboardShouldPersistTaps="handled"
              extraData={filter}
            />
          )}
        </BlueSheet>
        {/* Floating Create a Playbook button (same as Dashboard) */}
        <Animated.View
          style={[
            styles.floatingButton,
            { bottom: Math.max(110, bottomClearance + 70), right: Math.max(20, Math.max(insets.right, 20)) },
            { transform: [{ translateX: fabPan.x }, { translateY: fabPan.y }] },
          ]}
          {...fabPanResponder.panHandlers}
        >
          <Animated.View style={[styles.expandableButton, { width: buttonWidth }]}>
            <TouchableOpacity
              style={styles.expandableButtonTouchable}
              onPress={() => { triggerLightHaptic(); navigation.navigate('UserInput'); }}
              activeOpacity={0.8}
            >
              <View style={styles.fabIconContainer}>
                <Image
                  source={require('../../assets/icons/siFiaHeartWhiteTransparent.png')}
                  style={styles.floatingButtonIcon}
                  resizeMode="contain"
                  accessibilityLabel="siFia"
                />
              </View>
              <Animated.View style={{ opacity: textOpacity, width: textWidth }}>
                <ThemedText weight="semiBold" style={styles.expandText} numberOfLines={1}>
                  Create a Playbook
                </ThemedText>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
      {/* Devotional creation modal triggered by long-press on a playbook card */}
      <DevotionalModal
        visible={devotionalModalVisible}
        onClose={() => setDevotionalModalVisible(false)}
        playbookId={selectedPlaybookForDevotional?.id}
        userInput={selectedPlaybookForDevotional?.userInput}
        onDevotionalCreated={(devotionalId: string) => {
          setDevotionalModalVisible(false);
          navigation.navigate('DevotionalDetail' as any, { devotionalId });
        }}
      />
    </SafeAreaView>
  );
};

export default withErrorBoundary(PlaybookListScreen, 'PlaybookListScreen');

const createStyles = (_theme: any) => StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  swipeableContainer: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    height: 88, // Fixed height to match card
    backgroundColor: 'transparent', // Let page background show when swiping
  },
  cardTouchable: {
    width: '100%',
  },
  deleteButton: {
    width: 80,
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: '100%',
    borderRadius: 16, // Match Devotionals style
    marginLeft: 8,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  pageInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16, // Add responsive padding
  },
  containerEmpty: {
    // Remove default container padding so heroCard width matches Devotionals (90% of screen)
    paddingHorizontal: 0,
    paddingTop: 0,
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
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.anchorBlue,
    marginBottom: 8,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  // Additional layout styling applied on top of BlueSheet if needed
  contentSheet: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
  },
  floatingButton: {
    position: 'absolute',
    // bottom set dynamically in render using bottomClearance
    // right set dynamically to respect safe area
    zIndex: 10001,
    elevation: 10001,
  },
  expandableButton: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 28,
    height: 56,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignSelf: 'flex-end',
  },
  expandableButtonTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    minWidth: 56,
  },
  fabIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingButtonIcon: {
    width: 40,
    height: 40,
    alignSelf: 'center',
    tintColor: Colors.alertCoral,
  },
  expandText: {
    color: Colors.anchorBlue,
    fontSize: 14,
    marginLeft: 8,
    overflow: 'hidden',
    fontFamily: Fonts.semiBold,
  },
  headerSpacer: {
    height: 44,
    marginTop: 10,
    marginBottom: 10,
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
  // Empty state styles (mirroring Devotionals)
  emptyHeroContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    width: '90%',
    maxWidth: 720,
    backgroundColor: Colors.subtleOverlay,
    borderRadius: 34,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginHorizontal: 'auto', // Center the card
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
  },
  heroTitle: {
    fontSize: 18,
    textAlign: 'center',
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
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
  heroOutlineButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  heroButtonIcon: {
    marginRight: 8,
  },
  // Link-style text button below hero CTA
  heroTextButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  heroLinkText: {
    color: Colors.hopeWhite,
    opacity: 0.9,
  },
  stepsHint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  stepsFootnote: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  stepBadgeText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontFamily: Fonts.semiBold,
  },
  stepText: {
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 0, // Remove padding since pageInner handles it
    paddingBottom: 20,
  },
  // SectionList container and extra padding
  sectionList: {
    flex: 1,
  },
  listContentPadding: {
    paddingTop: 20,
    paddingBottom: 8,
  },
  filterTabs: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
    gap: 2,
    marginTop: 12,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 2,
  },
  filterTabActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterTabActiveCompleted: {
    backgroundColor: Colors.growthGreen,
  },
  filterTabActiveOngoing: {
    backgroundColor: Colors.alertCoral,
  },
  filterTabText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.hopeWhite,
    letterSpacing: 0.2,
  },
  filterTabTextActive: {
    color: Colors.hopeWhite,
  },
  // Header (on-white) tab styles
  filterTabsOnWhite: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
    gap: 6,
    flexWrap: 'wrap', // Allow tabs to wrap on smaller screens
  },
  filterTabOnWhite: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(3, 32, 61, 0.06)', // subtle anchor tint on white
  },
  filterTabActiveOnWhite: {
    backgroundColor: Colors.anchorBlue,
  },
  filterTabTextOnWhite: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.anchorBlue,
    letterSpacing: 0.2,
  },
  filterTabTextActiveOnWhite: {
    color: Colors.hopeWhite,
  },
  sectionHeader: {
    backgroundColor: '#2c4b77',
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
  },
  card: {
    marginBottom: 12,
  },
  cardContent: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    paddingVertical: 2,
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    lineHeight: 24,
    paddingVertical: 1,
    flexShrink: 1,
  },
  date: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.8,
    lineHeight: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
});
