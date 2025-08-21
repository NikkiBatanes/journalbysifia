/**
 * DevotionalCarousel.tsx
 * Displays user's devotionals in a horizontal carousel with completion status
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { triggerLightHaptic } from '../../utils/haptics';

const { width } = Dimensions.get('window');
// Match PlaybookCarousel sizing and spacing
const ITEM_WIDTH = width * 0.75;
const ITEM_SPACING = 2;
const ITEM_SIZE = ITEM_WIDTH + ITEM_SPACING;
const SIDE_PADDING = (width - ITEM_WIDTH) / 2;

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

  const formatFinishedDate = (dateStr?: string) => {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return undefined;
    const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
    const month = d.toLocaleDateString(undefined, { month: 'long' });
    const day = d.getDate();
    const year = d.getFullYear();
    const currentYear = new Date().getFullYear();
    const withYear = `${weekday}, ${month} ${day} ${year}`;
    const withoutYear = `${weekday}, ${month} ${day}`;
    return year === currentYear ? withoutYear : withYear;
  };

  const fetchDevotionals = useCallback(async () => {
    if (!user) {return;}

    try {
      setLoading(true);
      setError(null);

      // Fetch devotionals
      const { data: devotionalsData, error: devotionalsError } = await supabase
        .from('devotionals')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (devotionalsError) {
        console.error('Error fetching devotionals:', devotionalsError);
        return;
      }

      // Fetch completion data for each devotional
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
            let completedAt: string | undefined = undefined;
            let lastAccessed: string | undefined = undefined;
            let nextDayNumber: number | undefined = undefined;
            let nextDayTitle: string | undefined = undefined;
            let totalDaysForReturn: number | undefined = undefined;
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
              const content = devotional.content
                ? (typeof devotional.content === 'string' ? JSON.parse(devotional.content) : devotional.content)
                : null;
              let days = (devotional as any).days ?? content?.days;
              if (typeof days === 'string') {
                try { days = JSON.parse(days); } catch {}
              }
              const totalDays: number | undefined = (devotional as any).total_days ?? content?.total_days ?? (Array.isArray(days) ? days.length : undefined);
              totalDaysForReturn = totalDays;
              const currentDay: number = Math.max(1, Math.min(
                Number((devotional as any).current_day ?? content?.current_day ?? 1) || 1,
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
              console.warn('Error parsing devotional content:', parseError);
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
                console.warn('Error parsing progress data:', parseError);
              }
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
              category: devotional.category || 'Daily Devotion',
              verse,
              total_days: totalDaysForReturn,
              nextDayNumber,
              nextDayTitle,
            };
          } catch (err) {
            console.warn('Error processing devotional:', err);
            return {
              id: devotional.id,
              title: devotional.title,
              description: devotional.description,
              content: devotional.content,
              isCompleted: false,
              estimatedDuration: 5,
              category: 'Daily Devotion',
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

    } catch (err) {
      console.error('Error fetching devotionals:', err);
      setError('Unable to load devotionals');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDevotionals();
  }, [fetchDevotionals]);

  const getStatusColor = (isCompleted: boolean) => {
    return isCompleted ? Colors.successGreen : Colors.faithGold;
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
          <Text style={styles.categoryText}>{devotional.category}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(devotional.isCompleted) }]}>
          <Ionicons
            name={getStatusIcon(devotional.isCompleted)}
            size={12}
            color={Colors.hopeWhite}
          />
        </View>
      </View>

      <Text style={styles.devotionalTitle} numberOfLines={2}>
        {devotional.title}
      </Text>


      {devotional.verse && (
        <View style={styles.versePreview}>
          <Text style={styles.verseText} numberOfLines={2}>
            "{devotional.verse.text}"
          </Text>
          <Text style={styles.verseReference}>- {devotional.verse.reference}</Text>
        </View>
      )}

      {devotional.description && (
        <Text style={styles.devotionalDescription} numberOfLines={2}>
          {devotional.description}
        </Text>
      )}

      {/* Place Next/Completed info below description */}
      {devotional.isCompleted ? (
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.completedText}>DONE</Text>
          {!!formatFinishedDate(devotional.completedAt) && (
            <Text style={styles.finishedDateText}>{formatFinishedDate(devotional.completedAt)}</Text>
          )}
        </View>
      ) : devotional.nextDayNumber ? (
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.nextLabel}>NEXT</Text>
          <Text style={styles.nextDayTitleText} numberOfLines={1}>
            {devotional.total_days === 1
              ? `Day ${devotional.nextDayNumber}`
              : `Day ${devotional.nextDayNumber}: ${devotional.nextDayTitle || ''}`}
          </Text>
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
            <Text style={[styles.statusText, { color: getStatusColor(devotional.isCompleted) }]}>
              {getStatusText(devotional)}
            </Text>
          </View>

          {devotional.lastAccessed && !devotional.isCompleted && (
            <Text style={styles.lastAccessedText}>
              Last read: {new Date(devotional.lastAccessed).toLocaleDateString()}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <View style={styles.heroCard}>
        <MaterialCommunityIcons
          name="book"
          size={32}
          color="rgba(255,255,255,0.85)"
          style={styles.heroIcon}
        />
        <Text style={styles.heroOverline}>No Devotionals</Text>
        <Text style={styles.heroTitle}>Start with Scripture</Text>
        <Text style={styles.heroSubtitle}>
          Create a playbook for what you're facing, then build a daily devotional from it.
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="book" size={24} color={Colors.alertCoral} />
          <Text style={styles.title}>Your Devotionals</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.alertCoral} />
          <Text style={styles.loadingText}>Loading devotionals...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="book" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Your Devotionals</Text>
        {devotionals.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              onViewAll?.();
            }}
            style={styles.viewAllButton}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.alertCoral} />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              fetchDevotionals();
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : devotionals.length === 0 ? (
        renderEmptyState()
      ) : (
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContainer, { paddingHorizontal: SIDE_PADDING }]}
          decelerationRate="fast"
          snapToInterval={ITEM_SIZE}
          snapToAlignment="center"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          bounces={false}
          removeClippedSubviews={false}
          style={{ overflow: 'visible' }}
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
              outputRange: [0.85, 1, 0.85],
              extrapolate: 'clamp',
            });
            const translateY = scrollX.interpolate({
              inputRange,
              outputRange: [4, 0, 4],
              extrapolate: 'clamp',
            });
            const zIndex = scrollX.interpolate({
              inputRange,
              outputRange: [1, 2, 1],
              extrapolate: 'clamp',
            });

            return (
              <TouchableOpacity
                key={devotional.id}
                onPress={() => {
                  triggerLightHaptic();
                  onDevotionalPress?.(devotional);
                }}
                activeOpacity={0.85}
              >
                <Animated.View
                  style={[
                    styles.devotionalCard,
                    { width: ITEM_WIDTH, marginRight: ITEM_SPACING },
                    index === 0 ? { marginLeft: -(SIDE_PADDING - 16) } : null,
                    { transform: [{ scale }, { translateY }], opacity, zIndex },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{devotional.category}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(devotional.isCompleted) }]}>
                      <Ionicons
                        name={getStatusIcon(devotional.isCompleted)}
                        size={12}
                        color={Colors.hopeWhite}
                      />
                    </View>
                  </View>

                  <Text style={styles.devotionalTitle} numberOfLines={2}>
                    {devotional.title}
                  </Text>


                  {devotional.verse && (
                    <View style={styles.versePreview}>
                      <Text style={styles.verseText} numberOfLines={2}>
                        "{devotional.verse.text}"
                      </Text>
                      <Text style={styles.verseReference}>- {devotional.verse.reference}</Text>
                    </View>
                  )}

                  {devotional.description && (
                    <Text style={styles.devotionalDescription} numberOfLines={2}>
                      {devotional.description}
                    </Text>
                  )}

                  {/* Place Next/Completed info below description */}
                  {devotional.isCompleted ? (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={styles.completedText}>DONE</Text>
                      {!!formatFinishedDate(devotional.completedAt) && (
                        <Text style={styles.finishedDateText}>{formatFinishedDate(devotional.completedAt)}</Text>
                      )}
                    </View>
                  ) : devotional.nextDayNumber ? (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={styles.nextLabel}>NEXT</Text>
                      <Text style={styles.nextDayTitleText} numberOfLines={1}>
                        {devotional.total_days === 1
                          ? `Day ${devotional.nextDayNumber}`
                          : `Day ${devotional.nextDayNumber}: ${devotional.nextDayTitle || ''}`}
                      </Text>
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
                        <Text style={[styles.statusText, { color: getStatusColor(devotional.isCompleted) }]}>
                          {getStatusText(devotional)}
                        </Text>
                      </View>

                      {devotional.lastAccessed && !devotional.isCompleted && (
                        <Text style={styles.lastAccessedText}>
                          Last read: {new Date(devotional.lastAccessed).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  )}
                </Animated.View>
              </TouchableOpacity>
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
    fontWeight: '600',
    color: Colors.hopeWhite,
    flex: 1,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.alertCoral,
    fontWeight: '500',
  },
  scrollContainer: {
    paddingRight: 16,
  },
  scrollPadding: {
    width: 16,
  },
  devotionalCard: {
    // width and spacing are applied inline per item to enable snapping & animations
    backgroundColor: Colors.modalBlue,
    borderRadius: 12,
    padding: 16,
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
    fontWeight: '500',
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
    fontWeight: '600',
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
    fontWeight: '600',
    textAlign: 'right',
  },
  devotionalDescription: {
    fontSize: 14,
    color: Colors.mediumGray,
    lineHeight: 20,
    marginBottom: 16,
  },
  nextLabel: {
    fontSize: 10,
    color: Colors.hopeWhite,
    opacity: 0.7,
    letterSpacing: 1,
    fontWeight: '700',
  },
  nextDayTitleText: {
    fontSize: 13,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  completedText: {
    fontSize: 12,
    color: Colors.successGreen,
    fontWeight: '700',
    marginBottom: 8,
  },
  finishedDateText: {
    fontSize: 12,
    color: Colors.successGreen,
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
    fontWeight: '500',
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
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  emptyStateContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  heroCard: {
    width: '100%',
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
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
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 18,
    textAlign: 'center',
    color: Colors.hopeWhite,
    fontWeight: '700',
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
    fontWeight: '600',
  },
  dynamicCardStyle: {
    // Base style for dynamic properties
  },
});

export default DevotionalCarousel;
