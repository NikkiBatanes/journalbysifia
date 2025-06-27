import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, HandHeart as LuHandHeart } from 'lucide-react-native';

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
      icon={
        <LuHandHeart 
          size={24}
          color={Colors.alertCoral}
          strokeWidth={2.5}
        />
      }
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
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={addGratitudeItem}
              style={[
                styles.button,
                styles.saveButton,
                !newItem.trim() && styles.disabledButton,
              ]}
              disabled={!newItem.trim()}
            >
              <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
            </TouchableOpacity>
          </View>
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
    marginBottom: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 40,
    position: 'relative',
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
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
    flex: 1,
    height: 40,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.darkGray,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    padding: 0,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  disabledButton: {
    opacity: 0.5,
  },
  hintText: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: Colors.mediumGray,
    textAlign: 'right',
    marginBottom: 4,
  },
});
