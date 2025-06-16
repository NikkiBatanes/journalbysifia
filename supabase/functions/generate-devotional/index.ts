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
    // Try to match both new "QUESTIONS TO PONDER:" and old "REFLECTION QUESTIONS:" formats
    const questionsMatch = content.match(/(?:QUESTIONS TO PONDER|REFLECTION QUESTIONS):\s*([\s\S]*?)(?=PRAYER:|$)/i);

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
      { id: 'q3', text: 'How does this devotional point you to Christ?' },
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

    // Try to extract title, description, and categories from the content
    try {
      const lines = content.split('\n').filter(line => line.trim());
      // --- Title Extraction Logic ---
      let foundTitle = '';
      let foundDescription = '';
      let foundCategories: string[] = [];
      // First pass: Look for explicit title markers in the first 20 lines
      for (let i = 0; i < Math.min(20, lines.length); i++) {
        const titleMatch = lines[i].match(/^(DEVOTIONAL TITLE:|SERIES TITLE:|TITLE:)[ \t]*(.*)$/i);
        if (titleMatch && titleMatch[2]) {
          foundTitle = titleMatch[2].replace(/^"(.*)"$/, '$1').trim();
          break;
        }
      }
      // Second pass: If no explicit title found, look for a line that might be a title
      if (!foundTitle) {
        for (let i = 0; i < Math.min(20, lines.length); i++) {
          if (lines[i].match(/^(CATEGORY|DESCRIPTION|DAY|SCRIPTURE|REFLECTION|QUESTIONS|PRAYER):/i)) continue;
          if (lines[i].length > 3 && lines[i].length <= 40) {
            foundTitle = lines[i].replace(/^"(.*)"$/, '$1').trim();
            break;
          }
        }
      }
      // Third pass: If still no title, try the first line as a last resort
      if (!foundTitle && lines.length > 0) {
        foundTitle = lines[0].replace(/^(?:DEVOTIONAL|SERIES)?\s*TITLE:\s*/i, '').replace(/^"(.*)"$/, '$1').trim();
      }
      // Clean and truncate
      let cleanedTitle = cleanMarkdown(foundTitle);
      if (cleanedTitle.length > 32) {
        cleanedTitle = cleanedTitle.slice(0, 32).replace(/\s+\S*$/, '').trim();
      }
      // Fallback if generic/incomplete
      const fallbackTitles = [
        'A Fresh Start',
        'New Mercies',
        'Anchored in Hope',
        'Light for Today',
        'Strength for the Journey',
        'Grace Unfolding',
        'Faith Over Fear',
        'Rooted and Grounded',
        'Unshakeable',
        'Purpose Renewed',
        'Divine Guidance',
        'Faithful Steps',
        'Living Waters',
        'Steadfast Love',
        'Renewed Mind',
        'Sacred Journey',
        'Abundant Grace',
        'Deeper Faith',
        'Joyful Heart',
        'Peaceful Presence'
      ];
      if (!cleanedTitle || cleanedTitle.length < 3 || /\b(of|in|for|with|by|to|from|through|on|at|about|into|over|after|before|under|above|around|across|between|without|within|along|upon|amid|among)$/i.test(cleanedTitle)) {
        devotional.title = fallbackTitles[Math.floor(Math.random() * fallbackTitles.length)];
        console.log('Fallback title used:', devotional.title);
      } else {
        devotional.title = cleanedTitle;
      }
      // --- End Title Extraction Logic ---

      // Debug log to verify final title
      console.log('Final extracted devotional title:', devotional.title);

      // --- Description Extraction ---
      let foundDescription = '';
      for (let i = 0; i < Math.min(20, lines.length); i++) {
        const descMatch = lines[i].match(/^DESCRIPTION:\s*(.*)$/i);
        if (descMatch && descMatch[1]) {
          foundDescription = descMatch[1].trim();
          break;
        }
      }
      if (!foundDescription) {
        // Fallback: try to find a likely description line
        for (let i = 0; i < Math.min(20, lines.length); i++) {
          if (lines[i].toLowerCase().includes('journey') || lines[i].toLowerCase().includes('explore') || lines[i].toLowerCase().includes('discover') || lines[i].toLowerCase().includes('guide')) {
            foundDescription = cleanMarkdown(lines[i]);
            break;
          }
        }
      }
      if (!foundDescription) {
        foundDescription = `A ${duration}-day journey to deepen your faith and spiritual growth.`;
      }
      devotional.description = foundDescription;

      // --- Category Extraction ---
      let foundCategories: string[] = [];
      for (let i = 0; i < Math.min(20, lines.length); i++) {
        const catMatch = lines[i].match(/^CATEGORY:\s*(.*)$/i);
        if (catMatch && catMatch[1]) {
          const categoryText = catMatch[1].trim();
          const extractedCategories = categoryText.replace(/[\[\]]/g, '').split(/,|\s+and\s+/).map(cat => cat.trim()).filter(cat => cat.length > 0);
          foundCategories = extractedCategories;
          break;
        }
      }
      if (foundCategories.length > 0) {
        devotional.category = foundCategories.join(', ');
      } else {
        // Default category based on user input
        const inputLower = (userInput || '').toLowerCase();
        if (inputLower.includes('anxiety') || inputLower.includes('worry') || inputLower.includes('stress')) {
          devotional.category = 'Peace, Mental Health';
        } else if (inputLower.includes('marriage') || inputLower.includes('relationship')) {
          devotional.category = 'Relationships, Love';
        } else if (inputLower.includes('purpose') || inputLower.includes('meaning')) {
          devotional.category = 'Purpose, Identity';
        } else {
          devotional.category = 'Faith, Growth';
        }
      }
      // --- End description and category extraction ---

      // --- Continue with description, categories, etc. ---

      for (let i = 0; i < Math.min(20, lines.length); i++) {
        const titleMatch = lines[i].match(/^(DEVOTIONAL TITLE:|SERIES TITLE:|TITLE:)\s*(.*)$/i);
        if (titleMatch && titleMatch[2]) {
          foundTitle = titleMatch[2].replace(/^"(.*)"$/, '$1').trim();
          console.log(`Found title with prefix at line ${i}:`, foundTitle);
          continue;
        }

        // Look for description
        const descMatch = lines[i].match(/^DESCRIPTION:\s*(.*)$/i);
        if (descMatch && descMatch[1]) {
          foundDescription = descMatch[1].trim();
          console.log(`Found description at line ${i}:`, foundDescription);
          continue;
        }

        // Look for categories/tags
        const catMatch = lines[i].match(/^CATEGORY:\s*(.*)$/i);
        if (catMatch && catMatch[1]) {
          const categoryText = catMatch[1].trim();
          // Extract categories - could be comma-separated or in brackets
          const extractedCategories = categoryText
            .replace(/[\[\]]/g, '') // Remove brackets
            .split(/,|\s+and\s+/) // Split by comma or 'and'
            .map(cat => cat.trim())
            .filter(cat => cat.length > 0);
          
          foundCategories = extractedCategories;
          console.log(`Found categories at line ${i}:`, foundCategories);
          continue;
        }
      }

      // Second pass: If no explicit title found, look for a line that might be a title
      if (!foundTitle) {
        for (let i = 0; i < Math.min(20, lines.length); i++) {
          // Skip lines that look like category, description, or other structured content
          if (lines[i].match(/^(CATEGORY|DESCRIPTION|DAY|SCRIPTURE|REFLECTION|QUESTIONS|PRAYER):/i)) {
            continue;
          }

          // If this is the first line or follows a blank line, it might be a title
          if (i === 0 || (i > 0 && !lines[i - 1].trim())) {
            foundTitle = lines[i].trim();
            console.log(`Found potential title at line ${i} without prefix:`, foundTitle);
            break;
          }
        }
      }

      // Third pass: If still no title, try the first line as a last resort
      if (!foundTitle && lines.length > 0) {
        foundTitle = lines[0]
          .replace(/^(?:DEVOTIONAL|SERIES)?\s*TITLE:\s*/i, '')
          .replace(/^"(.*)"$/, '$1')
          .trim();
        console.log('Using first line as fallback title:', foundTitle);
      }

  if (!content) {
    throw new Error('No content found in AI response');
  }

  // Try to extract title, description, and categories from the content

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
              const comboMatch = titleLine[1].match(/(.*?)\s*SCRIPTURE:\s*"([^"]+)"\s*-\s*([^\n]+)/i);
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
          } else if (duration > 1) {
            // For multi-day devotionals, try to extract a meaningful day title from the content
            // Look for patterns that might indicate a title in the first few lines
            const dayContentLines = dayContent.split('\n').filter(line => line.trim());
            
            // Skip lines that are clearly not titles
            for (let i = 0; i < Math.min(5, dayContentLines.length); i++) {
              const line = dayContentLines[i].trim();
              // Skip lines that are part of the structure
              if (line.match(/^(SCRIPTURE|REFLECTION|QUESTIONS|PRAYER):/i)) {
                continue;
              }
              
              // If line is short enough and doesn't look like part of the content, it might be a title
              if (line.length < 60 && !line.match(/^["\d]/) && !line.includes('TITLE:')) {
                dayTitle = cleanMarkdown(line);
                break;
              }
            }
            
            // If we still don't have a good title, create one based on the day number and progression
            if (dayTitle === `Day ${dayNumber}`) {
              // Create titles based on the progression pattern
              if (duration === 3) {
                const titles = ['Beginning the Journey', 'Finding Healing', 'Embracing Hope'];
                dayTitle = titles[dayNumber - 1] || `Day ${dayNumber}`;
              } else if (duration === 5) {
                const titles = ['Awareness', 'Building Trust', 'Finding Healing', 'Taking Action', 'Renewal'];
                dayTitle = titles[dayNumber - 1] || `Day ${dayNumber}`;
              } else if (duration === 7) {
                const titles = ['Facing the Challenge', 'Trusting God', 'Growing in Faith', 
                               'Taking Action', 'Finding Community', 'Renewing Your Mind', 'Celebrating Victory'];
                dayTitle = titles[dayNumber - 1] || `Day ${dayNumber}`;
              }
            }
          }

          // Extract scripture
          const scriptureMatch = dayContent.match(/SCRIPTURE:\s*"([^"]+)"\s*-\s*([^\n]+)/i);
          if (scriptureMatch) {
            scriptureText = cleanMarkdown(scriptureMatch[1].trim());
            scriptureRef = cleanMarkdown(scriptureMatch[2].trim());
          }

          // Extract reflection
          let reflection = '';
          const reflectionMatch = dayContent.match(/REFLECTION:\s*([\s\S]*?)(?=QUESTIONS TO PONDER:|PRAYER:|$)/i);
          if (reflectionMatch && reflectionMatch[1]) {
            reflection = cleanMarkdown(reflectionMatch[1].trim());
          }

          // Extract reflection questions
          let reflectionQuestions: DevotionalQuestion[] = [];
          const questionsMatch = dayContent.match(/QUESTIONS TO PONDER:\s*([\s\S]*?)(?=PRAYER:|$)/i);
          if (questionsMatch && questionsMatch[1]) {
            const questionsText = cleanMarkdown(questionsMatch[1].trim());
            reflectionQuestions = questionsText.split('\n').filter(Boolean).map((question, idx) => ({
              id: `q${idx + 1}`,
              text: question.trim(),
            }));
          }

          // Extract prayer with improved handling for the structured format
          let prayer = '';
          const prayerMatch = dayContent.match(/PRAYER:\s*([\s\S]*?)(?=DAY \d+:|$)/i);
          if (prayerMatch && prayerMatch[1]) {
            let rawPrayer = prayerMatch[1].trim();
            // Preserve line breaks, but clean markdown from each line
            let lines = rawPrayer.split(/\r?\n/).map(line => cleanMarkdown(line.trim())).filter(Boolean);

            // Remove any duplicate "In Jesus' Name" or "Amen" lines except for the last two
            lines = lines.filter((line, idx, arr) => {
              const lower = line.toLowerCase();
              if ((lower.includes("in jesus' name") || lower.includes("in jesus’s name") || lower.includes("in jesus\"s name")) && idx !== arr.length - 2) return false;
              if ((lower === 'amen' || lower === 'amen.') && idx !== arr.length - 1) return false;
              return true;
            });

            // Ensure prayer starts with addressing the Father
            if (!lines[0].match(/^(Heavenly|Almighty|Loving|Gracious|Dear|Holy)\s+Father,/i)) {
              lines.unshift('Heavenly Father,');
            }

            // Remove any trailing empty lines
            while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();

            // Remove any existing "In Jesus' Name" and "Amen" at the end to avoid duplication
            while (lines.length > 0 && (lines[lines.length - 1].toLowerCase().includes("in jesus' name") || lines[lines.length - 1].toLowerCase() === 'amen' || lines[lines.length - 1].toLowerCase() === 'amen.')) {
              lines.pop();
            }

            // Add the correct closing
            lines.push("", "In Jesus' Name,", "Amen");

            prayer = lines.join('\n');
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
          reference: 'PSALM 23:1',
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

// Main server handler
serve(async (req: Request): Promise<Response> => {
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

To generate a devotional, base it on the user's input: "${userInput || 'spiritual growth'}" and incorporate relevant spiritual guidance from the playbook content including Truth in Love, Action Steps, Affirmations, Bible verse, and Challenge card.

${duration === 1 ? 'This will be a single-day devotional with a Devotional Title.' : `This will be a ${duration}-day devotional series with a Series Title and individual Daily Titles for each day.`}

${duration > 1 ? 'SERIES TITLE:' : 'DEVOTIONAL TITLE:'}
[Create a meaningful, complete, and natural-sounding title ${duration > 1 ? 'for the overall devotional series' : ''} that encapsulates the theme. The title MUST be a finished phrase or sentence, never cut off or incomplete, and MUST fit within 32 characters. NEVER end with a preposition or leave the thought hanging.]

DESCRIPTION:
[Write a brief description of what this devotional journey will help the reader accomplish.]

CATEGORY:
[Choose 2-3 specific tags that best fit this devotional based on the content and theme. DO NOT use 'General' as a category.]

For each day (${duration} days total), create the following structure:

DAY 1:
${duration > 1 ? 'TITLE: [Create a unique, meaningful, and complete title for this specific day that fits within 32 characters and differs from the series title]' : ''}
SCRIPTURE: "[Full Bible verse text]" - [Reference (book chapter:verse)] (Strictly separate the verse text and the reference. The verse must be in quotes, then a dash, then the reference. DO NOT include the verse text in the reference field. Avoid most common verses unless truly fitting.)

REFLECTION:
[Write a warm, personal reflection that speaks directly to the reader (use "you"), resonates deeply with their input, and is broken into 2–4 short, readable paragraphs. DO NOT include Questions to Ponder or Prayer in the reflection.]

QUESTIONS TO PONDER:
[2-3 Christ-centered, introspective questions.]

PRAYER:
[Write a personal prayer as a letter, broken into 3–5 short lines. Start with "Heavenly Father," or similar, then a line break. Include adoration, confession, supplication, and thanksgiving, but allow for natural, flexible language. End with "In Jesus' Name," on its own line, then "Amen" on its own line. NEVER repeat the ending. Example:
Almighty Father,

I praise You for being the ultimate Healer.
I confess my struggle to let go of my pain and anger.
Please help me to embrace Your healing, trusting that You are working all things for my good.
Thank You for Your gentle care and the promise of restoration.

In Jesus' Name,
Amen]

[Repeat the above structure for each day, from DAY 1 to DAY ${duration}]

${duration > 1 ? `For multi-day devotionals, follow this progression:
- 3 Days: Problem → Healing → Hope
- 5 Days: Awareness → Trust → Healing → Action → Renewal
- 7 Days: Problem → Trust → Growth → Action → Community → Renewal → Celebration

Ensure each day builds on the previous one, creating a cohesive journey toward spiritual growth and practical application.` : ''}

Strictly follow the format for each section. Never let one section bleed into another. Ensure the scripture format is strictly followed: the verse text in quotes, followed by a dash, then the reference (e.g., "For God so loved the world..." - John 3:16).
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
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
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
});
