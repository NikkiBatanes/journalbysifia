import React, { useCallback, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../components/common/ThemedText';
import { FaithfulRhythmRow } from '../components/dashboard/FaithfulRhythmsCard';
import { useAuth } from '../context/IndustryStandardAuthContext';
import {
  FAITHFUL_RHYTHM_UPDATED,
  getFaithfulRhythmsSnapshot,
  type FaithfulRhythmId,
  type FaithfulRhythmsSnapshot,
} from '../services/faithfulRhythmService';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic } from '../utils/haptics';
import {returnToMainTab} from '../navigation/returnToMainTab';

const DAILY_RHYTHMS: FaithfulRhythmId[] = ['morning', 'evening', 'heart_journal', 'prayer'];
const WEEKLY_RHYTHMS: FaithfulRhythmId[] = ['bible_study'];

const RhythmSection = ({
  title,
  description,
  ids,
  snapshot,
}: {
  title: string;
  description: string;
  ids: FaithfulRhythmId[];
  snapshot: FaithfulRhythmsSnapshot;
}) => (
  <View style={styles.section}>
    <ThemedText weight="bold" style={styles.sectionTitle}>{title}</ThemedText>
    <ThemedText style={styles.sectionDescription}>{description}</ThemedText>
    <View style={styles.sectionCard}>
      {ids.map((id, index) => (
        <React.Fragment key={id}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <FaithfulRhythmRow rhythm={snapshot[id]} expanded />
        </React.Fragment>
      ))}
    </View>
  </View>
);

const FaithfulRhythmsScreen: React.FC<any> = ({route}) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {preferences} = useAuth();
  const [snapshot, setSnapshot] = useState<FaithfulRhythmsSnapshot | null>(null);

  const refresh = useCallback(async () => {
    setSnapshot(await getFaithfulRhythmsSnapshot(preferences?.weekStart || 'monday'));
  }, [preferences?.weekStart]);

  useFocusEffect(useCallback(() => {
    let active = true;
    refresh().catch(() => { if (active) {setSnapshot(null);} });
    const subscription = DeviceEventEmitter.addListener(FAITHFUL_RHYTHM_UPDATED, () => {
      if (active) {refresh().catch(() => setSnapshot(null));}
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [refresh]));

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={Platform.OS === 'android' ? 'transparent' : Colors.lightBackground}
        translucent={Platform.OS === 'android'}
      />

      {!snapshot ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.sage} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 8,
              paddingBottom: Math.max(insets.bottom, 20) + 24,
            },
          ]}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <View style={styles.eyebrowRow}>
              <Ionicons name="repeat-outline" size={16} color={Colors.sage} />
              <ThemedText weight="semiBold" style={styles.eyebrow}>FAITHFUL RHYTHMS</ThemedText>
            </View>
            <ThemedText weight="semiBold" style={styles.title}>
              A record of the ways{'\n'}you return
            </ThemedText>
          </View>
          <RhythmSection
            title="Daily rhythms"
            description="Completed days build these streaks. Edits never add another day."
            ids={DAILY_RHYTHMS}
            snapshot={snapshot}
          />
          <RhythmSection
            title="Weekly rhythms"
            description="Bible Study counts active weeks, so its pace stays natural."
            ids={WEEKLY_RHYTHMS}
            snapshot={snapshot}
          />
          <RhythmSection
            title="Sunday sermon rhythm"
            description="Complete Sermon Notes on every Sunday of the month to continue this monthly streak."
            ids={['session_notes']}
            snapshot={snapshot}
          />
          <RhythmSection
            title="Review rhythm"
            description="Reviews follow the period they belong to rather than a daily streak."
            ids={['reviews']}
            snapshot={snapshot}
          />
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.closeButton, {top: insets.top + 8}]}
        onPress={() => {
          triggerLightHaptic();
          if (route?.params?.returnTo === 'More') {
            returnToMainTab(navigation, 'More');
          } else if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('MainTabs');
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="Close faithful rhythms"
        activeOpacity={0.7}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
      >
        <Ionicons name="close" size={17} color={Colors.sage} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.lightBackground},
  scrollView: {flex: 1},
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  content: {paddingHorizontal: 24, gap: 26},
  intro: {alignItems: 'center', marginBottom: 4},
  eyebrowRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 32, marginBottom: 8},
  eyebrow: {fontSize: 11, lineHeight: 15, letterSpacing: 1, color: Colors.sageMuted},
  title: {fontFamily: Fonts.semiBold, color: Colors.text, fontSize: 24, lineHeight: 32, textAlign: 'center'},
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  section: {gap: 5},
  sectionTitle: {fontFamily: Fonts.bold, color: Colors.text, fontSize: 16, lineHeight: 22},
  sectionDescription: {color: Colors.textGray, fontSize: 11, lineHeight: 17, marginBottom: 8},
  sectionCard: {backgroundColor: Colors.cardBackground, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 22, padding: 18},
  divider: {height: StyleSheet.hairlineWidth, backgroundColor: Colors.cardBorder, marginVertical: 16},
});

export default FaithfulRhythmsScreen;
