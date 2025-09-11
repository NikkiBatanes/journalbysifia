// Spiritual Profile System for Personalized Christian Coaching
// Phase 2: Smart Personalization Engine

export type SpiritualMaturityLevel =
  | 'new_believer'      // Recently accepted faith, learning basics
  | 'growing'           // Established faith, actively growing
  | 'mature'            // Deep understanding, helping others
  | 'leader';           // Teaching, mentoring, leading others

export type CommunicationStyle =
  | 'gentle'            // Soft, encouraging, patient approach
  | 'direct'            // Clear, straightforward, action-oriented
  | 'scholarly'         // Theological depth, biblical analysis
  | 'practical'         // Real-world application, everyday faith
  | 'conversational';   // Friendly, relatable, story-based

export type FaithBackground =
  | 'new_to_faith'      // Recently started faith journey
  | 'returning'         // Coming back after time away
  | 'lifelong'          // Raised in faith, continuous journey
  | 'exploring'         // Still questioning, seeking answers
  | 'transitioning';    // Moving between denominations/traditions

export type PreferredContentDepth =
  | 'surface'           // Quick insights, simple truths
  | 'medium'            // Balanced depth with practical application
  | 'deep'              // Theological exploration, complex concepts
  | 'adaptive';         // Adjust based on topic and context

export interface SpiritualProfile {
  userId: string;

  // Core Profile Information
  maturityLevel: SpiritualMaturityLevel;
  communicationStyle: CommunicationStyle;
  faithBackground: FaithBackground;
  preferredDepth: PreferredContentDepth;

  // Current Spiritual Journey
  currentStruggles: string[];           // Areas they're working on
  recentVictories: string[];            // Recent growth areas
  prayerRequests: string[];             // Current prayer focuses

  // Learning Preferences
  preferredBibleTranslation?: string;   // NIV, ESV, NLT, etc.
  favoriteVerses: string[];             // Verses that resonate
  topicsOfInterest: string[];           // Areas they want to grow in

  // Interaction History
  conversationHistory: ConversationMemory[];
  responsePatterns: ResponsePattern[];
  engagementMetrics: EngagementMetrics;

  // Adaptive Learning
  contentPreferences: ContentPreferences;
  personalizedInsights: PersonalizedInsight[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
}

export interface ConversationMemory {
  id: string;
  date: string;
  topic: string;
  userQuestion: string;
  aiResponse: string;
  userFeedback?: 'helpful' | 'not_helpful' | 'very_helpful';
  followUpQuestions: string[];
  emotionalTone: 'struggling' | 'hopeful' | 'confused' | 'grateful' | 'seeking';
}

export interface ResponsePattern {
  pattern: string;                      // What type of responses work best
  effectiveness: number;                // 0-1 score of how well it works
  contexts: string[];                   // When this pattern is most effective
  examples: string[];                   // Sample responses that worked
}

export interface EngagementMetrics {
  totalInteractions: number;
  averageSessionLength: number;         // minutes
  mostActiveTimeOfDay: string;
  preferredInteractionFrequency: 'daily' | 'weekly' | 'as_needed';
  topEngagementTriggers: string[];      // What prompts most interaction
}

export interface ContentPreferences {
  preferredInsightLength: 'short' | 'medium' | 'long';
  includeScripture: boolean;
  includePracticalSteps: boolean;
  includeReflectionQuestions: boolean;
  preferredEmojis: string[];            // Which emojis resonate
  avoidTopics: string[];                // Sensitive areas to avoid
}

export interface PersonalizedInsight {
  id: string;
  insight: string;
  context: string;                      // When/why this was generated
  effectiveness: number;                // How well it worked (0-1)
  userResponse: string;                 // How user responded
  dateGenerated: string;
  relatedStruggles: string[];
}

// Spiritual Maturity Assessment
export interface MaturityAssessment {
  userId: string;
  assessmentDate: string;

  // Assessment Areas
  biblicalKnowledge: number;            // 1-10 scale
  prayerLife: number;                   // 1-10 scale
  serviceToOthers: number;              // 1-10 scale
  faithInTrials: number;                // 1-10 scale
  spiritualDisciplines: number;         // 1-10 scale

  // Calculated Maturity Level
  overallMaturity: SpiritualMaturityLevel;
  growthAreas: string[];
  strengths: string[];

  // Recommendations
  suggestedContentDepth: PreferredContentDepth;
  recommendedCommunicationStyle: CommunicationStyle;
  nextSteps: string[];
}

// Personalization Engine Configuration
export interface PersonalizationConfig {
  // Maturity Level Mappings
  maturityLevelPrompts: Record<SpiritualMaturityLevel, string>;
  communicationStylePrompts: Record<CommunicationStyle, string>;

  // Content Adaptation Rules
  contentDepthRules: Record<PreferredContentDepth, ContentDepthRule>;
  contextualAdaptations: ContextualAdaptation[];

  // Learning Algorithm Settings
  learningRate: number;                 // How quickly to adapt (0-1)
  memoryDecay: number;                  // How quickly old patterns fade
  confidenceThreshold: number;          // When to apply personalization
}

export interface ContentDepthRule {
  maxInsightLength: number;             // characters
  scriptureComplexity: 'simple' | 'moderate' | 'complex';
  theologicalDepth: 'basic' | 'intermediate' | 'advanced';
  practicalApplications: number;        // how many to include
  reflectionQuestionDepth: 'surface' | 'thoughtful' | 'deep';
}

export interface ContextualAdaptation {
  trigger: string;                      // What triggers this adaptation
  adaptations: {
    tone: string;
    contentFocus: string;
    encouragementLevel: 'gentle' | 'strong' | 'challenging';
    scriptureSelection: string;
  };
}

// Helper Types for API Responses
export interface PersonalizedExpoundingRequest {
  userId: string;
  actionStepText: string;
  userOriginalInput: string;
  playbookTitle: string;
  spiritualProfile: SpiritualProfile;
  currentContext?: {
    timeOfDay: string;
    recentActivity: string;
    emotionalState?: string;
  };
}

