import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
// SwipeableTodoItem handles the gesture handler imports
import { SwipeableTodoItem } from '../SwipeableTodoItem';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { Check, X, Trophy as LuTrophy, Pencil } from 'lucide-react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useTodayWinData,
  useCreateTodayWinEntry,
  useUpdateTodayWinEntry,
  useDeleteTodayWinEntry,
} from '../../services/hooks/useJournalData';
import { ErrorBoundary } from '../ErrorBoundary';
import { TodayWinSkeleton } from '../SkeletonLoader/TodayWinSkeleton';
import { analytics } from '../../utils/analytics';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';

interface TodayWinProps {
  selectedDate: Date;
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
}

const TodayWinComponent: React.FC<TodayWinProps> = ({ selectedDate, viewMode, expanded, onExpand }) => {
  // Global edit mode context (only for inline view)
  // Global edit mode context - safe version that handles missing provider
  const globalEditMode = useEditModeSafe();


  const { user } = useAuth();
  const [winText, setWinText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [previousWin, setPreviousWin] = useState<{ id: string; text: string } | null>(null);
  const [displayWin, setDisplayWin] = useState<{ id: string; text: string } | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const dateStr = toLocalDateString(selectedDate);

  // Determine if we should show adding mode
  const shouldShowAddingMode = isAdding || isEditing;

  // Reset state when date changes (prevents stale data)
  React.useEffect(() => {
    setWinText('');
    setIsAdding(false);
    setIsEditing(false);
    setPreviousWin(null);
    setDisplayWin(null);
    setEditingEntryId(null);
    setIsSaving(false);
    console.log('🏆 TodayWin: Resetting state for date:', dateStr);
  }, [dateStr]);

  const userId = user?.id || '';

  // Get today's win entry with performance tracking
  const loadStartTime = useRef<number>(Date.now());
  const { data: entries = [], isLoading, error, refetch } = useTodayWinData(userId, dateStr);

  // Handle global edit mode activation
  React.useEffect(() => {
    if (viewMode === 'inline' && globalEditMode?.isGlobalEditMode) {
      // Check if there's existing win content
      const hasExistingWin = entries.length > 0 && entries[0]?.content;

      if (hasExistingWin) {
        // Start editing existing win
        const currentEntry = entries[0];
        const existingWin = (() => {
          try {
            const parsed = typeof currentEntry.content === 'string' ? JSON.parse(currentEntry.content) : currentEntry.content;
            return parsed.win || '';
          } catch {
            return '';
          }
        })();

        if (existingWin && !isEditing) {
          setIsEditing(true);
          setIsAdding(false); // Make sure adding is false
          setWinText(existingWin);
          setEditingEntryId(currentEntry.id);
          setPreviousWin({ id: currentEntry.id, text: existingWin });
        } else if (!existingWin && !isAdding) {
          setIsAdding(true);
          setIsEditing(false); // Make sure editing is false
        }
      } else if (!isAdding) {
        // Start adding new win
        setIsAdding(true);
        setIsEditing(false); // Make sure editing is false
      }
    }
  }, [globalEditMode?.isGlobalEditMode, entries.length, viewMode, entries, isAdding, isEditing]);



  // Track loading performance
  React.useEffect(() => {
    if (!isLoading && entries.length >= 0) {
      const loadTime = Date.now() - loadStartTime.current;
      const hasWin = entries.length > 0 && entries[0]?.content;

      analytics.trackWinEvent('win_loaded', {
        has_win: Boolean(hasWin),
        load_time_ms: loadTime,
        date: dateStr,
      }, user?.id);
    }
  }, [isLoading, entries, entries.length, dateStr, user?.id]);

  // Handle loading and error states
  React.useEffect(() => {
    if (error) {
      analytics.trackWinEvent('win_error', {
        error_type: error.message || 'unknown',
        operation: 'load',
        date: dateStr,
      }, user?.id);

      Alert.alert('Error', 'Failed to load today\'s win.');
    }
  }, [error, dateStr, user?.id]);
  const createMutation = useCreateTodayWinEntry();
  const updateMutation = useUpdateTodayWinEntry();
  const deleteMutation = useDeleteTodayWinEntry();

  // Get the first entry (TodayWin typically has one entry) - moved before early returns
  const entry = entries.length > 0 ? entries[0] : null;

  // Handler for swipe-to-delete
  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Today\'s Win?',
      'Are you sure you want to delete your Today\'s Win entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(id);
          },
        },
      ]
    );
  };

  // Individual item edit handlers
  const editWin = (id: string) => {
    const winItem = displayWin || win;
    if (!winItem) {return;}

    setEditingItemId(id);
    setEditingItemText(winItem.text);
  };

  const saveEditedWin = async () => {
    if (!editingItemId || !editingItemText.trim()) {return;}

    try {
      setIsSaving(true);
      const entryToUpdate = entries.find(e => e.id === editingItemId);
      if (!entryToUpdate) {return;}

      await updateMutation.mutateAsync({
        id: entryToUpdate.id,
        updates: {
          content: JSON.stringify({ win: editingItemText.trim() }),
        },
      });

      // Reset edit state
      setEditingItemId(null);
      setEditingItemText('');

      // Track analytics
      analytics.trackWinEvent('win_updated', {
        text_length: editingItemText.trim().length,
        previous_text_length: 0,
        date: dateStr,
      }, user?.id);
    } catch (updateError) {
      console.error('Failed to update win:', updateError);
      Alert.alert('Error', 'Failed to update win. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditWin = () => {
    setEditingItemId(null);
    setEditingItemText('');
  };

  // Memoize the win object to prevent infinite re-renders - moved before early returns
  const win = React.useMemo(() => {
    if (!entry) {return null;}

    try {
      const content = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
      const result = {
        id: entry.id,
        text: content.win || '',
      };
      console.log('🏆 TodayWin: Win object created:', result);
      return result;
    } catch {
      const result = {
        id: entry.id,
        text: '',
      };
      console.log('🏆 TodayWin: Win object created (error case):', result);
      return result;
    }
  }, [entry]);

  // Update displayWin when win data changes, but only if not currently editing or saving
  React.useEffect(() => {
    if (!isEditing && !isSaving) {
      // Only update if the win has actually changed
      setDisplayWin(prevDisplayWin => {
        // Compare by ID and text to avoid unnecessary updates
        if (!win && !prevDisplayWin) {return prevDisplayWin;}
        if (!win || !prevDisplayWin) {
          console.log('🏆 TodayWin: Updated displayWin from server:', win);
          return win;
        }

        // Don't override optimistic updates with the same content
        if (win.id === prevDisplayWin.id && win.text === prevDisplayWin.text) {
          return prevDisplayWin; // No change, keep previous
        }

        // Don't override optimistic updates with older data
        // (optimistic updates have temp IDs or are newer)
        if (prevDisplayWin.id.startsWith('temp-') && win.text === prevDisplayWin.text) {
          // Replace temp ID with real ID but keep the optimistic content
          console.log('🏆 TodayWin: Replacing optimistic ID with real ID:', { from: prevDisplayWin.id, to: win.id });
          return { ...prevDisplayWin, id: win.id };
        }

        console.log('🏆 TodayWin: Updated displayWin from server:', win);
        return win;
      });
    }
  }, [win, isEditing, isSaving]);

  // Handle loading state
  if (isLoading) {
    return <TodayWinSkeleton />;
  }

  // Handle error state
  if (error) {
    return (
      <JournalCard
        title="TODAY'S WIN"
        subtitle="What's your biggest win today?"
        icon={<LuTrophy size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
        showAddButton={false}
      >
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Failed to load today's win. Please try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              // Trigger a refetch by clearing cache and refetching
              refetch();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </JournalCard>
    );
  }

  const startAdding = () => {
    setIsAdding(true);
    setWinText('');
  };

  const cancelAdding = () => {
    console.log('🏆 TodayWin: Cancelling', { previousWin, isEditing, editingEntryId });
    if (previousWin) {
      // Restore the previous win if we were editing
      setDisplayWin(previousWin);
      setPreviousWin(null);
    } else {
      // Clear the input if we were adding a new win
      setWinText('');
    }
    setIsAdding(false);
    setIsEditing(false);
    setEditingEntryId(null);
    setIsSaving(false);
    console.log('🏆 TodayWin: Cancel complete');
  };

  const saveWin = () => {
    if (!winText.trim()) {return;}

    console.log('🏆 TodayWin: Starting save process', {
      winText: winText.trim(),
      isEditing,
      editingEntryId,
      entriesCount: entries.length,
    });

    if (isEditing && editingEntryId) {
      // Update existing entry
      const currentEntry = entries.find(e => e.id === editingEntryId);
      if (!currentEntry) {
        console.error('🏆 TodayWin: Entry not found for editing:', editingEntryId);
        console.error('🏆 TodayWin: Available entries:', entries.map(e => ({ id: e.id, content: e.content })));
        return;
      }

      console.log('🏆 TodayWin: Found entry to update:', {
        id: currentEntry.id,
        currentContent: currentEntry.content,
        newText: winText.trim(),
      });

      let updatedContent: any;
      try {
        updatedContent = typeof currentEntry.content === 'string'
          ? JSON.parse(currentEntry.content)
          : currentEntry.content;
      } catch {
        updatedContent = {};
      }

      const oldWin = updatedContent.win;
      updatedContent.win = winText.trim();

      console.log('🏆 TodayWin: Content update:', {
        oldWin,
        newWin: updatedContent.win,
        fullContent: updatedContent,
      });

      // Set saving state to prevent useEffect from overriding
      setIsSaving(true);

      // Create optimistic update
      const optimisticWin = {
        id: editingEntryId,
        text: winText.trim(),
      };

      // Apply optimistic update immediately
      setDisplayWin(optimisticWin);
      console.log('🏆 TodayWin: Optimistic update applied:', optimisticWin);

      // Clear editing state after optimistic update
      setIsAdding(false);
      setIsEditing(false);
      setWinText('');
      setPreviousWin(null);
      setEditingEntryId(null);

      // Close global edit mode if active
      if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
        globalEditMode.setGlobalEditMode(false);
      }

      updateMutation.mutate({
        id: editingEntryId,
        updates: {
          content: JSON.stringify(updatedContent),
        },
      }, {
        onSuccess: (data) => {
          console.log('🏆 TodayWin: Update mutation successful', data);
          setIsSaving(false);

          // Track analytics
          analytics.trackWinEvent('win_updated', {
            text_length: winText.trim().length,
            previous_text_length: previousWin?.text.length || 0,
            date: dateStr,
          }, user?.id); // Allow useEffect to work again
          // The optimistic update will be replaced by real data when it arrives
        },
        onError: (updateMutationError) => {
          console.error('🏆 TodayWin: Update mutation failed', updateMutationError);
          setIsSaving(false); // Allow useEffect to work again
          // Revert optimistic update and restore editing state on error
          const originalWin = {
            id: editingEntryId,
            text: (() => {
              try {
                const foundEntry = entries.find(e => e.id === editingEntryId);
                if (!foundEntry) {return '';}
                const content = typeof foundEntry.content === 'string' ? JSON.parse(foundEntry.content) : foundEntry.content;
                return content.win || '';
              } catch {
                return '';
              }
            })(),
          };
          setDisplayWin(originalWin);
          console.log('🏆 TodayWin: Reverted optimistic update due to error', originalWin);
        },
      });
    } else {
      // Create new entry
      // Set saving state to prevent useEffect from overriding
      setIsSaving(true);

      // Create optimistic update
      const optimisticWin = {
        id: 'temp-' + Date.now(),
        text: winText.trim(),
      };

      // Apply optimistic update immediately
      setDisplayWin(optimisticWin);
      console.log('🏆 TodayWin: Optimistic create applied:', optimisticWin);

      // Clear editing state after optimistic update
      setIsAdding(false);
      setIsEditing(false);
      setWinText('');
      setPreviousWin(null);
      setEditingEntryId(null);

      // Close global edit mode if active
      if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
        globalEditMode.setGlobalEditMode(false);
      }

      createMutation.mutate({
        user_id: userId,
        selected_date: dateStr,
        content: JSON.stringify({ win: winText.trim() }),
      }, {
        onSuccess: (data) => {
          console.log('🏆 TodayWin: Create mutation successful', data);
          setIsSaving(false);

          // Track analytics
          analytics.trackWinEvent('win_created', {
            text_length: winText.trim().length,
            date: dateStr,
          }, user?.id); // Allow useEffect to work again
          // The optimistic update will be replaced by real data when it arrives
        },
        onError: (createMutationError) => {
          console.error('🏆 TodayWin: Create mutation failed', createMutationError);
          setIsSaving(false); // Allow useEffect to work again
          // Revert optimistic update on error
          setDisplayWin(null);
          console.log('🏆 TodayWin: Reverted optimistic create due to error');
        },
      });
    }

    // State clearing is now handled above in each branch
  };

  // Hide empty component in inline and moments view
  if ((viewMode === 'inline' || viewMode === 'moments') && !isLoading && !error && (!win || !win.text.trim())) {
    return null;
  }

  return (
    <JournalCard
      title={displayWin || shouldShowAddingMode ? "TODAY'S WIN" : undefined}
      subtitle={displayWin || shouldShowAddingMode ? "What's your biggest win today?" : undefined}
      icon={displayWin || shouldShowAddingMode ? <Ionicons name="trophy" size={24} color={Colors.alertCoral} /> : undefined}
      showAddButton={false}
      onAdd={startAdding}
      isAdding={shouldShowAddingMode}
      onCancelAdd={cancelAdding}
      viewMode={viewMode}
      expanded={expanded}
      onExpand={onExpand}
    >
      {(() => {
        if (shouldShowAddingMode) {
          return (
            <>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={winText}
                  onChangeText={setWinText}
                  placeholder="What's your win for today?"
                  placeholderTextColor={Colors.mediumGray}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                  returnKeyType="done"
                  blurOnSubmit={false}
                />
              </View>
              <View style={styles.buttonRow}>
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    onPress={cancelAdding}
                    style={[styles.button, styles.cancelButton]}
                    activeOpacity={0.8}
                  >
                    <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveWin}
                    style={[
                      styles.button,
                      styles.saveButton,
                      !winText.trim() && styles.disabledButton,
                    ]}
                    disabled={!winText.trim()}
                    activeOpacity={0.8}
                  >
                    <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          );
        } else if (displayWin) {
          return (
            <SwipeableTodoItem
              item={{ id: displayWin.id, text: displayWin.text, completed: false }}
              onToggle={() => {}}
              onDelete={handleDelete}
              onEdit={() => editWin(displayWin.id)}
              hideCheckbox
              variant="gratitude"
              disableSwipe={viewMode === 'carousel' && !expanded}
            >
              {editingItemId === displayWin.id ? (
                <View style={styles.editWinContainer}>
                  <TextInput
                    style={styles.editWinInput}
                    value={editingItemText}
                    onChangeText={setEditingItemText}
                    autoFocus
                    multiline
                    onSubmitEditing={saveEditedWin}
                    returnKeyType="done"
                    blurOnSubmit={false}
                  />
                  <View style={styles.editWinButtons}>
                    <TouchableOpacity
                      onPress={cancelEditWin}
                      style={[styles.editWinActionButton, styles.editWinCancelButton]}
                    >
                      <Ionicons name="close" size={16} color={Colors.hopeWhite} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={saveEditedWin}
                      style={[styles.editWinActionButton, styles.editWinSaveButton]}
                      disabled={!editingItemText.trim() || isSaving}
                    >
                      <Ionicons name="checkmark" size={16} color={Colors.hopeWhite} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={[
                  styles.winContainer,
                  viewMode === 'inline' && styles.winContainerInline,
                ]}>
                  <Text style={styles.winText}>{displayWin.text}</Text>
                </View>
              )}
            </SwipeableTodoItem>
          );
        } else {
          return (
            <View style={styles.emptyStateContainer}>
              <View style={styles.iconContainer}>
                <Ionicons
                  name="trophy"
                  size={32}
                  color={Colors.mediumGray}
                />
                <Text style={styles.sectionLabel} accessibilityRole="text">TODAY'S WIN</Text>
              </View>
              <View style={styles.titleContainer}>
                <Text
                  style={styles.emptyStateTitle}
                  accessibilityRole="header"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  Celebrate God's Victories
                </Text>
              </View>
              <Text style={styles.emptyStateSubtext} accessibilityRole="text">
                Share a moment where faith led to triumph today.
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={startAdding}
                accessibilityRole="button"
                accessibilityLabel="Begin today's win"
              >
                <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
                <Text style={styles.emptyStateButtonText}>Begin</Text>
              </TouchableOpacity>
            </View>
          );
        }
      })()}
    </JournalCard>
  );
};

// Export with error boundary wrapper
export const TodayWinReactQuery: React.FC<TodayWinProps> = (props) => {
  return (
    <ErrorBoundary name="TodayWinReactQuery">
      <TodayWinComponent {...props} />
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  swipeableContainer: {
    marginBottom: 4,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f87171',
  },
  winContainer: {
    backgroundColor: '#274673',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 0,
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  winContainerInline: {
    backgroundColor: Colors.anchorBlue,
  },
  deleteButton: {
    width: 80,
    backgroundColor: '#f87171',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 10,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    marginLeft: -10,
  },
  deleteButtonContent: {
    width: 60,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winContent: {
    flex: 1,
  },
  winText: {
    fontFamily: Fonts.bold, // This should map to weight 800 in your Fonts configuration
    color: Colors.hopeWhite,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    letterSpacing: 1,
    fontWeight: '600', // Explicitly set font weight to 800
    flexWrap: 'wrap',
  },
  editButton: {
    padding: 4,
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    padding: 0,
  },
  formContainer: {
    marginTop: 8,
  },
  inputContainer: {
    marginBottom: 8,
    width: '100%',
  },
  input: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  disabledButton: {
    opacity: 0.5,
  },

  // Edit win styles
  editWinContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
  },
  editWinInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: 'transparent',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editWinButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  editWinActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editWinCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editWinSaveButton: {
    backgroundColor: Colors.growthGreen,
  },

  // Error state styles
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
  },
  errorText: {
    fontFamily: Fonts.regular,
    color: Colors.alertCoral,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'center',
  },
  retryText: {
    fontFamily: Fonts.medium,
    color: Colors.hopeWhite,
    fontSize: 12,
  },
  // Empty state styles
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 12,
    width: '100%',
  },
  emptyStateTitle: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  emptyStateSubtext: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  beginButton: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  beginButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  // New empty state styles
  iconContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyStateIcon: {
    marginBottom: 8,
    opacity: 0.8,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 12,
    color: Colors.mediumGray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 6,
    opacity: 0.9,
  },
  titleContainer: {
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  emptyStateButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonIcon: {
    marginRight: 8,
  },
  emptyStateButtonText: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
});
