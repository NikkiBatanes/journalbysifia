/**
 * StreakTracker.tsx
 * Displays user's spiritual growth streaks and achievements
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  useWindowDimensions,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { faithPointsEvents, FAITH_POINTS_EVENTS } from '../../services/faithPointsEvents';
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../common/ThemedText';

interface Streak {
  id: string;
  type: 'prayer' | 'journal' | 'playbook';
  currentStreak: number;
  longestStreak: number;
  lastActivity: string;
  isActive: boolean;
}

interface StreakTrackerProps {
  onStreakPress?: (streak: Streak) => void;
  variant?: 'default' | 'pill';
  faithPoints?: number;
  badgesCount?: number;
  showProfileStats?: boolean;
  onFaithPointsPress?: () => void;
  onBadgesPress?: () => void;
}


// Chip sizing and spacing (grid layout)
const CHIP_SPACING = 4;
const CONTENT_HORIZONTAL_PADDING = 4;
const CHIP_COLUMNS = 3; // single row of 3 chips
const MIN_CHIP_WIDTH = 40;

const StreakTracker: React.FC<StreakTrackerProps> = ({
  onStreakPress: _onStreakPress,
  variant = 'default',
  faithPoints = 0,
  badgesCount = 0,
  showProfileStats = false,
  onFaithPointsPress,
  onBadgesPress,
}) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Streak | null>(null);
  const [profileStat, setProfileStat] = useState<'faithPoints' | 'badges' | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [gridWidth, setGridWidth] = useState<number>(windowWidth);
  const isPill = variant === 'pill';
  const useCompactChips = isPill || showProfileStats;
  const sheetAnim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible
  const sheetPaddingStyle = React.useMemo(() => ({ paddingBottom: 16 + insets.bottom }), [insets.bottom]);
  const chipWidth = React.useMemo(() => {
    if (!gridWidth) {
      return MIN_CHIP_WIDTH;
    }
    const availableWidth = Math.max(gridWidth - CONTENT_HORIZONTAL_PADDING * 2, 0);
    const rawWidth = (availableWidth - CHIP_SPACING * (CHIP_COLUMNS - 1)) / CHIP_COLUMNS;
    return Math.max(Math.floor(rawWidth), MIN_CHIP_WIDTH);
  }, [gridWidth]);

  useEffect(() => {
    setGridWidth(windowWidth);
  }, [windowWidth]);

  const calculateStreaks = useCallback((activityList: any[]): Streak[] => {
    const streakTypes = [
      {
        type: 'playbook',
        activityTypes: [
          'playbook_generated',
          'playbook_created',
          'playbook_opened',
          'playbook_revisited_completed',
          'action_step_completed',
          'subtask_completed',
          'playbook_completed',
          'affirmation_read_aloud',
          'action_step_interacted',
          'playbook_read_aloud',
          'challenge_accepted',
        ],
      },
      {
        type: 'journal',
        activityTypes: [
          'journal_entry',
          'journal_todo_added',
          'journal_focus_set',
          'journal_timeblock_added',
          'journal_gratitude_added',
          'journal_win_added',
          'journal_looking_forward_added',
          'todo_completed',
          'focus_priority_marked',
          'reflection_saved',
          'gratitude_saved',
          'prayer_saved',
          'timeblock_saved',
        ],
      },
      {
        type: 'prayer',
        activityTypes: [
          'daily_streak',
          'prayer_for_now',
          'prayer_for_others',
          'prayer_journal_acts',
          'prayer_journal_open',
          'prayer_playbook_prayed',
          'prayer_list_prayed',
          'prayer_list_request_added',
          'prayer_answered', // When marking prayer as answered
        ],
      },
    ];
    const streakResults: Streak[] = [];

    streakTypes.forEach(({ type, activityTypes }) => {
      const typeActivities = activityList.filter(activity =>
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
        Logger.error('[StreakTracker] Error fetching activities for streaks', error as Error, { component: 'StreakTracker' });
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
      Logger.error('Error fetching streaks', err as Error, { component: 'StreakTracker' });
    } finally {
      setLoading(false);
    }
  }, [user, calculateStreaks]);

  const calculateStreakForType = (activityList: any[]) => {
    if (activityList.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastActivity: null, isActive: false };
    }

    // Group activities by date
    const activityDates = activityList.map(activity =>
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
      lastActivity: activityList[0]?.created_at,
      isActive,
    };
  };

  useEffect(() => {
    fetchStreaks();

    const handlePointsUpdated = (payload: any) => {
      if (!payload) {return;}
      const activityType = payload.activityType || payload.reason || payload.activity_type;
      if (!activityType) {
        fetchStreaks();
        return;
      }

      const normalized = String(activityType).toLowerCase();
      const isPrayerActivity = [
        'prayer_for_now',
        'prayer_for_others',
        'prayer_journal_acts',
        'prayer_journal_open',
        'prayer_playbook_prayed',
        'prayer_list_prayed',
        'prayer_list_request_added',
      ].some(key => normalized.includes(key));

      if (isPrayerActivity) {
        fetchStreaks();
      }
    };

    faithPointsEvents.on(FAITH_POINTS_EVENTS.POINTS_UPDATED, handlePointsUpdated);

    return () => {
      faithPointsEvents.off(FAITH_POINTS_EVENTS.POINTS_UPDATED, handlePointsUpdated);
    };
  }, [fetchStreaks]);

  const getStreakIcon = (type: string) => {
    // Use MaterialCommunityIcons to match bottom navigation
    switch (type) {
      case 'prayer': return 'hands-pray';
      case 'journal': return 'notebook-edit';
      case 'playbook': return 'clipboard-text-play';
      default: return 'fire';
    }
  };

  // Map streak type to activity types used for calculation
  const activityTypesByStreak: Record<Streak['type'], string[]> = {
    playbook: [
      'playbook_generated',
      'playbook_created',
      'playbook_opened',
      'playbook_revisited_completed',
      'action_step_completed',
      'subtask_completed',
      'playbook_completed',
      'affirmation_read_aloud',
      'action_step_interacted',
      'playbook_read_aloud',
      'challenge_accepted',
    ],
    journal: [
      'journal_entry',
      'journal_todo_added',
      'journal_focus_set',
      'journal_timeblock_added',
      'journal_gratitude_added',
      'journal_win_added',
      'journal_looking_forward_added',
      'todo_completed',
      'focus_priority_marked',
      'reflection_saved',
      'gratitude_saved',
      'prayer_saved',
      'timeblock_saved',
    ],
    prayer: [
      'daily_streak',
      'prayer_for_now',
      'prayer_for_others',
      'prayer_journal_acts',
      'prayer_journal_open',
      'prayer_playbook_prayed',
      'prayer_list_prayed',
      'prayer_list_request_added',
    ],
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

  // removed unused getStreakColor helper

  const getStreakTitle = (type: string) => {
    switch (type) {
      case 'prayer': return 'Prayer';
      case 'journal': return 'Journaling';
      case 'playbook': return 'Playbooks';
      default: return type;
    }
  };

  const formatLastActivity = (iso: string) => {
    if (!iso) {return '';}
    const d = new Date(iso);
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    const weekday = d.toLocaleString(undefined, { weekday: 'short' });
    const month = d.toLocaleString(undefined, { month: 'short' });
    const day = d.toLocaleString(undefined, { day: 'numeric' });
    const year = sameYear ? '' : ` ${d.getFullYear()}`;
    return `${weekday}, ${month} ${day}${year}`;
  };

  const getFaithPointsInfo = (points: number) => {
    const levelThresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000];
    const levelTitles: Record<number, string> = {
      1: 'Beginning', 2: 'Growing', 3: 'Rooted', 4: 'Steady', 5: 'Grounded',
      6: 'Faithful', 7: 'Maturing', 8: 'Deepening', 9: 'Strengthened', 10: 'Abiding',
    };
    let currentLevel = 1;
    for (let i = levelThresholds.length - 1; i >= 0; i--) {
      if (points >= levelThresholds[i]) {
        currentLevel = i + 1;
        break;
      }
    }
    const cappedLevel = Math.min(currentLevel, 10);
    const currentThreshold = levelThresholds[cappedLevel - 1] || 0;
    const nextThreshold = levelThresholds[cappedLevel] || 10000;
    const pointsNeeded = Math.max(0, nextThreshold - points);
    const progress = cappedLevel < 10 ? Math.min(1, Math.max(0, (points - currentThreshold) / (nextThreshold - currentThreshold))) : 1;
    return {
      level: cappedLevel,
      levelTitle: levelTitles[cappedLevel] || 'Abiding',
      nextLevelTitle: levelTitles[cappedLevel + 1] || 'Abiding',
      pointsNeeded,
      progress,
    };
  };

  const getProfileStatIcon = (stat: 'faithPoints' | 'badges') => {
    switch (stat) {
      case 'faithPoints': return 'star-four-points';
      case 'badges': return 'trophy';
      default: return 'fire';
    }
  };

  const getProfileStatTitle = (stat: 'faithPoints' | 'badges') => {
    switch (stat) {
      case 'faithPoints': return 'Faith Points';
      case 'badges': return 'Badges';
      default: return '';
    }
  };

  const openSheet = (streak: Streak) => {
    setSelected(streak);
    setProfileStat(null);
    setSheetVisible(true);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  const openProfileSheet = (stat: 'faithPoints' | 'badges') => {
    setSelected(null);
    setProfileStat(stat);
    setSheetVisible(true);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setSheetVisible(false);
        setSelected(null);
        setProfileStat(null);
      }
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, showProfileStats && styles.profileContainer, isPill && styles.pillContainer]}>
        <View style={[styles.header, isPill && styles.pillHeader]}>
          <MaterialCommunityIcons name="fire" size={isPill ? 18 : 24} color={isPill ? Colors.hopeWhite : Colors.alertCoral} />
          <ThemedText weight="semiBold" style={[styles.title, isPill && styles.pillTitle]}>Streak Tracker</ThemedText>
        </View>
        <View style={[styles.grid, isPill && styles.pillGrid, { paddingHorizontal: isPill ? 0 : CONTENT_HORIZONTAL_PADDING }]}>
          {(showProfileStats ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4]).map((i) => (
            <View key={i} style={[styles.chip, useCompactChips && styles.pillChip, styles.chipLoading, !useCompactChips && { width: chipWidth }]}>
              <MaterialCommunityIcons name="fire" size={18} color={Colors.textGray} />
              <ThemedText weight="semiBold" style={styles.streakNumber}>-</ThemedText>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, showProfileStats && styles.profileContainer, isPill && styles.pillContainer]}>
      <View style={[styles.header, isPill && styles.pillHeader]}>
        <MaterialCommunityIcons name="fire" size={isPill ? 18 : 24} color={isPill ? Colors.hopeWhite : Colors.alertCoral} />
        <ThemedText weight="semiBold" style={[styles.title, isPill && styles.pillTitle]}>Streak Tracker</ThemedText>
      </View>

      <View style={[styles.grid, isPill && styles.pillGrid]}>
        {streaks.map(streak => (
          <TouchableOpacity
            key={streak.id}
            style={[styles.chip, useCompactChips && styles.pillChip]}
            onPress={() => { triggerLightHaptic(); openSheet(streak); }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name={getStreakIcon(streak.type) as any}
              size={useCompactChips ? 12 : 18}
              color={useCompactChips ? Colors.hopeWhite : Colors.textGray}
            />
            <ThemedText weight="semiBold" style={[styles.streakNumber, useCompactChips && styles.pillStreakNumber]}>{streak.currentStreak}</ThemedText>
            {streak.isActive && !useCompactChips && (
              <MaterialCommunityIcons name="fire" size={14} color={Colors.alertCoral} style={styles.iconMarginLeft} />
            )}
          </TouchableOpacity>
        ))}
        {showProfileStats && (
          <>
            <TouchableOpacity
              style={[styles.chip, styles.pillChip]}
              onPress={() => { triggerLightHaptic(); if (onFaithPointsPress) { onFaithPointsPress(); } else { openProfileSheet('faithPoints'); } }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="star-four-points" size={12} color={Colors.hopeWhite} />
              <ThemedText weight="semiBold" style={styles.pillStreakNumber}>{faithPoints} FP</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, styles.pillChip]}
              onPress={() => { triggerLightHaptic(); if (onBadgesPress) { onBadgesPress(); } else { openProfileSheet('badges'); } }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="trophy" size={12} color={Colors.hopeWhite} />
              <ThemedText weight="semiBold" style={styles.pillStreakNumber}>{badgesCount}</ThemedText>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Bottom Sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        statusBarTranslucent={Platform.OS === 'android'}
        navigationBarTranslucent={Platform.OS === 'android'}
        hardwareAccelerated={Platform.OS === 'android'}
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
                    outputRange: [windowHeight * 0.4, 0],
                  }),
                },
              ],
            },
            sheetPaddingStyle,
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            {selected ? (
              <MaterialCommunityIcons
                name={getStreakIcon(selected.type) as any}
                size={18}
                color={Colors.hopeWhite}
                style={styles.iconMarginRight}
              />
            ) : profileStat ? (
              <MaterialCommunityIcons
                name={getProfileStatIcon(profileStat) as any}
                size={18}
                color={Colors.hopeWhite}
                style={styles.iconMarginRight}
              />
            ) : null}
            <ThemedText weight="semiBold" style={styles.sheetTitle}>{selected ? getStreakTitle(selected.type) : profileStat ? getProfileStatTitle(profileStat) : ''}</ThemedText>
          </View>
          {selected && (
            <View style={styles.sheetContent}>
              <View style={styles.sheetRow}>
                <ThemedText style={styles.sheetLabel}>Current</ThemedText>
                <ThemedText weight="semiBold" style={styles.sheetValue}>{selected.currentStreak}</ThemedText>
              </View>
              <View style={styles.sheetRow}>
                <ThemedText style={styles.sheetLabel}>Best</ThemedText>
                <ThemedText weight="semiBold" style={styles.sheetValue}>{selected.longestStreak}</ThemedText>
              </View>
              {selected.lastActivity && (
                <View style={styles.sheetRow}>
                  <ThemedText style={styles.sheetLabel}>Last Activity</ThemedText>
                  <ThemedText weight="semiBold" style={styles.sheetValue}>{formatLastActivity(selected.lastActivity)}</ThemedText>
                </View>
              )}

              {/* Recent Activity Heatmap (14 days) */}
              <View style={styles.sectionSeparator} />
              <ThemedText weight="semiBold" style={styles.sectionHeader}>Recent Activity</ThemedText>
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
                  <ThemedText style={styles.heatmapCaption}>{activeCount}/{total} days active</ThemedText>
                );
              })()}

              {/* Achievements */}
              <View style={styles.sectionSeparator} />
              <ThemedText weight="semiBold" style={styles.sectionHeader}>Achievements</ThemedText>
              <View style={styles.badgesRow}>
                {[3, 7, 14, 30].map((t) => (
                  <View
                    key={t}
                    style={[styles.badgeChip, (selected.currentStreak >= t || selected.longestStreak >= t) ? styles.badgeChipEarned : styles.badgeChipDim]}
                  >
                    <ThemedText weight="semiBold" style={styles.badgeText}>{t}d</ThemedText>
                  </View>
                ))}
              </View>
              {selected.longestStreak < 30 && (
                <ThemedText style={styles.badgeCaption}>
                  {Math.max(0, [3,7,14,30].find(t => t > selected.longestStreak) as number - selected.currentStreak)} days to next badge
                </ThemedText>
              )}

              {/* Actions removed per request */}
            </View>
          )}
          {profileStat === 'faithPoints' && (() => {
            const info = getFaithPointsInfo(faithPoints);
            return (
              <View style={styles.sheetContent}>
                <View style={styles.levelSection}>
                  <ThemedText weight="semiBold" style={styles.levelText}>Level {info.level}: {info.levelTitle}</ThemedText>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${info.progress * 100}%` }]} />
                  </View>
                  <ThemedText weight="regular" style={styles.pointsText}>{faithPoints} FP</ThemedText>
                  {info.level < 10 && (
                    <>
                      <ThemedText weight="regular" style={styles.pointsNeededText}>You need {info.pointsNeeded} more points to reach</ThemedText>
                      <View style={styles.nextLevelPill}>
                        <ThemedText weight="semiBold" style={styles.nextLevelPillText}>Level {info.level + 1}: {info.nextLevelTitle}</ThemedText>
                      </View>
                    </>
                  )}
                </View>
                <View style={styles.sectionSeparator} />
                <ThemedText weight="semiBold" style={styles.sectionHeader}>Faith Points are earned by</ThemedText>
                <View style={styles.bulletList}>
                  <ThemedText style={styles.bullet}>• Completing playbook action steps</ThemedText>
                  <ThemedText style={styles.bullet}>• Finishing playbooks</ThemedText>
                  <ThemedText style={styles.bullet}>• Daily journaling</ThemedText>
                  <ThemedText style={styles.bullet}>• Prayer activities</ThemedText>
                  <ThemedText style={styles.bullet}>• Maintaining streaks</ThemedText>
                </View>
              </View>
            );
          })()}
          {profileStat === 'badges' && (
            <View style={styles.sheetContent}>
              <View style={styles.sheetRow}>
                <ThemedText style={styles.sheetLabel}>Earned</ThemedText>
                <ThemedText weight="semiBold" style={styles.sheetValue}>{badgesCount}</ThemedText>
              </View>
              <ThemedText style={styles.heatmapCaption}>Badges are awarded for completing playbooks, maintaining streaks, and reaching faith point milestones.</ThemedText>
              {onBadgesPress && (
                <TouchableOpacity style={styles.sheetButton} onPress={() => { triggerLightHaptic(); onBadgesPress(); closeSheet(); }} activeOpacity={0.85}>
                  <ThemedText weight="semiBold" style={styles.sheetButtonText}>View all badges</ThemedText>
                </TouchableOpacity>
              )}
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
  profileContainer: {
    marginTop: 22,
  },
  pillContainer: {
    marginTop: 0,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: Colors.faithGold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  pillHeader: {
    paddingHorizontal: 0,
    marginBottom: 8,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    color: Colors.hopeWhite,
  },
  pillTitle: {
    fontSize: 14,
    letterSpacing: 0.8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scrollContainer: {
    // paddingHorizontal set dynamically to SIDE_PADDING for edge-to-edge feel
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CHIP_SPACING,
    paddingHorizontal: 12,
  },
  pillGrid: {
    paddingHorizontal: 0,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    height: 44,
    // no vertical margin needed in single-row layout
  },
  pillChip: {
    height: 30,
    paddingHorizontal: 4,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  pillStreakNumber: {
    fontSize: 11,
    color: Colors.hopeWhite,
    marginHorizontal: 2,
  },
  streakNumber: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginHorizontal: 4,
  },
  chipLoading: {
    opacity: 0.5,
  },
  streakLabel: {
    fontSize: 12,
    color: Colors.textGray,
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
    fontSize: 12,
  },
  badgeCaption: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
  },
  iconMarginLeft: {
    marginLeft: 4,
  },
  iconMarginRight: {
    marginRight: 4,
  },
  levelSection: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  levelText: {
    fontSize: 15,
    color: Colors.hopeWhite,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.faithGold,
    borderRadius: 4,
  },
  pointsText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginTop: 2,
  },
  pointsNeededText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  nextLevelPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 2,
  },
  nextLevelPillText: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },
  bulletList: {
    gap: 6,
    marginTop: 2,
  },
  bullet: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
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
    fontSize: 14,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetLabel: {
    fontSize: 13,
    color: Colors.textGray,
  },
  sheetValue: {
    fontSize: 14,
    color: Colors.hopeWhite,
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
    fontSize: 14,
  },
});

export default StreakTracker;
