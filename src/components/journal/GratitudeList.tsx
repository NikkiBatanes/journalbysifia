import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, HandHeart as LuHandHeart, X } from 'lucide-react-native';

interface GratitudeItem {
  id: string;
  text: string;
  date: Date;
}

export const GratitudeList: React.FC = () => {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [gratitudeItems, setGratitudeItems] = useState<GratitudeItem[]>([]);
  const [newItems, setNewItems] = useState(['', '', '']); // Three input fields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [visibleCount, setVisibleCount] = useState<number>(5);
  const MAX_ITEMS = 10;

  const startAdding = () => {
    setIsAdding(true);
    setIsEditing(false);
  };
  
  const startEditing = () => {
    setIsEditing(true);
    setIsAdding(false);
    
    // Prepare edit fields with existing items and empty fields to make at least 3
    const editFields = [...gratitudeItems.map(item => item.text)];
    while (editFields.length < 3) {
      editFields.push('');
    }
    setNewItems(editFields);
    console.log('Edit mode started with fields:', editFields);
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setIsEditing(false);
    setNewItems(['', '', '']);
  };

  const addAnotherField = () => {
    if (newItems.length < MAX_ITEMS) {
      setNewItems([...newItems, '']);
    }
  };

  const handleNewItemChange = (index: number, value: string) => {
    const updatedItems = [...newItems];
    updatedItems[index] = value;
    setNewItems(updatedItems);
  };

  const saveGratitudeItems = () => {
    const validItems = newItems.filter(item => item.trim());
    
    if (validItems.length > 0) {
      if (isEditing) {
        // When editing, replace all items with the new ones
        const updatedItems = validItems.map((text, index) => {
          // If an existing item has this index, keep its ID and date but update text
          if (index < gratitudeItems.length) {
            return {
              ...gratitudeItems[index],
              text: text.trim()
            };
          } else {
            // This is a new item
            return {
              id: Date.now() + Math.random().toString() + index,
              text: text.trim(),
              date: new Date()
            };
          }
        });
        setGratitudeItems(updatedItems);
      } else {
        // When adding, append new items
        const itemsToAdd = validItems.map(text => ({
          id: Date.now() + Math.random().toString(),
          text: text.trim(),
          date: new Date(),
        }));

        if ((gratitudeItems.length + itemsToAdd.length) <= MAX_ITEMS) {
          setGratitudeItems([...gratitudeItems, ...itemsToAdd]);
        }
      }
      
      setNewItems(['', '', '']);
      setIsAdding(false);
      setIsEditing(false);
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

  const displayGratitudeList = () => {
    if (isAdding || isEditing || gratitudeItems.length === 0) return null;
    
    const visibleItems = gratitudeItems.slice(0, visibleCount);
    const hasMore = gratitudeItems.length > visibleCount;
    const showingAll = visibleCount >= gratitudeItems.length;

    return (
      <View style={styles.itemsContainer}>
        {visibleItems.map((item, index) => (
          <View key={item.id} style={styles.gratitudeItem}>
            <View style={styles.itemNumber}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </View>
            <Text style={[styles.itemText, { width: '100%' }]}>{item.text}</Text>
          </View>
        ))}
        {gratitudeItems.length > 5 && (
          <View style={styles.paginationContainer}>
            <View style={styles.paginationButtonGroup}>
              {!showingAll ? (
                <TouchableOpacity
                  onPress={() => setVisibleCount(prev => Math.min(prev + 5, gratitudeItems.length))}
                  style={[styles.paginationButton, styles.showMoreButton]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.paginationButtonText, styles.showMoreText]}>Show more</Text>
                  <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setVisibleCount(5)}
                  style={[styles.paginationButton, styles.showLessButton]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.paginationButtonText, styles.showLessText]}>Show less</Text>
                  <Ionicons name="chevron-up" size={12} color={Colors.mediumGray} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    );
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
      showAddButton={!isAdding && !isEditing && gratitudeItems.length < MAX_ITEMS}
      onAdd={gratitudeItems.length > 0 ? startEditing : startAdding}
      isAdding={isAdding || isEditing}
    >
      {displayGratitudeList()}
      {(isAdding || isEditing) ? (
        <View style={styles.inputContainer}>
          {isEditing ? (
            newItems.map((item, index) => (
              <TextInput
                key={index}
                style={[styles.input, index > 0 && { marginTop: 8 }]}
                value={item}
                onChangeText={(value) => handleNewItemChange(index, value)}
                placeholder="I'm grateful for..."
                placeholderTextColor={Colors.mediumGray}
                returnKeyType={index < newItems.length - 1 ? 'next' : 'done'}
                onSubmitEditing={index < newItems.length - 1 ? undefined : saveGratitudeItems}
              />
            ))
          ) : (
            <React.Fragment>
              {newItems.map((item, index) => (
                <TextInput
                  key={index}
                  style={[styles.input, index > 0 && { marginTop: 8 }]}
                  value={item}
                  onChangeText={(value) => handleNewItemChange(index, value)}
                  placeholder="I'm grateful for..."
                  placeholderTextColor={Colors.mediumGray}
                  returnKeyType={index < newItems.length - 1 ? 'next' : 'done'}
                  onSubmitEditing={index < newItems.length - 1 ? undefined : saveGratitudeItems}
                />
              ))}
            </React.Fragment>
          )}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={addAnotherField}
              style={[
                styles.button, 
                styles.addAnotherButton,
                (newItems.length >= MAX_ITEMS || 
                 (isEditing && newItems.length >= gratitudeItems.length + 3)) && 
                styles.disabledButton
              ]}
              activeOpacity={0.8}
              disabled={newItems.length >= MAX_ITEMS || (isEditing && newItems.length >= gratitudeItems.length + 3)}
            >
              <View style={styles.plusIcon}>
                <Ionicons name="add" size={16} color={Colors.alertCoral} />
              </View>
            </TouchableOpacity>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                onPress={cancelAdding}
                style={[styles.button, styles.cancelButton]}
                activeOpacity={0.8}
              >
                <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveGratitudeItems}
                style={[
                  styles.button,
                  styles.saveButton,
                  !newItems.some(item => item.trim()) && styles.disabledButton,
                ]}
                disabled={!newItems.some(item => item.trim())}
                activeOpacity={0.8}
              >
                <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

    </JournalCard>
  );
};

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
  },
  emptyText: {
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  itemsContainer: {
    marginTop: 8,
  },
  paginationContainer: {
    width: '100%',
    paddingVertical: 8,
  },
  paginationButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  paginationButtonText: {
    marginHorizontal: 2,
    fontSize: 12,
    fontFamily: Fonts.medium,
    lineHeight: 16,
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
    color: Colors.mediumGray,
  },
  gratitudeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    width: '100%',
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
  itemText: {
    color: Colors.darkGray,
    fontFamily: Fonts.regular,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  numberText: {
    color: Colors.alertCoral,
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  itemInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.darkGray,
    marginLeft: 8,
    padding: 0,
    fontFamily: Fonts.regular,
    paddingRight: 8,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  addAnotherButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.mediumGray,
  },
  closeIcon: {
    // Empty style to fix the lint error
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
