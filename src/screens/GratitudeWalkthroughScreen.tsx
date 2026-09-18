import React, {useCallback, useEffect, useState} from 'react';
import {ScrollView, StatusBar, StyleSheet, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {Heart} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import GratitudeLogEditor from '../components/journal/GratitudeLogEditor';
import StepFadeIn from '../components/common/StepFadeIn';
import ThemedText from '../components/common/ThemedText';
import {withErrorBoundary} from '../components/ErrorBoundary/withErrorBoundary';
import {
  createLocalJournalEntry,
  deleteLocalJournalEntry,
  getLocalJournalEntries,
} from '../storage/journalStorage';
import {Colors} from '../theme/colors';
import {toLocalDateString} from '../utils/date';
import {triggerMediumHaptic} from '../utils/haptics';
import type {RootStackParamList} from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GratitudeWalkthrough'>;

const GratitudeWalkthroughScreen: React.FC<Props> = ({route, navigation}) => {
  const insets = useSafeAreaInsets();
  const selectedDate = route.params?.selectedDate ? new Date(route.params.selectedDate) : new Date();
  const dateKey = toLocalDateString(selectedDate);
  const [initialItems, setInitialItems] = useState<string[]>([]);
  const [savedItems, setSavedItems] = useState<string[] | null>(null);

  useFocusEffect(useCallback(() => {
    StatusBar.setHidden(true, 'slide');
    StatusBar.setBarStyle('dark-content');
    return () => StatusBar.setHidden(false, 'slide');
  }, []));

  useEffect(() => {
    let active = true;
    getLocalJournalEntries('gratitude', dateKey).then(entries => {
      const entry = entries.find(item => !item.metadata?.subtask_id);
      if (!active || !entry) {return;}
      try {
        const content = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
        setInitialItems(Array.isArray(content?.items) ? content.items : []);
      } catch {
        setInitialItems([]);
      }
    });
    return () => { active = false; };
  }, [dateKey]);

  const saveGratitude = useCallback(async ({items}: {items: string[]; date: Date}) => {
    const cleanItems = items.map(item => item.trim()).filter(Boolean);
    const existing = await getLocalJournalEntries('gratitude', dateKey);
    for (const entry of existing.filter(item => !item.metadata?.subtask_id)) {
      await deleteLocalJournalEntry(entry.id, 'gratitude', dateKey);
    }
    await createLocalJournalEntry({
      content_type: 'gratitude',
      selected_date: dateKey,
      content: JSON.stringify({items: cleanItems}),
      metadata: {source: 'gratitude_walkthrough'},
    });
    triggerMediumHaptic();
    setSavedItems(cleanItems);
  }, [dateKey]);

  if (!savedItems) {
    return (
      <GratitudeLogEditor
        selectedDate={selectedDate}
        initialItems={initialItems}
        onSave={saveGratitude}
        onCancel={() => navigation.goBack()}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, {paddingTop: insets.top + 56}]}
        showsVerticalScrollIndicator={false}>
        <StepFadeIn delay={0} style={styles.eyebrow}>
          <Heart size={16} color={Colors.sage} strokeWidth={2.2} />
          <ThemedText weight="semiBold" style={styles.eyebrowText}>GRATITUDE</ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={80} style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Heart size={22} color={Colors.hopeWhite} strokeWidth={2.2} />
            </View>
            <View style={styles.headerCopy}>
              <ThemedText weight="semiBold" style={styles.category}>Gratitude</ThemedText>
              <ThemedText style={styles.subtext}>Your gratitude has been saved</ThemedText>
            </View>
            <Ionicons name="checkmark-circle" size={28} color={Colors.sage} />
          </View>

          <View style={styles.section}>
            <ThemedText weight="medium" style={styles.sectionLabel}>Grateful for</ThemedText>
            <View style={styles.list}>
              {savedItems.map((item, index) => (
                <View key={`${item}-${index}`} style={styles.item}>
                  <View style={styles.numberCircle}>
                    <ThemedText weight="semiBold" style={styles.number}>{index + 1}</ThemedText>
                  </View>
                  <ThemedText style={styles.itemText}>{item}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>A grateful heart notices the gifts already present.</ThemedText>
          </View>
        </StepFadeIn>
        <View style={{height: 110}} />
      </ScrollView>

      <View style={[styles.doneContainer, {bottom: insets.bottom + 20}]}>
        <TouchableOpacity
          style={styles.doneButton}
          activeOpacity={0.85}
          onPress={() => {
            triggerMediumHaptic();
            navigation.goBack();
          }}>
          <ThemedText weight="semiBold" style={styles.doneText}>Done</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.lightBackground},
  scroll: {flex: 1},
  content: {paddingHorizontal: 20, paddingBottom: 30},
  eyebrow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24},
  eyebrowText: {fontSize: 14, color: Colors.sageMuted, letterSpacing: 0.5},
  card: {borderRadius: 26, padding: 24, borderWidth: 1.5, borderColor: Colors.inputBorder, backgroundColor: Colors.cardBackground},
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 24},
  iconCircle: {width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.sage},
  headerCopy: {flex: 1, marginHorizontal: 12},
  category: {fontSize: 18, color: Colors.text},
  subtext: {fontSize: 13, color: Colors.textGray, marginTop: 2},
  section: {paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.inputBorder},
  sectionLabel: {fontSize: 11, color: Colors.textGray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1},
  list: {gap: 8},
  item: {flexDirection: 'row', alignItems: 'center', gap: 10},
  numberCircle: {width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.sage},
  number: {fontSize: 12, color: Colors.hopeWhite},
  itemText: {flex: 1, fontSize: 15, lineHeight: 22, color: Colors.text},
  footer: {paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.inputBorder},
  footerText: {fontSize: 13, lineHeight: 20, color: Colors.textGray},
  doneContainer: {position: 'absolute', left: 20, right: 20, padding: 12, borderRadius: 26, backgroundColor: Colors.lightBackground},
  doneButton: {height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.sage},
  doneText: {fontSize: 16, color: Colors.hopeWhite},
});

export default withErrorBoundary(GratitudeWalkthroughScreen, 'GratitudeWalkthroughScreen');
