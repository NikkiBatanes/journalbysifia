import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface GratitudeItem {
  id: string;
  text: string;
  date: Date;
}

export const GratitudeList: React.FC = () => {
  const [isAdding, setIsAdding] = useState(false);
  const [gratitudeItems, setGratitudeItems] = useState<GratitudeItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const MAX_ITEMS = 10;

  const startAdding = () => {
    setIsAdding(true);
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setNewItem('');
  };

  const addGratitudeItem = () => {
    if (newItem.trim() && gratitudeItems.length < MAX_ITEMS) {
      setGratitudeItems([...gratitudeItems, {
        id: Date.now().toString(),
        text: newItem,
        date: new Date(),
      }]);
      setNewItem('');
      setIsAdding(false);
    }
  };

  const removeGratitudeItem = (id: string) => {
    setGratitudeItems(gratitudeItems.filter(item => item.id !== id));
  };

  const updateGratitudeItem = (id: string, text: string) => {
    setGratitudeItems(gratitudeItems.map(item =>
      item.id === id ? { ...item, text } : item
    ));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <JournalCard
      icon="heart-circle-outline"
      title="Gratitude List"
      subtitle="Reflect on what you're thankful for"
      showAddButton={!isAdding && gratitudeItems.length < MAX_ITEMS}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
    >
      {gratitudeItems.length > 0 ? (
        <ScrollView style={styles.itemsContainer}>
          {gratitudeItems.map((item, index) => (
            <View key={item.id} style={styles.gratitudeItem}>
              <View style={styles.itemNumber}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
              <TextInput
                style={styles.itemInput}
                value={item.text}
                onChangeText={(text) => updateGratitudeItem(item.id, text)}
                placeholder="I'm grateful for..."
                placeholderTextColor={Colors.mediumGray}
                multiline
              />
              <TouchableOpacity
                onPress={() => removeGratitudeItem(item.id)}
                style={styles.removeButton}
              >
                <Ionicons name="close" size={20} color={Colors.mediumGray} />
              </TouchableOpacity>
              <Text style={styles.timeText}>{formatDate(item.date)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : isAdding && gratitudeItems.length < MAX_ITEMS ? (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newItem}
            onChangeText={setNewItem}
            placeholder="I'm grateful for..."
            placeholderTextColor={Colors.mediumGray}
            onSubmitEditing={addGratitudeItem}
            returnKeyType="done"
          />
          <Text style={styles.hintText}>
            {gratitudeItems.length < 3
              ? `Add ${3 - gratitudeItems.length} more to complete your gratitude practice`
              : `You can add up to ${MAX_ITEMS} items`}
          </Text>
        </View>
      ) : null}

    </JournalCard>
  );
};

const styles = StyleSheet.create({
  itemsContainer: {
    maxHeight: 200,
    marginBottom: 8,
  },
  gratitudeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    position: 'relative',
  },
  itemNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  numberText: {
    color: Colors.alertCoral,
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  itemInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    paddingRight: 30,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  timeText: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    fontSize: 10,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
  },
  emptyText: {
    display: 'none',
  },
  inputContainer: {
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    marginBottom: 4,
  },
  hintText: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: Colors.mediumGray,
    textAlign: 'right',
    marginBottom: 4,
  },
});
