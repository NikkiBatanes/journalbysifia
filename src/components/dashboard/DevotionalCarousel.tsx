/**
 * DevotionalCarousel.tsx
 * Displays user's devotionals in a horizontal carousel with completion status
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  DeviceEventEmitter,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { triggerLightHaptic } from '../../utils/haptics';
import DevotionalCarouselSkeleton from '../SkeletonLoader/DevotionalCarouselSkeleton';
import ThemedText from '../common/ThemedText';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');
// Match ReflectionQuestionsCard sizing and spacing
const CARD_HORIZONTAL_PADDING = 16; // matches card padding
const VISIBLE_WIDTH = Math.max(0, width - CARD_HORIZONTAL_PADDING * 2);
const ITEM_WIDTH = VISIBLE_WIDTH * 0.8;
const ITEM_SPACING = 8;
const ITEM_SIZE = ITEM_WIDTH + ITEM_SPACING;
const SIDE_INSET = Math.max(0, (VISIBLE_WIDTH - ITEM_WIDTH) / 2);

interface Devotional {
  id: string;
  title: string;
  description?: string;
  content: any;
  isCompleted: boolean;
  completedAt?: string;
  lastAccessed?: string;
  estimatedDuration?: number; // in minutes
  category?: string;
  verse?: {
    text: string;
    reference: string;
  } | null;
  tags?: string[];
  // Optional fields present on the row
  current_day?: number;
  total_days?: number;
  days?: any[];
  nextDayNumber?: number;
  nextDayTitle?: string;
}

// Fallback data for when database is empty

interface DevotionalCarouselProps {
  onDevotionalPress?: (devotional: Devotional) => void;
  onViewAll?: () => void;
}

const DevotionalCarousel: React.FC<DevotionalCarouselProps> = ({
  onDevotionalPress,
  onViewAll,
}) => {
  const { user } = useAuth();
  const [devotionals, setDevotionals] = useState<Devotional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devotionalIdsRef = useRef<Set<string>>(new Set());
  const [hasPlaybooks, setHasPlaybooks] = useState(false);

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

  const fetchDevotionals = useCallback(async () => {
    if (!user) {return;}

    try {
      setLoading(true);
      setError(null);

      // Fetch devotionals and playbooks count in parallel
      const [devotionalsQuery, playbooksCountQuery] = await Promise.all([
        supabase
          .from('devotionals')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(10),
        supabase
          .from('playbooks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

      const devotionalsData = (devotionalsQuery.data ?? []) as any[];
      const devotionalsError = devotionalsQuery.error;
      const playbooksCount = (playbooksCountQuery as any)?.count ?? 0;
      setHasPlaybooks((playbooksCount || 0) > 0);

      if (devotionalsError) {
        Logger.error('Error fetching devotionals', devotionalsError as Error, {
        component: 'DevotionalCarousel',
      });
        return;
      }

      // Fetch completion data for each devotional
      // Helper to derive a better category if the saved one is too generic
      const deriveCategory = (row: any): string => {
        const savedArray = Array.isArray(row.categories) ? row.categories : [];
        const saved = (row.category as string) || (savedArray[0] as string) || '';
        const isGeneric = !saved || /^(growth|spiritual\s*growth|daily\s*devotion)$/i.test(saved.trim());
        if (!isGeneric) {
          return saved;
        }
        const base = `${row.title || ''} ${row.description || ''}`.toLowerCase();
        if (base.includes('prayer') || base.includes('pray')) {return 'Prayer';}
        if (base.includes('faith') || base.includes('trust') || base.includes('believe')) {return 'Faith';}
        if (base.includes('love') || base.includes('relationship') || base.includes('family')) {return 'Relationships';}
        if (base.includes('peace') || base.includes('anxiety') || base.includes('worry') || base.includes('stress')) {return 'Peace';}
        if (base.includes('hope') || base.includes('encouragement') || base.includes('strength')) {return 'Hope';}
        if (base.includes('wisdom') || base.includes('decision') || base.includes('guidance')) {return 'Wisdom';}
        if (base.includes('forgive')) {return 'Forgiveness';}
        if (base.includes('gratitude') || base.includes('thank')) {return 'Gratitude';}
        if (base.includes('purpose') || base.includes('calling') || base.includes('mission')) {return 'Purpose';}
        return saved || 'Spiritual Growth';
      };

      const devotionalsWithStatus = await Promise.all(
        devotionalsData.map(async (devotional) => {
          try {
            // Get user progress for this devotional
            const { data: progressData } = await supabase
              .from('user_progress')
              .select('*')
              .eq('user_id', user.id)
              .eq('content_type', 'devotional')
              .eq('content_id', devotional.id)
              .single();

            // Parse devotional content
            let verse = null;
            let estimatedDuration = 5; // default 5 minutes

            // Track completion and navigation helpers
            let isCompleted = false;
            let completedAt: string | undefined;
            let lastAccessed: string | undefined;
            let nextDayNumber: number | undefined;
            let nextDayTitle: string | undefined;
            let totalDaysForReturn: number | undefined;
            try {
              const content = devotional.content
                ? (typeof devotional.content === 'string'
                    ? JSON.parse(devotional.content)
                    : devotional.content)
                : null;

              // Extract verse information
              if (content && content.verse) {
                verse = {
                  text: content.verse.text || content.verse,
                  reference: content.verse.reference || 'Scripture',
                };
              }

            // Derive completion from days data if available
            try {
              const content2 = devotional.content
                ? (typeof devotional.content === 'string' ? JSON.parse(devotional.content) : devotional.content)
                : null;
              let days = (devotional as any).days ?? content2?.days;
              if (typeof days === 'string') {
                try { days = JSON.parse(days); } catch {}
              }
              const totalDays: number | undefined = (devotional as any).total_days ?? content2?.total_days ?? (Array.isArray(days) ? days.length : undefined);
              totalDaysForReturn = totalDays;
              const currentDay: number = Math.max(1, Math.min(
                Number((devotional as any).current_day ?? content2?.current_day ?? 1) || 1,
                totalDays || 9999,
              ));

              const allDaysCompleted = Array.isArray(days) && days.length > 0 && days.every((d: any) => !!d?.completed);
              const progressedPastEnd = !!totalDays && currentDay > totalDays;
              if (allDaysCompleted || progressedPastEnd) {
                isCompleted = true;
                // If we derived completion and there's no completedAt yet, use lastAccessed or now
                if (!completedAt) {
                  completedAt = lastAccessed || new Date().toISOString();
                }
              }
            } catch {}

              // Prefer per-day estimation using next incomplete day
              let days = (devotional as any).days ?? content?.days;
              if (typeof days === 'string') {
                try { days = JSON.parse(days); } catch {}
              }
              const totalDays: number | undefined = (devotional as any).total_days ?? content?.total_days ?? (Array.isArray(days) ? days.length : undefined);
              const currentDay: number = Math.max(1, Math.min(
                Number((devotional as any).current_day ?? content?.current_day ?? 1) || 1,
                totalDays || 9999,
              ));

              // Next incomplete day is current_day (1-based). Use that day's text if available
              let usedPerDayText = false;
              if (Array.isArray(days) && days.length >= currentDay) {
                const dayEntry = days[currentDay - 1];
                const dayText = dayEntry?.reflection || dayEntry?.content || dayEntry?.text || '';
                nextDayNumber = currentDay;
                nextDayTitle = (dayEntry?.title && typeof dayEntry.title === 'string')
                  ? dayEntry.title
                  : `Day ${currentDay}`;
                if (typeof dayText === 'string' && dayText.length > 0) {
                  const textLength = dayText.length;
                  estimatedDuration = Math.max(3, Math.ceil(textLength / 200));
                  usedPerDayText = true;
                }
              }

              // Fallback to overall content length when per-day not available
              if (!usedPerDayText && content && (content.reflection || content.content)) {
                const textLength = (content.reflection || content.content).length;
                estimatedDuration = Math.max(3, Math.ceil(textLength / 200));
              }
            } catch (parseError) {
              Logger.warn('Error parsing devotional content', { component: 'DevotionalCarousel', data: parseError });
            }

            if (progressData && progressData.progress_data) {
              try {
                const progress = typeof progressData.progress_data === 'string'
                  ? JSON.parse(progressData.progress_data)
                  : progressData.progress_data;

                isCompleted = progress.completed || false;
                // Prefer explicit completedAt, else use progress row updated time as fallback
                const progressUpdatedAt = (progressData as any).updated_at as string | undefined;
                completedAt = progress.completedAt || progressUpdatedAt || undefined;
                lastAccessed = progressUpdatedAt || undefined;
              } catch (parseError) {
                Logger.warn('Error parsing progress data', { component: 'DevotionalCarousel', data: parseError });
              }
            }

            // Fallback lastAccessed from devotional.updated_at if progress missing
            if (!lastAccessed) {
              try { lastAccessed = (devotional as any).updated_at as string | undefined; } catch {}
            }

            // If completed, do not show NEXT info
            if (isCompleted) {
              nextDayNumber = undefined;
              nextDayTitle = undefined;
            }

            return {
              id: devotional.id,
              title: devotional.title,
              description: devotional.description,
              content: devotional.content,
              isCompleted,
              completedAt,
              lastAccessed,
              estimatedDuration,
              category: deriveCategory(devotional),
              verse,
              total_days: totalDaysForReturn,
              nextDayNumber,
              nextDayTitle,
            };
          } catch (err) {
            Logger.warn('Error processing devotional', { component: 'DevotionalCarousel', data: err });
            return {
              id: devotional.id,
              title: devotional.title,
              description: devotional.description,
              content: devotional.content,
              isCompleted: false,
              estimatedDuration: 5,
              category: deriveCategory(devotional),
            };
          }
        })
      );

      // Sort: incomplete first, then by last accessed/updated
      const sortedDevotionals = devotionalsWithStatus.sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) {
          return a.isCompleted ? 1 : -1; // incomplete first
        }
        const aDate = new Date(a.lastAccessed || a.completedAt || 0);
        const bDate = new Date(b.lastAccessed || b.completedAt || 0);
        return bDate.getTime() - aDate.getTime(); // most recent first
      });

      setDevotionals(sortedDevotionals);
      // Track current devotional IDs for realtime filtering
      devotionalIdsRef.current = new Set(sortedDevotionals.map(d => d.id));

    } catch (err) {
      Logger.error('Error fetching devotionals', err as Error, { component: 'DevotionalCarousel' });
      setError('Unable to load devotionals');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDevotionals();
  }, [fetchDevotionals]);

  // Also refetch whenever the screen regains focus (returning from details)
  useFocusEffect(
    useCallback(() => {
      fetchDevotionals();
      return () => {};
    }, [fetchDevotionals])
  );

  // Listen for local creation event to refresh immediately with a short delayed retry
  useEffect(() => {
    const onCreated = (payload: { id?: string; user_id?: string }) => {
      if (payload?.user_id && user?.id && payload.user_id !== user.id) {return;}
      // Immediate fetch
      fetchDevotionals();
      // Debounced delayed fetch to catch eventual consistency
      if (refreshTimeout.current) {
        clearTimeout(refreshTimeout.current);
      }
      refreshTimeout.current = setTimeout(() => {
        fetchDevotionals();
      }, 1500);
    };
    const onFocused = (payload: { user_id?: string }) => {
      if (payload?.user_id && user?.id && payload.user_id !== user.id) {return;}
      // Same strategy on focus
      fetchDevotionals();
      if (refreshTimeout.current) {
        clearTimeout(refreshTimeout.current);
      }
      refreshTimeout.current = setTimeout(() => {
        fetchDevotionals();
      }, 800);
    };

    const subCreated = DeviceEventEmitter.addListener('devotional_created', onCreated);
    const subFocused = DeviceEventEmitter.addListener('dashboard_focused', onFocused);

    return () => {
      try { subCreated.remove(); } catch {}
      try { subFocused.remove(); } catch {}
      if (refreshTimeout.current) {
        clearTimeout(refreshTimeout.current);
        refreshTimeout.current = null;
      }
    };
  }, [user, fetchDevotionals]);

  // Debounced refetch to avoid rapid consecutive updates
  // scheduleRefetch removed - was defined but never called

  // Realtime updates: refresh when devotionals or related user_progress change
  useEffect(() => {
    if (!user) { return; }

    // Clean up any existing channel first
    const channelName = `devotionals_dashboard_${user.id}_${Date.now()}`;
    const channel = supabase.channel(channelName);

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'devotionals' },
      () => {

        fetchDevotionals();
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_progress' },
      (payload: any) => {
        const contentType = payload.new?.content_type ?? payload.old?.content_type;
        if (contentType === 'devotional') {

          fetchDevotionals();
        }
      }
    );

    channel.subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [user, fetchDevotionals]);

  const getStatusColor = (isCompleted: boolean) => {
    return isCompleted ? Colors.growthGreen : Colors.faithGold;
  };

  const getStatusIcon = (isCompleted: boolean) => {
    return isCompleted ? 'checkmark-circle' : 'time-outline';
  };

  const getStatusText = (devotional: Devotional) => {
    if (devotional.isCompleted) {
      return devotional.completedAt
        ? `Completed ${formatFinishedDate(devotional.completedAt)}`
        : 'Completed';
    }
    return `${devotional.estimatedDuration} min read`;
  };

  const renderDevotionalCard = (devotional: Devotional, _index: number) => (
    <TouchableOpacity
      key={devotional.id}
      style={[
        styles.devotionalCard,
        {

        },
      ]}
      onPress={() => {
        triggerLightHaptic();
        onDevotionalPress?.(devotional);
      }}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.categoryBadge}>
          <ThemedText weight="medium" style={styles.categoryText}>{devotional.category}</ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(devotional.isCompleted) }]}>
          <Ionicons
            name={getStatusIcon(devotional.isCompleted)}
            size={12}
            color={Colors.hopeWhite}
          />
        </View>
      </View>

      <ThemedText weight="semiBold" style={styles.devotionalTitle} numberOfLines={2}>
        {devotional.title}
      </ThemedText>

      {devotional.verse && (
        <View style={styles.versePreview}>
          <ThemedText style={styles.verseText} numberOfLines={2}>
            "{devotional.verse.text}"
          </ThemedText>
          <ThemedText weight="semiBold" style={styles.verseReference}>- {devotional.verse.reference}</ThemedText>
        </View>
      )}

      {devotional.description && (
        <ThemedText style={styles.devotionalDescription} numberOfLines={2}>
          {devotional.description}
        </ThemedText>
      )}

      {/* Place Next/Completed info below description */}
      {devotional.isCompleted ? (
        <View style={styles.mb8}>
          <ThemedText weight="bold" style={styles.completedText}>DONE</ThemedText>
          {!!formatFinishedDate(devotional.completedAt) && (
            <View style={styles.finishedDateRow}>
              <Ionicons name="calendar-clear-outline" size={14} color={Colors.growthGreen} style={styles.finishedDateIcon} />
              <ThemedText weight="bold" style={styles.finishedDateText}>
                {formatFinishedDate(devotional.completedAt)}
              </ThemedText>
            </View>
          )}
        </View>
      ) : devotional.nextDayNumber ? (
        <View style={styles.mb8}>
          <ThemedText weight="bold" style={styles.nextLabel}>NEXT</ThemedText>
          <ThemedText weight="semiBold" style={styles.nextDayTitleText} numberOfLines={1}>
            {devotional.total_days === 1
              ? `Day ${devotional.nextDayNumber}`
              : `Day ${devotional.nextDayNumber}: ${devotional.nextDayTitle || ''}`}
          </ThemedText>
        </View>
      ) : null}

      {!devotional.isCompleted && (
        <View style={styles.statusSection}>
          <View style={styles.statusInfo}>
            <Ionicons
              name={getStatusIcon(devotional.isCompleted)}
              size={16}
              color={getStatusColor(devotional.isCompleted)}
            />
            <ThemedText weight="medium" style={[styles.statusText, { color: getStatusColor(devotional.isCompleted) }]}>
              {getStatusText(devotional)}
            </ThemedText>
          </View>

          {devotional.lastAccessed && !devotional.isCompleted && (
            <ThemedText style={styles.lastAccessedText}>
              {`Last read: ${formatFinishedDate(devotional.lastAccessed) || ''}`}
            </ThemedText>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyCard}>
        <View style={styles.heroCard}>
          <MaterialCommunityIcons
            name="book"
            size={32}
            color="rgba(255,255,255,0.85)"
            style={styles.heroIcon}
          />
          <ThemedText weight="semiBold" style={styles.heroOverline}>
            {hasPlaybooks ? 'No Devotionals Yet' : 'No Devotionals'}
          </ThemedText>
          <ThemedText weight="bold" style={styles.heroTitle}>
            {hasPlaybooks ? 'Create a Devotional' : 'Start with Scripture'}
          </ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            {hasPlaybooks
              ? 'Long-press one of your playbooks to create a personalized devotional from it.'
              : "Create a playbook for what you're facing, then build a daily devotional from it."}
          </ThemedText>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return <DevotionalCarouselSkeleton />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="book" size={24} color={Colors.alertCoral} />
        <ThemedText weight="semiBold" style={styles.title}>Your Devotionals</ThemedText>
        {devotionals.length > 1 && (
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              onViewAll?.();
            }}
            style={styles.viewAllButton}
          >
            <ThemedText weight="medium" style={styles.viewAllText}>VIEW ALL</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              fetchDevotionals();
            }}
            style={styles.retryButton}
          >
            <ThemedText weight="semiBold" style={styles.retryText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      ) : devotionals.length === 0 ? (
        renderEmptyState()
      ) : (
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContainer, { paddingHorizontal: SIDE_INSET }]}
          decelerationRate="fast"
          snapToInterval={ITEM_SIZE}
          snapToAlignment="start"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          bounces={true}
          removeClippedSubviews={false}
          style={styles.scrollExpanded}
        >
          {devotionals.map((devotional, index) => {
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
            const zIndex = scrollX.interpolate({
              inputRange,
              outputRange: [1, 2, 1],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={devotional.id}
                style={[
                  styles.itemContainer,
                  { transform: [{ scale }, { translateY }], opacity, zIndex },
                ]}
              >
                {renderDevotionalCard(devotional, index)}
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    color: Colors.hopeWhite,
    flex: 1,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 11,
    color: Colors.alertCoral,
  },
  scrollContainer: {
    paddingRight: 16,
  },
  scrollExpanded: {
    overflow: 'visible',
    marginHorizontal: -16, // matches CARD_HORIZONTAL_PADDING
  },
  itemContainer: {
    width: ITEM_WIDTH,
    marginRight: ITEM_SPACING,
  },
  mb8: {
    marginBottom: 8,
  },
  devotionalCard: {
    // width and spacing are applied inline per item to enable snapping & animations
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 10,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devotionalTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 12,
    lineHeight: 22,
  },
  versePreview: {
    backgroundColor: Colors.lightPurple,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  verseText: {
    fontSize: 13,
    color: Colors.darkerGray,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 4,
  },
  verseReference: {
    fontSize: 11,
    color: Colors.alertCoral,
    textAlign: 'right',
  },
  devotionalDescription: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 20,
    marginBottom: 16,
  },
  nextLabel: {
    fontSize: 10,
    color: Colors.hopeWhite,
    opacity: 0.7,
    letterSpacing: 1,
  },
  nextDayTitleText: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },
  completedText: {
    fontSize: 12,
    color: Colors.growthGreen,
    marginBottom: 8,
  },
  finishedDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  finishedDateIcon: {
    marginRight: 4,
  },
  finishedDateText: {
    fontSize: 12,
    color: Colors.growthGreen,
    fontWeight: '600',
  },
  statusSection: {
    gap: 4,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
  },
  lastAccessedText: {
    fontSize: 10,
    color: Colors.lightGray,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textGray,
    fontStyle: 'italic',
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
  dynamicCardStyle: {
    // Base style for dynamic properties
  },
});

export default DevotionalCarousel;
