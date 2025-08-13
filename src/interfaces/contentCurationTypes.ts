/**
 * Phase 4: Intelligent Content Curation - Content Types
 * Defines interfaces for smart content delivery and adaptive learning
 */

export interface ContentItem {
  id: string;
  type: 'text' | 'audio' | 'video' | 'interactive' | 'scripture' | 'prayer' | 'reflection';
  title: string;
  content: string;
  metadata: {
    duration?: number; // in minutes
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    spiritualThemes: string[];
    emotionalTones: ('encouraging' | 'challenging' | 'comforting' | 'inspiring')[];
    scriptureReferences?: string[];
    tags: string[];
  };
  mediaUrl?: string; // for audio/video content
  interactiveConfig?: InteractiveExerciseConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface InteractiveExerciseConfig {
  exerciseType: 'guided_prayer' | 'scripture_meditation' | 'gratitude_practice' | 'reflection_questions' | 'worship_moment';
  steps: InteractiveStep[];
  estimatedDuration: number;
  backgroundMusic?: string;
  voiceGuidance?: boolean;
}

export interface InteractiveStep {
  id: string;
  instruction: string;
  duration?: number; // in seconds
  userInput?: {
    type: 'text' | 'voice' | 'selection' | 'none';
    prompt?: string;
    options?: string[];
  };
  backgroundElement?: {
    type: 'scripture' | 'music' | 'nature_sounds' | 'silence';
    content?: string;
  };
}

export interface ContentRecommendation {
  contentItem: ContentItem;
  relevanceScore: number; // 0-100
  reasoning: string;
  optimalTiming: {
    preferredTime: 'morning' | 'afternoon' | 'evening' | 'anytime';
    urgency: 'immediate' | 'today' | 'this_week' | 'flexible';
    contextualTriggers: string[];
  };
  personalizationFactors: {
    spiritualMaturity: number; // how well it matches user's level
    emotionalState: number; // how well it addresses current emotional needs
    conversationContext: number; // relevance to recent conversations
    growthGoals: number; // alignment with user's spiritual goals
  };
}

export interface LearningPath {
  id: string;
  userId: string;
  title: string;
  description: string;
  spiritualFocus: string[];
  currentStage: number;
  totalStages: number;
  stages: LearningStage[];
  adaptiveRules: AdaptiveRule[];
  progressMetrics: {
    completionRate: number;
    engagementScore: number;
    spiritualGrowthIndicators: Record<string, number>;
    lastUpdated: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningStage {
  id: string;
  stageNumber: number;
  title: string;
  description: string;
  objectives: string[];
  recommendedContent: string[]; // ContentItem IDs
  completionCriteria: {
    requiredEngagement: number;
    minimumReflections: number;
    conversationDepth: number;
  };
  estimatedDuration: number; // in days
  prerequisites?: string[];
}

export interface AdaptiveRule {
  id: string;
  condition: {
    type: 'engagement_low' | 'breakthrough_detected' | 'struggle_identified' | 'time_based' | 'conversation_theme';
    threshold?: number;
    timeframe?: number; // in days
    keywords?: string[];
  };
  action: {
    type: 'recommend_content' | 'adjust_difficulty' | 'change_focus' | 'schedule_check_in' | 'celebrate_progress';
    parameters: Record<string, any>;
  };
  priority: 'high' | 'medium' | 'low';
}

export interface ContentDeliverySchedule {
  userId: string;
  scheduledItems: ScheduledContentItem[];
  preferences: {
    preferredTimes: string[]; // e.g., ['08:00', '20:00']
    frequency: 'daily' | 'every_other_day' | 'weekly' | 'as_needed';
    contentTypes: ContentItem['type'][];
    maxDailyContent: number;
    quietHours: { start: string; end: string };
  };
  adaptiveSettings: {
    adjustBasedOnEngagement: boolean;
    respectEmotionalState: boolean;
    considerConversationContext: boolean;
    enableSmartTiming: boolean;
  };
}

export interface ScheduledContentItem {
  id: string;
  contentId: string;
  scheduledFor: Date;
  deliveryMethod: 'notification' | 'in_app' | 'email' | 'auto_present';
  priority: 'high' | 'medium' | 'low';
  context: {
    reason: string;
    relatedConversation?: string;
    spiritualNeed?: string;
    emotionalSupport?: boolean;
  };
  status: 'scheduled' | 'delivered' | 'engaged' | 'skipped' | 'expired';
  deliveredAt?: Date;
  engagedAt?: Date;
  userFeedback?: {
    helpful: boolean;
    timing: 'perfect' | 'good' | 'poor';
    relevance: number; // 1-5 scale
    comments?: string;
  };
}

export interface ContentAnalytics {
  contentId: string;
  userId: string;
  engagementMetrics: {
    viewCount: number;
    completionRate: number;
    timeSpent: number; // in minutes
    interactionCount: number;
    shareCount: number;
    bookmarkCount: number;
  };
  spiritualImpact: {
    prayerRequests: number;
    breakthroughMoments: number;
    scriptureEngagement: number;
    conversationDepth: number;
    applicationCommitments: number;
  };
  userFeedback: {
    ratings: number[]; // 1-5 scale ratings
    comments: string[];
    helpfulnessScore: number;
    relevanceScore: number;
  };
  adaptiveLearning: {
    optimalTiming: string[];
    effectiveContexts: string[];
    userPreferences: Record<string, any>;
    improvementSuggestions: string[];
  };
}

export interface ContentCurationConfig {
  algorithmWeights: {
    spiritualMaturity: number;
    emotionalState: number;
    conversationContext: number;
    userPreferences: number;
    timing: number;
    engagement: number;
  };
  contentFilters: {
    enableDifficultyMatching: boolean;
    respectEmotionalState: boolean;
    considerRecentContent: boolean;
    avoidRepetition: boolean;
    prioritizeBreakthroughs: boolean;
  };
  deliverySettings: {
    maxRecommendationsPerDay: number;
    minimumTimeBetweenContent: number; // in hours
    adaptiveScheduling: boolean;
    respectUserTimezone: boolean;
  };
  learningPathSettings: {
    enableAdaptiveProgression: boolean;
    allowPathSwitching: boolean;
    celebrateCompletions: boolean;
    trackLongTermGrowth: boolean;
  };
}
