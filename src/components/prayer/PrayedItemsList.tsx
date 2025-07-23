import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';

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

export interface PrayedItem {
  id: string;
  text: string;
  date: Date;
  devotionalTitle: string;
  totalDays?: number;
  dayNumber?: number;
  dayTitle?: string;
}

interface PrayedItemsListProps {
  items: PrayedItem[];
}

const PrayedItemsList: React.FC<PrayedItemsListProps> = ({ items }) => {
  if (items.length === 0) {
    return null;
  }

  // Group prayed items by date
  const groupedItems = items.reduce((groups: {[key: string]: any[]}, item) => {
    const dateKey = item.date.toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(item);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedItems).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <View style={styles.container}>
      {sortedDates.map((date) => (
        <View key={date}>
          <View style={styles.headerContainer}>
            <Ionicons name="bookmark" size={20} color={Colors.hopeWhite} style={styles.icon} />
            <Text style={styles.header}>Prayed Devotionals {formatPrayerDate(new Date(date))}</Text>
          </View>
          {groupedItems[date].map((item) => (
            <View style={styles.prayerItem} key={item.id}>
              <Text style={styles.prayerText}>{
                item.text
                  .replace(/Heavenly Father,\s*/i, 'Heavenly Father,\n\n')
                  .replace(/(\n?)(In Jesus'? Name, Amen)/i, '\n\n$2')
              }</Text>
              <View style={styles.metadataContainer}>
                <View style={styles.verticalLine} />
                <View style={styles.metadataContent}>
                  <Text style={styles.fromText}>From</Text>
                  {item.totalDays && (
                    <Text style={styles.metadataText}>
                      {item.totalDays === 1 ? '1-Day Devotional' : `${item.totalDays}-Day Devotional Series`}
                    </Text>
                  )}
                  <Text style={styles.devotionalTitle}>{item.devotionalTitle}</Text>
                  {item.dayNumber && item.dayTitle && item.dayNumber > 1 && (
                    <Text style={styles.metadataText}>
                      Day {item.dayNumber}: {item.dayTitle}
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

export default PrayedItemsList;
