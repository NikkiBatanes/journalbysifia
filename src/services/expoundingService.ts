/**
 * Expounding Service for Access Tiers System
 * Handles deeper insights and clarification for action steps
 */

import { supabase } from './supabaseClient';
import { subscriptionService } from './subscriptionService';

export interface ExpoundingContent {
  id: string;
  actionStepId?: string;
  subtaskId?: string;
  stepNumber?: number; // For step-by-step expounding
  contentType: 'spiritual_insight' | 'practical_guidance' | 'biblical_context' | 'reflection_questions' | 'step_breakdown' | 'user_question_response';
  title: string;
  content: string;
  scriptureReferences?: string[];
  practicalSteps?: string[];
  reflectionQuestions?: string[];
  aiGenerated: boolean;
  userId: string;
  userQuestion?: string; // For user-initiated questions
  parentExpoundingId?: string; // For follow-up questions
  isPublic?: boolean; // For sharing insights
  createdAt: string;
  updatedAt: string;
}

export interface ExpoundingAccess {
  hasAccess: boolean;
  requiredTier: string;
  currentTier: string;
}

export class ExpoundingService {
  private supabase = supabase;

  /**
   * Check if user has access to expounding content
   */
  async hasExpoundingAccess(userId: string): Promise<ExpoundingAccess> {
    try {
      const subscription = await subscriptionService.getUserSubscription(userId);
      const limits = subscriptionService.getSubscriptionLimits(subscription.tier);
      
      return {
        hasAccess: limits.expoundingEnabled || false,
        requiredTier: 'transformation',
        currentTier: subscription.tier,
      };
    } catch (error) {
      console.error('[ExpoundingService] Error checking expounding access:', error);
      return {
        hasAccess: false,
        requiredTier: 'transformation',
        currentTier: 'basic',
      };
    }
  }

  /**
   * Get expounding content for specific action step and subtask
   */
  async getExpoundingContent(actionStepId: string, subtaskId: string): Promise<ExpoundingContent | null> {
    try {
      const { data, error } = await this.supabase
        .from('expounding_content')
        .select('*')
        .eq('action_step_id', actionStepId)
        .eq('subtask_id', subtaskId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[ExpoundingService] Error fetching expounding content:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[ExpoundingService] Error in getExpoundingContent:', error);
      return null;
    }
  }

  /**
   * Generate expounding content using AI
   */
  async generateExpoundingContent(actionStep: any, subtask: any): Promise<ExpoundingContent | null> {
    try {
      // For beta launch, we'll use predefined templates
      // In production, this would integrate with AI service
      
      const expandedContent = await this.generateContentWithAI(actionStep, subtask);
      
      const expoundingContent: Partial<ExpoundingContent> = {
        action_step_id: actionStep.id,
        subtask_id: subtask.id,
        expanded_content: expandedContent,
        tier_required: 'transformation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save to database
      const { data, error } = await this.supabase
        .from('expounding_content')
        .insert(expoundingContent)
        .select()
        .single();

      if (error) {
        console.error('[ExpoundingService] Error saving expounding content:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[ExpoundingService] Error generating expounding content:', error);
      return null;
    }
  }

  /**
   * Generate AI-powered expounding content
   */
  private async generateContentWithAI(actionStep: any, subtask: any): Promise<any> {
    // For beta launch, use template-based content
    // In production, integrate with OpenAI or similar service
    
    const templates = {
      prayer: {
        deeper_insights: "Prayer is not just communication with God, but a transformative practice that aligns our hearts with His will. Through consistent prayer, we develop spiritual sensitivity and learn to discern God's voice in our daily lives.",
        practical_steps: [
          "Set aside a specific time each day for prayer",
          "Create a quiet, dedicated space for prayer",
          "Use a prayer journal to track requests and answers",
          "Practice different types of prayer (praise, confession, thanksgiving, supplication)"
        ],
        reflection_questions: [
          "How has God been speaking to you lately?",
          "What areas of your life need God's guidance?",
          "How can you make prayer a more consistent part of your routine?"
        ],
        biblical_context: "Jesus modeled consistent prayer throughout His ministry (Luke 5:16, Mark 1:35). The early church devoted themselves to prayer (Acts 2:42), showing its central importance in Christian life.",
        common_challenges: [
          "Feeling like prayers aren't being answered",
          "Struggling with consistency in prayer time",
          "Not knowing what to pray about",
          "Feeling distracted during prayer"
        ],
        encouragement: "Remember that prayer is a relationship, not a performance. God delights in hearing from you, whether your prayers are eloquent or simple. Every moment spent in prayer deepens your connection with Him."
      },
      bible_study: {
        deeper_insights: "Bible study is more than reading; it's engaging with God's living Word to transform our minds and hearts. Through careful study, we discover God's character, His promises, and His plan for our lives.",
        practical_steps: [
          "Choose a consistent time and place for study",
          "Use a study Bible with helpful notes and commentary",
          "Ask questions: What does this teach about God? About humanity? About living faithfully?",
          "Apply what you learn to your current circumstances"
        ],
        reflection_questions: [
          "What is God teaching you through His Word right now?",
          "How can you apply today's reading to your life?",
          "What questions do you have about what you've read?"
        ],
        biblical_context: "The Bereans were commended for examining the Scriptures daily (Acts 17:11). Timothy was reminded that Scripture is profitable for teaching, reproof, correction, and training in righteousness (2 Timothy 3:16-17).",
        common_challenges: [
          "Finding time for consistent study",
          "Understanding difficult passages",
          "Staying focused while reading",
          "Knowing where to start"
        ],
        encouragement: "God's Word is a lamp to your feet and a light to your path (Psalm 119:105). Every time you open Scripture, you're positioning yourself to hear from God and grow in wisdom."
      }
    };

    // Determine content type based on action step and subtask
    const contentType = this.determineContentType(actionStep, subtask);
    const template = templates[contentType] || templates.prayer;

    // Customize template based on specific content
    return {
      deeper_insights: template.deeper_insights,
      practical_steps: template.practical_steps,
      reflection_questions: template.reflection_questions,
      biblical_context: template.biblical_context,
      common_challenges: template.common_challenges,
      encouragement: template.encouragement,
    };
  }

  /**
   * Determine content type for appropriate template
   */
  private determineContentType(actionStep: any, subtask: any): string {
    const text = `${actionStep.title} ${actionStep.description} ${subtask.text}`.toLowerCase();
    
    if (text.includes('pray') || text.includes('prayer')) {
      return 'prayer';
    }
    
    if (text.includes('bible') || text.includes('scripture') || text.includes('read')) {
      return 'bible_study';
    }
    
    // Default to prayer template
    return 'prayer';
  }

  /**
   * Get all expounding content for a playbook
   */
  async getPlaybookExpoundingContent(playbookId: string): Promise<ExpoundingContent[]> {
    try {
      const { data, error } = await this.supabase
        .from('expounding_content')
        .select(`
          *,
          action_steps!inner(playbook_id)
        `)
        .eq('action_steps.playbook_id', playbookId);

      if (error) {
        console.error('[ExpoundingService] Error fetching playbook expounding content:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[ExpoundingService] Error in getPlaybookExpoundingContent:', error);
      return [];
    }
  }

  /**
   * Delete expounding content
   */
  async deleteExpoundingContent(contentId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('expounding_content')
        .delete()
        .eq('id', contentId);

      if (error) {
        console.error('[ExpoundingService] Error deleting expounding content:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ExpoundingService] Error in deleteExpoundingContent:', error);
      return false;
    }
  }

  /**
   * Update expounding content
   */
  async updateExpoundingContent(contentId: string, updates: Partial<ExpoundingContent>): Promise<ExpoundingContent | null> {
    try {
      const { data, error } = await this.supabase
        .from('expounding_content')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contentId)
        .select()
        .single();

      if (error) {
        console.error('[ExpoundingService] Error updating expounding content:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[ExpoundingService] Error in updateExpoundingContent:', error);
      return null;
    }
  }
}

// Export singleton instance
export const expoundingService = new ExpoundingService();
