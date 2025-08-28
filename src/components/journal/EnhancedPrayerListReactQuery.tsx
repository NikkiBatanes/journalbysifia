import React, { useState, useRef, useCallback } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { triggerLightHaptic } from '../../utils/haptics';

import { Pencil, X, Check } from 'lucide-react-native';
import { JournalCard } from './JournalCard';
import { ErrorBoundary } from '../ErrorBoundary';
import { usePeoplePrayerData, useCreatePrayer, useUpdatePrayer } from '../../services/hooks/usePrayerData';
import { PrayerApiEntry } from '../../services/api/prayerApi';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';

// Types and Interfaces
type TabType = 'mine' | 'requests';

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

  // React Query hooks for data fetching
  const { data: peoplePrayers = [], error } = usePeoplePrayerData(
    user?.id || '',
    dateStr
  );
  // Debug log: print peoplePrayers every render
  console.log('[EnhancedPrayerListReactQuery] peoplePrayers:', peoplePrayers);
  const createPrayerMutation = useCreatePrayer();
  const updatePrayerMutation = useUpdatePrayer();
  
  // Check if the selected date is in the past
  const today = new Date().toLocaleDateString('en-CA'); // Use local date to match dateStr format
  const isPastDate = dateStr < today;

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Local state for form
  const [name, setName] = useState('');
  const [prayer, setPrayer] = useState('');
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('mine');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isPrayerFocused, setIsPrayerFocused] = useState(false);
  const [isNotesFocused, setIsNotesFocused] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [currentRequestedBy, setCurrentRequestedBy] = useState<string | undefined>(undefined);
  // Auto-grow heights for multiline inputs
  const [prayerHeight, setPrayerHeight] = useState(140);
  const [notesHeight, setNotesHeight] = useState(60);

  const prayerInputRef = useRef<TextInput>(null);

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

  // Get dynamic subtitle based on context
  const getSubtitle = () => {
    if (isEditing) {
      return activeTab === 'mine' ? 'Write prayer for someone' : 'Write prayer request';
    }
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

  const handleAddPrayer = useCallback(async () => {
    if (!user?.id || !name.trim() || (!prayer.trim() && activeTab !== 'mine')) {return;}

    setIsSaving(true);
    try {
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
        content: prayer.trim() || 'Prayed for ' + name.trim(),
        is_prayer_request: activeTab === 'requests', // <-- FIX: set at root
        notes: notes.trim() || undefined, // Store notes directly at root level
        metadata: {
          requested_by: currentRequestedBy,
        },
        selected_date: dateStr,
      };

      console.log('🙏 Saving prayer with data:', {
        activeTab,
        is_prayer_request: activeTab === 'requests',
        currentRequestedBy,
        prayerData,
      });
      // Debug: Ensure is_prayer_request is at root
      if (typeof prayerData.is_prayer_request === 'undefined') {
        console.warn('❗️ [BUG] is_prayer_request is missing at root of prayerData!', prayerData);
      } else {
        console.log('✅ is_prayer_request at root:', prayerData.is_prayer_request);
      }

      console.log('🙏 [IMMEDIATE] About to save prayer. activeTab:', activeTab, 'prayerData:', prayerData);
      await createPrayerMutation.mutateAsync(prayerData);

      // Clear inputs and exit edit mode
      setName('');
      setPrayer('');
      setNotes('');
      setCurrentRequestedBy(undefined);
      setInputKey(prev => prev + 1);
      setIsEditing(false);

      // Exit global edit mode if in inline view
      if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
        globalEditMode.setGlobalEditMode(false);
      }

      Keyboard.dismiss();
    } catch (err) {
      console.error('Error adding prayer:', err);
      // TODO: Show error message to user
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, name, prayer, notes, activeTab, currentRequestedBy, dateStr, peoplePrayers, createPrayerMutation, updatePrayerMutation, globalEditMode, viewMode]);

  const handleAddToMyList = (prayerEntry: PersonPrayer) => {
    // Set the requestedBy first
    setCurrentRequestedBy(prayerEntry.requested_by || 'Someone');

    // Switch to 'Prayers for People' tab
    setActiveTab('mine');

    // Enable editing mode to show the form
    setIsEditing(true);

    // Enable global edit mode if in inline view
    if (viewMode === 'inline' && globalEditMode?.setGlobalEditMode) {
      globalEditMode.setGlobalEditMode(true);
    }

    // Pre-fill the form fields after a small delay to ensure tab switch
    setTimeout(() => {
      setName(prayerEntry.person_name || '');
      setPrayer(''); // Keep prayer text empty for user to fill
      setNotes(prayerEntry.content); // Move the prayer request content to notes
      setInputKey(prev => prev + 1); // Force re-render of inputs

      // Focus the prayer input field
      if (prayerInputRef.current) {
        prayerInputRef.current.focus();
      }
    }, 100);
  };

  // Edit mode handlers
  const toggleEditing = useCallback(() => {
    triggerLightHaptic();
    setIsEditing(!isEditing);
    if (!isEditing) {
      // Clear form when starting to edit
      setName('');
      setPrayer('');
      setNotes('');
      setCurrentRequestedBy(undefined);
      setInputKey(prev => prev + 1);
    }
  }, [isEditing]);

  const handleCancelEdit = useCallback(() => {
    triggerLightHaptic();
    setName('');
    setPrayer('');
    setNotes('');
    setCurrentRequestedBy(undefined);
    setInputKey(prev => prev + 1);
    setIsEditing(false);

    if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
      globalEditMode.setGlobalEditMode(false);
    }
  }, [globalEditMode, viewMode]);

  // Handle global edit mode changes for inline view
  React.useEffect(() => {
    if (viewMode === 'inline' && globalEditMode?.isGlobalEditMode && !isEditing) {
      setIsEditing(true);
    } else if (viewMode === 'inline' && !globalEditMode?.isGlobalEditMode && isEditing) {
      setIsEditing(false);
      setName('');
      setPrayer('');
      setNotes('');
      setCurrentRequestedBy(undefined);
    }
  }, [globalEditMode?.isGlobalEditMode, viewMode, isEditing]);

  // Render edit form
  const renderEditForm = () => (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.editContainer}>
        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'mine' && styles.activeTab]}
            onPress={() => {
              triggerLightHaptic();
              console.log('🔄 Switching to "Prayers for People" tab');
              setActiveTab(_prev => {
                console.log('🔄 Tab state updated to:', 'mine');
                return 'mine';
              });
            }}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, activeTab === 'mine' && styles.activeTabText]}>
                Prayers for People
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
            onPress={() => {
              triggerLightHaptic();
              console.log('🔄 Switching to "Prayer Requests" tab');
              setActiveTab(_prev => {
                console.log('🔄 Tab state updated to:', 'requests');
                return 'requests';
              });
            }}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
                Prayer Requests
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Input Form */}
        <View style={[styles.inputContainer, isNameFocused && styles.inputFocused]}>
          <TextInput
            key={`name-${inputKey}`}
            style={[styles.input, styles.singleLineInput]}
            placeholder={activeTab === 'mine' ? 'Who are you praying for?' : 'Who is requesting prayer?'}
            placeholderTextColor={Colors.mediumGray}
            value={name}
            onChangeText={setName}
            onFocus={() => setIsNameFocused(true)}
            onBlur={() => setIsNameFocused(false)}
            autoCapitalize="words"
            textAlignVertical="center"
            keyboardAppearance="dark"
          />
        </View>

        <View style={[styles.prayerInputContainer, isPrayerFocused && styles.inputFocused]}>
          <TextInput
            key={`prayer-${inputKey}`}
            ref={prayerInputRef}
            style={[
              styles.input,
              styles.prayerInput,
              { height: Math.max(140, prayerHeight) },
            ]}
            placeholder={activeTab === 'mine' ? 'What would you like to pray for them?' : 'What is the prayer request?'}
            placeholderTextColor={Colors.mediumGray}
            value={prayer}
            onChangeText={setPrayer}
            onFocus={() => setIsPrayerFocused(true)}
            onBlur={() => setIsPrayerFocused(false)}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            onContentSizeChange={e => setPrayerHeight(e.nativeEvent.contentSize.height)}
            keyboardAppearance="dark"
          />
          {/* Integrated Notes Section - Only show in 'Mine' tab */}
          {activeTab === 'mine' && (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>{currentRequestedBy ? 'Prayer Request:' : 'Notes (optional):'}</Text>
              <TextInput
                key={`notes-${inputKey}`}
                style={[styles.notesInput, { height: Math.max(60, notesHeight) }]}
                placeholder="Add any additional notes here..."
                placeholderTextColor={Colors.mediumGray}
                value={notes}
                onChangeText={setNotes}
                onFocus={() => setIsNotesFocused(true)}
                onBlur={() => setIsNotesFocused(false)}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
                onContentSizeChange={e => setNotesHeight(e.nativeEvent.contentSize.height)}
                keyboardAppearance="dark"
              />
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={() => { triggerLightHaptic(); handleCancelEdit(); }}
            style={[styles.button, styles.cancelButton]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Cancel editing prayer"
          >
            <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { triggerLightHaptic(); handleAddPrayer(); }}
            style={[
              styles.button,
              styles.saveButton,
              (isSaving || !name.trim() || !prayer.trim()) && styles.disabledButton,
            ]}
            disabled={isSaving || !name.trim() || !prayer.trim()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Save prayer"
            accessibilityState={{ disabled: isSaving || !name.trim() || !prayer.trim() }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.hopeWhite} />
            ) : (
              <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );

  // Render existing prayers
  const renderExistingPrayers = () => {
    // Split prayers into categories
    // Show only unprayed requests in the Requests section
    const localPrayerRequests = peoplePrayers.filter(item => item.is_prayer_request === true && item.prayed !== true);
    const prayedForPrayers = peoplePrayers.filter(item => item.is_prayer_request !== true);

    const renderPrayerItem = (item: PersonPrayer) => (
      <View key={item.id} style={styles.prayerItem}>
        <View style={styles.prayerHeader}>
          <View style={styles.prayerHeaderLeft}>
            <View style={styles.prayerTypeIndicator}>
              <Ionicons
                name={item.is_prayer_request === true ? 'mail-unread' : 'heart'}
                size={14}
                color={item.is_prayer_request === true ? Colors.alertCoral : Colors.growthGreen}
              />
              <Text style={[
                styles.prayerTypeLabel,
                { color: Colors.hopeWhite },
              ]}>
                {item.is_prayer_request === true ? 'PRAYER REQUEST' : 'PRAYED FOR'}
              </Text>
              {item.is_prayer_request === true && item.prayed === true && (
                <Ionicons
                  name="checkmark-circle"
                  size={12}
                  color={Colors.growthGreen}
                  style={styles.prayedStatusIcon}
                />
              )}
            </View>
            <Text style={styles.personName}>
              {item.person_name}
            </Text>
          </View>
        </View>
        <View style={styles.prayerContentContainer}>
          {/* Main prayer text: show content if exists, otherwise notes */}
          <Text style={styles.prayerText}>
            {item.content || item.notes}
          </Text>
          {/* Show Prayer Request label for prayers that came from a request */}
          {(item.requested_by || item.metadata?.requested_by || item.metadata?.prayer_request_display) && item.content && (
            <View style={styles.notesBox}>
              <Ionicons
                name="mail-unread"
                size={12}
                color={Colors.alertCoral}
                style={styles.prayedRequestIcon}
              />
              <Text style={[styles.notesText, styles.notesTextInside]} numberOfLines={3}>
                <Text style={styles.notesLabel}>
                  Prayer Request: 
                </Text>
                {item.metadata?.prayer_request_display || item.notes || ''}
              </Text>
            </View>
          )}
          {/* Show regular notes for personal prayers (not from requests) */}
          {!(item.requested_by || item.metadata?.requested_by || item.metadata?.prayer_request_display) && item.notes && item.content && (
            <Text style={styles.notesText} numberOfLines={3}>
              <Text style={styles.notesLabel}>Note: </Text>
              {item.notes}
            </Text>
          )}
        </View>
        {/* Show Pray for Now button for any prayer request that is not prayed for */}
        {item.is_prayer_request === true && item.prayed !== true && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => { triggerLightHaptic(); handleAddToMyList(item); }}
          >
            <Ionicons
              name="add-circle-outline"
              size={18}
              color={Colors.hopeWhite}
              style={styles.iconMargin}
            />
            <Text style={styles.addButtonText}>{`Pray for ${item.person_name} now`}</Text>
          </TouchableOpacity>
        )}
      </View>
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
                <Text style={styles.categoryTitle}>PRAYER REQUESTS</Text>
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
                <Text style={styles.categoryTitle}>PRAYED FOR</Text>
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
          <Text style={styles.errorText}>Error loading prayers</Text>
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <JournalCard
        icon={(hasContent || isEditing) ? (
          <MaterialCommunityIcons
            name="account-heart-outline"
            size={24}
            color={Colors.alertCoral}
          />
        ) : undefined}
        title={hasContent || isEditing ? 'PRAYER LIST FOR PEOPLE' : undefined}
        subtitle={hasContent || isEditing ? getSubtitle() : undefined}
        variant={variant}
        viewMode={viewMode}
        expanded={expanded}
        onExpand={onExpand}
        showAddButton={hasContent || isEditing ? !isEditing && !isPastDate : !isPastDate}
        onAdd={toggleEditing}
        isAdding={isEditing}
        onCancelAdd={handleCancelEdit}
      >
        {isEditing ? (
          renderEditForm()
        ) : hasContent ? (
          renderExistingPrayers()
        ) : (viewMode === 'inline' || viewMode === 'moments') ? null : (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name="account-heart-outline"
                  size={32}
                  color={Colors.mediumGray}
                  style={[styles.emptyStateIcon, styles.flippedIcon]}
                />
              </View>
              <Text style={styles.sectionLabel} accessibilityRole="text">
                PRAYER LIST FOR PEOPLE
              </Text>
            </View>
            <View style={styles.titleContainer}>
              <Text
                style={styles.emptyStateTitle}
                accessibilityRole="header"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {isPast ? pastEmptyTitle : 'Start your prayer list'}
              </Text>
            </View>
            <Text style={styles.emptyStateSubtext} accessibilityRole="text">
              {isPast
                ? pastEmptySubtitle
                : "Add people you'd like to pray for or prayer requests from others"}
            </Text>
            {!isPast && (
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => { triggerLightHaptic(); toggleEditing(); }}
                accessibilityRole="button"
                accessibilityLabel="Begin creating prayer list"
              >
                <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
                <Text style={styles.emptyStateButtonText}>Begin</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
  emptyStateTitle: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  emptyStateSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
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
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.medium,
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
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  activeTabText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.medium,
    marginBottom: 8,
    opacity: 0.8,
  },
  notesInput: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.medium,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  prayedStatusIcon: {
    marginLeft: 6,
  },
  personName: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.regular,
    marginBottom: 4,
  },
  notesText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.medium,
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
    fontFamily: Fonts.regular,
    fontSize: 16,
    marginTop: 12,
  },
  debugText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.medium,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorStateSubtext: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.medium,
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
    fontFamily: Fonts.semiBold,
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
    marginBottom: 12,
  },
});

export default EnhancedPrayerListReactQuery;
