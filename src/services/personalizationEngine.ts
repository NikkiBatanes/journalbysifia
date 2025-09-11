// Personalization Engine for Christian Coaching
// Phase 2: Smart Personalization Engine

import {
  SpiritualProfile,
  SpiritualMaturityLevel,
  CommunicationStyle,
  MaturityAssessment,
  ConversationMemory,
  PersonalizationConfig,
} from '../interfaces/spiritualProfile';

export class PersonalizationEngine {
  private config: PersonalizationConfig;

  constructor() {
    this.config = this.initializeConfig();
  }


  /**
   * Assess user's spiritual maturity based on interactions and responses
   */
  async assessSpiritualMaturity(userId: string, interactions: ConversationMemory[]): Promise<MaturityAssessment> {
    // Analyze conversation patterns to determine maturity level
    const biblicalKnowledge = this.assessBiblicalKnowledge(interactions);
    const prayerLife = this.assessPrayerLife(interactions);
    const serviceToOthers = this.assessServiceOrientation(interactions);
    const faithInTrials = this.assessFaithInTrials(interactions);
    const spiritualDisciplines = this.assessSpiritualDisciplines(interactions);

    const overallScore = (biblicalKnowledge + prayerLife + serviceToOthers + faithInTrials + spiritualDisciplines) / 5;

    const overallMaturity = this.calculateMaturityLevel(overallScore);
    const growthAreas = this.identifyGrowthAreas({
      biblicalKnowledge,
      prayerLife,
      serviceToOthers,
      faithInTrials,
      spiritualDisciplines,
    });

    return {
      userId,
      assessmentDate: new Date().toISOString(),
      biblicalKnowledge,
      prayerLife,
      serviceToOthers,
      faithInTrials,
      spiritualDisciplines,
      overallMaturity,
      growthAreas,
      strengths: this.identifyStrengths({
        biblicalKnowledge,
        prayerLife,
        serviceToOthers,
        faithInTrials,
        spiritualDisciplines,
      }),
      suggestedContentDepth: this.suggestContentDepth(overallMaturity),
      recommendedCommunicationStyle: this.recommendCommunicationStyle(interactions),
      nextSteps: this.generateNextSteps(overallMaturity, growthAreas),
    };
  }

  /**
   * Create or update spiritual profile based on user interactions
   */
  async updateSpiritualProfile(userId: string, newInteraction: ConversationMemory): Promise<SpiritualProfile> {
    // This would typically fetch existing profile from database
    let profile = await this.getExistingProfile(userId);

    if (!profile) {
      profile = this.createInitialProfile(userId);
    }

    // Update profile based on new interaction
    profile.conversationHistory.push(newInteraction);
    profile.lastActiveAt = new Date().toISOString();
    profile.updatedAt = new Date().toISOString();

    // Analyze interaction for insights
    const insights = this.analyzeInteraction(newInteraction);

    // Update struggles and victories based on conversation
    if (insights.newStruggles.length > 0) {
      profile.currentStruggles = [...new Set([...profile.currentStruggles, ...insights.newStruggles])];
    }

    if (insights.newVictories.length > 0) {
      profile.recentVictories = [...new Set([...profile.recentVictories, ...insights.newVictories])];
    }

    // Update engagement metrics
    profile.engagementMetrics.totalInteractions++;

    // Reassess maturity if enough interactions
    if (profile.conversationHistory.length % 5 === 0) {
      const assessment = await this.assessSpiritualMaturity(userId, profile.conversationHistory);
      profile.maturityLevel = assessment.overallMaturity;
    }

    return profile;
  }

  /**
   * Get personalized content recommendations
   */
  getPersonalizedRecommendations(profile: SpiritualProfile): {
    contentDepth: string;
    communicationTone: string;
    focusAreas: string[];
    avoidanceTopics: string[];
  } {
    return {
      contentDepth: this.getRecommendedDepth(profile),
      communicationTone: this.getRecommendedTone(profile),
      focusAreas: this.getFocusAreas(profile),
      avoidanceTopics: profile.contentPreferences.avoidTopics,
    };
  }

  // Private helper methods
  private getMaturityContext(level: SpiritualMaturityLevel): string {
    const contexts = {
      new_believer: 'USER PROFILE: New believer who is learning the basics of faith. Use simple, encouraging language. Focus on foundational truths and gentle guidance. Avoid complex theology.',
      growing: 'USER PROFILE: Growing Christian who has established faith and is actively seeking to mature. Balance encouragement with gentle challenges. Can handle moderate theological concepts.',
      mature: 'USER PROFILE: Mature believer with deep understanding of faith. Can engage with complex theological concepts. Focus on application and helping others.',
      leader: 'USER PROFILE: Spiritual leader who teaches and mentors others. Provide insights that can be shared with others. Focus on leadership challenges and advanced spiritual growth.',
    };
    return contexts[level];
  }

  private getCommunicationStyle(style: CommunicationStyle): string {
    const styles = {
      gentle: "COMMUNICATION STYLE: Use gentle, patient, encouraging language. Be soft and understanding. Focus on God's love and grace.",
      direct: 'COMMUNICATION STYLE: Be clear, straightforward, and action-oriented. Get to the point quickly. Focus on practical steps and clear direction.',
      scholarly: 'COMMUNICATION STYLE: Include theological depth and biblical analysis. Reference original languages, historical context, and doctrinal insights when relevant.',
      practical: 'COMMUNICATION STYLE: Focus on real-world application and everyday faith. Use concrete examples and practical wisdom.',
      conversational: 'COMMUNICATION STYLE: Be friendly, relatable, and story-based. Use everyday language and personal anecdotes.',
    };
    return styles[style];
  }

  private buildPersonalContext(profile: SpiritualProfile, originalInput: string): string {
    let context = `Original struggle: "${originalInput}"\n`;

    if (profile.currentStruggles.length > 0) {
      context += `Current challenges: ${profile.currentStruggles.join(', ')}\n`;
    }

    if (profile.recentVictories.length > 0) {
      context += `Recent growth: ${profile.recentVictories.join(', ')}\n`;
    }

    if (profile.favoriteVerses.length > 0) {
      context += `Verses that resonate: ${profile.favoriteVerses.join(', ')}\n`;
    }

    return context;
  }

  private getAdaptiveInstructions(profile: SpiritualProfile): string {
    let instructions = 'PERSONALIZATION INSTRUCTIONS:\n';

    // Content depth instructions
    if (profile.preferredDepth === 'surface') {
      instructions += '- Keep insights concise and simple\n';
    } else if (profile.preferredDepth === 'deep') {
      instructions += '- Provide theological depth and rich biblical context\n';
    }

    // Content preferences
    if (!profile.contentPreferences.includeScripture) {
      instructions += '- Minimize scripture references\n';
    }

    if (!profile.contentPreferences.includePracticalSteps) {
      instructions += '- Focus on insights rather than action steps\n';
    }

    return instructions;
  }

  private assessBiblicalKnowledge(interactions: ConversationMemory[]): number {
    // Analyze conversations for biblical references, understanding, questions
    let score = 5; // Default middle score

    for (const interaction of interactions) {
      if (interaction.userQuestion.includes('Bible') || interaction.userQuestion.includes('scripture')) {
        score += 0.5;
      }
      if (interaction.aiResponse.includes('verse') && interaction.userFeedback === 'very_helpful') {
        score += 0.3;
      }
    }

    return Math.min(10, Math.max(1, score));
  }

  private assessPrayerLife(interactions: ConversationMemory[]): number {
    let score = 5;

    for (const interaction of interactions) {
      if (interaction.topic.toLowerCase().includes('prayer')) {
        score += 0.4;
      }
      if (interaction.userQuestion.toLowerCase().includes('pray')) {
        score += 0.3;
      }
    }

    return Math.min(10, Math.max(1, score));
  }

  private assessServiceOrientation(interactions: ConversationMemory[]): number {
    let score = 5;

    for (const interaction of interactions) {
      if (interaction.topic.toLowerCase().includes('service') ||
          interaction.topic.toLowerCase().includes('helping others')) {
        score += 0.5;
      }
    }

    return Math.min(10, Math.max(1, score));
  }

  private assessFaithInTrials(interactions: ConversationMemory[]): number {
    let score = 5;

    for (const interaction of interactions) {
      if (interaction.emotionalTone === 'struggling' &&
          interaction.userFeedback === 'very_helpful') {
        score += 0.4;
      }
      if (interaction.emotionalTone === 'hopeful') {
        score += 0.2;
      }
    }

    return Math.min(10, Math.max(1, score));
  }

  private assessSpiritualDisciplines(interactions: ConversationMemory[]): number {
    let score = 5;

    const disciplineKeywords = ['discipline', 'habit', 'routine', 'consistent', 'daily'];

    for (const interaction of interactions) {
      for (const keyword of disciplineKeywords) {
        if (interaction.userQuestion.toLowerCase().includes(keyword)) {
          score += 0.3;
          break;
        }
      }
    }

    return Math.min(10, Math.max(1, score));
  }

  private calculateMaturityLevel(score: number): SpiritualMaturityLevel {
    if (score <= 3) {return 'new_believer';}
    if (score <= 5) {return 'growing';}
    if (score <= 7) {return 'mature';}
    return 'leader';
  }

  private identifyGrowthAreas(scores: Record<string, number>): string[] {
    const areas = [];
    if (scores.biblicalKnowledge < 5) {areas.push('Biblical Knowledge');}
    if (scores.prayerLife < 5) {areas.push('Prayer Life');}
    if (scores.serviceToOthers < 5) {areas.push('Service to Others');}
    if (scores.faithInTrials < 5) {areas.push('Faith in Trials');}
    if (scores.spiritualDisciplines < 5) {areas.push('Spiritual Disciplines');}
    return areas;
  }

  private identifyStrengths(scores: Record<string, number>): string[] {
    const strengths = [];
    if (scores.biblicalKnowledge >= 7) {strengths.push('Biblical Knowledge');}
    if (scores.prayerLife >= 7) {strengths.push('Prayer Life');}
    if (scores.serviceToOthers >= 7) {strengths.push('Service to Others');}
    if (scores.faithInTrials >= 7) {strengths.push('Faith in Trials');}
    if (scores.spiritualDisciplines >= 7) {strengths.push('Spiritual Disciplines');}
    return strengths;
  }

  private suggestContentDepth(maturity: SpiritualMaturityLevel): 'surface' | 'medium' | 'deep' {
    const depthMap = {
      new_believer: 'surface' as const,
      growing: 'medium' as const,
      mature: 'deep' as const,
      leader: 'deep' as const,
    };
    return depthMap[maturity];
  }

  private recommendCommunicationStyle(interactions: ConversationMemory[]): CommunicationStyle {
    // Analyze which style gets best feedback
    const styleEffectiveness = {
      gentle: 0,
      direct: 0,
      scholarly: 0,
      practical: 0,
      conversational: 0,
    };

    // This would analyze actual response patterns
    // For now, return a default
    return 'conversational';
  }

  private generateNextSteps(maturity: SpiritualMaturityLevel, growthAreas: string[]): string[] {
    const steps = [];

    if (growthAreas.includes('Prayer Life')) {
      steps.push('Establish a daily prayer routine');
    }
    if (growthAreas.includes('Biblical Knowledge')) {
      steps.push('Start a daily Bible reading plan');
    }
    if (growthAreas.includes('Service to Others')) {
      steps.push('Find one way to serve others this week');
    }

    return steps;
  }

  private async getExistingProfile(userId: string): Promise<SpiritualProfile | null> {
    // This would fetch from database
    // For now, return null to create new profile
    return null;
  }

  private createInitialProfile(userId: string): SpiritualProfile {
    return {
      userId,
      maturityLevel: 'growing', // Default assumption
      communicationStyle: 'conversational',
      faithBackground: 'lifelong',
      preferredDepth: 'medium',
      currentStruggles: [],
      recentVictories: [],
      prayerRequests: [],
      favoriteVerses: [],
      topicsOfInterest: [],
      conversationHistory: [],
      responsePatterns: [],
      engagementMetrics: {
        totalInteractions: 0,
        averageSessionLength: 0,
        mostActiveTimeOfDay: 'evening',
        preferredInteractionFrequency: 'as_needed',
        topEngagementTriggers: [],
      },
      contentPreferences: {
        preferredInsightLength: 'medium',
        includeScripture: true,
        includePracticalSteps: true,
        includeReflectionQuestions: true,
        preferredEmojis: ['💡', '🙏', '💭'],
        avoidTopics: [],
      },
      personalizedInsights: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
  }

  private analyzeInteraction(interaction: ConversationMemory): {
    newStruggles: string[];
    newVictories: string[];
  } {
    const newStruggles = [];
    const newVictories = [];

    // Simple keyword analysis (would be more sophisticated in production)
    const strugglingKeywords = ['struggling', 'difficult', 'hard', 'challenge', 'problem'];
    const victoryKeywords = ['breakthrough', 'victory', 'success', 'growth', 'better'];

    for (const keyword of strugglingKeywords) {
      if (interaction.userQuestion.toLowerCase().includes(keyword)) {
        // Extract context around the keyword
        newStruggles.push(interaction.topic);
        break;
      }
    }

    for (const keyword of victoryKeywords) {
      if (interaction.userQuestion.toLowerCase().includes(keyword)) {
        newVictories.push(interaction.topic);
        break;
      }
    }

    return { newStruggles, newVictories };
  }

  private getRecommendedDepth(profile: SpiritualProfile): string {
    return profile.preferredDepth;
  }

  private getRecommendedTone(profile: SpiritualProfile): string {
    return profile.communicationStyle;
  }

  private getFocusAreas(profile: SpiritualProfile): string[] {
    return [...profile.currentStruggles, ...profile.topicsOfInterest];
  }

  private initializeConfig(): PersonalizationConfig {
    return {
      maturityLevelPrompts: {
        new_believer: 'Focus on foundational truths and gentle encouragement',
        growing: 'Balance encouragement with gentle challenges',
        mature: 'Provide deeper insights and application focus',
        leader: 'Include leadership perspective and mentoring insights',
      },
      communicationStylePrompts: {
        gentle: 'Use soft, patient, encouraging language',
        direct: 'Be clear, straightforward, and action-oriented',
        scholarly: 'Include theological depth and biblical analysis',
        practical: 'Focus on real-world application',
        conversational: 'Be friendly, relatable, and story-based',
      },
      contentDepthRules: {
        surface: {
          maxInsightLength: 200,
          scriptureComplexity: 'simple',
          theologicalDepth: 'basic',
          practicalApplications: 1,
          reflectionQuestionDepth: 'surface',
        },
        medium: {
          maxInsightLength: 400,
          scriptureComplexity: 'moderate',
          theologicalDepth: 'intermediate',
          practicalApplications: 2,
          reflectionQuestionDepth: 'thoughtful',
        },
        deep: {
          maxInsightLength: 600,
          scriptureComplexity: 'complex',
          theologicalDepth: 'advanced',
          practicalApplications: 3,
          reflectionQuestionDepth: 'deep',
        },
        adaptive: {
          maxInsightLength: 400,
          scriptureComplexity: 'moderate',
          theologicalDepth: 'intermediate',
          practicalApplications: 2,
          reflectionQuestionDepth: 'thoughtful',
        },
      },
      contextualAdaptations: [],
      learningRate: 0.1,
      memoryDecay: 0.05,
      confidenceThreshold: 0.7,
    };
  }
}

export const personalizationEngine = new PersonalizationEngine();
