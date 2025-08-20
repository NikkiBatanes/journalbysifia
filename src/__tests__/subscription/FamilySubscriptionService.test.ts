import { FamilySubscriptionService } from '../../services/FamilySubscriptionService';
import { NewSubscriptionService } from '../../services/NewSubscriptionService';
import { supabase } from '../../config/supabaseClient';

// Mock dependencies
jest.mock('../../config/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../services/NewSubscriptionService');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockNewSubscriptionService = NewSubscriptionService as jest.Mocked<typeof NewSubscriptionService>;

describe('FamilySubscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createFamilyGroup', () => {
    it('should create family group successfully', async () => {
      const mockFamilyGroup = {
        id: 'family-123',
        admin_user_id: 'user-123',
        group_name: 'Smith Family',
        max_members: 6,
        current_members: 1,
        platform_subscription_id: 'sub-123',
        status: 'active',
      };

      // Mock family group creation
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockFamilyGroup,
              error: null,
            }),
          }),
        }),
      } as any);

      // Mock user subscription update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      const result = await FamilySubscriptionService.createFamilyGroup({
        group_name: 'Smith Family',
        admin_user_id: 'user-123',
        platform_subscription_id: 'sub-123',
      });

      expect(result).toEqual(mockFamilyGroup);
    });
  });

  describe('inviteMember', () => {
    it('should create invitation successfully', async () => {
      const mockFamilyGroup = {
        id: 'family-123',
        current_members: 2,
        max_members: 6,
        members: [
          { email: 'admin@example.com', user_id: 'user-123' },
        ],
      };

      const mockInvitation = {
        id: 'invite-123',
        family_group_id: 'family-123',
        invited_email: 'member@example.com',
        invitation_code: 'ABC12345',
        status: 'pending',
      };

      // Mock getFamilyGroup
      jest.spyOn(FamilySubscriptionService, 'getFamilyGroup').mockResolvedValue(mockFamilyGroup as any);

      // Mock check for existing invitation
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' },
                }),
              }),
            }),
          }),
        }),
      } as any);

      // Mock invitation creation
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await FamilySubscriptionService.inviteMember({
        family_group_id: 'family-123',
        invited_email: 'member@example.com',
        invited_by_user_id: 'user-123',
      });

      expect(result).toEqual(mockInvitation);
    });

    it('should reject invitation when family is at capacity', async () => {
      const mockFamilyGroup = {
        id: 'family-123',
        current_members: 6,
        max_members: 6,
        members: [],
      };

      jest.spyOn(FamilySubscriptionService, 'getFamilyGroup').mockResolvedValue(mockFamilyGroup as any);

      await expect(
        FamilySubscriptionService.inviteMember({
          family_group_id: 'family-123',
          invited_email: 'member@example.com',
          invited_by_user_id: 'user-123',
        })
      ).rejects.toThrow('Family group is at maximum capacity');
    });

    it('should reject invitation for existing member', async () => {
      const mockFamilyGroup = {
        id: 'family-123',
        current_members: 2,
        max_members: 6,
        members: [
          { email: 'member@example.com', user_id: 'user-456' },
        ],
      };

      jest.spyOn(FamilySubscriptionService, 'getFamilyGroup').mockResolvedValue(mockFamilyGroup as any);

      await expect(
        FamilySubscriptionService.inviteMember({
          family_group_id: 'family-123',
          invited_email: 'member@example.com',
          invited_by_user_id: 'user-123',
        })
      ).rejects.toThrow('User is already a member of this family group');
    });
  });

  describe('acceptInvitation', () => {
    it('should accept invitation successfully', async () => {
      const mockInvitation = {
        id: 'invite-123',
        family_group_id: 'family-123',
        invited_email: 'member@example.com',
        invitation_code: 'ABC12345',
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
      };

      const mockFamilyGroup = {
        id: 'family-123',
        current_members: 2,
        max_members: 6,
      };

      // Mock get invitation
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockInvitation,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      // Mock getFamilyGroup
      jest.spyOn(FamilySubscriptionService, 'getFamilyGroup').mockResolvedValue(mockFamilyGroup as any);

      // Mock user subscription update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      // Mock family group member count update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      // Mock invitation status update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      const result = await FamilySubscriptionService.acceptInvitation('ABC12345', 'user-456');

      expect(result).toBe(true);
    });

    it('should reject expired invitation', async () => {
      const mockInvitation = {
        id: 'invite-123',
        family_group_id: 'family-123',
        invitation_code: 'ABC12345',
        status: 'pending',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      };

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockInvitation,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      // Mock invitation expiry update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      await expect(
        FamilySubscriptionService.acceptInvitation('ABC12345', 'user-456')
      ).rejects.toThrow('Invitation has expired');
    });
  });

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      const mockFamilyGroup = {
        id: 'family-123',
        admin_user_id: 'user-123',
        current_members: 3,
      };

      jest.spyOn(FamilySubscriptionService, 'getFamilyGroup').mockResolvedValue(mockFamilyGroup as any);

      // Mock user subscription update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      // Mock family group member count update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      const result = await FamilySubscriptionService.removeMember('family-123', 'user-456', 'user-123');

      expect(result).toBe(true);
    });

    it('should reject removal by non-admin', async () => {
      const mockFamilyGroup = {
        id: 'family-123',
        admin_user_id: 'user-123',
        current_members: 3,
      };

      jest.spyOn(FamilySubscriptionService, 'getFamilyGroup').mockResolvedValue(mockFamilyGroup as any);

      await expect(
        FamilySubscriptionService.removeMember('family-123', 'user-456', 'user-789')
      ).rejects.toThrow('Only family admin can remove members');
    });

    it('should reject admin self-removal', async () => {
      const mockFamilyGroup = {
        id: 'family-123',
        admin_user_id: 'user-123',
        current_members: 3,
      };

      jest.spyOn(FamilySubscriptionService, 'getFamilyGroup').mockResolvedValue(mockFamilyGroup as any);

      await expect(
        FamilySubscriptionService.removeMember('family-123', 'user-123', 'user-123')
      ).rejects.toThrow('Admin cannot be removed from family group');
    });
  });

  describe('getFamilyUsageAnalytics', () => {
    it('should return usage analytics', async () => {
      const mockFamilyGroup = {
        id: 'family-123',
        members: [
          { user_id: 'user-123', full_name: 'John Smith', email: 'john@example.com' },
          { user_id: 'user-456', full_name: 'Jane Smith', email: 'jane@example.com' },
        ],
      };

      const mockSubscriptions = [
        { playbooks_used: 5, devotionals_used: 3 },
        { playbooks_used: 8, devotionals_used: 6 },
      ];

      jest.spyOn(FamilySubscriptionService, 'getFamilyGroup').mockResolvedValue(mockFamilyGroup as any);
      
      mockNewSubscriptionService.getUserSubscription
        .mockResolvedValueOnce(mockSubscriptions[0] as any)
        .mockResolvedValueOnce(mockSubscriptions[1] as any);

      const result = await FamilySubscriptionService.getFamilyUsageAnalytics('family-123');

      expect(result).toEqual({
        totalPlaybooks: 13,
        totalDevotionals: 9,
        memberUsage: [
          {
            userId: 'user-123',
            fullName: 'John Smith',
            playbooks: 5,
            devotionals: 3,
          },
          {
            userId: 'user-456',
            fullName: 'Jane Smith',
            playbooks: 8,
            devotionals: 6,
          },
        ],
      });
    });
  });
});
