import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ThemedText from '../components/common/ThemedText';
import NewSuccessModal from '../components/NewSuccessModal';
import ScriptureReaderModal from '../components/ScriptureReaderModal';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useCreateReflection, useUpdateReflection } from '../services/hooks/useReflectionData';
import { getScripturePassage, type ScriptureReaderResult } from '../services/scriptureReaderService';
import { styles as s } from '../components/journal/reflectionStyles';
import { Colors } from '../theme/colors';
import { getFontFamily } from '../theme/fonts';
import { useTheme } from '../hooks/useTheme';
import { toLocalDateString } from '../utils/date';
import { triggerLightHaptic } from '../utils/haptics';
import { useSuccessModal } from '../hooks/useSuccessModal';
import { Logger } from '../utils/ProductionLogger';

interface RouteParams {
  selectedDate?: string; // ISO date string
  existingReflection?: any;
  returnTo?: string; // Parent (tab) route to switch back to after closing
  version?: string; // Bible version for the reader (defaults to NASB)
}

// Matches a plausible Bible reference like "John 3:16", "1 Cor 13", "Psalm 23".
const REFERENCE_PATTERN = /^[1-3]?\s*[a-zA-Z]+\.?\s+\d{1,3}(:\d{1,3}([–—-]\d{1,3})?(,\s*\d{1,3}([–—-]\d{1,3})?)*)?$/;

const ScriptureNoteEditorScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = (route.params as RouteParams) || {};
  const { user } = useAuth();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamilyRegular = getFontFamily(fontKey, 'regular');
  const fontFamilyBold = getFontFamily(fontKey, 'bold');

  const selectedDate = params.selectedDate ? new Date(params.selectedDate) : new Date();
  const dateStr = toLocalDateString(selectedDate);

  const createMutation = useCreateReflection();
  const updateMutation = useUpdateReflection();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const [editingId] = useState<string | null>(params.existingReflection?.id || null);
  const [reference, setReference] = useState<string>(params.existingReflection?.title || '');
  const [content, setContent] = useState<string>(params.existingReflection?.content || '');
  const [hasChanges, setHasChanges] = useState<boolean>(Boolean(params.existingReflection));
  const [resolvedVerse, setResolvedVerse] = useState<ScriptureReaderResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [showReader, setShowReader] = useState(false);

  const contentInputRef = useRef<TextInput>(null);
  const lookupVersionRef = useRef(0);

  // Debounced scripture lookup — resolves the typed reference so we can
  // preview the verse and confirm it exists before the user writes.
  useEffect(() => {
    const candidate = reference.trim();
    const lookupId = ++lookupVersionRef.current;

    if (!REFERENCE_PATTERN.test(candidate)) {
      setResolvedVerse(null);
      setResolving(false);
      return;
    }

    setResolving(true);
    const timer = setTimeout(() => {
      getScripturePassage(candidate, params.version || 'NASB')
        .then(result => {
          if (lookupVersionRef.current === lookupId) {
            setResolvedVerse(result);
          }
        })
        .catch(() => {
          if (lookupVersionRef.current === lookupId) {
            setResolvedVerse(null);
          }
        })
        .finally(() => {
          if (lookupVersionRef.current === lookupId) {
            setResolving(false);
          }
        });
    }, 600);

    return () => clearTimeout(timer);
  }, [reference, params.version]);

  const closeEditor = useCallback(() => {
    navigation.goBack();
    if (params.returnTo) {
      (navigation.getParent() as any)?.navigate?.(params.returnTo);
    }
  }, [navigation, params.returnTo]);

  const successModal = useSuccessModal(
    () => {
      contentInputRef.current?.blur();
      closeEditor();
    },
    () => {
      setTimeout(() => contentInputRef.current?.focus(), 300);
    }
  );

  const handleCancel = () => {
    Keyboard.dismiss();
    closeEditor();
  };

  const openReader = () => {
    triggerLightHaptic();
    setShowReader(true);
  };

  const handleShareScripture = useCallback((text: string) => {
    // Insert the shared verse into the note body.
    setContent(prev => (prev.trim() ? `${prev}\n\n${text}` : text));
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    triggerLightHaptic();
    if (!user) {
      Logger.error('User not authenticated', undefined, { component: 'ScriptureNoteEditorScreen' });
      return;
    }

    const trimmedReference = (resolvedVerse?.reference || reference).trim();
    const trimmedContent = content.trim();
    if (!trimmedReference || !trimmedContent) { return; }

    try {
      const saveData = {
        title: trimmedReference,
        content: trimmedContent,
        type: 'free',
        user_id: user.id,
        selected_date: dateStr,
        source: 'scripture',
      };

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, updates: saveData });
      } else {
        await createMutation.mutateAsync(saveData);
      }

      setTimeout(() => {
        successModal.showSuccess({
          title: editingId ? 'Scripture Note Updated' : 'Scripture Note Saved',
          message: editingId
            ? 'Your scripture note has been updated in your journal.'
            : 'Your scripture note has been saved to your journal.',
          showEditButton: true,
        });
      }, 100);
    } catch (saveError) {
      Logger.error('ScriptureNoteEditorScreen: Save failed', saveError as Error, {
        component: 'ScriptureNoteEditorScreen',
      });
      Alert.alert('Error', 'Failed to save your scripture note. Please try again.');
    }
  };

  const canSave = Boolean(reference.trim()) && Boolean(content.trim()) && hasChanges && !isSaving;
  const readerReference = resolvedVerse?.reference || reference.trim();
  const dateString = (() => {
    const year = selectedDate.getFullYear();
    const currentYear = new Date().getFullYear();
    const base: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    const withYear: Intl.DateTimeFormatOptions = { ...base, year: 'numeric' };
    return selectedDate.toLocaleDateString('en-US', year === currentYear ? base : withYear);
  })();

  return (
    <View style={s.container}>
      <StatusBar hidden />
      <View style={s.backgroundContainer} />

      <View style={s.header}>
        <ThemedText weight="bold" style={s.title}>{dateString}</ThemedText>
        <View style={s.modeToggle}>
          {/* Read Scripture — opens the scripture reader for the typed reference */}
          <TouchableOpacity
            style={s.modeButton}
            onPress={openReader}
            disabled={!readerReference}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Read scripture"
          >
            <MaterialCommunityIcons
              name="book-open-page-variant-outline"
              size={22}
              color={readerReference ? Colors.alertCoral : Colors.trustGrey}
            />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={s.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        enabled={Platform.OS === 'ios'}
      >
        <View style={s.contentCard}>
          <ScrollView
            style={s.content}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Scripture search bar — takes the place of the title input */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" style={styles.searchIcon} />
              <TextInput
                style={[s.entryInput, s.titleInput, s.transparentInput, styles.searchInput, { fontFamily: fontFamilyBold }]}
                placeholder="Search a Bible Verse"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={reference}
                onChangeText={(text) => {
                  setReference(text);
                  setHasChanges(true);
                }}
                keyboardAppearance="dark"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => contentInputRef.current?.focus()}
                underlineColorAndroid="transparent"
              />
              {resolving && (
                <ActivityIndicator size="small" color={Colors.hopeWhite} style={styles.searchSpinner} />
              )}
            </View>

            {/* Resolved verse preview */}
            {resolvedVerse && (
              <TouchableOpacity
                style={styles.versePreview}
                onPress={openReader}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Read ${resolvedVerse.reference}`}
              >
                <ThemedText style={styles.versePreviewText} numberOfLines={3}>
                  {resolvedVerse.text}
                </ThemedText>
                <ThemedText weight="semiBold" style={styles.versePreviewRef}>
                  {resolvedVerse.reference} · {resolvedVerse.version}
                </ThemedText>
              </TouchableOpacity>
            )}

            <TextInput
              ref={contentInputRef}
              style={[s.entryInput, s.entryContentInput, { fontFamily: fontFamilyRegular }]}
              placeholder="Write about this passage…"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={content}
              onChangeText={(text) => {
                setContent(text);
                setHasChanges(true);
              }}
              multiline
              keyboardAppearance="dark"
              textAlignVertical="top"
            />
          </ScrollView>
        </View>

        {/* Floating action buttons — same pattern as the heart journal editor */}
        <View style={s.fabWrapper}>
          <View style={s.fabContainer}>
            <View style={s.fabRow}>
              <TouchableOpacity
                style={[s.fab, s.cancelFab]}
                onPress={() => {
                  triggerLightHaptic();
                  handleCancel();
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.fab, s.saveFab, !canSave && s.fabDisabled]}
                disabled={!canSave}
                onPress={handleSave}
                accessibilityRole="button"
                accessibilityLabel="Save scripture note"
              >
                {isSaving ? (
                  <ActivityIndicator size={17} color={Colors.hopeWhite} />
                ) : (
                  <Ionicons name="checkmark" size={17} color={Colors.hopeWhite} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ScriptureReaderModal
        visible={showReader && !!readerReference}
        passages={[{ reference: readerReference }]}
        initialIndex={0}
        version={params.version || 'NASB'}
        onClose={() => setShowReader(false)}
        onShareScripture={handleShareScripture}
      />

      <NewSuccessModal
        visible={successModal.isVisible}
        config={successModal.config}
        onDone={successModal.handleDone}
        onEdit={successModal.handleEdit}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
    fontSize: 22,
  },
  searchSpinner: {
    marginLeft: 10,
  },
  versePreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  versePreviewText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.9,
  },
  versePreviewRef: {
    color: Colors.alertCoral,
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 0.4,
  },
});

export default ScriptureNoteEditorScreen;
