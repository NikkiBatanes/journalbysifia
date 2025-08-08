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

      // Check if expounding is enabled for this tier
      const hasExpoundingAccess = limits.expoundingEnabled || false;

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
    _actionStepText: string,
    subtaskId?: string,
    subtaskText?: string
  ): Promise<StepExpounding[]> {
    try {
      // Check access first
      const access = await this.checkExpoundingAccess(userId);
      if (!access.hasAccess) {
        throw new Error('User does not have access to expounding features');
      }

      const expoundingSteps: StepExpounding[] = [];
      const targetText = subtaskText || actionStepText;

      for (const template of this.stepTemplates) {
        const stepContent = await this.generateStepContent(
          targetText,
          template,
          actionStepText
        );

        const stepExpounding: StepExpounding = {
          id: `${actionStepId}_${subtaskId || 'main'}_step_${template.stepNumber}`,
          actionStepId,
          subtaskId,
          stepNumber: template.stepNumber,
          stepTitle: template.title,
          contentType: template.contentType as any,
          content: stepContent.mainContent,
          scriptureReferences: stepContent.scriptureReferences,
          practicalSteps: stepContent.practicalSteps,
          reflectionQuestions: stepContent.reflectionQuestions,
          aiGenerated: true,
          userId,
          isPublic: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        expoundingSteps.push(stepExpounding);
      }

      // Save to database
      await this.saveStepExpounding(expoundingSteps);

      return expoundingSteps;
    } catch (error) {
      console.error('[EnhancedExpoundingService] Error generating step expounding:', error);
      throw error;
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
    subtaskId?: string
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
   * Generate content for a specific step
   */
  private async generateStepContent(
    targetText: string,
    template: ExpoundingTemplate,
    actionStepText: string
  ): Promise<{
    mainContent: string;
    scriptureReferences: string[];
    practicalSteps: string[];
    reflectionQuestions: string[];
  }> {
    // In production, this would call AI service
    // For now, return template-based content

    const stepContent = {
      mainContent: `${template.template} for: "${targetText}"`,
      scriptureReferences: this.getRelevantScriptures(template.contentType),
      practicalSteps: this.generatePracticalSteps(targetText, template.stepNumber),
      reflectionQuestions: this.generateReflectionQuestions(targetText, template.stepNumber),
    };

    return stepContent;
  }

  /**
   * Generate AI response to user question
   */
  private async generateQuestionResponse(
    question: string,
    context: string
  ): Promise<{
    response: string;
    type: 'clarification' | 'deeper_insight' | 'practical_help' | 'biblical_guidance';
  }> {
    // In production, this would call AI service with context
    // For now, return template response

    const responseType = this.categorizeQuestion(question);
    const response = this.generateTemplateResponse(question, context, responseType);

    return { response, type: responseType };
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
  private mapDatabaseToStepExpounding(record: any): StepExpounding {
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
  private mapDatabaseToUserQuestion(record: any): UserQuestionResponse {
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
  private generatePracticalSteps(text: string, stepNumber: number): string[] {
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
  private generateReflectionQuestions(text: string, stepNumber: number): string[] {
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
    type: string
  ): string {
    const templates: Record<string, string> = {
      clarification: `Let me help clarify this for you. Regarding "${question}" in the context of "${context}", here's what I understand...`,
      deeper_insight: `This is a profound question about "${question}". Looking deeper at "${context}", we can see...`,
      practical_help: `Great practical question! For "${question}" related to "${context}", here are some specific steps...`,
      biblical_guidance: `Let's look at what Scripture says about "${question}" in relation to "${context}". The Bible teaches us...`,
    };

    return templates[type] || `Thank you for your question about "${question}". Let me help you understand this better...`;
  }
}

// Export singleton instance
export const enhancedExpoundingService = new EnhancedExpoundingService();
