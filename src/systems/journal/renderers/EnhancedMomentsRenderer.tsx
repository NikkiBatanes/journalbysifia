import React from 'react';
import { View, Text, StyleSheet, SectionList, RefreshControlProps, ScrollView, Dimensions, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JournalPlugin } from '../types';
import { PluginRenderer } from '../PluginRenderer';
import { Colors } from '../../../theme/colors';
import { Fonts } from '../../../theme/fonts';
import { format, startOfMonth } from 'date-fns';
import { GroupingType, SortType } from '../../../components/moments/GroupingControls';
import { DateRange } from '../../../components/moments/DateFilterBar';
import { supabase } from '../../../services/supabaseClient';
import { useAuth } from '../../../context/IndustryStandardAuthContext';

const { width: screenWidth } = Dimensions.get('window');

interface EnhancedMomentsRendererProps {
  plugins: JournalPlugin[];
  dateRange: DateRange;
  refreshKey?: number;
  groupBy: GroupingType;
  sortBy: SortType;
  searchQuery: string;
  style?: any;
  headerComponents?: React.ReactElement[];
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

interface MomentEntry {
  plugin: JournalPlugin;
  date: Date;
  category: string;
  type: string;
}

interface GroupedSection {
  title: string;
  data: MomentEntry[][];  // Array of arrays - each inner array represents a carousel group
  key: string;
}

export const EnhancedMomentsRenderer: React.FC<EnhancedMomentsRendererProps> = ({
  plugins,
  dateRange,
  refreshKey,
  groupBy,
  sortBy,
  searchQuery,
  style,
  headerComponents = [],
  refreshControl,
}) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [realEntries, setRealEntries] = React.useState<MomentEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Fetch real journal entries from Supabase
  const fetchRealEntries = React.useCallback(async () => {
    if (!user) {
      setRealEntries([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const entries: MomentEntry[] = [];

      // Fetch real data from Supabase - only entries with actual content
      try {
        // Fetch prayer journal entries
        const { data: prayers, error: prayersError } = await supabase
          .from('prayers')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!prayersError && prayers && prayers.length > 0) {
          const prayerPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer'));
          if (prayerPlugin) {
            prayers.forEach(prayer => {
              entries.push({
                plugin: prayerPlugin,
                date: new Date(prayer.created_at),
                category: 'Prayer',
                type: 'Prayer Journal',
              });
            });
          }
        }

        // Fetch devotional entries
        const { data: devotionals, error: devotionalsError } = await supabase
          .from('devotionals')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!devotionalsError && devotionals && devotionals.length > 0) {
          const devotionalPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('devotional'));
          if (devotionalPlugin) {
            devotionals.forEach(devotional => {
              entries.push({
                plugin: devotionalPlugin,
                date: new Date(devotional.created_at),
                category: 'Devotional',
                type: 'Devotional Prayer',
              });
            });
          }
        }

        // Fetch playbooks (affirmations)
        const { data: playbooks, error: playbooksError } = await supabase
          .from('playbooks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!playbooksError && playbooks && playbooks.length > 0) {
          const playbookPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('playbook'));
          if (playbookPlugin) {
            playbooks.forEach(playbook => {
              entries.push({
                plugin: playbookPlugin,
                date: new Date(playbook.created_at),
                category: 'Affirmations',
                type: 'Daily Affirmation',
              });
            });
          }
        }

      } catch (dbError) {
        console.log('Database query error:', dbError);
        // If database queries fail, don't show any entries
      }

      // Only set entries if we have real content
      setRealEntries(entries);
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      setRealEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user, plugins]);

  // Fetch entries when component mounts or dependencies change
  React.useEffect(() => {
    fetchRealEntries();
  }, [fetchRealEntries, refreshKey]);

  // Generate moment entries from real data
  const generateMomentEntries = React.useMemo(() => {
    // Filter by search query if provided
    if (searchQuery.trim()) {
      return realEntries.filter(entry => 
        entry.plugin.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return realEntries;
  }, [realEntries, searchQuery]);

  // Sort entries
  const sortedEntries = React.useMemo(() => {
    const sorted = [...generateMomentEntries];

    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => b.date.getTime() - a.date.getTime());
      case 'oldest':
        return sorted.sort((a, b) => a.date.getTime() - b.date.getTime());
      case 'category':
        return sorted.sort((a, b) => {
          if (a.category === b.category) {
            return b.date.getTime() - a.date.getTime();
          }
          return a.category.localeCompare(b.category);
        });
      case 'type':
        return sorted.sort((a, b) => {
          if (a.type === b.type) {
            return b.date.getTime() - a.date.getTime();
          }
          return a.plugin.title.localeCompare(b.plugin.title);
        });
      default:
        return sorted;
    }
  }, [generateMomentEntries, sortBy]);

  // Group entries with carousel support
  const groupedSections = React.useMemo((): GroupedSection[] => {
    if (groupBy === 'none') {
      // For 'none' grouping, create carousel groups by type within the single section
      const typeGroups: Record<string, MomentEntry[]> = {};
      
      sortedEntries.forEach((entry) => {
        const typeKey = entry.type;
        if (!typeGroups[typeKey]) {
          typeGroups[typeKey] = [];
        }
        typeGroups[typeKey].push(entry);
      });

      const carouselData = Object.values(typeGroups);
      
      return [{
        title: 'All Moments',
        data: carouselData,
        key: 'all',
      }];
    }

    const groups: Record<string, MomentEntry[]> = {};

    sortedEntries.forEach((entry) => {
      let groupKey: string;

      switch (groupBy) {
        case 'date':
          groupKey = format(entry.date, 'yyyy-MM-dd');
          break;
        case 'month':
          groupKey = format(startOfMonth(entry.date), 'yyyy-MM');
          break;
        case 'category':
          groupKey = entry.category;
          break;
        case 'type':
          groupKey = entry.type;
          break;
        default:
          groupKey = 'default';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(entry);
    });

    // Convert to sections array with carousel support
    const sections = Object.entries(groups).map(([key, entries]) => {
      let title = key;

      // For date grouping, create carousel groups by type within each date
      if (groupBy === 'date') {
        const typeGroups: Record<string, MomentEntry> = {};
        
        entries.forEach((entry) => {
          const typeKey = entry.type;
          // Only keep the most recent entry for each type on this date
          if (!typeGroups[typeKey] || entry.date > typeGroups[typeKey].date) {
            typeGroups[typeKey] = entry;
          }
        });

        // Convert to array of single entries (one per type)
        const carouselData = Object.values(typeGroups).map(entry => [entry]);
        
        // Get proper title for date grouping
        if (entries.length > 0) {
          const firstEntry = entries[0];
          title = format(firstEntry.date, 'EEEE, MMMM d, yyyy');
        }
        
        return {
          title,
          data: carouselData,
          key,
        };
      }

      // For other grouping types, just wrap entries in array for consistency
      // Get proper title for the group
      if (entries.length > 0) {
        const firstEntry = entries[0];
        switch (groupBy) {
          case 'month':
            title = format(firstEntry.date, 'MMMM yyyy');
            break;
          case 'category':
            title = firstEntry.category.charAt(0).toUpperCase() + firstEntry.category.slice(1);
            break;
          case 'type':
            title = firstEntry.plugin.title;
            break;
        }
      }
      
      return {
        title,
        data: [entries],
        key,
      };
    });

    // Sort sections
    return sections.sort((a, b) => {
      if (groupBy === 'date' || groupBy === 'month') {
        // Sort by date (newest first for date grouping)
        const aFirstGroup = a.data[0];
        const bFirstGroup = b.data[0];
        const aDate = aFirstGroup && aFirstGroup.length > 0 ? aFirstGroup[0].date : new Date(0);
        const bDate = bFirstGroup && bFirstGroup.length > 0 ? bFirstGroup[0].date : new Date(0);
        return sortBy === 'oldest' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
      }
      // Sort alphabetically for category/type
      return a.title.localeCompare(b.title);
    });
  }, [sortedEntries, groupBy, sortBy]);

  const renderSectionHeader = ({ section }: { section: GroupedSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>
        {section.data.length} {section.data.length === 1 ? 'entry' : 'entries'}
      </Text>
    </View>
  );

  // Render carousel item (group of entries of the same type)
  const renderCarouselItem = ({ item: carouselGroup, index }: { item: MomentEntry[]; index: number }) => {
    if (!carouselGroup || carouselGroup.length === 0) return null;

    const firstEntry = carouselGroup[0];
    const isDevotional =
      (firstEntry.category && firstEntry.category.toLowerCase().includes('devotional')) ||
      (firstEntry.type && firstEntry.type.toLowerCase().includes('devotional'));
    
    // Special full-bleed carousel for Devotional
    if (isDevotional) {
      const { width } = Dimensions.get('window');
      const ITEM_WIDTH = Math.round(width); // Rounded to avoid sub-pixel gaps on iOS
      const JOURNAL_SIDE_PAD = 16; // matches devoHeaderContainer paddingHorizontal
      const baseLeftBreakout = (insets?.left || 0) + JOURNAL_SIDE_PAD;
      const baseRightBreakout = (insets?.right || 0) + JOURNAL_SIDE_PAD;
      const EDGE_OVERDRAW = 2; // eliminate tiny edges on high-DPI devices
      const leftBreakout = baseLeftBreakout + EDGE_OVERDRAW;
      const rightBreakout = baseRightBreakout + EDGE_OVERDRAW;

      return (
        <View style={styles.carouselContainer}>
          {/* Fixed header (time + tag) stays put and aligns with Prayer Journal */}
          <View style={styles.devoHeaderContainer}>
            <View style={styles.momentHeader}>
              <Text style={styles.momentDate}>{format(firstEntry.date, 'h:mm a')}</Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{firstEntry.category.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* True edge-to-edge carousel */}
          <View style={[styles.devoEdgeToEdge, { marginLeft: -leftBreakout, marginRight: -rightBreakout }]}>
            <FlatList
              horizontal
              data={carouselGroup}
              keyExtractor={(entry, idx) => `${entry.plugin.id}-${idx}`}
              showsHorizontalScrollIndicator={false}
              bounces={false}
              nestedScrollEnabled
              removeClippedSubviews={false}
              pagingEnabled
              decelerationRate="fast"
              snapToAlignment="start"
              disableIntervalMomentum
              contentInsetAdjustmentBehavior="never"
              automaticallyAdjustContentInsets={false}
              contentInset={{ left: 0, right: 0, top: 0, bottom: 0 }}
              scrollIndicatorInsets={{ left: 0, right: 0, top: 0, bottom: 0 }}
              ListHeaderComponent={<View style={{ width: leftBreakout }} />}
              ListFooterComponent={<View style={{ width: rightBreakout }} />}
              contentContainerStyle={{}}
              snapToOffsets={carouselGroup.map((_, i) => leftBreakout + i * ITEM_WIDTH)}
              getItemLayout={(_, index) => ({ length: ITEM_WIDTH, offset: ITEM_WIDTH * index, index })}
              renderItem={({ item: entry, index: entryIndex }) => (
                <View style={[
                  styles.devoCarouselItem,
                  { width: ITEM_WIDTH + leftBreakout + rightBreakout, marginLeft: -leftBreakout }
                ]}>
                  <View style={styles.devoFullWidthCard}>
                    <PluginRenderer
                      plugin={entry.plugin}
                      selectedDate={entry.date}
                      refreshKey={refreshKey}
                      viewMode="inline"
                    />
                  </View>
                </View>
              )}
              style={{ width: ITEM_WIDTH + leftBreakout + rightBreakout }}
            />
          </View>

          {carouselGroup.length > 1 && (
            <View style={styles.paginationContainer}>
              {carouselGroup.map((_, dotIndex) => (
                <View key={dotIndex} style={[styles.paginationDot, dotIndex === 0 && styles.paginationDotActive]} />
              ))}
            </View>
          )}
        </View>
      );
    }
    
    return (
      <View style={styles.carouselContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          style={styles.carousel}
          contentContainerStyle={styles.carouselContent}
        >
          {carouselGroup.map((entry, entryIndex) => (
            <View key={`${entry.plugin.id}-${entryIndex}`} style={styles.carouselItem}>
              <View style={styles.momentItem}>
                <View style={styles.momentContent}>
                  <View style={styles.momentHeader}>
                    <Text style={styles.momentDate}>
                      {format(entry.date, 'h:mm a')}
                    </Text>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>
                        {entry.category.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <PluginRenderer
                    plugin={entry.plugin}
                    selectedDate={entry.date}
                    refreshKey={refreshKey}
                    viewMode="inline"
                  />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
        
        {/* Pagination dots if more than one item */}
        {carouselGroup.length > 1 && (
          <View style={styles.paginationContainer}>
            {carouselGroup.map((_, dotIndex) => (
              <View 
                key={dotIndex} 
                style={[
                  styles.paginationDot,
                  dotIndex === 0 && styles.paginationDotActive
                ]} 
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No moments found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? `No entries match "${searchQuery}" in the selected date range`
          : 'No journal entries found for the selected date range'
        }
      </Text>
    </View>
  );

  // Filter sections to only show those with content
  const sectionsWithContent = React.useMemo(() => {
    return groupedSections.map(section => ({
      ...section,
      data: section.data.filter(carouselGroup => {
        // Filter out empty carousel groups
        if (!carouselGroup || carouselGroup.length === 0) return false;
        
        // Show all entries that have valid plugins - don't filter by specific plugin IDs
        return carouselGroup.some(entry => 
          entry && entry.plugin && entry.plugin.id && entry.plugin.title
        );
      })
    })).filter(section => section.data.length > 0);
  }, [groupedSections]);

  if (sectionsWithContent.length === 0) {
    return (
      <View style={[styles.container, style]}>
        {/* Always show header components (filters) even in empty state */}
        {headerComponents.length > 0 && (
          <View>
            {headerComponents.map((component, index) => (
              <View key={index}>{component}</View>
            ))}
          </View>
        )}
        {renderEmptyState()}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <SectionList
        sections={sectionsWithContent}
        renderItem={renderCarouselItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item, index) => `carousel-${index}-${item.length > 0 ? item[0].plugin.id : 'empty'}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={true}
        ListHeaderComponent={
          headerComponents.length > 0 ? (
            <View>
              {headerComponents.map((component, index) => (
                <View key={index}>{component}</View>
              ))}
            </View>
          ) : undefined
        }
        refreshControl={refreshControl}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.anchorBlue,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
  },
  sectionCount: {
    fontSize: 12,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
  },
  momentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timelineIndicator: {
    alignItems: 'center',
    marginRight: 16,
    paddingTop: 8,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.alertCoral,
    marginBottom: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 40,
  },
  momentContent: {
    flex: 1,
  },
  momentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  momentDate: {
    fontSize: 12,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 10,
    color: Colors.alertCoral,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    fontFamily: Fonts.regular,
  },
  carouselContainer: {
    marginBottom: 16,
  },
  carousel: {
    flexGrow: 0,
  },
  carouselContent: {
    paddingHorizontal: 8,
  },
  carouselItem: {
    width: screenWidth - 32,
    marginHorizontal: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: Colors.alertCoral,
  },
  // Devotional-specific carousel styling (center-snap like onboarding)
  devoCarouselContent: {
    paddingVertical: 0,
  },
  devoCarouselItem: {
    marginVertical: 0,
    marginHorizontal: 0,
    paddingHorizontal: 0,
    alignSelf: 'stretch',
  },
  devoFullWidthCard: {
    width: '100%',
    flex: 1,
    paddingHorizontal: 0,
  },
  devoHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  devoEdgeToEdge: {
    // Break out of the header padding so the FlatList can render full-bleed
    marginHorizontal: -16,
    alignSelf: 'stretch',
    overflow: 'visible',
  },

});
