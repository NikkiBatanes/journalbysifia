import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { differenceInCalendarDays } from 'date-fns';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ThemedText from '../../components/common/ThemedText';
import { BibleCopyrightModal } from '../../components/BibleCopyrightModal';
import { Colors } from '../../theme/colors';
import { Fonts, type FontFamily, getFontFamily } from '../../theme/fonts';
import { toLocalDateString } from '../../utils/date';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useRoutine } from '../../context/RoutineContext';
import { exitMorningFlow } from '../../navigation/exitEveningFlow';
import RoutineStepShell from '../../components/routine/RoutineStepShell';
import { getScripturePassage } from '../../services/scriptureReaderService';
import {
  createLocalReflection,
  getLocalReflection,
  getLocalReflections,
  updateLocalReflection,
} from '../../storage/reflectionStorage';

type TextAlign = 'left' | 'center' | 'right' | 'justify';

const FONT_OPTIONS: { key: FontFamily; label: string }[] = [
  { key: 'lora', label: 'Lora' },
  { key: 'lexend', label: 'Lexend' },
  { key: 'poppins', label: 'Poppins' },
  { key: 'nunito', label: 'Nunito' },
];

const ALIGN_OPTIONS: { key: TextAlign; icon: string; label: string }[] = [
  { key: 'left', icon: 'format-align-left', label: 'Left' },
  { key: 'center', icon: 'format-align-center', label: 'Center' },
  { key: 'right', icon: 'format-align-right', label: 'Right' },
  { key: 'justify', icon: 'format-align-justify', label: 'Justify' },
];

const FONT_SIZES = [18, 20, 22, 24, 26, 28, 30, 32];

const INDENT_OPTIONS = [0, 16, 32];
const LINE_SPACING_OPTIONS = [0, 4, 8, 12];
const LETTER_SPACING_OPTIONS = [0, 0.5, 1, 2];

const PsalmOfTheDayScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { selectedDate, markStepCompleted } = useRoutine();

  const psalmNumber = useMemo(() => {
    const createdAt = (user as any)?.created_at;
    const start = createdAt ? new Date(createdAt) : new Date();
    const dayIndex = Math.max(0, differenceInCalendarDays(new Date(), start));
    return (dayIndex % 150) + 1;
  }, [user]);

  const [psalmText, setPsalmText] = useState<string | null>(null);
  const [psalmVerses, setPsalmVerses] = useState<{ number: string; lines: string[] }[] | null>(null);
  const [psalmReference, setPsalmReference] = useState<string | null>(null);
  const [psalmVersion, setPsalmVersion] = useState<string | null>(null);
  const [psalmLoading, setPsalmLoading] = useState(false);
  const [psalmError, setPsalmError] = useState<string | null>(null);
  const [showAaSettings, setShowAaSettings] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);
  const [hasReadPsalm, setHasReadPsalm] = useState(false);
  const [psalmReflectionId, setPsalmReflectionId] = useState<string | null>(null);

  const [psalmFontSize, setPsalmFontSize] = useState(18);
  const [psalmFont, setPsalmFont] = useState<FontFamily>('lora');
  const [psalmBold, setPsalmBold] = useState(false);
  const [psalmAlign, setPsalmAlign] = useState<TextAlign>('left');
  const [psalmIndent, setPsalmIndent] = useState(0);
  const [psalmLineSpacing, setPsalmLineSpacing] = useState(0);
  const [psalmLetterSpacing, setPsalmLetterSpacing] = useState(0);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);

  const settingsAnim = useRef(new Animated.Value(0)).current;

  const dateStr = toLocalDateString(new Date(selectedDate));

  useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await getLocalReflections('scripture', dateStr);
      if (!mounted) {return;}
      const existing = entries
        .filter(e => e.source === 'morning_psalm' || e.metadata?.source === 'morning_psalm')
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
      if (existing) {
        setHasReadPsalm(Boolean(existing.metadata?.psalmRead));
        setPsalmReflectionId(existing.id);
      }
    })();
    return () => { mounted = false; };
  }, [dateStr, psalmNumber]);

  const psalmLines = useMemo(() => {
    if (!psalmText) { return []; }
    if (psalmText.includes('\n')) { return psalmText.split('\n'); }
    return psalmText.split(/\s+(?=\d+\s)/).map((s) => s.trim()).filter(Boolean);
  }, [psalmText]);

  useEffect(() => {
    let cancelled = false;
    setPsalmLoading(true);
    setPsalmError(null);
    getScripturePassage(`Psalm ${psalmNumber}`)
      .then((result) => {
        if (cancelled) { return; }
        setPsalmText(result.text);
        setPsalmVerses(result.verses || null);
        setPsalmReference(result.reference);
        setPsalmVersion(result.version);
      })
      .catch((err) => {
        if (cancelled) { return; }
        setPsalmError(err?.message || 'Could not load Psalm of the Day.');
      })
      .finally(() => {
        if (!cancelled) { setPsalmLoading(false); }
      });
    return () => { cancelled = true; };
  }, [psalmNumber]);

  const onNext = React.useCallback(async () => {
    triggerLightHaptic();

    const metadata = {
      psalmNumber,
      psalmRead: hasReadPsalm,
      source: 'morning_psalm',
    };

    let id = psalmReflectionId;
    try {
      if (id) {
        const existing = await getLocalReflection(id, 'scripture', dateStr);
        if (existing) {
          const updated = await updateLocalReflection({
            ...existing,
            title: `Psalm ${psalmNumber}`,
            content: existing.content,
            metadata: { ...existing.metadata, ...metadata },
          });
          id = updated.id;
        } else {
          const created = await createLocalReflection({
            title: `Psalm ${psalmNumber}`,
            content: '',
            type: 'scripture',
            source: 'morning_psalm',
            selected_date: dateStr,
            metadata,
          });
          id = created.id;
        }
      } else {
        const created = await createLocalReflection({
          title: `Psalm ${psalmNumber}`,
          content: '',
          type: 'scripture',
          source: 'morning_psalm',
          selected_date: dateStr,
          metadata,
        });
        id = created.id;
      }
      setPsalmReflectionId(id);
    } catch (error) {
      console.error('Error saving morning psalm read state:', error);
    }

    await markStepCompleted(
      'psalm',
      {
        domain: 'reflection',
        content_type: 'scripture',
        local_id: id!,
      },
      'psalm',
    );

    navigation.navigate('CarryIt');
  }, [hasReadPsalm, markStepCompleted, navigation, psalmNumber, psalmReflectionId, dateStr]);

  const togglePsalmRead = React.useCallback(() => {
    if (hasReadPsalm) {
      triggerLightHaptic();
    } else {
      triggerSuccessHaptic();
    }
    setHasReadPsalm((current) => !current);
  }, [hasReadPsalm]);

  const psalmLineStyle = useMemo(() => ({
    fontSize: psalmFontSize,
    lineHeight: psalmFontSize * 1.6 + psalmLineSpacing,
    letterSpacing: psalmLetterSpacing,
    textAlign: psalmAlign,
    paddingLeft: psalmIndent,
    fontFamily: getFontFamily(psalmFont, psalmBold ? 'bold' : 'regular'),
  }), [psalmAlign, psalmBold, psalmFont, psalmFontSize, psalmIndent, psalmLetterSpacing, psalmLineSpacing]);

  const togglePsalmSettings = useCallback(() => {
    triggerLightHaptic();
    const opening = !showAaSettings;
    setShowAaSettings(opening);
    Animated.timing(settingsAnim, {
      toValue: opening ? 1 : 0,
      duration: opening ? 260 : 200,
      useNativeDriver: false,
    }).start();
  }, [settingsAnim, showAaSettings]);

  const togglePsalmBold = useCallback(() => {
    triggerLightHaptic();
    setPsalmBold(current => !current);
  }, []);

  const selectPsalmFont = useCallback((font: FontFamily) => {
    triggerLightHaptic();
    setPsalmFont(font);
  }, []);

  const selectPsalmAlign = useCallback((align: TextAlign) => {
    triggerLightHaptic();
    setPsalmAlign(align);
  }, []);

  const increasePsalmFontSize = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = FONT_SIZES.indexOf(psalmFontSize);
    const nextIndex = Math.min(currentIndex + 1, FONT_SIZES.length - 1);
    setPsalmFontSize(FONT_SIZES[nextIndex]);
  }, [psalmFontSize]);

  const decreasePsalmFontSize = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = FONT_SIZES.indexOf(psalmFontSize);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setPsalmFontSize(FONT_SIZES[prevIndex]);
  }, [psalmFontSize]);

  const increasePsalmLineSpacing = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = LINE_SPACING_OPTIONS.indexOf(psalmLineSpacing);
    const nextIndex = Math.min(currentIndex + 1, LINE_SPACING_OPTIONS.length - 1);
    setPsalmLineSpacing(LINE_SPACING_OPTIONS[nextIndex]);
  }, [psalmLineSpacing]);

  const decreasePsalmLineSpacing = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = LINE_SPACING_OPTIONS.indexOf(psalmLineSpacing);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setPsalmLineSpacing(LINE_SPACING_OPTIONS[prevIndex]);
  }, [psalmLineSpacing]);

  const increasePsalmLetterSpacing = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = LETTER_SPACING_OPTIONS.indexOf(psalmLetterSpacing);
    const nextIndex = Math.min(currentIndex + 1, LETTER_SPACING_OPTIONS.length - 1);
    setPsalmLetterSpacing(LETTER_SPACING_OPTIONS[nextIndex]);
  }, [psalmLetterSpacing]);

  const decreasePsalmLetterSpacing = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = LETTER_SPACING_OPTIONS.indexOf(psalmLetterSpacing);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setPsalmLetterSpacing(LETTER_SPACING_OPTIONS[prevIndex]);
  }, [psalmLetterSpacing]);

  const increasePsalmIndent = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = INDENT_OPTIONS.indexOf(psalmIndent);
    const nextIndex = Math.min(currentIndex + 1, INDENT_OPTIONS.length - 1);
    setPsalmIndent(INDENT_OPTIONS[nextIndex]);
  }, [psalmIndent]);

  const decreasePsalmIndent = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = INDENT_OPTIONS.indexOf(psalmIndent);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setPsalmIndent(INDENT_OPTIONS[prevIndex]);
  }, [psalmIndent]);

  const resetPsalmPreferences = useCallback(() => {
    triggerLightHaptic();
    setPsalmFontSize(18);
    setPsalmFont('lora');
    setPsalmBold(false);
    setPsalmAlign('left');
    setPsalmIndent(0);
    setPsalmLineSpacing(0);
    setPsalmLetterSpacing(0);
  }, []);

  const onBack = () => exitMorningFlow(navigation, 'Today');

  const children = (
    <>
      {psalmReference && psalmVersion && (
        <View style={styles.psalmReferenceRow}>
          <ThemedText weight="semiBold" style={styles.psalmReference}>
            {psalmReference} · {psalmVersion}
          </ThemedText>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              setShowCopyright(true);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Bible translation information">
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={Colors.sage}
            />
          </TouchableOpacity>
        </View>
      )}

      <Animated.View
        pointerEvents={showAaSettings ? 'auto' : 'none'}
        style={[
          styles.psalmSettingsPanel,
          {
            maxHeight: settingsAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }),
            opacity: settingsAnim,
            transform: [{ translateY: settingsAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}
      >
        <View style={styles.psalmAppearanceTopRow}>
          <View style={styles.psalmQuickControls}>
            <View style={styles.psalmSizeControls}>
              <TouchableOpacity
                style={styles.psalmControlButton}
                onPress={decreasePsalmFontSize}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="Decrease font size"
              >
                <ThemedText weight="semiBold" style={styles.psalmDecreaseFontIcon}>A</ThemedText>
              </TouchableOpacity>
              <ThemedText weight="semiBold" style={styles.psalmFontSizeLabel}>{psalmFontSize}</ThemedText>
              <TouchableOpacity
                style={styles.psalmControlButton}
                onPress={increasePsalmFontSize}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="Increase font size"
              >
                <ThemedText weight="semiBold" style={styles.psalmIncreaseFontIcon}>A</ThemedText>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.psalmBoldToggle, psalmBold && styles.psalmBoldToggleActive]}
              onPress={togglePsalmBold}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="Bold text"
              accessibilityState={{ selected: psalmBold }}
            >
              <ThemedText weight="semiBold" style={[styles.psalmBoldToggleText, psalmBold && styles.psalmBoldToggleTextActive]}>Bold</ThemedText>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.psalmResetIconButton}
            onPress={resetPsalmPreferences}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Reset reader settings"
          >
            <Ionicons name="refresh-outline" size={15} color={Colors.sage} />
          </TouchableOpacity>
        </View>

        <View style={styles.psalmOptionGroup}>
          <View style={styles.psalmFontControls}>
            {FONT_OPTIONS.map(option => {
              const isActive = option.key === psalmFont;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.psalmFontChip, isActive && styles.psalmFontChipActive]}
                  onPress={() => selectPsalmFont(option.key)}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel={`Set font to ${option.label}`}
                >
                  <ThemedText
                    weight="semiBold"
                    style={[styles.psalmFontChipText, isActive && styles.psalmFontChipTextActive]}
                  >
                    {option.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.psalmOptionDivider} />
          <View style={styles.psalmAlignControls}>
            {ALIGN_OPTIONS.map(option => {
              const isActive = option.key === psalmAlign;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.psalmAlignButton, isActive && styles.psalmFontChipActive]}
                  onPress={() => selectPsalmAlign(option.key)}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel={`Align ${option.label}`}
                >
                  <MaterialCommunityIcons
                    name={option.icon}
                    size={16}
                    color={isActive ? Colors.hopeWhite : Colors.textGray}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={styles.psalmAdvancedButton}
          onPress={() => {
            triggerLightHaptic();
            setAdvancedSettingsOpen(current => !current);
          }}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Toggle advanced text settings"
          accessibilityState={{ expanded: advancedSettingsOpen }}
        >
          <ThemedText style={styles.psalmAdvancedButtonText}>Advanced</ThemedText>
          <Ionicons name={advancedSettingsOpen ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textGray} />
        </TouchableOpacity>

        {advancedSettingsOpen && (
          <View style={styles.psalmAdvancedSettings}>
            <View style={styles.psalmSettingsRow}>
              <ThemedText style={styles.psalmSettingsLabel}>Lines</ThemedText>
              <View style={styles.psalmSizeControls}>
                <TouchableOpacity
                  style={styles.psalmControlButton}
                  onPress={decreasePsalmLineSpacing}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease line spacing"
                >
                  <ThemedText weight="semiBold" style={styles.psalmControlButtonText}>−</ThemedText>
                </TouchableOpacity>
                <ThemedText weight="semiBold" style={styles.psalmFontSizeLabel}>{psalmLineSpacing}</ThemedText>
                <TouchableOpacity
                  style={styles.psalmControlButton}
                  onPress={increasePsalmLineSpacing}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Increase line spacing"
                >
                  <ThemedText weight="semiBold" style={styles.psalmControlButtonText}>+</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.psalmSettingsRow}>
              <ThemedText style={styles.psalmSettingsLabel}>Letters</ThemedText>
              <View style={styles.psalmSizeControls}>
                <TouchableOpacity
                  style={styles.psalmControlButton}
                  onPress={decreasePsalmLetterSpacing}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease letter spacing"
                >
                  <ThemedText weight="semiBold" style={styles.psalmControlButtonText}>−</ThemedText>
                </TouchableOpacity>
                <ThemedText weight="semiBold" style={styles.psalmFontSizeLabel}>{psalmLetterSpacing}</ThemedText>
                <TouchableOpacity
                  style={styles.psalmControlButton}
                  onPress={increasePsalmLetterSpacing}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Increase letter spacing"
                >
                  <ThemedText weight="semiBold" style={styles.psalmControlButtonText}>+</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.psalmSettingsRow}>
              <ThemedText style={styles.psalmSettingsLabel}>Indent</ThemedText>
              <View style={styles.psalmSizeControls}>
                <TouchableOpacity
                  style={styles.psalmControlButton}
                  onPress={decreasePsalmIndent}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease indent"
                >
                  <ThemedText weight="semiBold" style={styles.psalmControlButtonText}>−</ThemedText>
                </TouchableOpacity>
                <ThemedText weight="semiBold" style={styles.psalmFontSizeLabel}>{psalmIndent}</ThemedText>
                <TouchableOpacity
                  style={styles.psalmControlButton}
                  onPress={increasePsalmIndent}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Increase indent"
                >
                  <ThemedText weight="semiBold" style={styles.psalmControlButtonText}>+</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Animated.View>

      <View style={styles.card}>
        <ScrollView
          style={styles.psalmScroll}
          contentContainerStyle={styles.psalmContent}
          showsVerticalScrollIndicator={false}
        >
          {psalmLoading ? (
            <ActivityIndicator color={Colors.sage} style={styles.psalmLoader} />
          ) : psalmError ? (
            <Text style={[styles.psalmLine, psalmLineStyle]}>{psalmError}</Text>
          ) : psalmVerses && psalmVerses.length > 0 ? (
            <>
              {psalmVerses.map((verse, vIndex) => (
                <View key={`psalm-verse-${vIndex}`} style={styles.verseRow}>
                  <Text
                    style={[
                      styles.verseNumber,
                      {
                        fontSize: psalmFontSize,
                        lineHeight: psalmFontSize * 1.6 + psalmLineSpacing,
                        fontFamily: getFontFamily(psalmFont, 'bold'),
                      },
                    ]}>
                    {verse.number}
                  </Text>
                  <View style={styles.verseLines}>
                    {verse.lines.map((line, lIndex) => (
                      <Text
                        key={`psalm-line-${vIndex}-${lIndex}`}
                        style={[styles.verseLine, psalmLineStyle]}>
                        {line}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </>
          ) : (
            <>
              {psalmLines.map((line, index) => (
                line.trim() === '' ? (
                  <View key={`psalm-space-${index}`} style={styles.psalmStanzaBreak} />
                ) : (
                  <Text
                    key={`psalm-line-${index}`}
                    style={[styles.psalmLine, psalmLineStyle]}
                  >
                    {line.trim()}
                  </Text>
                )
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );

  const footer = (
    <View style={styles.footerRow}>
      <TouchableOpacity
        style={[styles.readButton, hasReadPsalm && styles.readButtonActive]}
        onPress={togglePsalmRead}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hasReadPsalm }}
        accessibilityLabel={`I've read Psalm ${psalmNumber}`}
      >
        <Ionicons
          name={hasReadPsalm ? 'checkmark-circle' : 'book-outline'}
          size={16}
          color={hasReadPsalm ? Colors.hopeWhite : Colors.sage}
        />
        <ThemedText weight="medium" style={[styles.readButtonText, hasReadPsalm && styles.readButtonTextActive]}>
          {hasReadPsalm ? `Psalm ${psalmNumber} read` : `I've read Psalm ${psalmNumber}`}
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onNext}
        activeOpacity={0.7}
        style={styles.primaryButton}
        accessibilityRole="button"
        accessibilityLabel="Next"
      >
        <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
      </TouchableOpacity>
    </View>
  );

  const aAButton = (
    <TouchableOpacity
      style={[styles.aaHeaderButton, showAaSettings && styles.aaHeaderButtonActive]}
      onPress={togglePsalmSettings}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel="Text settings"
      accessibilityState={{ expanded: showAaSettings }}
    >
      <ThemedText weight="bold" style={[styles.aaHeaderButtonText, showAaSettings && styles.aaHeaderButtonTextActive]}>aA</ThemedText>
    </TouchableOpacity>
  );

  return (
    <RoutineStepShell
      titleBottomSpacing={16}
      step={4}
      totalSteps={6}
      eyebrow="PSALM OF THE DAY"
      title={`Psalm ${psalmNumber}`}
      footer={footer}
      onBack={onBack}
      backgroundColor={Colors.lightBackground}
      rightControl={aAButton}
      manageStatusBar={false}
    >
      {children}

      <BibleCopyrightModal
        visible={showCopyright}
        onClose={() => setShowCopyright(false)}
        bibleVersion={psalmVersion || ''}
      />
    </RoutineStepShell>
  );
};

const styles = StyleSheet.create({
  psalmReferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 0,
    marginBottom: 4,
  },
  psalmReference: {
    color: Colors.sage,
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  aaHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF2EA',
    borderWidth: 0.5,
    borderColor: 'rgba(82, 106, 91, 0.2)',
  },
  aaHeaderButtonActive: {
    backgroundColor: '#E2EBDD',
    borderColor: 'rgba(82, 106, 91, 0.2)',
  },
  aaHeaderButtonText: {
    fontSize: 16,
    color: Colors.sage,
  },
  aaHeaderButtonTextActive: {
    color: Colors.sage,
  },
  psalmSettingsPanel: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 22,
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.2)',
    overflow: 'hidden',
    gap: 12,
  },
  psalmAppearanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  psalmQuickControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  psalmSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  psalmControlButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82, 106, 91, 0.1)',
  },
  psalmControlButtonText: {
    fontSize: 14,
    color: Colors.text,
  },
  psalmDecreaseFontIcon: {
    fontSize: 12,
    color: Colors.textGray,
  },
  psalmIncreaseFontIcon: {
    fontSize: 18,
    color: Colors.text,
  },
  psalmFontSizeLabel: {
    width: 28,
    textAlign: 'center',
    fontSize: 13,
    color: Colors.sage,
  },
  psalmBoldToggle: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.2)',
    backgroundColor: 'rgba(82, 106, 91, 0.06)',
  },
  psalmBoldToggleActive: {
    borderColor: Colors.sage,
    backgroundColor: Colors.sage,
  },
  psalmBoldToggleText: {
    fontSize: 12,
    color: Colors.text,
  },
  psalmBoldToggleTextActive: {
    color: Colors.hopeWhite,
  },
  psalmResetIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82, 106, 91, 0.06)',
  },
  psalmOptionGroup: {
    padding: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(82, 106, 91, 0.06)',
  },
  psalmFontControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  psalmFontChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82, 106, 91, 0.1)',
  },
  psalmFontChipActive: {
    backgroundColor: Colors.sage,
  },
  psalmFontChipText: {
    fontSize: 11,
    color: Colors.text,
  },
  psalmFontChipTextActive: {
    color: Colors.hopeWhite,
  },
  psalmOptionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    backgroundColor: 'rgba(82, 106, 91, 0.15)',
  },
  psalmAlignControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  psalmAlignButton: {
    flex: 1,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  psalmAdvancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 5,
  },
  psalmAdvancedButtonText: {
    fontSize: 11,
    color: Colors.textGray,
  },
  psalmAdvancedSettings: {
    paddingTop: 2,
    gap: 10,
  },
  psalmSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  psalmSettingsLabel: {
    width: 56,
    fontSize: 12,
    color: Colors.textGray,
  },
  card: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingBottom: 22,
    paddingTop: 4,
    minHeight: 320,
  },
  psalmScroll: {
    flex: 1,
  },
  psalmContent: {
    paddingBottom: 8,
  },
  psalmLoader: {
    marginTop: 20,
  },
  psalmLine: {
    color: Colors.text,
    marginBottom: 6,
  },
  psalmStanzaBreak: {
    height: 16,
  },
  verseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  verseNumber: {
    width: 48,
    paddingRight: 12,
    color: Colors.sage,
  },
  verseLines: {
    flex: 1,
  },
  verseLine: {
    color: Colors.text,
    marginBottom: 6,
  },
  footerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(82, 106, 91, 0.2)',
  },
  readButtonActive: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  readButtonText: {
    color: Colors.text,
    fontSize: 15,
  },
  readButtonTextActive: {
    color: Colors.hopeWhite,
  },
  primaryButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.sage,
    borderRadius: 20,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default PsalmOfTheDayScreen;
