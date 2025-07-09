import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface PersonPrayer {
  id: string;
  name: string;
  prayer: string;
}

const PeoplePrayerList: React.FC = () => {
  const [name, setName] = useState('');
  const [prayer, setPrayer] = useState('');
  const [peoplePrayers, setPeoplePrayers] = useState<PersonPrayer[]>([]);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isPrayerFocused, setIsPrayerFocused] = useState(false);

  const handleAddPrayer = () => {
    if (name.trim() && prayer.trim()) {
      const newPrayer: PersonPrayer = {
        id: Date.now().toString(),
        name: name.trim(),
        prayer: prayer.trim(),
      };
      setPeoplePrayers(prev => [newPrayer, ...prev]);
      setName('');
      setPrayer('');
    }
  };



  return (
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

      {/* Name Input */}
      <View style={[styles.inputContainer, isNameFocused && styles.inputFocused]}>
        <TextInput
          style={styles.input}
          placeholder="Person's Name"
          placeholderTextColor={Colors.trustGrey}
          value={name}
          onChangeText={setName}
          onFocus={() => setIsNameFocused(true)}
          onBlur={() => setIsNameFocused(false)}
          autoCapitalize="words"
          keyboardAppearance="dark"
        />
      </View>

      {/* Prayer Input */}
      <View style={[styles.prayerInputContainer, isPrayerFocused && styles.inputFocused]}>
        <TextInput
          style={[styles.input, styles.prayerInput]}
          placeholder="Write your prayer for this person..."
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
        {peoplePrayers.map((item) => (
          <View key={item.id} style={styles.prayerItem}>
            <Text style={styles.personName}>{item.name}</Text>
            <Text style={styles.prayerText}>{item.prayer}</Text>
          </View>
        ))}
      </ScrollView>
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
  checkButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
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
  personName: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
    fontSize: 16,
    marginBottom: 4,
  },
  prayerText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.regular,
  },
});

export default PeoplePrayerList;
