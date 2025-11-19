import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { NewSubscriptionService } from './NewSubscriptionService';
import { FamilyTrialService } from './FamilyTrialService';
import { FamilyNotificationService } from './FamilyNotificationService';

export interface FamilyGroup {
  id: string;
  admin_user_id: string;
  group_name: string;
  max_members: number;
  current_members: number;
  platform_subscription_id?: string;
  billing_cycle?: 'monthly' | 'annual';
  subscription_start_date?: string;
  subscription_end_date?: string;
  next_billing_date?: string;
  status: 'active' | 'cancelled' | 'expired';
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  user_id: string;
  family_group_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  status: 'active' | 'pending' | 'removed';
  // User profile data
  email?: string;
  full_name?: string;
  avatar_url?: string;
}

export interface FamilyInvitation {
  id: string;
  family_group_id: string;
  invited_email: string;
  invited_by_user_id: string;
  invitation_code: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: string;
  created_at: string;
}

export interface CreateFamilyGroupOptions {
  group_name: string;
  admin_user_id: string;
  platform_subscription_id?: string;
  max_members?: number;
  billing_cycle?: 'monthly' | 'annual';
}

export interface InviteMemberOptions {
  family_group_id: string;
  invited_email: string;
  invited_by_user_id: string;
}

export class FamilySubscriptionService {
  /**
   * Create a new family subscription group
   */
  static async createFamilyGroup(options: CreateFamilyGroupOptions): Promise<FamilyGroup> {
    try {
      const { data, error } = await supabase
        .from('family_subscription_groups')
        .insert({
          admin_user_id: options.admin_user_id,
          group_name: options.group_name,
          platform_subscription_id: options.platform_subscription_id,
          max_members: options.max_members || 5,
          current_members: 1,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create family group: ${error.message}`);
      }

      // Update the admin user's subscription to include family group ID
      await supabase
        .from('user_subscriptions_new')
        .update({
          family_group_id: data.id,
          family_role: 'admin',
        })
        .eq('user_id', options.admin_user_id);

      return data;
    } catch (error) {
      Logger.error('[FamilyService] Failed to create family group', error as Error, {
      component: 'FamilySubscriptionService',
    });
      throw error;
    }
  }

  /**
   * Get family group details with members
   */
  static async getFamilyGroup(groupId: string): Promise<FamilyGroup & { members: FamilyMember[] }> {
    try {
      // Get family group details
      const { data: groupData, error: groupError } = await supabase
        .from('family_subscription_groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) {
        throw new Error(`Failed to get family group: ${groupError.message}`);
      }

      // Get family members with user profile data
      const { data: membersData, error: membersError } = await supabase
        .from('user_subscriptions_new')
        .select(`
          user_id,
          family_role,
          created_at,
          user_profiles!inner(
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('family_group_id', groupId)
        .eq('status', 'active');

      if (membersError) {
        Logger.error('[FamilyService] Failed to get members', membersError as Error, {
      component: 'FamilySubscriptionService',
    });
      }

      const members: FamilyMember[] = (membersData || []).map(member => ({
        id: member.user_id,
        user_id: member.user_id,
        family_group_id: groupId,
        role: member.family_role as 'admin' | 'member',
        joined_at: member.created_at,
        status: 'active' as const,
        email: (member.user_profiles as any)?.[0]?.email || (member.user_profiles as any)?.email,
        full_name: (member.user_profiles as any)?.[0]?.full_name || (member.user_profiles as any)?.full_name,
        avatar_url: (member.user_profiles as any)?.[0]?.avatar_url || (member.user_profiles as any)?.avatar_url,
      }));

      return {
        ...groupData,
        members,
      };
    } catch (error) {
      Logger.error('[FamilyService] Failed to get family group', error as Error, {
      component: 'FamilySubscriptionService',
    });
      throw error;
    }
  }

  /**
   * Get family group for a user
   */
  static async getUserFamilyGroup(userId: string): Promise<(FamilyGroup & { members: FamilyMember[] }) | null> {
    try {
      // Get user's subscription to find family group ID
      const subscription = await NewSubscriptionService.getUserSubscription(userId);

      if (!subscription.family_group_id) {
        return null;
      }

      return await this.getFamilyGroup(subscription.family_group_id);
    } catch (error) {
      Logger.error('[FamilyService] Failed to get user family group', error as Error, {
      component: 'FamilySubscriptionService',
    });
      return null;
    }
  }

  /**
   * Invite a member to family group
   */
  static async inviteMember(options: InviteMemberOptions): Promise<FamilyInvitation> {
    try {
      // Check if family group exists and has space
      const familyGroup = await this.getFamilyGroup(options.family_group_id);

      // Count pending invitations
      const { data: pendingInvites } = await supabase
        .from('family_invitations')
        .select('id')
        .eq('family_group_id', options.family_group_id)
        .eq('status', 'pending');

      const pendingCount = pendingInvites?.length || 0;
      const totalSlots = familyGroup.current_members + pendingCount;

      if (totalSlots >= familyGroup.max_members) {
        throw new Error(`Family group is at maximum capacity (${familyGroup.current_members} members + ${pendingCount} pending invites = ${totalSlots}/${familyGroup.max_members})`);
      }

      // Check if user is already a member
      const existingMember = familyGroup.members.find(
        member => member.email === options.invited_email
      );

      if (existingMember) {
        throw new Error('User is already a member of this family group');
      }

      // Check for existing pending invitation
      const { data: existingInvitation } = await supabase
        .from('family_invitations')
        .select('*')
        .eq('family_group_id', options.family_group_id)
        .eq('invited_email', options.invited_email)
        .eq('status', 'pending')
        .single();

      if (existingInvitation) {
        throw new Error('Invitation already sent to this email');
      }

      // Generate invitation code
      const invitationCode = this.generateInvitationCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      // Create invitation
      const { data, error } = await supabase
        .from('family_invitations')
        .insert({
          family_group_id: options.family_group_id,
          invited_email: options.invited_email,
          invited_by_user_id: options.invited_by_user_id,
          invitation_code: invitationCode,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create invitation: ${error.message}`);
      }

      // Send in-app notification if user exists
      try {
        // Get inviter name
        const { data: inviterProfile } = await supabase
          .from('user_profiles')
          .select('full_name, email')
          .eq('id', options.invited_by_user_id)
          .single();

        const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'Someone';

        await FamilyNotificationService.notifyFamilyInvitation(
          options.invited_email,
          inviterName,
          invitationCode,
          options.family_group_id,
          familyGroup.group_name
        );
      } catch (notifError) {
        // Don't fail invitation if notification fails
        Logger.error('[FamilyService] Failed to send notification', notifError as Error, {
          component: 'FamilySubscriptionService',
        });
      }

      return data;
    } catch (error) {
      Logger.error('[FamilyService] Failed to invite member', error as Error, {
      component: 'FamilySubscriptionService',
    });
      throw error;
    }
  }

  /**
   * Accept family invitation
   */
  static async acceptInvitation(invitationCode: string, userId: string): Promise<boolean> {
    try {
      const normalizedCode = invitationCode.trim().toUpperCase();

      // Get invitation details
      const { data: invitation, error: invitationError } = await supabase
        .from('family_invitations')
        .select('*')
        .eq('invitation_code', normalizedCode)
        .eq('status', 'pending')
        .single();

      if (invitationError || !invitation) {
        Logger.error('[FamilyService] Invitation lookup failed', undefined, {
          component: 'FamilySubscriptionService',
          invitationCode: normalizedCode,
          supabaseError: invitationError
            ? {
                code: (invitationError as any).code,
                message: (invitationError as any).message,
                details: (invitationError as any).details,
                hint: (invitationError as any).hint,
              }
            : undefined,
        });
        throw new Error('Invalid or expired invitation code');
      }

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        await supabase
          .from('family_invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id);

        throw new Error('Invitation has expired');
      }

      // Get family group to check capacity
      const familyGroup = await this.getFamilyGroup(invitation.family_group_id);

      if (familyGroup.current_members >= familyGroup.max_members) {
        throw new Error('Family group is at maximum capacity');
      }

      // Update user's subscription to link to family group
      // First check if user has a subscription row
      const { error: checkError } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        // No subscription exists, create one
        const { error: insertError } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            family_group_id: invitation.family_group_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          Logger.error('[FamilyService] Failed to create user subscription', insertError as Error, {
            component: 'FamilySubscriptionService',
            errorCode: insertError.code,
            errorMessage: insertError.message,
            errorDetails: insertError.details,
          });
          throw new Error('Failed to create your subscription record');
        }
      } else {
        // Update existing subscription
        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .update({
            family_group_id: invitation.family_group_id,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (subscriptionError) {
          Logger.error('[FamilyService] Failed to link user subscription to family', subscriptionError as Error, {
            component: 'FamilySubscriptionService',
            errorCode: subscriptionError.code,
            errorMessage: subscriptionError.message,
            errorDetails: subscriptionError.details,
          });
          throw new Error('Failed to link your subscription to the family group');
        }
      }

      // Sync member limits based on family trial/paid status
      const syncSuccess = await FamilyTrialService.syncMemberLimits(
        userId,
        invitation.family_group_id
      );

      if (!syncSuccess) {
        Logger.warn('[FamilyService] Failed to sync member limits, but continuing', {
          component: 'FamilySubscriptionService',
          userId,
          familyGroupId: invitation.family_group_id,
        });
        // Don't throw - this is non-critical
      }

      // Update family group member count
      const { error: groupError } = await supabase
        .from('family_subscription_groups')
        .update({
          current_members: familyGroup.current_members + 1,
        })
        .eq('id', invitation.family_group_id);

      if (groupError) {
        Logger.error('[FamilyService] Failed to update member count', groupError as Error, {
          component: 'FamilySubscriptionService',
        });
      }

      // Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('family_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

      if (updateError) {
        Logger.error('[FamilyService] Failed to update invitation status', updateError as Error, {
      component: 'FamilySubscriptionService',
    });
      }

      // Notify admin that member joined
      try {
        const { data: memberProfile } = await supabase
          .from('user_profiles')
          .select('full_name, email')
          .eq('id', userId)
          .single();

        const memberName = memberProfile?.full_name || memberProfile?.email || 'A new member';

        await FamilyNotificationService.notifyMemberJoined(
          familyGroup.admin_user_id,
          memberName,
          invitation.family_group_id
        );
      } catch (notifError) {
        Logger.error('[FamilyService] Failed to send member joined notification', notifError as Error, {
          component: 'FamilySubscriptionService',
        });
      }

      return true;
    } catch (error) {
      Logger.error('[FamilyService] Failed to accept invitation', error as Error, {
      component: 'FamilySubscriptionService',
    });
      throw error;
    }
  }

  /**
   * Remove member from family group (admin action)
   */
  static async removeMember(familyGroupId: string, userId: string, adminUserId: string): Promise<boolean> {
    try {
      // Verify admin permissions
      const familyGroup = await this.getFamilyGroup(familyGroupId);

      if (familyGroup.admin_user_id !== adminUserId) {
        throw new Error('Only family admin can remove members');
      }

      // Cannot remove admin
      if (userId === adminUserId) {
        throw new Error('Admin cannot be removed from family group');
      }

      // Update user's subscription to remove from family
      const { error: subscriptionError } = await supabase
        .from('user_subscriptions_new')
        .update({
          tier: 'seeker',
          playbooks_limit: 0,
          devotionals_limit: 0,
          smart_journaling_enabled: false,
          playbooks_used: 0,
          devotionals_used: 0,
          family_group_id: null,
          family_role: null,
          subscription_display_name: 'siFia Seeker',
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (subscriptionError) {
        throw new Error(`Failed to update user subscription: ${subscriptionError.message}`);
      }

      // Update family group member count
      const { error: groupError } = await supabase
        .from('family_subscription_groups')
        .update({
          current_members: Math.max(1, familyGroup.current_members - 1),
          updated_at: new Date().toISOString(),
        })
        .eq('id', familyGroupId);

      if (groupError) {
        Logger.error('[FamilyService] Failed to update member count', groupError as Error, {
      component: 'FamilySubscriptionService',
    });
      }

      // Notify removed member
      try {
        await FamilyNotificationService.notifyMemberRemoved(userId, familyGroup.group_name);
      } catch (notifError) {
        Logger.error('[FamilyService] Failed to notify removed member', notifError as Error, {
          component: 'FamilySubscriptionService',
        });
      }

      return true;
    } catch (error) {
      Logger.error('[FamilyService] Failed to remove member', error as Error, {
      component: 'FamilySubscriptionService',
    });
      throw error;
    }
  }

  /**
   * Leave family group (member self-service)
   * Enterprise-grade: Allows members to voluntarily leave family subscription
   */
  static async leaveFamilyGroup(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      Logger.info('[FamilyService] Member leaving family group', { userId });

      // Get user's current subscription
      const subscription = await NewSubscriptionService.getUserSubscription(userId);

      if (!subscription.family_group_id) {
        throw new Error('User is not part of a family group');
      }

      // Cannot leave if admin - must cancel family subscription instead
      if (subscription.family_role === 'admin') {
        throw new Error('Family admin cannot leave group. Please cancel the family subscription instead.');
      }

      const familyGroupId = subscription.family_group_id;

      // Get family group details for notifications
      const familyGroup = await this.getFamilyGroup(familyGroupId);

      // Update user's subscription - downgrade to seeker
      const { error: subscriptionError } = await supabase
        .from('user_subscriptions_new')
        .update({
          tier: 'seeker',
          playbooks_limit: 0,
          devotionals_limit: 0,
          smart_journaling_enabled: false,
          playbooks_used: 0,
          devotionals_used: 0,
          family_group_id: null,
          family_role: null,
          subscription_display_name: 'siFia Seeker',
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (subscriptionError) {
        throw new Error(`Failed to update subscription: ${subscriptionError.message}`);
      }

      // Update family group member count
      const { error: groupError } = await supabase
        .from('family_subscription_groups')
        .update({
          current_members: Math.max(1, familyGroup.current_members - 1),
          updated_at: new Date().toISOString(),
        })
        .eq('id', familyGroupId);

      if (groupError) {
        Logger.error('[FamilyService] Failed to update member count', groupError as Error, {
          component: 'FamilySubscriptionService',
        });
      }

      // Notify admin that member left
      try {
        const { data: memberProfile } = await supabase
          .from('user_profiles')
          .select('full_name, email')
          .eq('id', userId)
          .single();

        const memberName = memberProfile?.full_name || memberProfile?.email || 'A member';

        await supabase.from('notifications').insert({
          user_id: familyGroup.admin_user_id,
          notification_type: 'member_left',
          title: 'Member Left Family',
          message: `${memberName} has left your family subscription "${familyGroup.group_name}".`,
          data: {
            family_group_id: familyGroupId,
            left_user_id: userId,
            left_at: new Date().toISOString(),
          },
          is_read: false,
          created_at: new Date().toISOString(),
        });
      } catch (notifError) {
        Logger.error('[FamilyService] Failed to notify admin about member leaving', notifError as Error, {
          component: 'FamilySubscriptionService',
        });
      }

      // Log activity
      try {
        await supabase.from('family_activity_log').insert({
          family_group_id: familyGroupId,
          user_id: userId,
          activity_type: 'member_left',
          activity_description: 'Member voluntarily left the family subscription',
          created_at: new Date().toISOString(),
        });
      } catch (logError) {
        Logger.error('[FamilyService] Failed to log member leave activity', logError as Error, {
          component: 'FamilySubscriptionService',
        });
      }

      Logger.info('[FamilyService] Member successfully left family group', {
        userId,
        familyGroupId,
      });

      return { success: true };
    } catch (error) {
      Logger.error('[FamilyService] Failed to leave family group', error as Error, {
        component: 'FamilySubscriptionService',
        userId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get pending invitations for a family group
   */
  static async getPendingInvitations(familyGroupId: string): Promise<FamilyInvitation[]> {
    try {
      const { data, error } = await supabase
        .from('family_invitations')
        .select('*')
        .eq('family_group_id', familyGroupId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get invitations: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      Logger.error('[FamilyService] Failed to get pending invitations', error as Error, {
      component: 'FamilySubscriptionService',
    });
      return [];
    }
  }

  /**
   * Cancel family invitation
   */
  static async cancelInvitation(invitationId: string, adminUserId: string): Promise<boolean> {
    try {
      // Get invitation to verify permissions
      const { data: invitation, error: invitationError } = await supabase
        .from('family_invitations')
        .select('*, family_subscription_groups!inner(admin_user_id)')
        .eq('id', invitationId)
        .single();

      if (invitationError || !invitation) {
        throw new Error('Invitation not found');
      }

      // Verify admin permissions
      if (invitation.family_subscription_groups.admin_user_id !== adminUserId) {
        throw new Error('Only family admin can cancel invitations');
      }

      // Update invitation status
      const { error } = await supabase
        .from('family_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) {
        throw new Error(`Failed to cancel invitation: ${error.message}`);
      }

      return true;
    } catch (error) {
      Logger.error('[FamilyService] Failed to cancel invitation', error as Error, {
      component: 'FamilySubscriptionService',
    });
      throw error;
    }
  }

  /**
   * Generate unique invitation code
   */
  private static generateInvitationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Get family usage analytics
   */
  static async getFamilyUsageAnalytics(familyGroupId: string): Promise<{
    totalPlaybooks: number;
    totalDevotionals: number;
    memberUsage: Array<{
      userId: string;
      fullName: string;
      playbooks: number;
      devotionals: number;
    }>;
  }> {
    try {
      const familyGroup = await this.getFamilyGroup(familyGroupId);

      const memberUsage = await Promise.all(
        familyGroup.members.map(async (member) => {
          const subscription = await NewSubscriptionService.getUserSubscription(member.user_id);
          return {
            userId: member.user_id,
            fullName: member.full_name || member.email || 'Unknown',
            playbooks: subscription.playbooks_used || 0,
            devotionals: subscription.devotionals_used || 0,
          };
        })
      );

      const totalPlaybooks = memberUsage.reduce((sum, member) => sum + member.playbooks, 0);
      const totalDevotionals = memberUsage.reduce((sum, member) => sum + member.devotionals, 0);

      return {
        totalPlaybooks,
        totalDevotionals,
        memberUsage,
      };
    } catch (error) {
      Logger.error('[FamilyService] Failed to get usage analytics', error as Error, {
      component: 'FamilySubscriptionService',
    });
      throw error;
    }
  }
}

export default FamilySubscriptionService;
