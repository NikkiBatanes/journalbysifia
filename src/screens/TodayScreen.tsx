import React, { useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil } from 'lucide-react-native';
import { endOfWeek, format, startOfWeek, subYears } from 'date-fns';

import ThemedText from '../components/common/ThemedText';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic } from '../utils/haptics';

const SectionHeading = ({ title, detail }: { title: string; detail: string }) => (
  <View style={styles.sectionHeading}>
    <ThemedText style={styles.eyebrow}>{title}</ThemedText>
    <ThemedText style={styles.sectionDetail}>{detail}</ThemedText>
  </View>
);

const IconTile = ({ icon, family = 'ion' }: { icon: string; family?: 'ion' | 'material' }) => (
  <View style={styles.iconTile}>
    {family === 'material'
      ? <MaterialCommunityIcons name={icon} size={25} color={Colors.sage} />
      : <Ionicons name={icon} size={25} color={Colors.sage} />}
  </View>
);

const TodayScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const weekLabel = useMemo(() => {
    const start = startOfWeek(now);
    const end = endOfWeek(now);
    return `${format(start, 'MMM d')}–${format(end, start.getMonth() === end.getMonth() ? 'd' : 'MMM d')}`.toUpperCase();
  }, [now]);
  const firstName = useMemo(() => {
    const metadata = (user as any)?.user_metadata;
    const value = metadata?.first_name || metadata?.full_name || user?.email?.split('@')[0] || 'Friend';
    return String(value).trim().split(/\s+/)[0];
  }, [user]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.lightBackground} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 104 }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={styles.date}>{format(now, 'EEE, MMM d').toUpperCase()}</ThemedText>
        <ThemedText style={styles.greeting}>Hi, {firstName}.</ThemedText>
        <ThemedText style={styles.subtitle}>Begin where you are.</ThemedText>

        <SectionHeading title="MORNING" detail="your daily rhythm" />
        <View style={[styles.card, styles.heroCard]}>
          <View style={styles.sunCircle}>
            <Ionicons name="sunny-outline" size={29} color={Colors.hopeWhite} />
          </View>
          <ThemedText style={styles.cardTitle}>Begin your day.</ThemedText>
          <ThemedText style={styles.body}>A gentle morning rhythm for your heart and your day. Check in, choose what matters, set your priorities, and begin with a Psalm.</ThemedText>
          <View style={styles.cardFooter}>
            <ThemedText style={styles.meta}>Check in · Focus · Priorities · Psalm</ThemedText>
            <TouchableOpacity
              style={styles.beginButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Begin your day"
              onPress={() => {
                triggerLightHaptic();
                (navigation as any).navigate('MorningFlow', {
                  screen: 'EmotionCheckIn',
                  params: { morningFlow: true },
                });
              }}
            >
              <Pencil size={16} color={Colors.hopeWhite} style={styles.beginButtonIcon} />
              <ThemedText weight="medium" style={styles.beginButtonText}>Begin</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <SectionHeading title="YOUR RHYTHM" detail="for this season" />
        <View style={styles.card}>
          <ThemedText style={styles.cardLabel}>THIS WEEK · {weekLabel}</ThemedText>
          <ThemedText style={styles.compactTitle}>Take a moment to look back.</ThemedText>
          <ThemedText style={styles.body}>Your weekly review is ready whenever you are. Notice what happened before you move into another week.</ThemedText>
          <View style={[styles.button, styles.leftButton]}><ThemedText style={styles.buttonText}>Weekly Review  →</ThemedText></View>
        </View>

        <SectionHeading title="JOURNAL" detail="write anytime" />
        <TouchableOpacity
          style={[styles.card, styles.rowCard]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open Heart Journal"
          onPress={() => {
            triggerLightHaptic();
            (navigation as any).navigate('Journal', {
              screen: 'ReflectionEditor',
              params: {
                selectedDate: new Date().toISOString(),
                initialMode: 'free-form',
                source: 'freeform',
                fromCarousel: true,
                openHeart: true,
                returnTo: 'Today',
              },
            });
          }}
        >
          <IconTile icon="heart" />
          <View style={styles.rowCopy}>
            <ThemedText weight="bold" style={styles.rowTitle}>Heart Journal</ThemedText>
            <ThemedText style={styles.meta}>What’s on your heart right now?</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.chevronColor} />
        </TouchableOpacity>
        <View style={styles.twoColumns}>
          <View style={[styles.card, styles.smallCard]}>
            <IconTile icon="sunny" />
            <ThemedText weight="bold" style={styles.smallTitle}>Reflection</ThemedText>
            <ThemedText style={styles.meta}>Choose a gentle prompt.</ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.card, styles.smallCard]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open Scripture Note"
            onPress={() => {
              triggerLightHaptic();
              (navigation as any).navigate('Journal', {
                screen: 'ScriptureNoteEditor',
                params: {
                  selectedDate: new Date().toISOString(),
                  returnTo: 'Today',
                },
              });
            }}
          >
            <IconTile icon="book" family="material" />
            <ThemedText weight="bold" style={styles.smallTitle}>Scripture Note</ThemedText>
            <ThemedText style={styles.meta}>Write about a passage.</ThemedText>
          </TouchableOpacity>
        </View>

        <SectionHeading title="EVENING" detail="close the day gently" />
        <View style={[styles.card, styles.heroCard]}>
          <View style={[styles.sunCircle, styles.moonCircle]}>
            <Ionicons name="moon" size={26} color={Colors.sage} />
          </View>
          <ThemedText style={styles.cardTitle}>Reflect on your day.</ThemedText>
          <ThemedText style={styles.body}>Give thanks, remember what mattered, and close with wisdom.</ThemedText>
          <TouchableOpacity
            style={[styles.beginButton, styles.leftButton]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Reflect on your day"
            onPress={() => {
              triggerLightHaptic();
              (navigation as any).navigate('EveningFlow', {
                screen: 'Gratitude',
                params: { selectedDate: new Date().toISOString() },
              });
            }}
          >
            <Pencil size={16} color={Colors.hopeWhite} style={styles.beginButtonIcon} />
            <ThemedText weight="medium" style={styles.beginButtonText}>Begin</ThemedText>
          </TouchableOpacity>
        </View>

        <SectionHeading title="PRAYER" detail="bring it before God" />
        <View style={[styles.card, styles.rowCard]}>
          <IconTile icon="clover" family="material" />
          <View style={styles.rowCopy}>
            <ThemedText weight="bold" style={styles.rowTitle}>Prayer Journal</ThemedText>
            <ThemedText style={styles.meta}>Open Prayer · CAST · Pray for Someone</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.chevronColor} />
        </View>

        <SectionHeading title="REMEMBER" detail="from your journal" />
        <View style={[styles.card, styles.memoryCard]}>
          <View style={styles.memoryTop}>
            <ThemedText style={styles.cardLabel}>ON THIS DAY</ThemedText>
            <ThemedText style={styles.meta}>1 year ago</ThemedText>
          </View>
          <ThemedText style={styles.quote}>“I don’t know what happens next. That’s why I am writing this now.”</ThemedText>
          <ThemedText style={styles.meta}>{format(subYears(now, 1), 'MMMM d, yyyy')} · Heart Journal</ThemedText>
          <ThemedText style={styles.textLink}>Read this entry  →</ThemedText>
        </View>
        <View style={[styles.card, styles.memoryCard]}>
          <View style={styles.memoryTop}>
            <ThemedText style={styles.cardLabel}>A PRAYER TO REVISIT</ThemedText>
            <ThemedText style={styles.meta}>6 months ago</ThemedText>
          </View>
          <View style={styles.prayerMemory}>
            <IconTile icon="clover" family="material" />
            <View style={styles.rowCopy}>
              <ThemedText style={styles.rowTitle}>Wisdom for what I’m building</ThemedText>
              <ThemedText style={styles.meta}>You were praying for clarity and faithful direction.</ThemedText>
            </View>
          </View>
          <View style={styles.chips}>
            <View style={styles.chip}><ThemedText style={styles.chipText}>Still praying</ThemedText></View>
            <View style={styles.chip}><ThemedText style={styles.chipText}>Answered</ThemedText></View>
          </View>
        </View>

        <View style={styles.writeButton}>
          <Pencil size={16} color={Colors.hopeWhite} style={{ marginRight: 8 }} />
          <ThemedText weight="bold" style={styles.writeButtonText}>Write anything</ThemedText>
        </View>
        <ThemedText style={styles.closing}>Nothing on Today has to be completed.</ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.lightBackground },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 20, maxWidth: 760, width: '100%', alignSelf: 'center' },
  date: { color: Colors.sageMuted, fontFamily: Fonts.semiBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.8 },
  greeting: { color: Colors.text, fontFamily: Fonts.bold, fontWeight: '900', fontSize: 31, lineHeight: 39, marginTop: 8, letterSpacing: -0.5 },
  subtitle: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 2, marginBottom: 20 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 24, marginBottom: 10, paddingHorizontal: 2 },
  eyebrow: { color: Colors.text, fontFamily: Fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 2 },
  sectionDetail: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 12, lineHeight: 17, textAlign: 'right' },
  card: { backgroundColor: Colors.cardBackground, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 22, padding: 18, shadowColor: Colors.darkBackground, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  heroCard: { padding: 20 },
  sunCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.sage, marginBottom: 16 },
  moonCircle: { backgroundColor: Colors.anchorBlueLight },
  cardTitle: { color: Colors.text, fontFamily: Fonts.bold, fontWeight: '900', fontSize: 23, lineHeight: 30, marginBottom: 7, letterSpacing: -0.35 },
  compactTitle: { color: Colors.text, fontFamily: Fonts.bold, fontWeight: '900', fontSize: 21, lineHeight: 28, marginTop: 9, marginBottom: 6, letterSpacing: -0.3 },
  body: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
  meta: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 19 },
  cardLabel: { color: Colors.sage, fontFamily: Fonts.semiBold, fontSize: 11, lineHeight: 15, letterSpacing: 1.7 },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 20 },
  button: { backgroundColor: Colors.sage, paddingHorizontal: 17, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  beginButton: { backgroundColor: Colors.sage, borderWidth: 1, borderColor: Colors.sage, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20, minWidth: 120, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  beginButtonIcon: { marginRight: 8 },
  beginButtonText: { fontSize: 15, color: Colors.hopeWhite, letterSpacing: 0.5 },
  leftButton: { alignSelf: 'flex-start', marginTop: 16 },
  buttonText: { color: Colors.hopeWhite, fontFamily: Fonts.semiBold, fontSize: 12 },
  rowCard: { minHeight: 98, flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconTile: { width: 52, height: 52, borderRadius: 18, backgroundColor: Colors.anchorBlueLight, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 1 },
  rowTitle: { color: Colors.text, fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22 },
  twoColumns: { flexDirection: 'row', gap: 12, marginTop: 12 },
  smallCard: { flex: 1, minHeight: 154, justifyContent: 'space-between', padding: 16 },
  smallTitle: { color: Colors.text, fontFamily: Fonts.bold, fontSize: 15, lineHeight: 20, marginTop: 16 },
  memoryCard: { overflow: 'hidden', marginBottom: 12 },
  memoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  quote: { color: Colors.text, fontFamily: Fonts.lora.medium, fontSize: 22, lineHeight: 32, marginVertical: 18 },
  textLink: { color: Colors.sage, fontFamily: Fonts.semiBold, fontSize: 12.5, marginTop: 18 },
  prayerMemory: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 18 },
  chip: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { color: Colors.sage, fontFamily: Fonts.semiBold, fontSize: 12 },
  writeButton: { height: 58, borderRadius: 20, backgroundColor: Colors.sage, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  writeButtonText: { color: Colors.hopeWhite, fontFamily: Fonts.semiBold, fontSize: 17 },
  closing: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 12, textAlign: 'center', marginTop: 12 },
});

export default TodayScreen;
