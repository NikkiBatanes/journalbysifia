/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

/**
 * Generate a UUID v4 compatible with Deno
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : ((r % 4) + 8);
    return v.toString(16);
  });
}

interface StreamlinedInsight {
  id: string;
  actionStepId: string;
  subtaskId?: string;
  type: 'spiritual_nudge' | 'practical_step' | 'encouragement' | 'challenge';
  content: string;
  followUpPrompts: string[];
  depth: 'surface' | 'medium' | 'deep';
  aiGenerated: boolean;
  userId: string;
  createdAt: string;
}

// Keep backward compatibility
interface StepExpounding {
  id: string;
  actionStepId: string;
  subtaskId?: string;
  stepNumber: number;
  stepTitle: string;
  contentType: 'spiritual_insight' | 'practical_guidance' | 'biblical_context' | 'reflection_questions';
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

interface ExpoundingTemplate {
  stepNumber: number;
  title: string;
  contentType: string;
  template: string;
}

interface RequestBody {
  actionStepId: string;
  actionStepText: string;
  subtaskId?: string;
  subtaskText?: string;
  userId: string;
  userOriginalInput?: string; // User's original struggle/context for personalized faith guidance
  playbookTitle?: string; // Additional context for Christian coaching
}

interface OpenAIData {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Step templates for consistent expounding structure
const stepTemplates: ExpoundingTemplate[] = [
  {
    stepNumber: 1,
    title: 'Understanding the Heart',
    contentType: 'spiritual_insight',
    template: "Let's explore the spiritual foundation of this step",
  },
  {
    stepNumber: 2,
    title: 'Practical Application',
    contentType: 'practical_guidance',
    template: "Now let's break down how to practically implement this",
  },
  {
    stepNumber: 3,
    title: 'Biblical Foundation',
    contentType: 'biblical_context',
    template: "Let's ground this in Scripture and biblical wisdom",
  },
  {
    stepNumber: 4,
    title: 'Reflection & Growth',
    contentType: 'reflection_questions',
    template: 'Time for deeper reflection and personal application',
  },
];

/**
 * Get personalized context for different content types
 */
function getPersonalizedContext(contentType: string): string {
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
function buildExpoundingPrompt(targetText: string, template: ExpoundingTemplate): string {
  const personalizedContext = getPersonalizedContext(template.contentType);

  return `
You are a wise, compassionate Christian coach helping someone grow in their faith. This person is working on: "${targetText}"

Context: ${template.title} - ${template.contentType}
Focus: ${personalizedContext}

Please provide a deeply personal and encouraging response that includes:

- Spiritual Insight (2-3 sentences)
  Connect this action to God's character and love
  Explain why it matters for spiritual growth
  Make it personal and relatable

- Biblical Foundation (1-2 sentences)
  One specific, relevant Bible verse with reference
  Brief explanation of how it applies to their situation
  Connect to God's promises and character

- Practical Steps (2-3 actionable items)
  Specific, concrete actions they can take today
  Include prayer, reflection, or community elements
  Make each step achievable and meaningful

- Reflection Questions (2-3 thoughtful questions)
  Help them examine their heart and motivations
  Connect to their relationship with God
  Encourage spiritual introspection

Write as if you're speaking directly to them personally.

Remember: This is about their spiritual growth and relationship with God. Make it deeply personal, encouraging, and actionable.

Format the response as a JSON object with this structure:
{
  "stepNumber": 1,
  "stepTitle": "Brief, encouraging title",
  "contentType": "spiritual_insight",
  "content": "Main spiritual insight here",
  "scriptureReferences": ["Specific Bible verse with reference"],
  "practicalSteps": ["Actionable step 1", "Actionable step 2"],
  "reflectionQuestions": ["Thoughtful question 1", "Thoughtful question 2"]
}

Ensure the JSON is valid and properly formatted.
  `;
}

/**
 * Parse OpenAI response for expounding content with advanced content extraction
 */
function parseOpenAIExpoundingResponse(
  aiResponse: string,
  template: ExpoundingTemplate
): {
  mainContent: string;
  scriptureReferences: string[];
  practicalSteps: string[];
  reflectionQuestions: string[];
} {
  try {
    const lines = aiResponse.split('\n').filter(line => line.trim());

    let mainContent = '';
    const scriptureReferences: string[] = [];
    const practicalSteps: string[] = [];
    const reflectionQuestions: string[] = [];

    let currentSection = 'main';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Section headers detection
      if (trimmedLine.includes('**') &&
          (trimmedLine.toLowerCase().includes('spiritual') ||
           trimmedLine.toLowerCase().includes('biblical') ||
           trimmedLine.toLowerCase().includes('practical') ||
           trimmedLine.toLowerCase().includes('reflection'))) {
        if (trimmedLine.toLowerCase().includes('practical')) {currentSection = 'practical';}
        else if (trimmedLine.toLowerCase().includes('reflection')) {currentSection = 'questions';}
        else if (trimmedLine.toLowerCase().includes('biblical')) {currentSection = 'biblical';}
        else {currentSection = 'main';}
        continue;
      }

      // Content classification
      if (/\b\d+:\d+/.test(trimmedLine) ||
          trimmedLine.includes('Bible') ||
          trimmedLine.includes('Scripture') ||
          /\b(Genesis|Exodus|Matthew|John|Romans|Corinthians|Ephesians|Philippians|Colossians|Timothy|Hebrews|James|Peter|Revelation)\b/.test(trimmedLine)) {
        scriptureReferences.push(trimmedLine.replace(/^\d+\.\s*/, '').replace(/^[•-]\s*/, '').trim());
      } else if ((/^\d+\./.test(trimmedLine) ||
                  trimmedLine.startsWith('•') ||
                  trimmedLine.startsWith('-')) &&
                 currentSection === 'practical') {
        practicalSteps.push(trimmedLine.replace(/^\d+\.\s*/, '').replace(/^[•-]\s*/, '').trim());
      } else if (trimmedLine.includes('?')) {
        reflectionQuestions.push(trimmedLine.replace(/^\d+\.\s*/, '').replace(/^[•-]\s*/, '').trim());
      } else if (currentSection === 'main' && trimmedLine.length > 10) {
        mainContent += trimmedLine + ' ';
      }
    }

    // Fallback extraction if structured parsing didn't work well
    if (!mainContent) {
      const sentences = aiResponse.split(/[.!?]+/).filter(s => s.trim().length > 20);
      mainContent = sentences.slice(0, 3).join('. ').trim() + '.';
    }

    if (scriptureReferences.length === 0) {
      const biblicalPattern = /([A-Z][a-z]+\s+\d+:\d+(?:-\d+)?)/g;
      const matches = aiResponse.match(biblicalPattern) || [];
      scriptureReferences.push(...matches);
    }

    if (practicalSteps.length === 0) {
      const stepPatterns = [/\d+\.\s*([^.!?]+)/g, /•\s*([^.!?]+)/g, /-\s*([^.!?]+)/g];
      for (const pattern of stepPatterns) {
        const matches = Array.from(aiResponse.matchAll(pattern));
        if (matches.length >= 2) {
          practicalSteps.push(...matches.map(match => match[1].trim()).slice(0, 4));
          break;
        }
      }
    }

    if (reflectionQuestions.length === 0) {
      const questionPattern = /([^.!?]*\?)/g;
      const matches = Array.from(aiResponse.matchAll(questionPattern));
      const questions = matches
        .map(match => match[1].trim())
        .filter(q => q.length > 10 && q.length < 200)
        .slice(0, 3);
      reflectionQuestions.push(...questions);
    }

    return {
      mainContent: mainContent.trim() || `${template.template} for: "${aiResponse.substring(0, 100)}..."`,
      scriptureReferences: scriptureReferences.length > 0 ? scriptureReferences : ['James 2:17 - Faith without works is dead'],
      practicalSteps: practicalSteps.length > 0 ? practicalSteps : [
        'Begin with prayer for guidance',
        'Reflect on how this applies to your life',
        'Take one small step today',
      ],
      reflectionQuestions: reflectionQuestions.length > 0 ? reflectionQuestions : [
        'How does this step challenge you to grow?',
        'What obstacles might you face, and how can you overcome them?',
      ],
    };
  } catch (error) {
    console.error('Error parsing OpenAI response:', error);

    // Return fallback content
    return {
      mainContent: aiResponse.substring(0, 200) + '...',
      scriptureReferences: ['James 2:17 - Faith without works is dead'],
      practicalSteps: [
        'Begin with prayer for guidance',
        'Reflect on how this applies to your life',
        'Take one small step today',
      ],
      reflectionQuestions: [
        'How does this step challenge you to grow?',
        'What obstacles might you face, and how can you overcome them?',
      ],
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const requestBody = await req.json()
    const { type, actionStepText, subtaskText, userOriginalInput, playbookTitle, userId, question, context } = requestBody
  } catch (_error) {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { 
    actionStepId, 
    actionStepText, 
    subtaskId, 
    subtaskText, 
    userId,
    userOriginalInput, // User's original struggle/context for personalized faith guidance
    playbookTitle // Additional context for Christian coaching
  } = requestBody;

  if (!actionStepId || !actionStepText || !userId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const expoundingSteps: StepExpounding[] = [];
    const targetText = subtaskText || actionStepText;

    // Generate content for each step template using OpenAI (personalized, no caching)
    for (const template of stepTemplates) {
      try {
        const prompt = buildExpoundingPrompt(targetText, template);

              },
            ],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        });

        let stepContent;
        if (openAIRes.ok) {
          const aiData = await openAIRes.json();
          const aiResponse = aiData.choices?.[0]?.message?.content || '';
          stepContent = parseOpenAIExpoundingResponse(aiResponse, template);
        } else {
          console.error('OpenAI API Error for step:', template.stepNumber, await openAIRes.text());
          // Fallback content
          stepContent = {
            mainContent: `${template.template} for: "${targetText}"`,
            scriptureReferences: ['James 2:17 - Faith without works is dead'],
            practicalSteps: [
              'Begin with prayer for guidance',
              'Reflect on how this applies to your life',
              'Take one small step today',
            ],
            reflectionQuestions: [
              'How does this step challenge you to grow?',
              'What obstacles might you face, and how can you overcome them?',
            ],
          };
        }

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
      } catch (stepError) {
        console.error(`Error generating step ${template.stepNumber}:`, stepError);

        // Add fallback step
        const fallbackStep: StepExpounding = {
          id: `${actionStepId}_${subtaskId || 'main'}_step_${template.stepNumber}`,
          actionStepId,
          subtaskId,
          stepNumber: template.stepNumber,
          stepTitle: template.title,
          contentType: template.contentType as any,
          content: `${template.template} for: "${targetText}"`,
          scriptureReferences: ['James 2:17 - Faith without works is dead'],
          practicalSteps: [
            'Begin with prayer for guidance',
            'Reflect on how this applies to your life',
            'Take one small step today',
          ],
          reflectionQuestions: [
            'How does this step challenge you to grow?',
            'What obstacles might you face, and how can you overcome them?',
          ],
          aiGenerated: true,
          userId,
          isPublic: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        expoundingSteps.push(fallbackStep);
      }
    }

    return new Response(JSON.stringify(expoundingSteps, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error generating expounding:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({
        error: 'Failed to generate expounding',
        details: errorMessage,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
