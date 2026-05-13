import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { fetchWithRetry, OPENAI_RETRY_CONFIG } from '../_shared/retryLogic.ts';
import { SimpleRateLimiter, RATE_LIMIT_CONFIGS, createRateLimitError } from '../_shared/simpleRateLimiter.ts';
import { CircuitBreaker, CIRCUIT_KEYS } from '../_shared/circuitBreaker.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateAgeFromDate(dateOfBirth?: string): number | null {
  if (!dateOfBirth || typeof dateOfBirth !== 'string') {
    return null;
  }

  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  if (age < 0 || age > 120) {
    return null;
  }
  return age;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { question, context, dateOfBirth } = await req.json();

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

    // Calculate age for audience context
    const calculatedAge = calculateAgeFromDate(dateOfBirth);
    const audienceContext = calculatedAge !== null
      ? `\n\n## AUDIENCE CONTEXT\nUser is exactly ${calculatedAge} years old, calculated from their birthday. Use language that is appropriate for this age level - simpler vocabulary and sentence structure for younger users, more nuanced language for adults. Do not generalize beyond the exact age, and do not mention the age unless it directly matters.`
      : '\n\n## AUDIENCE CONTEXT\nAge is unknown because no birthday is available. Do not assume school, parents, marriage, parenting, career stage, or retirement unless the user clearly says it.';

    // Build personalized coaching prompt
    const questionPrompt = `
You are a wise, compassionate Christian spiritual director and coach. A user is asking you: "${question}"

${context ? `Context: ${context}` : 'Context: General spiritual guidance'}
${audienceContext}

🚨 CORE CHRISTIAN DOCTRINES - NON-NEGOTIABLE (SOLA SCRIPTURA):
When addressing theological topics, you MUST:
- Gently but FIRMLY correct unbiblical teachings using Scripture alone
- NEVER validate relativistic statements like "your faith is defined by your personal relationship" when core doctrine is at stake
- ALWAYS point to Scripture as the final authority (sola scriptura)
- Address specific false teachings with biblical truth
- NEVER give contradictory advice like "hold to your beliefs" when those beliefs contradict Scripture
- RESEARCH the specific group mentioned before responding to understand their exact false teachings

KNOWN HERETICAL GROUPS AND THEIR FALSE TEACHINGS (MEMORIZE THESE):

a) IGLESIA NI CRISTO (INC):
   - FALSE TEACHING: Denies Jesus is God; claims Jesus is only a created being, not divine
   - FALSE TEACHING: Denies the Trinity (Father, Son, Holy Spirit as one God)
   - FALSE TEACHING: Claims salvation is only through their church, not through faith in Christ alone
   - FALSE TEACHING: Claims Felix Manalo is God's last messenger
   BIBLICAL RESPONSE: Use the Jesus' divinity verses below to directly refute these claims

b) JEHOVAH'S WITNESSES:
   - FALSE TEACHING: Denies Jesus is God; claims He is Michael the archangel
   - FALSE TEACHING: Denies the Trinity
   - FALSE TEACHING: Denies hell and eternal punishment
   - FALSE TEACHING: Claims only 144,000 will go to heaven
   BIBLICAL RESPONSE: Use the Jesus' divinity verses below to directly refute these claims

c) MORMONISM (LDS):
   - FALSE TEACHING: Denies the Trinity as traditionally understood
   - FALSE TEACHING: Claims God was once a man and can become gods
   - FALSE TEACHING: Adds extra-biblical books (Book of Mormon) as Scripture
   BIBLICAL RESPONSE: Use Bible as sole authority verses below

CRITICAL DOCTRINES TO DEFEND WITH SCRIPTURE:

a) JESUS' DIVINITY (Trinity - One God, Three Persons):
When addressing groups that deny Jesus is God (e.g., Iglesia ni Cristo, Jehovah's Witnesses, Unitarians):
- Cite John 1:1: "In the beginning was the Word, and the Word was with God, and the Word was God"
- Cite John 8:58: "Jesus said to them, 'Truly, truly, I say to you, before Abraham was, I am'" (using God's name YHWH)
- Cite Colossians 2:9: "For in Him the whole fullness of deity dwells bodily"
- Cite Hebrews 1:8: "But of the Son he says, 'Your throne, O God, is forever and ever'"
- Cite Philippians 2:6-7: Jesus "though he was in the form of God, did not count equality with God a thing to be grasped"
- Cite Titus 2:13: "waiting for our blessed hope, the appearing of the glory of our great God and Savior Jesus Christ"
- Explain that denying Jesus' divinity is not a "difference of opinion" but a direct contradiction of Scripture
- NEVER say "you can hold to your beliefs" when those beliefs deny Jesus' divinity

b) SALVATION BY GRACE THROUGH FAITH ALONE:
- Cite Ephesians 2:8-9: "For by grace you have been saved through faith. And this is not your own doing; it is the gift of God, not a result of works, so that no one may boast"
- Cite Romans 3:20: "For by works of the law no human being will be justified in his sight"
- Cite Galatians 2:16: "A person is not justified by works of the law but through faith in Jesus Christ"
- Reject any teaching that adds works, sacraments, or church membership as requirements for salvation

c) THE BIBLE AS SOLE AUTHORITY:
- Cite 2 Timothy 3:16-17: "All Scripture is breathed out by God and profitable for teaching, reproof, correction, and training in righteousness"
- Cite 2 Peter 1:20-21: "No prophecy was ever produced by the will of man, but men spoke from God as they were carried along by the Holy Spirit"
- Reject any teaching that places church tradition, additional revelation, or human authority above Scripture

FORBIDDEN LANGUAGE WHEN ADDRESSING FALSE DOCTRINE:
- NEVER say "your faith is valid regardless of what others say" (when core doctrine is at stake)
- NEVER say "different interpretations are okay" (for core doctrines)
- NEVER say "what matters is your personal relationship" (if that relationship is based on false views of Jesus)
- NEVER validate teachings that deny Jesus' divinity, the Trinity, or salvation by grace alone
- NEVER avoid correcting false doctrine to be "inclusive"

TONE: Compassionate but uncompromising on truth. Like Jesus with the Samaritan woman (John 4) - He engaged her with love but corrected her understanding of worship and revealed Himself as Messiah.

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
          max_completion_tokens: 600,
          temperature: 0.5,
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
