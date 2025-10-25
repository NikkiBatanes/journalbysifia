import { useState, useEffect, useCallback } from 'react';
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
      console.error('[useFamilySubscription] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

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

      await FamilySubscriptionService.createFamilyGroup({
        group_name: groupName,
        admin_user_id: user.id,
        platform_subscription_id: platformSubscriptionId,
      });

      // Refresh data after creation
      await loadFamilyData();
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create family group';
      setError(errorMessage);
      return false;
    }
  }, [user?.id, loadFamilyData]);

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
  }, [user?.id, familyGroup]);

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
  }, [user?.id, familyGroup, loadFamilyData]);

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
      return false;
    }
  }, [user?.id, loadFamilyData]);

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
  }, [user?.id, familyGroup]);

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
      console.error('[useFamilySubscription] Failed to get analytics:', err);
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
