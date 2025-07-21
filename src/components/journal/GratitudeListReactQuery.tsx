// src/components/journal/GratitudeListReactQuery.tsx
// Example migration of GratitudeList to React Query
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useGratitudeData, useCreateJournalEntry, useDeleteJournalEntry } from '../../services/hooks/useJournalData';
import { Colors } from '../../theme/colors';
import { FontSizes, Spacing } from '../../theme/styles';

interface GratitudeListReactQueryProps {
  selectedDate: Date;
}

export default function GratitudeListReactQuery({ selectedDate }: GratitudeListReactQueryProps) {
  const { user } = useAuth();
  const [newGratitude, setNewGratitude] = React.useState('');
  const [isAddingGratitude, setIsAddingGratitude] = React.useState(false);

  // Format date for API
  const dateStr = selectedDate.toISOString().split('T')[0];

  // React Query hooks
  const {
    data: gratitudeEntries = [],
    isLoading,
    error,
    refetch,
    isFetching
  } = useGratitudeData(user?.id || '', dateStr);

  const createGratitudeMutation = useCreateJournalEntry();
  const deleteGratitudeMutation = useDeleteJournalEntry();

  // Add new gratitude entry
  const handleAddGratitude = async () => {
    if (!newGratitude.trim() || !user) return;

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



  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Gratitude</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load gratitude entries</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gratitude</Text>
        {isFetching && (
          <ActivityIndicator size="small" color={Colors.anchorBlue} />
        )}
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
                (!newGratitude.trim() || createGratitudeMutation.isPending) && styles.saveButtonDisabled
              ]}
              disabled={!newGratitude.trim() || createGratitudeMutation.isPending}
            >
              {createGratitudeMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.hopeWhite} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
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
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.lg,
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
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  loadingText: {
    marginLeft: Spacing.sm,
    color: Colors.anchorBlue,
    fontSize: FontSizes.sm,
  },
  errorContainer: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  errorText: {
    color: Colors.red,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.sm,
  },
  retryButton: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.hopeWhite,
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.gray,
    borderRadius: 8,
    padding: Spacing.md,
    backgroundColor: Colors.hopeWhite,
    fontSize: FontSizes.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
  },
  cancelButtonText: {
    color: Colors.gray,
    fontSize: FontSizes.sm,
  },
  saveButton: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: Colors.gray,
  },
  saveButtonText: {
    color: Colors.hopeWhite,
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  list: {
    maxHeight: 300,
  },
  gratitudeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.md,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  gratitudeText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.darkGray,
    lineHeight: 20,
  },
  deleteButton: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
  },
  deleteButtonText: {
    color: Colors.red,
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  emptyText: {
    color: Colors.gray,
    fontSize: FontSizes.sm,
    textAlign: 'center',
  },
});
