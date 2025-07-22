import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { Pencil, X, Check, Sunrise as LuSunrise } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useLookingForwardData,
  useCreateLookingForwardEntry,
  useUpdateLookingForwardEntry,
  useDeleteLookingForwardEntry,
} from '../../services/hooks/useJournalData';

interface LookingForwardProps {
  selectedDate: Date;
}

export const LookingForwardReactQuery: React.FC<LookingForwardProps> = ({ selectedDate }) => {
  const { user } = useAuth();
  const [entryText, setEntryText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const swipeableRef = useRef<Swipeable>(null);

  const dateStr = toLocalDateString(selectedDate);

  // Reset state when date changes (prevents stale data)
  React.useEffect(() => {
    setEntryText('');
    setIsAdding(false);
    setEditingId(null);
    console.log('🌅 LookingForward: Resetting state for date:', dateStr);
  }, [dateStr]);

  // Get looking forward entries
  const { data: entries = [] } = useLookingForwardData(user?.id || '', dateStr);

  const createEntryMutation = useCreateLookingForwardEntry();
  const updateEntryMutation = useUpdateLookingForwardEntry();
  const deleteEntryMutation = useDeleteLookingForwardEntry();

  // Get the first entry (LookingForward typically has only one entry)
  const entry = entries.length > 0 ? entries[0] : null;

  const renderRightActions = (progress: any, dragX: any) => {
    const trans = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [0, 50, 100],
      extrapolate: 'clamp',
    });

    const handleDelete = () => {
      if (!entry) {return;}

      Alert.alert(
        'Delete Entry',
        'Are you sure you want to delete this entry?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteEntryMutation.mutate(entry.id);
            },
          },
        ]
      );
    };

    return (
      <View style={styles.deleteButton}>
        <Animated.View style={[styles.deleteButtonContent, { transform: [{ translateX: trans }] }]}>
          <TouchableOpacity
            onPress={handleDelete}
            style={styles.deleteButtonContent}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>
              Delete
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const startAdding = () => {
    setIsAdding(true);
    setEntryText('');
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setEntryText('');
  };

  const saveEntry = async () => {
    if (!entryText.trim() || !user) {return;}

    try {
      if (editingId) {
        // Update existing entry
        await updateEntryMutation.mutateAsync({
          id: editingId,
          updates: {
            content: JSON.stringify({ entry: { id: editingId, text: entryText.trim(), date: selectedDate } }),
          },
        });
        setEditingId(null);
      } else {
        // Create new entry
        await createEntryMutation.mutateAsync({
          user_id: user.id,
          selected_date: dateStr,
          content: JSON.stringify({
            entry: {
              id: `looking_forward_${Date.now()}`,
              text: entryText.trim(),
              date: selectedDate,
            },
          }),
        });
      }

      setIsAdding(false);
      setEntryText('');
    } catch (error) {
      console.error('Error saving looking forward entry:', error);
      Alert.alert('Error', 'Failed to save entry. Please try again.');
    }
  };

  const editEntry = () => {
    if (!entry) {return;}
    setEditingId(entry.id);
    const parsedContent = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
    setEntryText(parsedContent?.entry?.text || '');
    setIsAdding(true);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEntryText('');
    setIsAdding(false);
  };





  return (
    <JournalCard
      title="Looking Forward To"
      subtitle="What are you excited about tomorrow?"
      icon={<LuSunrise size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
      showAddButton={!entry && !isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
      headerRight={
        entry && !isAdding ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={editEntry} style={styles.headerButton}>
              <Pencil size={14} color={Colors.trustGrey} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        ) : null
      }
    >
      {entry && !isAdding ? (
        <Swipeable
          ref={swipeableRef}
          renderRightActions={renderRightActions}
          rightThreshold={20}
          containerStyle={styles.swipeableContainer}
          overshootRight={false}
          friction={3}
          enableTrackpadTwoFingerGesture
          onSwipeableWillOpen={() => {
            const { Vibration } = require('react-native');
            Vibration.vibrate(10);
          }}
        >
          <View style={styles.entryContainer}>
            <Text style={styles.entryText}>
              {(() => {
                const parsedContent = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
                return parsedContent?.entry?.text || '';
              })()}
            </Text>
          </View>
        </Swipeable>
      ) : isAdding ? (
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            value={entryText}
            onChangeText={setEntryText}
            placeholder="What are you looking forward to tomorrow?"
            placeholderTextColor={Colors.mediumGray}
            multiline
            autoFocus
          />
          <View style={styles.buttonRow}>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                onPress={editingId ? cancelEditing : cancelAdding}
                style={[styles.button, styles.cancelButton]}
                activeOpacity={0.8}
              >
                <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEntry}
                style={[
                  styles.button,
                  styles.saveButton,
                  !entryText.trim() && styles.disabledButton,
                ]}
                disabled={!entryText.trim() || createEntryMutation.isPending || updateEntryMutation.isPending}
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
  swipeableContainer: {
    marginBottom: 4,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f87171',
  },
  entryContainer: {
    backgroundColor: '#ebeef2',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 40,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 80,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 10,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    marginLeft: -10,
  },
  deleteButtonContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  entryText: {
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 4,
  },
  formContainer: {
    marginTop: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    padding: 0,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: Colors.mediumGray,
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  disabledButton: {
    opacity: 0.5,
  },
  retryButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: Colors.alertCoral,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
});
