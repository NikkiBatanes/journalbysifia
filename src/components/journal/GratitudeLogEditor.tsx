import React, { useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Keyboard, Alert, ActivityIndicator } from 'react-native';
import { Edit3, Plus } from 'lucide-react-native';
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
  const [gratitudeItems, setGratitudeItems] = React.useState<string[]>(initialItems.length >= 3 ? initialItems : ['', '', '']);
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

  const addMoreItem = () => {
    setGratitudeItems([...gratitudeItems, '']);
    setHasUserMadeChanges(true);
  };

  const getCurrentDate = () => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return today.toLocaleDateString('en-US', options);
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
          {/* Date and Edit Icon Row */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '500',
              color: Colors.hopeWhite,
              opacity: 0.9,
            }}>
              {getCurrentDate()}
            </Text>
            <TouchableOpacity style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Edit3 size={20} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </View>

          {/* Main Title */}
          <Text style={{
            fontSize: 28,
            fontWeight: 'bold',
            color: Colors.hopeWhite,
            marginBottom: 8,
            lineHeight: 34,
          }}>
            What are you grateful for today?
          </Text>

          {/* Subtitle */}
          <Text style={{
            fontSize: 16,
            color: Colors.hopeWhite,
            opacity: 0.7,
            marginBottom: 24,
          }}>
            List at least 3 things
          </Text>

          {/* Metadata - Uniform formatting */}
          {(subtaskTitle || playbookTitle) && (
            <View style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              borderLeftWidth: 4,
              borderLeftColor: Colors.hopeWhite,
            }}>
              <Text style={{
                color: Colors.hopeWhite,
                fontSize: 12,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 8,
                opacity: 0.6,
              }}>
                FROM PLAYBOOK
              </Text>
              {playbookTitle && (
                <Text style={{
                  color: Colors.hopeWhite,
                  fontSize: 16,
                  fontWeight: '600',
                  marginBottom: 4,
                }}>
                  {playbookTitle}
                </Text>
              )}
              {actionStepNumber && actionStepTitle && (
                <Text style={{
                  color: Colors.hopeWhite,
                  fontSize: 14,
                  opacity: 0.8,
                  marginBottom: 4,
                }}>
                  Step {actionStepNumber}: {actionStepTitle}
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

            <ScrollView style={s.scrollContent} showsVerticalScrollIndicator={false}>
              {gratitudeItems.map((item, index) => (
                <View key={index} style={{
                  marginBottom: 20,
                }}>
                  <TextInput
                    ref={(ref) => { inputRefs.current[index] = ref; }}
                    style={{
                      color: Colors.hopeWhite,
                      fontSize: 18,
                      minHeight: 60,
                      borderWidth: 0,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255, 255, 255, 0.2)',
                      paddingVertical: 16,
                      paddingHorizontal: 0,
                      textAlignVertical: 'top',
                      backgroundColor: 'transparent',
                    }}
                    placeholder={`${index + 1}. I'm grateful for...`}
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={item}
                    onChangeText={(text) => handleItemChange(index, text)}
                    multiline
                    returnKeyType={index < gratitudeItems.length - 1 ? 'next' : 'done'}
                    onSubmitEditing={() => {
                      if (index < gratitudeItems.length - 1) {
                        inputRefs.current[index + 1]?.focus();
                      } else {
                        Keyboard.dismiss();
                      }
                    }}
                    blurOnSubmit={index === gratitudeItems.length - 1}
                  />
                </View>
              ))}

              {/* Add More Button */}
              <TouchableOpacity
                onPress={addMoreItem}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 16,
                  paddingHorizontal: 0,
                  marginBottom: 20,
                }}
              >
                <Plus size={20} color={Colors.hopeWhite} style={{ marginRight: 12, opacity: 0.7 }} />
                <Text style={{
                  color: Colors.hopeWhite,
                  fontSize: 16,
                  opacity: 0.7,
                }}>
                  Add more
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Bottom spacing for FAB */}
            <View style={{ height: 100 }} />
          </View>
        </View>

        {/* Floating Action Button */}
        <View style={{
          position: 'absolute',
          bottom: 30,
          right: 20,
          left: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Cancel Button */}
          <TouchableOpacity
            onPress={handleCancel}
            disabled={isLoading}
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: Colors.hopeWhite,
              fontSize: 24,
              fontWeight: '300',
            }}>×</Text>
          </TouchableOpacity>

          {/* Save FAB */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isFormValid || isLoading}
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: isFormValid && !isLoading ? Colors.hopeWhite : 'rgba(255, 255, 255, 0.3)',
              justifyContent: 'center',
              alignItems: 'center',
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.anchorBlue} size="small" />
            ) : (
              <Text style={{
                color: Colors.anchorBlue,
                fontSize: 24,
                fontWeight: '500',
              }}>✓</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default GratitudeLogEditor;
