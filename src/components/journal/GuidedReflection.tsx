import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, EyeClosed as LuEyeClosed } from 'lucide-react-native';

const REFLECTION_PROMPTS = [
  "How did I seek God's guidance in my decisions today?",
  "Did I reflect Christ's love in my interactions?",
  "What challenged my faith, and how did I respond?",
  "Am I prioritizing daily prayer and Scripture reading?",
  "How am I using my talents and resources for God's glory?",
  "What habit or sin is hindering me, and how can I address it?",
  "Did I show forgiveness or grace to someone today?",
  "Am I serving others in my church or community?",
  "Is my career or business aligned with God's values?",
  "How am I managing stress to protect my mental health?",
  "What's one step I can take to improve my physical health?",
  "Am I trusting God with my work or financial concerns?",
  "How can I pursue excellence in my work to honor God?",
  "Am I encouraging others' faith or well-being this week?",
  "What's one way I can grow in a practical skill to reflect God's excellence?",
];

interface Reflection {
  id: string;
  prompt: string;
  response: string;
  date: Date;
}

export const GuidedReflection: React.FC = () => {
  const [isAdding, setIsAdding] = useState(false);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState(REFLECTION_PROMPTS[0]);
  const [response, setResponse] = useState('');
  const [showPrompts, setShowPrompts] = useState(false);

  const startAdding = () => {
    setIsAdding(true);
    setSelectedPrompt(REFLECTION_PROMPTS[0]);
    setResponse('');
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setResponse('');
  };

  const addReflection = () => {
    if (response.trim()) {
      setReflections([...reflections, {
        id: Date.now().toString(),
        prompt: selectedPrompt,
        response,
        date: new Date(),
      }]);
      setIsAdding(false);
      setResponse('');
    }
  };

  const removeReflection = (id: string) => {
    setReflections(reflections.filter(reflection => reflection.id !== id));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <JournalCard
      icon={
        <LuEyeClosed
          size={24}
          color={Colors.alertCoral}
          strokeWidth={2.5}
        />
      }
      title="Guided Reflection"
      subtitle="Reflect with prompts"
      showAddButton={!isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
    >
      {reflections.length > 0 ? (
        <View style={styles.reflectionsContainer}>
          {reflections.map(reflection => (
            <View key={reflection.id} style={styles.reflectionItem}>
              <View style={styles.reflectionHeader}>
                <Text style={styles.reflectionPrompt}>{reflection.prompt}</Text>
                <TouchableOpacity onPress={() => removeReflection(reflection.id)}>
                  <Ionicons name="close" size={20} color={Colors.mediumGray} />
                </TouchableOpacity>
              </View>
              <Text style={styles.reflectionResponse}>{reflection.response}</Text>
              <Text style={styles.reflectionDate}>{formatDate(reflection.date)}</Text>
            </View>
          ))}
        </View>
      ) : isAdding ? (
        <View style={styles.formContainer}>
          <TouchableOpacity
            style={styles.promptSelector}
            onPress={() => setShowPrompts(!showPrompts)}
          >
            <Text style={styles.selectedPrompt} numberOfLines={1}>
              {selectedPrompt}
            </Text>
            <Ionicons
              name={showPrompts ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.mediumGray}
            />
          </TouchableOpacity>

          {showPrompts && (
            <View style={styles.promptsList}>
              {REFLECTION_PROMPTS.map((prompt, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.promptOption,
                    selectedPrompt === prompt && styles.selectedPromptOption,
                  ]}
                  onPress={() => {
                    setSelectedPrompt(prompt);
                    setShowPrompts(false);
                  }}
                >
                  <Text style={[
                    styles.promptText,
                    selectedPrompt === prompt && styles.selectedPromptText,
                  ]}>
                    {prompt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TextInput
            style={styles.input}
            value={response}
            onChangeText={setResponse}
            placeholder="Write your thoughts here..."
            placeholderTextColor={Colors.mediumGray}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, !response.trim() && styles.disabledButton]}
              onPress={addReflection}
              disabled={!response.trim()}
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
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
  reflectionsContainer: {
    marginBottom: 8,
  },
  reflectionItem: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.alertCoral,
  },
  reflectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reflectionPrompt: {
    flex: 1,
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
    fontSize: 14,
    marginRight: 8,
  },
  reflectionResponse: {
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  reflectionDate: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 12,
    textAlign: 'right',
  },
  emptyText: {
    display: 'none',
  },
  formContainer: {
    marginTop: 8,
  },
  promptSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    marginBottom: 8,
  },
  selectedPrompt: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    marginRight: 8,
  },
  promptsList: {
    maxHeight: 200,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    marginBottom: 12,
    overflow: 'hidden',
  },
  promptOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  selectedPromptOption: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  promptText: {
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    lineHeight: 20,
  },
  selectedPromptText: {
    color: Colors.alertCoral,
    fontFamily: Fonts.medium,
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
    fontSize: 14,
  },
});
