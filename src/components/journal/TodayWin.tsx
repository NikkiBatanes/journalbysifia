import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface WinEntry {
  id: string;
  text: string;
  date: Date;
}

export const TodayWin: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [win, setWin] = useState<WinEntry | null>(null);
  const [winText, setWinText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const saveWin = () => {
    if (winText.trim()) {
      setWin({
        id: Date.now().toString(),
        text: winText,
        date: new Date(),
      });
      setWinText('');
      setIsEditing(false);
    }
  };

  const removeWin = () => {
    setWin(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <JournalCard
      icon="trophy-outline"
      title="Today's Win"
      subtitle="Celebrate your daily victory"
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      showAddButton={!win && !isEditing}
      onAdd={() => setIsEditing(true)}
    >
      {win ? (
        <View style={styles.winContainer}>
          <View style={styles.winContent}>
            <Text style={styles.winText}>{win.text}</Text>
            <Text style={styles.winTime}>{formatDate(win.date)}</Text>
          </View>
          <TouchableOpacity
            onPress={removeWin}
            style={styles.editButton}
          >
            <Ionicons name="create-outline" size={20} color={Colors.mediumGray} />
          </TouchableOpacity>
        </View>
      ) : isEditing ? (
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
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                setIsEditing(false);
                setWinText('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, !winText.trim() && styles.disabledButton]}
              onPress={saveWin}
              disabled={!winText.trim()}
            >
              <Text style={styles.saveButtonText}>Save Win</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.emptyText}>What's your win for today?</Text>
      )}
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  winContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
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
    padding: 4,
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
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: Colors.mediumGray,
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
