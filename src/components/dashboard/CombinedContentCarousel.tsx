/**
 * CombinedContentCarousel.tsx
 * Unified carousel displaying both playbooks and devotionals in a single horizontal scroll
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  DeviceEventEmitter,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil } from 'lucide-react-native';
import { format } from 'date-fns';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { triggerLightHaptic } from '../../utils/haptics';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import DashboardCombinedContentSkeleton from '../SkeletonLoader/DashboardCombinedContentSkeleton';
import ThemedText from '../common/ThemedText';
import DevotionalModal from '../DevotionalModal';

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

type ContentType = 'playbook' | 'devotional';

interface CardSection {
  label: string;
  step: number;
  metaIcon?: string;
  actionIcon?: string;
  actionIconType?: 'material' | 'ionicons';
}

// Static — defined once at module level, never recreated on render
const CARD_SECTIONS: CardSection[] = [
  { label: 'Intro',                step: 0 },
  { label: 'Truth in Love',        step: 1, metaIcon: 'time-outline' },
  { label: 'Scripture to Anchor',  step: 2 },
  { label: 'Faithful Actions',     step: 3 },
  { label: 'Prayer',               step: 4, metaIcon: 'pray-outline',        actionIcon: 'hands-pray',             actionIconType: 'material' },
  { label: 'Words to Speak',       step: 5, metaIcon: 'volume-high-outline', actionIcon: 'chatbubble-ellipses-outline', actionIconType: 'ionicons' },
];

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

interface BaseContent {
  id: string;
  type: ContentType;
  title: string;
  description?: string;
  content?: any;
  lastAccessed?: string;
  category?: string;
}

interface PlaybookContent {
  type: 'playbook';
  id: string;
  title: string;
  description?: string;
  content: any;
  userInput?: string;
  progress: number;
  totalSteps: number;
  completedSteps: number;
  lastAccessed?: string;
  category: string;
  walkthroughProgress: number;
  updatedAt: string;
  completedAt?: string;
  status?: string;
  truthInLove?: any;
}

interface DevotionalContent extends BaseContent {
  type: 'devotional';
  isCompleted: boolean;
  completedAt?: string;
  estimatedDuration?: number;
  verse?: {
    text: string;
    reference: string;
  } | null;
  tags?: string[];
  current_day?: number;
  total_days?: number;
  days?: any[];
  nextDayNumber?: number;
  nextDayTitle?: string;
}

type CombinedContent = PlaybookContent | DevotionalContent;

interface NormalizeDayTitleOptions {
  dayNumber?: number;
  category?: string;
}

const normalizeDayTitle = (title?: string | null, options: NormalizeDayTitleOptions = {}): string | undefined => {
  const { dayNumber, category } = options;
  if (!title) { return undefined; }

  const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

  let cleaned = collapseWhitespace(title);
  if (!cleaned) { return undefined; }

  const removeLeadingPattern = (pattern: RegExp) => {
    cleaned = cleaned.replace(pattern, '');
    cleaned = collapseWhitespace(cleaned);
  };

  cleaned = cleaned.replace(/^[-*•]+/, '');
  cleaned = collapseWhitespace(cleaned);

  const prefixPatterns = [
    /^[^A-Za-z0-9]*day\s*\d+\s*[-:–—.]*\s*/i,
    /^[^A-Za-z0-9]*focus\s*[-:–—.]*\s*/i,
  ];
  prefixPatterns.forEach(removeLeadingPattern);

  removeLeadingPattern(/^[^A-Za-z0-9]*category\s*[-:–—.]*\s*/i);

  if (cleaned.includes('|')) {
    const segments = cleaned
      .split('|')
      .map(segment => collapseWhitespace(segment))
      .filter(Boolean);

    const preferredSegment = segments.find(segment => {
      const lower = segment.toLowerCase();
      if (dayNumber && lower === `day ${dayNumber}`.toLowerCase()) { return false; }
      if (category && lower === category.trim().toLowerCase()) { return false; }
      return true;
    });
    cleaned = preferredSegment || segments[segments.length - 1] || cleaned;
  }

  if (!cleaned) { return undefined; }

  if (dayNumber && cleaned.toLowerCase() === `day ${dayNumber}`.toLowerCase()) {
    return undefined;
  }

  if (category && cleaned.toLowerCase() === category.trim().toLowerCase()) {
    return undefined;
  }

  const categoryIndex = cleaned.toLowerCase().indexOf('category:');
  if (categoryIndex >= 0) {
    const afterCategory = collapseWhitespace(cleaned.substring(categoryIndex + 'category:'.length));
    cleaned = afterCategory || cleaned.substring(0, categoryIndex).trim();
  }

  return cleaned;
};

interface CombinedContentCarouselProps {
  onPlaybookPress?: (playbook: PlaybookContent) => void;
  onDevotionalPress?: (devotional: DevotionalContent) => void;
  onEmpty?: () => void;
}

const CombinedContentCarousel: React.FC<CombinedContentCarouselProps> = ({
  onPlaybookPress,
  onDevotionalPress,
  onEmpty,
}) => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const scrollX = useRef(new Animated.Value(0)).current;
  const [content, setContent] = useState<CombinedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const refetchTimeoutRef = useRef<any>(null);
  const [devotionalModalVisible, setDevotionalModalVisible] = useState(false);
  const [selectedPlaybookForDevotional, setSelectedPlaybookForDevotional] = useState<PlaybookContent | null>(null);

  React.useEffect(() => {
    if (!loading && content.length === 0) {
      onEmpty?.();
    }
  }, [loading, content.length, onEmpty]);

  const formatFinishedDate = (dateStr?: string): string | undefined => {
    if (!dateStr) { return undefined; }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) { return undefined; }
    const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
    const month = d.toLocaleDateString(undefined, { month: 'long' });
    const day = d.getDate();
    const year = d.getFullYear();
    const currentYear = new Date().getFullYear();
    const yearPart = year === currentYear ? '' : `, ${year}`;
    return `${weekday}, ${month} ${day}${yearPart}`;
  };

  const fetchContent = useCallback(async () => {
    if (!user) { return; }

    try {
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      setError(null);

      // Use getPlaybooks API for consistency with PlaybookListScreen
      const { getPlaybooks } = await import('../../services/apiIntegration');
      const playbooksData = await getPlaybooks(user.id, { lightweight: true });

      const devotionalsQuery = await supabase
        .from('devotionals')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (devotionalsQuery.error) {
        Logger.error('Error fetching devotionals', devotionalsQuery.error as Error, {
          component: 'CombinedContentCarousel',
        });
      }
      const devotionalsData = devotionalsQuery.data || [];

      const playbooksWithProgress = playbooksData.map((playbook) => {
        // getPlaybooks API already returns processed data with walkthroughProgress and actionSteps
        // Calculate completed/total stats from actionSteps
        let completed = 0;
        let total = 0;
        if (playbook.actionSteps && Array.isArray(playbook.actionSteps)) {
          for (const step of playbook.actionSteps) {
            if (!step) { continue; }
            if (Array.isArray(step.subTasks) && step.subTasks.length > 0) {
              for (const subTask of step.subTasks) {
                if (subTask?.completed) { completed++; }
                total++;
              }
            } else {
              if (step.completed) { completed++; }
              total++;
            }
          }
        }

        const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          type: 'playbook' as const,
          id: playbook.id,
          title: playbook.title,
          description: playbook.description,
          content: playbook.content,
          userInput: playbook.userInput,
          progress: progressPercentage,
          totalSteps: total,
          completedSteps: completed,
          lastAccessed: playbook.updatedAt,
          category: playbook.category || 'Personal Growth',
          walkthroughProgress: playbook.walkthroughProgress ?? -1,
          updatedAt: playbook.updatedAt,
          completedAt: playbook.completedAt,
          status: playbook.status,
          truthInLove: playbook.truthInLove, // Include for read time calculation
        };
      });

      const deriveCategory = (row: any): string => {
        const savedArray = Array.isArray(row.categories) ? row.categories : [];
        const saved = (row.category as string) || (savedArray[0] as string) || '';
        const isGeneric = !saved || /^(growth|spiritual\s*growth|daily\s*devotion)$/i.test(saved.trim());
        if (!isGeneric) {
          return saved;
        }
        const base = `${row.title || ''} ${row.description || ''}`.toLowerCase();
        if (base.includes('prayer') || base.includes('pray')) { return 'Prayer'; }
        if (base.includes('faith') || base.includes('trust') || base.includes('believe')) { return 'Faith'; }
        if (base.includes('love') || base.includes('relationship') || base.includes('family')) { return 'Relationships'; }
        if (base.includes('peace') || base.includes('anxiety') || base.includes('worry') || base.includes('stress')) { return 'Peace'; }
        if (base.includes('hope') || base.includes('encouragement') || base.includes('strength')) { return 'Hope'; }
        if (base.includes('wisdom') || base.includes('decision') || base.includes('guidance')) { return 'Wisdom'; }
        if (base.includes('forgive')) { return 'Forgiveness'; }
        if (base.includes('gratitude') || base.includes('thank')) { return 'Gratitude'; }
        if (base.includes('purpose') || base.includes('calling') || base.includes('mission')) { return 'Purpose'; }
        return saved || 'Spiritual Growth';
      };

      const devotionalsWithStatus = await Promise.all(
        devotionalsData.map(async (devotional) => {
          try {
            const { data: progressData } = await supabase
              .from('user_progress')
              .select('*')
              .eq('user_id', user.id)
              .eq('content_type', 'devotional')
              .eq('content_id', devotional.id)
              .single();

            let verse = null;
            let estimatedDuration = 5;
            let isCompleted = false;
            let completedAt: string | undefined;
            let lastAccessed: string | undefined;
            let nextDayNumber: number | undefined;
            let nextDayTitle: string | undefined;

            const derivedCategory = deriveCategory(devotional);

            try {
              const devotionalContent = devotional.content
                ? (typeof devotional.content === 'string'
                    ? JSON.parse(devotional.content)
                    : devotional.content)
                : null;

              if (devotionalContent && devotionalContent.verse) {
                verse = {
                  text: devotionalContent.verse.text || devotionalContent.verse,
                  reference: devotionalContent.verse.reference || 'Scripture',
                };
              }

              let days = devotionalContent?.days ?? (devotional as any).days;
              if (typeof days === 'string') {
                try { days = JSON.parse(days); } catch {}
              }
              const totalDays: number | undefined = (devotional as any).total_days ?? devotionalContent?.total_days ?? (Array.isArray(days) ? days.length : undefined);
              const currentDay: number = Math.max(1, Math.min(
                Number((devotional as any).current_day ?? devotionalContent?.current_day ?? 1) || 1,
                totalDays || 9999,
              ));

              const allDaysCompleted = Array.isArray(days) && days.length > 0 && days.every((d: any) => !!d?.completed);
              const progressedPastEnd = !!totalDays && currentDay > totalDays;
              if (allDaysCompleted || progressedPastEnd) {
                isCompleted = true;
                if (!completedAt) {
                  completedAt = lastAccessed || new Date().toISOString();
                }
              }

              let usedPerDayText = false;
              if (Array.isArray(days) && days.length >= currentDay) {
                const dayEntry = days[currentDay - 1];
                const dayText = dayEntry?.reflection || dayEntry?.content || dayEntry?.text || '';
                nextDayNumber = currentDay;
                const rawDayTitle = typeof dayEntry?.title === 'string' ? dayEntry.title : undefined;
                const cleanedTitle = normalizeDayTitle(rawDayTitle, { dayNumber: currentDay, category: derivedCategory });
                nextDayTitle = cleanedTitle || `Day ${currentDay}`;
                if (typeof dayText === 'string' && dayText.length > 0) {
                  const textLength = dayText.length;
                  estimatedDuration = Math.max(3, Math.ceil(textLength / 200));
                  usedPerDayText = true;
                }
              }

              if (!usedPerDayText && devotionalContent && (devotionalContent.reflection || devotionalContent.content)) {
                const textLength = (devotionalContent.reflection || devotionalContent.content).length;
                estimatedDuration = Math.max(3, Math.ceil(textLength / 200));
              }
            } catch {}

            if (progressData && progressData.progress_data) {
              try {
                const progress = typeof progressData.progress_data === 'string'
                  ? JSON.parse(progressData.progress_data)
                  : progressData.progress_data;

                isCompleted = progress.completed || false;
                const progressUpdatedAt = (progressData as any).updated_at as string | undefined;
                completedAt = progress.completedAt || progressUpdatedAt || undefined;
                lastAccessed = progressUpdatedAt || undefined;
              } catch {}
            }

            if (!lastAccessed) {
              try { lastAccessed = (devotional as any).updated_at as string | undefined; } catch {}
            }

            if (isCompleted) {
              nextDayNumber = undefined;
              nextDayTitle = undefined;
            }

            return {
              type: 'devotional' as const,
              id: devotional.id,
              title: devotional.title,
              description: devotional.description,
              content: devotional.content,
              isCompleted,
              completedAt,
              lastAccessed,
              estimatedDuration,
              category: derivedCategory,
              verse,
              current_day: (devotional as any).current_day,
              total_days: (devotional as any).total_days,
              days: (devotional as any).days,
              nextDayNumber,
              nextDayTitle,
            };
          } catch (err) {
            Logger.warn('Error processing devotional', { component: 'CombinedContentCarousel', data: err });
            return {
              type: 'devotional' as const,
              id: devotional.id,
              title: devotional.title,
              description: devotional.description,
              content: devotional.content,
              isCompleted: false,
              estimatedDuration: 5,
              category: 'Spiritual Growth',
              verse: null,
            };
          }
        })
      );

      // Filter out completed items and limit to 3 of each type
      const activePlaybooks = playbooksWithProgress
        .filter(p => p.progress < 100 && p.status !== 'completed')
        .slice(0, 3);

      const activeDevotionals = devotionalsWithStatus
        .filter(d => !d.isCompleted)
        .slice(0, 3);

      const combined: CombinedContent[] = [
        ...activePlaybooks,
        ...activeDevotionals,
      ].sort((a, b) => {
        const aDate = new Date(a.lastAccessed || 0).getTime();
        const bDate = new Date(b.lastAccessed || 0).getTime();
        return bDate - aDate;
      });

      setContent(combined);
    } catch (err) {
      Logger.error('Error fetching content', err as Error, {
        component: 'CombinedContentCarousel',
      });
      setError('Unable to load content');
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  useFocusEffect(
    useCallback(() => {
      fetchContent();
      return () => {};
    }, [fetchContent])
  );

  const scheduleRefetch = useCallback(() => {
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
    }
    refetchTimeoutRef.current = setTimeout(() => {
      fetchContent();
    }, 150);
  }, [fetchContent]);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'updated' && event.query.queryKey) {
        const queryKey = event.query.queryKey;
        if (queryKey.includes('userPlaybooks') ||
            queryKey.includes('playbookProgress') ||
            queryKey.includes('playbooks') ||
            queryKey.includes('actionSteps') ||
            queryKey.includes('devotionals')) {
          scheduleRefetch();
        }
      }
    });

    return unsubscribe;
  }, [queryClient, scheduleRefetch]);

  useEffect(() => {
    const handleProgressUpdate = () => {
      scheduleRefetch();
    };

    const subscription = DeviceEventEmitter.addListener('playbookProgressUpdate', handleProgressUpdate);

    return () => {
      subscription.remove();
    };
  }, [scheduleRefetch]);

  useEffect(() => {
    if (!user?.id) { return; }

    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe();
      } catch {}
      channelRef.current = null;
    }

    const channel = supabase.channel(`dashboard-combined-content-${user.id}-${Date.now()}`);

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'playbook_action_steps' },
      () => {
        fetchContent();
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'playbook_sub_tasks' },
      () => {
        fetchContent();
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_progress' },
      () => {
        scheduleRefetch();
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'playbooks' },
      () => {
        scheduleRefetch();
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'devotionals' },
      () => {
        scheduleRefetch();
      }
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        try { channelRef.current.unsubscribe(); } catch {}
        channelRef.current = null;
      }
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = null;
      }
    };
  }, [user?.id, scheduleRefetch, fetchContent]);

  const getProgressColor = (progress: number) => {
    if (progress === 0) { return 'rgba(255, 255, 255, 0.16)'; }
    if (progress === 100) { return Colors.growthGreen; }
    return Colors.alertCoral;
  };

  const getProgressText = (progress: number) => {
    if (progress === 0) { return 'Not started'; }
    if (progress === 100) { return 'Complete'; }
    return `${progress}% Complete`;
  };

  const renderPlaybookCard = (playbook: PlaybookContent, index: number) => {
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

    const isCardCompleted = playbook.status === 'completed';
    const wp = playbook.walkthroughProgress ?? -1;
    
    // Calculate completed/total stats
    let completed = 0;
    let total = 0;
    if (playbook.content) {
      try {
        const parsed = typeof playbook.content === 'string' ? JSON.parse(playbook.content) : playbook.content;
        const steps = parsed.actionSteps || [];
        steps.forEach((step: any) => {
          if (step.subTasks && step.subTasks.length > 0) {
            step.subTasks.forEach((subtask: any) => {
              if (subtask.completed) completed++;
              total++;
            });
          } else {
            if (step.completed) completed++;
            total++;
          }
        });
      } catch {}
    }

    const category = playbook.category || 'Growth';

    // Calculate read time for Truth in Love section
    const estimateReadTime = (text: string): string => {
      if (!text) { return ''; }
      const words = text.trim().split(/\s+/).length;
      const minutes = Math.max(1, Math.round(words / 200));
      return `${minutes} min read`;
    };

    // Use truthInLove from playbook object to match PlaybookListScreen
    const tilText = (playbook.truthInLove as any)?.text || '';
    const tilReadTime = estimateReadTime(tilText);

    // Format dates
    const CURRENT_YEAR = new Date().getFullYear();
    let updatedDateStr = null;
    if (playbook.updatedAt) {
      const d = new Date(playbook.updatedAt);
      updatedDateStr = format(d, d.getFullYear() === CURRENT_YEAR ? 'EEE, MMM d' : 'EEE, MMM d, yyyy');
    }
    let completedDateStr = null;
    if (playbook.completedAt) {
      const d = new Date(playbook.completedAt);
      completedDateStr = format(d, d.getFullYear() === CURRENT_YEAR ? 'EEE, MMM d' : 'EEE, MMM d, yyyy');
    }

    return (
      <TouchableOpacity
        key={playbook.id}
        style={styles.cardTouch}
        onPress={() => {
          triggerLightHaptic();
          onPlaybookPress?.(playbook);
        }}
        onLongPress={() => {
          try { triggerLightHaptic(); } catch {}
          setSelectedPlaybookForDevotional(playbook);
          setDevotionalModalVisible(true);
        }}
        activeOpacity={0.85}
      >
        <Animated.View
          style={[
            styles.carouselCard,
            styles.itemContainer,
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
                setSelectedPlaybookForDevotional(playbook);
                setDevotionalModalVisible(true);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255, 255, 255, 0.7)" />
            </TouchableOpacity>
          </View>

          <View style={styles.dateWithBadge}>
            {!isCardCompleted && updatedDateStr ? (
              <ThemedText style={styles.carouselDate}>{updatedDateStr}</ThemedText>
            ) : null}
          </View>

          <ThemedText weight="semiBold" style={styles.carouselCardTitle}>
            {playbook.title}
          </ThemedText>

          {playbook.userInput && (
            <ThemedText style={styles.carouselCardDescription} numberOfLines={1}>
              {playbook.userInput}
            </ThemedText>
          )}

          {isCardCompleted ? (
            <View style={styles.completedSummary}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.growthGreen} />
              <ThemedText style={styles.completedSummaryText}>{completed} of {total} faithful actions acted on</ThemedText>
              {completedDateStr && (
                <>
                  <View style={styles.completedSummaryDivider} />
                  <ThemedText style={styles.completedDateText}>{completedDateStr}</ThemedText>
                </>
              )}
            </View>
          ) : (
            <View style={styles.sectionsContainer}>
              {CARD_SECTIONS.map(({ label, step, metaIcon, actionIcon, actionIconType }) => {
                const state = getSectionState(step, wp);
                // Derive dynamic values per section to match PlaybookListScreen
                const meta = step === 1 ? tilReadTime
                           : step === 3 && total > 0 ? `${completed} of ${total} acted on`
                           : undefined;
                // Note: hasPrayed/hasRead not available in CombinedContentCarousel context
                // Using state-based coloring instead
                const actionIconState = state === 'completed';
                return (
                  <View key={label} style={styles.sectionItem}>
                    <View style={[styles.statusPill, state === 'completed' && styles.statusPillCompleted, state === 'viewed' && styles.statusPillViewed, state === 'unreached' && styles.statusPillUnreached]}>
                      {state === 'completed' ? <View style={[styles.statusPillFill, styles.statusPillFillCompleted]} /> : <ThemedText style={[styles.statusPillText, state === 'viewed' && styles.statusPillTextViewed, state === 'unreached' && styles.statusPillTextUnreached]}>{state === 'viewed' ? '◐' : '○'}</ThemedText>}
                    </View>
                    <View style={styles.sectionContent}>
                      <ThemedText style={[styles.sectionLabel, state === 'unreached' && styles.sectionLabelMuted]}>{label}</ThemedText>
                      {meta && <View style={styles.sectionMetaContainer}>{metaIcon && <Ionicons name={metaIcon as any} size={12} color={'rgba(255,255,255,0.4)'} style={styles.sectionMetaIcon} />}<ThemedText style={[styles.sectionInfo, state !== 'completed' && styles.sectionInfoMuted]}>{meta}</ThemedText></View>}
                      {actionIcon && !meta && (actionIconType === 'ionicons' ? <Ionicons name={actionIcon as any} size={14} color={actionIconState ? Colors.alertCoral : 'rgba(255,255,255,0.4)'} style={styles.sectionActionIcon} /> : <MaterialCommunityIcons name={actionIcon as any} size={14} color={actionIconState ? Colors.alertCoral : 'rgba(255,255,255,0.4)'} style={styles.sectionActionIcon} />)}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderDevotionalCard = (devotional: DevotionalContent, index: number) => {
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

    return (
      <TouchableOpacity
        key={devotional.id}
        style={styles.cardTouch}
        onPress={() => {
          triggerLightHaptic();
          onDevotionalPress?.(devotional);
        }}
        activeOpacity={0.85}
      >
        <Animated.View
          style={[
            styles.card,
            styles.itemContainer,
            { transform: [{ scale }, { translateY }], opacity },
          ]}
        >
          <View style={styles.typeIndicator}>
            <MaterialCommunityIcons name="book" size={16} color={Colors.alertCoral} />
            <ThemedText weight="semiBold" style={styles.typeText}>DEVOTIONAL</ThemedText>
          </View>

          {devotional.isCompleted && (
            <View style={styles.badgeContainer}>
              <View style={[styles.statusBadge, { backgroundColor: Colors.growthGreen }]}>
                <ThemedText weight="semiBold" style={styles.statusBadgeText}>DONE</ThemedText>
              </View>
            </View>
          )}

          <ThemedText weight="semiBold" style={styles.cardTitle}>
            {devotional.title}
          </ThemedText>

          {devotional.description && (
            <ThemedText style={styles.cardDescription} numberOfLines={2}>
              {devotional.description}
            </ThemedText>
          )}

          {devotional.verse && (
            <View style={styles.verseContainer}>
              <ThemedText style={styles.verseText} numberOfLines={2}>
                "{devotional.verse.text}"
              </ThemedText>
              <ThemedText weight="medium" style={styles.verseReference}>
                {devotional.verse.reference}
              </ThemedText>
            </View>
          )}

          {devotional.isCompleted ? (
            <View style={styles.completedInfo}>
              <MaterialCommunityIcons name="check-circle" size={16} color={Colors.growthGreen} />
              <ThemedText weight="medium" style={styles.completedText}>
                Finished {formatFinishedDate(devotional.completedAt) || 'recently'}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.nextDayInfo}>
              {devotional.nextDayNumber && devotional.nextDayTitle && (
                <>
                  <ThemedText weight="medium" style={styles.nextDayText}>Next</ThemedText>
                  <ThemedText weight="medium" style={styles.nextDayText}>{`Day ${devotional.nextDayNumber}: ${devotional.nextDayTitle}`}</ThemedText>
                </>
              )}
              <View style={styles.durationRow}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={Colors.textGray} />
                <ThemedText style={styles.durationText}>
                  {devotional.estimatedDuration} min read
                </ThemedText>
              </View>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderCard = (item: CombinedContent, index: number) => {
    if (item.type === 'playbook') {
      return renderPlaybookCard(item, index);
    } else {
      return renderDevotionalCard(item, index);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyCard}>
        <View style={styles.heroCard}>
          <MaterialCommunityIcons
            name="clipboard-text-play"
            size={32}
            color="rgba(255,255,255,0.85)"
            style={styles.heroIcon}
          />
          <ThemedText weight="semiBold" style={styles.heroOverline}>No Content Yet</ThemedText>
          <ThemedText weight="bold" style={styles.heroTitle}>Create Your First Playbook</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Share what you're going through in detail.{'\n'}
            The more context, the better we can help.
          </ThemedText>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => {
            triggerLightHaptic();
            try { navigation.navigate('UserInput'); } catch {}
          }}
        >
          <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
          <ThemedText weight="semiBold" style={styles.createButtonText}>Create a Playbook</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return <DashboardCombinedContentSkeleton />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerCenter}>
        <ThemedText weight="semiBold" style={styles.title}>CONTINUE YOUR JOURNEY</ThemedText>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              fetchContent();
            }}
            style={styles.retryButton}
          >
            <ThemedText weight="semiBold" style={styles.retryText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      ) : content.length === 0 ? (
        renderEmptyState()
      ) : (
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContainer, { paddingHorizontal: SIDE_INSET }]}
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
          style={styles.scrollExpanded}
        >
          {content.map((item, i) => renderCard(item, i))}
        </Animated.ScrollView>
      )}

      <DevotionalModal
        visible={devotionalModalVisible}
        onClose={() => {
          setDevotionalModalVisible(false);
          setSelectedPlaybookForDevotional(null);
        }}
        playbookId={selectedPlaybookForDevotional?.id}
        userInput={selectedPlaybookForDevotional?.userInput}
        onDevotionalCreated={(devotionalId: string) => {
          setDevotionalModalVisible(false);
          setSelectedPlaybookForDevotional(null);
          try { navigation.navigate('DevotionalDetail' as never, { devotionalId } as never); } catch {}
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    overflow: 'visible',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 30,
  },
  headerCenter: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 12,
    color: Colors.hopeWhite,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  viewAllButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 11,
    color: Colors.alertCoral,
  },
  scrollContainer: {
    paddingVertical: 0,
    paddingRight: 0,
    overflow: 'visible',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    flexGrow: 1,
  },
  scrollExpanded: {
    overflow: 'visible',
    marginHorizontal: -16,
  },
  emptyStateContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyCard: {
    width: '100%',
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    position: 'relative',
  },
  heroCard: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  heroIcon: {
    marginBottom: 8,
    opacity: 0.9,
  },
  heroOverline: {
    fontSize: 12,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 18,
    textAlign: 'center',
    color: Colors.hopeWhite,
    lineHeight: 24,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  card: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    position: 'relative',
  },
  itemContainer: {
    width: ITEM_WIDTH,
    marginRight: ITEM_SPACING,
  },
  cardTouch: {},
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  typeText: {
    fontSize: 10,
    color: Colors.textGray,
    letterSpacing: 0.8,
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  progressBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  progressBadgeText: {
    fontSize: 10,
    color: Colors.hopeWhite,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    color: Colors.hopeWhite,
  },
  cardTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 8,
    paddingRight: 64,
    lineHeight: 22,
  },
  cardDescription: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 20,
    marginBottom: 8,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 3,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textGray,
  },
  stepInfo: {
    gap: 2,
  },
  stepText: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },
  verseContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.faithGold,
  },
  verseText: {
    fontSize: 13,
    color: Colors.hopeWhite,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 4,
  },
  verseReference: {
    fontSize: 11,
    color: Colors.faithGold,
  },
  completedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedText: {
    fontSize: 12,
    color: Colors.growthGreen,
  },
  nextDayInfo: {
    marginTop: 4,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  nextDayText: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },
  durationText: {
    fontSize: 11,
    color: Colors.textGray,
  },
  createButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
    flexDirection: 'row',
  },
  createButtonText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginRight: 8,
  },
  errorContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.alertCoral,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  // New styles to match PlaybookListScreen card design
  carouselCard: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 26,
    padding: 16,
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
  },
  categoryLabel: {
    position: 'absolute',
    left: 10,
    bottom: 8,
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
    position: 'absolute',
    top: 8,
    right: 10,
    padding: 4,
    zIndex: 20,
  },
  dateWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  carouselDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 0,
  },
  carouselCardTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  carouselCardDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 6,
  },
  completedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  completedSummaryText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  completedSummaryDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 8,
  },
  completedDateText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  sectionsContainer: {
    marginTop: 10,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPill: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
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
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  statusPillTextViewed: {
    color: Colors.faithGold,
  },
  statusPillTextUnreached: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  statusPillFill: {
    width: 8,
    height: 8,
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
    fontSize: 11,
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
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  sectionInfoMuted: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  sectionActionIcon: {
    marginRight: 0,
  },
});

export default CombinedContentCarousel;
