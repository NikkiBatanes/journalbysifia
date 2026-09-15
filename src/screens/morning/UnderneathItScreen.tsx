import React, { useEffect, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ThemedText from '../../components/common/ThemedText';
import StepFadeIn from '../../components/common/StepFadeIn';
import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { triggerLightHaptic, triggerMediumHaptic } from '../../utils/haptics';
import { useRoutine } from '../../context/RoutineContext';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { exitMorningFlow } from '../../navigation/exitEveningFlow';
import RoutineStepShell from '../../components/routine/RoutineStepShell';
import { safeJsonParse } from '../../utils/safeJsonParse';
import { getScripturePassage, ScriptureReaderResult } from '../../services/scriptureReaderService';
import {
  getLocalJournalSingleton,
  getAllLocalJournalSingletons,
  saveLocalJournalSingleton,
  LocalJournalEntry,
} from '../../storage/journalStorage';
import {
  getMorningCheckInPoolKey,
  getMorningCheckInScripturePool,
  getNextScriptureIndexFromHistory,
} from '../../data/morningCheckInScriptures';


const UnderneathItScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { selectedDate, markStepCompleted } = useRoutine();
  const dateStr = selectedDate;
  const bibleVersion = (user as any)?.user_metadata?.preferences?.content?.bibleVersion?.trim() || 'NASB';

  const [text, setText] = useState('');
  const [checkIn, setCheckIn] = useState({
    feeling: (route.params?.feeling as string | undefined) || '',
    feelingIcon: (route.params?.feelingIcon as string | undefined) || '',
    feelingIconType: (route.params?.feelingIconType as 'ionicons' | 'material' | undefined) || 'ionicons',
  });
  const [scripture, setScripture] = useState<{ reference: string; passageReference: string; translation: string; poolKey?: string } | null>(null);
  const [passage, setPassage] = useState<ScriptureReaderResult | null>(null);
  const [passageLoading, setPassageLoading] = useState(false);
  const [passageError, setPassageError] = useState(false);

  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  const saveContent = React.useCallback(async (
    contentValues: {
      feeling: string;
      feelingIcon: string;
      feelingIconType: string;
      underneathIt: string;
      scripture: { reference: string; passageReference: string; translation: string; poolKey?: string } | null;
    }
  ): Promise<LocalJournalEntry | null> => {
    try {
      const content = JSON.stringify({
        feeling: contentValues.feeling,
        feelingIcon: contentValues.feelingIcon,
        feelingIconType: contentValues.feelingIconType,
        underneathIt: contentValues.underneathIt.trim(),
        scripture: contentValues.scripture
          ? {
              reference: contentValues.scripture.reference,
              passageReference: contentValues.scripture.passageReference,
              translation: contentValues.scripture.translation,
              poolKey: contentValues.scripture.poolKey,
            }
          : undefined,
      });
      return await saveLocalJournalSingleton('morning_check_in', dateStr, content);
    } catch (saveError) {
      console.error('Error saving morning check-in:', saveError);
      return null;
    }
  }, [dateStr]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [existing, priorCheckIns] = await Promise.all([
        getLocalJournalSingleton('morning_check_in', dateStr),
        getAllLocalJournalSingletons('morning_check_in'),
      ]);
      if (!mounted) { return; }
      if (!existing) { return; }

      const parsed = safeJsonParse<Record<string, any>>(existing.content, { fallback: {} }) || {};
      const localFeeling = parsed.feeling || (route.params?.feeling as string | undefined) || '';
      const localFeelingIcon = parsed.feelingIcon || (route.params?.feelingIcon as string | undefined) || '';
      const localFeelingIconType = parsed.feelingIconType || (route.params?.feelingIconType as 'ionicons' | 'material' | undefined) || 'ionicons';
      const localUnderneathIt = parsed.underneathIt !== undefined ? parsed.underneathIt : '';

      if (mounted) {
        setText(localUnderneathIt);
        setCheckIn({
          feeling: localFeeling,
          feelingIcon: localFeelingIcon,
          feelingIconType: localFeelingIconType,
        });
      }

      const feelingId = (route.params?.feelingId as string | undefined) || (parsed.feeling || '').toLowerCase();
      const pool = getMorningCheckInScripturePool(feelingId);
      const currentPoolKey = getMorningCheckInPoolKey(feelingId);
      if (!pool.length || !mounted) { return; }

      const existingScripture = parsed.scripture?.reference ? parsed.scripture : null;
      const samePool = existingScripture && (
        (existingScripture.poolKey && existingScripture.poolKey === currentPoolKey) ||
        (!existingScripture.poolKey && getMorningCheckInPoolKey(parsed.feeling) === currentPoolKey)
      );

      if (samePool) {
        const restoredScripture = {
          reference: existingScripture.reference as string,
          passageReference: (existingScripture.passageReference || existingScripture.reference) as string,
          translation: bibleVersion,
          poolKey: currentPoolKey,
        };
        if (mounted) {
          setScripture(restoredScripture);
          if (!existingScripture.poolKey || existingScripture.translation !== bibleVersion) {
            await saveContent({
              feeling: localFeeling,
              feelingIcon: localFeelingIcon,
              feelingIconType: localFeelingIconType,
              underneathIt: localUnderneathIt,
              scripture: restoredScripture,
            });
          }
        }
        return;
      }

      const previousScriptures = priorCheckIns
        .filter(entry => entry.selected_date < dateStr)
        .map(entry => {
          const content = safeJsonParse<Record<string, any>>(entry.content, { fallback: {} }) || {};
          return {
            selected_date: entry.selected_date,
            updated_at: entry.updated_at,
            feeling: content.feeling,
            reference: content.scripture?.reference,
            passageReference: content.scripture?.passageReference,
          };
        })
        .filter(item => !!item.reference && getMorningCheckInPoolKey(item.feeling) === currentPoolKey)
        .sort((a, b) => {
          if (a.selected_date !== b.selected_date) {
            return a.selected_date > b.selected_date ? -1 : 1;
          }
          return a.updated_at > b.updated_at ? -1 : 1;
        })
        .map(item => ({ reference: item.reference as string, passageReference: item.passageReference }));

      const nextIndex = getNextScriptureIndexFromHistory(pool, previousScriptures);
      const selected = pool[nextIndex];
      const nextScripture = {
        reference: selected.displayReference,
        passageReference: selected.passageReference,
        translation: bibleVersion,
        poolKey: currentPoolKey,
      };

      if (mounted) {
        setScripture(nextScripture);
        await saveContent({
          feeling: localFeeling,
          feelingIcon: localFeelingIcon,
          feelingIconType: localFeelingIconType,
          underneathIt: localUnderneathIt,
          scripture: nextScripture,
        });
      }
    })();
    return () => { mounted = false; };
  }, [dateStr, route.params?.feeling, route.params?.feelingIcon, route.params?.feelingIconType, route.params?.feelingId, saveContent]);

  useEffect(() => {
    if (!scripture?.reference) { return; }
    let active = true;
    setPassageLoading(true);
    setPassageError(false);
    setPassage(null);
    getScripturePassage(scripture.reference, scripture.translation)
      .then((result) => {
        if (!active) { return; }
        setPassage(result);
      })
      .catch(() => {
        if (!active) { return; }
        setPassageError(true);
      })
      .finally(() => {
        if (!active) { return; }
        setPassageLoading(false);
      });
    return () => { active = false; };
  }, [scripture]);

  useEffect(() => {
    if (!scripture || scripture.translation === bibleVersion) { return; }
    const updatedScripture = { ...scripture, translation: bibleVersion };
    setScripture(updatedScripture);
    saveContent({
      feeling: checkIn.feeling,
      feelingIcon: checkIn.feelingIcon,
      feelingIconType: checkIn.feelingIconType,
      underneathIt: text,
      scripture: updatedScripture,
    });
  }, [bibleVersion, scripture, checkIn.feeling, checkIn.feelingIcon, checkIn.feelingIconType, text, saveContent]);

  const onNext = React.useCallback(async () => {
    triggerMediumHaptic();

    const record = await saveContent({
      feeling: checkIn.feeling,
      feelingIcon: checkIn.feelingIcon,
      feelingIconType: checkIn.feelingIconType,
      underneathIt: text,
      scripture,
    });
    if (record) {
      DeviceEventEmitter.emit('reflection_saved', { type: 'morning_check_in', date: dateStr });
    }

    await markStepCompleted(
      'underneath',
      record ? { domain: 'journal', content_type: 'morning_check_in', local_id: record.id } : undefined,
      'morning_check_in',
    );
    navigation.navigate('TodaysFocus', {
      feeling: checkIn.feeling,
      feelingIcon: checkIn.feelingIcon,
      feelingIconType: checkIn.feelingIconType,
      underneath: text,
    });
  }, [checkIn.feeling, checkIn.feelingIcon, checkIn.feelingIconType, dateStr, markStepCompleted, navigation, saveContent, scripture, text]);

  const handleRetryPassage = React.useCallback(() => {
    triggerLightHaptic();
    setScripture(prev => (prev ? { ...prev } : prev));
  }, []);

  const onBack = () => exitMorningFlow(navigation, 'Today');

  const footer = (
    <TouchableOpacity
      onPress={onNext}
      activeOpacity={0.7}
      style={styles.primaryButton}
    >
      <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
    </TouchableOpacity>
  );

  const feelingIcon = checkIn.feelingIconType === 'material' && checkIn.feelingIcon ? (
    <MaterialCommunityIcons
      name={checkIn.feelingIcon as any}
      size={34}
      color={Colors.sage}
    />
  ) : (
    <Ionicons
      name={(checkIn.feelingIcon || 'heart-outline') as any}
      size={34}
      color={Colors.sage}
    />
  );

  const scriptureText = passage
    ? (passage.verses?.length
      ? passage.verses.map(verse => verse.lines.join('\n')).join('\n')
      : passage.text)
    : '';

  return (
    <RoutineStepShell
      step={2}
      totalSteps={6}
      eyebrow="MORNING CHECK-IN"
      eyebrowIcon={<Ionicons name="sunny-outline" size={14} color={Colors.sage} />}
      footer={footer}
      onBack={onBack}
      backgroundColor={Colors.lightBackground}
      manageStatusBar={false}
    >
      <StepFadeIn delay={80}>
        <View style={styles.feelingRow}>
          <View style={styles.feelingIconCircle}>
            {feelingIcon}
          </View>
          <View style={styles.feelingTextWrap}>
            <ThemedText weight="medium" style={styles.feelingLabel}>
              You’re feeling
            </ThemedText>
            {checkIn.feeling ? (
              <ThemedText weight="bold" style={styles.feelingName}>
                {checkIn.feeling}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.feelingBalance} />
        </View>
      </StepFadeIn>
      <StepFadeIn delay={120}>
        <View style={styles.scriptureWrap}>
          {passageLoading ? (
            <ActivityIndicator color={Colors.sage} style={styles.scriptureLoader} />
          ) : passageError ? (
            <TouchableOpacity onPress={handleRetryPassage} activeOpacity={0.7}>
              <ThemedText style={styles.scriptureText}>
                Could not load this passage. Tap to retry.
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <>
              {scriptureText ? (
                <Text style={styles.scriptureText}>
                  {scriptureText}
                </Text>
              ) : null}
              {scripture?.reference ? (
                <View style={styles.referenceRow}>
                  <ThemedText weight="medium" style={styles.referenceText}>
                    {passage?.reference || scripture.reference} · {passage?.version || scripture.translation}
                  </ThemedText>
                  <Ionicons name="information-circle-outline" size={10} color={Colors.textGray} style={styles.infoIcon} />
                </View>
              ) : null}
            </>
          )}
        </View>
      </StepFadeIn>
      <StepFadeIn delay={160}>
        <ThemedText weight="semiBold" style={styles.title}>
          What’s underneath that?
        </ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={200}>
        <TextInput
          style={[styles.personalInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
          value={text}
          onChangeText={setText}
          placeholder="Take a moment to notice what’s on your heart."
          placeholderTextColor={Colors.textGray}
          multiline
          textAlignVertical="top"
          autoFocus
          keyboardAppearance="light"
        />
      </StepFadeIn>
    </RoutineStepShell>
  );
};

const styles = StyleSheet.create({
  personalInput: {
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 18,
    color: Colors.text,
    backgroundColor: 'transparent',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  feelingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
    marginBottom: 36,
  },
  feelingTextWrap: {
    alignItems: 'center',
  },
  feelingIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.anchorBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  feelingBalance: {
    width: 84,
    height: 84,
    marginLeft: 18,
  },
  feelingLabel: {
    fontSize: 11,
    letterSpacing: 2.5,
    color: Colors.textGray,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  feelingName: {
    fontSize: 34,
    lineHeight: 40,
    color: Colors.text,
  },
  scriptureWrap: {
    marginBottom: 24,
  },
  scriptureLoader: {
    marginVertical: 16,
  },
  scriptureText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 25,
    color: Colors.text,
    textAlign: 'left',
    marginBottom: 12,
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  referenceText: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Colors.textGray,
  },
  infoIcon: {
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  primaryButton: {
    alignSelf: 'flex-end',
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

export default UnderneathItScreen;
