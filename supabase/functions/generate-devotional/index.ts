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
  // Helper function to safely convert to string
  const safeString = (value: unknown): string => {
    if (value === null || value === undefined) {return '';}
    if (typeof value === 'string') {return value;}
    if (typeof value.toString === 'function') {return value.toString();}
    return '';
  };

  try {
    // Convert to string safely
    const str = safeString(text);

    // If we don't have a string after conversion, log and return empty string
    if (typeof str !== 'string') {
      console.warn('cleanMarkdown: Failed to convert input to string. Type:', typeof text);
      return '';
    }

    // If empty, return early
    if (!str.trim()) {return '';}

    // Log the input for debugging (be careful with sensitive data in production)
    console.log('cleanMarkdown input:', JSON.stringify(str).substring(0, 200) + (str.length > 200 ? '...' : ''));

    // Apply markdown cleaning operations
    let result = str;
    try {
      result = result
        .replace(/\*\*|__/g, '')  // Remove bold/italic markers
        .replace(/\*|_/g, '')      // Remove single asterisks/underscores
        .replace(/^[-*]\s*/gm, '')  // Remove list markers
        .replace(/^\s*[-*_]{3,}\s*$/gm, '') // Remove markdown dividers (---, ***, ___) on their own line
        .replace(/^#{1,6}\s*/gm, '') // Remove markdown headers (#, ##, etc.)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links but keep the text
        .replace(/`{1,3}([^`]+)`{1,3}/g, '$1') // Remove inline code blocks
        .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
        .replace(/\s+\n/g, '\n') // Remove trailing whitespace before newlines
        .replace(/--+/g, '') // Remove double or more dashes
        .replace(/\s+/g, ' ') // Normalize all whitespace to single spaces
        .trim();
    } catch (replaceError) {
      console.error('Error in replace operations:', replaceError);
      // If replace fails, try to return the original string
      return str.trim();
    }

    return result;
  } catch (error) {
    console.error('Unexpected error in cleanMarkdown:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      inputType: typeof text,
      inputValue: text,
    });
    // Return empty string as a fallback
    return '';
  }
}

/**
 * Safely parses the OpenAI response into a structured devotional format
 */
function parseOpenAIResponse(aiData: unknown, duration: number, playbookId?: string, userInput?: string): Devotional {
  const timestamp = Date.now();

  // Helper function to create an error day
  const createErrorDay = (dayNumber: number): never => {
    throw new Error(`Failed to create devotional day ${dayNumber}: Missing required scripture data`);
  };

  // Helper function to process reflection questions from content
  const processReflectionQuestions = (content: string): ReflectionQuestion[] => {
    const questionsMatch = content.match(/REFLECTION QUESTIONS:\s*([\s\S]*?)(?=PRAYER:|$)/i);

    if (questionsMatch && questionsMatch[1]) {
      try {
        const questionsContent = questionsMatch[1].trim();
        const questionLines = questionsContent
          .split('\n')
          .filter(Boolean) // Remove empty lines
          .map(q => {
            // Safely handle the question text
            const questionText = cleanMarkdown(q.trim());
            // Remove any leading numbers or bullets
            return questionText.replace(/^\s*\d+[.)]\s*|^\s*[-*]\s*/, '');
          })
          .filter(q => q.length > 0); // Remove any empty questions after cleaning

        // Convert to the expected format
        return questionLines.map((text, index) => ({
          id: `q${index + 1}`,
          text: text || `Question ${index + 1}`,
        }));
      } catch (error) {
        console.error('Error processing reflection questions:', error);
        // Return default questions if parsing fails
        return [];
      }
    }

    // Default questions if no questions found
    return [
      { id: 'q1', text: 'What stood out to you from today\'s scripture?' },
      { id: 'q2', text: 'How can you apply this to your life today?' },
    ];
  };

  // Main function logic
  try {
    // Log the raw AI data for debugging (be careful with sensitive data)
    console.log('Raw AI data type:', typeof aiData);

    // DEBUG: Confirm function is triggered
    console.log('FUNCTION TRIGGERED');
    // Safely extract content with type checking
    const response = aiData as Record<string, unknown>;
    const choices = Array.isArray(response?.choices) ? response.choices : [];
    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    const message = firstChoice?.message as Record<string, unknown> | undefined;
    const content = (message?.content as string) || '';

    // DEBUG: Print the full AI content for troubleshooting
    console.log('RAW AI CONTENT:', JSON.stringify(content));

    console.log('Extracted content length:', content.length);
    console.log('Content preview:', content.substring(0, 200) + (content.length > 200 ? '...' : ''));

    // Initialize devotional object with basic information
    const devotional: Devotional = {
      id: timestamp.toString(),
      title: 'Daily Devotional',
      description: 'A daily devotional for spiritual growth',
      category: 'General',
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

    if (!content) {
      throw new Error('No content found in AI response');
    }

    // Try to extract title and description from the content
    try {
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        // Remove any title prefixes like 'DEVOTIONAL TITLE:', 'TITLE:', 'SERIES TITLE:'
        const titleLine = lines[0]
          .replace(/^(?:DEVOTIONAL|SERIES)?\s*TITLE:\s*/i, '') // Fixed regex to properly capture SERIES TITLE:
          .replace(/^"(.*)"$/, '$1') // Remove surrounding quotes if present
          .trim();
        devotional.title = cleanMarkdown(titleLine);
        
        // Debug log to verify title extraction
        console.log('Original title line:', lines[0]);
        console.log('Extracted title:', devotional.title);
      }
      if (lines.length > 1) {
        // Extract description, removing any prefix
        const descLine = lines[1].replace(/^DESCRIPTION:\s*/i, '').trim();
        devotional.description = cleanMarkdown(descLine);
      }
    } catch (e) {
      console.error('Error extracting title/description:', e);
    }

    // Extract days from content
    try {
      const dayMatches = Array.from(content.matchAll(/DAY (\d+):\s*([\s\S]*?)(?=DAY \d+:|$)/gi));

      for (const dayMatch of dayMatches) {
        try {
          const dayNumber = parseInt(dayMatch[1], 10);
          const dayContent = dayMatch[2].trim();
          // DEBUG: Log the raw day content for troubleshooting
          console.log('RAW DAY CONTENT:', JSON.stringify(dayContent));

          // Robust extraction of day title and scripture
          let dayTitle = `Day ${dayNumber}`;
          let scriptureText = '';
          let scriptureRef = '';

          // 1. Try to match TITLE and SCRIPTURE on separate lines
          const titleLine = dayContent.match(/TITLE:\s*([^\n]+)/i);
          if (titleLine) {
            // If SCRIPTURE is embedded in the title line, extract both
            if (/SCRIPTURE:/i.test(titleLine[1])) {
              const comboMatch = titleLine[1].match(/(.*?)\s*SCRIPTURE:\s*"([^\"]+)"\s*-\s*([^\n]+)/i);
              if (comboMatch) {
                dayTitle = cleanMarkdown(comboMatch[1].trim());
                scriptureText = cleanMarkdown(comboMatch[2].trim());
                scriptureRef = cleanMarkdown(comboMatch[3].trim());
              } else {
                // If can't parse, just use as title
                dayTitle = cleanMarkdown(titleLine[1].replace(/SCRIPTURE:.*/, '').trim());
              }
            } else {
              dayTitle = cleanMarkdown(titleLine[1].trim());
            }
          }

          // 2. Try to match SCRIPTURE section followed by two quoted or unquoted lines (verse then reference)
          if (!scriptureText || !scriptureRef) {
            const scriptureSectionMatch = dayContent.match(/SCRIPTURE:\s*\n?["“]?([^"\n]+)["”]?\s*\n["“]?([^"\n]+)["”]?/i);
            if (scriptureSectionMatch) {
              scriptureText = cleanMarkdown(scriptureSectionMatch[1].trim());
              scriptureRef = cleanMarkdown(scriptureSectionMatch[2].trim());
            }
          }
          // 3. Try to match SCRIPTURE: "verse" - reference (flexible, allows whitespace and line breaks)
          if (!scriptureText || !scriptureRef) {
            const scriptureFlexibleMatch = dayContent.match(/SCRIPTURE:\s*["“]?([^"\n]+)["”]?\s*-\s*([^\n]+)/i);
            if (scriptureFlexibleMatch) {
              scriptureText = cleanMarkdown(scriptureFlexibleMatch[1].trim());
              scriptureRef = cleanMarkdown(scriptureFlexibleMatch[2].trim());
            }
          }
          // 4. Fallback: If still missing, try to find any quoted string and a reference-like pattern
          if (!scriptureText) {
            const quoteMatch = dayContent.match(/"([^\"]+)"/);
            if (quoteMatch) scriptureText = cleanMarkdown(quoteMatch[1].trim());
          }
          if (!scriptureRef) {
            const refMatch = dayContent.match(/([1-3]? ?[A-Za-z]+\s*\d{1,3}:\d{1,3}(-\d{1,3})?)/);
            if (refMatch) scriptureRef = cleanMarkdown(refMatch[1].trim().toUpperCase());
          }
          // 5. Final fallback
          if (!scriptureText) scriptureText = "God's word brings light and life to our hearts.";
          if (!scriptureRef) scriptureRef = 'PSALM 119:105';

          // Extract reflection
          const reflectionMatch = dayContent.match(/REFLECTION:\s*([\s\S]*?)(?=REFLECTION QUESTIONS:|PRAYER:|$)/i);
          const reflection = reflectionMatch ? cleanMarkdown(reflectionMatch[1].trim()) : '';

          // Process reflection questions
          const reflectionQuestions = processReflectionQuestions(dayContent);

          // Extract prayer
          let prayer = '';
          const prayerMatch = dayContent.match(/PRAYER:\s*([\s\S]*?)(?=DAY \d+:|$)/i);
          if (prayerMatch && prayerMatch[1]) {
            prayer = cleanMarkdown(prayerMatch[1].trim());
          }

          // Create and add the day to the devotional
          const day: DevotionalDay = {
            id: `${timestamp}-day-${dayNumber}`,
            dayNumber,
            title: dayTitle,
            scripture: {
              text: scriptureText,
              reference: scriptureRef.toUpperCase(),
            },
            reflection,
            reflectionQuestions: reflectionQuestions, // Corrected variable name
            prayer,
            completed: false,
          };

          devotional.days.push(day);

        } catch (dayError) {
          console.error(`Error processing day ${dayMatch[1] || 'unknown'}:`, dayError);
          // Skip this day if there's an error
        }
      }
    } catch (error) {
      console.error('Error processing days:', error);
      // If we can't parse the days, add a default day with an error message
      devotional.days.push(createDefaultDay(1, true));
    }

    // Ensure we have at least one day
    if (devotional.days.length === 0) {
      createErrorDay(1);
    }

    // Sort days by day number
    devotional.days.sort((a, b) => a.dayNumber - b.dayNumber);

    // Update the total days to match the actual number of days we have
    devotional.totalDays = Math.max(devotional.days.length, 1);

    return devotional;

  } catch (error) {
    console.error('Error in parseOpenAIResponse:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      inputData: aiData ? JSON.stringify(aiData).substring(0, 500) + '...' : 'No data',
    });

    // Return a default devotional with error information
    return {
      id: timestamp.toString(),
      title: 'Error Generating Devotional',
      description: 'There was an error generating your devotional. Please try again.',
      category: 'Error',
      days: [{
        id: `${timestamp}-day-1`,
        dayNumber: 1,
        title: 'Error',
        reflection: 'We encountered an error while generating your devotional. Please try again later.',
        scripture: {
          text: 'The Lord is my shepherd; I shall not want.',
          reference: 'PSALM 23:1'
        },
        reflectionQuestions: [
          { id: 'q1', text: 'What are you hoping to learn from this devotional?' },
          { id: 'q2', text: 'How can you trust God in times of difficulty?' },
        ],
        prayer: '',
        completed: false,
      }],
      currentDay: 1,
      totalDays: 1,
      progress: 0,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      playbookId,
      userInput,
    };
  }
}

// Helper function to create error responses
const createErrorResponse = (status: number, error: string, details?: any) => {
  console.error(`Error ${status}:`, error, details);
  return new Response(
    JSON.stringify({
      error,
      details: details?.message || String(details),
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

// Helper function to log request details
const logRequest = (req: Request, body?: any) => {
  console.log('=== Request Details ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  if (body) {
    console.log('Body:', JSON.stringify(body, null, 2));
  }
  console.log('========================');
};

serve(async (req: Request): Promise<Response> => {
  // Set CORS headers for preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  // Log the request
  logRequest(req);

  // Only allow POST requests
  if (req.method !== 'POST') {
    return createErrorResponse(405, 'Method not allowed', 'Only POST requests are accepted');
  }

  // Parse request body
  let requestBody: any;
  try {
    requestBody = await req.json();
    console.log('Request body parsed successfully');
  } catch (error) {
    return createErrorResponse(400, 'Invalid request body', error);
  }

  // Log the parsed request body
  console.log('Request body:', JSON.stringify(requestBody, null, 2));

  // Validate required fields
  if (!requestBody || typeof requestBody !== 'object') {
    return createErrorResponse(400, 'Invalid request body', 'Expected an object');
  }

  const { duration, playbookId, userInput } = requestBody;

  if (!duration || duration < 1 || duration > 7) {
    return new Response(JSON.stringify({ error: 'Invalid duration. Must be between 1 and 7 days.' }), { status: 400 });
  }

  // Compose prompt for OpenAI
  const prompt = `
You are a compassionate, biblically grounded devotional writer, an expert in Bible knowledge, a follower of Christ who loves Christ and puts Christ above all, creating a ${duration}-day devotional to help someone grow in their faith. 
The devotional should be based on the following user input: "${userInput || 'spiritual growth'}" and incorporate relevant spiritual guidance from the playbook content including Truth in Love, Action Steps, Affirmations, and Challenges.

Create a structured ${duration}-day devotional that follows this format:

${duration > 1 ? 'SERIES TITLE:' : 'DEVOTIONAL TITLE:'}
[${duration > 1 ? 'Create a meaningful, engaging title for the overall devotional series that encapsulates the theme' : 'Create a meaningful, engaging title for this single devotional'}]

CATEGORY:
[Choose ONE category that best fits this devotional: Prayer, Growth, Healing, Wisdom, Relationships, Purpose, Career, Finances, Mental Health, Parenting, Health]

DESCRIPTION:
[Write a brief 2-3 sentence description of what this devotional journey will help the reader accomplish]

For each day (${duration} days total), create the following structure:

DAY 1:
${duration > 1 ? 'TITLE:' : ''} ${duration > 1 ? '[Create a unique title for this specific day that differs from the series title]' : ''}
SCRIPTURE: "[Full Bible verse text]" - [Reference (book chapter:verse)] (Ensure the scripture text is enclosed in quotes, followed by a dash, then the reference)
REFLECTION: [Write a 150-250 word reflection that connects the Scripture to the user's situation, offers spiritual insight, and points to Jesus as the source of hope/strength/transformation. Include practical guidance that aligns with Truth in Love, Action Steps, Affirmations, or Challenges as appropriate.]
REFLECTION QUESTIONS:
1. [Question that encourages introspection]
2. [Question that encourages application]
3. [Question that encourages spiritual growth]
PRAYER: [Write a 50-100 word prayer addressing God directly, seeking His help for the specific situation, incorporating the theme and Scripture]

[Repeat the above structure for each day, from DAY 1 to DAY ${duration}]

Make sure each day builds on the previous one, creating a cohesive journey toward spiritual growth and practical application. Each day should have strategic purpose in helping the reader grow in their faith and address their specific situation. Ensure the scripture format is strictly followed: the verse text in quotes, followed by a dash, then the reference (e.g., "For God so loved the world..." - John 3:16).
`;

  // Validate required fields
  if (!duration || typeof duration !== 'number' || duration < 1 || duration > 7) {
    const error = 'Invalid duration. Must be a number between 1 and 7.';
    console.error(error);
    return new Response(JSON.stringify({ error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    const error = 'OpenAI API key not configured';
    console.error(error);
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('Calling OpenAI API...');
  let openAIRes;
  try {
    openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2500,
    }),
  });

  if (!openAIRes.ok) {
    const errorText = await openAIRes.text();
    console.error('OpenAI API error:', openAIRes.status, errorText);
    return new Response(JSON.stringify({
      error: 'Failed to generate devotional',
      details: errorText,
    }), {
      status: openAIRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const aiData = await openAIRes.json();
  console.log('OpenAI response received');

  try {
    const devotional = parseOpenAIResponse(aiData, duration, playbookId, userInput);
    console.log('Devotional generated successfully');
    return new Response(JSON.stringify(devotional), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
  } catch (parseError) {
    console.error('Error parsing OpenAI response:', parseError);
    return new Response(JSON.stringify({
      error: 'Failed to process devotional',
      details: parseError.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} catch (error) {
  console.error('Unexpected error:', error);
  return new Response(JSON.stringify({
    error: 'Internal server error',
    details: error.message,
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
});
