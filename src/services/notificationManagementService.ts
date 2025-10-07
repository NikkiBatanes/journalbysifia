import { supabase } from './supabaseClient';
import { pushNotificationService } from './pushNotificationService';

export interface NotificationPreferences {
  user_id: string;
  playbook_steps?: boolean;
  devotional_reminders?: boolean;
  journal_prompts?: boolean;
  prayer_reminders?: boolean;
  milestone_celebrations?: boolean;
  trial_notifications?: boolean;
  streak_alerts?: boolean;
  prayer_requests?: boolean;
  prayer_request_alerts?: boolean;
  quiet_hours_start?: string; // HH:MM format
  quiet_hours_end?: string; // HH:MM format
  timezone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationQueueItem {
  id?: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  scheduled_for?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status?: 'pending' | 'sent' | 'failed' | 'cancelled';
  retry_count?: number;
  created_at?: string;
}

export interface UserActivityTracking {
  user_id: string;
  last_prayer?: string;
  last_devotional?: string;
  last_journal_entry?: string;
  last_playbook_action?: string;
  prayer_streak?: number;
  devotional_streak?: number;
  journal_streak?: number;
  updated_at?: string;
}

class NotificationManagementService {
  /**
   * Get user's notification preferences
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        // Check if it's a missing table or column error (common during development)
        if (error.code === '42P01' ||
            error.code === 'PGRST204' ||
            error.message?.includes('relation') ||
            error.message?.includes('does not exist') ||
            error.message?.includes('column') ||
            error.message?.includes('schema cache')) {
          console.warn('Notification preferences table/column not found - returning null:', error.message);
          return null;
        }
        console.error('Error fetching notification preferences:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      // Map database schema to interface
      const preferences: NotificationPreferences = {
        user_id: data.user_id,
        playbook_steps: data.playbook_steps,
        devotional_reminders: data.devotional_reminders,
        journal_prompts: data.journal_prompts,
        prayer_reminders: data.prayer_reminders,
        milestone_celebrations: data.milestone_celebrations,
        trial_notifications: data.trial_notifications,
        streak_alerts: data.streak_alerts,
        prayer_request_alerts: data.prayer_request_alerts,
        quiet_hours_start: data.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end,
        timezone: data.timezone,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      return preferences;
    } catch (error) {
      console.error('Error in getNotificationPreferences:', error);
      return null;
    }
  }

  /**
   * Update user's notification preferences
   */
  async updateNotificationPreferences(preferences: NotificationPreferences): Promise<boolean> {
    try {
      // Map the interface to match the actual database schema
      const dbPreferences = {
        user_id: preferences.user_id,
        notification_type: 'user_preferences', // Required NOT NULL field in deployed database
        prayer_reminders: preferences.prayer_reminders ?? true,
        prayer_request_alerts: preferences.prayer_request_alerts ?? true,
        playbook_steps: preferences.playbook_steps ?? true,
        devotional_reminders: preferences.devotional_reminders ?? true,
        journal_prompts: preferences.journal_prompts ?? true,
        streak_alerts: preferences.streak_alerts ?? true,
        milestone_celebrations: preferences.milestone_celebrations ?? true,
        trial_notifications: preferences.trial_notifications ?? true,
        quiet_hours_start: preferences.quiet_hours_start ?? '22:00',
        quiet_hours_end: preferences.quiet_hours_end ?? '07:00',
        timezone: preferences.timezone ?? 'UTC',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('notification_preferences')
        .upsert(dbPreferences);

      if (error) {
        // Check if it's a missing table or column error (common during development)
        if (error.code === '42P01' ||
            error.code === 'PGRST204' ||
            error.message?.includes('relation') ||
            error.message?.includes('does not exist') ||
            error.message?.includes('column') ||
            error.message?.includes('schema cache')) {
          console.warn('Notification preferences table/column not found - skipping notification setup:', error.message);
          return true; // Return success to avoid blocking onboarding
        }
        console.error('Error updating notification preferences:', error);
        return false;
      }

      console.log('✅ Notification preferences updated successfully');
      return true;
    } catch (error) {
      console.error('Error in updateNotificationPreferences:', error);
      return false;
    }
  }

  /**
   * Schedule a notification
   */
  async scheduleNotification(notification: NotificationQueueItem): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_queue')
        .insert({
          ...notification,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error scheduling notification:', error);
        return false;
      }

      console.log('✅ Notification scheduled successfully');
      return true;
    } catch (error) {
      console.error('Error in scheduleNotification:', error);
      return false;
    }
  }

  /**
   * Send immediate notification
   */
  async sendImmediateNotification(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<boolean> {
    try {
      // Check user preferences first
      const preferences = await this.getNotificationPreferences(userId);

      // Check if user has notifications enabled for this type
      // This is a simplified check - you might want more sophisticated logic
      if (preferences && Object.values(preferences).some(pref => pref === true)) {
        // Schedule for immediate delivery
        const notification: NotificationQueueItem = {
          user_id: userId,
          type: 'immediate',
          title,
          message,
          data,
          scheduled_for: new Date().toISOString(),
          priority: 'normal',
        };

        return await this.scheduleNotification(notification);
      }

      console.log('User has notifications disabled, skipping immediate notification');
      return false;
    } catch (error) {
      console.error('Error in sendImmediateNotification:', error);
      return false;
    }
  }

  /**
   * Update user activity tracking
   */
  async updateUserActivity(userId: string, activityType: string): Promise<boolean> {
    try {
      const updateData: Partial<UserActivityTracking> = {
        user_id: userId,
        updated_at: new Date().toISOString(),
      };

      // Update specific activity timestamp
      switch (activityType) {
        case 'prayer':
          updateData.last_prayer = new Date().toISOString();
          break;
        case 'devotional':
          updateData.last_devotional = new Date().toISOString();
          break;
        case 'journal':
          updateData.last_journal_entry = new Date().toISOString();
          break;
        case 'playbook':
          updateData.last_playbook_action = new Date().toISOString();
          break;
        default:
          console.warn('Unknown activity type:', activityType);
          return false;
      }

      const { error } = await supabase
        .from('user_activity_tracking')
        .upsert(updateData);

      if (error) {
        console.error('Error updating user activity:', error);
        return false;
      }

      console.log(`✅ User activity updated: ${activityType}`);
      return true;
    } catch (error) {
      console.error('Error in updateUserActivity:', error);
      return false;
    }
  }

  /**
   * Get user's activity tracking data
   */
  async getUserActivity(userId: string): Promise<UserActivityTracking | null> {
    try {
      const { data, error } = await supabase
        .from('user_activity_tracking')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user activity:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserActivity:', error);
      return null;
    }
  }

  /**
   * Cancel scheduled notifications
   */
  async cancelNotifications(userId: string, type?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('notification_queue')
        .update({ status: 'cancelled' })
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (type) {
        query = query.eq('type', type);
      }

      const { error } = await query;

      if (error) {
        console.error('Error cancelling notifications:', error);
        return false;
      }

      console.log('✅ Notifications cancelled successfully');
      return true;
    } catch (error) {
      console.error('Error in cancelNotifications:', error);
      return false;
    }
  }

  /**
   * Get pending notifications for user
   */
  async getPendingNotifications(userId: string): Promise<NotificationQueueItem[]> {
    try {
      const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true });

      if (error) {
        console.error('Error fetching pending notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getPendingNotifications:', error);
      return [];
    }
  }

  /**
   * Initialize notification system for user
   */
  async initializeForUser(userId: string): Promise<boolean> {
    try {
      // Initialize push notification service
      await pushNotificationService.initialize(userId);

      // Create default preferences if they don't exist
      const existingPrefs = await this.getNotificationPreferences(userId);
      if (!existingPrefs) {
        const defaultPrefs: NotificationPreferences = {
          user_id: userId,
          playbook_steps: true,
          devotional_reminders: true,
          journal_prompts: true,
          prayer_reminders: true,
          milestone_celebrations: true,
          trial_notifications: true,
          streak_alerts: true,
          prayer_request_alerts: true,
          quiet_hours_start: '22:00',
          quiet_hours_end: '07:00',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        await this.updateNotificationPreferences(defaultPrefs);
      }

      // Initialize activity tracking
      const existingActivity = await this.getUserActivity(userId);
      if (!existingActivity) {
        const initialActivity: UserActivityTracking = {
          user_id: userId,
          prayer_streak: 0,
          devotional_streak: 0,
          journal_streak: 0,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('user_activity_tracking')
          .insert(initialActivity);

        if (error) {
          console.error('Error initializing user activity:', error);
        }
      }

      console.log('✅ Notification system initialized for user');
      return true;
    } catch (error) {
      console.error('Error in initializeForUser:', error);
      return false;
    }
  }

  /**
   * Schedule prayer reminder
   */
  async schedulePrayerReminder(userId: string, scheduledFor: Date): Promise<boolean> {
    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'prayer_reminder',
      title: 'Time for Prayer 🙏',
      message: 'Take a moment to connect with God through prayer.',
      data: {
        reminder_type: 'prayer',
        suggested_duration: '5-10 minutes',
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'normal',
    };

    return await this.scheduleNotification(notification);
  }

  /**
   * Schedule devotional reminder
   */
  async scheduleDevotionalReminder(userId: string, scheduledFor: Date): Promise<boolean> {
    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'devotional_reminder',
      title: 'Daily Devotional 📖',
      message: 'Start your day with God\'s word and guidance.',
      data: {
        reminder_type: 'devotional',
        action: 'open_devotional',
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'normal',
    };

    return await this.scheduleNotification(notification);
  }

  /**
   * Schedule journal prompt
   */
  async scheduleJournalPrompt(userId: string, scheduledFor: Date, prompt?: string): Promise<boolean> {
    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'journal_prompt',
      title: 'Reflection Time ✍️',
      message: prompt || 'How did God show up in your day today?',
      data: {
        reminder_type: 'journal',
        prompt: prompt || 'How did God show up in your day today?',
        action: 'open_journal',
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'normal',
    };

    return await this.scheduleNotification(notification);
  }

  /**
   * Send streak alert
   */
  async sendStreakAlert(userId: string, streakType: string, currentStreak: number): Promise<boolean> {
    const messages = {
      prayer: `Don't break your ${currentStreak}-day prayer streak! 🔥`,
      devotional: `Keep your ${currentStreak}-day devotional streak going! 📖`,
      journal: `Continue your ${currentStreak}-day journaling journey! ✍️`,
    };

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'streak_alert',
      title: 'Streak Alert! 🔥',
      message: messages[streakType as keyof typeof messages] || 'Keep your spiritual momentum going!',
      data: {
        streak_type: streakType,
        current_streak: currentStreak,
        action: `open_${streakType}`,
      },
      scheduled_for: new Date().toISOString(),
      priority: 'high',
    };

    return await this.scheduleNotification(notification);
  }
}

export const notificationManagementService = new NotificationManagementService();
