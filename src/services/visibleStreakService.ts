import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';

export const VISIBLE_STREAK_ACTIVITY_TYPES = [
  'playbook_completed',
  'action_step_completed',
  'playbook_generated',
  'affirmation_read_aloud',
  'devotional_generated',
  'devotional_completed',
  'devotional_full_completed',
  'reflection_question_answered',
  'prayer_devotional_prayed',
  'prayer_playbook_prayed',
  'prayer_saved',
  'prayer_journal_open',
  'prayer_list_request_added',
  'prayer_for_now',
  'prayer_journal_acts',
  'prayer_answered',
  'journal_focus_set',
  'journal_win_added',
  'journal_looking_forward_added',
  'journal_gratitude_added',
  'gratitude_saved',
  'reflection_saved',
] as const;

export type VisibleStreakActivityType = typeof VISIBLE_STREAK_ACTIVITY_TYPES[number];

const visibleStreakActivitySet = new Set<string>(VISIBLE_STREAK_ACTIVITY_TYPES);

const toLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getShownKey = (userId: string, dateString: string) => `visible_streak_shown_${userId}_${dateString}`;

class VisibleStreakService {
  isMeaningfulActivity(activityType: string): boolean {
    return visibleStreakActivitySet.has(activityType);
  }

  async getActivityDates(userId: string, lookbackDays = 100): Promise<Set<string>> {
    const windowStart = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('faith_points_log')
      .select('created_at, activity_type')
      .eq('user_id', userId)
      .in('activity_type', VISIBLE_STREAK_ACTIVITY_TYPES as unknown as string[])
      .gte('created_at', windowStart);

    if (error) {
      throw error;
    }

    const dates = new Set<string>();
    data?.forEach(entry => {
      if (entry.created_at && this.isMeaningfulActivity(entry.activity_type)) {
        dates.add(toLocalDate(new Date(entry.created_at)));
      }
    });

    return dates;
  }

  async getCurrentStreak(userId: string): Promise<number> {
    const activityDates = await this.getActivityDates(userId);
    const checkDate = new Date();
    let streak = 0;

    while (true) {
      const dateString = toLocalDate(checkDate);
      if (!activityDates.has(dateString)) {
        break;
      }
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return Math.max(streak, 1);
  }

  async hasShownToday(userId: string): Promise<boolean> {
    const today = toLocalDate(new Date());
    const shown = await AsyncStorage.getItem(getShownKey(userId, today));
    return shown === 'true';
  }

  async markShownToday(userId: string): Promise<void> {
    const today = toLocalDate(new Date());
    await AsyncStorage.setItem(getShownKey(userId, today), 'true');
  }

  async shouldShowCelebration(userId: string, activityType: string): Promise<boolean> {
    if (!this.isMeaningfulActivity(activityType)) {
      return false;
    }

    const shownToday = await this.hasShownToday(userId);
    return !shownToday;
  }

  toLocalDate(date: Date): string {
    return toLocalDate(date);
  }
}

export const visibleStreakService = new VisibleStreakService();
