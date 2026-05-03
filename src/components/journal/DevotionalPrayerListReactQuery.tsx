import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  TouchableOpacity,
  DeviceEventEmitter,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { triggerSelectionHaptic } from '../../utils/haptics';
import ThemedText from '../common/ThemedText';
import { useDevotionalPrayerData } from '../../services/hooks/usePrayerData';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import { JournalCard } from './JournalCard';
import { ErrorBoundary } from '../ErrorBoundary';

interface DevotionalPrayerListReactQueryProps {
  selectedDate: Date;
  viewMode?: 'carousel' | 'inline' | 'moments';
  variant?: 'carousel' | 'inline';
  expanded?: boolean;
  onExpand?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
// Match ReflectionQuestionsCard carousel sizing for centered, edge-to-edge scrolling
const CARD_HORIZONTAL_PADDING = 16; // JournalCard content padding
const VISIBLE_WIDTH = Math.max(0, screenWidth - CARD_HORIZONTAL_PADDING * 2);
const CARD_WIDTH = VISIBLE_WIDTH * 0.8; // 80% of visible width
const CARD_SPACING = 8;
const ITEM_SIZE = CARD_WIDTH + CARD_SPACING;
// Center the card within visible area
const SIDE_PADDING = Math.max(0, (VISIBLE_WIDTH - CARD_WIDTH) / 2);

const DevotionalPrayerListReactQuery: React.FC<DevotionalPrayerListReactQueryProps> = ({
  selectedDate,
  viewMode = 'carousel',
  variant = 'carousel',
  expanded,
  onExpand,
}) => {
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [userExpanded, setUserExpanded] = useState(false);
  const { data: devotionalPrayers = [], isLoading, error } = useDevotionalPrayerData(
    user?.id || '',
    dateStr
  );

  // Handle scroll feedback for better UX (must be at top-level)
  const handleScroll = useCallback((_event: any) => {
    // Track scroll position for animation
  }, []);

  // ---- LOGIC AND FUNCTIONS BELOW ----

  if (isLoading) {
    return null; // Don't show loading state for devotional prayers
  }

  if (error) {
    Logger.error('❌ Error loading devotional prayers', error as Error, { component: 'DevotionalPrayerListReactQuery' });
    return null; // Don't show error state for devotional prayers
  }

  const hasContent = devotionalPrayers.length > 0;

  // Determine if prayers are from playbook or devotional
  const playbookPrayerCount = devotionalPrayers.filter((p: any) => p.prayer_type === 'guided_playbook').length;
  const devotionalPrayerCount = devotionalPrayers.length - playbookPrayerCount;

  // Determine subtitle based on prayer types
  const getSubtitle = () => {
    if (playbookPrayerCount > 0 && devotionalPrayerCount > 0) {
      // Mixed: show both counts with line break
      return `${playbookPrayerCount} from playbook\n${devotionalPrayerCount} from devotional`;
    } else if (playbookPrayerCount > 0) {
      // Only playbook
      return `${playbookPrayerCount} from playbook`;
    } else {
      // Only devotional
      return `${devotionalPrayerCount} from devotional`;
    }
  };

  // Group prayers by date (similar to original PrayedItemsList)
  const groupedPrayers = devotionalPrayers.reduce((groups: {[key: string]: any[]}, prayer) => {
    const dateKey = new Date(prayer.created_at).toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(prayer);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedPrayers).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Determine date category for empty-state subtitle copy
  const getDateCategory = (targetDate: Date): 'today' | 'yesterday' | 'earlier' | 'future' => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const diffMs = startOfToday.getTime() - startOfTarget.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {return 'today';}
    if (diffDays === 1) {return 'yesterday';}
    if (diffDays > 1) {return 'earlier';}
    return 'future';
  };

  const getEmptySubtitle = () => {
    if (hasContent) {return undefined;}
    const category = getDateCategory(selectedDate);
    if (category === 'today') {return 'Shows after completing\ntoday’s devotional and tapping Pray';}
    if (category === 'yesterday') {return 'Shows after completing\nyesterday’s devotional and tapping Pray';}
    if (category === 'earlier') {return 'Shows after completing\nthis day’s devotional and tapping Pray';}
    // Future or fallback
    return 'Complete devotionals to see your prayers here';
  };

  const renderDevotionalPrayers = () => {
    const allPrayers = sortedDates.flatMap(date => groupedPrayers[date]);

    // Determine display limit based on user expansion state
    const displayLimit = userExpanded ? allPrayers.length : 1;
    const displayedPrayers = allPrayers.slice(0, displayLimit);
    const hasMoreItems = allPrayers.length > displayLimit;
    const canShowLess = userExpanded && allPrayers.length > 1;

    if (viewMode === 'carousel') {
      // Vertical stack for carousel view without internal scrolling
      // Show all prayers expanded within the card
      return (
        <View
          style={[
            styles.prayersContainer,
            expanded && styles.prayersContainerExpanded,
          ]}
        >
          {displayedPrayers.map((prayer) => (
            <View style={styles.prayerItem} key={prayer.id}>
              <View style={styles.prayerContentContainer}>
                <ThemedText style={styles.prayerText}>{prayer.content
                    .replace(/Heavenly Father,\s*/i, 'Heavenly Father,\n\n')
                    .replace(
                      (prayer as any).prayer_type === 'guided_playbook'
                        ? /(\n?)(In Jesus'? Name, Amen)/i
                        : /(\n?)(In Jesus'? Name,)\s*(Amen)/i,
                      (prayer as any).prayer_type === 'guided_playbook'
                        ? '\n\n$2'
                        : '\n\n$2\n$3'
                    )
                }</ThemedText>
              </View>
              <View style={styles.metadataContainer}>
                <View style={styles.verticalLine} />
                <View style={styles.metadataContent}>
                  <ThemedText style={styles.fromText} weight="medium">From</ThemedText>
                  {(prayer as any).prayer_type === 'guided_playbook' ? (
                    <ThemedText style={styles.metadataText}>Playbook</ThemedText>
                  ) : prayer.total_days ? (
                    <ThemedText style={styles.metadataText}>
                      {prayer.total_days === 1 ? '1-Day Devotional' : `${prayer.total_days}-Day Devotional Series`}
                    </ThemedText>
                  ) : null}
                  <ThemedText style={styles.devotionalTitle}>{prayer.devotional_title}</ThemedText>
                  {prayer.day_number && prayer.day_title && prayer.day_number > 1 && (
                    <ThemedText style={styles.metadataText}>
                      Day {prayer.day_number}: {prayer.day_title}
                    </ThemedText>
                  )}
                </View>
              </View>
            </View>
          ))}
          {/* Show More / Show Less Button */}
          {(hasMoreItems || canShowLess) && (
            <View style={styles.paginationContainer}>
              <View style={styles.paginationButtonGroup}>
                {hasMoreItems && (
                  <TouchableOpacity
                    style={[styles.paginationButton, styles.showMoreButton]}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setUserExpanded(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                    <ThemedText style={[styles.paginationButtonText, styles.showMoreText]}>
                      Show more
                    </ThemedText>
                  </TouchableOpacity>
                )}
                {canShowLess && (
                  <TouchableOpacity
                    style={[styles.paginationButton, styles.showLessButton]}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setUserExpanded(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-up" size={12} color={Colors.textGray} />
                    <ThemedText style={[styles.paginationButtonText, styles.showLessText]}>
                      Show less
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      );
    } else {
      // Horizontal carousel for inline and moments view - matching Plan carousel with peek
      return (
        <View style={styles.edgeToEdgeContainer}>
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_SIZE}
          snapToAlignment="start"
          decelerationRate="fast"
          pagingEnabled={false}
          directionalLockEnabled={true}
          bounces={true}
          bouncesZoom={false}
          contentContainerStyle={[styles.contentContainerWithPadding, { paddingHorizontal: SIDE_PADDING }]}
          style={styles.horizontalContainer}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            {
              useNativeDriver: true,
              listener: handleScroll,
            }
          )}
          scrollEventThrottle={16}
        >
          {allPrayers.map((prayer, i) => {
            const inputRange = [
              (i - 1) * ITEM_SIZE,
              i * ITEM_SIZE,
              (i + 1) * ITEM_SIZE,
            ];
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.92, 1, 0.92],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.7, 1, 0.7],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={prayer.id}
                style={[
                  styles.horizontalPrayerItemContainer,
                  { transform: [{ scale }], opacity },
                ]}
              >
                <View style={styles.horizontalPrayerItem}>
                  <View style={styles.prayerContentContainer}>
                    <ThemedText style={styles.prayerText}>{prayer.content
                        .replace(/Heavenly Father,\s*/i, 'Heavenly Father,\n\n')
                        .replace(
                          (prayer as any).prayer_type === 'guided_playbook'
                            ? /(\n?)(In Jesus'? Name, Amen)/i
                            : /(\n?)(In Jesus'? Name,)\s*(Amen)/i,
                          (prayer as any).prayer_type === 'guided_playbook'
                            ? '\n\n$2'
                            : '\n\n$2\n$3'
                        )
                    }</ThemedText>
                  </View>
                  <View style={styles.metadataContainer}>
                    <View style={styles.verticalLine} />
                    <View style={styles.metadataContent}>
                      <ThemedText style={styles.fromText} weight="medium">From</ThemedText>
                      {(prayer as any).prayer_type === 'guided_playbook' ? (
                        <ThemedText style={styles.metadataText}>Playbook</ThemedText>
                      ) : prayer.total_days ? (
                        <ThemedText style={styles.metadataText}>
                          {prayer.total_days === 1 ? '1-Day Devotional' : `${prayer.total_days}-Day Devotional Series`}
                        </ThemedText>
                      ) : null}
                      <ThemedText style={styles.devotionalTitle}>{prayer.devotional_title}</ThemedText>
                      {prayer.day_number && prayer.day_title && prayer.day_number > 1 && (
                        <ThemedText style={styles.metadataText}>
                          Day {prayer.day_number}: {prayer.day_title}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
        </View>
      );
    }
  };

  return (
    <ErrorBoundary>
      <JournalCard
        icon={hasContent ? (
          <Ionicons
            name="bookmark"
            size={24}
            color={Colors.alertCoral}
          />
        ) : undefined}
        title={hasContent ? (devotionalPrayers.length === 1 ? 'GUIDED PRAYER' : 'GUIDED PRAYERS') : undefined}
        subtitle={hasContent ? getSubtitle() : undefined}
        variant={variant}
        viewMode={viewMode}
        expanded={expanded}
        onExpand={onExpand}
      >
        {hasContent ? (
          renderDevotionalPrayers()
        ) : (viewMode === 'inline' || viewMode === 'moments') ? null : (
          <View style={styles.emptyStateContainer}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="bookmark"
                size={32}
                color={Colors.textGray}
                style={styles.emptyStateIcon}
              />
              <ThemedText style={styles.sectionLabel} accessibilityRole="text" weight="semiBold">
                GUIDED PRAYERS
              </ThemedText>
            </View>
            <View style={styles.titleContainer}>
              <ThemedText style={styles.emptyStateTitle} weight="semiBold">No Devotional Prayers</ThemedText>
              <ThemedText style={styles.emptyStateSubtitle}>{getEmptySubtitle()}</ThemedText>
            </View>
          </View>
        )}
      </JournalCard>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    // No top margin needed - will be handled by parent
  },
  prayersContainer: {
    // Allow the container to grow naturally to show all prayers
    flexGrow: 0,
    flexShrink: 1,
  },
  prayersContainerExpanded: {
    // No max height; keep for potential future use
  },
  horizontalContainer: {
    // Remove fixed height to allow content to expand
    // height: 200,
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'visible',
  },
  edgeToEdgeContainer: {
    // Break out of JournalCard's 16px horizontal padding to allow true edge-to-edge and peeking
    marginHorizontal: -16,
    paddingHorizontal: 0,
    overflow: 'visible',
  },
  horizontalPrayerItemContainer: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
    paddingHorizontal: 4,
    overflow: 'visible',
    alignItems: 'stretch',
  },
  horizontalPrayerItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Match reflection items' outer container
    padding: 12, // Slightly reduced padding to match reflections
    borderRadius: 24, // Match prayer request's 24px border radius
    minHeight: 180,
    flex: 1,
    justifyContent: 'flex-start',
  },
  prayerTypeSection: {
    marginBottom: 8,
  },
  prayerTypeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  prayerTypeSectionTitle: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },
  verticalPrayerItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Match reflection items' outer container
    padding: 12, // Slightly reduced padding to match reflections
    borderRadius: 24, // Match prayer request's 24px border radius
    marginBottom: 12,
    minHeight: 120, // Ensure consistent height
  },
  prayerItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Match reflection items' outer container
    padding: 12, // Slightly reduced padding to match reflections
    borderRadius: 24, // Match prayer request's 24px border radius
    marginBottom: 12,
    minHeight: 120, // Ensure consistent height
  },
  prayerContentContainer: {
    backgroundColor: 'rgba(26, 60, 109, 0.05)', // Light blue background for prayer content
    borderRadius: 24,
    padding: 12,
    paddingBottom: 8,
    marginBottom: 0,
  },
  metadataContainer: {
    marginBottom: 12,
    marginLeft: 8,
    paddingBottom: 0,
    borderBottomWidth: 0,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 2,
    backgroundColor: Colors.hopeWhite,
    opacity: 0.3,
    marginRight: 12,
    borderRadius: 2,
  },
  metadataContent: {
    flex: 1,
  },
  fromText: {
    fontSize: 10,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 6,
    letterSpacing: 1.5,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  devotionalTitle: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.7,
    marginBottom: 4,
    lineHeight: 16,
  },
  metadataText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.7,
    marginBottom: 2,
    lineHeight: 16,
  },
  prayerText: {
    color: Colors.hopeWhite,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 0,
    fontStyle: 'italic',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 12,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyStateIcon: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    color: Colors.textGray,
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 6,
    opacity: 0.9,
  },
  titleContainer: {
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 20,
  },
  contentContainerWithPadding: {
    paddingHorizontal: CARD_SPACING,
  },
  paginationContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  paginationButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 0,
    paddingTop: 10,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  paginationButtonText: {
    marginLeft: 2,
    fontSize: 11,
    fontFamily: Fonts.medium,
    lineHeight: 14,
  },
  showMoreButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  showMoreText: {
    color: Colors.alertCoral,
  },
  showLessButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  showLessText: {
    color: Colors.textGray,
  },
});

export default DevotionalPrayerListReactQuery;
