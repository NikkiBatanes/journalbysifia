import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, HandHeart as LuHandHeart, X } from 'lucide-react-native';
import { SwipeableTodoItem } from '../SwipeableTodoItem';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useGratitudeData,
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
} from '../../services/hooks/useJournalData';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';

import { ErrorBoundary } from '../ErrorBoundary';
import { GratitudeSkeleton } from '../SkeletonLoader/GratitudeSkeleton';
import { analytics } from '../../utils/analytics';

interface GratitudeItem {
  id: string;
  text: string;
  date: Date;
}

interface GratitudeListProps {
  selectedDate?: Date;
  refreshKey?: number;
  viewMode?: 'carousel' | 'inline' | 'moments';
}

export const GratitudeListReactQuery: React.FC<GratitudeListProps> = ({ selectedDate = new Date(), viewMode }) => {
  // Global edit mode context (only for inline view)
  // Global edit mode context - safe version that handles missing provider
  const globalEditMode = useEditModeSafe();


  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newItems, setNewItems] = useState(['', '', '']); // Three input fields
  const [visibleCount, setVisibleCount] = useState<number>(5);
  const swipeableRefs = React.useRef<{[key: string]: any}>({});

  // Determine if we should be in adding mode
  const shouldShowAddingMode = isAdding || isEditing || (viewMode === 'inline' && globalEditMode?.isGlobalEditMode);

  // Auth and date context
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // React Query hooks with performance tracking
  const loadStartTime = React.useRef<number>(Date.now());
  const { data: gratitudeEntries = [], isLoading, error } = useGratitudeData(user?.id || '', dateStr);


  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();
  const deleteMutation = useDeleteJournalEntry();

  // Debug: Check for multiple entries
  if (gratitudeEntries.length > 1) {
    console.log('🔍 Multiple gratitude entries detected:', {
      count: gratitudeEntries.length,
      entries: gratitudeEntries.map(e => ({ id: e.id, content: e.content })),
    });
  }

  // Transform API data to local GratitudeItem format
  const gratitudeItems: GratitudeItem[] = gratitudeEntries.map(entry => {
    let parsedContent;
    try {
      parsedContent = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
    } catch {
      parsedContent = { items: [] };
    }

    // Handle both single item and items array formats
    if (parsedContent.items && Array.isArray(parsedContent.items)) {
      return parsedContent.items.map((item: any, index: number) => ({
        id: `${entry.id}_${index}`,
        text: typeof item === 'string' ? item : (item.text || String(item)),
        date: selectedDate,
      }));
    } else if (parsedContent.text) {
      return [{
        id: entry.id,
        text: parsedContent.text,
        date: selectedDate,
      }];
    }
    return [];
  }).flat();

  // Track loading performance
  React.useEffect(() => {
    if (!isLoading && gratitudeEntries.length >= 0) {
      const loadTime = Date.now() - loadStartTime.current;

      analytics.trackGratitudeEvent('gratitude_loaded', {
        items_count: gratitudeItems.length,
        load_time_ms: loadTime,
        date: dateStr,
      }, user?.id);
    }
  }, [isLoading, gratitudeEntries.length, gratitudeItems.length, dateStr, user?.id]);

  // Handle loading and error states
  React.useEffect(() => {
    if (error) {
      analytics.trackGratitudeEvent('gratitude_error', {
        error_type: error.message || 'unknown',
        operation: 'load',
        date: dateStr,
      }, user?.id);

      Alert.alert('Error', 'Failed to load gratitude items.');
    }
  }, [error, dateStr, user?.id]);

  // Reset state when date changes
  React.useEffect(() => {
    setNewItems(['', '', '']);
    setIsAdding(false);
    setIsEditing(false);
    setVisibleCount(5);
  }, [dateStr]);

  const startAdding = () => {
    setIsAdding(true);
    setIsEditing(false);
  };

  const startEditing = () => {
    setIsEditing(true);
    setIsAdding(false);

    // Pre-fill with existing gratitude items
    const editFields = gratitudeItems.map(item => item.text);

    // Ensure we have at least 3 fields for editing
    while (editFields.length < 3) {
      editFields.push('');
    }

    setNewItems(editFields);
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setIsEditing(false);
    setNewItems(['', '', '']);
  };

  const addAnotherField = useCallback(() => {
    setNewItems([...newItems, '']);

    // Track field addition
    analytics.trackGratitudeEvent('gratitude_field_added', {
      field_count: newItems.length + 1,
      date: dateStr,
    }, user?.id);
  }, [newItems, dateStr, user?.id]);

  const handleNewItemChange = useCallback((index: number, value: string) => {
    const updatedItems = [...newItems];
    updatedItems[index] = value;
    setNewItems(updatedItems);
  }, [newItems]);

  const closeAllSwipeables = useCallback(() => {
    Object.values(swipeableRefs.current).forEach(ref => {
      if (ref?.close) {ref.close();}
    });
  }, []);

  const handleDeleteGratitudeItem = useCallback((id: string) => {
    Alert.alert(
      'Delete Gratitude Item',
      'Are you sure you want to delete this item?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            swipeableRefs.current[id]?.close();
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Find the original entry that contains this item
              const entryToDelete = gratitudeEntries.find(entry => {
                const parsedContent = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
                return parsedContent.items?.some((item: any, index: number) => `${entry.id}_${index}` === id);
              });

              if (entryToDelete) {
                const parsedContent = typeof entryToDelete.content === 'string' ? JSON.parse(entryToDelete.content) : entryToDelete.content;
                const itemToDelete = parsedContent.items?.find((item: any, index: number) => `${entryToDelete.id}_${index}` === id);
                const updatedItems = parsedContent.items?.filter((item: any, index: number) => `${entryToDelete.id}_${index}` !== id) || [];

                // Track gratitude item deletion
                if (itemToDelete) {
                  analytics.trackGratitudeEvent('gratitude_item_deleted', {
                    item_id: id,
                    item_text_length: itemToDelete.text?.length || 0,
                    date: dateStr,
                  }, user?.id);
                }

                // Always delete the old entry first
                await deleteMutation.mutateAsync(entryToDelete.id);

                // If there are remaining items, create a new entry with them
                if (updatedItems.length > 0) {
                  const itemsToSave = updatedItems.map((item: any, index: number) => ({
                    id: Date.now() + Math.random().toString() + index,
                    text: typeof item === 'string' ? item : (item.text || String(item)),
                    date: selectedDate,
                  }));

                  await createMutation.mutateAsync({
                    user_id: user?.id || '',
                    selected_date: dateStr,
                    content_type: 'gratitude',
                    content: JSON.stringify({ items: itemsToSave }),
                  });
                }
              }
            } catch (deleteError) {
              console.error('Error deleting gratitude item:', deleteError);
              Alert.alert('Error', 'Failed to delete gratitude item. Please try again.');
            }

            // Reset visible count if needed
            if (gratitudeItems.length - 1 <= visibleCount) {
              setVisibleCount(5);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [gratitudeItems, gratitudeEntries, deleteMutation, createMutation, visibleCount, user, selectedDate, dateStr]);

  const saveGratitudeItems = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save gratitude items.');
      return;
    }

    const validItems = newItems.filter(item => item.trim());

    if (validItems.length > 0) {
      try {
        // Prepare the items to save
        const itemsToSave = validItems.map((text, index) => ({
          id: `gratitude_${Date.now()}_${index}`,
          text: text.trim(),
          date: selectedDate,
        }));

        const contentToSave = JSON.stringify({ items: itemsToSave });

        if (gratitudeEntries.length > 0) {
          // Update the first entry with all new content
          await updateMutation.mutateAsync({
            id: gratitudeEntries[0].id,
            updates: {
              content: contentToSave,
            },
          });

          // Delete any extra entries to ensure only one exists
          if (gratitudeEntries.length > 1) {
            for (let i = 1; i < gratitudeEntries.length; i++) {
              try {
                await deleteMutation.mutateAsync(gratitudeEntries[i].id);
              } catch (deleteError) {
                console.error('Error deleting extra gratitude entry:', deleteError);
              }
            }
          }
        } else {
          // Create new entry when none exists
          await createMutation.mutateAsync({
            user_id: user.id,
            selected_date: dateStr,
            content_type: 'gratitude',
            content: contentToSave,
          });
        }

        // Track successful gratitude save
        analytics.trackGratitudeEvent('gratitude_items_saved', {
          items_count: validItems.length,
          total_text_length: validItems.join('').length,
          is_editing: isEditing,
          date: dateStr,
        }, user.id);

        setNewItems(['', '', '']);
        setIsAdding(false);
        setIsEditing(false);
        closeAllSwipeables();

        // Close global edit mode if active
        if (viewMode === 'inline' && globalEditMode?.isGlobalEditMode) {
          globalEditMode.setGlobalEditMode(false);
        }
      } catch (saveError) {
        console.error('Error saving gratitude items:', saveError);
        Alert.alert('Error', 'Failed to save gratitude items. Please try again.');
      }
    }
  };

  const loadMore = useCallback(() => {
    closeAllSwipeables();
    setVisibleCount(prev => Math.min(prev + 5, gratitudeItems.length));
  }, [gratitudeItems.length, closeAllSwipeables]);

  const showLess = useCallback(() => {
    closeAllSwipeables();
    setVisibleCount(5);
  }, [closeAllSwipeables]);

  const displayGratitudeList = () => {
    if (isAdding || isEditing || gratitudeItems.length === 0) {return null;}

    const visibleItems = gratitudeItems.slice(0, visibleCount);
    const hasMore = !isAdding && gratitudeItems.length > visibleCount;
    const showLessOption = !isAdding && visibleCount > 5;

    return (
      <View style={styles.itemsContainer}>
        {visibleItems.map((item, index) => (
        <View
          key={item.id}
          accessibilityRole="text"
          accessibilityLabel={`Gratitude item ${index + 1} of ${visibleItems.length}: ${item.text}`}
          accessibilityHint="Swipe left to delete this gratitude item"
        >
          <SwipeableTodoItem
            ref={(ref: any) => {
              if (ref) {
                swipeableRefs.current[item.id] = ref;
              } else {
                delete swipeableRefs.current[item.id];
              }
            }}
            item={{
              id: item.id,
              text: item.text,
              completed: false,
            }}
            onToggle={() => {}}
            onDelete={() => handleDeleteGratitudeItem(item.id)}
            hideCheckbox={true}
            variant="gratitude"
          >
            <View style={styles.itemRowTopAligned}>
              <View style={styles.itemNumber}>
                <Text style={styles.numberText} accessibilityElementsHidden={true}>{index + 1}</Text>
              </View>
              <Text style={styles.itemText} accessibilityElementsHidden={true}>{String(item.text || '')}</Text>
            </View>
          </SwipeableTodoItem>
        </View>
      ))}
        {!isAdding && gratitudeItems.length > 0 && (
          <View style={styles.paginationContainer}>
            <View style={styles.paginationButtonGroup}>
              {hasMore && (
                <TouchableOpacity
                style={[styles.paginationButton, styles.showMoreButton]}
                onPress={loadMore}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Show more gratitude items. ${gratitudeItems.length - visibleCount} remaining`}
                accessibilityHint="Loads more gratitude items to the list"
              >
                  <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                  <Text style={[styles.paginationButtonText, styles.showMoreText]}>
                    Show more
                  </Text>
                </TouchableOpacity>
              )}
              {showLessOption && (
                <TouchableOpacity
                style={[styles.paginationButton, styles.showLessButton]}
                onPress={showLess}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Show less gratitude items"
                accessibilityHint="Collapses the list to show fewer items"
              >
                  <Ionicons name="chevron-up" size={12} color={Colors.mediumGray} />
                  <Text style={[styles.paginationButtonText, styles.showLessText]}>
                    Show less
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  // Only show loading skeleton if we're loading initial data and have no cached data
  if (isLoading && gratitudeEntries.length === 0) {
    return (
      <ErrorBoundary name="GratitudeListReactQuery">
        <JournalCard
          icon={
            <LuHandHeart
              size={24}
              color={Colors.alertCoral}
              strokeWidth={2.5}
            />
          }
          title="Gratitude List"
          subtitle="Reflect on what you're thankful for"
          showAddButton={true}
          onAdd={() => {}} // Disabled during loading
        >
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Loading gratitude items"
            accessibilityHint="Please wait while your gratitude items are being loaded"
          >
            <GratitudeSkeleton count={3} />
          </View>
        </JournalCard>
      </ErrorBoundary>
    );
  }

  // Hide empty component in inline view
  if (viewMode === 'inline' && !isLoading && !error && gratitudeItems.length === 0) {
    return null;
  }

  return (
    <ErrorBoundary name="GratitudeListReactQuery">
      <JournalCard
      icon={
        <LuHandHeart
          size={24}
          color={Colors.alertCoral}
          strokeWidth={2.5}
        />
      }
      title="Gratitude List"
      subtitle="Reflect on what you're thankful for"
      showAddButton={!shouldShowAddingMode}
      onAdd={gratitudeItems.length > 0 ? startEditing : startAdding}
      isAdding={shouldShowAddingMode}
      viewMode={viewMode}
    >
      <View
        accessibilityRole="list"
        accessibilityLabel={`Gratitude list with ${gratitudeItems.length} items`}
      >
        {displayGratitudeList()}
      </View>
      {shouldShowAddingMode ? (
        <View style={styles.inputContainer}>
          {isEditing ? (
            newItems.map((item, index) => (
              <TextInput
                key={index}
                style={[styles.input, index > 0 && styles.inputWithTopMargin]}
                value={item}
                onChangeText={(value) => handleNewItemChange(index, value)}
                placeholder="I'm grateful for..."
                placeholderTextColor={Colors.mediumGray}
                returnKeyType={index < newItems.length - 1 ? 'next' : 'done'}
                onSubmitEditing={index < newItems.length - 1 ? undefined : saveGratitudeItems}
                accessibilityLabel={`Gratitude item ${index + 1} input`}
                accessibilityHint={'Enter something you\'re grateful for'}
              />
            ))
          ) : (
            <React.Fragment>
              {newItems.map((item, index) => (
                <TextInput
                  key={index}
                  style={[styles.input, index > 0 && styles.inputWithTopMargin]}
                  value={item}
                  onChangeText={(value) => handleNewItemChange(index, value)}
                  placeholder="I'm grateful for..."
                  placeholderTextColor={Colors.mediumGray}
                  returnKeyType={index < newItems.length - 1 ? 'next' : 'done'}
                  onSubmitEditing={index < newItems.length - 1 ? undefined : saveGratitudeItems}
                  accessibilityLabel={`Gratitude item ${index + 1} input`}
                  accessibilityHint={'Enter something you\'re grateful for'}
                />
              ))}
            </React.Fragment>
          )}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={addAnotherField}
              style={[
                styles.button,
                styles.addAnotherButton,
              ]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add another gratitude field"
              accessibilityHint="Adds another input field for gratitude items"
            >
              <View style={styles.plusIcon}>
                <Ionicons name="add" size={16} color={Colors.alertCoral} />
              </View>
            </TouchableOpacity>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                onPress={cancelAdding}
                style={[styles.button, styles.cancelButton]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Cancel adding gratitude items"
                accessibilityHint="Cancels the current gratitude input and closes the form"
              >
                <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveGratitudeItems}
                style={[
                  styles.button,
                  styles.saveButton,
                  !newItems.some(item => item.trim()) && styles.disabledButton,
                ]}
                disabled={!newItems.some(item => item.trim()) || createMutation.isPending || updateMutation.isPending}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Save gratitude items"
                accessibilityHint="Saves your gratitude items and closes the form"
                accessibilityState={{ disabled: !newItems.some(item => item.trim()) || createMutation.isPending || updateMutation.isPending }}
              >
                <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </JournalCard>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
  },
  emptyText: {
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  itemsContainer: {
    width: '100%',
    marginTop: 0, // Reduced from 10 to 4 to match Today's Win component
  },
  paginationContainer: {
    width: '100%',
    paddingVertical: 1,
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
    color: Colors.mediumGray,
  },
  itemRowTopAligned: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginLeft: 4,
    marginTop: 2, // Small adjustment to align with first line of text
  },
  itemText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
    marginRight: 8,
  },
  numberText: {
    color: Colors.alertCoral,
    fontFamily: Fonts.bold,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16, // Ensure vertical centering in the circle
  },
  inputContainer: {
    marginTop: 8,
    gap: 4,
  },
  input: {
    flex: 1,
    height: 40,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.darkGray,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    padding: 10,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  inputWithTopMargin: {
    // No longer needed as gap handles the spacing
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  addAnotherButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.mediumGray,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingText: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 13,
    textAlign: 'center',
    padding: 16,
  },
});
