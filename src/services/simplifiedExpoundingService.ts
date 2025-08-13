import { supabase } from './supabaseClient';

export type CardType = 'truth' | 'action' | 'affirmation' | 'bible' | 'challenge';

export interface CardInsight {
  id: string;
  cardType: CardType;
  cardContent: string;
  insight: string;
  actionableSteps?: string[];
  scriptureReference?: string;
  personalApplication: string;
  userId: string;
  playbookContext: string;
  createdAt: string;
}

export interface QuestionResponse {
  id: string;
  cardType: CardType;
  cardContent: string;
  userQuestion: string;
  aiResponse: string;
  userId: string;
  playbookContext: string;
  createdAt: string;
}

export interface FollowUpOption {
  id: string;
  label: string;
  prompt: string;
}

class SimplifiedExpoundingService {
  /**
   * Generate focused insight for a specific card type
   */
  async generateCardInsight(
    userId: string,
    cardType: CardType,
    cardContent: string,
    playbookContext: string,
    userOriginalInput?: string
  ): Promise<CardInsight> {
    try {
      console.log(`[SimplifiedExpoundingService] Generating ${cardType} insight`);

      // Get current session for authenticated API calls
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No authenticated session found');
      }

      // Call Supabase Edge Function for focused card insight (following generate playbook pattern)
      const { data, error } = await supabase.functions.invoke('answer-user-question', {
        body: {
          question: this.buildCardInsightPrompt(cardType, cardContent, userOriginalInput),
          context: `Playbook: ${playbookContext}. User's original situation: ${userOriginalInput || 'General spiritual growth'}`,
          userId: session.user.id,
          timestamp: Date.now(), // Ensure no caching like generate playbook
          cardType: cardType, // Add card type for better context
        },
      });

      if (error) {
        console.error('[SimplifiedExpoundingService] Supabase function error:', error);
        throw error;
      }

      if (data && data.response) {
        const insight: CardInsight = {
          id: `insight_${cardType}_${Date.now()}_${userId.slice(-6)}`,
          cardType,
          cardContent,
          insight: data.response,
          actionableSteps: this.extractActionableSteps(data.response),
          scriptureReference: this.extractScriptureReference(data.response),
          personalApplication: this.extractPersonalApplication(data.response),
          userId,
          playbookContext,
          createdAt: new Date().toISOString(),
        };

        console.log(`[SimplifiedExpoundingService] ${cardType} insight generated successfully`);
        return insight;
      }

      throw new Error('No response received from AI service');

    } catch (error) {
      console.error(`[SimplifiedExpoundingService] Error generating ${cardType} insight:`, error);

      // Return fallback insight
      return this.getFallbackInsight(userId, cardType, cardContent, playbookContext);
    }
  }

  /**
   * Answer user question about a specific card within playbook context
   */
  async answerCardQuestion(
    userId: string,
    cardType: CardType,
    cardContent: string,
    userQuestion: string,
    playbookContext: string,
    userOriginalInput?: string
  ): Promise<QuestionResponse> {
    try {
      console.log(`[SimplifiedExpoundingService] Answering question for ${cardType} card`);

      // Get current session for authenticated API calls
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No authenticated session found');
      }

      // Build contextual prompt for the question
      const contextualPrompt = this.buildQuestionPrompt(
        cardType,
        cardContent,
        userQuestion,
        playbookContext,
        userOriginalInput
      );

      // Call Supabase Edge Function for contextual Q&A (following generate playbook pattern)
      const { data, error } = await supabase.functions.invoke('answer-user-question', {
        body: {
          question: contextualPrompt,
          context: `Playbook: ${playbookContext}. User's original situation: ${userOriginalInput || 'General spiritual growth'}`,
          userId: session.user.id,
          timestamp: Date.now(), // Ensure no caching like generate playbook
          cardType: cardType, // Add card type for better context
          conversationId: `${cardType}_${Date.now()}`, // Unique conversation ID
        },
      });

      if (error) {
        console.error('[SimplifiedExpoundingService] Supabase function error:', error);
        throw error;
      }

      if (data && data.response) {
        const questionResponse: QuestionResponse = {
          id: `question_${cardType}_${Date.now()}_${userId.slice(-6)}`,
          cardType,
          cardContent,
          userQuestion,
          aiResponse: data.response,
          userId,
          playbookContext,
          createdAt: new Date().toISOString(),
        };

        console.log(`[SimplifiedExpoundingService] Question answered for ${cardType} card`);
        return questionResponse;
      }

      throw new Error('No response received from AI service');

    } catch (error) {
      console.error(`[SimplifiedExpoundingService] Error answering question for ${cardType}:`, error);

      // Return fallback response
      return this.getFallbackQuestionResponse(userId, cardType, cardContent, userQuestion, playbookContext);
    }
  }

  /**
   * Get follow-up options for each card type
   */
  getFollowUpOptions(cardType: CardType): FollowUpOption[] {
    const commonOptions: FollowUpOption[] = [
      {
        id: 'tell_more',
        label: 'Tell me more',
        prompt: 'Can you explain this in more detail and help me understand it better?',
      },
      {
        id: 'apply',
        label: 'How do I apply this?',
        prompt: 'How can I practically apply this to my specific situation?',
      },
      {
        id: 'important',
        label: 'Why is this important?',
        prompt: 'Why is this important for my spiritual growth and faith journey?',
      },
    ];

    // Add card-specific follow-up options
    const cardSpecificOptions: Record<CardType, FollowUpOption[]> = {
      truth: [
        {
          id: 'believe',
          label: 'How do I believe this?',
          prompt: 'How can I truly believe and internalize this truth in my heart?',
        },
      ],
      action: [
        {
          id: 'obstacles',
          label: 'What if I struggle?',
          prompt: 'What if I face obstacles or struggle to complete this action step?',
        },
      ],
      affirmation: [
        {
          id: 'doubt',
          label: 'What about my doubts?',
          prompt: 'How do I handle doubts or negative thoughts about this affirmation?',
        },
      ],
      bible: [
        {
          id: 'meaning',
          label: 'What does this mean?',
          prompt: 'What does this Bible verse mean in the context of my life and situation?',
        },
      ],
      challenge: [
        {
          id: 'overcome',
          label: 'How do I overcome this?',
          prompt: 'How can I overcome the difficulties in this challenge with God\'s help?',
        },
      ],
    };

    return [...commonOptions, ...(cardSpecificOptions[cardType] || [])];
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  private buildCardInsightPrompt(
    cardType: CardType,
    cardContent: string,
    userOriginalInput?: string
  ): string {
    const cardTypePrompts: Record<CardType, string> = {
      truth: `As a Christian life coach, provide a focused spiritual insight about this Truth in Love: "${cardContent}". Help the user understand how this truth applies to their life, relationships, and spiritual growth. Include practical ways to live out this truth daily.`,

      action: `As a Christian life coach, provide practical guidance for this Action Step: "${cardContent}". Break down how to implement this step effectively, what obstacles they might face, and how to rely on God's strength throughout the process.`,

      affirmation: `As a Christian life coach, provide encouragement and biblical foundation for this Affirmation: "${cardContent}". Help the user understand why this affirmation is true according to Scripture, and give practical ways to embrace this identity in Christ when doubts arise.`,

      bible: `As a Christian life coach, provide meaningful explanation and personal application for this Bible Verse: "${cardContent}". Explain the context, meaning, and how this scripture speaks to their current life situation with practical application steps.`,

      challenge: `As a Christian life coach, provide wisdom and encouragement for this Challenge: "${cardContent}". Help them understand how to approach this challenge with faith, what God might be teaching them, and practical steps to overcome obstacles with His help.`,
    };

    const basePrompt = cardTypePrompts[cardType];
    const contextPrompt = userOriginalInput
      ? `\n\nContext: The user originally came to this playbook because of: "${userOriginalInput}". Please make your response relevant to their specific situation.`
      : '';

    return basePrompt + contextPrompt + '\n\nProvide a focused, encouraging response in 1-2 paragraphs that is practical and biblically grounded.';
  }

  private buildQuestionPrompt(
    cardType: CardType,
    cardContent: string,
    userQuestion: string,
    playbookContext: string,
    userOriginalInput?: string
  ): string {
    return `
The user is looking at a ${cardType} card that says: "${cardContent}"

They are asking: "${userQuestion}"

Context: 
- This is part of the playbook: "${playbookContext}"
- User's original situation: "${userOriginalInput || 'General spiritual growth'}"

Please provide a focused, helpful answer that:
1. Directly addresses their question
2. Stays relevant to the ${cardType} card content
3. Considers their original situation and playbook context
4. Offers practical, biblical guidance
5. Is encouraging and supportive

Keep your response focused and around 1-2 paragraphs.
    `;
  }

  private extractActionableSteps(response: string): string[] {
    // Simple extraction of actionable steps from AI response
    const steps: string[] = [];
    const lines = response.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^\d+\./) || trimmed.startsWith('•') || trimmed.startsWith('-')) {
        steps.push(trimmed.replace(/^\d+\.\s*|^[•-]\s*/, ''));
      }
    }

    return steps.slice(0, 3); // Limit to 3 steps for simplicity
  }

  private extractScriptureReference(response: string): string | undefined {
    // Simple extraction of scripture references
    const scripturePattern = /\b\d*\s*[A-Za-z]+\s+\d+:\d+(-\d+)?\b/g;
    const matches = response.match(scripturePattern);
    return matches ? matches[0] : undefined;
  }

  private extractPersonalApplication(response: string): string {
    // Extract the most personal/applicable part of the response
    const sentences = response.split('.').filter(s => s.trim().length > 0);

    // Look for sentences with personal pronouns or application words
    const personalSentences = sentences.filter(sentence =>
      sentence.toLowerCase().includes('you') ||
      sentence.toLowerCase().includes('your') ||
      sentence.toLowerCase().includes('apply') ||
      sentence.toLowerCase().includes('practice')
    );

    return personalSentences.length > 0
      ? personalSentences[0].trim() + '.'
      : sentences[0]?.trim() + '.' || 'This applies to your spiritual growth journey.';
  }

  private getFallbackInsight(
    userId: string,
    cardType: CardType,
    cardContent: string,
    playbookContext: string
  ): CardInsight {
    const fallbackInsights: Record<CardType, string> = {
      truth: `This truth "${cardContent}" is a foundation for your spiritual growth. God wants you to understand and embrace this truth deeply in your heart, allowing it to transform how you see yourself and your relationship with Him. Consider how this truth can guide your decisions and relationships today.`,

      action: `This action step "${cardContent}" is designed to help you grow practically in your faith. Take it one step at a time, trusting that God will provide the strength and wisdom you need to follow through. Start small and build momentum with God's help.`,

      affirmation: `This affirmation "${cardContent}" reflects how God sees you and who you are in Christ. Even when it's hard to believe, this is God's truth about you. Let His love help you embrace this identity and speak this truth over yourself daily.`,

      bible: `This Bible verse "${cardContent}" contains God's wisdom and promises for your life. Spend time meditating on these words and ask God to show you how they apply to your current situation. Let Scripture be your guide and comfort.`,

      challenge: `This challenge "${cardContent}" is an opportunity for growth and deeper trust in God. Remember that God doesn't give you challenges to defeat you, but to develop your faith and character. Approach this with prayer and trust in His plan.`,
    };

    return {
      id: `fallback_${cardType}_${Date.now()}_${userId.slice(-6)}`,
      cardType,
      cardContent,
      insight: fallbackInsights[cardType],
      personalApplication: 'Take time to pray about this and ask God for guidance in applying it to your life.',
      userId,
      playbookContext,
      createdAt: new Date().toISOString(),
    };
  }

  private getFallbackQuestionResponse(
    userId: string,
    cardType: CardType,
    cardContent: string,
    userQuestion: string,
    playbookContext: string
  ): QuestionResponse {
    return {
      id: `fallback_question_${Date.now()}_${userId.slice(-6)}`,
      cardType,
      cardContent,
      userQuestion,
      aiResponse: `Thank you for your thoughtful question about "${cardContent}". While I'm having trouble generating a personalized response right now, I encourage you to bring this question to God in prayer. He knows your heart and your specific situation, and He will provide the wisdom and guidance you need. Consider also discussing this with a trusted Christian friend or mentor who can offer additional perspective.`,
      userId,
      playbookContext,
      createdAt: new Date().toISOString(),
    };
  }
}

export const simplifiedExpoundingService = new SimplifiedExpoundingService();
