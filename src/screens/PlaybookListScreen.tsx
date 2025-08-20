import { useRef, useCallback, useState, useEffect, useMemo, createRef } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil } from 'lucide-react-native';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  SectionList,
  Animated,
  Pressable,
  TouchableOpacity,
  NativeModules,
} from 'react-native';

import { format } from 'date-fns';

import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import PlaybookCard from '../components/PlaybookCard';
import { Colors, Fonts } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import type { Playbook } from '../interfaces/playbook';
import { deletePlaybook, getPlaybooks } from '../services/apiIntegration';
import { useAuth } from '../context/IndustryStandardAuthContext';
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

  // Multiple fallback mechanisms for userId
  const userId = user?.id || session?.user?.id;

  // Subtle haptic feedback, gated by user preference
  const triggerLightHaptic = useCallback(() => {
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
  }, [user]);

  // Debug logging for user state
  console.log('[PlaybookListScreen] User state:', {
    hasUser: !!user,
    hasSession: !!session,
    isAuthenticated,
    userId,
    userKeys: user ? Object.keys(user) : [],
  });

  // Fetch playbooks from database using React Query with proper caching
  const { data: playbooks = [], isLoading, refetch, isFetching } = useQuery<Playbook[]>({
    queryKey: ['playbooks', userId],
    queryFn: () => {
      console.log('[PlaybookListScreen] Fetching playbooks for userId:', userId);
      return getPlaybooks(userId || '');
    },
    enabled: !!userId && isAuthenticated, // Only run when we have a valid userId and are authenticated
    staleTime: 2 * 60 * 1000, // 2 minutes - reduced for more frequent updates
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: false, // Disable automatic refetch on focus (we handle manually)
    retry: (failureCount, error) => {
      console.log('[PlaybookListScreen] Query retry attempt:', failureCount, error);
      return failureCount < 3;
    },
  });

  // Advanced prefetching for lightning-fast navigation
  const { prefetchVisiblePlaybooks } = useIntelligentPrefetching(userId || '');

  // Set filter to 'ongoing' by default to show in-progress playbooks first
  const [filter, setFilter] = useState<'all' | 'ongoing' | 'completed'>('ongoing');

  // Subtle selection animation for filter tabs
  const tabKeys = useMemo(() => (['all', 'ongoing', 'completed'] as const), []);
  const tabScales = useRef<Record<'all' | 'ongoing' | 'completed', Animated.Value>>({
    all: new Animated.Value(1),
    ongoing: new Animated.Value(1),
    completed: new Animated.Value(1),
  });

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
      console.error('Error initializing animations:', err);
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
      console.log('[PlaybookListScreen] Screen focused, userId:', userId, 'playbooks count:', playbooks.length);

      // Always reset to 'ongoing' (In Progress) tab when navigating to this screen
      console.log('[PlaybookListScreen] Resetting filter to ongoing (In Progress) tab');
      setFilter('ongoing');

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
          console.log('[PlaybookListScreen] Force refetching playbooks on focus');
          refetch();
        }
      }, 150);

      return () => clearTimeout(timer);
    });

    return () => {
      unsubscribe();
    };
  }, [navigation, playbooks.length, refetch, userId]);

  // Additional effect to handle userId changes and ensure data loading
  useEffect(() => {
    console.log('[PlaybookListScreen] Auth state changed:', {
      userId,
      isAuthenticated,
      isLoading,
      isFetching,
      playbooksCount: playbooks.length,
    });

    // If we have a userId and are authenticated but no playbooks and we're not currently loading, force a refetch
    if (userId && isAuthenticated && playbooks.length === 0 && !isLoading && !isFetching) {
      console.log('[PlaybookListScreen] No playbooks found, forcing refetch');
      const timer = setTimeout(() => {
        refetch();
      }, 100);

      return () => clearTimeout(timer);
    }

    // If we lost authentication, clear any cached data
    if (!isAuthenticated && playbooks.length > 0) {
      console.log('[PlaybookListScreen] User not authenticated, should clear data');
    }
  }, [userId, isAuthenticated, playbooks.length, isLoading, isFetching, refetch]);

  // React Query will automatically refetch when userId changes due to queryKey dependency

  // Filter and sort playbooks by completion status (simplified)
  const filteredPlaybooks = useMemo(() => {
    // Early return for empty playbooks
    if (!Array.isArray(playbooks) || playbooks.length === 0) {
      return [];
    }

    // Simple filtering logic
    const filtered = playbooks.filter(playbook => {
      if (!playbook?.actionSteps) {return false;}

      const { completed, total } = calculateTaskStats(playbook.actionSteps);
      const progress = total > 0 ? (completed / total) * 100 : 0;
      const isCompleted = progress >= 100;

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
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return sorted;
  }, [playbooks, filter]);

  // Intelligent prefetching: prefetch visible playbooks for instant navigation
  useEffect(() => {
    if (filteredPlaybooks.length > 0 && userId) {
      // Prefetch the first 5 visible playbooks for instant navigation
      const visiblePlaybookIds = filteredPlaybooks.slice(0, 5).map(p => p.id);
      prefetchVisiblePlaybooks(visiblePlaybookIds).catch(error => {
        console.warn('[PlaybookListScreen] Prefetching failed:', error);
      });
    }
  }, [filteredPlaybooks, userId, prefetchVisiblePlaybooks]);

  // (Remove any other filteredPlaybooks declarations below this point)

  // Group playbooks by month/year (optimized)
  const groupPlaybooksByMonth = useCallback((playbooksList: Playbook[] = []) => {
    try {
      const groups: { [key: string]: Playbook[] } = {};

      // Early return for empty or invalid input
      if (!Array.isArray(playbooksList) || playbooksList.length === 0) {
        return [];
      }

      // Group playbooks by month/year
      for (const pb of playbooksList) {
        // Skip invalid items
        if (!pb?.createdAt) {continue;}

        const date = new Date(pb.createdAt);
        if (isNaN(date.getTime())) {continue;}

        const key = formatDate(date);
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(pb);
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

      // Process in smaller chunks to avoid blocking
      return Object.entries(groups)
        .map(([title, data]) => {
          // Sort playbooks within each section
          const sortedData = [...data].sort((a, b) => {
            return getSortDate(b) - getSortDate(a);
          });

          return { title, data: sortedData };
        })
        .sort((a, b) => {
          // Sort sections by the most recent date in each section
          const getMostRecentDate = (items: Playbook[]) => {
            if (!items.length) {return 0;}
            return Math.max(...items.map(pb => getSortDate(pb)));
          };

          return getMostRecentDate(b.data) - getMostRecentDate(a.data);
        });
    } catch (err) {
      console.error('Error in groupPlaybooksByMonth:', err);
      return [];
    }
  }, [filter]);

  const sections = useMemo(() => {
    // Ensure filteredPlaybooks is an array before passing to groupPlaybooksByMonth
    const safeFilteredPlaybooks = Array.isArray(filteredPlaybooks) ? filteredPlaybooks : [];
    const result = groupPlaybooksByMonth(safeFilteredPlaybooks);

    return result;
  }, [filteredPlaybooks, groupPlaybooksByMonth]);

  const handleDelete = async (id: string) => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

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
            try {
              // Delete from database
              await deletePlaybook(id, user?.id || '');
              // Refresh the list after successful deletion
              await refetch();
            } catch (err) {
              console.error('Error deleting playbook:', err);
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

  const renderItem = ({ item, index }: { item: Playbook; index: number }) => {
    // Safety check for item
    if (!item || typeof item !== 'object') {
      console.warn('Invalid item in renderItem:', item);
      return null;
    }

    // Ensure a persistent ref for each row
    if (item.id && !rowRefs.current[item.id]) {
      rowRefs.current[item.id] = createRef();
    }

    // Safely handle cases where animatedValues.current might not be initialized yet
    const currentAnimatedValue = Array.isArray(animatedValues.current) ? animatedValues.current[index] : null;
    const translateY = currentAnimatedValue?.interpolate?.({
      inputRange: [0, 1],
      outputRange: [50, 0],
    }) || new Animated.Value(0);

    // Fix: Ensure opacity is always 1 if animation value is not available
    const opacity = currentAnimatedValue || new Animated.Value(1);

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
          renderRightActions={() => (
            <RectButton
              style={styles.deleteButton}
              onPress={() => { try { triggerLightHaptic(); } catch {}; handleDelete(item.id); }}
            >
              <Ionicons name="trash-outline" size={24} color="white" />
            </RectButton>
          )}
          rightThreshold={40}
          friction={2}
          overshootRight={false}
          containerStyle={styles.swipeableContainer}
        >
          <PlaybookCard
            playbook={item}
            onPress={() => handleCardPress(item)}
            style={styles.card}
          />
        </Swipeable>
      </Animated.View>
    );
  };

  // Debug logging for render states
  console.log('[PlaybookListScreen] Render state:', {
    userId,
    isLoading,
    isFetching,
    playbooksCount: playbooks.length,
    hasUserId: !!userId,
  });

  // Show loading state when we don't have a userId yet (auth loading) or not authenticated
  if (!userId || !isAuthenticated) {
    console.log('[PlaybookListScreen] No userId or not authenticated, showing loading state:', {
      userId: !!userId,
      isAuthenticated,
    });
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
    console.log('[PlaybookListScreen] Showing empty state');
    return (
      <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
        <View style={[styles.container, styles.containerEmpty]}>
          <View style={[styles.headerBar, { paddingTop: insets.top }]}>
            <View style={styles.pageInner}>
              {/* Hide header when empty; keep layout with spacer (match Devotionals) */}
              <View style={styles.headerSpacer} />
            </View>
          </View>

          {/* Empty state hero */}
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyHeroContainer}>
              <View style={styles.heroCard}>
              <MaterialCommunityIcons
                name="clipboard-text-play"
                size={32}
                color="rgba(255,255,255,0.8)"
                style={styles.heroIcon}
              />
              <Text style={styles.heroOverline}>No Playbooks</Text>
              <Text style={styles.heroTitle}>Create a New Playbook</Text>
              <Text style={styles.heroSubtitle}>
                Share what you're going through in detail. The more context, the better we can help.
              </Text>

              <TouchableOpacity
                onPress={() => { triggerLightHaptic(); navigation.navigate('UserInput'); }}
                activeOpacity={0.85}
                style={styles.heroOutlineButton}
              >
                <Pencil size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                <Text style={styles.heroOutlineButtonText}>Create a Playbook</Text>
              </TouchableOpacity>

                {/* Hint before bullets */}
                <Text style={styles.stepsHint}>Helpful details to include:</Text>

                {/* Guided steps */}
                <View style={styles.stepsContainer}>
                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
                  <Text style={styles.stepText}>What happened</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
                  <Text style={styles.stepText}>Your pain</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
                  <Text style={styles.stepText}>A situation or struggle</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>4</Text></View>
                  <Text style={styles.stepText}>A decision you need to make</Text>
                </View>
                </View>
                {/* Subtle deliverable hint below bullets */}
                <Text style={styles.stepsFootnote}>We’ll turn this into a personalized playbook.</Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
      <View style={styles.container}>
        <View style={[styles.headerBar, { paddingTop: insets.top }]}>
          <View style={styles.pageInner}>
            <Text style={styles.headerTitle}>Playbooks</Text>
          </View>
        </View>
        {/* Filter Tabs */}
        <View style={styles.pageInner}>
          <View style={[styles.filterTabs, { paddingLeft: 16, paddingRight: Math.max(insets.right, 16) }]}>
            {tabKeys.map((tab) => (
              <Pressable
                key={tab}
                style={[
                  styles.filterTab,
                  filter === tab && (
                    tab === 'completed'
                      ? styles.filterTabActiveCompleted
                      : tab === 'ongoing'
                        ? styles.filterTabActiveOngoing
                        : styles.filterTabActive
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
                  <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
                    {tab === 'all' ? 'All' : tab === 'ongoing' ? 'In Progress' : 'Completed'}
                  </Text>
                </Animated.View>
              </Pressable>
            ))}
          </View>
        </View>
        {isLoading || isFetching ? (
          <View style={[styles.listContent, styles.pageInner]}>
            <PlaybookSkeleton />
          </View>
        ) : sections.length === 0 ? (
          <View style={[styles.container, styles.containerEmpty]}>
            <View style={[styles.emptyStateContainer]}>
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
                  <Text style={styles.heroOverline}>{filter === 'ongoing' ? 'IN PROGRESS LIST' : 'COMPLETED LIST'}</Text>
                  <Text style={styles.heroTitle}>
                    {filter === 'ongoing' ? 'All your playbooks are completed' : 'No completed playbooks yet'}
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    {filter === 'ongoing'
                      ? 'Great job finishing your tasks. Review a completed playbook or start a new one.'
                      : 'Keep going! Your finished playbooks will appear here.'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { triggerLightHaptic(); navigation.navigate('UserInput'); }}
                    activeOpacity={0.85}
                    style={styles.heroOutlineButton}
                  >
                    <Pencil size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                    <Text style={styles.heroOutlineButtonText}>
                      {filter === 'ongoing' ? 'Create a Playbook' : 'Create a Playbook'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { triggerLightHaptic(); setFilter(filter === 'ongoing' ? 'completed' : 'ongoing'); }}
                    activeOpacity={0.85}
                    style={{ paddingVertical: 6, paddingHorizontal: 8 }}
                  >
                    <Text style={{ color: Colors.hopeWhite, opacity: 0.9 }}>
                      {filter === 'ongoing' ? 'Review Completed' : 'See In Progress'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <SectionList
            key={`${filter}-${sections.length}`}
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>{title}</Text></View>
            )}
            contentContainerStyle={[styles.listContent, styles.pageInner]}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            extraData={filter}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default PlaybookListScreen;

const createStyles = (theme: any) => StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  swipeableContainer: {
    width: '100%',
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    height: 88, // Fixed height to match card
    backgroundColor: theme.colors.primary, // Use theme primary color for instant switching
  },
  cardTouchable: {
    width: '100%',
  },
  deleteButton: {
    width: 60,
    backgroundColor: '#f87171',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: '100%',
    borderTopRightRadius: 16, // Match card's border radius
    borderBottomRightRadius: 16, // Match card's border radius
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.hopeWhite,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.hopeWhite,
  },
  pageInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
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
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: theme.colors.anchorBlue,
    marginBottom: 10,
    marginTop: 10,
    letterSpacing: 0.5,
    fontWeight: '800',
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
    backgroundColor: theme.colors.anchorBlue,
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
  heroOutlineButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  heroButtonIcon: {
    marginRight: 8,
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
    fontWeight: '600',
  },
  stepText: {
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  filterTabs: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
    gap: 2,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 6,
    backgroundColor: '#e8edf6',
    marginHorizontal: 2,
  },
  filterTabActive: {
    backgroundColor: Colors.anchorBlue,
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
    color: Colors.anchorBlue,
    letterSpacing: 0.2,
    fontWeight: '400',
  },
  filterTabTextActive: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
  },
  sectionHeader: {
    backgroundColor: '#f6f8fa',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 2,
  },
  sectionHeaderText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.anchorBlue,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: 'bold',
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
    fontWeight: '700',
    flexShrink: 1,
  },
  date: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.8,
    lineHeight: 14,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
});
