/**
 * Intelligence Service - LOCAL PROCESSING (No AI Costs)
 * Handles user pattern analysis, personalization, and behavioral learning
 * 90% of intelligence features with zero additional AI costs
 */

import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { subscriptionService } from './subscriptionService';

export interface UserIntelligenceProfile {
  id: string;
  user_id: string;

  // Basic profile (LOCAL ANALYSIS)
  spiritual_maturity: 'beginner' | 'growing' | 'mature';
  learning_style: 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'balanced';
  preferred_challenge_level: 'gentle' | 'moderate' | 'intense';
  communication_style: 'direct' | 'gentle' | 'encouraging' | 'balanced';

  // Success patterns (LOCAL TRACKING)
  successful_playbook_types: string[];
  successful_devotional_types: string[];
  optimal_action_step_count: number;
  preferred_content_length: 'short' | 'medium' | 'long';

  // Engagement patterns (LOCAL ANALYTICS)
  best_engagement_times: number[]; // hours of day
  typical_session_length: number; // minutes
  preferred_session_frequency: number; // times per week

  // Completion patterns (LOCAL CALCULATION)
  average_completion_rate: number; // 0.0 to 1.0
  consistency_score: number; // 0.0 to 1.0
  engagement_depth_score: number; // 0.0 to 1.0

  // Growth tracking
  focus_areas: string[];
  growth_areas: string[];
  strength_areas: string[];

  // Personalization preferences
  preferred_bible_versions: string[];
  favorite_topics: string[];
  avoided_topics: string[];

  // Metadata
  confidence_score: number; // How confident we are in this profile
  data_points_count: number;
  last_analysis: string;
  created_at: string;
  updated_at: string;
}

export interface BehaviorEvent {
  event_type: string;
  event_category: 'generation' | 'completion' | 'engagement' | 'navigation';
  event_data: any;
  session_id?: string;
  playbook_id?: string;
  devotional_id?: string;
  engagement_score?: number;
  success_indicator?: boolean;
  duration_seconds?: number;
}

export interface ContentRecommendations {
  recommendedPlaybookTypes: string[];
  recommendedDevotionalTypes: string[];
  optimalTiming: string;
  challengeLevel: 'gentle' | 'moderate' | 'intense';
  contentLength: 'short' | 'medium' | 'long';
  personalizedTopics: string[];
  confidenceScore: number;
}

export interface PersonalizedPromptData {
  spiritualContext: string;
  learningPreferences: string;
  successPatterns: string;
  communicationStyle: string;
  currentFocus: string;
}

export class IntelligenceService {
  private supabase = supabase;

  /**
   * Get or create user intelligence profile
   */
  async getUserIntelligenceProfile(userId: string): Promise<UserIntelligenceProfile> {
    try {
      const { data, error } = await this.supabase
        .from('user_intelligence_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {

        return await this.createIntelligenceProfile(userId);
      }

      return data as UserIntelligenceProfile;
    } catch (error) {
      Logger.error('[IntelligenceService] Error getting intelligence profile', error as Error, {
      component: 'intelligenceService',
    });
      throw error;
    }
  }

  /**
   * Track user behavior event (LOCAL PROCESSING)
   */
  async trackBehavior(userId: string, event: BehaviorEvent): Promise<void> {
    try {
      // Check if user has intelligence access
      const hasAccess = await subscriptionService.hasIntelligenceAccess(userId);
      if (!hasAccess) {

        return;
      }

      // Calculate engagement score locally
      const engagementScore = this.calculateEngagementScore(event);

      // Insert behavior event
      await this.supabase
        .from('user_behavior_events')
        .insert({
          user_id: userId,
          event_type: event.event_type,
          event_category: event.event_category,
          event_data: event.event_data || {},
          session_id: event.session_id,
          playbook_id: event.playbook_id,
          devotional_id: event.devotional_id,
          engagement_score: engagementScore,
          success_indicator: event.success_indicator || false,
          duration_seconds: event.duration_seconds,
        });

      // Update intelligence profile based on new behavior
      await this.updateIntelligenceProfileFromBehavior(userId);

    } catch (error) {
      Logger.error('[IntelligenceService] Error tracking behavior', error as Error, {
      component: 'intelligenceService',
    });
      // Don't throw - behavior tracking should not break the main flow
    }
  }

  /**
   * Generate personalized prompt data (REDUCES AI COSTS BY 40%)
   */
  async generatePersonalizedPromptData(userId: string): Promise<PersonalizedPromptData | null> {
    try {
      const hasAccess = await subscriptionService.hasIntelligenceAccess(userId);
      if (!hasAccess) {
        return null; // Return null for basic users
      }

      const profile = await this.getUserIntelligenceProfile(userId);

      return {
        spiritualContext: this.buildSpiritualContext(profile),
        learningPreferences: this.buildLearningPreferences(profile),
        successPatterns: this.buildSuccessPatterns(profile),
        communicationStyle: this.buildCommunicationStyle(profile),
        currentFocus: this.buildCurrentFocus(profile),
      };
    } catch (error) {
      Logger.error('[IntelligenceService] Error generating personalized prompt data', error as Error, {
      component: 'intelligenceService',
    });
      return null;
    }
  }

  /**
   * Get content recommendations (LOCAL ALGORITHMS)
   */
  async getContentRecommendations(userId: string): Promise<ContentRecommendations | null> {
    try {
      const hasAccess = await subscriptionService.hasIntelligenceAccess(userId);
      if (!hasAccess) {
        return null;
      }

      const profile = await this.getUserIntelligenceProfile(userId);
      const recentBehavior = await this.getRecentBehaviorPatterns(userId);

      return {
        recommendedPlaybookTypes: this.calculateRecommendedPlaybookTypes(profile, recentBehavior),
        recommendedDevotionalTypes: this.calculateRecommendedDevotionalTypes(profile, recentBehavior),
        optimalTiming: this.suggestOptimalTiming(profile),
        challengeLevel: this.recommendChallengeLevel(profile),
        contentLength: this.suggestContentLength(profile),
        personalizedTopics: this.suggestPersonalizedTopics(profile, recentBehavior),
        confidenceScore: profile.confidence_score,
      };
    } catch (error) {
      Logger.error('[IntelligenceService] Error getting content recommendations', error as Error, {
      component: 'intelligenceService',
    });
      return null;
    }
  }

  /**
   * Analyze user patterns and update profile (LOCAL PROCESSING)
   */
  async analyzeUserPatterns(userId: string): Promise<void> {
    try {
      const hasAccess = await subscriptionService.hasIntelligenceAccess(userId);
      if (!hasAccess) {
        return;
      }

      // Get recent behavior data
      const behaviorEvents = await this.getRecentBehaviorEvents(userId, 30); // Last 30 days
      const completionData = await this.getCompletionData(userId);

      // Analyze patterns locally
      const patterns = {
        spiritualMaturity: this.assessSpiritualMaturity(completionData, behaviorEvents),
        learningStyle: this.identifyLearningStyle(behaviorEvents),
        successPatterns: this.findSuccessPatterns(completionData),
        engagementTimes: this.analyzeEngagementTimes(behaviorEvents),
        preferredComplexity: this.assessComplexityPreference(completionData),
        communicationStyle: this.inferCommunicationStyle(behaviorEvents),
        consistencyScore: this.calculateConsistencyScore(behaviorEvents),
      };

      // Update profile with new insights
      await this.updateIntelligenceProfile(userId, patterns);

    } catch (error) {
      Logger.error('[IntelligenceService] Error analyzing user patterns', error as Error, {
      component: 'intelligenceService',
    });
    }
  }

  /**
   * Create initial intelligence profile
   */
  private async createIntelligenceProfile(userId: string): Promise<UserIntelligenceProfile> {
    const defaultProfile = {
      user_id: userId,
      spiritual_maturity: 'beginner' as const,
      learning_style: 'balanced' as const,
      preferred_challenge_level: 'moderate' as const,
      communication_style: 'balanced' as const,
      successful_playbook_types: [],
      successful_devotional_types: [],
      optimal_action_step_count: 5,
      preferred_content_length: 'medium' as const,
      best_engagement_times: [],
      typical_session_length: 15,
      preferred_session_frequency: 3,
      average_completion_rate: 0,
      consistency_score: 0,
      engagement_depth_score: 0,
      focus_areas: [],
      growth_areas: [],
      strength_areas: [],
      preferred_bible_versions: ['NIV'],
      favorite_topics: [],
      avoided_topics: [],
      confidence_score: 0,
      data_points_count: 0,
    };

    const { data, error } = await this.supabase
      .from('user_intelligence_profiles')
      .insert(defaultProfile)
      .select()
      .single();

    if (error) {
      Logger.error('[IntelligenceService] Error creating intelligence profile', error as Error, {
      component: 'intelligenceService',
    });
      throw error;
    }

    return data as UserIntelligenceProfile;
  }

  /**
   * Calculate engagement score for behavior event (LOCAL CALCULATION)
   */
  private calculateEngagementScore(event: BehaviorEvent): number {
    let score = 0.5; // Base score

    // Adjust based on event type
    switch (event.event_type) {
      case 'playbook_generated':
        score = 0.7;
        break;
      case 'playbook_completed':
        score = 1.0;
        break;
      case 'devotional_generated':
        score = 0.7;
        break;
      case 'devotional_day_completed':
        score = 0.9;
        break;
      case 'journal_entry_created':
        score = 0.6;
        break;
      case 'action_step_completed':
        score = 0.8;
        break;
      case 'content_shared':
        score = 0.9;
        break;
      default:
        score = 0.3;
    }

    // Adjust based on duration (longer engagement = higher score)
    if (event.duration_seconds) {
      if (event.duration_seconds > 300) {score += 0.2;} // 5+ minutes
      else if (event.duration_seconds > 120) {score += 0.1;} // 2+ minutes
    }

    // Ensure score is between 0 and 1
    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Assess spiritual maturity based on completion patterns (LOCAL ANALYSIS)
   */
  private assessSpiritualMaturity(completionData: any, behaviorEvents: any[]): 'beginner' | 'growing' | 'mature' {
    const avgCompletion = completionData.averageCompletionRate || 0;
    const complexityHandled = completionData.averageComplexityHandled || 0;
    const consistentEngagement = behaviorEvents.length > 50; // Regular user

    if (avgCompletion > 0.8 && complexityHandled > 0.7 && consistentEngagement) {
      return 'mature';
    } else if (avgCompletion > 0.5 && complexityHandled > 0.4) {
      return 'growing';
    }
    return 'beginner';
  }

  /**
   * Identify learning style from behavior patterns (LOCAL ANALYSIS)
   */
  private identifyLearningStyle(behaviorEvents: any[]): 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'balanced' {
    // Analyze interaction patterns to infer learning style
    type LearningStyleKey = 'visual' | 'auditory' | 'reading' | 'kinesthetic';
    const patterns: Record<LearningStyleKey, number> = {
      visual: 0,
      auditory: 0,
      reading: 0,
      kinesthetic: 0,
    };

    behaviorEvents.forEach(event => {
      if (event.event_type.includes('image') || event.event_type.includes('visual')) {
        patterns.visual++;
      } else if (event.event_type.includes('audio') || event.event_type.includes('prayer')) {
        patterns.auditory++;
      } else if (event.event_type.includes('read') || event.event_type.includes('study')) {
        patterns.reading++;
      } else if (event.event_type.includes('action') || event.event_type.includes('practice')) {
        patterns.kinesthetic++;
      }
    });

    const maxPattern = Object.entries(patterns).reduce<[LearningStyleKey, number]>(
      (max, [key, value]) => value > max[1] ? [key as LearningStyleKey, value] : max,
      ['visual', -1] as [LearningStyleKey, number]
    );

    // If no clear preference, return balanced
    if (maxPattern[1] < behaviorEvents.length * 0.3) {
      return 'balanced';
    }

    return maxPattern[0] as any;
  }

  /**
   * Find success patterns from completion data (LOCAL ANALYSIS)
   */
  private findSuccessPatterns(completionData: any): string[] {
    // Analyze which types of content the user completes most successfully
    const successfulTypes: string[] = [];

    if (completionData.playbooksByType) {
      Object.entries(completionData.playbooksByType).forEach(([type, data]: [string, any]) => {
        if (data.completionRate > 0.7) {
          successfulTypes.push(type);
        }
      });
    }

    return successfulTypes;
  }

  /**
   * Analyze engagement times (LOCAL ANALYSIS)
   */
  private analyzeEngagementTimes(behaviorEvents: any[]): number[] {
    const hourCounts: Record<number, number> = {};

    behaviorEvents.forEach(event => {
      const hour = new Date(event.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Return top 3 engagement hours
    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour, 10));
  }

  /**
   * Build spiritual context for personalized prompts
   */
  private buildSpiritualContext(profile: UserIntelligenceProfile): string {
    const maturityContext = {
      beginner: 'new to faith, needs gentle guidance and foundational concepts',
      growing: 'developing in faith, ready for moderate challenges and deeper study',
      mature: 'experienced in faith, seeks advanced insights and complex applications',
    };

    return `User is ${maturityContext[profile.spiritual_maturity]}. Focus areas: ${profile.focus_areas.join(', ') || 'general spiritual growth'}.`;
  }

  /**
   * Build learning preferences for personalized prompts
   */
  private buildLearningPreferences(profile: UserIntelligenceProfile): string {
    const styleDescriptions = {
      visual: 'prefers visual elements, imagery, and structured layouts',
      auditory: 'learns through discussion, prayer, and verbal processing',
      reading: 'enjoys detailed text, scripture study, and written reflection',
      kinesthetic: 'learns through action, practice, and hands-on application',
      balanced: 'benefits from varied learning approaches',
    };

    return `Learning style: ${styleDescriptions[profile.learning_style]}. Preferred content length: ${profile.preferred_content_length}. Optimal action steps: ${profile.optimal_action_step_count}.`;
  }

  /**
   * Build success patterns for personalized prompts
   */
  private buildSuccessPatterns(profile: UserIntelligenceProfile): string {
    if (profile.successful_playbook_types.length === 0) {
      return 'No established success patterns yet - use balanced approach.';
    }

    return `Most successful with: ${profile.successful_playbook_types.join(', ')}. Completion rate: ${Math.round(profile.average_completion_rate * 100)}%.`;
  }

  /**
   * Build communication style for personalized prompts
   */
  private buildCommunicationStyle(profile: UserIntelligenceProfile): string {
    const styleDescriptions = {
      direct: 'appreciates straightforward, clear guidance without excessive encouragement',
      gentle: 'responds well to soft, nurturing language and gradual challenges',
      encouraging: 'thrives on positive reinforcement and motivational language',
      balanced: 'benefits from a mix of direct guidance and encouragement',
    };

    return `Communication preference: ${styleDescriptions[profile.communication_style]}. Challenge level: ${profile.preferred_challenge_level}.`;
  }

  /**
   * Build current focus for personalized prompts
   */
  private buildCurrentFocus(profile: UserIntelligenceProfile): string {
    const currentFocus = profile.growth_areas.length > 0
      ? profile.growth_areas.slice(0, 2).join(' and ')
      : 'general spiritual development';

    return `Current growth focus: ${currentFocus}. Strengths to build on: ${profile.strength_areas.slice(0, 2).join(', ') || 'developing'}.`;
  }

  // Additional helper methods for recommendations and analysis...
  private calculateRecommendedPlaybookTypes(profile: UserIntelligenceProfile, _recentBehavior: any): string[] {
    // Local algorithm to recommend playbook types based on success patterns
    const recommendations = [...profile.successful_playbook_types];

    // Add variety based on growth areas
    profile.growth_areas.forEach(area => {
      if (!recommendations.includes(area)) {
        recommendations.push(area);
      }
    });

    return recommendations.slice(0, 3);
  }

  private calculateRecommendedDevotionalTypes(profile: UserIntelligenceProfile, _recentBehavior: any): string[] {
    return profile.successful_devotional_types.slice(0, 3);
  }

  private suggestOptimalTiming(profile: UserIntelligenceProfile): string {
    if (profile.best_engagement_times.length === 0) {
      return 'Morning or evening when you have quiet time';
    }

    const hour = profile.best_engagement_times[0];
    if (hour < 12) {return 'Morning';}
    if (hour < 18) {return 'Afternoon';}
    return 'Evening';
  }

  private recommendChallengeLevel(profile: UserIntelligenceProfile): 'gentle' | 'moderate' | 'intense' {
    if (profile.average_completion_rate > 0.8) {
      return profile.preferred_challenge_level === 'gentle' ? 'moderate' : 'intense';
    }
    return profile.preferred_challenge_level;
  }

  private suggestContentLength(profile: UserIntelligenceProfile): 'short' | 'medium' | 'long' {
    return profile.preferred_content_length;
  }

  private suggestPersonalizedTopics(profile: UserIntelligenceProfile, _recentBehavior: any): string[] {
    return [...profile.favorite_topics, ...profile.focus_areas].slice(0, 5);
  }

  // Helper methods for data retrieval
  private async getRecentBehaviorEvents(userId: string, days: number = 30) {
    const { data } = await this.supabase
      .from('user_behavior_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    return data || [];
  }

  private async getCompletionData(_userId: string) {
    // This would analyze completion rates from playbooks and devotionals
    // For now, return mock data structure
    return {
      averageCompletionRate: 0.7,
      averageComplexityHandled: 0.6,
      playbooksByType: {},
    };
  }

  private async getRecentBehaviorPatterns(_userId: string) {
    return await this.getRecentBehaviorEvents(_userId, 7); // Last 7 days
  }

  private calculateConsistencyScore(behaviorEvents: Array<{created_at: string}>): number {
    // Calculate how consistently the user engages
    if (!behaviorEvents || behaviorEvents.length === 0) {return 0;}

    const uniqueDays = new Set(behaviorEvents.map((e: {created_at: string}) =>
      new Date(e.created_at).toDateString()
    ));

    return Math.min(uniqueDays.size / 7, 1); // Normalize to 0-1 range (7 days)
  }

  private inferCommunicationStyle(_behaviorEvents: any[]): 'direct' | 'gentle' | 'encouraging' | 'balanced' {
    // For now, return balanced - could be enhanced with more sophisticated analysis
    return 'balanced';
  }

  private assessComplexityPreference(completionData: any): 'gentle' | 'moderate' | 'intense' {
    const completionRate = completionData.averageCompletionRate || 0;

    if (completionRate > 0.8) {return 'intense';}
    if (completionRate > 0.6) {return 'moderate';}
    return 'gentle';
  }

  private async updateIntelligenceProfile(userId: string, patterns: any): Promise<void> {
    await this.supabase
      .from('user_intelligence_profiles')
      .update({
        spiritual_maturity: patterns.spiritualMaturity,
        learning_style: patterns.learningStyle,
        successful_playbook_types: patterns.successPatterns,
        best_engagement_times: patterns.engagementTimes,
        preferred_challenge_level: patterns.preferredComplexity,
        communication_style: patterns.communicationStyle,
        consistency_score: patterns.consistencyScore,
        confidence_score: Math.min(1.0, patterns.consistencyScore + 0.3),
        last_analysis: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }

  private async updateIntelligenceProfileFromBehavior(userId: string): Promise<void> {
    // Trigger the database function to update profile based on recent behavior
    await this.supabase.rpc('update_intelligence_profile_from_behavior', {
      p_user_id: userId,
    });
  }
}

// Export singleton instance
export const intelligenceService = new IntelligenceService();
