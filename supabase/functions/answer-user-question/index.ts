import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { question, context } = await req.json();

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Generating AI response for user question:', question?.substring(0, 50) + '...');

    // Build personalized coaching prompt
    const questionPrompt = `
You are a wise, compassionate Christian spiritual director and coach. A user is asking you: "${question}"

${context ? `Context: ${context}` : 'Context: General spiritual guidance'}

Please provide a thoughtful, biblical, and encouraging response that:
1. Directly addresses their question with wisdom and care
2. Offers relevant biblical perspective and scripture references
3. Provides practical, actionable guidance they can apply
4. Shows God's love, grace, and care for them personally
5. Encourages their spiritual growth and faith journey
6. Uses warm, personal language that feels like a caring mentor

Keep your response personal, encouraging, and around 2-3 paragraphs. Make it feel like a conversation with a trusted spiritual advisor.
    `;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are a wise, compassionate Christian spiritual director providing personalized guidance and coaching. Your responses should be biblical, practical, encouraging, and deeply personal.',
          },
          {
            role: 'user',
            content: questionPrompt,
          },
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response received from OpenAI');
    }

    console.log('AI response generated successfully for user question');

    return new Response(
      JSON.stringify({
        response: aiResponse,
        success: true,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error generating AI response:', error);

    // Return proper error status - no fallback
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to generate AI response',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
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
