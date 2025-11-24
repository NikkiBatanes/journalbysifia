/**
 * timeBlockApi.test.ts
 * Test suite for time block API service
 * Focus on error handling and utility functions
 */

import { ApiError, handleApiError } from '../api/timeBlockApi';

// Mock Logger
jest.mock('../../utils/ProductionLogger', () => ({
  Logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('timeBlockApi - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ApiError', () => {
    it('should create ApiError with correct properties', () => {
      const error = new ApiError('Test error', 400, 'TEST_CODE', { detail: 'test' });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.name).toBe('ApiError');
    });

    it('should maintain stack trace', () => {
      const error = new ApiError('Test error', 500);

      expect(error.stack).toBeDefined();
      expect(error.name).toBe('ApiError');
    });
  });

  describe('handleApiError', () => {
    it('should re-throw ApiError instances', () => {
      const originalError = new ApiError('Original error', 400);

      expect(() => handleApiError(originalError, 'test-context')).toThrow('Original error');
    });

    it('should handle regular Error instances', () => {
      const regularError = new Error('Regular error');

      expect(() => handleApiError(regularError, 'test-context')).toThrow(ApiError);
    });

    it('should handle Supabase errors', () => {
      const supabaseError = {
        message: 'Database error',
        code: 'PGRST116',
        details: 'Table not found',
        hint: 'Check table name',
      } as any;

      expect(() => handleApiError(supabaseError, 'test-context')).toThrow(ApiError);
    });

    it('should handle network errors', () => {
      const networkError = new Error('NetworkError: Failed to fetch');

      expect(() => handleApiError(networkError, 'test-context')).toThrow(ApiError);
    });

    it('should handle unknown error types', () => {
      const unknownError = 'string error';

      expect(() => handleApiError(unknownError, 'test-context')).toThrow(ApiError);
    });
  });
});
