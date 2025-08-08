import React, { useRef } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useDevotionalOperations } from '../services/hooks/useDevotionalDataSimplified';
import { useAuth } from '../context/IndustryStandardAuthContext';

import { Devotional } from '../interfaces/devotional';
import { format } from 'date-fns';
import { Swipeable, RectButton } from 'react-native-gesture-handler';

import { extractCleanTitle } from '../utils/titleUtils';
import { Colors, Fonts } from '../theme';
import 'react-native-gesture-handler';

type DevotionalsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Devotionals'>;

const DevotionalsScreen = () => {
  const navigation = useNavigation<DevotionalsScreenNavigationProp>();
  const { user } = useAuth();
  const userId = user?.id;
  const {
    devotionals,
    deleteDevotional,
    fetchPlaybookById,
    isLoading,
  } = useDevotionalOperations(userId || '');

  const handleDevotionalPress = (devotional: Devotional) => {
    // Log title extraction for debugging
    createTitleExtractionMemory(devotional);
    navigation.navigate('DevotionalDetail', { devotionalId: devotional.id });
  };

  const handlePlaybookPress = async (playbookId: string) => {
    try {
      const playbookData = await fetchPlaybookById(playbookId);
      if (playbookData) {
        navigation.navigate('PlaybookDetail', { playbook: playbookData });
      }
    } catch (error) {
      console.error('Error fetching playbook:', error);
    }
  };

  const handleDeleteDevotional = async (devotionalId: string) => {
    try {
      await deleteDevotional(devotionalId);
    } catch (error) {
      console.error('Error deleting devotional:', error);
    }
  };

  // Use any type for rowRefs to avoid TypeScript errors with Swipeable
  const rowRefs = useRef<{ [key: string]: any }>({});

  const renderRightActions = (devotionalId: string) => {
    return (
      <RectButton
        style={styles.deleteButton}
        onPress={() => handleDeleteDevotional(devotionalId)}
      >
        <Ionicons name="trash-outline" size={24} color="white" />
      </RectButton>
    );
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'EEEE, MMM d, yyyy').toUpperCase();
  };

  const renderDevotionalItem = ({ item }: { item: Devotional }) => {
    // Calculate progress percentage (0-100)
    const completedDays = item.days?.filter(day => day.completed).length || 0;
    const progress = (completedDays / item.totalDays) * 100;
    // Find the first incomplete day or use the last day if all are complete
    // currentDayIndex was previously calculated but not used
    const isComplete = progress >= 100;
    const formattedDate = formatDate(item.createdAt);

    // Log the entire item for debugging
    console.log('Devotional item:', JSON.stringify(item, null, 2));

    // Format category - handle different possible formats
    const formatCategory = (category: string) => {
      // If it's already a valid category, return it as is
      const validCategories = ['Prayer', 'Growth', 'Healing', 'Wisdom', 'Relationships', 'Purpose', 'Career', 'Finances', 'Mental Health', 'Parenting', 'Health'];
      if (validCategories.includes(category)) {
        return category;
      }
      // Try to extract category from string like "CATEGORY: Relationships"
      const match = category.match(/^(?:category|categories)?[\s:]*([^\s:]+)/i);
      const extracted = match ? match[1] : category;
      // Capitalize first letter
      return extracted.charAt(0).toUpperCase() + extracted.slice(1).toLowerCase();
    };

    // Format category but don't store it since it's not used
    formatCategory(item.category);

    // Use the utility function to extract a clean title
    const cleanTitle = extractCleanTitle(item.title, 'Devotional');

    return (
      <View style={styles.swipeableContainer}>
        <Swipeable
          ref={(ref) => {
            if (ref) {rowRefs.current[item.id] = ref;}
          }}
          renderRightActions={() => renderRightActions(item.id)}
          rightThreshold={40}
          friction={2}
          overshootRight={false}
          containerStyle={styles.swipeableInner}
        >
          <TouchableOpacity
            style={styles.devotionalCard}
            onPress={() => handleDevotionalPress(item)}
            activeOpacity={1}
          >
            <View style={styles.cardContent}>
              {/* Date */}
              <Text style={styles.date}>{formattedDate}</Text>

              {/* Series Title or Devotional Title */}
              <Text style={styles.devotionalTitle} numberOfLines={1}>{cleanTitle}</Text>

              {/* Description */}
              {item.description && (
                <Text style={styles.description} numberOfLines={2}>
                  {item.description.replace(/^CATEGORY:[^\n]*\n?/i, '')}
                </Text>
              )}

              {/* Categories + From Playbook Buttons */}
              <View style={styles.tagRow}>
                <View style={styles.tagList}>
                  {item.category && (
                    <View style={item.playbookId ? styles.categoryBadgeWithPlaybook : styles.categoryBadge}>
                      <Ionicons name="pricetag-outline" size={10} color={Colors.hopeWhite} style={styles.tagIcon} />
                      <Text style={styles.categoryText}>{item.category}</Text>
                    </View>
                  )}
                  {item.playbookId && (
                    <TouchableOpacity
                      style={styles.playbookBadge}
                      onPress={() => handlePlaybookPress(item.playbookId!)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="book-outline" size={12} color={Colors.hopeWhite} style={styles.playbookIcon} />
                      <Text style={styles.playbookText}>From Playbook</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={styles.progressHeader}>
                  <View style={styles.progressLabel}>
                    <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={16} color="rgba(255, 255, 255, 0.8)" style={styles.progressIcon} />
                    <Text style={styles.progressLabelText}>Progress</Text>
                  </View>
                  <Text style={styles.dayCounter}>
                    {completedDays}/{item.totalDays} {item.totalDays === 1 ? 'Day' : 'Days'} Completed
                  </Text>
                </View>
                <View style={styles.progressBarRow}>
                  <View style={styles.progressWrapper}>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${progress}%` }]} />
                    </View>
                  </View>
                </View>
                <View style={styles.nextDayContainer}>
                  {/* Show NEXT: Day X only if not complete, and there is an incomplete day */}
                  {!isComplete && item.days && item.days.some(day => !day.completed) && (() => {
                    const nextIdx = item.days.findIndex(day => !day.completed);
                    if (nextIdx !== -1) {
                      return (
                        <Text style={styles.nextDayText}>
                          NEXT: Day {nextIdx + 1}
                        </Text>
                      );
                    }
                    return null;
                  })()}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </Swipeable>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color={Colors.anchorBlue} />
          <Text style={styles.emptyStateText}>Loading devotionals...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="book-outline" size={64} color={Colors.anchorBlue} />
          <Ionicons name="heart-outline" size={32} color={Colors.faithGold} style={styles.overlayIcon} />
        </View>
        <Text style={styles.emptyStateTitle}>No Devotionals Yet</Text>
        <Text style={styles.emptyStateText}>
          Create a devotional from a playbook to start your spiritual journey.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Devotionals</Text>
      </View>

      <FlatList
        data={devotionals.sort((a: Devotional, b: Devotional) => {
          // Sort by updatedAt in descending order (newest first)
          // Fall back to createdAt if updatedAt is not available
          const dateA = new Date(a.updatedAt || a.createdAt).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt).getTime();
          return dateB - dateA;
        })}
        renderItem={renderDevotionalItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
};

// Create a memory of the title extraction logic for debugging purposes
const createTitleExtractionMemory = (devotional: Devotional) => {
  if (!devotional) {return;}

  console.log('Title extraction debug:', {
    originalTitle: devotional.title,
    extractedTitle: extractCleanTitle(devotional.title),
    devotionalId: devotional.id,
  });
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  swipeableContainer: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 200, // Minimum height
    backgroundColor: Colors.alertCoral, // Match delete button color
  },
  swipeableInner: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.anchorBlue,
  },
  listContent: {
    padding: 16,
    paddingBottom: 2,
  },
  devotionalCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  cardContent: {
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  categoryBadgeWithPlaybook: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  categoryText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '500',
  },
  playbookBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  playbookIcon: {
    marginRight: 4,
  },
  tagIcon: {
    marginRight: 4,
  },
  playbookText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginLeft: 8,
    height: '100%',
  },
  date: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.8,
    lineHeight: 14,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  devotionalTitle: {
    fontSize: 22, // Larger font size for consistency
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    lineHeight: 28, // Increased line height
    paddingVertical: 2,
    fontWeight: '700',
    marginBottom: 8, // Increased margin
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    lineHeight: 20,
  },
  progressBarContainer: {
    width: '100%',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressLabelText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 4,
    fontFamily: Fonts.medium,
  },
  progressIcon: {
    marginRight: 4,
  },
  dayCounter: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: Fonts.medium,
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  nextDayContainer: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  nextDayText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.95)',
    fontFamily: Fonts.medium,
  },
  progressWrapper: {
    flex: 1,
  },
  barBg: {
    width: '100%',
    height: 12, // Thicker bar for better visibility
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,
  },
  progressTextContainer: {
    width: 50,
    alignItems: 'flex-end',
    marginLeft: 0,
  },
  progressText: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.hopeWhite,
    marginRight: 4,
    textAlign: 'right',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  emptyIconContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  overlayIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default DevotionalsScreen;
