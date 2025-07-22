import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useGratitudeData, useCreateJournalEntry, useDeleteJournalEntry } from '../../services/hooks/useJournalData';
import { Colors } from '../../theme/colors';


interface GratitudeListReactQueryProps {
  selectedDate: Date;
}

export default function GratitudeListReactQuery({ selectedDate }: GratitudeListReactQueryProps) {
  const { user } = useAuth();
  const [newGratitude, setNewGratitude] = React.useState('');
  const [isAddingGratitude, setIsAddingGratitude] = React.useState(false);

  // Format date for API
  const dateStr = selectedDate.toISOString().split('T')[0];

  // Get gratitude entries
  const { data: gratitudeEntries = [] } = useGratitudeData(user?.id || '', dateStr);

  const createGratitudeMutation = useCreateJournalEntry();
  const deleteGratitudeMutation = useDeleteJournalEntry();

  // Add new gratitude entry
  const handleAddGratitude = async () => {
    if (!newGratitude.trim() || !user) {return;}

    try {
      await createGratitudeMutation.mutateAsync({
        user_id: user.id,
        content_type: 'gratitude',
        content: newGratitude.trim(),
        selected_date: dateStr,
      });

      setNewGratitude('');
      setIsAddingGratitude(false);
    } catch (error) {
      console.error('Error adding gratitude:', error);
      Alert.alert('Error', 'Failed to add gratitude entry');
    }
  };

  // Delete gratitude entry
  const handleDeleteGratitude = async (id: string) => {
    try {
      await deleteGratitudeMutation.mutateAsync(id);
    } catch (error) {
      console.error('Error deleting gratitude:', error);
      Alert.alert('Error', 'Failed to delete gratitude entry');
    }
  };

  // Render gratitude item
  const renderGratitudeItem = ({ item }: { item: any }) => (
    <View style={styles.gratitudeItem}>
      <Text style={styles.gratitudeText}>{item.content}</Text>
      <TouchableOpacity
        onPress={() => handleDeleteGratitude(item.id)}
        style={styles.deleteButton}
        disabled={deleteGratitudeMutation.isPending}
      >
        <Text style={styles.deleteButtonText}>×</Text>
      </TouchableOpacity>
    </View>
  );





  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gratitude</Text>

        <TouchableOpacity
          onPress={() => setIsAddingGratitude(true)}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Add new gratitude input */}
      {isAddingGratitude && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="What are you grateful for today?"
            value={newGratitude}
            onChangeText={setNewGratitude}
            multiline
            autoFocus
          />
          <View style={styles.inputActions}>
            <TouchableOpacity
              onPress={() => {
                setIsAddingGratitude(false);
                setNewGratitude('');
              }}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAddGratitude}
              style={[
                styles.saveButton,
                (!newGratitude.trim() || createGratitudeMutation.isPending) && styles.saveButtonDisabled,
              ]}
              disabled={!newGratitude.trim() || createGratitudeMutation.isPending}
            >
              <Text style={styles.saveButtonText}>
                {createGratitudeMutation.isPending ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Gratitude list */}
      <FlatList
        data={gratitudeEntries}
        renderItem={renderGratitudeItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No gratitude entries yet. Tap + to add one!
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  list: {
    maxHeight: 300,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.anchorBlue,
  },
  addButton: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: 'bold',
  },

  inputContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.mediumGray,
    borderRadius: 8,
    padding: 16,
    backgroundColor: Colors.hopeWhite,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  cancelButtonText: {
    color: Colors.mediumGray,
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  gratitudeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#F7F7F7',
    borderRadius: 8,
    marginBottom: 8,
  },
  gratitudeText: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
  deleteButton: {
    marginLeft: 8,
    padding: 4,
  },
  deleteButtonText: {
    color: Colors.alertCoral,
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: Colors.mediumGray,
    fontSize: 14,
    textAlign: 'center',
  },
});
