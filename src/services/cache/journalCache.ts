// src/services/cache/journalCache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { JournalApiEntry } from '../api/journalApi';

export class JournalCache {
  private static readonly CACHE_PREFIX = '@journal_cache_';
  private static readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

  // Generate cache key
  private static getCacheKey(userId: string, date: string, contentType?: string): string {
    const baseKey = `${this.CACHE_PREFIX}${userId}_${date}`;
    return contentType ? `${baseKey}_${contentType}` : baseKey;
  }

  // Get cache metadata key
  private static getMetadataKey(cacheKey: string): string {
    return `${cacheKey}_metadata`;
  }

  // Check if cache is valid
  private static async isCacheValid(cacheKey: string): Promise<boolean> {
    try {
      const metadataJson = await AsyncStorage.getItem(this.getMetadataKey(cacheKey));
      if (!metadataJson) return false;

      const metadata = JSON.parse(metadataJson);
      const now = Date.now();
      const cacheAge = now - metadata.timestamp;

      return cacheAge < this.CACHE_EXPIRY;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  }

  // Store entries in cache
  static async setCache(
    userId: string,
    date: string,
    entries: JournalApiEntry[],
    contentType?: string
  ): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(userId, date, contentType);
      const metadataKey = this.getMetadataKey(cacheKey);

      // Store the data
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entries));

      // Store metadata
      const metadata = {
        timestamp: Date.now(),
        count: entries.length,
        contentType,
      };
      await AsyncStorage.setItem(metadataKey, JSON.stringify(metadata));

      console.log(`📦 Cached ${entries.length} journal entries for ${userId} on ${date}${contentType ? ` (${contentType})` : ''}`);
    } catch (error) {
      console.error('Error setting journal cache:', error);
    }
  }

  // Get entries from cache
  static async getCache(
    userId: string,
    date: string,
    contentType?: string
  ): Promise<JournalApiEntry[] | null> {
    try {
      const cacheKey = this.getCacheKey(userId, date, contentType);

      // Check if cache is valid
      const isValid = await this.isCacheValid(cacheKey);
      if (!isValid) {
        console.log(`⏰ Cache expired for ${userId} on ${date}${contentType ? ` (${contentType})` : ''}`);
        return null;
      }

      // Get cached data
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (!cachedData) return null;

      const entries = JSON.parse(cachedData) as JournalApiEntry[];
      console.log(`✅ Cache hit: ${entries.length} journal entries for ${userId} on ${date}${contentType ? ` (${contentType})` : ''}`);
      
      return entries;
    } catch (error) {
      console.error('Error getting journal cache:', error);
      return null;
    }
  }

  // Clear cache for specific user/date/type
  static async clearCache(userId: string, date: string, contentType?: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(userId, date, contentType);
      const metadataKey = this.getMetadataKey(cacheKey);

      await AsyncStorage.multiRemove([cacheKey, metadataKey]);
      console.log(`🗑️ Cleared journal cache for ${userId} on ${date}${contentType ? ` (${contentType})` : ''}`);
    } catch (error) {
      console.error('Error clearing journal cache:', error);
    }
  }

  // Clear all journal cache for a user
  static async clearAllUserCache(userId: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const userCacheKeys = allKeys.filter(key => 
        key.startsWith(`${this.CACHE_PREFIX}${userId}_`)
      );

      if (userCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(userCacheKeys);
        console.log(`🗑️ Cleared all journal cache for user ${userId} (${userCacheKeys.length} keys)`);
      }
    } catch (error) {
      console.error('Error clearing all user journal cache:', error);
    }
  }

  // Clear all expired cache
  static async clearExpiredCache(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.CACHE_PREFIX));
      const expiredKeys: string[] = [];

      for (const key of cacheKeys) {
        if (key.endsWith('_metadata')) continue; // Skip metadata keys, check main keys

        const isValid = await this.isCacheValid(key);
        if (!isValid) {
          expiredKeys.push(key);
          expiredKeys.push(this.getMetadataKey(key)); // Also remove metadata
        }
      }

      if (expiredKeys.length > 0) {
        await AsyncStorage.multiRemove(expiredKeys);
        console.log(`🗑️ Cleared ${expiredKeys.length / 2} expired journal cache entries`);
      }
    } catch (error) {
      console.error('Error clearing expired journal cache:', error);
    }
  }

  // Get cache statistics
  static async getCacheStats(): Promise<{
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    totalSize: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.startsWith(this.CACHE_PREFIX) && !key.endsWith('_metadata')
      );

      let totalEntries = 0;
      let validEntries = 0;
      let expiredEntries = 0;
      let totalSize = 0;

      for (const key of cacheKeys) {
        const isValid = await this.isCacheValid(key);
        const data = await AsyncStorage.getItem(key);
        
        if (data) {
          totalSize += data.length;
          const entries = JSON.parse(data) as JournalApiEntry[];
          totalEntries += entries.length;
          
          if (isValid) {
            validEntries += entries.length;
          } else {
            expiredEntries += entries.length;
          }
        }
      }

      return {
        totalEntries,
        validEntries,
        expiredEntries,
        totalSize,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalEntries: 0,
        validEntries: 0,
        expiredEntries: 0,
        totalSize: 0,
      };
    }
  }

  // Preload cache for multiple dates (for better UX)
  static async preloadCache(
    userId: string,
    dates: string[],
    entries: { [date: string]: JournalApiEntry[] }
  ): Promise<void> {
    try {
      const promises = dates.map(date => {
        const dateEntries = entries[date] || [];
        return this.setCache(userId, date, dateEntries);
      });

      await Promise.all(promises);
      console.log(`📦 Preloaded journal cache for ${dates.length} dates`);
    } catch (error) {
      console.error('Error preloading journal cache:', error);
    }
  }
}
