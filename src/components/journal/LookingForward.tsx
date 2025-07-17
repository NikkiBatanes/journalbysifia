import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil, X, Check, Sunrise as LuSunrise } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import {
  getJournalKey,
  saveLocalLookingForward,
  getLocalLookingForward,
  syncToCloud,
  syncFromCloud,
  getLocalEntry,
  deleteLocalEntry,
  deleteCloudEntry,
  LookingForwardEntry,
} from '../../storage/journalStorage';
import { toLocalDateString } from '../../utils/date';

interface LookingForwardLocalEntry {
  id: string;
  text: string;
  date: Date;
}

interface LookingForwardProps {
  selectedDate: Date;
}

export const LookingForward: React.FC<LookingForwardProps> = ({ selectedDate }) => {
  const { user } = useAuth();
  const [entry, setEntry] = useState<LookingForwardLocalEntry | null>(null);
  const [entryText, setEntryText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [_, setIsEditing] = useState(false);
  const [_loading, setLoading] = useState(false);
  const [_syncing, setSyncing] = useState(false);
  const hydratedRef = useRef(false);
  const swipeableRef = useRef<Swipeable>(null);

  const dateStr = toLocalDateString(selectedDate);
  const contentType = 'looking_forward';
  const key = getJournalKey(user?.id || '', contentType, dateStr);

  // Hydrate looking forward entry from storage
  const hydrateLookingForward = useCallback(async () => {
    if (!user || hydratedRef.current) {return;}

    setLoading(true);
    try {
      // Load from local storage first
      const localEntry = await getLocalLookingForward(key);
      if (localEntry) {
        setEntry(localEntry);
      }

      // Sync from cloud in background
      const cloudEntry = await syncFromCloud(user.id, dateStr, contentType);
      if (cloudEntry?.content?.entry) {
        setEntry(cloudEntry.content.entry);
      }

      hydratedRef.current = true;
    } catch (error) {
      console.error('Error hydrating looking forward entry:', error);
    } finally {
      setLoading(false);
    }
  }, [user, key, dateStr, contentType]);

  // Save looking forward entry to storage
  const saveLookingForwardToStorage = useCallback(async (entryData: LookingForwardLocalEntry | null) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save looking forward entry.');
      return;
    }

    console.log('🌅 LookingForward: Saving to storage...', { entryData, user: user.id, dateStr, key });
    setSyncing(true);
    try {
      if (!entryData) {
        // Handle deletion
        console.log('🌅 LookingForward: Deleting entry');
        const localEntry = await getLocalEntry(key);
        if (localEntry) {
          await deleteLocalEntry(key);
          if (localEntry.id) {
            await deleteCloudEntry(user.id, localEntry.id);
          }
        }
      } else {
        // Save the entry
        const lookingForwardEntry: LookingForwardEntry = {
          ...entryData,
          date: selectedDate,
        };

        console.log('🌅 LookingForward: Saving local entry:', lookingForwardEntry);
        await saveLocalLookingForward(key, lookingForwardEntry, user.id);

        console.log('🌅 LookingForward: Starting cloud sync...');
        // Sync to cloud in background
        syncToCloud(user.id, dateStr, contentType).catch(error => {
          console.error('🌅 LookingForward: Background sync failed:', error);
        });
      }
    } catch (error) {
      console.error('🌅 LookingForward: Error saving:', error);
      Alert.alert('Error', 'Failed to save looking forward entry. Please try again.');
    } finally {
      setSyncing(false);
    }
  }, [user, key, dateStr, contentType, selectedDate]);

  const closeSwipeable = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const renderRightActions = (progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    });

    const opacity = dragX.interpolate({
      inputRange: [-100, -20, 0],
      outputRange: [1, 0.9, 0],
      extrapolate: 'clamp',
    });

    const handleDelete = () => {
      closeSwipeable();
      // Small delay to allow the swipeable to close before deleting
      setTimeout(() => {
        setEntry(null);
        saveLookingForwardToStorage(null);
      }, 200);
    };

    return (
      <Animated.View
        style={[
          styles.deleteButton,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleDelete}
          style={styles.deleteButtonContent}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={22} color="white" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const startAdding = () => {
    setIsAdding(true);
    setEntryText('');
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setIsEditing(false);
    setEntryText('');
  };

  const saveEntry = () => {
    if (entryText.trim()) {
      const newEntry = {
        id: entry?.id || Date.now().toString(),
        text: entryText,
        date: new Date(),
      };
      setEntry(newEntry);
      saveLookingForwardToStorage(newEntry);
      setEntryText('');
      setIsAdding(false);
      setIsEditing(false);
    }
  };

  const editEntry = () => {
    if (entry) {
      setEntryText(entry.text);
      setIsEditing(true);
      setIsAdding(true);
    }
  };

  // Hydrate data on mount
  useEffect(() => {
    hydrateLookingForward();
  }, [hydrateLookingForward]);

  // Reset hydration when user or date changes
  useEffect(() => {
    hydratedRef.current = false;
    setEntry(null);
    hydrateLookingForward();
  }, [user?.id, dateStr, hydrateLookingForward]);

  return (
    <JournalCard
      icon={
        <LuSunrise
          size={24}
          color={Colors.alertCoral}
          strokeWidth={2.5}
        />
      }
      title="Looking Forward To"
      subtitle="What are you excited about tomorrow?"
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
            <Text style={styles.entryText}>{entry.text}</Text>
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
                onPress={cancelAdding}
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
                disabled={!entryText.trim()}
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
    backgroundColor: '#f87171',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 10,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    marginLeft: -10,
  },
  deleteButtonContent: {
    width: 60,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyText: {
    display: 'none',
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
});
