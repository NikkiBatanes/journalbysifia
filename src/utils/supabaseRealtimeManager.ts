/**
 * Supabase Realtime Manager
 * Handles WebSocket connections cleanup to prevent NSInternalInconsistencyException
 */

import { supabase } from '../services/supabaseClient';
import { Logger } from './ProductionLogger';

class SupabaseRealtimeManager {
  private activeChannels: any[] = [];
  private isShuttingDown = false;

  /**
   * Clean up all subscriptions (call on app background/unmount)
   */
  cleanupAllSubscriptions() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    const channelCount = this.activeChannels.length;

    try {
      // Remove all active channels
      this.activeChannels.forEach(channel => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      });

      // Clear the array
      this.activeChannels = [];

      Logger.debug(`[Realtime] Cleaned up ${channelCount} WebSocket channels`, {
        component: 'supabaseRealtimeManager',
      });
    } catch (error) {
      Logger.error('[Realtime] Error cleaning up WebSocket channels', error as Error, {
        component: 'supabaseRealtimeManager',
      });
    }

    this.isShuttingDown = false;
  }

  /**
   * Register a channel for tracking
   */
  registerChannel(channel: any) {
    if (channel && !this.activeChannels.includes(channel)) {
      this.activeChannels.push(channel);
    }
  }

  /**
   * Unregister a specific channel
   */
  unregisterChannel(channel: any) {
    const index = this.activeChannels.indexOf(channel);
    if (index > -1) {
      this.activeChannels.splice(index, 1);
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        Logger.error('[Realtime] Error removing channel', error as Error, {
          component: 'supabaseRealtimeManager',
        });
      }
    }
  }

  /**
   * Get active channel count
   */
  getActiveChannelCount(): number {
    return this.activeChannels.length;
  }
}

// Export singleton instance
export const realtimeManager = new SupabaseRealtimeManager();

export default realtimeManager;
