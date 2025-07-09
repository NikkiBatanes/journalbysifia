import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Modal, 
  TouchableWithoutFeedback, 
  Keyboard 
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';

type PrayerStatus = 'praying' | 'answered';
type PrayerType = 'personal' | 'request';

interface PrayerItem {
  id: string;
  name: string;
  prayer: string;
  status: PrayerStatus;
  type: PrayerType;
  requestedBy?: string;
  notes?: string;
}

const EnhancedPrayerList: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mine' | 'requests'>('mine');
  
  const handleTabChange = (tab: 'mine' | 'requests') => {
    // Clear all input fields
    setName('');
    setPrayer('');
    setNotes('');
    setCurrentRequestedBy(undefined);
    Keyboard.dismiss();
    
    // Change the active tab
    setActiveTab(tab);
  };
  const [name, setName] = useState('');
  const [prayer, setPrayer] = useState('');
  const [notes, setNotes] = useState('');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isPrayerFocused, setIsPrayerFocused] = useState(false);
  const [isNotesFocused, setIsNotesFocused] = useState(false);
  const [selectedPrayer, setSelectedPrayer] = useState<PrayerItem | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // Sample data - in a real app, this would come from a database
  const [prayerItems, setPrayerItems] = useState<PrayerItem[]>([
    {
      id: '1',
      name: 'John Doe',
      prayer: 'Healing from illness',
      status: 'praying',
      type: 'personal',
      notes: 'Needs healing for back pain'
    },
    {
      id: '2',
      name: 'Sarah Smith',
      prayer: 'Job interview on Friday',
      status: 'praying',
      type: 'request',
      requestedBy: 'Sarah'
    }
  ]);

  const [currentRequestedBy, setCurrentRequestedBy] = useState<string | undefined>(undefined);

  const handleAddPrayer = () => {
    if (activeTab === 'requests') {
      // Adding a new prayer request
      if (name.trim() && prayer.trim()) {
        const newPrayer: PrayerItem = {
          id: Date.now().toString(),
          name: name.trim(),
          prayer: prayer.trim(), // Main prayer request text
          status: 'praying',
          type: 'request',
          notes: notes.trim(), // Additional notes
          requestedBy: 'Me'
        };
        
        setPrayerItems(prev => [newPrayer, ...prev]);
        setName('');
        setPrayer('');
        setNotes('');
        Keyboard.dismiss();
      }
    } else {
      // Adding a personal prayer
      if (name.trim() && (prayer.trim() || notes.trim())) {
        const newPrayer: PrayerItem = {
          id: Date.now().toString(),
          name: name.trim(),
          prayer: prayer.trim(), // Personal prayer text
          status: 'praying',
          type: 'personal',
          notes: notes.trim(), // Notes (could be the original prayer request)
          requestedBy: currentRequestedBy
        };
        
        setPrayerItems(prev => [newPrayer, ...prev]);
        setName('');
        setPrayer('');
        setNotes('');
        setCurrentRequestedBy(undefined);
        Keyboard.dismiss();
      }
    }
  };

  const togglePrayerStatus = (id: string) => {
    setPrayerItems(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, status: item.status === 'praying' ? 'answered' : 'praying' } 
          : item
      )
    );
  };

  const handlePrayerPress = (prayer: PrayerItem) => {
    setSelectedPrayer(prayer);
    setIsModalVisible(true);
  };

  const prayerInputRef = useRef<TextInput>(null);

  const handleAddToMyList = (prayer: PrayerItem) => {
    // Set the requestedBy first
    setCurrentRequestedBy(prayer.requestedBy || 'Someone');
    
    // Switch to 'People to Pray For' tab without clearing fields
    setActiveTab('mine');
    
    // Pre-fill the form fields after a small delay to ensure tab switch
    setTimeout(() => {
      setName(prayer.name);
      setPrayer(''); // Keep prayer text empty for user to fill
      setNotes(prayer.prayer); // Move the prayer request to notes
      
      // Focus the prayer input field
      if (prayerInputRef.current) {
        prayerInputRef.current.focus();
      }
    }, 100);
    
    // Close the modal if open
    setIsModalVisible(false);
  };

  const filteredPrayers = prayerItems.filter(item => 
    activeTab === 'mine' ? item.type === 'personal' : item.type === 'request'
  );

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
              {filteredPrayers.length} {filteredPrayers.length === 1 ? 'ITEM' : 'ITEMS'}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'mine' && styles.activeTab]}
            onPress={() => handleTabChange('mine')}
          >
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={[styles.tabText, activeTab === 'mine' && styles.activeTabText]}>
                Prayers for People
              </Text>
              {activeTab !== 'mine' && (
                <View style={[styles.badge, {backgroundColor: Colors.anchorBlue}]}>
                  <Text style={styles.badgeText}>
                    {prayerItems.filter(item => item.type === 'personal').length}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
            onPress={() => handleTabChange('requests')}
          >
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
                Prayer Requests
              </Text>
              {activeTab !== 'requests' && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {prayerItems.filter(item => item.type === 'request').length}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Input Form */}
        <View style={[styles.inputContainer, isNameFocused && styles.inputFocused]}>
          <TextInput
            style={styles.input}
            placeholder={activeTab === 'mine' ? "Who are you praying for?" : "Who is requesting prayer?"}
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
            ref={prayerInputRef}
            style={[styles.input, styles.prayerInput]}
            placeholder={activeTab === 'mine' 
              ? "What would you like to pray for this person?" 
              : "What is their prayer request?"}
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
              style={[styles.input, styles.notesInput]}
              placeholder="Notes (Optional)"
              placeholderTextColor={Colors.trustGrey}
              value={notes}
              onChangeText={setNotes}
              onFocus={() => setIsNotesFocused(true)}
              onBlur={() => setIsNotesFocused(false)}
              multiline
              textAlignVertical="top"
              keyboardAppearance="dark"
            />
          )}
          <TouchableOpacity
            style={[styles.checkButton, (!name.trim() || !prayer.trim()) && styles.disabledButton]}
            onPress={handleAddPrayer}
            disabled={!name.trim() || !prayer.trim()}
          >
            <Ionicons
              name="checkmark-circle"
              size={34}
              color={!name.trim() || !prayer.trim() ? 'rgba(255, 255, 255, 0.5)' : Colors.hopeWhite}
            />
          </TouchableOpacity>
        </View>

        {/* Prayer List */}
        <ScrollView style={styles.prayerList}>
          {filteredPrayers.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={[
                styles.prayerItem,
                item.status === 'answered' && styles.answeredPrayer
              ]}
              onPress={() => handlePrayerPress(item)}
              onLongPress={() => togglePrayerStatus(item.id)}
            >
              <View style={styles.prayerHeader}>
                <Text style={styles.personName}>
                  {item.name}
                </Text>
                <Ionicons 
                  name={item.status === 'answered' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={item.status === 'answered' ? Colors.growthGreen : Colors.hopeWhite}
                  style={styles.statusIcon}
                />
              </View>
              {item.type === 'request' ? (
                // For prayer requests
                <>
                  <Text style={styles.prayerText}>{item.prayer}</Text>
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
                    {item.prayer || item.notes}
                  </Text>
                  {item.requestedBy && item.notes && (
                    <Text style={styles.notesText} numberOfLines={1}>
                      <Text style={styles.notesLabel}>Prayer Request: </Text>
                      {item.notes}
                    </Text>
                  )}
                  {!item.requestedBy && item.notes && item.prayer && (
                    <Text style={styles.notesText} numberOfLines={1}>
                      <Text style={styles.notesLabel}>Notes: </Text>
                      {item.notes}
                    </Text>
                  )}
                </>
              )}
              {item.type === 'request' && activeTab === 'requests' && (
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={() => handleAddToMyList(item)}
                >
                  <Ionicons name="add-circle" size={20} color={Colors.hopeWhite} />
                  <Text style={styles.addButtonText}>Pray for {item.name} now</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Prayer Detail Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isModalVisible}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {selectedPrayer && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{selectedPrayer.name}</Text>
                    <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                      <Ionicons name="close" size={24} color={Colors.anchorBlue} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalPrayer}>{selectedPrayer.prayer}</Text>
                  {selectedPrayer.notes && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesTitle}>
                        {selectedPrayer.type === 'request' ? 'Prayer Request' : 'My Notes'}
                      </Text>
                      <Text style={styles.notesContent}>{selectedPrayer.notes}</Text>
                    </View>
                  )}
                  <View style={styles.modalActions}>
                    <TouchableOpacity 
                      style={styles.statusButton}
                      onPress={() => {
                        togglePrayerStatus(selectedPrayer.id);
                        setIsModalVisible(false);
                      }}
                    >
                      <Ionicons 
                        name={selectedPrayer.status === 'answered' ? 'ellipse-outline' : 'checkmark-circle'} 
                        size={20} 
                        color={selectedPrayer.status === 'answered' ? Colors.anchorBlue : Colors.growthGreen} 
                      />
                      <Text style={styles.statusButtonText}>
                        {selectedPrayer.status === 'answered' ? 'Mark as Praying' : 'Mark as Answered'}
                      </Text>
                    </TouchableOpacity>
                    {selectedPrayer.type === 'request' && (
                      <TouchableOpacity 
                        style={[styles.statusButton, styles.addToMyListButton]}
                        onPress={() => {
                          handleAddToMyList(selectedPrayer);
                          setIsModalVisible(false);
                        }}
                      >
                        <Ionicons name="add-circle" size={20} color={Colors.anchorBlue} />
                        <Text style={[styles.statusButtonText, { color: Colors.anchorBlue }]}>
Pray for {selectedPrayer.name} now
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
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
    marginBottom: 10,
  },
  answeredPrayer: {
    opacity: 0.7,
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
  },
  addButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 12,
    marginLeft: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.anchorBlue,
    flex: 1,
  },
  modalPrayer: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.anchorBlue,
    marginBottom: 16,
  },
  notesContainer: {
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  notesTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.anchorBlue,
    marginBottom: 4,
  },
  notesContent: {
    fontSize: 14,
    color: Colors.anchorBlue,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  addToMyListButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.anchorBlue,
    marginRight: 0,
    marginLeft: 8,
  },
  statusButtonText: {
    marginLeft: 6,
    fontFamily: Fonts.medium,
    color: Colors.anchorBlue,
    fontSize: 14,
  },
});

export default EnhancedPrayerList;
