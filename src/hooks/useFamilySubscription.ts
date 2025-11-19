import { useState, useEffect, useCallback } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { FamilySubscriptionService, FamilyGroup, FamilyMember, FamilyInvitation } from '../services/FamilySubscriptionService';

export interface UseFamilySubscriptionResult {
  // State
  familyGroup: (FamilyGroup & { members: FamilyMember[] }) | null;
  pendingInvitations: FamilyInvitation[];
  loading: boolean;
  error: string | null;

  // Actions
  createFamilyGroup: (groupName: string, platformSubscriptionId: string) => Promise<boolean>;
  inviteMember: (email: string) => Promise<boolean>;
  removeMember: (userId: string) => Promise<boolean>;
  leaveFamilyGroup: () => Promise<boolean>;
  acceptInvitation: (invitationCode: string) => Promise<boolean>;
  cancelInvitation: (invitationId: string) => Promise<boolean>;
  refreshFamilyData: () => Promise<void>;

  // Utilities
  isAdmin: boolean;
  canInviteMembers: boolean;
  getFamilyUsageAnalytics: () => Promise<any>;
}

/**
 * Hook for managing family subscription features
 */
export function useFamilySubscription(): UseFamilySubscriptionResult {
  const { user } = useAuth();
  const [familyGroup, setFamilyGroup] = useState<(FamilyGroup & { members: FamilyMember[] }) | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<FamilyInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load family group data
   */
  const loadFamilyData = useCallback(async () => {
    if (!user?.id) {
      setFamilyGroup(null);
      setPendingInvitations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get user's family group
      const group = await FamilySubscriptionService.getUserFamilyGroup(user.id);
      setFamilyGroup(group);

      // If user is admin, get pending invitations
      if (group && group.admin_user_id === user.id) {
        const invitations = await FamilySubscriptionService.getPendingInvitations(group.id);
        setPendingInvitations(invitations);
      } else {
        setPendingInvitations([]);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load family data';
      setError(errorMessage);
      Logger.error('[useFamilySubscription] Load error', err as Error, { component: 'useFamilySubscription' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Create a new family group
   */
  const createFamilyGroup = useCallback(async (
    groupName: string,
    platformSubscriptionId: string
  ): Promise<boolean> => {
    if (!user?.id) {
      throw new Error('User must be authenticated');
    }

    try {
      setError(null);

      const group = await FamilySubscriptionService.createFamilyGroup({
        group_name: groupName,
        admin_user_id: user.id,
        platform_subscription_id: platformSubscriptionId,
      });

      // Optimistically update local state so UI reflects new family immediately
      const adminMember: FamilyMember = {
        id: user.id,
        user_id: user.id,
        family_group_id: group.id,
        role: 'admin',
        joined_at: (group as any)?.created_at || new Date().toISOString(),
        status: 'active',
        email: (user as any)?.email,
        full_name: (user as any)?.user_metadata?.full_name,
        avatar_url: (user as any)?.user_metadata?.avatar_url,
      };

      setFamilyGroup({
        ...(group as any),
        members: [adminMember],
      });
      setPendingInvitations([]);

      // NOTE: We intentionally do NOT call loadFamilyData() immediately here.
      // Supabase read replicas can briefly lag writes, which was causing
      // getUserFamilyGroup() to return null right after creation, hiding
      // "Manage Family" until the app was reloaded. We now trust the
      // freshly returned `group` for immediate UI, and any manual refresh
      // (pull-to-refresh or subsequent loads) will sync from the server.
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create family group';
      setError(errorMessage);
      return false;
    }
  }, [user]);

  /**
   * Invite a member to the family group
   */
  const inviteMember = useCallback(async (email: string): Promise<boolean> => {
    if (!user?.id || !familyGroup) {
      throw new Error('User must be authenticated and have a family group');
    }

    try {
      setError(null);

      await FamilySubscriptionService.inviteMember({
        family_group_id: familyGroup.id,
        invited_email: email,
        invited_by_user_id: user.id,
      });

      // Refresh invitations after sending
      const invitations = await FamilySubscriptionService.getPendingInvitations(familyGroup.id);
      setPendingInvitations(invitations);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to invite member';
      setError(errorMessage);
      return false;
    }
  }, [user, familyGroup]);

  /**
   * Remove a member from the family group
   */
  const removeMember = useCallback(async (userId: string): Promise<boolean> => {
    if (!user?.id || !familyGroup) {
      throw new Error('User must be authenticated and have a family group');
    }

    try {
      setError(null);

      await FamilySubscriptionService.removeMember(familyGroup.id, userId, user.id);

      // Refresh family data after removal
      await loadFamilyData();
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
      setError(errorMessage);
      return false;
    }
  }, [user, familyGroup, loadFamilyData]);

  /**
   * Accept a family invitation
   */
  const acceptInvitation = useCallback(async (invitationCode: string): Promise<boolean> => {
    if (!user?.id) {
      throw new Error('User must be authenticated');
    }

    try {
      setError(null);

      await FamilySubscriptionService.acceptInvitation(invitationCode, user.id);

      // Refresh data after accepting invitation
      await loadFamilyData();
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to accept invitation';
      setError(errorMessage);
      Logger.error('Accept invitation failed in hook', err as Error, {
        component: 'useFamilySubscription',
        invitationCode,
        userId: user.id,
      });
      throw err; // Re-throw so NotificationsScreen can show the actual error
    }
  }, [user, loadFamilyData]);

  /**
   * Leave family group (member self-service)
   */
  const leaveFamilyGroup = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      throw new Error('User must be authenticated');
    }

    try {
      setError(null);

      const result = await FamilySubscriptionService.leaveFamilyGroup(user.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to leave family group');
      }

      // Refresh data after leaving
      await loadFamilyData();
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to leave family group';
      setError(errorMessage);
      return false;
    }
  }, [user, loadFamilyData]);

  /**
   * Cancel a pending invitation
   */
  const cancelInvitation = useCallback(async (invitationId: string): Promise<boolean> => {
    if (!user?.id) {
      throw new Error('User must be authenticated');
    }

    try {
      setError(null);

      await FamilySubscriptionService.cancelInvitation(invitationId, user.id);

      // Refresh invitations after cancellation
      if (familyGroup) {
        const invitations = await FamilySubscriptionService.getPendingInvitations(familyGroup.id);
        setPendingInvitations(invitations);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel invitation';
      setError(errorMessage);
      return false;
    }
  }, [user, familyGroup]);

  /**
   * Refresh family data
   */
  const refreshFamilyData = useCallback(async (): Promise<void> => {
    await loadFamilyData();
  }, [loadFamilyData]);

  /**
   * Get family usage analytics
   */
  const getFamilyUsageAnalytics = useCallback(async () => {
    if (!familyGroup) {
      throw new Error('No family group found');
    }

    try {
      return await FamilySubscriptionService.getFamilyUsageAnalytics(familyGroup.id);
    } catch (err) {
      Logger.error('[useFamilySubscription] Failed to get analytics', err as Error, { component: 'useFamilySubscription' });
      throw err;
    }
  }, [familyGroup]);

  // Computed properties
  const isAdmin = familyGroup?.admin_user_id === user?.id;
  const canInviteMembers = Boolean(isAdmin && familyGroup && (familyGroup.current_members || 0) < (familyGroup.max_members || 0));

  // Load data on mount and when user changes
  useEffect(() => {
    loadFamilyData();
  }, [loadFamilyData]);

  return {
    // State
    familyGroup,
    pendingInvitations,
    loading,
    error,

    // Actions
    createFamilyGroup,
    inviteMember,
    removeMember,
    leaveFamilyGroup,
    acceptInvitation,
    cancelInvitation,
    refreshFamilyData,

    // Utilities
    isAdmin,
    canInviteMembers,
    getFamilyUsageAnalytics,
  };
}

export default useFamilySubscription;
