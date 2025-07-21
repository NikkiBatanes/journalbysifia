import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { Check, X, Trophy as LuTrophy, Pencil } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';
import { 
  useTodayWinData, 
  useCreateTodayWinEntry, 
  useUpdateTodayWinEntry, 
  useDeleteTodayWinEntry 
} from '../../services/hooks/useJournalData';

interface WinEntry {
  id: string;
  text: string;
  date: Date;
}

interface TodayWinProps {
  selectedDate: Date;
}

export const TodayWinReactQuery: React.FC<TodayWinProps> = ({ selectedDate }) => {
  const { user } = useAuth();
  const [winText, setWinText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);

  const dateStr = toLocalDateString(selectedDate);
  
  // Reset state when date changes (prevents stale data)
  React.useEffect(() => {
    setWinText('');
    setIsAdding(false);
    setIsEditing(false);
    console.log('🏆 TodayWin: Resetting state for date:', dateStr);
  }, [dateStr]);
  const userId = user?.id || '';

  // React Query hooks
  const { data: entries = [], isLoading, error } = useTodayWinData(userId, dateStr);
  const createMutation = useCreateTodayWinEntry();
  const updateMutation = useUpdateTodayWinEntry();
  const deleteMutation = useDeleteTodayWinEntry();

  // Get the first entry (TodayWin typically has one entry)
  const entry = entries.length > 0 ? entries[0] : null;
  const win = entry ? {
    id: entry.id,
    text: (() => {
      try {
        const content = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
        return content?.win || '';
      } catch {
        return '';
      }
    })(),
    date: selectedDate
  } : null;

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
      inputRange: [-100, -50, 0],
      outputRange: [1, 0.8, 0],
      extrapolate: 'clamp',
    });

    const handleDelete = () => {
      if (!entry) return;
      
      Alert.alert(
        'Delete Win',
        'Are you sure you want to delete this win?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: () => {
              deleteMutation.mutate(entry.id);
              closeSwipeable();
            }
          },
        ]
      );
    };

    return (
      <Animated.View style={[styles.deleteButton, { opacity }]}>
        <TouchableOpacity
          style={styles.deleteButtonContent}
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <X size={20} color={Colors.hopeWhite} strokeWidth={2.5} />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const startAdding = () => {
    setIsAdding(true);
    setWinText('');
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setIsEditing(false);
    setWinText('');
  };

  const saveWin = () => {
    if (!winText.trim()) return;

    if (isEditing && entry) {
      // Update existing entry
      let updatedContent: any;
      try {
        updatedContent = typeof entry.content === 'string' 
          ? JSON.parse(entry.content) 
          : entry.content;
      } catch {
        updatedContent = {};
      }
      
      updatedContent.win = winText.trim();
      
      updateMutation.mutate({
        id: entry.id,
        updates: {
          content: JSON.stringify(updatedContent)
        }
      });
    } else {
      // Create new entry
      createMutation.mutate({
        user_id: userId,
        selected_date: dateStr,
        content: JSON.stringify({ win: winText.trim() })
      });
    }

    setIsAdding(false);
    setIsEditing(false);
    setWinText('');
  };

  const editWin = () => {
    if (!win) return;
    
    setWinText(win.text);
    setIsEditing(true);
    setIsAdding(true);
  };



  // Error state
  if (error) {
    return (
      <JournalCard
        title="Today's Win"
        subtitle="What's your biggest win today?"
        icon={<LuTrophy size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
        showAddButton={false}
        onAdd={startAdding}
        isAdding={isAdding}
        onCancelAdd={cancelAdding}
      >
        <View style={styles.winContainer}>
          <Text style={[styles.winText, { color: Colors.alertCoral }]}>
            Error loading win. Tap to retry.
          </Text>
        </View>
      </JournalCard>
    );
  }

  return (
    <JournalCard
      title="Today's Win"
      subtitle="What's your biggest win today?"
      icon={<LuTrophy size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
      showAddButton={!win && !isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
      headerRight={
        win && !isAdding ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={editWin} style={styles.headerButton}>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    padding: 0,
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
});
