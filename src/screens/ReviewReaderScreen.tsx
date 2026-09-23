import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HeaderBackButton from '../components/common/HeaderBackButton';
import ThemedText from '../components/common/ThemedText';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {triggerLightHaptic} from '../utils/haptics';
import {getLocalReview, type LocalReviewEntry, type ReviewType} from '../storage/reviewStorage';
import {getReviewStages} from '../services/reviewStages';
import {formatReviewPeriod} from './PastReviewsScreen';
import {getReviewCapture, type ReviewCapture, type ReviewCaptureItem} from '../services/reviewCaptureService';
import {rememberedReferenceMatchesMoment} from '../services/reviewMemoryService';
import {getWeeklyGratitudeItems} from '../utils/weeklyGratitudeAnswers';
import {formatWeeklyCareAnswer, formatWeeklyLifeCheckIn} from '../utils/weeklyLifeAreaAnswers';
import {formatWeeklyChallengeAnswer} from '../utils/weeklyChallengeAnswers';
import {formatWeeklySupportAnswer, getLegacyWeeklyLookingAheadSections} from '../utils/weeklyLookingAheadAnswers';
import {formatWeeklyLookingForwardAnswer, WEEKLY_LOOKING_FORWARD_TITLE} from '../utils/weeklyLookingForwardAnswers';
import {WeeklyReviewSummary} from '../components/reviews/WeeklyReviewSummary';

const ReviewReaderScreen: React.FC = () => {
  const navigation = useNavigation<any>(); const route = useRoute<any>(); const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);
  const [review, setReview] = useState<LocalReviewEntry | null>(null);
  const [capture, setCapture] = useState<ReviewCapture | null>(null);
  const [captureLoading, setCaptureLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const type = route.params?.type as ReviewType; const id = route.params?.reviewId as string;
  useFocusEffect(useCallback(() => {
    let active = true;
    setReview(null);
    setReviewLoading(true);
    setCapture(null);
    setCaptureLoading(true);
    const load = async () => {
      const nextReview = await getLocalReview(type, id);
      if (!active) {return;}
      setReview(nextReview);
      setReviewLoading(false);
      if (!nextReview) {setCapture(null); setCaptureLoading(false); return;}
      const nextCapture = await getReviewCapture(nextReview.periodStart, nextReview.periodEnd, nextReview.type);
      if (active) {setCapture(nextCapture); setCaptureLoading(false);}
    };
    load().catch(() => {
      if (active) {setCapture(null); setCaptureLoading(false); setReviewLoading(false);}
    });
    return () => {active = false;};
  }, [type, id, loadAttempt]));
  const sections = useMemo(() => {
    if (!review) {return [];}
    const currentSections = getReviewStages(review.type).flatMap(stage => {
      if (review.type === 'weekly' && stage.key === 'looking_forward_feeling') {return [];}
      if (review.type === 'weekly' && stage.key === 'looking_forward') {
        const value = formatWeeklyLookingForwardAnswer(review.answers);
        return value ? [{key: stage.key, title: WEEKLY_LOOKING_FORWARD_TITLE, value}] : [];
      }
      if (review.type === 'weekly' && stage.key === 'prayer_ahead') {
        const prayer = formatWeeklySupportAnswer(review.answers);
        const prayerTitle = review.answers.week_looking_forward === undefined && review.answers.week_support_choices === undefined
          ? 'What do you want to keep bringing to God?'
          : 'Your prayer for the week';
        return [
          ...(prayer ? [{key: 'prayer_ahead', title: prayerTitle, value: prayer}] : []),
        ];
      }
      if (review.type === 'weekly' && stage.key === 'watch_for') {
        const value = formatWeeklyChallengeAnswer(review.answers);
        return value ? [{key: stage.key, title: stage.question!, value}] : [];
      }
      if (review.type === 'weekly' && (stage.kind === 'life_check_in' || stage.key === 'dont_forget')) {
        const value = stage.kind === 'life_check_in'
          ? formatWeeklyLifeCheckIn(review.answers)
          : formatWeeklyCareAnswer(review.answers);
        return value ? [{key: stage.key, title: stage.question!, value}] : [];
      }
      if (review.type === 'weekly' && stage.kind === 'remembered') {
        const memory = review.answers.week_memory_other?.trim();
        return memory ? [{key: 'week_memory_other', title: 'Anything else you want to remember?', value: memory}] : [];
      }
      if (review.type === 'weekly' && stage.key === 'learning') {
        const learning = review.answers.week_learning?.trim();
        const savedPrayer = review.answers.prayer?.trim();
        return [
          ...(learning ? [{key: stage.key, title: stage.question!, value: learning}] : []),
          // Keep older weekly prayers readable under their original prompt.
          ...(savedPrayer ? [{key: 'prayer', title: 'What are you still bringing to God?', value: savedPrayer}] : []),
        ];
      }
      if (review.type === 'weekly' && stage.key === 'notice') {
        const values = getWeeklyGratitudeItems(review.answers);
        if (!values.length) {return [];}
        return [{
          key: stage.key,
          title: stage.question ?? stage.label ?? stage.key,
          value: values.join('\n\n'),
        }];
      }
      if (stage.key === 'god') {
        const choices = (review.answers.god || '').split('|').map(value => value.trim()).filter(Boolean);
        const custom = review.answers.god_faithfulness_other?.trim();
        const values = [...choices, ...(custom ? [custom] : [])];
        if (!values.length) {return [];}
        return [{
          key: stage.key,
          title: stage.question ?? stage.label ?? stage.key,
          value: values.length === 1 ? values[0] : values.map(value => `• ${value}`).join('\n'),
        }];
      }
      if (stage.kind === 'question' && stage.answerKey && review.answers[stage.answerKey]?.trim()) {return [{key:stage.key,title:stage.question ?? stage.label ?? stage.key,value:review.answers[stage.answerKey]}];}
      if (stage.kind === 'priorities' && stage.answerKeys) { const values = stage.answerKeys.map(key => review.answers[key]?.trim()).filter(Boolean); return values.length ? [{key:stage.key,title:stage.question ?? stage.label ?? stage.key,value:values.map((v,i) => `${i + 1}. ${v}`).join('\n')}] : []; }
      return [];
    });
    return review.type === 'weekly'
      ? [...currentSections, ...getLegacyWeeklyLookingAheadSections(review.answers)]
      : currentSections;
  }, [review]);
  const rememberedItems = useMemo(() => {
    if (!review || !capture) {return [] as ReviewCaptureItem[];}
    const used = new Set<string>();
    return review.memorableItems.flatMap(remembered => {
      const exact = capture.items.find(candidate =>
        candidate.id === remembered.id && candidate.selectedDate === remembered.selectedDate,
      );
      const item = exact ?? capture.items.find(candidate => {
        const key = `${candidate.id}:${candidate.selectedDate}`;
        return !used.has(key) && rememberedReferenceMatchesMoment(remembered, candidate);
      });
      if (!item) {return [];}
      used.add(`${item.id}:${item.selectedDate}`);
      return [item];
    });
  }, [capture, review]);
  const unresolvedRememberedCount = Math.max(0, (review?.memorableItems.length ?? 0) - rememberedItems.length);
  if (!review) {
    return <SafeAreaView style={[styles.safeArea, {paddingTop: topInset}]} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.lightBackground} translucent={false}/>
      <View style={styles.header}><HeaderBackButton onPress={() => {triggerLightHaptic(); navigation.goBack();}} color={Colors.sage}/></View>
      <View style={styles.loadState}>
        {reviewLoading ? <><ActivityIndicator color={Colors.sage}/><ThemedText style={styles.body}>Loading your review…</ThemedText></> : <>
          <ThemedText style={styles.body}>This review could not be opened.</ThemedText>
          <TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={() => {triggerLightHaptic(); setLoadAttempt(value => value + 1);}}>
            <ThemedText weight="semiBold" style={styles.headerTitle}>Try again</ThemedText>
          </TouchableOpacity>
        </>}
      </View>
    </SafeAreaView>;
  }
  if (review.type === 'weekly') {
    return <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent/>
      <WeeklyReviewSummary key={review.id} review={review} capture={capture} captureLoading={captureLoading}
        bottomInset={insets.bottom} topInset={topInset}
        onBack={() => {triggerLightHaptic(); navigation.goBack();}}/>
    </SafeAreaView>;
  }
  return <SafeAreaView style={[styles.safeArea, {paddingTop: topInset}]} edges={['left', 'right']}>
    <StatusBar barStyle="dark-content" backgroundColor={Colors.lightBackground} translucent={false} />
    <View style={styles.header}><HeaderBackButton onPress={() => {triggerLightHaptic(); navigation.goBack();}} color={Colors.text} /><ThemedText weight="semiBold" style={styles.headerTitle}>{formatReviewPeriod(review)}</ThemedText><View style={styles.headerButton} /></View>
    <ScrollView contentContainerStyle={[styles.content,{paddingBottom:insets.bottom + 32}]} showsVerticalScrollIndicator={false}>
      <ThemedText weight="semiBold" style={styles.eyebrow}>{review.type.replace('_',' ').toUpperCase()} REVIEW</ThemedText><ThemedText weight="bold" style={styles.title}>{formatReviewPeriod(review)}</ThemedText><ThemedText style={styles.subtitle}>A chapter from the life you lived.</ThemedText><View style={styles.rule} />
      <View style={styles.sectionHeading}><Ionicons name="leaf-outline" size={23} color={Colors.sage} /><View><ThemedText weight="bold" style={styles.sectionTitle}>Your reflection</ThemedText><ThemedText style={styles.sectionSubtitle}>What you noticed and chose to carry.</ThemedText></View></View>
      {!!review.prayerSnapshot?.length && <>
        <View style={styles.prayerHeading}><Ionicons name="sparkles-outline" size={18} color={Colors.sage} /><ThemedText weight="semiBold" style={styles.prayerHeadingText}>What happened in prayer</ThemedText></View>
        {review.prayerSnapshot.map(item => <View key={item.id} style={styles.card}><ThemedText weight="semiBold" style={styles.cardTitle}>{item.title}</ThemedText><ThemedText style={styles.prayerMeta}>{item.subtitle} · {item.eventDate}</ThemedText>{item.text?.trim() ? <ThemedText style={styles.body}>{item.text}</ThemedText> : null}</View>)}
      </>}
      {review.memorableItems.length > 0 && <>
        <View style={styles.rememberedHeading}><Ionicons name="bookmark" size={18} color={Colors.sage} /><ThemedText weight="semiBold" style={styles.rememberedHeadingText}>What you chose to remember</ThemedText></View>
        {rememberedItems.map(item => <View key={`${item.kind}:${item.id}:${item.selectedDate}`} style={styles.card}>
          <ThemedText weight="semiBold" style={styles.cardTitle}>{item.title}</ThemedText>
          <ThemedText style={styles.prayerMeta}>{[item.subtitle, item.selectedDate].filter(Boolean).join(' · ')}</ThemedText>
          {item.text?.trim() ? <ThemedText style={styles.body}>{item.text.trim()}</ThemedText> : item.lines?.length ? <ThemedText style={styles.body}>{item.lines.join('\n')}</ThemedText> : null}
        </View>)}
        {unresolvedRememberedCount > 0 ? <View style={styles.card}><ThemedText style={styles.body}>{unresolvedRememberedCount} remembered moment{unresolvedRememberedCount === 1 ? '' : 's'} could not be reopened because the original content is no longer available.</ThemedText></View> : null}
      </>}
      {sections.map(section => <View key={section.key} style={styles.card}><ThemedText weight="semiBold" style={styles.cardTitle}>{section.title}</ThemedText><ThemedText style={styles.body}>{section.value}</ThemedText></View>)}
      {!sections.length && !review.memorableItems.length && !review.prayerSnapshot?.length && <View style={styles.card}><ThemedText style={styles.body}>This review was completed without written reflections.</ThemedText></View>}
      <ThemedText style={styles.completed}>Completed {new Date(review.completedAt ?? review.updatedAt).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})}</ThemedText>
    </ScrollView>
  </SafeAreaView>;
};
const styles = StyleSheet.create({
  loadState: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24},
  retry: {minHeight: 44, paddingHorizontal: 22, justifyContent: 'center', backgroundColor: Colors.anchorBlueLight, borderRadius: 14},
  safeArea:{flex:1,backgroundColor:Colors.lightBackground},header:{height:52,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},headerButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},headerTitle:{fontSize:13,color:Colors.text},content:{paddingHorizontal:22,paddingTop:24},eyebrow:{fontSize:10,letterSpacing:1.5,color:Colors.sage,textAlign:'center'},title:{fontFamily:Fonts.lora.bold,fontSize:34,lineHeight:42,color:Colors.text,textAlign:'center',marginTop:7},subtitle:{fontSize:14,color:Colors.textGray,textAlign:'center',marginTop:5},rule:{height:StyleSheet.hairlineWidth,backgroundColor:Colors.cardBorder,marginVertical:24},sectionHeading:{flexDirection:'row',gap:12,alignItems:'center',marginBottom:15},sectionTitle:{fontFamily:Fonts.lora.bold,fontSize:23,color:Colors.text},sectionSubtitle:{fontSize:13,color:Colors.textGray,marginTop:2},prayerHeading:{flexDirection:'row',alignItems:'center',gap:8,marginTop:4,marginBottom:10},prayerHeadingText:{fontSize:15,color:Colors.text},rememberedHeading:{flexDirection:'row',alignItems:'center',gap:8,marginTop:8,marginBottom:10},rememberedHeadingText:{fontSize:15,color:Colors.text},prayerMeta:{fontSize:12,color:Colors.sage,marginBottom:8},card:{backgroundColor:Colors.cardBackground,borderRadius:17,borderWidth:StyleSheet.hairlineWidth,borderColor:Colors.cardBorder,padding:17,marginBottom:10},cardTitle:{fontSize:14,color:Colors.text,marginBottom:8},body:{fontSize:15,lineHeight:23,color:Colors.textGray},completed:{fontSize:12,color:Colors.textGray,textAlign:'center',marginTop:20},
});
export default ReviewReaderScreen;
