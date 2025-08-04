import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
// MaterialCommunityIcons import removed as it's not being used
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
const CARD_WIDTH = screenWidth * 0.75; // Slightly smaller to show next card
const CARD_SPACING = 12; // Increase spacing to show peek of next card
const SIDE_PADDING = 16; // More padding for better peek effect

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
  const { data: devotionalPrayers = [], isLoading, error } = useDevotionalPrayerData(
    user?.id || '',
    dateStr
  );

  // Handle scroll feedback for better UX (must be at top-level)
  const handleScroll = useCallback((_event: any) => {
    // Track scroll position for animation
  }, []);

  // ---- LOGIC AND FUNCTIONS BELOW ----

  console.log('📿 DevotionalPrayerList: Rendering with prayers:', devotionalPrayers.length);

  if (isLoading) {
    return null; // Don't show loading state for devotional prayers
  }

  if (error) {
    console.error('❌ Error loading devotional prayers:', error);
    return null; // Don't show error state for devotional prayers
  }

  const hasContent = devotionalPrayers.length > 0;

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

  const renderDevotionalPrayers = () => {
    const allPrayers = sortedDates.flatMap(date => groupedPrayers[date]);

    if (viewMode === 'carousel') {
      // Vertical stack for carousel view
      return (
        <ScrollView
          style={[
            styles.prayersContainer,
            expanded && styles.prayersContainerExpanded,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {allPrayers.map((prayer) => (
            <View style={styles.prayerItem} key={prayer.id}>
              <View style={styles.prayerContentContainer}>
                <Text style={styles.prayerText}>{prayer.content
                    .replace(/Heavenly Father,\s*/i, 'Heavenly Father,\n\n')
                    .replace(/(\n?)(In Jesus'? Name, Amen)/i, '\n\n$2')
                }</Text>
              </View>
              <View style={styles.metadataContainer}>
                <View style={styles.verticalLine} />
                <View style={styles.metadataContent}>
                  <Text style={styles.fromText}>From</Text>
                  {prayer.total_days && (
                    <Text style={styles.metadataText}>
                      {prayer.total_days === 1 ? '1-Day Devotional' : `${prayer.total_days}-Day Devotional Series`}
                    </Text>
                  )}
                  <Text style={styles.devotionalTitle}>{prayer.devotional_title}</Text>
                  {prayer.day_number && prayer.day_title && prayer.day_number > 1 && (
                    <Text style={styles.metadataText}>
                      Day {prayer.day_number}: {prayer.day_title}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      );
    } else {
      // Horizontal carousel for inline and moments view - matching Plan carousel exactly
      return (
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_SPACING}
          snapToAlignment="start"
          decelerationRate="fast"
          pagingEnabled={false}
          directionalLockEnabled={true}
          bounces={true}
          bouncesZoom={false}
          contentInset={{
            left: SIDE_PADDING / 2,
            right: SIDE_PADDING / 2,
          }}
          contentContainerStyle={{
            paddingHorizontal: SIDE_PADDING,
          }}
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
              (i - 1) * (CARD_WIDTH + CARD_SPACING),
              i * (CARD_WIDTH + CARD_SPACING),
              (i + 1) * (CARD_WIDTH + CARD_SPACING),
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
                    <Text style={styles.prayerText}>{prayer.content
                        .replace(/Heavenly Father,\s*/i, 'Heavenly Father,\n\n')
                        .replace(/(\n?)(In Jesus'? Name, Amen)/i, '\n\n$2')
                    }</Text>
                  </View>
                  <View style={styles.metadataContainer}>
                    <View style={styles.verticalLine} />
                    <View style={styles.metadataContent}>
                      <Text style={styles.fromText}>From</Text>
                      {prayer.total_days && (
                        <Text style={styles.metadataText}>
                          {prayer.total_days === 1 ? '1-Day Devotional' : `${prayer.total_days}-Day Devotional Series`}
                        </Text>
                      )}
                      <Text style={styles.devotionalTitle}>{prayer.devotional_title}</Text>
                      {prayer.day_number && prayer.day_title && prayer.day_number > 1 && (
                        <Text style={styles.metadataText}>
                          Day {prayer.day_number}: {prayer.day_title}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      );
    }
  };

  return (
    <ErrorBoundary>
      <JournalCard
        icon={hasContent ? (
          <Ionicons
            name="bookmarks"
            size={24}
            color={Colors.alertCoral}
          />
        ) : undefined}
        title={hasContent ? (devotionalPrayers.length === 1 ? 'PRAYED DEVO PRAYER' : 'PRAYED DEVO PRAYERS') : undefined}
        subtitle={
          hasContent
            ? viewMode === 'carousel'
              ? devotionalPrayers.length > 1
                ? `${devotionalPrayers.length} Prayers from your devotional`
                : '1 Prayer from your devotional'
              : devotionalPrayers.length > 1
                ? `${devotionalPrayers.length} Prayers from your devotional`
                : '1 Prayer from your devotional'
            : undefined
        }
        variant={variant}
        viewMode={viewMode}
        expanded={expanded}
        onExpand={onExpand}
      >
        {hasContent ? (
          renderDevotionalPrayers()
        ) : viewMode === 'inline' ? null : (
          <View style={styles.emptyStateContainer}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="bookmark"
                size={32}
                color={Colors.mediumGray}
                style={styles.emptyStateIcon}
              />
              <Text style={styles.sectionLabel} accessibilityRole="text">
                PRAYED DEVOTIONAL PRAYERS
              </Text>
            </View>
            <View style={styles.titleContainer}>
              <Text style={styles.emptyStateTitle}>No Devotional Prayers</Text>
              <Text style={styles.emptyStateSubtitle}>
                Complete devotionals to see your prayers here
              </Text>
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
    flex: 1,
    minHeight: 300, // Ensure proper height for carousel view
    maxHeight: 500, // Increased to allow more content
  },
  prayersContainerExpanded: {
    maxHeight: 800, // Allow much more expansion
  },
  horizontalContainer: {
    // Remove fixed height to allow content to expand
    // height: 200,
    flexGrow: 0,
    flexShrink: 0,
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
    borderRadius: 14, // Match reflection's 14px border radius
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
    fontWeight: '600',
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
  },
  prayerItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Match reflection items' outer container
    padding: 12, // Slightly reduced padding to match reflections
    borderRadius: 14, // Match reflection's 14px border radius
    marginBottom: 12,
    minHeight: 120, // Ensure consistent height
  },
  prayerContentContainer: {
    backgroundColor: 'rgba(26, 60, 109, 0.05)', // Light blue background for prayer content
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
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
    marginBottom: 12,
    fontStyle: 'italic',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateIcon: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.mediumGray,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  titleContainer: {
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Fonts.semiBold,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Fonts.regular,
  },
});

export default DevotionalPrayerListReactQuery;
