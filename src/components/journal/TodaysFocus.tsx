import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { JournalCard } from './JournalCard';
import { Check, Target } from 'lucide-react-native';

interface PriorityItem {
  id: string;
  text: string;
  completed: boolean;
}

interface TodayFocusData {
  focus: string;
  priorities: PriorityItem[];
}

export const TodaysFocus: React.FC = () => {
  const [data, setData] = useState<TodayFocusData>({
    focus: '',
    priorities: [
      { id: '1', text: '', completed: false },
      { id: '2', text: '', completed: false },
      { id: '3', text: '', completed: false }
    ]
  });
  const [isEditing, setIsEditing] = useState(false);

  const toggleEditing = () => {
    setIsEditing(!isEditing);
  };

  const updateFocus = (text: string) => {
    setData(prev => ({ ...prev, focus: text }));
  };

  const updatePriority = (index: number, text: string) => {
    const newPriorities = [...data.priorities];
    newPriorities[index] = { ...newPriorities[index], text };
    setData(prev => ({ ...prev, priorities: newPriorities }));
  };

  const togglePriority = (index: number) => {
    const newPriorities = [...data.priorities];
    newPriorities[index] = { 
      ...newPriorities[index], 
      completed: !newPriorities[index].completed 
    };
    setData(prev => ({ ...prev, priorities: newPriorities }));
  };

  return (
    <JournalCard
      icon={
        <Target 
          size={24} 
          color={Colors.alertCoral} 
          strokeWidth={2.5}
        />
      }
      title="Today's Focus"
      subtitle="Set your focus and priorities for the day"
      showAddButton={!isEditing}
      onAdd={toggleEditing}
      isAdding={isEditing}
      onCancelAdd={toggleEditing}
    >
      {isEditing
        ? (
          <View style={styles.editContainer}>
            <Text style={[styles.sectionHeader, { marginBottom: 8 }]}>Today's Focus</Text>
            <TextInput
              style={[styles.input, styles.focusInput]}
              value={data.focus}
              onChangeText={updateFocus}
              placeholder="What's your main focus today?"
              placeholderTextColor={Colors.mediumGray}
              autoFocus
            />
            <Text style={[styles.sectionHeader, { marginTop: 24, marginBottom: 8 }]}>TOP PRIORITIES</Text>
            {[0, 1, 2].map((index) => (
              <View key={index} style={styles.priorityRow}>
                <Text style={styles.priorityNumber}>{index + 1}.</Text>
                <TextInput
                  style={[styles.input, styles.priorityInput]}
                  value={data.priorities[index].text}
                  onChangeText={(text) => updatePriority(index, text)}
                  placeholder={`Priority ${index + 1}`}
                  placeholderTextColor={Colors.mediumGray}
                  onSubmitEditing={toggleEditing}
                />
              </View>
            ))}
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.saveButton, (!data.focus.trim() && data.priorities.every(p => !p.text.trim())) && styles.disabledButton]}
                onPress={toggleEditing}
                disabled={!data.focus.trim() && data.priorities.every(p => !p.text.trim())}
              >
                <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
            </View>
          </View>
        )
        : (
          (data.focus.trim() || data.priorities.some(p => p.text.trim() !== ''))
            ? (
              <View style={styles.viewContainer}>
                {data.focus && <Text style={styles.focusText}>{data.focus}</Text>}
                <View style={styles.prioritiesList}>
                  {data.priorities.some(p => p.text.trim() !== '') && (
                    <Text style={styles.prioritiesTitle}>TOP PRIORITIES</Text>
                  )}
                  {data.priorities
                    .filter(p => p.text.trim() !== '')
                    .map((priority, index) => (
                      <TouchableOpacity 
                        key={priority.id} 
                        style={styles.priorityItem}
                        onPress={() => togglePriority(index)}
                      >
                        <View style={[styles.tickCircle, priority.completed && styles.tickCircleCompleted]}>
                          {priority.completed && (
                            <Check size={10} color={Colors.hopeWhite} strokeWidth={3.5} />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.priorityText,
                            priority.completed && styles.completedText
                          ]}>
                          {priority.text}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>
            )
            : null
        )
      }
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  // Container styles
  editContainer: {
    padding: 0,
  },
  viewContainer: {
    padding: 0,
  },
  prioritiesList: {
    marginTop: 8,
  },
  prioritiesContainer: {
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 8,
    padding: 12,
    backgroundColor: Colors.hopeWhite,
  },

  // Text styles
  label: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 8,
  },
  sectionHeader: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.anchorBlue,
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  focusText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 0,
    lineHeight: 20,
  },
  placeholderText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.mediumGray,
    fontStyle: 'italic',
    marginBottom: 8,
    textDecorationLine: 'none',
  },
  hintText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginTop: 8,
  },

  // Input styles
  input: {
    flex: 1,
    height: '100%',
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
    backgroundColor: 'transparent',
    padding: 12,
    marginBottom: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  focusInput: {
    fontSize: 16,
    marginBottom: 16,
  },
  
  // Priority item styles
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    padding: 0,
  },
  priorityBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.alertCoral,
    marginRight: 12,
  },
  priorityText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
    flex: 1,
  },
  priorityNumber: {
    fontFamily: Fonts.medium,
    fontSize: 16,
    color: Colors.mediumGray,
    width: 24,
  },
  priorityInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    marginLeft: 8,
    marginBottom: 8,
  },

  // Button styles
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
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  disabledButton: {
    opacity: 0.5,
  },
  removeButton: {
    padding: 4,
  },
  tickCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.trustGrey,
    backgroundColor: 'rgba(176, 184, 193, 0.1)', // 10% opacity of trustGrey
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tickCircleCompleted: {
    backgroundColor: Colors.growthGreen, // 20% opacity of growthGreen
    borderColor: Colors.growthGreen,
  },
  tickCircleText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 16,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: Colors.mediumGray,
    opacity: 0.7,
  },
  prioritiesTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.anchorBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    fontWeight: '600',
  },
});
