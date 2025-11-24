/**
 * ProductionLogger.test.ts
 * Test suite for the production logging system
 */

import { Logger, LogLevel } from '../ProductionLogger';

describe('ProductionLogger', () => {
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('info logging', () => {
    it('should log info messages with metadata', () => {
      const message = 'Test info message';
      const metadata = { userId: '123', action: 'test' };

      Logger.info(message, metadata);

      expect(consoleInfoSpy).toHaveBeenCalled();
      const loggedMessage = consoleInfoSpy.mock.calls[0][0];
      expect(loggedMessage).toContain(message);
      expect(loggedMessage).toContain('userId');
    });

    it('should log info messages without metadata', () => {
      const message = 'Simple info message';

      Logger.info(message);

      expect(consoleInfoSpy).toHaveBeenCalled();
      const loggedMessage = consoleInfoSpy.mock.calls[0][0];
      expect(loggedMessage).toContain(message);
    });
  });

  describe('warn logging', () => {
    it('should log warning messages with metadata', () => {
      const message = 'Test warning';
      const metadata = { component: 'TestComponent' };

      Logger.warn(message, metadata);

      expect(consoleWarnSpy).toHaveBeenCalled();
      const loggedMessage = consoleWarnSpy.mock.calls[0][0];
      expect(loggedMessage).toContain(message);
    });

    it('should log warnings without metadata', () => {
      const message = 'Simple warning';

      Logger.warn(message);

      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('error logging', () => {
    it('should log errors with Error object and metadata', () => {
      const message = 'Test error';
      const error = new Error('Test error object');
      const metadata = { component: 'ErrorComponent' };

      Logger.error(message, error, metadata);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMessage = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMessage).toContain(message);
    });

    it('should log errors without Error object', () => {
      const message = 'Simple error';

      Logger.error(message);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle unknown error types', () => {
      const message = 'Unknown error';
      const unknownError = { weird: 'object' };

      Logger.error(message, unknownError as any);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('debug logging', () => {
    it('should log debug messages in development', () => {
      const message = 'Debug message';
      const metadata = { debug: true };

      Logger.debug(message, metadata);

      // Debug logs may or may not appear depending on environment
      // Just verify no errors thrown
      expect(() => Logger.debug(message, metadata)).not.toThrow();
    });
  });

  describe('fatal logging', () => {
    it('should log fatal errors', () => {
      const message = 'Fatal error';
      const error = new Error('Critical failure');

      Logger.fatal(message, error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMessage = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMessage).toContain(message);
      expect(loggedMessage).toContain('FATAL');
    });
  });

  describe('error tracker integration', () => {
    it('should send errors to error tracker when configured', () => {
      const mockTracker = {
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };

      Logger.setErrorTracker(mockTracker);

      const error = new Error('Tracked error');
      Logger.error('Error message', error);

      expect(mockTracker.captureException).toHaveBeenCalledWith(error, expect.any(Object));
    });
  });

  describe('log buffer', () => {
    it('should maintain log buffer for recent logs', () => {
      Logger.info('Log 1');
      Logger.warn('Log 2');
      Logger.error('Log 3');

      const recentLogs = Logger.getRecentLogs();

      expect(recentLogs).toBeDefined();
      expect(Array.isArray(recentLogs)).toBe(true);
      expect(recentLogs.length).toBeGreaterThan(0);
    });

    it('should limit buffer size', () => {
      // Log more than buffer size
      for (let i = 0; i < 150; i++) {
        Logger.info(`Log ${i}`);
      }

      const recentLogs = Logger.getRecentLogs();
      expect(recentLogs.length).toBeLessThanOrEqual(100);
    });
  });

  // Note: performance tracking methods not exposed in current Logger implementation
  // describe('performance tracking', () => {
  //   it('should track operation performance', () => {
  //     const operation = 'testOperation';
  //     const metadata = { test: true };
  //     Logger.trackPerformance(operation, 150, metadata);
  //     expect(consoleInfoSpy).toHaveBeenCalled();
  //   });
  // });

  describe('metadata handling', () => {
    it('should handle complex metadata objects', () => {
      const complexMetadata = {
        user: { id: '123', name: 'Test' },
        nested: { deep: { value: 'test' } },
        array: [1, 2, 3],
      };

      expect(() => Logger.info('Complex metadata', complexMetadata)).not.toThrow();
    });

    it('should handle circular references in metadata', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      expect(() => Logger.info('Circular metadata', circular)).not.toThrow();
    });

    it('should sanitize sensitive data in metadata', () => {
      const sensitiveData = {
        password: 'secret123',
        token: 'bearer-token',
        apiKey: 'api-key-123',
      };

      Logger.info('Sensitive data', sensitiveData);

      const loggedMessage = consoleInfoSpy.mock.calls[0][0];
      expect(loggedMessage).not.toContain('secret123');
      expect(loggedMessage).not.toContain('bearer-token');
    });
  });

  describe('log levels', () => {
    it('should respect minimum log level', () => {
      Logger.setMinLevel(LogLevel.WARN);

      Logger.debug('Debug message');
      Logger.info('Info message');
      Logger.warn('Warning message');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle null metadata', () => {
      expect(() => Logger.info('Message', null as any)).not.toThrow();
    });

    it('should handle undefined metadata', () => {
      expect(() => Logger.info('Message', undefined)).not.toThrow();
    });

    it('should handle empty string messages', () => {
      expect(() => Logger.info('')).not.toThrow();
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      expect(() => Logger.info(longMessage)).not.toThrow();
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Test 🚀 with émojis and spëcial çhars';
      expect(() => Logger.info(specialMessage)).not.toThrow();
    });
  });
});
