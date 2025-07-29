import React, { useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Keyboard, Alert, ActivityIndicator } from 'react-native';
import { Heart } from 'lucide-react-native';
import { Colors } from '../../theme/colors';

interface GratitudeLogEditorProps {
  onSave: (data: {
    items: string[];
    date: Date;
  }) => void;
  onCancel: () => void;
  initialItems?: string[];
  subtaskTitle?: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  isLoading?: boolean;
  styles?: any;
}

// Fallback styles in case styles prop is not provided
const defaultStyles = {
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  contentCard: {
    flex: 1,
    backgroundColor: 'rgba(26,60,109,0.08)',
    borderRadius: 12,
    margin: 16,
    padding: 16,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  gratitudeInput: {
    color: Colors.hopeWhite,
    fontSize: 16,
    marginBottom: 16,
    minHeight: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
  },
  gratitudeLabel: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.9,
  },
  gratitudeContainer: {
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: Colors.hopeWhite,
  },
  saveButtonText: {
    color: Colors.anchorBlue,
  },
  disabledButton: {
    opacity: 0.5,
  },
  metadataContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  metadataText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 4,
  },
  instructionText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  headerIcon: {
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
};

const GratitudeLogEditor: React.FC<GratitudeLogEditorProps> = ({
  onSave,
  onCancel,
  initialItems = ['', '', ''],
  subtaskTitle,
  playbookTitle,
  actionStepNumber,
  actionStepTitle,
  isLoading = false,
  styles,
}) => {
  const s = styles || defaultStyles;

  // State for gratitude items
  const [gratitudeItems, setGratitudeItems] = React.useState<string[]>(initialItems);
  const [hasUserMadeChanges, setHasUserMadeChanges] = React.useState(false);
  const [showDraftNotification, setShowDraftNotification] = React.useState(false);
  const [isFirstLoad, setIsFirstLoad] = React.useState(true);

  // Refs for inputs
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Draft key for auto-save
  const draftKey = `gratitude_draft_${new Date().toISOString().split('T')[0]}`;

  // Load draft on component mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem(draftKey);
        if (draft && isFirstLoad) {
          const parsedDraft = JSON.parse(draft);
          if (parsedDraft.items && parsedDraft.items.some((item: string) => item.trim())) {
            setGratitudeItems(parsedDraft.items);
            setShowDraftNotification(true);
            setTimeout(() => setShowDraftNotification(false), 3000);
          }
        }
      } catch (error) {
        console.error('Error loading gratitude draft:', error);
      } finally {
        setIsFirstLoad(false);
      }
    };

    loadDraft();
  }, [draftKey, isFirstLoad]);

  // Auto-save draft when items change
  useEffect(() => {
    if (!isFirstLoad && hasUserMadeChanges) {
      const saveDraft = async () => {
        try {
          await AsyncStorage.setItem(draftKey, JSON.stringify({ items: gratitudeItems }));
        } catch (error) {
          console.error('Error saving gratitude draft:', error);
        }
      };
      saveDraft();
    }
  }, [gratitudeItems, draftKey, isFirstLoad, hasUserMadeChanges]);

  // Clear draft on successful save
  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(draftKey);
    } catch (error) {
      console.error('Error clearing gratitude draft:', error);
    }
  };

  const handleItemChange = (index: number, text: string) => {
    const newItems = [...gratitudeItems];
    newItems[index] = text;
    setGratitudeItems(newItems);
    setHasUserMadeChanges(true);
  };

  const handleSave = async () => {
    const filledItems = gratitudeItems.filter(item => item.trim());

    if (filledItems.length === 0) {
      Alert.alert(
        'Empty Gratitude',
        'Please add at least one thing you\'re grateful for.',
        [{ text: 'OK' }]
      );
      return;
    }

    await clearDraft();
    onSave({
      items: gratitudeItems,
      date: new Date(),
    });
  };

  const handleCancel = () => {
    if (hasUserMadeChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: onCancel,
          },
        ]
      );
    } else {
      onCancel();
    }
  };

  const isFormValid = gratitudeItems.some(item => item.trim());

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <KeyboardAvoidingView
        style={s.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={s.header}>
          <View style={s.headerRow}>
            <Heart size={24} color={Colors.hopeWhite} style={s.headerIcon} />
            <Text style={s.title}>Gratitude Journal</Text>
          </View>

          {/* Metadata */}
          {(subtaskTitle || playbookTitle) && (
            <View style={s.metadataContainer}>
              {playbookTitle && (
                <Text style={s.metadataText}>
                  📖 {playbookTitle}
                </Text>
              )}
              {actionStepNumber && actionStepTitle && (
                <Text style={s.metadataText}>
                  🎯 Step {actionStepNumber}: {actionStepTitle}
                </Text>
              )}
              {subtaskTitle && (
                <Text style={s.metadataText}>
                  ✅ {subtaskTitle}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={s.contentCard}>
          <View style={s.content}>
            {showDraftNotification && (
              <View style={{
                backgroundColor: 'rgba(74, 144, 226, 0.2)',
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
                borderLeftWidth: 4,
                borderLeftColor: Colors.hopeWhite,
              }}>
                <Text style={{
                  color: Colors.hopeWhite,
                  fontSize: 14,
                  fontWeight: '500',
                }}>
                  📝 Draft restored
                </Text>
              </View>
            )}

            <Text style={s.instructionText}>
              What are you grateful for today? List three things below.
            </Text>

            <ScrollView style={s.scrollContent} showsVerticalScrollIndicator={false}>
              {gratitudeItems.map((item, index) => (
                <View key={index} style={s.gratitudeContainer}>
                  <Text style={s.gratitudeLabel}>
                    {index + 1}. I'm grateful for...
                  </Text>
                  <TextInput
                    ref={(ref) => { inputRefs.current[index] = ref; }}
                    style={s.gratitudeInput}
                    placeholder="Something you appreciate today"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={item}
                    onChangeText={(text) => handleItemChange(index, text)}
                    multiline
                    returnKeyType={index < 2 ? 'next' : 'done'}
                    onSubmitEditing={() => {
                      if (index < 2) {
                        inputRefs.current[index + 1]?.focus();
                      } else {
                        Keyboard.dismiss();
                      }
                    }}
                    blurOnSubmit={index === 2}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={s.buttonContainer}>
              <TouchableOpacity
                style={s.cancelButton}
                onPress={handleCancel}
                disabled={isLoading}
              >
                <Text style={[s.buttonText, s.cancelButtonText]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.saveButton,
                  (!isFormValid || isLoading) && s.disabledButton,
                ]}
                onPress={handleSave}
                disabled={!isFormValid || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.anchorBlue} size="small" />
                ) : (
                  <Text style={[s.buttonText, s.saveButtonText]}>
                    Save Gratitude
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default GratitudeLogEditor;
