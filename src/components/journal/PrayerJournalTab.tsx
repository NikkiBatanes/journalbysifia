import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../theme/colors';
import EnhancedPrayerList from './EnhancedPrayerList';
import PrayerJournalCard from './PrayerJournalCard';
import { usePrayer } from '../../context/PrayerContext';
import PrayedItemsList from '../prayer/PrayedItemsList';

const PrayerJournalTab: React.FC = () => {
  const { prayedItems } = usePrayer();

  return (
    <ScrollView style={styles.container}>
      {prayedItems.length > 0 && (
        <View style={styles.section}>
          <PrayedItemsList items={prayedItems} />
        </View>
      )}
      <View style={styles.section}>
        <PrayerJournalCard />
      </View>
      <View style={styles.section}>
        <EnhancedPrayerList />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  section: {
    marginBottom: 24,
  },
});

export default PrayerJournalTab;
