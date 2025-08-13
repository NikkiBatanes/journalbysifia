/**
 * Phase 4 Revised: Text-Based Intelligent Content Curation
 * Focuses on text content, scripture, and interactive text exercises within current app capabilities
 */

import { SpiritualProfile } from '../interfaces/spiritualProfile';
import { ConversationThread } from '../interfaces/conversationTypes';

export interface TextContentItem {
  id: string;
  type: 'devotional' | 'scripture_study' | 'reflection_prompt' | 'prayer_guide' | 'spiritual_insight';
  title: string;
  content: string;
  metadata: {
    readingTime: number; // in minutes
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    spiritualThemes: string[];
    emotionalTones: ('encouraging' | 'challenging' | 'comforting' | 'inspiring')[];
    scriptureReferences: string[];
    tags: string[];
  };
  interactiveElements?: {
    reflectionQuestions: string[];
    prayerPoints: string[];
    practicalSteps: string[];
    journalingPrompts: string[];
  };
  createdAt: Date;
}

export interface TextContentRecommendation {
  contentItem: TextContentItem;
  relevanceScore: number; // 0-100
  reasoning: string;
  personalizedElements: {
    customizedIntro: string;
    contextualQuestions: string[];
    personalizedPrayerPoints: string[];
  };
}

export class TextBasedContentCuration {
  private contentLibrary: Map<string, TextContentItem> = new Map();

  constructor() {
    this.initializeTextContentLibrary();
  }

  /**
   * Generate personalized text-based content recommendations
   */
  async generateTextRecommendations(
    userId: string,
    spiritualProfile: SpiritualProfile,
    recentConversations: ConversationThread[],
    currentNeed?: string
  ): Promise<TextContentRecommendation[]> {
    try {
      // Analyze user context from conversations
      const contextAnalysis = this.analyzeConversationContext(recentConversations, currentNeed);

      // Filter relevant content
      const candidateContent = this.filterRelevantTextContent(contextAnalysis, spiritualProfile);

      // Score and personalize content
      const personalizedRecommendations = await this.personalizeTextContent(
        candidateContent,
        contextAnalysis,
        spiritualProfile
      );

      console.log(`Generated ${personalizedRecommendations.length} text-based recommendations`);
      return personalizedRecommendations.slice(0, 3); // Top 3 recommendations

    } catch (error) {
      console.error('Error generating text recommendations:', error);
      return this.getFallbackTextRecommendations(spiritualProfile);
    }
  }

  /**
   * Generate personalized devotional content based on user's spiritual journey
   */
  async generatePersonalizedDevotional(
    spiritualProfile: SpiritualProfile,
    recentConversations: ConversationThread[],
    focusTheme?: string
  ): Promise<TextContentItem> {
    const dominantThemes = this.extractDominantThemes(recentConversations);
    const theme = focusTheme || dominantThemes[0] || 'faith';

    const devotional: TextContentItem = {
      id: `devotional_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'devotional',
      title: this.generateDevotionalTitle(theme, spiritualProfile.maturityLevel),
      content: await this.generateDevotionalContent(theme, spiritualProfile, recentConversations),
      metadata: {
        readingTime: 5,
        difficulty: this.mapMaturityToDifficulty(spiritualProfile.maturityLevel),
        spiritualThemes: [theme],
        emotionalTones: ['encouraging', 'inspiring'],
        scriptureReferences: this.selectRelevantScripture(theme),
        tags: ['personalized', 'devotional', theme],
      },
      interactiveElements: {
        reflectionQuestions: this.generateReflectionQuestions(theme, spiritualProfile),
        prayerPoints: this.generatePrayerPoints(theme, recentConversations),
        practicalSteps: this.generatePracticalSteps(theme, spiritualProfile.maturityLevel),
        journalingPrompts: this.generateJournalingPrompts(theme, recentConversations),
      },
      createdAt: new Date(),
    };

    return devotional;
  }

  /**
   * Create interactive text-based spiritual exercise
   */
  async generateTextBasedExercise(
    spiritualNeed: string,
    emotionalState: string,
    availableTime: number, // in minutes
    spiritualProfile: SpiritualProfile
  ): Promise<TextContentItem> {
    const exerciseType = this.selectTextExerciseType(spiritualNeed, emotionalState);

    const exercise: TextContentItem = {
      id: `exercise_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'reflection_prompt',
      title: this.generateExerciseTitle(exerciseType, spiritualNeed),
      content: this.generateExerciseContent(exerciseType, spiritualNeed, emotionalState, availableTime),
      metadata: {
        readingTime: Math.min(availableTime, 10),
        difficulty: this.mapMaturityToDifficulty(spiritualProfile.maturityLevel),
        spiritualThemes: [spiritualNeed],
        emotionalTones: [this.mapEmotionalStateToTone(emotionalState)],
        scriptureReferences: this.selectRelevantScripture(spiritualNeed),
        tags: ['interactive', 'exercise', exerciseType],
      },
      interactiveElements: {
        reflectionQuestions: this.generateExerciseQuestions(exerciseType, spiritualNeed),
        prayerPoints: [`Pray for God's guidance in your ${spiritualNeed}`],
        practicalSteps: this.generateExerciseSteps(exerciseType, availableTime),
        journalingPrompts: [`How is God speaking to you about ${spiritualNeed}?`],
      },
      createdAt: new Date(),
    };

    return exercise;
  }

  /**
   * Generate contextual scripture study based on user's current spiritual focus
   */
  async generateContextualScriptureStudy(
    spiritualProfile: SpiritualProfile,
    recentConversations: ConversationThread[]
  ): Promise<TextContentItem> {
    const themes = this.extractDominantThemes(recentConversations);
    const primaryTheme = themes[0] || 'faith';
    const scripture = this.selectRelevantScripture(primaryTheme)[0];

    const study: TextContentItem = {
      id: `scripture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'scripture_study',
      title: `Discovering God's Heart: ${scripture}`,
      content: await this.generateScriptureStudyContent(scripture, primaryTheme, spiritualProfile),
      metadata: {
        readingTime: 8,
        difficulty: this.mapMaturityToDifficulty(spiritualProfile.maturityLevel),
        spiritualThemes: [primaryTheme],
        emotionalTones: ['inspiring', 'challenging'],
        scriptureReferences: [scripture],
        tags: ['scripture', 'study', primaryTheme],
      },
      interactiveElements: {
        reflectionQuestions: this.generateScriptureQuestions(scripture, primaryTheme),
        prayerPoints: this.generateScripturePrayerPoints(scripture),
        practicalSteps: this.generateScriptureApplication(scripture, primaryTheme),
        journalingPrompts: [`How does ${scripture} speak to your current situation?`],
      },
      createdAt: new Date(),
    };

    return study;
  }

  // Private helper methods

  private analyzeConversationContext(conversations: ConversationThread[], currentNeed?: string) {
    const allThemes = conversations.flatMap(conv => conv.insights.keyThemes);
    const recentStruggles = conversations.flatMap(conv =>
      conv.messages.filter(msg =>
        msg.type === 'user' &&
        (msg.content.toLowerCase().includes('struggle') ||
         msg.content.toLowerCase().includes('difficult') ||
         msg.content.toLowerCase().includes('hard'))
      )
    );

    return {
      dominantThemes: this.getTopThemes(allThemes),
      currentNeed: currentNeed || 'guidance',
      strugglingAreas: recentStruggles.length,
      conversationDepth: conversations.reduce((sum, conv) => sum + conv.messages.length, 0),
      lastInteraction: conversations[0]?.lastActiveAt || new Date(),
    };
  }

  private filterRelevantTextContent(contextAnalysis: any, spiritualProfile: SpiritualProfile): TextContentItem[] {
    const candidates: TextContentItem[] = [];

    for (const [_, content] of this.contentLibrary) {
      // Filter by difficulty/maturity
      const userDifficulty = this.mapMaturityToDifficulty(spiritualProfile.maturityLevel);
      if (content.metadata.difficulty !== userDifficulty) {continue;}

      // Filter by relevant themes
      const hasRelevantTheme = content.metadata.spiritualThemes.some(theme =>
        contextAnalysis.dominantThemes.includes(theme) || theme === contextAnalysis.currentNeed
      );

      if (hasRelevantTheme) {
        candidates.push(content);
      }
    }

    return candidates;
  }

  private async personalizeTextContent(
    candidates: TextContentItem[],
    contextAnalysis: any,
    spiritualProfile: SpiritualProfile
  ): Promise<TextContentRecommendation[]> {
    const recommendations: TextContentRecommendation[] = [];

    for (const content of candidates) {
      const relevanceScore = this.calculateTextRelevanceScore(content, contextAnalysis, spiritualProfile);

      const recommendation: TextContentRecommendation = {
        contentItem: content,
        relevanceScore,
        reasoning: this.generateTextRecommendationReasoning(content, contextAnalysis),
        personalizedElements: {
          customizedIntro: this.generatePersonalizedIntro(content, spiritualProfile, contextAnalysis),
          contextualQuestions: this.generateContextualQuestions(content, contextAnalysis),
          personalizedPrayerPoints: this.generatePersonalizedPrayerPoints(content, contextAnalysis),
        },
      };

      recommendations.push(recommendation);
    }

    return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private calculateTextRelevanceScore(
    content: TextContentItem,
    contextAnalysis: any,
    spiritualProfile: SpiritualProfile
  ): number {
    let score = 0;

    // Theme relevance (40%)
    const themeMatch = content.metadata.spiritualThemes.filter(theme =>
      contextAnalysis.dominantThemes.includes(theme)
    ).length;
    score += (themeMatch / Math.max(contextAnalysis.dominantThemes.length, 1)) * 40;

    // Difficulty match (30%)
    const userDifficulty = this.mapMaturityToDifficulty(spiritualProfile.maturityLevel);
    score += content.metadata.difficulty === userDifficulty ? 30 : 15;

    // Current need match (20%)
    const needMatch = content.metadata.spiritualThemes.includes(contextAnalysis.currentNeed);
    score += needMatch ? 20 : 0;

    // Recency bonus (10%)
    const daysSinceLastInteraction = (Date.now() - contextAnalysis.lastInteraction.getTime()) / (1000 * 60 * 60 * 24);
    score += daysSinceLastInteraction < 1 ? 10 : 5;

    return Math.min(100, Math.max(0, score));
  }

  private initializeTextContentLibrary(): void {
    const sampleContent: TextContentItem[] = [
      {
        id: 'trust_devotional',
        type: 'devotional',
        title: 'When Trust Feels Impossible',
        content: 'Sometimes trusting God feels like stepping into complete darkness. But faith isn\'t about seeing the whole staircase—it\'s about taking the next step...',
        metadata: {
          readingTime: 5,
          difficulty: 'intermediate',
          spiritualThemes: ['trust', 'faith', 'surrender'],
          emotionalTones: ['encouraging', 'comforting'],
          scriptureReferences: ['Proverbs 3:5-6', 'Isaiah 55:8-9'],
          tags: ['trust', 'faith', 'devotional'],
        },
        interactiveElements: {
          reflectionQuestions: [
            'What area of your life feels hardest to trust God with right now?',
            'How has God proven trustworthy in your past?',
          ],
          prayerPoints: [
            'For courage to trust God with uncertain situations',
            'For peace in surrendering control',
          ],
          practicalSteps: [
            'Identify one small area where you can practice trust today',
            'Write down three ways God has been faithful in your life',
          ],
          journalingPrompts: [
            'God, I struggle to trust you with... because...',
            'Help me remember that your ways are higher than mine when...',
          ],
        },
        createdAt: new Date(),
      },
      {
        id: 'prayer_guide',
        type: 'prayer_guide',
        title: 'Learning to Pray with Confidence',
        content: 'Prayer isn\'t about perfect words or eloquent phrases. It\'s about honest conversation with a loving Father who delights in hearing from you...',
        metadata: {
          readingTime: 6,
          difficulty: 'beginner',
          spiritualThemes: ['prayer', 'relationship', 'communication'],
          emotionalTones: ['encouraging', 'inspiring'],
          scriptureReferences: ['Matthew 6:9-13', '1 Thessalonians 5:17', 'Philippians 4:6-7'],
          tags: ['prayer', 'beginner', 'relationship'],
        },
        interactiveElements: {
          reflectionQuestions: [
            'What makes prayer feel difficult or intimidating for you?',
            'How would your prayer life change if you truly believed God delights in hearing from you?',
          ],
          prayerPoints: [
            'For confidence in approaching God',
            'For authenticity in prayer',
          ],
          practicalSteps: [
            'Set aside 5 minutes today for honest conversation with God',
            'Try praying about one small, everyday concern',
          ],
          journalingPrompts: [
            'God, I want to talk to you about...',
            'Thank you for always being ready to listen when...',
          ],
        },
        createdAt: new Date(),
      },
    ];

    sampleContent.forEach(content => {
      this.contentLibrary.set(content.id, content);
    });
  }

  // Additional helper methods
  private extractDominantThemes(conversations: ConversationThread[]): string[] {
    const allThemes = conversations.flatMap(conv => conv.insights.keyThemes);
    return this.getTopThemes(allThemes);
  }

  private getTopThemes(themes: string[]): string[] {
    const themeCount = themes.reduce((acc, theme) => {
      acc[theme] = (acc[theme] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(themeCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([theme]) => theme);
  }

  private mapMaturityToDifficulty(maturityLevel: string): 'beginner' | 'intermediate' | 'advanced' {
    switch (maturityLevel) {
      case 'new_believer': return 'beginner';
      case 'growing': return 'intermediate';
      case 'mature':
      case 'leader': return 'advanced';
      default: return 'intermediate';
    }
  }

  private selectRelevantScripture(theme: string): string[] {
    const scriptureMap: Record<string, string[]> = {
      'trust': ['Proverbs 3:5-6', 'Isaiah 55:8-9', 'Jeremiah 29:11'],
      'prayer': ['Matthew 6:9-13', '1 Thessalonians 5:17', 'Philippians 4:6-7'],
      'faith': ['Hebrews 11:1', 'Romans 10:17', 'Matthew 17:20'],
      'peace': ['John 14:27', 'Philippians 4:6-7', 'Isaiah 26:3'],
      'love': ['1 John 4:19', '1 Corinthians 13:4-7', 'Romans 8:38-39'],
      'forgiveness': ['Ephesians 4:32', 'Matthew 6:14-15', '1 John 1:9'],
    };
    return scriptureMap[theme] || ['Psalm 23:1', 'Romans 8:28'];
  }

  private generateDevotionalTitle(theme: string, maturityLevel: string): string {
    const titleTemplates: Record<string, string[]> = {
      'trust': ['When Trust Feels Impossible', 'Learning to Let Go', 'God\'s Faithful Character'],
      'prayer': ['Honest Conversations with God', 'The Power of Simple Prayer', 'Drawing Near with Confidence'],
      'faith': ['Faith in the Darkness', 'Growing Deeper Roots', 'Believing God\'s Promises'],
    };

    const templates = titleTemplates[theme] || ['Growing in Faith'];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private async generateDevotionalContent(
    theme: string,
    spiritualProfile: SpiritualProfile,
    recentConversations: ConversationThread[]
  ): Promise<string> {
    // This would call an AI service to generate personalized content
    // For now, returning a template-based approach
    const struggles = recentConversations.flatMap(conv => conv.insights.keyThemes);
    const personalContext = struggles.length > 0 ? `especially as you've been wrestling with ${struggles[0]}` : '';

    return `God sees your heart and knows your journey, ${personalContext}. His love for you is unwavering, and His plans for you are good. Today, He invites you to take one more step of faith, trusting that He is working all things together for your good and His glory.`;
  }

  private generateReflectionQuestions(theme: string, spiritualProfile: SpiritualProfile): string[] {
    const questionBank: Record<string, string[]> = {
      'trust': [
        'What area of your life feels hardest to trust God with right now?',
        'How has God proven trustworthy in your past?',
        'What would change if you truly believed God\'s plans are good?',
      ],
      'prayer': [
        'What makes prayer feel difficult or intimidating for you?',
        'How would your prayer life change if you knew God delights in hearing from you?',
        'What would you talk to God about if you knew He was your closest friend?',
      ],
    };

    return questionBank[theme] || [
      'How is God speaking to you today?',
      'What is one way you can respond to God\'s love?',
    ];
  }

  private generatePrayerPoints(theme: string, recentConversations: ConversationThread[]): string[] {
    const basePoints = [`For growth in ${theme}`, 'For God\'s guidance and wisdom'];

    // Add contextual prayer points based on recent conversations
    const struggles = recentConversations.flatMap(conv => conv.insights.keyThemes);
    if (struggles.length > 0) {
      basePoints.push(`For peace and breakthrough in ${struggles[0]}`);
    }

    return basePoints;
  }

  private generatePracticalSteps(theme: string, maturityLevel: string): string[] {
    const stepBank: Record<string, string[]> = {
      'trust': [
        'Identify one small area where you can practice trust today',
        'Write down three ways God has been faithful in your life',
        'Choose to surrender one worry to God in prayer',
      ],
      'prayer': [
        'Set aside 5 minutes today for honest conversation with God',
        'Try praying about one small, everyday concern',
        'Thank God for three specific things',
      ],
    };

    return stepBank[theme] || [
      'Spend 5 minutes in quiet reflection with God',
      'Apply one insight from today\'s reading',
    ];
  }

  private generateJournalingPrompts(theme: string, recentConversations: ConversationThread[]): string[] {
    const basePrompts = [
      `God, I want to grow in ${theme} by...`,
      'Help me to see this situation through your eyes...',
    ];

    const struggles = recentConversations.flatMap(conv => conv.insights.keyThemes);
    if (struggles.length > 0) {
      basePrompts.push(`Lord, as I struggle with ${struggles[0]}, I need you to...`);
    }

    return basePrompts;
  }

  private selectTextExerciseType(spiritualNeed: string, emotionalState: string): string {
    const exerciseMap: Record<string, string> = {
      'trust': 'surrender_reflection',
      'prayer': 'conversation_practice',
      'peace': 'calming_meditation',
      'gratitude': 'thankfulness_practice',
      'forgiveness': 'healing_reflection',
    };
    return exerciseMap[spiritualNeed] || 'general_reflection';
  }

  private generateExerciseTitle(exerciseType: string, spiritualNeed: string): string {
    const titleMap: Record<string, string> = {
      'surrender_reflection': `Surrendering Your ${spiritualNeed} to God`,
      'conversation_practice': `Having an Honest Conversation About ${spiritualNeed}`,
      'calming_meditation': `Finding God\'s Peace in ${spiritualNeed}`,
      'thankfulness_practice': `Discovering Gratitude in ${spiritualNeed}`,
      'healing_reflection': `Allowing God to Heal Your ${spiritualNeed}`,
    };
    return titleMap[exerciseType] || `Reflecting on ${spiritualNeed} with God`;
  }

  private generateExerciseContent(
    exerciseType: string,
    spiritualNeed: string,
    emotionalState: string,
    availableTime: number
  ): string {
    return `Take the next ${availableTime} minutes to be present with God about your ${spiritualNeed}. This is a safe space to be honest about where you are and to listen for God's heart toward you.`;
  }

  private generateExerciseQuestions(exerciseType: string, spiritualNeed: string): string[] {
    return [
      `What does ${spiritualNeed} look like in your life right now?`,
      'How do you sense God wants to meet you in this area?',
      `What would it look like to trust God more deeply with ${spiritualNeed}?`,
    ];
  }

  private generateExerciseSteps(exerciseType: string, availableTime: number): string[] {
    const timePerStep = Math.floor(availableTime / 3);
    return [
      `Spend ${timePerStep} minutes in quiet reflection`,
      `Take ${timePerStep} minutes to journal your thoughts`,
      `End with ${timePerStep} minutes of prayer`,
    ];
  }

  private async generateScriptureStudyContent(
    scripture: string,
    theme: string,
    spiritualProfile: SpiritualProfile
  ): Promise<string> {
    return `Let's explore ${scripture} together and discover what God wants to reveal about ${theme} in your life. This passage speaks directly to your journey and offers hope for where you are right now.`;
  }

  private generateScriptureQuestions(scripture: string, theme: string): string[] {
    return [
      `What stands out to you most in ${scripture}?`,
      `How does this passage speak to your current situation with ${theme}?`,
      'What is God inviting you to believe or do through this scripture?',
    ];
  }

  private generateScripturePrayerPoints(scripture: string): string[] {
    return [
      `For God to illuminate the truth of ${scripture} in your heart`,
      'For wisdom to apply this scripture to your daily life',
      'For faith to believe God\'s promises in this passage',
    ];
  }

  private generateScriptureApplication(scripture: string, theme: string): string[] {
    return [
      `Memorize or write down ${scripture} to meditate on this week`,
      `Identify one specific way to apply this passage to your ${theme}`,
      'Share this scripture with someone who might be encouraged by it',
    ];
  }

  private mapEmotionalStateToTone(emotionalState: string): 'encouraging' | 'challenging' | 'comforting' | 'inspiring' {
    const toneMap: Record<string, any> = {
      'struggling': 'comforting',
      'hopeful': 'inspiring',
      'confused': 'encouraging',
      'grateful': 'inspiring',
      'seeking': 'encouraging',
    };
    return toneMap[emotionalState] || 'encouraging';
  }

  private generateTextRecommendationReasoning(content: TextContentItem, contextAnalysis: any): string {
    const themes = contextAnalysis.dominantThemes.slice(0, 2).join(' and ');
    return `Recommended based on your recent focus on ${themes} and your current spiritual journey`;
  }

  private generatePersonalizedIntro(
    content: TextContentItem,
    spiritualProfile: SpiritualProfile,
    contextAnalysis: any
  ): string {
    const theme = contextAnalysis.dominantThemes[0] || 'faith';
    return `As you've been exploring ${theme} in your spiritual journey, this content is specifically chosen to meet you where you are and help you take the next step with God.`;
  }

  private generateContextualQuestions(content: TextContentItem, contextAnalysis: any): string[] {
    const theme = contextAnalysis.dominantThemes[0] || 'faith';
    return [
      `How does this content speak to your current experience with ${theme}?`,
      'What is one insight you want to remember from this?',
      'How might God be inviting you to respond?',
    ];
  }

  private generatePersonalizedPrayerPoints(content: TextContentItem, contextAnalysis: any): string[] {
    const theme = contextAnalysis.dominantThemes[0] || 'faith';
    return [
      `For continued growth in ${theme}`,
      'For wisdom to apply these insights to your daily life',
      'For God\'s presence and guidance in your spiritual journey',
    ];
  }

  private getFallbackTextRecommendations(spiritualProfile: SpiritualProfile): TextContentRecommendation[] {
    const fallbackContent = Array.from(this.contentLibrary.values()).slice(0, 2);

    return fallbackContent.map(content => ({
      contentItem: content,
      relevanceScore: 50,
      reasoning: 'General recommendation based on your spiritual maturity level',
      personalizedElements: {
        customizedIntro: 'This content is selected to encourage you in your faith journey.',
        contextualQuestions: ['How does this speak to your heart today?'],
        personalizedPrayerPoints: ['For continued spiritual growth'],
      },
    }));
  }
}
