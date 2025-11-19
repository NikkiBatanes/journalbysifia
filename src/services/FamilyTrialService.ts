import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { NewSubscriptionService } from './NewSubscriptionService';
import { FamilySubscriptionService } from './FamilySubscriptionService';
import { FamilyNotificationService } from './FamilyNotificationService';

/**
 * FamilyTrialService
 *
 * Handles family trial → paid conversions and member limit synchronization
 *
 * Key Scenarios:
 * 1. Admin creates family on trial (2 playbooks/devotionals for all members)
 * 2. Admin upgrades trial to paid (all members get unlimited)
 * 3. New member joins during trial (gets trial limits)
 * 4. New member joins after paid (gets unlimited immediately)
 */

export class FamilyTrialService {
  /**
   * Convert family trial to paid subscription
   * Updates admin and all family members to unlimited
   */
  static async convertFamilyTrialToPaid(
    familyGroupId: string,
    adminUserId: string
  ): Promise<{
    success: boolean;
    membersUpdated: number;
    error?: string;
  }> {
    try {
      Logger.info('Converting family trial to paid', {
        familyGroupId,
        adminUserId,
      });

      // Get all family members
      const familyGroup = await FamilySubscriptionService.getFamilyGroup(familyGroupId);

      if (!familyGroup) {
        throw new Error('Family group not found');
      }

      if (familyGroup.admin_user_id !== adminUserId) {
        throw new Error('Only admin can convert trial');
      }

      // Update all member subscriptions to unlimited (family tier limits)
      const memberIds = familyGroup.members.map(m => m.user_id);

      const { error: updateError } = await supabase
        .from('user_subscriptions_new')
        .update({
          tier: 'family',
          playbooks_limit: 999999, // Unlimited
          devotionals_limit: 999999, // Unlimited
          smart_journaling_enabled: true,
          subscription_display_name: 'siFia Family',
          updated_at: new Date().toISOString(),
        })
        .in('user_id', memberIds);

      if (updateError) {
        throw new Error(`Failed to update members: ${updateError.message}`);
      }

      // Log activity
      await this.logFamilyActivity(
        familyGroupId,
        adminUserId,
        'subscription_upgraded',
        'Family trial converted to paid - all members now have unlimited access'
      );

      // Notify all members about unlimited access
      try {
        await FamilyNotificationService.notifyTrialConverted(
          familyGroupId,
          memberIds
        );
      } catch (notifError) {
        Logger.error('Failed to send trial converted notifications', notifError as Error, {
          component: 'FamilyTrialService',
        });
      }

      Logger.info('Family trial converted successfully', {
        familyGroupId,
        membersUpdated: memberIds.length,
      });

      return {
        success: true,
        membersUpdated: memberIds.length,
      };
    } catch (error) {
      Logger.error('Failed to convert family trial', error as Error, {
        component: 'FamilyTrialService',
        familyGroupId,
      });

      return {
        success: false,
        membersUpdated: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sync member limits when they join a family
   * Applies trial or paid limits based on family group status
   */
  static async syncMemberLimits(
    userId: string,
    familyGroupId: string
  ): Promise<boolean> {
    try {
      Logger.info('[FamilyTrial] Starting sync member limits', {
        component: 'FamilyTrialService',
        userId,
        familyGroupId,
      });

      // Get family group admin directly without loading full member list
      const { data: familyGroup, error: groupError } = await supabase
        .from('family_subscription_groups')
        .select('admin_user_id')
        .eq('id', familyGroupId)
        .single();

      if (groupError || !familyGroup) {
        throw new Error('Family group not found');
      }

      Logger.info('[FamilyTrial] Fetching admin subscription directly from DB', {
        component: 'FamilyTrialService',
        adminUserId: familyGroup.admin_user_id,
      });

      // Fetch admin subscription directly to avoid any service layer issues
      // Order by updated_at to get the most recent subscription if there are duplicates
      const { data: adminSubData, error: adminSubError } = await supabase
        .from('user_subscriptions_new')
        .select('tier, subscription_display_name, playbooks_limit, devotionals_limit')
        .eq('user_id', familyGroup.admin_user_id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      let adminSubscription = adminSubData;
      if (adminSubError || !adminSubscription) {
        Logger.warn('[FamilyTrial] Could not fetch admin subscription, assuming paid family', {
          component: 'FamilyTrialService',
          errorMessage: adminSubError?.message,
        });
        // Fallback: assume paid family (safer default - gives unlimited access)
        adminSubscription = { 
          tier: 'family',
          subscription_display_name: 'siFia Family',
          playbooks_limit: 999999,
          devotionals_limit: 999999,
        };
      }

      Logger.info('[FamilyTrial] Admin subscription fetched', {
        component: 'FamilyTrialService',
        tier: adminSubscription.tier,
        displayName: adminSubscription.subscription_display_name,
        playbooksLimit: adminSubscription.playbooks_limit,
      });

      // Determine if trial based on display name or limits
      const isTrial = adminSubscription.subscription_display_name === 'siFia Family Trial' ||
                     (adminSubscription.playbooks_limit && adminSubscription.playbooks_limit < 999999);

      const limits = isTrial
        ? {
            playbooks_limit: 2,
            devotionals_limit: 2,
            smart_journaling_enabled: true, // Trial has full tier benefits
            subscription_display_name: 'siFia Family Trial',
          }
        : {
            playbooks_limit: 999999, // Unlimited
            devotionals_limit: 999999, // Unlimited
            smart_journaling_enabled: true,
            subscription_display_name: 'siFia Family',
          };

      // Update member subscription
      Logger.info('[FamilyTrial] Updating member subscription', {
        component: 'FamilyTrialService',
        userId,
        limits,
      });

      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          ...limits,
          tier: 'family',
          family_group_id: familyGroupId,
          family_role: 'member',
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      Logger.info('[FamilyTrial] Member subscription update complete', {
        component: 'FamilyTrialService',
        hasError: !!error,
      });

      if (error) {
        throw new Error(`Failed to sync member limits: ${error.message}`);
      }

      Logger.info('Member limits synced', {
        userId,
        familyGroupId,
        isTrial,
        limits,
      });

      return true;
    } catch (error) {
      Logger.error('Failed to sync member limits', error as Error, {
        component: 'FamilyTrialService',
        userId,
        familyGroupId,
      });
      return false;
    }
  }

  /**
   * Check if family is on trial
   */
  static async isFamilyOnTrial(familyGroupId: string): Promise<boolean> {
    try {
      const familyGroup = await FamilySubscriptionService.getFamilyGroup(familyGroupId);

      if (!familyGroup) {
        return false;
      }

      const adminSubscription = await NewSubscriptionService.getUserSubscription(
        familyGroup.admin_user_id
      );

      return adminSubscription.tier === 'free_trial' ||
             adminSubscription.is_trial === true;
    } catch (error) {
      Logger.error('Failed to check family trial status', error as Error, {
        component: 'FamilyTrialService',
      });
      return false;
    }
  }

  /**
   * Get family subscription status for display
   */
  static async getFamilyStatus(familyGroupId: string): Promise<{
    isTrial: boolean;
    daysRemaining?: number;
    playbooks_limit: number;
    devotionals_limit: number;
    displayName: string;
  }> {
    try {
      const familyGroup = await FamilySubscriptionService.getFamilyGroup(familyGroupId);

      if (!familyGroup) {
        throw new Error('Family group not found');
      }

      const adminSubscription = await NewSubscriptionService.getUserSubscription(
        familyGroup.admin_user_id
      );

      const isTrial = adminSubscription.tier === 'free_trial' ||
                     adminSubscription.is_trial === true;

      return {
        isTrial,
        daysRemaining: adminSubscription.days_remaining,
        playbooks_limit: isTrial ? 2 : 999999,
        devotionals_limit: isTrial ? 2 : 999999,
        displayName: isTrial ? 'siFia Family Trial' : 'siFia Family',
      };
    } catch (error) {
      Logger.error('Failed to get family status', error as Error, {
        component: 'FamilyTrialService',
      });

      return {
        isTrial: false,
        playbooks_limit: 2,
        devotionals_limit: 2,
        displayName: 'siFia Family',
      };
    }
  }

  /**
   * Helper to log family activity
   */
  private static async logFamilyActivity(
    familyGroupId: string,
    userId: string,
    activityType: string,
    description: string
  ): Promise<void> {
    try {
      await supabase.from('family_activity_log').insert({
        family_group_id: familyGroupId,
        user_id: userId,
        activity_type: activityType,
        activity_description: description,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Failed to log family activity', error as Error, {
        component: 'FamilyTrialService',
      });
    }
  }
}

export default FamilyTrialService;
