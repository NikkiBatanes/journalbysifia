import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

  // Helper function to create a default day
  const createDefaultDay = (dayNumber: number, isError = false): DevotionalDay => {
    if (isError) {
      return {
        id: `${timestamp}-day-${dayNumber}`,
        dayNumber,
        title: 'Welcome to Your Devotional',
        scripture: {
          text: 'Your word is a lamp for my feet, a light on my path.',
          reference: 'Psalm 119:105',
        },
        reflection: 'There was an error generating today\'s devotional. Please try again later.',
        reflectionQuestions: [
          { id: 'q1', text: 'What does this scripture mean to you?' },
          { id: 'q2', text: 'How can you apply this to your life today?' },
        ],
        prayer: '',
        completed: false,
      };
    }

    return {
      id: `${timestamp}-day-${dayNumber}`,
      dayNumber,
      title: 'Start Your Journey',
      scripture: {
        text: 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the LORD your God will be with you wherever you go.',
        reference: 'Joshua 1:9',
      },
      reflection: 'Welcome to your devotional journey. Take time each day to reflect on God\'s word and grow in your faith.',
      reflectionQuestions: [
        { id: 'q1', text: 'What are you hoping to gain from this devotional time?' },
        { id: 'q2', text: 'How can you make space for God in your daily routine?' },
      ],
      prayer: '',
      completed: false,
    };
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
        return [
          { id: 'q1', text: 'What stood out to you from today\'s scripture?' },
          { id: 'q2', text: 'How can you apply this to your life today?' },
        ];
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

    // Safely extract content with type checking
    const response = aiData as Record<string, unknown>;
    const choices = Array.isArray(response?.choices) ? response.choices : [];
    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    const message = firstChoice?.message as Record<string, unknown> | undefined;
    const content = (message?.content as string) || '';

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
        devotional.title = cleanMarkdown(lines[0]);
      }
      if (lines.length > 1) {
        devotional.description = cleanMarkdown(lines[1]);
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

          // Extract day details
          const dayTitleMatch = dayContent.match(/TITLE:\s*([\s\S]*?)(?=SCRIPTURE:|$)/i);
          const dayTitle = dayTitleMatch ? cleanMarkdown(dayTitleMatch[1].trim()) : `Day ${dayNumber}`;

          // Extract scripture - handle multiple formats
          let scriptureText = '';
          let scriptureRef = '';

          // Try to extract scripture section
          const scriptureSectionMatch = dayContent.match(/SCRIPTURE:([\s\S]*?)(?=REFLECTION:|$)/i);

          if (scriptureSectionMatch) {
            const scriptureContent = scriptureSectionMatch[1].trim();

            // Format 1: Reference first, then text (e.g., "John 3:16\nFor God so loved...")
            const format1Match = scriptureContent.match(/^([\w\s\d:,-]+)\n([\s\S]*)/);
            if (format1Match) {
              scriptureText = cleanMarkdown(format1Match[2].trim());
              scriptureRef = cleanMarkdown(format1Match[1].trim());
            }
            // Format 2: "text" - reference (e.g., "The Lord is my shepherd..." - Psalm 23:1)
            else {
              const format2Match = scriptureContent.match(/^\s*"([\s\S]*?)"\s*-\s*([^\n]+)/i);
              if (format2Match) {
                // Swap the order - reference first, then text
                scriptureText = cleanMarkdown(format2Match[1].trim());
                scriptureRef = cleanMarkdown(format2Match[2].trim());
              }
              // Format 3: reference - text (e.g., John 3:16 - For God so loved the world...)
              else if (scriptureContent.includes(' - ')) {
                const parts = scriptureContent.split(' - ');
                if (parts.length >= 2) {
                  scriptureText = cleanMarkdown(parts.slice(1).join(' - ').trim());
                  scriptureRef = cleanMarkdown(parts[0].trim());
                }
              }
            }
          }

          // If we still don't have both reference and text, try to extract from the combined string
          if ((!scriptureText || !scriptureRef) && scriptureSectionMatch) {
            const combined = scriptureSectionMatch[1].trim();
            // If it looks like a reference is at the start (e.g., "John 3:16 For God so loved...")
            const refMatch = combined.match(/^([\w\s\d:,-]+?)\s+([A-Z].*)/);
            if (refMatch) {
              if (!scriptureText) {scriptureText = cleanMarkdown(refMatch[2].trim());}
              if (!scriptureRef) {scriptureRef = cleanMarkdown(refMatch[1].trim());}
            }
          }

          // If we still don't have scripture, use default values
          if (!scriptureText || !scriptureRef) {
            scriptureText = scriptureText || 'The Lord is my shepherd, I lack nothing. He makes me lie down in green pastures, he leads me beside quiet waters, he refreshes my soul. He guides me along the right paths for his name\'s sake.';
            scriptureRef = scriptureRef || 'Psalm 23:1-3';
          }

          // Extract reflection
          const reflectionMatch = dayContent.match(/REFLECTION:\s*([\s\S]*?)(?=REFLECTION QUESTIONS:|$)/i);
          const reflection = reflectionMatch ? cleanMarkdown(reflectionMatch[1].trim()) : '';

          // Process reflection questions and extract prayer
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
              reference: scriptureRef.toUpperCase(), // Convert reference to uppercase as per example
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
      devotional.days.push(createDefaultDay(1));
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
        scripture: {
          text: 'God is our refuge and strength, an ever-present help in trouble.',
          reference: 'Psalm 46:1',
        },
        reflection: 'We encountered an error while generating your devotional. Please try again later.',
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
You are a compassionate biblically grounded devotional writer expert in Bible knowldge, a follower of Christ, who loves Christ, and puts Christ above all creating a ${duration}-day devotional series to help someone grow in their faith. 
The devotional should be based on the following user input: "${userInput || 'spiritual growth'}".

Create a structured ${duration}-day devotional that follows this format:

DEVOTIONAL TITLE:
[Create a meaningful, engaging title for the devotional series]

CATEGORY:
[Choose ONE category that best fits this devotional: Prayer, Growth, Healing, Wisdom, Relationships, Purpose, Career, Finances, Mental Health, Parenting, Health]

DESCRIPTION:
[Write a brief 2-3 sentence description of what this devotional journey will help the reader accomplish]

For each day (${duration} days total), create the following structure:

DAY 1:
TITLE: [Create a meaningful title for this day's devotional]
SCRIPTURE: "[Full Bible verse text]" - [Reference (book chapter:verse)]
REFLECTION: [Write a 150-250 word reflection that connects the Scripture to the user's situation, offers spiritual insight, and points to Jesus as the source of hope/strength/transformation]
REFLECTION QUESTIONS:
1. [Question that encourages introspection]
2. [Question that encourages application]
3. [Question that encourages spiritual growth]
PRAYER: [Write a 50-100 word prayer addressing God directly, seeking His help for the specific situation, incorporating the theme and Scripture]

[Repeat the above structure for each day, from DAY 1 to DAY ${duration}]

Make sure each day builds on the previous one, creating a cohesive journey toward spiritual growth and practical application. Each day should have strategic purpose in helping the reader grow in their faith and address their specific situation.
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
