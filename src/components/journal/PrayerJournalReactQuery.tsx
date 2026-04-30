import React, { useState, useMemo, useCallback } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
// import { format } from 'date-fns'; // Unused
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
// import { getFontFamily, DEFAULT_FONT_FAMILY } from '../../theme/fonts'; // Unused
import { JournalCard } from './JournalCard';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useACTSPrayerData,
  useMarkSupplicationAnswered,
  useDeletePrayer,
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
import type { PluginFilters } from '../../systems/journal/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

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
  onEdit?: (prayer: any) => void;
  onDelete?: (prayer: any) => void;
}

const SwipeablePrayerCard: React.FC<SwipeablePrayerCardProps> = ({
  prayer,
  type,
  onMarkAnswered,
  onEdit,
  onDelete,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.prayerItem,
        prayer.answered_at && styles.prayerItemAnswered,
      ]}
      onPress={() => {
        if (onEdit) {
          triggerLightHaptic();
          onEdit(prayer);
        }
      }}
      onLongPress={() => {
        if (onDelete) {
          triggerLightHaptic();
          onDelete(prayer);
        }
      }}
      activeOpacity={0.7}
    >
      <ThemedText style={styles.prayerText}>{prayer.content}</ThemedText>

      {/* Mark as Answered Button - for supplication and open prayer when not answered and tracking is enabled */}
      {((type.key === 'supplication' || type.key === 'freeform') && !prayer.answered_at && prayer.metadata?.track_answered === true) && (
        <TouchableOpacity
          style={styles.markAnsweredButton}
          onPress={() => {
            // Directly mark as answered (no confirmation)
            onMarkAnswered(prayer.id, true);
          }}
        >
          <Ionicons name="checkmark" size={14} color={Colors.alertCoral} />
          <ThemedText style={styles.markAnsweredText} weight="medium">Mark Answered</ThemedText>
        </TouchableOpacity>
      )}

      {/* Answered Indicator - Tappable to mark as unanswered */}
      {prayer.answered_at && ((type.key === 'supplication' || type.key === 'freeform') ? prayer.metadata?.track_answered === true : true) && (
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
          <MaterialCommunityIcons name="hand-heart" size={14} color={Colors.growthGreen} />
          <ThemedText style={styles.answeredText} weight="medium">Answered</ThemedText>
          {prayer.answered_at && (
            <ThemedText style={styles.answeredTimestamp}>
              {formatAnsweredDate(prayer.answered_at)}
            </ThemedText>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// CombinedCASTPrayerCard Component - displays CAST prayers as one whole prayer with supplication at bottom
interface CombinedCASTPrayerCardProps {
  allPrayers: any[];
  supplicationPrayer: any | null;
  onMarkAnswered: (id: string, isAnswered: boolean) => void;
  onEdit?: (prayer: any) => void;
  onDelete?: (prayer: any) => void;
}

const CombinedCASTPrayerCard: React.FC<CombinedCASTPrayerCardProps> = ({
  allPrayers,
  supplicationPrayer,
  onMarkAnswered,
  onEdit,
  onDelete,
}) => {
  // Get prayers in order (confession, adoration, supplication, thanksgiving)
  const order = ['confession', 'adoration', 'supplication', 'thanksgiving'];
  const orderedPrayers = order
    .map(type => allPrayers.find((p: any) => p.type === type))
    .filter(Boolean);

  // Split content: before supplication and after supplication
  const supplicationIndex = orderedPrayers.findIndex((p: any) => p.type === 'supplication');
  const beforeSupplication = orderedPrayers.slice(0, supplicationIndex);
  const afterSupplication = orderedPrayers.slice(supplicationIndex + 1);

  return (
    <TouchableOpacity
      style={styles.combinedCASTCard}
      onPress={() => {
        if (onEdit && orderedPrayers.length > 0) {
          triggerLightHaptic();
          onEdit(orderedPrayers[0]);
        }
      }}
      onLongPress={() => {
        if (onDelete && orderedPrayers.length > 0) {
          triggerLightHaptic();
          onDelete(orderedPrayers[0]);
        }
      }}
      activeOpacity={0.7}
    >
      {/* Opening */}
      {orderedPrayers.length > 0 && (
        <View style={styles.combinedContentSection}>
          <ThemedText style={styles.suggestedPrayerText}>Heavenly Father,</ThemedText>
        </View>
      )}

      {/* Content before supplication (confession, adoration) */}
      {beforeSupplication.map((prayer: any) => (
        <View key={prayer.id} style={styles.combinedContentSection}>
          <ThemedText style={styles.combinedPrayerText}>{prayer.content}</ThemedText>
        </View>
      ))}

      {/* Supplication content */}
      {supplicationPrayer && (
        <View style={styles.combinedContentSection}>
          <ThemedText style={styles.combinedPrayerText}>{supplicationPrayer.content}</ThemedText>
        </View>
      )}

      {/* Tracking indicator for supplication - shown right after supplication */}
      {supplicationPrayer && supplicationPrayer.metadata?.track_answered === true && (
        <View style={styles.trackingSection}>
          {/* Mark as Answered Button */}
          {!supplicationPrayer.answered_at && (
            <TouchableOpacity
              style={styles.markAnsweredButton}
              onPress={() => {
                onMarkAnswered(supplicationPrayer.id, true);
              }}
            >
              <Ionicons name="checkmark" size={14} color={Colors.alertCoral} />
              <ThemedText style={styles.markAnsweredText} weight="medium">Mark Answered</ThemedText>
            </TouchableOpacity>
          )}

          {/* Answered Indicator */}
          {supplicationPrayer.answered_at && (
            <TouchableOpacity
              style={styles.answeredIndicator}
              onPress={() => {
                Alert.alert(
                  'Mark as Unanswered',
                  'Mark this prayer as unanswered?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Mark Unanswered',
                      onPress: () => onMarkAnswered(supplicationPrayer.id, false),
                    },
                  ]
                );
              }}
            >
              <MaterialCommunityIcons name="hand-heart" size={14} color={Colors.growthGreen} />
              <ThemedText style={styles.answeredText} weight="medium">Answered</ThemedText>
              {supplicationPrayer.answered_at && (
                <ThemedText style={styles.answeredTimestamp}>
                  {formatAnsweredDate(supplicationPrayer.answered_at)}
                </ThemedText>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content after supplication (thanksgiving) */}
      {afterSupplication.map((prayer: any) => (
        <View key={prayer.id} style={styles.combinedContentSection}>
          <ThemedText style={styles.combinedPrayerText}>{prayer.content}</ThemedText>
        </View>
      ))}

      {/* Closing */}
      {orderedPrayers.length > 0 && (
        <View style={styles.combinedContentSection}>
          <ThemedText style={styles.suggestedPrayerText}>In Jesus' Name, Amen</ThemedText>
        </View>
      )}
    </TouchableOpacity>
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
  navigation?: NativeStackNavigationProp<RootStackParamList>;
}

export const PrayerJournalReactQuery: React.FC<PrayerJournalProps> = ({
  selectedDate = new Date(),
  variant = 'carousel',
  viewMode,
  expanded,
  onExpand,
  filters,
  navigation,
}) => {
  // Global edit mode context (only for inline view)
  const globalEditMode = useEditModeSafe();

  const { user } = useAuth();
  // const theme = useTheme(); // Unused
  // const regularFont = getFontFamily(theme.currentFont || DEFAULT_FONT_FAMILY, 'regular'); // Unused
  const dateStr = toLocalDateString(selectedDate);
  const dateCategory = getDateCategory(selectedDate);

  // React Query hooks
  const { data: prayerEntries = [] } = useACTSPrayerData(user?.id || '', dateStr);
  const markAnsweredMutation = useMarkSupplicationAnswered();
  const deletePrayerMutation = useDeletePrayer();

  // Local state
  const [isEditing, setIsEditing] = useState(false);

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
      metadata: entry.metadata,
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

  // Check if we have content to display
  const hasContent = displayPrayers.length > 0;

  // Get dynamic subtitle based on context
  const getSubtitle = () => {
    if (isEditing) {
      return 'CAST Method & Open Prayer';
    }
    if (hasContent) {
      // Count ACTS prayer sessions (1 CAST prayer = 1 prayer, not per step)
      const actsPrayers = displayPrayers.filter(p => p.type !== 'freeform');
      const openPrayers = displayPrayers.filter(p => p.type === 'freeform');

      // Group ACTS prayers by time window (entries within 2 minutes = 1 prayer session)
      const sortedActs = actsPrayers.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      let actsCount = 0;
      let lastSessionTime = 0;
      const SESSION_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

      for (const prayer of sortedActs) {
        const prayerTime = new Date(prayer.created_at).getTime();
        if (prayerTime - lastSessionTime > SESSION_WINDOW_MS) {
          actsCount++;
          lastSessionTime = prayerTime;
        }
      }

      // Open prayers are counted individually
      const openCount = openPrayers.length;

      const totalCount = actsCount + openCount;
      const answeredCount = displayPrayers.filter(p => p.is_answered || p.status === 'answered' || !!p.answered_at).length;

      // Determine prayer path type
      let prayerPath = '';
      if (actsCount > 0 && openCount > 0) {
        prayerPath = 'CAST & Open';
      } else if (actsCount > 0) {
        prayerPath = 'CAST Method';
      } else if (openCount > 0) {
        prayerPath = 'Open Prayer';
      }

      // Main prayer count line with path
      let subtitle = totalCount === 1 ? '1 Prayer' : `${totalCount} Prayers`;
      if (prayerPath) {
        subtitle += ` • ${prayerPath}`;
      }

      // Add answered count on a new line if there are answered prayers
      if (answeredCount > 0) {
        subtitle += `\n${answeredCount} Answered Prayer${answeredCount !== 1 ? 's' : ''}`;
      }

      return subtitle;
    }
    return 'CAST Method & Open Prayer';
  };

  // Handle edit mode - navigate to walkthrough
  const toggleEditing = useCallback(() => {
    if (navigation) {
      navigation.navigate('PrayerJournalWalkthrough', {
        selectedDate: toLocalDateString(selectedDate),
      });
    }
  }, [navigation, selectedDate]);

  // Handle cancel editing
  const handleCancelEdit = useCallback(() => {
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

  // Handle delete prayer
  const handleDeletePrayer = useCallback((prayer: any) => {
    Alert.alert(
      'Delete Prayer',
      'Are you sure you want to delete this prayer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerLightHaptic();

              // For CAST prayers, delete the entire session (all prayers within 2 minutes)
              if (prayer.type !== 'freeform') {
                const actsPrayers = displayPrayers.filter((p: any) => p.type !== 'freeform');
                const SESSION_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
                const prayerTime = new Date(prayer.created_at).getTime();

                // Find all prayers in the same session
                const sessionPrayers = actsPrayers.filter((p: any) => {
                  const pTime = new Date(p.created_at).getTime();
                  return Math.abs(pTime - prayerTime) <= SESSION_WINDOW_MS;
                });

                // Delete all prayers in the session in parallel to avoid sequential animations
                await Promise.all(
                  sessionPrayers.map(p =>
                    deletePrayerMutation.mutateAsync({
                      id: p.id,
                      _userId: user?.id || '',
                      _dateStr: dateStr,
                    })
                  )
                );
              } else {
                // For open prayers, delete individually
                await deletePrayerMutation.mutateAsync({
                  id: prayer.id,
                  _userId: user?.id || '',
                  _dateStr: dateStr,
                });
              }

              triggerSuccessHaptic();
            } catch (error) {
              console.error('Failed to delete prayer:', error);
              Alert.alert('Error', 'Failed to delete prayer. Please try again.');
            }
          },
        },
      ]
    );
  }, [deletePrayerMutation, dateStr, user?.id, displayPrayers]);

  // Handle edit prayer - navigate to walkthrough with pre-selected type
  const handleEditPrayer = useCallback((prayer: any) => {
    if (!navigation) return;

    // Determine prayer type: 'acts' for CAST method, 'open' for open prayer
    const prayerType = prayer.type === 'freeform' ? 'open' : 'acts';

    // Navigate to walkthrough with pre-selected type
    navigation.navigate('PrayerJournalWalkthrough', {
      selectedDate: dateStr,
      initialPrayerType: prayerType,
      editingPrayerId: prayer.id,
    });
  }, [navigation, dateStr]);

  // Handle global edit mode changes for inline view
  React.useEffect(() => {
    if (viewMode === 'inline' && globalEditMode?.isGlobalEditMode && !isEditing) {
      setIsEditing(true);
    } else if (viewMode === 'inline' && !globalEditMode?.isGlobalEditMode && isEditing) {
      setIsEditing(false);
    }
  }, [globalEditMode?.isGlobalEditMode, viewMode, isEditing]);

  // Render existing prayers - redesigned to show CAST vs Open Prayer structure
  const renderExistingPrayers = () => {
    const actsPrayers = displayPrayers.filter((p: any) => p.type !== 'freeform');
    const openPrayers = displayPrayers.filter((p: any) => p.type === 'freeform');

    // Group ACTS prayers by session (within 2 minutes)
    const SESSION_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
    const sortedActs = actsPrayers.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const actsSessions: any[][] = [];
    let currentSession: any[] = [];

    for (const prayer of sortedActs) {
      const prayerTime = new Date(prayer.created_at).getTime();
      if (currentSession.length === 0) {
        currentSession.push(prayer);
      } else {
        const lastPrayerTime = new Date(currentSession[currentSession.length - 1].created_at).getTime();
        if (prayerTime - lastPrayerTime <= SESSION_WINDOW_MS) {
          currentSession.push(prayer);
        } else {
          actsSessions.push(currentSession);
          currentSession = [prayer];
        }
      }
    }
    if (currentSession.length > 0) {
      actsSessions.push(currentSession);
    }

    return (
      <View
        style={[
          styles.prayersContainer,
          (expanded || viewMode === 'inline') && styles.prayersContainerExpanded,
        ]}
      >
        {/* CAST Method Section */}
        {actsSessions.length > 0 && (
          <View style={styles.prayerPathSection}>
            <View style={styles.prayerPathHeader}>
              <MaterialCommunityIcons
                name="layers"
                size={18}
                color={Colors.alertCoral}
              />
              <ThemedText style={styles.prayerPathTitle} weight="semiBold">CAST METHOD</ThemedText>
              <View style={styles.prayerPathDivider} />
            </View>
            <View style={styles.castStepsContainer}>
              {actsSessions.map((session, sessionIndex) => {
                const supplication = session.find((p: any) => p.type === 'supplication');

                return (
                  <CombinedCASTPrayerCard
                    key={`session-${sessionIndex}`}
                    allPrayers={session}
                    supplicationPrayer={supplication || null}
                    onMarkAnswered={handleMarkAnswered}
                    onEdit={handleEditPrayer}
                    onDelete={handleDeletePrayer}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Open Prayer Section */}
        {openPrayers.length > 0 && (
          <View style={styles.prayerPathSection}>
            <View style={styles.prayerPathHeader}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={18}
                color={Colors.alertCoral}
              />
              <ThemedText style={styles.prayerPathTitle} weight="semiBold">OPEN PRAYER</ThemedText>
              <View style={styles.prayerPathDivider} />
            </View>
            <View style={styles.openPrayerContainer}>
              {openPrayers.map((prayer: any) => {
                const type = PRAYER_TYPES.find(t => t.key === 'freeform');
                return (
                  <SwipeablePrayerCard
                    key={prayer.id}
                    prayer={prayer}
                    type={type}
                    onMarkAnswered={handleMarkAnswered}
                    onEdit={handleEditPrayer}
                    onDelete={handleDeletePrayer}
                  />
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  };

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
      </JournalCard>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  editContainer: {
    gap: 16,
  },
  prayersContainer: {
    gap: 24,
    maxHeight: 200,
  },
  combinedCASTCard: {
    backgroundColor: '#35537e',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  combinedContentSection: {
    gap: 12,
  },
  trackingSection: {
    marginTop: 12,
    marginBottom: 12,
  },
  combinedPrayerText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  suggestedPrayerText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  supplicationSection: {
    gap: 8,
    marginTop: 8,
  },
  supplicationDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 4,
  },
  supplicationLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
  },
  supplicationText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  prayersContainerExpanded: {
    gap: 16,
    maxHeight: undefined,
  },
  prayerPathSection: {
    gap: 16,
  },
  prayerPathHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  prayerPathTitle: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: Colors.alertCoral,
  },
  prayerPathDivider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  castStepsContainer: {
    gap: 16,
  },
  castStepSection: {
    gap: 8,
  },
  castStepLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
  },
  openPrayerContainer: {
    gap: 8,
  },
  prayerTypeSection: {
    gap: 12,
    marginBottom: 8,
  },
  prayerTypeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  prayerTypeSectionTitle: {
    fontSize: 13,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 4,
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    alignSelf: 'flex-end',
    marginTop: 8,
    gap: 6,
  },
  markAnsweredText: {
    fontSize: 12,
    color: Colors.alertCoral,
  },
  answeredIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  answeredText: {
    fontSize: 12,
    color: Colors.growthGreen,
  },
  answeredTimestamp: {
    color: 'rgba(76, 175, 80, 0.9)',
    fontSize: 10,
    marginLeft: 4,
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
