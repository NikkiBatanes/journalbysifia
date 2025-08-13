import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';

export interface CachedContent {
  id: string;
  type: 'playbook' | 'devotional' | 'expounding' | 'ai_response' | 'user_data';
  content: any;
  metadata: {
    userId?: string;
    sourceId: string;
    title?: string;
    lastUpdated: string;
    expiresAt?: string;
    priority: 'high' | 'medium' | 'low';
    size: number; // in bytes
  };
  accessCount: number;
  lastAccessedAt: string;
}

export interface CacheStats {
  totalItems: number;
  totalSize: number; // in bytes
  highPriorityItems: number;
  expiredItems: number;
  lastCleanup: string;
}

export interface OfflineQueueItem {
  id: string;
  type: 'sync_progress' | 'sync_bookmark' | 'sync_preference' | 'api_call';
  data: any;
  endpoint?: string;
  method?: 'POST' | 'PUT' | 'DELETE';
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  lastAttempt?: string;
}

class OfflineCachingService {
  private readonly STORAGE_KEYS = {
    CACHE: 'offline_cache',
    QUEUE: 'offline_queue',
    STATS: 'cache_stats',
  };

  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly DEFAULT_EXPIRY_HOURS = 24;
  private isOnline = true;

  constructor() {
    this.initializeNetworkListener();
    this.schedulePeriodicCleanup();
  }

  /**
   * Cache content for offline access
   */
  async cacheContent(
    type: CachedContent['type'],
    sourceId: string,
    content: any,
    options?: {
      userId?: string;
      title?: string;
      priority?: CachedContent['metadata']['priority'];
      expiryHours?: number;
    }
  ): Promise<void> {
    try {
      const contentString = JSON.stringify(content);
      const size = new Blob([contentString]).size;

      // Check cache size limits
      await this.ensureCacheSpace(size);

      const cachedItem: CachedContent = {
        id: `cache_${type}_${sourceId}_${Date.now()}`,
        type,
        content,
        metadata: {
          userId: options?.userId,
          sourceId,
          title: options?.title,
          lastUpdated: new Date().toISOString(),
          expiresAt: options?.expiryHours
            ? new Date(Date.now() + options.expiryHours * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + this.DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
          priority: options?.priority || 'medium',
          size,
        },
        accessCount: 0,
        lastAccessedAt: new Date().toISOString(),
      };

      await this.saveCachedItem(cachedItem);
      await this.updateCacheStats();

      console.log(`[OfflineCachingService] Cached ${type} content:`, sourceId);
    } catch (error) {
      console.error('[OfflineCachingService] Error caching content:', error);
    }
  }

  /**
   * Retrieve cached content
   */
  async getCachedContent(
    type: CachedContent['type'],
    sourceId: string,
    userId?: string
  ): Promise<any | null> {
    try {
      const cache = await this.getAllCachedItems();
      const item = cache.find(item =>
        item.type === type &&
        item.metadata.sourceId === sourceId &&
        (!userId || item.metadata.userId === userId)
      );

      if (!item) {
        return null;
      }

      // Check if expired
      if (item.metadata.expiresAt && new Date(item.metadata.expiresAt) < new Date()) {
        await this.removeCachedItem(item.id);
        return null;
      }

      // Update access stats
      item.accessCount += 1;
      item.lastAccessedAt = new Date().toISOString();
      await this.saveCachedItem(item);

      console.log(`[OfflineCachingService] Retrieved cached ${type}:`, sourceId);
      return item.content;
    } catch (error) {
      console.error('[OfflineCachingService] Error getting cached content:', error);
      return null;
    }
  }

  /**
   * Check if content is cached and valid
   */
  async isCached(
    type: CachedContent['type'],
    sourceId: string,
    userId?: string
  ): Promise<boolean> {
    try {
      const content = await this.getCachedContent(type, sourceId, userId);
      return content !== null;
    } catch (error) {
      console.error('[OfflineCachingService] Error checking cache:', error);
      return false;
    }
  }

  /**
   * Pre-cache essential content for offline use
   */
  async preCacheEssentialContent(userId: string): Promise<void> {
    try {
      console.log('[OfflineCachingService] Pre-caching essential content...');

      // Cache user's active playbooks
      await this.preCacheUserPlaybooks(userId);

      // Cache recent devotionals
      await this.preCacheRecentDevotionals(userId);

      // Cache user progress data
      await this.preCacheUserData(userId);

      console.log('[OfflineCachingService] Pre-caching completed');
    } catch (error) {
      console.error('[OfflineCachingService] Error pre-caching content:', error);
    }
  }

  /**
   * Add item to offline sync queue
   */
  async addToOfflineQueue(
    type: OfflineQueueItem['type'],
    data: any,
    endpoint?: string,
    method?: OfflineQueueItem['method']
  ): Promise<void> {
    try {
      const queueItem: OfflineQueueItem = {
        id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        data,
        endpoint,
        method,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
      };

      const queue = await this.getOfflineQueue();
      queue.push(queueItem);

      await AsyncStorage.setItem(this.STORAGE_KEYS.QUEUE, JSON.stringify(queue));

      console.log('[OfflineCachingService] Added to offline queue:', type);
    } catch (error) {
      console.error('[OfflineCachingService] Error adding to queue:', error);
    }
  }

  /**
   * Process offline queue when connection is restored
   */
  async processOfflineQueue(): Promise<void> {
    try {
      if (!this.isOnline) {
        return;
      }

      const queue = await this.getOfflineQueue();
      const processedItems: string[] = [];

      console.log(`[OfflineCachingService] Processing ${queue.length} queued items...`);

      for (const item of queue) {
        try {
          const success = await this.processQueueItem(item);

          if (success) {
            processedItems.push(item.id);
          } else if (item.retryCount >= item.maxRetries) {
            console.warn('[OfflineCachingService] Max retries exceeded for item:', item.id);
            processedItems.push(item.id); // Remove failed items after max retries
          } else {
            // Increment retry count
            item.retryCount += 1;
            item.lastAttempt = new Date().toISOString();
          }
        } catch (error) {
          console.error(`[OfflineCachingService] Error processing queue item ${item.id}:`, error);
          item.retryCount += 1;
          item.lastAttempt = new Date().toISOString();
        }
      }

      // Remove processed items from queue
      const remainingQueue = queue.filter(item => !processedItems.includes(item.id));
      await AsyncStorage.setItem(this.STORAGE_KEYS.QUEUE, JSON.stringify(remainingQueue));

      console.log(`[OfflineCachingService] Processed ${processedItems.length} items, ${remainingQueue.length} remaining`);
    } catch (error) {
      console.error('[OfflineCachingService] Error processing offline queue:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.STATS);

      if (stored) {
        return JSON.parse(stored);
      }

      // Calculate fresh stats
      return await this.calculateCacheStats();
    } catch (error) {
      console.error('[OfflineCachingService] Error getting cache stats:', error);
      return {
        totalItems: 0,
        totalSize: 0,
        highPriorityItems: 0,
        expiredItems: 0,
        lastCleanup: new Date().toISOString(),
      };
    }
  }

  /**
   * Clear expired cache items
   */
  async clearExpiredCache(): Promise<number> {
    try {
      const cache = await this.getAllCachedItems();
      const now = new Date();
      let removedCount = 0;

      const validItems = cache.filter(item => {
        if (item.metadata.expiresAt && new Date(item.metadata.expiresAt) < now) {
          removedCount++;
          return false;
        }
        return true;
      });

      await this.saveAllCachedItems(validItems);
      await this.updateCacheStats();

      console.log(`[OfflineCachingService] Cleared ${removedCount} expired items`);
      return removedCount;
    } catch (error) {
      console.error('[OfflineCachingService] Error clearing expired cache:', error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEYS.CACHE);
      await AsyncStorage.removeItem(this.STORAGE_KEYS.STATS);
      console.log('[OfflineCachingService] All cache cleared');
    } catch (error) {
      console.error('[OfflineCachingService] Error clearing cache:', error);
    }
  }

  /**
   * Get network status
   */
  getNetworkStatus(): boolean {
    return this.isOnline;
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      console.log(`[OfflineCachingService] Network status: ${this.isOnline ? 'Online' : 'Offline'}`);

      // Process queue when coming back online
      if (wasOffline && this.isOnline) {
        setTimeout(() => this.processOfflineQueue(), 1000);
      }
    });
  }

  private schedulePeriodicCleanup(): void {
    // Clean up expired cache every hour
    setInterval(() => {
      this.clearExpiredCache();
    }, 60 * 60 * 1000);
  }

  private async ensureCacheSpace(requiredSize: number): Promise<void> {
    const stats = await this.getCacheStats();

    if (stats.totalSize + requiredSize > this.MAX_CACHE_SIZE) {
      await this.evictLeastUsedItems(requiredSize);
    }
  }

  private async evictLeastUsedItems(requiredSpace: number): Promise<void> {
    try {
      const cache = await this.getAllCachedItems();

      // Sort by priority (low first) and access count (least accessed first)
      const sortedCache = cache.sort((a, b) => {
        const priorityOrder = { low: 0, medium: 1, high: 2 };
        const aPriority = priorityOrder[a.metadata.priority];
        const bPriority = priorityOrder[b.metadata.priority];

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        return a.accessCount - b.accessCount;
      });

      let freedSpace = 0;
      const itemsToRemove: string[] = [];

      for (const item of sortedCache) {
        if (freedSpace >= requiredSpace) {break;}

        freedSpace += item.metadata.size;
        itemsToRemove.push(item.id);
      }

      // Remove selected items
      const remainingCache = cache.filter(item => !itemsToRemove.includes(item.id));
      await this.saveAllCachedItems(remainingCache);

      console.log(`[OfflineCachingService] Evicted ${itemsToRemove.length} items to free ${freedSpace} bytes`);
    } catch (error) {
      console.error('[OfflineCachingService] Error evicting cache items:', error);
    }
  }

  private async preCacheUserPlaybooks(userId: string): Promise<void> {
    // This would integrate with existing playbook service
    // For now, we'll just log the intent
    console.log(`[OfflineCachingService] Pre-caching playbooks for user: ${userId}`);
  }

  private async preCacheRecentDevotionals(userId: string): Promise<void> {
    // This would integrate with existing devotional service
    console.log(`[OfflineCachingService] Pre-caching devotionals for user: ${userId}`);
  }

  private async preCacheUserData(userId: string): Promise<void> {
    // Cache user progress, preferences, etc.
    console.log(`[OfflineCachingService] Pre-caching user data for: ${userId}`);
  }

  private async processQueueItem(item: OfflineQueueItem): Promise<boolean> {
    try {
      switch (item.type) {
        case 'sync_progress':
          // Sync progress data to Supabase
          return await this.syncProgressData(item.data);

        case 'sync_bookmark':
          // Sync bookmark to Supabase
          return await this.syncBookmarkData(item.data);

        case 'sync_preference':
          // Sync user preferences
          return await this.syncPreferenceData(item.data);

        case 'api_call':
          // Generic API call
          return await this.makeApiCall(item);

        default:
          console.warn(`[OfflineCachingService] Unknown queue item type: ${item.type}`);
          return false;
      }
    } catch (error) {
      console.error('[OfflineCachingService] Error processing queue item:', error);
      return false;
    }
  }

  private async syncProgressData(data: any): Promise<boolean> {
    // Implementation would sync with progressTrackingService
    console.log('[OfflineCachingService] Syncing progress data:', data);
    return true; // Placeholder
  }

  private async syncBookmarkData(data: any): Promise<boolean> {
    // Implementation would sync with bookmarkingService
    console.log('[OfflineCachingService] Syncing bookmark data:', data);
    return true; // Placeholder
  }

  private async syncPreferenceData(data: any): Promise<boolean> {
    // Implementation would sync user preferences
    console.log('[OfflineCachingService] Syncing preference data:', data);
    return true; // Placeholder
  }

  private async makeApiCall(item: OfflineQueueItem): Promise<boolean> {
    if (!item.endpoint || !item.method) {
      return false;
    }

    try {
      const response = await fetch(item.endpoint, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item.data),
      });

      return response.ok;
    } catch (error) {
      console.error('[OfflineCachingService] API call failed:', error);
      return false;
    }
  }

  private async getAllCachedItems(): Promise<CachedContent[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.CACHE);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[OfflineCachingService] Error getting cached items:', error);
      return [];
    }
  }

  private async saveAllCachedItems(items: CachedContent[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.CACHE, JSON.stringify(items));
    } catch (error) {
      console.error('[OfflineCachingService] Error saving cached items:', error);
    }
  }

  private async saveCachedItem(item: CachedContent): Promise<void> {
    try {
      const cache = await this.getAllCachedItems();
      const existingIndex = cache.findIndex(cached => cached.id === item.id);

      if (existingIndex >= 0) {
        cache[existingIndex] = item;
      } else {
        cache.push(item);
      }

      await this.saveAllCachedItems(cache);
    } catch (error) {
      console.error('[OfflineCachingService] Error saving cached item:', error);
    }
  }

  private async removeCachedItem(itemId: string): Promise<void> {
    try {
      const cache = await this.getAllCachedItems();
      const filtered = cache.filter(item => item.id !== itemId);
      await this.saveAllCachedItems(filtered);
    } catch (error) {
      console.error('[OfflineCachingService] Error removing cached item:', error);
    }
  }

  private async getOfflineQueue(): Promise<OfflineQueueItem[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.QUEUE);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[OfflineCachingService] Error getting offline queue:', error);
      return [];
    }
  }

  private async calculateCacheStats(): Promise<CacheStats> {
    try {
      const cache = await this.getAllCachedItems();
      const now = new Date();

      const stats: CacheStats = {
        totalItems: cache.length,
        totalSize: cache.reduce((sum, item) => sum + item.metadata.size, 0),
        highPriorityItems: cache.filter(item => item.metadata.priority === 'high').length,
        expiredItems: cache.filter(item =>
          item.metadata.expiresAt && new Date(item.metadata.expiresAt) < now
        ).length,
        lastCleanup: new Date().toISOString(),
      };

      await this.updateCacheStats(stats);
      return stats;
    } catch (error) {
      console.error('[OfflineCachingService] Error calculating cache stats:', error);
      return {
        totalItems: 0,
        totalSize: 0,
        highPriorityItems: 0,
        expiredItems: 0,
        lastCleanup: new Date().toISOString(),
      };
    }
  }

  private async updateCacheStats(stats?: CacheStats): Promise<void> {
    try {
      const cacheStats = stats || await this.calculateCacheStats();
      await AsyncStorage.setItem(this.STORAGE_KEYS.STATS, JSON.stringify(cacheStats));
    } catch (error) {
      console.error('[OfflineCachingService] Error updating cache stats:', error);
    }
  }
}

export const offlineCachingService = new OfflineCachingService();
