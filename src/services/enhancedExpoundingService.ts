/**
 * Enhanced Expounding Service for Phase 3
 *
 * Supports step-by-step expounding and user-initiated questions
 * for action steps and subtasks with tier-based access control.
 */

import { supabase } from './supabaseClient';
import { subscriptionService } from './subscriptionService';

export interface StepExpounding {
  id: string;
  actionStepId: string;
  subtaskId?: string;
  stepNumber: number; // 1, 2, 3, etc.
  stepTitle: string;
  contentType: 'spiritual_insight' | 'practical_guidance' | 'biblical_context' | 'reflection_questions' | 'step_breakdown';
  content: string;
  scriptureReferences?: string[];
  practicalSteps?: string[];
  reflectionQuestions?: string[];
  aiGenerated: boolean;
  userId: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserQuestionResponse {
  id: string;
  actionStepId?: string;
  subtaskId?: string;
  userQuestion: string;
  aiResponse: string;
  responseType: 'clarification' | 'deeper_insight' | 'practical_help' | 'biblical_guidance';
  relatedStepNumber?: number;
  parentExpoundingId?: string;
  userId: string;
  isHelpful?: boolean;
  createdAt: string;
}

export interface ExpoundingTemplate {
  stepNumber: number;
  title: string;
  contentType: string;
  template: string;
  prompts: {
    spiritual: string;
    practical: string;
    biblical: string;
    reflective: string;
  };
}

class EnhancedExpoundingService {
  private supabase = supabase;

  // Step-by-step expounding templates
  private stepTemplates: ExpoundingTemplate[] = [
    {
      stepNumber: 1,
      title: 'Understanding the Heart',
      contentType: 'spiritual_insight',
      template: "Let's explore the spiritual foundation of this step",
      prompts: {
        spiritual: "What is God's heart behind this action? How does this align with His character?",
        practical: 'What are the first practical steps to begin this journey?',
        biblical: 'What biblical principles support this action?',
        reflective: 'How might God be calling you to grow through this step?',
      },
    },
    {
      stepNumber: 2,
      title: 'Practical Application',
      contentType: 'practical_guidance',
      template: "Now let's break down how to practically implement this",
      prompts: {
        spiritual: 'How can you invite God into the practical aspects?',
        practical: 'What specific actions can you take today?',
        biblical: 'What biblical examples can guide your approach?',
        reflective: 'What obstacles might you face and how can faith help?',
      },
    },
    {
      stepNumber: 3,
      title: 'Biblical Foundation',
      contentType: 'biblical_context',
      template: "Let's ground this in Scripture and biblical wisdom",
      prompts: {
        spiritual: "How does this reflect God's will for your life?",
        practical: 'How did biblical figures handle similar situations?',
        biblical: 'What verses speak directly to this situation?',
        reflective: 'How can Scripture guide your daily decisions here?',
      },
    },
    {
      stepNumber: 4,
      title: 'Reflection & Growth',
      contentType: 'reflection_questions',
      template: 'Time for deeper reflection and personal application',
      prompts: {
        spiritual: 'How is God using this to transform your heart?',
        practical: 'What changes do you need to make in your routine?',
        biblical: 'Which biblical promises can you claim in this area?',
        reflective: "How will you know when you're growing in this area?",
      },
    },
  ];

  /**
   * Check if user has access to expounding features
   */
  async checkExpoundingAccess(userId: string): Promise<{
    hasAccess: boolean;
    requiredTier: string;
    currentTier: string;
    canAskQuestions: boolean;
    canViewSteps: boolean;
  }> {
    try {
      const subscription = await subscriptionService.getUserSubscription(userId);
      const limits = subscriptionService.getSubscriptionLimits(subscription?.tier || 'basic');

      // Check if intelligence features (which include expounding) are enabled for this tier
      const hasExpoundingAccess = limits.intelligenceEnabled || false;

      return {
        hasAccess: hasExpoundingAccess,
        requiredTier: 'transformation',
        currentTier: subscription?.tier || 'basic',
        canAskQuestions: hasExpoundingAccess,
        canViewSteps: hasExpoundingAccess,
      };
    } catch (error) {
      console.error('[EnhancedExpoundingService] Error checking access:', error);
      return {
        hasAccess: false,
        requiredTier: 'transformation',
        currentTier: 'basic',
        canAskQuestions: false,
        canViewSteps: false,
      };
    }
  }

  /**
   * Generate step-by-step expounding for an action step
   */
  async generateStepByStepExpounding(
    userId: string,
    actionStepId: string,
    actionStepText: string,
    subtaskId?: string,
    subtaskText?: string,
    userOriginalInput?: string, // User's original struggle/context for personalized faith guidance
    playbookTitle?: string // Additional context for Christian coaching
  ): Promise<StepExpounding[]> {
    try {
      // Check access first
      const access = await this.checkExpoundingAccess(userId);
      if (!access.hasAccess) {
        throw new Error('User does not have access to expounding features');
      }

      // Track user engagement (Phase 4 feature)
      this.trackUserEngagement(userId, 'expounding');

      // Use Supabase Edge Function for AI generation (consistent with generate playbook/devotional)
      const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();

      if (sessionError || !session) {
        console.error('[EnhancedExpoundingService] Session error:', sessionError);
        throw new Error('No valid session found');
      }

      const functionUrl = `${process.env.SUPABASE_URL || 'https://aesmrjinczhknchlrsmt.supabase.co'}/functions/v1/generate-expounding`;

      console.log('[EnhancedExpoundingService] Calling Supabase Edge Function for AI generation...');
      console.log('[EnhancedExpoundingService] Function URL:', functionUrl);
      console.log('[EnhancedExpoundingService] Request payload:', {
        actionStepId,
        actionStepText,
        subtaskId,
        subtaskText,
        userId,
      });

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzE0NzEsImV4cCI6MjA1MDU0NzQ3MX0.Uy4Tz2Vy8Hs7Qg8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          actionStepId,
          actionStepText,
          subtaskId,
          subtaskText,
          userId,
          userOriginalInput,
          playbookTitle,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[EnhancedExpoundingService] Supabase function error:', response.status, errorText);
        throw new Error(`Failed to generate expounding: ${response.status}`);
      }

      const expoundingSteps: StepExpounding[] = await response.json();

      console.log('[EnhancedExpoundingService] AI-generated expounding received, saving to database...');

      // Save to database
      await this.saveStepExpounding(expoundingSteps);

      return expoundingSteps;
    } catch (error) {
      console.error('[EnhancedExpoundingService] Error generating step expounding:', error);

      // Return fallback content instead of throwing error to prevent UI from getting stuck
      console.log('[EnhancedExpoundingService] Providing fallback content...');

      const fallbackSteps: StepExpounding[] = this.stepTemplates.map(template => ({
        id: `${actionStepId}_${subtaskId || 'main'}_step_${template.stepNumber}`,
        actionStepId,
        subtaskId,
        stepNumber: template.stepNumber,
        stepTitle: template.title,
        contentType: template.contentType as any,
        content: `${template.template} for: "${actionStepText}"`,
        scriptureReferences: this.getRelevantScriptures(template.contentType),
        practicalSteps: this.generatePracticalSteps(actionStepText, template.stepNumber),
        reflectionQuestions: this.generateReflectionQuestions(actionStepText, template.stepNumber),
        aiGenerated: false, // Mark as not AI generated since it's fallback
        userId,
        isPublic: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      return fallbackSteps;
    }
  }

  /**
   * Handle user questions about action steps
   */
  async answerUserQuestion(
    userId: string,
    question: string,
    actionStepId?: string,
    subtaskId?: string,
    relatedStepNumber?: number
  ): Promise<UserQuestionResponse> {
    try {
      // Check access
      const access = await this.checkExpoundingAccess(userId);
      if (!access.canAskQuestions) {
        throw new Error('User does not have access to ask questions');
      }

      // Get context if action step provided
      let context = '';
      if (actionStepId) {
        const stepData = await this.getActionStepContext(actionStepId, subtaskId);
        context = stepData.context;
      }

      // Generate AI response
      const aiResponse = await this.generateQuestionResponse(question, context);

      const questionResponse: UserQuestionResponse = {
        id: `question_${Date.now()}_${userId.slice(-6)}`,
        actionStepId,
        subtaskId,
        userQuestion: question,
        aiResponse: aiResponse.response,
        responseType: aiResponse.type,
        relatedStepNumber,
        userId,
        createdAt: new Date().toISOString(),
      };

      // Save to database
      await this.saveUserQuestion(questionResponse);

      return questionResponse;
    } catch (error) {
      console.error('[EnhancedExpoundingService] Error answering question:', error);
      throw error;
    }
  }

  /**
   * Get existing step-by-step expounding for an action step
   */
  async getStepExpounding(
    userId: string,
    actionStepId: string,
    _subtaskId?: string
  ): Promise<StepExpounding[]> {
    try {
      const access = await this.checkExpoundingAccess(userId);
      if (!access.hasAccess) {
        return [];
      }

      const { data, error } = await this.supabase
        .from('step_expounding')
        .select('*')
        .eq('action_step_id', actionStepId)
        .eq('user_id', userId)
        .order('step_number', { ascending: true });

      if (error) {throw error;}

      return data?.map(this.mapDatabaseToStepExpounding) || [];
    } catch (error) {
      console.error('[EnhancedExpoundingService] Error getting step expounding:', error);
      return [];
    }
  }

  /**
   * Get user's question history for an action step
   */
  async getUserQuestions(
    userId: string,
    actionStepId?: string,
    subtaskId?: string
  ): Promise<UserQuestionResponse[]> {
    try {
      let query = this.supabase
        .from('user_questions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (actionStepId) {
        query = query.eq('action_step_id', actionStepId);
      }

      if (subtaskId) {
        query = query.eq('subtask_id', subtaskId);
      }

      const { data, error } = await query;
      if (error) {throw error;}

      return data?.map(this.mapDatabaseToUserQuestion) || [];
    } catch (error) {
      console.error('[EnhancedExpoundingService] Error getting user questions:', error);
      return [];
    }
  }

  /**
   * Rate the helpfulness of a question response
   */
  async rateQuestionResponse(
    userId: string,
    questionId: string,
    isHelpful: boolean
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_questions')
        .update({ is_helpful: isHelpful })
        .eq('id', questionId)
        .eq('user_id', userId);

      if (error) {throw error;}
    } catch (error) {
      console.error('[EnhancedExpoundingService] Error rating response:', error);
    }
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  /**
   * Generate content using Supabase Edge Function (consistent with generate playbook/devotional)
   */
  private async generateStepContent(
    targetText: string,
    template: ExpoundingTemplate,
    actionStepText?: string
  ): Promise<{
    mainContent: string;
    scriptureReferences: string[];
    practicalSteps: string[];
    reflectionQuestions: string[];
  }> {
    // This method is now handled by the Supabase Edge Function
    // Return fallback content as this will be replaced by the full function call
    const stepContent = {
      mainContent: `${template.template} for: "${targetText}"`,
      scriptureReferences: this.getRelevantScriptures(template.contentType),
      practicalSteps: this.generatePracticalSteps(targetText, template.stepNumber),
      reflectionQuestions: this.generateReflectionQuestions(targetText, template.stepNumber),
    };

    return stepContent;
  }

  /**
   * Generate AI response to user question using dedicated Supabase Edge Function
   */
  private async generateQuestionResponse(
    question: string,
    context: string
  ): Promise<{
    response: string;
    type: 'clarification' | 'deeper_insight' | 'practical_help' | 'biblical_guidance';
  }> {
    try {
      console.log('[EnhancedExpoundingService] Generating AI response for question:', question);

      // Get current session for authenticated API calls
      const { data: { session } } = await this.supabase.auth.getSession();

      if (!session) {
        throw new Error('No authenticated session found');
      }

      // Call dedicated Supabase Edge Function for user questions
      const { data, error } = await this.supabase.functions.invoke('answer-user-question', {
        body: {
          question: question,
          context: context,
          userId: session.user.id,
        },
      });

      if (error) {
        console.error('[EnhancedExpoundingService] Supabase function error:', error);
        throw error;
      }

      if (data && data.response) {
        const responseType = this.categorizeQuestion(question);
        console.log('[EnhancedExpoundingService] AI response generated successfully');
        return { response: data.response, type: responseType };
      }

      throw new Error('No response received from AI service');

    } catch (error) {
      console.error('[EnhancedExpoundingService] AI question generation failed, using fallback:', error);

      // Fallback to template response if AI fails
      const responseType = this.categorizeQuestion(question);
      const response = this.generateTemplateResponse(question, context, responseType);

      return { response, type: responseType };
    }
  }

  /**
   * Get action step context for questions
   */
  private async getActionStepContext(
    actionStepId: string,
    subtaskId?: string
  ): Promise<{ context: string }> {
    try {
      // Get action step text
      const { data: stepData } = await this.supabase
        .from('playbook_action_steps')
        .select('text')
        .eq('id', actionStepId)
        .single();

      let context = stepData?.text || '';

      // Get subtask text if provided
      if (subtaskId) {
        const { data: subtaskData } = await this.supabase
          .from('playbook_sub_tasks')
          .select('text')
          .eq('id', subtaskId)
          .single();

        context += ` - Subtask: ${subtaskData?.text || ''}`;
      }

      return { context };
    } catch (error) {
      console.error('[EnhancedExpoundingService] Error getting context:', error);
      return { context: '' };
    }
  }

  /**
   * Save step expounding to database
   */
  private async saveStepExpounding(steps: StepExpounding[]): Promise<void> {
    try {
      const dbRecords = steps.map(step => ({
        id: step.id,
        action_step_id: step.actionStepId,
        subtask_id: step.subtaskId,
        step_number: step.stepNumber,
        step_title: step.stepTitle,
        content_type: step.contentType,
        content: step.content,
        scripture_references: step.scriptureReferences,
        practical_steps: step.practicalSteps,
        reflection_questions: step.reflectionQuestions,
        ai_generated: step.aiGenerated,
        user_id: step.userId,
        is_public: step.isPublic,
        created_at: step.createdAt,
        updated_at: step.updatedAt,
      }));

      const { error } = await this.supabase
        .from('step_expounding')
        .upsert(dbRecords);

      if (error) {throw error;}
    } catch (error) {
      console.error('[EnhancedExpoundingService] Error saving step expounding:', error);
    }
  }

  /**
   * Save user question to database
   */
  private async saveUserQuestion(question: UserQuestionResponse): Promise<void> {
    try {
      const dbRecord = {
        id: question.id,
        action_step_id: question.actionStepId,
        subtask_id: question.subtaskId,
        user_question: question.userQuestion,
        ai_response: question.aiResponse,
        response_type: question.responseType,
        related_step_number: question.relatedStepNumber,
        user_id: question.userId,
        created_at: question.createdAt,
      };

      const { error } = await this.supabase
        .from('user_questions')
        .insert(dbRecord);

      if (error) {throw error;}
    } catch (error) {
      console.error('[EnhancedExpoundingService] Error saving user question:', error);
    }
  }

  /**
   * Map database record to StepExpounding interface
   */
  private mapDatabaseToStepExpounding(record: Record<string, any>): StepExpounding {
    return {
      id: record.id,
      actionStepId: record.action_step_id,
      subtaskId: record.subtask_id,
      stepNumber: record.step_number,
      stepTitle: record.step_title,
      contentType: record.content_type,
      content: record.content,
      scriptureReferences: record.scripture_references,
      practicalSteps: record.practical_steps,
      reflectionQuestions: record.reflection_questions,
      aiGenerated: record.ai_generated,
      userId: record.user_id,
      isPublic: record.is_public,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  /**
   * Map database record to UserQuestionResponse interface
   */
  private mapDatabaseToUserQuestion(record: Record<string, any>): UserQuestionResponse {
    return {
      id: record.id,
      actionStepId: record.action_step_id,
      subtaskId: record.subtask_id,
      userQuestion: record.user_question,
      aiResponse: record.ai_response,
      responseType: record.response_type,
      relatedStepNumber: record.related_step_number,
      userId: record.user_id,
      isHelpful: record.is_helpful,
      createdAt: record.created_at,
    };
  }

  /**
   * Get relevant scriptures for content type
   */
  private getRelevantScriptures(contentType: string): string[] {
    const scriptureMap: Record<string, string[]> = {
      spiritual_insight: ['Psalm 139:23-24', 'Proverbs 3:5-6', '1 Corinthians 2:10-12'],
      practical_guidance: ['James 1:5', 'Proverbs 16:3', 'Philippians 4:13'],
      biblical_context: ['2 Timothy 3:16-17', 'Hebrews 4:12', 'Psalm 119:105'],
      reflection_questions: ['Psalm 26:2', 'Lamentations 3:40', '1 Corinthians 11:28'],
    };

    return scriptureMap[contentType] || [];
  }

  /**
   * Generate practical steps for a step number
   */
  private generatePracticalSteps(_text: string, stepNumber: number): string[] {
    const stepMaps: Record<number, string[]> = {
      1: ['Begin with prayer', 'Set clear intentions', 'Identify your motivation'],
      2: ['Create a specific plan', 'Set measurable goals', 'Establish accountability'],
      3: ['Study relevant Scripture', 'Seek biblical wisdom', 'Apply biblical principles'],
      4: ['Journal your thoughts', 'Reflect on progress', 'Adjust your approach'],
    };

    return stepMaps[stepNumber] || ['Take the first step', 'Stay consistent', 'Trust the process'];
  }

  /**
   * Generate reflection questions for a step number
   */
  private generateReflectionQuestions(_text: string, stepNumber: number): string[] {
    const questionMaps: Record<number, string[]> = {
      1: ['What is God calling me to in this area?', 'How does this align with my values?'],
      2: ['What practical steps can I take today?', 'What obstacles might I face?'],
      3: ['What does Scripture say about this?', 'How did biblical figures handle this?'],
      4: ['How am I growing through this?', 'What has God taught me so far?'],
    };

    return questionMaps[stepNumber] || ['How is God working in this situation?'];
  }

  /**
   * Categorize user question type
   */
  private categorizeQuestion(question: string): 'clarification' | 'deeper_insight' | 'practical_help' | 'biblical_guidance' {
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('how') || lowerQuestion.includes('what')) {
      return 'practical_help';
    } else if (lowerQuestion.includes('why') || lowerQuestion.includes('meaning')) {
      return 'deeper_insight';
    } else if (lowerQuestion.includes('bible') || lowerQuestion.includes('scripture')) {
      return 'biblical_guidance';
    } else {
      return 'clarification';
    }
  }

  /**
   * Generate template response for question
   */
  private generateTemplateResponse(
    question: string,
    context: string,
    type: 'clarification' | 'deeper_insight' | 'practical_help' | 'biblical_guidance'
  ): string {
    const templates: Record<string, string> = {
      clarification: `Let me help clarify this for you. Regarding "${question}" in the context of "${context}", here's what I understand...`,
      deeper_insight: `This is a profound question about "${question}". Looking deeper at "${context}", we can see...`,
      practical_help: `Great practical question! For "${question}" related to "${context}", here are some specific steps...`,
      biblical_guidance: `Let's look at what Scripture says about "${question}" in relation to "${context}". The Bible teaches us...`,
    };

    return templates[type] || `Thank you for your question about "${question}". Let me help you understand this better...`;
  }

  // =============================================
  // OPENAI INTEGRATION METHODS (consistent with generate playbook/devotional)
  // =============================================

  /**
   * Call OpenAI API for expounding content generation
   */
  private async callOpenAIForExpounding(
    targetText: string,
    template: ExpoundingTemplate
  ): Promise<string | null> {
    try {
      const prompt = this.buildExpoundingPrompt(targetText, template);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a wise spiritual advisor helping Christians grow in their faith through practical action steps. Provide biblical, encouraging, and actionable guidance.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        console.error('OpenAI API Error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error('[EnhancedExpoundingService] OpenAI API call failed:', error);
      return null;
    }
  }

  /**
   * Call OpenAI API for user question responses
   */
  private async callOpenAIForQuestion(
    question: string,
    context: string
  ): Promise<string | null> {
    try {
      const prompt = this.buildQuestionPrompt(question, context);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a compassionate spiritual mentor answering questions about Christian faith and spiritual growth. Provide personalized, biblical, and encouraging responses.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.8,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        console.error('OpenAI API Error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error('[EnhancedExpoundingService] OpenAI question API call failed:', error);
      return null;
    }
  }

  /**
   * Get personalized context for different content types
   */
  private getPersonalizedContext(contentType: string): string {
    const contextMap: Record<string, string> = {
      'spiritual_insight': 'Understanding God\'s heart behind this action and how it transforms us',
      'practical_guidance': 'Concrete steps that fit into daily life and spiritual disciplines',
      'biblical_context': 'Scripture that speaks directly to this situation with practical application',
      'reflection_questions': 'Deep questions that reveal heart motivations and spiritual growth areas',
    };

    return contextMap[contentType] || 'Personal spiritual growth and practical application';
  }

  /**
   * Build enhanced prompt for expounding content generation (personalized, no caching)
   */
  private buildExpoundingPrompt(targetText: string, template: ExpoundingTemplate): string {
    const personalizedContext = this.getPersonalizedContext(template.contentType);

    return `
You are a wise, compassionate spiritual mentor helping someone grow in their Christian faith. This person is working on: "${targetText}"

Context: ${template.title} - ${template.contentType}
Focus: ${personalizedContext}

Please provide a deeply personal and encouraging response that includes:

1. **Spiritual Insight** (2-3 sentences): 
   - Connect this action to God's heart and character
   - Explain why this matters for spiritual growth
   - Make it personal and relatable

2. **Biblical Foundation**:
   - One specific, relevant Bible verse with reference
   - Brief explanation of how it applies to this situation
   - Connect to God's promises or character

3. **Practical Steps** (3-4 actionable items):
   - Specific, concrete actions they can take today
   - Include prayer, reflection, or community elements
   - Make each step achievable and meaningful

4. **Reflection Questions** (2-3 thoughtful questions):
   - Help them examine their heart and motivations
   - Connect to their relationship with God
   - Encourage deeper spiritual introspection

Write as if you're speaking directly to someone you care about. Be encouraging, biblical, practical, and deeply personal. Avoid generic advice - make it specific to their spiritual journey.
    `.trim();
  }

  /**
   * Build enhanced prompt for user question responses (personalized, no caching)
   */
  private buildQuestionPrompt(question: string, context: string): string {
    const questionType = this.categorizeQuestion(question);
    const personalizedGuidance = this.getPersonalizedQuestionGuidance(questionType);

    return `
You are a caring spiritual mentor responding to someone's personal question about their faith journey.

**Their Situation**: They're working on "${context}" and have asked: "${question}"

**Question Type**: ${questionType}
**Focus**: ${personalizedGuidance}

Please provide a deeply personal, encouraging response that:

1. **Acknowledges their heart**: Show you understand their struggle or curiosity
2. **Provides biblical wisdom**: Share relevant Scripture or biblical principles naturally
3. **Offers practical steps**: Give 2-3 specific actions they can take
4. **Encourages their journey**: Remind them of God's love and their growth

**Tone**: Warm, understanding, and encouraging - like a trusted mentor who genuinely cares
**Length**: 3-4 sentences that feel personal and actionable
**Avoid**: Generic advice, overly complex theology, or judgment

Remember: This person is courageously seeking to grow spiritually. Meet them with grace, wisdom, and hope.
    `.trim();
  }

  /**
   * Get personalized guidance based on question type
   */
  private getPersonalizedQuestionGuidance(questionType: string): string {
    const guidanceMap: Record<string, string> = {
      'clarification': 'Help them understand clearly with practical examples and gentle explanation',
      'deeper_insight': 'Explore the spiritual significance and God\'s heart behind this situation',
      'practical_help': 'Provide concrete, actionable steps they can implement immediately',
      'biblical_guidance': 'Connect relevant Scripture to their specific situation with application',
    };

    return guidanceMap[questionType] || 'Provide encouraging, practical spiritual guidance';
  }

  /**
   * Parse OpenAI response for expounding content with advanced content extraction
   */
  private parseOpenAIExpoundingResponse(
    aiResponse: string,
    template: ExpoundingTemplate
  ): {
    mainContent: string;
    scriptureReferences: string[];
    practicalSteps: string[];
    reflectionQuestions: string[];
  } {
    try {
      // Enhanced parsing with section detection
      const sections = this.extractContentSections(aiResponse);

      return {
        mainContent: sections.mainContent || this.extractMainInsight(aiResponse),
        scriptureReferences: sections.scriptureReferences.length > 0
          ? sections.scriptureReferences
          : this.extractBiblicalReferences(aiResponse),
        practicalSteps: sections.practicalSteps.length > 0
          ? sections.practicalSteps
          : this.extractPracticalSteps(aiResponse),
        reflectionQuestions: sections.reflectionQuestions.length > 0
          ? sections.reflectionQuestions
          : this.extractReflectionQuestions(aiResponse),
      };
    } catch (error) {
      console.error('[EnhancedExpoundingService] Error parsing OpenAI response:', error);

      // Intelligent fallback with content analysis
      return this.createIntelligentFallback(aiResponse, template);
    }
  }

  /**
   * Extract content sections using advanced pattern matching
   */
  private extractContentSections(aiResponse: string): {
    mainContent: string;
    scriptureReferences: string[];
    practicalSteps: string[];
    reflectionQuestions: string[];
  } {
    const lines = aiResponse.split('\n').filter(line => line.trim());

    let mainContent = '';
    const scriptureReferences: string[] = [];
    const practicalSteps: string[] = [];
    const reflectionQuestions: string[] = [];

    let currentSection = 'main';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Section headers detection
      if (this.isSectionHeader(trimmedLine)) {
        currentSection = this.determineSectionType(trimmedLine);
        continue;
      }

      // Content classification
      if (this.isBiblicalReference(trimmedLine)) {
        scriptureReferences.push(this.cleanBiblicalReference(trimmedLine));
      } else if (this.isPracticalStep(trimmedLine)) {
        practicalSteps.push(this.cleanPracticalStep(trimmedLine));
      } else if (this.isReflectionQuestion(trimmedLine)) {
        reflectionQuestions.push(this.cleanReflectionQuestion(trimmedLine));
      } else if (currentSection === 'main' && trimmedLine.length > 10) {
        mainContent += trimmedLine + ' ';
      }
    }

    return {
      mainContent: mainContent.trim(),
      scriptureReferences,
      practicalSteps,
      reflectionQuestions,
    };
  }

  /**
   * Advanced content extraction helpers
   */
  private isSectionHeader(line: string): boolean {
    const headers = ['spiritual insight', 'biblical foundation', 'practical steps', 'reflection questions'];
    return headers.some(header => line.toLowerCase().includes(header)) && line.includes('**');
  }

  private determineSectionType(line: string): string {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('practical') || lowerLine.includes('steps')) {return 'practical';}
    if (lowerLine.includes('reflection') || lowerLine.includes('questions')) {return 'questions';}
    if (lowerLine.includes('biblical') || lowerLine.includes('scripture')) {return 'biblical';}
    return 'main';
  }

  private isBiblicalReference(line: string): boolean {
    return /\b\d+:\d+/.test(line) ||
           line.includes('Bible') ||
           line.includes('Scripture') ||
           /\b(Genesis|Exodus|Matthew|John|Romans|Corinthians|Ephesians|Philippians|Colossians|Timothy|Hebrews|James|Peter|Revelation)\b/.test(line);
  }

  private isPracticalStep(line: string): boolean {
    return /^\d+\./.test(line) ||
           line.startsWith('•') ||
           line.startsWith('-') ||
           line.toLowerCase().includes('step') ||
           line.toLowerCase().includes('action');
  }

  private isReflectionQuestion(line: string): boolean {
    return line.includes('?') &&
           (line.toLowerCase().includes('how') ||
            line.toLowerCase().includes('what') ||
            line.toLowerCase().includes('why') ||
            line.toLowerCase().includes('reflect'));
  }

  private cleanBiblicalReference(line: string): string {
    return line.replace(/^\d+\.\s*/, '').replace(/^[•-]\s*/, '').trim();
  }

  private cleanPracticalStep(line: string): string {
    return line.replace(/^\d+\.\s*/, '').replace(/^[•-]\s*/, '').trim();
  }

  private cleanReflectionQuestion(line: string): string {
    return line.replace(/^\d+\.\s*/, '').replace(/^[•-]\s*/, '').trim();
  }

  /**
   * Extract main insight from unstructured content
   */
  private extractMainInsight(aiResponse: string): string {
    const sentences = aiResponse.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 3).join('. ').trim() + '.';
  }

  /**
   * Extract biblical references with pattern matching
   */
  private extractBiblicalReferences(aiResponse: string): string[] {
    const biblicalPattern = /([A-Z][a-z]+\s+\d+:\d+(?:-\d+)?)/g;
    const matches = aiResponse.match(biblicalPattern) || [];
    return matches.length > 0 ? matches : this.getRelevantScriptures('spiritual_insight');
  }

  /**
   * Extract practical steps from content
   */
  private extractPracticalSteps(aiResponse: string): string[] {
    const stepPatterns = [
      /\d+\.\s*([^.!?]+)/g,
      /•\s*([^.!?]+)/g,
      /-\s*([^.!?]+)/g,
    ];

    for (const pattern of stepPatterns) {
      const matches = Array.from(aiResponse.matchAll(pattern));
      if (matches.length >= 2) {
        return matches.map(match => match[1].trim()).slice(0, 4);
      }
    }

    return this.generatePracticalSteps('', 1);
  }

  /**
   * Extract reflection questions from content
   */
  private extractReflectionQuestions(aiResponse: string): string[] {
    const questionPattern = /([^.!?]*\?)/g;
    const matches = Array.from(aiResponse.matchAll(questionPattern));
    const questions = matches
      .map(match => match[1].trim())
      .filter(q => q.length > 10 && q.length < 200)
      .slice(0, 3);

    return questions.length > 0 ? questions : this.generateReflectionQuestions('', 1);
  }

  /**
   * Create intelligent fallback content
   */
  private createIntelligentFallback(aiResponse: string, template: ExpoundingTemplate): {
    mainContent: string;
    scriptureReferences: string[];
    practicalSteps: string[];
    reflectionQuestions: string[];
  } {
    return {
      mainContent: aiResponse.length > 200 ? aiResponse.substring(0, 200) + '...' : aiResponse,
      scriptureReferences: this.getRelevantScriptures(template.contentType),
      practicalSteps: this.generatePracticalSteps('', template.stepNumber),
      reflectionQuestions: this.generateReflectionQuestions('', template.stepNumber),
    };
  }
  // Phase 4: Advanced Features - Analytics & Tracking
  private userEngagementMetrics: Map<string, {
    expoundingRequests: number;
    questionsAsked: number;
    lastInteraction: Date;
    favoriteContentTypes: string[];
    averageReadTime: number;
  }> = new Map();

  /**
   * Track user engagement with expounding features
   */
  private trackUserEngagement(userId: string, action: 'expounding' | 'question', contentType?: string): void {
    const current = this.userEngagementMetrics.get(userId) || {
      expoundingRequests: 0,
      questionsAsked: 0,
      lastInteraction: new Date(),
      favoriteContentTypes: [],
      averageReadTime: 0,
    };

    if (action === 'expounding') {
      current.expoundingRequests++;
      if (contentType && !current.favoriteContentTypes.includes(contentType)) {
        current.favoriteContentTypes.push(contentType);
      }
    } else if (action === 'question') {
      current.questionsAsked++;
    }

    current.lastInteraction = new Date();
    this.userEngagementMetrics.set(userId, current);
  }

  /**
   * Generate contextual follow-up questions based on user's spiritual journey
   */
  async generateFollowUpQuestions(
    userId: string,
    actionStepText: string,
    currentStepNumber: number
  ): Promise<string[]> {
    const userMetrics = this.userEngagementMetrics.get(userId);
    const personalizedContext = userMetrics?.favoriteContentTypes.join(', ') || 'spiritual growth';

    try {
      const prompt = `
You are a wise spiritual mentor helping someone grow in their faith journey.

Context: They're working on "${actionStepText}" (Step ${currentStepNumber})
Their interests: ${personalizedContext}

Generate 3 thoughtful follow-up questions that would help them go deeper in their spiritual growth. Make each question:
1. Personal and introspective
2. Actionable and practical
3. Connected to their current step

Format as a simple list, one question per line.
      `.trim();

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a compassionate spiritual advisor helping people grow in their Christian faith.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || '';

      return aiResponse
        .split('\n')
        .filter(line => line.trim().length > 10)
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 3);

    } catch (error) {
      console.error('[EnhancedExpoundingService] Error generating follow-up questions:', error);

      // Fallback questions based on step number
      const fallbackQuestions = [
        'How is God speaking to you through this step?',
        'What practical changes will you make this week?',
        'How can you invite others into this part of your journey?',
      ];

      return fallbackQuestions;
    }
  }

  /**
   * Analyze content connections between steps for better user experience
   */
  analyzeStepConnections(steps: StepExpounding[]): {
    connections: Array<{
      fromStep: number;
      toStep: number;
      connectionType: 'builds_on' | 'contrasts_with' | 'complements';
      description: string;
    }>;
    suggestedOrder: number[];
  } {
    const connections: Array<{
      fromStep: number;
      toStep: number;
      connectionType: 'builds_on' | 'contrasts_with' | 'complements';
      description: string;
    }> = [];

    // Analyze content relationships
    for (let i = 0; i < steps.length; i++) {
      for (let j = i + 1; j < steps.length; j++) {
        const step1 = steps[i];
        const step2 = steps[j];

        // Check for content type relationships
        if (step1.contentType === 'spiritual_insight' && step2.contentType === 'practical_guidance') {
          connections.push({
            fromStep: step1.stepNumber,
            toStep: step2.stepNumber,
            connectionType: 'builds_on',
            description: 'Spiritual insight leads to practical application',
          });
        }

        if (step1.contentType === 'biblical_context' && step2.contentType === 'reflection_questions') {
          connections.push({
            fromStep: step1.stepNumber,
            toStep: step2.stepNumber,
            connectionType: 'complements',
            description: 'Biblical foundation supports deeper reflection',
          });
        }
      }
    }

    // Suggest optimal reading order
    const suggestedOrder = [1, 2, 3, 4]; // Default progressive order

    return {
      connections,
      suggestedOrder,
    };
  }

  /**
   * Get user engagement analytics
   */
  getUserEngagementAnalytics(userId: string): {
    totalInteractions: number;
    favoriteContentTypes: string[];
    engagementLevel: 'low' | 'medium' | 'high';
    lastActive: Date;
    suggestedContent: string[];
  } {
    const metrics = this.userEngagementMetrics.get(userId);

    if (!metrics) {
      return {
        totalInteractions: 0,
        favoriteContentTypes: [],
        engagementLevel: 'low',
        lastActive: new Date(),
        suggestedContent: ['spiritual_insight'],
      };
    }

    const totalInteractions = metrics.expoundingRequests + metrics.questionsAsked;
    let engagementLevel: 'low' | 'medium' | 'high' = 'low';

    if (totalInteractions > 10) {engagementLevel = 'high';}
    else if (totalInteractions > 3) {engagementLevel = 'medium';}

    // Suggest content based on what they haven't explored much
    const allContentTypes = ['spiritual_insight', 'practical_guidance', 'biblical_context', 'reflection_questions'];
    const suggestedContent = allContentTypes.filter(
      type => !metrics.favoriteContentTypes.includes(type)
    );

    return {
      totalInteractions,
      favoriteContentTypes: metrics.favoriteContentTypes,
      engagementLevel,
      lastActive: metrics.lastInteraction,
      suggestedContent: suggestedContent.length > 0 ? suggestedContent : ['spiritual_insight'],
    };
  }
}

// Export singleton instance
export const enhancedExpoundingService = new EnhancedExpoundingService();
