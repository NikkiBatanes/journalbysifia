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
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  usePeoplePrayerData,
  useCreatePrayer,
  useUpdatePrayer,
  useMarkPrayerRequestPrayed,
} from '../../services/hooks/usePrayerData';

interface EnhancedPrayerListReactQueryProps {
  selectedDate: Date;
}

const EnhancedPrayerListReactQuery: React.FC<EnhancedPrayerListReactQueryProps> = ({
  selectedDate,
}) => {
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // React Query hooks
  const { data: peoplePrayers = [], isLoading, error, refetch } = usePeoplePrayerData(user?.id || '', dateStr);
  const createPrayerMutation = useCreatePrayer();
  const updatePrayerMutation = useUpdatePrayer();
  const markPrayedMutation = useMarkPrayerRequestPrayed();

  // Local state
  const [activeTab, setActiveTab] = useState<'mine' | 'requests'>('mine');
  const [name, setName] = useState('');
  const [prayer, setPrayer] = useState('');
  const [notes, setNotes] = useState('');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isPrayerFocused, setIsPrayerFocused] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [currentRequestedBy, setCurrentRequestedBy] = useState<string | undefined>(undefined);

  const prayerInputRef = useRef<TextInput>(null);

  const clearInputs = useCallback(() => {
    setName('');
    setPrayer('');
    setNotes('');
    setCurrentRequestedBy(undefined);
    setIsNameFocused(false);
    setIsPrayerFocused(false);

    if (prayerInputRef.current) {
      prayerInputRef.current.blur();
    }

    setInputKey(prev => prev + 1);
  }, []);

  // Reset state when date changes
  React.useEffect(() => {
    clearInputs();
    console.log('🙏 EnhancedPrayerList: Resetting state for date:', dateStr);
  }, [dateStr, clearInputs]);

  // Filter prayers by type
  const prayerRequests = peoplePrayers.filter(p => p.is_request === true);
  const personalPrayers = peoplePrayers.filter(p => p.is_request === false);
  const currentPrayers = activeTab === 'requests' ? prayerRequests : personalPrayers;

  const handleTabChange = (tab: 'mine' | 'requests') => {
    Keyboard.dismiss();
    clearInputs();

    setTimeout(() => {
      setActiveTab(tab);
    }, 50);
  };

  const handleAddPrayer = async () => {
    Keyboard.dismiss();

    if (createPrayerMutation.isPending) {return;}

    let shouldClearInputs = false;

    try {
      // If we're adding a prayer that came from a request, mark the original request as prayed
      if (currentRequestedBy) {
        const originalRequest = prayerRequests.find(
          item => item.person_name === name && item.is_request === true && !item.is_prayed
        );
        if (originalRequest) {
          await markPrayedMutation.mutateAsync({
            id: originalRequest.id,
            isPrayed: true,
            _userId: user?.id || '',
            _dateStr: dateStr,
          });
        }
        shouldClearInputs = true;
      }

      if (activeTab === 'requests') {
        // Adding a new prayer request
        if (name.trim() && prayer.trim()) {
          await createPrayerMutation.mutateAsync({
            user_id: user?.id || '',
            content: prayer.trim(),
            type: 'people',
            person_name: name.trim(),
            is_request: true,
            selected_date: dateStr,
          });
          shouldClearInputs = true;
        }
      } else {
        // Adding a personal prayer
        if (name.trim() && (prayer.trim() || notes.trim())) {
          await createPrayerMutation.mutateAsync({
            user_id: user?.id || '',
            content: prayer.trim(),
            type: 'people',
            person_name: name.trim(),
            is_request: false,
            selected_date: dateStr,
          });
          shouldClearInputs = true;
        }
      }

      if (shouldClearInputs) {
        clearInputs();
      }
    } catch (err) {
      console.error('Error adding prayer:', err);
      // Error is handled by React Query
    }
  };

  const handleAddToMyList = async (prayerEntry: {
    requested_by?: string;
    person_name?: string;
    content: string;
  }) => {
    setName(prayerEntry.person_name || '');
    setPrayer(prayerEntry.content);
    setCurrentRequestedBy(prayerEntry.requested_by);
    setActiveTab('mine');
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Please log in to view prayers</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.anchorBlue} />
          <Text style={styles.loadingText}>Loading prayers...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading prayers</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isSubmitting = createPrayerMutation.isPending || updatePrayerMutation.isPending || markPrayedMutation.isPending;
  const canSubmit = name.trim() && (activeTab === 'requests' ? prayer.trim() : (prayer.trim() || notes.trim()));

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="people" size={22} color={Colors.anchorBlue} style={styles.headerIcon} />
            <Text style={styles.headerTitle}>People Prayers</Text>
            <View style={styles.headerPill}>
              <Text style={styles.headerPillText}>
                {peoplePrayers.length} {peoplePrayers.length === 1 ? 'person' : 'people'}
              </Text>
            </View>
          </View>
          {prayerRequests.filter(p => !p.is_prayed).length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {prayerRequests.filter(p => !p.is_prayed).length}
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
              <Ionicons
                name="person"
                size={16}
                color={activeTab === 'mine' ? Colors.hopeWhite : 'rgba(255, 255, 255, 0.7)'}
                style={styles.iconMargin}
              />
              <Text style={[styles.tabText, activeTab === 'mine' && styles.activeTabText]}>
                My Prayers ({personalPrayers.length})
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
            onPress={() => handleTabChange('requests')}
          >
            <View style={styles.tabContent}>
              <Ionicons
                name="help-circle"
                size={16}
                color={activeTab === 'requests' ? Colors.hopeWhite : 'rgba(255, 255, 255, 0.7)'}
                style={styles.iconMargin}
              />
              <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
                Requests ({prayerRequests.length})
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Input Section */}
        <View style={[styles.inputContainer, isNameFocused && styles.inputFocused]}>
          <TextInput
            key={`name-${inputKey}`}
            style={styles.input}
            placeholder="Person's name"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            value={name}
            onChangeText={setName}
            onFocus={() => setIsNameFocused(true)}
            onBlur={() => setIsNameFocused(false)}
          />
        </View>

        <View style={[styles.prayerInputContainer, isPrayerFocused && styles.inputFocused]}>
          <TextInput
            ref={prayerInputRef}
            key={`prayer-${inputKey}`}
            style={[styles.input, styles.prayerInput]}
            placeholder={
              activeTab === 'requests'
                ? 'What would you like prayer for?'
                : 'How can I pray for this person?'
            }
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            value={prayer}
            onChangeText={setPrayer}
            multiline
            onFocus={() => setIsPrayerFocused(true)}
            onBlur={() => setIsPrayerFocused(false)}
          />

          {activeTab === 'mine' && (
            <TextInput
              key={`notes-${inputKey}`}
              style={styles.notesInput}
              placeholder="Additional notes (optional)"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          )}

          <TouchableOpacity
            style={[
              styles.checkButton,
              (!canSubmit || isSubmitting) && styles.disabledButton,
            ]}
            onPress={handleAddPrayer}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.anchorBlue} />
            ) : (
              <Ionicons name="checkmark" size={24} color={Colors.anchorBlue} />
            )}
          </TouchableOpacity>
        </View>

        {/* Prayer List */}
        <ScrollView style={styles.prayerList} showsVerticalScrollIndicator={false}>
          {currentPrayers.map((prayerItem) => (
            <View key={prayerItem.id} style={styles.prayerItem}>
              <View style={styles.prayerHeader}>
                <Text style={styles.personName}>{prayerItem.person_name}</Text>
                {activeTab === 'requests' && (
                  <Ionicons
                    name={prayerItem.is_prayed ? 'checkmark-circle' : 'time-outline'}
                    size={20}
                    color={prayerItem.is_prayed ? Colors.success : 'rgba(255, 255, 255, 0.6)'}
                    style={styles.statusIcon}
                  />
                )}
              </View>

              <Text style={styles.prayerText}>{prayerItem.content}</Text>

              {activeTab === 'requests' && !prayerItem.is_prayed && (
                <TouchableOpacity
                  style={[styles.addButton, markPrayedMutation.isPending && styles.prayedButton]}
                  onPress={() => handleAddToMyList({
                    person_name: prayerItem.person_name,
                    content: prayerItem.content,
                    requested_by: 'Request',
                  })}
                  disabled={markPrayedMutation.isPending}
                >
                  <Ionicons name="add-circle-outline" size={16} color={Colors.hopeWhite} />
                  <Text style={styles.addButtonText}>Add to My Prayers</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {currentPrayers.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {activeTab === 'requests'
                  ? 'No prayer requests yet'
                  : 'No personal prayers yet'
                }
              </Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'requests'
                  ? 'Add a prayer request above'
                  : 'Add someone to pray for above'
                }
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(26, 60, 109, 0.3)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
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
});

export default EnhancedPrayerListReactQuery;
