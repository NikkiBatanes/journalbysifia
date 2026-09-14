import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, TextInput, StyleSheet, TouchableOpacity, Alert, Animated, DeviceEventEmitter } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import ThemedText from '../common/ThemedText';

import { Check, HandHeart as LuHandHeart, X, Pencil } from 'lucide-react-native';

import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  createLocalJournalEntry,
  getLocalJournalEntries,
  updateLocalJournalEntry,
  deleteLocalJournalEntry,
} from '../../storage/journalStorage';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';

import { ErrorBoundary } from '../ErrorBoundary';
import { GratitudeSkeleton } from '../SkeletonLoader/GratitudeSkeleton';
import { analytics } from '../../utils/analytics';
import {
  triggerLightHaptic,
  triggerSelectionHaptic,
  triggerSuccessHaptic,
  triggerErrorHaptic,
} from '../../utils/haptics';
import { useScroll } from '../../context/ScrollContext';
import { visibleStreakService } from '../../services/visibleStreakService';

// Pluralization helpers
const pluralS = (count: number) => (count === 1 ? '' : 's');
// const entryWord = (count: number) => (count === 1 ? 'entry' : 'entries'); // Unused

interface GratitudeItem {
  id: string;
  text: string;
  date: Date;
}

interface GratitudeListProps {
  selectedDate?: Date;
  refreshKey?: number;
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
  onBegin?: (existingEntry?: any, selectedDate?: Date) => void;
}

export const GratitudeListReactQuery: React.FC<GratitudeListProps> = ({ selectedDate = new Date(), viewMode, expanded, onExpand, onBegin }) => {
  const navigation = useNavigation();
  // Global edit mode context (only for inline view)
  // Global edit mode context - safe version that handles missing provider
  const globalEditMode = useEditModeSafe();

  // Dynamic theming for fonts (match dashboard)
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  // Create dynamic fonts object
  const fonts = useMemo(() => ({
    regular: getFontFamily(fontKey, 'regular'),
    medium: getFontFamily(fontKey, 'medium'),
    semiBold: getFontFamily(fontKey, 'semiBold'),
    bold: getFontFamily(fontKey, 'bold'),
  }), [fontKey]);

  // Memoize styles with fonts
  const styles = useMemo(() => createStyles(fonts), [fonts]);

  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newItems, setNewItems] = useState(['', '', '']); // Start with three input fields
  const [visibleCount, setVisibleCount] = useState<number>(5);
  const inputRefs = useRef<(TextInput | null)[]>([]); // Refs for input fields
  const shouldFocusInput = useRef(false); // Track when we need to focus

  // Listen for collapse event when navigating away from journal screen
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('collapse_all_expanded', () => {
      setVisibleCount(5);
    });
    return () => subscription.remove();
  }, []);

  // Animation for add button appearing/disappearing between cancel and save
  const buttonGroupAnim = useRef(new Animated.Value(0)).current;
  const cancelTranslateX = useRef(buttonGroupAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] })).current;
  const saveTranslateX = useRef(buttonGroupAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] })).current;
  const addButtonScale = useRef(buttonGroupAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })).current;
  const closeButtonScale = useRef(new Animated.Value(1)).current;

  // Determine if we should be in adding mode
  const shouldShowAddingMode = isAdding || isEditing || ((viewMode === 'inline' || viewMode === 'carousel') && globalEditMode?.isGlobalEditMode);

  // Show add (+) button only when the 3rd input field has content
  const shouldShowAddButton = (newItems[2]?.trim().length ?? 0) > 0;

  // Auth and date context
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);
  const { scrollToSection } = useScroll();

  // Determine date category: today, yesterday, earlier
  const now = new Date();
  const todayStr = toLocalDateString(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = toLocalDateString(yesterday);
  const isToday = dateStr === todayStr;
  const isYesterday = dateStr === yesterdayStr;
  const isEarlier = !isToday && !isYesterday;

  // Local-first gratitude data
  const loadStartTime = React.useRef<number>(Date.now());
  const [gratitudeEntries, setGratitudeEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    (async () => {
      try {
        const entries = await getLocalJournalEntries('gratitude', dateStr);
        if (!mounted) return;
        setGratitudeEntries(entries.filter(e => !e.metadata?.subtask_id));
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError as Error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [dateStr]);

  // Check for multiple entries
  if (gratitudeEntries.length > 1) {

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

  // Always reset to 0 when form opens or closes so there's no stale visibility
  useEffect(() => {
    buttonGroupAnim.setValue(0);
  }, [shouldShowAddingMode, buttonGroupAnim]);

  // Animate add button after the form is open and shouldShowAddButton changes
  useEffect(() => {
    if (!shouldShowAddingMode) {return;}
    Animated.spring(buttonGroupAnim, {
      toValue: shouldShowAddButton ? 1 : 0,
      useNativeDriver: true,
      tension: 100,
      friction: 12,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShowAddButton, shouldShowAddingMode]);

  // Focus input field when it's rendered and we need to focus
  useEffect(() => {
    if (shouldShowAddingMode && shouldFocusInput.current && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
      shouldFocusInput.current = false; // Reset the flag
    }
  }, [shouldShowAddingMode]); // Only watch shouldShowAddingMode

  const startAdding = useCallback(() => {
    if (!isAdding) { triggerLightHaptic(); }
    setIsAdding(true);
    setIsEditing(false);
    // Focus the input field with multiple attempts
    const focusInput = () => {
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    };

    // Try immediately
    focusInput();
    // Try again after delay
    setTimeout(focusInput, 100);
    // Try one more time with longer delay
    setTimeout(focusInput, 300);
  }, [isAdding]);

  const startEditing = useCallback(() => {
    if (!isEditing) { triggerLightHaptic(); }
    setIsEditing(true);
    setIsAdding(false);

    // Pre-fill with existing gratitude items
    const editFields = gratitudeItems.map(item => item.text);

    // Ensure we have at least 3 fields for editing
    while (editFields.length < 3) {
      editFields.push('');
    }

    setNewItems(editFields);
    // Focus the input field with multiple attempts
    const focusInput = () => {
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    };

    // Try immediately
    focusInput();
    // Try again after delay
    setTimeout(focusInput, 100);
    // Try one more time with longer delay
    setTimeout(focusInput, 300);
  }, [gratitudeItems, setIsEditing, setIsAdding, setNewItems, isEditing]);

  // Handle global edit mode activation
  React.useEffect(() => {
    if ((viewMode === 'inline' || viewMode === 'carousel') && globalEditMode?.isGlobalEditMode && !isAdding && !isEditing) {
      // If there are existing gratitude items, start editing them
      if (gratitudeItems.length > 0) {
        startEditing();
      } else {
        // If no existing items, start adding new ones
        startAdding();
      }
    }
  }, [globalEditMode?.isGlobalEditMode, gratitudeItems.length, viewMode, isAdding, isEditing, startEditing, startAdding]);

  const cancelAdding = () => {
    triggerSelectionHaptic();
    setIsAdding(false);
    setIsEditing(false);
    setNewItems(['', '', '']);
    // Scroll to reflect section (contains gratitude) when canceling
    setTimeout(() => {
      scrollToSection('reflect-carousel', -100);
    }, 100);
  };

  const handleCloseButtonPress = () => {
    Animated.spring(closeButtonScale, {
      toValue: 0.85,
      useNativeDriver: true,
      tension: 150,
      friction: 10,
    }).start(() => {
      Animated.spring(closeButtonScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 150,
        friction: 10,
      }).start();
    });
    cancelAdding();
  };

  const addAnotherField = useCallback(() => {
    triggerSelectionHaptic();
    const newFieldIndex = newItems.length;
    setNewItems([...newItems, '']);

    // Focus the newly added field
    setTimeout(() => {
      inputRefs.current[newFieldIndex]?.focus();
    }, 100);

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

  // Individual item edit handlers
  // editGratitudeItem removed - was defined but never called

  const saveGratitudeItems = async () => {
    const validItems = newItems.filter(item => item.trim());

    if (validItems.length > 0) {
      try {
        const itemsToSave = validItems.map((text, index) => ({
          id: `gratitude_${Date.now()}_${index}`,
          text: text.trim(),
          date: selectedDate,
        }));

        const contentToSave = JSON.stringify({ items: itemsToSave });

        if (gratitudeEntries.length > 0) {
          const updated = await updateLocalJournalEntry({
            ...gratitudeEntries[0],
            content: contentToSave,
            updated_at: new Date().toISOString(),
            version: (gratitudeEntries[0].version || 1) + 1,
          });
          setGratitudeEntries([updated]);

          if (gratitudeEntries.length > 1) {
            for (let i = 1; i < gratitudeEntries.length; i++) {
              try {
                await deleteLocalJournalEntry(gratitudeEntries[i].id, 'gratitude', dateStr);
              } catch (deleteError) {
                Logger.error('Error deleting extra gratitude entry', deleteError as Error, {
                  component: 'GratitudeListReactQuery',
                });
              }
            }
          }
        } else {
          const created = await createLocalJournalEntry({
            content_type: 'gratitude',
            selected_date: dateStr,
            content: contentToSave,
          });
          setGratitudeEntries([created]);

          if (user?.id) {
            const shouldShowStreak = await visibleStreakService.shouldShowCelebration(user.id, 'journal_gratitude_added');
            if (shouldShowStreak) {
              await visibleStreakService.markShownToday(user.id);
              (navigation as any).navigate('StreakPlan', {
                userId: user.id,
                source: 'journal_gratitude_added',
              });
            }
          }
        }

        if (user?.id) {
          analytics.trackGratitudeEvent('gratitude_items_saved', {
            items_count: validItems.length,
            total_text_length: validItems.join('').length,
            is_editing: isEditing,
            date: dateStr,
          }, user.id);
        }

        setTimeout(() => {
          scrollToSection('reflect-carousel', -100);
        }, 100);

        setNewItems(['', '', '']);
        setIsAdding(false);
        setIsEditing(false);

        triggerSuccessHaptic();

        if ((viewMode === 'inline' || viewMode === 'carousel') && globalEditMode?.isGlobalEditMode) {
          globalEditMode.setGlobalEditMode(false);
        }
      } catch (saveError) {
        Logger.error('Error saving gratitude items', saveError as Error, {
          component: 'GratitudeListReactQuery',
        });
        Alert.alert('Error', 'Failed to save gratitude items. Please try again.');
        triggerErrorHaptic();
      }
    } else {
      if (gratitudeEntries.length > 0) {
        try {
          await deleteLocalJournalEntry(gratitudeEntries[0].id, 'gratitude', dateStr);
          setGratitudeEntries([]);

          setNewItems(['', '', '']);
          setIsAdding(false);
          setIsEditing(false);

          triggerSuccessHaptic();

          setTimeout(() => {
            scrollToSection('reflect-carousel', -100);
          }, 100);

          if ((viewMode === 'inline' || viewMode === 'carousel') && globalEditMode?.isGlobalEditMode) {
            globalEditMode.setGlobalEditMode(false);
          }
        } catch (deleteError) {
          Logger.error('Error deleting gratitude entry', deleteError as Error, {
            component: 'GratitudeListReactQuery',
          });
          Alert.alert('Error', 'Failed to delete gratitude items. Please try again.');
          triggerErrorHaptic();
        }
      } else {
        setNewItems(['', '', '']);
        setIsAdding(false);
        setIsEditing(false);

        setTimeout(() => {
          scrollToSection('reflect-carousel', -100);
        }, 100);
      }
    }
  };

  const loadMore = useCallback(() => {
    triggerLightHaptic();
    setVisibleCount(prev => Math.min(prev + 5, gratitudeItems.length));
  }, [gratitudeItems.length]);

  const showLess = useCallback(() => {
    triggerLightHaptic();
    setVisibleCount(5);
    // Scroll to reflect section (contains gratitude) when showing less
    setTimeout(() => {
      scrollToSection('reflect-carousel', -100);
    }, 100);
  }, [scrollToSection]);

  const displayGratitudeList = () => {
    if (isAdding || isEditing) {return null;}

    if (gratitudeItems.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="heart-circle-outline"
              size={32}
              color={Colors.textGray}
              style={styles.emptyStateIcon}
            />
            <ThemedText weight="semiBold" style={styles.sectionLabel} accessibilityRole="text">GRATITUDE LIST</ThemedText>
          </View>
          <View style={styles.titleContainer}>
            <ThemedText
              style={styles.emptyStateTitle}
              accessibilityRole="header"
              numberOfLines={1}
              ellipsizeMode="tail"
              weight="semiBold"
            >
              {isYesterday ? 'Gratitude for Yesterday' : isEarlier ? 'Gratitude on This Day' : 'Give Thanks Today'}
            </ThemedText>
          </View>
          <ThemedText style={styles.emptyStateSubtext} accessibilityRole="text">
            {isYesterday
              ? 'Pause to notice what God did yesterday'
              : isEarlier
                ? 'Note ways God was present\non this day'
                : 'Note blessings to\ncultivate a heart of gratitude'}
          </ThemedText>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => {
              triggerLightHaptic();
              if (onBegin) {
                onBegin(undefined, selectedDate);
              } else {
                startAdding();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={(isYesterday || isEarlier) ? 'Revisit gratitude list' : 'Begin gratitude list'}
          >
            <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
            <ThemedText style={styles.emptyStateButtonText}>
              {(isYesterday || isEarlier) ? 'Revisit' : 'Begin'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    const visibleItems = gratitudeItems.slice(0, visibleCount);
    const hasMore = !isAdding && gratitudeItems.length > visibleCount;
    const showLessOption = !isAdding && visibleCount > 5;

    return (
      <View style={styles.itemsContainer}>
        {/* Removed inline summary bar and 'Add another' CTA; summary now shown in header subtitle */}
        {visibleItems.map((item, index) => (
        <View
          key={item.id}
          style={styles.itemRowTopAligned}
          accessibilityRole="text"
          accessibilityLabel={`Gratitude item ${index + 1} of ${visibleItems.length}: ${item.text}`}
        >
          <View style={styles.itemNumber}>
            <ThemedText style={styles.numberText} accessibilityElementsHidden={true}>{index + 1}</ThemedText>
          </View>
          <ThemedText style={styles.itemText} accessibilityElementsHidden={true}>{String(item.text || '')}</ThemedText>
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
                  <ThemedText style={[styles.paginationButtonText, styles.showMoreText]}>
                    Show more
                  </ThemedText>
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
                  <Ionicons name="chevron-up" size={12} color={Colors.textGray} />
                  <ThemedText style={[styles.paginationButtonText, styles.showLessText]}>
                    Show less
                  </ThemedText>
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
          title="GRATITUDE LIST"
          subtitle="Reflect on your gratitude today"
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

  // Determine if there's content
  const hasContent = gratitudeItems.length > 0;

  // Hide empty component in inline and moments view
  if ((viewMode === 'inline' || viewMode === 'moments') && !isLoading && !error && gratitudeItems.length === 0) {
    return null;
  }

  // Dynamic subtitle: show count summary for Yesterday/Earlier when there is content
  const count = gratitudeItems.length;
  const dynamicSubtitle = (hasContent || shouldShowAddingMode)
    ? ((hasContent && (isYesterday || isEarlier))
        ? (isYesterday
            ? (count === 1
                ? '1 moment of gratitude yesterday'
                : `You gave thanks ${count} time${pluralS(count)} yesterday`)
            : (count === 1
                ? '1 moment remembered on this day'
                : `${count} moments remembered on this day`))
        : (isYesterday
            ? 'Reflect on your gratitude yesterday'
            : (isEarlier
                ? 'Reflect on your gratitude on this day'
                : 'Reflect on your gratitude today')))
    : undefined;

  return (
    <ErrorBoundary name="GratitudeListReactQuery">
      <JournalCard
        icon={(hasContent || shouldShowAddingMode) ? (
          <MaterialCommunityIcons
            name="heart-circle-outline"
            size={24}
            color={Colors.alertCoral}
          />
        ) : undefined}
        title={(hasContent || shouldShowAddingMode) ? 'GRATITUDE LIST' : undefined}
        subtitle={dynamicSubtitle}
        showAddButton={hasContent ? !shouldShowAddingMode : false}
        onAdd={() => {
          if (onBegin) {
            // Pass all gratitude items from all entries for editing
            const allItems = gratitudeItems.map(item => item.text);
            // Create a synthetic entry object with all items
            const syntheticEntry = gratitudeEntries.length > 0 ? {
              ...gratitudeEntries[0],
              content: JSON.stringify({ items: allItems }),
            } : undefined;
            onBegin(syntheticEntry, selectedDate);
          } else {
            if (gratitudeItems.length > 0) {
              startEditing();
            } else {
              startAdding();
            }
          }
        }}
        isAdding={shouldShowAddingMode}
        viewMode={viewMode}
        expanded={expanded}
        onExpand={onExpand}
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
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[styles.input, index > 0 && styles.inputWithTopMargin, { fontFamily: getFontFamily(fontKey, 'regular') }]}
                value={item}
                onChangeText={(value) => handleNewItemChange(index, value)}
                placeholder="I'm grateful for..."
                placeholderTextColor={Colors.textGray}
                returnKeyType={index < newItems.length - 1 ? 'next' : 'done'}
                onSubmitEditing={index < newItems.length - 1 ? undefined : saveGratitudeItems}
                autoFocus={index === 0}
                accessibilityLabel={`Gratitude item ${index + 1} input`}
                accessibilityHint={'Enter something you\'re grateful for'}
              />
            ))
          ) : (
            <React.Fragment>
              {newItems.map((item, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={[styles.input, index > 0 && styles.inputWithTopMargin, { fontFamily: getFontFamily(fontKey, 'regular') }]}
                  value={item}
                  onChangeText={(value) => handleNewItemChange(index, value)}
                  placeholder="I'm grateful for..."
                  placeholderTextColor={Colors.textGray}
                  returnKeyType={index < newItems.length - 1 ? 'next' : 'done'}
                  onSubmitEditing={index < newItems.length - 1 ? undefined : saveGratitudeItems}
                  autoFocus={index === 0}
                  accessibilityLabel={`Gratitude item ${index + 1} input`}
                  accessibilityHint={'Enter something you\'re grateful for'}
                />
              ))}
            </React.Fragment>
          )}
          <View style={styles.buttonRow}>
            <View style={styles.actionButtonsGroup}>
              <Animated.View style={{ transform: [{ translateX: cancelTranslateX }] }}>
                <Animated.View style={{ transform: [{ scale: closeButtonScale }] }}>
                  <TouchableOpacity
                    onPress={handleCloseButtonPress}
                    style={[styles.button, styles.cancelButton]}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel adding gratitude items"
                    accessibilityHint="Cancels the current gratitude input and closes the form"
                  >
                    <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>
              <Animated.View
                pointerEvents={shouldShowAddButton ? 'auto' : 'none'}
                style={{ opacity: buttonGroupAnim, transform: [{ scale: addButtonScale }] }}
              >
                <TouchableOpacity
                  onPress={addAnotherField}
                  style={[styles.button, styles.addAnotherButton]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Add another gratitude field"
                  accessibilityHint="Adds another input field for gratitude items"
                >
                  <View style={styles.plusIcon}>
                    <Ionicons name="add" size={17} color={Colors.alertCoral} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={{ transform: [{ translateX: saveTranslateX }] }}>
                <TouchableOpacity
                  onPress={saveGratitudeItems}
                  style={[
                    styles.button,
                    styles.saveButton,
                    !newItems.some(item => item.trim()) && styles.disabledButton,
                  ]}
                  disabled={!newItems.some(item => item.trim())}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Save gratitude items"
                  accessibilityHint="Saves your gratitude items and closes the form"
                  accessibilityState={{ disabled: !newItems.some(item => item.trim()) }}
                >
                  <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </View>
      ) : null}
    </JournalCard>
    </ErrorBoundary>
  );
};

const createStyles = (fonts: any) => StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
  },
  emptyText: {
    color: Colors.textGray,
    fontFamily: fonts.regular,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  itemsContainer: {
    width: '100%',
    marginTop: 0, // Reduced from 10 to 4 to match Today's Win component
    gap: 12,
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
    fontFamily: fonts.medium,
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
    color: Colors.textGray,
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
    fontFamily: fonts.regular,
    fontSize: 16,
    flex: 1,
    lineHeight: 24,
    marginRight: 8,
  },
  numberText: {
    color: Colors.alertCoral,
    fontFamily: fonts.bold,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 18, // Ensure vertical centering in the circle
  },

  // Input styles
  inputContainer: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  inputWithTopMargin: {
    marginTop: 8,
  },

  // Button styles
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
  },
  actionButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    backgroundColor: 'transparent',
    width: 24,
    height: 24,
    borderRadius: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAnotherButton: {
    backgroundColor: 'transparent',
    width: 24,
    height: 24,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  plusIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonGroup: {
    flexDirection: 'row',
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
  loadingText: {
    fontFamily: fonts.regular,
    color: Colors.textGray,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
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
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.semiBold,
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
