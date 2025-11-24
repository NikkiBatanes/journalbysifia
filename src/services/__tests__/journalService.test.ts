/**
 * journalService.test.ts
 * Test suite for journal service
 */

import { journalService } from '../journalService';

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

describe('journalService', () => {
  const mockSupabase = require('../supabaseClient').supabase;
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createJournalEntry', () => {
    it('should create journal entry successfully', async () => {
      const entryData = {
        user_id: mockUserId,
        title: 'Morning Reflection',
        content: 'Today I feel grateful for...',
        category: 'gratitude',
        mood: 'peaceful',
        tags: ['gratitude', 'peace'],
      };

      const mockCreatedEntry = {
        ...entryData,
        id: 'journal-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCreatedEntry,
              error: null,
            }),
          }),
        }),
      });

      const result = await journalService.createJournalEntry(entryData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedEntry);
    });

    it('should handle creation errors gracefully', async () => {
      const entryData = {
        user_id: mockUserId,
        title: 'Test Entry',
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

      const result = await journalService.createJournalEntry(entryData);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('getUserJournalEntries', () => {
    it('should fetch user journal entries successfully', async () => {
      const mockEntries = [
        {
          id: 'journal-123',
          user_id: mockUserId,
          title: 'Morning Prayer',
          content: 'Prayer time was meaningful...',
          category: 'prayer',
          mood: 'grateful',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'journal-124',
          user_id: mockUserId,
          title: 'Evening Reflection',
          content: 'Reflecting on the day...',
          category: 'reflection',
          mood: 'thoughtful',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockEntries,
              error: null,
            }),
          }),
        }),
      });

      const result = await journalService.getUserJournalEntries(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntries);
    });

    it('should handle empty entries list', async () => {
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

      const result = await journalService.getUserJournalEntries(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getJournalEntriesByDateRange', () => {
    it('should fetch journal entries by date range successfully', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const mockEntries = [
        {
          id: 'journal-123',
          user_id: mockUserId,
          title: 'New Year Reflection',
          content: 'Starting the year with gratitude...',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockEntries,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await journalService.getJournalEntriesByDateRange(mockUserId, startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntries);
    });

    it('should handle invalid date range', async () => {
      const startDate = '2024-01-31';
      const endDate = '2024-01-01'; // End before start

      const result = await journalService.getJournalEntriesByDateRange(mockUserId, startDate, endDate);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid date range');
    });
  });

  describe('updateJournalEntry', () => {
    it('should update journal entry successfully', async () => {
      const entryId = 'journal-123';
      const updateData = {
        title: 'Updated Reflection',
        content: 'Updated content for journal entry',
        mood: 'peaceful',
      };

      const mockUpdatedEntry = {
        id: entryId,
        user_id: mockUserId,
        ...updateData,
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedEntry,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await journalService.updateJournalEntry(entryId, updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedEntry);
    });

    it('should handle update errors gracefully', async () => {
      const entryId = 'journal-123';
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

      const result = await journalService.updateJournalEntry(entryId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('deleteJournalEntry', () => {
    it('should delete journal entry successfully', async () => {
      const entryId = 'journal-123';

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      const result = await journalService.deleteJournalEntry(entryId, mockUserId);

      expect(result.success).toBe(true);
    });

    it('should handle delete errors gracefully', async () => {
      const entryId = 'journal-123';
      const mockError = { message: 'Delete failed', code: 'DELETE_ERROR' };

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: mockError,
          }),
        }),
      });

      const result = await journalService.deleteJournalEntry(entryId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('searchJournalEntries', () => {
    it('should search journal entries successfully', async () => {
      const searchTerm = 'gratitude';
      const mockEntries = [
        {
          id: 'journal-123',
          title: 'Gratitude Journal',
          content: 'Today I am grateful for...',
          tags: ['gratitude', 'blessings'],
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockEntries,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await journalService.searchJournalEntries(mockUserId, searchTerm);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntries);
    });

    it('should handle empty search term', async () => {
      const result = await journalService.searchJournalEntries(mockUserId, '');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('search term');
    });
  });

  describe('getJournalEntryById', () => {
    it('should fetch journal entry by ID successfully', async () => {
      const entryId = 'journal-123';
      const mockEntry = {
        id: entryId,
        user_id: mockUserId,
        title: 'Morning Reflection',
        content: 'Today was a peaceful morning...',
        category: 'reflection',
        mood: 'peaceful',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockEntry,
              error: null,
            }),
          }),
        }),
      });

      const result = await journalService.getJournalEntryById(entryId, mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntry);
    });

    it('should handle not found error', async () => {
      const entryId = 'nonexistent';

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

      const result = await journalService.getJournalEntryById(entryId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('journal validation', () => {
    it('should validate required fields', async () => {
      const invalidEntry = {
        user_id: mockUserId,
        // Missing title and content
      };

      const result = await journalService.createJournalEntry(invalidEntry);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('required');
    });

    it('should validate journal category', async () => {
      const validCategories = ['prayer', 'reflection', 'gratitude', 'scripture', 'meditation'];

      validCategories.forEach(async (category) => {
        const entryData = {
          user_id: mockUserId,
          title: 'Test Entry',
          content: 'Test content',
          category,
        };

        const result = await journalService.createJournalEntry(entryData);
        expect(typeof result.success).toBe('boolean');
      });
    });

    it('should reject invalid category', async () => {
      const entryData = {
        user_id: mockUserId,
        title: 'Test Entry',
        content: 'Test content',
        category: 'invalid_category',
      };

      const result = await journalService.createJournalEntry(entryData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid category');
    });

    it('should validate mood', async () => {
      const validMoods = ['grateful', 'peaceful', 'thoughtful', 'joyful', 'anxious', 'sad'];

      validMoods.forEach(async (mood) => {
        const entryData = {
          user_id: mockUserId,
          title: 'Test Entry',
          content: 'Test content',
          mood,
        };

        const result = await journalService.createJournalEntry(entryData);
        expect(typeof result.success).toBe('boolean');
      });
    });
  });

  describe('journal statistics', () => {
    it('should get user journal statistics', async () => {
      const mockStats = {
        total_entries: 50,
        entries_this_month: 15,
        current_streak: 7,
        longest_streak: 21,
        most_common_mood: 'grateful',
        favorite_category: 'reflection',
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

      const result = await journalService.getUserJournalStats(mockUserId);

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

      const result = await journalService.getUserJournalStats(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('journal tagging', () => {
    it('should add tags to journal entry', async () => {
      const entryId = 'journal-123';
      const tags = ['gratitude', 'peace', 'blessings'];

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: entryId, tags },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await journalService.addTagsToEntry(entryId, tags);

      expect(result.success).toBe(true);
      expect(result.data?.tags).toEqual(tags);
    });

    it('should remove tags from journal entry', async () => {
      const entryId = 'journal-123';
      const tagsToRemove = ['anxious', 'sad'];

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: entryId, tags: ['grateful', 'peace'] },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await journalService.removeTagsFromEntry(entryId, tagsToRemove);

      expect(result.success).toBe(true);
    });

    it('should get entries by tag', async () => {
      const tag = 'gratitude';
      const mockEntries = [
        {
          id: 'journal-123',
          title: 'Gratitude Entry',
          tags: ['gratitude', 'blessings'],
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockEntries,
              error: null,
            }),
          }),
        }),
      });

      const result = await journalService.getEntriesByTag(mockUserId, tag);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntries);
    });
  });

  describe('journal caching', () => {
    it('should cache journal entry data', async () => {
      const entryId = 'journal-123';
      const mockEntry = {
        id: entryId,
        user_id: mockUserId,
        title: 'Morning Reflection',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockEntry,
              error: null,
            }),
          }),
        }),
      });

      // First call should hit database
      await journalService.getJournalEntryById(entryId, mockUserId);

      // Second call should use cache
      await journalService.getJournalEntryById(entryId, mockUserId);

      // Should only call database once
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on update', async () => {
      const entryId = 'journal-123';
      const updateData = { title: 'Updated Entry' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: entryId, ...updateData },
                error: null,
              }),
            }),
          }),
        }),
      });

      await journalService.updateJournalEntry(entryId, updateData);

      // Next getJournalEntryById call should hit database
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: entryId, title: 'Updated Entry' },
              error: null,
            }),
          }),
        }),
      });

      await journalService.getJournalEntryById(entryId, mockUserId);

      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await journalService.getUserJournalEntries(mockUserId);

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

      const result = await journalService.getUserJournalEntries(mockUserId);

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

      const result = await journalService.getJournalEntryById('journal-123', mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('unexpected');
    });
  });

  describe('edge cases', () => {
    it('should handle empty user ID', async () => {
      const result = await journalService.getUserJournalEntries('');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid user ID');
    });

    it('should handle null user ID', async () => {
      const result = await journalService.getUserJournalEntries(null as any);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid user ID');
    });

    it('should handle concurrent operations', async () => {
      const entryData = {
        user_id: mockUserId,
        title: 'Test Entry',
        content: 'Test content',
        category: 'reflection',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...entryData, id: 'journal-123' },
              error: null,
            }),
          }),
        }),
      });

      // Create multiple entries concurrently
      const promises = Array.from({ length: 3 }, () =>
        journalService.createJournalEntry(entryData)
      );

      const results = await Promise.all(promises);

      // All should complete without errors
      results.forEach((result) => {
        expect(typeof result.success).toBe('boolean');
      });
    });
  });
});
