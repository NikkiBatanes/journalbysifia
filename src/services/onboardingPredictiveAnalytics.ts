/**
 * Onboarding Predictive Analytics Service
 * Advanced analytics and user journey prediction for onboarding optimization
 * Phase 4: Predictive Analytics
 */

import { supabase } from './supabaseClient';
import { onboardingService } from './onboardingService';

export interface UserJourneyPrediction {
  userId: string;
  currentStep: number;
  predictedCompletionProbability: number;
  predictedAbandonmentRisk: 'low' | 'medium' | 'high';
  recommendedInterventions: string[];
  predictedCompletionTime: number; // in minutes
  confidenceScore: number;
  factors: Array<{
    name: string;
    impact: number; // -1 to 1
    description: string;
  }>;
}

export interface ChurnPrediction {
  userId: string;
  churnProbability: number;
  riskLevel: 'low' | 'medium' | 'high';
  keyRiskFactors: string[];
  recommendedActions: string[];
  timeToChurn: number; // estimated days
}

export interface ConversionPrediction {
  userId: string;
  christAcceptanceProbability: number;
  trialConversionProbability: number;
  optimalTouchpoints: string[];
  recommendedContent: string[];
  bestContactTime: string;
}

export interface PredictiveInsights {
  overallTrends: {
    completionRateTrend: 'increasing' | 'decreasing' | 'stable';
    averageCompletionTimeTrend: 'improving' | 'worsening' | 'stable';
    christAcceptanceRateTrend: 'increasing' | 'decreasing' | 'stable';
  };
  segmentPerformance: Array<{
    segment: string;
    performance: 'above_average' | 'average' | 'below_average';
    keyMetrics: Record<string, number>;
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    category: 'ui_ux' | 'content' | 'timing' | 'personalization';
    description: string;
    expectedImpact: number;
  }>;
}

class OnboardingPredictiveAnalytics {
  private supabase = supabase;

  /**
   * Predict user journey completion
   */
  async predictUserJourney(userId: string): Promise<UserJourneyPrediction> {
    try {
      // Get user's current progress and behavior data
      const progress = await onboardingService.getOnboardingProgress(userId);
      const faithProfile = await onboardingService.getFaithJourneyProfile(userId);
      const personalizationProfile = await onboardingService.getPersonalizationProfile(userId);

      if (!progress) {
        throw new Error('User progress not found');
      }

      // Calculate completion probability based on multiple factors
      const factors = this.calculatePredictionFactors(progress, faithProfile, personalizationProfile);
      const completionProbability = this.calculateCompletionProbability(factors);
      const abandonmentRisk = this.calculateAbandonmentRisk(completionProbability, factors);
      const recommendedInterventions = this.generateInterventions(factors, abandonmentRisk);
      const predictedCompletionTime = this.predictCompletionTime(progress, factors);
      const confidenceScore = this.calculateConfidenceScore(factors);

      return {
        userId,
        currentStep: progress.current_step,
        predictedCompletionProbability: completionProbability,
        predictedAbandonmentRisk: abandonmentRisk,
        recommendedInterventions,
        predictedCompletionTime,
        confidenceScore,
        factors,
      };
    } catch (error) {
      console.error('Error predicting user journey:', error);
      throw error;
    }
  }

  /**
   * Calculate prediction factors
   */
  private calculatePredictionFactors(
    progress: any,
    faithProfile: any,
    personalizationProfile: any
  ): Array<{ name: string; impact: number; description: string }> {
    const factors = [];

    // Time spent factor
    const avgTimePerStep = progress.time_spent_seconds / progress.current_step;
    const timeImpact = avgTimePerStep > 120 ? 0.3 : avgTimePerStep < 30 ? -0.2 : 0.1;
    factors.push({
      name: 'time_engagement',
      impact: timeImpact,
      description: `User spends ${avgTimePerStep.toFixed(0)}s per step on average`,
    });

    // Progress momentum factor
    const completionRate = progress.completed_steps.length / progress.current_step;
    const momentumImpact = completionRate > 0.8 ? 0.4 : completionRate < 0.5 ? -0.3 : 0.1;
    factors.push({
      name: 'progress_momentum',
      impact: momentumImpact,
      description: `${(completionRate * 100).toFixed(0)}% step completion rate`,
    });

    // Faith engagement factor
    if (faithProfile) {
      const faithEngagement = faithProfile.has_accepted_christ ? 0.5 :
                             faithProfile.spiritual_maturity_level === 'growing' ? 0.3 : 0.1;
      factors.push({
        name: 'faith_engagement',
        impact: faithEngagement,
        description: `Faith engagement level: ${faithProfile.spiritual_maturity_level || 'unknown'}`,
      });
    }

    // Personalization completeness factor
    if (personalizationProfile) {
      const personalizedFields = Object.values(personalizationProfile).filter(v => v !== null).length;
      const personalizationImpact = personalizedFields > 5 ? 0.2 : personalizedFields < 3 ? -0.1 : 0.1;
      factors.push({
        name: 'personalization_completeness',
        impact: personalizationImpact,
        description: `${personalizedFields} personalization fields completed`,
      });
    }

    // Session consistency factor
    const daysSinceStart = (Date.now() - new Date(progress.started_at).getTime()) / (1000 * 60 * 60 * 24);
    const sessionConsistency = daysSinceStart < 1 ? 0.3 : daysSinceStart > 7 ? -0.4 : 0.1;
    factors.push({
      name: 'session_consistency',
      impact: sessionConsistency,
      description: `${daysSinceStart.toFixed(1)} days since onboarding started`,
    });

    return factors;
  }

  /**
   * Calculate completion probability
   */
  private calculateCompletionProbability(factors: Array<{ impact: number }>): number {
    const baseRate = 0.65; // Historical completion rate
    const factorSum = factors.reduce((sum, factor) => sum + factor.impact, 0);
    const adjustedProbability = baseRate + (factorSum * 0.2);

    return Math.max(0.1, Math.min(0.95, adjustedProbability));
  }

  /**
   * Calculate abandonment risk
   */
  private calculateAbandonmentRisk(
    completionProbability: number,
    factors: Array<{ impact: number }>
  ): 'low' | 'medium' | 'high' {
    const negativeFactors = factors.filter(f => f.impact < 0).length;

    if (completionProbability < 0.3 || negativeFactors >= 3) {return 'high';}
    if (completionProbability < 0.6 || negativeFactors >= 2) {return 'medium';}
    return 'low';
  }

  /**
   * Generate intervention recommendations
   */
  private generateInterventions(
    factors: Array<{ name: string; impact: number }>,
    risk: 'low' | 'medium' | 'high'
  ): string[] {
    const interventions = [];

    if (risk === 'high') {
      interventions.push('Send immediate encouragement notification');
      interventions.push('Offer personal support chat');
    }

    const lowEngagementFactor = factors.find(f => f.name === 'time_engagement' && f.impact < 0);
    if (lowEngagementFactor) {
      interventions.push('Simplify current step content');
      interventions.push('Add progress celebration');
    }

    const slowProgressFactor = factors.find(f => f.name === 'progress_momentum' && f.impact < 0);
    if (slowProgressFactor) {
      interventions.push('Highlight benefits of completion');
      interventions.push('Show testimonials from similar users');
    }

    const sessionFactor = factors.find(f => f.name === 'session_consistency' && f.impact < -0.2);
    if (sessionFactor) {
      interventions.push('Send gentle reminder notification');
      interventions.push('Offer to resume where left off');
    }

    return interventions;
  }

  /**
   * Predict completion time
   */
  private predictCompletionTime(progress: any, factors: Array<{ impact: number }>): number {
    const baseTimePerStep = 90; // seconds
    const remainingSteps = progress.total_steps - progress.current_step;
    const factorMultiplier = 1 + (factors.reduce((sum, f) => sum + f.impact, 0) * 0.3);

    return Math.max(30, baseTimePerStep * remainingSteps * factorMultiplier / 60); // in minutes
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(factors: Array<{ impact: number }>): number {
    const factorCount = factors.length;
    const factorVariance = this.calculateVariance(factors.map(f => f.impact));

    // Higher confidence with more factors and lower variance
    const baseConfidence = Math.min(0.9, factorCount * 0.15);
    const variancePenalty = factorVariance * 0.3;

    return Math.max(0.3, baseConfidence - variancePenalty);
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Predict churn risk
   */
  async predictChurnRisk(userId: string): Promise<ChurnPrediction> {
    const journey = await this.predictUserJourney(userId);

    const churnProbability = 1 - journey.predictedCompletionProbability;
    const riskLevel = churnProbability > 0.7 ? 'high' : churnProbability > 0.4 ? 'medium' : 'low';

    const keyRiskFactors = journey.factors
      .filter(f => f.impact < -0.1)
      .map(f => f.description);

    const recommendedActions = [
      ...journey.recommendedInterventions,
      'Personalize content recommendations',
      'Adjust notification timing',
    ];

    const timeToChurn = churnProbability > 0.5 ?
      Math.max(1, 7 - (churnProbability * 7)) : 14;

    return {
      userId,
      churnProbability,
      riskLevel,
      keyRiskFactors,
      recommendedActions,
      timeToChurn,
    };
  }

  /**
   * Predict conversion opportunities
   */
  async predictConversionOpportunities(userId: string): Promise<ConversionPrediction> {
    const faithProfile = await onboardingService.getFaithJourneyProfile(userId);
    const personalizationProfile = await onboardingService.getPersonalizationProfile(userId);

    // Christ acceptance probability
    let christAcceptanceProbability = 0.2; // base rate
    if (faithProfile) {
      if (faithProfile.spiritual_maturity === 'growing') {christAcceptanceProbability += 0.3;}
      if (faithProfile.church_attendance === 'weekly') {christAcceptanceProbability += 0.2;}
      if (faithProfile.prayer_frequency === 'daily') {christAcceptanceProbability += 0.2;}
    }

    // Trial conversion probability
    let trialConversionProbability = 0.15; // base rate
    if (personalizationProfile) {
      if (personalizationProfile.daily_commitment_minutes > 10) {trialConversionProbability += 0.2;}
      if (personalizationProfile.likes_community_features) {trialConversionProbability += 0.15;}
    }

    const optimalTouchpoints = [
      'After completing faith journey step',
      'During goal selection',
      'At trial setup screen',
    ];

    const recommendedContent = [
      'Personal testimony videos',
      'Community success stories',
      'Feature demonstration',
    ];

    const bestContactTime = personalizationProfile?.optimal_notification_times?.[0] || 'evening';

    return {
      userId,
      christAcceptanceProbability: Math.min(0.9, christAcceptanceProbability),
      trialConversionProbability: Math.min(0.8, trialConversionProbability),
      optimalTouchpoints,
      recommendedContent,
      bestContactTime,
    };
  }

  /**
   * Generate predictive insights for admin dashboard
   */
  async generatePredictiveInsights(): Promise<PredictiveInsights> {
    // This would analyze historical data to generate trends and recommendations
    // For now, providing a structured response

    return {
      overallTrends: {
        completionRateTrend: 'increasing',
        averageCompletionTimeTrend: 'improving',
        christAcceptanceRateTrend: 'stable',
      },
      segmentPerformance: [
        {
          segment: 'New Believers',
          performance: 'above_average',
          keyMetrics: { completionRate: 78, avgTime: 12.5, conversionRate: 45 },
        },
        {
          segment: 'Growing Christians',
          performance: 'average',
          keyMetrics: { completionRate: 65, avgTime: 15.2, conversionRate: 32 },
        },
        {
          segment: 'Mature Believers',
          performance: 'below_average',
          keyMetrics: { completionRate: 52, avgTime: 18.7, conversionRate: 28 },
        },
      ],
      recommendations: [
        {
          priority: 'high',
          category: 'personalization',
          description: 'Implement dynamic content based on spiritual maturity level',
          expectedImpact: 15,
        },
        {
          priority: 'medium',
          category: 'timing',
          description: 'Optimize notification timing based on user behavior patterns',
          expectedImpact: 8,
        },
        {
          priority: 'medium',
          category: 'ui_ux',
          description: 'Simplify goal selection interface for better engagement',
          expectedImpact: 12,
        },
      ],
    };
  }

  /**
   * Batch predict for multiple users
   */
  async batchPredictUserJourneys(userIds: string[]): Promise<UserJourneyPrediction[]> {
    const predictions = [];

    for (const userId of userIds) {
      try {
        const prediction = await this.predictUserJourney(userId);
        predictions.push(prediction);
      } catch (error) {
        console.error(`Failed to predict journey for user ${userId}:`, error);
      }
    }

    return predictions;
  }
}

export const onboardingPredictiveAnalytics = new OnboardingPredictiveAnalytics();
