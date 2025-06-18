/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { devotionalAdvisorPersona, enforcePersona, applyPersonaContext } from './persona.config.ts';

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
  categories: string[];
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


interface DevotionalRequestBody {
  duration?: number;
  playbookId?: string;
  userInput?: string;
  userName?: string;
}

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
  categories: string[];
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
    if (value === null || value === undefined) {return '';}
    if (typeof value === 'string') {return value;}
    if (typeof value.toString === 'function') {return value.toString();}
    return '';
  };

  try {
    const str = safeString(text);
    if (typeof str !== 'string') {
      console.warn('cleanMarkdown: Failed to convert input to string. Type:', typeof text);
      return '';
    }
    if (!str.trim()) {return '';}

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
      : 'Heavenly Father,\n\nThank You for Your guiding word.\nForgive me for doubting Your path.\nGuide me in Your truth today.\nThank You for Your faithfulness.\n\nIn Jesus’ Name, Amen',
    completed: false,
  };
}

/**
 * Safely parses the OpenAI response into a structured devotional format
 */
function parseOpenAIResponse(aiData: unknown, duration: number, playbookId?: string, userInput?: string): Devotional {
  const errorDevotional = (msg: string, _pbId?: string, _uInput?: string): Devotional => ({
    id: `${Date.now()}`,
    title: 'Error Generating Devotional',
    description: msg,
    category: 'Error',
    categories: ['Error'],
    days: [createDefaultDay(1, true)],
    currentDay: 1,
    totalDays: duration || 1,
    progress: 0,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    playbookId: _pbId,
    userInput: _uInput || '',
  });

  try {
    const response = aiData as Record<string, unknown>;
    const choices = Array.isArray(response?.choices) ? response.choices : [];
    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    const content = (firstChoice?.message as Record<string, unknown> | undefined)?.content as string || '';
    if (!content) {return errorDevotional('No content found in AI response.', playbookId, userInput);}

    // Log the raw content for debugging
    console.log('[DEVOTIONAL PARSER] Raw content start:', JSON.stringify(content).substring(0, 500) + (content.length > 500 ? '...' : ''));

    const devotional: Devotional = {
      id: `${Date.now()}`,
      title: '',
      description: '',
      category: '',
      categories: [], // Add categories: [] here
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

    // Extract title - handle multiple possible formats
    let title = 'Daily Devotional';
    const titleMatches = [
      content.match(/SERIES TITLE:\s*\n([^\n]+)/i),  // Plain format
      content.match(/\*\*SERIES TITLE:\*\*\s*\n([^\n]+)/i),  // Markdown format
      content.match(/^#\s*([^\n]+)/),  // Markdown H1
      content.match(/^TITLE:\s*\n([^\n]+)/i),  // Simple TITLE: format
      content.match(/DEVOTIONAL TITLE:\s*([^\n]+)/i),  // DEVOTIONAL TITLE: format
      content.match(/^([^\n]{5,64})(?=\n|$)/),  // First line that's 5-64 chars long
    ];

    for (const match of titleMatches) {
      if (match && match[1]) {
        title = cleanMarkdown(match[1]).trim().slice(0, 64);
        if (title) {break;}
      } else if (match && match[0]) {
        // Handle patterns where the entire match is the title
        title = cleanMarkdown(match[0]).trim().slice(0, 64);
        if (title) {break;}
      }
    }

    // Clean up common title artifacts
    title = title
      .replace(/^[\s\d\-*•.]+/, '')  // Remove leading bullets/numbers
      .replace(/[\]["]/g, '')         // Remove brackets and quotes
      .trim();

    // Fallback to user input if no valid title found
    if (!title || title.toLowerCase() === 'daily devotional') {
      title = (userInput || 'Daily Devotional')
        .split('.')[0]
        .replace(/[^\w\s-]/g, '')
        .trim()
        .slice(0, 64);
    }

    devotional.title = title;
    console.log('[DEVOTIONAL PARSER] Extracted title:', title);

    // Extract description - handle multiple possible formats
    let description = `A ${duration}-day journey to deepen your faith.`;
    const descMatches = [
      content.match(/DESCRIPTION:\s*\n([\s\S]*?)(?=\n\n|\n---|$)/i),
      content.match(/\*\*DESCRIPTION:\*\*\s*\n([\s\S]*?)(?=\n\n|\n---|$)/i),
      content.match(/^[^\n]+\n([\s\S]*?)(?=^#|^\*\*|$)/m),
    ];

    for (const match of descMatches) {
      if (match && match[1]) {
        const desc = cleanMarkdown(match[1]).trim();
        if (desc) {
          description = desc;
          break;
        }
      }
    }
    devotional.description = description;
    console.log('[DEVOTIONAL PARSER] Extracted description:', description);

    // Extract up to 3 categories/tags from CATEGORY section
    let categories: string[] = [];
    const catMatch = content.match(/CATEGORY:\s*([\s\S]*?)(?=\n{2,}|$)/i);
    if (catMatch && catMatch[1]) {
      categories = catMatch[1]
        .split(/\n|,|;/)
        .map((c) => cleanMarkdown(c).trim())
        .filter(Boolean)
        .slice(0, 3);
    }
    devotional.categories = categories;
    console.log('[DEVOTIONAL PARSER] Extracted categories:', categories);

    // Extract categories
    devotional.category = categories.join(', ');
    console.log('[DEVOTIONAL PARSER] Extracted category:', devotional.category);

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

        // Extract day title - handle multiple formats
        let dayTitle = `Day ${dayNumber}`; // Default title
        const seriesTitle = devotional.title.toLowerCase();

        // First, try to find a suitable title in the day content
        const dayTitleMatches = [
          // Look for patterns like "DAY 1: Title" or "DAY 1 - Title"
          dayContent.match(/DAY\s+\d+[.:-]?\s*([^\n]+)/i),
          // Look for TITLE: format
          dayContent.match(/TITLE:\s*([^\n]+)/i),
          // Look for markdown headers
          dayContent.match(/^#+\s*([^\n]+)/m),
          // Look for bold text that might be a title
          dayContent.match(/\*\*([^*]+)\*\*/),
          // Look for any line that might be a title
          dayContent.match(/^(.+?)\n\n/),
          // Look for lines that look like titles (sentence case, 3-10 words)
          dayContent.match(/^([A-Z][^\n.!?]{10,60}[^\n.!?])(?=\n|$)/m),
        ];

        // Try each pattern until we find a suitable title
        for (const titleMatch of dayTitleMatches) {
          if (titleMatch && titleMatch[1]) {
            let candidate = cleanMarkdown(titleMatch[1])
              .trim()
              .replace(/^[\d.:-\s*#]+/, '') // Remove any leading numbers, colons, dashes, or special chars
              .replace(/[\]["]/g, '') // Remove brackets and quotes
              .trim();

            // Additional cleaning for common patterns
            candidate = candidate
              .replace(/^[\s\d\-*•.]+/, '')  // Remove leading bullets/numbers
              .replace(/[\]["]/g, '')         // Remove brackets and quotes
              .trim();

            // Basic validation
            if (candidate &&
                candidate.length > 3 &&
                candidate.length <= 64 &&
                !candidate.toLowerCase().includes(seriesTitle) &&
                !candidate.match(/^(day\s*\d+|devotional|title|scripture|reflection|prayer)/i) &&
                !candidate.match(/^[^a-z]+$/) && // Not all caps
                candidate.split(' ').length <= 10) { // Not too long
              dayTitle = candidate;
              break;
            }
          }
        }

        // If the extracted title is too similar to the series title, use a default
        if (dayTitle.toLowerCase() === seriesTitle ||
            dayTitle.toLowerCase().includes(seriesTitle) ||
            seriesTitle.includes(dayTitle.toLowerCase())) {
          dayTitle = `Day ${dayNumber}`;
        }

        // Ensure the title isn't too long
        dayTitle = dayTitle.slice(0, 32).trim();

        // Ensure title is meaningful, not too long, and not the same as series title
        const cleanDayTitle = (() => {
          // Clean and trim the title
          let result = cleanMarkdown(dayTitle).trim().slice(0, 64);

          // Fallback to default if empty or too generic
          if (!result || result === `Day ${dayNumber}` || result.length > 64) {
            result = `Day ${dayNumber}`;
          }

          // Ensure it's not the same as the series title
          const seriesTitleLower = devotional.title.toLowerCase();
          if (result.toLowerCase() === seriesTitleLower) {
            result = `Day ${dayNumber}: ${result}`.slice(0, 64);
          }

          return result;
        })();
        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Title:`, cleanDayTitle);

        // Extract scripture (match plain format, allow curly quotes, dash, and whitespace)
        let scriptureText = 'Your word is a lamp to my feet and a light to my path.';
        let scriptureRef = 'PSALM 119:105';
        // Match: SCRIPTURE:  \n“Be still, and know that I am God.” - PSALM 46:10
        // Allow both curly and straight quotes, and optional spaces
        const scriptureMatch = dayContent.match(/SCRIPTURE:\s*\n?[“"]?([^”"\n]+)[”"]?\s*-\s*([A-Z0-9 ]+:[0-9]+(?:-[0-9]+)?)/i);
        if (scriptureMatch && scriptureMatch[1] && scriptureMatch[2]) {
          scriptureText = scriptureMatch[1].trim();
          scriptureRef = scriptureMatch[2].trim();
        }
        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Scripture:`, { text: scriptureText, reference: scriptureRef });
        const scripture = {
          text: cleanMarkdown(scriptureText),
          reference: cleanMarkdown(scriptureRef),
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

        // Extract prayer text
        let prayerText = '';
        const prayerMatch = dayContent.match(/PRAYER:[\s\n]*([\s\S]*?)(?=In Jesus' Name|$)/i);
        if (prayerMatch && prayerMatch[1]) {
          let prayerBody = cleanMarkdown(prayerMatch[1])
            .trim()
            .replace(/^[\s\d\-*•.]+/, '')  // Remove leading bullets/numbers
            .replace(/[\]["]/g, '')         // Remove brackets and quotes
            .trim();

          // Remove any existing 'Heavenly Father' from the prayer body
          prayerBody = prayerBody.replace(/^Heavenly Father[,\s]*/i, '');
          
          // Format prayer with compact spacing - no extra space after body
          prayerText = `Heavenly Father,\n${prayerBody}\nIn Jesus' Name, Amen`;
        } else {
          // Default prayer with compact spacing - no extra space after body
          prayerText = 'Heavenly Father,\nThank You for this time together. Guide me in Your truth today. Forgive me for doubting Your path. Help me trust Your plan. Thank You for Your faithfulness.\nIn Jesus\' Name, Amen';
        }
        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Prayer:`, prayerText.substring(0, 100));

        // Clean up day title if needed
          const finalDayTitle = dayTitle || `Day ${dayNum}`;

          devotional.days.push({
            id: `${Date.now()}-day-${dayNumber}`,
            dayNumber,
            title: finalDayTitle,
            scripture: {
              text: scriptureText || 'The Lord is my shepherd, I lack nothing.',
              reference: scriptureRef || 'Psalm 23:1',
            },
            reflection: reflection || 'Reflect on God\'s word today.',
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

  const logRequest = (request: Request, body?: unknown) => {
    console.log('=== Request Details ===');
    console.log('Method:', request.method);
    console.log('URL:', request.url);
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    if (body) {console.log('Body:', JSON.stringify(body, null, 2));}
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

  let requestBody: DevotionalRequestBody;
  try {
    requestBody = await req.json();
    console.log('Request body parsed successfully');

    // Validate required fields
    if (!requestBody.userInput) {
      return createErrorResponse(400, 'Missing required field: userInput');
    }
  } catch (error) {
    return createErrorResponse(400, 'Invalid request body', error instanceof Error ? error.message : 'Unknown error');
  }

  const { duration = 1, playbookId, userInput = '', userName = 'User' } = requestBody;

  if (typeof duration !== 'number' || duration < 1 || duration > 7) {
    return createErrorResponse(400, 'Invalid duration', 'Must be a number between 1 and 7.');
  }

  try {
    applyPersonaContext(devotionalAdvisorPersona, userInput);

    const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: devotionalAdvisorPersona.systemPrompt,
          },
          {
            role: 'user',
            content: `User: ${userName}\nRequest: ${userInput}\nDuration: ${duration} day${duration > 1 ? 's' : ''}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!openAIRes.ok) {
      const error = await openAIRes.text();
      console.error('OpenAI API Error:', error);
      return createErrorResponse(openAIRes.status, 'Error from OpenAI API', error);
    }

    const aiData = await openAIRes.json();

    let content = aiData.choices?.[0]?.message?.content || '';
    if (content) {
      content = enforcePersona(content, devotionalAdvisorPersona);
    }

    const devotional = parseOpenAIResponse(
      { choices: [{ message: { content } }] },
      duration,
      playbookId,
      userInput
    );

    return new Response(JSON.stringify(devotional), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  } catch (error) {
    console.error('Error generating devotional:', error);
    return createErrorResponse(
      500,
      'Failed to generate devotional',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});
