import React, {useCallback, useMemo, useState} from 'react';
import {ScrollView, StatusBar, StyleSheet, TouchableOpacity, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../components/common/ThemedText';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {triggerLightHaptic} from '../utils/haptics';
import {type ReviewType, type LocalReviewEntry, getLocalReviewsByType} from '../storage/reviewStorage';

type ReviewTab = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
const TABS: Array<{key: ReviewTab; label: string; types: ReviewType[]}> = [
  {key: 'weekly', label: 'Weekly', types: ['weekly']},
  {key: 'monthly', label: 'Monthly', types: ['monthly']},
  {key: 'quarterly', label: 'Quarterly', types: ['quarterly']},
  {key: 'yearly', label: 'Yearly', types: ['year_end', 'begin_year']},
];
const dateFromYmd = (value: string) => new Date(`${value}T12:00:00`);
export const formatReviewPeriod = (review: LocalReviewEntry) => {
  const start = dateFromYmd(review.periodStart); const end = dateFromYmd(review.periodEnd);
  if (review.type === 'monthly') return start.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
  if (review.type === 'quarterly') return `${start.toLocaleDateString(undefined, {month: 'short'})} – ${end.toLocaleDateString(undefined, {month: 'short', year: 'numeric'})}`;
  if (review.type === 'year_end' || review.type === 'begin_year') return String(start.getFullYear());
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth ? `${start.toLocaleDateString(undefined, {month: 'short'})} ${start.getDate()} – ${end.getDate()}` : `${start.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} – ${end.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`;
};

const PastReviewsScreen: React.FC = () => {
  const navigation = useNavigation<any>(); const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ReviewTab>('weekly');
  const [reviews, setReviews] = useState<LocalReviewEntry[]>([]);
  const loadReviews = useCallback(async () => {
    const all = await Promise.all(TABS.flatMap(tab => tab.types).map(type => getLocalReviewsByType(type)));
    setReviews(all.flat().sort((a, b) => b.periodStart.localeCompare(a.periodStart)));
  }, []);
  useFocusEffect(useCallback(() => { loadReviews(); }, [loadReviews]));
  const visible = useMemo(() => { const types = TABS.find(tab => tab.key === activeTab)?.types ?? []; return reviews.filter(r => types.includes(r.type)); }, [activeTab, reviews]);
  const current = visible.find(r => r.status === 'draft'); const completed = visible.filter(r => r.status === 'completed');
  const openReview = (review: LocalReviewEntry) => { triggerLightHaptic(); navigation.navigate(review.status === 'completed' ? 'ReviewReader' : 'Review', {type: review.type, reviewId: review.id, periodStart: review.periodStart, periodEnd: review.periodEnd}); };
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.lightBackground} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={22} color={Colors.text} /></TouchableOpacity>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('ReviewSettings')} accessibilityLabel="Review settings"><Ionicons name="settings-outline" size={21} color={Colors.text} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + 30}]} showsVerticalScrollIndicator={false}>
        <ThemedText weight="bold" style={styles.title}>Reviews</ThemedText>
        <ThemedText style={styles.subtitle}>Your life, reflected over time.</ThemedText>
        <View style={styles.tabs}>{TABS.map(tab => <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.activeTab]} onPress={() => {triggerLightHaptic(); setActiveTab(tab.key);}}><ThemedText weight="semiBold" style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</ThemedText></TouchableOpacity>)}</View>
        {current ? <TouchableOpacity style={styles.currentCard} onPress={() => openReview(current)} activeOpacity={0.78}>
          <View style={styles.iconTile}><Ionicons name="leaf-outline" size={23} color={Colors.sage} /></View><View style={styles.cardBody}>
            <View style={styles.cardTopline}><ThemedText weight="semiBold" style={styles.cardEyebrow}>CURRENT {activeTab.toUpperCase()}</ThemedText><View style={styles.badge}><ThemedText style={styles.badgeText}>In progress</ThemedText></View></View>
            <ThemedText weight="bold" style={styles.currentPeriod}>{formatReviewPeriod(current)}</ThemedText><ThemedText style={styles.cardDescription}>Keep reflecting. Your answers are saved as you go.</ThemedText>
          </View></TouchableOpacity> : null}
        <ThemedText weight="bold" style={styles.sectionTitle}>{completed.length ? `Past ${TABS.find(t => t.key === activeTab)?.label}` : TABS.find(t => t.key === activeTab)?.label}</ThemedText>
        {completed.length ? <View style={styles.listCard}>{completed.map((review, index) => <TouchableOpacity key={review.id} style={[styles.listRow, index < completed.length - 1 && styles.listDivider]} onPress={() => openReview(review)} activeOpacity={0.72}>
          <View style={[styles.iconTile, styles.smallTile]}><Ionicons name="calendar-outline" size={19} color={Colors.sage} /></View><View style={styles.cardBody}><ThemedText weight="semiBold" style={styles.listTitle}>{formatReviewPeriod(review)}</ThemedText><ThemedText numberOfLines={1} style={styles.listMeta}>{Object.keys(review.answers).length} reflections · {review.memorableItems.length} remembered</ThemedText></View><Ionicons name="chevron-forward" size={19} color={Colors.textGray} />
        </TouchableOpacity>)}</View> : <View style={styles.emptyCard}><Ionicons name="leaf-outline" size={28} color={Colors.sage} /><ThemedText weight="semiBold" style={styles.emptyTitle}>Your reflections will gather here.</ThemedText><ThemedText style={styles.emptyText}>When a {activeTab} review becomes available, you can begin it from Today.</ThemedText></View>}
      </ScrollView>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:Colors.lightBackground},header:{height:52,paddingHorizontal:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},headerButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},content:{paddingHorizontal:22,paddingTop:6},title:{fontFamily:Fonts.lora.bold,fontSize:34,lineHeight:42,color:Colors.text},subtitle:{fontSize:15,color:Colors.textGray,marginTop:2,marginBottom:22},tabs:{flexDirection:'row',gap:7,marginBottom:24},tab:{flex:1,minHeight:40,borderRadius:22,backgroundColor:Colors.cardBackground,alignItems:'center',justifyContent:'center',paddingHorizontal:4},activeTab:{backgroundColor:Colors.sage},activeTabText:{color:Colors.hopeWhite},tabText:{fontSize:12,color:Colors.text},currentCard:{flexDirection:'row',gap:13,backgroundColor:Colors.cardBackground,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:Colors.cardBorder,padding:14,marginBottom:24},iconTile:{width:46,height:46,borderRadius:13,backgroundColor:'#EDF1E9',alignItems:'center',justifyContent:'center'},smallTile:{width:42,height:42,borderRadius:11},cardBody:{flex:1},cardTopline:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},cardEyebrow:{fontSize:10,letterSpacing:1.1,color:Colors.sage},badge:{backgroundColor:'#E7F0E9',paddingHorizontal:9,paddingVertical:5,borderRadius:14},badgeText:{fontSize:10,color:Colors.sage},currentPeriod:{fontFamily:Fonts.lora.bold,fontSize:22,color:Colors.text,marginTop:4},cardDescription:{fontSize:13,lineHeight:19,color:Colors.textGray,marginTop:6},sectionTitle:{fontSize:17,color:Colors.text,marginBottom:10},listCard:{backgroundColor:Colors.cardBackground,borderRadius:18,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:Colors.cardBorder},listRow:{minHeight:76,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:13},listDivider:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:Colors.cardBorder},listTitle:{fontSize:15,color:Colors.text,marginBottom:3},listMeta:{fontSize:12,color:Colors.textGray},emptyCard:{backgroundColor:Colors.cardBackground,borderRadius:18,alignItems:'center',padding:28,borderWidth:StyleSheet.hairlineWidth,borderColor:Colors.cardBorder},emptyTitle:{fontFamily:Fonts.lora.semiBold,fontSize:17,color:Colors.text,textAlign:'center',marginTop:12},emptyText:{fontSize:13,lineHeight:20,color:Colors.textGray,textAlign:'center',marginTop:7},
});
export default PastReviewsScreen;
