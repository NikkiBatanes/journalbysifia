import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversationContext {
  originalUserInput: string;
  playbookTitle: string;
  currentStepText: string;
  userSpiritualProfile?: Record<string, unknown>;
}

interface ConversationMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface InteractiveCoachingRequest {
  type: 'opening' | 'response';
  userMessage?: string;
  conversationHistory?: ConversationMessage[];
  context: ConversationContext;
  insights?: {
    keyThemes: string[];
    breakthroughs: string[];
    prayerRequests: string[];
    scriptureReferences: string[];
  };
  userId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, userMessage, conversationHistory, context, insights }: InteractiveCoachingRequest = await req.json();

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('Service configuration error. Please contact support.');
    }

    let prompt: string;

    if (type === 'opening') {
      prompt = buildOpeningPrompt(context);
    } else {
      prompt = buildConversationalPrompt(userMessage!, conversationHistory || [], context, insights);
    }

    console.log('Generated prompt for interactive coaching:', prompt.substring(0, 200) + '...');

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a wise, compassionate Christian spiritual director and coach. You provide personalized, biblical guidance with deep empathy and practical wisdom. Always respond in valid JSON format as specified in the prompts.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiContent = openaiData.choices[0]?.message?.content;

    if (!aiContent) {
      throw new Error('We couldn\'t generate a coaching response. Please try again.');
    }

    // Parse the JSON response - fail if not valid JSON
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiContent);
    } catch (_parseError) {
      console.error('Failed to parse OpenAI response as JSON:', aiContent);
      throw new Error('We received an unexpected response. Please try again.');
    }

    console.log('Interactive coaching response generated successfully');

    return new Response(
      JSON.stringify(parsedResponse),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error in generate-interactive-coaching function:', error);

    // Return proper error status - no fallback
    return new Response(
      JSON.stringify({
        success: false,
        error: 'We couldn\'t generate coaching guidance right now',
        message: error instanceof Error ? error.message : 'Our coaching assistant is temporarily unavailable. Please try again in a moment.',
        retryable: true,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    );
  }
});

/**
 * Build opening prompt for starting a conversation
 */
function buildOpeningPrompt(context: ConversationContext): string {
  return `
You are a wise, compassionate Christian spiritual director starting a conversation with someone working on: "${context.currentStepText}"

Context:
- Their original struggle/input: "${context.originalUserInput}"
- Playbook: "${context.playbookTitle}"
- This is the beginning of a personal coaching conversation

Your role is to:
1. Create a warm, safe space for spiritual conversation
2. Show that you understand their journey and context
3. Ask thoughtful questions that invite deeper reflection
4. Provide gentle guidance rooted in biblical wisdom

Generate an opening message that:
- Acknowledges their specific situation with empathy
- References their original struggle in a caring way
- Invites them to share what's on their heart
- Creates psychological safety for vulnerable conversation
- Offers hope and God's presence

Also provide 2-3 follow-up questions that could help deepen the conversation.

Format your response as JSON:
{
  "message": "Your warm, personal opening message here",
  "followUpQuestions": [
    {
      "id": "q1",
      "question": "Thoughtful follow-up question",
      "purpose": "clarification|deeper_exploration|emotional_check|spiritual_growth",
      "priority": "high|medium|low"
    }
  ],
  "suggestedActions": ["Optional gentle suggestions"],
  "prayerPoints": ["Areas to pray about"],
  "scriptureRecommendations": [
    {
      "verse": "Relevant Bible verse",
      "reference": "Book Chapter:Verse",
      "reason": "Why this verse is relevant"
    }
  ]
}

Make it deeply personal, referencing their specific context and journey.
  `;
}

/**
 * Build conversational prompt for ongoing dialogue
 */
function buildConversationalPrompt(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  context: ConversationContext,
  insights?: {
    keyThemes?: string[];
    breakthroughs?: string[];
    prayerRequests?: string[];
    scriptureReferences?: string[];
  }
): string {
  const recentHistory = conversationHistory.slice(-4).map(msg =>
    `${msg.type === 'user' ? 'User' : 'Coach'}: ${msg.content}`
  ).join('\n');

  const themes = insights?.keyThemes?.join(', ') || 'spiritual growth';
  const prayerRequests = insights?.prayerRequests?.slice(-2).join(', ') || '';

  return `
You are continuing a spiritual coaching conversation. Here's the context:

Original Situation: "${context.originalUserInput}"
Current Step: "${context.currentStepText}"
Playbook: "${context.playbookTitle}"

Recent Conversation:
${recentHistory}

Current Themes: ${themes}
${prayerRequests ? `Prayer Areas: ${prayerRequests}` : ''}

User just said: "${userMessage}"

As their spiritual coach, provide a response that:
1. Shows you heard and understood their heart
2. Offers biblical wisdom and encouragement
3. Asks thoughtful follow-up questions
4. Provides practical next steps
5. Maintains emotional and spiritual safety

Analyze their emotional tone and spiritual needs. Respond with appropriate depth and care.

Format your response as JSON:
{
  "message": "Your compassionate, wise response",
  "followUpQuestions": [
    {
      "id": "unique_id",
      "question": "Thoughtful follow-up question",
      "purpose": "clarification|deeper_exploration|practical_application|emotional_check|spiritual_growth",
      "priority": "high|medium|low"
    }
  ],
  "suggestedActions": ["Specific, actionable suggestions"],
  "prayerPoints": ["Specific areas to pray about based on their sharing"],
  "scriptureRecommendations": [
    {
      "verse": "Relevant Bible verse",
      "reference": "Book Chapter:Verse", 
      "reason": "Why this verse speaks to their situation"
    }
  ],
  "emotionalSupport": {
    "tone": "encouraging|gentle|challenging|celebratory",
    "affirmations": ["Personal affirmations based on what they shared"]
  }
}

Be deeply personal, referencing their specific words and situation. Show Christ's love through your response.
  `;
}
