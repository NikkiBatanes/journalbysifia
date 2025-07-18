import React, { useState, useRef, useCallback } from 'react';
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
import { usePrayer } from '../../context/PrayerContext';


const EnhancedPrayerList: React.FC = () => {
  const { addPrayer, updatePrayer, getPrayerRequests, getPersonalPrayers } = usePrayer();
  const [activeTab, setActiveTab] = useState<'mine' | 'requests'>('mine');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearInputs = useCallback(() => {
    // Reset all input fields
    setName('');
    setPrayer('');
    setNotes('');
    setCurrentRequestedBy(undefined);

    // Reset focus states
    setIsNameFocused(false);
    setIsPrayerFocused(false);

    // Force blur any focused inputs
    if (prayerInputRef.current) {
      prayerInputRef.current.blur();
    }

    // Force a re-render of the inputs by updating the key
    setInputKey(prev => prev + 1);
  }, []);

  const handleTabChange = (tab: 'mine' | 'requests') => {
    // Dismiss keyboard first
    Keyboard.dismiss();

    // Clear all input fields
    clearInputs();

    // Change the active tab after a small delay
    setTimeout(() => {
      setActiveTab(tab);
    }, 50);
  };
  const [name, setName] = useState('');
  const [prayer, setPrayer] = useState('');
  const [notes, setNotes] = useState('');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isPrayerFocused, setIsPrayerFocused] = useState(false);
  const [inputKey, setInputKey] = useState(0); // Add key to force re-render inputs

  const [currentRequestedBy, setCurrentRequestedBy] = useState<string | undefined>(undefined);

  // Get filtered prayers using new storage system
  const prayerRequests = getPrayerRequests();
  const personalPrayers = getPersonalPrayers();
  const currentPrayers = activeTab === 'requests' ? prayerRequests : personalPrayers;

  const handleAddPrayer = async () => {
    // Dismiss keyboard first
    Keyboard.dismiss();

    if (isSubmitting) {return;}

    let shouldClearInputs = false;
    setIsSubmitting(true);

    try {
      // If we're adding a prayer that came from a request, mark the original request as prayed
      if (currentRequestedBy) {
        const originalRequest = prayerRequests.find(
          item => item.person_name === name && item.is_prayer_request === true && !item.prayed
        );
        if (originalRequest) {
          await updatePrayer(originalRequest.id, { prayed: true });
        }
        shouldClearInputs = true;
      }

      if (activeTab === 'requests') {
        // Adding a new prayer request
        if (name.trim() && prayer.trim()) {
          await addPrayer({
            content: prayer.trim(),
            prayer_type: 'people',
            person_name: name.trim(),
            is_prayer_request: true,
            requested_by: 'Me',
            notes: notes.trim(),
            selected_date: new Date().toISOString().split('T')[0],
          });
          shouldClearInputs = true;
        }
      } else {
        // Adding a personal prayer
        if (name.trim() && (prayer.trim() || notes.trim())) {
          await addPrayer({
            content: prayer.trim(),
            prayer_type: 'people',
            person_name: name.trim(),
            is_prayer_request: false,
            requested_by: currentRequestedBy,
            notes: notes.trim(),
            selected_date: new Date().toISOString().split('T')[0],
          });
          shouldClearInputs = true;
        }
      }

      // Always clear inputs after processing
      if (shouldClearInputs) {
        clearInputs();
      }
    } catch (error) {
      console.error('Error adding prayer:', error);
      // TODO: Show error message to user
    } finally {
      setIsSubmitting(false);
    }
  };

  const prayerInputRef = useRef<TextInput>(null);

  const handleAddToMyList = (prayerEntry: {
    requested_by?: string;
    person_name?: string;
    content: string;
  }) => {
    // Set the requestedBy first
    setCurrentRequestedBy(prayerEntry.requested_by || 'Someone');

    // Switch to 'People to Pray For' tab without clearing fields
    setActiveTab('mine');

    // Pre-fill the form fields after a small delay to ensure tab switch
    setTimeout(() => {
      setName(prayerEntry.person_name || '');
      setPrayer(''); // Keep prayer text empty for user to fill
      setNotes(prayerEntry.content); // Move the prayer request to notes

      // Focus the prayer input field
      if (prayerInputRef.current) {
        prayerInputRef.current.focus();
      }
    }, 100);
  };

  // Get count of unprayed requests for the badge
  const unprayedRequestsCount = prayerRequests.filter(item => !item.prayed).length;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="people" size={20} color={Colors.hopeWhite} style={styles.headerIcon} />
            <Text style={styles.headerTitle}>
              People to Pray For
            </Text>
          </View>
          <View style={styles.headerPill}>
            <Text style={styles.headerPillText}>
              {currentPrayers.length} {currentPrayers.length === 1 ? 'ITEM' : 'ITEMS'}
            </Text>
          </View>
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
              multiline
              textAlignVertical="top"
              returnKeyType="done"
            />
          )}
          <TouchableOpacity
            style={[styles.checkButton, (!name.trim() || !prayer.trim() || isSubmitting) && styles.disabledButton]}
            onPress={handleAddPrayer}
            disabled={!name.trim() || !prayer.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.hopeWhite} />
            ) : (
              <Ionicons
                name="checkmark-circle"
                size={34}
                color={(!name.trim() || !prayer.trim() || isSubmitting) ? 'rgba(255, 255, 255, 0.5)' : Colors.hopeWhite}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Prayer List */}
        <ScrollView style={styles.prayerList}>
          {currentPrayers.map((item: {
            id: string;
            person_name?: string;
            content: string;
            notes?: string;
            is_prayer_request?: boolean;
            prayed?: boolean;
            requested_by?: string;
          }) => (
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
    flex: 1,
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
    minHeight: 100,
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
    flex: 1,
    marginTop: 8,
  },
  prayerItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  prayerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconMargin: {
    marginRight: 6,
  },
  personName: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
    fontSize: 16,
    flex: 1,
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
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },
  notesLabel: {
    fontFamily: Fonts.medium,
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
});

export default EnhancedPrayerList;
