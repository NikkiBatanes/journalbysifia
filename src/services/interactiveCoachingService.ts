/**
 * Phase 3: Interactive Spiritual Coaching Service
 * Handles conversational AI spiritual director functionality
 */

// import { supabase } from '../config/supabase'; // Will be implemented when supabase config is available
import {
  ConversationThread,
  ConversationMessage,
  ConversationResponse,
  FollowUpQuestion,
  ConversationAnalytics,
  InteractiveCoachingConfig,
} from '../interfaces/conversationTypes';
import { SpiritualProfile } from '../interfaces/spiritualProfile';
import { PersonalizationEngine } from './personalizationEngine';

export class InteractiveCoachingService {
  private personalizationEngine: PersonalizationEngine;
  private config: InteractiveCoachingConfig;

  constructor() {
    this.personalizationEngine = new PersonalizationEngine();
    this.config = {
      maxMessagesPerThread: 20,
      followUpQuestionLimit: 3,
      conversationTimeoutMinutes: 30,
      enableEmotionalAnalysis: true,
      enableScriptureRecommendations: true,
      enablePrayerSupport: true,
      adaptiveResponseStyle: true,
    };
  }

  /**
   * Start a new conversation thread for a specific step
   */
  async startConversation(
    userId: string,
    playbookId: string,
    stepId: string,
    stepText: string,
    userOriginalInput: string,
    playbookTitle: string,
    subtaskId?: string
  ): Promise<ConversationThread> {
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const thread: ConversationThread = {
      id: threadId,
      userId,
      playbookId,
      stepId,
      subtaskId,
      title: `Coaching: ${stepText.substring(0, 50)}...`,
      status: 'active',
      messages: [],
      context: {
        originalUserInput: userOriginalInput,
        playbookTitle,
        currentStepText: stepText,
      },
      insights: {
        keyThemes: [],
        breakthroughs: [],
        prayerRequests: [],
        scriptureReferences: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActiveAt: new Date(),
    };

    // Generate opening message from AI coach
    const openingResponse = await this.generateOpeningMessage(thread);

    const systemMessage: ConversationMessage = {
      id: `msg_${Date.now()}_1`,
      type: 'ai',
      content: openingResponse.message,
      timestamp: new Date(),
      metadata: {
        stepId,
        subtaskId,
        spiritualNeed: 'guidance',
      },
    };

    thread.messages.push(systemMessage);

    // Store thread in local state (could be extended to Supabase later)
    await this.saveConversationThread(thread);

    return thread;
  }

  /**
   * Continue conversation with user message and AI response
   */
  async continueConversation(
    threadId: string,
    userMessage: string,
    emotionalTone?: 'struggling' | 'hopeful' | 'confused' | 'grateful' | 'seeking'
  ): Promise<ConversationResponse> {
    const thread = await this.getConversationThread(threadId);
    if (!thread) {
      throw new Error('Conversation thread not found');
    }

    // Add user message to thread
    const userMsg: ConversationMessage = {
      id: `msg_${Date.now()}_${thread.messages.length + 1}`,
      type: 'user',
      content: userMessage,
      timestamp: new Date(),
      metadata: {
        stepId: thread.stepId,
        subtaskId: thread.subtaskId,
        emotionalTone,
      },
    };

    thread.messages.push(userMsg);

    // Analyze conversation context and generate AI response
    const response = await this.generateContextualResponse(thread, userMessage);

    // Add AI response to thread
    const aiMsg: ConversationMessage = {
      id: `msg_${Date.now()}_${thread.messages.length + 1}`,
      type: 'ai',
      content: response.message,
      timestamp: new Date(),
      metadata: {
        stepId: thread.stepId,
        subtaskId: thread.subtaskId,
        spiritualNeed: this.detectSpiritualNeed(userMessage),
      },
    };

    thread.messages.push(aiMsg);
    thread.updatedAt = new Date();
    thread.lastActiveAt = new Date();

    // Update insights based on conversation
    this.updateConversationInsights(thread, userMessage, response);

    // Save updated thread
    await this.saveConversationThread(thread);

    return response;
  }

  /**
   * Generate opening message for new conversation
   */
  private async generateOpeningMessage(thread: ConversationThread): Promise<ConversationResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('generate-interactive-coaching', {
        body: {
          type: 'opening',
          context: thread.context,
          userId: thread.userId,
        },
      });

      if (error) {throw error;}

      return {
        message: data.message || this.getDefaultOpeningMessage(thread.context.currentStepText),
        followUpQuestions: data.followUpQuestions || this.getDefaultFollowUpQuestions(),
        suggestedActions: data.suggestedActions || [],
        prayerPoints: data.prayerPoints || [],
        scriptureRecommendations: data.scriptureRecommendations || [],
      };
    } catch (error) {
      console.error('Error generating opening message:', error);
      return {
        message: this.getDefaultOpeningMessage(thread.context.currentStepText),
        followUpQuestions: this.getDefaultFollowUpQuestions(),
      };
    }
  }

  /**
   * Generate contextual AI response based on conversation history
   */
  private async generateContextualResponse(
    thread: ConversationThread,
    userMessage: string
  ): Promise<ConversationResponse> {
    try {
      const conversationHistory = thread.messages.slice(-6); // Last 6 messages for context

      // Temporary mock implementation until supabase is configured
      const data = {
        message: this.getDefaultResponse(userMessage),
        followUpQuestions: [],
      };
      const error = null;

      // const { data, error } = await supabase.functions.invoke('generate-interactive-coaching', {
      //   body: {
      //     type: 'response',
      //     userMessage,
      //     conversationHistory,
      //     context: thread.context,
      //     insights: thread.insights,
      //     userId: thread.userId
      //   }
      // });

      if (error) {throw error;}

      return {
        message: data.message || this.getDefaultResponse(userMessage),
        followUpQuestions: data.followUpQuestions || [],
        suggestedActions: data.suggestedActions || [],
        prayerPoints: data.prayerPoints || [],
        scriptureRecommendations: data.scriptureRecommendations || [],
        emotionalSupport: data.emotionalSupport,
      };
    } catch (error) {
      console.error('Error generating contextual response:', error);
      return {
        message: this.getDefaultResponse(userMessage),
        followUpQuestions: [],
      };
    }
  }

  /**
   * Detect spiritual need from user message
   */
  private detectSpiritualNeed(message: string): 'encouragement' | 'guidance' | 'accountability' | 'prayer' | 'scripture' {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('pray') || lowerMessage.includes('prayer')) {return 'prayer';}
    if (lowerMessage.includes('bible') || lowerMessage.includes('verse') || lowerMessage.includes('scripture')) {return 'scripture';}
    if (lowerMessage.includes('struggle') || lowerMessage.includes('hard') || lowerMessage.includes('difficult')) {return 'encouragement';}
    if (lowerMessage.includes('what should') || lowerMessage.includes('how do') || lowerMessage.includes('help me')) {return 'guidance';}
    if (lowerMessage.includes('accountable') || lowerMessage.includes('check in') || lowerMessage.includes('follow up')) {return 'accountability';}

    return 'guidance';
  }

  /**
   * Update conversation insights based on new messages
   */
  private updateConversationInsights(
    thread: ConversationThread,
    userMessage: string,
    aiResponse: ConversationResponse
  ): void {
    // Extract key themes
    const themes = this.extractThemes(userMessage);
    thread.insights.keyThemes = [...new Set([...thread.insights.keyThemes, ...themes])];

    // Add prayer requests
    if (aiResponse.prayerPoints) {
      thread.insights.prayerRequests = [...thread.insights.prayerRequests, ...aiResponse.prayerPoints];
    }

    // Add scripture references
    if (aiResponse.scriptureRecommendations) {
      const references = aiResponse.scriptureRecommendations.map(s => s.reference);
      thread.insights.scriptureReferences = [...new Set([...thread.insights.scriptureReferences, ...references])];
    }

    // Detect breakthroughs
    if (userMessage.toLowerCase().includes('understand') ||
        userMessage.toLowerCase().includes('realize') ||
        userMessage.toLowerCase().includes('breakthrough')) {
      thread.insights.breakthroughs.push(userMessage.substring(0, 100));
    }
  }

  /**
   * Extract themes from user message
   */
  private extractThemes(message: string): string[] {
    const themes: string[] = [];
    const lowerMessage = message.toLowerCase();

    // Common spiritual themes
    const themeKeywords = {
      'trust': ['trust', 'faith', 'believe'],
      'prayer': ['pray', 'prayer', 'talk to god'],
      'fear': ['fear', 'afraid', 'scared', 'anxious'],
      'forgiveness': ['forgive', 'forgiveness', 'mercy'],
      'purpose': ['purpose', 'calling', 'direction'],
      'relationships': ['relationship', 'marriage', 'family', 'friend'],
      'growth': ['grow', 'mature', 'develop', 'change'],
    };

    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        themes.push(theme);
      }
    });

    return themes;
  }

  /**
   * Get conversation thread by ID
   */
  async getConversationThread(threadId: string): Promise<ConversationThread | null> {
    // In a real implementation, this would fetch from Supabase
    // For now, using local storage as a simple implementation
    const stored = localStorage.getItem(`conversation_${threadId}`);
    return stored ? JSON.parse(stored) : null;
  }

  /**
   * Save conversation thread
   */
  private async saveConversationThread(thread: ConversationThread): Promise<void> {
    // In a real implementation, this would save to Supabase
    // For now, using local storage as a simple implementation
    localStorage.setItem(`conversation_${thread.id}`, JSON.stringify(thread));
  }

  /**
   * Default opening message fallback
   */
  private getDefaultOpeningMessage(stepText: string): string {
    return `I'm here to walk alongside you as you work on "${stepText}". This is a safe space where we can explore what God might be saying to you through this step. What's on your heart right now about this area of your life?`;
  }

  /**
   * Default follow-up questions fallback
   */
  private getDefaultFollowUpQuestions(): FollowUpQuestion[] {
    return [
      {
        id: 'default_1',
        question: 'What feels most challenging about this step?',
        purpose: 'clarification',
        priority: 'high',
      },
      {
        id: 'default_2',
        question: 'How do you sense God might be inviting you to grow here?',
        purpose: 'spiritual_growth',
        priority: 'medium',
      },
    ];
  }

  /**
   * Default response fallback
   */
  private getDefaultResponse(userMessage: string): string {
    return 'Thank you for sharing that with me. I can hear your heart in what you\'ve said. Let me pray for wisdom as we explore this together. What would it look like to invite God into this specific situation?';
  }

  /**
   * Generate conversation analytics
   */
  async generateAnalytics(threadId: string): Promise<ConversationAnalytics> {
    const thread = await this.getConversationThread(threadId);
    if (!thread) {
      throw new Error('Conversation thread not found');
    }

    // Analyze engagement and spiritual growth indicators
    const userMessages = thread.messages.filter(m => m.type === 'user');
    const avgMessageLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;

    return {
      threadId,
      engagementLevel: avgMessageLength > 100 ? 'high' : avgMessageLength > 50 ? 'medium' : 'low',
      spiritualGrowthIndicators: {
        openness: this.calculateOpenness(userMessages),
        vulnerability: this.calculateVulnerability(userMessages),
        applicationWillingness: this.calculateApplicationWillingness(userMessages),
        scriptureEngagement: this.calculateScriptureEngagement(userMessages),
      },
      conversationQuality: {
        depth: thread.messages.length > 10 ? 8 : 6,
        relevance: 9, // Would be calculated based on topic coherence
        personalConnection: thread.insights.breakthroughs.length > 0 ? 9 : 7,
      },
      nextSteps: this.generateNextSteps(thread),
    };
  }

  private calculateOpenness(messages: ConversationMessage[]): number {
    // Simple heuristic based on message length and personal language
    const personalWords = ['i feel', 'i think', 'i struggle', 'i hope', 'i want'];
    let score = 5;

    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      personalWords.forEach(word => {
        if (content.includes(word)) {score += 0.5;}
      });
    });

    return Math.min(10, score);
  }

  private calculateVulnerability(messages: ConversationMessage[]): number {
    // Look for vulnerable language
    const vulnerableWords = ['struggle', 'hard', 'difficult', 'afraid', 'hurt', 'broken'];
    let score = 3;

    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      vulnerableWords.forEach(word => {
        if (content.includes(word)) {score += 1;}
      });
    });

    return Math.min(10, score);
  }

  private calculateApplicationWillingness(messages: ConversationMessage[]): number {
    // Look for action-oriented language
    const actionWords = ['will try', 'going to', 'plan to', 'commit', 'practice'];
    let score = 4;

    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      actionWords.forEach(word => {
        if (content.includes(word)) {score += 1.5;}
      });
    });

    return Math.min(10, score);
  }

  private calculateScriptureEngagement(messages: ConversationMessage[]): number {
    // Look for scripture references or biblical language
    const biblicalWords = ['god', 'jesus', 'lord', 'bible', 'verse', 'scripture', 'pray'];
    let score = 2;

    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      biblicalWords.forEach(word => {
        if (content.includes(word)) {score += 0.8;}
      });
    });

    return Math.min(10, score);
  }

  private generateNextSteps(thread: ConversationThread): string[] {
    const steps: string[] = [];

    if (thread.insights.prayerRequests.length > 0) {
      steps.push('Continue in prayer about the areas discussed');
    }

    if (thread.insights.scriptureReferences.length > 0) {
      steps.push(`Meditate on ${thread.insights.scriptureReferences[0]}`);
    }

    if (thread.insights.keyThemes.includes('trust')) {
      steps.push('Practice one small act of trust in God this week');
    }

    steps.push('Reflect on insights from this conversation in your journal');

    return steps;
  }
}
