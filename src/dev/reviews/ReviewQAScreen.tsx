import React, {useState} from 'react';
import {Alert, ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../../components/common/ThemedText';
import {Colors} from '../../theme/colors';
import {REVIEW_QA_WEEKLY_REFERENCE_DATE} from './reviewQAClock';
import {formatReviewQAPeriod, REVIEW_QA_SCENARIOS, type ReviewQAScenario, type ReviewQADefinition} from './reviewQAFixtures';
import {clearReviewQAData, loadReviewQAScenario} from './reviewQALoader';
import type {ReviewCapture} from '../../services/reviewCaptureService';

const localDate = (value:string) => {const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d,12);};

const ReviewQAScreen=()=>{
  const navigation=useNavigation<any>(); const [busy,setBusy]=useState(false); const [loaded,setLoaded]=useState<ReviewQAScenario|null>(null); const [capture,setCapture]=useState<ReviewCapture|null>(null);
  if(!__DEV__) return null;
  const load=async(scenario:ReviewQADefinition,showOnToday=true)=>{setBusy(true);try{const result=await loadReviewQAScenario(scenario.id);setLoaded(scenario.id);setCapture(result.capture);if(showOnToday){navigation.getParent()?.navigate('Today');}}catch(error){Alert.alert('Unable to load Review QA',error instanceof Error?error.message:'Unknown error');}finally{setBusy(false);}};
  const clear=async()=>{setBusy(true);try{const count=await clearReviewQAData();setLoaded(null);setCapture(null);Alert.alert('Review QA cleared',`${count} namespaced records removed. Normal data was preserved.`);}finally{setBusy(false);}};
  return <SafeAreaView style={styles.safe}><View style={styles.header}><TouchableOpacity accessibilityLabel="Close Review QA" onPress={()=>navigation.goBack()}><Ionicons name="close" size={24} color={Colors.text}/></TouchableOpacity><ThemedText weight="bold" style={styles.headerTitle}>Weekly Review QA</ThemedText><View style={{width:24}}/></View><ScrollView contentContainerStyle={styles.content}>
    <ThemedText style={styles.dev}>DEVELOPMENT ONLY</ThemedText><ThemedText style={styles.reference}>September 14–20, 2026</ThemedText><ThemedText style={styles.note}>Monday-start profile · 10 structured Guided Reflections included · Reference date {localDate(REVIEW_QA_WEEKLY_REFERENCE_DATE).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})}</ThemedText>
    {REVIEW_QA_SCENARIOS.map(s=><View key={s.id} style={styles.card}><View style={styles.row}><View style={{flex:1}}><ThemedText weight="bold" style={styles.title}>{s.title}</ThemedText><ThemedText style={styles.period}>{formatReviewQAPeriod(s)}</ThemedText></View><ThemedText weight="semiBold" style={styles.status}>{s.status}</ThemedText></View>{loaded===s.id&&capture?<ThemedText style={styles.counts}>Captured: {capture.items.length} · Prayer {capture.summary.prayer} · Gratitude {capture.summary.gratitude} · Reflections {capture.summary.reflection} · Scripture {capture.summary.scripture} · Journal {capture.summary.journal}</ThemedText>:null}<View style={styles.actions}><TouchableOpacity disabled={busy} style={styles.open} onPress={()=>load(s,true)}><ThemedText weight="semiBold" style={styles.openText}>Show on Today</ThemedText></TouchableOpacity><TouchableOpacity disabled={busy} style={styles.reload} onPress={()=>load(s,false)}><ThemedText style={styles.reloadText}>Reload data</ThemedText></TouchableOpacity></View></View>)}
    <TouchableOpacity disabled={busy} style={styles.clear} onPress={clear}><ThemedText weight="semiBold" style={styles.clearText}>Clear Review QA Context</ThemedText></TouchableOpacity>
  </ScrollView></SafeAreaView>;
};
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:Colors.lightBackground},header:{height:56,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},headerTitle:{fontSize:17,color:Colors.text},content:{padding:20,paddingBottom:48},dev:{fontSize:10,letterSpacing:1.5,color:Colors.alertCoral,textAlign:'center'},reference:{fontSize:18,color:Colors.text,textAlign:'center',marginTop:8},secondaryReference:{fontSize:12,color:Colors.textGray,textAlign:'center',marginTop:3},note:{fontSize:13,lineHeight:19,color:Colors.textGray,textAlign:'center',marginVertical:16},card:{backgroundColor:Colors.cardBackground,borderWidth:1,borderColor:Colors.cardBorder,borderRadius:18,padding:16,marginBottom:12},row:{flexDirection:'row',gap:10,alignItems:'flex-start'},title:{fontSize:17,color:Colors.text},period:{fontSize:13,color:Colors.textGray,marginTop:4},status:{fontSize:9,color:Colors.sage,letterSpacing:.7,maxWidth:100,textAlign:'right'},counts:{fontSize:11,lineHeight:17,color:Colors.textGray,marginTop:12},actions:{flexDirection:'row',gap:9,marginTop:14},open:{flex:1,backgroundColor:Colors.sage,borderRadius:18,padding:11},openText:{color:Colors.hopeWhite,textAlign:'center',fontSize:12},reload:{paddingHorizontal:15,paddingVertical:11,borderRadius:18,borderWidth:1,borderColor:Colors.cardBorder},reloadText:{color:Colors.sage,fontSize:12},clear:{borderWidth:1,borderColor:Colors.alertCoral,borderRadius:18,padding:14,marginTop:8},clearText:{color:Colors.alertCoral,textAlign:'center'}});
export default ReviewQAScreen;
