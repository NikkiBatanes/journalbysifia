import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check } from 'lucide-react-native';

interface WinEntry {
  id: string;
  text: string;
  date: Date;
}

export const TodayWin: React.FC = () => {
  const [win, setWin] = useState<WinEntry | null>(null);
  const [winText, setWinText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const startAdding = () => {
    setIsAdding(true);
    setWinText('');
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setWinText('');
  };

  const saveWin = () => {
    if (winText.trim()) {
      setWin({
        id: Date.now().toString(),
        text: winText,
        date: new Date(),
      });
      setWinText('');
      setIsAdding(false);
    }
  };

  const editWin = () => {
    if (win) {
      setWinText(win.text);
      setIsAdding(true);
    }
  };

  const removeWin = () => {
    setWin(null);
    setWinText('');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <JournalCard
      icon="trophy-outline"
      title="Today's Win"
      subtitle="Celebrate your daily victory"
      showAddButton={!win && !isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
    >
      {win ? (
        <View style={styles.winContainer}>
          <View style={styles.winContent}>
            <Text style={styles.winText}>{win.text}</Text>
            <Text style={styles.winTime}>{formatDate(win.date)}</Text>
          </View>
          <View style={styles.buttonGroup}>
            <TouchableOpacity onPress={editWin} style={styles.editButton}>
              <Ionicons name="create-outline" size={20} color={Colors.mediumGray} />
            </TouchableOpacity>
            <TouchableOpacity onPress={removeWin} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={20} color={Colors.alertCoral} />
            </TouchableOpacity>
          </View>
        </View>
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
            <TouchableOpacity
              onPress={cancelAdding}
              style={[styles.button, styles.cancelButton]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={saveWin}
              style={[styles.button, styles.saveButton]}
              disabled={!winText.trim()}
            >
              <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  winContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 0,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
  },
  winContent: {
    flex: 1,
    marginRight: 12,
  },
  winText: {
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  winTime: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 12,
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  buttonGroup: {
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    marginRight: 8,
    width: 'auto',
    height: 'auto',
    paddingHorizontal: 12,
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  disabledButton: {
    opacity: 0.5,
  },
  cancelButtonText: {
    color: Colors.darkGray,
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  saveButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
});
