import React, { useRef, useCallback, useState, useEffect, useMemo, createRef } from 'react';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  Dimensions,
  ScrollView,
  TextInput,
} from 'react-native';

import { format } from 'date-fns';
import { supabase } from '../services/supabaseClient';

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

import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useScroll } from '../context/ScrollContext';

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

// Helper function to determine category from playbook title/content
const getCategory = (playbook: Playbook): string => {
  const title = playbook.title?.toLowerCase() || '';
  const userInput = playbook.userInput?.toLowerCase() || '';
  const combined = `${title} ${userInput}`;

  if (combined.includes('love') || combined.includes('relationship') || combined.includes('family') || combined.includes('friend')) {
    return 'Relationships';
  }
  if (combined.includes('money') || combined.includes('finance') || combined.includes('financial') || combined.includes('debt')) {
    return 'Finance';
  }
  if (combined.includes('faith') || combined.includes('trust') || combined.includes('believe') || combined.includes('god') || combined.includes('prayer')) {
    return 'Faith';
  }
  if (combined.includes('peace') || combined.includes('anxiety') || combined.includes('worry') || combined.includes('stress')) {
    return 'Peace';
  }
  if (combined.includes('hope') || combined.includes('encouragement') || combined.includes('strength')) {
    return 'Hope';
  }
  if (combined.includes('wisdom') || combined.includes('decision') || combined.includes('guidance')) {
    return 'Wisdom';
  }
  if (combined.includes('forgive')) {
    return 'Forgiveness';
  }
  if (combined.includes('gratitude') || combined.includes('thank')) {
    return 'Gratitude';
  }
  if (combined.includes('purpose') || combined.includes('calling') || combined.includes('mission')) {
    return 'Purpose';
  }
  return 'Growth';
};

// Estimate reading time for a block of text at ~200 wpm
const estimateReadTime = (text: string): string => {
  if (!text) { return ''; }
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
};

// Derive per-section state from walkthrough_progress
// completed = Next was pressed on that step, viewed = user was there but didn't press Next,
// unreached = never got there
const getSectionState = (
  sectionStep: number,
  wp: number,
): 'completed' | 'viewed' | 'unreached' => {
  if (wp < 0) { return 'unreached'; } // not started — nothing is viewed or completed
  if (wp >= sectionStep) { return 'completed'; }
  if (wp + 1 === sectionStep) { return 'viewed'; }
  return 'unreached';
};

interface CarouselCardProps {
  item: Playbook; index: number; scrollX: Animated.Value;
  isMenuOpen: boolean; hasPrayed: boolean; hasRead: boolean; devotionalCount: number;
  cardStyles: any;
  onPress: (item: Playbook) => void; onLongPress: (item: Playbook) => void;
  onMenuToggle: (id: string | null) => void; onDelete: (id: string) => void;
  onRenamePress: (item: Playbook) => void; onTagPress: (item: Playbook) => void;
  onDevotionalPress: (item: Playbook) => void; triggerHaptic: () => void;
}
const CarouselCard = React.memo(({ item, index, scrollX, isMenuOpen, hasPrayed, hasRead, devotionalCount, cardStyles: st, onPress, onLongPress, onMenuToggle, onDelete, onRenamePress, onTagPress, onDevotionalPress, triggerHaptic }: CarouselCardProps) => {
  const ir = [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE];
  const scale      = useMemo(() => scrollX.interpolate({ inputRange: ir, outputRange: [0.96, 1, 0.96], extrapolate: 'clamp' }), [scrollX, index]);
  const opacity    = useMemo(() => scrollX.interpolate({ inputRange: ir, outputRange: [0.9, 1, 0.9],   extrapolate: 'clamp' }), [scrollX, index]);
  const translateY = useMemo(() => scrollX.interpolate({ inputRange: ir, outputRange: [2, 0, 2],       extrapolate: 'clamp' }), [scrollX, index]);
  const { completed, total } = useMemo(() => calculateTaskStats(item.actionSteps), [item.actionSteps]);
  const category    = useMemo(() => getCategory(item), [item.title, item.userInput]);
  const tilReadTime = useMemo(() => estimateReadTime((item.truthInLove as any)?.text || ''), [item.truthInLove]);
  const isCardCompleted = item.status === 'completed';
  const wp = item.walkthroughProgress ?? -1;
  return (
    <TouchableOpacity style={st.carouselCardTouch} onPress={() => onPress(item)} onLongPress={() => onLongPress(item)} activeOpacity={0.85}>
      <Animated.View style={[st.carouselCard, { transform: [{ scale }, { translateY }], opacity }]}>
        <View style={st.gradientContainer}>
          <View style={st.categoryLabel}><ThemedText weight="bold" style={st.categoryLabelText}>{category}</ThemedText></View>
          <TouchableOpacity style={st.menuButton} onPress={() => { try { triggerHaptic(); } catch {} onMenuToggle(isMenuOpen ? null : item.id); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255, 255, 255, 0.7)" />
          </TouchableOpacity>
          {isMenuOpen && (
            <View style={st.dropdownMenu}>
              <TouchableOpacity style={st.dropdownItem} onPress={() => { try { triggerHaptic(); } catch {} onRenamePress(item); }}><ThemedText style={st.dropdownItemText}>Rename</ThemedText></TouchableOpacity>
              <TouchableOpacity style={st.dropdownItem} onPress={() => { try { triggerHaptic(); } catch {} onTagPress(item); }}>
                <View style={st.dropdownItemContent}><ThemedText style={st.dropdownItemText}>Tag</ThemedText>{item.tag && <View style={st.dropdownBadge}><ThemedText style={st.dropdownBadgeText}>{item.tag}</ThemedText></View>}</View>
              </TouchableOpacity>
              <TouchableOpacity style={st.dropdownItem} onPress={() => { try { triggerHaptic(); } catch {} onDevotionalPress(item); }}>
                <View style={st.dropdownItemContent}>
                  <ThemedText style={st.dropdownItemText}>Turn into devotional</ThemedText>
                  {devotionalCount > 0 && <View style={st.dropdownBadge}><MaterialCommunityIcons name="book" size={10} color={Colors.hopeWhite} />{devotionalCount >= 2 && <ThemedText style={st.dropdownBadgeText}>{devotionalCount}</ThemedText>}</View>}
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={st.dropdownItem} onPress={() => { try { triggerHaptic(); } catch {} onMenuToggle(null); onDelete(item.id); }}><ThemedText style={[st.dropdownItemText, st.dropdownItemTextDelete]}>Delete</ThemedText></TouchableOpacity>
            </View>
          )}
          {isMenuOpen && <TouchableOpacity style={st.menuBackdrop} onPress={() => onMenuToggle(null)} activeOpacity={1} />}
        </View>
        <View style={st.dateWithBadge}>
          {isCardCompleted && item.completedAt ? (
            <ThemedText style={[st.carouselDate, st.completedDate]}>Completed {format(new Date(item.completedAt), new Date(item.completedAt).getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy')}</ThemedText>
          ) : item.updatedAt ? (
            <ThemedText style={st.carouselDate}>{format(new Date(item.updatedAt), new Date(item.updatedAt).getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy')}</ThemedText>
          ) : null}
        </View>
        <ThemedText weight="semiBold" style={st.carouselCardTitle}>{item.title}</ThemedText>
        {item.userInput && <ThemedText style={st.carouselCardDescription} numberOfLines={3}>{item.userInput}</ThemedText>}
        {isCardCompleted ? (
          <View style={st.completedSummary}><Ionicons name="checkmark-circle" size={14} color={Colors.growthGreen} /><ThemedText style={st.completedSummaryText}>{completed} of {total} faithful actions acted on</ThemedText></View>
        ) : (
          <View style={st.sectionsContainer}>
            {([
              { label: 'Intro', step: 0 },
              { label: 'Truth in Love', step: 1, meta: tilReadTime, metaIcon: 'time-outline' },
              { label: 'Scripture to Anchor', step: 2 },
              { label: 'Faithful Actions', step: 3, meta: total > 0 ? `${completed} of ${total} acted on` : undefined },
              { label: 'Prayer', step: 4, metaIcon: 'pray-outline', actionIcon: 'hands-pray', actionIconType: 'material', actionIconState: hasPrayed },
              { label: 'Words to Speak', step: 5, metaIcon: 'volume-high-outline', actionIcon: 'chatbubble-ellipses-outline', actionIconType: 'ionicons', actionIconState: hasRead },
            ] as any[]).map(({ label, step, meta, metaIcon, actionIcon, actionIconType, actionIconState }) => {
              const state = getSectionState(step, wp);
              return (
                <View key={label} style={st.sectionItem}>
                  <View style={[st.statusPill, state === 'completed' && st.statusPillCompleted, state === 'viewed' && st.statusPillViewed, state === 'unreached' && st.statusPillUnreached]}>
                    {state === 'completed' ? <View style={[st.statusPillFill, st.statusPillFillCompleted]} /> : <ThemedText style={[st.statusPillText, state === 'viewed' && st.statusPillTextViewed, state === 'unreached' && st.statusPillTextUnreached]}>{state === 'viewed' ? '◐' : '○'}</ThemedText>}
                  </View>
                  <View style={st.sectionContent}>
                    <ThemedText style={[st.sectionLabel, state === 'unreached' && st.sectionLabelMuted]}>{label}</ThemedText>
                    {meta && <View style={st.sectionMetaContainer}>{metaIcon && <Ionicons name={metaIcon as any} size={12} color={'rgba(255,255,255,0.4)'} style={st.sectionMetaIcon} />}<ThemedText style={[st.sectionInfo, state !== 'completed' && st.sectionInfoMuted]}>{meta}</ThemedText></View>}
                    {actionIcon && !meta && (actionIconType === 'ionicons' ? <Ionicons name={actionIcon as any} size={14} color={actionIconState ? Colors.alertCoral : 'rgba(255,255,255,0.4)'} style={st.sectionActionIcon} /> : <MaterialCommunityIcons name={actionIcon as any} size={14} color={actionIconState ? Colors.alertCoral : 'rgba(255,255,255,0.4)'} style={st.sectionActionIcon} />)}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

const PlaybookListScreen = ({ navigation }: any) => {
  // Get user info with fallback mechanisms
  const { user, session, isAuthenticated } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { setShowTabBar } = useScroll();
  const tabBarCollapsedRef = useRef(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  // Visible bar height excluding safe area bottom, plus a small cushion
  const bottomClearance = Math.max(12, Math.max(0, tabBarHeight - insets.bottom) + 12);

  // State for creating a devotional from a playbook via long-press
  const [devotionalModalVisible, setDevotionalModalVisible] = useState(false);
  const [selectedPlaybookForDevotional, setSelectedPlaybookForDevotional] = useState<Playbook | null>(null);

  // State for rename playbook
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedPlaybookForRename, setSelectedPlaybookForRename] = useState<Playbook | null>(null);
  const [newTitle, setNewTitle] = useState('');

  // State for tag playbook
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [selectedPlaybookForTag, setSelectedPlaybookForTag] = useState<Playbook | null>(null);
  const [selectedTag, setSelectedTag] = useState('');
  const [customTag, setCustomTag] = useState('');

  // Predefined tags
  const predefinedTags = [
    'Relationships',
    'Marriage',
    'Family',
    'Conflict',
    'Peace',
    'Career',
    'Work',
    'Finance',
    'Growth',
    'Health',
    'Spiritual',
    'Custom',
  ];

  // Multiple fallback mechanisms for userId
  const userId = user?.id || session?.user?.id;

  // Subtle haptic feedback, gated by user preference
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

  // Always expand tab bar when returning to this screen
  useFocusEffect(
    useCallback(() => {
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);
    }, [setShowTabBar])
  );

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

  // Stable ref for playbook IDs to avoid recreating callback on every query update
  const playbookIdsRef = useRef<string[]>([]);
  useEffect(() => {
    playbookIdsRef.current = playbooks.map(p => p.id);
  }, [playbooks]);

  // Throttle session state loads — only reload if >5s have passed (avoids N AsyncStorage reads on every tab press)
  const lastSessionLoadRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastSessionLoadRef.current < 5000) { return; }
      const ids = playbookIdsRef.current;
      if (ids.length === 0) { return; }
      lastSessionLoadRef.current = now;
      const loadAll = async () => {
        const entries: Record<string, { hasPrayed: boolean; hasRead: boolean }> = {};
        await Promise.all(
          ids.map(async (id) => {
            try {
              const raw = await AsyncStorage.getItem(`playbook_session_${id}`);
              if (raw) {
                const sess = JSON.parse(raw);
                entries[id] = {
                  hasPrayed: sess.hasPrayed ?? false,
                  hasRead: sess.hasRead ?? false,
                };
              }
            } catch (_) {}
          })
        );
        setSessionStates(entries);
      };
      loadAll();
    }, [])
  );

  // Handle rename playbook
  const handleRenamePlaybook = useCallback(async () => {
    if (!selectedPlaybookForRename || !newTitle.trim()) return;

    try {
      triggerLightHaptic();
      const { error } = await supabase
        .from('playbooks')
        .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
        .eq('id', selectedPlaybookForRename.id);

      if (error) throw error;

      // Refetch to update data
      refetch();

      setRenameModalVisible(false);
      setNewTitle('');
      setSelectedPlaybookForRename(null);
    } catch (err) {
      Logger.error('Error renaming playbook', err as Error, { component: 'PlaybookListScreen' });
      Alert.alert('Error', 'Failed to rename playbook. Please try again.');
    }
  }, [selectedPlaybookForRename, newTitle, triggerLightHaptic, refetch]);

  // Handle tag playbook
  const handleTagPlaybook = useCallback(async () => {
    if (!selectedPlaybookForTag) return;

    const finalTag = selectedTag === 'Custom' ? customTag.trim() : selectedTag;
    if (!finalTag) return;

    try {
      triggerLightHaptic();
      const { error } = await supabase
        .from('playbooks')
        .update({ tag: finalTag, updated_at: new Date().toISOString() })
        .eq('id', selectedPlaybookForTag.id);

      if (error) throw error;

      // Refetch to update data
      refetch();

      setTagModalVisible(false);
      setSelectedTag('');
      setCustomTag('');
      setSelectedPlaybookForTag(null);
    } catch (err) {
      Logger.error('Error tagging playbook', err as Error, { component: 'PlaybookListScreen' });
      Alert.alert('Error', 'Failed to tag playbook. Please try again.');
    }
  }, [selectedPlaybookForTag, selectedTag, customTag, triggerLightHaptic, refetch]);

  // Set filter to 'all' by default to show all playbooks
  const [filter, setFilter] = useState<'all' | 'ongoing' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);
  const [devotionalsCount, setDevotionalsCount] = useState<Record<string, number>>({});
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [sessionStates, setSessionStates] = useState<Record<string, { hasPrayed: boolean; hasRead: boolean }>>({});

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

  const toggleSearch = useCallback(() => {
    const opening = !showSearch;
    setShowSearch(opening);
    Animated.spring(searchAnim, {
      toValue: opening ? 1 : 0,
      tension: 65,
      friction: 14,
      useNativeDriver: false,
    }).start(() => {
      if (opening) {
        searchInputRef.current?.focus();
      }
    });
    if (!opening) {
      setSearchQuery('');
    }
  }, [showSearch, searchAnim]);

  // Component renders with current state

  // Refs
  const rowRefs = useRef<{ [key: string]: any }>({});


  // Removed loadPlaybooksCallback - React Query handles data fetching automatically

  // DISABLED: Entrance animations cause ghosting/fading during data updates
  // Since we've optimized data loading to be instant, animations are unnecessary
  // const hasInitializedAnimations = useRef(false);
  // useEffect(() => {
  //   if (playbooks.length > 0 && !hasInitializedAnimations.current) {
  //     hasInitializedAnimations.current = true;
  //     initAnimations(playbooks.length);
  //   }
  // }, [playbooks.length]);

  // Set to In Progress tab on focus; React Query staleTime handles background refetching automatically
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setFilter('ongoing'); // React bails out (no re-render) when value is already 'ongoing'
    });
    return () => { unsubscribe(); };
  }, [navigation]);

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
      // Completion is driven by the status field (Save & Finish pressed), not action step math
      const isCompleted = playbook.status === 'completed';

      return { playbook, progress, isCompleted };
    });
  }, [playbooks]);

  // Fetch devotionals count for each playbook — stable dep: playbooks.length, not the full array ref
  const playbooksLengthRef = useRef(0);
  useEffect(() => {
    if (!userId || playbooks.length === 0) return;
    if (playbooks.length === playbooksLengthRef.current && Object.keys(devotionalsCount).length > 0) return;
    playbooksLengthRef.current = playbooks.length;

    const fetchDevotionalsCount = async () => {
      try {
        const { data: devotionals, error } = await supabase
          .from('devotionals')
          .select('playbook_id')
          .eq('user_id', userId);

        if (error) throw error;

        const counts: Record<string, number> = {};
        devotionals?.forEach((devotional: any) => {
          if (devotional.playbook_id) {
            counts[devotional.playbook_id] = (counts[devotional.playbook_id] || 0) + 1;
          }
        });

        setDevotionalsCount(counts);
      } catch (err) {
        Logger.error('Error fetching devotionals count', err as Error, { component: 'PlaybookListScreen' });
      }
    };

    fetchDevotionalsCount();
  }, [userId, playbooks.length]);

  // Filter and sort playbooks by completion status and search query (optimized with cached progress)
  const filteredPlaybooks = useMemo(() => {
    // Early return for empty playbooks
    if (playbooksWithProgress.length === 0) {
      return [];
    }

    // Simple filtering logic using cached progress
    const filtered = playbooksWithProgress.filter(({ isCompleted, playbook }) => {
      // Filter by completion status
      switch (filter) {
        case 'all':
          break;
        case 'ongoing':
          if (isCompleted) return false;
          break;
        case 'completed':
          if (!isCompleted) return false;
          break;
        default:
          return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const title = playbook.title?.toLowerCase() || '';
        const userInput = playbook.userInput?.toLowerCase() || '';
        return title.includes(query) || userInput.includes(query);
      }

      return true;
    });

    // Sort by most recent
    const sorted = filtered.sort((a, b) => {
      const dateA = new Date(a.playbook.updatedAt || a.playbook.createdAt || 0).getTime();
      const dateB = new Date(b.playbook.updatedAt || b.playbook.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return sorted.map(({ playbook }) => playbook);
  }, [playbooksWithProgress, filter, searchQuery]);

  // Intelligent prefetching: prefetch visible playbooks for instant navigation
  useEffect(() => {
    if (filteredPlaybooks.length > 0 && userId) {
      // ENTERPRISE-GRADE: Defer prefetching to after navigation transition completes
      const raf = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: (time?: number) => void) => setTimeout(() => cb(), 16);
      raf(() => {
        const visiblePlaybookIds = filteredPlaybooks.slice(0, 5).map(p => p.id);
        prefetchVisiblePlaybooks(visiblePlaybookIds).catch(error => {
          Logger.warn('[PlaybookListScreen] Prefetching failed', { component: 'PlaybookListScreen', data: error });
        });
      });
    }
  }, [filteredPlaybooks, userId, prefetchVisiblePlaybooks]);

  // (Remove any other filteredPlaybooks declarations below this point)

  const isEmptyState = playbooks.length === 0 && !isLoading && !!userId;

  useScreenStatusBar(isEmptyState ? 'light' : 'auto', isEmptyState ? Colors.anchorBlue : undefined);

  const handleDelete = useCallback(async (id: string) => {
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
  }, [userId, triggerLightHaptic, user?.id, refetch]);

  // Move handleCardPress outside of renderItem
  const handleCardPress = useCallback((playbook: Playbook) => {
    // Don't navigate if menu is open for this card
    if (menuVisible === playbook.id) {
      setMenuVisible(null);
      return;
    }
    triggerLightHaptic();
    navigation.navigate('PlaybookWalkthrough', { playbook });
  }, [navigation, triggerLightHaptic, menuVisible]);

  const handleCardLongPress = useCallback((playbook: Playbook) => {
    try { triggerLightHaptic(); } catch {}
    setSelectedPlaybookForDevotional(playbook);
    setDevotionalModalVisible(true);
  }, [triggerLightHaptic]);

  // OPTIMIZED: Memoize renderRightActions to avoid recreation
  // eslint-disable-next-line react/no-unstable-nested-components
  const renderRightActions = useCallback((itemId: string) => () => (
    <RectButton
      style={styles.deleteButton}
      onPress={() => { try { triggerLightHaptic(); } catch {} handleDelete(itemId); }}
    >
      <Ionicons name="trash-outline" size={24} color="white" />
    </RectButton>
  ), [handleDelete, styles.deleteButton, triggerLightHaptic]);

  const handleRenamePress = useCallback((item: Playbook) => {
    setMenuVisible(null); setSelectedPlaybookForRename(item); setRenameModalVisible(true);
  }, []);
  const handleTagPress = useCallback((item: Playbook) => {
    setMenuVisible(null); setSelectedPlaybookForTag(item); setTagModalVisible(true);
  }, []);
  const handleDevotionalPress = useCallback((pb: Playbook) => {
    setMenuVisible(null); handleCardLongPress(pb);
  }, [handleCardLongPress]);

  const renderItem = useCallback(({ item, index }: { item: Playbook; index: number }) => {
    // Safety check for item
    if (!item || typeof item !== 'object') {
      Logger.warn('Invalid item in renderItem', { component: 'PlaybookListScreen', data: item });
      return null;
    }

    const inputRange = [
      (index - 1) * ITEM_SIZE,
      index * ITEM_SIZE,
      (index + 1) * ITEM_SIZE,
    ];
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.96, 1, 0.96],
      extrapolate: 'clamp',
    });
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });
    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [2, 0, 2],
      extrapolate: 'clamp',
    });

    // Calculate progress
    const { completed, total } = calculateTaskStats(item.actionSteps);
    const progress = total > 0 ? (completed / total) * 100 : 0;
    const category = getCategory(item);
    const isCardCompleted = item.status === 'completed';
    const wp = item.walkthroughProgress ?? -1; // -1 = not started, 0–5 = last completed step
    const tilReadTime = estimateReadTime((item.truthInLove as any)?.text || '');

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.carouselCardTouch}
        onPress={() => handleCardPress(item)}
        onLongPress={() => handleCardLongPress(item)}
        activeOpacity={0.85}
      >
        <Animated.View
          style={[
            styles.carouselCard,
            { transform: [{ scale }, { translateY }], opacity },
          ]}
        >
          <View style={styles.gradientContainer}>
            <View style={styles.categoryLabel}>
              <ThemedText weight="bold" style={styles.categoryLabelText}>{category}</ThemedText>
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
                  style={styles.dropdownItem}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    setMenuVisible(null);
                    setSelectedPlaybookForRename(item);
                    setRenameModalVisible(true);
                  }}
                >
                  <ThemedText style={styles.dropdownItemText}>Rename</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    setMenuVisible(null);
                    setSelectedPlaybookForTag(item);
                    setTagModalVisible(true);
                  }}
                >
                  <View style={styles.dropdownItemContent}>
                    <ThemedText style={styles.dropdownItemText}>Tag</ThemedText>
                    {item.tag && (
                      <View style={styles.dropdownBadge}>
                        <ThemedText style={styles.dropdownBadgeText}>{item.tag}</ThemedText>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    setMenuVisible(null);
                    handleCardLongPress(item);
                  }}
                >
                  <View style={styles.dropdownItemContent}>
                    <ThemedText style={styles.dropdownItemText}>Turn into devotional</ThemedText>
                    {devotionalsCount[item.id] > 0 && (
                      <View style={styles.dropdownBadge}>
                        <MaterialCommunityIcons name="book" size={10} color={Colors.hopeWhite} />
                        {devotionalsCount[item.id] >= 2 && (
                          <ThemedText style={styles.dropdownBadgeText}>{devotionalsCount[item.id]}</ThemedText>
                        )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    setMenuVisible(null);
                    handleDelete(item.id);
                  }}
                >
                  <ThemedText style={[styles.dropdownItemText, styles.dropdownItemTextDelete]}>Delete</ThemedText>
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

          <View style={styles.dateWithBadge}>
            {/* Completed cards show completion date; others show last updated date */}
            {isCardCompleted && item.completedAt ? (
              <ThemedText style={[styles.carouselDate, styles.completedDate]}>
                Completed {format(new Date(item.completedAt), new Date(item.completedAt).getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy')}
              </ThemedText>
            ) : item.updatedAt ? (
              <ThemedText style={styles.carouselDate}>
                {format(new Date(item.updatedAt), new Date(item.updatedAt).getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy')}
              </ThemedText>
            ) : null}
          </View>

          <ThemedText weight="semiBold" style={styles.carouselCardTitle}>
            {item.title}
          </ThemedText>

          {item.userInput && (
            <ThemedText style={styles.carouselCardDescription} numberOfLines={3}>
              {item.userInput}
            </ThemedText>
          )}

          {/* Completed card: hide step sections, show action count summary */}
          {isCardCompleted ? (
            <View style={styles.completedSummary}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.growthGreen} />
              <ThemedText style={styles.completedSummaryText}>
                {completed} of {total} faithful actions acted on
              </ThemedText>
            </View>
          ) : (
            /* All non-completed cards show sections — ✓/◐/○ based on walkthroughProgress */
            <View style={styles.sectionsContainer}>
              {([
                { label: 'Intro',               step: 0 },
                { label: 'Truth in Love',        step: 1, meta: tilReadTime, metaIcon: 'time-outline' },
                { label: 'Scripture to Anchor',  step: 2 },
                { label: 'Faithful Actions',     step: 3, meta: total > 0 ? `${completed} of ${total} acted on` : undefined },
                { label: 'Prayer',               step: 4, metaIcon: 'pray-outline', actionIcon: 'hands-pray', actionIconType: 'material', actionIconState: sessionStates[item.id]?.hasPrayed },
                { label: 'Words to Speak',       step: 5, metaIcon: 'volume-high-outline', actionIcon: 'chatbubble-ellipses-outline', actionIconType: 'ionicons', actionIconState: sessionStates[item.id]?.hasRead },
              ] as { label: string; step: number; meta?: string; metaIcon?: string; actionIcon?: string; actionIconType?: 'material' | 'ionicons'; actionIconState?: boolean }[]).map(({ label, step, meta, metaIcon, actionIcon, actionIconType, actionIconState }) => {
                const state = getSectionState(step, wp);
                return (
                  <View key={label} style={styles.sectionItem}>
                    <View style={[
                      styles.statusPill,
                      state === 'completed' && styles.statusPillCompleted,
                      state === 'viewed'    && styles.statusPillViewed,
                      state === 'unreached' && styles.statusPillUnreached,
                    ]}>
                      {state === 'completed' ? (
                        <View style={[
                          styles.statusPillFill,
                          state === 'completed' && styles.statusPillFillCompleted,
                        ]} />
                      ) : (
                        <ThemedText style={[
                          styles.statusPillText,
                          state === 'viewed'    && styles.statusPillTextViewed,
                          state === 'unreached' && styles.statusPillTextUnreached,
                        ]}>
                          {state === 'viewed' ? '◐' : '○'}
                        </ThemedText>
                      )}
                    </View>
                    <View style={styles.sectionContent}>
                      <ThemedText style={[
                        styles.sectionLabel,
                        state === 'unreached' && styles.sectionLabelMuted,
                      ]}>
                        {label}
                      </ThemedText>
                      {meta && (
                        <View style={styles.sectionMetaContainer}>
                          {metaIcon && (
                            <Ionicons
                              name={metaIcon as any}
                              size={12}
                              color={'rgba(255,255,255,0.4)'}
                              style={styles.sectionMetaIcon}
                            />
                          )}
                          <ThemedText style={[
                            styles.sectionInfo,
                            state !== 'completed' && styles.sectionInfoMuted,
                          ]}>
                            {meta}
                          </ThemedText>
                        </View>
                      )}
                      {actionIcon && !meta && (
                        actionIconType === 'ionicons' ? (
                          <Ionicons
                            name={actionIcon as any}
                            size={14}
                            color={actionIconState ? Colors.alertCoral : 'rgba(255,255,255,0.4)'}
                            style={styles.sectionActionIcon}
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name={actionIcon as any}
                            size={14}
                            color={actionIconState ? Colors.alertCoral : 'rgba(255,255,255,0.4)'}
                            style={styles.sectionActionIcon}
                          />
                        )
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  }, [handleCardPress, handleCardLongPress, scrollX, sessionStates, menuVisible, devotionalsCount, triggerLightHaptic, handleDelete]);

  // Logging for render states

  // Show loading state when we don't have a userId yet (auth loading) or not authenticated
  if (!userId || !isAuthenticated) {

    return (
      <SafeAreaView style={styles.safeArea} edges={['left','right']}>
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
      <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.anchorBlue }]} edges={['left','right']}>
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
    <SafeAreaView style={styles.safeArea} edges={['left','right']}>
      <View style={styles.container}>
        {/* Header on white background with tabs */}
        <View pointerEvents="box-none" style={[styles.headerBar, { paddingTop: insets.top }]}>
          <View style={styles.pageInner}>
            <ThemedText weight="bold" style={styles.headerTitle}>Playbooks</ThemedText>
            <Animated.View
              style={[
                styles.searchBarWrapper,
                {
                  height: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 68] }),
                  opacity: searchAnim,
                },
              ]}
              pointerEvents={showSearch ? 'auto' : 'none'}
            >
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color={Colors.textGray} style={styles.searchIcon} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search playbooks..."
                  placeholderTextColor={Colors.textGray}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    style={styles.clearButton}
                    accessibilityLabel="Clear search"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close-circle" size={16} color={Colors.textGray} />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
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
          {/* Search circle button — top right, inverted style for hopeWhite background */}
          <TouchableOpacity
            style={[styles.searchCircleButton, { top: insets.top + 10 }]}
            onPress={() => { triggerLightHaptic(); toggleSearch(); }}
            activeOpacity={0.75}
            accessibilityLabel={showSearch ? 'Close search' : 'Search playbooks'}
            accessibilityRole="button"
          >
            <Ionicons
              name={showSearch ? 'close' : 'search'}
              size={17}
              color={Colors.anchorBlue}
            />
          </TouchableOpacity>
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
            <>
              {filter === 'ongoing' && (
                <View style={styles.carouselTitleContainer}>
                  <ThemedText weight="semiBold" style={styles.carouselTitle}>
                    CONTINUE YOUR {filteredPlaybooks.length === 1 ? 'PLAYBOOK' : 'PLAYBOOKS'}
                  </ThemedText>
                </View>
              )}
              <Animated.ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.carouselScrollContainer, { paddingHorizontal: SIDE_INSET }]}
                decelerationRate="fast"
                snapToInterval={ITEM_SIZE}
                snapToAlignment="center"
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                  { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                bounces={true}
                removeClippedSubviews={false}
              >
                {filteredPlaybooks.map((playbook, index) => (
                <CarouselCard
                  key={playbook.id}
                  item={playbook}
                  index={index}
                  scrollX={scrollX}
                  isMenuOpen={menuVisible === playbook.id}
                  hasPrayed={sessionStates[playbook.id]?.hasPrayed ?? false}
                  hasRead={sessionStates[playbook.id]?.hasRead ?? false}
                  devotionalCount={devotionalsCount[playbook.id] ?? 0}
                  cardStyles={styles}
                  onPress={handleCardPress}
                  onLongPress={handleCardLongPress}
                  onMenuToggle={setMenuVisible}
                  onDelete={handleDelete}
                  onRenamePress={handleRenamePress}
                  onTagPress={handleTagPress}
                  onDevotionalPress={handleDevotionalPress}
                  triggerHaptic={triggerLightHaptic}
                />
              ))}
              </Animated.ScrollView>
            </>
          )}
        </BlueSheet>
      </View>
      {/* Devotional creation modal triggered by long-press on a playbook card */}
      <DevotionalModal
        visible={devotionalModalVisible}
        onClose={() => {
          setDevotionalModalVisible(false);
          setSelectedPlaybookForDevotional(null); // Reset selected playbook
        }}
        playbookId={selectedPlaybookForDevotional?.id}
        userInput={selectedPlaybookForDevotional?.userInput}
        onDevotionalCreated={(devotionalId: string) => {
          setDevotionalModalVisible(false);
          setSelectedPlaybookForDevotional(null); // Reset selected playbook
          navigation.navigate('DevotionalDetail' as any, { devotionalId });
        }}
      />

      {/* Rename modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRenameModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <ThemedText weight="bold" style={styles.modalTitle}>Rename Playbook</ThemedText>
            <TextInput
              style={styles.modalInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter new title"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setRenameModalVisible(false)}
              >
                <ThemedText style={styles.modalButtonTextCancel}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleRenamePlaybook}
              >
                <ThemedText style={styles.modalButtonTextConfirm}>Save</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tag selection modal */}
      <Modal
        visible={tagModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTagModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTagModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <ThemedText weight="bold" style={styles.modalTitle}>Select Tag</ThemedText>
            <ScrollView style={styles.tagList} showsVerticalScrollIndicator={false}>
              {predefinedTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagItem,
                    selectedTag === tag && styles.tagItemSelected
                  ]}
                  onPress={() => {
                    if (tag === 'Custom') {
                      setSelectedTag('Custom');
                    } else {
                      setSelectedTag(tag);
                      setCustomTag('');
                    }
                  }}
                >
                  <ThemedText style={[
                    styles.tagItemText,
                    selectedTag === tag && styles.tagItemTextSelected
                  ]}>
                    {tag}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {selectedTag === 'Custom' && (
              <TextInput
                style={styles.modalInput}
                value={customTag}
                onChangeText={setCustomTag}
                placeholder="Enter custom tag"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
              />
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setTagModalVisible(false)}
              >
                <ThemedText style={styles.modalButtonTextCancel}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleTagPlaybook}
              >
                <ThemedText style={styles.modalButtonTextConfirm}>Save</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  carouselCardTouch: {
    width: ITEM_WIDTH,
    marginRight: ITEM_SPACING,
  },
  carouselCard: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    minHeight: 200,
  },
  carouselTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  carouselTypeText: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: Colors.alertCoral,
  },
  carouselBadgeContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  carouselProgressBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  carouselProgressBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  carouselCardTitle: {
    fontSize: 18,
    lineHeight: 24,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  carouselDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 0,
  },
  dateWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  devotionalsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginLeft: 8,
    minHeight: 20,
  },
  devotionalsBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginLeft: 3,
  },
  carouselCardDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 16,
  },
  carouselProgressSection: {
    marginBottom: 12,
  },
  carouselProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  carouselProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  carouselProgressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  carouselStepInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carouselStepText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  carouselScrollContainer: {
    paddingVertical: 20,
    flexGrow: 1,
  },
  carouselTitleContainer: {
    paddingHorizontal: SIDE_INSET,
    paddingTop: 20,
    paddingBottom: 12,
  },
  carouselTitle: {
    fontSize: 12,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  gradientContainer: {
    height: 70,
    borderRadius: 22,
    marginBottom: 12,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'linear-gradient(135deg, rgba(231, 238, 247, 0.2) 0%, rgba(219, 230, 244, 0.2) 45%, rgba(244, 239, 230, 0.2) 100%)',
    overflow: 'visible',
  },
  gradientRelationships: {
    backgroundColor: 'linear-gradient(135deg, rgba(230, 237, 247, 0.2) 0%, rgba(213, 227, 245, 0.2) 50%, rgba(245, 235, 232, 0.2) 100%)',
  },
  gradientFinance: {
    backgroundColor: 'linear-gradient(135deg, rgba(238, 244, 235, 0.2) 0%, rgba(223, 233, 220, 0.2) 50%, rgba(227, 237, 246, 0.2) 100%)',
  },
  gradientFaith: {
    backgroundColor: 'linear-gradient(135deg, rgba(241, 238, 229, 0.2) 0%, rgba(232, 224, 210, 0.2) 45%, rgba(219, 230, 244, 0.2) 100%)',
  },
  gradientPeace: {
    backgroundColor: 'linear-gradient(135deg, rgba(230, 237, 247, 0.2) 0%, rgba(213, 227, 245, 0.2) 50%, rgba(245, 235, 232, 0.2) 100%)',
  },
  gradientHope: {
    backgroundColor: 'linear-gradient(135deg, rgba(238, 244, 235, 0.2) 0%, rgba(223, 233, 220, 0.2) 50%, rgba(227, 237, 246, 0.2) 100%)',
  },
  gradientWisdom: {
    backgroundColor: 'linear-gradient(135deg, rgba(241, 238, 229, 0.2) 0%, rgba(232, 224, 210, 0.2) 45%, rgba(219, 230, 244, 0.2) 100%)',
  },
  gradientForgiveness: {
    backgroundColor: 'linear-gradient(135deg, rgba(230, 237, 247, 0.2) 0%, rgba(213, 227, 245, 0.2) 50%, rgba(245, 235, 232, 0.2) 100%)',
  },
  gradientGratitude: {
    backgroundColor: 'linear-gradient(135deg, rgba(238, 244, 235, 0.2) 0%, rgba(223, 233, 220, 0.2) 50%, rgba(227, 237, 246, 0.2) 100%)',
  },
  gradientPurpose: {
    backgroundColor: 'linear-gradient(135deg, rgba(241, 238, 229, 0.2) 0%, rgba(232, 224, 210, 0.2) 45%, rgba(219, 230, 244, 0.2) 100%)',
  },
  gradientGrowth: {
    backgroundColor: 'linear-gradient(135deg, rgba(231, 238, 247, 0.2) 0%, rgba(219, 230, 244, 0.2) 45%, rgba(244, 239, 230, 0.2) 100%)',
  },
  gradientBubble: {
    position: 'absolute',
    right: -18,
    top: -18,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  gradientBubbleSmall: {
    position: 'absolute',
    right: 30,
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  categoryLabel: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
  categoryLabelText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.04,
    textTransform: 'uppercase',
    color: Colors.anchorBlue,
  },
  menuButton: {
    position: 'absolute',
    top: 12,
    right: 12,
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
    top: 40,
    right: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    minWidth: 180,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  dropdownItemTextDelete: {
    color: '#f87171',
  },
  dropdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 12,
  },
  dropdownBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: Colors.hopeWhite,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalButtonConfirm: {
    backgroundColor: Colors.anchorBlue,
  },
  modalButtonTextCancel: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  tagList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  tagItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  tagItemSelected: {
    backgroundColor: Colors.anchorBlue,
  },
  tagItemText: {
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  tagItemTextSelected: {
    fontWeight: '600',
  },
  sectionsContainer: {
    marginTop: 12,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionCheck: {
    marginRight: 8,
  },
  // Pill badge status icons with green and faith gold colors
  statusPill: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusPillCompleted: {
    backgroundColor: 'rgba(95, 138, 104, 0.15)',
    borderColor: Colors.growthGreen,
  },
  statusPillViewed: {
    backgroundColor: 'rgba(197, 140, 43, 0.1)',
    borderColor: Colors.faithGold,
  },
  statusPillUnreached: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  statusPillText: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  statusPillTextCompleted: {
    color: Colors.growthGreen,
  },
  statusPillTextViewed: {
    color: Colors.faithGold,
  },
  statusPillTextUnreached: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  statusPillFill: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  statusPillFillCompleted: {
    backgroundColor: Colors.growthGreen,
  },
  sectionContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },
  sectionLabelMuted: {
    color: 'rgba(255, 255, 255, 0.35)',
  },
  sectionMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionMetaIcon: {
    marginRight: 0,
  },
  sectionInfo: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  sectionInfoMuted: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  sectionActionIcon: {
    marginRight: 0,
  },
  sectionViewedIcon: {
    fontSize: 15,
    color: Colors.faithGold,
    lineHeight: 18,
    marginRight: 0,
  },
  completedDate: {
    color: Colors.growthGreen,
  },
  completedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  completedSummaryText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
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
  searchBarWrapper: {
    overflow: 'hidden',
  },
  searchBar: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    height: 44,
  },
  searchCircleButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.07)',
    borderRadius: 999,
    zIndex: 100,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.anchorBlue,
    paddingVertical: 0,
    fontFamily: Fonts.regular,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
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
    paddingBottom: 70,
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
