import React, { useEffect, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ThemedText from '../../components/common/ThemedText';
import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { triggerLightHaptic, triggerMediumHaptic } from '../../utils/haptics';
import { useRoutine } from '../../context/RoutineContext';
import RoutineStepShell from '../../components/routine/RoutineStepShell';
import {
  getLocalJournalSingleton,
  saveLocalJournalSingleton,
  LocalJournalEntry,
} from '../../storage/journalStorage';


const UnderneathItScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { selectedDate, markStepCompleted } = useRoutine();
  const dateStr = selectedDate;
  const [text, setText] = useState('');
  const [checkIn, setCheckIn] = useState({
    feeling: (route.params?.feeling as string | undefined) || '',
    feelingIcon: (route.params?.feelingIcon as string | undefined) || '',
    feelingIconType: (route.params?.feelingIconType as 'ionicons' | 'material' | undefined) || 'ionicons',
  });

  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  const verticalLineHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(verticalLineHeight, {
      toValue: 75,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [verticalLineHeight]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const existing = await getLocalJournalSingleton('morning_check_in', dateStr);
      if (!existing || !mounted) { return; }
      const parsed = typeof existing.content === 'string'
        ? JSON.parse(existing.content)
        : existing.content;
      if (parsed.underneathIt !== undefined) { setText(parsed.underneathIt); }
      setCheckIn(prev => ({
        feeling: parsed.feeling || prev.feeling,
        feelingIcon: parsed.feelingIcon || prev.feelingIcon,
        feelingIconType: parsed.feelingIconType || prev.feelingIconType,
      }));
    })();
    return () => { mounted = false; };
  }, [dateStr]);

  const onNext = React.useCallback(async () => {
    triggerMediumHaptic();

    let record: LocalJournalEntry | null = null;
    try {
      const content = JSON.stringify({
        feeling: checkIn.feeling,
        feelingIcon: checkIn.feelingIcon,
        feelingIconType: checkIn.feelingIconType,
        underneathIt: text.trim(),
      });
      record = await saveLocalJournalSingleton('morning_check_in', dateStr, content);
      DeviceEventEmitter.emit('reflection_saved', { type: 'morning_check_in', date: dateStr });
    } catch (saveError) {
      console.error('Error saving morning check-in:', saveError);
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
  }, [checkIn, dateStr, markStepCompleted, navigation, text]);

  const footer = (
    <TouchableOpacity
      onPress={onNext}
      activeOpacity={0.7}
      style={styles.primaryButton}
    >
      <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
    </TouchableOpacity>
  );

  const onBack = () => navigation.goBack();

  const children = (
    <>
      <View style={styles.metadataContainer}>
        <Animated.View style={[styles.verticalLine, { height: verticalLineHeight }]} />
        <View style={styles.metadataContent}>
          {checkIn.feelingIconType === 'material' && checkIn.feelingIcon ? (
            <MaterialCommunityIcons
              name={checkIn.feelingIcon as any}
              size={18}
              color={Colors.sage}
              style={styles.metadataIcon}
            />
          ) : (
            <Ionicons
              name={(checkIn.feelingIcon || 'heart-outline') as any}
              size={18}
              color={Colors.sage}
              style={styles.metadataIcon}
            />
          )}
          <ThemedText weight="medium" style={styles.fromText}>
            FEELING
          </ThemedText>
          <ThemedText style={styles.metadataText}>
            {checkIn.feeling ? (
              <>You named <ThemedText weight="semiBold">{checkIn.feeling}</ThemedText></>
            ) : (
              'A gentle check-in for your heart'
            )}
          </ThemedText>
          <ThemedText style={styles.metadataText}>
            If there’s more on your heart, bring it before God here…
          </ThemedText>
        </View>
      </View>
    </>
  );

  return (
    <RoutineStepShell
      step={2}
      totalSteps={6}
      eyebrow="MORNING CHECK-IN"
      eyebrowIcon={<Ionicons name="sunny-outline" size={14} color={Colors.sage} />}
      title="What’s underneath that?"
      footer={footer}
      onBack={onBack}
      backgroundColor={Colors.lightBackground}
    >
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
      {children}
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
  metadataContainer: {
    marginTop: 32,
    marginBottom: 24,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 2,
    backgroundColor: Colors.sage,
    opacity: 0.4,
    marginRight: 12,
    borderRadius: 2,
  },
  metadataContent: {
    flex: 1,
  },
  metadataIcon: {
    marginBottom: 4,
    opacity: 0.8,
  },
  fromText: {
    fontSize: 8,
    color: Colors.textGray,
    opacity: 0.6,
    marginBottom: 4,
    letterSpacing: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  metadataText: {
    fontSize: 12,
    color: Colors.textGray,
    opacity: 0.6,
    marginBottom: 4,
    lineHeight: 16,
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
