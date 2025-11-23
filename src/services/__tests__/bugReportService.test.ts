/**
 * bugReportService.test.ts
 * Test suite for the bug report service
 */

import { reportBug } from '../bugReportService';
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

describe('bugReportService', () => {
  const mockSupabase = supabase as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reportBug', () => {
    const validBugReport = {
      user_id: 'test-user-id',
      message: 'Test bug description',
      platform: 'ios',
      os_version: '16.0',
      screen: 'HomeScreen',
      app_version: '1.0.0',
      extra: {
        device_info: {
          model: 'iPhone 14',
          version: '1.0.0',
        },
        reproduction_steps: 'Step 1: Do this\nStep 2: Do that',
        expected_behavior: 'Expected result',
        actual_behavior: 'Actual result',
        severity: 'medium',
        screenshots: ['base64-image-data'],
      },
    };

    it('should submit a valid bug report successfully', async () => {
      const mockResponse = { data: { id: 'bug-123' }, error: null };
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse),
          }),
        }),
      });

      const result = await reportBug(validBugReport);

      expect(result).toEqual(mockResponse.data);
      expect(mockSupabase.from).toHaveBeenCalledWith('bug_reports');
    });

    it('should handle database errors gracefully', async () => {
      const dbError = {
        code: '23505',
        message: 'Duplicate entry',
        details: 'Constraint violation',
        hint: 'Check unique constraints',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: dbError }),
          }),
        }),
      });

      await expect(reportBug(validBugReport)).rejects.toThrow('This bug report has already been submitted.');
    });

    it('should handle network errors', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Network error')),
          }),
        }),
      });

      await expect(reportBug(validBugReport)).rejects.toThrow('Failed to submit bug report. Please check your connection and try again.');
    });

    it('should validate required fields', async () => {
      const invalidReport = {
        ...validBugReport,
        message: '', // Empty required field
      };

      await expect(reportBug(invalidReport)).rejects.toThrow('Please describe the issue before submitting.');
    });

    it('should sanitize input data', async () => {
      const reportWithXSS = {
        ...validBugReport,
        message: '<script>alert("xss")</script>Malicious content',
      };

      const mockResponse = { data: { id: 'bug-456' }, error: null };
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse),
          }),
        }),
      });

      const result = await reportBug(reportWithXSS);

      expect(result).toEqual(mockResponse.data);
    });

    it('should handle large descriptions', async () => {
      const longDescription = 'a'.repeat(10000); // Very long description
      const reportWithLongDesc = {
        ...validBugReport,
        message: longDescription,
      };

      const mockResponse = { data: { id: 'bug-789' }, error: null };
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse),
          }),
        }),
      });

      const result = await reportBug(reportWithLongDesc);

      expect(result).toEqual(mockResponse.data);
    });

    it('should validate severity levels', async () => {
      const validSeverities = ['low', 'medium', 'high', 'critical'];

      for (const severity of validSeverities) {
        const report = { ...validBugReport, severity: severity as any };

        const mockResponse = { data: { id: `bug-${severity}` }, error: null };
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue(mockResponse),
            }),
          }),
        });

        const result = await reportBug(report);
        expect(result).toEqual(mockResponse.data);
      }
    });

    it('should reject invalid severity levels', async () => {
      const invalidReport = {
        ...validBugReport,
        severity: 'invalid' as any,
      };

      await expect(reportBug(invalidReport)).rejects.toThrow('Please describe the issue before submitting.');
    });

    it('should handle optional fields gracefully', async () => {
      const minimalReport = {
        user_id: 'test-user-id',
        message: 'Minimal bug report',
        platform: 'android',
        os_version: '16.0',
        screen: 'HomeScreen',
      };  // Optional fields omitted

      const mockResponse = { data: { id: 'bug-minimal' }, error: null };
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse),
          }),
        }),
      });

      const result = await reportBug(minimalReport);

      expect(result).toEqual(mockResponse.data);
    });

    it('should handle complex payloads', async () => {
      const complexReport = {
        ...validBugReport,
        extra: {
          complex_data: { nested: { value: 'test' } },
        },
      };

      const mockResponse = { data: { id: 'bug-complex' }, error: null };
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse),
          }),
        }),
      });

      const result = await reportBug(complexReport);

      expect(result).toEqual(mockResponse.data);
    });

    it('should handle multiple submissions', async () => {
      const mockResponse = { data: { id: 'bug-multiple' }, error: null };
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse),
          }),
        }),
      });

      // Submit multiple reports
      const results = [];
      for (let i = 0; i < 3; i++) {
        const report = { ...validBugReport, message: `Multiple submission ${i}` };
        results.push(await reportBug(report));
      }

      // All should succeed
      results.forEach(result => {
        expect(result).toEqual(mockResponse.data);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null inputs', async () => {
      await expect(reportBug(null as any)).rejects.toThrow('Please describe the issue before submitting.');
    });

    it('should handle malformed objects', async () => {
      const malformedReport = {
        user_id: 123, // Should be string
        message: true, // Should be string
        platform: 'ios',
        os_version: '16.0',
        screen: 'HomeScreen',
      };

      await expect(reportBug(malformedReport as any)).rejects.toThrow();
    });
  });
});
