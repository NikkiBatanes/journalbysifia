import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors } from '../theme/colors';
import { Fonts, type FontFamily, getFontFamily } from '../theme/fonts';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { triggerLightHaptic } from '../utils/haptics';
import { getScripturePassage, type ScriptureReaderResult } from '../services/scriptureReaderService';
import ThemedText from './common/ThemedText';
import { BibleCopyrightModal } from './BibleCopyrightModal';

interface ScriptureReaderModalProps {
  visible: boolean;
  passages: Array<{ reference: string }>;
  initialIndex: number;
  version?: string;
  onClose: () => void;
  onShareScripture?: (text: string) => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const AnimatedThemedText = Animated.createAnimatedComponent(ThemedText);

const USER_FRIENDLY_ERROR = 'This Scripture passage could not be loaded. Please check your connection and try again.';

const FONT_SIZES = [18, 20, 22, 24, 26, 28, 30, 32];

const FONT_OPTIONS: { key: FontFamily; label: string }[] = [
  { key: 'lora', label: 'Lora' },
  { key: 'lexend', label: 'Lexend' },
  { key: 'poppins', label: 'Poppins' },
  { key: 'nunito', label: 'Nunito' },
];

type TextAlign = 'left' | 'center' | 'right' | 'justify';

const ALIGN_OPTIONS: { key: TextAlign; icon: string; label: string }[] = [
  { key: 'left', icon: 'format-align-left', label: 'Left' },
  { key: 'center', icon: 'format-align-center', label: 'Center' },
  { key: 'right', icon: 'format-align-right', label: 'Right' },
  { key: 'justify', icon: 'format-align-justify', label: 'Justify' },
];

const INDENT_OPTIONS = [0, 16, 32];
const LINE_SPACING_OPTIONS = [0, 4, 8, 12];
const LETTER_SPACING_OPTIONS = [0, 0.5, 1, 2];

const getChapterReference = (reference: string): string => {
  const match = reference.trim().match(/^(.+?\s+\d{1,3})(?::\d.*)?$/);
  return match?.[1] || reference;
};

const ScriptureReaderModal: React.FC<ScriptureReaderModalProps> = ({
  visible,
  passages,
  initialIndex,
  version = 'NASB',
  onClose,
  onShareScripture,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const verseScrollRef = useRef<ScrollView>(null);
  const scrollExpansion = useRef(new Animated.Value(0)).current;
  const settingsAnim = useRef(new Animated.Value(0)).current;
  const headerCollapseAnim = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const sheetExpandedRef = useRef(false);
  const sheetExpansionCompleteRef = useRef(false);
  const headerCollapsedRef = useRef(false);
  const suppressHeaderCollapseForDragRef = useRef(false);
  const dragStartOffsetRef = useRef(0);
  const [showFullChapter, setShowFullChapter] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [headerCollapsed, setHeaderCollapsedState] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);
  const [result, setResult] = useState<ScriptureReaderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [readerFontSize, setReaderFontSize] = useState(24);
  const [readerFont, setReaderFont] = useState<FontFamily>('lora');
  const [readerBold, setReaderBold] = useState(false);
  const [readerAlign, setReaderAlign] = useState<TextAlign>('left');
  const [readerIndent, setReaderIndent] = useState(0);
  const [readerLineSpacing, setReaderLineSpacing] = useState(0);
  const [readerLetterSpacing, setReaderLetterSpacing] = useState(0);
  const [loadedPreferencesKey, setLoadedPreferencesKey] = useState<string | null>(null);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const preferencesStorageKey = `scripture-reader-preferences:${user?.id || 'guest'}`;

  const selectedPassage = passages[Math.min(Math.max(initialIndex, 0), Math.max(passages.length - 1, 0))];
  const chapterReference = useMemo(
    () => getChapterReference(selectedPassage?.reference || ''),
    [selectedPassage?.reference],
  );
  const requestedReference = showFullChapter ? chapterReference : selectedPassage?.reference || '';

  useEffect(() => {
    let active = true;
    setLoadedPreferencesKey(null);
    AsyncStorage.getItem(preferencesStorageKey)
      .then(stored => {
        if (!active || !stored) { return; }
        const preferences = JSON.parse(stored);
        if (FONT_SIZES.includes(preferences.fontSize)) { setReaderFontSize(preferences.fontSize); }
        if (FONT_OPTIONS.some(option => option.key === preferences.font)) { setReaderFont(preferences.font); }
        if (typeof preferences.bold === 'boolean') { setReaderBold(preferences.bold); }
        if (ALIGN_OPTIONS.some(option => option.key === preferences.align)) { setReaderAlign(preferences.align); }
        if (INDENT_OPTIONS.includes(preferences.indent)) { setReaderIndent(preferences.indent); }
        if (LINE_SPACING_OPTIONS.includes(preferences.lineSpacing)) { setReaderLineSpacing(preferences.lineSpacing); }
        if (LETTER_SPACING_OPTIONS.includes(preferences.letterSpacing)) { setReaderLetterSpacing(preferences.letterSpacing); }
      })
      .catch(() => {})
      .finally(() => {
        if (active) { setLoadedPreferencesKey(preferencesStorageKey); }
      });
    return () => {
      active = false;
    };
  }, [preferencesStorageKey]);

  useEffect(() => {
    if (loadedPreferencesKey !== preferencesStorageKey) { return; }
    AsyncStorage.setItem(preferencesStorageKey, JSON.stringify({
      fontSize: readerFontSize,
      font: readerFont,
      bold: readerBold,
      align: readerAlign,
      indent: readerIndent,
      lineSpacing: readerLineSpacing,
      letterSpacing: readerLetterSpacing,
    })).catch(() => {});
  }, [loadedPreferencesKey, preferencesStorageKey, readerAlign, readerBold, readerFont, readerFontSize, readerIndent, readerLetterSpacing, readerLineSpacing]);

  useEffect(() => {
    if (!visible) { return; }
    closingRef.current = false;
    setShowFullChapter(false);
    setSettingsOpen(false);
    setAdvancedSettingsOpen(false);
    setHeaderCollapsedState(false);
    setShowCopyright(false);
    sheetExpandedRef.current = false;
    sheetExpansionCompleteRef.current = false;
    headerCollapsedRef.current = false;
    suppressHeaderCollapseForDragRef.current = false;
    dragStartOffsetRef.current = 0;
    sheetAnim.setValue(0);
    scrollExpansion.setValue(0);
    settingsAnim.setValue(0);
    headerCollapseAnim.setValue(0);
    Animated.spring(sheetAnim, {
      toValue: 1,
      tension: 72,
      friction: 10,
      useNativeDriver: false,
    }).start();
  }, [headerCollapseAnim, initialIndex, passages.length, scrollExpansion, settingsAnim, sheetAnim, visible]);

  useEffect(() => {
    if (!visible || !requestedReference) { return; }
    let active = true;
    setLoading(true);
    setError('');
    setResult(null);
    getScripturePassage(requestedReference, version)
      .then(nextResult => {
        if (active) { setResult(nextResult); }
      })
      .catch(() => {
        if (active) {
          setError(USER_FRIENDLY_ERROR);
        }
      })
      .finally(() => {
        if (active) { setLoading(false); }
      });
    return () => {
      active = false;
    };
  }, [requestedReference, version, visible]);

  const close = useCallback(() => {
    if (closingRef.current) { return; }
    closingRef.current = true;
    triggerLightHaptic();
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 190,
      useNativeDriver: false,
    }).start(onClose);
  }, [onClose, sheetAnim]);

  const shareCurrentVerse = useCallback(() => {
    if (!onShareScripture || !result?.text || closingRef.current) { return; }
    const shareText = `${result.text}\n\n— ${result.reference || requestedReference}`;
    triggerLightHaptic();
    closingRef.current = true;
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 190,
      useNativeDriver: false,
    }).start(() => {
      onClose();
      setTimeout(() => onShareScripture(shareText), 250);
    });
  }, [onClose, onShareScripture, requestedReference, result, sheetAnim]);

  const expandReadingSheet = useCallback(() => {
    if (sheetExpandedRef.current) { return; }
    sheetExpandedRef.current = true;
    sheetExpansionCompleteRef.current = false;
    Animated.timing(scrollExpansion, {
      toValue: 110,
      duration: 360,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        sheetExpansionCompleteRef.current = true;
      }
    });
  }, [scrollExpansion]);

  const restoreCompactReader = useCallback(() => {
    sheetExpandedRef.current = false;
    sheetExpansionCompleteRef.current = false;
    headerCollapsedRef.current = false;
    setHeaderCollapsedState(false);
    setSettingsOpen(false);
    Animated.parallel([
      Animated.timing(scrollExpansion, {
        toValue: 0,
        duration: 360,
        useNativeDriver: false,
      }),
      Animated.timing(headerCollapseAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.timing(settingsAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [headerCollapseAnim, scrollExpansion, settingsAnim]);

  const toggleReadingMode = () => {
    triggerLightHaptic();
    const openingFullChapter = !showFullChapter;
    setShowFullChapter(openingFullChapter);
    requestAnimationFrame(() => {
      verseScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    if (openingFullChapter) {
      expandReadingSheet();
    } else {
      restoreCompactReader();
    }
  };

  const toggleReaderSettings = () => {
    triggerLightHaptic();
    const opening = !settingsOpen;
    setSettingsOpen(opening);
    Animated.timing(settingsAnim, {
      toValue: opening ? 1 : 0,
      duration: opening ? 260 : 200,
      useNativeDriver: false,
    }).start();
  };

  const increaseFontSize = () => {
    triggerLightHaptic();
    const currentIndex = FONT_SIZES.indexOf(readerFontSize);
    const nextIndex = Math.min(currentIndex + 1, FONT_SIZES.length - 1);
    setReaderFontSize(FONT_SIZES[nextIndex]);
  };

  const decreaseFontSize = () => {
    triggerLightHaptic();
    const currentIndex = FONT_SIZES.indexOf(readerFontSize);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setReaderFontSize(FONT_SIZES[prevIndex]);
  };

  const toggleReaderBold = () => {
    triggerLightHaptic();
    setReaderBold(current => !current);
  };

  const selectReaderFont = (font: FontFamily) => {
    triggerLightHaptic();
    setReaderFont(font);
  };

  const selectReaderAlign = (align: TextAlign) => {
    triggerLightHaptic();
    setReaderAlign(align);
  };

  const increaseLineSpacing = () => {
    triggerLightHaptic();
    const currentIndex = LINE_SPACING_OPTIONS.indexOf(readerLineSpacing);
    const nextIndex = Math.min(currentIndex + 1, LINE_SPACING_OPTIONS.length - 1);
    setReaderLineSpacing(LINE_SPACING_OPTIONS[nextIndex]);
  };

  const decreaseLineSpacing = () => {
    triggerLightHaptic();
    const currentIndex = LINE_SPACING_OPTIONS.indexOf(readerLineSpacing);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setReaderLineSpacing(LINE_SPACING_OPTIONS[prevIndex]);
  };

  const increaseLetterSpacing = () => {
    triggerLightHaptic();
    const currentIndex = LETTER_SPACING_OPTIONS.indexOf(readerLetterSpacing);
    const nextIndex = Math.min(currentIndex + 1, LETTER_SPACING_OPTIONS.length - 1);
    setReaderLetterSpacing(LETTER_SPACING_OPTIONS[nextIndex]);
  };

  const decreaseLetterSpacing = () => {
    triggerLightHaptic();
    const currentIndex = LETTER_SPACING_OPTIONS.indexOf(readerLetterSpacing);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setReaderLetterSpacing(LETTER_SPACING_OPTIONS[prevIndex]);
  };

  const increaseIndent = () => {
    triggerLightHaptic();
    const currentIndex = INDENT_OPTIONS.indexOf(readerIndent);
    const nextIndex = Math.min(currentIndex + 1, INDENT_OPTIONS.length - 1);
    setReaderIndent(INDENT_OPTIONS[nextIndex]);
  };

  const decreaseIndent = () => {
    triggerLightHaptic();
    const currentIndex = INDENT_OPTIONS.indexOf(readerIndent);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setReaderIndent(INDENT_OPTIONS[prevIndex]);
  };

  const resetReaderPreferences = () => {
    triggerLightHaptic();
    setReaderFontSize(24);
    setReaderFont('lora');
    setReaderBold(false);
    setReaderAlign('left');
    setReaderIndent(0);
    setReaderLineSpacing(0);
    setReaderLetterSpacing(0);
  };

  const collapseReadingHeader = useCallback(() => {
    if (headerCollapsedRef.current) { return; }
    headerCollapsedRef.current = true;
    setHeaderCollapsedState(true);
    setSettingsOpen(false);
    Animated.timing(settingsAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
    Animated.timing(headerCollapseAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [headerCollapseAnim, settingsAnim]);

  const handleScrollBeginDrag = useCallback((event: any) => {
    dragStartOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
    suppressHeaderCollapseForDragRef.current = !sheetExpandedRef.current || !sheetExpansionCompleteRef.current;
    expandReadingSheet();
  }, [expandReadingSheet]);

  const handleReadingScroll = useCallback((event: any) => {
    const rawOffsetY = event.nativeEvent.contentOffset.y;
    const offsetY = Math.max(0, rawOffsetY);
    if (headerCollapsedRef.current) {
      if (offsetY <= 1) {
        restoreCompactReader();
      }
      return;
    }

    if (sheetExpandedRef.current && rawOffsetY < -18) {
      restoreCompactReader();
      return;
    }

    if (
      suppressHeaderCollapseForDragRef.current ||
      !sheetExpansionCompleteRef.current
    ) {
      return;
    }

    if (offsetY - dragStartOffsetRef.current > 32) {
      collapseReadingHeader();
    }
  }, [collapseReadingHeader, restoreCompactReader]);

  const collapsedHeight = Math.min(570, SCREEN_HEIGHT * 0.68);
  const expandedHeight = SCREEN_HEIGHT - Math.max(insets.top, 12);
  const sheetHeight = scrollExpansion.interpolate({
    inputRange: [0, 110],
    outputRange: [collapsedHeight, expandedHeight],
    extrapolate: 'clamp',
  });

  return (
    <>
      <Modal
        visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent={Platform.OS === 'android'}
      navigationBarTranslucent={Platform.OS === 'android'}
      hardwareAccelerated={Platform.OS === 'android'}
      onRequestClose={close}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close}>
          <Animated.View style={[styles.backdrop, { opacity: sheetAnim }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              paddingBottom: 0,
              opacity: sheetAnim,
              transform: [{
                translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }),
              }],
            },
          ]}
        >
          <View style={styles.handle} />
          <Animated.View
            pointerEvents={headerCollapsed ? 'none' : 'auto'}
            style={[
              styles.headerControlsReveal,
              {
                maxHeight: headerCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [42, 0] }),
                opacity: headerCollapseAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.35, 0] }),
                transform: [
                  { translateY: headerCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
                  { scale: headerCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) },
                ],
              },
            ]}
          >
            <View style={styles.readerToolbar}>
              <TouchableOpacity
                style={[styles.toolbarButton, settingsOpen && styles.toolbarButtonActive]}
                onPress={toggleReaderSettings}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="Reading settings"
                accessibilityState={{ expanded: settingsOpen }}
              >
                <ThemedText weight="bold" style={[styles.toolbarButtonText, settingsOpen && styles.toolbarButtonTextActive]}>aA</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={toggleReadingMode}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel={showFullChapter ? 'Back to selected verse' : 'Read full chapter'}
              >
                <MaterialCommunityIcons name="format-list-bulleted" size={14} color="rgba(255,255,255,0.65)" />
                <ThemedText weight="semiBold" style={styles.toolbarButtonText}>
                  {showFullChapter ? 'Verse' : 'Full chapter'}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={shareCurrentVerse}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel={showFullChapter ? 'Share full chapter' : 'Share verse'}
              >
                <Ionicons name="paper-plane-outline" size={14} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={close}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="Close Scripture reader"
              >
                <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View
            pointerEvents={settingsOpen ? 'auto' : 'none'}
            style={[
              styles.settingsReveal,
              {
                maxHeight: settingsAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }),
                opacity: settingsAnim,
                transform: [{
                  translateY: settingsAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
                }],
              },
            ]}
          >
            <View style={styles.settingsPanel}>
              <View style={styles.appearanceTopRow}>
                <View style={styles.quickControls}>
                  <View style={styles.sizeControls}>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={decreaseFontSize}
                      activeOpacity={0.72}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease font size"
                    >
                      <ThemedText weight="semiBold" style={styles.decreaseFontIcon}>A</ThemedText>
                    </TouchableOpacity>
                    <ThemedText weight="semiBold" style={styles.fontSizeLabel}>{readerFontSize}</ThemedText>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={increaseFontSize}
                      activeOpacity={0.72}
                      accessibilityRole="button"
                      accessibilityLabel="Increase font size"
                    >
                      <ThemedText weight="semiBold" style={styles.increaseFontIcon}>A</ThemedText>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.boldToggle, readerBold && styles.boldToggleActive]}
                    onPress={toggleReaderBold}
                    activeOpacity={0.72}
                    accessibilityRole="button"
                    accessibilityLabel="Bold text"
                    accessibilityState={{ selected: readerBold }}
                  >
                    <ThemedText weight="semiBold" style={[styles.boldToggleText, readerBold && styles.boldToggleTextActive]}>Bold</ThemedText>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.resetIconButton}
                  onPress={resetReaderPreferences}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Reset reader settings"
                >
                  <Ionicons name="refresh-outline" size={15} color="rgba(242,245,247,0.52)" />
                </TouchableOpacity>
              </View>

              <View style={styles.optionGroup}>
                <View style={styles.fontControls}>
                  {FONT_OPTIONS.map(option => {
                    const isActive = option.key === readerFont;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[styles.fontChip, isActive && styles.fontChipActive]}
                        onPress={() => selectReaderFont(option.key)}
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel={`Set font to ${option.label}`}
                      >
                        <ThemedText
                          weight="semiBold"
                          style={[styles.fontChipText, isActive && styles.fontChipTextActive]}
                        >
                          {option.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.optionDivider} />
                <View style={styles.alignControls}>
                  {ALIGN_OPTIONS.map(option => {
                    const isActive = option.key === readerAlign;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[styles.alignButton, isActive && styles.fontChipActive]}
                        onPress={() => selectReaderAlign(option.key)}
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel={`Align ${option.label}`}
                      >
                        <MaterialCommunityIcons
                          name={option.icon}
                          size={16}
                          color={isActive ? Colors.faithGold : 'rgba(242,245,247,0.72)'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={styles.advancedButton}
                onPress={() => {
                  triggerLightHaptic();
                  setAdvancedSettingsOpen(current => !current);
                }}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="Toggle advanced text settings"
                accessibilityState={{ expanded: advancedSettingsOpen }}
              >
                <ThemedText style={styles.advancedButtonText}>Advanced</ThemedText>
                <Ionicons name={advancedSettingsOpen ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(242,245,247,0.62)" />
              </TouchableOpacity>
              {advancedSettingsOpen && (
                <View style={styles.advancedSettings}>
                  <View style={styles.settingsRow}>
                    <ThemedText style={styles.settingsLabel}>Lines</ThemedText>
                    <View style={styles.sizeControls}>
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={decreaseLineSpacing}
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel="Decrease line spacing"
                      >
                        <ThemedText weight="semiBold" style={styles.controlButtonText}>−</ThemedText>
                      </TouchableOpacity>
                      <ThemedText weight="semiBold" style={styles.fontSizeLabel}>{readerLineSpacing}</ThemedText>
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={increaseLineSpacing}
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel="Increase line spacing"
                      >
                        <ThemedText weight="semiBold" style={styles.controlButtonText}>+</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.settingsRow}>
                    <ThemedText style={styles.settingsLabel}>Letters</ThemedText>
                    <View style={styles.sizeControls}>
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={decreaseLetterSpacing}
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel="Decrease letter spacing"
                      >
                        <ThemedText weight="semiBold" style={styles.controlButtonText}>−</ThemedText>
                      </TouchableOpacity>
                      <ThemedText weight="semiBold" style={styles.fontSizeLabel}>{readerLetterSpacing}</ThemedText>
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={increaseLetterSpacing}
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel="Increase letter spacing"
                      >
                        <ThemedText weight="semiBold" style={styles.controlButtonText}>+</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.settingsRow}>
                    <ThemedText style={styles.settingsLabel}>Indent</ThemedText>
                    <View style={styles.sizeControls}>
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={decreaseIndent}
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel="Decrease indent"
                      >
                        <ThemedText weight="semiBold" style={styles.controlButtonText}>−</ThemedText>
                      </TouchableOpacity>
                      <ThemedText weight="semiBold" style={styles.fontSizeLabel}>{readerIndent}</ThemedText>
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={increaseIndent}
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel="Increase indent"
                      >
                        <ThemedText weight="semiBold" style={styles.controlButtonText}>+</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.headingBlock,
              {
                marginTop: headerCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
              },
            ]}
          >
            <AnimatedThemedText
              weight="bold"
              style={[
                styles.eyebrow,
                {
                  marginBottom: headerCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 3] }),
                  fontSize: headerCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [11, 9] }),
                  lineHeight: headerCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 12] }),
                },
              ]}
            >
              READ SCRIPTURE
            </AnimatedThemedText>
            <AnimatedThemedText
              weight="bold"
              style={[
                styles.reference,
                {
                  fontSize: headerCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [27, 19] }),
                  lineHeight: headerCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [36, 26] }),
                },
              ]}
            >
              {result?.reference || requestedReference}
            </AnimatedThemedText>
            <Animated.View
              style={{
                maxHeight: headerCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }),
                opacity: headerCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                overflow: 'hidden',
              }}
            >
              <View style={styles.versionInfoRow}>
                <ThemedText weight="semiBold" style={styles.version}>{result?.version || version}</ThemedText>
                <TouchableOpacity
                  style={styles.versionInfoButton}
                  onPress={() => {
                    triggerLightHaptic();
                    setShowCopyright(true);
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`About the ${result?.version || version} Bible translation`}
                >
                  <Ionicons name="information-circle-outline" size={15} color="rgba(242,245,247,0.58)" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>

          <ScrollView
            ref={verseScrollRef}
            style={styles.verseScroll}
            contentContainerStyle={styles.verseScrollContent}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScrollBeginDrag={handleScrollBeginDrag}
            onScroll={handleReadingScroll}
          >
            {loading ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={Colors.alertCoral} />
                <ThemedText style={styles.loadingText}>Loading Scripture…</ThemedText>
              </View>
            ) : error ? (
              <View style={styles.loadingBlock}>
                <Ionicons name="cloud-offline-outline" size={24} color={Colors.alertCoral} />
                <ThemedText style={styles.errorText}>{error}</ThemedText>
                <TouchableOpacity style={styles.retryButton} onPress={() => {
                  setError('');
                  setLoading(true);
                  getScripturePassage(requestedReference, version)
                    .then(setResult)
                    .catch(() => setError(USER_FRIENDLY_ERROR))
                    .finally(() => setLoading(false));
                }}>
                  <ThemedText weight="semiBold" style={styles.retryText}>Try again</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <Text
                selectable
                style={[
                  styles.verseText,
                  {
                    fontFamily: getFontFamily(readerFont, readerBold ? 'bold' : 'regular'),
                    fontSize: readerFontSize,
                    lineHeight: readerFontSize + 14 + readerLineSpacing,
                    letterSpacing: readerLetterSpacing,
                    textAlign: readerAlign,
                    paddingLeft: readerIndent,
                  },
                ]}
              >
                {result?.text || ''}
              </Text>
            )}
          </ScrollView>
        </Animated.View>
        <BibleCopyrightModal
          visible={showCopyright}
          onClose={() => setShowCopyright(false)}
          bibleVersion={result?.version || version}
          contained
        />
      </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,15,30,0.72)',
  },
  sheet: {
    width: '100%',
    paddingHorizontal: 22,
    paddingTop: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: Colors.modalBlue,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    marginBottom: 24,
    borderRadius: 3,
    backgroundColor: 'rgba(242,245,247,0.30)',
  },
  headingBlock: {
    alignSelf: 'stretch',
  },
  headerControlsReveal: {
    overflow: 'hidden',
  },
  readerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  toolbarButton: {
    minHeight: 36,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  toolbarButtonActive: {
    backgroundColor: 'rgba(245,166,35,0.20)',
  },
  toolbarButtonText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
  },
  toolbarButtonTextActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  settingsReveal: {
    overflow: 'hidden',
  },
  settingsPanel: {
    marginTop: 12,
    paddingTop: 14,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(242,245,247,0.16)',
    gap: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsLabel: {
    width: 56,
    fontSize: 12,
    color: 'rgba(242,245,247,0.62)',
  },
  sizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  controlButtonText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  decreaseFontIcon: {
    fontSize: 12,
    color: 'rgba(242,245,247,0.72)',
  },
  increaseFontIcon: {
    fontSize: 18,
    color: Colors.hopeWhite,
  },
  appearanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boldToggle: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242,245,247,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  boldToggleActive: {
    borderColor: 'rgba(245,166,35,0.42)',
    backgroundColor: 'rgba(245,166,35,0.22)',
  },
  boldToggleText: {
    fontSize: 12,
    color: 'rgba(242,245,247,0.72)',
  },
  boldToggleTextActive: {
    color: Colors.faithGold,
  },
  resetIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  fontSizeLabel: {
    width: 28,
    textAlign: 'center',
    fontSize: 13,
    color: Colors.faithGold,
  },
  optionGroup: {
    padding: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  fontControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  optionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    backgroundColor: 'rgba(242,245,247,0.12)',
  },
  alignControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  alignButton: {
    flex: 1,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 5,
  },
  advancedButtonText: {
    fontSize: 11,
    color: 'rgba(242,245,247,0.62)',
  },
  advancedSettings: {
    paddingTop: 2,
    gap: 10,
  },
  fontChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  fontChipActive: {
    backgroundColor: 'rgba(245,166,35,0.28)',
  },
  fontChipText: {
    fontSize: 11,
    color: 'rgba(242,245,247,0.72)',
  },
  fontChipTextActive: {
    color: Colors.faithGold,
  },
  eyebrow: {
    marginBottom: 8,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.5,
    color: Colors.alertCoral,
  },
  reference: {
    fontSize: 27,
    lineHeight: 36,
    paddingBottom: 1,
    color: Colors.hopeWhite,
  },
  versionInfoRow: {
    minHeight: 22,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  version: {
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 1,
    color: 'rgba(242,245,247,0.52)',
  },
  versionInfoButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  verseScroll: {
    flex: 1,
    marginTop: 14,
  },
  verseScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingBottom: 24,
  },
  verseText: {
    fontFamily: Fonts.lora.regular,
    fontSize: 24,
    lineHeight: 38,
    color: Colors.hopeWhite,
  },
  loadingBlock: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: 'rgba(242,245,247,0.62)',
  },
  errorText: {
    maxWidth: 300,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: 'rgba(242,245,247,0.72)',
  },
  retryButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.42)',
  },
  retryText: {
    fontSize: 12,
    color: Colors.faithGold,
  },
});

export default ScriptureReaderModal;
