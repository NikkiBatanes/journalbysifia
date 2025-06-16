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
    const message = firstChoice?.message as Record<string, unknown> | undefined;
    const content = (message?.content as string) || '';
    if (!content) return errorDevotional('No content found in AI response.', playbookId, userInput);

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

    // Extract title from DEVOTIONAL TITLE, SERIES TITLE, or TITLE (with or without **/#)
    const titleMatch = content.match(/^(?:[#*\s]*)?(DEVOTIONAL TITLE|SERIES TITLE|TITLE):\s*\n?([^\n]+)/im);
    devotional.title = titleMatch ? cleanMarkdown(titleMatch[2]).trim().slice(0, 32) : 'Daily Devotional';

    // Extract description (with or without **/#)
    const descMatch = content.match(/^(?:[#*\s]*)?DESCRIPTION:\s*\n?([^\n]+)/im);
    devotional.description = descMatch 
      ? cleanMarkdown(descMatch[1].trim())
      : `A ${duration}-day journey to deepen your faith.`;

    // Extract categories (with or without **/#)
    const catMatch = content.match(/^(?:[#*\s]*)?CATEGORY:\s*\n?([^\n]+)/im);
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

    // Extract days from markdown format with **, ###, ####, or plain colon
    const dayRegex = /^(?:[#*]{2,4}\s*|###\s*|####\s*)?DAY (\d+):\s*\n?([\s\S]*?)(?=^(?:[#*]{2,4}\s*|###\s*|####\s*)?DAY \d+:|^(?:[#*\s]*)?CATEGORY:|$)/gim;
    let dayMatches: Array<[unknown, string, string]> = [];
    let match: RegExpExecArray | null;
    const foundDayHeaders: string[] = [];
    while ((match = dayRegex.exec(content)) !== null) {
      const dayNum = match[1];
      const dayContent = match[2];
      foundDayHeaders.push(match[0].split('\n')[0]);
      dayMatches.push([null, dayNum, dayContent]);
    }
    console.log('[DEVOTIONAL PARSER] Days parsed:', dayMatches.length, 'Headers:', foundDayHeaders);
    if (dayMatches.length === 0 && duration === 1) {
      // fallback for single-day devotionals
      const singleDayMatch = content.match(/^(?:[#*\s]*)?DAY 1:[\s\S]*?(?:DAILY TITLE:|\*\*DAILY TITLE:\*\*)[\s\S]*?(?:SCRIPTURE:|\*\*SCRIPTURE:\*\*)[\s\S]*?(?:DAILY REFLECTION:|\*\*DAILY REFLECTION:\*\*)[\s\S]*?(?:REFLECTION QUESTIONS:|\*\*REFLECTION QUESTIONS:\*\*)[\s\S]*?(?:PRAYER:|\*\*PRAYER:\*\*)/i);
      if (singleDayMatch) dayMatches = [[null, '1', singleDayMatch[0]]];
      console.log('[DEVOTIONAL PARSER] Fallback single day triggered:', !!singleDayMatch);
    }

    for (const [, dayNum, dayContent] of dayMatches) {
      try {
        const dayNumber = parseInt(dayNum, 10);
        
        // Extract day title (with or without **/#, allow optional newline/space after colon)
        const dayTitleMatch = dayContent.match(/(?:[#*\s]*)?DAILY TITLE:\s*(?:\n+)?([^\n]+)/i);
        console.log('[DEVOTIONAL PARSER] DayTitleMatch:', dayTitleMatch ? dayTitleMatch[1] : null);
        const dayTitle = duration > 1
          ? (dayTitleMatch ? dayTitleMatch[1] : `Day ${dayNumber}`)
          : devotional.title;
        const cleanDayTitle = cleanMarkdown(dayTitle).trim().slice(0, 32);

        // Extract scripture (with or without **/#, allow same-line and flexible reference, allow optional newline/space after colon)
        const scriptureMatch = dayContent.match(/(?:[#*\s]*)?SCRIPTURE:\s*(?:\n+)?"?([^"\n]+?)"?\s*-\s*([^\n]+)/i);
        console.log('[DEVOTIONAL PARSER] ScriptureMatch:', scriptureMatch ? [scriptureMatch[1], scriptureMatch[2]] : null);
        const scripture = scriptureMatch
          ? {
              text: cleanMarkdown(scriptureMatch[1]).trim(),
              reference: cleanMarkdown(scriptureMatch[2]).trim(),
            }
          : {
              text: 'Your word is a lamp to my feet and a light to my path.',
              reference: 'PSALM 119:105',
            };

        // Extract reflection (with or without **/#, allow optional newline/space after colon)
        const reflectionMatch = dayContent.match(/(?:[#*\s]*)?DAILY REFLECTION:\s*(?:\n+)?([\s\S]*?)(?=(?:[#*\s]*)?REFLECTION QUESTIONS:|(?:[#*\s]*)?PRAYER:|$)/i);
        console.log('[DEVOTIONAL PARSER] ReflectionMatch:', reflectionMatch ? (reflectionMatch[1] || reflectionMatch[0]) : null);
        let reflection = '';
        if (reflectionMatch) {
          // For g flag, reflectionMatch[1] may be undefined, so fallback to [0] and strip header
          let reflectionRaw = reflectionMatch[1] || reflectionMatch[0].replace(/^(?:[#*\s]*)?DAILY REFLECTION:\s*/i, '');
          reflection = cleanMarkdown(reflectionRaw).trim();
          // If there are no double newlines, insert after every 2 sentences
          if (!/\n{2,}/.test(reflection)) {
            // Split by sentence (naive: period/question/exclamation followed by space or end)
            const sentences = reflection.split(/(?<=[.!?])\s+/);
            const paragraphs = [];
            for (let i = 0; i < sentences.length; i += 2) {
              paragraphs.push(sentences.slice(i, i + 2).join(' '));
            }
            reflection = paragraphs.join('\n\n');
          } else {
            // Just normalize double newlines
            reflection = reflection.replace(/\n{2,}/g, '\n\n');
          }
        }

        // Extract questions (with or without **/#, allow optional newline/space after colon)
        const questionsMatch = dayContent.match(/(?:[#*\s]*)?REFLECTION QUESTIONS:\s*(?:\n+)?([\s\S]*?)(?=(?:[#*\s]*)?PRAYER:|$)/i);
        console.log('[DEVOTIONAL PARSER] QuestionsMatch:', questionsMatch ? (questionsMatch[1] || questionsMatch[0]) : null);
        let questionsRaw = '';
        if (questionsMatch) {
          questionsRaw = questionsMatch[1] || questionsMatch[0].replace(/^(?:[#*\s]*)?REFLECTION QUESTIONS:\s*/i, '');
        }
        const reflectionQuestions = questionsRaw
          ? questionsRaw
              .split('\n')
              .map((q) => q.trim())
              .filter((q) => q && q.match(/^\d+\./))
              .map((q, i) => ({
                id: `q${i + 1}`,
                text: cleanMarkdown(q.replace(/^\d+\.\s*/, '')).trim(),
              }))
          : [
              { id: 'q1', text: 'What stood out to you today?' },
              { id: 'q2', text: 'How can you apply this to your life?' },
              { id: 'q3', text: 'How does this point you to Christ?' },
            ];

        // Extract prayer (with or without **/#, allow optional newline/space after colon)
        const prayerMatch = dayContent.match(/(?:[#*\s]*)?PRAYER:\s*(?:\n+)?([\s\S]*?)(?=In Jesus'? Name,?\s*?Amen|$)/i);
        console.log('[DEVOTIONAL PARSER] PrayerMatch:', prayerMatch ? (prayerMatch[1] || prayerMatch[0]) : null);
        let prayerText = '';
        if (prayerMatch) {
          let prayerBody = cleanMarkdown(prayerMatch[1] || prayerMatch[0].replace(/^(?:[#*\s]*)?PRAYER:\s*/i, '')).trim();
          // Remove leading/trailing blank lines
          prayerBody = prayerBody.replace(/^\s+|\s+$/g, '');

          // Only prepend 'Heavenly Father,' if not present
          if (!/^Heavenly Father,?/i.test(prayerBody)) {
            prayerText += 'Heavenly Father,\n';
          }
          prayerText += prayerBody;

          // Only append 'In Jesus' Name,\nAmen' if not present
          if (!/In Jesus'? Name,?\s*\n?Amen\.?$/i.test(prayerText)) {
            if (!/In Jesus'? Name,?/i.test(prayerText)) {
              prayerText += '\nIn Jesus\' Name,';
            }
            if (!/Amen\.?$/i.test(prayerText)) {
              prayerText += '\nAmen';
            }
          }
        } else {
          prayerText = 'Heavenly Father,\n';
          prayerText += 'Thank You for this time together.\n';
          prayerText += 'Guide me in Your truth today.\n';
          prayerText += 'Forgive me for doubting Your path.\n';
          prayerText += 'Help me trust Your plan.\n';
          prayerText += 'Thank You for Your faithfulness.\n';
          prayerText += 'In Jesus\' Name,\nAmen';
        }
        const prayer = prayerText;

        devotional.days.push({
          id: `${Date.now()}-day-${dayNumber}`,
          dayNumber,
          title: cleanDayTitle,
          scripture,
          reflection,
          reflectionQuestions,
          prayer,
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
[2-3 specific AI-generated tags, e.g., "Peace, Trust, Healing", based on theme. Avoid "General".]

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