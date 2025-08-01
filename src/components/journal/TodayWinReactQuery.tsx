import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { Check, X, Trophy as LuTrophy, Pencil } from 'lucide-react-native';
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
import { useEditMode } from '../../systems/journal/context/EditModeContext';

interface TodayWinProps {
  selectedDate: Date;
  viewMode?: 'carousel' | 'inline' | 'moments';
}

const TodayWinComponent: React.FC<TodayWinProps> = ({ selectedDate, viewMode }) => {
  // Global edit mode context (only for inline view)
  let globalEditMode = null;
  try {
    if (viewMode === 'inline') {
      globalEditMode = useEditMode();
    }
  } catch {
    // useEditMode not available, continue without global edit mode
  }

  const { user } = useAuth();
  const [winText, setWinText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [previousWin, setPreviousWin] = useState<{ id: string; text: string } | null>(null);
  const [displayWin, setDisplayWin] = useState<{ id: string; text: string } | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);

  const dateStr = toLocalDateString(selectedDate);

  // Determine if we should show adding mode based on global edit mode
  const shouldShowAddingMode = isAdding || (globalEditMode?.isGlobalEditMode && viewMode === 'inline');

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

  // Debug: Log when entries change
  React.useEffect(() => {
    console.log('🏆 TodayWin: Entries changed:', entries);
  }, [entries]);

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

  const closeSwipeable = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  // Handle loading state
  if (isLoading) {
    return <TodayWinSkeleton />;
  }

  // Handle error state
  if (error) {
    return (
      <JournalCard
        title="Today's Win"
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

  const renderRightActions = (progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    });

    const opacity = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [1, 0.8, 0],
      extrapolate: 'clamp',
    });

    const handleDelete = () => {
      if (!entry) {return;}

      Alert.alert(
        'Delete Win',
        'Are you sure you want to delete this win?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteMutation.mutate(entry.id);
              closeSwipeable();
            },
          },
        ]
      );
    };

    return (
      <Animated.View style={[styles.deleteButton, { opacity }]}>
        <TouchableOpacity
          style={styles.deleteButtonContent}
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <X size={20} color={Colors.hopeWhite} strokeWidth={2.5} />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

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

  const editWin = () => {
    if (!displayWin) {return;}

    console.log('🏆 TodayWin: Starting edit mode', { displayWin, isAdding, isEditing });
    setPreviousWin(displayWin);
    setWinText(displayWin.text);
    setEditingEntryId(displayWin.id); // Store the entry ID for updating
    setDisplayWin(null); // Clear the win state to show the edit form
    setIsEditing(true);
    setIsAdding(true);
    console.log('🏆 TodayWin: Edit mode set', { isAdding: true, isEditing: true, editingEntryId: displayWin.id });
  };

  // Hide empty component in inline view
  if (viewMode === 'inline' && !isLoading && !error && (!win || !win.text.trim())) {
    return null;
  }

  return (
    <JournalCard
      title="Today's Win"
      subtitle="What's your biggest win today?"
      icon={<LuTrophy size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
      showAddButton={!displayWin && !shouldShowAddingMode}
      onAdd={startAdding}
      isAdding={shouldShowAddingMode}
      onCancelAdd={cancelAdding}
      headerRight={
        displayWin && !shouldShowAddingMode && viewMode !== 'inline' ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={editWin} style={styles.headerButton}>
              <Pencil size={14} color={Colors.trustGrey} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        ) : undefined
      }
      viewMode={viewMode}
    >
      {displayWin && !shouldShowAddingMode && (
        <Swipeable
          ref={swipeableRef}
          renderRightActions={renderRightActions}
          rightThreshold={40}
        >
          <View style={styles.swipeableContainer}>
            <View style={styles.winContainer}>
              <Text style={styles.winText}>{displayWin.text}</Text>
            </View>
          </View>
        </Swipeable>
      )}
      {shouldShowAddingMode && (
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            value={winText}
            onChangeText={setWinText}
            placeholder="What's your win for today?"
            placeholderTextColor={Colors.mediumGray}
            multiline
            autoFocus
          />
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
        </View>
      )}
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
    backgroundColor: '#ebeef2',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 40,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    justifyContent: 'center',
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
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
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
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
    fontSize: 13,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: Colors.mediumGray,
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  disabledButton: {
    opacity: 0.5,
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
});
