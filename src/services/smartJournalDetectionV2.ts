/**
 * Smart Journal Detection V2
 * Enhanced pattern recognition for intelligent journal routing
 * NO UI changes - pure backend intelligence enhancement
 */

import { userContextEngine } from './userContextEngine';
import { Logger } from '../utils/ProductionLogger';
import { faithPointsService } from './faithPointsService';

export interface JournalDetectionResult {
  detectedType: string;
  confidence: number;
  suggestedComponent: string;
  intelligentPrompts?: string[];
  contextualGuidance?: string;
  relatedScriptures?: string[];
  actionSuggestions?: string[];
}

export interface JournalAnalysis {
  primaryType: string;
  secondaryTypes: string[];
  emotionalTone: string;
  spiritualThemes: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
  recommendedFollowUp: string[];
}

export class SmartJournalDetectionV2 {

  // Enhanced pattern recognition for journal types
  private readonly JOURNAL_PATTERNS = {
    timeblock: {
      keywords: ['schedule', 'meeting', 'appointment', 'time', 'calendar', 'plan', 'agenda', 'event'],
      phrases: ['at', 'from', 'to', 'pm', 'am', 'o\'clock', 'today', 'tomorrow', 'next week'],
      confidence_boost: 0.3,
    },
    reflection: {
      keywords: ['think', 'feel', 'realize', 'understand', 'learn', 'discover', 'insight', 'wonder'],
      phrases: ['i think', 'i feel', 'i realize', 'i learned', 'it made me', 'i wonder'],
      confidence_boost: 0.4,
    },
    prayer: {
      keywords: ['pray', 'god', 'lord', 'jesus', 'father', 'holy spirit', 'amen', 'bless'],
      phrases: ['dear god', 'heavenly father', 'lord jesus', 'pray for', 'thank you god'],
      confidence_boost: 0.5,
    },
    gratitude: {
      keywords: ['grateful', 'thankful', 'blessed', 'appreciate', 'thank', 'blessing'],
      phrases: ['i am grateful', 'thankful for', 'blessed by', 'appreciate', 'thank god'],
      confidence_boost: 0.4,
    },
    financial: {
      keywords: ['money', 'budget', 'expense', 'income', 'tithe', 'offering', 'donation', 'cost'],
      phrases: ['spent', 'earned', 'saved', 'gave', 'donated', 'tithed', 'budget for'],
      confidence_boost: 0.4,
    },
    goal_setting: {
      keywords: ['goal', 'plan', 'achieve', 'target', 'objective', 'aim', 'resolution'],
      phrases: ['i want to', 'my goal is', 'i plan to', 'i will', 'i commit to'],
      confidence_boost: 0.3,
    },
    struggle: {
      keywords: ['struggle', 'difficult', 'hard', 'challenge', 'problem', 'worry', 'anxiety'],
      phrases: ['struggling with', 'having trouble', 'difficult time', 'worried about'],
      confidence_boost: 0.4,
    },
    victory: {
      keywords: ['victory', 'success', 'breakthrough', 'overcome', 'achieved', 'accomplished'],
      phrases: ['i overcame', 'breakthrough in', 'successful in', 'achieved my'],
      confidence_boost: 0.4,
    },
  };

  // Emotional tone detection
  private readonly EMOTIONAL_PATTERNS = {
    joyful: ['happy', 'joy', 'excited', 'blessed', 'grateful', 'amazing', 'wonderful'],
    peaceful: ['peace', 'calm', 'serene', 'quiet', 'still', 'restful', 'tranquil'],
    struggling: ['sad', 'difficult', 'hard', 'struggle', 'pain', 'hurt', 'worry'],
    hopeful: ['hope', 'faith', 'trust', 'believe', 'confident', 'optimistic'],
    confused: ['confused', 'uncertain', 'lost', 'don\'t know', 'unclear', 'mixed'],
    determined: ['determined', 'committed', 'focused', 'resolved', 'dedicated'],
  };

  // Spiritual themes detection
  private readonly SPIRITUAL_THEMES = {
    faith_growth: ['faith', 'grow', 'spiritual', 'mature', 'deeper', 'closer to god'],
    prayer_life: ['prayer', 'pray', 'communion', 'talk to god', 'quiet time'],
    scripture_study: ['bible', 'scripture', 'word', 'study', 'read', 'verse'],
    service: ['serve', 'help', 'ministry', 'volunteer', 'give', 'love others'],
    forgiveness: ['forgive', 'mercy', 'grace', 'reconcile', 'heal', 'restore'],
    purpose: ['purpose', 'calling', 'mission', 'plan', 'destiny', 'will of god'],
    relationships: ['relationship', 'family', 'friend', 'marriage', 'community'],
    stewardship: ['steward', 'manage', 'resource', 'time', 'talent', 'treasure'],
  };

  /**
   * Detect journal type with enhanced intelligence
   */
  async detectJournalType(
    userId: string,
    content: string,
    userName: string = 'User'
  ): Promise<JournalDetectionResult> {
    try {

      // Get user context for personalized detection
      const userContext = await userContextEngine.buildUserContext(
        userId,
        userName,
        content,
        'journal_analysis' as any
      );

      // Perform pattern analysis
      const patternAnalysis = this.analyzePatterns(content);
      const emotionalAnalysis = this.analyzeEmotionalTone(content);
      const spiritualAnalysis = this.analyzeSpiritualThemes(content);

      // Combine analyses for final detection
      const detectionResult = await this.combineAnalyses(
        patternAnalysis,
        emotionalAnalysis,
        spiritualAnalysis,
        userContext
      );

      // Generate intelligent prompts and guidance
      const enhancedResult = await this.enhanceWithIntelligence(
        detectionResult,
        content,
        userContext
      );

      // Record behavior event for learning
      await this.recordDetectionEvent();

      // Award faith points for journaling
      await faithPointsService.awardPoints(
        userId,
        'journal_entry',
        {
          detectedType: enhancedResult.detectedType,
          confidence: enhancedResult.confidence,
        }
      );

      return enhancedResult;

    } catch (error) {
      Logger.error('[SmartJournalDetectionV2] Error detecting journal type', error as Error, { component: 'smartJournalDetectionV2' });

      // Return fallback detection
      return {
        detectedType: 'reflection',
        confidence: 50,
        suggestedComponent: 'ReflectionJournal',
        intelligentPrompts: ['What are you thinking about today?'],
        contextualGuidance: 'Take time to reflect on your thoughts and feelings.',
      };
    }
  }

  /**
   * Perform comprehensive journal analysis
   */
  async analyzeJournalContent(
    userId: string,
    content: string,
    userName: string = 'User'
  ): Promise<JournalAnalysis> {
    try {
      const detectionResult = await this.detectJournalType(userId, content, userName);
      const emotionalTone = this.analyzeEmotionalTone(content);
      const spiritualThemes = this.analyzeSpiritualThemes(content);

      // Determine urgency level
      const urgencyLevel = this.determineUrgencyLevel(content);

      // Generate follow-up recommendations
      const recommendedFollowUp = this.generateFollowUpRecommendations(
        detectionResult.detectedType,
        emotionalTone.primaryTone,
        urgencyLevel
      );

      return {
        primaryType: detectionResult.detectedType,
        secondaryTypes: this.getSecondaryTypes(content),
        emotionalTone: emotionalTone.primaryTone,
        spiritualThemes: spiritualThemes.themes,
        urgencyLevel,
        recommendedFollowUp,
      };

    } catch (error) {
      Logger.error('[SmartJournalDetectionV2] Error analyzing journal', error as Error, { component: 'smartJournalDetectionV2' });

      return {
        primaryType: 'reflection',
        secondaryTypes: [],
        emotionalTone: 'neutral',
        spiritualThemes: [],
        urgencyLevel: 'low',
        recommendedFollowUp: ['Continue reflecting on your thoughts'],
      };
    }
  }

  /**
   * Analyze patterns in the content
   */
  private analyzePatterns(content: string): { [key: string]: number } {
    const contentLower = content.toLowerCase();
    const scores: { [key: string]: number } = {};

    for (const [type, patterns] of Object.entries(this.JOURNAL_PATTERNS)) {
      let score = 0;

      // Check keywords
      for (const keyword of patterns.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          score += matches.length * 0.1;
        }
      }

      // Check phrases
      for (const phrase of patterns.phrases) {
        if (contentLower.includes(phrase)) {
          score += patterns.confidence_boost;
        }
      }

      scores[type] = Math.min(score, 1.0); // Cap at 1.0
    }

    return scores;
  }

  /**
   * Analyze emotional tone
   */
  private analyzeEmotionalTone(content: string): { primaryTone: string; confidence: number; allTones: { [key: string]: number } } {
    const contentLower = content.toLowerCase();
    const toneScores: { [key: string]: number } = {};

    for (const [tone, keywords] of Object.entries(this.EMOTIONAL_PATTERNS)) {
      let score = 0;

      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          score += matches.length;
        }
      }

      toneScores[tone] = score;
    }

    // Find primary tone
    const primaryTone = Object.keys(toneScores).reduce((a, b) =>
      toneScores[a] > toneScores[b] ? a : b
    );

    const maxScore = Math.max(...Object.values(toneScores));
    const confidence = maxScore > 0 ? Math.min(maxScore * 20, 100) : 50;

    return {
      primaryTone: maxScore > 0 ? primaryTone : 'neutral',
      confidence,
      allTones: toneScores,
    };
  }

  /**
   * Analyze spiritual themes
   */
  private analyzeSpiritualThemes(content: string): { themes: string[]; confidence: number } {
    const contentLower = content.toLowerCase();
    const themeScores: { [key: string]: number } = {};

    for (const [theme, keywords] of Object.entries(this.SPIRITUAL_THEMES)) {
      let score = 0;

      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          score += 1;
        }
      }

      if (score > 0) {
        themeScores[theme] = score;
      }
    }

    // Get top themes
    const sortedThemes = Object.entries(themeScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([theme]) => theme);

    const totalScore = Object.values(themeScores).reduce((sum, score) => sum + score, 0);
    const confidence = Math.min(totalScore * 15, 100);

    return {
      themes: sortedThemes,
      confidence,
    };
  }

  /**
   * Combine all analyses for final detection
   */
  private async combineAnalyses(
    patternAnalysis: { [key: string]: number },
    emotionalAnalysis: any,
    spiritualAnalysis: any,
    userContext: any
  ): Promise<{ detectedType: string; confidence: number }> {

    // Find highest scoring pattern
    const topPattern = Object.entries(patternAnalysis)
      .sort(([,a], [,b]) => b - a)[0];

    if (!topPattern || topPattern[1] < 0.1) {
      // Default to reflection if no clear pattern
      return { detectedType: 'reflection', confidence: 50 };
    }

    const [detectedType, patternScore] = topPattern;

    // Boost confidence based on context and emotional analysis
    let confidence = patternScore * 100;

    // Context boost
    if (userContext.confidenceScore > 70) {
      confidence += 10;
    }

    // Emotional consistency boost
    if (this.isEmotionallyConsistent(detectedType, emotionalAnalysis.primaryTone)) {
      confidence += 15;
    }

    // Spiritual theme boost
    if (spiritualAnalysis.themes.length > 0) {
      confidence += 10;
    }

    return {
      detectedType,
      confidence: Math.min(Math.round(confidence), 95), // Cap at 95%
    };
  }

  /**
   * Enhance detection with intelligent prompts and guidance
   */
  private async enhanceWithIntelligence(
    baseResult: { detectedType: string; confidence: number },
    content: string,
    userContext: any
  ): Promise<JournalDetectionResult> {

    const intelligentPrompts = this.generateIntelligentPrompts(baseResult.detectedType, content);
    const contextualGuidance = this.generateContextualGuidance(baseResult.detectedType, userContext);
    const relatedScriptures = this.getRelatedScriptures(baseResult.detectedType);
    const actionSuggestions = this.generateActionSuggestions(baseResult.detectedType);
    const suggestedComponent = this.getSuggestedComponent(baseResult.detectedType);

    return {
      detectedType: baseResult.detectedType,
      confidence: baseResult.confidence,
      suggestedComponent,
      intelligentPrompts,
      contextualGuidance,
      relatedScriptures,
      actionSuggestions,
    };
  }

  /**
   * Helper methods for intelligence enhancement
   */
  private generateIntelligentPrompts(type: string, _content: string): string[] {
    const prompts: { [key: string]: string[] } = {
      timeblock: [
        'How can you honor God in this scheduled time?',
        'What spiritual preparation do you need for this event?',
        'How can this time serve your spiritual growth?',
      ],
      reflection: [
        'What is God teaching you through this experience?',
        'How does this align with your spiritual journey?',
        'What scripture comes to mind as you reflect?',
      ],
      prayer: [
        'What specific prayers are on your heart today?',
        'How has God been answering your recent prayers?',
        'What are you most grateful for in prayer?',
      ],
      gratitude: [
        'How has God\'s goodness been evident in your life?',
        'What unexpected blessings have you noticed?',
        'How can you share this gratitude with others?',
      ],
      financial: [
        'How can you honor God with your financial decisions?',
        'What does faithful stewardship look like for you?',
        'How can you trust God more with your finances?',
      ],
      struggle: [
        'How can you invite God into this struggle?',
        'What promises from God can you hold onto?',
        'Who in your community can support you through this?',
      ],
      victory: [
        'How do you see God\'s hand in this victory?',
        'How can you use this success to serve others?',
        'What did you learn about God through this experience?',
      ],
    };

    return prompts[type] || prompts.reflection;
  }

  private generateContextualGuidance(type: string, userContext: any): string {
    const guidance: { [key: string]: string } = {
      timeblock: 'Consider how this time can be used for spiritual growth and service.',
      reflection: 'Take time to process your thoughts and feelings in light of God\'s truth.',
      prayer: 'Approach God with honesty and openness, knowing He hears you.',
      gratitude: 'Let gratitude fill your heart and overflow to others around you.',
      financial: 'Remember that everything belongs to God, and we are stewards of His resources.',
      struggle: 'God is with you in this difficulty. Seek His strength and wisdom.',
      victory: 'Give glory to God for this blessing and consider how to use it for His kingdom.',
    };

    const baseGuidance = guidance[type] || guidance.reflection;

    // Personalize based on context confidence
    if (userContext.confidenceScore > 80) {
      return `Based on your spiritual journey, ${baseGuidance.toLowerCase()}`;
    }

    return baseGuidance;
  }

  private getRelatedScriptures(type: string): string[] {
    const scriptures: { [key: string]: string[] } = {
      timeblock: ['Ecclesiastes 3:1', 'Ephesians 5:15-16', 'Psalm 90:12'],
      reflection: ['Psalm 139:23-24', 'Proverbs 27:19', 'Lamentations 3:40'],
      prayer: ['1 Thessalonians 5:17', 'Philippians 4:6-7', 'Matthew 6:6'],
      gratitude: ['1 Thessalonians 5:18', 'Psalm 100:4', 'Colossians 3:17'],
      financial: ['Malachi 3:10', 'Matthew 6:19-21', '1 Timothy 6:10'],
      struggle: ['Romans 8:28', 'Philippians 4:13', 'Isaiah 41:10'],
      victory: ['1 Corinthians 15:57', 'Psalm 118:24', 'James 1:17'],
    };

    return scriptures[type] || scriptures.reflection;
  }

  private generateActionSuggestions(type: string): string[] {
    const actions: { [key: string]: string[] } = {
      timeblock: ['Pray before the event', 'Set spiritual intentions', 'Plan for God-honoring interactions'],
      reflection: ['Journal your thoughts', 'Discuss with a mentor', 'Meditate on related scripture'],
      prayer: ['Set aside dedicated prayer time', 'Join a prayer group', 'Keep a prayer journal'],
      gratitude: ['Write thank you notes', 'Share blessings with others', 'Practice daily gratitude'],
      financial: ['Review your budget prayerfully', 'Consider your giving', 'Seek financial wisdom'],
      struggle: ['Reach out for support', 'Spend time in prayer', 'Study relevant scriptures'],
      victory: ['Share your testimony', 'Thank those who helped', 'Consider how to help others'],
    };

    return actions[type] || actions.reflection;
  }

  private getSuggestedComponent(type: string): string {
    const components: { [key: string]: string } = {
      timeblock: 'TimeBlockJournal',
      reflection: 'ReflectionJournal',
      prayer: 'PrayerJournal',
      gratitude: 'GratitudeJournal',
      financial: 'FinancialJournal',
      goal_setting: 'GoalJournal',
      struggle: 'ReflectionJournal',
      victory: 'GratitudeJournal',
    };

    return components[type] || 'ReflectionJournal';
  }

  /**
   * Additional helper methods
   */
  private isEmotionallyConsistent(journalType: string, emotionalTone: string): boolean {
    const consistencyMap: { [key: string]: string[] } = {
      gratitude: ['joyful', 'peaceful', 'hopeful'],
      prayer: ['peaceful', 'hopeful', 'struggling'],
      struggle: ['struggling', 'confused'],
      victory: ['joyful', 'hopeful', 'determined'],
      reflection: ['peaceful', 'confused', 'determined'],
    };

    return consistencyMap[journalType]?.includes(emotionalTone) || false;
  }

  private determineUrgencyLevel(content: string): 'low' | 'medium' | 'high' {
    const urgentKeywords = ['urgent', 'emergency', 'crisis', 'desperate', 'help', 'immediately'];
    const mediumKeywords = ['important', 'need', 'struggling', 'difficult', 'worried'];

    const contentLower = content.toLowerCase();

    if (urgentKeywords.some(keyword => contentLower.includes(keyword))) {
      return 'high';
    }

    if (mediumKeywords.some(keyword => contentLower.includes(keyword))) {
      return 'medium';
    }

    return 'low';
  }

  private getSecondaryTypes(content: string): string[] {
    const patternAnalysis = this.analyzePatterns(content);

    return Object.entries(patternAnalysis)
      .sort(([,a], [,b]) => b - a)
      .slice(1, 3) // Get 2nd and 3rd highest
      .filter(([,score]) => score > 0.1)
      .map(([type]) => type);
  }

  private generateFollowUpRecommendations(
    primaryType: string,
    emotionalTone: string,
    urgencyLevel: 'low' | 'medium' | 'high'
  ): string[] {
    const recommendations = [];

    // Type-based recommendations
    if (primaryType === 'struggle' || urgencyLevel === 'high') {
      recommendations.push('Consider reaching out to a pastor or counselor');
      recommendations.push('Spend extra time in prayer and scripture');
    }

    if (primaryType === 'victory') {
      recommendations.push('Share your testimony with others');
      recommendations.push('Consider how to use this blessing to serve');
    }

    if (primaryType === 'prayer') {
      recommendations.push('Set aside dedicated prayer time daily');
      recommendations.push('Consider joining a prayer group');
    }

    // Emotional tone recommendations
    if (emotionalTone === 'struggling') {
      recommendations.push('Practice self-care and seek support');
      recommendations.push('Remember God\'s promises during difficult times');
    }

    if (emotionalTone === 'joyful') {
      recommendations.push('Express gratitude for God\'s blessings');
      recommendations.push('Share your joy with others');
    }

    return recommendations.slice(0, 3); // Limit to 3 recommendations
  }

  /**
   * Record detection event for machine learning
   */
  private async recordDetectionEvent(): Promise<void> {
    try {
      // This would integrate with your user_behavior_events table
      // For now, just log the event

    } catch (error) {
      Logger.error('[SmartJournalDetectionV2] Error recording detection event', error as Error, { component: 'smartJournalDetectionV2' });
    }
  }
}

// Export singleton instance
export const smartJournalDetectionV2 = new SmartJournalDetectionV2();
