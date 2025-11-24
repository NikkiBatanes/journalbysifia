/**
 * timeBlockApi.test.ts
 * Test suite for time block API service (core business logic)
 */

import {
  createTimeBlock,
  getTimeBlock,
  updateTimeBlock,
  deleteTimeBlock,
  getUserTimeBlocks,
  getTimeBlocksByDate,
  searchTimeBlocks,
} from '../timeBlockApi';
import { supabase } from '../supabaseClient';

// Mock Supabase
jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        ilike: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

describe('timeBlockApi', () => {
  const mockSupabase = supabase as any;
  const mockUserId = 'user-123';
  const mockTimeBlock = {
    id: 'block-123',
    user_id: mockUserId,
    title: 'Morning Prayer',
    description: 'Daily morning prayer time',
    start_time: '2024-01-01T08:00:00Z',
    end_time: '2024-01-01T08:30:00Z',
    category: 'prayer',
    priority: 'high',
    completed: false,
    metadata: { location: 'home' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTimeBlock', () => {
    it('should create time block successfully', async () => {
      const newBlock = {
        user_id: mockUserId,
        title: 'Morning Prayer',
        start_time: '2024-01-01T08:00:00Z',
        end_time: '2024-01-01T08:30:00Z',
        category: 'prayer',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...mockTimeBlock, ...newBlock },
              error: null,
            }),
          }),
        }),
      });

      const result = await createTimeBlock(newBlock);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...mockTimeBlock, ...newBlock });
      expect(mockSupabase.from).toHaveBeenCalledWith('time_blocks');
    });

    it('should handle creation errors', async () => {
      const newBlock = {
        user_id: mockUserId,
        title: 'Morning Prayer',
        start_time: '2024-01-01T08:00:00Z',
        end_time: '2024-01-01T08:30:00Z',
      };

      const mockError = { message: 'Insert failed', code: 'INSERT_ERROR' };

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

      const result = await createTimeBlock(newBlock);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });

    it('should validate required fields', async () => {
      const invalidBlock = {
        user_id: mockUserId,
        // Missing required fields
      };

      const result = await createTimeBlock(invalidBlock);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('required');
    });
  });

  describe('getTimeBlock', () => {
    it('should fetch time block successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTimeBlock,
              error: null,
            }),
          }),
        }),
      });

      const result = await getTimeBlock(mockTimeBlock.id, mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTimeBlock);
    });

    it('should handle not found error', async () => {
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

      const result = await getTimeBlock('nonexistent-id', mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });

    it('should handle fetch errors', async () => {
      const mockError = { message: 'Fetch failed', code: 'FETCH_ERROR' };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      const result = await getTimeBlock(mockTimeBlock.id, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('updateTimeBlock', () => {
    it('should update time block successfully', async () => {
      const updateData = {
        title: 'Updated Prayer Time',
        completed: true,
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...mockTimeBlock, ...updateData },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await updateTimeBlock(mockTimeBlock.id, updateData, mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...mockTimeBlock, ...updateData });
    });

    it('should handle update errors', async () => {
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

      const result = await updateTimeBlock(mockTimeBlock.id, updateData, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });

    it('should handle not found on update', async () => {
      const updateData = { title: 'Updated' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows found' },
              }),
            }),
          }),
        }),
      });

      const result = await updateTimeBlock('nonexistent-id', updateData, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('deleteTimeBlock', () => {
    it('should delete time block successfully', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      const result = await deleteTimeBlock(mockTimeBlock.id, mockUserId);

      expect(result.success).toBe(true);
    });

    it('should handle delete errors', async () => {
      const mockError = { message: 'Delete failed', code: 'DELETE_ERROR' };

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: mockError,
          }),
        }),
      });

      const result = await deleteTimeBlock(mockTimeBlock.id, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('getUserTimeBlocks', () => {
    it('should fetch user time blocks successfully', async () => {
      const mockBlocks = [mockTimeBlock];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockBlocks,
              error: null,
            }),
          }),
        }),
      });

      const result = await getUserTimeBlocks(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBlocks);
    });

    it('should handle empty results', async () => {
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

      const result = await getUserTimeBlocks(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle fetch errors', async () => {
      const mockError = { message: 'Fetch failed', code: 'FETCH_ERROR' };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      const result = await getUserTimeBlocks(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('getTimeBlocksByDate', () => {
    it('should fetch time blocks by date range successfully', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const mockBlocks = [mockTimeBlock];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockBlocks,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getTimeBlocksByDate(mockUserId, startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBlocks);
    });

    it('should handle invalid date range', async () => {
      const startDate = '2024-01-31';
      const endDate = '2024-01-01'; // End before start

      const result = await getTimeBlocksByDate(mockUserId, startDate, endDate);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid date range');
    });
  });

  describe('searchTimeBlocks', () => {
    it('should search time blocks successfully', async () => {
      const searchTerm = 'prayer';
      const mockBlocks = [mockTimeBlock];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockBlocks,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await searchTimeBlocks(mockUserId, searchTerm);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBlocks);
    });

    it('should handle empty search term', async () => {
      const result = await searchTimeBlocks(mockUserId, '');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('search term');
    });

    it('should handle search errors', async () => {
      const searchTerm = 'prayer';
      const mockError = { message: 'Search failed', code: 'SEARCH_ERROR' };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: null,
                error: mockError,
              }),
            }),
          }),
        }),
      });

      const result = await searchTimeBlocks(mockUserId, searchTerm);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('validation', () => {
    it('should validate time block data', async () => {
      const invalidBlock = {
        user_id: mockUserId,
        title: '', // Empty title
        start_time: '2024-01-01T08:00:00Z',
        end_time: '2024-01-01T07:00:00Z', // End before start
      };

      const result = await createTimeBlock(invalidBlock);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('validation');
    });

    it('should validate date format', async () => {
      const invalidBlock = {
        user_id: mockUserId,
        title: 'Test Block',
        start_time: 'invalid-date',
        end_time: '2024-01-01T08:00:00Z',
      };

      const result = await createTimeBlock(invalidBlock);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('date format');
    });

    it('should validate category', async () => {
      const invalidBlock = {
        user_id: mockUserId,
        title: 'Test Block',
        start_time: '2024-01-01T08:00:00Z',
        end_time: '2024-01-01T09:00:00Z',
        category: 'invalid-category',
      };

      const result = await createTimeBlock(invalidBlock);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('category');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      const newBlock = {
        user_id: mockUserId,
        title: 'Test Block',
        start_time: '2024-01-01T08:00:00Z',
        end_time: '2024-01-01T09:00:00Z',
      };

      mockSupabase.from.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await createTimeBlock(newBlock);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Network error');
    });

    it('should handle timeout errors', async () => {
      const newBlock = {
        user_id: mockUserId,
        title: 'Test Block',
        start_time: '2024-01-01T08:00:00Z',
        end_time: '2024-01-01T09:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockImplementation(() =>
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), 100)
              )
            ),
          }),
        }),
      });

      const result = await createTimeBlock(newBlock);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent operations', async () => {
      const newBlock = {
        user_id: mockUserId,
        title: 'Test Block',
        start_time: '2024-01-01T08:00:00Z',
        end_time: '2024-01-01T09:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...mockTimeBlock, ...newBlock },
              error: null,
            }),
          }),
        }),
      });

      // Create multiple blocks concurrently
      const promises = Array.from({ length: 3 }, () => createTimeBlock(newBlock));

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
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

      const result = await getTimeBlock(mockTimeBlock.id, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('unexpected');
    });
  });
});
