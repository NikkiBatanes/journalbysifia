import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format, startOfDay, addMinutes, isSameDay, parseISO } from 'date-fns';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

const PIXELS_PER_MINUTE = 2;

export interface TimeBlockItem {
  id: string;
  title: string;
  category: string;
  startTime: Date | string;
  endTime: Date | string;
  notes?: string;
  location?: string;
  isAllDay?: boolean;
  _column?: number;
  _totalColumns?: number;
  repeat?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'biweekly' | 'never';
    endDate?: Date | string;
    customDays?: number[];
    customFrequency?: {
      value: number;
      unit: 'day' | 'week' | 'month' | 'year';
    };
  };
}

interface ScheduleContentProps {
  selectedDate?: Date;
}

const formatTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'h:mm a');
};

const getOffsetY = (date: Date | string) => {
  const d = date instanceof Date ? date : new Date(date);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  return (hours * 60 + minutes) * PIXELS_PER_MINUTE;
};

const getBlockHeight = (start: Date | string, end: Date | string) => {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffMins = Math.max(30, Math.round(diffMs / (1000 * 60))); // Minimum 30 mins
  return diffMins * PIXELS_PER_MINUTE;
};

const getCategoryColor = (category: string) => {
  const colors = {
    work: Colors.anchorBlue,
    personal: Colors.growthGreen,
    health: Colors.alertCoral,
    learning: Colors.faithGold,
    other: Colors.devotionalPurple,
  };
  return colors[category as keyof typeof colors] || Colors.textGray;
};

export const ScheduleContent: React.FC<ScheduleContentProps> = ({ selectedDate = new Date() }) => {
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const selectedDateStr = React.useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  useEffect(() => {
    let isMounted = true;

    const fetchTimeBlocks = async () => {
      if (!isMounted) {return;}

      try {
        console.log('[ScheduleContent] Fetching time blocks...');
        setIsLoading(true);

        const storedBlocks = await AsyncStorage.getItem('@timeBlocks');
        console.log('[ScheduleContent] Raw data from storage:', storedBlocks ? 'Data exists' : 'No data');

        if (!isMounted) {return;}

        let allBlocks: TimeBlockItem[] = [];

        try {
          if (storedBlocks) {
            const parsed = JSON.parse(storedBlocks);
            console.log('[ScheduleContent] Successfully parsed blocks:', Array.isArray(parsed) ? `Found ${parsed.length} blocks` : 'Not an array');
            allBlocks = Array.isArray(parsed) ? parsed : [];
          } else {
            console.log('[ScheduleContent] No blocks found in storage');
            allBlocks = [];
          }
        } catch (parseError) {
          console.error('[ScheduleContent] Error parsing time blocks:', parseError);
          if (isMounted) {
            Alert.alert('Error', 'Failed to load schedule data. Please try again.');
          }
          allBlocks = [];
        }

        if (!isMounted) {return;}

        const processedBlocks = processTimeBlocks(allBlocks);

        if (isMounted) {
          console.log(`[ScheduleContent] Successfully processed ${processedBlocks.length} blocks`);

          const filteredBlocks = processedBlocks.filter(block => {
            const blockDate = block.startTime instanceof Date ? block.startTime : new Date(block.startTime);
            return isSameDay(blockDate, selectedDate);
          });

          setTimeBlocks(filteredBlocks);
        }
      } catch (error) {
        console.error('[ScheduleContent] Error fetching time blocks:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTimeBlocks();

    return () => {
      isMounted = false;
    };
  }, [selectedDateStr, selectedDate]);

  // Update current time every minute
  useEffect(() => {
    // Update immediately
    const updateTime = () => setCurrentTime(new Date());
    updateTime();

    // Then update every minute
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, [selectedDate]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  console.log('Rendering with timeBlocks:', timeBlocks);

  if (timeBlocks.length === 0) {
    console.log('No time blocks found for the selected date');
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.timelineContainer, styles.timelineBlocksContainer]}>
          <View style={styles.timelineHours}>
            {Array.from({ length: 24 }).map((_, idx) => {
              const hour = idx;
              return (
                <View key={hour} style={styles.timelineHourRow}>
                  <Text style={styles.timelineHourText}>{hour % 12 === 0 ? 12 : hour % 12} {hour < 12 ? 'AM' : 'PM'}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.timelineBlocks}>
            {timeBlocks.map((block, idx) => {
              // Ensure we have Date objects
              const blockStart = block.startTime instanceof Date ? block.startTime : new Date(block.startTime);
              const blockEnd = block.endTime instanceof Date ? block.endTime : new Date(block.endTime);

              // Create a copy of the selected date to avoid mutating the original
              const selectedDateStart = new Date(selectedDate);
              selectedDateStart.setHours(0, 0, 0, 0);

              const selectedDateEnd = new Date(selectedDate);
              selectedDateEnd.setHours(23, 59, 59, 999);

              // Skip if block is completely outside the selected date
              if (blockEnd <= selectedDateStart || blockStart >= selectedDateEnd) {
                console.log('[ScheduleContent] Block excluded:', block.title, formatTime(blockStart), '-', formatTime(blockEnd));
                return null;
              }

              // Clamp block times to the selected date
              const clampedStart = blockStart < selectedDateStart ? new Date(selectedDateStart) : new Date(blockStart);
              const clampedEnd = blockEnd > selectedDateEnd ? new Date(selectedDateEnd) : new Date(blockEnd);
              const offsetY = getOffsetY(clampedStart);
              const blockHeight = getBlockHeight(clampedStart, clampedEnd);
              const blockColor = getCategoryColor(block.category);

              const columnWidth = 100 / (block._totalColumns || 1);
              const left = (columnWidth * (block._column || 0));
              const width = columnWidth - 2; // 2% margin between blocks

              return (
                <TouchableOpacity
                  key={block.id || idx}
                  style={[
                    styles.timelineBlock,
                    {
                      left: `${left}%`,
                      width: `${width}%`,
                      top: offsetY,
                      height: blockHeight,
                      backgroundColor: `${blockColor}22`,
                      borderLeftColor: blockColor,
                      shadowColor: blockColor,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.blockRow}>
                    <View style={[styles.categoryDot, { backgroundColor: blockColor }]} />
                    <Text style={styles.blockTitleModern}>{block.title}</Text>
                  </View>
                  <Text style={styles.blockTimeModern}>
                    {formatTime(block.startTime)} - {formatTime(block.endTime)}
                  </Text>
                  {block.notes ? (
                    <Text style={styles.blockNotesModern} numberOfLines={1}>{block.notes}</Text>
                  ) : null}
                  <Text style={styles.blockCategoryModern}>{block.category}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isSameDay(currentTime, selectedDate) && (
            <View style={[styles.currentTimeIndicator, { top: getOffsetY(currentTime) }]}>
              <View style={styles.currentTimeDot} />
              <Text style={styles.currentTimeText}>{formatTime(currentTime)}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
            <Text style={styles.fabText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
};

const processTimeBlocks = (blocks: TimeBlockItem[]): TimeBlockItem[] => {
  // First, ensure all blocks have proper Date objects
  const validBlocks = blocks
    .map(block => ({
      ...block,
      startTime: block.startTime instanceof Date ? block.startTime : new Date(block.startTime),
      endTime: block.endTime instanceof Date ? block.endTime : new Date(block.endTime),
    }))
    .filter(block => {
      const isValidStart = block.startTime instanceof Date && !isNaN(block.startTime.getTime());
      const isValidEnd = block.endTime instanceof Date && !isNaN(block.endTime.getTime());
      return isValidStart && isValidEnd;
    });

  // Sort blocks by start time
  const sortedBlocks = [...validBlocks].sort((a, b) => {
    const aStart = a.startTime instanceof Date ? a.startTime : new Date(a.startTime);
    const bStart = b.startTime instanceof Date ? b.startTime : new Date(b.startTime);
    return aStart.getTime() - bStart.getTime();
  });

  // Group overlapping blocks
  const groups: TimeBlockItem[][] = [];

  sortedBlocks.forEach(block => {
    let added = false;

    // Try to add to existing group
    for (const group of groups) {
      const overlaps = group.some(b => {
        const blockStart = block.startTime instanceof Date ? block.startTime : new Date(block.startTime);
        const blockEnd = block.endTime instanceof Date ? block.endTime : new Date(block.endTime);
        const bStart = b.startTime instanceof Date ? b.startTime : new Date(b.startTime);
        const bEnd = b.endTime instanceof Date ? b.endTime : new Date(b.endTime);

        return (blockStart.getTime() >= bStart.getTime() && blockStart.getTime() < bEnd.getTime()) ||
               (bStart.getTime() >= blockStart.getTime() && bStart.getTime() < blockEnd.getTime());
      });

      if (overlaps) {
        group.push(block);
        added = true;
        break;
      }
    }

    // If no overlapping group found, create new group
    if (!added) {
      groups.push([block]);
    }
  });

  // Assign column positions to each block
  return sortedBlocks.map(block => {
    const group = groups.find(g => g.includes(block)) || [block];
    const indexInGroup = group.indexOf(block);
    const totalInGroup = group.length;

    return {
      ...block,
      _column: indexInGroup,
      _totalColumns: totalInGroup,
    };
  });
};

const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 40,
  },

  // Timeline
  timelineContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  timelineContent: {
    minHeight: 900,
  },
  timelineBlockContainer: {
    minHeight: 900,
  },
  timelineBlocksContainer: {
    minHeight: 900,
  },
  timelineHours: {
    width: 60,
  },
  timelineHourRow: {
    height: 60,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  timelineHourText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'right',
    paddingRight: 8,
    marginTop: 10,
  },
  emptyTextSmall: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textGray,
  },
  timelineBlocks: {
    flex: 1,
    marginLeft: 10,
  },

  // Time Block
  timelineBlock: {
    position: 'absolute',
    padding: 12,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    marginRight: '2%',
    borderLeftWidth: 5,
    zIndex: 1,
    elevation: 3,
  },
  blockStyle: {
    zIndex: 1,
    elevation: 3,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blockTitleModern: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.darkGray,
    flex: 1,
  },
  blockTimeModern: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textGray,
    marginBottom: 2,
  },
  blockNotesModern: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textGray,
    marginBottom: 2,
  },
  blockCategoryModern: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.anchorBlue,
    marginTop: 2,
  },

  // Current Time Indicator
  currentTimeIndicator: {
    position: 'absolute',
    left: 70,
    right: 20,
    height: 2,
    backgroundColor: Colors.alertCoral,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
  },
  currentTimeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.alertCoral,
    marginLeft: 0,
    marginRight: 6,
  },
  currentTimeText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.alertCoral,
  },

  // FAB (Floating Action Button)
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  fabText: {
    color: 'white',
    fontSize: 32,
    fontFamily: Fonts.bold,
    marginTop: -2,
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.darkGray,
    fontFamily: Fonts.regular,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    padding: 30,
  },
  emptyText: {
    color: Colors.darkGray,
    fontFamily: Fonts.regular,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Category Dot
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
});

export default ScheduleContent;
