/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { devotionalAdvisorPersona, enforcePersona, applyPersonaContext } from './persona.config.ts';

interface Scripture {
  text: string;
  reference: string;
  version?: string;
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
  bibleVersion?: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to fetch playbook data including truth_in_love content
async function fetchPlaybookData(playbookId: string) {
  try {
    const { data: playbook, error } = await supabase
      .from('playbooks')
      .select('id, title, description, truth_in_love')
      .eq('id', playbookId)
      .single();

    if (error) {
      console.error('Error fetching playbook:', error);
      return null;
    }

    return playbook;
  } catch (error) {
    console.error('Error in fetchPlaybookData:', error);
    return null;
  }
}

interface Scripture {
  text: string;
  reference: string;
  version?: string;
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
 * @deprecated This function is no longer used as we removed fallbacks for better error handling
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _createDefaultDay(dayNumber: number, isError = false, bibleVersion = 'ESV'): DevotionalDay {
  const timestamp = Date.now();
  return {
    id: `${timestamp}-day-${dayNumber}`,
    dayNumber,
    title: isError ? 'Error' : `Day ${dayNumber}`,
    scripture: {
      text: isError ? 'The Lord is my shepherd; I shall not want.' : 'Your word is a lamp to my feet and a light to my path.',
      reference: isError ? 'PSALM 23:1' : 'PSALM 119:105',
      version: bibleVersion,
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
 * Enhanced with comprehensive error handling, input validation, and detailed logging
 */
function parseOpenAIResponse(aiData: unknown, duration: number, playbookId?: string, userInput?: string, bibleVersion?: string): Devotional {
  console.log('[DEVOTIONAL PARSER] Starting parseOpenAIResponse with:', {
    duration,
    playbookId,
    userInput: userInput?.substring(0, 50),
    bibleVersion,
    aiDataType: typeof aiData,
    timestamp: new Date().toISOString(),
  });

  // Input validation
  if (!aiData) {
    console.error('[DEVOTIONAL PARSER] ERROR: aiData is null or undefined');
    throw new Error('AI response data is required but was not provided');
  }

  if (!duration || duration < 1 || duration > 30) {
    console.error('[DEVOTIONAL PARSER] ERROR: Invalid duration:', duration);
    throw new Error(`Duration must be between 1 and 30 days, received: ${duration}`);
  }

  try {
    // Enhanced response structure validation
    console.log('[DEVOTIONAL PARSER] Validating AI response structure...');

    if (typeof aiData !== 'object') {
      console.error('[DEVOTIONAL PARSER] ERROR: aiData is not an object, type:', typeof aiData);
      throw new Error(`Expected AI response to be an object, received: ${typeof aiData}`);
    }

    const response = aiData as Record<string, unknown>;
    console.log('[DEVOTIONAL PARSER] Response keys:', Object.keys(response));

    if (!Array.isArray(response?.choices)) {
      console.error('[DEVOTIONAL PARSER] ERROR: No choices array in response:', response);
      throw new Error('AI response missing required "choices" array');
    }

    const choices = response.choices;
    if (choices.length === 0) {
      console.error('[DEVOTIONAL PARSER] ERROR: Empty choices array');
      throw new Error('AI response contains empty choices array');
    }

    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    if (!firstChoice || typeof firstChoice !== 'object') {
      console.error('[DEVOTIONAL PARSER] ERROR: Invalid first choice:', firstChoice);
      throw new Error('AI response first choice is invalid or missing');
    }

    console.log('[DEVOTIONAL PARSER] First choice keys:', Object.keys(firstChoice));

    const message = firstChoice.message as Record<string, unknown> | undefined;
    if (!message || typeof message !== 'object') {
      console.error('[DEVOTIONAL PARSER] ERROR: Invalid message structure:', message);
      throw new Error('AI response message structure is invalid or missing');
    }

    const content = message.content as string;
    if (!content || typeof content !== 'string') {
      console.error('[DEVOTIONAL PARSER] ERROR: Invalid content:', { content, type: typeof content });
      throw new Error('AI response content is missing or not a string');
    }

    if (content.trim().length === 0) {
      console.error('[DEVOTIONAL PARSER] ERROR: Empty content after trimming');
      throw new Error('AI response content is empty after trimming whitespace');
    }

    console.log('[DEVOTIONAL PARSER] Content validation passed. Length:', content.length);

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

    // Extract title - handle multiple possible formats (but not from category)
    let title = 'Daily Devotional';
    const titleMatches = [
      content.match(/TITLE:\s*([^\n]+)/i),  // TITLE: format
      content.match(/SERIES TITLE:\s*([^\n]+)/i),  // SERIES TITLE: format
      content.match(/DEVOTIONAL TITLE:\s*([^\n]+)/i),  // DEVOTIONAL TITLE: format
      content.match(/^#\s*([^\n]+)/),  // Markdown H1
      content.match(/^([^\n]{5,64})(?=\n|$)/),  // First line that's 5-64 chars long
    ];


    // Define valid categories
    const validCategories = [
      'Marriage', 'Family', 'Parenting', 'Work', 'Career', 'Business',
      'Finance', 'Stewardship', 'Giving', 'Time Management', 'Health',
      'Mental Health', 'Self-Care', 'Anxiety/Worry', 'Purpose', 'Calling',
      'Ministry', 'Worship', 'Quiet Time', 'Rest', 'Peace', 'Conflict Resolution',
      'Forgiveness', 'Gratitude', 'Grief', 'Evangelism', 'Discipleship',
      'Mission', 'Community', 'Relationships', 'Leadership', 'Contentment',
    ];

    // Extract category with multiple patterns
    let category = '';
    const categoryMatch = content.match(/CATEGORY:[\s\n]+([^\n]+)/i) ||
                         content.match(/Category:[\s\n]+([^\n]+)/i) ||
                         content.match(/#\s*Category:[\s\n]+([^\n]+)/i);

    if (categoryMatch && categoryMatch[1]) {
      // Get the full line after CATEGORY:
      const extractedLine = cleanMarkdown(categoryMatch[1]).trim();
      console.log(`[DEVOTIONAL PARSER] Extracted category line: '${extractedLine}'`);

      // Find the first valid category that matches the start of the line
      const matchedCategory = validCategories.find(validCategory =>
        extractedLine.toLowerCase().startsWith(validCategory.toLowerCase())
      );

      if (matchedCategory) {
        category = matchedCategory;
        console.log(`[DEVOTIONAL PARSER] Matched category: '${category}'`);
      } else {
        console.log(`[DEVOTIONAL PARSER] No valid category found in: '${extractedLine}'`);
        console.log('[DEVOTIONAL PARSER] Valid categories are:', validCategories);
      }
    } else {
      console.log('[DEVOTIONAL PARSER] No category match found in content');
    }

    devotional.category = category;
    devotional.categories = [category];
    console.log('[DEVOTIONAL PARSER] Extracted category:', category);

    // Now extract title, making sure it's not the same as the category
    for (const match of titleMatches) {
      if (match && match[1]) {
        const potentialTitle = cleanMarkdown(match[1]).trim();
        if (potentialTitle && potentialTitle !== category) {
          title = potentialTitle.slice(0, 64);
          break;
        }
      } else if (match && match[0]) {
        const potentialTitle = cleanMarkdown(match[0]).trim();
        if (potentialTitle && potentialTitle !== category) {
          title = potentialTitle.slice(0, 64);
          break;
        }
      }
    }

    // Clean up common title artifacts
    title = title
      .replace(/^[\s\d\-*•.]+/, '')  // Remove leading bullets/numbers
      .replace(/[\]["]/g, '')         // Remove brackets and quotes
      .trim();

    // Fallback to user input if no valid title found
    if (!title || title.toLowerCase() === 'daily devotional' || title === category) {
      title = (userInput || 'Daily Devotional')
        .split('.')[0]
        .replace(/[^\w\s-]/g, '')
        .trim()
        .slice(0, 64);
    }

    devotional.title = title;
    console.log('[DEVOTIONAL PARSER] Extracted title:', title);

    // Extract description - handle multiple possible formats and enforce 80-char limit
    let description = duration > 1
      ? `This ${duration}-day devotional series will help you grow in faith.`
      : 'This 1-day devotional will help you draw closer to God.';

    console.log('[DEVOTIONAL PARSER] Content start for description extraction:', content.substring(0, 300) + (content.length > 300 ? '...' : ''));

    const descMatches = [
      // Match formats with DESCRIPTION: prefix (single line)
      content.match(/DESCRIPTION:[\s\n]+([^\n]{10,80})(?=\n|$)/i),
      // Match formats with DESCRIPTION: prefix (multi-line)
      content.match(/DESCRIPTION:[\s\n]+([^\n]{10,80})(?=\n\n|\n---|$)/i),
      // Match markdown bold format
      content.match(/\*\*DESCRIPTION:\*\*[\s\n]+([^\n]{10,80})(?=\n|$)/i),
      // Match SERIES DESCRIPTION: for multi-day devotionals
      content.match(/SERIES DESCRIPTION:[\s\n]+([^\n]{10,80})(?=\n|$)/i),
      // Match first line after title
      content.match(/^[^\n]+\n\s*([^\n]{10,80})(?=\n|$)/m),
    ];

    console.log('[DEVOTIONAL PARSER] Trying to extract description...');
    for (let i = 0; i < descMatches.length; i++) {
      const match = descMatches[i];
      if (match && match[1]) {
        const desc = cleanMarkdown(match[1]).trim();
        console.log(`[DEVOTIONAL PARSER] Match ${i} found:`, desc);

        // Ensure description is within 80 characters and is a complete sentence
        if (desc && desc.length <= 80 && /[.!?]$/.test(desc)) {
          // If it's a multi-line description, take the first line
          const firstLine = desc.split('\n')[0].trim();
          if (firstLine.length <= 80) {
            description = firstLine;
            console.log(`[DEVOTIONAL PARSER] Using description from match ${i}:`, description);
            break;
          }
        } else {
          console.log(`[DEVOTIONAL PARSER] Match ${i} rejected - invalid format or length`);
        }
      } else {
        console.log(`[DEVOTIONAL PARSER] No match found at index ${i}`);
      }
    }

    // Ensure description is within 80 characters
    if (description.length > 80) {
      console.log(`[DEVOTIONAL PARSER] Truncating description from ${description.length} to 80 chars`);
      description = description.substring(0, 77) + '...';
    }

    devotional.description = description;
    console.log('[DEVOTIONAL PARSER] Extracted description:', description);

    // Category is already extracted at the beginning of the function
    console.log('[DEVOTIONAL PARSER] Using category:', devotional.category);

    // Extract days - handle the specific format from OpenAI response
    console.log('[DEVOTIONAL PARSER] Trying to parse days...');

    // Enhanced day parsing with multiple patterns to handle various OpenAI response formats
    let dayMatches: Array<[unknown, string, string]> = [];

    // Pattern 1: **DAY X:** format (bold markdown)
    const dayRegex1 = /\*\*DAY\s*(\d+):\*\*\s*([^*]*?)(?=\*\*DAY\s*\d+:|$)/gi;
    let match1;
    while ((match1 = dayRegex1.exec(content)) !== null) {
      console.log(`[DEVOTIONAL PARSER] Found day ${match1[1]} (bold format) with content length:`, match1[2].length);
      dayMatches.push([null, match1[1], match1[2].trim()]);
    }

    // Pattern 2: DAY X: format (plain text)
    if (dayMatches.length === 0) {
      console.log('[DEVOTIONAL PARSER] Trying plain DAY format...');
      const dayRegex2 = /(?:^|\n)DAY\s*(\d+):\s*([^]*?)(?=(?:\n|^)DAY\s*\d+:|$)/gi;
      let match2;
      while ((match2 = dayRegex2.exec(content)) !== null) {
        console.log(`[DEVOTIONAL PARSER] Found day ${match2[1]} (plain format) with content length:`, match2[2].length);
        dayMatches.push([null, match2[1], match2[2].trim()]);
      }
    }

    // Pattern 3: # DAY X or ## DAY X (markdown headers)
    if (dayMatches.length === 0) {
      console.log('[DEVOTIONAL PARSER] Trying markdown header format...');
      const dayRegex3 = /(?:^|\n)#{1,3}\s*DAY\s*(\d+)[^\n]*\n([^]*?)(?=(?:\n|^)#{1,3}\s*DAY\s*\d+|$)/gi;
      let match3;
      while ((match3 = dayRegex3.exec(content)) !== null) {
        console.log(`[DEVOTIONAL PARSER] Found day ${match3[1]} (header format) with content length:`, match3[2].length);
        dayMatches.push([null, match3[1], match3[2].trim()]);
      }
    }

    // Pattern 4: Look for any numbered sections that might be days
    // BUT skip if they're inside REFLECTION QUESTIONS section
    if (dayMatches.length === 0) {
      console.log('[DEVOTIONAL PARSER] Trying numbered section format...');
      
      // First, find REFLECTION QUESTIONS sections to exclude them
      const reflectionQuestionsRegex = /REFLECTION QUESTIONS:[\s\S]*?(?=\n\n[A-Z]+:|$)/gi;
      const reflectionSections: Array<{start: number, end: number}> = [];
      let reflectionMatch;
      while ((reflectionMatch = reflectionQuestionsRegex.exec(content)) !== null) {
        reflectionSections.push({
          start: reflectionMatch.index,
          end: reflectionMatch.index + reflectionMatch[0].length
        });
      }
      
      const dayRegex4 = /(?:^|\n)(\d+)[.)]\s*([^]*?)(?=(?:\n|^)\d+[.)]|$)/gi;
      let match4;
      while ((match4 = dayRegex4.exec(content)) !== null && parseInt(match4[1], 10) <= 7) {
        // Check if this match is inside a REFLECTION QUESTIONS section
        const matchPos = match4.index;
        const isInReflectionQuestions = reflectionSections.some(
          section => matchPos >= section.start && matchPos <= section.end
        );
        
        if (!isInReflectionQuestions) {
          console.log(`[DEVOTIONAL PARSER] Found day ${match4[1]} (numbered format) with content length:`, match4[2].length);
          dayMatches.push([null, match4[1], match4[2].trim()]);
        } else {
          console.log(`[DEVOTIONAL PARSER] Skipping numbered item ${match4[1]} (inside REFLECTION QUESTIONS)`);
        }
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

        // Extract scripture with multiple format support - no defaults, force AI parsing
        let scriptureText = '';
        let scriptureRef = '';

        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} - Raw day content:\n${dayContent}`);

        // Define scripture patterns with cleaned up regex (no unnecessary escapes)
        const scripturePatterns = [
          // Format: SCRIPTURE:\n"verse" - BOOK 1:19-20 (with dash and optional newlines)
          {
            pattern: /SCRIPTURE:[\s\n]*['"]([^'"\n]+)['"][\s\n]*[-—][\s\n]*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
            name: 'format 1a (SCRIPTURE:\n"verse" - BOOK 1:19-20 with dash)',
          },
          // Format: SCRIPTURE:\n"verse" BOOK 1:19-20 (without dash)
          {
            pattern: /SCRIPTURE:[\s\n]*['"]([^'"\n]+)['"]\s+([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
            name: 'format 1b (SCRIPTURE:\n"verse" BOOK 1:19-20 without dash)',
          },
          // Format: SCRIPTURE:\nBOOK 1:19-20 - "verse"
          {
            pattern: /SCRIPTURE:[\s\n]*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*[-—]\s*['"]([^'"\n]+)['"]/i,
            name: 'format 2 (SCRIPTURE:\nBOOK 1:19-20 - "verse")',
          },
          // Format: SCRIPTURE: verse - BOOK 1:19-20 (all on one line)
          {
            pattern: /SCRIPTURE:[\s\n]*([^\n"']+?)\s*[-—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
            name: 'format 3 (SCRIPTURE: verse - BOOK 1:19-20)',
          },
          // More flexible format: Any line containing "SCRIPTURE"
          {
            pattern: /SCRIPTURE:[\s\n]*([^\n]+?)\s*[-—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
            name: 'format 4 (flexible SCRIPTURE: verse - BOOK 1:19-20)',
          },
          // Just look for any verse reference pattern
          {
            pattern: /([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*[-—]\s*['"]([^'"\n]+)['"]/i,
            name: 'format 5 (BOOK 1:19-20 - "verse")',
          },
          // Look for quoted text followed by a reference
          {
            pattern: /['"]([^'"\n]+)['"]\s*[-—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
            name: 'format 6 ("verse" - BOOK 1:19-20)',
          },
        ];

        // First, try to find a scripture section
        const scriptureSectionMatch = dayContent.match(/(SCRIPTURE|BIBLE VERSE|VERSE|TEXT):[\s\n]*([\s\S]*?)(?=(?:REFLECTION|PRAYER|QUESTIONS|$))/i);
        const contentToSearch = scriptureSectionMatch ? scriptureSectionMatch[0] : dayContent;

        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} - Searching for scripture in: ${contentToSearch.substring(0, 200)}...`);

        for (const { pattern, name } of scripturePatterns) {
          const scriptureMatch = contentToSearch.match(pattern);
          if (scriptureMatch && scriptureMatch[1] && scriptureMatch[2]) {
            console.log(`[DEVOTIONAL PARSER] Day ${dayNum} - Matched scripture ${name}`);
            console.log(`[DEVOTIONAL PARSER] Day ${dayNum} - Match groups:`, scriptureMatch[1], scriptureMatch[2]);

            // Determine which group is the text and which is the reference
            if (scriptureMatch[1].match(/[A-Z]+\s*\d+[:\d]*(?:\s*-\s*\d+)?/)) {
              // First group looks like a reference (e.g., "JOHN 3:16" or "PSALM 23:1-6")
              scriptureRef = scriptureMatch[1].trim();
              scriptureText = scriptureMatch[2].trim();
            } else {
              // First group is the text, second is the reference
              scriptureText = scriptureMatch[1].trim();
              scriptureRef = scriptureMatch[2].trim();
            }
            console.log(`[DEVOTIONAL PARSER] Day ${dayNum} - Extracted scripture: "${scriptureText}" (${scriptureRef})`);
            break;
          } else {
            console.log(`[DEVOTIONAL PARSER] Day ${dayNum} - No match for ${name}`);
          }
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
        const prayerMatch = dayContent.match(/PRAYER:[\s\n]*([\s\S]*?)(?=In Jesus[''']?\s*[Nn]ame|$)/i);
        if (prayerMatch && prayerMatch[1]) {
          let prayerBody = cleanMarkdown(prayerMatch[1])
            .trim()
            .replace(/^[\s\d\-*•.]+/, '')  // Remove leading bullets/numbers
            .replace(/[\]["]/g, '')         // Remove brackets and quotes
            .trim();

          // Remove any existing 'Heavenly Father' from the prayer body
          prayerBody = prayerBody.replace(/^Heavenly Father[,\s]*/i, '');
          
          // Normalize multiple newlines to single newlines in the prayer body
          // This ensures consistent spacing regardless of AI output format
          prayerBody = prayerBody.replace(/\n{2,}/g, '\n');

          // Format prayer with proper spacing - single newline after "Heavenly Father," and before "In Jesus' Name, Amen"
          prayerText = `Heavenly Father,\n${prayerBody}\nIn Jesus' Name, Amen`;
        } else {
          // No fallback - throw error if prayer not found
          throw new Error(`Failed to parse prayer for Day ${dayNum}. AI must provide properly formatted prayer.`);
        }
        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Prayer:`, prayerText.substring(0, 100));

        // Clean up day title if needed
          const finalDayTitle = dayTitle || `Day ${dayNum}`;

          devotional.days.push({
            id: `${Date.now()}-day-${dayNumber}`,
            dayNumber,
            title: finalDayTitle,
            scripture: {
              text: scriptureText,
              reference: scriptureRef,
              version: bibleVersion || 'NASB',
            },
            reflection: reflection,
            reflectionQuestions,
            prayer: prayerText,
            completed: false,
          });
      } catch (dayError) {
        console.error(`[DEVOTIONAL PARSER] ERROR processing day ${dayNum}:`, {
          error: dayError instanceof Error ? dayError.message : 'Unknown error',
          dayContent: dayContent.substring(0, 200),
          stack: dayError instanceof Error ? dayError.stack : undefined,
        });

        // No fallback - throw the error to force proper AI generation
        throw new Error(`Failed to parse Day ${dayNum}: ${dayError instanceof Error ? dayError.message : 'Unknown error'}`);
      }
    }

    console.log(`[DEVOTIONAL PARSER] Processed ${devotional.days.length} days total`);

    // Enhanced validation of parsed days - NO FALLBACKS
    if (devotional.days.length === 0) {
      console.error('[DEVOTIONAL PARSER] CRITICAL ERROR: No devotional days were parsed');
      console.error('[DEVOTIONAL PARSER] Original content length:', content.length);
      console.error('[DEVOTIONAL PARSER] Day matches found:', dayMatches.length);
      console.error('[DEVOTIONAL PARSER] Content preview:', content.substring(0, 500));

      // No fallback - throw error to force proper AI generation
      throw new Error(`No devotional days were parsed from OpenAI response. Expected ${duration} days but got 0. The AI response format was not recognized.`);
    }

    // Validate each day has required fields - NO FALLBACKS, throw errors instead
    devotional.days.forEach((day, _index) => {
      if (!day.scripture?.text || !day.scripture?.reference) {
        throw new Error(`Day ${day.dayNumber} is missing scripture. AI must provide properly formatted scripture with text and reference.`);
      }

      if (!day.reflection || day.reflection.trim().length === 0) {
        throw new Error(`Day ${day.dayNumber} is missing reflection. AI must provide meaningful reflection content.`);
      }

      if (!day.prayer || day.prayer.trim().length === 0) {
        throw new Error(`Day ${day.dayNumber} is missing prayer. AI must provide properly formatted prayer.`);
      }

      if (!Array.isArray(day.reflectionQuestions) || day.reflectionQuestions.length === 0) {
        throw new Error(`Day ${day.dayNumber} is missing reflection questions. AI must provide at least 3 reflection questions.`);
      }
    });

    // Sort days and finalize
    devotional.days.sort((a, b) => a.dayNumber - b.dayNumber);
    devotional.totalDays = Math.max(devotional.days.length, duration);

    console.log('[DEVOTIONAL PARSER] Successfully parsed devotional:', {
      title: devotional.title,
      category: devotional.category,
      totalDays: devotional.totalDays,
      daysCount: devotional.days.length,
      firstDayTitle: devotional.days[0]?.title,
      lastDayTitle: devotional.days[devotional.days.length - 1]?.title,
    });

    return devotional;
  } catch (error) {
    console.error('[DEVOTIONAL PARSER] CRITICAL ERROR in parseOpenAIResponse:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration,
      playbookId,
      userInput,
      bibleVersion,
      timestamp: new Date().toISOString(),
    });

    // Enhanced error context for debugging
    if (error instanceof Error) {
      console.error('[DEVOTIONAL PARSER] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }

    // Re-throw with enhanced context
    const enhancedError = new Error(
      `Failed to parse OpenAI devotional response: ${error instanceof Error ? error.message : 'Unknown error'}. Duration: ${duration}, PlaybookId: ${playbookId || 'none'}`
    );

    if (error instanceof Error && error.stack) {
      enhancedError.stack = error.stack;
    }

    throw enhancedError;
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

  const { duration = 1, playbookId, userInput = '', userName = 'User', bibleVersion = 'NASB' } = requestBody;
  console.log('[Generate-Devotional] Request body:', JSON.stringify(requestBody, null, 2));
  console.log('[Generate-Devotional] Bible version received:', bibleVersion);
  console.log('[Generate-Devotional] User input received:', userInput);

  // Add anti-repetition context to user input
  const enhancedUserInput = `${userInput}

CRITICAL INSTRUCTION: You MUST NOT use these overused verses: Jeremiah 29:11, Philippians 4:13, Romans 8:28, Psalm 119:105, Proverbs 3:5-6, Isaiah 40:31. 

REQUIRED: Use verses from lesser-known books like Zephaniah, Haggai, Malachi, Nahum, Obadiah, Joel, Amos, Micah, or narrative books like Ruth, Esther, Nehemiah, 1-2 Chronicles.

Choose an obscure but meaningful verse that relates to the topic above.`;

  if (typeof duration !== 'number' || duration < 1 || duration > 7) {
    return createErrorResponse(400, 'Invalid duration', 'Must be a number between 1 and 7.');
  }

  try {
    const contextualPersona = applyPersonaContext(devotionalAdvisorPersona.systemPrompt, enhancedUserInput, bibleVersion);

    // Fetch playbook data if playbookId is provided
    let playbookContext = '';
    if (playbookId) {
      console.log(`Fetching playbook data for ID: ${playbookId}`);
      const playbookData = await fetchPlaybookData(playbookId);

      if (playbookData && playbookData.truth_in_love) {
        const truthInLove = playbookData.truth_in_love;
        console.log('Truth in Love data found:', truthInLove);

        playbookContext = '\n\n## PLAYBOOK CONTEXT - TRUTH IN LOVE\n';
        playbookContext += `Playbook: ${playbookData.title || 'Unknown'}\n`;

        if (truthInLove.text) {
          playbookContext += `Truth: ${truthInLove.text}\n`;
        }

        if (truthInLove.summary) {
          playbookContext += `Summary: ${truthInLove.summary}\n`;
        }

        playbookContext += '\nIMPORTANT: The devotional MUST align with and reinforce the truth and principles from this playbook. Use this context to guide the spiritual themes, biblical references, and practical applications in the devotional.';
      } else {
        console.log('No truth_in_love data found for playbook:', playbookId);
      }
    }

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
            content: contextualPersona + playbookContext,
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

    // Log the raw OpenAI response for debugging
    console.log('=== RAW OPENAI RESPONSE ===');
    console.log(JSON.stringify(aiData, null, 2));
    console.log('==========================');

    let content = aiData.choices?.[0]?.message?.content || '';
    if (content) {
      content = enforcePersona(content, devotionalAdvisorPersona);
    }

    const devotional = parseOpenAIResponse(
      { choices: [{ message: { content } }] },
      duration,
      playbookId,
      userInput,
      bibleVersion
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
