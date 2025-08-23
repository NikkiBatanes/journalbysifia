/**
 * StreakTracker.tsx
 * Displays user's spiritual growth streaks and achievements
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Animated,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { triggerLightHaptic } from '../../utils/haptics';

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


const { width } = Dimensions.get('window');
// Chip sizing and spacing (grid layout)
const CHIP_SPACING = 8;
const CONTENT_HORIZONTAL_PADDING = 16;
const CHIP_COLUMNS = 4; // single row of 4 chips
// reduce total width slightly so the row can be centered with visible side breathing room
const CHIP_WIDTH = Math.floor(
  (width - CONTENT_HORIZONTAL_PADDING * 2 - CHIP_SPACING * (CHIP_COLUMNS - 1) - 8) / CHIP_COLUMNS
);

const StreakTracker: React.FC<StreakTrackerProps> = ({ onStreakPress }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Streak | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible

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

      const { data, error } = await supabase
        .from('faith_points_log')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[StreakTracker] Error fetching activities for streaks:', error);
        // Still calculate streaks with empty data to show 0 streaks
        const streakData = calculateStreaks([]);
        setStreaks(streakData);
        return;
      }

      // Calculate streaks for each activity type
      const streakData = calculateStreaks(data || []);
      setStreaks(streakData);
      setActivities(data || []);

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
    // Use MaterialCommunityIcons to match bottom navigation
    switch (type) {
      case 'prayer': return 'hands-pray';
      case 'devotional': return 'book';
      case 'journal': return 'notebook-edit';
      case 'playbook': return 'clipboard-text-play';
      default: return 'fire';
    }
  };

  // Map streak type to activity types used for calculation
  const activityTypesByStreak: Record<Streak['type'], string[]> = {
    journal: ['journal_entry'],
    playbook: ['playbook_generated', 'action_step_completed'],
    devotional: ['devotional_generated', 'daily_streak'],
    prayer: ['daily_streak'],
  };

  const getRecentActivityForType = (type: Streak['type'], days = 14) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days - 1));
    const types = activityTypesByStreak[type] || [];
    const setOfDates = new Set(
      activities
        .filter(a => types.includes(a.activity_type))
        .map(a => new Date(a.created_at).toDateString())
    );

    const out: { date: Date; label: string; active: boolean; today: boolean }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(cutoff);
      d.setDate(cutoff.getDate() + i);
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const dayStr = d.toDateString();
      const today = new Date().toDateString() === dayStr;
      out.push({ date: d, label, active: setOfDates.has(dayStr), today });
    }
    return out;
  };

  const getConsistencySummary = (recent: { active: boolean }[]) => {
    const activeCount = recent.filter(r => r.active).length;
    return { activeCount, total: recent.length };
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

  const formatLastActivity = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    const weekday = d.toLocaleString(undefined, { weekday: 'short' });
    const month = d.toLocaleString(undefined, { month: 'short' });
    const day = d.toLocaleString(undefined, { day: 'numeric' });
    const year = sameYear ? '' : ` ${d.getFullYear()}`;
    return `${weekday}, ${month} ${day}${year}`;
  };

  const openSheet = (streak: Streak) => {
    setSelected(streak);
    setSheetVisible(true);
    Animated.timing(sheetAnim, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setSheetVisible(false);
    });
  };

  const renderStreakCard = (streak: Streak) => (
    <TouchableOpacity
      key={streak.id}
      style={styles.chip}
      onPress={() => { triggerLightHaptic(); openSheet(streak); }}
      activeOpacity={0.85}
    >
      <MaterialCommunityIcons
        name={getStreakIcon(streak.type) as any}
        size={18}
        color={Colors.mediumGray}
      />
      <Text style={styles.streakNumber}>{streak.currentStreak}</Text>
      {streak.isActive && (
        <MaterialCommunityIcons name="fire" size={14} color={Colors.alertCoral} style={{ marginLeft: 4 }} />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="fire" size={24} color={Colors.alertCoral} />
          <Text style={styles.title}>Streak Tracker</Text>
        </View>
        <Text style={styles.loadingText}>Loading streaks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="fire" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Streak Tracker</Text>
      </View>

      <View style={[styles.grid, { paddingHorizontal: CONTENT_HORIZONTAL_PADDING }]}>
        {streaks.map(renderStreakCard)}
      </View>

      {/* Bottom Sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
      >
        <TouchableOpacity activeOpacity={1} style={styles.sheetBackdrop} onPress={closeSheet} />
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                {
                  translateY: sheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [260, 0],
                  }),
                },
              ],
            },
            { paddingBottom: 16 + insets.bottom },
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            {selected ? (
              <MaterialCommunityIcons
                name={getStreakIcon(selected.type) as any}
                size={18}
                color={Colors.hopeWhite}
                style={{ marginRight: 4 }}
              />
            ) : null}
            <Text style={styles.sheetTitle}>{selected ? getStreakTitle(selected.type) : ''}</Text>
          </View>
          {selected && (
            <View style={styles.sheetContent}>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Current</Text>
                <Text style={styles.sheetValue}>{selected.currentStreak}</Text>
              </View>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Best</Text>
                <Text style={styles.sheetValue}>{selected.longestStreak}</Text>
              </View>
              {selected.lastActivity && (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Last Activity</Text>
                  <Text style={styles.sheetValue}>{formatLastActivity(selected.lastActivity)}</Text>
                </View>
              )}

              {/* Recent Activity Heatmap (14 days) */}
              <View style={styles.sectionSeparator} />
              <Text style={styles.sectionHeader}>Recent Activity</Text>
              <View style={styles.heatmapRow}>
                {getRecentActivityForType(selected.type).map((d, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.heatSquare,
                      d.active ? styles.heatSquareActive : styles.heatSquareInactive,
                      d.today ? styles.heatSquareToday : null,
                    ]}
                  />
                ))}
              </View>
              {(() => {
                const recent = getRecentActivityForType(selected.type);
                const { activeCount, total } = getConsistencySummary(recent);
                return (
                  <Text style={styles.heatmapCaption}>{activeCount}/{total} days active</Text>
                );
              })()}

              {/* Achievements */}
              <View style={styles.sectionSeparator} />
              <Text style={styles.sectionHeader}>Achievements</Text>
              <View style={styles.badgesRow}>
                {[3, 7, 14, 30].map((t) => (
                  <View
                    key={t}
                    style={[styles.badgeChip, (selected.currentStreak >= t || selected.longestStreak >= t) ? styles.badgeChipEarned : styles.badgeChipDim]}
                  >
                    <Text style={styles.badgeText}>{t}d</Text>
                  </View>
                ))}
              </View>
              {selected.longestStreak < 30 && (
                <Text style={styles.badgeCaption}>
                  {Math.max(0, [3,7,14,30].find(t => t > selected.longestStreak) as number - selected.currentStreak)} days to next badge
                </Text>
              )}

              {/* Actions removed per request */}
            </View>
          )}
        </Animated.View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
    marginBottom: 24,
    overflow: 'visible',
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
    // paddingHorizontal set dynamically to SIDE_PADDING for edge-to-edge feel
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    gap: CHIP_SPACING,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    height: 48,
    width: CHIP_WIDTH,
    // no vertical margin needed in single-row layout
  },
  streakNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginHorizontal: 6,
  },
  streakLabel: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.modalBlue,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 8,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 0,
    includeFontPadding: false as any,
    lineHeight: 18,
    textAlign: 'center',
  },
  sheetContent: {
    gap: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 6,
    marginTop: 6,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heatSquare: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heatSquareInactive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heatSquareActive: {
    backgroundColor: Colors.faithGold,
    borderColor: 'rgba(255,215,0,0.5)',
  },
  heatSquareToday: {
    borderColor: Colors.hopeWhite,
  },
  heatmapCaption: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badgeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeChipEarned: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderColor: 'rgba(255,215,0,0.4)',
  },
  badgeChipDim: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  badgeText: {
    color: Colors.hopeWhite,
    fontWeight: '600',
    fontSize: 12,
  },
  badgeCaption: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: Colors.hopeWhite,
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  secondaryBtnText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    fontSize: 14,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetLabel: {
    fontSize: 13,
    color: Colors.mediumGray,
  },
  sheetValue: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  sheetButton: {
    marginTop: 12,
    alignSelf: 'center',
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sheetButtonText: {
    color: Colors.hopeWhite,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default StreakTracker;
