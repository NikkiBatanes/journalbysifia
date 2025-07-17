import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, X, Trophy as LuTrophy, Pencil } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import {
  getJournalKey,
  saveLocalTodayWin,
  getLocalTodayWin,
  syncToCloud,
  syncFromCloud,
  getLocalEntry,
  deleteLocalEntry,
  deleteCloudEntry,
  TodayWinEntry,
} from '../../storage/journalStorage';
import { toLocalDateString } from '../../utils/date';

interface WinEntry {
  id: string;
  text: string;
  date: Date;
}

interface TodayWinProps {
  selectedDate: Date;
}

export const TodayWin: React.FC<TodayWinProps> = ({ selectedDate }) => {
  const { user } = useAuth();
  const [win, setWin] = useState<WinEntry | null>(null);
  const [winText, setWinText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [previousWin, setPreviousWin] = useState<WinEntry | null>(null);
  const [_loading, setLoading] = useState(false);
  const [_syncing, setSyncing] = useState(false);
  const hydratedRef = useRef(false);
  const swipeableRef = useRef<Swipeable>(null);

  const dateStr = toLocalDateString(selectedDate);
  const contentType = 'today_win';
  const key = getJournalKey(user?.id || '', contentType, dateStr);

  // Hydrate today's win from storage
  const hydrateTodayWin = useCallback(async () => {
    if (!user || hydratedRef.current) {return;}

    setLoading(true);
    try {
      // Load from local storage first
      const localWin = await getLocalTodayWin(key);
      if (localWin) {
        setWin(localWin);
      }

      // Sync from cloud in background
      const cloudWin = await syncFromCloud(user.id, dateStr, contentType);
      if (cloudWin?.content?.win) {
        setWin(cloudWin.content.win);
      }

      hydratedRef.current = true;
    } catch (error) {
      console.error('Error hydrating today\'s win:', error);
    } finally {
      setLoading(false);
    }
  }, [user, key, dateStr, contentType]);

  // Save today's win to storage
  const saveTodayWinToStorage = useCallback(async (winEntry: WinEntry | null) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save today\'s win.');
      return;
    }

    console.log('🏆 TodayWin: Saving to storage...', { winEntry, user: user.id, dateStr, key });
    setSyncing(true);
    try {
      if (!winEntry) {
        // Handle deletion
        console.log('🏆 TodayWin: Deleting entry');
        const localEntry = await getLocalEntry(key);
        if (localEntry) {
          await deleteLocalEntry(key);
          if (localEntry.id) {
            await deleteCloudEntry(user.id, localEntry.id);
          }
        }
      } else {
        // Save the win
        const todayWinEntry: TodayWinEntry = {
          ...winEntry,
          date: selectedDate,
        };

        console.log('🏆 TodayWin: Saving local entry:', todayWinEntry);
        await saveLocalTodayWin(key, todayWinEntry, user.id);

        console.log('🏆 TodayWin: Starting cloud sync...');
        // Sync to cloud in background
        syncToCloud(user.id, dateStr, contentType).catch(error => {
          console.error('🏆 TodayWin: Background sync failed:', error);
        });
      }
    } catch (error) {
      console.error('🏆 TodayWin: Error saving:', error);
      Alert.alert('Error', 'Failed to save today\'s win. Please try again.');
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
        setWin(null);
        saveTodayWinToStorage(null);
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
    setWinText('');
  };

  const cancelAdding = () => {
    if (previousWin) {
      // Restore the previous win if we were editing
      setWin(previousWin);
      setPreviousWin(null);
    } else {
      // Clear the input if we were adding a new win
      setWinText('');
    }
    setIsAdding(false);
  };

  const saveWin = () => {
    if (winText.trim()) {
      const newWin = {
        id: Date.now().toString(),
        text: winText,
        date: new Date(),
      };
      setWin(newWin);
      saveTodayWinToStorage(newWin);
      setWinText('');
      setIsAdding(false);
      setPreviousWin(null); // Clear previous win after successful save
    }
  };

  const editWin = () => {
    if (win) {
      setPreviousWin(win);
      setWinText(win.text);
      setWin(null); // Clear the win state to show the edit form
      setIsAdding(true);
    }
  };

  // Hydrate data on mount
  useEffect(() => {
    hydrateTodayWin();
  }, [hydrateTodayWin]);

  // Reset hydration when user or date changes
  useEffect(() => {
    hydratedRef.current = false;
    setWin(null);
    hydrateTodayWin();
  }, [user?.id, dateStr, hydrateTodayWin]);

  return (
    <JournalCard
      icon={
        <LuTrophy
          size={24}
          color={Colors.alertCoral}
          strokeWidth={2.5}
        />
      }
      title="Today's Win"
      subtitle="Celebrate your daily victory"
      showAddButton={!win && !isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
      headerRight={
        win && !isAdding ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={editWin} style={styles.editButton}>
              <Pencil size={14} color={Colors.trustGrey} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        ) : null
      }
    >
      {win ? (
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
          <View style={styles.winContainer}>
            <View style={styles.winContent}>
              <Text style={styles.winText}>{win.text}</Text>
            </View>
          </View>
        </Swipeable>
      ) : isAdding ? (
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            value={winText}
            onChangeText={setWinText}
            placeholder="What's your win for today?"
            placeholderTextColor={Colors.mediumGray}
            multiline
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
                onPress={saveWin}
                style={[
                  styles.button,
                  styles.saveButton,
                  !winText.trim() && styles.disabledButton,
                ]}
                disabled={!winText.trim()}
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
  winContainer: {
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
  winContent: {
    flex: 1,
  },
  winText: {
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    lineHeight: 20,
  },
  editButton: {
    padding: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    padding: 0,
  },
  emptyText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginVertical: 8,
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
  // Button text styles are no longer needed as we're using icons
});
