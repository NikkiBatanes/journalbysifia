import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Animated, Alert, Vibration } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { Pencil, X, Check, Sunrise as LuSunrise } from 'lucide-react-native';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useLookingForwardData,
  useCreateLookingForwardEntry,
  useUpdateLookingForwardEntry,
  useDeleteLookingForwardEntry,
} from '../../services/hooks/useJournalData';
import { LookingForwardSkeleton } from '../SkeletonLoader/LookingForwardSkeleton';
import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary';
import { analytics } from '../../utils/analytics';

interface LookingForwardProps {
  selectedDate: Date;
}

const LookingForwardComponent: React.FC<LookingForwardProps> = ({ selectedDate }) => {
  const { user } = useAuth();
  const [entryText, setEntryText] = useState('');
  const [displayEntry, setDisplayEntry] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);
  const loadStartTime = useRef<number>(Date.now());

  const dateStr = toLocalDateString(selectedDate);
  const userId = user?.id || '';

  // Get looking forward entries with performance tracking
  const { data: entries = [], isLoading, error, refetch } = useLookingForwardData(userId, dateStr);

  const createMutation = useCreateLookingForwardEntry();
  const updateMutation = useUpdateLookingForwardEntry();
  const deleteMutation = useDeleteLookingForwardEntry();

  // Get the first entry (LookingForward typically has only one entry) - moved before early returns
  const entry = entries.length > 0 ? entries[0] : null;

  // Memoize the looking forward object to prevent infinite re-renders - moved before early returns
  const lookingForward = React.useMemo(() => {
    if (!entry) {return null;}

    try {
      const content = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
      return {
        id: entry.id,
        text: content?.entry?.text || '',
      };
    } catch {
      return {
        id: entry.id,
        text: '',
      };
    }
  }, [entry]);

  // Update displayEntry when lookingForward data changes, but only if not currently editing or saving
  React.useEffect(() => {
    if (!isEditing && !isSaving) {
      // Only update if the entry has actually changed
      setDisplayEntry((prevDisplayEntry: any) => {
        // Compare by ID and text to avoid unnecessary updates
        if (!lookingForward && !prevDisplayEntry) {return prevDisplayEntry;}
        if (!lookingForward || !prevDisplayEntry) {
          console.log('🌅 LookingForward: Updated displayEntry from server:', lookingForward);
          return lookingForward;
        }

        // Don't override optimistic updates with the same content
        if (lookingForward.id === prevDisplayEntry.id && lookingForward.text === prevDisplayEntry.text) {
          return prevDisplayEntry; // No change, keep previous
        }

        // Don't override optimistic updates with older data
        // (optimistic updates have temp IDs or are newer)
        if (prevDisplayEntry.id.startsWith('temp-') && lookingForward.text === prevDisplayEntry.text) {
          // Replace temp ID with real ID but keep the optimistic content
          console.log('🌅 LookingForward: Replacing optimistic ID with real ID:', { from: prevDisplayEntry.id, to: lookingForward.id });
          return { ...prevDisplayEntry, id: lookingForward.id };
        }

        console.log('🌅 LookingForward: Updated displayEntry from server:', lookingForward);
        return lookingForward;
      });
    }
  }, [lookingForward, isEditing, isSaving]);

  const closeSwipeable = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  // Reset state when date changes (prevents stale data)
  React.useEffect(() => {
    setEntryText('');
    setIsAdding(false);
    setIsEditing(false);
    setIsSaving(false);
    console.log('🌅 LookingForward: Resetting state for date:', dateStr);
  }, [dateStr]);

  // Track loading performance
  React.useEffect(() => {
    if (!isLoading && entries.length >= 0) {
      const loadTime = Date.now() - loadStartTime.current;
      const hasEntry = entries.length > 0 && entries[0]?.content;

      analytics.trackLookingForwardEvent('looking_forward_loaded', {
        has_entry: Boolean(hasEntry),
        load_time_ms: loadTime,
        date: dateStr,
      }, user?.id);
    }
  }, [isLoading, entries, entries.length, dateStr, user?.id]);

  // Handle loading and error states
  React.useEffect(() => {
    if (error) {
      analytics.trackLookingForwardEvent('looking_forward_error', {
        error_type: error.message || 'unknown',
        operation: 'load',
        date: dateStr,
      }, user?.id);

      Alert.alert('Error', 'Failed to load looking forward entry.');
    }
  }, [error, dateStr, user?.id]);

  // Debug: Log when entries change
  React.useEffect(() => {
    console.log('🌅 LookingForward: Entries changed:', entries);
  }, [entries]);

  // Handle loading state
  if (isLoading) {
    return <LookingForwardSkeleton />;
  }

  // Handle error state
  if (error) {
    return (
      <JournalCard
        title="Looking Forward To"
        subtitle="What are you looking forward to tomorrow?"
        icon={<LuSunrise size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
        showAddButton={false}
      >
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Failed to load looking forward entry. Please try again.
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
      if (!displayEntry) {return;}

      Alert.alert(
        'Delete Entry',
        'Are you sure you want to delete this looking forward entry?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // Track analytics
                analytics.trackLookingForwardEvent('looking_forward_deleted', {
                  entry_id: displayEntry.id,
                  text_length: displayEntry.text.length,
                  date: dateStr,
                }, user?.id);

                // Optimistic update: immediately remove from UI
                setDisplayEntry(null);
                closeSwipeable();

                // Perform actual deletion
                await deleteMutation.mutateAsync(displayEntry.id);
              } catch (deleteError) {
                console.error('🌅 LookingForward: Delete failed:', deleteError);

                // Revert optimistic update on error
                setDisplayEntry(lookingForward);

                // Track error
                analytics.trackLookingForwardEvent('looking_forward_error', {
                  error_type: deleteError instanceof Error ? deleteError.message : 'unknown',
                  operation: 'delete',
                  date: dateStr,
                }, user?.id);

                Alert.alert('Error', 'Failed to delete entry. Please try again.');
              }
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
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const startAdding = () => {
    setIsAdding(true);
    setIsEditing(false);
    setEntryText('');
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setIsEditing(false);
    setEntryText('');
  };

  const saveEntry = async () => {
    if (!entryText.trim() || !user || isSaving) {return;}

    const trimmedText = entryText.trim();
    setIsSaving(true);

    try {
      if (isEditing && displayEntry) {
        // Update existing entry with optimistic update
        const previousTextLength = displayEntry.text.length;
        const optimisticEntry = {
          ...displayEntry,
          text: trimmedText,
        };

        // Optimistic update
        setDisplayEntry(optimisticEntry);
        setIsAdding(false);
        setIsEditing(false);
        setEntryText('');

        // Track analytics
        analytics.trackLookingForwardEvent('looking_forward_updated', {
          text_length: trimmedText.length,
          previous_text_length: previousTextLength,
          date: dateStr,
        }, user.id);

        // Perform actual update
        await updateMutation.mutateAsync({
          id: displayEntry.id,
          updates: {
            content: JSON.stringify({
              entry: {
                id: displayEntry.id,
                text: trimmedText,
                date: selectedDate,
              },
            }),
          },
        });

        console.log('🌅 LookingForward: Entry updated successfully');
      } else {
        // Create new entry with optimistic update
        const tempId = `temp-${Date.now()}`;
        const optimisticEntry = {
          id: tempId,
          text: trimmedText,
        };

        // Optimistic update
        setDisplayEntry(optimisticEntry);
        setIsAdding(false);
        setEntryText('');

        // Track analytics
        analytics.trackLookingForwardEvent('looking_forward_created', {
          text_length: trimmedText.length,
          date: dateStr,
        }, user.id);

        // Perform actual creation
        await createMutation.mutateAsync({
          user_id: user.id,
          selected_date: dateStr,
          content: JSON.stringify({
            entry: {
              id: `looking_forward_${Date.now()}`,
              text: trimmedText,
              date: selectedDate,
            },
          }),
        });

        console.log('🌅 LookingForward: Entry created successfully');
      }
    } catch (saveError) {
      console.error('🌅 LookingForward: Save failed:', saveError);

      // Revert optimistic update on error
      setDisplayEntry(lookingForward);
      setIsAdding(true); // Show form again

      // Track error
      analytics.trackLookingForwardEvent('looking_forward_error', {
        error_type: saveError instanceof Error ? saveError.message : 'unknown',
        operation: isEditing ? 'update' : 'create',
        date: dateStr,
      }, user.id);

      Alert.alert('Error', 'Failed to save entry. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const editEntry = () => {
    if (!displayEntry) {return;}

    setEntryText(displayEntry.text);
    setIsEditing(true);
    setIsAdding(true);
  };

  const cancelEditing = () => {
    setIsAdding(false);
    setIsEditing(false);
    setEntryText('');
  };

  return (
    <JournalCard
      title="Looking Forward To"
      subtitle="What are you looking forward to tomorrow?"
      icon={<LuSunrise size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
      showAddButton={!displayEntry && !isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
      headerRight={
        displayEntry && !isAdding ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={editEntry} style={styles.headerButton}>
              <Pencil size={14} color={Colors.trustGrey} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        ) : null
      }
    >
      {displayEntry && !isAdding ? (
        <Swipeable
          ref={swipeableRef}
          renderRightActions={renderRightActions}
          rightThreshold={20}
          containerStyle={styles.swipeableContainer}
          overshootRight={false}
          friction={3}
          enableTrackpadTwoFingerGesture
          onSwipeableWillOpen={() => {
            Vibration.vibrate(10);
          }}
        >
          <View style={styles.entryContainer}>
            <Text style={styles.entryText}>
              {displayEntry.text}
            </Text>
          </View>
        </Swipeable>
      ) : isAdding ? (
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            value={entryText}
            onChangeText={setEntryText}
            placeholder="What are you looking forward to tomorrow?"
            placeholderTextColor={Colors.mediumGray}
            multiline
            autoFocus
          />
          <View style={styles.buttonRow}>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                onPress={isEditing ? cancelEditing : cancelAdding}
                style={[styles.button, styles.cancelButton]}
                activeOpacity={0.8}
              >
                <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEntry}
                style={[
                  styles.button,
                  styles.saveButton,
                  (!entryText.trim() || isSaving) && styles.disabledButton,
                ]}
                disabled={!entryText.trim() || isSaving || createMutation.isPending || updateMutation.isPending}
                activeOpacity={0.8}
              >
                <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  swipeableContainer: {
    marginBottom: 4,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f87171',
  },
  entryContainer: {
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
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 10,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    marginLeft: -10,
  },
  deleteButtonContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  entryText: {
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 4,
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    padding: 0,
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
  errorContainer: {
    backgroundColor: '#ebeef2',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 60,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: Fonts.regular,
    color: Colors.alertCoral,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: Colors.alertCoral,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
});

// Export the component wrapped with error boundary for production-ready error handling
export const LookingForwardReactQuery: React.FC<LookingForwardProps> = (props) => (
  <ErrorBoundary name="LookingForwardReactQuery">
    <LookingForwardComponent {...props} />
  </ErrorBoundary>
);
