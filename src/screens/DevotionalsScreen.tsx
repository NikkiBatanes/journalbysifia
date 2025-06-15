import React, { useRef } from 'react';
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
import { useDevotional } from '../context/DevotionalContext';

import { Devotional } from '../interfaces/devotional';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Fonts } from '../theme';
import { format } from 'date-fns';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import 'react-native-gesture-handler';

type DevotionalsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Devotionals'>;

const DevotionalsScreen = () => {
  const navigation = useNavigation<DevotionalsScreenNavigationProp>();
  const { devotionals, deleteDevotional, fetchPlaybookById, isLoading } = useDevotional();

  const handleDevotionalPress = (devotional: Devotional) => {
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
    const progress = item.progress; // Already comes as a percentage from the backend

    // Find the first incomplete day or use the last day if all are complete
    const currentDayIndex = item.days?.findIndex(day => !day.completed) ?? -1;
    const completedDays = item.days?.filter(day => day.completed).length || 0;
    const currentDay = currentDayIndex >= 0 ? currentDayIndex + 1 : item.totalDays;
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

    const displayCategory = formatCategory(item.category);

    // Remove prefixes from title
    const cleanTitle = item.title.replace(/^(?:DEVOTIONAL|SERIES)\s*TITLE:\s*/i, '');

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
              <Text style={styles.date}>{formattedDate}</Text>

              <Text style={styles.devotionalTitle} numberOfLines={1}>{cleanTitle}</Text>

              {item.description && (
                <Text style={styles.description} numberOfLines={2}>
                  {item.description.replace(/^CATEGORY:[^\n]*\n?/i, '')}
                </Text>
              )}

              <View style={styles.tagRow}>
                <TouchableOpacity style={styles.categoryBadge}>
                  <Ionicons name="pricetag-outline" size={12} color={Colors.hopeWhite} style={styles.playbookIcon} />
                  <Text style={styles.categoryText}>
                    {displayCategory}
                  </Text>
                </TouchableOpacity>

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

              <View style={styles.progressBarContainer}>
                <View style={styles.progressHeader}>
                  <View style={styles.progressLabel}>
                    <Ionicons name="time-outline" size={14} color="rgba(255, 255, 255, 0.8)" style={styles.progressIcon} />
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
                  {!isComplete && currentDay < item.totalDays && (
                    <Text style={styles.nextDayText}>
                      NEXT: Day {currentDay + 1}
                    </Text>
                  )}
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
        data={devotionals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
        renderItem={renderDevotionalItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
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
    height: 200, // Increased height
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
    height: 200, // Increased height
    position: 'relative',
  },
  cardContent: {
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8, // Reduced bottom margin
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '500',
  },
  playbookBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playbookIcon: {
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
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    lineHeight: 24,
    paddingVertical: 1,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
    lineHeight: 20,
  },
  progressBarContainer: {
    width: '100%',
    marginTop: 16,
    marginHorizontal: -4, // Extend beyond parent's padding
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 4, // Compensate for negative margin
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
    fontWeight: '600',
    marginTop: 4,
  },
  progressWrapper: {
    flex: 1,
  },
  barBg: {
    width: '100%',
    height: 10, // Slightly thicker bar
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 4,
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
