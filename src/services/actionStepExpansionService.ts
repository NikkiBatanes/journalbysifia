/**
 * Action Step Expansion Service
 * Intelligent expansion of playbook action steps with context-aware sub-tasks
 * NO UI changes - pure backend intelligence enhancement
 */

import { supabase } from './supabaseClient';
import { userContextEngine } from './userContextEngine';
import { smartJournalDetectionV2 } from './smartJournalDetectionV2';
import { faithPointsService } from './faithPointsService';

export interface ActionStepExpansionRequest {
  userId: string;
  userName: string;
  actionStepId: string;
  actionStepText: string;
  playbookContext?: any;
  subscriptionTier: string;
}

export interface ExpandedSubTask {
  text: string;
  detectedJournalType?: string;
  isExample: boolean;
  exampleInteractive: boolean;
  orderIndex: number;
  intelligentPrompts?: string[];
  contextualGuidance?: string;
  estimatedTimeMinutes?: number;
  difficultyLevel?: 'easy' | 'medium' | 'challenging';
  spiritualFocus?: string;
}

export interface ExpansionResult {
  success: boolean;
  subTasks: ExpandedSubTask[];
  expansionQuality: number;
  intelligenceLevel: string;
  contextConfidence: number;
  totalEstimatedTime: number;
  error?: string;
}

export interface ExpansionAnalysis {
  actionType: string;
  complexityLevel: number;
  spiritualDomains: string[];
  recommendedSubTaskCount: number;
  suggestedTimeframe: string;
  prerequisites: string[];
}

export class ActionStepExpansionService {
  
  // Action step categorization patterns
  private readonly ACTION_PATTERNS = {
    prayer: {
      keywords: ['pray', 'prayer', 'intercede', 'worship', 'commune', 'seek god'],
      subTaskTypes: ['prayer_planning', 'prayer_practice', 'prayer_reflection'],
      avgSubTasks: 4,
      timePerTask: 15
    },
    scripture_study: {
      keywords: ['read', 'study', 'bible', 'scripture', 'verse', 'meditate', 'memorize'],
      subTaskTypes: ['scripture_selection', 'study_method', 'application', 'memorization'],
      avgSubTasks: 5,
      timePerTask: 20
    },
    relationship: {
      keywords: ['relationship', 'friend', 'family', 'spouse', 'community', 'forgive', 'reconcile'],
      subTaskTypes: ['reflection', 'planning', 'conversation', 'follow_up'],
      avgSubTasks: 4,
      timePerTask: 25
    },
    service: {
      keywords: ['serve', 'help', 'volunteer', 'ministry', 'give', 'support', 'assist'],
      subTaskTypes: ['planning', 'preparation', 'action', 'reflection'],
      avgSubTasks: 5,
      timePerTask: 30
    },
    personal_growth: {
      keywords: ['grow', 'develop', 'improve', 'change', 'habit', 'discipline', 'character'],
      subTaskTypes: ['assessment', 'goal_setting', 'practice', 'accountability'],
      avgSubTasks: 6,
      timePerTask: 20
    },
    financial: {
      keywords: ['money', 'budget', 'tithe', 'giving', 'stewardship', 'financial', 'resource'],
      subTaskTypes: ['assessment', 'planning', 'implementation', 'tracking'],
      avgSubTasks: 4,
      timePerTask: 30
    },
    communication: {
      keywords: ['talk', 'discuss', 'share', 'communicate', 'express', 'listen'],
      subTaskTypes: ['preparation', 'conversation', 'follow_up', 'reflection'],
      avgSubTasks: 4,
      timePerTask: 20
    },
    spiritual_discipline: {
      keywords: ['discipline', 'practice', 'routine', 'habit', 'spiritual', 'devotion'],
      subTaskTypes: ['planning', 'implementation', 'tracking', 'adjustment'],
      avgSubTasks: 5,
      timePerTask: 25
    }
  };

  // Intelligence levels by subscription tier
  private readonly INTELLIGENCE_LEVELS = {
    'family': 'advanced',
    'transformation': 'enhanced',
    'growth': 'enhanced', 
    'starter': 'basic',
    'free_trial': 'basic'
  };

  // Sub-task complexity by intelligence level
  private readonly COMPLEXITY_LEVELS = {
    advanced: {
      maxSubTasks: 8,
      detailLevel: 'comprehensive',
      includeExamples: true,
      includeInteractive: true,
      contextWeight: 0.9
    },
    enhanced: {
      maxSubTasks: 6,
      detailLevel: 'detailed',
      includeExamples: true,
      includeInteractive: false,
      contextWeight: 0.7
    },
    basic: {
      maxSubTasks: 4,
      detailLevel: 'simple',
      includeExamples: false,
      includeInteractive: false,
      contextWeight: 0.4
    }
  };

  /**
   * Expand action step into intelligent sub-tasks
   */
  async expandActionStep(request: ActionStepExpansionRequest): Promise<ExpansionResult> {
    try {
      console.log(`[ActionStepExpansion] Expanding action step for user ${request.userId}`);
      
      // Get user context for personalized expansion
      const userContext = await userContextEngine.buildUserContext(
        request.userId,
        request.userName,
        request.actionStepText,
        'action_expansion'
      );
      
      // Analyze the action step
      const analysis = await this.analyzeActionStep(request.actionStepText, userContext);
      
      // Get intelligence level
      const intelligenceLevel = this.INTELLIGENCE_LEVELS[request.subscriptionTier as keyof typeof this.INTELLIGENCE_LEVELS];
      const complexityConfig = this.COMPLEXITY_LEVELS[intelligenceLevel as keyof typeof this.COMPLEXITY_LEVELS];
      
      // Generate sub-tasks
      const subTasks = await this.generateIntelligentSubTasks(
        request,
        analysis,
        userContext,
        complexityConfig
      );
      
      // Enhance sub-tasks with journal detection
      const enhancedSubTasks = await this.enhanceWithJournalDetection(subTasks, request.userId);
      
      // Calculate quality metrics
      const expansionQuality = this.calculateExpansionQuality(enhancedSubTasks, analysis, userContext);
      const totalEstimatedTime = enhancedSubTasks.reduce((sum, task) => sum + (task.estimatedTimeMinutes || 0), 0);
      
      // Store expansion in database
      await this.storeExpansion(request, enhancedSubTasks, analysis, userContext);
      
      // Award faith points
      await faithPointsService.awardPoints(
        request.userId,
        'action_step_expanded',
        { 
          subTaskCount: enhancedSubTasks.length,
          expansionQuality,
          intelligenceLevel
        }
      );
      
      console.log(`[ActionStepExpansion] Generated ${enhancedSubTasks.length} sub-tasks with ${expansionQuality}% quality`);
      
      return {
        success: true,
        subTasks: enhancedSubTasks,
        expansionQuality,
        intelligenceLevel,
        contextConfidence: userContext.confidenceScore,
        totalEstimatedTime
      };
      
    } catch (error) {
      console.error('[ActionStepExpansion] Error expanding action step:', error);
      return {
        success: false,
        subTasks: [],
        expansionQuality: 0,
        intelligenceLevel: 'basic',
        contextConfidence: 0,
        totalEstimatedTime: 0,
        error: error instanceof Error ? error.message : 'Expansion failed'
      };
    }
  }

  /**
   * Analyze action step to understand its nature and requirements
   */
  private async analyzeActionStep(actionText: string, userContext: any): Promise<ExpansionAnalysis> {
    const actionLower = actionText.toLowerCase();
    
    // Determine action type
    let actionType = 'general';
    let maxScore = 0;
    
    for (const [type, patterns] of Object.entries(this.ACTION_PATTERNS)) {
      let score = 0;
      for (const keyword of patterns.keywords) {
        if (actionLower.includes(keyword)) {
          score += 1;
        }
      }
      
      if (score > maxScore) {
        maxScore = score;
        actionType = type;
      }
    }
    
    // Determine complexity level (1-5)
    const complexityLevel = this.determineComplexityLevel(actionText);
    
    // Identify spiritual domains
    const spiritualDomains = this.identifySpiritualDomains(actionText);
    
    // Calculate recommended sub-task count
    const baseCount = this.ACTION_PATTERNS[actionType as keyof typeof this.ACTION_PATTERNS]?.avgSubTasks || 4;
    const recommendedSubTaskCount = Math.min(baseCount + Math.floor(complexityLevel / 2), 8);
    
    // Suggest timeframe
    const suggestedTimeframe = this.suggestTimeframe(actionType, complexityLevel);
    
    // Identify prerequisites
    const prerequisites = this.identifyPrerequisites(actionText, userContext);
    
    return {
      actionType,
      complexityLevel,
      spiritualDomains,
      recommendedSubTaskCount,
      suggestedTimeframe,
      prerequisites
    };
  }

  /**
   * Generate intelligent sub-tasks based on analysis
   */
  private async generateIntelligentSubTasks(
    request: ActionStepExpansionRequest,
    analysis: ExpansionAnalysis,
    userContext: any,
    complexityConfig: any
  ): Promise<ExpandedSubTask[]> {
    
    const subTasks: ExpandedSubTask[] = [];
    const actionPattern = this.ACTION_PATTERNS[analysis.actionType as keyof typeof this.ACTION_PATTERNS];
    
    if (!actionPattern) {
      // Generate generic sub-tasks
      return this.generateGenericSubTasks(request.actionStepText, analysis, complexityConfig);
    }
    
    // Generate type-specific sub-tasks
    const subTaskCount = Math.min(analysis.recommendedSubTaskCount, complexityConfig.maxSubTasks);
    
    for (let i = 0; i < subTaskCount; i++) {
      const subTaskType = actionPattern.subTaskTypes[i % actionPattern.subTaskTypes.length];
      const subTask = await this.generateSpecificSubTask(
        request.actionStepText,
        subTaskType,
        analysis,
        userContext,
        complexityConfig,
        i
      );
      
      subTasks.push(subTask);
    }
    
    // Add examples if enabled
    if (complexityConfig.includeExamples && subTasks.length > 0) {
      const exampleTask = await this.generateExampleSubTask(
        request.actionStepText,
        analysis,
        subTasks.length
      );
      subTasks.push(exampleTask);
    }
    
    return subTasks;
  }

  /**
   * Generate specific sub-task based on type
   */
  private async generateSpecificSubTask(
    actionText: string,
    subTaskType: string,
    analysis: ExpansionAnalysis,
    userContext: any,
    complexityConfig: any,
    orderIndex: number
  ): Promise<ExpandedSubTask> {
    
    const subTaskTemplates: { [key: string]: { [key: string]: string } } = {
      prayer_planning: {
        basic: 'Plan your prayer time and topics',
        detailed: 'Create a structured prayer plan with specific topics and timing',
        comprehensive: 'Develop a comprehensive prayer strategy including preparation, focus areas, and follow-up reflection'
      },
      prayer_practice: {
        basic: 'Spend time in prayer',
        detailed: 'Engage in focused prayer using your planned approach',
        comprehensive: 'Practice intentional prayer incorporating various methods (adoration, confession, thanksgiving, supplication)'
      },
      scripture_selection: {
        basic: 'Choose relevant Bible verses',
        detailed: 'Select specific scriptures that relate to your situation',
        comprehensive: 'Research and select multiple scripture passages with cross-references and commentary insights'
      },
      reflection: {
        basic: 'Reflect on your thoughts and feelings',
        detailed: 'Take time to deeply consider your emotions and motivations',
        comprehensive: 'Engage in thorough self-examination using guided reflection questions and journaling'
      },
      planning: {
        basic: 'Make a plan for action',
        detailed: 'Create a detailed plan with specific steps and timeline',
        comprehensive: 'Develop a comprehensive action plan with contingencies, resources, and accountability measures'
      },
      assessment: {
        basic: 'Evaluate your current situation',
        detailed: 'Conduct a thorough assessment of your current state and needs',
        comprehensive: 'Perform a comprehensive evaluation using multiple assessment tools and perspectives'
      }
    };
    
    const template = subTaskTemplates[subTaskType] || subTaskTemplates.reflection;
    const text = template[complexityConfig.detailLevel] || template.basic;
    
    // Personalize based on context
    const personalizedText = this.personalizeSubTaskText(text, userContext, complexityConfig.contextWeight);
    
    return {
      text: personalizedText,
      isExample: false,
      exampleInteractive: false,
      orderIndex,
      estimatedTimeMinutes: this.estimateSubTaskTime(subTaskType, complexityConfig.detailLevel),
      difficultyLevel: this.determineDifficulty(subTaskType, analysis.complexityLevel),
      spiritualFocus: this.getSubTaskSpiritualFocus(subTaskType, analysis.spiritualDomains)
    };
  }

  /**
   * Generate example sub-task
   */
  private async generateExampleSubTask(
    actionText: string,
    analysis: ExpansionAnalysis,
    orderIndex: number
  ): Promise<ExpandedSubTask> {
    
    const examples: { [key: string]: string } = {
      prayer: 'Example: Set aside 15 minutes each morning to pray about specific concerns',
      scripture_study: 'Example: Read Philippians 4:6-7 and write down three ways to apply it',
      relationship: 'Example: Schedule a coffee meeting to have an honest conversation',
      service: 'Example: Volunteer at a local food bank for 2 hours this weekend',
      personal_growth: 'Example: Practice gratitude by writing down 3 things you\'re thankful for daily',
      financial: 'Example: Review your budget and identify one area to increase giving',
      communication: 'Example: Write a heartfelt letter expressing your feelings',
      spiritual_discipline: 'Example: Commit to 10 minutes of morning devotions for one week'
    };
    
    const exampleText = examples[analysis.actionType] || 'Example: Take one small step toward your goal today';
    
    return {
      text: exampleText,
      isExample: true,
      exampleInteractive: false,
      orderIndex,
      estimatedTimeMinutes: 10,
      difficultyLevel: 'easy',
      spiritualFocus: analysis.spiritualDomains[0] || 'general'
    };
  }

  /**
   * Generate generic sub-tasks for unknown action types
   */
  private generateGenericSubTasks(
    actionText: string,
    analysis: ExpansionAnalysis,
    complexityConfig: any
  ): ExpandedSubTask[] {
    
    const genericSteps = [
      'Prepare for this action through prayer and reflection',
      'Take the first concrete step toward your goal',
      'Continue with consistent daily progress',
      'Reflect on your progress and adjust as needed'
    ];
    
    return genericSteps.slice(0, complexityConfig.maxSubTasks).map((text, index) => ({
      text,
      isExample: false,
      exampleInteractive: false,
      orderIndex: index,
      estimatedTimeMinutes: 20,
      difficultyLevel: 'medium' as const,
      spiritualFocus: 'general'
    }));
  }

  /**
   * Enhance sub-tasks with journal detection
   */
  private async enhanceWithJournalDetection(
    subTasks: ExpandedSubTask[],
    userId: string
  ): Promise<ExpandedSubTask[]> {
    
    const enhancedSubTasks = [];
    
    for (const subTask of subTasks) {
      try {
        // Detect journal type for this sub-task
        const detection = await smartJournalDetectionV2.detectJournalType(userId, subTask.text);
        
        const enhancedSubTask: ExpandedSubTask = {
          ...subTask,
          detectedJournalType: detection.detectedType,
          intelligentPrompts: detection.intelligentPrompts,
          contextualGuidance: detection.contextualGuidance
        };
        
        enhancedSubTasks.push(enhancedSubTask);
        
      } catch (error) {
        console.error('[ActionStepExpansion] Error detecting journal type:', error);
        enhancedSubTasks.push(subTask);
      }
    }
    
    return enhancedSubTasks;
  }

  /**
   * Helper methods
   */
  private determineComplexityLevel(actionText: string): number {
    const complexityIndicators = {
      simple: ['simple', 'easy', 'quick', 'basic'],
      moderate: ['plan', 'organize', 'develop', 'create'],
      complex: ['comprehensive', 'detailed', 'thorough', 'deep'],
      advanced: ['strategic', 'systematic', 'intensive', 'transformational']
    };
    
    const actionLower = actionText.toLowerCase();
    
    if (complexityIndicators.advanced.some(word => actionLower.includes(word))) return 5;
    if (complexityIndicators.complex.some(word => actionLower.includes(word))) return 4;
    if (complexityIndicators.moderate.some(word => actionLower.includes(word))) return 3;
    if (complexityIndicators.simple.some(word => actionLower.includes(word))) return 1;
    
    return 2; // Default moderate complexity
  }

  private identifySpiritualDomains(actionText: string): string[] {
    const domains: { [key: string]: string[] } = {
      prayer: ['pray', 'prayer', 'intercession', 'worship'],
      scripture: ['bible', 'scripture', 'word', 'verse'],
      fellowship: ['community', 'church', 'fellowship', 'group'],
      service: ['serve', 'ministry', 'volunteer', 'help'],
      stewardship: ['give', 'tithe', 'steward', 'resource'],
      discipleship: ['grow', 'mature', 'disciple', 'learn'],
      evangelism: ['share', 'witness', 'evangelize', 'testimony'],
      worship: ['worship', 'praise', 'adoration', 'honor']
    };
    
    const actionLower = actionText.toLowerCase();
    const identifiedDomains = [];
    
    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => actionLower.includes(keyword))) {
        identifiedDomains.push(domain);
      }
    }
    
    return identifiedDomains.length > 0 ? identifiedDomains : ['general'];
  }

  private suggestTimeframe(actionType: string, complexityLevel: number): string {
    const baseTimeframes: { [key: string]: string } = {
      prayer: 'daily',
      scripture_study: 'daily',
      relationship: 'within a week',
      service: 'this weekend',
      personal_growth: 'over 21 days',
      financial: 'this month',
      communication: 'within 3 days',
      spiritual_discipline: 'daily for 30 days'
    };
    
    const baseTimeframe = baseTimeframes[actionType] || 'this week';
    
    if (complexityLevel >= 4) {
      return `${baseTimeframe} (extended timeline recommended)`;
    }
    
    return baseTimeframe;
  }

  private identifyPrerequisites(actionText: string, userContext: any): string[] {
    const prerequisites = [];
    
    // Context-based prerequisites
    if (userContext.confidenceScore < 50) {
      prerequisites.push('Spend time in prayer for guidance');
    }
    
    // Action-based prerequisites
    if (actionText.toLowerCase().includes('forgive')) {
      prerequisites.push('Prepare your heart through prayer and scripture study');
    }
    
    if (actionText.toLowerCase().includes('confront') || actionText.toLowerCase().includes('difficult conversation')) {
      prerequisites.push('Seek wise counsel from a mentor or pastor');
    }
    
    return prerequisites;
  }

  private personalizeSubTaskText(text: string, userContext: any, contextWeight: number): string {
    if (contextWeight < 0.5 || userContext.confidenceScore < 60) {
      return text;
    }
    
    // Add personalization based on context
    const personalizations = [
      'Based on your spiritual journey, ',
      'Considering your current situation, ',
      'Given your recent experiences, '
    ];
    
    const personalization = personalizations[Math.floor(Math.random() * personalizations.length)];
    return `${personalization}${text.toLowerCase()}`;
  }

  private estimateSubTaskTime(subTaskType: string, detailLevel: string): number {
    const baseTimes: { [key: string]: number } = {
      prayer_planning: 15,
      prayer_practice: 20,
      scripture_selection: 10,
      scripture_study: 25,
      reflection: 15,
      planning: 20,
      assessment: 15,
      conversation: 30,
      implementation: 25,
      tracking: 10
    };
    
    const baseTime = baseTimes[subTaskType] || 15;
    
    const multipliers = {
      simple: 0.8,
      detailed: 1.2,
      comprehensive: 1.5
    };
    
    return Math.round(baseTime * (multipliers[detailLevel as keyof typeof multipliers] || 1));
  }

  private determineDifficulty(subTaskType: string, complexityLevel: number): 'easy' | 'medium' | 'challenging' {
    const difficultyMap: { [key: string]: 'easy' | 'medium' | 'challenging' } = {
      prayer_planning: 'easy',
      prayer_practice: 'medium',
      scripture_selection: 'easy',
      reflection: 'medium',
      planning: 'medium',
      assessment: 'challenging',
      conversation: 'challenging',
      implementation: 'medium'
    };
    
    const baseDifficulty = difficultyMap[subTaskType] || 'medium';
    
    if (complexityLevel >= 4 && baseDifficulty !== 'challenging') {
      return 'challenging';
    }
    
    return baseDifficulty;
  }

  private getSubTaskSpiritualFocus(subTaskType: string, spiritualDomains: string[]): string {
    const focusMap: { [key: string]: string } = {
      prayer_planning: 'prayer',
      prayer_practice: 'prayer',
      scripture_selection: 'scripture',
      scripture_study: 'scripture',
      reflection: 'discipleship',
      planning: 'stewardship',
      assessment: 'discipleship',
      conversation: 'fellowship',
      implementation: 'service'
    };
    
    return focusMap[subTaskType] || spiritualDomains[0] || 'general';
  }

  private calculateExpansionQuality(
    subTasks: ExpandedSubTask[],
    analysis: ExpansionAnalysis,
    userContext: any
  ): number {
    let quality = 70; // Base quality
    
    // Quality factors
    if (subTasks.length >= analysis.recommendedSubTaskCount) quality += 10;
    if (subTasks.every(task => task.detectedJournalType)) quality += 15;
    if (userContext.confidenceScore > 70) quality += 10;
    if (subTasks.some(task => task.intelligentPrompts?.length)) quality += 5;
    
    return Math.min(quality, 100);
  }

  /**
   * Store expansion in database
   */
  private async storeExpansion(
    request: ActionStepExpansionRequest,
    subTasks: ExpandedSubTask[],
    analysis: ExpansionAnalysis,
    userContext: any
  ): Promise<void> {
    try {
      await supabase
        .from('smart_expounded_steps')
        .insert({
          action_step_id: request.actionStepId,
          expounded_content: {
            subTasks,
            analysis,
            contextConfidence: userContext.confidenceScore,
            intelligenceLevel: this.INTELLIGENCE_LEVELS[request.subscriptionTier as keyof typeof this.INTELLIGENCE_LEVELS]
          },
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('[ActionStepExpansion] Error storing expansion:', error);
    }
  }
}

// Export singleton instance
export const actionStepExpansionService = new ActionStepExpansionService();
