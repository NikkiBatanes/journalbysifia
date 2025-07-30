import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

export type TimeBlockCategory = {
  name: string;
  icon: string;
};

const CATEGORIES: TimeBlockCategory[] = [
  { name: 'Appointments', icon: 'calendar' },
  { name: 'Break Time', icon: 'cafe' },
  { name: 'Career Growth', icon: 'rocket' },
  { name: 'Church Activities', icon: 'people' },
  { name: 'Deep Work', icon: 'code-working' },
  { name: 'Events', icon: 'calendar-number' },
  { name: 'Family Time', icon: 'people-circle' },
  { name: 'Life Admin', icon: 'document-text' },
  { name: 'Mental Health', icon: 'heart' },
  { name: 'Ministry', icon: 'hand-left' },
  { name: 'Personal Growth', icon: 'person' },
  { name: 'Physical Health', icon: 'barbell' },
  { name: 'Projects', icon: 'folder' },
  { name: 'Quiet Time', icon: 'book' },
  { name: 'Recreation', icon: 'airplane' },
  { name: 'Sleep & Recovery', icon: 'moon' },
  { name: 'Work Meetings', icon: 'briefcase' },
  { name: 'Others', icon: 'ellipsis-horizontal' },
];

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
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Choose Category</Text>
          <FlatList
            data={CATEGORIES}
            keyExtractor={(item) => item.name}
            numColumns={3}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.categoryButton, selectedCategory === item.name && styles.selectedCategoryButton]}
                onPress={() => onSelect(item)}
                activeOpacity={0.8}
              >
                <Ionicons name={item.icon as any} size={28} color={Colors.anchorBlue} style={styles.icon} />
                <Text style={styles.categoryText}>{item.name}</Text>
                {selectedCategory === item.name && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.alertCoral} style={styles.checkIcon} />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.grid}
          />
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.36)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.anchorBlue,
    marginBottom: 18,
  },
  grid: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
  },
  categoryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F6FA',
    borderRadius: 14,
    margin: 7,
    padding: 12,
    width: 90,
    height: 90,
    position: 'relative',
  },
  selectedCategoryButton: {
    borderWidth: 2,
    borderColor: Colors.alertCoral,
    backgroundColor: '#FFF2ED',
  },
  icon: {
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 13,
    color: Colors.anchorBlue,
    fontWeight: '500',
    textAlign: 'center',
  },
  checkIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  cancelButton: {
    marginTop: 18,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: Colors.anchorBlue,
  },
  cancelText: {
    color: Colors.hopeWhite,
    fontWeight: '600',
    fontSize: 15,
  },
});

export default TimeBlockCategoryModal;
export { CATEGORIES as TIMEBLOCK_CATEGORIES };
