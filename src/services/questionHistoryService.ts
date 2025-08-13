import { supabase } from './supabaseClient';

export interface QuestionHistoryEntry {
  id: string;
  userId: string;
  cardType: 'truth' | 'action' | 'affirmation' | 'bible' | 'challenge';
  cardContent: string;
  question: string;
  aiResponse: string;
  playbookTitle: string;
  userOriginalInput?: string;
  askedAt: string;
  conversationId: string;
  isFollowUp: boolean;
  parentQuestionId?: string;
}

export interface SmartFollowUp {
  id: string;
  prompt: string;
  label: string;
  category: 'deeper' | 'practical' | 'biblical' | 'personal';
  relevanceScore: number;
}

class QuestionHistoryService {
  /**
   * Save a question and AI response to history (following no-cache personalization pattern)
   */
  async saveQuestionToHistory(
    userId: string,
    cardType: string,
    cardContent: string,
    question: string,
    aiResponse: string,
    playbookTitle: string,
    userOriginalInput?: string,
    conversationId?: string,
    parentQuestionId?: string
  ): Promise<QuestionHistoryEntry> {
    try {
      const historyEntry: Omit<QuestionHistoryEntry, 'id'> = {
        userId,
        cardType: cardType as any,
        cardContent,
        question,
        aiResponse,
        playbookTitle,
        userOriginalInput,
        askedAt: new Date().toISOString(),
        conversationId: conversationId || `${cardType}_${Date.now()}`,
        isFollowUp: !!parentQuestionId,
        parentQuestionId,
      };

      const { data, error } = await supabase
        .from('question_history')
        .insert(historyEntry)
        .select()
        .single();

      if (error) {
        console.error('[QuestionHistoryService] Error saving question:', error);
        throw error;
      }

      console.log('[QuestionHistoryService] Question saved to history');
      return data;
    } catch (error) {
      console.error('[QuestionHistoryService] Error:', error);
      throw new Error('Failed to save question to history.');
    }
  }

  /**
   * Get user's question history with personalized context
   */
  async getUserQuestionHistory(
    userId: string,
    cardType?: string,
    limit: number = 50
  ): Promise<QuestionHistoryEntry[]> {
    try {
      let query = supabase
        .from('question_history')
        .select('*')
        .eq('userId', userId)
        .order('askedAt', { ascending: false })
        .limit(limit);

      if (cardType) {
        query = query.eq('cardType', cardType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[QuestionHistoryService] Error fetching history:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[QuestionHistoryService] Error:', error);
      return [];
    }
  }

  /**
   * Generate smart follow-up questions based on conversation history and user context
   * Following maximum personalization pattern - no caching, always fresh
   */
  generateSmartFollowUps(
    cardType: string,
    cardContent: string,
    recentQuestions: string[],
    userOriginalInput?: string
  ): SmartFollowUp[] {
    const timestamp = Date.now(); // Ensure fresh generation each time
    const baseFollowUps: SmartFollowUp[] = [];

    // Generate personalized follow-ups based on card type and user context
    switch (cardType) {
      case 'truth':
        baseFollowUps.push(
          {
            id: `truth_deeper_${timestamp}`,
            prompt: `How can I apply this truth about "${cardContent}" to my specific situation: ${userOriginalInput || 'my current challenges'}?`,
            label: 'Apply to My Situation',
            category: 'personal',
            relevanceScore: 0.9,
          },
          {
            id: `truth_biblical_${timestamp}`,
            prompt: 'What other Bible verses support this truth and can strengthen my faith in this area?',
            label: 'Find Supporting Scripture',
            category: 'biblical',
            relevanceScore: 0.8,
          }
        );
        break;

      case 'action':
        baseFollowUps.push(
          {
            id: `action_practical_${timestamp}`,
            prompt: `What are the first 3 concrete steps I can take this week to implement "${cardContent}" in my daily life?`,
            label: 'Get Practical Steps',
            category: 'practical',
            relevanceScore: 0.95,
          },
          {
            id: `action_obstacles_${timestamp}`,
            prompt: `What obstacles might I face when trying to "${cardContent}" and how can I overcome them with God's help?`,
            label: 'Overcome Obstacles',
            category: 'deeper',
            relevanceScore: 0.85,
          }
        );
        break;

      case 'affirmation':
        baseFollowUps.push(
          {
            id: `affirmation_personal_${timestamp}`,
            prompt: `How can I truly believe and internalize this affirmation: "${cardContent}" when I struggle with doubt?`,
            label: 'Overcome Doubt',
            category: 'personal',
            relevanceScore: 0.9,
          },
          {
            id: `affirmation_daily_${timestamp}`,
            prompt: 'What daily practices can help me remember and live out this truth about who I am in Christ?',
            label: 'Daily Practices',
            category: 'practical',
            relevanceScore: 0.8,
          }
        );
        break;

      case 'bible':
        baseFollowUps.push(
          {
            id: `bible_deeper_${timestamp}`,
            prompt: `What is the deeper meaning and historical context of this verse: "${cardContent}"?`,
            label: 'Understand Context',
            category: 'biblical',
            relevanceScore: 0.85,
          },
          {
            id: `bible_application_${timestamp}`,
            prompt: `How does this verse specifically speak to my situation: ${userOriginalInput || 'my current life circumstances'}?`,
            label: 'Personal Application',
            category: 'personal',
            relevanceScore: 0.95,
          }
        );
        break;

      case 'challenge':
        baseFollowUps.push(
          {
            id: `challenge_courage_${timestamp}`,
            prompt: `How can I find the courage and strength to accept this challenge: "${cardContent}" when it feels overwhelming?`,
            label: 'Find Courage',
            category: 'personal',
            relevanceScore: 0.9,
          },
          {
            id: `challenge_steps_${timestamp}`,
            prompt: 'What specific, manageable steps can I take to begin this challenge while relying on God\'s grace?',
            label: 'Break Into Steps',
            category: 'practical',
            relevanceScore: 0.85,
          }
        );
        break;
    }

    // Filter out questions similar to recent ones for variety
    return baseFollowUps
      .filter(followUp => !this.isSimilarToRecentQuestions(followUp.prompt, recentQuestions))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3); // Top 3 most relevant
  }

  /**
   * Check if a follow-up is similar to recent questions to avoid repetition
   */
  private isSimilarToRecentQuestions(newPrompt: string, recentQuestions: string[]): boolean {
    const newWords = newPrompt.toLowerCase().split(' ');

    return recentQuestions.some(recent => {
      const recentWords = recent.toLowerCase().split(' ');
      const commonWords = newWords.filter(word =>
        word.length > 3 && recentWords.includes(word)
      );
      return commonWords.length > 2; // Similar if 3+ common words
    });
  }

  /**
   * Get conversation thread for a specific conversation ID
   */
  async getConversationThread(
    userId: string,
    conversationId: string
  ): Promise<QuestionHistoryEntry[]> {
    try {
      const { data, error } = await supabase
        .from('question_history')
        .select('*')
        .eq('userId', userId)
        .eq('conversationId', conversationId)
        .order('askedAt', { ascending: true });

      if (error) {
        console.error('[QuestionHistoryService] Error fetching conversation:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[QuestionHistoryService] Error:', error);
      return [];
    }
  }
}

export const questionHistoryService = new QuestionHistoryService();
