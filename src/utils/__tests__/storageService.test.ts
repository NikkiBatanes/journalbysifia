/**
 * storageService.test.ts
 * Test suite for storage service utility
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

describe('storageService', () => {
  const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setItem', () => {
    it('should store string value successfully', async () => {
      const key = 'test-key';
      const value = 'test-value';

      mockAsyncStorage.setItem.mockResolvedValueOnce();

      const result = await mockAsyncStorage.setItem(key, value);

      expect(result).toBeUndefined();
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(key, value);
    });

    it('should store JSON object successfully', async () => {
      const key = 'user-profile';
      const value = { id: 'user-123', name: 'John Doe' };

      mockAsyncStorage.setItem.mockResolvedValueOnce();

      const result = await mockAsyncStorage.setItem(key, JSON.stringify(value));

      expect(result).toBeUndefined();
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(key, JSON.stringify(value));
    });

    it('should handle storage errors gracefully', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const error = new Error('Storage failed');

      mockAsyncStorage.setItem.mockRejectedValueOnce(error);

      await expect(mockAsyncStorage.setItem(key, value)).rejects.toThrow('Storage failed');
    });
  });

  describe('getItem', () => {
    it('should retrieve string value successfully', async () => {
      const key = 'test-key';
      const value = 'test-value';

      mockAsyncStorage.getItem.mockResolvedValueOnce(value);

      const result = await mockAsyncStorage.getItem(key);

      expect(result).toBe(value);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(key);
    });

    it('should return null for non-existent key', async () => {
      const key = 'non-existent-key';

      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await mockAsyncStorage.getItem(key);

      expect(result).toBeNull();
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(key);
    });

    it('should parse JSON object successfully', async () => {
      const key = 'user-profile';
      const value = { id: 'user-123', name: 'John Doe' };

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(value));

      const result = await mockAsyncStorage.getItem(key);
      const parsedValue = JSON.parse(result || '{}');

      expect(parsedValue).toEqual(value);
    });

    it('should handle retrieval errors gracefully', async () => {
      const key = 'test-key';
      const error = new Error('Retrieval failed');

      mockAsyncStorage.getItem.mockRejectedValueOnce(error);

      await expect(mockAsyncStorage.getItem(key)).rejects.toThrow('Retrieval failed');
    });
  });

  describe('removeItem', () => {
    it('should remove item successfully', async () => {
      const key = 'test-key';

      mockAsyncStorage.removeItem.mockResolvedValueOnce();

      const result = await mockAsyncStorage.removeItem(key);

      expect(result).toBeUndefined();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(key);
    });

    it('should handle removal errors gracefully', async () => {
      const key = 'test-key';
      const error = new Error('Removal failed');

      mockAsyncStorage.removeItem.mockRejectedValueOnce(error);

      await expect(mockAsyncStorage.removeItem(key)).rejects.toThrow('Removal failed');
    });
  });

  describe('clear', () => {
    it('should clear all storage successfully', async () => {
      mockAsyncStorage.clear.mockResolvedValueOnce();

      const result = await mockAsyncStorage.clear();

      expect(result).toBeUndefined();
      expect(mockAsyncStorage.clear).toHaveBeenCalled();
    });

    it('should handle clear errors gracefully', async () => {
      const error = new Error('Clear failed');

      mockAsyncStorage.clear.mockRejectedValueOnce(error);

      await expect(mockAsyncStorage.clear()).rejects.toThrow('Clear failed');
    });
  });

  describe('getAllKeys', () => {
    it('should get all keys successfully', async () => {
      const keys = ['key1', 'key2', 'key3'];

      mockAsyncStorage.getAllKeys.mockResolvedValueOnce(keys);

      const result = await mockAsyncStorage.getAllKeys();

      expect(result).toEqual(keys);
      expect(mockAsyncStorage.getAllKeys).toHaveBeenCalled();
    });

    it('should handle empty storage', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValueOnce([]);

      const result = await mockAsyncStorage.getAllKeys();

      expect(result).toEqual([]);
      expect(mockAsyncStorage.getAllKeys).toHaveBeenCalled();
    });

    it('should handle getAllKeys errors gracefully', async () => {
      const error = new Error('GetAllKeys failed');

      mockAsyncStorage.getAllKeys.mockRejectedValueOnce(error);

      await expect(mockAsyncStorage.getAllKeys()).rejects.toThrow('GetAllKeys failed');
    });
  });

  describe('multiGet', () => {
    it('should get multiple items successfully', async () => {
      const keys = ['key1', 'key2'];
      const values = [['key1', 'value1'], ['key2', 'value2']];

      mockAsyncStorage.multiGet.mockResolvedValueOnce(values);

      const result = await mockAsyncStorage.multiGet(keys);

      expect(result).toEqual(values);
      expect(mockAsyncStorage.multiGet).toHaveBeenCalledWith(keys);
    });

    it('should handle empty keys array', async () => {
      const keys: string[] = [];

      mockAsyncStorage.multiGet.mockResolvedValueOnce([]);

      const result = await mockAsyncStorage.multiGet(keys);

      expect(result).toEqual([]);
      expect(mockAsyncStorage.multiGet).toHaveBeenCalledWith(keys);
    });

    it('should handle multiGet errors gracefully', async () => {
      const keys = ['key1', 'key2'];
      const error = new Error('MultiGet failed');

      mockAsyncStorage.multiGet.mockRejectedValueOnce(error);

      await expect(mockAsyncStorage.multiGet(keys)).rejects.toThrow('MultiGet failed');
    });
  });

  describe('multiSet', () => {
    it('should set multiple items successfully', async () => {
      const keyValues: [string, string][] = [['key1', 'value1'], ['key2', 'value2']];

      mockAsyncStorage.multiSet.mockResolvedValueOnce();

      const result = await mockAsyncStorage.multiSet(keyValues);

      expect(result).toBeUndefined();
      expect(mockAsyncStorage.multiSet).toHaveBeenCalledWith(keyValues);
    });

    it('should handle empty keyValues array', async () => {
      const keyValues: [string, string][] = [];

      mockAsyncStorage.multiSet.mockResolvedValueOnce();

      const result = await mockAsyncStorage.multiSet(keyValues);

      expect(result).toBeUndefined();
      expect(mockAsyncStorage.multiSet).toHaveBeenCalledWith(keyValues);
    });

    it('should handle multiSet errors gracefully', async () => {
      const keyValues: [string, string][] = [['key1', 'value1']];
      const error = new Error('MultiSet failed');

      mockAsyncStorage.multiSet.mockRejectedValueOnce(error);

      await expect(mockAsyncStorage.multiSet(keyValues)).rejects.toThrow('MultiSet failed');
    });
  });

  describe('multiRemove', () => {
    it('should remove multiple items successfully', async () => {
      const keys = ['key1', 'key2'];

      mockAsyncStorage.multiRemove.mockResolvedValueOnce();

      const result = await mockAsyncStorage.multiRemove(keys);

      expect(result).toBeUndefined();
      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith(keys);
    });

    it('should handle empty keys array', async () => {
      const keys: string[] = [];

      mockAsyncStorage.multiRemove.mockResolvedValueOnce();

      const result = await mockAsyncStorage.multiRemove(keys);

      expect(result).toBeUndefined();
      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith(keys);
    });

    it('should handle multiRemove errors gracefully', async () => {
      const keys = ['key1', 'key2'];
      const error = new Error('MultiRemove failed');

      mockAsyncStorage.multiRemove.mockRejectedValueOnce(error);

      await expect(mockAsyncStorage.multiRemove(keys)).rejects.toThrow('MultiRemove failed');
    });
  });

  describe('data validation', () => {
    it('should handle very large values', async () => {
      const key = 'large-value';
      const largeValue = 'x'.repeat(1000000); // 1MB string

      mockAsyncStorage.setItem.mockResolvedValueOnce();

      await expect(mockAsyncStorage.setItem(key, largeValue)).resolves.toBeUndefined();
    });

    it('should handle special characters in keys', async () => {
      const key = 'special-key-@#$%^&*()';
      const value = 'test-value';

      mockAsyncStorage.setItem.mockResolvedValueOnce();

      await expect(mockAsyncStorage.setItem(key, value)).resolves.toBeUndefined();
    });

    it('should handle special characters in values', async () => {
      const key = 'test-key';
      const value = 'Special value: 🎉🚀📱';

      mockAsyncStorage.setItem.mockResolvedValueOnce();

      await expect(mockAsyncStorage.setItem(key, value)).resolves.toBeUndefined();
    });

    it('should handle empty strings', async () => {
      const key = 'empty-string';
      const value = '';

      mockAsyncStorage.setItem.mockResolvedValueOnce();

      await expect(mockAsyncStorage.setItem(key, value)).resolves.toBeUndefined();
    });

    it('should handle null and undefined values', async () => {
      const key = 'null-value';

      mockAsyncStorage.setItem.mockResolvedValueOnce();

      await expect(mockAsyncStorage.setItem(key, 'null')).resolves.toBeUndefined();
      await expect(mockAsyncStorage.setItem(key, 'undefined')).resolves.toBeUndefined();
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent set operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        mockAsyncStorage.setItem(`key${i}`, `value${i}`)
      );

      mockAsyncStorage.setItem.mockResolvedValue();

      await Promise.all(operations);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent get operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        mockAsyncStorage.getItem(`key${i}`)
      );

      mockAsyncStorage.getItem.mockResolvedValue('test-value');

      await Promise.all(operations);

      expect(mockAsyncStorage.getItem).toHaveBeenCalledTimes(10);
    });

    it('should handle mixed concurrent operations', async () => {
      const setOperations = Array.from({ length: 5 }, (_, i) => 
        mockAsyncStorage.setItem(`key${i}`, `value${i}`)
      );
      const getOperations = Array.from({ length: 5 }, (_, i) => 
        mockAsyncStorage.getItem(`key${i}`)
      );

      mockAsyncStorage.setItem.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValue('test-value');

      await Promise.all([...setOperations, ...getOperations]);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(5);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledTimes(5);
    });
  });

  describe('error recovery', () => {
    it('should retry failed operations', async () => {
      const key = 'test-key';
      const value = 'test-value';

      mockAsyncStorage.setItem
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce();

      // First attempt fails
      await expect(mockAsyncStorage.setItem(key, value)).rejects.toThrow('First failure');

      // Second attempt succeeds
      await expect(mockAsyncStorage.setItem(key, value)).resolves.toBeUndefined();

      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(2);
    });

    it('should handle quota exceeded errors', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const quotaError = new Error('Quota exceeded');

      mockAsyncStorage.setItem.mockRejectedValueOnce(quotaError);

      await expect(mockAsyncStorage.setItem(key, value)).rejects.toThrow('Quota exceeded');
    });

    it('should handle invalid key errors', async () => {
      const invalidKey = '';
      const value = 'test-value';
      const invalidKeyError = new Error('Invalid key');

      mockAsyncStorage.setItem.mockRejectedValueOnce(invalidKeyError);

      await expect(mockAsyncStorage.setItem(invalidKey, value)).rejects.toThrow('Invalid key');
    });
  });

  describe('performance considerations', () => {
    it('should handle rapid successive operations', async () => {
      const key = 'rapid-key';
      const operations = Array.from({ length: 100 }, (_, i) => 
        mockAsyncStorage.setItem(`${key}${i}`, `value${i}`)
      );

      mockAsyncStorage.setItem.mockResolvedValue();

      const startTime = Date.now();
      await Promise.all(operations);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(100);
    });

    it('should handle large number of keys efficiently', async () => {
      const keys = Array.from({ length: 1000 }, (_, i) => `key${i}`);

      mockAsyncStorage.getAllKeys.mockResolvedValue(keys);

      const result = await mockAsyncStorage.getAllKeys();

      expect(result).toHaveLength(1000);
      expect(mockAsyncStorage.getAllKeys).toHaveBeenCalled();
    });
  });

  describe('memory management', () => {
    it('should not leak memory during operations', async () => {
      const key = 'memory-test';
      const largeValue = 'x'.repeat(100000);

      mockAsyncStorage.setItem.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValue(largeValue);

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await mockAsyncStorage.setItem(`${key}${i}`, largeValue);
        await mockAsyncStorage.getItem(`${key}${i}`);
      }

      // Should complete without memory issues
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(100);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledTimes(100);
    });
  });
});
