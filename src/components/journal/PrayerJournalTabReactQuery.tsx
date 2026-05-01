import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrayerJournalReactQuery } from './PrayerJournalReactQuery';
import EnhancedPrayerListReactQuery from './EnhancedPrayerListReactQuery';
import DevotionalPrayerListReactQuery from './DevotionalPrayerListReactQuery';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

interface PrayerJournalTabReactQueryProps {
  selectedDate: Date;
  refreshKey?: number;
  viewMode?: 'carousel' | 'inline' | 'moments';
  navigation?: NativeStackNavigationProp<RootStackParamList>;
}

const PrayerJournalTabReactQuery: React.FC<PrayerJournalTabReactQueryProps> = ({
  selectedDate,
  refreshKey,
  viewMode,
  navigation,
}) => {
  // Reset any local state when refresh key changes
  React.useEffect(() => {
    if (refreshKey && refreshKey > 0) {

      // React Query will automatically refetch data
    }
  }, [refreshKey]);

  return (
    <View style={styles.container}>
      {/* ACTS Prayer Journal Card */}
      <PrayerJournalReactQuery selectedDate={selectedDate} viewMode={viewMode} navigation={navigation} />

      {/* Devotional Prayers List */}
      <DevotionalPrayerListReactQuery selectedDate={selectedDate} viewMode={viewMode} />

      {/* People Prayers List */}
      <EnhancedPrayerListReactQuery selectedDate={selectedDate} viewMode={viewMode} navigation={navigation} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0, // Remove padding since parent ScrollView handles it
  },
});

export default PrayerJournalTabReactQuery;
