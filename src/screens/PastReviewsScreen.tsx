import React, {useCallback, useMemo, useRef, useState} from 'react';
import {BackHandler, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HeaderBackButton from '../components/common/HeaderBackButton';
import ThemedText from '../components/common/ThemedText';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {triggerLightHaptic} from '../utils/haptics';
import {type ReviewType, type LocalReviewEntry, getLocalReviewsByType} from '../storage/reviewStorage';
import {getReviewEligibility, type DashboardReview} from '../services/reviewEligibilityService';
import {getActiveReviewQAContext, getReviewQAEligibilityOptions} from '../dev/reviews/reviewQALoader';

type ReviewTab = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
const TABS: Array<{key: ReviewTab; label: string; types: ReviewType[]}> = [
  {key: 'weekly', label: 'Weekly', types: ['weekly']},
  {key: 'monthly', label: 'Monthly', types: ['monthly']},
  {key: 'quarterly', label: 'Quarterly', types: ['quarterly']},
  {key: 'yearly', label: 'Yearly', types: ['year_end', 'begin_year']},
];
const tabForReviewType = (type: ReviewType): ReviewTab => {
  if (type === 'year_end' || type === 'begin_year') {return 'yearly';}
  return type;
};
const dateFromYmd = (value: string) => new Date(`${value}T12:00:00`);
type ReviewPeriodLike = Pick<LocalReviewEntry, 'type' | 'periodStart' | 'periodEnd'>;
export const formatReviewPeriod = (review: ReviewPeriodLike) => {
  const start = dateFromYmd(review.periodStart); const end = dateFromYmd(review.periodEnd);
  if (review.type === 'monthly') {return start.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});}
  if (review.type === 'quarterly') {return `${start.toLocaleDateString(undefined, {month: 'short'})} – ${end.toLocaleDateString(undefined, {month: 'short', year: 'numeric'})}`;}
  if (review.type === 'year_end' || review.type === 'begin_year') {return String(start.getFullYear());}
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth ? `${start.toLocaleDateString(undefined, {month: 'short'})} ${start.getDate()} – ${end.getDate()}` : `${start.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} – ${end.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`;
};
const formatActiveReviewPeriod = (review: DashboardReview) => formatReviewPeriod({
  type: review.type,
  periodStart: review.period.periodStart,
  periodEnd: review.period.periodEnd,
});
const formatMonthlyDeadline = (review: DashboardReview) => {
  if (review.type !== 'monthly' || !review.period.availableUntil) {return null;}
  const deadline = dateFromYmd(review.period.availableUntil);
  deadline.setDate(deadline.getDate() - 1);
  return deadline.toLocaleDateString(undefined, {month: 'long', day: 'numeric'});
};

const PastReviewsScreen: React.FC<any> = ({route}) => {
  const navigation = useNavigation<any>(); const insets = useSafeAreaInsets();
  const returnToMore = route?.params?.returnTo === 'More';
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);
  const [activeTab, setActiveTab] = useState<ReviewTab>('weekly');
  const [reviews, setReviews] = useState<LocalReviewEntry[]>([]);
  const [activeReviews, setActiveReviews] = useState<DashboardReview[]>([]);
  const selectedInitialActiveTab = useRef(false);
  const closeReviews = useCallback(() => {
    triggerLightHaptic();
    if (returnToMore) {
      navigation.popToTop();
      navigation.getParent()?.navigate('More');
      return;
    }
    navigation.goBack();
  }, [navigation, returnToMore]);
  const loadReviews = useCallback(async () => {
    const qaContext = __DEV__ ? await getActiveReviewQAContext() : null;
    const [all, eligibility] = await Promise.all([
      Promise.all(TABS.flatMap(tab => tab.types).map(type => getLocalReviewsByType(type))),
      getReviewEligibility(
        qaContext?.referenceDate,
        undefined,
        qaContext ? getReviewQAEligibilityOptions(qaContext) : undefined,
      ).catch(() => ({main: null, alsoReady: [], allActive: []})),
    ]);
    setReviews(all.flat().sort((a, b) => b.periodStart.localeCompare(a.periodStart)));
    setActiveReviews(eligibility.allActive);
    if (!selectedInitialActiveTab.current) {
      selectedInitialActiveTab.current = true;
      if (eligibility.main) {
        setActiveTab(tabForReviewType(eligibility.main.type));
      }
    }
  }, []);
  useFocusEffect(useCallback(() => { loadReviews(); }, [loadReviews]));
  useFocusEffect(useCallback(() => {
    if (!returnToMore || Platform.OS !== 'android') {return undefined;}
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeReviews();
      return true;
    });
    return () => subscription.remove();
  }, [closeReviews, returnToMore]));
  const activeTypes = useMemo(() => TABS.find(tab => tab.key === activeTab)?.types ?? [], [activeTab]);
  const visible = useMemo(() => reviews.filter(r => activeTypes.includes(r.type)), [activeTypes, reviews]);
  const current = useMemo(() => activeReviews.filter(r => activeTypes.includes(r.type)), [activeReviews, activeTypes]);
  const completed = visible.filter(r => r.status === 'completed');
  const openReview = (review: LocalReviewEntry) => { triggerLightHaptic(); navigation.navigate(review.status === 'completed' ? 'ReviewReader' : 'Review', {type: review.type, reviewId: review.id, periodStart: review.periodStart, periodEnd: review.periodEnd, ...(review.status === 'draft' ? {resumeLastStage: true} : {})}); };
  const openCurrentReview = (review: DashboardReview) => {
    triggerLightHaptic();
    navigation.navigate('Review', {
      type: review.type,
      reviewId: review.review?.id,
      periodStart: review.period.periodStart,
      periodEnd: review.period.periodEnd,
      ...(review.state === 'in_progress' ? {resumeLastStage: true} : {}),
    });
  };
  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.lightBackground} translucent={false} />
      <View style={[styles.header, {top: topInset}]}>
        <HeaderBackButton onPress={closeReviews} color={Colors.text} />
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            triggerLightHaptic();
            navigation.navigate('ReviewSettings');
          }}
          activeOpacity={0.7}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          accessibilityRole="button"
          accessibilityLabel="Review settings">
          <Ionicons name="settings-outline" size={21} color={Colors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, {paddingTop: topInset + 58, paddingBottom: insets.bottom + 30}]} showsVerticalScrollIndicator={false}>
        <ThemedText weight="bold" style={styles.title}>Reviews</ThemedText>
        <ThemedText style={styles.subtitle}>Your life, reflected over time.</ThemedText>
        <ScrollView
          horizontal
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabs}
          showsHorizontalScrollIndicator={false}>
          {TABS.map(tab => {
            const selected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, selected && styles.activeTab]}
                onPress={() => {triggerLightHaptic(); setActiveTab(tab.key);}}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{selected}}>
                <ThemedText weight="semiBold" style={[styles.tabText, selected && styles.activeTabText]}>
                  {tab.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {current.map(review => {
          const inProgress = review.state === 'in_progress';
          const deadline = formatMonthlyDeadline(review);
          const tabLabel = TABS.find(t => t.key === activeTab)?.label ?? activeTab;
          return <TouchableOpacity
            key={`${review.type}:${review.period.periodStart}`}
            style={styles.currentCard}
            onPress={() => openCurrentReview(review)}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={`${inProgress ? 'Continue' : 'Begin'} ${tabLabel.toLowerCase()} review for ${formatActiveReviewPeriod(review)}`}>
            <View style={styles.iconTile}><Ionicons name="leaf-outline" size={23} color={Colors.sage} /></View><View style={styles.cardBody}>
              <View style={styles.cardTopline}><ThemedText weight="semiBold" style={styles.cardEyebrow}>CURRENT {activeTab.toUpperCase()}</ThemedText><View style={styles.badge}><ThemedText style={styles.badgeText}>{inProgress ? 'In progress' : 'Ready'}</ThemedText></View></View>
              <ThemedText weight="bold" style={styles.currentPeriod}>{formatActiveReviewPeriod(review)}</ThemedText>
              <ThemedText style={styles.cardDescription}>{inProgress ? 'Keep reflecting. Your answers are saved as you go.' : 'This review is ready when you are.'}{deadline ? ` Available through ${deadline}.` : ''}</ThemedText>
            </View>
          </TouchableOpacity>;
        })}
        <ThemedText weight="bold" style={styles.sectionTitle}>Past {TABS.find(t => t.key === activeTab)?.label}</ThemedText>
        {completed.length ? <View style={styles.listCard}>{completed.map((review, index) => <TouchableOpacity key={review.id} style={[styles.listRow, index < completed.length - 1 && styles.listDivider]} onPress={() => openReview(review)} activeOpacity={0.72}>
          <View style={[styles.iconTile, styles.smallTile]}><Ionicons name="calendar-outline" size={19} color={Colors.sage} /></View><View style={styles.cardBody}><ThemedText weight="semiBold" style={styles.listTitle}>{formatReviewPeriod(review)}</ThemedText><ThemedText numberOfLines={1} style={styles.listMeta}>{Object.keys(review.answers).length} reflections · {review.memorableItems.length} remembered</ThemedText></View><Ionicons name="chevron-forward" size={19} color={Colors.textGray} />
        </TouchableOpacity>)}</View> : <View style={styles.emptyCard}><Ionicons name="leaf-outline" size={28} color={Colors.sage} /><ThemedText weight="semiBold" style={styles.emptyTitle}>Your completed reviews will gather here.</ThemedText><ThemedText style={styles.emptyText}>Finish a {activeTab} review to add it to this history.</ThemedText></View>}
      </ScrollView>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:Colors.lightBackground},header:{position:'absolute',left:0,right:0,zIndex:10,height:52,paddingHorizontal:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},headerButton:{width:42,height:42,borderRadius:21,backgroundColor:Colors.cardBackground,alignItems:'center',justifyContent:'center'},scroll:{flex:1},content:{flexGrow:1,paddingHorizontal:22,paddingTop:6},title:{fontFamily:Fonts.lora.bold,fontSize:34,lineHeight:42,color:Colors.text},subtitle:{fontSize:15,color:Colors.textGray,marginTop:2,marginBottom:22},tabsScroll:{flexGrow:0,marginBottom:24},tabs:{flexDirection:'row',gap:8},tab:{minWidth:72,minHeight:44,borderRadius:22,backgroundColor:'rgba(82, 106, 91, 0.08)',borderWidth:0.5,borderColor:'rgba(82, 106, 91, 0.2)',alignItems:'center',justifyContent:'center',paddingHorizontal:14,paddingVertical:11},activeTab:{backgroundColor:Colors.sageMuted,borderColor:Colors.sage},activeTabText:{color:Colors.hopeWhite},tabText:{fontSize:12,lineHeight:17,color:Colors.text,textAlign:'center'},currentCard:{flexDirection:'row',gap:13,backgroundColor:Colors.cardBackground,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:Colors.cardBorder,padding:14,marginBottom:24},iconTile:{width:46,height:46,borderRadius:13,backgroundColor:'#EDF1E9',alignItems:'center',justifyContent:'center'},smallTile:{width:42,height:42,borderRadius:11},cardBody:{flex:1},cardTopline:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},cardEyebrow:{fontSize:10,letterSpacing:1.1,color:Colors.sage},badge:{backgroundColor:'#E7F0E9',paddingHorizontal:9,paddingVertical:5,borderRadius:14},badgeText:{fontSize:10,color:Colors.sage},currentPeriod:{fontFamily:Fonts.lora.bold,fontSize:22,color:Colors.text,marginTop:4},cardDescription:{fontSize:13,lineHeight:19,color:Colors.textGray,marginTop:6},sectionTitle:{fontSize:17,color:Colors.text,marginBottom:10},listCard:{backgroundColor:Colors.cardBackground,borderRadius:18,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:Colors.cardBorder},listRow:{minHeight:76,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:13},listDivider:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:Colors.cardBorder},listTitle:{fontSize:15,color:Colors.text,marginBottom:3},listMeta:{fontSize:12,color:Colors.textGray},emptyCard:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:28,paddingVertical:36},emptyTitle:{fontFamily:Fonts.lora.semiBold,fontSize:17,color:Colors.text,textAlign:'center',marginTop:12},emptyText:{fontSize:13,lineHeight:20,color:Colors.textGray,textAlign:'center',marginTop:7},
});
export default PastReviewsScreen;
