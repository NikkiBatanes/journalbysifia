import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { NotebookPen as LuNotebookPen, X, Check } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useReflectionData,
  useCreateReflection,
  useUpdateReflection,
  useDeleteReflection,
} from '../../services/hooks/useReflectionData';

type ViewMode = 'free' | 'guided';

export const GUIDED_PROMPTS = [
  "How did I seek God's guidance in my decisions today?",
  "Did I reflect Christ's love in my interactions?",
  'What challenged my faith, and how did I respond?',
  'Am I prioritizing daily prayer and Scripture reading?',
  "How am I using my talents and resources for God's glory?",
  'What habit or sin is hindering me, and how can I address it?',
  'Did I show forgiveness or grace to someone today?',
  'Am I serving others in my church or community?',
  "Is my career or business aligned with God's values?",
  'How am I managing stress to protect my mental health?',
  "What's one step I can take to improve my physical health?",
  'Am I trusting God with my work or financial concerns?',
  'How can I pursue excellence in my work to honor God?',
  "Am I encouraging others' faith or well-being this week?",
  "What's one way I can grow in a practical skill to reflect God's excellence?",
  'Am I allowing comparison to steal my joy and gratitude for what God has given me?',
];

interface ReflectionLogEntry {
  id: string;
  title: string;
  content: string;
  type: ViewMode;
  source?: 'devotional';
  prompt?: string;
  tags: string[];
  location?: string;
  devotionalTitle?: string;
  dayNumber?: number;
  dayTitle?: string;
  totalDays?: number;
  questionNumber?: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  selected_date: string;
}

interface ReflectionLogProps {
  selectedDate?: Date;
  refreshKey?: number;
}

export const ReflectionLogReactQuery: React.FC<ReflectionLogProps> = ({ selectedDate = new Date() }) => {
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // React Query hooks
  const { data: reflectionEntries = [], isLoading, error } = useReflectionData(user?.id || '', dateStr);
  const createMutation = useCreateReflection();
  const updateMutation = useUpdateReflection();
  const deleteMutation = useDeleteReflection();

  // Transform API data to local format
  const entries: ReflectionLogEntry[] = reflectionEntries.map(entry => ({
    id: entry.id,
    title: entry.title,
    content: entry.content,
    type: entry.type,
    source: entry.source,
    prompt: entry.question_text,
    tags: [], // Tags would need to be parsed from content or stored separately
    location: undefined,
    devotionalTitle: entry.devotional_title,
    dayNumber: entry.day_number,
    dayTitle: entry.day_title,
    totalDays: entry.total_days,
    questionNumber: entry.question_number,
    user_id: entry.user_id,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    selected_date: entry.selected_date,
  }));

  // Local state
  const [visibleCount, setVisibleCount] = useState(3);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<ReflectionLogEntry | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
    type: 'free' as ViewMode,
    prompt: '',
    tags: [] as string[],
    location: '',
  });

  const resetForm = () => {
    setNewEntry({
      title: '',
      content: '',
      type: 'free',
      prompt: '',
      tags: [],
      location: '',
    });
    setSelectedPrompt('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSaveEntry = async () => {
    if (!user) {return;}

    if (!newEntry.title.trim() || !newEntry.content.trim()) {
      Alert.alert('Error', 'Please fill in both title and content.');
      return;
    }

    try {
      const entryData = {
        user_id: user.id,
        selected_date: dateStr,
        title: newEntry.title.trim(),
        content: newEntry.content.trim(),
        type: newEntry.type,
        question_text: newEntry.type === 'guided' ? newEntry.prompt : undefined,
      };

      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          updates: entryData,
        });
      } else {
        await createMutation.mutateAsync(entryData);
      }

      resetForm();
    } catch (saveError) {
      console.error('Error saving reflection entry:', saveError);
      Alert.alert('Error', 'Failed to save reflection entry. Please try again.');
    }
  };

  const handleEditEntry = (entry: ReflectionLogEntry) => {
    setNewEntry({
      title: entry.title,
      content: entry.content,
      type: entry.type,
      prompt: entry.prompt || '',
      tags: entry.tags,
      location: entry.location || '',
    });
    setSelectedPrompt(entry.prompt || '');
    setEditingId(entry.id);
    setIsAdding(true);
  };

  const handleDeleteEntry = async (entryId: string) => {
    Alert.alert(
      'Delete Reflection',
      'Are you sure you want to delete this reflection entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(entryId);
            } catch (deleteError) {
              Alert.alert('Error', 'Failed to delete reflection entry');
            }
          },
        },
      ]
    );
  };

  const handleEntryPress = (entry: ReflectionLogEntry) => {
    setSelectedEntry(entry);
    setShowEntryModal(true);
  };

  const startAdding = () => {
    resetForm();
    setIsAdding(true);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderPromptPicker = () => (
    <Modal
      visible={showPromptPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowPromptPicker(false)}
    >
      <View style={styles.promptModalContainer}>
        <View style={styles.promptModalContent}>
          <View style={styles.promptModalHeader}>
            <Text style={styles.promptModalTitle}>Select a Prompt</Text>
            <TouchableOpacity onPress={() => setShowPromptPicker(false)}>
              <X size={24} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.promptList}>
            {GUIDED_PROMPTS.map((prompt, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.promptOption,
                  selectedPrompt === prompt && styles.selectedPromptOption,
                ]}
                onPress={() => {
                  setSelectedPrompt(prompt);
                  setNewEntry(prev => ({ ...prev, prompt }));
                  setShowPromptPicker(false);
                }}
              >
                <Text style={styles.promptOptionText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderEntryCard = (entry: ReflectionLogEntry) => (
    <TouchableOpacity
      key={entry.id}
      style={styles.entryCard}
      onPress={() => handleEntryPress(entry)}
      activeOpacity={0.8}
    >
      <View style={styles.entryHeader}>
        <Text style={styles.entryTitle} numberOfLines={1}>
          {entry.title}
        </Text>
        <View style={styles.entryActions}>
          <TouchableOpacity
            onPress={() => handleEditEntry(entry)}
            style={styles.actionButton}
          >
            <Ionicons name="pencil" size={14} color={Colors.anchorBlue} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteEntry(entry.id)}
            style={styles.actionButton}
          >
            <Ionicons name="trash" size={14} color={Colors.alertCoral} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.entryContent} numberOfLines={2}>
        {entry.content}
      </Text>

      <View style={styles.entryMeta}>
        <Text style={styles.entryType}>
          {entry.type === 'guided' ? 'Guided' : 'Free-form'}
        </Text>
        <Text style={styles.entryDate}>
          {formatDate(entry.created_at)}
        </Text>
      </View>

      {entry.prompt && (
        <Text style={styles.entryPrompt} numberOfLines={1}>
          Prompt: {entry.prompt}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderEntryForm = () => (
    <View style={styles.addForm}>
      {/* Type selector */}
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            newEntry.type === 'free' && styles.typeButtonActive,
          ]}
          onPress={() => setNewEntry(prev => ({ ...prev, type: 'free' }))}
        >
          <Text style={[
            styles.typeButtonText,
            newEntry.type === 'free' && styles.typeButtonTextActive,
          ]}>
            Free-form
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeButton,
            newEntry.type === 'guided' && styles.typeButtonActive,
          ]}
          onPress={() => setNewEntry(prev => ({ ...prev, type: 'guided' }))}
        >
          <Text style={[
            styles.typeButtonText,
            newEntry.type === 'guided' && styles.typeButtonTextActive,
          ]}>
            Guided
          </Text>
        </TouchableOpacity>
      </View>

      {/* Prompt selector for guided type */}
      {newEntry.type === 'guided' && (
        <View style={styles.promptSelector}>
          <Text style={styles.promptLabel}>Reflection Prompt</Text>
          <TouchableOpacity
            style={styles.pickerContainer}
            onPress={() => setShowPromptPicker(true)}
          >
            <Text style={[
              styles.selectedPrompt,
              !selectedPrompt && styles.placeholderText,
            ]}>
              {selectedPrompt || 'Select a prompt...'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.mediumGray} />
          </TouchableOpacity>
        </View>
      )}

      {/* Title input */}
      <TextInput
        style={styles.input}
        value={newEntry.title}
        onChangeText={(text) => setNewEntry(prev => ({ ...prev, title: text }))}
        placeholder="Reflection title"
        placeholderTextColor={Colors.mediumGray}
        autoFocus
      />

      {/* Content input */}
      <TextInput
        style={[styles.input, styles.contentInput]}
        value={newEntry.content}
        onChangeText={(text) => setNewEntry(prev => ({ ...prev, content: text }))}
        placeholder={newEntry.type === 'guided' ? 'Write your reflection...' : 'What\'s on your mind?'}
        placeholderTextColor={Colors.mediumGray}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      {/* Action buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          onPress={resetForm}
          style={[styles.button, styles.cancelButton]}
        >
          <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSaveEntry}
          style={[
            styles.button,
            styles.saveButton,
            (createMutation.isPending || updateMutation.isPending) && styles.disabledButton,
          ]}
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEntryModal = () => (
    <Modal
      visible={showEntryModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowEntryModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedEntry?.title}</Text>
            <TouchableOpacity onPress={() => setShowEntryModal(false)}>
              <X size={24} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {selectedEntry?.prompt && (
              <View style={styles.promptContainer}>
                <Text style={styles.promptText}>"{selectedEntry.prompt}"</Text>
              </View>
            )}

            <Text style={styles.modalContentText}>
              {selectedEntry?.content}
            </Text>

            <View style={styles.modalMeta}>
              <Text style={styles.modalMetaText}>
                {selectedEntry?.type === 'guided' ? 'Guided Reflection' : 'Free-form Reflection'}
              </Text>
              <Text style={styles.modalMetaText}>
                {selectedEntry && formatDate(selectedEntry.created_at)}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  React.useEffect(() => {
    if (error) {
      Alert.alert('Error', 'Failed to load reflection entries.');
    }
  }, [error]);

  if (isLoading) {
    return (
      <JournalCard
        icon={<LuNotebookPen size={24} color={Colors.anchorBlue} strokeWidth={2.5} />}
        title="Reflection Log"
        subtitle="Capture your thoughts and insights"
        showAddButton={false}
        onAdd={() => {}}
        isAdding={false}
      >
        <Text style={styles.loadingText}>Loading reflections...</Text>
      </JournalCard>
    );
  }

  return (
    <JournalCard
      icon={<LuNotebookPen size={24} color={Colors.anchorBlue} strokeWidth={2.5} />}
      title="Reflection Log"
      subtitle="Capture your thoughts and insights"
      showAddButton={!isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
    >
      {entries.length > 0 ? (
        <View>
          {entries.slice(0, visibleCount).map(renderEntryCard)}
          {entries.length > visibleCount && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setVisibleCount(prev => prev + 3)}
            >
              <Text style={styles.showMoreText}>
                Show {Math.min(3, entries.length - visibleCount)} more
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        !isAdding && (
          <Text style={styles.emptyText}>
            No reflections yet. Tap the + button to start writing.
          </Text>
        )
      )}

      {isAdding && renderEntryForm()}
      {renderPromptPicker()}
      {renderEntryModal()}
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  loadingText: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 13,
    textAlign: 'center',
    padding: 16,
  },
  emptyText: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 16,
  },
  showMoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  showMoreText: {
    fontFamily: Fonts.medium,
    color: Colors.anchorBlue,
    fontSize: 13,
  },
  entryCard: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.alertCoral,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.darkGray,
    flex: 1,
    marginRight: 8,
  },
  entryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  entryContent: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.darkGray,
    lineHeight: 18,
    marginBottom: 8,
  },
  entryMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryType: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.anchorBlue,
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  entryDate: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.mediumGray,
  },
  entryPrompt: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.mediumGray,
    fontStyle: 'italic',
    marginTop: 4,
  },
  addForm: {
    marginTop: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    padding: 2,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: Colors.hopeWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeButtonText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.mediumGray,
  },
  typeButtonTextActive: {
    color: Colors.darkGray,
  },
  promptSelector: {
    marginBottom: 16,
  },
  promptLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.darkGray,
    marginBottom: 8,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
  },
  selectedPrompt: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
    marginRight: 8,
  },
  placeholderText: {
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  input: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    minHeight: 40,
  },
  contentInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
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
  cancelButton: {
    backgroundColor: Colors.mediumGray,
  },
  disabledButton: {
    opacity: 0.5,
  },
  promptModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  promptModalContent: {
    backgroundColor: Colors.hopeWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    padding: 16,
  },
  promptModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  promptModalTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.darkGray,
  },
  promptList: {
    maxHeight: 400,
  },
  promptOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  selectedPromptOption: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  promptOptionText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  modalTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.darkGray,
    flex: 1,
    marginRight: 8,
  },
  modalBody: {
    flex: 1,
  },
  promptContainer: {
    backgroundColor: 'rgba(26, 60, 109, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  promptText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.anchorBlue,
    fontStyle: 'italic',
  },
  modalContentText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  modalMetaText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
  },
});
