import React, { useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { GUIDED_PROMPTS } from './ReflectionLog';

interface ReflectionLogEditorProps {
  viewMode: 'free-form' | 'guided';
  setViewMode: (mode: 'free-form' | 'guided') => void;
  newEntry: { title: string; content: string; tags: string[] };
  setNewEntry: (entry: { title: string; content: string; tags: string[] }) => void;
  _selectedPrompt: string;
  setSelectedPrompt: (prompt: string) => void;
  handleSaveEntry: () => void;
  setIsAdding: (adding: boolean) => void;
  showAddMenu: boolean;
  setShowAddMenu: (show: boolean) => void;
  keyboardHeight: number;
  styles: any;
  titleInputRef: React.RefObject<TextInput | null>;
  dateString: string;
  initialTitle?: string; // Prefilled title for the entry
  lockTitle?: boolean;   // If true, title is read-only or hidden
  source: 'freeform' | 'guided' | 'devotional' | 'playbook' | string; // Entry source
}

const ReflectionLogEditor: React.FC<ReflectionLogEditorProps> = ({
  viewMode,
  setViewMode,
  newEntry,
  setNewEntry,
  _selectedPrompt,
  setSelectedPrompt,
  handleSaveEntry,
  setIsAdding,
  showAddMenu,
  setShowAddMenu,
  keyboardHeight,
  styles,
  titleInputRef,
  dateString,
  initialTitle = '',
  lockTitle = false,
  source,
}) => {
  const contentInputRef = useRef<TextInput>(null);

  // Set initial title on mount if provided and focus content if title is locked
  React.useEffect(() => {
    if (initialTitle && newEntry.title !== initialTitle) {
      setNewEntry({ ...newEntry, title: initialTitle });
    }
    
    // If title is locked (meaning we came from a prompt), focus the content input
    if (lockTitle && contentInputRef.current) {
      // Small delay to ensure the input is rendered
      const timer = setTimeout(() => {
        contentInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTitle, lockTitle]);

  return (
    <View style={styles.container}>
    <StatusBar hidden />
    <View style={styles.backgroundContainer} />
    <View style={styles.header}>
      <Text style={styles.title}>{dateString}</Text>
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={styles.modeButton}
          onPress={() => setViewMode('free-form')}
        >
          <Pencil
            size={22}
            color={viewMode === 'free-form' ? Colors.alertCoral : Colors.inactiveIcon}
            fill={viewMode === 'free-form' ? Colors.alertCoral : Colors.inactiveIcon}
            strokeWidth={1.5}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modeButton}
          onPress={() => setViewMode('guided')}
        >
          <Ionicons
            name="heart"
            size={24}
            color={viewMode === 'guided' ? Colors.alertCoral : Colors.inactiveIcon}
          />
        </TouchableOpacity>
      </View>
    </View>

    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      enabled={Platform.OS === 'ios'}>

      <View style={styles.contentCard}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {viewMode === 'free-form' ? (
            <>
              {lockTitle ? (
                <Text style={[styles.entryInput, styles.titleInput, styles.transparentInput, { color: Colors.hopeWhite, opacity: 0.9 }]}>{newEntry.title}</Text>
              ) : (
                <TextInput
                  ref={titleInputRef}
                  style={[styles.entryInput, styles.titleInput, styles.transparentInput]}
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
                style={[styles.entryInput, styles.entryContentInput, styles.transparentInput]}
                placeholder="Pour out your thoughts..."
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                multiline
                value={newEntry.content}
                onChangeText={(text: string) => setNewEntry({ ...newEntry, content: text })}
                underlineColorAndroid="transparent"
                selectionColor={Colors.hopeWhite}
              />
            </>
          ) : (
            <View style={styles.guidedContainer}>
              <View style={styles.promptGrid}>
                {GUIDED_PROMPTS.map((prompt: string, index: number) => (
                  <View
                    key={index}
                    style={styles.promptCard}
                  >
                    <Text style={styles.promptCardText}>{prompt}</Text>
                    <TouchableOpacity
                      style={styles.reflectLabel}
                      onPress={() => {
                        setSelectedPrompt(prompt);
                        setNewEntry({ 
                          title: prompt, 
                          content: '',  // Reset content
                          tags: []      // Reset tags
                        });
                        setViewMode('free-form');
                      }}
                    >
                      <Text style={styles.reflectLabelText}>REFLECT ON IT</Text>
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
        <View style={styles.fabWrapper}>
          {/* Left Add FAB with Menu */}
          <View style={[
            styles.fabContainer,
            styles.leftFabContainer,
            Platform.OS === 'android' && keyboardHeight > 0
              ? [styles.androidFabWithKeyboard, { bottom: keyboardHeight + 4 }]
              : styles.fabDefaultPosition,
          ]}>
            {showAddMenu && (
              <View style={styles.addMenu}>
                <TouchableOpacity style={styles.addMenuItem}>
                  <Ionicons name="pricetag" size={20} color={Colors.hopeWhite} />
                  <Text style={styles.addMenuText}>Tags</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addMenuItem}>
                  <Ionicons name="image" size={20} color={Colors.hopeWhite} />
                  <Text style={styles.addMenuText}>Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addMenuItem}>
                  <Ionicons name="camera" size={20} color={Colors.hopeWhite} />
                  <Text style={styles.addMenuText}>Camera</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={[styles.fab, styles.addFab]}
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
            styles.fabContainer,
            Platform.OS === 'android' && keyboardHeight > 0
              ? [styles.androidFabWithKeyboard, { bottom: keyboardHeight + 4 }]
              : styles.fabDefaultPosition,
          ]}>
            <View style={styles.fabRow}>
              {/* Cancel FAB */}
              <TouchableOpacity
                style={[styles.fab, styles.cancelFab]}
                onPress={() => setIsAdding(false)}
              >
                <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.6)" />
              </TouchableOpacity>

              {/* Save FAB */}
              <TouchableOpacity
                style={[
                  styles.fab,
                  styles.saveFab,
                  (!newEntry.title.trim() || !newEntry.content.trim()) && styles.fabDisabled,
                ]}
                disabled={!newEntry.title.trim() || !newEntry.content.trim()}
                onPress={handleSaveEntry}
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
