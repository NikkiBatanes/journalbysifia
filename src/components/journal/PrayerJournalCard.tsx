import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { usePrayer } from '../../context/PrayerContext';
import { JournalCategory } from '../../storage/prayerStorage';

// Prayer types and descriptions
const PRAYER_TYPES = [
  {
    key: 'adoration',
    label: 'ADORATION',
    displayName: 'Adoration',
    color: Colors.anchorBlue,
    description: 'Praising God',
    icon: 'star', // Using star instead of sparkles
  },
  {
    key: 'confession',
    label: 'CONFESSION',
    displayName: 'Confession',
    color: Colors.anchorBlue, // Using anchorBlue for all
    description: 'Acknowledging Sins',
    icon: 'heart', // Using heart instead of heart-broken
  },
  {
    key: 'thanksgiving',
    label: 'THANKSGIVING',
    displayName: 'Thanksgiving',
    color: Colors.anchorBlue, // Using anchorBlue for all
    description: 'Giving Thanks',
    icon: 'gift',
  },
  {
    key: 'supplication',
    label: 'SUPPLICATION',
    displayName: 'Supplication',
    color: Colors.anchorBlue, // Using anchorBlue for all
    description: 'Making Requests',
    icon: 'hand-right', // Using hand-right instead of hands-praying
  },
];

type PrayerStatus = 'pending' | 'answered';

// Format date as MM/DD/YYYY
const formatDate = (dateString: string): string => {
  if (!dateString) {return 'No date';}
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

const PrayerJournalCard: React.FC = () => {
  const { journalPrayers, addPrayer, updatePrayer } = usePrayer();
  const [selectedType, setSelectedType] = useState(PRAYER_TYPES[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [prayerText, setPrayerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group prayers by type using the new storage system
  const prayersByType = journalPrayers.reduce<Record<string, typeof journalPrayers>>((acc, prayer) => {
    const category = prayer.journal_category || 'adoration';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(prayer);
    return acc;
  }, {});

  const totalPrayers = journalPrayers.length;

  // Add prayer logic using new storage system
  const handleAddPrayer = async () => {
    if (prayerText.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await addPrayer({
          content: prayerText.trim(),
          prayer_type: 'journal',
          journal_category: selectedType.key as JournalCategory,
          status: selectedType.key === 'supplication' ? 'pending' as PrayerStatus : undefined,
          selected_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        });
        setPrayerText('');
      } catch (error) {
        console.error('Error adding prayer:', error);
        // TODO: Show error message to user
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Toggle supplication answered status using new storage system
  const handleToggleAnswered = async (id: string) => {
    try {
      const prayer = journalPrayers.find(p => p.id === id);
      if (!prayer) {return;}

      const newStatus: PrayerStatus = prayer.status === 'pending' ? 'answered' : 'pending';
      await updatePrayer(id, {
        status: newStatus,
        answered_date: newStatus === 'answered' ? new Date().toISOString() : undefined,
      });
    } catch (error) {
      console.error('Error updating prayer status:', error);
      // TODO: Show error message to user
    }
  };


  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="heart" size={20} color={Colors.hopeWhite} style={styles.headerIcon} />
          <Text style={styles.headerTitle}>Prayer Journal</Text>
        </View>
        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>
            {totalPrayers} {totalPrayers === 1 ? 'PRAYER' : 'PRAYERS'}
          </Text>
        </View>
      </View>
      {/* Prayer Type Dropdown */}
      <View style={styles.dropdownContainer}>
        <TouchableOpacity
          style={styles.dropdownHeader}
          onPress={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <Ionicons name={selectedType.icon} size={18} color={selectedType.color} style={styles.dropdownIcon} />
          <Text style={[styles.dropdownHeaderText, { color: selectedType.color }]}>
            {selectedType.displayName}
          </Text>
          <Ionicons
            name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.hopeWhite}
            style={styles.dropdownArrow}
          />
        </TouchableOpacity>

        {isDropdownOpen && (
          <View style={styles.dropdownList}>
            {PRAYER_TYPES.map(type => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.dropdownItem,
                  selectedType.key === type.key && styles.dropdownItemSelected,
                ]}
                onPress={() => {
                  setSelectedType(type);
                  setIsDropdownOpen(false);
                }}
              >
                <Ionicons name={type.icon} size={16} color={type.color} style={styles.dropdownItemIcon} />
                <Text style={styles.dropdownItemText}>{type.displayName}</Text>
                <Text style={[styles.dropdownItemDesc, { color: type.color }]}>{type.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      {/* Input Row */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={`Write your ${selectedType.displayName.toLowerCase()} prayer...`}
          placeholderTextColor={Colors.trustGrey}
          value={prayerText}
          onChangeText={setPrayerText}
          multiline
          textAlignVertical="top"
          scrollEnabled={true}
          autoCapitalize="sentences"
          keyboardAppearance="dark"
          textBreakStrategy="simple"
          underlineColorAndroid="transparent"
          autoCorrect={true}
        />
        <TouchableOpacity
          style={[styles.checkButton, (!prayerText.trim() || isSubmitting) && styles.disabledButton]}
          onPress={handleAddPrayer}
          disabled={!prayerText.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={Colors.hopeWhite} />
          ) : (
            <Ionicons
              name="checkmark-circle"
              size={34}
              color={(!prayerText.trim() || isSubmitting) ? 'rgba(255, 255, 255, 0.5)' : Colors.hopeWhite}
            />
          )}
        </TouchableOpacity>
      </View>
      {/* Render Prayer Cards in specific order */}
      {PRAYER_TYPES.map(prayerType => {
        const prayerList = prayersByType[prayerType.key] || [];
        if (prayerList.length === 0) {return null;}

        return (
          <View key={prayerType.key} style={styles.prayerGroupCard}>
            <View style={styles.prayerGroupHeader}>
              <View style={styles.prayerTypeBadge}>
                <Text style={styles.prayerGroupTitle}>
                  {prayerType.label}
                </Text>
              </View>
            </View>
            {/* Answered prayers counter badge */}
            {prayerType.key === 'supplication' && (
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>
                  {prayerList.filter(p => p.status === 'answered').length}/{prayerList.length}
                </Text>
              </View>
            )}
            {prayerList.map((prayer) => (
              <View key={prayer.id} style={styles.prayerItem}>
                <Text style={styles.prayerText}>{prayer.content}</Text>
                {prayer.journal_category === 'supplication' && (
                  <TouchableOpacity
                    style={[styles.pendingPill, prayer.status === 'answered' && styles.answeredPill]}
                    onPress={() => handleToggleAnswered(prayer.id)}
                  >
                    {prayer.status === 'answered' ? (
                      <View style={styles.answeredContainer}>
                        <Ionicons name="checkmark-circle" size={14} color="#065F46" style={styles.pillIcon} />
                        <Text style={styles.answeredText}>
                          Answered: {formatDate(prayer.answered_date || '')}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.waitingContainer}>
                        <Ionicons name="time-outline" size={14} color={Colors.hopeWhite} style={styles.pillIcon} />
                        <Text style={styles.pendingText}>Waiting</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        );
      })}
    </View>
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
    marginRight: 10, // Slightly increased margin for better spacing
    marginLeft: 2,   // Small adjustment to align with content
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
  // Dropdown Styles
  dropdownContainer: {
    marginBottom: 12,
    position: 'relative',
    zIndex: 10,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dropdownIcon: {
    marginRight: 10,
  },
  dropdownHeaderText: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.anchorBlue,
  },
  dropdownArrow: {
    marginLeft: 8,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  dropdownItemIcon: {
    marginRight: 12,
    width: 24,
    textAlign: 'center',
    color: Colors.anchorBlue, // Standard color for all icons
  },
  dropdownItemText: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.anchorBlue, // Standard color for all text
    marginRight: 8,
  },
  dropdownItemDesc: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.anchorBlue, // Standard color for all text
    opacity: 0.8,
    marginLeft: 'auto',
  },
  inputContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    color: Colors.hopeWhite,
    fontSize: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    paddingRight: 60, // Space for check button
    minHeight: 150,
    maxHeight: 300,
    textAlignVertical: 'top',
    fontFamily: Fonts.regular,
    lineHeight: 24,
    ...Platform.select({
      android: {
        textAlignVertical: 'top',
        paddingTop: 12,
      },
      ios: {
        paddingTop: 8,
      },
    }),
  },
  checkButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    zIndex: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
  prayerGroupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.anchorBlue,
  },
  prayerGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
  },
  prayerTypeBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: 12,
    padding: 6,
    marginRight: 8,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Colors.hopeWhite,
  },
  prayerGroupTitle: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
  },
  prayerTag: {
    backgroundColor: Colors.anchorBlue,
    color: Colors.hopeWhite,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
    fontFamily: Fonts.bold,
    fontSize: 12,
    letterSpacing: 1.1,
    overflow: 'hidden',
  },
  prayerItem: {
    backgroundColor: 'rgba(26, 60, 109, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    minHeight: 80, // Ensure consistent height for items with/without status
  },
  prayerText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 24,
    marginRight: 8,
    paddingRight: 80, // Add padding to prevent text from going under the status
    paddingBottom: 24, // Add space for the status at the bottom
    fontFamily: Fonts.regular,
    letterSpacing: 0.2,
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  answeredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(209, 250, 229, 0.2)',
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 12,
    marginTop: 4, // Added space above the status
    alignSelf: 'flex-start', // Better alignment with text
  },
  pendingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginRight: 4,
    letterSpacing: 0.2,
  },
  answeredText: {
    color: Colors.success,
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  pillIcon: {
    marginLeft: 0,
    marginRight: 4,
  },
  answeredContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  counterBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 1,
  },
  counterText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
});

export default PrayerJournalCard;
