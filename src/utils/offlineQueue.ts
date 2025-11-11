/**
 * Offline Queue System
 * Stores failed requests and retries when connection is restored
 * ZERO UI/UX IMPACT - All background operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Logger } from './ProductionLogger';
import { monitoring } from './monitoring';

// ============================================================================
// TYPES
// ============================================================================

export interface QueuedRequest {
  id: string;
  type: 'playbook_generation' | 'playbook_save' | 'api_call';
  endpoint?: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'medium' | 'high';
  userId?: string;
}

interface QueueStats {
  totalQueued: number;
  pendingRetries: number;
  failedPermanently: number;
  successfulRetries: number;
}

// ============================================================================
// OFFLINE QUEUE SERVICE
// ============================================================================

class OfflineQueueService {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private isOnline = true;
  private readonly STORAGE_KEY = '@siFia:offlineQueue';
  private readonly MAX_QUEUE_SIZE = 50;
  private readonly RETRY_DELAY_BASE = 2000; // 2 seconds
  private unsubscribeNetInfo: (() => void) | null = null;

  constructor() {
    this.initialize();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  private async initialize(): Promise<void> {
    // Load persisted queue
    await this.loadQueue();

    // Listen for network changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      Logger.info(`📡 Network status: ${this.isOnline ? 'Online' : 'Offline'}`, {
        component: 'offlineQueue',
      });

      // If we just came back online, process queue
      if (wasOffline && this.isOnline) {
        Logger.info('🔄 Back online - processing queued requests', {
          component: 'offlineQueue',
        });
        this.processQueue();
      }
    });

    // Process queue on startup if online
    if (this.isOnline) {
      this.processQueue();
    }
  }

  // ==========================================================================
  // QUEUE MANAGEMENT
  // ==========================================================================

  /**
   * Add request to offline queue
   */
  async addToQueue(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const queuedRequest: QueuedRequest = {
      ...request,
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Check queue size limit
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest low-priority item
      const lowPriorityIndex = this.queue.findIndex((r) => r.priority === 'low');
      if (lowPriorityIndex !== -1) {
        this.queue.splice(lowPriorityIndex, 1);
        Logger.warn('Queue full - removed oldest low-priority request', {
          component: 'offlineQueue',
        });
      } else {
        throw new Error('Queue is full - cannot add more requests');
      }
    }

    this.queue.push(queuedRequest);
    await this.saveQueue();

    Logger.info(`📥 Added to offline queue: ${request.type}`, {
      component: 'offlineQueue',
      data: { queueSize: this.queue.length, priority: request.priority },
    });

    monitoring.trackMetric('offline_queue_add', 1, {
      type: request.type,
      priority: request.priority,
    });

    // Try to process immediately if online
    if (this.isOnline) {
      this.processQueue();
    }

    return queuedRequest.id;
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Sort by priority (high > medium > low) and timestamp (older first)
      const sortedQueue = [...this.queue].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) {return priorityDiff;}
        return a.timestamp - b.timestamp;
      });

      for (const request of sortedQueue) {
        if (!this.isOnline) {
          Logger.info('📴 Went offline - pausing queue processing', {
            component: 'offlineQueue',
          });
          break;
        }

        await this.processRequest(request);
      }
    } finally {
      this.isProcessing = false;
      await this.saveQueue();
    }
  }

  /**
   * Process a single request
   */
  private async processRequest(request: QueuedRequest): Promise<void> {
    try {
      Logger.info(`🔄 Processing queued request: ${request.type}`, {
        component: 'offlineQueue',
        data: { id: request.id, retryCount: request.retryCount },
      });

      // Execute the request based on type
      let success = false;

      switch (request.type) {
        case 'playbook_generation':
          success = await this.retryPlaybookGeneration(request);
          break;
        case 'playbook_save':
          success = await this.retryPlaybookSave(request);
          break;
        case 'api_call':
          success = await this.retryApiCall(request);
          break;
        default:
          Logger.warn(`Unknown request type: ${request.type}`, {
            component: 'offlineQueue',
          });
          success = false;
      }

      if (success) {
        // Remove from queue
        this.queue = this.queue.filter((r) => r.id !== request.id);

        Logger.info(`✅ Successfully processed queued request: ${request.type}`, {
          component: 'offlineQueue',
        });

        monitoring.trackMetric('offline_queue_success', 1, {
          type: request.type,
          retryCount: request.retryCount,
        });
      } else {
        // Increment retry count
        request.retryCount++;

        if (request.retryCount >= request.maxRetries) {
          // Max retries reached - remove from queue
          this.queue = this.queue.filter((r) => r.id !== request.id);

          Logger.error(
            `❌ Max retries reached for ${request.type}`,
            new Error('Max retries exceeded'),
            { component: 'offlineQueue', data: { id: request.id } }
          );

          monitoring.trackMetric('offline_queue_failed', 1, {
            type: request.type,
            retryCount: request.retryCount,
          });
        } else {
          // Wait before next retry (exponential backoff)
          const delay = this.RETRY_DELAY_BASE * Math.pow(2, request.retryCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      Logger.error(`Error processing queued request: ${request.type}`, error as Error, {
        component: 'offlineQueue',
      });
    }
  }

  // ==========================================================================
  // REQUEST HANDLERS
  // ==========================================================================

  private async retryPlaybookGeneration(request: QueuedRequest): Promise<boolean> {
    try {
      // Import dynamically to avoid circular dependencies
      const { generatePlaybook } = await import('../services/modernPlaybookApi');

      const result = await generatePlaybook(
        request.payload.userInput,
        request.payload.userName
      );

      return !!result;
    } catch (error) {
      Logger.warn('Failed to retry playbook generation', {
        component: 'offlineQueue',
        data: error,
      });
      return false;
    }
  }

  private async retryPlaybookSave(request: QueuedRequest): Promise<boolean> {
    try {
      const { savePlaybook } = await import('../services/modernPlaybookApi');

      const result = await savePlaybook(
        request.payload.playbook,
        request.payload.userId
      );

      return result.success;
    } catch (error) {
      Logger.warn('Failed to retry playbook save', {
        component: 'offlineQueue',
        data: error,
      });
      return false;
    }
  }

  private async retryApiCall(request: QueuedRequest): Promise<boolean> {
    try {
      if (!request.endpoint) {return false;}

      const response = await fetch(request.endpoint, {
        method: request.payload.method || 'POST',
        headers: request.payload.headers || {},
        body: request.payload.body ? JSON.stringify(request.payload.body) : undefined,
      });

      return response.ok;
    } catch (error) {
      Logger.warn('Failed to retry API call', {
        component: 'offlineQueue',
        data: error,
      });
      return false;
    }
  }

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        Logger.info(`📂 Loaded ${this.queue.length} queued requests`, {
          component: 'offlineQueue',
        });
      }
    } catch (error) {
      Logger.error('Failed to load offline queue', error as Error, {
        component: 'offlineQueue',
      });
      this.queue = [];
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      Logger.error('Failed to save offline queue', error as Error, {
        component: 'offlineQueue',
      });
    }
  }

  // ==========================================================================
  // STATISTICS & MANAGEMENT
  // ==========================================================================

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return {
      totalQueued: this.queue.length,
      pendingRetries: this.queue.filter((r) => r.retryCount > 0).length,
      failedPermanently: 0, // Tracked separately
      successfulRetries: 0, // Tracked separately
    };
  }

  /**
   * Get current queue
   */
  getQueue(): QueuedRequest[] {
    return [...this.queue];
  }

  /**
   * Clear entire queue
   */
  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
    Logger.info('🧹 Cleared offline queue', { component: 'offlineQueue' });
  }

  /**
   * Remove specific request
   */
  async removeRequest(id: string): Promise<boolean> {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter((r) => r.id !== id);

    if (this.queue.length < initialLength) {
      await this.saveQueue();
      return true;
    }

    return false;
  }

  /**
   * Check if online
   */
  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Cleanup on app close
   */
  async cleanup(): Promise<void> {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
    await this.saveQueue();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const offlineQueue = new OfflineQueueService();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Queue a playbook generation for retry
 */
export async function queuePlaybookGeneration(
  userInput: string,
  userName: string,
  userId?: string,
  priority: 'low' | 'medium' | 'high' = 'high'
): Promise<string> {
  return offlineQueue.addToQueue({
    type: 'playbook_generation',
    payload: { userInput, userName },
    maxRetries: 3,
    priority,
    userId,
  });
}

/**
 * Queue a playbook save for retry
 */
export async function queuePlaybookSave(
  playbook: any,
  userId: string,
  priority: 'low' | 'medium' | 'high' = 'high'
): Promise<string> {
  return offlineQueue.addToQueue({
    type: 'playbook_save',
    payload: { playbook, userId },
    maxRetries: 5,
    priority,
    userId,
  });
}

/**
 * Check if device is online
 */
export function isOnline(): boolean {
  return offlineQueue.isNetworkOnline();
}
