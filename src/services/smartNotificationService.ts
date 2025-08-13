import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface NotificationPreferences {
  dailyDevotional: boolean;
  coachingReminders: boolean;
  progressCelebrations: boolean;
  spiritualMilestones: boolean;
  customReminders: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
  };
  preferredTimes: string[]; // Array of HH:MM times
}

export interface SmartNotification {
  id: string;
  userId: string;
  type: 'devotional' | 'coaching' | 'progress' | 'milestone' | 'custom';
  title: string;
  message: string;
  scheduledFor: string; // ISO date string
  isPersonalized: boolean;
  context?: {
    playbookId?: string;
    actionStepId?: string;
    progressData?: any;
  };
  status: 'scheduled' | 'sent' | 'dismissed';
  createdAt: string;
}

export interface ProgressMilestone {
  id: string;
  userId: string;
  type: 'playbook_completion' | 'streak_achievement' | 'spiritual_growth' | 'consistency';
  title: string;
  description: string;
  achievedAt: string;
  celebrationMessage: string;
  nextGoal?: string;
}

class SmartNotificationService {
  private readonly STORAGE_KEYS = {
    PREFERENCES: 'notification_preferences',
    SCHEDULED: 'scheduled_notifications',
    MILESTONES: 'progress_milestones',
  };

  /**
   * Get user notification preferences
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const stored = await AsyncStorage.getItem(`${this.STORAGE_KEYS.PREFERENCES}_${userId}`);

      if (stored) {
        return JSON.parse(stored);
      }

      // Default preferences
      const defaultPreferences: NotificationPreferences = {
        dailyDevotional: true,
        coachingReminders: true,
        progressCelebrations: true,
        spiritualMilestones: true,
        customReminders: false,
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '07:00',
        },
        preferredTimes: ['08:00', '12:00', '18:00'],
      };

      await this.saveNotificationPreferences(userId, defaultPreferences);
      return defaultPreferences;
    } catch (error) {
      console.error('[SmartNotificationService] Error getting preferences:', error);
      throw error;
    }
  }

  /**
   * Save notification preferences
   */
  async saveNotificationPreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${this.STORAGE_KEYS.PREFERENCES}_${userId}`,
        JSON.stringify(preferences)
      );

      // Also save to Supabase for cross-device sync
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          notification_preferences: preferences,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[SmartNotificationService] Error saving to Supabase:', error);
      }
    } catch (error) {
      console.error('[SmartNotificationService] Error saving preferences:', error);
      throw error;
    }
  }

  /**
   * Schedule personalized coaching reminder
   */
  async scheduleCoachingReminder(
    userId: string,
    playbookId: string,
    actionStepId?: string,
    customTime?: string
  ): Promise<SmartNotification> {
    try {
      const preferences = await this.getNotificationPreferences(userId);

      if (!preferences.coachingReminders) {
        throw new Error('Coaching reminders are disabled');
      }

      // Get user's spiritual profile for personalization
      const { data: profile } = await supabase
        .from('user_spiritual_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Generate personalized message
      const personalizedMessage = await this.generatePersonalizedMessage(
        'coaching',
        profile,
        { playbookId, actionStepId }
      );

      const scheduledTime = customTime || this.getNextPreferredTime(preferences);

      const notification: SmartNotification = {
        id: `coaching_${Date.now()}_${userId.slice(-6)}`,
        userId,
        type: 'coaching',
        title: 'Your Spiritual Coach is Here 🙏',
        message: personalizedMessage,
        scheduledFor: scheduledTime,
        isPersonalized: true,
        context: { playbookId, actionStepId },
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      };

      await this.saveNotification(notification);
      return notification;
    } catch (error) {
      console.error('[SmartNotificationService] Error scheduling coaching reminder:', error);
      throw error;
    }
  }

  /**
   * Schedule progress celebration notification
   */
  async scheduleProgressCelebration(
    userId: string,
    milestone: ProgressMilestone
  ): Promise<SmartNotification> {
    try {
      const preferences = await this.getNotificationPreferences(userId);

      if (!preferences.progressCelebrations) {
        return null;
      }

      const notification: SmartNotification = {
        id: `celebration_${Date.now()}_${userId.slice(-6)}`,
        userId,
        type: 'progress',
        title: '🎉 Celebrating Your Growth!',
        message: milestone.celebrationMessage,
        scheduledFor: new Date().toISOString(), // Immediate
        isPersonalized: true,
        context: { progressData: milestone },
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      };

      await this.saveNotification(notification);
      return notification;
    } catch (error) {
      console.error('[SmartNotificationService] Error scheduling celebration:', error);
      throw error;
    }
  }

  /**
   * Track and celebrate progress milestones
   */
  async trackProgressMilestone(
    userId: string,
    type: ProgressMilestone['type'],
    data: any
  ): Promise<ProgressMilestone | null> {
    try {
      let milestone: ProgressMilestone | null = null;

      switch (type) {
        case 'playbook_completion':
          milestone = await this.checkPlaybookCompletion(userId, data);
          break;
        case 'streak_achievement':
          milestone = await this.checkStreakAchievement(userId, data);
          break;
        case 'spiritual_growth':
          milestone = await this.checkSpiritualGrowth(userId, data);
          break;
        case 'consistency':
          milestone = await this.checkConsistency(userId, data);
          break;
      }

      if (milestone) {
        await this.saveMilestone(milestone);
        await this.scheduleProgressCelebration(userId, milestone);
      }

      return milestone;
    } catch (error) {
      console.error('[SmartNotificationService] Error tracking milestone:', error);
      return null;
    }
  }

  /**
   * Get user's progress milestones
   */
  async getUserMilestones(userId: string): Promise<ProgressMilestone[]> {
    try {
      const stored = await AsyncStorage.getItem(`${this.STORAGE_KEYS.MILESTONES}_${userId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[SmartNotificationService] Error getting milestones:', error);
      return [];
    }
  }

  /**
   * Get scheduled notifications for user
   */
  async getScheduledNotifications(userId: string): Promise<SmartNotification[]> {
    try {
      const stored = await AsyncStorage.getItem(`${this.STORAGE_KEYS.SCHEDULED}_${userId}`);
      const notifications: SmartNotification[] = stored ? JSON.parse(stored) : [];

      // Filter out past notifications
      const now = new Date();
      return notifications.filter(n =>
        n.status === 'scheduled' && new Date(n.scheduledFor) > now
      );
    } catch (error) {
      console.error('[SmartNotificationService] Error getting notifications:', error);
      return [];
    }
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  private async generatePersonalizedMessage(
    type: string,
    profile: any,
    context: any
  ): Promise<string> {
    // Generate personalized messages based on user's spiritual profile
    const messages = {
      coaching: [
        'Ready to take the next step in your faith journey? Your personalized guidance is waiting! 🌟',
        "God has something beautiful planned for your growth today. Let's explore it together! ✨",
        'Your spiritual coach is here with encouragement tailored just for you. 💝',
        'Time to nurture your soul with some personalized wisdom and biblical insight! 🙏',
      ],
    };

    const typeMessages = messages[type] || messages.coaching;
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  }

  private getNextPreferredTime(preferences: NotificationPreferences): string {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Find next preferred time today or tomorrow
    for (const time of preferences.preferredTimes) {
      const scheduledTime = new Date(`${today}T${time}:00`);
      if (scheduledTime > now && !this.isInQuietHours(scheduledTime, preferences)) {
        return scheduledTime.toISOString();
      }
    }

    // If no time today, schedule for first preferred time tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    const firstTime = preferences.preferredTimes[0] || '08:00';

    return new Date(`${tomorrowDate}T${firstTime}:00`).toISOString();
  }

  private isInQuietHours(time: Date, preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours.enabled) {return false;}

    const timeStr = time.toTimeString().slice(0, 5); // HH:MM format
    const { startTime, endTime } = preferences.quietHours;

    if (startTime <= endTime) {
      return timeStr >= startTime && timeStr <= endTime;
    } else {
      // Quiet hours span midnight
      return timeStr >= startTime || timeStr <= endTime;
    }
  }

  private async checkPlaybookCompletion(userId: string, data: any): Promise<ProgressMilestone | null> {
    // Check if user completed a significant playbook
    const completedSteps = data.completedSteps || 0;
    const totalSteps = data.totalSteps || 0;

    if (completedSteps === totalSteps && totalSteps >= 5) {
      return {
        id: `playbook_${Date.now()}_${userId.slice(-6)}`,
        userId,
        type: 'playbook_completion',
        title: 'Playbook Completed! 🎯',
        description: `You've completed "${data.playbookTitle}" with all ${totalSteps} action steps!`,
        achievedAt: new Date().toISOString(),
        celebrationMessage: `Amazing work! You've completed "${data.playbookTitle}" and taken ${totalSteps} meaningful steps in your faith journey. God is proud of your dedication! 🙌`,
        nextGoal: 'Ready for your next spiritual adventure? Explore more playbooks to continue growing!',
      };
    }

    return null;
  }

  private async checkStreakAchievement(userId: string, data: any): Promise<ProgressMilestone | null> {
    const streak = data.currentStreak || 0;
    const milestoneStreaks = [7, 14, 30, 60, 100];

    if (milestoneStreaks.includes(streak)) {
      return {
        id: `streak_${Date.now()}_${userId.slice(-6)}`,
        userId,
        type: 'streak_achievement',
        title: `${streak}-Day Streak! 🔥`,
        description: `You've maintained consistent spiritual growth for ${streak} days!`,
        achievedAt: new Date().toISOString(),
        celebrationMessage: `Incredible! ${streak} days of consistent spiritual growth. Your faithfulness is inspiring! Keep up the amazing work! 🔥✨`,
        nextGoal: streak < 100 ? `Can you reach ${milestoneStreaks.find(s => s > streak) || 365} days?` : 'You\'re a spiritual growth champion!',
      };
    }

    return null;
  }

  private async checkSpiritualGrowth(userId: string, data: any): Promise<ProgressMilestone | null> {
    // Check for spiritual maturity level increases
    const previousLevel = data.previousLevel || 'beginner';
    const currentLevel = data.currentLevel || 'beginner';

    if (previousLevel !== currentLevel) {
      return {
        id: `growth_${Date.now()}_${userId.slice(-6)}`,
        userId,
        type: 'spiritual_growth',
        title: 'Spiritual Growth Milestone! 🌱',
        description: `You've grown from ${previousLevel} to ${currentLevel} in your faith journey!`,
        achievedAt: new Date().toISOString(),
        celebrationMessage: `What beautiful growth! You've progressed from ${previousLevel} to ${currentLevel} in your spiritual maturity. God is working in your life! 🌱💚`,
        nextGoal: 'Continue growing deeper in your relationship with God!',
      };
    }

    return null;
  }

  private async checkConsistency(userId: string, data: any): Promise<ProgressMilestone | null> {
    const weeklyGoal = data.weeklyGoal || 3;
    const weeklyCompleted = data.weeklyCompleted || 0;
    const weeksConsistent = data.weeksConsistent || 0;

    if (weeklyCompleted >= weeklyGoal && weeksConsistent > 0 && weeksConsistent % 4 === 0) {
      return {
        id: `consistency_${Date.now()}_${userId.slice(-6)}`,
        userId,
        type: 'consistency',
        title: `${weeksConsistent} Weeks of Consistency! 📅`,
        description: `You've met your weekly spiritual goals for ${weeksConsistent} consecutive weeks!`,
        achievedAt: new Date().toISOString(),
        celebrationMessage: `Outstanding consistency! ${weeksConsistent} weeks of meeting your spiritual goals shows true dedication. Your faithfulness is beautiful! 📅✨`,
        nextGoal: 'Keep building this amazing habit of consistent spiritual growth!',
      };
    }

    return null;
  }

  private async saveNotification(notification: SmartNotification): Promise<void> {
    try {
      const existing = await this.getScheduledNotifications(notification.userId);
      existing.push(notification);

      await AsyncStorage.setItem(
        `${this.STORAGE_KEYS.SCHEDULED}_${notification.userId}`,
        JSON.stringify(existing)
      );
    } catch (error) {
      console.error('[SmartNotificationService] Error saving notification:', error);
    }
  }

  private async saveMilestone(milestone: ProgressMilestone): Promise<void> {
    try {
      const existing = await this.getUserMilestones(milestone.userId);
      existing.push(milestone);

      await AsyncStorage.setItem(
        `${this.STORAGE_KEYS.MILESTONES}_${milestone.userId}`,
        JSON.stringify(existing)
      );

      // Also save to Supabase
      const { error } = await supabase
        .from('user_milestones')
        .insert({
          id: milestone.id,
          user_id: milestone.userId,
          type: milestone.type,
          title: milestone.title,
          description: milestone.description,
          achieved_at: milestone.achievedAt,
          celebration_message: milestone.celebrationMessage,
          next_goal: milestone.nextGoal,
        });

      if (error) {
        console.error('[SmartNotificationService] Error saving milestone to Supabase:', error);
      }
    } catch (error) {
      console.error('[SmartNotificationService] Error saving milestone:', error);
    }
  }
}

export const smartNotificationService = new SmartNotificationService();
