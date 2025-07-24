import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Colors } from '../../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useDevotionalPrayerData } from '../../services/hooks/usePrayerData';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';

const formatPrayerDate = (prayerDate: Date): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const prayerDateOnly = new Date(prayerDate);
  prayerDateOnly.setHours(0, 0, 0, 0);

  if (prayerDateOnly.getTime() === today.getTime()) {
    return 'Today';
  } else if (prayerDateOnly.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return 'This Day';
  }
};

interface DevotionalPrayerListReactQueryProps {
  selectedDate: Date;
}

const DevotionalPrayerListReactQuery: React.FC<DevotionalPrayerListReactQueryProps> = ({
  selectedDate,
}) => {
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // React Query hook for devotional prayers
  const { data: devotionalPrayers = [], isLoading, error } = useDevotionalPrayerData(
    user?.id || '',
    dateStr
  );

  console.log('📿 DevotionalPrayerList: Rendering with prayers:', devotionalPrayers.length);

  if (isLoading) {
    return null; // Don't show loading state for devotional prayers
  }

  if (error) {
    console.error('❌ Error loading devotional prayers:', error);
    return null; // Don't show error state for devotional prayers
  }

  if (devotionalPrayers.length === 0) {
    return null;
  }

  // Group prayers by date (similar to original PrayedItemsList)
  const groupedPrayers = devotionalPrayers.reduce((groups: {[key: string]: any[]}, prayer) => {
    const dateKey = new Date(prayer.created_at).toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(prayer);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedPrayers).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <View style={styles.container}>
      {sortedDates.map((date) => (
        <View key={date}>
          <View style={styles.headerContainer}>
            <Ionicons name="bookmark" size={20} color={Colors.hopeWhite} style={styles.icon} />
            <Text style={styles.header}>Prayed Devotionals {formatPrayerDate(new Date(date))}</Text>
          </View>
          {groupedPrayers[date].map((prayer) => (
            <View style={styles.prayerItem} key={prayer.id}>
              <Text style={styles.prayerText}>{
                prayer.content
                  .replace(/Heavenly Father,\s*/i, 'Heavenly Father,\n\n')
                  .replace(/(\n?)(In Jesus'? Name, Amen)/i, '\n\n$2')
              }</Text>
              <View style={styles.metadataContainer}>
                <View style={styles.verticalLine} />
                <View style={styles.metadataContent}>
                  <Text style={styles.fromText}>From</Text>
                  {prayer.total_days && (
                    <Text style={styles.metadataText}>
                      {prayer.total_days === 1 ? '1-Day Devotional' : `${prayer.total_days}-Day Devotional Series`}
                    </Text>
                  )}
                  <Text style={styles.devotionalTitle}>{prayer.devotional_title}</Text>
                  {prayer.day_number && prayer.day_title && prayer.day_number > 1 && (
                    <Text style={styles.metadataText}>
                      Day {prayer.day_number}: {prayer.day_title}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.anchorBlue,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  header: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginLeft: 8,
  },
  icon: {
    marginRight: 4,
  },
  prayerItem: {
    backgroundColor: Colors.anchorBlue,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  metadataContainer: {
    marginBottom: 12,
    marginLeft: 8,
    paddingBottom: 0,
    borderBottomWidth: 0,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 2,
    backgroundColor: Colors.hopeWhite,
    opacity: 0.3,
    marginRight: 12,
    borderRadius: 2,
  },
  metadataContent: {
    flex: 1,
  },
  fromText: {
    fontSize: 10,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 6,
    letterSpacing: 1.5,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  devotionalTitle: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.7,
    marginBottom: 4,
    lineHeight: 16,
  },
  metadataText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.7,
    marginBottom: 2,
    lineHeight: 16,
  },
  prayerText: {
    color: Colors.hopeWhite,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
});

export default DevotionalPrayerListReactQuery;
