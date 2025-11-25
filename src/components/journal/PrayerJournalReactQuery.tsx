import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
// import { format } from 'date-fns'; // Unused
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Check, Pencil } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
// import { getFontFamily, DEFAULT_FONT_FAMILY } from '../../theme/fonts'; // Unused
import { JournalCard } from './JournalCard';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/queryKeys';
import {
  useACTSPrayerData,
  useCreatePrayer,
  useMarkSupplicationAnswered,
  useDeletePrayer,
  useUpdatePrayer,
} from '../../services/hooks/usePrayerData';
import { ErrorBoundary } from '../ErrorBoundary';
import { analytics } from '../../utils/analytics';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';
import ThemedText from '../common/ThemedText';
// import { useTheme } from '../../hooks/useTheme'; // Unused
import {
  triggerLightHaptic,
  triggerSuccessHaptic,
  triggerSelectionHaptic,
  triggerErrorHaptic,
} from '../../utils/haptics';
import { PrayerStyleSelectionModal } from '../modals/PrayerStyleSelectionModal';
import type { PluginFilters } from '../../systems/journal/types';
import { faithPointsService } from '../../services/faithPointsService';

// Prayer types for ACTS method and freeform
const PRAYER_TYPES = [
  {
    key: 'adoration',
    label: 'ADORATION',
    displayName: 'Adoration',
    color: Colors.hopeWhite,
    description: 'Worshiping God for who He is and His character',
    icon: 'star',
    method: 'ACTS',
  },
  {
    key: 'confession',
    label: 'CONFESSION',
    displayName: 'Confession',
    color: Colors.hopeWhite,
    description: 'Acknowledging sins and seeking forgiveness',
    icon: 'heart',
    method: 'ACTS',
  },
  {
    key: 'thanksgiving',
    label: 'THANKSGIVING',
    displayName: 'Thanksgiving',
    color: Colors.hopeWhite,
    description: 'Thanking God for everything',
    icon: 'gift',
    method: 'ACTS',
  },
  {
    key: 'supplication',
    label: 'SUPPLICATION',
    displayName: 'Supplication',
    color: Colors.hopeWhite,
    description: 'Bringing your personal requests to God',
    icon: 'hand-left',
    method: 'ACTS',
  },
  {
    key: 'freeform',
    label: 'OPEN PRAYER',
    displayName: 'Open Prayer',
    color: Colors.growthGreen,
    description: 'Pray freely from your heart',
    icon: 'chatbubble-ellipses-outline',
    method: 'Freeform',
  },
];

// SwipeablePrayerCard Component
interface SwipeablePrayerCardProps {
  prayer: any;
  type: any;
  onMarkAnswered: (id: string, isAnswered: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const SwipeablePrayerCard: React.FC<SwipeablePrayerCardProps> = ({
  prayer,
  type,
  onMarkAnswered,
  onEdit,
  onDelete,
}) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <View style={styles.prayerSwipeActions}>
      <TouchableOpacity
        style={styles.editActionBtn}
        onPress={() => {
          onEdit(prayer.id);
          swipeableRef.current?.close();
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="create-outline" size={22} color="white" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteActionBtn}
        onPress={() => {
          onDelete(prayer.id);
          swipeableRef.current?.close();
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={22} color="white" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.swipeableContainer}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
      >
        <View
          style={[
            styles.prayerItem,
            prayer.answered_at && styles.prayerItemAnswered,
          ]}
        >
          <ThemedText style={styles.prayerText}>{prayer.content}</ThemedText>

          {/* Mark as Answered Button - for supplication and open prayer when not answered */}
          {((type.key === 'supplication' || type.key === 'freeform') && !prayer.answered_at) && (
            <TouchableOpacity
              style={styles.markAnsweredButton}
              onPress={() => {
                // Directly mark as answered (no confirmation)
                onMarkAnswered(prayer.id, true);
              }}
            >
              <Check size={12} color="#FF9500" />
              <ThemedText style={styles.markAnsweredText}>Mark as Answered</ThemedText>
            </TouchableOpacity>
          )}

          {/* Answered Indicator - Tappable to mark as unanswered */}
          {prayer.answered_at && (
            <TouchableOpacity
              style={styles.answeredIndicator}
              onPress={() => {
                if ((type.key === 'supplication' || type.key === 'freeform')) {
                  Alert.alert(
                    'Mark as Unanswered',
                    'Mark this prayer as unanswered?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Mark Unanswered',
                        onPress: () => onMarkAnswered(prayer.id, false),
                      },
                    ]
                  );
                }
              }}
            >
              <Check size={12} color={Colors.growthGreen} />
              <View style={styles.answeredTextContainer}>
                <ThemedText style={styles.answeredText}>Answered</ThemedText>
                <ThemedText style={styles.answeredTimestamp}>
                  {formatAnsweredDate(prayer.answered_at)}
                </ThemedText>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </Swipeable>
    </View>
  );
};

// Determine date category relative to local time
const getDateCategory = (targetDate: Date): 'today' | 'yesterday' | 'earlier' => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  const diffMs = startOfToday.getTime() - startOfTarget.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {return 'today';}
  if (diffDays === 1) {return 'yesterday';}
  return 'earlier';
};

// Dynamic empty-state copy by date category
const PRAYER_EMPTY_COPY: Record<'today' | 'yesterday' | 'earlier', { title: string; subtitle: string }> = {
  today: {
    title: 'Draw Near in Prayer',
    subtitle: 'Share your heart with the\nLord today',
  },
  yesterday: {
    title: 'Prayers from Yesterday',
    subtitle: 'Reflect on what you brought before God yesterday',
  },
  earlier: {
    title: 'Prayers from This Day',
    subtitle: 'Recall the prayers you offered\non this day',
  },
};

// Helper function to format answered date
const formatAnsweredDate = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return 'No date';
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const dateYear = date.getFullYear();

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    };

    // Only include year if it's different from current year
    if (dateYear !== currentYear) {
      options.year = 'numeric';
    }

    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    Logger.error('Error formatting date', error as Error, { component: 'PrayerJournalReactQuery' });
    return 'Error formatting date';
  }
};

interface PrayerJournalProps {
  selectedDate?: Date;
  refreshKey?: number;
  variant?: 'carousel' | 'inline';
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
  filters?: PluginFilters;
}

export const PrayerJournalReactQuery: React.FC<PrayerJournalProps> = ({
  selectedDate = new Date(),
  variant = 'carousel',
  viewMode,
  expanded,
  onExpand,
  filters,
}) => {
  // Global edit mode context (only for inline view)
  const globalEditMode = useEditModeSafe();

  const { user } = useAuth();
  // const theme = useTheme(); // Unused
  // const regularFont = getFontFamily(theme.currentFont || DEFAULT_FONT_FAMILY, 'regular'); // Unused
  const dateStr = toLocalDateString(selectedDate);
  const dateCategory = getDateCategory(selectedDate);

  // React Query hooks
  const queryClient = useQueryClient();
  const { data: prayerEntries = [] } = useACTSPrayerData(user?.id || '', dateStr);
  const createMutation = useCreatePrayer();
  const markAnsweredMutation = useMarkSupplicationAnswered();
  const deleteMutation = useDeletePrayer();
  const updateMutation = useUpdatePrayer();

  // Local state
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPrayerType, setSelectedPrayerType] = useState<string>('');
  const [prayerText, setPrayerText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [editingPrayerId, setEditingPrayerId] = useState<string | null>(null);

  // Transform API data to local format
  const existingPrayers = useMemo(() => {
    if (!prayerEntries || typeof prayerEntries !== 'object') {return [];}

    // Handle the case where prayerEntries is an object with prayer type arrays
    const prayerData = prayerEntries as any;
    const allPrayers = [
      ...(prayerData.adoration || []),
      ...(prayerData.confession || []),
      ...(prayerData.thanksgiving || []),
      ...(prayerData.supplication || []),
      ...(prayerData.freeform || []),
    ];

    return allPrayers.map((entry: any) => ({
      id: entry.id,
      type: entry.journal_category === 'personal_prayer' ? 'freeform' : (entry.journal_category || 'adoration'),
      content: entry.content,
      created_at: entry.created_at,
      status: entry.status,
      is_answered: entry.is_answered,
      answered_at: entry.answered_date,
    }));
  }, [prayerEntries]);

  // Map filters to local type keys used by this component
  const allowedTypeKeysFromFilters = useMemo(() => {
    if (!filters) {return undefined as string[] | undefined;}
    const allowed = filters.allowedJournalCategories || [];
    const mapped: string[] = [];
    allowed.forEach((c) => {
      const s = (c || '').toLowerCase();
      if (s === 'supplication') {mapped.push('supplication');}
      if (s === 'personal_prayer' || s === 'open' || s === 'open_prayer' || s === 'freeform') {mapped.push('freeform');}
    });
    return mapped.length > 0 ? mapped : undefined;
  }, [filters]);

  // Derive the prayers to actually display according to filters
  const displayPrayers = useMemo(() => {
    let list = [...existingPrayers];
    if (filters) {
      // Exclude unwanted categories (acts types)
      if (filters.excludeJournalCategories && filters.excludeJournalCategories.length > 0) {
        const exclude = new Set(filters.excludeJournalCategories.map(s => (s || '').toLowerCase()));
        list = list.filter(p => !exclude.has(p.type === 'freeform' ? 'personal_prayer' : p.type));
      }
      // Allowed categories (filter-in)
      if (allowedTypeKeysFromFilters && allowedTypeKeysFromFilters.length > 0) {
        const allow = new Set(allowedTypeKeysFromFilters);
        list = list.filter(p => allow.has(p.type));
      }
      // Answered-only
      if (filters.answeredOnly === true) {
        list = list.filter(p => !!p.is_answered || p.status === 'answered' || !!p.answered_at);
      }
      if (filters.answeredOnly === false) {
        list = list.filter(p => !(p.is_answered || p.status === 'answered' || !!p.answered_at));
      }
    }
    return list;
  }, [existingPrayers, filters, allowedTypeKeysFromFilters]);

  // Debug: log how many prayers will be displayed under current filters
  React.useEffect(() => {
    if (filters) {
      console.log('[PrayerJournalReactQuery] Filters applied:', {
        filters,
        existingPrayersCount: existingPrayers.length,
        displayPrayersCount: displayPrayers.length,
        allowedTypeKeysFromFilters,
        existingPrayers: existingPrayers.map(p => ({
          id: p.id,
          type: p.type,
          is_answered: p.is_answered,
          status: p.status,
          answered_at: p.answered_at,
        })),
      });
    }
  }, [filters, existingPrayers.length, displayPrayers.length, allowedTypeKeysFromFilters, existingPrayers]);

  // Check if we have content to display
  const hasContent = displayPrayers.length > 0;

  // Get dynamic subtitle based on context
  const getSubtitle = () => {
    if (isEditing) {
      const selectedType = PRAYER_TYPES.find(t => t.key === selectedPrayerType);
      return selectedType?.method === 'ACTS' ? 'ACTS Method Prayer' : 'Open Prayer';
    }
    if (hasContent) {
      const totalCount = displayPrayers.length;
      const supplicationCount = displayPrayers.filter(p => p.type === 'supplication').length;
      const openCount = displayPrayers.filter(p => p.type === 'freeform').length;
      const answeredCount = displayPrayers.filter(p => p.is_answered || p.status === 'answered' || !!p.answered_at).length;

      // Main prayer count line
      let subtitle = totalCount === 1 ? '1 Prayer' : `${totalCount} Prayers`;

      // Add prayer type breakdown
      const typeParts = [];
      if (supplicationCount > 0) {
        typeParts.push(`${supplicationCount} Supplication`);
      }
      if (openCount > 0) {
        typeParts.push(`${openCount} Open`);
      }

      if (typeParts.length > 0) {
        subtitle += ` • ${typeParts.join(', ')}`;
      }

      // Add answered count on a new line if there are answered prayers
      if (answeredCount > 0) {
        subtitle += `\n${answeredCount} Answered Prayer${answeredCount !== 1 ? 's' : ''}`;
      }

      return subtitle;
    }
    return 'ACTS & Open Prayer';
  };

  // Handle edit mode - directly open modal
  const toggleEditing = useCallback(() => {
    // Directly open modal without changing selection
    setShowStyleModal(true);
  }, []);

  // Handle prayer type selection
  const handlePrayerTypeSelect = useCallback((type: string) => {
    setSelectedPrayerType(type);
  }, []);

  // Handle style selection modal
  // handleOpenStyleModal and handleConfirmStyle removed - were defined but never used

  const handleCloseStyleModal = useCallback(() => {
    setShowStyleModal(false);
    setPrayerText('');
    // Clear selection when closing so nothing remains selected outside the modal
    setSelectedPrayerType('');
    setEditingPrayerId(null);
  }, []);

  // Handle prayer text change
  const handlePrayerTextChange = useCallback((text: string) => {
    setPrayerText(text);
  }, []);

  // Handle save prayer
  const handleSavePrayer = useCallback(async () => {
    if (!prayerText.trim()) {
      Alert.alert('Empty Prayer', 'Please enter your prayer before saving.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingPrayerId) {
        // Update existing prayer
        await updateMutation.mutateAsync({
          id: editingPrayerId,
          updates: {
            content: prayerText.trim(),
          },
          _userId: user?.id || '',
          _dateStr: dateStr,
        });

        // Manually invalidate ACTS prayer cache to ensure UI updates
        queryClient.invalidateQueries({
          queryKey: queryKeys.prayers.acts(user?.id || '', dateStr),
        });

        analytics.track('prayer_journal_entry_updated', {
          prayer_id: editingPrayerId,
          date: dateStr,
          content_length: prayerText.trim().length,
        });
      } else {
        // Require the user to choose a prayer type before creating
        if (!selectedPrayerType) {
          Alert.alert('Choose Prayer Type', 'Please select a prayer type (ACTS or Open Prayer) before saving.');
          setIsSaving(false);
          return;
        }
        // Create new prayer
        await createMutation.mutateAsync({
          user_id: user?.id || '',
          selected_date: dateStr,
          prayer_type: 'journal',
          journal_category: selectedPrayerType === 'freeform' ? 'personal_prayer' : selectedPrayerType as 'adoration' | 'confession' | 'thanksgiving' | 'supplication',
          content: prayerText.trim(),
          status: (selectedPrayerType === 'freeform' || selectedPrayerType === 'supplication') ? 'pending' : undefined,
        });

        if (user?.id) {
          const activityKey: Parameters<typeof faithPointsService.awardPoints>[1] =
            selectedPrayerType === 'freeform' ? 'prayer_journal_open' : 'prayer_journal_acts';

          faithPointsService
            .awardPoints(user.id, activityKey, {
              suppressNotification: true,
              source: 'prayer_journal',
              journal_category: selectedPrayerType,
              selected_date: dateStr,
            })
            .catch(error => {
              Logger.warn('[PrayerJournalReactQuery] Failed to award prayer journal faith points', { component: 'PrayerJournalReactQuery', data: error });
            });
        }

        analytics.track('prayer_journal_entry_created', {
          prayer_type: selectedPrayerType,
          date: dateStr,
          content_length: prayerText.trim().length,
        });
      }

      // Success feedback only after confirmed mutation success
      triggerSuccessHaptic();

      // Reset form
      setPrayerText('');
      setSelectedPrayerType('');
      setIsEditing(false);
      setEditingPrayerId(null);

      if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
        globalEditMode.setGlobalEditMode(false);
      }
    } catch (saveError) {
      Logger.error('Error saving prayer', saveError as Error, {
        component: 'PrayerJournalReactQuery',
      });
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
      // Error feedback
      triggerErrorHaptic();
    } finally {
      setIsSaving(false);
    }
  }, [prayerText, selectedPrayerType, user?.id, dateStr, createMutation, updateMutation, editingPrayerId, globalEditMode, viewMode, queryClient]);

  // Handle save from modal
  const handleSaveFromModal = useCallback(async () => {
    await handleSavePrayer();
    setShowStyleModal(false);
  }, [handleSavePrayer]);

  // Handle cancel editing
  const handleCancelEdit = useCallback(() => {
    setPrayerText('');
    // Ensure no selection remains when cancelling add/edit
    setSelectedPrayerType('');
    setIsEditing(false);

    if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
      globalEditMode.setGlobalEditMode(false);
    }
  }, [globalEditMode, viewMode]);

  // Handle mark prayer as answered
  const handleMarkAnswered = useCallback(async (prayerId: string, isAnswered: boolean) => {
    try {
      // Immediate selection feedback on explicit user tap
      triggerSelectionHaptic();
      await markAnsweredMutation.mutateAsync({
        id: prayerId,
        isAnswered,
        _userId: user?.id || '',
        _dateStr: dateStr,
      });

      // Success feedback only after mutation success
      triggerSuccessHaptic();

      analytics.track('prayer_marked_answered', {
        prayer_id: prayerId,
        is_answered: isAnswered,
        date: dateStr,
      });
    } catch (error) {
      Logger.error('Error marking prayer as answered', error as Error, { component: 'PrayerJournalReactQuery' });
      Alert.alert('Error', 'Failed to update prayer status. Please try again.');
      // Error feedback
      triggerErrorHaptic();
    }
  }, [markAnsweredMutation, dateStr, user?.id]);

  // Handle global edit mode changes for inline view
  React.useEffect(() => {
    if (viewMode === 'inline' && globalEditMode?.isGlobalEditMode && !isEditing) {
      setIsEditing(true);
    } else if (viewMode === 'inline' && !globalEditMode?.isGlobalEditMode && isEditing) {
      setIsEditing(false);
      setPrayerText('');
      setSelectedPrayerType('');
    }
  }, [globalEditMode?.isGlobalEditMode, viewMode, isEditing]);

  // Render existing prayers
  const renderExistingPrayers = () => (
    <View
      style={[
        styles.prayersContainer,
        (expanded || viewMode === 'inline') && styles.prayersContainerExpanded,
      ]}
    >
      {PRAYER_TYPES.map((type) => {
        const typePrayers = displayPrayers.filter((p: any) => p.type === type.key);
        if (typePrayers.length === 0) { return null; }

        return (
          <View key={type.key} style={styles.prayerTypeSection}>
            <View style={styles.prayerTypeSectionHeader}>
              <Ionicons
                name={type.icon}
                size={16}
                color={Colors.hopeWhite}
              />
              <ThemedText style={styles.prayerTypeSectionTitle} weight="semiBold">{type.displayName}</ThemedText>
            </View>
            {typePrayers.map((prayer: any) => (
              <SwipeablePrayerCard
                key={prayer.id}
                prayer={prayer}
                type={type}
                onMarkAnswered={handleMarkAnswered}
                onEdit={(prayerId: string) => {
                  // Find the prayer and open modal with its content
                  const prayerToEdit = existingPrayers.find(p => p.id === prayerId);
                  if (prayerToEdit) {
                    setEditingPrayerId(prayerId);
                    setSelectedPrayerType(prayerToEdit.type);
                    setPrayerText(prayerToEdit.content);
                    setShowStyleModal(true);
                  }
                }}
                onDelete={(prayerId: string) => {
                  Alert.alert(
                    'Delete Prayer',
                    'Are you sure you want to delete this prayer?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          deleteMutation.mutate({
                            id: prayerId,
                            _userId: user?.id || '',
                            _dateStr: dateStr,
                          });
                          triggerSuccessHaptic();
                        },
                      },
                    ]
                  );
                }}
              />
            ))}
          </View>
        );
      })}
    </View>
  );

  return (
    <ErrorBoundary>
      <JournalCard
        icon={hasContent || isEditing ? (
          <MaterialCommunityIcons
            name="hands-pray"
            size={24}
            color={Colors.alertCoral}
          />
        ) : undefined}
        title={hasContent || isEditing ? 'PRAYER JOURNAL' : undefined}
        subtitle={hasContent || isEditing ? getSubtitle() : undefined}
        variant={variant}
        viewMode={viewMode}
        expanded={expanded}
        onExpand={onExpand}
        showAddButton={hasContent || isEditing}
        onAdd={toggleEditing}
        isAdding={isEditing}
        onCancelAdd={handleCancelEdit}
      >
        {hasContent ? (
          renderExistingPrayers()
        ) : (viewMode === 'inline' || viewMode === 'moments') ? null : (
          <View style={styles.emptyStateContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="hands-pray"
                size={32}
                color={Colors.textGray}
                style={styles.emptyStateIcon}
              />
              <ThemedText style={styles.sectionLabel} accessibilityRole="text" weight="semiBold">
                PRAYER JOURNAL
              </ThemedText>
            </View>
            <View style={styles.titleContainer}>
              <ThemedText
                style={styles.emptyStateTitle}
                accessibilityRole="header"
                numberOfLines={1}
                ellipsizeMode="tail"
                weight="semiBold"
              >
                {PRAYER_EMPTY_COPY[dateCategory].title}
              </ThemedText>
            </View>
            <ThemedText style={styles.emptyStateSubtext}>
              {PRAYER_EMPTY_COPY[dateCategory].subtitle}
            </ThemedText>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => { triggerLightHaptic(); toggleEditing(); }}
            >
              <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
              <ThemedText style={styles.emptyStateButtonText} weight="medium">
                {dateCategory === 'today' ? 'Begin' : 'Revisit'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Prayer Style Selection Modal */}
        <PrayerStyleSelectionModal
          visible={showStyleModal}
          selectedPrayerType={selectedPrayerType}
          prayerText={prayerText}
          onSelectPrayerType={handlePrayerTypeSelect}
          onPrayerTextChange={handlePrayerTextChange}
          onSave={handleSaveFromModal}
          onCancel={handleCloseStyleModal}
          isSaving={isSaving}
        />
      </JournalCard>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  editContainer: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  prayersContainer: {
    maxHeight: 200,
  },
  prayersContainerExpanded: {
    maxHeight: undefined,
  },
  prayerTypeSection: {
    marginBottom: 8,
  },
  prayerTypeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  prayerTypeSectionTitle: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },
  prayerItem: {
    backgroundColor: '#35537e',
    borderRadius: 12,
    padding: 14,
  },
  prayerContent: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  markAnsweredButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'center',
    marginTop: 4,
    gap: 6,
  },
  markAnsweredText: {
    fontSize: 11,
    color: '#FF9500',
  },
  answeredIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  answeredText: {
    fontSize: 11,
    color: Colors.growthGreen,
  },
  answeredTextContainer: {
    marginLeft: 4,
  },
  answeredTimestamp: {
    fontSize: 9,
    color: Colors.textGray,
    marginTop: 1,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 12,
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyStateIcon: {
    marginBottom: 8,
    opacity: 0.8,
  },
  sectionLabel: {
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
  emptyStateButtonText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginRight: 8,
  },
  // Swipeable prayer card styles
  swipeableContainer: {
    marginBottom: 10, // Match the card's marginBottom
    overflow: 'hidden',
    borderRadius: 12, // Match the card border radius
  },
  prayerItemAnswered: {
    backgroundColor: '#35537e',
  },
  prayerText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  prayerItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  prayerDate: {
    fontSize: 12,
    color: Colors.textGray,
    opacity: 0.8,
  },
  actionButtons: {
    flexDirection: 'row',
    position: 'absolute',
    right: 10,
    top: 10,
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: Colors.alertCoral,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  prayerContentContainer: {
    flex: 1,
  },
  actionButtonsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    gap: 8,
  },
  prayerSwipeActions: {
    flexDirection: 'row',
    width: 168, // Match Todos swipe area width for consistency
    height: '100%', // Match the card height
    marginLeft: 8, // Add consistent gap like Todos
    overflow: 'hidden', // Ensure rounded corners are respected
    borderRadius: 12, // Match card border radius
  },
  editActionBtn: {
    flex: 1, // Fill all space left of delete button
    height: '100%',
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 12, // Add padding to move icon to the right
  },
  deleteActionBtn: {
    width: 75, // Make delete button smaller
    height: '100%',
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
});
