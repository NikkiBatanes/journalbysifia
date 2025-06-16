import { serve } from 'https://deno.land/std/http/server.ts';

interface Scripture {
  text: string;
  reference: string;
}

interface ReflectionQuestion {
  id: string;
  text: string;
}

interface DevotionalDay {
  id: string;
  dayNumber: number;
  title: string;
  scripture: Scripture;
  reflection: string;
  reflectionQuestions: ReflectionQuestion[];
  prayer: string;
  completed: boolean;
}

interface Devotional {
  id: string;
  title: string;
  description: string;
  category: string;
  days: DevotionalDay[];
  currentDay: number;
  totalDays: number;
  progress: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  playbookId?: string;
  userInput?: string;
}

/**
 * Safely cleans markdown formatting from text
 * @param text - Input text that might contain markdown
 * @returns Cleaned text with markdown removed
 */
function cleanMarkdown(text: unknown): string {
  const safeString = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value.toString === 'function') return value.toString();
    return '';
  };

  try {
    const str = safeString(text);
    if (typeof str !== 'string') {
      console.warn('cleanMarkdown: Failed to convert input to string. Type:', typeof text);
      return '';
    }
    if (!str.trim()) return '';

    let result = str;
    try {
      result = result
        .replace(/\*\*|__/g, '') // Remove bold/italic
        .replace(/\*|_/g, '') // Remove single asterisks/underscores
        .replace(/^[-*]\s*/gm, '') // Remove list markers
        .replace(/^\s*[-*_]{3,}\s*$/gm, '') // Remove dividers
        .replace(/^#{1,6}\s*/gm, '') // Remove headers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
        .replace(/`{1,3}([^`]+)`{1,3}/g, '$1') // Remove code blocks
        .replace(/\n{3,}/g, '\n\n') // Limit newlines
        .replace(/\s+\n/g, '\n') // Remove trailing whitespace
        .replace(/--+/g, '') // Remove dashes
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    } catch (replaceError) {
      console.error('Error in replace operations:', replaceError);
      return str.trim();
    }
    return result;
  } catch (error) {
    console.error('Unexpected error in cleanMarkdown:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      inputType: typeof text,
      inputValue: text,
    });
    return '';
  }
}

/**
 * Creates a default devotional day for error cases
 */
function createDefaultDay(dayNumber: number, isError = false): DevotionalDay {
  const timestamp = Date.now();
  return {
    id: `${timestamp}-day-${dayNumber}`,
    dayNumber,
    title: isError ? 'Error' : `Day ${dayNumber}`,
    scripture: {
      text: isError ? 'The Lord is my shepherd; I shall not want.' : 'Your word is a lamp to my feet and a light to my path.',
      reference: isError ? 'PSALM 23:1' : 'PSALM 119:105',
    },
    reflection: isError
      ? 'We encountered an error generating this devotional. Please try again.'
      : 'Reflect on God’s guidance in your life today.',
    reflectionQuestions: [
      { id: 'q1', text: 'What stands out to you from today’s scripture?' },
      { id: 'q2', text: 'How can you apply this to your life today?' },
      { id: 'q3', text: 'How does this point you to Christ?' },
    ],
    prayer: isError
      ? ''
      : 'Heavenly Father,\n\nThank You for Your guiding word.\nForgive me for doubting Your path.\nGuide me in Your truth today.\nThank You for Your faithfulness.\nIn Jesus’ Name,\nAmen',
    completed: false,
  };
}

/**
 * Safely parses the OpenAI response into a structured devotional format
 */
function parseOpenAIResponse(aiData: unknown, duration: number, playbookId?: string, userInput?: string): Devotional {
  const errorDevotional = (msg: string, playbookId?: string, userInput?: string): Devotional => ({
    id: `${Date.now()}`,
    title: 'Error Generating Devotional',
    description: msg,
    category: 'Error',
    days: [createDefaultDay(1, true)],
    currentDay: 1,
    totalDays: 1,
    progress: 0,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    playbookId,
    userInput,
  });

  try {
    const response = aiData as Record<string, unknown>;
    const choices = Array.isArray(response?.choices) ? response.choices : [];
    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    const content = (firstChoice?.message as Record<string, unknown> | undefined)?.content as string || '';
    if (!content) return errorDevotional('No content found in AI response.', playbookId, userInput);
    
    // Log the raw content for debugging
    console.log('[DEVOTIONAL PARSER] Raw content start:', JSON.stringify(content).substring(0, 500) + (content.length > 500 ? '...' : ''));

    const devotional: Devotional = {
      id: `${Date.now()}`,
      title: '',
      description: '',
      category: '',
      days: [],
      currentDay: 1,
      totalDays: duration,
      progress: 0,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      playbookId,
      userInput,
    };

    // Extract title (handle the exact format from OpenAI response)
    let title = 'Daily Devotional';
    const titleMatch = content.match(/\*\*SERIES TITLE:\*\*\s*\n([^\n]+)/i);
    if (titleMatch && titleMatch[1]) {
      title = cleanMarkdown(titleMatch[1]).trim().slice(0, 32);
    }
    devotional.title = title;
    console.log('[DEVOTIONAL PARSER] Extracted title:', title);

    // Extract description (handle the exact format from OpenAI response)
    let description = `A ${duration}-day journey to deepen your faith.`;
    const descMatch = content.match(/\*\*DESCRIPTION:\*\*\s*\n([^\n]+)(?:\n\n|\n---|$)/i);
    if (descMatch && descMatch[1]) {
      description = cleanMarkdown(descMatch[1]).trim();
    }
    devotional.description = description;
    console.log('[DEVOTIONAL PARSER] Extracted description:', description);

    // Extract categories
    const catMatch = content.match(/^(?:[#*]\s*)*CATEGORY:\s*([\s\S]*?)(?=\n{2,}|$)/im);
    const categories = catMatch
      ? cleanMarkdown(catMatch[1])
          .split(/\n|,|;/)
          .map(c => c.trim())
          .filter(c => c)
          .slice(0, 3)
      : userInput?.toLowerCase().includes('rest')
        ? ['Peace', 'Rest', 'Trust']
        : ['Faith', 'Growth'];
    devotional.category = categories.join(', ');

    // Extract days - handle the specific format from OpenAI response
    console.log('[DEVOTIONAL PARSER] Trying to parse days...');
    
    // First try with the exact format from OpenAI: **DAY X:**
    let dayMatches: Array<[unknown, string, string]> = [];
    const dayRegex = /\*\*DAY\s*(\d+):\*\*\s*\n([\s\S]*?)(?=\*\*DAY\s*\d+:|\.{3}|$)/gi;
    
    let match;
    while ((match = dayRegex.exec('\n' + content)) !== null) {
      console.log(`[DEVOTIONAL PARSER] Found day ${match[1]} with content length:`, match[2].length);
      dayMatches.push([null, match[1], match[2].trim()]);
    }
    
    console.log('[DEVOTIONAL PARSER] Days parsed (markdown format):', dayMatches.length);
    
    // If no days found, try with the exact format but without the **
    if (dayMatches.length === 0) {
      console.log('[DEVOTIONAL PARSER] Trying alternative day parsing...');
      const altDayRegex = /DAY\s*(\d+):\s*\n([\s\S]*?)(?=DAY\s*\d+:|$)/gi;
      let altMatch;
      while ((altMatch = altDayRegex.exec(content)) !== null) {
        console.log(`[DEVOTIONAL PARSER] Found day ${altMatch[1]} (alt format) with content length:`, altMatch[2].length);
        dayMatches.push([null, altMatch[1], altMatch[2].trim()]);
      }
    }
    
    // If still no days found, try splitting by the separator (---)
    if (dayMatches.length === 0) {
      console.log('[DEVOTIONAL PARSER] Trying separator-based parsing...');
      const daySections = content.split(/\n---\n/);
      
      daySections.forEach((section, index) => {
        const dayMatch = section.match(/DAY\s*(\d+):/i);
        if (dayMatch && dayMatch.index !== undefined) {
          const dayNum = dayMatch[1];
          const dayContent = section.substring(dayMatch.index + dayMatch[0].length).trim();
          console.log(`[DEVOTIONAL PARSER] Found day ${dayNum} (separator format) with content length:`, dayContent.length);
          dayMatches.push([null, dayNum, dayContent]);
        } else if (index > 0 && dayMatches.length > 0) {
          // If we can't parse the day number but we have previous days,
          // assume it's a continuation of the previous day
          console.log(`[DEVOTIONAL PARSER] Adding content to previous day (${section.length} chars)`);
          const lastDay = dayMatches[dayMatches.length - 1];
          lastDay[2] = (lastDay[2] + '\n\n' + section).trim();
        }
      });
    }
    
    console.log('[DEVOTIONAL PARSER] Total days parsed:', dayMatches.length);
    
    // Fallback for single-day devotionals
    if (dayMatches.length === 0 && duration === 1) {
      console.log('[DEVOTIONAL PARSER] No days found, using full content as single day');
      dayMatches = [[null, '1', content]];
    }

    for (const [, dayNum, dayContent] of dayMatches) {
      try {
        const dayNumber = parseInt(dayNum, 10);
        console.log(`[DEVOTIONAL PARSER] Processing Day ${dayNum}...`);

        // Log day content for debugging
        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} content (first 100 chars):`, JSON.stringify(dayContent.substring(0, 100)));

        // Extract day title (handle the exact format from OpenAI response)
        let dayTitle = `Day ${dayNumber}`; // Default title
        const dayTitleMatch = dayContent.match(/\*\*DAILY TITLE:\*\*\s*\n([^\n]+)/i);
        if (dayTitleMatch && dayTitleMatch[1]) {
          dayTitle = dayTitleMatch[1].trim();
        }
        const cleanDayTitle = cleanMarkdown(dayTitle).trim().slice(0, 32);
        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Title:`, cleanDayTitle);

        // Extract scripture (handle the exact format from OpenAI response)
        let scriptureText = 'Your word is a lamp to my feet and a light to my path.';
        let scriptureRef = 'PSALM 119:105';
        
        // Try to match the exact format from OpenAI response
        const scriptureMatch = dayContent.match(/\*\*SCRIPTURE:\*\*\s*\n\\"([^\"]+)\"\s*-\s*([A-Z0-9\s:]+)/i) ||
                              dayContent.match(/\*\*SCRIPTURE:\*\*\s*\n([^\n-]+)\s*-\s*([A-Z0-9\s:]+)/i);
        
        if (scriptureMatch) {
          scriptureText = scriptureMatch[1].trim();
          scriptureRef = scriptureMatch[2].trim();
        } else {
          // Fallback: Try to find anything that looks like a scripture reference
          const possibleScripture = dayContent.match(/\*\*SCRIPTURE:\*\*[\s\n]*([^\n]+?)([A-Z0-9\s]+:[0-9]+(?:-[0-9]+)?)/i);
          if (possibleScripture) {
            scriptureText = possibleScripture[1].replace(/[-"]/g, '').trim();
            scriptureRef = possibleScripture[2].trim();
          }
        }
        
        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Scripture:`, { text: scriptureText, reference: scriptureRef });
        const scripture = {
          text: cleanMarkdown(scriptureText),
          reference: cleanMarkdown(scriptureRef)
        };
        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Scripture:`, scripture);

        // Extract reflection (handle both DAILY REFLECTION and REFLECTION headers)
        let reflection = '';
        const reflectionMatch = dayContent.match(/(?:DAILY REFLECTION|REFLECTION):\s*([\s\S]*?)(?=(?:REFLECTION QUESTIONS|QUESTIONS|PRAYER):|$)/i);
        if (reflectionMatch) {
          reflection = cleanMarkdown(reflectionMatch[1]).trim();
          // Format into paragraphs if not already
          if (!/\n{2,}/.test(reflection)) {
            const sentences = reflection.split(/(?<=[.!?])\s+/);
            const paragraphs = [];
            for (let i = 0; i < sentences.length; i += 2) {
              paragraphs.push(sentences.slice(i, i + 2).join(' '));
            }
            reflection = paragraphs.join('\n\n');
          }
        } else {
          reflection = 'Take time to reflect on today\'s scripture and how it speaks to your current situation.';
        }
        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Reflection length:`, reflection.length);

        // Extract questions (handle both REFLECTION QUESTIONS and QUESTIONS headers)
        let reflectionQuestions: ReflectionQuestion[] = [];
        const questionsMatch = dayContent.match(/(?:REFLECTION QUESTIONS|QUESTIONS):\s*([\s\S]*?)(?=PRAYER:|$)/i);
        if (questionsMatch) {
          const questionsRaw = questionsMatch[1];
          reflectionQuestions = questionsRaw
            .split('\n')
            .map(q => q.trim())
            .filter(q => q && q.match(/^\d+\./))
            .map((q, i) => ({
              id: `q${i + 1}`,
              text: cleanMarkdown(q.replace(/^\d+\.\s*/, '')).trim(),
            }));
        }
        if (reflectionQuestions.length === 0) {
          reflectionQuestions = [
            { id: 'q1', text: 'What stood out to you today?' },
            { id: 'q2', text: 'How can you apply this to your life?' },
            { id: 'q3', text: 'How does this point you to Christ?' },
          ];
        }
        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Questions count:`, reflectionQuestions.length);

        // Extract prayer (handle different prayer formats)
        let prayerText = '';
        const prayerMatch = dayContent.match(/PRAYER:[\s\n]*([\s\S]*?)(?=In Jesus'? Name,?\s*?Amen|$)/i);
        if (prayerMatch) {
          let prayerBody = cleanMarkdown(prayerMatch[1]).trim();
          prayerBody = prayerBody.replace(/^\s+|\s+$/g, '');
          
          // Ensure proper prayer format
          if (!/^Heavenly Father,?/i.test(prayerBody)) {
            prayerText += 'Heavenly Father,\n';
          }
          prayerText += prayerBody;
          
          // Ensure proper closing
          if (!/In Jesus'? Name,?\s*\n?Amen\.?$/i.test(prayerText)) {
            if (!/In Jesus'? Name,?/i.test(prayerText)) {
              prayerText += '\nIn Jesus\' Name,';
            }
            if (!/Amen\.?$/i.test(prayerText)) {
              prayerText += '\nAmen';
            }
          }
        } else {
          // Default prayer if none found
          prayerText = 'Heavenly Father,\nThank You for this time together.\nGuide me in Your truth today.\nForgive me for doubting Your path.\nHelp me trust Your plan.\nThank You for Your faithfulness.\nIn Jesus\' Name,\nAmen';
        }
        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Prayer:`, prayerText.substring(0, 100));

        devotional.days.push({
          id: `${Date.now()}-day-${dayNumber}`,
          dayNumber,
          title: cleanDayTitle,
          scripture,
          reflection,
          reflectionQuestions,
          prayer: prayerText,
          completed: false,
        });
      } catch (error) {
        console.error(`Error processing day ${dayNum}:`, error);
      }
    }

    if (devotional.days.length === 0) {
      devotional.days.push(createDefaultDay(1, true));
    }

    devotional.days.sort((a, b) => a.dayNumber - b.dayNumber);
    devotional.totalDays = Math.max(devotional.days.length, duration);

    return devotional;
  } catch (error) {
    console.error('Error in parseOpenAIResponse:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errorDevotional('Failed to parse devotional content.', playbookId, userInput);
  }
}

/**
 * Main server handler
 */
serve(async (req: Request): Promise<Response> => {
  const createErrorResponse = (status: number, error: string, details?: unknown) => {
    console.error(`Error ${status}:`, error, details);
    return new Response(
      JSON.stringify({
        error,
        details: (details && typeof details === 'object' && 'message' in details) ? String((details as { message: unknown }).message) : String(details),
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  };

  const logRequest = (req: Request, body?: unknown) => {
    console.log('=== Request Details ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    if (body) console.log('Body:', JSON.stringify(body, null, 2));
    console.log('========================');
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  logRequest(req);

  if (req.method !== 'POST') {
    return createErrorResponse(405, 'Method not allowed', 'hustle and bustle - Only POST requests are accepted');
  }

  interface DevotionalRequestBody {
    duration?: number;
    playbookId?: string;
    userInput?: string;
    [key: string]: unknown;
  }
  let requestBody: DevotionalRequestBody;
  try {
    requestBody = await req.json();
    console.log('Request body parsed successfully');
  } catch (error) {
    return createErrorResponse(400, 'Invalid request body', error);
  }

  logRequest(req, requestBody);

  const { duration, playbookId, userInput } = requestBody;

  if (!duration || typeof duration !== 'number' || duration < 1 || duration > 7) {
    return createErrorResponse(400, 'Invalid duration', 'Must be a number between 1 and 7.');
  }

  const prompt = `
You are a compassionate, biblically grounded devotional writer, an expert in Bible knowledge, and a follower of Christ who prioritizes Jesus above all. Create a ${duration}-day devotional based on the user input: "${userInput || 'spiritual growth'}" and playbook content (Truth in Love, Action Steps, Affirmations, Bible verse, Challenge card). Use less common scriptures unless none are suitable.

${duration > 1 ? 'SERIES TITLE:' : 'DEVOTIONAL TITLE:'}
[Create a unique title under 32 characters, inspired by the theme, not user input. Avoid generic titles like "Devotional" or "Daily Devotional". Examples: "Finding Peace", "Steadfast Faith".]

DESCRIPTION:
[One sentence describing the ${duration}-day journey, e.g., "A ${duration}-day journey exploring how prayer brings peace."]

${duration > 1
  ? Array.from({ length: duration }, (_, i) => `
DAY ${i + 1}:
DAILY TITLE: [Unique title under 32 characters, distinct from series title]
SCRIPTURE: "[Full verse text]" - [BOOK CHAPTER:VERSE]
DAILY REFLECTION: [200-300 words, empathetic, Christ-centered, with short paragraphs (2-4 sentences, line breaks). Follow the series arc (Day ${i + 1}: ${['Problem', 'Healing', 'Hope'][i] || `Step ${i + 1}`}). Acknowledge the struggle, share biblical truth, offer practical steps, highlight God's character, end with hope.]
REFLECTION QUESTIONS:
1. [Personal, Christ-centered question]
2. [God’s character-focused question]
3. [Practical, actionable question]
PRAYER:
Heavenly Father,
[1-2 sentences of adoration]
[1 sentence of confession]
[1-2 sentences of petition]
[1 sentence of thanksgiving]
In Jesus’ Name,
Amen
`).join('\n')
  : `
DAY 1:
DAILY TITLE: [Same as devotional title]
SCRIPTURE: "[Full verse text]" - [BOOK CHAPTER:VERSE]
DAILY REFLECTION: [200-300 words, empathetic, Christ-centered, with short paragraphs (2-4 sentences, line breaks). Acknowledge the struggle, share biblical truth, offer practical steps, highlight God's character, end with hope.]
REFLECTION QUESTIONS:
1. [Personal, Christ-centered question]
2. [God’s character-focused question]
3. [Practical, actionable question]
PRAYER:
Heavenly Father,
[1-2 sentences of adoration]
[1 sentence of confession]
[1-2 sentences of petition]
[1 sentence of thanksgiving]
In Jesus’ Name,
Amen
`}

CATEGORY:
2-3 specific AI-generated tags, e.g., "Peace, Trust, Healing", based on theme. Avoid "General".
[AI-generated category tag 1]
[AI-generated category tag 2]
[AI-generated category tag 3 (if applicable)]

${duration > 1 ? `
SERIES ARC GUIDE:
${duration === 3 ? `
- Day 1: Problem - Acknowledge the struggle
- Day 2: Healing - Biblical perspective
- Day 3: Hope - Resolution and application
` : duration === 5 ? `
- Day 1: Awareness - Identify the struggle
- Day 2: Trust - God’s character
- Day 3: Healing - Biblical foundation
- Day 4: Action - Practical steps
- Day 5: Renewal - Hopeful commitment
` : `
- Day 1: Problem - Face the struggle
- Day 2: Trust - God’s faithfulness
- Day 3: Growth - Spiritual development
- Day 4: Action - Practical steps
- Day 5: Community - Connection with others
- Day 6: Renewal - Changed perspective
- Day 7: Celebration - God’s promises
`}` : ''}

Follow this format strictly. Titles must be under 32 characters. Scripture reference in uppercase, e.g., "Verse text" - JOHN 3:16. Prayer must use exact line-break structure. Categories must be specific and relevant.
`;

  try {
    console.log('Making OpenAI API request...');
    const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!openAIRes.ok) {
      const err = await openAIRes.text();
      console.error('OpenAI API error status:', openAIRes.status);
      console.error('OpenAI API error response:', err);
      return createErrorResponse(openAIRes.status, 'Error from OpenAI API', err);
    }

    const aiData = await openAIRes.json();
    console.log('OpenAI API response received:', JSON.stringify(aiData, null, 2));
    const devotional = parseOpenAIResponse(aiData, duration, playbookId, userInput);
    return new Response(JSON.stringify(devotional), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return createErrorResponse(500, 'Internal server error', error);
  }
});