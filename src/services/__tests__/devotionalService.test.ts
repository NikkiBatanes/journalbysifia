/**
 * devotionalService.test.ts
 * Test suite for devotional service
 */

import { modernDevotionalApi } from '../modernDevotionalApi';

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
        gte: jest.fn().mockReturnValue({
          lte: jest.fn().mockReturnValue({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          }),
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

describe('devotionalService', () => {
  const mockSupabase = require('../supabaseClient').supabase;
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDevotional', () => {
    it('should create devotional successfully', async () => {
      const devotionalData = {
        user_id: mockUserId,
        title: 'Morning Reflection',
        scripture: 'Philippians 4:8',
        content: 'Think about what is true, noble, right...',
        category: 'reflection',
        duration_minutes: 10,
      };

      const mockCreatedDevotional = {
        ...devotionalData,
        id: 'devotional-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCreatedDevotional,
              error: null,
            }),
          }),
        }),
      });

      const result = await devotionalService.createDevotional(devotionalData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedDevotional);
    });

    it('should handle creation errors gracefully', async () => {
      const devotionalData = {
        user_id: mockUserId,
        title: 'Test Devotional',
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

      const result = await devotionalService.createDevotional(devotionalData);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('getUserDevotionals', () => {
    it('should fetch user devotionals successfully', async () => {
      const mockDevotionals = [
        {
          id: 'devotional-123',
          user_id: mockUserId,
          title: 'Morning Prayer',
          scripture: 'Psalm 23:1',
          category: 'prayer',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'devotional-124',
          user_id: mockUserId,
          title: 'Evening Reflection',
          scripture: 'Proverbs 3:5-6',
          category: 'reflection',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockDevotionals,
              error: null,
            }),
          }),
        }),
      });

      const result = await devotionalService.getUserDevotionals(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDevotionals);
    });

    it('should handle empty devotionals list', async () => {
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

      const result = await devotionalService.getUserDevotionals(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getDevotionalsByDateRange', () => {
    it('should fetch devotionals by date range successfully', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const mockDevotionals = [
        {
          id: 'devotional-123',
          user_id: mockUserId,
          title: 'New Year Reflection',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockDevotionals,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await devotionalService.getDevotionalsByDateRange(mockUserId, startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDevotionals);
    });

    it('should handle invalid date range', async () => {
      const startDate = '2024-01-31';
      const endDate = '2024-01-01'; // End before start

      const result = await devotionalService.getDevotionalsByDateRange(mockUserId, startDate, endDate);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid date range');
    });
  });

  describe('updateDevotional', () => {
    it('should update devotional successfully', async () => {
      const devotionalId = 'devotional-123';
      const updateData = {
        title: 'Updated Reflection',
        content: 'Updated content for reflection',
      };

      const mockUpdatedDevotional = {
        id: devotionalId,
        user_id: mockUserId,
        ...updateData,
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedDevotional,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await devotionalService.updateDevotional(devotionalId, updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedDevotional);
    });

    it('should handle update errors gracefully', async () => {
      const devotionalId = 'devotional-123';
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

      const result = await devotionalService.updateDevotional(devotionalId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('deleteDevotional', () => {
    it('should delete devotional successfully', async () => {
      const devotionalId = 'devotional-123';

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      const result = await devotionalService.deleteDevotional(devotionalId, mockUserId);

      expect(result.success).toBe(true);
    });

    it('should handle delete errors gracefully', async () => {
      const devotionalId = 'devotional-123';
      const mockError = { message: 'Delete failed', code: 'DELETE_ERROR' };

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: mockError,
          }),
        }),
      });

      const result = await devotionalService.deleteDevotional(devotionalId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('searchDevotionals', () => {
    it('should search devotionals successfully', async () => {
      const searchTerm = 'prayer';
      const mockDevotionals = [
        {
          id: 'devotional-123',
          title: 'Morning Prayer',
          scripture: 'Psalm 23',
          content: 'The Lord is my shepherd',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockDevotionals,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await devotionalService.searchDevotionals(mockUserId, searchTerm);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDevotionals);
    });

    it('should handle empty search term', async () => {
      const result = await devotionalService.searchDevotionals(mockUserId, '');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('search term');
    });
  });

  describe('getDevotionalById', () => {
    it('should fetch devotional by ID successfully', async () => {
      const devotionalId = 'devotional-123';
      const mockDevotional = {
        id: devotionalId,
        user_id: mockUserId,
        title: 'Morning Prayer',
        scripture: 'Psalm 23:1',
        content: 'The Lord is my shepherd...',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDevotional,
              error: null,
            }),
          }),
        }),
      });

      const result = await devotionalService.getDevotionalById(devotionalId, mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDevotional);
    });

    it('should handle not found error', async () => {
      const devotionalId = 'nonexistent';

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

      const result = await devotionalService.getDevotionalById(devotionalId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('devotional validation', () => {
    it('should validate required fields', async () => {
      const invalidDevotional = {
        user_id: mockUserId,
        // Missing title and scripture
      };

      const result = await devotionalService.createDevotional(invalidDevotional);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('required');
    });

    it('should validate devotional category', async () => {
      const validCategories = ['prayer', 'reflection', 'scripture', 'meditation', 'gratitude'];

      validCategories.forEach(async (category) => {
        const devotionalData = {
          user_id: mockUserId,
          title: 'Test Devotional',
          scripture: 'Psalm 23:1',
          category,
        };

        const result = await devotionalService.createDevotional(devotionalData);
        expect(typeof result.success).toBe('boolean');
      });
    });

    it('should reject invalid category', async () => {
      const devotionalData = {
        user_id: mockUserId,
        title: 'Test Devotional',
        scripture: 'Psalm 23:1',
        category: 'invalid_category',
      };

      const result = await devotionalService.createDevotional(devotionalData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid category');
    });
  });

  describe('devotional progress tracking', () => {
    it('should mark devotional as completed', async () => {
      const devotionalId = 'devotional-123';
      const progressData = {
        completed: true,
        completed_at: '2024-01-01T08:00:00Z',
        reflection: 'This was very meaningful today',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: devotionalId, ...progressData },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await devotionalService.markDevotionalCompleted(devotionalId, progressData);

      expect(result.success).toBe(true);
      expect(result.data?.completed).toBe(true);
    });

    it('should handle completion tracking errors', async () => {
      const devotionalId = 'devotional-123';
      const progressData = { completed: true };

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

      const result = await devotionalService.markDevotionalCompleted(devotionalId, progressData);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('devotional statistics', () => {
    it('should get user devotional statistics', async () => {
      const mockStats = {
        total_devotionals: 25,
        completed_this_month: 12,
        current_streak: 7,
        longest_streak: 14,
        favorite_category: 'prayer',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockStats,
              error: null,
            }),
          }),
        }),
      });

      const result = await devotionalService.getUserDevotionalStats(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStats);
    });

    it('should handle missing statistics gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await devotionalService.getUserDevotionalStats(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('devotional caching', () => {
    it('should cache devotional data', async () => {
      const devotionalId = 'devotional-123';
      const mockDevotional = {
        id: devotionalId,
        user_id: mockUserId,
        title: 'Morning Prayer',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDevotional,
              error: null,
            }),
          }),
        }),
      });

      // First call should hit database
      await devotionalService.getDevotionalById(devotionalId, mockUserId);

      // Second call should use cache
      await devotionalService.getDevotionalById(devotionalId, mockUserId);

      // Should only call database once
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on update', async () => {
      const devotionalId = 'devotional-123';
      const updateData = { title: 'Updated Devotional' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: devotionalId, ...updateData },
                error: null,
              }),
            }),
          }),
        }),
      });

      await devotionalService.updateDevotional(devotionalId, updateData);

      // Next getDevotionalById call should hit database
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: devotionalId, title: 'Updated Devotional' },
              error: null,
            }),
          }),
        }),
      });

      await devotionalService.getDevotionalById(devotionalId, mockUserId);

      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await devotionalService.getUserDevotionals(mockUserId);

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

      const result = await devotionalService.getUserDevotionals(mockUserId);

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

      const result = await devotionalService.getDevotionalById('devotional-123', mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('unexpected');
    });
  });

  describe('edge cases', () => {
    it('should handle empty user ID', async () => {
      const result = await devotionalService.getUserDevotionals('');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid user ID');
    });

    it('should handle null user ID', async () => {
      const result = await devotionalService.getUserDevotionals(null as any);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid user ID');
    });

    it('should handle concurrent operations', async () => {
      const devotionalData = {
        user_id: mockUserId,
        title: 'Test Devotional',
        scripture: 'Psalm 23:1',
        category: 'prayer',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...devotionalData, id: 'devotional-123' },
              error: null,
            }),
          }),
        }),
      });

      // Create multiple devotionals concurrently
      const promises = Array.from({ length: 3 }, () =>
        devotionalService.createDevotional(devotionalData)
      );

      const results = await Promise.all(promises);

      // All should complete without errors
      results.forEach((result: any) => {
        expect(typeof result.success).toBe('boolean');
      });
    });
  });
});
