import React, { useState, useMemo } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Modal, View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';

import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { TIMEBLOCK_CATEGORIES, TimeBlockCategory } from './TimeBlockCategories';

interface TimeBlockCategoryModalProps {
  visible: boolean;
  selectedCategory: string;
  onSelect: (category: TimeBlockCategory) => void;
  onCancel: () => void;
}

const TimeBlockCategoryModal: React.FC<TimeBlockCategoryModalProps> = ({
  visible,
  selectedCategory,
  onSelect,
  onCancel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter categories based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return TIMEBLOCK_CATEGORIES;
    }
    return TIMEBLOCK_CATEGORIES.filter(category =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Reset search when modal closes
  React.useEffect(() => {
    if (!visible) {
      setSearchQuery('');
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Category</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons
                name="search"
                size={16}
                color={Colors.hopeWhite}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search categories..."
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                >
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color="rgba(255, 255, 255, 0.6)"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <ScrollView
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {filteredCategories.map((category) => (
              <TouchableOpacity
                key={category.name}
                style={[
                  styles.categoryRow,
                  selectedCategory === category.name && styles.selectedCategoryRow,
                ]}
                onPress={() => onSelect(category)}
              >
                <View style={styles.categoryContent}>
                  <View style={[styles.categoryIconContainer, { backgroundColor: category.color }]}>
                    <Ionicons
                      name={category.icon as any}
                      size={18}
                      color={Colors.hopeWhite}
                    />
                  </View>
                  <Text style={[
                    styles.categoryText,
                    selectedCategory === category.name && styles.selectedCategoryText,
                  ]}>
                    {category.name}
                  </Text>
                </View>
                {selectedCategory === category.name && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={category.color}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.hopeWhite,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedCategoryRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryText: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.hopeWhite,
    flex: 1,
  },
  selectedCategoryText: {
    fontFamily: Fonts.bold,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.hopeWhite,
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default TimeBlockCategoryModal;
export { TIMEBLOCK_CATEGORIES };
