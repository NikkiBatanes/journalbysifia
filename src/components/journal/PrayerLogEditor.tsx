import React, { useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Alert, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';

interface PrayerLogEditorProps {
  onSave: (data: {
    content: string;
    date: Date;
  }) => void;
  onCancel: () => void;
  initialContent?: string;
  subtaskTitle?: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  isLoading?: boolean;
  styles?: any;
  dateString?: string;
}

// Styles matching reflection log editor pattern
const defaultStyles = {
  // Main container styles (matching reflection editor)
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  backgroundContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.anchorBlue,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },

  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: Colors.hopeWhite,
  },
  headerLeft: {
    flex: 1,
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.anchorBlue,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.anchorBlue,
    opacity: 0.7,
    marginTop: 2,
  },

  // FAB styles
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  fabDefaultPosition: {
    bottom: 20,
    right: 20,
  },
  fabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  saveFab: {
    backgroundColor: Colors.anchorBlue,
  },
  cancelFab: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  fabDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    opacity: 0.5,
  },

  // Date and metadata styles
  dateContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.anchorBlue,
  },
  dateText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
    letterSpacing: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  metadataText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 4,
    lineHeight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  entryInput: {
    color: Colors.hopeWhite,
    fontSize: 18,
    marginBottom: 8,
  },
  titleInput: {
    fontWeight: 'bold',
    fontSize: 22,
    paddingVertical: 8,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  transparentInput: {},
  entryContentInput: {
    minHeight: 200,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  lockedTitleText: {
    color: Colors.hopeWhite,
    opacity: 0.9,
    includeFontPadding: false,
    textAlignVertical: 'center',
    marginBottom: 20, // Space below title
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
  metadataContainer: {
    marginTop: 32,
    marginBottom: 24,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 1,
    backgroundColor: Colors.hopeWhite,
    opacity: 0.3,
    marginRight: 12,
    borderRadius: 2,
  },
  fromText: {
    fontSize: 8,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 4,
    letterSpacing: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    lineHeight: 12,
  },

  // Compact view styles (for card view)
  compactCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginBottom: 12,
  },
  compactHeader: {
    width: '100%',
  },
  compactDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  compactDate: {
    color: Colors.hopeWhite,
    fontSize: 14,
    opacity: 0.8,
  },
  compactTitle: {
    color: Colors.hopeWhite,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  compactSubtitle: {
    color: Colors.hopeWhite,
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  compactContent: {
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.9,
  },
  compactActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  compactButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  compactButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '500',
  },
};

const PrayerLogEditor: React.FC<PrayerLogEditorProps> = ({
  onSave,
  onCancel: _onCancel,
  initialContent = '',
  subtaskTitle: _subtaskTitle,
  playbookTitle,
  actionStepNumber,
  actionStepTitle,
  isLoading = false,
  styles,
  dateString,
}) => {
  const s = { ...defaultStyles, ...styles };
  const inputRef = useRef<TextInput>(null);

  // State management
  const [prayerContent, setPrayerContent] = React.useState(initialContent);
  const [hasUserMadeChanges, setHasUserMadeChanges] = React.useState(false);
  const [isFirstLoad, setIsFirstLoad] = React.useState(true);
  const [showAddMenu, setShowAddMenu] = React.useState(false);

  // Draft key for auto-saving
  const draftKey = 'prayer_log_draft';

  // Load draft on component mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem(draftKey);
        const hasExistingData = initialContent && initialContent.trim();

        if (draft && !hasExistingData && !hasUserMadeChanges) {
          setPrayerContent(draft);
        }
      } catch (error) {
        console.error('Error loading prayer draft:', error);
      } finally {
        setIsFirstLoad(false);
      }
    };

    loadDraft();
  }, [initialContent, hasUserMadeChanges]);

  // Auto-save draft when content changes
  useEffect(() => {
    if (!isFirstLoad && hasUserMadeChanges) {
      const saveDraft = async () => {
        try {
          if (prayerContent.trim()) {
            await AsyncStorage.setItem(draftKey, prayerContent);
          } else {
            await AsyncStorage.removeItem(draftKey);
          }
        } catch (error) {
          console.error('Error saving prayer draft:', error);
        }
      };

      const timeoutId = setTimeout(saveDraft, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [prayerContent, draftKey, isFirstLoad, hasUserMadeChanges]);

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(draftKey);
    } catch (error) {
      console.error('Error clearing prayer draft:', error);
    }
  };

  const handleContentChange = (text: string) => {
    setPrayerContent(text);
    setHasUserMadeChanges(true);
  };

  const handleSave = async () => {
    try {
      await clearDraft();
      onSave({
        content: prayerContent.trim(),
        date: new Date(),
      });
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    }
  };

  const onCancel = () => {
    console.log('🙏 PrayerLogEditor: onCancel called');
    _onCancel();
  };

  // Main render - exactly matching reflection editor layout
  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.hopeWhite} />

      {/* Background container */}
      <View style={s.backgroundContainer} />

      {/* Header - matching reflection editor structure */}
      <View style={s.header}>
        <Text style={s.title}>{dateString}</Text>
        <View style={s.modeToggle}>
          {/* Always show pencil icon for free-form mode */}
          <TouchableOpacity style={s.modeButton}>
            <Pencil
              size={22}
              color={Colors.alertCoral}
              fill={Colors.alertCoral}
              strokeWidth={1.5}
            />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={s.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        enabled={Platform.OS === 'ios'}>

        <View style={s.contentCard}>
            <ScrollView
              style={s.content}
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Title section */}
              <Text style={[s.entryInput, s.titleInput, s.transparentInput, s.lockedTitleText]}>
                {_subtaskTitle || "What's on your heart today?"}
              </Text>

              {/* Prayer content input */}
              <TextInput
                ref={inputRef}
                style={[s.entryInput, s.entryContentInput]}
                placeholder="Share your thoughts, prayers, and reflections..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={prayerContent}
                onChangeText={handleContentChange}
                multiline
                textAlignVertical="top"
                autoFocus
              />

              {/* Metadata section for playbook context */}
              {(playbookTitle || _subtaskTitle) && (
                <View style={s.metadataContainer}>
                  <View style={s.verticalLine} />
                  <View>
                    <Text style={s.fromText}>
                      FROM PLAYBOOK
                    </Text>
                    {playbookTitle && (
                      <Text style={s.metadataText}>
                        {playbookTitle}
                      </Text>
                    )}
                    {actionStepNumber && actionStepTitle && (
                      <Text style={s.metadataText}>
                        Step {actionStepNumber}: {actionStepTitle}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* Left Add FAB */}
        <View style={[s.fabContainer, s.leftFabContainer, s.fabDefaultPosition]}>
          {showAddMenu && (
            <View style={s.addMenu}>
              <TouchableOpacity style={s.addMenuItem}>
                <Ionicons name="pricetag" size={20} color={Colors.hopeWhite} />
                <Text style={s.addMenuText}>Tags</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.addMenuItem}>
                <Ionicons name="image" size={20} color={Colors.hopeWhite} />
                <Text style={s.addMenuText}>Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.addMenuItem}>
                <Ionicons name="camera" size={20} color={Colors.hopeWhite} />
                <Text style={s.addMenuText}>Camera</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={[s.fab, s.addFab]}
            onPress={() => setShowAddMenu(!showAddMenu)}
          >
            <Ionicons
              name={showAddMenu ? 'close' : 'add'}
              size={24}
              color="rgba(255, 255, 255, 0.6)"
            />
          </TouchableOpacity>
        </View>

        {/* Right Action Buttons */}
        <View style={[s.fabContainer, s.fabDefaultPosition]}>
          <View style={s.fabRow}>
            {/* Cancel FAB */}
            <TouchableOpacity
              style={[s.fab, s.cancelFab]}
              onPress={onCancel}
            >
              <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.6)" />
            </TouchableOpacity>

            {/* Save FAB */}
            <TouchableOpacity
              style={[
                s.fab,
                s.saveFab,
                (!prayerContent.trim() || !hasUserMadeChanges || isLoading) && s.fabDisabled,
              ]}
              disabled={!prayerContent.trim() || !hasUserMadeChanges || isLoading}
              onPress={handleSave}
            >
              {isLoading ? (
                <ActivityIndicator size={20} color={Colors.hopeWhite} />
              ) : (
                <Ionicons name="checkmark" size={20} color={Colors.hopeWhite} />
              )}
            </TouchableOpacity>
          </View>
        </View>
    </View>
  );
};

export default PrayerLogEditor;
