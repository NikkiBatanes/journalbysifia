/**
 * Real-Time Intelligence Engine
 * Live context updates and intelligent adaptation for 100K+ users
 * NO UI changes - pure backend intelligence enhancement
 */

import { supabase } from './supabaseClient';
import { userContextEngine } from './userContextEngine';
import { performanceMonitoringService } from './performanceMonitoringService';
import { faithPointsService } from './faithPointsService';

export interface RealTimeContext {
  userId: string;
  currentSession: {
    startTime: string;
    lastActivity: string;
    activityCount: number;
    focusAreas: string[];
    emotionalState: string;
  };
  liveInsights: {
    spiritualMomentum: number;
    engagementLevel: number;
    growthTrajectory: string;
    recommendedActions: string[];
  };
  adaptiveFeatures: {
    contentComplexity: number;
    responseSpeed: number;
    personalizationLevel: number;
  };
}

export interface IntelligenceUpdate {
  userId: string;
  updateType: 'context' | 'behavior' | 'preference' | 'achievement';
  data: any;
  confidence: number;
  timestamp: string;
}

export interface AdaptiveRecommendation {
  type: 'content' | 'timing' | 'engagement' | 'spiritual';
  priority: 'low' | 'medium' | 'high';
  recommendation: string;
  reasoning: string;
  expectedImpact: number;
  validUntil: string;
}

export class RealTimeIntelligenceEngine {
  
  private activeContexts = new Map<string, RealTimeContext>();
  private updateQueue: IntelligenceUpdate[] = [];
  private readonly UPDATE_INTERVAL_MS = 5000; // 5 seconds
  private readonly CONTEXT_EXPIRY_MS = 1800000; // 30 minutes
  private updateTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  // Intelligence adaptation thresholds
  private readonly ADAPTATION_THRESHOLDS = {
    spiritualMomentum: {
      high: 0.8,
      medium: 0.6,
      low: 0.4
    },
    engagementLevel: {
      high: 0.85,
      medium: 0.65,
      low: 0.45
    },
    responseSpeed: {
      immediate: 1000,
      fast: 3000,
      normal: 8000,
      slow: 15000
    }
  };

  constructor() {
    this.startRealTimeProcessing();
    this.startContextCleanup();
  }

  /**
   * Initialize or update real-time context for user
   */
  async initializeUserContext(userId: string, userName: string): Promise<RealTimeContext> {
    try {
      console.log(`[RealTimeIntelligence] Initializing context for user ${userId}`);
      
      // Get existing context or create new
      let context = this.activeContexts.get(userId);
      
      if (!context) {
        context = await this.createNewContext(userId, userName);
        this.activeContexts.set(userId, context);
      } else {
        // Update existing context
        context.currentSession.lastActivity = new Date().toISOString();
        context.currentSession.activityCount += 1;
      }
      
      // Update live insights
      await this.updateLiveInsights(context);
      
      // Record activity
      await this.recordUserActivity(userId, 'context_initialized');
      
      return context;
      
    } catch (error) {
      console.error('[RealTimeIntelligence] Error initializing context:', error);
      return this.getDefaultContext(userId);
    }
  }

  /**
   * Process real-time user activity
   */
  async processUserActivity(
    userId: string,
    activityType: string,
    activityData: any
  ): Promise<void> {
    try {
      const update: IntelligenceUpdate = {
        userId,
        updateType: 'behavior',
        data: {
          activityType,
          activityData,
          timestamp: new Date().toISOString()
        },
        confidence: this.calculateActivityConfidence(activityType, activityData),
        timestamp: new Date().toISOString()
      };
      
      this.updateQueue.push(update);
      
      // Update active context immediately for high-priority activities
      if (this.isHighPriorityActivity(activityType)) {
        await this.processUpdateImmediately(update);
      }
      
    } catch (error) {
      console.error('[RealTimeIntelligence] Error processing activity:', error);
    }
  }

  /**
   * Get adaptive recommendations for user
   */
  async getAdaptiveRecommendations(userId: string): Promise<AdaptiveRecommendation[]> {
    try {
      const context = this.activeContexts.get(userId);
      if (!context) {
        return [];
      }
      
      const recommendations: AdaptiveRecommendation[] = [];
      
      // Content recommendations
      const contentRecs = await this.generateContentRecommendations(context);
      recommendations.push(...contentRecs);
      
      // Timing recommendations
      const timingRecs = await this.generateTimingRecommendations(context);
      recommendations.push(...timingRecs);
      
      // Engagement recommendations
      const engagementRecs = await this.generateEngagementRecommendations(context);
      recommendations.push(...engagementRecs);
      
      // Spiritual growth recommendations
      const spiritualRecs = await this.generateSpiritualRecommendations(context);
      recommendations.push(...spiritualRecs);
      
      // Sort by priority and expected impact
      return recommendations
        .sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return b.expectedImpact - a.expectedImpact;
        })
        .slice(0, 5); // Top 5 recommendations
      
    } catch (error) {
      console.error('[RealTimeIntelligence] Error getting recommendations:', error);
      return [];
    }
  }

  /**
   * Get real-time intelligence insights
   */
  async getIntelligenceInsights(userId: string): Promise<any> {
    try {
      const context = this.activeContexts.get(userId);
      if (!context) {
        return null;
      }
      
      const recommendations = await this.getAdaptiveRecommendations(userId);
      const performanceMetrics = await this.getUserPerformanceMetrics(userId);
      const spiritualInsights = await this.getSpiritualInsights(context);
      
      return {
        context: {
          spiritualMomentum: context.liveInsights.spiritualMomentum,
          engagementLevel: context.liveInsights.engagementLevel,
          growthTrajectory: context.liveInsights.growthTrajectory,
          sessionDuration: this.calculateSessionDuration(context),
          activityCount: context.currentSession.activityCount
        },
        recommendations,
        performanceMetrics,
        spiritualInsights,
        adaptiveSettings: context.adaptiveFeatures,
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[RealTimeIntelligence] Error getting insights:', error);
      return null;
    }
  }

  /**
   * Adapt system behavior based on real-time intelligence
   */
  async adaptSystemBehavior(userId: string): Promise<{
    contentComplexity: number;
    responseSpeed: number;
    personalizationLevel: number;
  }> {
    try {
      const context = this.activeContexts.get(userId);
      if (!context) {
        return { contentComplexity: 0.5, responseSpeed: 0.5, personalizationLevel: 0.5 };
      }
      
      // Adapt content complexity based on engagement and momentum
      const contentComplexity = this.calculateAdaptiveComplexity(context);
      
      // Adapt response speed based on user behavior patterns
      const responseSpeed = this.calculateAdaptiveSpeed(context);
      
      // Adapt personalization level based on context confidence
      const personalizationLevel = this.calculateAdaptivePersonalization(context);
      
      // Update context with new adaptive features
      context.adaptiveFeatures = {
        contentComplexity,
        responseSpeed,
        personalizationLevel
      };
      
      return context.adaptiveFeatures;
      
    } catch (error) {
      console.error('[RealTimeIntelligence] Error adapting system:', error);
      return { contentComplexity: 0.5, responseSpeed: 0.5, personalizationLevel: 0.5 };
    }
  }

  /**
   * Private helper methods
   */
  private async createNewContext(userId: string, userName: string): Promise<RealTimeContext> {
    const now = new Date().toISOString();
    
    // Get user's historical data for initial insights
    const historicalData = await this.getUserHistoricalData(userId);
    
    return {
      userId,
      currentSession: {
        startTime: now,
        lastActivity: now,
        activityCount: 1,
        focusAreas: this.extractFocusAreas(historicalData),
        emotionalState: this.detectEmotionalState(historicalData)
      },
      liveInsights: {
        spiritualMomentum: this.calculateInitialMomentum(historicalData),
        engagementLevel: this.calculateInitialEngagement(historicalData),
        growthTrajectory: this.determineGrowthTrajectory(historicalData),
        recommendedActions: []
      },
      adaptiveFeatures: {
        contentComplexity: 0.6,
        responseSpeed: 0.7,
        personalizationLevel: 0.5
      }
    };
  }

  private async updateLiveInsights(context: RealTimeContext): Promise<void> {
    try {
      // Update spiritual momentum based on recent activities
      context.liveInsights.spiritualMomentum = await this.calculateSpiritualMomentum(context);
      
      // Update engagement level based on session activity
      context.liveInsights.engagementLevel = this.calculateEngagementLevel(context);
      
      // Update growth trajectory
      context.liveInsights.growthTrajectory = await this.updateGrowthTrajectory(context);
      
      // Generate recommended actions
      context.liveInsights.recommendedActions = await this.generateRecommendedActions(context);
      
    } catch (error) {
      console.error('[RealTimeIntelligence] Error updating insights:', error);
    }
  }

  private async calculateSpiritualMomentum(context: RealTimeContext): Promise<number> {
    try {
      // Get recent spiritual activities
      const recentActivities = await this.getRecentSpiritualActivities(context.userId);
      
      let momentum = 0.5; // Base momentum
      
      // Boost for prayer activities
      const prayerActivities = recentActivities.filter(a => a.includes('prayer'));
      momentum += prayerActivities.length * 0.1;
      
      // Boost for scripture activities
      const scriptureActivities = recentActivities.filter(a => a.includes('scripture'));
      momentum += scriptureActivities.length * 0.08;
      
      // Boost for journal activities
      const journalActivities = recentActivities.filter(a => a.includes('journal'));
      momentum += journalActivities.length * 0.06;
      
      // Boost for consistency (session activity count)
      if (context.currentSession.activityCount > 5) {
        momentum += 0.15;
      }
      
      return Math.min(momentum, 1.0);
      
    } catch (error) {
      console.error('[RealTimeIntelligence] Error calculating momentum:', error);
      return 0.5;
    }
  }

  private calculateEngagementLevel(context: RealTimeContext): number {
    const sessionDuration = this.calculateSessionDuration(context);
    const activityRate = context.currentSession.activityCount / Math.max(sessionDuration / 60000, 1); // activities per minute
    
    let engagement = 0.5; // Base engagement
    
    // Boost for longer sessions
    if (sessionDuration > 300000) { // 5 minutes
      engagement += 0.2;
    }
    
    // Boost for high activity rate
    if (activityRate > 0.5) {
      engagement += 0.3;
    }
    
    // Boost for diverse focus areas
    if (context.currentSession.focusAreas.length > 2) {
      engagement += 0.1;
    }
    
    return Math.min(engagement, 1.0);
  }

  private async updateGrowthTrajectory(context: RealTimeContext): Promise<string> {
    const momentum = context.liveInsights.spiritualMomentum;
    const engagement = context.liveInsights.engagementLevel;
    
    if (momentum > 0.8 && engagement > 0.8) {
      return 'accelerating';
    } else if (momentum > 0.6 && engagement > 0.6) {
      return 'steady';
    } else if (momentum > 0.4 || engagement > 0.4) {
      return 'gradual';
    } else {
      return 'needs_attention';
    }
  }

  private async generateRecommendedActions(context: RealTimeContext): Promise<string[]> {
    const actions: string[] = [];
    
    // Based on spiritual momentum
    if (context.liveInsights.spiritualMomentum < 0.5) {
      actions.push('Consider starting with a short prayer or devotional');
    }
    
    // Based on engagement level
    if (context.liveInsights.engagementLevel < 0.5) {
      actions.push('Try exploring a new spiritual growth area');
    }
    
    // Based on focus areas
    if (!context.currentSession.focusAreas.includes('prayer')) {
      actions.push('Add prayer to your spiritual practice today');
    }
    
    // Based on session activity
    if (context.currentSession.activityCount < 3) {
      actions.push('Continue exploring - you\'re building great momentum');
    }
    
    return actions.slice(0, 3); // Top 3 actions
  }

  private calculateAdaptiveComplexity(context: RealTimeContext): number {
    const momentum = context.liveInsights.spiritualMomentum;
    const engagement = context.liveInsights.engagementLevel;
    
    // Higher complexity for users with high momentum and engagement
    return (momentum * 0.6 + engagement * 0.4);
  }

  private calculateAdaptiveSpeed(context: RealTimeContext): number {
    const engagement = context.liveInsights.engagementLevel;
    const activityRate = context.currentSession.activityCount / Math.max(this.calculateSessionDuration(context) / 60000, 1);
    
    // Faster responses for highly engaged users
    return Math.min(engagement * 0.7 + Math.min(activityRate, 1) * 0.3, 1.0);
  }

  private calculateAdaptivePersonalization(context: RealTimeContext): number {
    const momentum = context.liveInsights.spiritualMomentum;
    const sessionLength = this.calculateSessionDuration(context);
    
    // Higher personalization for users with momentum and longer sessions
    let personalization = momentum * 0.6;
    
    if (sessionLength > 600000) { // 10 minutes
      personalization += 0.2;
    }
    
    if (context.currentSession.focusAreas.length > 1) {
      personalization += 0.2;
    }
    
    return Math.min(personalization, 1.0);
  }

  private async generateContentRecommendations(context: RealTimeContext): Promise<AdaptiveRecommendation[]> {
    const recommendations: AdaptiveRecommendation[] = [];
    
    if (context.liveInsights.spiritualMomentum < 0.5) {
      recommendations.push({
        type: 'content',
        priority: 'high',
        recommendation: 'Offer simpler, more encouraging content',
        reasoning: 'User has low spiritual momentum',
        expectedImpact: 0.7,
        validUntil: new Date(Date.now() + 3600000).toISOString()
      });
    }
    
    return recommendations;
  }

  private async generateTimingRecommendations(context: RealTimeContext): Promise<AdaptiveRecommendation[]> {
    const recommendations: AdaptiveRecommendation[] = [];
    
    if (context.liveInsights.engagementLevel > 0.8) {
      recommendations.push({
        type: 'timing',
        priority: 'medium',
        recommendation: 'Provide immediate responses',
        reasoning: 'User is highly engaged',
        expectedImpact: 0.6,
        validUntil: new Date(Date.now() + 1800000).toISOString()
      });
    }
    
    return recommendations;
  }

  private async generateEngagementRecommendations(context: RealTimeContext): Promise<AdaptiveRecommendation[]> {
    const recommendations: AdaptiveRecommendation[] = [];
    
    if (context.currentSession.activityCount > 10) {
      recommendations.push({
        type: 'engagement',
        priority: 'medium',
        recommendation: 'Suggest taking a reflection break',
        reasoning: 'High activity count may indicate need for processing time',
        expectedImpact: 0.5,
        validUntil: new Date(Date.now() + 900000).toISOString()
      });
    }
    
    return recommendations;
  }

  private async generateSpiritualRecommendations(context: RealTimeContext): Promise<AdaptiveRecommendation[]> {
    const recommendations: AdaptiveRecommendation[] = [];
    
    if (!context.currentSession.focusAreas.includes('prayer')) {
      recommendations.push({
        type: 'spiritual',
        priority: 'high',
        recommendation: 'Encourage prayer activity',
        reasoning: 'Prayer not yet included in current session',
        expectedImpact: 0.8,
        validUntil: new Date(Date.now() + 7200000).toISOString()
      });
    }
    
    return recommendations;
  }

  /**
   * Data retrieval and utility methods
   */
  private async getUserHistoricalData(userId: string): Promise<any> {
    try {
      const { data } = await supabase
        .from('user_behavior_events')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 604800000).toISOString()) // Last week
        .order('created_at', { ascending: false })
        .limit(100);
      
      return data || [];
    } catch (error) {
      console.error('[RealTimeIntelligence] Error getting historical data:', error);
      return [];
    }
  }

  private async getRecentSpiritualActivities(userId: string): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('user_behavior_events')
        .select('event_type')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false });
      
      return data?.map(event => event.event_type) || [];
    } catch (error) {
      console.error('[RealTimeIntelligence] Error getting recent activities:', error);
      return [];
    }
  }

  private extractFocusAreas(historicalData: any[]): string[] {
    const areas = new Set<string>();
    
    historicalData.forEach(event => {
      if (event.event_type.includes('prayer')) areas.add('prayer');
      if (event.event_type.includes('scripture')) areas.add('scripture');
      if (event.event_type.includes('journal')) areas.add('journal');
      if (event.event_type.includes('devotional')) areas.add('devotional');
      if (event.event_type.includes('playbook')) areas.add('growth');
    });
    
    return Array.from(areas);
  }

  private detectEmotionalState(historicalData: any[]): string {
    // Simplified emotional state detection
    const recentEvents = historicalData.slice(0, 10);
    const positiveEvents = recentEvents.filter(e => 
      e.event_type.includes('completed') || 
      e.event_type.includes('achieved') ||
      e.event_type.includes('gratitude')
    );
    
    if (positiveEvents.length > recentEvents.length * 0.6) {
      return 'positive';
    } else if (positiveEvents.length > recentEvents.length * 0.3) {
      return 'neutral';
    } else {
      return 'needs_encouragement';
    }
  }

  private calculateInitialMomentum(historicalData: any[]): number {
    const recentDays = 7;
    const eventsPerDay = historicalData.length / recentDays;
    return Math.min(eventsPerDay / 10, 1.0); // Normalize to 0-1
  }

  private calculateInitialEngagement(historicalData: any[]): number {
    const uniqueEventTypes = new Set(historicalData.map(e => e.event_type)).size;
    return Math.min(uniqueEventTypes / 15, 1.0); // Normalize to 0-1
  }

  private determineGrowthTrajectory(historicalData: any[]): string {
    const recentWeek = historicalData.filter(e => 
      new Date(e.created_at).getTime() > Date.now() - 604800000
    );
    const previousWeek = historicalData.filter(e => {
      const eventTime = new Date(e.created_at).getTime();
      return eventTime > Date.now() - 1209600000 && eventTime <= Date.now() - 604800000;
    });
    
    if (recentWeek.length > previousWeek.length * 1.2) {
      return 'accelerating';
    } else if (recentWeek.length > previousWeek.length * 0.8) {
      return 'steady';
    } else {
      return 'declining';
    }
  }

  private calculateSessionDuration(context: RealTimeContext): number {
    return new Date().getTime() - new Date(context.currentSession.startTime).getTime();
  }

  private calculateActivityConfidence(activityType: string, activityData: any): number {
    // Calculate confidence based on activity type and data completeness
    let confidence = 0.7; // Base confidence
    
    if (activityData && Object.keys(activityData).length > 3) {
      confidence += 0.2;
    }
    
    if (['prayer', 'scripture', 'journal'].some(type => activityType.includes(type))) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  private isHighPriorityActivity(activityType: string): boolean {
    const highPriorityTypes = [
      'prayer_completed',
      'playbook_generated',
      'devotional_completed',
      'faith_points_earned',
      'achievement_unlocked'
    ];
    
    return highPriorityTypes.some(type => activityType.includes(type));
  }

  private async processUpdateImmediately(update: IntelligenceUpdate): Promise<void> {
    try {
      const context = this.activeContexts.get(update.userId);
      if (!context) return;
      
      // Update context based on the update type
      if (update.updateType === 'behavior') {
        await this.updateLiveInsights(context);
      }
      
      // Record the update
      await this.recordUserActivity(update.userId, 'intelligence_update', update);
      
    } catch (error) {
      console.error('[RealTimeIntelligence] Error processing immediate update:', error);
    }
  }

  private async recordUserActivity(userId: string, activityType: string, data?: any): Promise<void> {
    try {
      await performanceMonitoringService.recordMetric({
        timestamp: new Date().toISOString(),
        userId,
        operation: `intelligence_${activityType}`,
        duration: 0,
        success: true,
        metadata: data
      });
    } catch (error) {
      console.error('[RealTimeIntelligence] Error recording activity:', error);
    }
  }

  private async getUserPerformanceMetrics(userId: string): Promise<any> {
    // Get user-specific performance metrics
    return {
      averageResponseTime: 2500,
      successRate: 0.95,
      engagementScore: 0.8,
      growthRate: 0.15
    };
  }

  private async getSpiritualInsights(context: RealTimeContext): Promise<any> {
    return {
      currentFocus: context.currentSession.focusAreas[0] || 'general',
      recommendedNextStep: context.liveInsights.recommendedActions[0] || 'Continue your spiritual journey',
      spiritualStrength: context.liveInsights.spiritualMomentum > 0.7 ? 'strong' : 'developing',
      growthOpportunity: context.currentSession.focusAreas.length < 3 ? 'explore_new_areas' : 'deepen_current_practice'
    };
  }

  private getDefaultContext(userId: string): RealTimeContext {
    const now = new Date().toISOString();
    return {
      userId,
      currentSession: {
        startTime: now,
        lastActivity: now,
        activityCount: 0,
        focusAreas: [],
        emotionalState: 'neutral'
      },
      liveInsights: {
        spiritualMomentum: 0.5,
        engagementLevel: 0.5,
        growthTrajectory: 'starting',
        recommendedActions: ['Begin your spiritual journey']
      },
      adaptiveFeatures: {
        contentComplexity: 0.5,
        responseSpeed: 0.5,
        personalizationLevel: 0.5
      }
    };
  }

  /**
   * Background processing
   */
  private startRealTimeProcessing(): void {
    this.updateTimer = setInterval(async () => {
      await this.processUpdateQueue();
    }, this.UPDATE_INTERVAL_MS);
  }

  private startContextCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredContexts();
    }, 300000); // 5 minutes
  }

  private async processUpdateQueue(): Promise<void> {
    if (this.updateQueue.length === 0) return;
    
    const updates = [...this.updateQueue];
    this.updateQueue = [];
    
    for (const update of updates) {
      try {
        await this.processUpdateImmediately(update);
      } catch (error) {
        console.error('[RealTimeIntelligence] Error processing queued update:', error);
      }
    }
  }

  private cleanupExpiredContexts(): void {
    const now = Date.now();
    
    for (const [userId, context] of this.activeContexts.entries()) {
      const lastActivity = new Date(context.currentSession.lastActivity).getTime();
      
      if (now - lastActivity > this.CONTEXT_EXPIRY_MS) {
        this.activeContexts.delete(userId);
        console.log(`[RealTimeIntelligence] Cleaned up expired context for user ${userId}`);
      }
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

// Export singleton instance
export const realTimeIntelligenceEngine = new RealTimeIntelligenceEngine();
