/**
 * Enhanced Generation Service V2
 * Context-aware, intelligent content generation with queue integration
 * NO UI changes - pure backend intelligence enhancement
 */

import { supabase } from './supabaseClient';
import { userContextEngine } from './userContextEngine';
import { enhancedQueueService } from './enhancedQueueService';
import { faithPointsService } from './faithPointsService';

export interface GenerationRequest {
  userId: string;
  userName: string;
  userInput: string;
  type: 'playbook' | 'devotional' | 'journal_expansion';
  subscriptionTier: string;
  additionalContext?: any;
}

export interface GenerationResult {
  success: boolean;
  queueId?: string;
  content?: string;
  estimatedWaitTime?: number;
  error?: string;
  intelligenceLevel?: string;
  contextConfidence?: number;
}

export interface PlaybookStructure {
  title: string;
  truthInLove: {
    content: string;
    scriptureReferences: string[];
  };
  bibleVerse: {
    verse: string;
    reference: string;
    application: string;
  };
  directChallenge: {
    content: string;
    callToAction: string;
  };
  actionSteps: Array<{
    text: string;
    examples?: string;
    subTasks?: Array<{
      text: string;
      detectedJournalType?: string;
      isExample?: boolean;
    }>;
  }>;
  affirmations: string[];
}

export interface DevotionalStructure {
  title: string;
  totalDays: number;
  category: string;
  days: Array<{
    dayNumber: number;
    title: string;
    content: string;
    bibleVerse: {
      verse: string;
      reference: string;
    };
    reflectionQuestions: string[];
    prayer: string;
    actionPoint: string;
  }>;
}

export class EnhancedGenerationServiceV2 {

  // Intelligence levels by subscription tier
  private readonly INTELLIGENCE_LEVELS = {
    'family': 'advanced',
    'transformation': 'enhanced',
    'growth': 'enhanced',
    'spark': 'basic',
    'free_trial': 'basic',
  };

  // Context weight by tier (how much context influences generation)
  private readonly CONTEXT_WEIGHTS = {
    'family': 0.9,        // 90% context influence
    'transformation': 0.8, // 80% context influence
    'growth': 0.7,        // 70% context influence
    'spark': 0.5,       // 50% context influence
    'free_trial': 0.3,     // 30% context influence
  };

  /**
   * Generate playbook with enhanced intelligence
   */
  async generatePlaybook(request: GenerationRequest): Promise<GenerationResult> {
    try {
      console.log(`[EnhancedGenerationV2] Generating playbook for user ${request.userId}`);

      // Check if immediate generation is possible (high tier users)
      const canGenerateImmediately = await this.canGenerateImmediately(request);

      if (canGenerateImmediately) {
        return await this.generateImmediatePlaybook(request);
      } else {
        return await this.queuePlaybookGeneration(request);
      }

    } catch (error) {
      console.error('[EnhancedGenerationV2] Error generating playbook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      };
    }
  }

  /**
   * Generate devotional with enhanced intelligence
   */
  async generateDevotional(request: GenerationRequest): Promise<GenerationResult> {
    try {
      console.log(`[EnhancedGenerationV2] Generating devotional for user ${request.userId}`);

      const canGenerateImmediately = await this.canGenerateImmediately(request);

      if (canGenerateImmediately) {
        return await this.generateImmediateDevotional(request);
      } else {
        return await this.queueDevotionalGeneration(request);
      }

    } catch (error) {
      console.error('[EnhancedGenerationV2] Error generating devotional:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      };
    }
  }

  /**
   * Expand journal entry with intelligent insights
   */
  async expandJournalEntry(request: GenerationRequest): Promise<GenerationResult> {
    try {
      console.log(`[EnhancedGenerationV2] Expanding journal entry for user ${request.userId}`);

      // Journal expansion is always immediate (lighter processing)
      return await this.generateImmediateJournalExpansion(request);

    } catch (error) {
      console.error('[EnhancedGenerationV2] Error expanding journal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Expansion failed',
      };
    }
  }

  /**
   * Check if user can generate immediately (based on tier and load)
   */
  private async canGenerateImmediately(request: GenerationRequest): Promise<boolean> {
    try {
      // High tier users get immediate generation
      if (['family', 'transformation'].includes(request.subscriptionTier)) {
        return true;
      }

      // Check current queue load
      const queueStatus = await enhancedQueueService.getQueueStatus(request.userId);

      // If queue is light, allow immediate generation
      if (queueStatus.totalInQueue < 10) {
        return true;
      }

      return false;

    } catch (error) {
      console.error('[EnhancedGenerationV2] Error checking immediate generation:', error);
      return false;
    }
  }

  /**
   * Generate playbook immediately with context
   */
  private async generateImmediatePlaybook(request: GenerationRequest): Promise<GenerationResult> {
    try {
      const startTime = Date.now();

      // Build enhanced user context
      const context = await userContextEngine.buildUserContext(
        request.userId,
        request.userName,
        request.userInput,
        'playbook'
      );

      // Get intelligence level
      const intelligenceLevel = this.INTELLIGENCE_LEVELS[request.subscriptionTier as keyof typeof this.INTELLIGENCE_LEVELS];
      const contextWeight = this.CONTEXT_WEIGHTS[request.subscriptionTier as keyof typeof this.CONTEXT_WEIGHTS];

      // Generate contextual prompt
      const basePrompt = this.getPlaybookPrompt(intelligenceLevel);
      const contextualPrompt = await userContextEngine.generateContextualPrompt(basePrompt, context);

      // Apply context weight
      const finalPrompt = this.applyContextWeight(contextualPrompt.enhancedPrompt, contextWeight);

      // Generate content (placeholder for actual OpenAI call)
      const generatedContent = await this.callOpenAIForPlaybook(finalPrompt, intelligenceLevel);

      // Parse and structure the content
      const structuredPlaybook = await this.parsePlaybookContent(generatedContent);

      // Store in database
      await this.storeGeneratedPlaybook(request, structuredPlaybook, context, Date.now() - startTime);

      // Award faith points
      await faithPointsService.awardPoints(
        request.userId,
        'playbook_generated',
        {
          intelligenceLevel,
          contextConfidence: context.confidenceScore,
          generationTime: Date.now() - startTime,
        }
      );

      console.log(`[EnhancedGenerationV2] Playbook generated immediately in ${Date.now() - startTime}ms`);

      return {
        success: true,
        content: JSON.stringify(structuredPlaybook),
        intelligenceLevel,
        contextConfidence: context.confidenceScore,
      };

    } catch (error) {
      console.error('[EnhancedGenerationV2] Error in immediate playbook generation:', error);
      throw error;
    }
  }

  /**
   * Generate devotional immediately with context
   */
  private async generateImmediateDevotional(request: GenerationRequest): Promise<GenerationResult> {
    try {
      const startTime = Date.now();

      // Build enhanced user context
      const context = await userContextEngine.buildUserContext(
        request.userId,
        request.userName,
        request.userInput,
        'devotional'
      );

      // Get intelligence level
      const intelligenceLevel = this.INTELLIGENCE_LEVELS[request.subscriptionTier as keyof typeof this.INTELLIGENCE_LEVELS];
      const contextWeight = this.CONTEXT_WEIGHTS[request.subscriptionTier as keyof typeof this.CONTEXT_WEIGHTS];

      // Generate contextual prompt
      const basePrompt = this.getDevotionalPrompt(intelligenceLevel);
      const contextualPrompt = await userContextEngine.generateContextualPrompt(basePrompt, context);

      // Apply context weight
      const finalPrompt = this.applyContextWeight(contextualPrompt.enhancedPrompt, contextWeight);

      // Generate content
      const generatedContent = await this.callOpenAIForDevotional(finalPrompt, intelligenceLevel);

      // Parse and structure the content
      const structuredDevotional = await this.parseDevotionalContent(generatedContent);

      // Store in database
      await this.storeGeneratedDevotional(request, structuredDevotional, context, Date.now() - startTime);

      // Award faith points
      await faithPointsService.awardPoints(
        request.userId,
        'devotional_generated',
        {
          intelligenceLevel,
          contextConfidence: context.confidenceScore,
          generationTime: Date.now() - startTime,
        }
      );

      console.log(`[EnhancedGenerationV2] Devotional generated immediately in ${Date.now() - startTime}ms`);

      return {
        success: true,
        content: JSON.stringify(structuredDevotional),
        intelligenceLevel,
        contextConfidence: context.confidenceScore,
      };

    } catch (error) {
      console.error('[EnhancedGenerationV2] Error in immediate devotional generation:', error);
      throw error;
    }
  }

  /**
   * Generate journal expansion immediately
   */
  private async generateImmediateJournalExpansion(request: GenerationRequest): Promise<GenerationResult> {
    try {
      const startTime = Date.now();

      // Build context for journal expansion
      const context = await userContextEngine.buildUserContext(
        request.userId,
        request.userName,
        request.userInput,
        'journal_expansion'
      );

      // Generate expansion prompt
      const expansionPrompt = this.getJournalExpansionPrompt(request.userInput, context);

      // Generate expansion
      const expansion = await this.callOpenAIForJournalExpansion(expansionPrompt);

      // Store expansion
      await this.storeJournalExpansion(request, expansion, context, Date.now() - startTime);

      // Award faith points
      await faithPointsService.awardPoints(
        request.userId,
        'journal_entry',
        {
          contextConfidence: context.confidenceScore,
          generationTime: Date.now() - startTime,
        }
      );

      console.log(`[EnhancedGenerationV2] Journal expansion generated in ${Date.now() - startTime}ms`);

      return {
        success: true,
        content: expansion,
        contextConfidence: context.confidenceScore,
      };

    } catch (error) {
      console.error('[EnhancedGenerationV2] Error in journal expansion:', error);
      throw error;
    }
  }

  /**
   * Queue playbook generation
   */
  private async queuePlaybookGeneration(request: GenerationRequest): Promise<GenerationResult> {
    try {
      const queueId = await enhancedQueueService.addToQueue(
        request.userId,
        'playbook',
        request.userInput,
        request.userName,
        request.subscriptionTier
      );

      const queueStatus = await enhancedQueueService.getQueueStatus(request.userId);

      return {
        success: true,
        queueId,
        estimatedWaitTime: queueStatus.estimatedWaitTime,
      };

    } catch (error) {
      console.error('[EnhancedGenerationV2] Error queueing playbook:', error);
      throw error;
    }
  }

  /**
   * Queue devotional generation
   */
  private async queueDevotionalGeneration(request: GenerationRequest): Promise<GenerationResult> {
    try {
      const queueId = await enhancedQueueService.addToQueue(
        request.userId,
        'devotional',
        request.userInput,
        request.userName,
        request.subscriptionTier
      );

      const queueStatus = await enhancedQueueService.getQueueStatus(request.userId);

      return {
        success: true,
        queueId,
        estimatedWaitTime: queueStatus.estimatedWaitTime,
      };

    } catch (error) {
      console.error('[EnhancedGenerationV2] Error queueing devotional:', error);
      throw error;
    }
  }

  /**
   * Helper methods for prompts and content processing
   */
  private getPlaybookPrompt(intelligenceLevel: string): string {
    const prompts = {
      basic: 'Create a simple spiritual growth playbook with clear action steps.',
      enhanced: 'Create a comprehensive spiritual growth playbook with detailed guidance, scripture references, and practical applications.',
      advanced: 'Create an advanced spiritual growth playbook with deep theological insights, personalized guidance, multiple scripture references, and sophisticated action planning.',
    };

    return prompts[intelligenceLevel as keyof typeof prompts] || prompts.basic;
  }

  private getDevotionalPrompt(intelligenceLevel: string): string {
    const prompts = {
      basic: 'Create a simple devotional with daily readings and basic reflection questions.',
      enhanced: 'Create a comprehensive devotional with rich content, thoughtful reflection questions, and practical applications.',
      advanced: 'Create an advanced devotional with deep spiritual insights, sophisticated reflection questions, cross-references, and personalized spiritual guidance.',
    };

    return prompts[intelligenceLevel as keyof typeof prompts] || prompts.basic;
  }

  private getJournalExpansionPrompt(userInput: string, context: any): string {
    return `Expand on this journal entry with spiritual insights and guidance: "${userInput}". 
    Consider the user's spiritual journey and provide thoughtful reflection questions and encouragement.
    Context confidence: ${context.confidenceScore}%`;
  }

  private applyContextWeight(prompt: string, weight: number): string {
    // Apply context weight to influence how much personal context affects the prompt
    if (weight > 0.8) {
      return `[HIGH PERSONALIZATION] ${prompt}`;
    } else if (weight > 0.6) {
      return `[MEDIUM PERSONALIZATION] ${prompt}`;
    } else {
      return `[BASIC PERSONALIZATION] ${prompt}`;
    }
  }

  /**
   * Placeholder methods for actual OpenAI integration
   */
  private async callOpenAIForPlaybook(prompt: string, intelligenceLevel: string): Promise<string> {
    // Placeholder for actual OpenAI API call
    await this.sleep(2000 + Math.random() * 3000);
    return `Generated playbook content for prompt: ${prompt.substring(0, 100)}... (Intelligence: ${intelligenceLevel})`;
  }

  private async callOpenAIForDevotional(prompt: string, intelligenceLevel: string): Promise<string> {
    // Placeholder for actual OpenAI API call
    await this.sleep(3000 + Math.random() * 4000);
    return `Generated devotional content for prompt: ${prompt.substring(0, 100)}... (Intelligence: ${intelligenceLevel})`;
  }

  private async callOpenAIForJournalExpansion(prompt: string): Promise<string> {
    // Placeholder for actual OpenAI API call
    await this.sleep(1000 + Math.random() * 2000);
    return `Expanded journal insight: ${prompt.substring(0, 100)}...`;
  }

  /**
   * Content parsing and structuring methods
   */
  private async parsePlaybookContent(_content: string): Promise<PlaybookStructure> {
    // Placeholder for actual content parsing
    return {
      title: 'Generated Spiritual Growth Playbook',
      truthInLove: {
        content: 'Truth in love content...',
        scriptureReferences: ['Romans 8:28', 'Philippians 4:13'],
      },
      bibleVerse: {
        verse: 'For I know the plans I have for you...',
        reference: 'Jeremiah 29:11',
        application: 'Application of this verse...',
      },
      directChallenge: {
        content: 'Challenge content...',
        callToAction: 'Take action by...',
      },
      actionSteps: [
        {
          text: 'First action step',
          examples: 'Example: ...',
          subTasks: [
            { text: 'Sub-task 1', detectedJournalType: 'reflection' },
            { text: 'Sub-task 2', detectedJournalType: 'prayer' },
          ],
        },
      ],
      affirmations: ['I am loved by God', 'I am growing in faith'],
    };
  }

  private async parseDevotionalContent(_content: string): Promise<DevotionalStructure> {
    // Placeholder for actual content parsing
    return {
      title: 'Generated Devotional',
      totalDays: 7,
      category: 'Growth',
      days: [
        {
          dayNumber: 1,
          title: 'Day 1: Beginning',
          content: 'Devotional content for day 1...',
          bibleVerse: {
            verse: 'In the beginning was the Word...',
            reference: 'John 1:1',
          },
          reflectionQuestions: ['How does this apply to your life?'],
          prayer: 'Prayer for today...',
          actionPoint: 'Action to take today...',
        },
      ],
    };
  }

  /**
   * Storage methods
   */
  private async storeGeneratedPlaybook(
    request: GenerationRequest,
    playbook: PlaybookStructure,
    context: any,
    generationTime: number
  ): Promise<void> {
    try {
      await supabase
        .from('generated_content')
        .insert({
          user_id: request.userId,
          content_type: 'playbook',
          title: playbook.title,
          content: JSON.stringify(playbook),
          user_input: request.userInput,
          metadata: {
            context_confidence: context.confidenceScore,
            intelligence_level: this.INTELLIGENCE_LEVELS[request.subscriptionTier as keyof typeof this.INTELLIGENCE_LEVELS],
          },
          generation_time_ms: generationTime,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[EnhancedGenerationV2] Error storing playbook:', error);
    }
  }

  private async storeGeneratedDevotional(
    request: GenerationRequest,
    devotional: DevotionalStructure,
    context: any,
    generationTime: number
  ): Promise<void> {
    try {
      await supabase
        .from('generated_content')
        .insert({
          user_id: request.userId,
          content_type: 'devotional',
          title: devotional.title,
          content: JSON.stringify(devotional),
          user_input: request.userInput,
          metadata: {
            context_confidence: context.confidenceScore,
            intelligence_level: this.INTELLIGENCE_LEVELS[request.subscriptionTier as keyof typeof this.INTELLIGENCE_LEVELS],
          },
          generation_time_ms: generationTime,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[EnhancedGenerationV2] Error storing devotional:', error);
    }
  }

  private async storeJournalExpansion(
    request: GenerationRequest,
    expansion: string,
    context: any,
    generationTime: number
  ): Promise<void> {
    try {
      await supabase
        .from('generated_content')
        .insert({
          user_id: request.userId,
          content_type: 'journal_expansion',
          title: 'Journal Expansion',
          content: expansion,
          user_input: request.userInput,
          metadata: {
            context_confidence: context.confidenceScore,
          },
          generation_time_ms: generationTime,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[EnhancedGenerationV2] Error storing journal expansion:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const enhancedGenerationServiceV2 = new EnhancedGenerationServiceV2();
