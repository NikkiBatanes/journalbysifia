import React, { useState, useRef } from 'react';
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
import Ionicons from 'react-native-vector-icons/Ionicons';
import ComponentErrorBoundary from '../../components/ErrorBoundary/ComponentErrorBoundary';
import { usePeoplePrayerData, useCreatePrayer, useUpdatePrayer } from '../../services/hooks/usePrayerData';
import { PrayerApiEntry } from '../../services/api/prayerApi';
import { useAuth } from '../../context/IndustryStandardAuthContext';

// Types and Interfaces
type TabType = 'mine' | 'requests';

// Use the API interface directly
type PersonPrayer = PrayerApiEntry;

interface EnhancedPrayerListReactQueryProps {
  selectedDate: Date;
}





const EnhancedPrayerListReactQuery: React.FC<EnhancedPrayerListReactQueryProps> = ({
  selectedDate,
}) => {
  console.log('🙏 EnhancedPrayerList: Component is rendering!', { selectedDate });

  const { user } = useAuth();
  const dateStr = selectedDate.toISOString().split('T')[0];

  // React Query hooks for data fetching
  const { data: peoplePrayers = [], error } = usePeoplePrayerData(
    user?.id || '',
    dateStr
  );
  const createPrayerMutation = useCreatePrayer();
  const updatePrayerMutation = useUpdatePrayer();



  // Local state for form
  const [name, setName] = useState('');
  const [prayer, setPrayer] = useState('');
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('mine');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isPrayerFocused, setIsPrayerFocused] = useState(false);
  const [_isNoteFocused, setIsNoteFocused] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [currentRequestedBy, setCurrentRequestedBy] = useState<string | undefined>(undefined);

  const prayerInputRef = useRef<TextInput>(null);

  const handleAddPrayer = async () => {
    if (!user?.id || !name.trim() || !prayer.trim()) {return;}

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
      await createPrayerMutation.mutateAsync({
        user_id: user.id,
        prayer_type: 'people',
        person_name: name.trim(),
        content: prayer.trim(),
        metadata: {
          notes: notes.trim() || undefined,
          is_prayer_request: activeTab === 'requests',
          requested_by: currentRequestedBy,
        },
        selected_date: dateStr,
      });


      // Clear inputs
      setName('');
      setPrayer('');
      setNotes('');
      setCurrentRequestedBy(undefined);
      setInputKey(prev => prev + 1);

      Keyboard.dismiss();
    } catch (err) {
      console.error('Error adding prayer:', err);
      // TODO: Show error message to user
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Clear inputs when switching tabs
    setName('');
    setPrayer('');
    setNotes('');
    setCurrentRequestedBy(undefined);
    setInputKey(prev => prev + 1);
  };

  const handleAddToMyList = (prayerEntry: PersonPrayer) => {
    // Set the requestedBy first
    setCurrentRequestedBy(prayerEntry.requested_by || 'Someone');

    // Switch to 'Prayers for People' tab
    setActiveTab('mine');

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

  const prayerRequests = peoplePrayers.filter(p => p.is_prayer_request === true);
  const personalPrayers = peoplePrayers.filter(p => p.is_prayer_request !== true);
  const currentPrayers = activeTab === 'requests' ? prayerRequests : personalPrayers;

  // Get count of unprayed requests for the badge
  const unprayedRequestsCount = prayerRequests.filter(item => !item.prayed).length;

  // Handle no user case
  if (!user) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Please log in to view prayers</Text>
        </View>
      </View>
    );
  }

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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="people" size={20} color={Colors.hopeWhite} style={styles.headerIcon} />
            <Text style={styles.headerTitle}>Prayer List for People</Text>
          </View>
          {peoplePrayers.length > 0 && (
            <View style={styles.headerPill}>
              <Text style={styles.headerPillText}>
                {peoplePrayers.length} {peoplePrayers.length === 1 ? 'PERSON' : 'PEOPLE'}
              </Text>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'mine' && styles.activeTab]}
            onPress={() => handleTabChange('mine')}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, activeTab === 'mine' && styles.activeTabText]}>
                Prayers for People
              </Text>
              {activeTab !== 'mine' && personalPrayers.length > 0 && (
                <View style={[styles.badge, {backgroundColor: Colors.anchorBlue}]}>
                  <Text style={styles.badgeText}>
                    {personalPrayers.length}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
            onPress={() => handleTabChange('requests')}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
                Prayer Requests
              </Text>
              {activeTab !== 'requests' && unprayedRequestsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unprayedRequestsCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Input Form */}
        <View style={[styles.inputContainer, isNameFocused && styles.inputFocused]}>
          <TextInput
            key={`name-${inputKey}`}
            style={styles.input}
            placeholder={activeTab === 'mine' ? 'Who are you praying for?' : 'Who is requesting prayer?'}
            placeholderTextColor={Colors.trustGrey}
            value={name}
            onChangeText={setName}
            onFocus={() => setIsNameFocused(true)}
            onBlur={() => setIsNameFocused(false)}
            autoCapitalize="words"
            keyboardAppearance="dark"
          />
        </View>

        <View style={[styles.prayerInputContainer, isPrayerFocused && styles.inputFocused]}>
          <TextInput
            key={`prayer-${inputKey}`}
            ref={prayerInputRef}
            style={[styles.input, styles.prayerInput]}
            placeholder={activeTab === 'mine'
              ? 'What would you like to pray for this person?'
              : 'What is their prayer request?'}
            placeholderTextColor={Colors.trustGrey}
            value={prayer}
            onChangeText={setPrayer}
            onFocus={() => setIsPrayerFocused(true)}
            onBlur={() => setIsPrayerFocused(false)}
            multiline
            textAlignVertical="top"
            autoCapitalize="sentences"
            keyboardAppearance="dark"
          />
          {activeTab === 'mine' && (
            <TextInput
              key={`notes-${inputKey}`}
              style={[styles.input, styles.notesInput]}
              placeholder="Add notes (optional)"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={notes}
              onChangeText={setNotes}
              onFocus={() => setIsNoteFocused(true)}
              onBlur={() => setIsNoteFocused(false)}
              multiline
              textAlignVertical="top"
              returnKeyType="done"
            />
          )}
          <TouchableOpacity
            style={[styles.checkButton, (!name.trim() || !prayer.trim() || createPrayerMutation.isPending) && styles.disabledButton]}
            onPress={handleAddPrayer}
            disabled={!name.trim() || !prayer.trim() || createPrayerMutation.isPending}
          >
            {createPrayerMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.hopeWhite} />
            ) : (
              <Ionicons
                name="checkmark-circle"
                size={34}
                color={(!name.trim() || !prayer.trim() || createPrayerMutation.isPending) ? 'rgba(255, 255, 255, 0.5)' : Colors.hopeWhite}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Prayer List */}
        <ScrollView style={styles.prayerList}>
          {currentPrayers.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.prayerItem}
              onPress={() => {}}
            >
              <View style={styles.prayerHeader}>
                <Text style={styles.personName}>
                  {item.person_name}
                </Text>
              </View>
              {item.is_prayer_request ? (
                // For prayer requests
                <>
                  <Text style={styles.prayerText}>{item.content}</Text>
                  {item.notes && (
                    <Text style={styles.notesText} numberOfLines={1}>
                      <Text style={styles.notesLabel}>Notes: </Text>
                      {item.notes}
                    </Text>
                  )}
                </>
              ) : (
                // For personal prayers
                <>
                  <Text style={styles.prayerText}>
                    {item.content || item.notes}
                  </Text>
                  {item.requested_by && item.notes && (
                    <Text style={styles.notesText} numberOfLines={1}>
                      <Text style={styles.notesLabel}>Prayer Request: </Text>
                      {item.notes}
                    </Text>
                  )}
                  {!item.requested_by && item.notes && item.content && (
                    <Text style={styles.notesText} numberOfLines={1}>
                      <Text style={styles.notesLabel}>Notes: </Text>
                      {item.notes}
                    </Text>
                  )}
                </>
              )}
              {item.is_prayer_request && activeTab === 'requests' && (
                <TouchableOpacity
                  style={[styles.addButton, item.prayed && styles.prayedButton]}
                  onPress={() => handleAddToMyList(item)}
                  disabled={item.prayed}
                >
                  <Ionicons
                    name={item.prayed ? 'checkmark-circle' : 'add-circle'}
                    size={20}
                    color={Colors.hopeWhite}
                    style={styles.iconMargin}
                  />
                  <Text style={styles.addButtonText}>
                    {item.prayed ? 'Prayed' : `Pray for ${item.person_name} now`}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.anchorBlue,
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
  headerIcon: {
    marginRight: 10,
    marginLeft: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  headerPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
    fontSize: 14,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  input: {
    color: Colors.hopeWhite,
    fontSize: 16,
    padding: 14,
    fontFamily: Fonts.regular,
  },
  prayerInputContainer: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 120,
  },
  prayerInput: {
    padding: 14,
    textAlignVertical: 'top',
    minHeight: 120,
    paddingBottom: 50,
  },
  notesInput: {
    minHeight: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    margin: 8,
    color: Colors.hopeWhite,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  checkButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Prayer List
  prayerList: {
    maxHeight: 300,
    marginTop: 8,
  },
  prayerItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  prayerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
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
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },
  notesLabel: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
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
    backgroundColor: Colors.anchorBlue,
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
    color: Colors.anchorBlue,
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
    color: Colors.anchorBlue,
    fontFamily: Fonts.regular,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 20,
  },
  errorRetryButton: {
    backgroundColor: Colors.anchorBlue,
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
});

// Wrap with error boundary for production safety
const EnhancedPrayerListWithErrorBoundary: React.FC<EnhancedPrayerListReactQueryProps> = (props) => (
  <ComponentErrorBoundary>
    <EnhancedPrayerListReactQuery {...props} />
  </ComponentErrorBoundary>
);

export default EnhancedPrayerListWithErrorBoundary;
