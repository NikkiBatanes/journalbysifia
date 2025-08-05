/**
 * User Context Engine
 * Builds rich context from user input + history for content generation
 * NO UI changes - pure backend intelligence system
 */

import { supabase } from './supabaseClient';

export interface UserContext {
  // Core user data
  userId: string;
  userName: string;
  
  // Current request context
  currentInput: string;
  requestType: 'playbook' | 'devotional' | 'journal_expansion';
  
  // Historical patterns (learned from past interactions)
  recentTopics: string[];
  preferredComplexity: 'simple' | 'moderate' | 'deep';
  communicationStyle: 'direct' | 'gentle' | 'encouraging';
  challengeAreas: string[];
  growthAreas: string[];
  
  // Behavioral insights (local processing)
  averageEngagementTime: number;
  completionPatterns: string[];
  successfulContentTypes: string[];
  
  // Current life context (extracted from recent inputs)
  currentChallenges: string[];
  currentBlessings: string[];
  currentPrayerRequests: string[];
  currentGoals: string[];
  
  // Metadata
  confidenceScore: number; // How much we know about this user
  lastUpdated: string;
}

export interface ContextualPrompt {
  basePrompt: string;
  enhancedPrompt: string;
  contextUsed: string[];
  estimatedRelevance: number;
}

export class UserContextEngine {
  
  /**
   * Build comprehensive user context from input + history
   * This is the core intelligence that makes content highly relevant
   */
  async buildUserContext(
    userId: string, 
    userName: string, 
    currentInput: string, 
    requestType: 'playbook' | 'devotional' | 'journal_expansion'
  ): Promise<UserContext> {
    
    console.log(`[UserContextEngine] Building context for user ${userId}, request: ${requestType}`);
    
    try {
      // 1. Get user's historical data
      const historicalData = await this.getUserHistoricalData(userId);
      
      // 2. Analyze current input for context clues
      const inputAnalysis = await this.analyzeCurrentInput(currentInput);
      
      // 3. Extract behavioral patterns (local processing)
      const behaviorPatterns = await this.extractBehaviorPatterns(userId);
      
      // 4. Build comprehensive context
      const context: UserContext = {
        userId,
        userName,
        currentInput,
        requestType,
        
        // Historical insights
        recentTopics: historicalData.recentTopics,
        preferredComplexity: historicalData.preferredComplexity,
        communicationStyle: historicalData.communicationStyle,
        challengeAreas: historicalData.challengeAreas,
        growthAreas: historicalData.growthAreas,
        
        // Behavioral patterns
        averageEngagementTime: behaviorPatterns.averageEngagementTime,
        completionPatterns: behaviorPatterns.completionPatterns,
        successfulContentTypes: behaviorPatterns.successfulContentTypes,
        
        // Current context from input
        currentChallenges: inputAnalysis.challenges,
        currentBlessings: inputAnalysis.blessings,
        currentPrayerRequests: inputAnalysis.prayerRequests,
        currentGoals: inputAnalysis.goals,
        
        // Metadata
        confidenceScore: this.calculateConfidenceScore(historicalData, behaviorPatterns),
        lastUpdated: new Date().toISOString()
      };
      
      // 5. Store updated context for future use
      await this.storeUserContext(context);
      
      console.log(`[UserContextEngine] Context built with confidence: ${context.confidenceScore}%`);
      return context;
      
    } catch (error) {
      console.error('[UserContextEngine] Error building context:', error);
      
      // Return minimal context if error occurs
      return {
        userId,
        userName,
        currentInput,
        requestType,
        recentTopics: [],
        preferredComplexity: 'moderate',
        communicationStyle: 'encouraging',
        challengeAreas: [],
        growthAreas: [],
        averageEngagementTime: 15,
        completionPatterns: [],
        successfulContentTypes: [],
        currentChallenges: [],
        currentBlessings: [],
        currentPrayerRequests: [],
        currentGoals: [],
        confidenceScore: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }
  
  /**
   * Generate contextual prompt that's highly relevant to user
   * This replaces generic prompts with user-specific ones
   */
  async generateContextualPrompt(
    basePrompt: string, 
    context: UserContext
  ): Promise<ContextualPrompt> {
    
    const contextElements = [];
    
    // Add user-specific context based on confidence level
    if (context.confidenceScore > 20) {
      contextElements.push(`User's name: ${context.userName}`);
      contextElements.push(`Communication style: ${context.communicationStyle}`);
      contextElements.push(`Preferred complexity: ${context.preferredComplexity}`);
    }
    
    if (context.confidenceScore > 40) {
      if (context.recentTopics.length > 0) {
        contextElements.push(`Recent topics of interest: ${context.recentTopics.slice(0, 3).join(', ')}`);
      }
      if (context.challengeAreas.length > 0) {
        contextElements.push(`Areas needing growth: ${context.challengeAreas.slice(0, 2).join(', ')}`);
      }
    }
    
    if (context.confidenceScore > 60) {
      if (context.currentChallenges.length > 0) {
        contextElements.push(`Current challenges: ${context.currentChallenges.join(', ')}`);
      }
      if (context.currentGoals.length > 0) {
        contextElements.push(`Current goals: ${context.currentGoals.join(', ')}`);
      }
      if (context.successfulContentTypes.length > 0) {
        contextElements.push(`Responds well to: ${context.successfulContentTypes.join(', ')}`);
      }
    }
    
    // Build enhanced prompt
    const enhancedPrompt = `${basePrompt}

USER CONTEXT (for highly relevant content):
${contextElements.join('\n')}

Current user input: "${context.currentInput}"

Generate content that directly addresses their input while incorporating their personal context for maximum relevance and impact.`;

    return {
      basePrompt,
      enhancedPrompt,
      contextUsed: contextElements,
      estimatedRelevance: Math.min(95, 60 + context.confidenceScore)
    };
  }
  
  /**
   * Get user's historical data from database
   */
  private async getUserHistoricalData(userId: string) {
    try {
      // Get recent playbooks and devotionals
      const { data: recentContent } = await supabase
        .from('generated_content')
        .select('title, content_type, user_input, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      // Get journal entries for context
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('content, entry_type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      // Extract patterns from historical data
      const recentTopics = this.extractTopicsFromContent(recentContent || []);
      const preferredComplexity = this.analyzeComplexityPreference(recentContent || []);
      const communicationStyle = this.analyzeCommunicationStyle(journalEntries || []);
      const challengeAreas = this.extractChallengeAreas(recentContent || []);
      const growthAreas = this.extractGrowthAreas(recentContent || []);
      
      return {
        recentTopics,
        preferredComplexity,
        communicationStyle,
        challengeAreas,
        growthAreas
      };
      
    } catch (error) {
      console.error('[UserContextEngine] Error getting historical data:', error);
      return {
        recentTopics: [],
        preferredComplexity: 'moderate' as const,
        communicationStyle: 'encouraging' as const,
        challengeAreas: [],
        growthAreas: []
      };
    }
  }
  
  /**
   * Analyze current user input for context clues
   */
  private async analyzeCurrentInput(input: string) {
    const lowercaseInput = input.toLowerCase();
    
    // Extract challenges (keywords that indicate struggles)
    const challengeKeywords = ['struggle', 'difficult', 'hard', 'challenge', 'problem', 'issue', 'worry', 'anxious', 'stress'];
    const challenges = challengeKeywords.filter(keyword => 
      lowercaseInput.includes(keyword)
    ).map(keyword => `dealing with ${keyword}`);
    
    // Extract blessings (positive keywords)
    const blessingKeywords = ['blessed', 'grateful', 'thankful', 'joy', 'happy', 'celebration', 'success'];
    const blessings = blessingKeywords.filter(keyword => 
      lowercaseInput.includes(keyword)
    ).map(keyword => `experiencing ${keyword}`);
    
    // Extract prayer requests (spiritual needs)
    const prayerKeywords = ['pray', 'prayer', 'need prayer', 'pray for', 'healing', 'guidance', 'wisdom'];
    const prayerRequests = prayerKeywords.filter(keyword => 
      lowercaseInput.includes(keyword)
    ).map(keyword => `prayer for ${keyword}`);
    
    // Extract goals (future-oriented language)
    const goalKeywords = ['want to', 'need to', 'goal', 'hope to', 'plan to', 'trying to', 'working on'];
    const goals = goalKeywords.filter(keyword => 
      lowercaseInput.includes(keyword)
    ).map(keyword => `goal related to ${keyword}`);
    
    return {
      challenges,
      blessings,
      prayerRequests,
      goals
    };
  }
  
  /**
   * Extract behavioral patterns from user activity
   */
  private async extractBehaviorPatterns(userId: string) {
    try {
      // Get user behavior events
      const { data: events } = await supabase
        .from('user_behavior_events')
        .select('event_type, event_data, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (!events || events.length === 0) {
        return {
          averageEngagementTime: 15,
          completionPatterns: [],
          successfulContentTypes: []
        };
      }
      
      // Calculate average engagement time
      const engagementEvents = events.filter(e => e.event_type === 'content_engagement');
      const averageEngagementTime = engagementEvents.length > 0 
        ? engagementEvents.reduce((sum, e) => sum + (e.event_data?.duration || 15), 0) / engagementEvents.length
        : 15;
      
      // Find completion patterns
      const completionEvents = events.filter(e => e.event_type === 'content_completed');
      const completionPatterns = [...new Set(completionEvents.map(e => e.event_data?.content_type))];
      
      // Find successful content types
      const successfulContentTypes = [...new Set(
        events
          .filter(e => e.event_type === 'positive_feedback' || e.event_type === 'content_shared')
          .map(e => e.event_data?.content_type)
      )];
      
      return {
        averageEngagementTime,
        completionPatterns,
        successfulContentTypes
      };
      
    } catch (error) {
      console.error('[UserContextEngine] Error extracting behavior patterns:', error);
      return {
        averageEngagementTime: 15,
        completionPatterns: [],
        successfulContentTypes: []
      };
    }
  }
  
  /**
   * Store user context for future use
   */
  private async storeUserContext(context: UserContext) {
    try {
      await supabase
        .from('user_contexts')
        .upsert({
          user_id: context.userId,
          context_data: context,
          confidence_score: context.confidenceScore,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('[UserContextEngine] Error storing context:', error);
    }
  }
  
  /**
   * Helper methods for pattern analysis
   */
  private extractTopicsFromContent(content: any[]): string[] {
    // Extract common topics from titles and inputs
    const allText = content.map(c => `${c.title} ${c.user_input}`).join(' ').toLowerCase();
    const topicKeywords = ['prayer', 'faith', 'family', 'work', 'relationships', 'health', 'finances', 'ministry', 'growth', 'worship'];
    
    return topicKeywords.filter(topic => allText.includes(topic));
  }
  
  private analyzeComplexityPreference(content: any[]): 'simple' | 'moderate' | 'deep' {
    // Analyze length and depth of previous successful content
    if (content.length === 0) return 'moderate';
    
    const avgLength = content.reduce((sum, c) => sum + (c.user_input?.length || 0), 0) / content.length;
    
    if (avgLength < 50) return 'simple';
    if (avgLength > 150) return 'deep';
    return 'moderate';
  }
  
  private analyzeCommunicationStyle(entries: any[]): 'direct' | 'gentle' | 'encouraging' {
    // Default to encouraging for Christian app
    return 'encouraging';
  }
  
  private extractChallengeAreas(content: any[]): string[] {
    const allText = content.map(c => c.user_input || '').join(' ').toLowerCase();
    const challengeAreas = ['patience', 'forgiveness', 'trust', 'fear', 'doubt', 'anger', 'pride'];
    
    return challengeAreas.filter(area => allText.includes(area));
  }
  
  private extractGrowthAreas(content: any[]): string[] {
    const allText = content.map(c => c.user_input || '').join(' ').toLowerCase();
    const growthAreas = ['love', 'compassion', 'wisdom', 'understanding', 'peace', 'joy', 'kindness'];
    
    return growthAreas.filter(area => allText.includes(area));
  }
  
  private calculateConfidenceScore(historicalData: any, behaviorPatterns: any): number {
    let score = 0;
    
    // Historical data contributes to confidence
    if (historicalData.recentTopics.length > 0) score += 20;
    if (historicalData.challengeAreas.length > 0) score += 15;
    if (historicalData.growthAreas.length > 0) score += 15;
    
    // Behavioral patterns contribute to confidence
    if (behaviorPatterns.completionPatterns.length > 0) score += 20;
    if (behaviorPatterns.successfulContentTypes.length > 0) score += 20;
    if (behaviorPatterns.averageEngagementTime > 10) score += 10;
    
    return Math.min(100, score);
  }
}

// Export singleton instance
export const userContextEngine = new UserContextEngine();
