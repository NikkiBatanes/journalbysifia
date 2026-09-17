import React, {useCallback, useMemo, useState} from 'react';
import {ScrollView, StatusBar, StyleSheet, TouchableOpacity, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../components/common/ThemedText';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {getLocalReview, type LocalReviewEntry, type ReviewType} from '../storage/reviewStorage';
import {getReviewStages} from '../services/reviewStages';
import {formatReviewPeriod} from './PastReviewsScreen';

const ReviewReaderScreen: React.FC = () => {
  const navigation = useNavigation<any>(); const route = useRoute<any>(); const insets = useSafeAreaInsets();
  const [review, setReview] = useState<LocalReviewEntry | null>(null);
  const type = route.params?.type as ReviewType; const id = route.params?.reviewId as string;
  useFocusEffect(useCallback(() => {getLocalReview(type, id).then(setReview);}, [type, id]));
  const sections = useMemo(() => {
    if (!review) return [];
    return getReviewStages(review.type).flatMap(stage => {
      if (stage.kind === 'question' && stage.answerKey && review.answers[stage.answerKey]?.trim()) return [{key:stage.key,title:stage.question ?? stage.label ?? stage.key,value:review.answers[stage.answerKey]}];
      if (stage.kind === 'priorities' && stage.answerKeys) { const values = stage.answerKeys.map(key => review.answers[key]?.trim()).filter(Boolean); return values.length ? [{key:stage.key,title:stage.question ?? stage.label ?? stage.key,value:values.map((v,i) => `${i + 1}. ${v}`).join('\n')}] : []; }
      return [];
    });
  }, [review]);
  if (!review) return <SafeAreaView style={styles.safeArea} />;
  return <SafeAreaView style={styles.safeArea} edges={['top']}>
    <StatusBar barStyle="dark-content" backgroundColor={Colors.lightBackground} />
    <View style={styles.header}><TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={22} color={Colors.text} /></TouchableOpacity><ThemedText weight="semiBold" style={styles.headerTitle}>{formatReviewPeriod(review)}</ThemedText><View style={styles.headerButton} /></View>
    <ScrollView contentContainerStyle={[styles.content,{paddingBottom:insets.bottom + 32}]} showsVerticalScrollIndicator={false}>
      <ThemedText weight="semiBold" style={styles.eyebrow}>{review.type.replace('_',' ').toUpperCase()} REVIEW</ThemedText><ThemedText weight="bold" style={styles.title}>{formatReviewPeriod(review)}</ThemedText><ThemedText style={styles.subtitle}>A chapter from the life you lived.</ThemedText><View style={styles.rule} />
      <View style={styles.sectionHeading}><Ionicons name="leaf-outline" size={23} color={Colors.sage} /><View><ThemedText weight="bold" style={styles.sectionTitle}>Your reflection</ThemedText><ThemedText style={styles.sectionSubtitle}>What you noticed and chose to carry.</ThemedText></View></View>
      {review.memorableItems.length > 0 && <View style={styles.card}><ThemedText weight="semiBold" style={styles.cardTitle}>What stood out</ThemedText><ThemedText style={styles.body}>{review.memorableItems.length} moment{review.memorableItems.length === 1 ? '' : 's'} remembered from this season.</ThemedText></View>}
      {sections.map(section => <View key={section.key} style={styles.card}><ThemedText weight="semiBold" style={styles.cardTitle}>{section.title}</ThemedText><ThemedText style={styles.body}>{section.value}</ThemedText></View>)}
      {!sections.length && !review.memorableItems.length && <View style={styles.card}><ThemedText style={styles.body}>This review was completed without written reflections.</ThemedText></View>}
      <ThemedText style={styles.completed}>Completed {new Date(review.completedAt ?? review.updatedAt).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})}</ThemedText>
    </ScrollView>
  </SafeAreaView>;
};
const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:Colors.lightBackground},header:{height:52,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},headerButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},headerTitle:{fontSize:13,color:Colors.text},content:{paddingHorizontal:22,paddingTop:24},eyebrow:{fontSize:10,letterSpacing:1.5,color:Colors.sage,textAlign:'center'},title:{fontFamily:Fonts.lora.bold,fontSize:34,lineHeight:42,color:Colors.text,textAlign:'center',marginTop:7},subtitle:{fontSize:14,color:Colors.textGray,textAlign:'center',marginTop:5},rule:{height:StyleSheet.hairlineWidth,backgroundColor:Colors.cardBorder,marginVertical:24},sectionHeading:{flexDirection:'row',gap:12,alignItems:'center',marginBottom:15},sectionTitle:{fontFamily:Fonts.lora.bold,fontSize:23,color:Colors.text},sectionSubtitle:{fontSize:13,color:Colors.textGray,marginTop:2},card:{backgroundColor:Colors.cardBackground,borderRadius:17,borderWidth:StyleSheet.hairlineWidth,borderColor:Colors.cardBorder,padding:17,marginBottom:10},cardTitle:{fontSize:14,color:Colors.text,marginBottom:8},body:{fontSize:15,lineHeight:23,color:Colors.textGray},completed:{fontSize:12,color:Colors.textGray,textAlign:'center',marginTop:20},
});
export default ReviewReaderScreen;
