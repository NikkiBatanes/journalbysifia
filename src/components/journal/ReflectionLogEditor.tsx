import React, { useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Keyboard } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { GUIDED_PROMPTS } from './ReflectionLog';

type ViewMode = 'free-form' | 'guided';

interface ReflectionLogEditorProps {
  onSave: (entry: {
    title: string;
    content: string;
    tags: string[];
    date: Date;
    type: ViewMode;
    prompt?: string;
    source?: 'devotional' | string;
  }) => void;
  onCancel: () => void;
  devotionalTitle?: string;
  totalDays?: number;
  dayNumber?: number;
  dayTitle?: string;
  questionNumber?: number;
  initialEntry?: {
    title?: string;
    content?: string;
    tags?: string[];
    type?: ViewMode;
    prompt?: string;
    source?: 'devotional' | string;
  };
  initialMode?: ViewMode;
  initialPrompt?: string;
  dateString?: string;
  initialTitle?: string;
  lockTitle?: boolean;
  source?: 'freeform' | 'guided' | 'devotional' | 'playbook' | string;
  styles?: any;
}

// Fallback styles in case styles prop is not provided
const fallbackStyles = {
  container: { flex: 1, backgroundColor: Colors.anchorBlue },
  backgroundContainer: {},
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
  metadataText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 4,
    lineHeight: 12,
  },
  lastMetadataText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 4,
    lineHeight: 12,
  },
  header: { padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', color: Colors.hopeWhite, marginBottom: 8 },
  modeToggle: { flexDirection: 'row', marginBottom: 16 },
  modeButton: { marginRight: 12 },
  keyboardAvoidingView: { flex: 1 },
  contentCard: { flex: 1, backgroundColor: 'rgba(26,60,109,0.08)', borderRadius: 12, margin: 16, padding: 16 },
  content: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  entryInput: { color: Colors.hopeWhite, fontSize: 18, marginBottom: 8 },
  titleInput: { fontWeight: 'bold', fontSize: 22 },
  transparentInput: {},
  entryContentInput: { minHeight: 100, fontSize: 16 },
  guidedContainer: {},
  promptGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  promptCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, margin: 4, padding: 12, flex: 1, minWidth: 120 },
  promptCardText: { color: Colors.hopeWhite, fontSize: 16 },
  reflectLabel: { marginTop: 8, backgroundColor: Colors.growthGreen, borderRadius: 8, padding: 6, alignItems: 'center' },
  reflectLabelText: { color: Colors.hopeWhite, fontWeight: 'bold' },
  lockedTitleText: {
    color: Colors.hopeWhite,
    opacity: 0.9,
    paddingVertical: 8,
    fontWeight: '600',
    fontSize: 20,
  },
  fabWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  fabContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  leftFabContainer: {},
  androidFabWithKeyboard: {},
  fabDefaultPosition: {},
  addMenu: { backgroundColor: Colors.anchorBlue, borderRadius: 8, padding: 8, marginBottom: 8 },
  addMenuItem: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  addMenuText: { color: Colors.hopeWhite, marginLeft: 8 },
  fab: { backgroundColor: Colors.alertCoral, borderRadius: 24, padding: 12, margin: 8 },
  addFab: {},
  fabRow: { flexDirection: 'row' },
  cancelFab: { backgroundColor: Colors.alertCoral },
  saveFab: { backgroundColor: Colors.growthGreen },
  fabDisabled: { opacity: 0.4 },
  modalView: {
    backgroundColor: Colors.hopeWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 0,
    width: '100%',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  // Metadata styles moved to inline styles to prevent override
};

const ReflectionLogEditor: React.FC<ReflectionLogEditorProps> = ({
  onSave,
  onCancel,
  devotionalTitle,
  totalDays,
  dayNumber,
  dayTitle,
  questionNumber,
  initialEntry = {},
  initialMode = 'free-form',
  initialPrompt = '',
  dateString,
  initialTitle = '',
  lockTitle = false,
  source = 'freeform',
  styles,
}) => {
  // Merge styles prop with fallbackStyles
  const s = { ...fallbackStyles, ...styles };
  // Internal state
  const [viewMode, setViewMode] = React.useState<'free-form' | 'guided'>(initialMode);
  const [newEntry, setNewEntry] = React.useState<{ title: string; content: string; tags: string[] }>(
    {
      title: initialEntry.title || initialTitle || '',
      content: initialEntry.content || '',
      tags: initialEntry.tags || [],
    }
  );

  // Check if we're editing an existing entry (has content)
  const isEditing = !!initialEntry.content;
  const [selectedPrompt, setSelectedPrompt] = React.useState<string>(initialPrompt || initialEntry.prompt || '');
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);

  // Refs
  const titleInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);

  // Debug log for lockTitle and initialTitle
  console.log('lockTitle:', lockTitle, 'initialTitle:', initialTitle, 'currentTitle:', newEntry.title);

  // Update title when initialTitle changes and focus content if title is locked
  React.useEffect(() => {
    console.log('initialTitle changed:', initialTitle);
    if (initialTitle && (newEntry.title !== initialTitle || !newEntry.title)) {
      console.log('Updating title to:', initialTitle);
      setNewEntry(prev => ({ ...prev, title: initialTitle }));
    }
  }, [initialTitle, newEntry.title]);

  // Focus content field when in locked title mode
  React.useEffect(() => {
    if (lockTitle && contentInputRef.current) {
      const timer = setTimeout(() => {
        contentInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [lockTitle]);

  // Keyboard listeners for FAB
  React.useEffect(() => {
    const showSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillShow', (e: any) => setKeyboardHeight(e.endCoordinates.height))
      : Keyboard.addListener('keyboardDidShow', (e: any) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0))
      : Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Save handler
  const handleSave = () => {
    // For devotional reflections, always use 'guided' type
    const entryType: ViewMode = (source === 'devotional' || selectedPrompt) ? 'guided' : 'free-form';
    const entry = {
      ...newEntry,
      date: new Date(),
      type: entryType,
      ...(selectedPrompt && { prompt: selectedPrompt }),
      ...(source === 'devotional' && { source: 'devotional' as const }), // Ensure source is set for devotional entries
    };
    onSave(entry);
  };

  // Cancel handler
  const handleCancel = () => {
    Keyboard.dismiss();
    // Small delay to ensure keyboard is fully dismissed before closing
    setTimeout(() => {
      onCancel();
    }, 10);
  };

  return (
    <View style={s.container}>
    <StatusBar hidden />
    <View style={s.backgroundContainer} />
    <View style={s.header}>
      <Text style={s.title}>{dateString}</Text>
      <View style={s.modeToggle}>
        {/* Always show pencil icon for free-form mode */}
        <TouchableOpacity
          style={s.modeButton}
          onPress={() => {
            // First reset the entry to a clean state
            setNewEntry({
              title: '',
              content: '',
              tags: [],
            });
            // Then update the mode and clear the prompt
            setViewMode('free-form');
            setSelectedPrompt('');
            // Force focus to the title input
            setTimeout(() => {
              titleInputRef.current?.focus();
            }, 100);
          }}
        >
          <Pencil
            size={22}
            color={viewMode === 'free-form' && !selectedPrompt ? Colors.alertCoral : Colors.inactiveIcon}
            fill={viewMode === 'free-form' && !selectedPrompt ? Colors.alertCoral : Colors.inactiveIcon}
            strokeWidth={1.5}
          />
        </TouchableOpacity>
        {/* Hide guided prompt icon for devotional source */}
        {!isEditing && source !== 'devotional' && (
          <TouchableOpacity
            style={s.modeButton}
            onPress={() => setViewMode('guided')}
          >
            <Ionicons
              name="heart"
              size={24}
              color={selectedPrompt || viewMode === 'guided' ? Colors.alertCoral : Colors.inactiveIcon}
            />
          </TouchableOpacity>
        )}
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
          {viewMode === 'free-form' ? (
            <>
              {lockTitle || (source && source !== 'freeform') ? (
                <Text
                  style={[
                    s.entryInput,
                    s.titleInput,
                    s.transparentInput,
                    s.lockedTitleText,
                  ]}
                >
                  {initialTitle || newEntry.title}
                </Text>
              ) : (
                <TextInput
                  ref={titleInputRef}
                  style={[s.entryInput, s.titleInput, s.transparentInput]}
                  placeholder="Name Your Reflection..."
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={newEntry.title}
                  onChangeText={(text: string) => setNewEntry({ ...newEntry, title: text })}
                  underlineColorAndroid="transparent"
                  selectionColor={Colors.hopeWhite}
                  multiline={true}
                  autoFocus
                />
              )}
              <TextInput
                ref={contentInputRef}
                style={[s.entryInput, s.entryContentInput, s.transparentInput]}
                placeholder="Pour out your thoughts..."
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                multiline
                value={newEntry.content}
                onChangeText={(text: string) => setNewEntry({ ...newEntry, content: text })}
                underlineColorAndroid="transparent"
                selectionColor={Colors.hopeWhite}
              />
              {(source === 'devotional') && (
                <View style={s.metadataContainer}>
                  <View style={s.verticalLine} />
                  <View>
                  <Text style={s.fromText}>
                    FROM
                  </Text>
                  {totalDays && (
                    <Text style={s.metadataText}>
                      {totalDays}-day {totalDays > 1 ? 'Devotional Series' : 'Devotional'}
                    </Text>
                  )}
                  {devotionalTitle && (
                    <Text style={s.metadataText}>
                      {devotionalTitle}
                    </Text>
                  )}
                  {dayNumber && dayTitle && totalDays !== 1 && (
                    <Text style={s.metadataText}>
                      Day {dayNumber}: {dayTitle}
                    </Text>
                  )}
                  {questionNumber && (
                    <Text style={s.metadataText}>
                      Question to Ponder #{questionNumber}
                    </Text>
                  )}
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={s.guidedContainer}>
              <View style={s.promptGrid}>
                {GUIDED_PROMPTS.map((prompt: string, index: number) => (
                  <View
                    key={index}
                    style={s.promptCard}
                  >
                    <Text style={s.promptCardText}>{prompt}</Text>
                    <TouchableOpacity
                      style={s.reflectLabel}
                      onPress={() => {
                        // First clear any existing content
                        setNewEntry({
                          title: prompt,
                          content: '',
                          tags: [],
                        });
                        // Then update the prompt and view mode
                        setSelectedPrompt(prompt);
                        setViewMode('free-form');
                        // Focus the content input
                        setTimeout(() => {
                          contentInputRef.current?.focus();
                        }, 100);
                      }}
                    >
                      <Text style={s.reflectLabelText}>REFLECT ON IT</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Floating Action Buttons - Only show in free-form mode */}
      {viewMode === 'free-form' && (
        <View style={s.fabWrapper}>
          {/* Left Add FAB with Menu */}
          <View style={[
            s.fabContainer,
            s.leftFabContainer,
            Platform.OS === 'android' && keyboardHeight > 0
              ? [s.androidFabWithKeyboard, { bottom: keyboardHeight + 4 }]
              : s.fabDefaultPosition,
          ]}>
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
          <View style={[
            s.fabContainer,
            Platform.OS === 'android' && keyboardHeight > 0
              ? [s.androidFabWithKeyboard, { bottom: keyboardHeight + 4 }]
              : s.fabDefaultPosition,
          ]}>
            <View style={s.fabRow}>
              {/* Cancel FAB */}
              <TouchableOpacity
                style={[s.fab, s.cancelFab]}
                onPress={handleCancel}
              >
                <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.6)" />
              </TouchableOpacity>

              {/* Save FAB */}
              <TouchableOpacity
                style={[
                  s.fab,
                  s.saveFab,
                  (!newEntry.title.trim() || !newEntry.content.trim()) && s.fabDisabled,
                ]}
                disabled={!newEntry.title.trim() || !newEntry.content.trim()}
                onPress={handleSave}
              >
                <Ionicons name="checkmark" size={20} color={Colors.hopeWhite} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  </View>
  );
};

export default ReflectionLogEditor;
