import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../../theme/colors';
import EnhancedPrayerList from './EnhancedPrayerList';
import PrayerJournalCard from './PrayerJournalCard';
import { usePrayer } from '../../context/PrayerContext';
import PrayedItemsList from '../prayer/PrayedItemsList';

interface PrayerJournalTabProps {
  selectedDate?: Date;
}

const PrayerJournalTab: React.FC<PrayerJournalTabProps> = ({ selectedDate }) => {
  const {
    prayedItems,
    loading,
    journalPrayers,
    peoplePrayers,
    devotionalPrayers,
    setSelectedDate,
  } = usePrayer();

  // Update selected date when prop changes
  React.useEffect(() => {
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  }, [selectedDate, setSelectedDate]);

  const hasAnyPrayers = journalPrayers.length > 0 || peoplePrayers.length > 0 || devotionalPrayers.length > 0;

  return (
    <View style={styles.container}>
      {/* Show devotional prayers (legacy prayedItems) */}
      {prayedItems.length > 0 && (
        <View style={styles.section}>
          <PrayedItemsList items={prayedItems} />
        </View>
      )}

      {/* Prayer Journal Card - ACTS Model */}
      <View style={styles.section}>
        <PrayerJournalCard />
      </View>

      {/* Enhanced Prayer List - People Prayers */}
      <View style={styles.section}>
        <EnhancedPrayerList />
      </View>

      {/* Loading indicator when loading and no prayers */}
      {loading && !hasAnyPrayers && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.anchorBlue} />
        </View>
      )}
    </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  contentContainer: {
    paddingBottom: 20,
  },
});

export default PrayerJournalTab;
