import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { notificationSchedulerService } from './notificationSchedulerService';
import { NotificationQueueItem } from './notificationManagementService';
import { requestReview } from './reviewPromptService';

export type MilestoneType = 'faith_points' | 'level_up' | 'playbook_complete' | 'prayer_answered';

export interface MilestoneEvent {
  userId: string;
  type: MilestoneType;
  value: number | string;
  metadata?: Record<string, any>;
}

/**
 * Milestone Celebration Service
 * Handles celebration notifications for user achievements
 */
class MilestoneCelebrationService {
  // Faith points milestones to celebrate
  private readonly FAITH_POINTS_MILESTONES = [100, 250, 500, 750, 1000, 2500, 5000, 10000];

  // Level titles (synced with faithPointsService)
  private readonly LEVEL_TITLES: Record<number, string> = {
    1: 'Beginning',
    2: 'Growing',
    3: 'Rooted',
    4: 'Steady',
    5: 'Grounded',
    6: 'Faithful',
    7: 'Maturing',
    8: 'Deepening',
    9: 'Strengthened',
    10: 'Abiding',
  };

  /**
   * Check if faith points milestone was reached and celebrate
   */
  async checkFaithPointsMilestone(
    userId: string,
    previousPoints: number,
    currentPoints: number
  ): Promise<boolean> {
    try {
      // Find if we crossed a milestone
      const milestoneCrossed = this.FAITH_POINTS_MILESTONES.find(
        milestone => previousPoints < milestone && currentPoints >= milestone
      );

      if (!milestoneCrossed) {
        return false;
      }

      // Send celebration notification
      return await this.celebrateFaithPointsMilestone(userId, milestoneCrossed);
    } catch (error) {
      Logger.error('Error checking faith points milestone', error as Error, {
        component: 'milestoneCelebrationService',
        userId,
        previousPoints,
        currentPoints,
      });
      return false;
    }
  }

  /**
   * Send faith points milestone celebration notification
   */
  private async celebrateFaithPointsMilestone(
    userId: string,
    points: number
  ): Promise<boolean> {
    try {
      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'milestone_celebration',
        title: `You reached ${points} faith points`,
        message: 'Keep going. Quiet faithfulness adds up over time.',
        data: {
          deep_link: 'sifia://profile/stats',
          milestone_type: 'faith_points',
          value: points,
        },
        scheduled_for: new Date().toISOString(),
        priority: 'high',
      };

      const success = await notificationSchedulerService.scheduleNotification(notification, {
         // Celebrations are immediate
        priority: 'high',
        batchWithOthers: false,
      });

      if (success) {
        Logger.info('Faith points milestone celebrated', {
          component: 'milestoneCelebrationService',
          userId,
          points,
        });

        // Request review after faith points milestones (100+ points)
        requestReview({ triggerSource: `faith_points_milestone_${points}` }).catch(() => {
          // Silently fail - review prompt is optional
        });
      }

      return success;
    } catch (error) {
      Logger.error('Error celebrating faith points milestone', error as Error, {
        component: 'milestoneCelebrationService',
        userId,
        points,
      });
      return false;
    }
  }

  /**
   * Celebrate level up
   */
  async celebrateLevelUp(
    userId: string,
    newLevel: number
  ): Promise<boolean> {
    try {
      const levelTitle = this.LEVEL_TITLES[newLevel] || 'Faithful One';

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'milestone_celebration',
        title: `You're now a ${levelTitle}`,
        message: 'A new step in your journey has opened. Keep walking with God, one faithful step at a time.',
        data: {
          deep_link: 'sifia://profile/stats',
          milestone_type: 'level_up',
          new_level: newLevel,
          level_title: levelTitle,
        },
        scheduled_for: new Date().toISOString(),
        priority: 'high',
      };

      const success = await notificationSchedulerService.scheduleNotification(notification, {
         // Celebrations are immediate
        priority: 'high',
        batchWithOthers: false,
      });

      if (success) {
        Logger.info('Level up celebrated', {
          component: 'milestoneCelebrationService',
          userId,
          newLevel,
          levelTitle,
        });

        // Request review after level up (significant achievement)
        requestReview({ triggerSource: `level_up_${newLevel}` }).catch(() => {
          // Silently fail - review prompt is optional
        });
      }

      return success;
    } catch (error) {
      Logger.error('Error celebrating level up', error as Error, {
        component: 'milestoneCelebrationService',
        userId,
        newLevel,
      });
      return false;
    }
  }

  /**
   * Celebrate playbook completion
   */
  async celebratePlaybookComplete(
    userId: string,
    playbookId: string,
    playbookTitle: string
  ): Promise<boolean> {
    try {
      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'milestone_celebration',
        title: 'Playbook complete',
        message: `You finished "${playbookTitle}". Take a moment to notice what God has shown you here.`,
        data: {
          deep_link: `sifia://playbooks/${playbookId}?celebrate=true`,
          milestone_type: 'playbook_complete',
          playbook_id: playbookId,
          playbook_title: playbookTitle,
        },
        scheduled_for: new Date().toISOString(),
        priority: 'high',
      };

      const success = await notificationSchedulerService.scheduleNotification(notification, {
         // Celebrations are immediate
        priority: 'high',
        batchWithOthers: false,
      });

      if (success) {
        Logger.info('Playbook completion celebrated', {
          component: 'milestoneCelebrationService',
          userId,
          playbookId,
          playbookTitle,
        });

        // Request review after playbook completion (positive user experience)
        requestReview({ triggerSource: 'playbook_complete' }).catch(() => {
          // Silently fail - review prompt is optional
        });
      }

      return success;
    } catch (error) {
      Logger.error('Error celebrating playbook completion', error as Error, {
        component: 'milestoneCelebrationService',
        userId,
        playbookId,
      });
      return false;
    }
  }

  /**
   * Celebrate prayer answered
   */
  async celebratePrayerAnswered(
    userId: string,
    prayerId: string
  ): Promise<boolean> {
    try {
      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'milestone_celebration',
        title: 'Prayer answered',
        message: 'Praise God for His faithfulness. Take a moment to reflect on how He has moved in this.',
        data: {
          deep_link: `sifia://journal/prayer?answered=true&id=${prayerId}`,
          milestone_type: 'prayer_answered',
          prayer_id: prayerId,
        },
        scheduled_for: new Date().toISOString(),
        priority: 'high',
      };

      const success = await notificationSchedulerService.scheduleNotification(notification, {
         // Celebrations are immediate
        priority: 'high',
        batchWithOthers: false,
      });

      if (success) {
        Logger.info('Prayer answered celebrated', {
          component: 'milestoneCelebrationService',
          userId,
          prayerId,
        });

        // Request review after prayer answered (spiritual milestone)
        requestReview({ triggerSource: 'prayer_answered' }).catch(() => {
          // Silently fail - review prompt is optional
        });
      }

      return success;
    } catch (error) {
      Logger.error('Error celebrating prayer answered', error as Error, {
        component: 'milestoneCelebrationService',
        userId,
        prayerId,
      });
      return false;
    }
  }

  /**
   * Generic milestone celebration
   */
  async celebrateMilestone(event: MilestoneEvent): Promise<boolean> {
    try {
      switch (event.type) {
        case 'level_up':
          return await this.celebrateLevelUp(event.userId, Number(event.value));

        case 'playbook_complete':
          return await this.celebratePlaybookComplete(
            event.userId,
            String(event.value),
            event.metadata?.playbookTitle || 'Your Playbook'
          );

        case 'prayer_answered':
          return await this.celebratePrayerAnswered(event.userId, String(event.value));

        case 'faith_points':
          // For faith points, use checkFaithPointsMilestone instead
          Logger.warn('Use checkFaithPointsMilestone for faith points', {
            component: 'milestoneCelebrationService',
          });
          return false;

        default:
          Logger.warn('Unknown milestone type', {
            component: 'milestoneCelebrationService',
            type: event.type,
          });
          return false;
      }
    } catch (error) {
      Logger.error('Error celebrating milestone', error as Error, {
        component: 'milestoneCelebrationService',
        event,
      });
      return false;
    }
  }

  /**
   * Track milestone in database (optional - for analytics)
   */
  async trackMilestone(event: MilestoneEvent): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_milestones')
        .insert({
          user_id: event.userId,
          milestone_type: event.type,
          milestone_value: String(event.value),
          metadata: event.metadata || {},
          achieved_at: new Date().toISOString(),
        });

      if (error) {
        // Gracefully handle missing table (not critical)
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          Logger.warn('user_milestones table not found - skipping milestone tracking', {
            component: 'milestoneCelebrationService',
          });
          return true;
        }

        Logger.error('Failed to track milestone', error as Error, {
          component: 'milestoneCelebrationService',
          event,
        });
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Error tracking milestone', error as Error, {
        component: 'milestoneCelebrationService',
        event,
      });
      return false;
    }
  }
}

export const milestoneCelebrationService = new MilestoneCelebrationService();
