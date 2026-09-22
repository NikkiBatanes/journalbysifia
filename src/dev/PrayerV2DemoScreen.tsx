import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../components/common/ThemedText';
import { Colors } from '../theme/colors';
import { clearPrayerV2DemoData, getPrayerV2DemoReferenceDate, loadPrayerV2DemoScenario } from './prayerV2DemoLoader';
import type { PrayerV2DemoScenario } from './prayerV2DemoFixtures';

const scenarios: Array<[PrayerV2DemoScenario, string]> = [
  ['full', 'Load Full Prayer V2 Demo'], ['return', 'Load Return Scenario'],
  ['check_in', 'Load Check In Scenario'], ['follow_up', 'Load Follow Up Scenario'],
  ['remember', 'Load Remember Scenario'], ['celebrate', 'Load Celebrate Scenario'],
  ['mixed_needs', 'Load Mixed Needs Scenario'], ['review', 'Load Full Year Review Demo'],
];

const PrayerV2DemoScreen = () => {
  const navigation = useNavigation<any>();
  const [reference, setReference] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => getPrayerV2DemoReferenceDate().then(setReference);
  useEffect(() => { void refresh(); }, []);
  if (!__DEV__) return null;
  const load = async (scenario: PrayerV2DemoScenario) => {
    setBusy(true);
    try { const result = await loadPrayerV2DemoScenario(scenario); await refresh(); Alert.alert('Prayer demo loaded', `${result.logicalJourneys} logical journeys · ${result.prayerRecords} local records`); }
    catch (error) { Alert.alert('Unable to load demo', error instanceof Error ? error.message : 'Unknown error'); }
    finally { setBusy(false); }
  };
  const clear = async () => {
    setBusy(true);
    try { const count = await clearPrayerV2DemoData(); await refresh(); Alert.alert('Prayer demo cleared', `${count} demo Prayer records removed. Normal local data was preserved.`); }
    catch (error) { Alert.alert('Unable to clear demo', error instanceof Error ? error.message : 'Unknown error'); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Close Prayer demo"><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity><ThemedText weight="bold" style={styles.title}>Prayer V2 Demo Data</ThemedText><View style={styles.spacer} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <ThemedText style={styles.note}>Development-only local fixtures. Nothing is sent to Supabase.</ThemedText>
      <TouchableOpacity disabled={busy} style={[styles.button, styles.gallery]} onPress={() => navigation.navigate('TodayPrayerCardGallery')}><ThemedText weight="semiBold" style={styles.buttonText}>Today Prayer Card Gallery</ThemedText></TouchableOpacity>
      {([['mixed', 'Open Mixed Prayer Needs'], ['cast', 'Open CAST Demo'], ['unprayed', 'Open Unprayed Request'], ['prayed', 'Open Prayed Request'], ['recent', 'Open Recently Followed-Up Request']] as const).map(([openDemo, label]) => <TouchableOpacity key={openDemo} disabled={busy} style={[styles.button, styles.shortcut]} onPress={() => navigation.navigate('TodayPrayerCardGallery', { openDemo })}><ThemedText weight="semiBold" style={styles.shortcutText}>{label}</ThemedText></TouchableOpacity>)}
      <View style={styles.reference}><ThemedText weight="semiBold">Demo reference date</ThemedText><ThemedText style={styles.date}>{reference ? new Date(reference).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'No demo loaded'}</ThemedText></View>
      {scenarios.map(([scenario, label]) => <TouchableOpacity key={scenario} disabled={busy} style={styles.button} onPress={() => load(scenario)}><ThemedText weight="semiBold" style={styles.buttonText}>{label}</ThemedText></TouchableOpacity>)}
      <TouchableOpacity disabled={busy} style={[styles.button, styles.clear]} onPress={clear}><ThemedText weight="semiBold" style={styles.clearText}>Clear Prayer V2 Demo Data</ThemedText></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
};
const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:Colors.lightBackground},header:{height:56,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{fontSize:17,color:Colors.text},spacer:{width:24},content:{padding:20,paddingBottom:44},note:{fontSize:13,lineHeight:19,color:Colors.textGray,marginBottom:16},reference:{padding:16,borderRadius:14,backgroundColor:Colors.cardBackground,marginBottom:18},date:{marginTop:4,color:Colors.sage},button:{padding:15,borderRadius:12,backgroundColor:Colors.sage,marginBottom:10},gallery:{marginBottom:10},shortcut:{backgroundColor:Colors.cardBackground,borderWidth:1,borderColor:Colors.cardBorder},shortcutText:{color:Colors.sage,textAlign:'center'},buttonText:{color:Colors.hopeWhite,textAlign:'center'},clear:{backgroundColor:Colors.cardBackground,borderWidth:1,borderColor:Colors.alertCoral,marginTop:10},clearText:{color:Colors.alertCoral,textAlign:'center'} });
export default PrayerV2DemoScreen;
