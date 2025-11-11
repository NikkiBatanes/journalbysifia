import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { fetchWithRetry, OPENAI_RETRY_CONFIG } from '../_shared/retryLogic.ts';
import { SimpleRateLimiter, RATE_LIMIT_CONFIGS, createRateLimitError } from '../_shared/simpleRateLimiter.ts';
import { CircuitBreaker, CIRCUIT_KEYS } from '../_shared/circuitBreaker.ts';

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

    // Extract user ID from authorization header for rate limiting
    const authHeader = req.headers.get('authorization');
    const userId = authHeader ? authHeader.split(' ')[1] : 'anonymous';

    // Check rate limit
    const rateLimitResult = SimpleRateLimiter.checkLimit(userId, RATE_LIMIT_CONFIGS.question);
    if (!rateLimitResult.allowed) {
      return createRateLimitError(
        rateLimitResult,
        `You're asking questions too quickly. Please wait ${rateLimitResult.retryAfter} seconds.`
      );
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('Service configuration error. Please contact support.');
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

    // Call OpenAI API with circuit breaker + retry logic
    console.log('[Answer-Question] Calling OpenAI API with circuit breaker + retry logic...');
    const response = await CircuitBreaker.execute(
      CIRCUIT_KEYS.OPENAI_QUESTION,
      async () => await fetchWithRetry(
      'https://api.openai.com/v1/chat/completions',
      {
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
      },
      OPENAI_RETRY_CONFIG
      )
    );
    
    console.log('[Answer-Question] OpenAI API call successful');

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
        error: 'We couldn\'t generate a response right now',
        message: 'Our AI assistant is temporarily unavailable. Please try asking your question again in a moment.',
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
