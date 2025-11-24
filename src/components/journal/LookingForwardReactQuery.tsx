import React, { useState, useRef } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
// SwipeableTodoItem handles the gesture handler imports
import { SwipeableTodoItem } from '../SwipeableTodoItem';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import ThemedText from '../common/ThemedText';
import { Pencil, X, Check, Sunrise as LuSunrise } from 'lucide-react-native';

import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useLookingForwardData,
  useCreateLookingForwardEntry,
  useUpdateLookingForwardEntry,
  useDeleteLookingForwardEntry,
} from '../../services/hooks/useJournalData';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';
import { LookingForwardSkeleton } from '../SkeletonLoader/LookingForwardSkeleton';
import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary';
import { analytics } from '../../utils/analytics';
import {
  triggerLightHaptic,
  triggerSelectionHaptic,
  triggerSuccessHaptic,
  triggerErrorHaptic,
} from '../../utils/haptics';

interface LookingForwardProps {
  selectedDate: Date;
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
}

const LookingForwardComponent: React.FC<LookingForwardProps> = ({ selectedDate, viewMode, expanded, onExpand }) => {
  // Global edit mode context (only for inline view)
  // Global edit mode context - safe version that handles missing provider
  const globalEditMode = useEditModeSafe();
  // Dynamic theming for fonts
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  const { user } = useAuth();
  const [entryText, setEntryText] = useState('');
  const [displayEntry, setDisplayEntry] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const loadStartTime = useRef<number>(Date.now());

  const dateStr = toLocalDateString(selectedDate);
  const userId = user?.id || '';

  // Date category helpers (Today / Yesterday / Earlier)
  const getDateCategory = (date: Date): 'today' | 'yesterday' | 'earlier' => {
    const todayStr = toLocalDateString(new Date());
    const targetStr = toLocalDateString(date);
    if (targetStr === todayStr) { return 'today'; }
    // compute yesterday by subtracting one day from today in local time
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toLocalDateString(yesterday);
    if (targetStr === yesterdayStr) { return 'yesterday'; }
    return 'earlier';
  };

  const dateCategory = getDateCategory(selectedDate);

  // Copy maps based on date category
  const getDisplaySubtitle = (): string => {
    switch (dateCategory) {
      case 'today':
        return 'Tomorrow in His Hands';
      case 'yesterday':
        return 'Yesterday in His Care';
      default:
        return 'This Day in His Plan';
    }
  };

  const getEmptySubtitle = (): string => {
    switch (dateCategory) {
      case 'today':
        return "Write what you're excited for, trusting in God's plan";
      case 'yesterday':
        return 'What were you looking forward to yesterday?';
      default:
        return 'Recall the anticipation from this day';
    }
  };

  const getEditShortSubtitle = (): string | undefined => {
    switch (dateCategory) {
      case 'yesterday':
        return 'Yesterday’s hope';
      case 'earlier':
        return 'Hope from then';
      default:
        return undefined; // Today unchanged
    }
  };

  // Determine if we should be in adding mode
  const shouldShowAddingMode = isAdding || isEditing || ((viewMode === 'inline' || viewMode === 'carousel') && globalEditMode?.isGlobalEditMode);

  // Get looking forward entries with performance tracking
  const { data: entries = [], isLoading, error, refetch } = useLookingForwardData(userId, dateStr);

  const createMutation = useCreateLookingForwardEntry();
  const updateMutation = useUpdateLookingForwardEntry();
  const deleteMutation = useDeleteLookingForwardEntry();

  // Get the first entry (LookingForward typically has only one entry) - moved before early returns
  const entry = entries.length > 0 ? entries[0] : null;

  // Handler for swipe-to-delete
  const handleEntryDelete = (id: string) => {
    Alert.alert(
      'Delete Looking Forward?',
      'Are you sure you want to delete your Looking Forward entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('DELETE DEBUG: Attempting to delete entry:', id);
            triggerSelectionHaptic();
            deleteMutation.mutate(id, {
              onSuccess: () => {
                console.log('DELETE DEBUG: Successfully deleted entry:', id);
                triggerSuccessHaptic();
                // Optional: Show success message
                Alert.alert('Deleted', 'Looking Forward entry deleted successfully');
              },
              onError: (deleteError: any) => {
                console.error('DELETE DEBUG: Failed to delete entry:', id, deleteError);
                triggerErrorHaptic();
                // Show error message to user
                Alert.alert('Error', 'Failed to delete Looking Forward entry. Please try again.');
              },
            });
          },
        },
      ]
    );
  };

  // Individual item edit handlers
  // editLookingForwardEntry removed - was defined but never called

  const saveEditedEntry = async () => {
    if (!editingItemId || !editingItemText.trim()) {return;}

    try {
      setIsSaving(true);
      const entryToUpdate = entries.find(e => e.id === editingItemId);
      if (!entryToUpdate) {return;}

      await updateMutation.mutateAsync({
        id: entryToUpdate.id,
        updates: {
          content: JSON.stringify({ lookingForward: editingItemText.trim() }),
        },
      });

      // Reset edit state
      setEditingItemId(null);
      setEditingItemText('');

      // Track analytics
      analytics.trackLookingForwardEvent('looking_forward_updated', {
        text_length: editingItemText.trim().length,
        previous_text_length: 0,
        date: dateStr,
      }, user?.id);
      triggerSuccessHaptic();
    } catch (updateError) {
      Logger.error('Failed to update looking forward', updateError as Error, {
  component: 'LookingForwardReactQuery',
});
      Alert.alert('Error', 'Failed to update looking forward. Please try again.');
      triggerErrorHaptic();
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditEntry = () => {
    triggerSelectionHaptic();
    setEditingItemId(null);
    setEditingItemText('');
  };

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

          return { ...prevDisplayEntry, id: lookingForward.id };
        }

        return lookingForward;
      });
    }
  }, [lookingForward, isEditing, isSaving]);

  // Reset state when date changes (prevents stale data)
  React.useEffect(() => {
    setEntryText('');
    setIsAdding(false);
    setIsEditing(false);
    setIsSaving(false);

  }, [dateStr]);

  // Handle global edit mode activation
  React.useEffect(() => {
    if ((viewMode === 'inline' || viewMode === 'carousel') && globalEditMode?.isGlobalEditMode) {
      // Check if there's existing looking forward content
      const hasExistingEntry = entries.length > 0 && entries[0]?.content;

      if (hasExistingEntry) {
        // Start editing existing entry
        const currentEntry = entries[0];
        const existingText = (() => {
          try {
            const parsed = typeof currentEntry.content === 'string' ? JSON.parse(currentEntry.content) : currentEntry.content;
            return parsed.entry?.text || '';
          } catch {
            return '';
          }
        })();

        if (existingText && !isEditing) {
          setIsEditing(true);
          setIsAdding(false); // Make sure adding is false
          setEntryText(existingText);
        } else if (!existingText && !isAdding) {
          setIsAdding(true);
          setIsEditing(false); // Make sure editing is false
        }
      } else if (!isAdding) {
        // Start adding new entry
        setIsAdding(true);
        setIsEditing(false); // Make sure editing is false
      }
    }
  }, [globalEditMode?.isGlobalEditMode, entries.length, viewMode, entries, isAdding, isEditing]);

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

  // Handle loading state
  if (isLoading) {
    return <LookingForwardSkeleton />;
  }

  // Handle error state
  if (error) {
    return (
      <JournalCard
        title="LOOKING FORWARD TO"
        subtitle="Tomorrow's hope and anticipation"
        icon={<LuSunrise size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
        showAddButton={false}
      >
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>
            Failed to load looking forward entry. Please try again.
          </ThemedText>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              // Trigger a refetch by clearing cache and refetching
              refetch();
            }}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.retryText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      </JournalCard>
    );
  }

  const startAdding = () => {
    triggerLightHaptic();
    setIsAdding(true);
    setIsEditing(false);
    setEntryText('');
  };

  const cancelAdding = () => {
    triggerSelectionHaptic();
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

        // Close global edit mode if active
        if (globalEditMode?.isGlobalEditMode && (viewMode === 'inline' || viewMode === 'carousel')) {
          globalEditMode.setGlobalEditMode(false);
        }

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

        triggerSuccessHaptic();
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

        // Close global edit mode if active
        if (globalEditMode?.isGlobalEditMode && (viewMode === 'inline' || viewMode === 'carousel')) {
          globalEditMode.setGlobalEditMode(false);
        }

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

        triggerSuccessHaptic();
      }
    } catch (saveError) {
      Logger.error('🌅 LookingForward: Save failed', saveError as Error, {
  component: 'LookingForwardReactQuery',
});

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
      triggerErrorHaptic();
    } finally {
      setIsSaving(false);
    }
  };

  const editEntry = () => {
    if (!displayEntry) {return;}

    setEntryText(displayEntry.text);
    triggerLightHaptic();
    setIsEditing(true);
    setIsAdding(true);
  };

  const cancelEditing = () => {
    triggerSelectionHaptic();
    setIsAdding(false);
    setIsEditing(false);
    setEntryText('');
  };

  // Determine if there's content
  const hasContent = lookingForward && lookingForward.text.trim();

  // Hide empty component in inline and moments view
  if ((viewMode === 'inline' || viewMode === 'moments') && !isLoading && !error && (!lookingForward || !lookingForward.text.trim())) {
    return null;
  }

  // Determine subtitle for header: in adding/editing mode use short edit subtitle for non-today; otherwise display subtitle
  const headerSubtitle = (hasContent || shouldShowAddingMode)
    ? (shouldShowAddingMode && getEditShortSubtitle() ? getEditShortSubtitle()! : getDisplaySubtitle())
    : undefined;

  return (
    <JournalCard
      title={hasContent || shouldShowAddingMode ? 'LOOKING FORWARD TO' : undefined}
      subtitle={headerSubtitle}
      icon={hasContent || shouldShowAddingMode ? <MaterialCommunityIcons name="white-balance-sunny" size={24} color={Colors.alertCoral} /> : undefined}
      showAddButton={hasContent ? !shouldShowAddingMode : false}
      onAdd={displayEntry ? editEntry : startAdding}
      isAdding={shouldShowAddingMode}
      onCancelAdd={cancelAdding}
      viewMode={viewMode}
      expanded={expanded}
      onExpand={onExpand}
    >
      {displayEntry && !shouldShowAddingMode && (
        <SwipeableTodoItem
          item={{ id: displayEntry.id, text: displayEntry.text, completed: false }}
          onToggle={() => {}}
          onDelete={handleEntryDelete}
          hideCheckbox
          variant="gratitude"
          disableSwipe={viewMode === 'carousel' && !expanded}
        >
          {editingItemId === displayEntry.id ? (
            <View style={styles.editEntryContainer}>
              <TextInput
                style={[styles.editEntryInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
                value={editingItemText}
                onChangeText={setEditingItemText}
                autoFocus
                multiline
                onSubmitEditing={saveEditedEntry}
                returnKeyType="done"
                blurOnSubmit={false}
              />
              <View style={styles.editEntryButtons}>
                <TouchableOpacity
                  onPress={cancelEditEntry}
                  style={[styles.editEntryActionButton, styles.editEntryCancelButton]}
                >
                  <Ionicons name="close" size={16} color={Colors.hopeWhite} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveEditedEntry}
                  style={[styles.editEntryActionButton, styles.editEntrySaveButton]}
                  disabled={!editingItemText.trim() || isSaving}
                >
                  <Ionicons name="checkmark" size={16} color={Colors.hopeWhite} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[
              styles.entryContainer,
              viewMode === 'inline' && styles.entryContainerInline,
            ]}>
              <ThemedText style={styles.entryText}>{displayEntry.text}</ThemedText>
            </View>
          )}
        </SwipeableTodoItem>
      )}
      {shouldShowAddingMode && (
        <>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { fontFamily: getFontFamily(fontKey, 'regular') }]}
              value={entryText}
              onChangeText={setEntryText}
              placeholder="What are you looking forward to tomorrow?"
              placeholderTextColor={Colors.textGray}
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
        </>
      )}
      {!displayEntry && !shouldShowAddingMode && (
        <View style={styles.emptyStateContainer}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="white-balance-sunny"
              size={32}
              color={Colors.textGray}
              style={styles.emptyStateIcon}
            />
            <ThemedText style={styles.sectionLabel} accessibilityRole="text">LOOKING FORWARD TO</ThemedText>
          </View>
          <View style={styles.titleContainer}>
            <ThemedText
              style={styles.emptyStateTitle}
              accessibilityRole="header"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {getDisplaySubtitle()}
            </ThemedText>
          </View>
          <ThemedText style={styles.emptyStateSubtext} accessibilityRole="text">
            {getEmptySubtitle()}
          </ThemedText>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={startAdding}
            accessibilityRole="button"
            accessibilityLabel={dateCategory === 'today' ? 'Begin looking forward' : 'Revisit looking forward'}
          >
            <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
            <ThemedText style={styles.emptyStateButtonText}>
              {dateCategory === 'today' ? 'Begin' : 'Revisit'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
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
    backgroundColor: '#274673',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    borderWidth: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  entryContainerInline: {
    backgroundColor: Colors.anchorBlue,
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
    fontFamily: Fonts.bold, // This should map to weight 800 in your Fonts configuration
    color: Colors.hopeWhite,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    letterSpacing: 1,
    fontWeight: '600',
    flexWrap: 'wrap',
  },

  // Edit entry styles
  editEntryContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
  },
  editEntryInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 22,
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editEntryButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  editEntryActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editEntryCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editEntrySaveButton: {
    backgroundColor: Colors.growthGreen,
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    padding: 0,
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
  emptyStateIcon: {
    marginBottom: 8,
    opacity: 0.8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontWeight: '600',
    fontSize: 12,
    color: Colors.textGray,
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
  emptyStateTitle: {
    fontWeight: '600',
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
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
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
});

// Export the component wrapped with error boundary for production-ready error handling
export const LookingForwardReactQuery: React.FC<LookingForwardProps> = (props) => (
  <ErrorBoundary name="LookingForwardReactQuery">
    <LookingForwardComponent {...props} />
  </ErrorBoundary>
);
