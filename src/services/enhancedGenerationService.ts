/**
 * Enhanced Generation Service
 * Integrates subscription limits, intelligence system, and queue management
 * Provides simple interface for playbook and devotional generation
 */

import { subscriptionService } from './subscriptionService';
import { Logger } from '../utils/ProductionLogger';
import { intelligenceService } from './intelligenceService';
// import { GenerationResult } from './types';
import { queueService } from './queueService';
import { supabase } from './supabaseClient';

export interface PlaybookGenerationRequest {
  userId: string;
  userInput: string;
  userName: string;
  isOnboarding?: boolean;
}

export interface DevotionalGenerationRequest {
  userId: string;
  userName: string;
  duration?: number;
  playbookId?: string;
  userInput?: string;
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

export class EnhancedGenerationService {
  // Resolve user's preferred Bible version, defaulting to NASB
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
   * Generate playbook with subscription checks and intelligence
   */
  async generatePlaybook(request: PlaybookGenerationRequest): Promise<GenerationResponse> {
    try {

      // 1. Check subscription limits (SIMPLE FOR USERS)
      const canGenerate = await subscriptionService.canGenerate(request.userId, 'playbook', request.isOnboarding || false);

      if (!canGenerate.allowed) {

        return {
          success: false,
          message: canGenerate.message || `You've used all ${canGenerate.limit} playbooks this month. Upgrade for more!`,
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

      // Resolve bible version preference (default NASB)
      const bibleVersion = await this.getPreferredBibleVersion();

      // 4. Add to intelligent queue (include bibleVersion)
      const queueId = await queueService.addToQueue({
        userId: request.userId,
        type: 'playbook',
        userInput: request.userInput,
        userName: request.userName,
        isOnboarding: request.isOnboarding,
        additionalParams: { bibleVersion },
      });

      // 5. Get queue status for user feedback
      const queueStatus = await queueService.getQueueStatus(request.userId);

      // 6. Build user-friendly message
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
      // If this is a content blocked error, re-throw it immediately to be handled by the frontend
      if ((error as any).contentBlocked) {
        throw error;
      }

      // Only log partitioning errors as info since they trigger expected fallback
      if ((error as any)?.message?.includes('Database partitioning error')) {

      } else {
        Logger.error('[EnhancedGenerationService] Error in generatePlaybook', error as Error, {
      component: 'enhancedGenerationService',
    });
      }

      // Handle database issues gracefully (schema, partitioning, etc.)
      if ((error as any)?.code === 'PGRST204' ||
          (error as any)?.code === '23514' ||
          (error as any)?.message?.includes('schema') ||
          (error as any)?.message?.includes('column') ||
          (error as any)?.message?.includes('partition') ||
          (error as any)?.message?.includes('no partition of relation')) {

        try {
          // Attempt direct generation without queue for schema issues
          await this.generateDirectPlaybook(request);
          // Return success without queueId to indicate immediate completion
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
          // If this is a content blocked error, re-throw it immediately
          if ((directError as any).contentBlocked) {
            throw directError;
          }

          Logger.error('[EnhancedGenerationService] Direct generation also failed', directError as Error, {
      component: 'enhancedGenerationService',
    });
          // Try one more fallback - simple API call
          try {
            await this.generateSimpleFallback(request);
            // Return success without queueId for fallback too
            return {
              success: true,
              message: 'Playbook generated successfully!',
              estimatedWaitTime: 0,
              intelligenceEnabled: false,
              upgradeRequired: false,
              remaining: 5,
              limit: 10,
            };
          } catch (fallbackError) {
            // If this is a content blocked error, re-throw it immediately
            if ((fallbackError as any).contentBlocked) {
              throw fallbackError;
            }

            Logger.error('[EnhancedGenerationService] All generation methods failed', fallbackError as Error, {
      component: 'enhancedGenerationService',
    });
          }
        }
      }

      return {
        success: false,
        message: 'Something went wrong while creating your playbook. Please try again.',
        upgradeRequired: false,
      };
    }
  }

  /**
   * Direct playbook generation bypass for database schema issues
   */
  private async generateDirectPlaybook(request: PlaybookGenerationRequest): Promise<GenerationResponse> {
    try {

      // Use the simple fallback method which properly saves to database
      return await this.generateSimpleFallback(request);
    } catch (error) {
      Logger.error('[EnhancedGenerationService] Direct generation failed', error as Error, {
      component: 'enhancedGenerationService',
    });
      throw error; // Re-throw to allow fallback handling
    }
  }

  /**
   * Simple fallback generation for critical failures
   */
  private async generateSimpleFallback(request: PlaybookGenerationRequest): Promise<GenerationResponse> {
    try {

      // Use environment config to get Supabase URL
      const { getEnvironmentConfig } = await import('../config/environment');
      const env = getEnvironmentConfig();

      if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
        throw new Error('Missing environment configuration');
      }

      const functionUrl = `${env.SUPABASE_URL}/functions/v1/generate-playbook`;

      // Resolve bible version preference (default NASB)
      const bibleVersion = await this.getPreferredBibleVersion();

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
        }),
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();

          // Handle CONTENT_BLOCKED error specially
          if (errorData.error === 'CONTENT_BLOCKED') {
            const blockError: any = new Error(errorData.message || 'Content blocked');
            blockError.contentBlocked = true;
            blockError.christianMessage = errorData.message;
            blockError.alternatives = errorData.alternatives;
            blockError.category = errorData.category;
            throw blockError;
          }

          // Handle other JSON errors
          Logger.error('[EnhancedGenerationService] Supabase function error', new Error(JSON.stringify(errorData)), {
            component: 'enhancedGenerationService',
          });
          throw new Error(errorData.message || 'Something went wrong. Please try again.');
        } catch (parseError) {
          // If it's already a CONTENT_BLOCKED error, re-throw it
          if ((parseError as any).contentBlocked) {
            throw parseError;
          }

          // If JSON parsing fails, fall back to text
          const errorText = await response.text();
          Logger.error('[EnhancedGenerationService] Supabase function error', new Error(errorText), {
            component: 'enhancedGenerationService',
          });
          throw new Error('Something went wrong. Please try again.');
        }
      }

      const result = await response.json();

      // Save the result directly to database
      try {
        const { savePlaybook } = await import('./modernPlaybookApi');

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

        if (saveResult.success) {

        } else {
          Logger.error('[EnhancedGenerationService] Save failed but generation succeeded', saveResult.error ? new Error(String(saveResult.error)) : new Error('Unknown save error'), {
        component: 'enhancedGenerationService',
      });
        }
      } catch (saveError) {
        Logger.error('[EnhancedGenerationService] Save error in fallback', saveError as Error, {
      component: 'enhancedGenerationService',
    });
        // Don't fail the entire operation for save errors
      }

      return {
        success: true,
        queueId: 'fallback-' + Date.now(),
        message: 'Playbook generated successfully (fallback mode)',
        estimatedWaitTime: 0,
        intelligenceEnabled: false,
        upgradeRequired: false,
        remaining: 5,
        limit: 10,
      };
    } catch (error) {
      // If this is a content blocked error, re-throw it to be handled by the caller
      if ((error as any).contentBlocked) {
        throw error;
      }

      Logger.error('[EnhancedGenerationService] Simple fallback generation failed', error as Error, {
      component: 'enhancedGenerationService',
    });

      return {
        success: false,
        message: 'Something went wrong while creating your playbook. Please try again.',
        upgradeRequired: false,
      };
    }
  }

  /**
   * Generate devotional with subscription checks and intelligence
   */
  async generateDevotional(request: DevotionalGenerationRequest): Promise<GenerationResponse> {
    try {

      // 1. Check subscription limits
      const canGenerate = await subscriptionService.canGenerate(request.userId, 'devotional');

      if (!canGenerate.allowed) {

        return {
          success: false,
          message: canGenerate.message || `You've used all ${canGenerate.limit} devotionals this month. Upgrade for more!`,
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
          event_type: 'devotional_generation_requested',
          event_category: 'generation',
          event_data: {
            duration: request.duration,
            has_playbook_context: !!request.playbookId,
            subscription_tier: subscription.tier,
          },
          duration_seconds: 0,
        });
      }

      // Resolve bible version preference (default NASB)
      const bibleVersion = await this.getPreferredBibleVersion();

      // 4. Add to intelligent queue
      const queueId = await queueService.addToQueue({
        userId: request.userId,
        type: 'devotional',
        userInput: request.userInput || '',
        userName: request.userName,
        additionalParams: {
          duration: request.duration || 7,
          playbookId: request.playbookId,
          userInput: request.userInput,
          bibleVersion,
        },
      });

      // 5. Get queue status
      const queueStatus = await queueService.getQueueStatus(request.userId);

      // 6. Build user-friendly message
      let message = 'Generating your devotional...';
      if (queueStatus.estimatedWaitTime > 0) {
        const waitMinutes = Math.ceil(queueStatus.estimatedWaitTime / 60);
        message = `Your devotional is in queue. Estimated wait: ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}`;

        if (intelligenceEnabled) {
          message += ' (AI-personalized)';
        }
      } else {
        message = intelligenceEnabled
          ? 'Generating your personalized devotional...'
          : 'Generating your devotional...';
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
      Logger.error('[EnhancedGenerationService] Error in generateDevotional', error as Error, {
      component: 'enhancedGenerationService',
    });

      return {
        success: false,
        message: 'Connection error occurred. Please check your internet connection and try again.',
        upgradeRequired: false,
      };
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

      let message = '';
      switch (status.status) {
        case 'pending':
          const waitMinutes = Math.ceil((status.estimatedWaitTime || 0) / 60);
          message = waitMinutes > 0
            ? `In queue - estimated wait: ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}`
            : 'In queue - processing soon';
          break;
        case 'processing':
          message = 'Generating your content...';
          break;
        case 'completed':
          message = 'Generation completed successfully!';
          break;
        case 'failed':
          message = status.errorMessage || 'Something went wrong. Please try again.';
          break;
      }

      return {
        status: status.status,
        message,
        resultId: status.resultId,
        estimatedWaitTime: status.estimatedWaitTime,
        processingTimeSeconds: status.processingTimeSeconds,
      };
    } catch (error) {
      Logger.error('[EnhancedGenerationService] Error checking generation status', error as Error, {
      component: 'enhancedGenerationService',
    });
      return {
        status: 'failed',
        message: 'Error checking generation status',
      };
    }
  }

  /**
   * Cancel generation request
   */
  async cancelGeneration(queueId: string, userId: string): Promise<boolean> {
    try {
      const cancelled = await queueService.cancelQueueItem(queueId, userId);

      if (cancelled) {

        // Track cancellation for intelligence system
        const hasIntelligence = await subscriptionService.hasIntelligenceAccess(userId);
        if (hasIntelligence) {
          await intelligenceService.trackBehavior(userId, {
            event_type: 'generation_cancelled',
            event_category: 'engagement',
            event_data: { queue_id: queueId },
            success_indicator: false,
          });
        }
      }

      return cancelled;
    } catch (error) {
      Logger.error('[EnhancedGenerationService] Error cancelling generation', error as Error, {
      component: 'enhancedGenerationService',
    });
      return false;
    }
  }

  /**
   * Get user's generation history and analytics
   */
  async getGenerationAnalytics(userId: string): Promise<{
    subscription: any;
    usage: any;
    limits: any;
    analytics: any;
    recommendations?: any;
  }> {
    try {
      // Get subscription analytics
      const subscriptionAnalytics = await subscriptionService.getSubscriptionAnalytics(userId);

      // Get intelligence recommendations if available
      let recommendations = null;
      if (subscriptionAnalytics.analytics.intelligenceEnabled) {
        recommendations = await intelligenceService.getContentRecommendations(userId);
      }

      return {
        ...subscriptionAnalytics,
        recommendations,
      };
    } catch (error) {
      Logger.error('[EnhancedGenerationService] Error getting generation analytics', error as Error, {
      component: 'enhancedGenerationService',
    });
      throw error;
    }
  }

  /**
   * Track content completion for intelligence system
   */
  async trackContentCompletion(
    userId: string,
    contentType: 'playbook' | 'devotional',
    contentId: string,
    completionData: {
      completed: boolean;
      completionRate: number;
      timeSpent: number;
      userRating?: number;
      userFeedback?: string;
    }
  ): Promise<void> {
    try {
      const hasIntelligence = await subscriptionService.hasIntelligenceAccess(userId);
      if (!hasIntelligence) {
        return; // Skip tracking for basic users
      }

      // Track completion behavior
      await intelligenceService.trackBehavior(userId, {
        event_type: `${contentType}_completion`,
        event_category: 'completion',
        event_data: {
          content_id: contentId,
          completion_rate: completionData.completionRate,
          user_rating: completionData.userRating,
          user_feedback: completionData.userFeedback,
        },
        success_indicator: completionData.completed,
        duration_seconds: completionData.timeSpent,
      });

      // Update content effectiveness tracking
      await this.updateContentEffectiveness(userId, contentType, contentId, completionData);

    } catch (error) {
      Logger.error('[EnhancedGenerationService] Error tracking content completion', error as Error, {
      component: 'enhancedGenerationService',
    });
      // Don't throw - tracking should not break the main flow
    }
  }

  /**
   * Get personalized content suggestions
   */
  async getPersonalizedSuggestions(userId: string): Promise<{
    suggestedTopics: string[];
    optimalTiming: string;
    recommendedContentLength: string;
    challengeLevel: string;
    confidenceScore: number;
  } | null> {
    try {
      const hasIntelligence = await subscriptionService.hasIntelligenceAccess(userId);
      if (!hasIntelligence) {
        return null;
      }

      const recommendations = await intelligenceService.getContentRecommendations(userId);
      if (!recommendations) {
        return null;
      }

      return {
        suggestedTopics: recommendations.personalizedTopics,
        optimalTiming: recommendations.optimalTiming,
        recommendedContentLength: recommendations.contentLength,
        challengeLevel: recommendations.challengeLevel,
        confidenceScore: recommendations.confidenceScore,
      };
    } catch (error) {
      Logger.error('[EnhancedGenerationService] Error getting personalized suggestions', error as Error, {
      component: 'enhancedGenerationService',
    });
      return null;
    }
  }

  /**
   * Update content effectiveness for learning system
   */
  private async updateContentEffectiveness(
    userId: string,
    contentType: string,
    contentId: string,
    completionData: any
  ): Promise<void> {
    try {
      await subscriptionService.supabase
        .from('content_effectiveness')
        .upsert({
          content_type: contentType,
          content_id: contentId,
          user_id: userId,
          completion_rate: completionData.completionRate,
          engagement_score: this.calculateEngagementScore(completionData),
          time_to_complete: completionData.timeSpent,
          user_rating: completionData.userRating,
          completed_successfully: completionData.completed,
          user_feedback_positive: completionData.userRating ? completionData.userRating >= 4 : null,
          led_to_further_engagement: false, // Could be enhanced with more tracking
          measured_at: new Date().toISOString(),
        });
    } catch (error) {
      Logger.error('[EnhancedGenerationService] Error updating content effectiveness', error as Error, {
      component: 'enhancedGenerationService',
    });
    }
  }

  /**
   * Calculate engagement score for content effectiveness
   */
  private calculateEngagementScore(completionData: any): number {
    let score = completionData.completionRate; // Base score from completion rate

    // Adjust based on time spent (more time = higher engagement, up to a point)
    if (completionData.timeSpent > 600) { // 10+ minutes
      score += 0.2;
    } else if (completionData.timeSpent > 300) { // 5+ minutes
      score += 0.1;
    }

    // Adjust based on user rating
    if (completionData.userRating) {
      score += (completionData.userRating - 3) * 0.1; // Rating above 3 increases score
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Get queue statistics for admin/monitoring
   */
  async getQueueStatistics(): Promise<any> {
    try {
      return await queueService.getQueueStatistics();
    } catch (error) {
      Logger.error('[EnhancedGenerationService] Error getting queue statistics', error as Error, {
      component: 'enhancedGenerationService',
    });
      return null;
    }
  }
}

// Export singleton instance
export const enhancedGenerationService = new EnhancedGenerationService();
