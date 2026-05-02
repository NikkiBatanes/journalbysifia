import React, { useState, useCallback, useMemo } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  StatusBar,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { triggerLightHaptic, triggerSuccessHaptic, triggerSelectionHaptic } from '../../utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pencil } from 'lucide-react-native';
import { JournalCard } from './JournalCard';
import { ErrorBoundary } from '../ErrorBoundary';
import { usePeoplePrayerData, useCreatePrayer, useUpdatePrayer, useMarkPrayerRequestPrayed, useDeletePrayer } from '../../services/hooks/usePrayerData';
import { PrayerApiEntry } from '../../services/api/prayerApi';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';
import ThemedText from '../common/ThemedText';
// import { useTheme } from '../../hooks/useTheme'; // Unused
import { PeoplePrayerModal } from '../modals/PeoplePrayerModal';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/queryKeys';
import { faithPointsService } from '../../services/faithPointsService';
import type { RootStackParamList } from '../../navigation/types';

// Use the API interface directly
type PersonPrayer = PrayerApiEntry;

interface EnhancedPrayerListReactQueryProps {
  selectedDate: Date;
  refreshKey?: number;
  variant?: 'carousel' | 'inline';
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
  filters?: { hideEmptyComponents?: boolean };
}

const EnhancedPrayerListReactQuery: React.FC<EnhancedPrayerListReactQueryProps> = ({
  selectedDate,
  variant = 'carousel',
  viewMode,
  expanded,
  onExpand,
  navigation,
  filters,
}) => {

  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);
  const globalEditMode = useEditModeSafe();
  // const theme = useTheme(); // Unused
  // const regularFont = getFontFamily(theme.currentFont || DEFAULT_FONT_FAMILY, 'regular'); // Unused

  // React Query hooks for data fetching
  const queryClient = useQueryClient();
  const { data: peoplePrayers = [], error } = usePeoplePrayerData(
    user?.id || '',
    dateStr
  );
  // Debug log: print peoplePrayers every render

  const createPrayerMutation = useCreatePrayer();
  const updatePrayerMutation = useUpdatePrayer();
  const markPrayedMutation = useMarkPrayerRequestPrayed();
  const deletePrayerMutation = useDeletePrayer();
  const insets = useSafeAreaInsets();

  // Check if the selected date is in the past
  const today = new Date().toLocaleDateString('en-CA'); // Use local date to match dateStr format
  const isPastDate = dateStr < today;

  // Modal state (kept for edit functionality)
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPrayerId, setEditingPrayerId] = useState<string | null>(null);

  // Full-screen prayer editor modal state
  const [showPrayerEditorModal, setShowPrayerEditorModal] = useState(false);
  const [modalPrayerName, setModalPrayerName] = useState('');
  const [modalPrayerRequest, setModalPrayerRequest] = useState('');
  const [savingModalPrayer, setSavingModalPrayer] = useState(false);
  const [selectedPrayerRequest, setSelectedPrayerRequest] = useState<any>(null);

  // Local state for form
  const [name, setName] = useState('');
  const [prayerText, setPrayerText] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedPrayerType, setSelectedPrayerType] = useState<string>('mine');
  const [currentRequestedBy, setCurrentRequestedBy] = useState('');

  // Show more / show less state for inline display
  // Initial display: 1 prayer request + 1 prayed for, or 2 of one type if the other is empty
  const initialLimits = useMemo(() => {
    const hasRequests = peoplePrayers.some(p => p.is_prayer_request === true && p.prayed !== true);
    const hasPersonal = peoplePrayers.some(p => p.is_prayer_request !== true);

    if (hasRequests && hasPersonal) {
      return { requests: 1, personal: 1 };
    } else if (hasRequests) {
      return { requests: 2, personal: 0 };
    } else if (hasPersonal) {
      return { requests: 0, personal: 2 };
    }
    return { requests: 0, personal: 0 };
  }, [peoplePrayers]);

  const [userExpanded, setUserExpanded] = useState(false);

  // Use initial limits unless user has expanded
  const requestsDisplayLimit = userExpanded ? peoplePrayers.filter(p => p.is_prayer_request === true && p.prayed !== true).length : initialLimits.requests;
  const personalDisplayLimit = userExpanded ? peoplePrayers.filter(p => p.is_prayer_request !== true).length : initialLimits.personal;

  // Computed values
  // Only count requests that are not yet prayed
  const prayerRequests = peoplePrayers.filter(p => p.is_prayer_request === true && p.prayed !== true);
  const personalPrayers = peoplePrayers.filter(p => p.is_prayer_request !== true);
  const hasVisibleContent = prayerRequests.length > 0 || personalPrayers.length > 0;

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
  const showAddInHeader = hasVisibleContent && !isPastDate;

  // Get dynamic subtitle based on context
  const getSubtitle = () => {
    if (hasVisibleContent) {
      const totalCount = uniqueTotal.size;
      let subtitle = totalCount === 1 ? '1 person in your prayer list' : `${totalCount} people in your prayer list`;

      // Add breakdown on new line with requests first
      const reqCount = uniqueRequests.size;
      const prayedForCount = uniquePersonal.size;
      if (reqCount > 0 && prayedForCount > 0) {
        subtitle += `\n${reqCount} request • ${prayedForCount} prayed for`;
      } else if (reqCount > 0) {
        subtitle += `\n${reqCount} request`;
      } else if (prayedForCount > 0) {
        subtitle += `\n${prayedForCount} prayed for`;
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
            .catch(catchError => {
              Logger.warn('[EnhancedPrayerListReactQuery] Failed to award prayer list faith points', { component: 'EnhancedPrayerListReactQuery', data: catchError });
            });
        }
      }

      triggerSuccessHaptic();

      // Clear inputs and close modal
      setName('');
      setPrayerText('');
      setNotes('');
      setSelectedPrayerType('mine');
      setCurrentRequestedBy('');
      setEditingPrayerId(null);
      setShowModal(false);

      // Exit global edit mode if in inline view
      if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
        globalEditMode.setGlobalEditMode(false);
      }
    } catch (err) {
      Logger.error('Error saving prayer', err as Error, { component: 'EnhancedPrayerListReactQuery' });
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, name, prayerText, notes, selectedPrayerType, currentRequestedBy, editingPrayerId, dateStr, peoplePrayers, createPrayerMutation, updatePrayerMutation, queryClient, globalEditMode, viewMode]);

  const handleAddToMyList = (prayerEntry: PersonPrayer) => {
    // Navigate to the full-screen prayer editor for this prayer request
    // Always use the current journal dateStr (not the prayer request's original date)
    // so the new "prayed for" prayer is saved for the currently viewed date and
    // the optimistic update populates the correct cache key.
    if (navigation) {
      navigation.navigate('PrayerEditor', {
        prayerRequest: {
          person_name: prayerEntry.person_name || '',
          content: prayerEntry.content || '',
          id: prayerEntry.id,
          user_id: prayerEntry.user_id,
          selected_date: dateStr,
        },
      });
    }
  };

  const handleMarkAsAnswered = async (prayerId: string) => {
    try {
      triggerLightHaptic();

      // Optimistically update the cache
      queryClient.setQueryData(
        queryKeys.prayers.people(user?.id || '', dateStr),
        (old: PersonPrayer[] | undefined) => {
          if (!old) {return old;}
          return old.map(prayer =>
            prayer.id === prayerId
              ? { ...prayer, status: 'answered' as const, answered_date: new Date().toISOString() }
              : prayer
          );
        }
      );

      await updatePrayerMutation.mutateAsync({
        id: prayerId,
        updates: {
          status: 'answered' as const,
          answered_date: new Date().toISOString(),
        },
        _userId: user?.id || '',
        _dateStr: dateStr,
      });
      triggerSuccessHaptic();
    } catch (markAnsweredError) {
      console.error('Failed to mark prayer as answered:', markAnsweredError);
      // Revert optimistic update on error
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.people(user?.id || '', dateStr),
      });
    }
  };

  const handleMarkAsUnanswered = async (prayerId: string) => {
    try {
      triggerLightHaptic();
      queryClient.setQueryData(
        queryKeys.prayers.people(user?.id || '', dateStr),
        (old: PersonPrayer[] | undefined) => {
          if (!old) {return old;}
          return old.map(prayer =>
            prayer.id === prayerId
              ? { ...prayer, status: 'pending' as const, answered_date: null }
              : prayer
          );
        }
      );
      await updatePrayerMutation.mutateAsync({
        id: prayerId,
        updates: {
          status: 'pending' as const,
          answered_date: null,
        },
        _userId: user?.id || '',
        _dateStr: dateStr,
      });
      triggerSuccessHaptic();
    } catch (markUnansweredError) {
      console.error('Failed to mark prayer as unanswered:', markUnansweredError);
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.people(user?.id || '', dateStr),
      });
    }
  };

  const handleSaveModalPrayer = async () => {
    if (!modalPrayerRequest.trim()) {
      Alert.alert('Missing Prayer', 'Please enter your prayer before saving.');
      return;
    }

    setSavingModalPrayer(true);
    try {
      // Create the prayer
      await createPrayerMutation.mutateAsync({
        user_id: user!.id,
        prayer_type: 'people' as const,
        content: modalPrayerRequest,
        person_name: modalPrayerName,
        metadata: {
          prayer_type: 'prayer-request',
          original_request_content: selectedPrayerRequest?.content,
          prayer_request_display: selectedPrayerRequest?.content,
        },
        selected_date: new Date().toLocaleDateString('en-CA'),
      });

      // Mark the prayer request as prayed (skip if still an optimistic temp ID)
      if (selectedPrayerRequest?.id && !selectedPrayerRequest.id.startsWith('temp-')) {
        await markPrayedMutation.mutateAsync({
          id: selectedPrayerRequest.id,
          isPrayed: true,
          _userId: selectedPrayerRequest.user_id,
          _dateStr: selectedPrayerRequest.selected_date,
        });
      }

      // Close modal
      setShowPrayerEditorModal(false);
      setSelectedPrayerRequest(null);
      setModalPrayerName('');
      setModalPrayerRequest('');
    } catch (e) {
      console.error('Failed to save prayer', e);
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    } finally {
      setSavingModalPrayer(false);
    }
  };

  const handleCancelModalPrayer = () => {
    setShowPrayerEditorModal(false);
    setSelectedPrayerRequest(null);
    setModalPrayerName('');
    setModalPrayerRequest('');
    setSavingModalPrayer(false);
  };

  const handleEditPrayer = (prayer: PersonPrayer) => {
    if (!navigation) {return;}

    // Determine the prayer type
    const prayerType = prayer.is_prayer_request === true ? 'prayer-request' : 'pray-for-someone';

    // Navigate to walkthrough with pre-selected type and data
    navigation.navigate('PrayersForPeopleWalkthrough', {
      initialPersonName: prayer.person_name,
      initialPrayerRequest: prayer.is_prayer_request === true ? prayer.content : undefined,
      initialPrayerText: prayer.is_prayer_request !== true ? prayer.content : undefined,
      initialPrayerType: prayerType,
      editingPrayerId: prayer.id,
      initialTrackAnswered: prayer.metadata?.track_answered,
      selectedDate: selectedDate.toISOString(),
    });
  };

  const handleDeletePrayer = (prayer: PersonPrayer) => {
    Alert.alert(
      'Delete Prayer',
      `Are you sure you want to delete this prayer for ${prayer.person_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerLightHaptic();
              await deletePrayerMutation.mutateAsync({
                id: prayer.id,
                _userId: user?.id || '',
                _dateStr: dateStr,
              });
              triggerSuccessHaptic();
            } catch (deleteError) {
              console.error('Failed to delete prayer:', deleteError);
              Alert.alert('Error', 'Failed to delete prayer. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Modal handlers
  const handleOpenModal = useCallback(() => {
    triggerLightHaptic();
    // Navigate to walkthrough instead of showing modal
    if (navigation) {
      navigation.navigate('PrayersForPeopleWalkthrough', { selectedDate: selectedDate.toISOString() });
    }
  }, [navigation, selectedDate]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setName('');
    setPrayerText('');
    setNotes('');
    setSelectedPrayerType('mine');
    setCurrentRequestedBy('');
    setEditingPrayerId(null);
  }, []);

  if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
    globalEditMode.setGlobalEditMode(false);
  }

  // Handle global edit mode changes for inline view
  React.useEffect(() => {
    if (viewMode === 'inline' && globalEditMode?.isGlobalEditMode && !showModal) {
      setShowModal(true);
    } else if (viewMode === 'inline' && !globalEditMode?.isGlobalEditMode && showModal) {
      handleCloseModal();
    }
  }, [globalEditMode?.isGlobalEditMode, viewMode, showModal, handleCloseModal]);

  // Render existing prayers
  const renderExistingPrayers = () => {
    // Split prayers into categories
    // Show only unprayed requests in the Requests section
    const localPrayerRequests = peoplePrayers.filter(item => item.is_prayer_request === true && item.prayed !== true);
    const prayedForPrayers = peoplePrayers.filter(item => item.is_prayer_request !== true);

    if (localPrayerRequests.length === 0 && prayedForPrayers.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIconContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="account-heart-outline" size={40} color={Colors.alertCoral} style={styles.emptyStateIcon} />
            </View>
            <ThemedText weight="medium" style={styles.sectionLabel}>Prayer List</ThemedText>
          </View>
          <View style={styles.titleContainer}>
            <ThemedText weight="semiBold" style={styles.emptyStateTitle}>
              {isPast ? pastEmptyTitle : 'No People in Prayer List'}
            </ThemedText>
          </View>
          <ThemedText weight="regular" style={styles.emptyStateSubtext}>
            {isPast ? pastEmptySubtitle : 'Add the people you want to pray for and keep track of prayer requests here.'}
          </ThemedText>
          {!isPastDate && (
            <TouchableOpacity style={styles.emptyStateButton} onPress={handleOpenModal} activeOpacity={0.8}>
              <Ionicons name="add" size={18} color={Colors.hopeWhite} style={styles.buttonIcon} />
              <ThemedText weight="semiBold" style={styles.emptyStateButtonText}>Add Person</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Apply limits
    const displayedRequests = localPrayerRequests.slice(0, requestsDisplayLimit);
    const displayedPersonal = prayedForPrayers.slice(0, personalDisplayLimit);

    // Check if we need to show show more/less button
    const hasMoreRequests = localPrayerRequests.length > requestsDisplayLimit;
    const hasMorePersonal = prayedForPrayers.length > personalDisplayLimit;
    const hasMoreItems = hasMoreRequests || hasMorePersonal;
    const canShowLess = userExpanded;

    const renderPrayerItem = (item: PersonPrayer) => (
      <SwipeablePrayerCard
        key={item.id}
        prayer={item}
        handleAddToMyList={handleAddToMyList}
        handleMarkAsAnswered={handleMarkAsAnswered}
        handleMarkAsUnanswered={handleMarkAsUnanswered}
        onEdit={handleEditPrayer}
        onDelete={handleDeletePrayer}
      />
    );

    return (
      <View
        style={[styles.prayerList, styles.scrollViewFlex]}
      >
        <View style={styles.scrollViewContent}>
        {/* Prayer Requests Section */}
        <View>
          {displayedRequests.length > 0 && (
            <>
              <View style={styles.categoryHeader}>
                <ThemedText style={styles.categoryTitle}>PRAYER REQUESTS</ThemedText>
              </View>
              <View style={styles.sectionSpacing} />
              {displayedRequests.map(renderPrayerItem)}
            </>
          )}
        </View>
        {/* Prayed For Section */}
        <View>
          {displayedPersonal.length > 0 && (
            <>
              <View style={styles.categoryHeader}>
                <ThemedText style={styles.categoryTitle}>PRAYED FOR</ThemedText>
              </View>
              <View style={styles.sectionSpacing} />
              {displayedPersonal.map(renderPrayerItem)}
            </>
          )}
        </View>

        {/* Show More / Show Less Button */}
        {(hasMoreItems || canShowLess) && (
          <View style={styles.paginationContainer}>
            <View style={styles.paginationButtonGroup}>
              {hasMoreItems && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showMoreButton]}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setUserExpanded(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                  <ThemedText style={[styles.paginationButtonText, styles.showMoreText]}>
                    Show more
                  </ThemedText>
                </TouchableOpacity>
              )}
              {canShowLess && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showLessButton]}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setUserExpanded(false);
                  }}
                  activeOpacity={0.7}
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

  if ((viewMode === 'moments' || filters?.hideEmptyComponents) && !hasVisibleContent) {
    return null;
  }

  return (
    <ErrorBoundary>
      <JournalCard
        icon={hasVisibleContent ? (
          <MaterialCommunityIcons
            name="account-heart-outline"
            size={24}
            color={Colors.alertCoral}
          />
        ) : undefined}
        title={hasVisibleContent ? 'PRAYERS FOR PEOPLE' : undefined}
        subtitle={hasVisibleContent ? getSubtitle() : undefined}
        variant={variant}
        viewMode={viewMode}
        expanded={expanded}
        onExpand={onExpand}
        showAddButton={showAddInHeader && hasVisibleContent}
        onAdd={handleOpenModal}
        isAdding={false}
        onCancelAdd={handleCloseModal}
      >
        {hasVisibleContent ? renderExistingPrayers() : (viewMode === 'inline' || viewMode === 'moments') ? null : (
          <View style={styles.emptyStateContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="account-heart-outline"
                size={32}
                color={Colors.textGray}
                style={styles.emptyStateIcon}
              />
              <ThemedText style={styles.sectionLabel} accessibilityRole="text" weight="semiBold">
                PRAYERS FOR PEOPLE
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
                {isPast ? pastEmptyTitle : 'No People in Prayer List'}
              </ThemedText>
            </View>
            <ThemedText style={styles.emptyStateSubtext}>
              {isPast ? pastEmptySubtitle : 'Add the people you want to pray for and keep track of prayer requests here.'}
            </ThemedText>
            {!isPastDate && (
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => { triggerLightHaptic(); handleOpenModal(); }}
              >
                <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
                <ThemedText style={styles.emptyStateButtonText} weight="medium">
                  Begin
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}
      </JournalCard>

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

        {/* Prayer Editor Modal */}
        <Modal
          visible={showPrayerEditorModal}
          animationType="fade"
          presentationStyle="fullScreen"
          onRequestClose={handleCancelModalPrayer}
        >
          <StatusBar hidden />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.fullScreenModalContainer}
          >
            <View style={styles.fullScreenPrayerModalContainer}>
                <TouchableOpacity
                  style={[styles.prayerModalCancelButton, { top: insets.top + 8 }]}
                  onPress={() => { triggerLightHaptic(); handleCancelModalPrayer(); }}
                  disabled={savingModalPrayer}
                >
                  <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
                </TouchableOpacity>

                <View style={styles.prayerModalHeader}>
                  <View style={styles.prayerModalHeaderLeft}>
                    <MaterialCommunityIcons name="hands-pray" size={20} color={Colors.alertCoral} />
                    <ThemedText weight="bold" style={styles.prayerModalTitle}>PRAY FOR {modalPrayerName || 'Someone'}</ThemedText>
                  </View>
                </View>

                <ThemedText weight="semiBold" style={styles.prayerModalSubtitle}>Lift up a prayer for {modalPrayerName || 'them'}</ThemedText>

                {/* Name field - pre-filled and non-editable */}
                <TextInput
                  style={[styles.prayerModalNameInput, { fontFamily: Fonts.regular }]}
                  value={modalPrayerName}
                  onChangeText={setModalPrayerName}
                  placeholder="Name (optional)"
                  placeholderTextColor={Colors.placeholderText}
                  keyboardAppearance="dark"
                  editable={false}
                />

                {/* Combined field: Prayer input + Prayer Request inside same card */}
                <View style={styles.combinedPrayerField}>
                  <TextInput
                    style={[styles.combinedPrayerInput, { fontFamily: Fonts.regular }]}
                    placeholder={`Write a prayer for ${modalPrayerName || 'them'}…`}
                    placeholderTextColor={Colors.placeholderText}
                    value={modalPrayerRequest}
                    onChangeText={setModalPrayerRequest}
                    onFocus={triggerSelectionHaptic}
                    multiline
                    numberOfLines={6}
                    autoFocus
                    keyboardAppearance="dark"
                  />
                  <View style={styles.combinedDivider} />
                  <View style={styles.combinedReadOnlyInner}>
                    <ThemedText weight="semiBold" style={styles.prayerModalFieldLabel}>Prayer Request</ThemedText>
                    <ThemedText weight="regular" style={styles.prayerModalReadOnlyText}>{selectedPrayerRequest?.content || ''}</ThemedText>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.prayerModalSaveButton, { bottom: insets.bottom - 10, opacity: modalPrayerRequest.trim() ? 1 : 0 }]}
                  onPress={() => { triggerLightHaptic(); handleSaveModalPrayer(); }}
                  disabled={savingModalPrayer || !modalPrayerRequest.trim()}
                >
                  <Ionicons name="checkmark" size={24} color={Colors.hopeWhite} />
                </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
    </ErrorBoundary>
  );
};

// Swipeable Prayer Card Component (moved outside parent to avoid nested component warning)
const SwipeablePrayerCard: React.FC<{
  prayer: PersonPrayer;
  handleAddToMyList: (prayer: PersonPrayer) => void;
  handleMarkAsAnswered: (id: string) => void;
  handleMarkAsUnanswered: (id: string) => void;
  onEdit?: (prayer: PersonPrayer) => void;
  onDelete?: (prayer: PersonPrayer) => void;
}> = ({ prayer, handleAddToMyList, handleMarkAsAnswered, handleMarkAsUnanswered, onEdit, onDelete }) => {
  const actionButtonPressedRef = React.useRef(false);

  return (
    <TouchableOpacity
      style={styles.prayerItem}
      onPress={() => {
        if (actionButtonPressedRef.current) {
          actionButtonPressedRef.current = false;
          return;
        }
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
            <View style={styles.addButtonContainer}>
              <View style={styles.addButtonDivider} />
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  actionButtonPressedRef.current = true;
                  triggerLightHaptic();
                  handleAddToMyList(prayer);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={Colors.hopeWhite}
                  style={styles.iconMargin}
                />
                <ThemedText style={styles.addButtonText} weight="medium">{`Pray for ${prayer.person_name} now`}</ThemedText>
              </TouchableOpacity>
            </View>
          )}
          {/* Show Mark as Answered button for prayers with tracking enabled (only for prayed for, not prayer requests) */}
          {(() => {
            const hasTracking = prayer.metadata?.track_answered === true;
            const isNotRequest = prayer.is_prayer_request !== true;

            return hasTracking && isNotRequest;
          })() && (
            <View style={styles.answeredActionContainer}>
              <TouchableOpacity
                style={[styles.answeredActionButton, prayer.status === 'answered' && styles.answeredActionButtonActive]}
                onPress={() => {
                  actionButtonPressedRef.current = true;
                  if (prayer.status === 'answered') {
                    handleMarkAsUnanswered(prayer.id);
                  } else {
                    handleMarkAsAnswered(prayer.id);
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={prayer.status === 'answered' ? 'sparkles' : 'checkmark-circle-outline'}
                  size={14}
                  color={prayer.status === 'answered' ? Colors.alertCoral : Colors.hopeWhite}
                />
                <ThemedText style={[styles.answeredActionText, prayer.status === 'answered' && styles.answeredActionTextActive]} weight="medium">
                  {prayer.status === 'answered' ? 'Answered' : 'Mark Answered'}
                </ThemedText>
                {prayer.status === 'answered' && prayer.answered_date && (
                  <ThemedText style={styles.answeredDate}>
                    {(() => {
                      const date = new Date(prayer.answered_date);
                      const currentYear = new Date().getFullYear();
                      const isCurrentYear = date.getFullYear() === currentYear;

                      return date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        ...(isCurrentYear ? {} : { year: 'numeric' }),
                      });
                    })()}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          )}
    </TouchableOpacity>
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
    marginRight: 4,
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
    padding: 20,
    minHeight: 60,
    marginBottom: 12,
    // Make the prayer row a distinct card (like completionCard)
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    borderRadius: 24,
    position: 'relative',
    zIndex: 1,
    width: '100%',
  },
  prayerContentContainer: {
    marginBottom: 8,
    width: '100%',
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
    flexWrap: 'wrap',
    width: '100%',
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
    flexWrap: 'wrap',
    width: '100%',
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
    flexWrap: 'wrap',
    width: '100%',
  },
  notesTextInside: {
    backgroundColor: 'transparent',
    padding: 0,
    marginTop: 0,
    flex: 1,
    flexWrap: 'wrap',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
    borderRadius: 8,
    width: '100%',
  },
  addButtonDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
  },
  addButtonContainer: {
    width: '100%',
  },
  answeredBadgeWrapper: {
    alignSelf: 'flex-start',
  },
  answeredButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  answeredActionContainer: {
    marginTop: 8,
  },
  answeredActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(26,60,109,0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 8,
  },
  answeredActionButtonActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  answeredActionText: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },
  answeredActionTextActive: {
    color: Colors.alertCoral,
  },
  answeredBadgeContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  answeredBadgeText: {
    fontSize: 12,
    color: Colors.growthGreen,
  },
  answeredDate: {
    color: 'rgba(255, 107, 107, 0.9)',
    fontSize: 12,
    marginLeft: 6,
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
  answeredButtonText: {
    color: Colors.alertCoral,
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
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    zIndex: 1,
  },
  fullScreenPrayerModalContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  prayerModalCancelButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prayerModalHeader: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  prayerModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  prayerModalTitle: {
    color: Colors.hopeWhite,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  prayerModalSubtitle: {
    color: Colors.secondaryText,
    fontSize: 24,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 30,
  },
  prayerModalNameInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 14,
    marginBottom: 20,
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  combinedPrayerField: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 14,
    minHeight: 150,
  },
  combinedPrayerInput: {
    color: Colors.hopeWhite,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
  },
  combinedDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 12,
  },
  combinedReadOnlyInner: {
    backgroundColor: 'rgba(26,60,109,0.15)',
    borderRadius: 8,
    padding: 12,
  },
  prayerModalFieldLabel: {
    color: Colors.hopeWhite,
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  prayerModalReadOnlyText: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
  },
  prayerModalSaveButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.alertCoral,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  swipeableContainer: {
    marginBottom: 12,
    overflow: 'hidden',
    borderRadius: 24,
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
  },
  paginationContainer: {
    marginTop: 12,
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
    color: Colors.textGray,
  },
});

export default EnhancedPrayerListReactQuery;
