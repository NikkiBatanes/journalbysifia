import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

export interface StatsData {
  totalBadges: number;
  currentStreak: number;
  goalsCompleted: number;
  prayerSessions: number;
  journalEntries: number;
}

interface Props {
  title?: string;
  stats: StatsData;
}

const StatsGrid: React.FC<Props> = ({ title = 'Your Journey', stats }) => {
  return (
    <View style={styles.statsContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="trophy" size={24} color={Colors.anchorBlue} />
          <Text style={styles.statNumber}>{stats.totalBadges || 0}</Text>
          <Text style={styles.statLabel}>Badges</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="flame" size={24} color={Colors.faithGold} />
          <Text style={styles.statNumber}>{stats.currentStreak || 0}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={24} color={Colors.growthGreen} />
          <Text style={styles.statNumber}>{stats.goalsCompleted || 0}</Text>
          <Text style={styles.statLabel}>Goals</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="heart" size={24} color={Colors.error} />
          <Text style={styles.statNumber}>{stats.prayerSessions || 0}</Text>
          <Text style={styles.statLabel}>Prayers</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="document-text" size={24} color={Colors.warning} />
          <Text style={styles.statNumber}>{stats.journalEntries || 0}</Text>
          <Text style={styles.statLabel}>Journal</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: Colors.darkerGray,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12 as any,
  },
  statCard: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
    color: Colors.darkerGray,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
});

export default StatsGrid;
