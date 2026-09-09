/**
 * Enhanced Queue Service
 * Handles 100K+ concurrent users with priority-based processing
 * NO UI changes - pure backend optimization
 */

import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { userContextEngine } from './userContextEngine';
import { faithPointsService } from './faithPointsService';

export interface QueueItem {
  id: string;
  userId: string;
  type: 'playbook' | 'journal_expansion';
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  userInput: string;
  userName: string;
  contextData?: any;
  workerId?: string;
  startedAt?: string;
  completedAt?: string;
  resultData?: any;
  errorMessage?: string;
  estimatedTokens?: number;
  actualTokens?: number;
  processingTimeMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface QueueStatus {
  position: number;
  estimatedWaitTime: number; // seconds
  totalInQueue: number;
  averageProcessingTime: number;
}

export interface ProcessingResult {
  success: boolean;
  content?: string;
  tokensUsed?: number;
  processingTime?: number;
  error?: string;
}

export class EnhancedQueueService {

  // Priority levels by subscription tier
  private readonly PRIORITY_LEVELS = {
    'family': 1,        // Highest priority
    'transformation': 2,
    'growth': 3,
    'spark': 4,
    'free_trial': 5,     // Lowest priority
  };

  // Worker configuration
  private readonly MAX_CONCURRENT_WORKERS = 10;
  private readonly WORKER_TIMEOUT_MS = 120000; // 2 minutes
  private readonly QUEUE_POLL_INTERVAL_MS = 1000; // 1 second

  private isProcessing = false;
  private activeWorkers = new Set<string>();

  /**
   * Add item to queue with priority based on subscription tier
   */
  async addToQueue(
    userId: string,
    type: 'playbook' | 'journal_expansion',
    userInput: string,
    userName: string,
    subscriptionTier: string = 'free_trial'
  ): Promise<string> {

    try {

      // Get user context for enhanced generation
      const context = await userContextEngine.buildUserContext(userId, userName, userInput, type);

      // Determine priority based on subscription tier
      const priority = this.PRIORITY_LEVELS[subscriptionTier as keyof typeof this.PRIORITY_LEVELS] || 5;

      // Estimate token usage for cost tracking
      const estimatedTokens = this.estimateTokenUsage(userInput, context);

      // Insert into queue
      const { data: queueItem, error } = await supabase
        .from('generation_queue')
        .insert({
          user_id: userId,
          type,
          priority,
          status: 'pending',
          user_input: userInput,
          user_name: userName,
          context_data: context,
          estimated_tokens: estimatedTokens,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        Logger.error('[EnhancedQueueService] Error adding to queue', error as Error, {
      component: 'enhancedQueueService',
    });
        throw error;
      }

      // Start processing if not already running
      if (!this.isProcessing) {
        this.startQueueProcessing();
      }

      return queueItem.id;

    } catch (error) {
      Logger.error('[EnhancedQueueService] Error adding to queue', error as Error, {
      component: 'enhancedQueueService',
    });
      throw error;
    }
  }

  /**
   * Get queue status for user
   */
  async getQueueStatus(userId: string): Promise<QueueStatus> {
    try {
      // Get user's pending items
      const { data: userItems } = await supabase
        .from('generation_queue')
        .select('id, priority, created_at')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (!userItems || userItems.length === 0) {
        return {
          position: 0,
          estimatedWaitTime: 0,
          totalInQueue: 0,
          averageProcessingTime: 0,
        };
      }

      const oldestUserItem = userItems[0];

      // Count items ahead in queue (higher priority or same priority but earlier)
      const { data: itemsAhead } = await supabase
        .from('generation_queue')
        .select('id')
        .eq('status', 'pending')
        .or(`priority.lt.${oldestUserItem.priority},and(priority.eq.${oldestUserItem.priority},created_at.lt.${oldestUserItem.created_at})`);

      // Get total queue size
      const { count: totalInQueue } = await supabase
        .from('generation_queue')
        .select('id', { count: 'exact' })
        .eq('status', 'pending');

      // Calculate average processing time from recent completions
      const averageProcessingTime = await this.getAverageProcessingTime();

      const position = (itemsAhead?.length || 0) + 1;
      const estimatedWaitTime = Math.max(0, (position - this.activeWorkers.size) * averageProcessingTime);

      return {
        position,
        estimatedWaitTime,
        totalInQueue: totalInQueue || 0,
        averageProcessingTime,
      };

    } catch (error) {
      Logger.error('[EnhancedQueueService] Error getting queue status', error as Error, {
      component: 'enhancedQueueService',
    });
      return {
        position: 0,
        estimatedWaitTime: 0,
        totalInQueue: 0,
        averageProcessingTime: 30,
      };
    }
  }

  /**
   * Get queue item by ID
   */
  async getQueueItem(queueId: string): Promise<QueueItem | null> {
    try {
      const { data: item } = await supabase
        .from('generation_queue')
        .select('*')
        .eq('id', queueId)
        .single();

      return item ? this.mapDatabaseToQueueItem(item) : null;

    } catch (error) {
      Logger.error('[EnhancedQueueService] Error getting queue item', error as Error, {
      component: 'enhancedQueueService',
    });
      return null;
    }
  }

  /**
   * Start queue processing (runs continuously)
   */
  private async startQueueProcessing(): Promise<void> {
    if (this.isProcessing) {return;}

    this.isProcessing = true;

    while (this.isProcessing) {
      try {
        // Process items if we have available worker slots
        if (this.activeWorkers.size < this.MAX_CONCURRENT_WORKERS) {
          await this.processNextItems();
        }

        // Clean up timed out workers
        await this.cleanupTimedOutWorkers();

        // Wait before next poll
        await this.sleep(this.QUEUE_POLL_INTERVAL_MS);

      } catch (error) {
        Logger.error('[EnhancedQueueService] Error in queue processing', error as Error, {
      component: 'enhancedQueueService',
    });
        await this.sleep(5000); // Wait 5 seconds on error
      }
    }
  }

  /**
   * Process next items in queue
   */
  private async processNextItems(): Promise<void> {
    const availableSlots = this.MAX_CONCURRENT_WORKERS - this.activeWorkers.size;
    if (availableSlots <= 0) {return;}

    try {
      // Get next items to process (ordered by priority, then created_at)
      const { data: items } = await supabase
        .from('generation_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(availableSlots);

      if (!items || items.length === 0) {
        // No items to process, stop processing
        this.isProcessing = false;
        return;
      }

      // Process each item in parallel
      for (const item of items) {
        this.processQueueItem(this.mapDatabaseToQueueItem(item));
      }

    } catch (error) {
      Logger.error('[EnhancedQueueService] Error getting next items', error as Error, {
      component: 'enhancedQueueService',
    });
    }
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(item: QueueItem): Promise<void> {
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Mark as processing
      this.activeWorkers.add(workerId);

      await supabase
        .from('generation_queue')
        .update({
          status: 'processing',
          worker_id: workerId,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      const startTime = Date.now();

      // Generate content based on type
      const result = await this.generateContent(item);

      const processingTime = Date.now() - startTime;

      if (result.success) {
        // Mark as completed
        await supabase
          .from('generation_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result_data: { content: result.content },
            actual_tokens: result.tokensUsed,
            processing_time_ms: processingTime,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        // Store generated content
        await this.storeGeneratedContent(item, result.content!, result.tokensUsed!, processingTime);

        // Award faith points
        await faithPointsService.awardPoints(
          item.userId,
          'playbook_generated',
          { queueId: item.id, processingTime }
        );

      } else {
        // Mark as failed
        await supabase
          .from('generation_queue')
          .update({
            status: 'failed',
            error_message: result.error,
            processing_time_ms: processingTime,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        Logger.error(`[EnhancedQueueService] Failed ${item.type} for user ${item.userId}:`, {
        component: 'enhancedQueueService',
        data: result.error,
      });
      }

    } catch (error) {
      Logger.error(`[EnhancedQueueService] Error processing item ${item.id}:`, {
        component: 'enhancedQueueService',
        data: error,
      });

      // Mark as failed
      await supabase
        .from('generation_queue')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

    } finally {
      // Remove worker from active set
      this.activeWorkers.delete(workerId);
    }
  }

  /**
   * Generate content using Supabase Edge Functions
   * Calls the appropriate generation function based on content type
   */
  private async generateContent(item: QueueItem): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      let response;
      let tokensUsed = 0;

      // Call the appropriate Supabase Edge Function based on type
      switch (item.type) {
        case 'playbook':
          response = await this.generatePlaybook(item);
          tokensUsed = this.estimateTokenUsage(item.userInput, item.contextData);
          break;

        case 'journal_expansion':
          response = await this.generateJournalExpansion(item);
          tokensUsed = this.estimateTokenUsage(item.userInput, item.contextData);
          break;

        default:
          throw new Error(`Unsupported content type: ${item.type}`);
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        content: JSON.stringify(response),
        tokensUsed,
        processingTime,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      Logger.error('[EnhancedQueueService] Content generation failed', error as Error, {
        component: 'enhancedQueueService',
        itemType: item.type,
        userId: item.userId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
        processingTime,
      };
    }
  }

  /**
   * Generate playbook via Supabase Edge Function with timeout and retry
   */
  private async generatePlaybook(item: QueueItem): Promise<any> {
    const maxRetries = 3;
    const timeout = 180000; // 180 seconds (3 minutes) for TestFlight reliability
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        Logger.info(`Generating playbook attempt ${attempt}/${maxRetries}`, {
          component: 'enhancedQueueService',
          data: { userId: item.userId, attempt },
        });

        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        );

        // Race between actual call and timeout
        const result = await Promise.race([
          supabase.functions.invoke('generate-guided-playbook-v146test', {
            body: {
              userInput: item.userInput,
              userName: item.userName,
              userId: item.userId,
            },
          }),
          timeoutPromise,
        ]) as any;

        const { data, error } = result;

        if (error) {
          lastError = error;
          Logger.warn(`Playbook generation failed attempt ${attempt}`, {
            component: 'enhancedQueueService',
            data: { error: error.message, attempt },
          });

          // Don't retry on last attempt
          if (attempt < maxRetries) {
            // Exponential backoff: 2s, 4s, 8s
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            continue;
          }
          throw new Error('We couldn\'t create your playbook right now. Please try again.');
        }

        if (!data) {
          throw new Error('We couldn\'t create your playbook. Please try again.');
        }

        Logger.info(`Playbook generated successfully on attempt ${attempt}`, {
          component: 'enhancedQueueService',
          data: { userId: item.userId, attempt },
        });

        return data;
      } catch (error: any) {
        lastError = error;
        Logger.warn(`Playbook generation error attempt ${attempt}`, {
          component: 'enhancedQueueService',
          data: { error: error.message, attempt },
        });

        // Don't retry on last attempt
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }

        throw new Error('We couldn\'t create your playbook right now. Please try again.');
      }
    }

    throw lastError || new Error('Failed to generate playbook after all retries');
  }

  /**
   * Generate journal expansion via appropriate Edge Function
   * TODO: Implement when journal expansion Edge Function is created
   */
  private async generateJournalExpansion(_item: QueueItem): Promise<any> {
    // For now, throw an error as this feature is not yet implemented
    throw new Error('This feature is coming soon. Stay tuned!');

    // Future implementation:
    // const { data, error } = await supabase.functions.invoke('expand-journal-entry', {
    //   body: {
    //     entryId: item.contextData?.entryId,
    //     userInput: item.userInput,
    //     userName: item.userName,
    //   },
    // });
    //
    // if (error) {
    //   throw new Error(`Journal expansion failed: ${error.message}`);
    // }
    //
    // return data;
  }

  /**
   * Store generated content in database
   */
  private async storeGeneratedContent(
    item: QueueItem,
    content: string,
    tokensUsed: number,
    processingTime: number
  ): Promise<void> {
    try {
      await supabase
        .from('generated_content')
        .insert({
          user_id: item.userId,
          content_type: item.type,
          title: this.extractTitle(content),
          content,
          user_input: item.userInput,
          metadata: {
            queue_id: item.id,
            context_confidence: item.contextData?.confidenceScore || 0,
          },
          generation_time_ms: processingTime,
          tokens_used: tokensUsed,
          cost_cents: Math.ceil(tokensUsed * 0.002), // Rough cost estimate
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      Logger.error('[EnhancedQueueService] Error storing content', error as Error, {
      component: 'enhancedQueueService',
    });
    }
  }

  /**
   * Helper methods
   */
  private async getAverageProcessingTime(): Promise<number> {
    try {
      const { data: recentItems } = await supabase
        .from('generation_queue')
        .select('processing_time_ms')
        .eq('status', 'completed')
        .not('processing_time_ms', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(50);

      if (!recentItems || recentItems.length === 0) {return 30;} // Default 30 seconds

      const avgTime = recentItems.reduce((sum, item) => sum + (item.processing_time_ms || 0), 0) / recentItems.length;
      return Math.ceil(avgTime / 1000); // Convert to seconds

    } catch (error) {
      return 30; // Default fallback
    }
  }

  private async cleanupTimedOutWorkers(): Promise<void> {
    try {
      const timeoutThreshold = new Date(Date.now() - this.WORKER_TIMEOUT_MS).toISOString();

      await supabase
        .from('generation_queue')
        .update({
          status: 'failed',
          error_message: 'Worker timeout',
          updated_at: new Date().toISOString(),
        })
        .eq('status', 'processing')
        .lt('started_at', timeoutThreshold);

    } catch (error) {
      Logger.error('[EnhancedQueueService] Error cleaning up timed out workers', error as Error, {
      component: 'enhancedQueueService',
    });
    }
  }

  private estimateTokenUsage(userInput: string, context: any): number {
    // Rough estimation based on input length and context complexity
    const baseTokens = Math.ceil(userInput.length / 4); // ~4 chars per token
    const contextTokens = context?.confidenceScore ? Math.ceil(context.confidenceScore * 2) : 50;
    const outputTokens = 500; // Estimated output length

    return baseTokens + contextTokens + outputTokens;
  }

  private getBasePrompt(type: string): string {
    const prompts = {
      playbook: 'Create a detailed spiritual growth playbook with actionable steps.',
      journal_expansion: 'Expand on this journal entry with spiritual insights.',
    };

    return prompts[type as keyof typeof prompts] || prompts.playbook;
  }

  private extractTitle(content: string): string {
    // Extract title from first line or first 50 characters
    const firstLine = content.split('\n')[0];
    return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
  }

  private mapDatabaseToQueueItem(dbItem: any): QueueItem {
    return {
      id: dbItem.id,
      userId: dbItem.user_id,
      type: dbItem.type,
      priority: dbItem.priority,
      status: dbItem.status,
      userInput: dbItem.user_input,
      userName: dbItem.user_name,
      contextData: dbItem.context_data,
      workerId: dbItem.worker_id,
      startedAt: dbItem.started_at,
      completedAt: dbItem.completed_at,
      resultData: dbItem.result_data,
      errorMessage: dbItem.error_message,
      estimatedTokens: dbItem.estimated_tokens,
      actualTokens: dbItem.actual_tokens,
      processingTimeMs: dbItem.processing_time_ms,
      createdAt: dbItem.created_at,
      updatedAt: dbItem.updated_at,
    };
  }


  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const enhancedQueueService = new EnhancedQueueService();
