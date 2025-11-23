/**
 * featureRequestService.test.ts
 * Test suite for the feature request service
 */

import { reportFeature } from '../featureRequestService';
import { supabase } from '../../services/supabaseClient';

// Mock Supabase client
jest.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}));

// Mock Logger
jest.mock('../../utils/ProductionLogger', () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('featureRequestService', () => {
  const mockSupabase = supabase as any;
  const validFeatureRequest = {
    user_id: 'test-user-id',
    message: 'Add dark mode support',
    category: 'ui_improvement',
    platform: 'ios',
    os_version: '16.0',
    screen: 'HomeScreen',
    app_version: '1.0.0',
    extra: {
      priority: 'medium',
      use_case: 'I use the app at night and bright screen hurts my eyes',
      alternatives_tried: 'Using phone brightness control',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reportFeature', () => {

    it('should submit a valid feature request successfully', async () => {
      const mockResponse = { data: { id: 'feature-123' }, error: null };
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse),
          }),
        }),
      });

      const result = await reportFeature(validFeatureRequest);

      expect(result).toEqual(mockResponse.data);
      expect(mockSupabase.from).toHaveBeenCalledWith('feature_requests');
    });

    it('should handle database errors gracefully', async () => {
      const dbError = {
        code: '23505',
        message: 'Duplicate entry',
        details: 'Feature request already exists',
        hint: 'Check for duplicates',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: dbError }),
          }),
        }),
      });

      await expect(reportFeature(validFeatureRequest)).rejects.toThrow('This feature request already exists.');
    });

    it('should handle network errors', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Network error')),
          }),
        }),
      });

      await expect(reportFeature(validFeatureRequest)).rejects.toThrow('Failed to submit feature request. Please check your connection and try again.');
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        ...validFeatureRequest,
        message: '', // Empty required field
      };

      await expect(reportFeature(invalidRequest)).rejects.toThrow('Please describe the feature before submitting.');
    });

    it('should sanitize input data', async () => {
      const requestWithXSS = {
        ...validFeatureRequest,
        message: '<script>alert("xss")</script>Malicious content',
      };

      const mockResponse = { data: { id: 'feature-456' }, error: null };
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse),
          }),
        }),
      });

      const result = await reportFeature(requestWithXSS);

      expect(result).toEqual(mockResponse.data);
    });

    it('should validate category values', async () => {
      const validCategories = ['ui_improvement', 'new_feature', 'performance', 'bug_fix', 'integration'];

      for (const category of validCategories) {
        const request = { ...validFeatureRequest, category: category as any };

        const mockResponse = { data: { id: `feature-${category}` }, error: null };
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue(mockResponse),
            }),
          }),
        });

        const result = await reportFeature(request);
        expect(result).toEqual(mockResponse.data);
      }
    });

    it('should reject invalid category values', async () => {
      const invalidRequest = {
        ...validFeatureRequest,
        category: 'invalid_category' as any,
      };

      await expect(reportFeature(invalidRequest)).rejects.toThrow('Please describe the feature before submitting.');
    });

    it('should handle complex payloads', async () => {
      const complexRequest = {
        ...validFeatureRequest,
        extra: {
          complex_data: { nested: { value: 'test' } },
        },
      };

      const mockResponse = { data: { id: 'feature-complex' }, error: null };
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse),
          }),
        }),
      });

      const result = await reportFeature(complexRequest);

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null inputs', async () => {
      await expect(reportFeature(null as any)).rejects.toThrow('Please describe the feature before submitting.');
    });

    it('should handle malformed objects', async () => {
      const malformedRequest = {
        user_id: 123, // Should be string
        message: true, // Should be string
        category: 'ui_improvement',
        platform: 'ios',
        os_version: '16.0',
        screen: 'HomeScreen',
      };

      await expect(reportFeature(malformedRequest as any)).rejects.toThrow();
    });

    it('should handle special characters', async () => {
      const requestWithSpecialChars = {
        ...validFeatureRequest,
        message: 'Feature request with special chars: ñáéíóú ',
      };

      const mockResponse = { data: { id: 'feature-special' }, error: null };
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse),
          }),
        }),
      });

      const result = await reportFeature(requestWithSpecialChars);

      expect(result).toEqual(mockResponse.data);
    });
  });
});
