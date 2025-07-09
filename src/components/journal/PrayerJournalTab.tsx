import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../theme/colors';
import EnhancedPrayerList from './EnhancedPrayerList';
import PrayerJournalCard from './PrayerJournalCard';

const PrayerJournalTab: React.FC = () => {
  return (
    <ScrollView style={styles.container}>
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
