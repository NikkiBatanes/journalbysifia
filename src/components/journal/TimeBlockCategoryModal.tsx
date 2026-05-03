import React, { useState, useMemo } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Modal, View, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';

import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import { TIMEBLOCK_CATEGORIES, TimeBlockCategory } from './TimeBlockCategories';
import { triggerLightHaptic, triggerSelectionHaptic } from '../../utils/haptics';

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
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

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
            <ThemedText weight="semiBold" style={styles.title}>Select Category</ThemedText>
            <TouchableOpacity onPress={() => { triggerLightHaptic(); onCancel(); }} style={styles.closeButton}>
              <ThemedText weight="medium" style={styles.closeButtonText}>Cancel</ThemedText>
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
                style={[styles.searchInput, { fontFamily: getFontFamily(fontKey, 'medium') }]}
                placeholder="Search categories..."
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                selectionColor={Colors.white}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => { triggerLightHaptic(); setSearchQuery(''); }}
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
                onPress={() => { triggerSelectionHaptic(); onSelect(category); }}
              >
                <View style={styles.categoryContent}>
                  <View style={[styles.categoryIconContainer, { backgroundColor: category.color }]}>
                    <Ionicons
                      name={category.icon as any}
                      size={18}
                      color={selectedCategory === category.name ? Colors.anchorBlue : Colors.hopeWhite}
                    />
                  </View>
                  <ThemedText
                    weight={selectedCategory === category.name ? 'semiBold' : 'medium'}
                    style={[
                      styles.categoryText,
                      // Keep selected text Hope White
                    ]}
                  >
                    {category.name}
                  </ThemedText>
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
    borderRadius: 30,
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
    color: Colors.hopeWhite,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 16,
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
    color: Colors.hopeWhite,
    flex: 1,
  },
  selectedCategoryText: {
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
