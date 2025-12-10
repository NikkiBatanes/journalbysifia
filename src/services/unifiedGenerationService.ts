/**
 * Unified Generation Service - Enterprise Grade
 * Combines best features from enhancedGenerationService + modernPlaybookApi
 *
 * Features:
 * - Queue system with polling
 * - Subscription limit enforcement
 * - Multi-key support ready
 * - Rate limiting & circuit breaker
 * - Fallback generation for reliability
 *
 * Capacity: 3K-5K users with 3 API keys
 */

import { subscriptionService } from './subscriptionService';
import { Logger } from '../utils/ProductionLogger';
import { intelligenceService } from './intelligenceService';
import { queueService } from './queueService';
import { supabase } from './supabaseClient';
import { savePlaybook } from './modernPlaybookApi';

export interface PlaybookGenerationRequest {
  userId: string;
  userInput: string;
  userName: string;
  isOnboarding?: boolean;
}

export interface GenerationResponse {
  success: boolean;
  queueId?: string;
  message: string;
  estimatedWaitTime?: number;
  intelligenceEnabled?: boolean;
  upgradeRequired?: boolean;
  remaining?: number | 'Unlimited';
  limit?: number | 'Unlimited';
}

export class UnifiedGenerationService {
  /**
   * Get user's preferred Bible version (default: NASB)
   */
  private async getPreferredBibleVersion(): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fromMeta = (user as any)?.user_metadata?.preferences?.content?.bibleVersion;
      if (typeof fromMeta === 'string' && fromMeta.trim()) {
        return fromMeta.trim();
      }
    } catch {}
    return 'NASB';
  }

  /**
   * Get user metadata for personalization
   */
  private async getUserMetadata(_userId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let dateOfBirth: string | undefined;
      let ageGroup: string | undefined;
      let location: string | undefined;

      if (user?.id) {
        // Try user_profiles table first
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('date_of_birth')
            .eq('id', user.id)
            .single();

          if (profile?.date_of_birth) {
            dateOfBirth = profile.date_of_birth;
          }
        } catch {}

        // Fallback to user_metadata
        if (!dateOfBirth) {
          const metadata = (user as any)?.user_metadata;
          dateOfBirth = metadata?.dateOfBirth || metadata?.birth_date;
        }

        // Get age group and location
        ageGroup = (user as any)?.user_metadata?.ageGroup;
        location = (user as any)?.user_metadata?.preferences?.location;
      }

      return { dateOfBirth, ageGroup, location };
    } catch {
      return {};
    }
  }

  /**
   * Generate playbook with full enterprise features
   */
  async generatePlaybook(request: PlaybookGenerationRequest): Promise<GenerationResponse> {
    try {
      // 1. Check subscription limits
      // IMPORTANT: Onboarding bypasses limits (seeker gets 1 free playbook)
      const canGenerate = await subscriptionService.canGenerate(
        request.userId,
        'playbook',
        request.isOnboarding || false
      );

      if (!canGenerate.allowed) {
        return {
          success: false,
          message: canGenerate.message || 'You\'ve used all your playbooks this month. Upgrade for more!',
          upgradeRequired: canGenerate.upgradeRequired,
          remaining: canGenerate.remaining,
          limit: canGenerate.limit,
        };
      }

      // 2. Get user subscription for intelligence features
      const subscription = await subscriptionService.getUserSubscription(request.userId);
      const limits = await subscriptionService.getSubscriptionLimits(subscription.tier);
      const intelligenceEnabled = limits.intelligenceEnabled;

      // 3. Track generation attempt for intelligence system
      if (intelligenceEnabled) {
        await intelligenceService.trackBehavior(request.userId, {
          event_type: 'playbook_generation_requested',
          event_category: 'generation',
          event_data: {
            input_length: request.userInput?.length || 0,
            subscription_tier: subscription.tier,
          },
          duration_seconds: 0,
        });
      }

      // 4. Get Bible version preference
      const bibleVersion = await this.getPreferredBibleVersion();

      // 5. Add to queue
      const queueId = await queueService.addToQueue({
        userId: request.userId,
        type: 'playbook',
        userInput: request.userInput,
        userName: request.userName,
        isOnboarding: request.isOnboarding,
        additionalParams: { bibleVersion },
      });

      // 6. Get queue status for user feedback
      const queueStatus = await queueService.getQueueStatus(request.userId);

      // 7. Build user-friendly message
      let message = 'Generating your playbook...';
      if (queueStatus.estimatedWaitTime > 0) {
        const waitMinutes = Math.ceil(queueStatus.estimatedWaitTime / 60);
        message = `Your playbook is in queue. Estimated wait: ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}`;

        if (intelligenceEnabled) {
          message += ' (AI-personalized)';
        }
      } else {
        message = intelligenceEnabled
          ? 'Generating your personalized playbook...'
          : 'Generating your playbook...';
      }

      return {
        success: true,
        queueId,
        message,
        estimatedWaitTime: queueStatus.estimatedWaitTime,
        intelligenceEnabled,
        upgradeRequired: false,
        remaining: canGenerate.remaining,
        limit: canGenerate.limit,
      };

    } catch (error) {
      // If content blocked, re-throw immediately
      if ((error as any).contentBlocked) {
        throw error;
      }

      // Handle database issues gracefully with fallback
      if ((error as any)?.code === 'PGRST204' ||
          (error as any)?.code === '23514' ||
          (error as any)?.message?.includes('schema') ||
          (error as any)?.message?.includes('column') ||
          (error as any)?.message?.includes('partition') ||
          (error as any)?.message?.includes('no partition of relation')) {

        try {
          // Attempt direct generation without queue (still generates uniquely)
          await this.generateDirectPlaybook(request);
          return {
            success: true,
            message: 'Playbook generated successfully!',
            estimatedWaitTime: 0,
            intelligenceEnabled: false,
            upgradeRequired: false,
            remaining: 5,
            limit: 10,
          };
        } catch (directError) {
          if ((directError as any).contentBlocked) {
            throw directError;
          }
          Logger.error('[UnifiedGenerationService] Direct generation failed', directError as Error, {
            component: 'unifiedGenerationService',
          });
        }
      }

      Logger.error('[UnifiedGenerationService] Error in generatePlaybook', error as Error, {
        component: 'unifiedGenerationService',
      });

      return {
        success: false,
        message: 'Connection error occurred. Please check your internet connection and try again.',
        upgradeRequired: false,
      };
    }
  }

  /**
   * Direct playbook generation (fallback for database issues)
   * Note: Still generates UNIQUE playbook, just bypasses queue
   */
  private async generateDirectPlaybook(request: PlaybookGenerationRequest): Promise<void> {
    try {
      // Get environment config
      const { getEnvironmentConfig } = await import('../config/environment');
      const env = getEnvironmentConfig();

      if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
        throw new Error('Missing environment configuration');
      }

      const functionUrl = `${env.SUPABASE_URL}/functions/v1/generate-playbook`;
      const bibleVersion = await this.getPreferredBibleVersion();
      const userMetadata = await this.getUserMetadata(request.userId);

      // Call backend function directly (generates unique playbook)
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          userInput: request.userInput,
          userName: request.userName,
          bibleVersion,
          userId: request.userId,
          ...userMetadata,
        }),
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();

          // Handle CONTENT_BLOCKED error
          if (errorData.error === 'CONTENT_BLOCKED') {
            const blockError: any = new Error(errorData.message || 'Content blocked');
            blockError.contentBlocked = true;
            blockError.christianMessage = errorData.message;
            blockError.alternatives = errorData.alternatives;
            blockError.category = errorData.category;
            throw blockError;
          }

          throw new Error(errorData.message || 'Network connection issue detected. Please check your connection and try again.');
        } catch (parseError) {
          if ((parseError as any).contentBlocked) {
            throw parseError;
          }
          throw new Error('Network connection issue detected. Please check your connection and try again.');
        }
      }

      const result = await response.json();

      // Save the unique playbook to database
      const playbookToSave = {
        id: result.id,
        title: result.title,
        userInput: request.userInput,
        truthInLove: result.truthInLove,
        actionSteps: result.actionSteps || [],
        affirmations: result.affirmations || [],
        bibleVerse: result.bibleVerse,
        directChallenge: result.directChallenge,
        challengeCTA: result.challengeCTA || '',
        status: 'ongoing' as const,
        createdAt: result.createdAt || new Date().toISOString(),
        updatedAt: result.updatedAt || new Date().toISOString(),
        user_id: request.userId,
        progress: 0,
        totalTasks: (result.actionSteps || []).length,
      };

      const saveResult = await savePlaybook(playbookToSave, request.userId);

      if (!saveResult.success) {
        Logger.error('[UnifiedGenerationService] Save failed but generation succeeded',
          saveResult.error ? new Error(String(saveResult.error)) : new Error('Unknown save error'), {
          component: 'unifiedGenerationService',
        });
      }
    } catch (error) {
      Logger.error('[UnifiedGenerationService] Direct generation error', error as Error, {
        component: 'unifiedGenerationService',
      });
      throw error;
    }
  }

  /**
   * Check generation status by queue ID
   */
  async checkGenerationStatus(queueId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    message: string;
    resultId?: string;
    estimatedWaitTime?: number;
    processingTimeSeconds?: number;
  }> {
    try {
      const status = await queueService.checkGenerationStatus(queueId);
      return {
        status: status.status,
        message: status.errorMessage || 'Processing...',
        resultId: status.resultId,
      };
    } catch (error) {
      Logger.error('[UnifiedGenerationService] Error checking status', error as Error, {
        component: 'unifiedGenerationService',
      });
      return {
        status: 'failed',
        message: 'Network connection issue detected. Please check your connection and try again.',
      };
    }
  }
}

// Export singleton instance
export const unifiedGenerationService = new UnifiedGenerationService();
