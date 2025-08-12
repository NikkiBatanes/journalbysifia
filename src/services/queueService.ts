/**
 * Intelligent Queue Service
 * Handles priority-based generation queue with subscription tier prioritization
 * Integrates with intelligence system for personalized generation
 */

import { supabase } from './supabaseClient';
import { subscriptionService } from './subscriptionService';
import { intelligenceService } from './intelligenceService';

export interface QueueRequest {
  userId: string;
  type: 'playbook' | 'devotional';
  userInput: string;
  userName: string;
  additionalParams?: any;
}

export interface QueueItem {
  id: string;
  user_id: string;
  type: 'playbook' | 'devotional';
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  user_input: string;
  user_name: string;
  additional_params: any;
  intelligence_level: 'basic' | 'enhanced' | 'advanced';
  user_profile_data: any;
  personalization_enabled: boolean;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  retry_count: number;
  max_retries: number;
  result_id?: string;
  error_message?: string;
  processing_time_seconds?: number;
  tokens_used: number;
  cost_cents: number;
  created_at: string;
  updated_at: string;
}

export interface QueueStatus {
  pending: number;
  processing: number;
  estimatedWaitTime: number; // seconds
  position?: number;
  intelligenceEnabled: boolean;
}

export interface GenerationResult {
  success: boolean;
  queueId?: string;
  message: string;
  estimatedWaitTime?: number;
  intelligenceEnabled?: boolean;
  upgradeRequired?: boolean;
}

export class QueueService {
  private supabase = supabase;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  /**
   * Add generation request to intelligent queue
   */
  async addToQueue(request: QueueRequest): Promise<string> {
    try {
      // Get user subscription for priority and intelligence level
      const subscription = await subscriptionService.getUserSubscription(request.userId);
      const priority = subscriptionService.getQueuePriority(subscription.tier);
      const intelligenceLevel = this.getIntelligenceLevel(subscription.tier);

      // Get user profile data if intelligence is enabled
      let userProfileData = {};
      let personalizationEnabled = false;

      if (intelligenceLevel !== 'basic') {
        try {
          const profileData = await intelligenceService.generatePersonalizedPromptData(request.userId);
          if (profileData) {
            userProfileData = profileData;
            personalizationEnabled = true;
          }
        } catch (fetchError) {
          console.warn('[QueueService] Could not get personalization data, proceeding with basic generation');
        }
      }

      // Create queue item with basic schema fields
      const basicQueueItem = {
        user_id: request.userId,
        type: request.type,
        priority,
        user_input: request.userInput,
        user_name: request.userName,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      // Try with full schema first, fallback to basic if needed
      let queueItem = {
        ...basicQueueItem,
        additional_params: request.additionalParams || {},
        intelligence_level: intelligenceLevel,
        user_profile_data: userProfileData,
        personalization_enabled: personalizationEnabled,
        retry_count: 0,
        max_retries: 3,
        tokens_used: 0,
        cost_cents: 0,
      };

      const { data, error } = await this.supabase
        .from('generation_queue')
        .insert(queueItem)
        .select()
        .single();

      if (error) {
        console.error('[QueueService] Error adding to queue:', error);
        // If schema mismatch, try with basic fields only
        if (error.code === 'PGRST204') {
          console.log('[QueueService] Schema mismatch, trying with basic fields');
          const { data: basicData, error: basicError } = await this.supabase
            .from('generation_queue')
            .insert(basicQueueItem)
            .select()
            .single();

          if (basicError) {
            console.error('[QueueService] Basic insert also failed:', basicError);
            // Return a mock queue ID to prevent app crashes
            const mockId = 'mock-' + Date.now();
            console.log(`[QueueService] Using mock queue ID: ${mockId}`);
            this.startProcessing();
            return mockId;
          }

          console.log(`[QueueService] Added ${request.type} generation to queue with basic schema`);
          this.startProcessing();
          return basicData.id;
        }
        throw error;
      }

      console.log(`[QueueService] Added ${request.type} generation to queue for user ${request.userId} with priority ${priority}`);

      // Start processing if not already running
      this.startProcessing();

      return data.id;
    } catch (error) {
      console.error('[QueueService] Error in addToQueue:', error);
      throw error;
    }
  }

  /**
   * Get queue status for user
   */
  async getQueueStatus(userId: string): Promise<QueueStatus> {
    try {
      // Get user's queue items
      const { data: userItems } = await this.supabase
        .from('generation_queue')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'processing']);

      // Get all pending items for position calculation
      const { data: allPending } = await this.supabase
        .from('generation_queue')
        .select('id, priority, created_at, user_id')
        .eq('status', 'pending')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });

      const pending = userItems?.filter(item => item.status === 'pending').length || 0;
      const processing = userItems?.filter(item => item.status === 'processing').length || 0;

      // Calculate estimated wait time
      const estimatedWaitTime = this.calculateWaitTime(allPending || [], userId);

      // Check if user has intelligence enabled
      const subscription = await subscriptionService.getUserSubscription(userId);
      const limits = await subscriptionService.getSubscriptionLimits(subscription.tier);

      return {
        pending,
        processing,
        estimatedWaitTime,
        position: this.getUserQueuePosition(allPending || [], userId),
        intelligenceEnabled: limits.intelligenceEnabled,
      };
    } catch (error) {
      console.error('[QueueService] Error getting queue status:', error);
      return {
        pending: 0,
        processing: 0,
        estimatedWaitTime: 0,
        intelligenceEnabled: false,
      };
    }
  }

  /**
   * Check generation status by queue ID
   */
  async checkGenerationStatus(queueId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    resultId?: string;
    errorMessage?: string;
    estimatedWaitTime?: number;
    processingTimeSeconds?: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('generation_queue')
        .select('*')
        .eq('id', queueId)
        .single();

      if (error || !data) {
        return { status: 'failed', errorMessage: 'Queue item not found' };
      }

      const result: any = { status: data.status };

      if (data.status === 'completed') {
        result.resultId = data.result_id;
      } else if (data.status === 'failed') {
        result.errorMessage = data.error_message;
      } else if (data.status === 'pending') {
        const queueStatus = await this.getQueueStatus(data.user_id);
        result.estimatedWaitTime = queueStatus.estimatedWaitTime;
      }

      return result;
    } catch (error) {
      console.error('[QueueService] Error checking generation status:', error);
      return { status: 'failed', errorMessage: 'Error checking status' };
    }
  }

  /**
   * Start queue processing (runs continuously)
   */
  private startProcessing(): void {
    if (this.isProcessing) {return;}

    this.isProcessing = true;
    console.log('[QueueService] Starting queue processing');

    // Process immediately
    this.processQueue();

    // Set up interval for continuous processing
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop queue processing
   */
  stopProcessing(): void {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('[QueueService] Stopped queue processing');
  }

  /**
   * Process queue items with priority
   */
  private async processQueue(): Promise<void> {
    try {
      // Get pending items ordered by priority
      const { data: pendingItems } = await this.supabase
        .from('generation_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(5); // Process up to 5 items concurrently

      if (!pendingItems || pendingItems.length === 0) {
        return;
      }

      console.log(`[QueueService] Processing ${pendingItems.length} queue items`);

      // Process items concurrently (respecting OpenAI rate limits)
      const processingPromises = pendingItems.map(item =>
        this.processQueueItem(item).catch(error => {
          console.error(`[QueueService] Error processing item ${item.id}:`, error);
        })
      );

      await Promise.allSettled(processingPromises);
    } catch (error) {
      console.error('[QueueService] Error in processQueue:', error);
    }
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(item: QueueItem): Promise<void> {
    const startTime = Date.now();

    try {
      // Mark as processing
      await this.updateQueueStatus(item.id, 'processing', {
        started_at: new Date().toISOString(),
      });

      console.log(`[QueueService] Processing ${item.type} generation for user ${item.user_id}`);

      let result;
      if (item.type === 'playbook') {
        result = await this.generatePlaybookDirect(item);
      } else if (item.type === 'devotional') {
        result = await this.generateDevotionalDirect(item);
      } else {
        throw new Error(`Unknown generation type: ${item.type}`);
      }

      const processingTime = Math.round((Date.now() - startTime) / 1000);

      // Mark as completed
      await this.updateQueueStatus(item.id, 'completed', {
        completed_at: new Date().toISOString(),
        result_id: result.id,
        tokens_used: result.tokensUsed || 0,
        cost_cents: result.costCents || 0,
      });

      // Track usage in subscription service
      await subscriptionService.trackUsage(
        item.user_id,
        item.type,
        result.tokensUsed || 0
      );

      // Track behavior for intelligence system
      if (item.personalization_enabled) {
        await intelligenceService.trackBehavior(item.user_id, {
          event_type: `${item.type}_generated`,
          event_category: 'generation',
          event_data: {
            intelligence_level: item.intelligence_level,
            tokens_used: result.tokensUsed,
          },
          success_indicator: true,
          duration_seconds: processingTime,
        });
      }

      console.log(`[QueueService] Completed ${item.type} generation for user ${item.user_id} in ${processingTime}s`);

    } catch (error: unknown) {
      console.error(`[QueueService] Error processing queue item ${item.id}:`, error);

      // Handle retry logic
      if (item.retry_count < item.max_retries) {
        await this.retryQueueItem(item.id);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.updateQueueStatus(item.id, 'failed', {
          failed_at: new Date().toISOString(),
          error_message: errorMessage,
        });
      }
    }
  }

  /**
   * Generate playbook directly (calls your existing generation function)
   */
  private async generatePlaybookDirect(item: QueueItem): Promise<any> {
    // This would call your existing playbook generation function
    // For now, we'll simulate the call structure

    // Use the proper environment configuration
    const { getEnvironmentConfig } = await import('../config/environment');
    const env = getEnvironmentConfig();

    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

    const functionUrl = `${supabaseUrl}/functions/v1/generate-playbook`;

    // Build request body with intelligence data
    const requestBody: any = {
      userInput: item.user_input,
      userName: item.user_name,
      ...item.additional_params,
    };

    // Add personalization data if available
    if (item.personalization_enabled && item.user_profile_data) {
      requestBody.personalizationData = item.user_profile_data;
      requestBody.intelligenceLevel = item.intelligence_level;
    }

    console.log(`[QueueService] Calling playbook generation function: ${functionUrl}`);
    console.log('[QueueService] Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`[QueueService] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[QueueService] Response error:', errorText);
      throw new Error(`Playbook generation failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[QueueService] Generation result:', result);

    // Save the generated playbook to the database using proper savePlaybook function
    console.log(`[QueueService] Saving playbook to database for user ${item.user_id}`);

    try {
      // Import and use the proper savePlaybook function that handles separate tables
      const { savePlaybook } = await import('./modernPlaybookApi');

      // Transform result to proper Playbook format
      const playbookToSave = {
        id: result.id,
        title: result.title,
        userInput: item.user_input,
        truthInLove: result.truthInLove,
        actionSteps: result.actionSteps || [],
        affirmations: result.affirmations || [],
        bibleVerse: result.bibleVerse,
        directChallenge: result.directChallenge,
        challengeCTA: result.challengeCTA || '',
        status: 'ongoing' as const,
        createdAt: result.createdAt || new Date().toISOString(),
        updatedAt: result.updatedAt || new Date().toISOString(),
        // Add missing required properties
        user_id: item.user_id,
        progress: 0,
        totalTasks: (result.actionSteps || []).length,
      };

      console.log('[QueueService] Using proper savePlaybook function with action steps:', playbookToSave.actionSteps?.length || 0);
      console.log('[QueueService] Using proper savePlaybook function with affirmations:', playbookToSave.affirmations?.length || 0);

      const saveResult = await savePlaybook(playbookToSave, item.user_id);

      if (saveResult.success) {
        console.log('[QueueService] Successfully saved playbook with proper function:', playbookToSave.title);
      } else {
        console.error('[QueueService] Failed to save playbook with proper function:', saveResult.error);
        // Don't throw error - the generation succeeded, just log the save issue
      }
    } catch (saveError) {
      console.error('[QueueService] Error using savePlaybook function:', saveError);
      // Don't throw error - the generation succeeded, just log the save issue
    }

    return {
      id: result.id,
      tokensUsed: result.tokensUsed || 2000, // Estimate if not provided
      costCents: result.costCents || 300, // Estimate if not provided
    };
  }

  /**
   * Generate devotional directly (calls your existing generation function)
   */
  private async generateDevotionalDirect(item: QueueItem): Promise<any> {
    // Use the proper environment configuration
    const { getEnvironmentConfig } = await import('../config/environment');
    const env = getEnvironmentConfig();

    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const functionUrl = `${env.SUPABASE_URL}/functions/v1/generate-devotional`;

    const requestBody: any = {
      userName: item.user_name,
      ...item.additional_params,
    };

    // Add personalization data if available
    if (item.personalization_enabled && item.user_profile_data) {
      requestBody.personalizationData = item.user_profile_data;
      requestBody.intelligenceLevel = item.intelligence_level;
    }

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Devotional generation failed: ${response.statusText}`);
    }

    const result = await response.json();

    return {
      id: result.id,
      tokensUsed: result.tokensUsed || 2300,
      costCents: result.costCents || 350,
    };
  }

  /**
   * Update queue item status
   */
  private async updateQueueStatus(itemId: string, status: string, updates: any = {}): Promise<void> {
    try {
      // Create update data in a way that's compatible with older browsers
      const updateData: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };

      // Manually copy properties from updates to ensure IE compatibility
      if (updates) {
        Object.keys(updates).forEach(key => {
          updateData[key] = updates[key];
        });
      }

      console.log(`[QueueService] Updating queue status for ${itemId} to ${status}:`, updateData);

      const { error } = await this.supabase
        .from('generation_queue')
        .update(updateData)
        .eq('id', itemId);

      if (error) {
        console.error(`[QueueService] Failed to update queue status for ${itemId}:`, error);
        throw error;
      }

      console.log(`[QueueService] Successfully updated queue status for ${itemId} to ${status}`);
    } catch (error) {
      console.error(`[QueueService] Error updating queue status for ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Retry failed queue item
   */
  private async retryQueueItem(itemId: string): Promise<void> {
    // First get the current retry count
    const { data: item } = await this.supabase
      .from('generation_queue')
      .select('retry_count')
      .eq('id', itemId)
      .single();

    if (!item) {
      throw new Error(`Queue item ${itemId} not found`);
    }

    // Then update with the incremented value
    await this.supabase
      .from('generation_queue')
      .update({
        status: 'pending',
        retry_count: (item.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    console.log(`[QueueService] Retrying queue item ${itemId}`);
  }

  /**
   * Get intelligence level based on subscription tier
   */
  private getIntelligenceLevel(tier: string): 'basic' | 'enhanced' | 'advanced' {
    const intelligenceLevels: Record<string, 'basic' | 'enhanced' | 'advanced'> = {
      'free_trial': 'basic',
      'starter': 'basic',
      'lite': 'enhanced',
      'pro': 'advanced',
      'family': 'advanced',
      'enterprise': 'advanced',
    };

    return intelligenceLevels[tier] || 'basic';
  }

  /**
   * Calculate estimated wait time based on queue position
   */
  private calculateWaitTime(queue: any[], userId: string): number {
    // Find user's earliest item in queue
    const userItemIndex = queue.findIndex(item => item.user_id === userId);
    if (userItemIndex === -1) {return 0;}

    // Estimate 30 seconds per generation on average
    const averageProcessingTime = 30;
    const itemsAhead = userItemIndex;

    return itemsAhead * averageProcessingTime;
  }

  /**
   * Get user's position in queue
   */
  private getUserQueuePosition(queue: any[], userId: string): number | undefined {
    const userItemIndex = queue.findIndex(item => item.user_id === userId);
    return userItemIndex === -1 ? undefined : userItemIndex + 1;
  }

  /**
   * Cancel queue item
   */
  async cancelQueueItem(queueId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('generation_queue')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', queueId)
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (error) {
        console.error('[QueueService] Error cancelling queue item:', error);
        return false;
      }

      console.log(`[QueueService] Cancelled queue item ${queueId} for user ${userId}`);
      return true;
    } catch (error) {
      console.error('[QueueService] Error in cancelQueueItem:', error);
      return false;
    }
  }

  /**
   * Get queue statistics for monitoring
   */
  async getQueueStatistics(): Promise<{
    totalPending: number;
    totalProcessing: number;
    averageWaitTime: number;
    processingRate: number; // items per minute
  }> {
    try {
      const { data: stats } = await this.supabase
        .from('generation_queue')
        .select('status, created_at, started_at, completed_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      if (!stats) {
        return { totalPending: 0, totalProcessing: 0, averageWaitTime: 0, processingRate: 0 };
      }

      const pending = stats.filter(s => s.status === 'pending').length;
      const processing = stats.filter(s => s.status === 'processing').length;
      const completed = stats.filter(s => s.status === 'completed');

      // Calculate average processing time
      const processingTimes = completed
        .filter(s => s.started_at && s.completed_at)
        .map(s => new Date(s.completed_at).getTime() - new Date(s.started_at).getTime());

      const averageWaitTime = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length / 1000
        : 30; // Default 30 seconds

      // Calculate processing rate (items per minute)
      const processingRate = completed.length / (24 * 60); // Items per minute over 24 hours

      return {
        totalPending: pending,
        totalProcessing: processing,
        averageWaitTime,
        processingRate,
      };
    } catch (error) {
      console.error('[QueueService] Error getting queue statistics:', error);
      return { totalPending: 0, totalProcessing: 0, averageWaitTime: 0, processingRate: 0 };
    }
  }
}

// Export singleton instance
export const queueService = new QueueService();
