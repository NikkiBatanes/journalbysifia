/**
 * ProductionLogger.test.ts
 * Test suite for the enterprise-grade Logger utility
 */

import { Logger } from '../ProductionLogger';

// Mock console methods to capture log output
const mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleDebug = jest.spyOn(console, 'debug').mockImplementation();

// Mock __DEV__ to be true for testing
const originalDev = (global as any).__DEV__;
(global as any).__DEV__ = true;

describe('ProductionLogger', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    mockConsoleInfo.mockClear();
    mockConsoleWarn.mockClear();
    mockConsoleError.mockClear();
    mockConsoleDebug.mockClear();
  });

  afterAll(() => {
    // Restore console methods and __DEV__ after all tests
    mockConsoleInfo.mockRestore();
    mockConsoleWarn.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleDebug.mockRestore();
    (global as any).__DEV__ = originalDev;
  });

  describe('Logger.info', () => {
    it('should log info messages without metadata', () => {
      const message = 'Test info message';
      Logger.info(message);

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    it('should log info messages with metadata', () => {
      const message = 'Test info with metadata';
      const metadata = { userId: '123', action: 'test' };
      Logger.info(message, metadata);

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    it('should handle complex metadata objects', () => {
      const message = 'Complex metadata test';
      const metadata = {
        user: { id: '123', name: 'Test User' },
        timestamp: new Date().toISOString(),
        data: { items: [1, 2, 3], nested: { value: true } },
      };
      Logger.info(message, metadata);

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    it('should handle null/undefined metadata gracefully', () => {
      const message = 'Test with null metadata';
      Logger.info(message, null as any);
      Logger.info(message, undefined);

      expect(mockConsoleInfo).toHaveBeenCalledTimes(2);
    });
  });

  describe('Logger.warn', () => {
    it('should log warning messages', () => {
      const message = 'Test warning message';
      const metadata = { warning: 'test' };
      Logger.warn(message, metadata);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    it('should handle warnings without metadata', () => {
      const message = 'Warning without metadata';
      Logger.warn(message);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });
  });

  describe('Logger.error', () => {
    it('should log error messages with Error objects', () => {
      const message = 'Test error message';
      const error = new Error('Test error');
      const metadata = { component: 'test' };
      Logger.error(message, error, metadata);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    it('should log error messages with unknown errors', () => {
      const message = 'Test with unknown error';
      const error = 'Unknown error string';
      const metadata = { component: 'test' };
      Logger.error(message, error, metadata);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    it('should handle errors without metadata', () => {
      const message = 'Error without metadata';
      const error = new Error('Simple error');
      Logger.error(message, error);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    it('should handle null errors', () => {
      const message = 'Error with null error';
      Logger.error(message, null as any);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });
  });

  describe('Logger.debug', () => {
    it('should log debug messages', () => {
      const message = 'Test debug message';
      const metadata = { debug: true };
      Logger.debug(message, metadata);

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    it('should handle debug without metadata', () => {
      const message = 'Debug without metadata';
      Logger.debug(message);

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });
  });

  describe('LogMetadata validation', () => {
    it('should handle valid LogMetadata structure', () => {
      const message = 'Valid metadata test';
      const validMetadata = {
        component: 'test',
        userId: '123',
        action: 'test',
        timestamp: new Date().toISOString(),
        data: { key: 'value' },
      };

      expect(() => {
        Logger.info(message, validMetadata);
        Logger.warn(message, validMetadata);
        Logger.debug(message, validMetadata);
      }).not.toThrow();
    });

    it('should handle metadata with error property correctly', () => {
      const message = 'Error metadata test';
      const errorMetadata = {
        component: 'test',
        error: {
          message: 'Test error',
          stack: 'Error stack trace',
          name: 'Error',
        },
      };

      expect(() => {
        Logger.info(message, errorMetadata);
      }).not.toThrow();
    });

    it('should handle metadata with errorMessage property', () => {
      const message = 'Error message metadata test';
      const metadata = {
        component: 'test',
        errorMessage: 'Simple error string',
      };

      expect(() => {
        Logger.warn(message, metadata);
      }).not.toThrow();
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle rapid logging without errors', () => {
      const message = 'Rapid logging test';

      expect(() => {
        for (let i = 0; i < 100; i++) {
          Logger.info(`${message} ${i}`, { iteration: i });
        }
      }).not.toThrow();

      expect(mockConsoleInfo).toHaveBeenCalledTimes(100);
    });

    it('should handle large metadata objects', () => {
      const message = 'Large metadata test';
      const largeMetadata = {
        data: new Array(100).fill(0).map((_, i) => ({ id: i, value: `item-${i}` })),
        timestamp: new Date().toISOString(),
      };

      expect(() => {
        Logger.info(message, largeMetadata);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(() => {
        Logger.info('');
        Logger.warn('');
        Logger.error('');
        Logger.debug('');
      }).not.toThrow();
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Test with special chars: 🚀 ñáéíóú 漢字 🎉';
      const metadata = { special: 'chars: 🎯✨💫' };

      expect(() => {
        Logger.info(specialMessage, metadata);
        Logger.warn(specialMessage, metadata);
        Logger.error(specialMessage, new Error(specialMessage), metadata);
        Logger.debug(specialMessage, metadata);
      }).not.toThrow();
    });

    it('should handle very long messages', () => {
      const longMessage = 'a'.repeat(1000);
      const metadata = { length: longMessage.length };

      expect(() => {
        Logger.info(longMessage, metadata);
      }).not.toThrow();
    });

    it('should handle circular references in metadata', () => {
      const message = 'Circular reference test';
      const circular: any = { prop: 'value' };
      circular.self = circular;

      expect(() => {
        Logger.info(message, circular);
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should work consistently across all log levels', () => {
      const baseMessage = 'Integration test';
      const metadata = { test: 'integration' };

      Logger.debug(baseMessage, metadata);
      Logger.info(baseMessage, metadata);
      Logger.warn(baseMessage, metadata);
      Logger.error(baseMessage, new Error('Integration error'), metadata);

      expect(mockConsoleDebug).toHaveBeenCalledTimes(1);
      expect(mockConsoleInfo).toHaveBeenCalledTimes(1);
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
    });

    it('should maintain log order in rapid succession', () => {
      const messages = ['first', 'second', 'third'];

      Logger.info(messages[0]);
      Logger.info(messages[1]);
      Logger.info(messages[2]);

      expect(mockConsoleInfo).toHaveBeenCalledTimes(3);
      // Verify order by checking the calls
      expect(mockConsoleInfo.mock.calls[0][0]).toContain(messages[0]);
      expect(mockConsoleInfo.mock.calls[1][0]).toContain(messages[1]);
      expect(mockConsoleInfo.mock.calls[2][0]).toContain(messages[2]);
    });
  });
});
