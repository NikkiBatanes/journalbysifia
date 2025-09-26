import React, { useState, useRef, useCallback, useMemo } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Colors } from '../../theme/colors';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';

import { Pencil, X, Check } from 'lucide-react-native';
import { JournalCard } from './JournalCard';
import { ErrorBoundary } from '../ErrorBoundary';
import { usePeoplePrayerData, useCreatePrayer, useUpdatePrayer, useDeletePrayer } from '../../services/hooks/usePrayerData';
import { PrayerApiEntry } from '../../services/api/prayerApi';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';
import ThemedText from '../common/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily, DEFAULT_FONT_FAMILY } from '../../theme/fonts';
import { PeoplePrayerModal } from '../modals/PeoplePrayerModal';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/queryKeys';
import { faithPointsService } from '../../services/faithPointsService';

// Use the API interface directly
type PersonPrayer = PrayerApiEntry;

interface EnhancedPrayerListReactQueryProps {
  selectedDate: Date;
  refreshKey?: number;
  variant?: 'carousel' | 'inline';
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
}

const EnhancedPrayerListReactQuery: React.FC<EnhancedPrayerListReactQueryProps> = ({
  selectedDate,
  variant = 'carousel',
  viewMode,
  expanded,
  onExpand,
}) => {
  console.log('🙏 EnhancedPrayerList: Component is rendering!', { selectedDate });

  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);
  const globalEditMode = useEditModeSafe();
  const theme = useTheme();
  const regularFont = getFontFamily(theme.currentFont || DEFAULT_FONT_FAMILY, 'regular');

  // React Query hooks for data fetching
  const queryClient = useQueryClient();
  const { data: peoplePrayers = [], error } = usePeoplePrayerData(
    user?.id || '',
    dateStr
  );
  // Debug log: print peoplePrayers every render
  console.log('[EnhancedPrayerListReactQuery] peoplePrayers:', peoplePrayers);
  const createPrayerMutation = useCreatePrayer();
  const updatePrayerMutation = useUpdatePrayer();
  const deleteMutation = useDeletePrayer();

  // Check if the selected date is in the past
  const today = new Date().toLocaleDateString('en-CA'); // Use local date to match dateStr format
  const isPastDate = dateStr < today;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPrayerId, setEditingPrayerId] = useState<string | null>(null);

  // Local state for form
  const [name, setName] = useState('');
  const [prayerText, setPrayerText] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedPrayerType, setSelectedPrayerType] = useState<string>('');
  const [currentRequestedBy, setCurrentRequestedBy] = useState<string | undefined>(undefined);

  // Computed values
  const hasContent = peoplePrayers.length > 0;
  // Only count requests that are not yet prayed
  const prayerRequests = peoplePrayers.filter(p => p.is_prayer_request === true && p.prayed !== true);
  const personalPrayers = peoplePrayers.filter(p => p.is_prayer_request !== true);

  // Counts should be by unique people, not entries
  const toName = (p: PersonPrayer) => (p.person_name || '').trim();
  const uniqueRequests = new Set(prayerRequests.map(toName));
  const uniquePersonal = new Set(personalPrayers.map(toName));
  const uniqueTotal = new Set<string>([...uniqueRequests, ...uniquePersonal]);

  // Helper: categorize selected date
  const getDateCategory = (targetDate: Date): 'today' | 'yesterday' | 'earlier' | 'future' => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const diffMs = startOfToday.getTime() - startOfTarget.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {return 'today';}
    if (diffDays === 1) {return 'yesterday';}
    if (diffDays > 1) {return 'earlier';}
    return 'future';
  };

  const category = getDateCategory(selectedDate);
  const isPast = category === 'yesterday' || category === 'earlier';
  const pastEmptyTitle = 'No People in Prayer List';
  const pastEmptySubtitle = category === 'yesterday'
    ? 'Appears when people were prayed for or prayer requests were added yesterday'
    : 'Appears when people were prayed for or prayer requests were added on this day';

  // Show header pencil only when there is content and it's not a past date
  const showAddInHeader = hasContent && !isPastDate;

  // Get dynamic subtitle based on context
  const getSubtitle = () => {
    if (hasContent) {
      const totalCount = uniqueTotal.size;
      let subtitle = totalCount === 1 ? '1 Person in your prayer list' : `${totalCount} People in your prayer list`;

      // Add breakdown on new line with requests first
      const reqCount = uniqueRequests.size;
      const prayedForCount = uniquePersonal.size;
      if (reqCount > 0 && prayedForCount > 0) {
        subtitle += `\n${reqCount} Request${reqCount > 1 ? 's' : ''} • ${prayedForCount} Prayed for`;
      } else if (reqCount > 0) {
        subtitle += `\n${reqCount} Request${reqCount > 1 ? 's' : ''}`;
      } else if (prayedForCount > 0) {
        subtitle += `\n${prayedForCount} Prayed for`;
      }

      return subtitle;
    }
    return 'Prayer list for people you care about';
  };

  const handleSavePrayer = useCallback(async () => {
    if (!user?.id || !name.trim() || !prayerText.trim()) {
      Alert.alert('Missing Information', 'Please fill in both name and prayer fields.');
      return;
    }

    // Require the user to choose a prayer type before creating
    if (!selectedPrayerType && !editingPrayerId) {
      Alert.alert('Choose Prayer Type', 'Please select whether this is a personal prayer or prayer request.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingPrayerId) {
        // Update existing prayer
        await updatePrayerMutation.mutateAsync({
          id: editingPrayerId,
          updates: {
            person_name: name.trim(),
            content: prayerText.trim(),
            notes: notes.trim() || undefined,
          },
          _userId: user.id,
          _dateStr: dateStr,
        });

        // Manually invalidate people prayer cache to ensure UI updates
        queryClient.invalidateQueries({
          queryKey: queryKeys.prayers.people(user.id, dateStr),
        });
      } else {
        // If we're adding a prayer that came from a request, mark the original request as prayed
        if (currentRequestedBy) {
          const originalRequest = peoplePrayers.find(
            item => item.person_name === name && item.is_prayer_request === true && !item.prayed
          );
          if (originalRequest) {
            await updatePrayerMutation.mutateAsync({
              id: originalRequest.id,
              updates: { prayed: true },
              _userId: user.id,
              _dateStr: dateStr,
            });
          }
        }

        // Create new prayer
        const prayerData = {
          user_id: user.id,
          prayer_type: 'people' as const,
          person_name: name.trim(),
          content: prayerText.trim(),
          is_prayer_request: selectedPrayerType === 'requests',
          notes: notes.trim() || undefined,
          metadata: {
            requested_by: currentRequestedBy,
          },
          selected_date: dateStr,
        };

        await createPrayerMutation.mutateAsync(prayerData);

        if (user?.id) {
          const activityKey: Parameters<typeof faithPointsService.awardPoints>[1] =
            selectedPrayerType === 'requests' ? 'prayer_list_request_added' : 'prayer_list_prayed';

          faithPointsService
            .awardPoints(user.id, activityKey, {
              suppressNotification: true,
              source: 'prayer_list',
              person_name: prayerData.person_name,
              is_prayer_request: prayerData.is_prayer_request,
              selected_date: dateStr,
            })
            .catch(error => {
              console.warn('[EnhancedPrayerListReactQuery] Failed to award prayer list faith points:', error);
            });
        }
      }

      triggerSuccessHaptic();

      // Clear inputs and close modal
      setName('');
      setPrayerText('');
      setNotes('');
      setSelectedPrayerType('');
      setCurrentRequestedBy(undefined);
      setEditingPrayerId(null);
      setShowModal(false);

      // Exit global edit mode if in inline view
      if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
        globalEditMode.setGlobalEditMode(false);
      }
    } catch (err) {
      console.error('Error saving prayer:', err);
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, name, prayerText, notes, selectedPrayerType, currentRequestedBy, editingPrayerId, dateStr, peoplePrayers, createPrayerMutation, updatePrayerMutation, queryClient, globalEditMode, viewMode]);

  const handleAddToMyList = (prayerEntry: PersonPrayer) => {
    // Set the requestedBy first
    setCurrentRequestedBy(prayerEntry.requested_by || 'Someone');

    // Switch to 'Prayers for People' type
    setSelectedPrayerType('mine');

    // Pre-fill the form fields
    setName(prayerEntry.person_name || '');
    setPrayerText(''); // Keep prayer text empty for user to fill
    setNotes(prayerEntry.content); // Move the prayer request content to notes

    // Open modal
    setShowModal(true);

    // Enable global edit mode if in inline view
    if (viewMode === 'inline' && globalEditMode?.setGlobalEditMode) {
      globalEditMode.setGlobalEditMode(true);
    }
  };

  // Modal handlers
  const handleOpenModal = useCallback(() => {
    triggerLightHaptic();
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setName('');
    setPrayerText('');
    setNotes('');
    setSelectedPrayerType('');
    setCurrentRequestedBy(undefined);
    setEditingPrayerId(null);

    if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
      globalEditMode.setGlobalEditMode(false);
    }
  }, [globalEditMode, viewMode]);

  // Handle global edit mode changes for inline view
  React.useEffect(() => {
    if (viewMode === 'inline' && globalEditMode?.isGlobalEditMode && !showModal) {
      setShowModal(true);
    } else if (viewMode === 'inline' && !globalEditMode?.isGlobalEditMode && showModal) {
      handleCloseModal();
    }
  }, [globalEditMode?.isGlobalEditMode, viewMode, showModal, handleCloseModal]);

  // Swipeable Prayer Card Component
  const SwipeablePrayerCard: React.FC<{
    prayer: PersonPrayer;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
  }> = ({ prayer, onEdit, onDelete }) => {
    const swipeableRef = useRef<Swipeable>(null);

    const renderRightActions = () => (
      <View style={styles.prayerSwipeActions}>
        <TouchableOpacity
          style={styles.editActionBtn}
          onPress={() => {
            try { triggerLightHaptic(); } catch {}
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
            try { triggerLightHaptic(); } catch {}
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
          rightThreshold={40}
          friction={2}
          overshootRight={false}
          onSwipeableWillOpen={() => { try { triggerLightHaptic(); } catch {} }}
          enableTrackpadTwoFingerGesture
          containerStyle={styles.swipeableRow}
        >
          <View style={styles.prayerItem}>
            <View style={styles.prayerHeader}>
              <View style={styles.prayerHeaderLeft}>
                <View style={styles.prayerTypeIndicator}>
                  <Ionicons
                    name={prayer.is_prayer_request === true ? 'mail-unread' : 'heart'}
                    size={14}
                    color={prayer.is_prayer_request === true ? Colors.alertCoral : Colors.growthGreen}
                  />
                  <ThemedText
                    style={[
                      styles.prayerTypeLabel,
                      { color: Colors.hopeWhite },
                    ]}
                    weight="semiBold"
                  >
                    {prayer.is_prayer_request === true ? 'PRAYER REQUEST' : 'PRAYED FOR'}
                  </ThemedText>
                  {prayer.is_prayer_request === true && prayer.prayed === true && (
                    <Ionicons
                      name="checkmark-circle"
                      size={12}
                      color={Colors.growthGreen}
                      style={styles.prayedStatusIcon}
                    />
                  )}
                </View>
                <ThemedText style={styles.personName} weight="bold">
                  {prayer.person_name}
                </ThemedText>
              </View>
            </View>
            <View style={styles.prayerContentContainer}>
              {/* Main prayer text: show content if exists, otherwise notes */}
              <ThemedText style={styles.prayerText}>
                {prayer.content || prayer.notes}
              </ThemedText>
              {/* Show Prayer Request label for prayers that came from a request */}
              {(prayer.requested_by || prayer.metadata?.requested_by || prayer.metadata?.prayer_request_display) && prayer.content && (
                <View style={styles.notesBox}>
                  <Ionicons
                    name="mail-unread"
                    size={12}
                    color={Colors.alertCoral}
                    style={styles.prayedRequestIcon}
                  />
                  <ThemedText style={[styles.notesText, styles.notesTextInside]} numberOfLines={3}>
                    <ThemedText style={styles.notesLabel} weight="medium">
                      Prayer Request:
                    </ThemedText>
                    {prayer.metadata?.prayer_request_display || prayer.notes || ''}
                  </ThemedText>
                </View>
              )}
              {/* Show regular notes for personal prayers (not from requests) */}
              {!(prayer.requested_by || prayer.metadata?.requested_by || prayer.metadata?.prayer_request_display) && prayer.notes && prayer.content && (
                <ThemedText style={styles.notesText} numberOfLines={3}>
                  <ThemedText style={styles.notesLabel} weight="medium">Note: </ThemedText>
                  {prayer.notes}
                </ThemedText>
              )}
            </View>
            {/* Show Pray for Now button for any prayer request that is not prayed for */}
            {prayer.is_prayer_request === true && prayer.prayed !== true && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => { triggerLightHaptic(); handleAddToMyList(prayer); }}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={Colors.hopeWhite}
                  style={styles.iconMargin}
                />
                <ThemedText style={styles.addButtonText} weight="medium">{`Pray for ${prayer.person_name} now`}</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </Swipeable>
      </View>
    );
  };

  // Render existing prayers
  const renderExistingPrayers = () => {
    // Split prayers into categories
    // Show only unprayed requests in the Requests section
    const localPrayerRequests = peoplePrayers.filter(item => item.is_prayer_request === true && item.prayed !== true);
    const prayedForPrayers = peoplePrayers.filter(item => item.is_prayer_request !== true);

    const renderPrayerItem = (item: PersonPrayer) => (
      <SwipeablePrayerCard
        key={item.id}
        prayer={item}
        onEdit={(prayerId: string) => {
          const prayerToEdit = peoplePrayers.find(p => p.id === prayerId);
          if (prayerToEdit) {
            setEditingPrayerId(prayerId);
            setSelectedPrayerType(prayerToEdit.is_prayer_request ? 'requests' : 'mine');
            setName(prayerToEdit.person_name || '');
            setPrayerText(prayerToEdit.content || '');
            setNotes(prayerToEdit.notes || '');
            setShowModal(true);
          }
        }}
        onDelete={(prayerId: string) => {
          try { triggerLightHaptic(); } catch {}
          Alert.alert(
            'Delete Prayer',
            'Are you sure you want to delete this prayer?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  try { triggerLightHaptic(); } catch {}
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
    );

    return (
      <View
        style={[styles.prayerList, styles.scrollViewFlex]}
      >
        <View style={styles.scrollViewContent}>
        {/* Prayer Requests Section */}
        <View>
          {localPrayerRequests.length > 0 && (
            <>
              <View style={styles.categoryHeader}>
                <ThemedText style={styles.categoryTitle}>PRAYER REQUESTS</ThemedText>
              </View>
              <View style={styles.sectionSpacing} />
              {localPrayerRequests.map(renderPrayerItem)}
            </>
          )}
        </View>
        {/* Prayed For Section */}
        <View>
          {prayedForPrayers.length > 0 && (
            <>
              <View style={styles.categoryHeader}>
                <ThemedText style={styles.categoryTitle}>PRAYED FOR</ThemedText>
              </View>
              <View style={styles.sectionSpacing} />
              {prayedForPrayers.map(renderPrayerItem)}
            </>
          )}
        </View>
        </View>
      </View>
    );
  };

  if (error) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.errorText}>Error loading prayers</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <JournalCard
        icon={hasContent ? (
          <MaterialCommunityIcons
            name="account-heart-outline"
            size={24}
            color={Colors.alertCoral}
          />
        ) : undefined}
        title={hasContent ? 'PRAYER LIST FOR PEOPLE' : undefined}
        subtitle={hasContent ? getSubtitle() : undefined}
        variant={variant}
        viewMode={viewMode}
        expanded={expanded}
        onExpand={onExpand}
        showAddButton={showAddInHeader}
        onAdd={handleOpenModal}
        isAdding={false}
        onCancelAdd={handleCloseModal}
      >
        {hasContent ? (
          renderExistingPrayers()
        ) : (viewMode === 'inline' || viewMode === 'moments') ? null : (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name="account-heart-outline"
                  size={32}
                  color={Colors.textGray}
                  style={[styles.emptyStateIcon, styles.flippedIcon]}
                />
              </View>
              <ThemedText style={styles.sectionLabel} accessibilityRole="text" weight="semiBold">
                PRAYER LIST FOR PEOPLE
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
                {isPast ? pastEmptyTitle : 'Start Your Prayer List'}
              </ThemedText>
            </View>
            <ThemedText style={styles.emptyStateSubtext} accessibilityRole="text">
              {isPast
                ? pastEmptySubtitle
                : "Add people you'd like to pray for or prayer requests from others"}
            </ThemedText>
            {!isPast && (
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => { triggerLightHaptic(); handleOpenModal(); }}
                accessibilityRole="button"
                accessibilityLabel="Begin creating prayer list"
              >
                <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
                <ThemedText style={styles.emptyStateButtonText} weight="medium">Begin</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* People Prayer Modal */}
        <PeoplePrayerModal
          visible={showModal}
          selectedPrayerType={selectedPrayerType}
          name={name}
          prayerText={prayerText}
          notes={notes}
          onSelectPrayerType={setSelectedPrayerType}
          onNameChange={setName}
          onPrayerTextChange={setPrayerText}
          onNotesChange={setNotes}
          onSave={handleSavePrayer}
          onCancel={handleCloseModal}
          isSaving={isSaving}
          currentRequestedBy={currentRequestedBy}
        />
      </JournalCard>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  // Empty state styles
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 12,
    width: '100%',
  },
  headerIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  emptyIconContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyStateIcon: {
    marginBottom: 8,
    opacity: 0.8,
  },
  flippedIcon: {
    transform: [{ scaleX: -1 }],
  },
  sectionLabel: {
    // font handled by ThemedText
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
    // font handled by ThemedText
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  emptyStateSubtitle: {
    // font handled by ThemedText
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateSubtext: {
    // font handled by ThemedText
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
    // font handled by ThemedText
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  // Edit form styles
  editContainer: {
    padding: 16,
  },
  // Existing prayers display styles
  prayersContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 8,
    marginVertical: 18,
    marginHorizontal: 8,
    elevation: 4,
    maxHeight: 500,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    flexDirection: 'column',
    marginLeft: 8,
  },
  headerIcon: {
    marginRight: 10,
    marginLeft: 2,
  },
  headerTitle: {
    fontSize: 17,
    // font handled by ThemedText
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    // font handled by ThemedText
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  headerPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerPillText: {
    fontSize: 12,
    // font handled by ThemedText
    color: Colors.hopeWhite,
    opacity: 0.9,
  },
  badge: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    // font handled by ThemedText
    paddingHorizontal: 4,
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.7)',
    // font handled by ThemedText
    fontSize: 12,
  },
  activeTabText: {
    color: Colors.hopeWhite,
    // font handled by ThemedText
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconMargin: {
    marginRight: 6,
  },
  // Inputs
  inputContainer: {
    marginBottom: 12,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  inputFocused: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  input: {
    color: Colors.hopeWhite,
    fontSize: 16,
    padding: 16,
    // font handled inline via regularFont for TextInput
    lineHeight: 24,
  },
  singleLineInput: {
    height: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  prayerInputContainer: {
    marginBottom: 16,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    minHeight: 180,
    padding: 0,
  },
  prayerInput: {
    padding: 16,
    textAlignVertical: 'top',
    minHeight: 140,
  },
  notesSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    marginTop: 8,
  },
  notesLabel: {
    color: Colors.hopeWhite,
    fontSize: 12,
    // font handled by ThemedText
    marginBottom: 8,
    opacity: 0.8,
  },
  notesInput: {
    color: Colors.hopeWhite,
    fontSize: 14,
    // font handled inline via regularFont for TextInput
    minHeight: 60,
    textAlignVertical: 'top',
    padding: 0,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor:  'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    // font handled by ThemedText
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.3,
  },
  prayersContainerExpanded: {
    maxHeight: 500,
  },
  checkButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  // Prayer List
  prayerList: {
    flex: 1,
    marginTop: 8,
  },
  prayerItem: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 60,
    // Make the prayer row a distinct card (like Todos)
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    position: 'relative',
    zIndex: 1,
  },
  prayerContentContainer: {
    marginBottom: 8,
  },

  prayerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  prayerHeaderLeft: {
    flex: 1,
  },
  prayerTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  prayerTypeLabel: {
    fontSize: 10,
    // font handled by ThemedText
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  prayedStatusIcon: {
    marginLeft: 6,
  },
  personName: {
    color: Colors.hopeWhite,
    // font handled by ThemedText
    fontSize: 16,
    marginBottom: 4,
  },
  statusIcon: {
    marginLeft: 8,
  },
  prayerText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
    // font handled by ThemedText
    marginBottom: 4,
  },
  notesText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    lineHeight: 18,
    // font handled by ThemedText
    marginTop: 8,
    fontStyle: 'italic',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 8,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
  },
  prayedRequestIcon: {
    marginTop: 0,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  notesTextInside: {
    backgroundColor: 'transparent',
    padding: 0,
    marginTop: 0,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
  },
  prayedButton: {
    opacity: 0.7,
  },
  addButtonText: {
    color: Colors.hopeWhite,
    // font handled by ThemedText
    fontSize: 12,
    marginLeft: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    color: Colors.hopeWhite,
    // font handled by ThemedText
    fontSize: 16,
    marginTop: 12,
  },
  debugText: {
    color: 'rgba(255, 255, 255, 0.7)',
    // font handled by ThemedText
    fontSize: 12,
    marginTop: 4,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorText: {
    color: Colors.error,
    // font handled by ThemedText
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.hopeWhite,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: Colors.hopeWhite,
    // font handled by ThemedText
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: Colors.hopeWhite,
    // font handled by ThemedText
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: Colors.hopeWhite,
    // font handled by ThemedText
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  errorStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorStateIcon: {
    marginBottom: 16,
  },
  errorStateText: {
    color: Colors.hopeWhite,
    // font handled by ThemedText
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorStateSubtext: {
    color: Colors.hopeWhite,
    // font handled by ThemedText
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 20,
  },
  errorRetryButton: {
    backgroundColor: Colors.hopeWhite,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorRetryIcon: {
    marginRight: 4,
  },
  errorRetryText: {
    color: Colors.hopeWhite,
    // font handled by ThemedText
    fontSize: 14,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryIcon: {
    marginRight: 8,
  },
  categoryTitle: {
    color: Colors.hopeWhite,
    // font handled by ThemedText
    fontSize: 12,
    letterSpacing: 1.2,
    textAlign: 'left',
    flex: 1,
  },
  scrollViewFlex: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  sectionSpacing: {
    marginBottom: 8,
  },
  // Swipe action styles
  swipeableContainer: {
    marginBottom: 12,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  swipeableRow: {
    backgroundColor: 'transparent',
  },
  prayerSwipeActions: {
    flexDirection: 'row',
    width: 168,
    height: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
    marginLeft: 8,
    borderRadius: 12,
  },
  editActionBtn: {
    flex: 1,
    height: '100%',
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 12,
  },
  deleteActionBtn: {
    width: 75,
    height: '100%',
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
});

export default EnhancedPrayerListReactQuery;
