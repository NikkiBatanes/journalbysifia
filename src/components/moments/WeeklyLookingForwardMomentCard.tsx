import React from 'react';
import {StyleSheet, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ThemedText from '../common/ThemedText';
import {Colors} from '../../theme/colors';
import type {MomentTimelineItem} from '../../services/momentTimelineService';

export const WeeklyLookingForwardMomentCard = ({timelineItem}: {timelineItem: MomentTimelineItem}) => {
  const metadata = timelineItem.metadata ?? {};
  const periodLabel = typeof metadata.periodLabel === 'string' ? metadata.periodLabel : '';
  const text = typeof metadata.lookingForwardText === 'string' ? metadata.lookingForwardText : '';
  const emotion = typeof metadata.emotionName === 'string' ? metadata.emotionName : '';
  const emotionIcon = typeof metadata.emotionIcon === 'string' ? metadata.emotionIcon : 'heart-outline';
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="weather-sunset-up" size={28} color={Colors.sage}/>
        <ThemedText weight="semiBold" style={styles.title}>{timelineItem.preview.title}</ThemedText>
        {!!periodLabel && <View style={styles.datePill}><ThemedText weight="medium" style={styles.date}>{periodLabel}</ThemedText></View>}
      </View>
      {!!text && <ThemedText style={styles.body}>{text}</ThemedText>}
      {!!emotion && <View style={styles.feeling}>
        <MaterialCommunityIcons name={emotionIcon} size={22} color={Colors.sage}/>
        <View style={styles.feelingCopy}>
          <ThemedText style={styles.caption}>HOW YOU’RE HOLDING IT</ThemedText>
          <ThemedText weight="medium" style={styles.emotion}>{emotion}</ThemedText>
        </View>
      </View>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {backgroundColor: Colors.cardBackground, borderRadius: 26, padding: 24},
  header: {alignItems: 'center', gap: 12, marginBottom: 24},
  title: {fontSize: 19, lineHeight: 27, textAlign: 'center', color: Colors.sage},
  datePill: {backgroundColor: Colors.anchorBlueLight, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6},
  date: {fontSize: 12, lineHeight: 18, color: Colors.sage},
  body: {fontSize: 17, lineHeight: 26, color: Colors.text},
  feeling: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24},
  feelingCopy: {flex: 1, gap: 4},
  caption: {fontSize: 10, letterSpacing: 1, color: Colors.textGray},
  emotion: {fontSize: 15, lineHeight: 22, color: Colors.sage},
});
