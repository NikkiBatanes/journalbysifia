/**
 * Onboarding Service
 * Handles modern onboarding flow with faith journey tracking
 * Enterprise-grade implementation with analytics and personalization
 */

import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';

// =============================================
// TYPES AND INTERFACES
// =============================================

export type OnboardingStepStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'abandoned';

export type SpiritualMaturityLevel =
  | 'new_believer'
  | 'growing'
  | 'mature'
  | 'leader'
  | 'unsure';

export type ChurchAttendanceFrequency =
  | 'never'
  | 'rarely'
  | 'monthly'
  | 'weekly'
  | 'multiple_weekly';

export type BibleReadingFrequency =
  | 'never'
  | 'rarely'
  | 'weekly'
  | 'daily'
  | 'multiple_daily';

export type PrayerFrequency =
  | 'never'
  | 'rarely'
  | 'weekly'
  | 'daily'
  | 'multiple_daily';

export type AcceptanceContext =
  | 'childhood'
  | 'teenager'
  | 'adult'
  | 'recent'
  | 'unsure'
  | 'not_yet';

export type BaptismStatus =
  | 'yes'
  | 'no'
  | 'planning'
  | 'not_applicable';

export type PersonalityType =
  | 'contemplative'
  | 'active'
  | 'social'
  | 'studious';

export type LearningStyle =
  | 'visual'
  | 'auditory'
  | 'kinesthetic'
  | 'reading';

export type ContentLengthPreference =
  | 'short'
  | 'medium'
  | 'long';

export interface OnboardingProgress {
  id: string;
  user_id: string;
  current_step: number;
  total_steps: number;
  completed_steps: string[];
  skipped_steps: string[];
  started_at: string;
  completed_at?: string;
  abandoned_at?: string;
  last_activity_at: string;
  completion_rate: number;
  time_spent_seconds: number;
  session_id: string;
  device_info: Record<string, any>;
  is_completed: boolean;
  is_abandoned: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaithJourneyProfile {
  id: string;
  user_id: string;
  has_accepted_christ?: boolean;
  acceptance_date?: string;
  acceptance_context?: AcceptanceContext;
  spiritual_maturity: SpiritualMaturityLevel;
  years_as_believer?: number;
  church_attendance: ChurchAttendanceFrequency;
  current_church_name?: string;
  church_denomination?: string;
  baptism_status: BaptismStatus;
  baptism_date?: string;
  bible_reading_frequency: BibleReadingFrequency;
  prayer_frequency: PrayerFrequency;
  preferred_bible_version: string;
  areas_of_growth: string[];
  life_challenges: string[];
  spiritual_gifts: string[];
  ministry_interests: string[];
  current_doubts: string[];
  growth_desires: string[];
  spiritual_influences: string[];
  needs_pastoral_care: boolean;
  church_connection_requested: boolean;
  prayer_request_text?: string;
  created_at: string;
  updated_at: string;
}

export interface PersonalizationProfile {
  id: string;
  user_id: string;
  personality_type?: PersonalityType;
  learning_style?: LearningStyle;
  preferred_content_length: ContentLengthPreference;
  preferred_topics: string[];
  avoided_topics: string[];
  optimal_notification_times: string[];
  preferred_study_days: string[];
  daily_commitment_minutes: number;
  prefers_gentle_encouragement: boolean;
  prefers_direct_challenges: boolean;
  likes_community_features: boolean;
  prefers_audio_content: boolean;
  prefers_video_content: boolean;
  accessibility_needs: string[];
  engagement_patterns: Record<string, any>;
  personalization_score: number;
  confidence_level: number;
  created_at: string;
  updated_at: string;
}

export interface OnboardingStepData {
  step_name: string;
  step_number: number;
  data: Record<string, any>;
  time_spent_seconds?: number;
  interactions_count?: number;
  completion_method: OnboardingStepStatus;
}

export interface ChristAcceptanceData {
  acceptance_context: AcceptanceContext;
  influenced_by?: string;
  specific_content_id?: string;
  prayer_text?: string;
  baptism_interest?: boolean;
  church_connection_interest?: boolean;
  discipleship_interest?: boolean;
}

export interface OnboardingMetrics {
  step_name: string;
  completion_rate: number;
  average_time_spent: number;
  skip_rate: number;
  total_users: number;
}

// =============================================
// ONBOARDING SERVICE CLASS
// =============================================

export class OnboardingService {
  private supabase = supabase;

  /**
   * Initialize onboarding for a new user
   */
  async initializeOnboarding(userId: string): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('initialize_onboarding', {
        p_user_id: userId,
      });

      if (error) {
        Logger.error('[OnboardingService] Error initializing onboarding', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        throw error;
      }

      return data;
    } catch (error) {
      Logger.error('[OnboardingService] Error in initializeOnboarding', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      throw error;
    }
  }

  /**
   * Get user's onboarding progress
   */
  async getOnboardingProgress(userId: string): Promise<OnboardingProgress | null> {
    try {
      const { data, error } = await this.supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        Logger.error('[OnboardingService] Error getting onboarding progress', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        throw error;
      }

      return data;
    } catch (error) {
      Logger.error('[OnboardingService] Error in getOnboardingProgress', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      throw error;
    }
  }

  /**
   * Update onboarding step progress
   */
  async updateStepProgress(
    userId: string,
    stepData: OnboardingStepData
  ): Promise<void> {
    try {
      // Update progress using the database function
      const { error: progressError } = await this.supabase.rpc('update_onboarding_progress', {
        p_user_id: userId,
        p_step_name: stepData.step_name,
        p_step_number: stepData.step_number,
        p_completion_method: stepData.completion_method,
        p_time_spent: stepData.time_spent_seconds || 0,
      });

      if (progressError) {
        Logger.error('[OnboardingService] Error updating progress', progressError as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        throw progressError;
      }

      // Record analytics
      await this.recordStepAnalytics(userId, stepData);

    } catch (error) {
      Logger.error('[OnboardingService] Error in updateStepProgress', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      throw error;
    }
  }

  /**
   * Record step analytics
   */
  private async recordStepAnalytics(
    userId: string,
    stepData: OnboardingStepData
  ): Promise<void> {
    try {
      const progress = await this.getOnboardingProgress(userId);

      const { error } = await this.supabase
        .from('onboarding_step_analytics')
        .insert({
          user_id: userId,
          session_id: progress?.session_id,
          step_name: stepData.step_name,
          step_number: stepData.step_number,
          time_spent_seconds: stepData.time_spent_seconds || 0,
          interactions_count: stepData.interactions_count || 0,
          completion_method: stepData.completion_method,
          input_field_count: Object.keys(stepData.data).length,
          device_info: progress?.device_info || {},
        });

      if (error) {
        Logger.error('[OnboardingService] Error recording analytics', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        // Don't throw - analytics shouldn't block the main flow
      }
    } catch (error) {
      Logger.error('[OnboardingService] Error in recordStepAnalytics', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      // Don't throw - analytics shouldn't block the main flow
    }
  }

  /**
   * Update faith journey profile
   */
  async updateFaithJourneyProfile(
    userId: string,
    profileData: Partial<FaithJourneyProfile>
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('faith_journey_profiles')
        .upsert({
          user_id: userId,
          ...profileData,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        Logger.error('[OnboardingService] Error updating faith journey', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        throw error;
      }

    } catch (error) {
      Logger.error('[OnboardingService] Error in updateFaithJourneyProfile', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      throw error;
    }
  }

  /**
   * Get faith journey profile
   */
  async getFaithJourneyProfile(userId: string): Promise<FaithJourneyProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('faith_journey_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        Logger.error('[OnboardingService] Error getting faith journey', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        throw error;
      }

      return data;
    } catch (error) {
      Logger.error('[OnboardingService] Error in getFaithJourneyProfile', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      throw error;
    }
  }

  /**
   * Record Christ acceptance event
   */
  async recordChristAcceptance(
    userId: string,
    acceptanceData: ChristAcceptanceData
  ): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('record_christ_acceptance', {
        p_user_id: userId,
        p_acceptance_context: acceptanceData.acceptance_context,
        p_influenced_by: acceptanceData.influenced_by,
        p_content_id: acceptanceData.specific_content_id,
        p_prayer_text: acceptanceData.prayer_text,
      });

      if (error) {
        Logger.error('[OnboardingService] Error recording Christ acceptance', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        throw error;
      }

      return data;
    } catch (error) {
      Logger.error('[OnboardingService] Error in recordChristAcceptance', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      throw error;
    }
  }

  /**
   * Update personalization profile
   */
  async updatePersonalizationProfile(
    userId: string,
    profileData: Partial<PersonalizationProfile>
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('onboarding_personalization_profiles')
        .upsert({
          user_id: userId,
          ...profileData,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        Logger.error('[OnboardingService] Error updating personalization', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        throw error;
      }

    } catch (error) {
      Logger.error('[OnboardingService] Error in updatePersonalizationProfile', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      throw error;
    }
  }

  /**
   * Get personalization profile
   */
  async getPersonalizationProfile(userId: string): Promise<PersonalizationProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('onboarding_personalization_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        Logger.error('[OnboardingService] Error getting personalization', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        throw error;
      }

      return data;
    } catch (error) {
      Logger.error('[OnboardingService] Error in getPersonalizationProfile', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      throw error;
    }
  }

  /**
   * Complete onboarding process
   * Updates BOTH onboarding_progress AND user_profiles to ensure all login methods work
   */
  async completeOnboarding(userId: string): Promise<void> {
    Logger.debug('[OnboardingService] Starting completeOnboarding', { 
      userId, 
      userIdType: typeof userId,
      userIdLength: userId?.length,
      isUuidFormat: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    });
    
    try {
      // 1. Update onboarding_progress table
      const { error: progressError } = await this.supabase
        .from('onboarding_progress')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          completion_rate: 1.0,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (progressError) {
        Logger.error('[OnboardingService] Error updating onboarding_progress', progressError as Error, {
          component: 'onboardingService',
          action: 'complete_onboarding',
          userId,
        });
        throw progressError;
      }

      // 2. Update user_profiles.onboarding_completed (PRIMARY source of truth for login routing)
      // Use upsert to handle cases where profile doesn't exist yet (e.g., social login)
      Logger.debug('[OnboardingService] Updating user_profiles.onboarding_completed to true', { userId });
      
      // First get the user's email to include in the upsert
      const { data: userData } = await this.supabase.auth.getUser();
      const userEmail = userData?.user?.email;

      if (!userEmail) {
        Logger.error('[OnboardingService] Cannot get user email for profile update', {
          component: 'onboardingService',
          action: 'complete_onboarding',
          userId,
        });
        throw new Error('User email not available for profile update');
      }

      const { data: updateResult, error: profileError } = await this.supabase
        .from('user_profiles')
        .upsert(
          {
            id: userId,
            email: userEmail, // Include required email field
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'id',
            ignoreDuplicates: false, // Always update if exists
          }
        )
        .select('id, onboarding_completed')
        .single();

      Logger.debug('[OnboardingService] UPSERT RESULT', {
        userId,
        userEmail,
        updateResult,
        profileError: profileError?.message,
        profileErrorCode: profileError?.code,
        hasUpdateResult: !!updateResult,
        updatedOnboardingCompleted: updateResult?.onboarding_completed
      });

      if (profileError) {
        Logger.error('[OnboardingService] Error updating user_profiles.onboarding_completed', profileError as Error, {
          component: 'onboardingService',
          action: 'complete_onboarding',
          userId,
        });
        throw profileError;
      }

      if (!updateResult) {
        Logger.error('[OnboardingService] UPSERT returned no result - possible RLS issue', {
          component: 'onboardingService',
          action: 'complete_onboarding',
          userId,
        });
        throw new Error('UPSERT operation returned no result - check RLS policies');
      }

      Logger.debug('[OnboardingService] Onboarding completed successfully for user', {
        component: 'onboardingService',
        userId,
      });

      // VERIFY: Double-check the update worked
      try {
        const { data: verifyProfile } = await this.supabase
          .from('user_profiles')
          .select('onboarding_completed, updated_at')
          .eq('id', userId)
          .single();
        
        Logger.debug('[OnboardingService] VERIFICATION - Profile after update', {
          userId,
          onboardingCompleted: verifyProfile?.onboarding_completed,
          updatedAt: verifyProfile?.updated_at,
          verification: verifyProfile?.onboarding_completed === true ? 'SUCCESS' : 'FAILED'
        });
      } catch (verifyError) {
        Logger.warn('[OnboardingService] Could not verify onboarding completion', {
          errorMessage: (verifyError as Error)?.message || 'Unknown verification error',
          component: 'onboardingService',
          action: 'verify_onboarding_completion',
          userId,
        });
      }

    } catch (error) {
      Logger.error('[OnboardingService] Error in completeOnboarding', error as Error, {
        component: 'onboardingService',
        action: 'complete_onboarding',
        userId,
      });
      throw error;
    }
  }

  /**
   * Check if user has completed onboarding
   */
  async hasCompletedOnboarding(userId: string): Promise<boolean> {
    try {

      // 1) Primary source of truth: user_profiles.onboarding_completed
      try {
        const { data: profile, error: profErr } = await this.supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('id', userId)
          .single();

        if (!profErr && profile) {
          // Explicitly check for true value, not just truthy
          const isCompleted = profile.onboarding_completed === true;

          if (isCompleted) {
            return true;
          }
        }
      } catch (e) {
        Logger.warn('[OnboardingService] Profile check failed, falling back', {
      component: 'onboardingService',
      errorMessage: e instanceof Error ? e.message : String(e),
    });
      }

      // 2) Fallback: onboarding_progress.is_completed

      const progress = await this.getOnboardingProgress(userId);
      const fallbackResult = progress?.is_completed === true;

      return fallbackResult;
    } catch (error) {
      Logger.error('[OnboardingService] Error checking onboarding completion', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      return false;
    }
  }

  /**
   * Get onboarding metrics for analytics
   */
  async getOnboardingMetrics(): Promise<OnboardingMetrics[]> {
    try {
      const { data, error } = await this.supabase.rpc('calculate_onboarding_metrics');

      if (error) {
        Logger.error('[OnboardingService] Error getting metrics', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        throw error;
      }

      return data || [];
    } catch (error) {
      Logger.error('[OnboardingService] Error in getOnboardingMetrics', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      throw error;
    }
  }

  /**
   * Abandon onboarding (user exits without completing)
   */
  async abandonOnboarding(userId: string, currentStep: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('onboarding_progress')
        .update({
          is_abandoned: true,
          abandoned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        Logger.error('[OnboardingService] Error abandoning onboarding', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        throw error;
      }

      // Record abandonment analytics
      await this.recordStepAnalytics(userId, {
        step_name: currentStep,
        step_number: 0,
        data: {},
        completion_method: 'abandoned',
      });

    } catch (error) {
      Logger.error('[OnboardingService] Error in abandonOnboarding', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      throw error;
    }
  }

  /**
   * Get users who need pastoral care follow-up
   */
  async getUsersNeedingPastoralCare(): Promise<FaithJourneyProfile[]> {
    try {
      const { data, error } = await this.supabase
        .from('faith_journey_profiles')
        .select('*')
        .eq('needs_pastoral_care', true);

      if (error) {
        Logger.error('[OnboardingService] Error getting pastoral care users', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        throw error;
      }

      return data || [];
    } catch (error) {
      Logger.error('[OnboardingService] Error in getUsersNeedingPastoralCare', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      throw error;
    }
  }

  /**
   * Get recent Christ acceptance events for follow-up
   */
  async getRecentChristAcceptanceEvents(days: number = 7): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('christ_acceptance_events')
        .select(`
          *,
          faith_journey_profiles (
            user_id,
            spiritual_maturity,
            church_attendance,
            needs_pastoral_care
          )
        `)
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .eq('needs_follow_up', true)
        .eq('follow_up_completed', false)
        .order('created_at', { ascending: false });

      if (error) {
        Logger.error('[OnboardingService] Error getting acceptance events', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
        throw error;
      }

      return data || [];
    } catch (error) {
      Logger.error('[OnboardingService] Error in getRecentChristAcceptanceEvents', error as Error, {
      component: 'onboardingService',
      action: 'onboarding',
    });
      throw error;
    }
  }
}

// Export singleton instance
export const onboardingService = new OnboardingService();
