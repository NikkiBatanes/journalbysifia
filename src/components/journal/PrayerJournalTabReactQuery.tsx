import React from 'react';
import { View, StyleSheet } from 'react-native';
import PrayerJournalCardReactQuery from './PrayerJournalCardReactQuery';
import EnhancedPrayerListReactQuery from './EnhancedPrayerListReactQuery';

interface PrayerJournalTabReactQueryProps {
  selectedDate: Date;
  refreshKey?: number;
}

const PrayerJournalTabReactQuery: React.FC<PrayerJournalTabReactQueryProps> = ({
  selectedDate,
  refreshKey,
}) => {
  // Reset any local state when refresh key changes
  React.useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      console.log('🙏 PrayerJournalTab: Refresh triggered with key:', refreshKey);
      // React Query will automatically refetch data
    }
  }, [refreshKey]);

  return (
    <View style={styles.container}>
      {/* ACTS Prayer Journal Card */}
      <PrayerJournalCardReactQuery selectedDate={selectedDate} />

      {/* People Prayers List */}
      <EnhancedPrayerListReactQuery selectedDate={selectedDate} />
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
