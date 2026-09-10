import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, PanResponder, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { differenceInCalendarDays } from 'date-fns';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../../components/common/ThemedText';
import { BibleCopyrightModal } from '../../components/BibleCopyrightModal';
import { Colors } from '../../theme/colors';
import { Fonts, type FontFamily, getFontFamily } from '../../theme/fonts';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useMorningStatusBar } from '../../hooks/useMorningStatusBar';
import { getScripturePassage } from '../../services/scriptureReaderService';

type TextAlign = 'left' | 'center' | 'right' | 'justify';

const FONT_OPTIONS: { key: FontFamily; label: string }[] = [
  { key: 'lora', label: 'Lora' },
  { key: 'lexend', label: 'Lexend' },
  { key: 'poppins', label: 'Poppins' },
  { key: 'nunito', label: 'Nunito' },
];

const ALIGN_OPTIONS: { key: TextAlign; label: string }[] = [
  { key: 'left', label: 'Left' },
  { key: 'center', label: 'Center' },
  { key: 'right', label: 'Right' },
  { key: 'justify', label: 'Justify' },
];

const INDENT_OPTIONS = [0, 16, 32];
const LINE_SPACING_OPTIONS = [0, 4, 8, 12];
const LETTER_SPACING_OPTIONS = [0, 0.5, 1, 2];

interface SettingRowProps<T extends string | number> {
  label: string;
  options: { key: T; label: string }[];
  active: T;
  onSelect: (value: T) => void;
}

const SettingRow = <T extends string | number>({ label, options, active, onSelect }: SettingRowProps<T>) => (
  <View style={styles.settingRow}>
    <ThemedText style={styles.settingLabel}>{label}</ThemedText>
    <View style={styles.chipsRow}>
      {options.map((option) => {
        const isActive = option.key === active;
        return (
          <TouchableOpacity
            key={String(option.key)}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => {
              triggerLightHaptic();
              onSelect(option.key);
            }}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.chipText, isActive && styles.chipTextActive]}>
              {option.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

const PsalmOfTheDayScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width: screenWidth } = useWindowDimensions();
  const { user } = useAuth();
  const params = useMemo(() => route.params ?? {}, [route.params]);
  useMorningStatusBar();

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

  const [psalmFontSize, setPsalmFontSize] = useState(18);
  const [psalmFont, setPsalmFont] = useState<FontFamily>('lora');
  const [psalmAlign, setPsalmAlign] = useState<TextAlign>('left');
  const [psalmIndent, setPsalmIndent] = useState(0);
  const [psalmLineSpacing, setPsalmLineSpacing] = useState(0);
  const [psalmLetterSpacing, setPsalmLetterSpacing] = useState(0);

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

  const onNext = React.useCallback(() => {
    triggerLightHaptic();
    navigation.navigate('CarryIt', { ...params, psalmNumber, psalmRead: hasReadPsalm });
  }, [hasReadPsalm, navigation, params, psalmNumber]);

  const togglePsalmRead = React.useCallback(() => {
    if (hasReadPsalm) {
      triggerLightHaptic();
    } else {
      triggerSuccessHaptic();
    }
    setHasReadPsalm((current) => !current);
  }, [hasReadPsalm]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          return gestureState.dx < -14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
        },
        onPanResponderRelease: (_, gestureState) => {
          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          const hasEnoughDistance = Math.abs(gestureState.dx) > screenWidth * 0.15;
          const hasEnoughVelocity = Math.abs(gestureState.vx) > 0.45;

          if (!isHorizontalSwipe || (!hasEnoughDistance && !hasEnoughVelocity)) {
            return;
          }

          if (gestureState.dx < 0) {
            onNext();
          }
        },
      }),
    [onNext, screenWidth]
  );

  const psalmLineStyle = useMemo(() => ({
    fontSize: psalmFontSize,
    lineHeight: psalmFontSize * 1.6 + psalmLineSpacing,
    letterSpacing: psalmLetterSpacing,
    textAlign: psalmAlign,
    paddingLeft: psalmIndent,
    fontFamily: getFontFamily(psalmFont, 'regular'),
  }), [psalmAlign, psalmFont, psalmFontSize, psalmIndent, psalmLetterSpacing, psalmLineSpacing]);

  const sizeOptions = useMemo(() => [16, 18, 20, 22, 24].map((size) => ({ key: size, label: String(size) })), []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 16 }]} {...panResponder.panHandlers}>
      <ThemedText style={styles.eyebrow}>PSALM OF THE DAY</ThemedText>
      <View style={styles.titleRow}>
        <ThemedText style={styles.title}>Psalm {psalmNumber}</ThemedText>
        <TouchableOpacity
          style={styles.aaButton}
          onPress={() => {
            triggerLightHaptic();
            setShowAaSettings(!showAaSettings);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Text settings"
        >
          <ThemedText weight="bold" style={styles.aaButtonText}>aA</ThemedText>
        </TouchableOpacity>
      </View>
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

      {showAaSettings && (
        <View style={styles.settingsPanel}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsContent}>
            <SettingRow label="Size" options={sizeOptions} active={psalmFontSize} onSelect={setPsalmFontSize} />
            <SettingRow
              label="Font"
              options={FONT_OPTIONS}
              active={psalmFont}
              onSelect={(value) => setPsalmFont(value as FontFamily)}
            />
            <SettingRow
              label="Align"
              options={ALIGN_OPTIONS}
              active={psalmAlign}
              onSelect={(value) => setPsalmAlign(value as TextAlign)}
            />
            <SettingRow
              label="Indent"
              options={INDENT_OPTIONS.map((v) => ({ key: v, label: v === 0 ? 'None' : `${v}` }))}
              active={psalmIndent}
              onSelect={setPsalmIndent}
            />
            <SettingRow
              label="Line"
              options={LINE_SPACING_OPTIONS.map((v) => ({ key: v, label: v === 0 ? 'None' : `+${v}` }))}
              active={psalmLineSpacing}
              onSelect={setPsalmLineSpacing}
            />
            <SettingRow
              label="Letter"
              options={LETTER_SPACING_OPTIONS.map((v) => ({ key: v, label: v === 0 ? 'None' : `${v}` }))}
              active={psalmLetterSpacing}
              onSelect={setPsalmLetterSpacing}
            />
          </ScrollView>
        </View>
      )}

      <View style={styles.card}>
        <ScrollView
          style={styles.psalmScroll}
          contentContainerStyle={styles.psalmContent}
          showsVerticalScrollIndicator={false}
        >
          {psalmLoading ? (
            <ActivityIndicator color={Colors.sage} style={styles.psalmLoader} />
          ) : psalmError ? (
            <ThemedText style={[styles.psalmLine, psalmLineStyle]}>{psalmError}</ThemedText>
          ) : psalmVerses && psalmVerses.length > 0 ? (
            <>
              {psalmVerses.map((verse, vIndex) => (
                <View key={`psalm-verse-${vIndex}`} style={styles.verseRow}>
                  <ThemedText
                    weight="bold"
                    style={[
                      styles.verseNumber,
                      {
                        fontSize: psalmFontSize,
                        lineHeight: psalmFontSize * 1.6 + psalmLineSpacing,
                        fontFamily: getFontFamily(psalmFont, 'bold'),
                      },
                    ]}>
                    {verse.number}
                  </ThemedText>
                  <View style={styles.verseLines}>
                    {verse.lines.map((line, lIndex) => (
                      <ThemedText
                        key={`psalm-line-${vIndex}-${lIndex}`}
                        style={[styles.verseLine, psalmLineStyle]}>
                        {line}
                      </ThemedText>
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
                  <ThemedText
                    key={`psalm-line-${index}`}
                    style={[styles.psalmLine, psalmLineStyle]}
                  >
                    {line.trim()}
                  </ThemedText>
                )
              ))}
            </>
          )}
        </ScrollView>
      </View>

      <TouchableOpacity
        style={[styles.readButton, hasReadPsalm && styles.readButtonActive, { bottom: insets.bottom + 20 }]}
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

      <View style={[styles.primaryButton, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={onNext}
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Next"
        >
          <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>
      <BibleCopyrightModal
        visible={showCopyright}
        onClose={() => setShowCopyright(false)}
        bibleVersion={psalmVersion || ''}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
    paddingHorizontal: 18,
  },
  eyebrow: {
    color: Colors.sageMuted,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.8,
    textAlign: 'center',
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontWeight: '900',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
    position: 'relative',
  },
  aaButton: {
    position: 'absolute',
    right: 0,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
    borderRadius: 20,
  },
  aaButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  settingsPanel: {
    maxHeight: 180,
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 16,
    padding: 12,
  },
  settingsContent: {
    gap: 10,
  },
  settingRow: {
    marginBottom: 2,
  },
  settingLabel: {
    color: Colors.textGray,
    fontFamily: Fonts.regular,
    fontSize: 12,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  chipText: {
    color: Colors.text,
    fontSize: 13,
  },
  chipTextActive: {
    color: Colors.hopeWhite,
  },
  card: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 22,
    padding: 22,
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
  psalmReference: {
    color: Colors.sage,
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  psalmReferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 4,
    marginBottom: 16,
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
  readButton: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.2)',
    zIndex: 100,
  },
  readButtonActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  readButtonText: {
    color: Colors.sage,
    fontSize: 14,
  },
  readButtonTextActive: {
    color: Colors.hopeWhite,
  },
  primaryButton: {
    position: 'absolute',
    right: 20,
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
    zIndex: 100,
  },
});

export default PsalmOfTheDayScreen;
