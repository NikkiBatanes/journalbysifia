import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, HandHeart as LuHandHeart, X } from 'lucide-react-native';
import { SwipeableTodoItem } from '../SwipeableTodoItem';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useGratitudeData,
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
} from '../../services/hooks/useJournalData';
import { ComponentErrorBoundary } from '../ErrorBoundary';
import { GratitudeSkeleton } from '../SkeletonLoader/GratitudeSkeleton';
import { analytics } from '../../utils/analytics';

interface GratitudeItem {
  id: string;
  text: string;
  date: Date;
}

interface GratitudeListProps {
  selectedDate?: Date;
}

export const GratitudeListReactQuery: React.FC<GratitudeListProps> = ({ selectedDate = new Date() }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newItems, setNewItems] = useState(['', '', '']); // Three input fields
  const [visibleCount, setVisibleCount] = useState<number>(5);
  const swipeableRefs = React.useRef<{[key: string]: any}>({});

  // Auth and date context
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // React Query hooks with performance tracking
  const loadStartTime = React.useRef<number>(Date.now());
  const { data: gratitudeEntries = [], isLoading, error } = useGratitudeData(user?.id || '', dateStr);
  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();
  const deleteMutation = useDeleteJournalEntry();

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
        text: item.text || item,
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
    const editFields = gratitudeItems.map(item => item.text);
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

              if (updatedItems.length === 0) {
                // Delete the entire entry if no items left
                deleteMutation.mutate(entryToDelete.id);
              } else {
                // Update the entry with remaining items
                updateMutation.mutate({
                  id: entryToDelete.id,
                  updates: {
                    content: JSON.stringify({ items: updatedItems }),
                  },
                });
              }
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
  }, [gratitudeItems, gratitudeEntries, deleteMutation, updateMutation, visibleCount]);

  const saveGratitudeItems = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save gratitude items.');
      return;
    }

    const validItems = newItems.filter(item => item.trim());

    if (validItems.length > 0) {
      try {
        if (isEditing && gratitudeEntries.length > 0) {
          // Update existing entry
          const existingEntry = gratitudeEntries[0];
          const itemsToSave = validItems.map((text, index) => ({
            id: Date.now() + Math.random().toString() + index,
            text: text.trim(),
            date: selectedDate,
          }));

          await updateMutation.mutateAsync({
            id: existingEntry.id,
            updates: {
              content: JSON.stringify({ items: itemsToSave }),
            },
          });
        } else {
          // Create new entry
          const itemsToSave = validItems.map((text, index) => ({
            id: Date.now() + Math.random().toString() + index,
            text: text.trim(),
            date: selectedDate,
          }));

          await createMutation.mutateAsync({
            user_id: user.id,
            selected_date: dateStr,
            content_type: 'gratitude',
            content: JSON.stringify({ items: itemsToSave }),
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
          <SwipeableTodoItem
            key={item.id}
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
          >
            <View style={styles.itemNumber}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </View>
            <Text style={styles.itemText}>{item.text}</Text>
          </SwipeableTodoItem>
        ))}
        {!isAdding && gratitudeItems.length > 0 && (
          <View style={styles.paginationContainer}>
            <View style={styles.paginationButtonGroup}>
              {hasMore && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showMoreButton]}
                  onPress={loadMore}
                  activeOpacity={0.7}
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

  if (isLoading) {
    return (
      <ComponentErrorBoundary name="GratitudeListReactQuery">
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
          <GratitudeSkeleton count={3} />
        </JournalCard>
      </ComponentErrorBoundary>
    );
  }

  return (
    <ComponentErrorBoundary name="GratitudeListReactQuery">
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
      showAddButton={!isAdding && !isEditing}
      onAdd={gratitudeItems.length > 0 ? startEditing : startAdding}
      isAdding={isAdding || isEditing}
    >
      {displayGratitudeList()}
      {(isAdding || isEditing) ? (
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
                accessibilityHint={`Enter something you're grateful for`}
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
                  accessibilityHint={`Enter something you're grateful for`}
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
              >
                <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </JournalCard>
    </ComponentErrorBoundary>
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
    marginTop: 10,
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
  itemNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginLeft: 4,
  },
  itemText: {
    color: Colors.darkGray,
    fontFamily: Fonts.regular,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
    marginRight: 8,
  },
  numberText: {
    color: Colors.alertCoral,
    fontFamily: Fonts.bold,
    fontSize: 12,
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
