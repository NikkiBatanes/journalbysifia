/**
 * Phase 3: Interactive Spiritual Coaching - Conversation Types
 * Defines interfaces for conversational AI spiritual director
 */

export interface ConversationMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    stepId?: string;
    subtaskId?: string;
    emotionalTone?: 'struggling' | 'hopeful' | 'confused' | 'grateful' | 'seeking';
    spiritualNeed?: 'encouragement' | 'guidance' | 'accountability' | 'prayer' | 'scripture';
  };
}

export interface ConversationThread {
  id: string;
  userId: string;
  playbookId: string;
  stepId: string;
  subtaskId?: string;
  title: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  messages: ConversationMessage[];
  context: {
    originalUserInput: string;
    playbookTitle: string;
    currentStepText: string;
    userSpiritualProfile?: any; // Will reference SpiritualProfile
  };
  insights: {
    keyThemes: string[];
    breakthroughs: string[];
    prayerRequests: string[];
    scriptureReferences: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  purpose: 'clarification' | 'deeper_exploration' | 'practical_application' | 'emotional_check' | 'spiritual_growth';
  priority: 'high' | 'medium' | 'low';
  suggestedResponses?: string[];
}

export interface ConversationResponse {
  message: string;
  followUpQuestions: FollowUpQuestion[];
  suggestedActions?: string[];
  prayerPoints?: string[];
  scriptureRecommendations?: {
    verse: string;
    reference: string;
    reason: string;
  }[];
  emotionalSupport?: {
    tone: 'encouraging' | 'gentle' | 'challenging' | 'celebratory';
    affirmations: string[];
  };
}

export interface ConversationAnalytics {
  threadId: string;
  engagementLevel: 'low' | 'medium' | 'high';
  spiritualGrowthIndicators: {
    openness: number; // 1-10 scale
    vulnerability: number;
    applicationWillingness: number;
    scriptureEngagement: number;
  };
  conversationQuality: {
    depth: number; // 1-10 scale
    relevance: number;
    personalConnection: number;
  };
  nextSteps: string[];
}

export interface InteractiveCoachingConfig {
  maxMessagesPerThread: number;
  followUpQuestionLimit: number;
  conversationTimeoutMinutes: number;
  enableEmotionalAnalysis: boolean;
  enableScriptureRecommendations: boolean;
  enablePrayerSupport: boolean;
  adaptiveResponseStyle: boolean;
}
