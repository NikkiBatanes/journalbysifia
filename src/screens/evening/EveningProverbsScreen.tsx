import { exitEveningFlow } from '../../navigation/exitEveningFlow';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, DeviceEventEmitter, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ThemedText from '../../components/common/ThemedText';
import { BibleCopyrightModal } from '../../components/BibleCopyrightModal';
import { Colors } from '../../theme/colors';
import { Fonts, type FontFamily, getFontFamily } from '../../theme/fonts';
import { toLocalDateString } from '../../utils/date';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import { useRoutine } from '../../context/RoutineContext';
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

const EveningProverbsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { selectedDate, markStepCompleted } = useRoutine();


  const proverbNumber = useMemo(() => {
    const day = parseInt(selectedDate.split('-')[2] || '0', 10);
    return Math.min(Math.max(day, 1), 31);
  }, [selectedDate]);

  const [proverbText, setProverbText] = useState<string | null>(null);
  const [proverbVerses, setProverbVerses] = useState<{ number: string; lines: string[] }[] | null>(null);
  const [proverbReference, setProverbReference] = useState<string | null>(null);
  const [proverbVersion, setProverbVersion] = useState<string | null>(null);
  const [proverbLoading, setProverbLoading] = useState(false);
  const [proverbError, setProverbError] = useState<string | null>(null);
  const [showAaSettings, setShowAaSettings] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);
  const [hasReadProverb, setHasReadProverb] = useState(false);
  const [proverbReflectionId, setProverbReflectionId] = useState<string | null>(null);

  const [proverbFontSize, setProverbFontSize] = useState(18);
  const [proverbFont, setProverbFont] = useState<FontFamily>('lora');
  const [proverbBold, setProverbBold] = useState(false);
  const [proverbAlign, setProverbAlign] = useState<TextAlign>('left');
  const [proverbIndent, setProverbIndent] = useState(0);
  const [proverbLineSpacing, setProverbLineSpacing] = useState(0);
  const [proverbLetterSpacing, setProverbLetterSpacing] = useState(0);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);

  const settingsAnim = useRef(new Animated.Value(0)).current;

  const dateStr = toLocalDateString(new Date(selectedDate));

  useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await getLocalReflections('scripture', dateStr);
      if (!mounted) {return;}
      const existing = entries
        .filter(e => e.source === 'evening_proverbs' || e.metadata?.source === 'evening_proverbs')
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
      if (existing) {
        setHasReadProverb(Boolean(existing.metadata?.proverbRead));
        setProverbReflectionId(existing.id);
      }
    })();
    return () => { mounted = false; };
  }, [dateStr, proverbNumber]);

  const proverbLines = useMemo(() => {
    if (!proverbText) { return []; }
    if (proverbText.includes('\n')) { return proverbText.split('\n'); }
    return proverbText.split(/\s+(?=\d+\s)/).map((s) => s.trim()).filter(Boolean);
  }, [proverbText]);

  useEffect(() => {
    let cancelled = false;
    setProverbLoading(true);
    setProverbError(null);
    getScripturePassage(`Proverbs ${proverbNumber}`)
      .then((result) => {
        if (cancelled) { return; }
        setProverbText(result.text);
        setProverbVerses(result.verses || null);
        setProverbReference(result.reference);
        setProverbVersion(result.version);
      })
      .catch((err) => {
        if (cancelled) { return; }
        setProverbError(err?.message || 'Could not load Proverbs of the Day.');
      })
      .finally(() => {
        if (!cancelled) { setProverbLoading(false); }
      });
    return () => { cancelled = true; };
  }, [proverbNumber]);

  const onNext = React.useCallback(async () => {
    triggerLightHaptic();

    const metadata = {
      proverbNumber,
      proverbRead: hasReadProverb,
      source: 'evening_proverbs',
    };

    let id = proverbReflectionId;
    try {
      if (id) {
        const existing = await getLocalReflection(id, 'scripture', dateStr);
        if (existing) {
          const updated = await updateLocalReflection({
            ...existing,
            title: `Proverbs ${proverbNumber}`,
            content: existing.content,
            metadata: { ...existing.metadata, ...metadata },
          });
          id = updated.id;
        } else {
          const created = await createLocalReflection({
            title: `Proverbs ${proverbNumber}`,
            content: '',
            type: 'scripture',
            source: 'evening_proverbs',
            selected_date: dateStr,
            metadata,
          });
          id = created.id;
        }
      } else {
        const created = await createLocalReflection({
          title: `Proverbs ${proverbNumber}`,
          content: '',
          type: 'scripture',
          source: 'evening_proverbs',
          selected_date: dateStr,
          metadata,
        });
        id = created.id;
      }
      setProverbReflectionId(id);
    } catch (error) {
      console.error('Error saving evening proverbs read state:', error);
    }

    await markStepCompleted(
      'proverbs',
      {
        domain: 'reflection',
        content_type: 'scripture',
        local_id: id!,
      },
      'proverbs',
    );

    DeviceEventEmitter.emit('reflection_saved', { type: 'evening_proverbs', date: dateStr });

    navigation.navigate('CarryWisdom', {
      ...route.params,
      selectedDate,
      proverbVersion: proverbVersion || 'NASB',
      proverbNumber,
      proverbReference: proverbReference || `Proverbs ${proverbNumber}`,
      proverbReflectionId: id,
    });
  }, [hasReadProverb, markStepCompleted, navigation, route.params, proverbNumber, proverbReference, proverbVersion, proverbReflectionId, dateStr, selectedDate]);

  const toggleProverbRead = React.useCallback(() => {
    if (hasReadProverb) {
      triggerLightHaptic();
    } else {
      triggerSuccessHaptic();
    }
    setHasReadProverb((current) => !current);
  }, [hasReadProverb]);

  const proverbLineStyle = useMemo(() => ({
    fontSize: proverbFontSize,
    lineHeight: proverbFontSize * 1.6 + proverbLineSpacing,
    letterSpacing: proverbLetterSpacing,
    textAlign: proverbAlign,
    paddingLeft: proverbIndent,
    fontFamily: getFontFamily(proverbFont, proverbBold ? 'bold' : 'regular'),
  }), [proverbAlign, proverbBold, proverbFont, proverbFontSize, proverbIndent, proverbLetterSpacing, proverbLineSpacing]);

  const toggleProverbSettings = useCallback(() => {
    triggerLightHaptic();
    const opening = !showAaSettings;
    setShowAaSettings(opening);
    Animated.timing(settingsAnim, {
      toValue: opening ? 1 : 0,
      duration: opening ? 260 : 200,
      useNativeDriver: false,
    }).start();
  }, [settingsAnim, showAaSettings]);

  const toggleProverbBold = useCallback(() => {
    triggerLightHaptic();
    setProverbBold(current => !current);
  }, []);

  const selectProverbFont = useCallback((font: FontFamily) => {
    triggerLightHaptic();
    setProverbFont(font);
  }, []);

  const selectProverbAlign = useCallback((align: TextAlign) => {
    triggerLightHaptic();
    setProverbAlign(align);
  }, []);

  const increaseProverbFontSize = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = FONT_SIZES.indexOf(proverbFontSize);
    const nextIndex = Math.min(currentIndex + 1, FONT_SIZES.length - 1);
    setProverbFontSize(FONT_SIZES[nextIndex]);
  }, [proverbFontSize]);

  const decreaseProverbFontSize = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = FONT_SIZES.indexOf(proverbFontSize);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setProverbFontSize(FONT_SIZES[prevIndex]);
  }, [proverbFontSize]);

  const increaseProverbLineSpacing = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = LINE_SPACING_OPTIONS.indexOf(proverbLineSpacing);
    const nextIndex = Math.min(currentIndex + 1, LINE_SPACING_OPTIONS.length - 1);
    setProverbLineSpacing(LINE_SPACING_OPTIONS[nextIndex]);
  }, [proverbLineSpacing]);

  const decreaseProverbLineSpacing = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = LINE_SPACING_OPTIONS.indexOf(proverbLineSpacing);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setProverbLineSpacing(LINE_SPACING_OPTIONS[prevIndex]);
  }, [proverbLineSpacing]);

  const increaseProverbLetterSpacing = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = LETTER_SPACING_OPTIONS.indexOf(proverbLetterSpacing);
    const nextIndex = Math.min(currentIndex + 1, LETTER_SPACING_OPTIONS.length - 1);
    setProverbLetterSpacing(LETTER_SPACING_OPTIONS[nextIndex]);
  }, [proverbLetterSpacing]);

  const decreaseProverbLetterSpacing = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = LETTER_SPACING_OPTIONS.indexOf(proverbLetterSpacing);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setProverbLetterSpacing(LETTER_SPACING_OPTIONS[prevIndex]);
  }, [proverbLetterSpacing]);

  const increaseProverbIndent = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = INDENT_OPTIONS.indexOf(proverbIndent);
    const nextIndex = Math.min(currentIndex + 1, INDENT_OPTIONS.length - 1);
    setProverbIndent(INDENT_OPTIONS[nextIndex]);
  }, [proverbIndent]);

  const decreaseProverbIndent = useCallback(() => {
    triggerLightHaptic();
    const currentIndex = INDENT_OPTIONS.indexOf(proverbIndent);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setProverbIndent(INDENT_OPTIONS[prevIndex]);
  }, [proverbIndent]);

  const resetProverbPreferences = useCallback(() => {
    triggerLightHaptic();
    setProverbFontSize(18);
    setProverbFont('lora');
    setProverbBold(false);
    setProverbAlign('left');
    setProverbIndent(0);
    setProverbLineSpacing(0);
    setProverbLetterSpacing(0);
  }, []);

  const onBack = () => exitEveningFlow(navigation, 'Today');

  const children = (
    <>
      {proverbReference && proverbVersion && (
        <View style={styles.proverbReferenceRow}>
          <ThemedText weight="semiBold" style={styles.proverbReference}>
            {proverbReference} · {proverbVersion}
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
          styles.proverbSettingsPanel,
          {
            maxHeight: settingsAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }),
            opacity: settingsAnim,
            transform: [{ translateY: settingsAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}
      >
        <View style={styles.proverbAppearanceTopRow}>
          <View style={styles.proverbQuickControls}>
            <View style={styles.proverbSizeControls}>
              <TouchableOpacity
                style={styles.proverbControlButton}
                onPress={decreaseProverbFontSize}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="Decrease font size"
              >
                <ThemedText weight="semiBold" style={styles.proverbDecreaseFontIcon}>A</ThemedText>
              </TouchableOpacity>
              <ThemedText weight="semiBold" style={styles.proverbFontSizeLabel}>{proverbFontSize}</ThemedText>
              <TouchableOpacity
                style={styles.proverbControlButton}
                onPress={increaseProverbFontSize}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="Increase font size"
              >
                <ThemedText weight="semiBold" style={styles.proverbIncreaseFontIcon}>A</ThemedText>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.proverbBoldToggle, proverbBold && styles.proverbBoldToggleActive]}
              onPress={toggleProverbBold}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="Bold text"
              accessibilityState={{ selected: proverbBold }}
            >
              <ThemedText weight="semiBold" style={[styles.proverbBoldToggleText, proverbBold && styles.proverbBoldToggleTextActive]}>Bold</ThemedText>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.proverbResetIconButton}
            onPress={resetProverbPreferences}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Reset reader settings"
          >
            <Ionicons name="refresh-outline" size={15} color={Colors.sage} />
          </TouchableOpacity>
        </View>

        <View style={styles.proverbOptionGroup}>
          <View style={styles.proverbFontControls}>
            {FONT_OPTIONS.map(option => {
              const isActive = option.key === proverbFont;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.proverbFontChip, isActive && styles.proverbFontChipActive]}
                  onPress={() => selectProverbFont(option.key)}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel={`Set font to ${option.label}`}
                >
                  <ThemedText
                    weight="semiBold"
                    style={[styles.proverbFontChipText, isActive && styles.proverbFontChipTextActive]}
                  >
                    {option.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.proverbOptionDivider} />
          <View style={styles.proverbAlignControls}>
            {ALIGN_OPTIONS.map(option => {
              const isActive = option.key === proverbAlign;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.proverbAlignButton, isActive && styles.proverbFontChipActive]}
                  onPress={() => selectProverbAlign(option.key)}
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
          style={styles.proverbAdvancedButton}
          onPress={() => {
            triggerLightHaptic();
            setAdvancedSettingsOpen(current => !current);
          }}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Toggle advanced text settings"
          accessibilityState={{ expanded: advancedSettingsOpen }}
        >
          <ThemedText style={styles.proverbAdvancedButtonText}>Advanced</ThemedText>
          <Ionicons name={advancedSettingsOpen ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textGray} />
        </TouchableOpacity>

        {advancedSettingsOpen && (
          <View style={styles.proverbAdvancedSettings}>
            <View style={styles.proverbSettingsRow}>
              <ThemedText style={styles.proverbSettingsLabel}>Lines</ThemedText>
              <View style={styles.proverbSizeControls}>
                <TouchableOpacity
                  style={styles.proverbControlButton}
                  onPress={decreaseProverbLineSpacing}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease line spacing"
                >
                  <ThemedText weight="semiBold" style={styles.proverbControlButtonText}>−</ThemedText>
                </TouchableOpacity>
                <ThemedText weight="semiBold" style={styles.proverbFontSizeLabel}>{proverbLineSpacing}</ThemedText>
                <TouchableOpacity
                  style={styles.proverbControlButton}
                  onPress={increaseProverbLineSpacing}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Increase line spacing"
                >
                  <ThemedText weight="semiBold" style={styles.proverbControlButtonText}>+</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.proverbSettingsRow}>
              <ThemedText style={styles.proverbSettingsLabel}>Letters</ThemedText>
              <View style={styles.proverbSizeControls}>
                <TouchableOpacity
                  style={styles.proverbControlButton}
                  onPress={decreaseProverbLetterSpacing}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease letter spacing"
                >
                  <ThemedText weight="semiBold" style={styles.proverbControlButtonText}>−</ThemedText>
                </TouchableOpacity>
                <ThemedText weight="semiBold" style={styles.proverbFontSizeLabel}>{proverbLetterSpacing}</ThemedText>
                <TouchableOpacity
                  style={styles.proverbControlButton}
                  onPress={increaseProverbLetterSpacing}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Increase letter spacing"
                >
                  <ThemedText weight="semiBold" style={styles.proverbControlButtonText}>+</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.proverbSettingsRow}>
              <ThemedText style={styles.proverbSettingsLabel}>Indent</ThemedText>
              <View style={styles.proverbSizeControls}>
                <TouchableOpacity
                  style={styles.proverbControlButton}
                  onPress={decreaseProverbIndent}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease indent"
                >
                  <ThemedText weight="semiBold" style={styles.proverbControlButtonText}>−</ThemedText>
                </TouchableOpacity>
                <ThemedText weight="semiBold" style={styles.proverbFontSizeLabel}>{proverbIndent}</ThemedText>
                <TouchableOpacity
                  style={styles.proverbControlButton}
                  onPress={increaseProverbIndent}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Increase indent"
                >
                  <ThemedText weight="semiBold" style={styles.proverbControlButtonText}>+</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Animated.View>

      <View style={styles.card}>
        <ScrollView
          style={styles.proverbScroll}
          contentContainerStyle={styles.proverbContent}
          showsVerticalScrollIndicator={false}
        >
          {proverbLoading ? (
            <ActivityIndicator color={Colors.sage} style={styles.proverbLoader} />
          ) : proverbError ? (
            <Text style={[styles.proverbLine, proverbLineStyle]}>{proverbError}</Text>
          ) : proverbVerses && proverbVerses.length > 0 ? (
            <>
              {proverbVerses.map((verse, vIndex) => (
                <View key={`proverb-verse-${vIndex}`} style={styles.verseRow}>
                  <Text
                    style={[
                      styles.verseNumber,
                      {
                        fontSize: proverbFontSize,
                        lineHeight: proverbFontSize * 1.6 + proverbLineSpacing,
                        fontFamily: getFontFamily(proverbFont, 'bold'),
                      },
                    ]}>
                    {verse.number}
                  </Text>
                  <View style={styles.verseLines}>
                    {verse.lines.map((line, lIndex) => (
                      <Text
                        key={`proverb-line-${vIndex}-${lIndex}`}
                        style={[styles.verseLine, proverbLineStyle]}>
                        {line}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </>
          ) : (
            <>
              {proverbLines.map((line, index) => (
                line.trim() === '' ? (
                  <View key={`proverb-space-${index}`} style={styles.proverbStanzaBreak} />
                ) : (
                  <Text
                    key={`proverb-line-${index}`}
                    style={[styles.proverbLine, proverbLineStyle]}
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
        style={[styles.readButton, hasReadProverb && styles.readButtonActive]}
        onPress={toggleProverbRead}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hasReadProverb }}
        accessibilityLabel={`I've read Proverbs ${proverbNumber}`}
      >
        {hasReadProverb ? (
          <Ionicons name="checkmark-circle" size={16} color={Colors.hopeWhite} />
        ) : (
          <MaterialCommunityIcons name="script-text" size={16} color={Colors.sage} />
        )}
        <ThemedText weight="medium" style={[styles.readButtonText, hasReadProverb && styles.readButtonTextActive]}>
          {hasReadProverb ? `Proverbs ${proverbNumber} read` : `I've read Proverbs ${proverbNumber}`}
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
      onPress={toggleProverbSettings}
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
      extraScrollBottomPadding={140}
      manageStatusBar={false}
      step={3}
      totalSteps={6}
      eyebrow="PROVERB OF THE DAY"
      title={`Proverbs ${proverbNumber}`}
      footer={footer}
      onBack={onBack}
      backgroundColor={Colors.lightBackground}
      rightControl={aAButton}
    >
      {children}

      <BibleCopyrightModal
        visible={showCopyright}
        onClose={() => setShowCopyright(false)}
        bibleVersion={proverbVersion || ''}
      />
    </RoutineStepShell>
  );
};

const styles = StyleSheet.create({
  proverbReferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 0,
    marginBottom: 4,
  },
  proverbReference: {
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
  proverbSettingsPanel: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 22,
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.2)',
    overflow: 'hidden',
    gap: 12,
  },
  proverbAppearanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proverbQuickControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proverbSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proverbControlButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82, 106, 91, 0.1)',
  },
  proverbControlButtonText: {
    fontSize: 14,
    color: Colors.text,
  },
  proverbDecreaseFontIcon: {
    fontSize: 12,
    color: Colors.textGray,
  },
  proverbIncreaseFontIcon: {
    fontSize: 18,
    color: Colors.text,
  },
  proverbFontSizeLabel: {
    width: 28,
    textAlign: 'center',
    fontSize: 13,
    color: Colors.sage,
  },
  proverbBoldToggle: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.2)',
    backgroundColor: 'rgba(82, 106, 91, 0.06)',
  },
  proverbBoldToggleActive: {
    borderColor: Colors.sage,
    backgroundColor: Colors.sage,
  },
  proverbBoldToggleText: {
    fontSize: 12,
    color: Colors.text,
  },
  proverbBoldToggleTextActive: {
    color: Colors.hopeWhite,
  },
  proverbResetIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82, 106, 91, 0.06)',
  },
  proverbOptionGroup: {
    padding: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(82, 106, 91, 0.06)',
  },
  proverbFontControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  proverbFontChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82, 106, 91, 0.1)',
  },
  proverbFontChipActive: {
    backgroundColor: Colors.sage,
  },
  proverbFontChipText: {
    fontSize: 11,
    color: Colors.text,
  },
  proverbFontChipTextActive: {
    color: Colors.hopeWhite,
  },
  proverbOptionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    backgroundColor: 'rgba(82, 106, 91, 0.15)',
  },
  proverbAlignControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  proverbAlignButton: {
    flex: 1,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proverbAdvancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 5,
  },
  proverbAdvancedButtonText: {
    fontSize: 11,
    color: Colors.textGray,
  },
  proverbAdvancedSettings: {
    paddingTop: 2,
    gap: 10,
  },
  proverbSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  proverbSettingsLabel: {
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
  proverbScroll: {
    flex: 1,
  },
  proverbContent: {
    paddingBottom: 8,
  },
  proverbLoader: {
    marginTop: 20,
  },
  proverbLine: {
    color: Colors.text,
    marginBottom: 6,
  },
  proverbStanzaBreak: {
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
    backgroundColor: '#E9EAE3',
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(82, 106, 91, 0.2)',
  },
  readButtonActive: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  readButtonText: {
    color: Colors.sage,
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

export default EveningProverbsScreen;
