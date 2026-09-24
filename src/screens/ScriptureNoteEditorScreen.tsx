import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Trash2 } from 'lucide-react-native';

import ThemedText from '../components/common/ThemedText';
import { BibleCopyrightModal } from '../components/BibleCopyrightModal';
import NewSuccessModal from '../components/NewSuccessModal';
import ScriptureReaderModal from '../components/ScriptureReaderModal';
import ShareComposer from '../components/TruthToCarryShareComposer';
import {
  createLocalReflection,
  getLocalReflection,
  updateLocalReflection,
} from '../storage/reflectionStorage';
import { useDeleteReflection } from '../services/hooks/useReflectionData';
import { getScripturePassage, type ScriptureReaderResult } from '../services/scriptureReaderService';
import { styles as s } from '../components/journal/reflectionStyles';
import { Colors } from '../theme/colors';
import { getFontFamily } from '../theme/fonts';
import { useTheme } from '../hooks/useTheme';
import { fromLocalDateString, toLocalDateString } from '../utils/date';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { useSuccessModal } from '../hooks/useSuccessModal';
import { Logger } from '../utils/ProductionLogger';
import { claimFaithfulRhythmCelebration, FAITHFUL_RHYTHM_UPDATED } from '../services/faithfulRhythmService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFloatingKeyboardButton } from '../hooks/useFloatingKeyboardButton';
import {
  createJournalPickerEntrance,
  JournalComposerBar,
  JournalPickerMenu,
} from '../components/journal/shared/JournalComposer';
import DraggableJournalBlock from '../components/journal/shared/DraggableJournalBlock';
import {
  reorderJournalBlock,
  resolveJournalBlockDropIndex,
} from '../components/journal/shared/journalBlockOperations';
import { JournalBlockEditor } from '../components/journal/shared/JournalBlockEditor';
import JournalTextInput from '../components/journal/shared/JournalTextInput';
import { ScriptureLookupInput } from '../components/journal/shared/ScriptureLookupInput';
import { JournalColumnBlock } from '../components/journal/shared/JournalColumnBlock';
import JournalNestedBlockEditor from '../components/journal/shared/JournalNestedBlockEditor';
import { pickImageLocal } from '../services/avatarService';
import {
  JOURNAL_BLOCK_GAP,
  JOURNAL_BLOCKS,
  JournalBlockIcon,
  createJournalBlock,
  journalBlocksToPlainText,
  prepareJournalBlocksForSave,
  type JournalBlock,
} from '../components/journal/shared/journalBlocks';
import {
  REFLECTION_NOTE_TYPES,
  createGuidedNoteId,
  type GuidedReflectionNote,
} from '../types/guidedReflection';

interface RouteParams {
  selectedDate?: string; // ISO date string
  existingReflection?: any;
  returnTo?: string; // Parent (tab) route to switch back to after closing
  version?: string; // Bible version for the reader (defaults to NASB)
}

// Matches a plausible Bible reference like "John 3:16", "1 Cor 13", "Psalm 23".
const REFERENCE_PATTERN = /^[1-3]?\s*[a-zA-Z]+\.?\s+\d{1,3}(:\d{1,3}([–—-]\d{1,3})?(,\s*\d{1,3}([–—-]\d{1,3})?)*)?$/;

const stripWrappingQuotationMarks = (text: string) =>
  text.trim().replace(/^[“\"]\s*/, '').replace(/\s*[”\"]$/, '');

const blocksToPlainText = (blocks: GuidedReflectionNote[]) =>
  journalBlocksToPlainText(prepareJournalBlocksForSave(blocks));

const ScriptureNoteEditorScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = (route.params as RouteParams) || {};
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamilyRegular = getFontFamily(fontKey, 'regular');
  const fontFamilyBold = getFontFamily(fontKey, 'bold');
  const insets = useSafeAreaInsets();
  const { bottom: composerBottom } = useFloatingKeyboardButton(insets.bottom);

  const selectedDate = params.selectedDate ? fromLocalDateString(params.selectedDate) : new Date();
  const dateStr = toLocalDateString(selectedDate);

  const deleteMutation = useDeleteReflection();
  const [isSaving, setIsSaving] = useState(false);
  const [editingId] = useState<string | null>(params.existingReflection?.id || null);
  const [reference, setReference] = useState<string>(params.existingReflection?.title || '');
  const [content, setContent] = useState<string>(params.existingReflection?.content || '');
  const [journalBlocks, setJournalBlocks] = useState<GuidedReflectionNote[]>(() =>
    params.existingReflection?.metadata?.journalBlocks?.length
      ? params.existingReflection.metadata.journalBlocks
      : params.existingReflection?.content
      ? [{ id: createGuidedNoteId(), kind: 'text', text: params.existingReflection.content }]
      : [],
  );
  const [hasChanges, setHasChanges] = useState<boolean>(Boolean(params.existingReflection));
  const [resolvedVerse, setResolvedVerse] = useState<ScriptureReaderResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [showReader, setShowReader] = useState(false);
  const [shareComposerText, setShareComposerText] = useState('');
  const [shareComposerOpen, setShareComposerOpen] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [columnTarget, setColumnTarget] = useState<{ columnId: string; side: 'left' | 'right' } | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    blockId: string;
    fromIndex: number;
    targetIndex: number;
    blockHeight: number;
  } | null>(null);
  const notePickerAnimations = useRef(REFLECTION_NOTE_TYPES.map(() => new Animated.Value(0))).current;
  const plusRotation = useRef(new Animated.Value(0)).current;
  const pickerColorAnim = useRef(new Animated.Value(0)).current;
  const actionAnimations = useRef([0, 1, 2, 3].map(() => new Animated.Value(1))).current;
  const editorEntranceAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    editorEntranceAnims.forEach(animation => {
      animation.stopAnimation();
      animation.setValue(0);
    });
    const frame = requestAnimationFrame(() => {
      Animated.sequence([
        Animated.timing(editorEntranceAnims[0], {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.spring(editorEntranceAnims[1], {
            toValue: 1,
            tension: 82,
            friction: 11,
            useNativeDriver: true,
          }),
          Animated.spring(editorEntranceAnims[2], {
            toValue: 1,
            tension: 88,
            friction: 12,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
    return () => {
      cancelAnimationFrame(frame);
      editorEntranceAnims.forEach(animation => animation.stopAnimation());
    };
  }, [editorEntranceAnims]);

  useEffect(() => {
    if (!editingId) {return;}
    let mounted = true;
    (async () => {
      const existing = await getLocalReflection(editingId, 'scripture', dateStr);
      if (!existing || !mounted) return;
      setReference(existing.title || existing.metadata?.scripture_reference || '');
      setContent(existing.content || '');
      setJournalBlocks(
        existing.metadata?.journalBlocks?.length
          ? existing.metadata.journalBlocks
          : existing.content
          ? [{ id: createGuidedNoteId(), kind: 'text', text: existing.content }]
          : [],
      );
      setHasChanges(true);
    })();
    return () => { mounted = false; };
  }, [editingId, dateStr]);

  const contentInputRef = useRef<TextInput>(null);
  const searchInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const blockInputRefs = useRef(new Map<string, TextInput>());
  const journalBlockLayoutsRef = useRef(new Map<string, { y: number; height: number }>());
  const pendingFocusBlockIdRef = useRef<string | null>(null);
  const pendingFocusShouldScrollEndRef = useRef(true);
  const focusRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupVersionRef = useRef(0);

  useEffect(() => () => {
    if (focusRetryTimerRef.current) clearTimeout(focusRetryTimerRef.current);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
    const retry = setTimeout(() => searchInputRef.current?.focus(), 180);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(retry);
    };
  }, []);

  useEffect(() => {
    const blockId = pendingFocusBlockIdRef.current;
    if (!blockId) return;
    const frame = requestAnimationFrame(() => {
      blockInputRefs.current.get(blockId)?.focus();
      const layout = journalBlockLayoutsRef.current.get(blockId);
      if (layout && !pendingFocusShouldScrollEndRef.current) {
        scrollRef.current?.scrollTo({ y: Math.max(0, layout.y - 20), animated: true });
      } else {
        scrollRef.current?.scrollToEnd({ animated: true });
      }
      if (focusRetryTimerRef.current) clearTimeout(focusRetryTimerRef.current);
      focusRetryTimerRef.current = setTimeout(() => {
        blockInputRefs.current.get(blockId)?.focus();
        scrollRef.current?.scrollToEnd({ animated: true });
        focusRetryTimerRef.current = null;
      }, 320);
      pendingFocusBlockIdRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [journalBlocks]);

  const commitBlocks = useCallback((next: GuidedReflectionNote[]) => {
    setJournalBlocks(next);
    setContent(blocksToPlainText(next));
    setHasChanges(true);
  }, []);

  const addBlock = useCallback((kind: GuidedReflectionNote['kind'], extra: Partial<GuidedReflectionNote> = {}) => {
    const selectedBlock = selectedBlockId
      ? journalBlocks.find(item => item.id === selectedBlockId)
      : undefined;
    const destination =
      selectedBlock?.parentColumnId && selectedBlock.columnSide
        ? { columnId: selectedBlock.parentColumnId, side: selectedBlock.columnSide }
        : columnTarget;
    if (destination && !JOURNAL_BLOCKS[kind].allowInColumn) { return; }
    const block: GuidedReflectionNote = {
      ...createJournalBlock(kind, createGuidedNoteId()),
      ...(destination
        ? { parentColumnId: destination.columnId, columnSide: destination.side }
        : {}),
      ...extra,
    };
    let selectedIndex = selectedBlockId
      ? journalBlocks.findIndex(item => item.id === selectedBlockId)
      : -1;
    if (destination && selectedBlock?.parentColumnId !== destination.columnId) {
      selectedIndex = -1;
    }
    if (destination && selectedIndex < 0) {
      for (let i = journalBlocks.length - 1; i >= 0; i -= 1) {
        const item = journalBlocks[i];
        if (item.parentColumnId === destination.columnId && item.columnSide === destination.side) {
          selectedIndex = i;
          break;
        }
      }
      if (selectedIndex < 0) {
        selectedIndex = journalBlocks.findIndex(item => item.id === destination.columnId);
      }
    }
    const nextBlocks = [...journalBlocks];
    if (selectedIndex >= 0) {
      nextBlocks.splice(selectedIndex + 1, 0, block);
      pendingFocusShouldScrollEndRef.current = selectedIndex === journalBlocks.length - 1;
    } else {
      nextBlocks.push(block);
      pendingFocusShouldScrollEndRef.current = true;
    }
    pendingFocusBlockIdRef.current = block.id;
    commitBlocks(nextBlocks);
    setColumnTarget(kind === 'column' ? null : destination || null);
  }, [commitBlocks, columnTarget, journalBlocks, selectedBlockId]);

  const insertActionAfter = useCallback((index: number) => {
    const block: GuidedReflectionNote = {
      id: createGuidedNoteId(),
      kind: 'action',
      text: '',
      completed: false,
    };
    const nextBlocks = [...journalBlocks];
    nextBlocks.splice(index + 1, 0, block);
    pendingFocusBlockIdRef.current = block.id;
    pendingFocusShouldScrollEndRef.current = index === journalBlocks.length - 1;
    setSelectedBlockId(block.id);
    commitBlocks(nextBlocks);
  }, [commitBlocks, journalBlocks]);

  const handleDragJournalBlockStart = useCallback(
    (blockId: string) => {
      const fromIndex = journalBlocks.findIndex(block => block.id === blockId);
      const layout = journalBlockLayoutsRef.current.get(blockId);
      if (fromIndex < 0 || !layout) { return; }
      setDragPreview({
        blockId,
        fromIndex,
        targetIndex: fromIndex,
        blockHeight: layout.height,
      });
    },
    [journalBlocks],
  );

  const handleDragJournalBlockMove = useCallback(
    (blockId: string, deltaY: number) => {
      const targetIndex = resolveJournalBlockDropIndex(
        journalBlocks,
        journalBlockLayoutsRef.current,
        blockId,
        deltaY,
      );
      setDragPreview(current =>
        !current || current.blockId !== blockId || current.targetIndex === targetIndex
          ? current
          : { ...current, targetIndex },
      );
    },
    [journalBlocks],
  );

  const handleDragJournalBlock = useCallback(
    (blockId: string, deltaY: number) => {
      const targetIndex = resolveJournalBlockDropIndex(
        journalBlocks,
        journalBlockLayoutsRef.current,
        blockId,
        deltaY,
      );
      setDragPreview(null);
      const nextBlocks = reorderJournalBlock(journalBlocks, blockId, targetIndex);
      if (nextBlocks !== journalBlocks) {
        setSelectedBlockId(blockId);
        commitBlocks(nextBlocks);
      }
    },
    [commitBlocks, journalBlocks],
  );

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

  const handleDelete = () => {
    triggerLightHaptic();
    if (!editingId) { return; }
    Alert.alert(
      'Delete Scripture Note',
      'Are you sure you want to delete this scripture note? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            triggerLightHaptic();
            deleteMutation.mutateAsync(editingId)
              .then(() => closeEditor())
              .catch(deleteError => {
                Logger.error('Failed to delete scripture note', deleteError as Error, {
                  component: 'ScriptureNoteEditorScreen',
                });
                Alert.alert('Error', 'Failed to delete scripture note. Please try again.');
              });
          },
        },
      ],
    );
  };

  const openReader = () => {
    triggerLightHaptic();
    setShowReader(true);
  };

  const showReferenceInfo = () => {
    triggerLightHaptic();
    setShowCopyright(true);
  };

  const openNotePicker = () => {
    Keyboard.dismiss();
    notePickerAnimations.forEach(animation => {
      animation.stopAnimation();
      animation.setValue(0);
    });
    setNotePickerOpen(true);
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(pickerColorAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.spring(plusRotation, {
          toValue: 1,
          tension: 90,
          friction: 12,
          useNativeDriver: true,
        }),
        createJournalPickerEntrance(notePickerAnimations),
      ]).start();
    }, 80);
  };

  const closeNotePicker = (onComplete?: () => void) => {
    Animated.parallel([
      Animated.timing(pickerColorAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.spring(plusRotation, {
        toValue: 0,
        tension: 90,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.stagger(
        28,
        notePickerAnimations.map(animation =>
          Animated.timing(animation, {
            toValue: 0,
            duration: 130,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start(() => {
      setNotePickerOpen(false);
      onComplete?.();
    });
  };

  const handleShareScripture = useCallback((text: string) => {
    setShareComposerText(text);
    setShareComposerOpen(true);
  }, []);

  const handleSave = async () => {
    triggerLightHaptic();

    const trimmedReference = (resolvedVerse?.reference || reference).trim();
    const trimmedContent = content.trim();
    if (!trimmedReference || !trimmedContent) { return; }

    setIsSaving(true);

    try {
      const parsedRef = trimmedReference.match(/^(\d?\s*[A-Za-z]+)\s*(.*)$/);
      const book = parsedRef ? parsedRef[1].trim() : '';
      const chapterVerse = parsedRef ? parsedRef[2].trim() : '';

      if (editingId) {
        const existing = await getLocalReflection(editingId, 'scripture', dateStr);
        if (existing) {
          await updateLocalReflection({
            ...existing,
            title: trimmedReference,
            content: trimmedContent,
            source: 'scripture_note',
            metadata: {
              ...existing.metadata,
              book,
              reference: trimmedReference,
              chapter_verse: chapterVerse,
              version: resolvedVerse?.version || params.version || existing.metadata?.version || 'NASB',
              journalBlocks: prepareJournalBlocksForSave(journalBlocks),
            },
            updated_at: new Date().toISOString(),
            version: (existing.version || 1) + 1,
          });
        } else {
          await createLocalReflection({
            title: trimmedReference,
            content: trimmedContent,
            type: 'scripture',
            source: 'scripture_note',
            selected_date: dateStr,
            metadata: { book, reference: trimmedReference, chapter_verse: chapterVerse, version: resolvedVerse?.version || params.version || 'NASB', journalBlocks: prepareJournalBlocksForSave(journalBlocks) },
          });
        }
      } else {
        await createLocalReflection({
          title: trimmedReference,
          content: trimmedContent,
          type: 'scripture',
          source: 'scripture_note',
          selected_date: dateStr,
          metadata: { book, reference: trimmedReference, chapter_verse: chapterVerse, version: resolvedVerse?.version || params.version || 'NASB', journalBlocks: prepareJournalBlocksForSave(journalBlocks) },
        });
      }

      if (!editingId) {
        DeviceEventEmitter.emit(FAITHFUL_RHYTHM_UPDATED, {rhythm: 'heart_journal', selectedDate: dateStr});
        if (await claimFaithfulRhythmCelebration('heart_journal', dateStr)) {
          setIsSaving(false);
          (navigation as any).navigate('StreakPlan', {
            rhythm: 'heart_journal',
            source: 'scripture_note_complete',
            returnTo: 'moments',
          });
          return;
        }
      }

      setTimeout(() => {
        setIsSaving(false);
        successModal.showSuccess({
          title: editingId ? 'Scripture Note Updated' : 'Scripture Note Saved',
          message: editingId
            ? 'Your scripture note has been updated in your journal.'
            : 'Your scripture note has been saved to your journal.',
          showEditButton: true,
        });
      }, 100);
    } catch (saveError) {
      setIsSaving(false);
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
  const blockStyles = {
    ...s,
    ...styles,
    freeText: [styles.freeText, { fontFamily: fontFamilyRegular }],
    captureInput: [styles.captureInput, { fontFamily: fontFamilyRegular }],
  };
  const editorHeaderEntranceStyle = { opacity: editorEntranceAnims[0] };
  const editorContentEntranceStyle = {
    opacity: editorEntranceAnims[1],
    transform: [{
      translateY: editorEntranceAnims[1].interpolate({
        inputRange: [0, 1],
        outputRange: [14, 0],
      }),
    }],
  };
  const editorActionsEntranceStyle = {
    opacity: editorEntranceAnims[2],
    transform: [{
      translateY: editorEntranceAnims[2].interpolate({
        inputRange: [0, 1],
        outputRange: [10, 0],
      }),
    }],
  };
  return (
    <View style={s.container}>
      <StatusBar hidden />
      <View style={s.backgroundContainer} />

      <View style={s.header}>
        <ThemedText weight="bold" style={s.title}>{dateString}</ThemedText>
        <Animated.View style={[s.headerActions, editorHeaderEntranceStyle]}>
          {editingId && (
            <TouchableOpacity
              style={s.headerPlainButton}
              onPress={handleDelete}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Delete scripture note"
            >
              <Trash2 size={22} color={Colors.sage} strokeWidth={1.5} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.headerCloseButton}
            onPress={() => {
              triggerLightHaptic();
              handleCancel();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close scripture note"
          >
            <Ionicons name="close" size={17} color={Colors.sage} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      <KeyboardAvoidingView
        style={s.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        enabled={Platform.OS === 'ios'}
      >
        <View style={s.contentCard}>
          <ScrollView
            ref={scrollRef}
            style={s.content}
            contentContainerStyle={[s.scrollContent, { paddingBottom: notePickerOpen ? 410 : 180 }]}
            scrollIndicatorInsets={{ bottom: notePickerOpen ? 300 : 120 }}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={editorContentEntranceStyle}>
            {/* Scripture search bar — takes the place of the title input */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" style={styles.searchIcon} />
              <JournalTextInput
                ref={searchInputRef}
                autoFocus
                style={[s.entryInput, s.titleInput, s.transparentInput, styles.searchInput, { fontFamily: fontFamilyBold }]}
                placeholder="Search a Bible Verse"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={reference}
                onChangeText={(text) => {
                  setReference(text);
                  setHasChanges(true);
                }}
                keyboardAppearance="light"
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
              <View style={styles.versePreview}>
                <TouchableOpacity
                  onPress={openReader}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Read ${resolvedVerse.reference}`}
                >
                  <Text style={styles.versePreviewText}>
                    {stripWrappingQuotationMarks(resolvedVerse.text)}
                  </Text>
                </TouchableOpacity>
                <View style={styles.verseMetaRow}>
                  <ThemedText weight="semiBold" style={styles.versePreviewRef}>
                    {resolvedVerse.reference} · {resolvedVerse.version}
                  </ThemedText>
                  <TouchableOpacity
                    style={styles.verseInfoButton}
                    onPress={showReferenceInfo}
                    activeOpacity={0.72}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Bible translation information"
                  >
                    <Ionicons name="information-circle-outline" size={14} color={Colors.anchorBlueLight} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {journalBlocks.filter(block => !block.parentColumnId).map(block => {
              const index = journalBlocks.findIndex(item => item.id === block.id);
              const updateBlock = (changes: Partial<GuidedReflectionNote>) =>
                commitBlocks(journalBlocks.map(item =>
                  item.id === block.id ? { ...item, ...changes } : item,
                ));
              const removeBlock = () =>
                commitBlocks(journalBlocks.filter(item => item.id !== block.id));
              const registerBlockInput = (input: TextInput | null) => {
                if (input) {
                  blockInputRefs.current.set(block.id, input);
                  if (index === 0) contentInputRef.current = input;
                } else {
                  blockInputRefs.current.delete(block.id);
                }
              };
              const selectBlock = () => {
                setSelectedBlockId(block.id);
                setColumnTarget(null);
              };
              const wrapBlock = (content: React.ReactNode) => (
                <DraggableJournalBlock
                  key={block.id}
                  blockId={block.id}
                  tone="onDark"
                  selected={selectedBlockId === block.id}
                  shiftY={(() => {
                    if (!dragPreview || dragPreview.blockId === block.id) {
                      return 0;
                    }
                    if (
                      dragPreview.targetIndex > dragPreview.fromIndex &&
                      index > dragPreview.fromIndex &&
                      index <= dragPreview.targetIndex
                    ) {
                      return -dragPreview.blockHeight;
                    }
                    if (
                      dragPreview.targetIndex < dragPreview.fromIndex &&
                      index >= dragPreview.targetIndex &&
                      index < dragPreview.fromIndex
                    ) {
                      return dragPreview.blockHeight;
                    }
                    return 0;
                  })()}
                  onSelect={selectBlock}
                  onLayout={layout =>
                    journalBlockLayoutsRef.current.set(block.id, layout)
                  }
                  onDragStart={handleDragJournalBlockStart}
                  onDragMove={handleDragJournalBlockMove}
                  onDragEnd={handleDragJournalBlock}>
                  {content}
                </DraggableJournalBlock>
              );

              if (block.kind === 'column') {
                const nestedBlocks = journalBlocks.filter(
                  item => item.parentColumnId === block.id,
                );
                const renderNestedBlock = (nestedBlock: JournalBlock) => (
                  <JournalNestedBlockEditor
                    key={nestedBlock.id}
                    block={nestedBlock}
                    tone="onDark"
                    bibleVersion={params.version || 'NASB'}
                    onFocus={() => {
                      setSelectedBlockId(nestedBlock.id);
                      if (nestedBlock.columnSide) {
                        setColumnTarget({ columnId: block.id, side: nestedBlock.columnSide });
                      }
                    }}
                    onChange={changes =>
                      commitBlocks(journalBlocks.map(item =>
                        item.id === nestedBlock.id
                          ? { ...item, ...(changes as Partial<GuidedReflectionNote>) }
                          : item,
                      ))
                    }
                    onDelete={() =>
                      commitBlocks(journalBlocks.filter(item => item.id !== nestedBlock.id))
                    }
                    registerInput={input => {
                      if (input) blockInputRefs.current.set(nestedBlock.id, input);
                      else blockInputRefs.current.delete(nestedBlock.id);
                    }}
                  />
                );
                return wrapBlock(
                  <JournalColumnBlock
                    leftBlocks={nestedBlocks.filter(item => item.columnSide === 'left') as JournalBlock[]}
                    rightBlocks={nestedBlocks.filter(item => item.columnSide === 'right') as JournalBlock[]}
                    activeSide={columnTarget?.columnId === block.id ? columnTarget.side : null}
                    tone="onDark"
                    renderBlock={renderNestedBlock}
                    onSelectSide={side => {
                      setSelectedBlockId(block.id);
                      setColumnTarget({ columnId: block.id, side });
                    }}
                    onDelete={() =>
                      commitBlocks(journalBlocks.filter(
                        item => item.id !== block.id && item.parentColumnId !== block.id,
                      ))
                    }
                  />,
                );
              }
              return wrapBlock(
                <JournalBlockEditor
                  block={block}
                  configOverride={block.kind === 'text' ? undefined : JOURNAL_BLOCKS[block.kind]}
                  tone="onDark"
                  textPlaceholder="Write about this passage…"
                  styles={blockStyles}
                  registerInput={registerBlockInput}
                  onChange={changes =>
                    updateBlock(changes as Partial<GuidedReflectionNote>)
                  }
                  onFocus={selectBlock}
                  bibleVersion={params.version || 'NASB'}
                  onCreateSection={title =>
                    addBlock('section', {
                      text: title,
                      sectionSource: 'outline',
                    })
                  }
                  onDelete={removeBlock}
                  onCreateNextAction={block.kind === 'action' ? () => insertActionAfter(index) : undefined}
                  renderScripture={block.kind === 'scripture' ? () => (
                    <ScriptureLookupInput
                      value={block.reference || block.scriptureReference || block.text}
                      placeholder={JOURNAL_BLOCKS.scripture.placeholder}
                      version={block.scriptureVersion || params.version || 'NASB'}
                      tone="onDark"
                      style={blockStyles.captureInput}
                      registerInput={input => {
                        if (input) blockInputRefs.current.set(block.id, input);
                        else blockInputRefs.current.delete(block.id);
                      }}
                      onChange={nextReference =>
                        updateBlock({
                          text: nextReference,
                          reference: undefined,
                          scriptureText: undefined,
                          scriptureReference: undefined,
                          scriptureVersion: undefined,
                        })
                      }
                      onResolved={result =>
                        updateBlock({
                          scriptureText: result?.text,
                          scriptureReference: result?.reference,
                          scriptureVersion: result?.version,
                        })
                      }
                    />
                  ) : undefined}
                />
              );
            })}
            </Animated.View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

        <Animated.View
          pointerEvents="box-none"
          style={[styles.floatingComposer, { bottom: composerBottom }]}
        >
          <Animated.View style={[styles.floatingComposerEntrance, editorActionsEntranceStyle]}>
            {notePickerOpen && (
              <JournalPickerMenu
                items={REFLECTION_NOTE_TYPES
                  .filter(
                    item =>
                      !columnTarget || JOURNAL_BLOCKS[item.kind].allowInColumn,
                  )
                  .map(item => ({
                    key: item.kind,
                    label: item.label,
                    icon: (
                      <JournalBlockIcon
                        config={JOURNAL_BLOCKS[item.kind as keyof typeof JOURNAL_BLOCKS]}
                        size={16}
                        color={Colors.sage}
                      />
                    ),
                  }))}
                animations={notePickerAnimations}
                onSelect={async kind => {
                  triggerMediumHaptic();
                  if (kind === 'photo') {
                    closeNotePicker(async () => {
                      try {
                        const photo = await pickImageLocal();
                        if (photo) addBlock('photo', { uri: photo.uri });
                      } catch {
                        Alert.alert('Could not add photo', 'Please try choosing your photo again.');
                      }
                    });
                  } else {
                    closeNotePicker(() => addBlock(kind));
                  }
                }}
                tone="onDark"
              />
            )}
            <JournalComposerBar
              onBack={() => {
                if (notePickerOpen) closeNotePicker(handleCancel);
                else handleCancel();
              }}
              onWrite={() => {
                triggerLightHaptic();
                if (notePickerOpen) closeNotePicker(() => addBlock('text'));
                else addBlock('text');
              }}
              onAdd={() => {
                triggerLightHaptic();
                if (notePickerOpen) closeNotePicker();
                else openNotePicker();
              }}
              onNext={() => {
                if (notePickerOpen) closeNotePicker(handleSave);
                else handleSave();
              }}
              addOpen={notePickerOpen}
              plusRotation={plusRotation}
              pickerColorAnim={pickerColorAnim}
              actionAnimations={actionAnimations}
              nextIcon={isSaving ? 'hourglass-outline' : 'checkmark'}
              backLabel="Close scripture note"
              nextLabel="Save scripture note"
              nextDisabled={!canSave}
              tone="onDark"
            />
          </Animated.View>
        </Animated.View>

      <ScriptureReaderModal
        visible={showReader && !!readerReference}
        passages={[{ reference: readerReference }]}
        initialIndex={0}
        version={params.version || 'NASB'}
        onClose={() => setShowReader(false)}
        onShareScripture={handleShareScripture}
      />

      <ShareComposer
        visible={shareComposerOpen}
        text={shareComposerText}
        onClose={() => setShareComposerOpen(false)}
      />

      <BibleCopyrightModal
        visible={showCopyright}
        onClose={() => setShowCopyright(false)}
        bibleVersion={resolvedVerse?.version || params.version || 'NASB'}
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
  floatingComposer: {
    position: 'absolute',
    left: 18,
    right: 18,
    zIndex: 30,
    elevation: 30,
    alignItems: 'flex-end',
  },
  floatingComposerEntrance: {
    width: '100%',
    alignItems: 'flex-end',
  },
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
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.42)',
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    marginBottom: 20,
  },
  versePreviewText: {
    color: Colors.hopeWhite,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 28,
    opacity: 0.94,
  },
  versePreviewRef: {
    color: Colors.anchorBlueLight,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  verseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 5,
  },
  verseInfoButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeText: {
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 6,
    marginBottom: 6,
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  capture: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 14,
    padding: 12,
    marginBottom: JOURNAL_BLOCK_GAP,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  textCapture: { backgroundColor: 'rgba(255,255,255,0.1)' },
  scriptureCapture: { backgroundColor: 'rgba(255,255,255,0.12)' },
  quoteCapture: { backgroundColor: 'rgba(255,255,255,0.1)' },
  keyCapture: { backgroundColor: 'rgba(255,255,255,0.14)' },
  rememberCapture: { backgroundColor: 'rgba(255,255,255,0.12)' },
  questionCapture: { backgroundColor: 'rgba(255,255,255,0.08)' },
  responseCapture: { backgroundColor: 'rgba(255,255,255,0.14)' },
  captureHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  captureLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  captureLabel: { fontSize: 10, letterSpacing: 1.2, color: Colors.hopeWhite },
  captureInput: {
    minHeight: 54,
    paddingTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.hopeWhite,
    textAlignVertical: 'top',
  },
  secondaryInput: {
    paddingTop: 7,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.72)',
  },
});

export default ScriptureNoteEditorScreen;
