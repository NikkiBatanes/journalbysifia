/**
 * StreakTracker.tsx
 * Displays user's spiritual growth streaks and achievements
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';

interface Streak {
  id: string;
  type: 'prayer' | 'devotional' | 'journal' | 'playbook';
  currentStreak: number;
  longestStreak: number;
  lastActivity: string;
  isActive: boolean;
}

interface StreakTrackerProps {
  onStreakPress?: (streak: Streak) => void;
}


const StreakTracker: React.FC<StreakTrackerProps> = ({ onStreakPress }) => {
  const { user } = useAuth();
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);

  const calculateStreaks = useCallback((activities: any[]): Streak[] => {
    const streakTypes = [
      { type: 'journal', activityTypes: ['journal_entry'] },
      { type: 'playbook', activityTypes: ['playbook_generated', 'action_step_completed'] },
      { type: 'devotional', activityTypes: ['devotional_generated', 'daily_streak'] },
      { type: 'prayer', activityTypes: ['daily_streak'] }, // Prayer can be tracked via daily_streak
    ];
    const streakResults: Streak[] = [];

    streakTypes.forEach(({ type, activityTypes }) => {
      const typeActivities = activities.filter(activity =>
        activityTypes.includes(activity.activity_type)
      );

      const { currentStreak, longestStreak, lastActivity, isActive } =
        calculateStreakForType(typeActivities);

      streakResults.push({
        id: type,
        type: type as any,
        currentStreak,
        longestStreak,
        lastActivity: lastActivity || new Date().toISOString(),
        isActive,
      });
    });

    return streakResults;
  }, []);

  const fetchStreaks = useCallback(async () => {
    if (!user) {return;}

    try {
      setLoading(true);

      // Fetch user activity data for streak calculation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      console.log('[StreakTracker] Fetching activities for user:', user.id);
      console.log('[StreakTracker] Date range:', thirtyDaysAgo.toISOString(), 'to now');

      const { data, error } = await supabase
        .from('faith_points_log')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[StreakTracker] Error fetching activities for streaks:', error);
        console.log('[StreakTracker] Streak error details:', error);
        // Still calculate streaks with empty data to show 0 streaks
        const streakData = calculateStreaks([]);
        setStreaks(streakData);
        return;
      }

      console.log(`[StreakTracker] Found ${data?.length || 0} activities for streak calculation`);
      console.log('[StreakTracker] Activities data:', data);

      // Calculate streaks for each activity type
      const streakData = calculateStreaks(data || []);
      setStreaks(streakData);

    } catch (err) {
      console.error('Error fetching streaks:', err);
    } finally {
      setLoading(false);
    }
  }, [user, calculateStreaks]);

  const calculateStreakForType = (activities: any[]) => {
    if (activities.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastActivity: null, isActive: false };
    }

    // Group activities by date
    const activityDates = activities.map(activity =>
      new Date(activity.created_at).toDateString()
    );
    const uniqueDates = [...new Set(activityDates)].sort((a, b) =>
      new Date(b).getTime() - new Date(a).getTime()
    );

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    // Check if active today or yesterday
    const isActive = uniqueDates.includes(today) || uniqueDates.includes(yesterdayStr);

    if (uniqueDates.length > 0) {
      const startDate = uniqueDates.includes(today) ? new Date(today) : new Date(yesterdayStr);

      // Count consecutive days
      for (let i = 0; i < uniqueDates.length; i++) {
        const checkDate = new Date(startDate);
        checkDate.setDate(checkDate.getDate() - i);

        if (uniqueDates.includes(checkDate.toDateString())) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = uniqueDates.length - 1; i >= 0; i--) {
      if (i === uniqueDates.length - 1) {
        tempStreak = 1;
      } else {
        const currentDate = new Date(uniqueDates[i]);
        const prevDate = new Date(uniqueDates[i + 1]);
        const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

        if (dayDiff === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return {
      currentStreak: isActive ? currentStreak : 0,
      longestStreak,
      lastActivity: activities[0]?.created_at,
      isActive,
    };
  };

  useEffect(() => {
    fetchStreaks();
  }, [fetchStreaks]);

  const getStreakIcon = (type: string) => {
    switch (type) {
      case 'prayer': return 'hands-up';
      case 'devotional': return 'book';
      case 'journal': return 'journal';
      case 'playbook': return 'library';
      default: return 'flame';
    }
  };

  const getStreakColor = (streak: number) => {
    if (streak >= 30) {return Colors.successGreen;}
    if (streak >= 14) {return Colors.faithGold;}
    if (streak >= 7) {return Colors.alertCoral;}
    return Colors.mediumGray;
  };

  const getStreakTitle = (type: string) => {
    switch (type) {
      case 'prayer': return 'Prayer';
      case 'devotional': return 'Devotionals';
      case 'journal': return 'Journaling';
      case 'playbook': return 'Playbooks';
      default: return type;
    }
  };

  const renderStreakCard = (streak: Streak) => (
    <TouchableOpacity
      key={streak.id}
      style={[
        styles.streakCard,
        { borderLeftColor: getStreakColor(streak.currentStreak) },
      ]}
      onPress={() => onStreakPress?.(streak)}
      activeOpacity={0.8}
    >
      <View style={styles.streakHeader}>
        <View style={[styles.iconContainer, { backgroundColor: getStreakColor(streak.currentStreak) }]}>
          <Ionicons
            name={getStreakIcon(streak.type) as any}
            size={20}
            color={Colors.hopeWhite}
          />
        </View>
        <View style={styles.streakInfo}>
          <Text style={styles.streakTitle}>{getStreakTitle(streak.type)}</Text>
          <Text style={styles.streakSubtitle}>
            {streak.isActive ? 'Active streak' : 'Streak broken'}
          </Text>
        </View>
        {streak.isActive && (
          <View style={styles.activeIndicator}>
            <Ionicons name="flame" size={16} color={Colors.alertCoral} />
          </View>
        )}
      </View>

      <View style={styles.streakStats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{streak.currentStreak}</Text>
          <Text style={styles.statLabel}>Current</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{streak.longestStreak}</Text>
          <Text style={styles.statLabel}>Best</Text>
        </View>
      </View>

      {streak.lastActivity && (
        <Text style={styles.lastActivity}>
          Last: {new Date(streak.lastActivity).toLocaleDateString()}
        </Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="flame" size={24} color={Colors.alertCoral} />
          <Text style={styles.title}>Streak Tracker</Text>
        </View>
        <Text style={styles.loadingText}>Loading streaks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="flame" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Streak Tracker</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {streaks.map(renderStreakCard)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  streakCard: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 12,
    padding: 16,
    width: 160,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakInfo: {
    flex: 1,
  },
  streakTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  streakSubtitle: {
    fontSize: 11,
    color: Colors.mediumGray,
  },
  activeIndicator: {
    padding: 2,
  },
  streakStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.mediumGray,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 8,
  },
  lastActivity: {
    fontSize: 10,
    color: Colors.lightGray,
    textAlign: 'center',
  },
});

export default StreakTracker;
