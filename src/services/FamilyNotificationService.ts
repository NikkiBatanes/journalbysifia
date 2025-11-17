import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';

/**
 * FamilyNotificationService
 *
 * Handles in-app notifications for family subscription events
 * - Invitation received
 * - Member joined
 * - Member removed
 * - Trial converted to paid
 */

export interface FamilyNotification {
  id: string;
  user_id: string;
  notification_type: 'family_invitation' | 'member_joined' | 'member_removed' | 'trial_converted';
  title: string;
  message: string;
  data?: {
    family_group_id?: string;
    invitation_code?: string;
    invited_by_name?: string;
  };
  is_read: boolean;
  created_at: string;
}

export class FamilyNotificationService {
  /**
   * Send in-app notification when user is invited to family
   */
  static async notifyFamilyInvitation(
    invitedEmail: string,
    invitedByName: string,
    invitationCode: string,
    familyGroupId: string,
    groupName: string
  ): Promise<boolean> {
    try {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', invitedEmail)
        .single();

      if (profileError || !profile) {
        Logger.info('User not found for email, will send email invitation only', {
          email: invitedEmail,
        });
        return false;
      }

      // Create in-app notification
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: profile.id,
          notification_type: 'family_invitation',
          title: 'Family Invitation',
          message: `${invitedByName} invited you to join "${groupName}" family subscription`,
          data: {
            family_group_id: familyGroupId,
            invitation_code: invitationCode,
            invited_by_name: invitedByName,
            group_name: groupName,
          },
          is_read: false,
          created_at: new Date().toISOString(),
        });

      if (error) {
        Logger.error('Failed to create family invitation notification', error as Error, {
          component: 'FamilyNotificationService',
        });
        return false;
      }

      Logger.info('Family invitation notification sent', {
        invitedEmail,
        invitationCode,
      });

      return true;
    } catch (error) {
      Logger.error('Failed to send family invitation notification', error as Error, {
        component: 'FamilyNotificationService',
      });
      return false;
    }
  }

  /**
   * Notify admin when member joins
   */
  static async notifyMemberJoined(
    adminUserId: string,
    memberName: string,
    familyGroupId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: adminUserId,
          notification_type: 'member_joined',
          title: 'New Family Member',
          message: `${memberName} has joined your family subscription`,
          data: {
            family_group_id: familyGroupId,
          },
          is_read: false,
          created_at: new Date().toISOString(),
        });

      if (error) {
        Logger.error('Failed to create member joined notification', error as Error, {
          component: 'FamilyNotificationService',
        });
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Failed to send member joined notification', error as Error, {
        component: 'FamilyNotificationService',
      });
      return false;
    }
  }

  /**
   * Notify all members when trial converts to paid
   */
  static async notifyTrialConverted(
    familyGroupId: string,
    memberIds: string[]
  ): Promise<boolean> {
    try {
      const notifications = memberIds.map(userId => ({
        user_id: userId,
        notification_type: 'trial_converted',
        title: 'Family Subscription Activated',
        message: 'Your family subscription is now active with unlimited access!',
        data: {
          family_group_id: familyGroupId,
        },
        is_read: false,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) {
        Logger.error('Failed to create trial converted notifications', error as Error, {
          component: 'FamilyNotificationService',
        });
        return false;
      }

      Logger.info('Trial converted notifications sent', {
        familyGroupId,
        memberCount: memberIds.length,
      });

      return true;
    } catch (error) {
      Logger.error('Failed to send trial converted notifications', error as Error, {
        component: 'FamilyNotificationService',
      });
      return false;
    }
  }

  /**
   * Notify member when removed from family
   */
  static async notifyMemberRemoved(
    userId: string,
    groupName: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          notification_type: 'member_removed',
          title: 'Removed from Family',
          message: `You have been removed from "${groupName}" family subscription`,
          data: {},
          is_read: false,
          created_at: new Date().toISOString(),
        });

      if (error) {
        Logger.error('Failed to create member removed notification', error as Error, {
          component: 'FamilyNotificationService',
        });
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Failed to send member removed notification', error as Error, {
        component: 'FamilyNotificationService',
      });
      return false;
    }
  }

  /**
   * Get pending family invitations for user
   */
  static async getPendingInvitations(userId: string): Promise<FamilyNotification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('notification_type', 'family_invitation')
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) {
        Logger.error('Failed to get pending invitations', error as Error, {
          component: 'FamilyNotificationService',
        });
        return [];
      }

      return data || [];
    } catch (error) {
      Logger.error('Failed to fetch pending invitations', error as Error, {
        component: 'FamilyNotificationService',
      });
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        Logger.error('Failed to mark notification as read', error as Error, {
          component: 'FamilyNotificationService',
        });
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Failed to update notification', error as Error, {
        component: 'FamilyNotificationService',
      });
      return false;
    }
  }
}

export default FamilyNotificationService;
