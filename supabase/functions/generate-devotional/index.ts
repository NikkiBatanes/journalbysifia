/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { devotionalAdvisorPersona, enforcePersona, applyPersonaContext } from './persona.config.ts';
import { fetchWithRetry, OPENAI_RETRY_CONFIG } from '../_shared/retryLogic.ts';
import { SimpleRateLimiter, RATE_LIMIT_CONFIGS, createRateLimitError, createRateLimitHeaders as _createRateLimitHeaders } from '../_shared/simpleRateLimiter.ts';
import { CircuitBreaker, CIRCUIT_KEYS } from '../_shared/circuitBreaker.ts';
import { ResponseCache, CACHE_CONFIGS, generateCacheKey } from '../_shared/responseCache.ts';
import { bibleVerseService, BibleVerseService } from '../_shared/bibleVerseService.ts';
import { keyPoolManager } from '../_shared/keyPoolManager.ts';

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
  dateOfBirth?: string;  // ISO date string from user profile
  ageGroup?: string;     // From onboarding: 'teen', 'young-adult', 'adult', 'middle-aged', 'senior'
  userTier?: string;     // User's subscription tier for key pool selection
  isOnboarding?: boolean; // Whether this is an onboarding generation
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to fetch playbook data including truth_in_love content and original user_input
async function fetchPlaybookData(playbookId: string) {
  try {
    const { data: playbook, error } = await supabase
      .from('playbooks')
      .select('id, title, truth_in_love, user_input')
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
        .replace(/\r\n/g, '\n') // Normalize Windows newlines
        .replace(/\*\*|__/g, '') // Remove bold/italic
        .replace(/\*|_/g, '') // Remove single asterisks/underscores
        .replace(/^[-*]\s*/gm, '') // Remove list markers
        .replace(/^\s*[-*_]{3,}\s*$/gm, '') // Remove dividers
        .replace(/^#{1,6}\s*/gm, '') // Remove headers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
        .replace(/`{1,3}([^`]+)`{1,3}/g, '$1') // Remove code blocks
        .replace(/\n{3,}/g, '\n\n') // Limit newlines
        .replace(/[ \t]+\n/g, '\n') // Remove trailing spaces before newline
        .replace(/--+/g, '') // Remove dashes
        .replace(/[ \t]+/g, ' ') // Normalize spaces/tabs but preserve newlines
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
 * Safely cleans scripture text while preserving ALL authentic translation elements
 * @param text - Scripture text that might contain markdown
 * @returns Scripture text with exact translation preserved
 */
function cleanScripture(text: unknown): string {
  const safeString = (value: unknown): string => {
    if (value === null || value === undefined) {return '';}
    if (typeof value === 'string') {return value;}
    if (typeof value.toString === 'function') {return value.toString();}
    return '';
  };

  try {
    const str = safeString(text);
    if (typeof str !== 'string') {
      console.warn('cleanScripture: Failed to convert input to string. Type:', typeof text);
      return '';
    }
    if (!str.trim()) {return '';}

    // MINIMAL CLEANUP - Only handle line breaks and excessive whitespace
    // Preserve ALL translation elements including brackets, quotes, punctuation
    let result = str
      .replace(/\n+/g, ' ') // Convert line breaks to spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .trim(); // Remove leading/trailing whitespace only

    return result;
  } catch (error) {
    console.error('Unexpected error in cleanScripture:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      inputType: typeof text,
      inputValue: text,
    });
    return '';
  }
}

/**
 * Enforce exact Bible verse text using BibleVerseService
 * Replaces AI-generated verse text with scraped exact text for problematic translations
 */
async function enforceExactScriptures(devotional: Devotional, version: string): Promise<void> {
  console.log(`[EnforceScriptures] ============ ENFORCEMENT START ============`);
  console.log(`[EnforceScriptures] Version: ${version}`);
  console.log(`[EnforceScriptures] Total days: ${devotional.days.length}`);
  
  // Check if this version requires scraping
  const requiresScraping = ['MSG', 'AMP', 'NLT', 'CSB'].includes(version.toUpperCase());
  console.log(`[EnforceScriptures] Requires scraping: ${requiresScraping}`);

  for (const day of devotional.days) {
    console.log(`[EnforceScriptures] ---------- Day ${day.dayNumber} ----------`);
    
    if (!day.scripture || !day.scripture.reference) {
      console.warn(`[EnforceScriptures] ❌ Day ${day.dayNumber} missing scripture reference`);
      continue;
    }

    console.log(`[EnforceScriptures] Current: ${day.scripture.reference}`);
    console.log(`[EnforceScriptures] Current text (first 100 chars): ${day.scripture.text.substring(0, 100)}`);

    try {
      const aiGeneratedReference = day.scripture.reference;
      const aiGeneratedText = day.scripture.text;
      
      console.log(`[EnforceScriptures] Calling bibleVerseService.fetchVerse...`);
      const exactVerse = await bibleVerseService.fetchVerse(aiGeneratedReference, version);
      
      console.log(`[EnforceScriptures] ✅ Fetch successful - Source: ${exactVerse.source}`);
      console.log(`[EnforceScriptures] Scraped text (first 100 chars): ${exactVerse.text.substring(0, 100)}`);
      console.log(`[EnforceScriptures] Scraped reference: ${exactVerse.reference}`);
      
      day.scripture.text = exactVerse.text;
      day.scripture.reference = exactVerse.reference;
      day.scripture.version = version;

      console.log(`[EnforceScriptures] Day ${day.dayNumber} updated:`, {
        wasAIText: aiGeneratedText !== exactVerse.text,
        aiGeneratedReference,
        scrapedReference: exactVerse.reference,
        referenceChanged: aiGeneratedReference !== exactVerse.reference,
        aiTextLength: aiGeneratedText.length,
        scrapedTextLength: exactVerse.text.length,
        source: exactVerse.source,
      });
      
      console.log(`[EnforceScriptures] FINAL day ${day.dayNumber} scripture:`, {
        text: day.scripture.text.substring(0, 100),
        reference: day.scripture.reference,
        version: day.scripture.version,
      });
    } catch (error) {
      console.error(`[EnforceScriptures] ❌ Day ${day.dayNumber} FAILED:`, error);
      console.error(`[EnforceScriptures] Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.log(`[EnforceScriptures] ⚠️  Keeping AI-generated text for day ${day.dayNumber}`);
    }
  }

  console.log(`[EnforceScriptures] ============ ENFORCEMENT END ============`);
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
          end: reflectionMatch.index + reflectionMatch[0].length,
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
          // Keep the full day content including the DAY header for title extraction
          const dayContent = section.substring(dayMatch.index).trim();
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
          // Look for any line that might be a title (but exclude prayer content)
          dayContent.match(/^(?!Heavenly Father)(.+?)\n\n/),
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
                !candidate.match(/^(day\s*\d+|devotional|title|scripture|reflection|prayer|heavenly father)/i) &&
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
      // SIMPLE FORMAT FIRST: SCRIPTURE: "verse" - Reference (handles most AI outputs)
      // Uses basic quote matching that works with straight quotes (char 34)
      {
        pattern: /SCRIPTURE:\s*"([^"]+)"\s*[-–—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?)/i,
        name: 'format 0 (simple SCRIPTURE: "verse" - Reference)',
      },
      // Format: SCRIPTURE:\n"verse" - BOOK 1:19-20 (with dash and optional newlines)
      {
        pattern: /SCRIPTURE:[\s\n]*["'""“”‟‛›«»‹]\s*([\s\S]+?)\s*["'""“”‟‛›«»‹][\s\n]*[-–—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
        name: 'format 1a (SCRIPTURE:\n"verse" - BOOK 1:19-20 with dash)',
      },
      // Format: SCRIPTURE:\n"verse" BOOK 1:19-20 (without dash)
      {
        pattern: /SCRIPTURE:[\s\n]*["'""“”‟‛›«»‹]\s*([\s\S]+?)\s*["'""“”‟‛›«»‹]\s+([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
        name: 'format 1b (SCRIPTURE:\n"verse" BOOK 1:19-20 without dash)',
      },
      // Format: SCRIPTURE:\nBOOK 1:19-20 - "verse"
      {
        pattern: /SCRIPTURE:[\s\n]*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*[-–—]\s*["'""“”‟‛›«»‹]\s*([\s\S]+?)\s*["'""“”‟‛›«»‹]/i,
        name: 'format 2 (SCRIPTURE:\nBOOK 1:19-20 - "verse")',
      },
      // Format: SCRIPTURE: verse - BOOK 1:19-20 (all on one line)
      {
        pattern: /SCRIPTURE:[\s\n]*([\s\S]+?)\s*[-–—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
      name: 'format 3 (SCRIPTURE: verse - BOOK 1:19-20)',
      },
      // More flexible format: Any line containing "SCRIPTURE"
      {
        pattern: /SCRIPTURE:[\s\n]*([\s\S]+?)\s*[-–—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
        name: 'format 4 (flexible SCRIPTURE: verse - BOOK 1:19-20)',
      },
      // Reference followed by quoted verse (allows multiline verse)
      {
        pattern: /([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*[-–—]\s*["'""“”‟‛›«»‹]\s*([\s\S]+?)\s*["'""“”‟‛›«»‹]/i,
        name: 'format 5 (BOOK 1:19-20 - "verse")',
      },
      // Quoted verse followed by reference
      {
        pattern: /["'""“”‟‛›«»‹]\s*([\s\S]+?)\s*["'""“”‟‛›«»‹]\s*[-–—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
        name: 'format 6 ("verse" - BOOK 1:19-20)',
      },
      // SCRIPTURE: followed by newline, then "verse" - BOOK (the format AI is using)
      {
        pattern: /SCRIPTURE:[\s\n]*["'""“”‟‛›«»‹]\s*([\s\S]+?)\s*["'""“”‟‛›«»‹]\s*[-–—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
        name: 'format 7 (SCRIPTURE:\n"verse" - BOOK 1:19-20)',
      },
      // Lenient fallback: any quoted text followed by dash and bible reference
      {
        pattern: /["'""“”‟‛›«»‹]\s*([^""“”‟‛›«»‹]+)\s*["'""“”‟‛›«»‹]\s*[-–—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?)/i,
        name: 'format 8 (lenient fallback)',
      },
      // Super lenient: SCRIPTURE: followed by any text, then dash, then reference
      // Handles cases where quotes might be missing or malformed
      {
        pattern: /SCRIPTURE:[\s\n]*["""]?(.+?)\s*[-–—]\s*([1-3]?\s*[A-Za-z]+\s*\d+:\d+(?:[-–]\d+)?)/i,
        name: 'format 9 (super lenient SCRIPTURE)',
      },
      // Ultra lenient: Look for any Bible reference pattern and grab preceding text
      {
        pattern: /["""]([^"""]{10,300})\s*["""]\s*[-–—]\s*([1-3]?\s*[A-Za-z]+\s+\d+:\d+(?:[-–]\d+)?)/i,
        name: 'format 10 (ultra lenient quoted text)',
      },
    ];

        // First, try to find a scripture section - extract up to 500 chars to ensure we get the full reference
        const scriptureSectionMatch = dayContent.match(/(SCRIPTURE|BIBLE VERSE|VERSE|TEXT):[\s\n]*([\s\S]{0,500})(?=REFLECTION|PRAYER|QUESTIONS|$)/i);
        const contentToSearch = scriptureSectionMatch ? scriptureSectionMatch[0] : dayContent;

        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} - Searching for scripture (length: ${contentToSearch.length}):`, contentToSearch.substring(0, 300));

        // Log character codes for debugging quote issues
        const firstQuoteIdx = contentToSearch.indexOf('"');
        if (firstQuoteIdx >= 0) {
          console.log(`[DEVOTIONAL PARSER] Day ${dayNum} - First quote char code: ${contentToSearch.charCodeAt(firstQuoteIdx)} at index ${firstQuoteIdx}`);
        }

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

        // LAST RESORT: If no patterns matched, try to extract any quoted text before a Bible reference
        if (!scriptureText || !scriptureRef) {
          console.log(`[DEVOTIONAL PARSER] Day ${dayNum} - All patterns failed, trying last resort extraction...`);
          
          // Try to find any Bible reference (Book Chapter:Verse pattern)
          const refMatch = contentToSearch.match(/([1-3]?\s*[A-Za-z]+)\s+(\d+:\d+(?:[-–]\d+)?)/);
          if (refMatch) {
            scriptureRef = `${refMatch[1]} ${refMatch[2]}`.trim();
            console.log(`[DEVOTIONAL PARSER] Day ${dayNum} - Found reference: ${scriptureRef}`);
            
            // Now try to find quoted text before this reference
            const beforeRef = contentToSearch.substring(0, contentToSearch.indexOf(refMatch[0]));
            // Match any text between quotes (straight or curly)
            const quoteMatch = beforeRef.match(/["'""\u201C\u201D]([^"'""\u201C\u201D]{10,500})["'""\u201C\u201D]/);
            if (quoteMatch) {
              scriptureText = quoteMatch[1].trim();
              console.log(`[DEVOTIONAL PARSER] Day ${dayNum} - Found quoted text: ${scriptureText.substring(0, 50)}...`);
            }
          }
        }

        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Scripture:`, { text: scriptureText, reference: scriptureRef });
        const scripture = {
          text: cleanScripture(scriptureText),
          reference: cleanScripture(scriptureRef),
        };
        console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Scripture:`, scripture);

        // Extract reflection (handle both DAILY REFLECTION and REFLECTION headers)
        let reflection = '';
        const reflectionMatch = dayContent.match(/(?:DAILY REFLECTION|REFLECTION):\s*([\s\S]*?)(?=(?:REFLECTION QUESTIONS|QUESTIONS|PRAYER):|$)/i);
        if (reflectionMatch) {
          reflection = cleanMarkdown(reflectionMatch[1]).trim();
          
          // CRITICAL: Remove inline questions that AI mistakenly includes in reflection
          // Pattern 1: "Reflect on the following questions..." followed by numbered list
          reflection = reflection.replace(/Reflect on the following questions[^:]*?:\s*\d+\.\s*[\s\S]*$/i, '').trim();
          // Pattern 2: "Consider these questions..." followed by numbered list
          reflection = reflection.replace(/Consider these questions[^:]*?:\s*\d+\.\s*[\s\S]*$/i, '').trim();
          // Pattern 3: "Use these questions..." followed by numbered list
          reflection = reflection.replace(/Use these questions[^:]*?:\s*\d+\.\s*[\s\S]*$/i, '').trim();
          // Pattern 4: Any trailing numbered list (1. 2. 3.) at the end of reflection
          reflection = reflection.replace(/\n\s*\d+\.\s+[^\n]+\s*\d+\.\s+[^\n]+\s*\d+\.\s+[^\n]+\s*$/i, '').trim();
          
          // Preserve AI's natural paragraph structure - do not force artificial breaks
          // The AI is instructed to create organic, flowing paragraphs in its output
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
        
        // FALLBACK: If no proper REFLECTION QUESTIONS section, try to extract inline questions from reflection
        if (reflectionQuestions.length === 0 && reflectionMatch) {
          const reflectionText = reflectionMatch[1];
          // Look for inline questions pattern: "Reflect on..." or "Consider..." followed by numbered list
          const inlineQuestionsMatch = reflectionText.match(/(?:Reflect on the following questions|Consider these questions|Use these questions)[^:]*?:\s*([\s\S]*?)$/i);
          if (inlineQuestionsMatch) {
            const inlineQuestionsRaw = inlineQuestionsMatch[1];
            reflectionQuestions = inlineQuestionsRaw
              .split(/\n|(?=\d+\.)/)
              .map(q => q.trim())
              .filter(q => q && q.match(/^\d+\./))
              .map((q, i) => ({
                id: `q${i + 1}`,
                text: cleanMarkdown(q.replace(/^\d+\.\s*/, '')).trim(),
              }));
            console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Extracted ${reflectionQuestions.length} inline questions from reflection`);
          }
        }
        
        // If we still have no questions, treat as a hard parse error
        if (reflectionQuestions.length === 0) {
          console.error(`[DEVOTIONAL PARSER] Day ${dayNum} has no reflection questions - this is not allowed`);
          throw new Error(`Failed to parse reflection questions for Day ${dayNum}. AI must provide properly formatted questions.`);
        }

        // Extract prayer text - first try day-specific, then fall back to series-level prayer
        let prayerText = '';
        // Match both "PRAYER:" and "### PRAYER:" formats
        const prayerMatch = dayContent.match(/#{0,3}\s*PRAYER:[\s\n]*([\s\S]*?)(?=In Jesus[''']?\s*[Nn]ame|$)/i);
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
          // Try to find series-level prayer (after all days)
          const seriesPrayerMatch = content.match(/#{0,3}\s*PRAYER:[\s\n]*([\s\S]*?)(?=In Jesus[''']?\s*[Nn]ame)/i);
          if (seriesPrayerMatch && seriesPrayerMatch[1]) {
            let prayerBody = cleanMarkdown(seriesPrayerMatch[1])
              .trim()
              .replace(/^[\s\d\-*•.]+/, '')
              .replace(/[\]["]/g, '')
              .trim();
            prayerBody = prayerBody.replace(/^Heavenly Father[,\s]*/i, '');
            prayerBody = prayerBody.replace(/\n{2,}/g, '\n');
            prayerText = `Heavenly Father,\n${prayerBody}\nIn Jesus' Name, Amen`;
            console.log(`[DEVOTIONAL PARSER] Day ${dayNum} Using series-level prayer`);
          } else {
            // No prayer found - throw error
            throw new Error(`Failed to parse prayer for Day ${dayNum}. AI must provide properly formatted prayer.`);
          }
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
  const createErrorResponse = (status: number, userMessage: string, technicalDetails?: unknown) => {
    console.error(`Error ${status}:`, userMessage, technicalDetails);
    return new Response(
      JSON.stringify({
        error: userMessage,
        message: userMessage,
        retryable: status >= 500, // Server errors are retryable
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
    return createErrorResponse(405, 'Invalid request method');
  }

  let requestBody: DevotionalRequestBody;
  try {
    requestBody = await req.json();
    console.log('Request body parsed successfully');

    // Validate required fields
    if (!requestBody.userInput) {
      return createErrorResponse(400, 'Please provide a topic for your devotional');
    }
  } catch (_error) {
    return createErrorResponse(400, 'We couldn\'t process your request. Please try again.');
  }

  const { duration = 1, playbookId, userInput = '', userName = 'User', bibleVersion = 'NASB', dateOfBirth, ageGroup, userTier, isOnboarding } = requestBody;
  console.log('[Generate-Devotional] Request body:', JSON.stringify(requestBody, null, 2));
  console.log('[Generate-Devotional] Bible version received:', bibleVersion);
  console.log('[Generate-Devotional] User input received:', userInput);
  console.log('[Generate-Devotional] User tier:', userTier, 'isOnboarding:', isOnboarding);

  // Extract user ID from authorization header for rate limiting
  const authHeader = req.headers.get('authorization');
  const userId = authHeader ? authHeader.split(' ')[1] : 'anonymous';

  // Check rate limit
  console.log('[Generate-Devotional] Checking rate limit for user:', userId);
  const rateLimitResult = SimpleRateLimiter.checkLimit(userId, RATE_LIMIT_CONFIGS.devotional);
  
  if (!rateLimitResult.allowed) {
    console.log('[Generate-Devotional] Rate limit exceeded for user:', userId);
    return createRateLimitError(
      rateLimitResult,
      `You've created ${RATE_LIMIT_CONFIGS.devotional.maxRequests} devotionals in the last hour. Please wait a moment before creating another.`
    );
  }
  
  console.log('[Generate-Devotional] Rate limit check passed. Remaining:', rateLimitResult.remaining);

  // Simplified age check: only adjust language for teens (13-16)
  console.log('[Generate-Devotional] ========== AGE DETECTION START ==========');
  console.log('[Generate-Devotional] Received dateOfBirth:', dateOfBirth);
  console.log('[Generate-Devotional] Received ageGroup:', ageGroup);
  
  let isTeenUser = false;
  let calculatedAge: number | null = null;
  let ageSource = '';
  
  // PRIORITY 1: Calculate age from dateOfBirth (takes precedence over ageGroup)
  if (dateOfBirth) {
    try {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let userAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        userAge--;
      }
      
      calculatedAge = userAge;
      ageSource = 'dateOfBirth';
      console.log('[Generate-Devotional] Calculated age from dateOfBirth:', userAge);
      
      // Flag ALL youth (age <= 16) for simplified language
      isTeenUser = userAge >= 0 && userAge <= 16;
      console.log('[Generate-Devotional] Is youth (<=16) based on dateOfBirth:', isTeenUser);
    } catch (error) {
      console.log('[Generate-Devotional] ❌ Error calculating age from dateOfBirth:', error);
      ageSource = 'error';
    }
  }
  
  // PRIORITY 2: Only use ageGroup if dateOfBirth is not available or failed
  if (ageSource !== 'dateOfBirth' && typeof ageGroup === 'string') {
    const simplifiedGroups = ['teen', 'teens', 'child', 'children', 'kid', 'youth', 'preteen'];
    if (simplifiedGroups.includes(ageGroup.toLowerCase())) {
      console.log('[Generate-Devotional] Using ageGroup fallback (no valid dateOfBirth):', ageGroup);
      isTeenUser = true;
      ageSource = 'ageGroup';
    } else {
      ageSource = 'ageGroup-not-teen';
    }
  }
  
  console.log('[Generate-Devotional] FINAL: Age source:', ageSource);
  console.log('[Generate-Devotional] FINAL: Calculated age:', calculatedAge);
  if (isTeenUser) {
    console.log('[Generate-Devotional] Teen user detected - simplifying language');
  }
  console.log('[Generate-Devotional] FINAL: Teen user (simplified language):', isTeenUser);
  console.log('[Generate-Devotional] ========== AGE DETECTION END ==========');

  // DISABLE CACHING for personalized content
  // Each user should get unique, personalized devotionals
  console.log('[Generate-Devotional] Caching disabled for personalized content');
  console.log('[Generate-Devotional] Generating new devotional for user:', userName);

  // Add anti-repetition context to user input
  // Phase 5: Remove anti-repetition logic for faster generation
  const enhancedUserInput = userInput;

  if (typeof duration !== 'number' || duration < 1 || duration > 7) {
    return createErrorResponse(400, 'Please choose a devotional length between 1 and 7 days.');
  }

  try {
    // Fetch playbook data if playbookId is provided
    let playbookContext = '';
    let playbookUserInput = '';
    if (playbookId) {
      console.log(`Fetching playbook data for ID: ${playbookId}`);
      const playbookData = await fetchPlaybookData(playbookId);

      if (playbookData) {
        // Always use the playbook's original user_input as the primary context
        if (playbookData.user_input) {
          playbookUserInput = playbookData.user_input;
          console.log('Playbook user_input found:', playbookUserInput.substring(0, 100));
        }

        if (playbookData.truth_in_love) {
          const truthInLove = playbookData.truth_in_love;
          console.log('Truth in Love data found:', truthInLove);

          playbookContext = '\n\n## PLAYBOOK CONTEXT - ORIGINAL STRUGGLE & TRUTH\n';
          playbookContext += `Playbook: ${playbookData.title || 'Unknown'}\n`;

          // Include the original user struggle/situation
          if (playbookUserInput) {
            playbookContext += `\nOriginal User Struggle/Situation:\n${playbookUserInput}\n`;
          }

          if (truthInLove.text) {
            playbookContext += `\nTruth in Love:\n${truthInLove.text}\n`;
          }

          if (truthInLove.summary) {
            playbookContext += `\nTruth Summary:\n${truthInLove.summary}\n`;
          }

          playbookContext += '\n🚨 CRITICAL - STORYTELLING & BIBLICAL LEARNING:\n';
          playbookContext += '- Root the devotional in the ORIGINAL user struggle/situation above\n';
          playbookContext += '- Use biblical narratives, characters, and stories to teach and illustrate\n';
          playbookContext += '- Focus on learning from biblical situations and circumstances\n';
          playbookContext += '- Connect Scripture passages to real-life application\n';
          playbookContext += '- The devotional MUST align with and reinforce the truth from this playbook\n';
          playbookContext += '- Quote or reference the user\'s original words to make it personal';
        } else {
          console.log('No truth_in_love data found for playbook:', playbookId);
          // Even without truth_in_love, include the original user_input
          if (playbookUserInput) {
            playbookContext = `\n\n## ORIGINAL USER STRUGGLE:\n${playbookUserInput}\n\nIMPORTANT: Root the devotional in this original struggle and use biblical storytelling to address it.`;
          }
        }
      }
    }

    const refusalPatterns = [
      /i'm sorry, but i can't assist/i,
      /i'm sorry, but i cannot assist/i,
      /i'm unable to assist/i,
      /i cannot assist with this request/i,
      /i'm unable to help with this/i,
      /i cannot fulfill this request/i,
    ];

    const paraphraseInput = (input: string): string => {
      let paraphrased = input;

      paraphrased = paraphrased.replace(/\b(i want|i need|i will|i must)\b/gi, 'I am thinking about');
      paraphrased = paraphrased.replace(/\b(give me|get me)\b/gi, 'considering');
      paraphrased = paraphrased.replace(/\bnow\b/gi, '');
      paraphrased = paraphrased.replace(/\bimmediately\b/gi, '');
      paraphrased = paraphrased.replace(/\btoday\b/gi, '');
      paraphrased = paraphrased.replace(/\b(trapped|stuck)\b/gi, 'struggling with');
      paraphrased = paraphrased.replace(/\bin a (girl|boy|male|female) body\b/gi, 'my gender identity');
      paraphrased = paraphrased.replace(/\bsex change\b/gi, 'gender transition');
      paraphrased = paraphrased.replace(/\btransition\b/gi, 'exploring my identity');
      paraphrased = paraphrased.replace(/\brape\b/gi, 'sexual assault');
      paraphrased = paraphrased.replace(/\bmurder\b/gi, 'taking a life');
      paraphrased = paraphrased.replace(/\bsuicide\b/gi, 'ending my life');

      return paraphrased.replace(/\s+/g, ' ').trim();
    };

    const buildSystemPrompt = (input: string, original: string) => {
      const personaContext = applyPersonaContext(devotionalAdvisorPersona.systemPrompt, input, bibleVersion);
      return `${personaContext}

🚨 ORIGINAL USER INPUT (DO NOT IGNORE):
- Verbatim Request: ${original}
- Working Copy (only if different): ${input}` + playbookContext;
    };

    const buildUserMessage = (originalInput: string, currentInput: string) => {
      const lines = [
        `User: ${userName}`,
        `Original Request (verbatim): ${originalInput}`,
        currentInput !== originalInput ? `Working Request (safety-adjusted): ${currentInput}` : '',
        `Duration: ${duration} day${duration > 1 ? 's' : ''}`,
      ];

      // If this devotional is linked to a playbook, emphasize using the playbook's original context
      if (playbookId && playbookUserInput) {
        lines.push(`\n🔗 LINKED TO PLAYBOOK - Use the playbook's original struggle as primary context (see PLAYBOOK CONTEXT section above)`);
      }

      if (isTeenUser) {
        lines.push('IMPORTANT: This user is a teenager (13-16 years old). Use simple, clear language - avoid complex theological terms and keep sentences straightforward.');
      }

      return lines.filter(Boolean).join('\n');
    };

    const originalUserInput = userInput;

    const executeOpenAIRequest = async (input: string) => {
      console.log('[Generate-Devotional] Calling OpenAI API with circuit breaker + retry logic...');
      console.log(`[Generate-Devotional] Request params - userTier: ${userTier}, isOnboarding: ${isOnboarding}`);
      
      // Get appropriate API key from pool based on user tier
      // IMPORTANT: Onboarding always uses Key 1 for best first impression
      const tierForKey = isOnboarding ? 'onboarding' : (userTier || 'spark');
      console.log(`[Generate-Devotional] Resolved tierForKey: ${tierForKey}`);
      
      const apiKey = keyPoolManager.getBestKey(authHeader?.split(' ')[1] || 'anonymous', tierForKey);
      
      if (!apiKey) {
        console.error(`[Generate-Devotional] No API key available for tier: ${tierForKey}`);
        throw new Error('Service temporarily unavailable. Please try again in a moment.');
      }
      
      console.log(`[Generate-Devotional] Using API key: ${apiKey.id} for tier: ${tierForKey}`);
      
      const openAIRes = await CircuitBreaker.execute(
        CIRCUIT_KEYS.OPENAI_DEVOTIONAL,
        async () => await fetchWithRetry(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.key}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: buildSystemPrompt(input, originalUserInput),
              },
              {
                role: 'user',
                content: buildUserMessage(originalUserInput, input),
              },
            ],
            temperature: 0.7,
            max_tokens: duration === 7 ? 8000 : 6000,
          }),
        },
        OPENAI_RETRY_CONFIG
        )
      );

      console.log('[Generate-Devotional] OpenAI API call successful');
      
      // Mark key as healthy on success
      keyPoolManager.markHealthy(apiKey.id);
      
      return openAIRes;
    };

    let effectiveUserInput = userInput;
    let usedParaphrasing = false;

    let openAIRes = await executeOpenAIRequest(effectiveUserInput);
    let aiData = await openAIRes.json();
    let rawContent = aiData.choices?.[0]?.message?.content || '';

    if (refusalPatterns.some(pattern => pattern.test(rawContent.toLowerCase()))) {
      console.log('[Generate-Devotional] AI refused, paraphrasing input and retrying...');
      effectiveUserInput = paraphraseInput(userInput);
      usedParaphrasing = true;
      console.log('[Generate-Devotional] Original input:', userInput.substring(0, 100));
      console.log('[Generate-Devotional] Paraphrased input:', effectiveUserInput.substring(0, 100));

      openAIRes = await executeOpenAIRequest(effectiveUserInput);
      aiData = await openAIRes.json();
      rawContent = aiData.choices?.[0]?.message?.content || '';
    }

    if (usedParaphrasing) {
      console.log('[Generate-Devotional] Used paraphrasing to bypass refusal');
    }

    // Log the raw OpenAI response for debugging
    console.log('=== RAW OPENAI RESPONSE ===');
    console.log(JSON.stringify(aiData, null, 2));
    console.log('==========================');

    let content = aiData.choices?.[0]?.message?.content || '';
    
    // Check if AI provided any content at all
    if (!content || content.trim().length === 0) {
      console.error('[DEVOTIONAL] AI returned empty response');
      throw new Error('AI returned empty response - no devotional content generated');
    }
    
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

    // Enforce exact scriptures using BibleGateway scraper for problematic translations
    // NASB removed from scraping list to prevent timeouts (it doesn't have formatting issues)
    // Wrap in timeout to prevent function from crashing if scraping takes too long
    try {
      const SCRIPTURE_TIMEOUT_MS = 15000; // 15 seconds max for scripture enforcement
      console.log('[Generate-Devotional] Starting scripture enforcement...');
      await Promise.race([
        enforceExactScriptures(devotional, bibleVersion || 'NASB'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Scripture enforcement timeout')), SCRIPTURE_TIMEOUT_MS)
        )
      ]);
      console.log('[Generate-Devotional] Scripture enforcement completed successfully');
    } catch (scriptureError) {
      console.warn('[Generate-Devotional] ⚠️ Scripture enforcement failed or timed out, using AI-generated verses:', scriptureError);
      // Continue with AI-generated verses - don't crash the whole function
    }

    // Caching disabled for personalized content
    console.log('[Generate-Devotional] ✅ Preparing response...');
    console.log('[Generate-Devotional] Devotional has', devotional.days.length, 'days');

    const responseData = JSON.stringify(devotional);
    console.log('[Generate-Devotional] ✅ Response ready, size:', responseData.length, 'bytes');

    return new Response(responseData, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Error generating devotional:', error);
    return createErrorResponse(
      500,
      'We couldn\'t create your devotional right now. Please try again in a moment.'
    );
  }
});
