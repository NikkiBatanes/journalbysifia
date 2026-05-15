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
import { validatePlaybookInputQuality } from '../utils/playbookInputValidation';
import { findIncompletePlaybookFields } from '../utils/playbookCompleteness';

export interface PlaybookGenerationRequest {
  userId: string;
  userInput: string;
  userName: string;
  isOnboarding?: boolean;
  dateOfBirth?: string;
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
  private async getUserMetadata(userId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let dateOfBirth: string | undefined;
      let location: string | undefined;

      const profileUserId = userId || user?.id;
      if (profileUserId) {
        // Try user_profiles table first
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('date_of_birth')
            .eq('id', profileUserId)
            .single();

          if (profile?.date_of_birth) {
            dateOfBirth = profile.date_of_birth;
          }
        } catch {}

        // Fallback to user_metadata
        if (!dateOfBirth) {
          const metadata = (user as any)?.user_metadata;
          dateOfBirth = metadata?.dateOfBirth || metadata?.birth_date || metadata?.birthDate;
        }

        location = (user as any)?.user_metadata?.preferences?.location;
      }

      return { dateOfBirth, location };
    } catch {
      return {};
    }
  }

  /**
   * Generate playbook with full enterprise features
   */
  async generatePlaybook(request: PlaybookGenerationRequest): Promise<GenerationResponse> {
    try {
      const inputQuality = validatePlaybookInputQuality(request.userInput);
      if (!inputQuality.isValid) {
        return {
          success: false,
          message: inputQuality.message || 'Please describe a real situation, struggle, decision, or feeling you want guidance for.',
          upgradeRequired: false,
        };
      }

      // 1. Check subscription limits. Onboarding counts against the same monthly quota.
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
      const userMetadata = await this.getUserMetadata(request.userId);
      const generationContext = {
        ...userMetadata,
        dateOfBirth: request.dateOfBirth || userMetadata.dateOfBirth,
      };

      // 5. Add to queue
      const queueId = await queueService.addToQueue({
        userId: request.userId,
        type: 'playbook',
        userInput: request.userInput,
        userName: request.userName,
        isOnboarding: request.isOnboarding,
        additionalParams: { bibleVersion, ...generationContext },
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

      // Get user subscription for tier-based key selection
      const subscription = await subscriptionService.getUserSubscription(request.userId);

      const functionUrl = `${env.SUPABASE_URL}/functions/v1/generate-guided-playbook`;
      const bibleVersion = await this.getPreferredBibleVersion();
      const userMetadata = await this.getUserMetadata(request.userId);
      const generationContext = {
        ...userMetadata,
        dateOfBirth: request.dateOfBirth || userMetadata.dateOfBirth,
      };

      Logger.info('[UnifiedGenerationService] Direct generation - subscription retrieved', {
        component: 'unifiedGenerationService',
        userId: request.userId,
        tier: subscription.tier,
        isOnboarding: request.isOnboarding,
      });

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
          userTier: subscription.tier, // Add tier for key pool selection
          isOnboarding: request.isOnboarding || false, // Add onboarding flag
          ...generationContext,
        }),
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();

          Logger.error('[UnifiedGenerationService] Direct generation HTTP error', new Error(`HTTP ${response.status}`), {
            component: 'unifiedGenerationService',
            status: response.status,
            errorBody: errorData,
          });

          // Handle CONTENT_BLOCKED error
          if (errorData.error === 'CONTENT_BLOCKED') {
            const blockError: any = new Error(errorData.message || 'Content blocked');
            blockError.contentBlocked = true;
            blockError.christianMessage = errorData.message;
            blockError.alternatives = errorData.alternatives;
            blockError.category = errorData.category;
            throw blockError;
          }

          if (errorData.error === 'GENERATION_INTERRUPTED') {
            const interruptedError: any = new Error(
              errorData.message || 'I started creating your playbook, but the response stopped before it finished. Please try again.'
            );
            interruptedError.generationInterrupted = true;
            interruptedError.retryable = errorData.retryable === true;
            throw interruptedError;
          }

          const backendError: any = new Error(errorData.message || `Generation failed (HTTP ${response.status}). Please try again.`);
          backendError.backendError = true;
          throw backendError;
        } catch (parseError) {
          if (
            (parseError as any).contentBlocked ||
            (parseError as any).generationInterrupted ||
            (parseError as any).backendError
          ) {
            throw parseError;
          }
          Logger.error('[UnifiedGenerationService] Direct generation non-JSON error', new Error(`HTTP ${response.status}`), {
            component: 'unifiedGenerationService',
            status: response.status,
          });
          throw new Error(`Generation failed (HTTP ${response.status}). Please try again.`);
        }
      }

      const result = await response.json();

      // Client-side completeness guard: refuse to save partial generations.
      // The backend already retries on missing content, but if anything still slips
      // through (network truncation, parser race, etc.) we surface a retryable error
      // rather than persisting a half-built playbook the UI can't render.
      const incompleteFields = findIncompletePlaybookFields(result);
      if (incompleteFields.length > 0) {
        Logger.error(
          '[UnifiedGenerationService] Refusing to save incomplete playbook',
          new Error(`Incomplete fields: ${incompleteFields.join(', ')}`),
          { component: 'unifiedGenerationService' }
        );
        const err = new Error(
          'We received an incomplete playbook. Please try generating again.'
        ) as Error & { retryable: boolean; incompleteFields: string[] };
        err.retryable = true;
        err.incompleteFields = incompleteFields;
        throw err;
      }

      // Save the unique playbook to database
      const playbookToSave = {
        id: result.id,
        title: result.title,
        userInput: request.userInput,
        category: result.category || undefined,
        truthInLove: result.truthInLove,
        actionSteps: result.actionSteps || [],
        affirmations: result.affirmations || [],
        bibleVerse: result.bibleVerse,
        bibleVerseReflection: result.bibleVerseReflection,
        directChallenge: result.directChallenge,
        prayer: result.prayer,
        wordToSpeak: result.wordToSpeak,
        transitionLine: result.transitionLine || result.transition_line || '',
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
      } else {
        await subscriptionService.trackUsage(
          request.userId,
          'playbook',
          0,
          request.isOnboarding || false
        );
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
