import { supabase } from '../config/supabaseClient';
import { NewSubscriptionService } from './NewSubscriptionService';

export interface FamilyGroup {
  id: string;
  admin_user_id: string;
  group_name: string;
  max_members: number;
  current_members: number;
  platform_subscription_id: string;
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
  platform_subscription_id: string;
  max_members?: number;
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
          max_members: options.max_members || 6,
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

      console.log('[FamilyService] Family group created successfully:', data.id);
      return data;
    } catch (error) {
      console.error('[FamilyService] Failed to create family group:', error);
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
        console.error('[FamilyService] Failed to get members:', membersError);
      }

      const members: FamilyMember[] = (membersData || []).map(member => ({
        id: member.user_id,
        user_id: member.user_id,
        family_group_id: groupId,
        role: member.family_role as 'admin' | 'member',
        joined_at: member.created_at,
        status: 'active' as const,
        email: member.user_profiles?.email,
        full_name: member.user_profiles?.full_name,
        avatar_url: member.user_profiles?.avatar_url,
      }));

      return {
        ...groupData,
        members,
      };
    } catch (error) {
      console.error('[FamilyService] Failed to get family group:', error);
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
      console.error('[FamilyService] Failed to get user family group:', error);
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
      
      if (familyGroup.current_members >= familyGroup.max_members) {
        throw new Error('Family group is at maximum capacity');
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

      console.log('[FamilyService] Invitation created:', data.id);
      return data;
    } catch (error) {
      console.error('[FamilyService] Failed to invite member:', error);
      throw error;
    }
  }

  /**
   * Accept family invitation
   */
  static async acceptInvitation(invitationCode: string, userId: string): Promise<boolean> {
    try {
      // Get invitation details
      const { data: invitation, error: invitationError } = await supabase
        .from('family_invitations')
        .select('*')
        .eq('invitation_code', invitationCode)
        .eq('status', 'pending')
        .single();

      if (invitationError || !invitation) {
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

      // Update user's subscription to join family
      const { error: subscriptionError } = await supabase
        .from('user_subscriptions_new')
        .update({
          tier: 'family',
          family_group_id: invitation.family_group_id,
          family_role: 'member',
          status: 'active',
        })
        .eq('user_id', userId);

      if (subscriptionError) {
        throw new Error(`Failed to update user subscription: ${subscriptionError.message}`);
      }

      // Update family group member count
      const { error: groupError } = await supabase
        .from('family_subscription_groups')
        .update({
          current_members: familyGroup.current_members + 1,
        })
        .eq('id', invitation.family_group_id);

      if (groupError) {
        console.error('[FamilyService] Failed to update member count:', groupError);
      }

      // Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('family_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

      if (updateError) {
        console.error('[FamilyService] Failed to update invitation status:', updateError);
      }

      console.log('[FamilyService] Invitation accepted successfully');
      return true;
    } catch (error) {
      console.error('[FamilyService] Failed to accept invitation:', error);
      throw error;
    }
  }

  /**
   * Remove member from family group
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
          family_group_id: null,
          family_role: 'member',
          status: 'active',
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
        })
        .eq('id', familyGroupId);

      if (groupError) {
        console.error('[FamilyService] Failed to update member count:', groupError);
      }

      console.log('[FamilyService] Member removed successfully');
      return true;
    } catch (error) {
      console.error('[FamilyService] Failed to remove member:', error);
      throw error;
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
      console.error('[FamilyService] Failed to get pending invitations:', error);
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

      console.log('[FamilyService] Invitation cancelled successfully');
      return true;
    } catch (error) {
      console.error('[FamilyService] Failed to cancel invitation:', error);
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
      console.error('[FamilyService] Failed to get usage analytics:', error);
      throw error;
    }
  }
}

export default FamilySubscriptionService;
