import React from 'react';
import { View, Text, StyleSheet, SectionList, RefreshControlProps } from 'react-native';
import { JournalPlugin } from '../types';
import { PluginRenderer } from '../PluginRenderer';
import { Colors } from '../../../theme/colors';
import { Fonts } from '../../../theme/fonts';
import { format, startOfMonth } from 'date-fns';
import { GroupingType, SortType } from '../../../components/moments/GroupingControls';
import { DateRange } from '../../../components/moments/DateFilterBar';

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
  data: MomentEntry[];
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
  // Generate moment entries for date range
  const generateMomentEntries = React.useMemo(() => {
    const entries: MomentEntry[] = [];
    const currentDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    while (currentDate <= endDate) {
      plugins.forEach((plugin) => {
        // Filter by search query if provided
        if (searchQuery && !plugin.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !plugin.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())) {
          return;
        }

        entries.push({
          plugin,
          date: new Date(currentDate),
          category: plugin.category,
          type: plugin.id,
        });
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return entries;
  }, [plugins, dateRange, searchQuery]);

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

  // Group entries
  const groupedSections = React.useMemo((): GroupedSection[] => {
    if (groupBy === 'none') {
      return [{
        title: 'All Moments',
        data: sortedEntries,
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

    // Convert to sections array
    const sections = Object.entries(groups).map(([key, data]) => {
      let title = key;

      // Get proper title for the group
      if (data.length > 0) {
        const firstEntry = data[0];
        switch (groupBy) {
          case 'date':
            title = format(firstEntry.date, 'EEEE, MMMM d, yyyy');
            break;
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
        data,
        key,
      };
    });

    // Sort sections
    return sections.sort((a, b) => {
      if (groupBy === 'date' || groupBy === 'month') {
        // Sort by date (newest first for date grouping)
        const aDate = a.data[0]?.date || new Date(0);
        const bDate = b.data[0]?.date || new Date(0);
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

  const renderMomentItem = ({ item, index }: { item: MomentEntry; index: number }) => (
    <View style={styles.momentItem}>
      <View style={styles.timelineIndicator}>
        <View style={styles.timelineDot} />
        {index < (groupedSections.find(s => s.data.includes(item))?.data.length || 0) - 1 && (
          <View style={styles.timelineLine} />
        )}
      </View>

      <View style={styles.momentContent}>
        <View style={styles.momentHeader}>
          <Text style={styles.momentDate}>
            {format(item.date, 'MMM d, yyyy')}
          </Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {item.category.toUpperCase()}
            </Text>
          </View>
        </View>

        <PluginRenderer
          plugin={item.plugin}
          selectedDate={item.date}
          refreshKey={refreshKey}
          viewMode="moments"
        />
      </View>
    </View>
  );

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

  if (groupedSections.length === 0 || groupedSections.every(s => s.data.length === 0)) {
    return renderEmptyState();
  }

  return (
    <View style={[styles.container, style]}>
      <SectionList
        sections={groupedSections}
        renderItem={renderMomentItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item, index) => `${item.plugin.id}-${format(item.date, 'yyyy-MM-dd')}-${index}`}
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
    lineHeight: 20,
  },
});
