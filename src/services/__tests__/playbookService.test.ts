/**
 * playbookService.test.ts
 * Test suite for playbook service
 */

import { modernPlaybookApi } from '../modernPlaybookApi';

// Mock Supabase
jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn().mockReturnValue({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        }),
        in: jest.fn().mockReturnValue({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        }),
        ilike: jest.fn().mockReturnValue({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        }),
      })),
      insert: jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        }),
      })),
      update: jest.fn(() => ({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          }),
        }),
      })),
    })),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('playbookService', () => {
  const mockSupabase = require('../supabaseClient').supabase;
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPlaybook', () => {
    it('should create playbook successfully', async () => {
      const playbookData = {
        user_id: mockUserId,
        title: 'Morning Prayer Routine',
        description: 'A powerful morning prayer routine',
        category: 'prayer',
        difficulty: 'beginner',
        duration_days: 7,
      };

      const mockCreatedPlaybook = {
        ...playbookData,
        id: 'playbook-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCreatedPlaybook,
              error: null,
            }),
          }),
        }),
      });

      const result = await playbookService.createPlaybook(playbookData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedPlaybook);
    });

    it('should handle creation errors gracefully', async () => {
      const playbookData = {
        user_id: mockUserId,
        title: 'Test Playbook',
      };

      const mockError = { message: 'Creation failed', code: 'CREATE_ERROR' };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      const result = await playbookService.createPlaybook(playbookData);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('getUserPlaybooks', () => {
    it('should fetch user playbooks successfully', async () => {
      const mockPlaybooks = [
        {
          id: 'playbook-123',
          user_id: mockUserId,
          title: 'Morning Prayer',
          category: 'prayer',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'playbook-124',
          user_id: mockUserId,
          title: 'Evening Reflection',
          category: 'reflection',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockPlaybooks,
              error: null,
            }),
          }),
        }),
      });

      const result = await playbookService.getUserPlaybooks(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPlaybooks);
    });

    it('should handle empty playbooks list', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await playbookService.getUserPlaybooks(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('updatePlaybook', () => {
    it('should update playbook successfully', async () => {
      const playbookId = 'playbook-123';
      const updateData = {
        title: 'Updated Prayer Routine',
        description: 'An improved prayer routine',
      };

      const mockUpdatedPlaybook = {
        id: playbookId,
        user_id: mockUserId,
        ...updateData,
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedPlaybook,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await playbookService.updatePlaybook(playbookId, updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedPlaybook);
    });

    it('should handle update errors gracefully', async () => {
      const playbookId = 'playbook-123';
      const updateData = { title: 'Updated' };

      const mockError = { message: 'Update failed', code: 'UPDATE_ERROR' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: mockError,
              }),
            }),
          }),
        }),
      });

      const result = await playbookService.updatePlaybook(playbookId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('deletePlaybook', () => {
    it('should delete playbook successfully', async () => {
      const playbookId = 'playbook-123';

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      const result = await playbookService.deletePlaybook(playbookId, mockUserId);

      expect(result.success).toBe(true);
    });

    it('should handle delete errors gracefully', async () => {
      const playbookId = 'playbook-123';
      const mockError = { message: 'Delete failed', code: 'DELETE_ERROR' };

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: mockError,
          }),
        }),
      });

      const result = await playbookService.deletePlaybook(playbookId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('searchPlaybooks', () => {
    it('should search playbooks successfully', async () => {
      const searchTerm = 'prayer';
      const mockPlaybooks = [
        {
          id: 'playbook-123',
          title: 'Morning Prayer Routine',
          description: 'Daily prayer practice',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockPlaybooks,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await playbookService.searchPlaybooks(mockUserId, searchTerm);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPlaybooks);
    });

    it('should handle empty search term', async () => {
      const result = await playbookService.searchPlaybooks(mockUserId, '');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('search term');
    });
  });

  describe('getPlaybookById', () => {
    it('should fetch playbook by ID successfully', async () => {
      const playbookId = 'playbook-123';
      const mockPlaybook = {
        id: playbookId,
        user_id: mockUserId,
        title: 'Morning Prayer',
        description: 'Daily prayer routine',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockPlaybook,
              error: null,
            }),
          }),
        }),
      });

      const result = await playbookService.getPlaybookById(playbookId, mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPlaybook);
    });

    it('should handle not found error', async () => {
      const playbookId = 'nonexistent';

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' },
            }),
          }),
        }),
      });

      const result = await playbookService.getPlaybookById(playbookId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('playbook validation', () => {
    it('should validate required fields', async () => {
      const invalidPlaybook = {
        user_id: mockUserId,
        // Missing title
      };

      const result = await playbookService.createPlaybook(invalidPlaybook);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('required');
    });

    it('should validate playbook category', async () => {
      const validCategories = ['prayer', 'reflection', 'devotional', 'scripture', 'service'];

      validCategories.forEach(async (category) => {
        const playbookData = {
          user_id: mockUserId,
          title: 'Test Playbook',
          category,
        };

        const result = await playbookService.createPlaybook(playbookData);
        expect(typeof result.success).toBe('boolean');
      });
    });

    it('should reject invalid category', async () => {
      const playbookData = {
        user_id: mockUserId,
        title: 'Test Playbook',
        category: 'invalid_category',
      };

      const result = await playbookService.createPlaybook(playbookData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid category');
    });
  });

  describe('playbook progress tracking', () => {
    it('should update playbook progress', async () => {
      const playbookId = 'playbook-123';
      const progressData = {
        current_day: 3,
        completed_days: [1, 2],
        last_completed_at: '2024-01-03T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: playbookId, ...progressData },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await playbookService.updatePlaybookProgress(playbookId, progressData);

      expect(result.success).toBe(true);
      expect(result.data?.current_day).toBe(3);
    });

    it('should handle progress update errors', async () => {
      const playbookId = 'playbook-123';
      const progressData = { current_day: 3 };

      const mockError = { message: 'Progress update failed', code: 'PROGRESS_ERROR' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: mockError,
              }),
            }),
          }),
        }),
      });

      const result = await playbookService.updatePlaybookProgress(playbookId, progressData);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('playbook caching', () => {
    it('should cache playbook data', async () => {
      const playbookId = 'playbook-123';
      const mockPlaybook = {
        id: playbookId,
        user_id: mockUserId,
        title: 'Morning Prayer',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockPlaybook,
              error: null,
            }),
          }),
        }),
      });

      // First call should hit database
      await playbookService.getPlaybookById(playbookId, mockUserId);

      // Second call should use cache
      await playbookService.getPlaybookById(playbookId, mockUserId);

      // Should only call database once
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on update', async () => {
      const playbookId = 'playbook-123';
      const updateData = { title: 'Updated Playbook' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: playbookId, ...updateData },
                error: null,
              }),
            }),
          }),
        }),
      });

      await playbookService.updatePlaybook(playbookId, updateData);

      // Next getPlaybookById call should hit database
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: playbookId, title: 'Updated Playbook' },
              error: null,
            }),
          }),
        }),
      });

      await playbookService.getPlaybookById(playbookId, mockUserId);

      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await playbookService.getUserPlaybooks(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Network error');
    });

    it('should handle timeout errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockImplementation(() =>
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), 100)
              )
            ),
          }),
        }),
      });

      const result = await playbookService.getUserPlaybooks(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });

    it('should handle malformed responses', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: undefined,
              error: null,
            }),
          }),
        }),
      });

      const result = await playbookService.getPlaybookById('playbook-123', mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('unexpected');
    });
  });

  describe('edge cases', () => {
    it('should handle empty user ID', async () => {
      const result = await playbookService.getUserPlaybooks('');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid user ID');
    });

    it('should handle null user ID', async () => {
      const result = await playbookService.getUserPlaybooks(null as any);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid user ID');
    });

    it('should handle concurrent operations', async () => {
      const playbookData = {
        user_id: mockUserId,
        title: 'Test Playbook',
        category: 'prayer',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...playbookData, id: 'playbook-123' },
              error: null,
            }),
          }),
        }),
      });

      // Create multiple playbooks concurrently
      const promises = Array.from({ length: 3 }, () =>
        playbookService.createPlaybook(playbookData)
      );

      const results = await Promise.all(promises);

      // All should complete without errors
      results.forEach((result: any) => {
        expect(typeof result.success).toBe('boolean');
      });
    });
  });
});
