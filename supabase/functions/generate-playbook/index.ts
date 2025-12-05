/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { strategicAdvisorPersona, applyPersonaContext, enforcePersona } from './persona.config.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { fetchWithRetry, OPENAI_RETRY_CONFIG } from '../_shared/retryLogic.ts';
import { SimpleRateLimiter, RATE_LIMIT_CONFIGS, createRateLimitError } from '../_shared/simpleRateLimiter.ts';
import { CircuitBreaker, CIRCUIT_KEYS } from '../_shared/circuitBreaker.ts';
import { ResponseCache, CACHE_CONFIGS, generateCacheKey } from '../_shared/responseCache.ts';
import { bibleVerseService, BibleVerseService } from '../_shared/bibleVerseService.ts';

/**
 * Generate a UUID v4 compatible with Deno
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : ((r % 4) + 8);
    return v.toString(16);
  });
}

interface SubTask {
  id: string;
  text: string;
  completed: boolean;
  is_example?: boolean;
  example_interactive?: boolean;
  orderIndex?: number;
}

interface ActionStep {
  id: string;
  title: string;
  subTasks: SubTask[];
  examples: string[];
  example_interactive?: boolean;
  completed: boolean;
  orderIndex?: number;
}

interface Playbook {
  id: string;
  title: string;
  subtitle: string;
  truthInLove: {
    summary: string;
    text: string;
  };
  actionSteps: ActionStep[];
  affirmations: { id: string; text: string; completed: boolean }[];
  bibleVerse: { text: string; reference: string; version?: string };
  directChallenge: string;
  createdAt: string;
  updatedAt: string;
  userInput: string;
  progress: number;
  totalTasks: number;
  persona?: string;
  profileImage?: string;
}

interface OpenAIData {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function enforcePlaybookBibleVerse(playbook: Playbook, version: string): Promise<void> {
  console.log(`[Playbook Scripture] ============ ENFORCEMENT START ============`);
  console.log(`[Playbook Scripture] Version: ${version}`);
  console.log(`[Playbook Scripture] Current verse text (first 100 chars): ${playbook.bibleVerse?.text?.substring(0, 100)}`);
  console.log(`[Playbook Scripture] Current reference: ${playbook.bibleVerse?.reference}`);

  if (!playbook.bibleVerse?.reference) {
    console.warn('[Playbook Scripture] ❌ No reference found, skipping enforcement');
    return;
  }

  // Check if this version requires scraping
  const requiresScraping = ['MSG', 'AMP', 'NLT', 'CSB'].includes(version.toUpperCase());
  console.log(`[Playbook Scripture] Requires scraping: ${requiresScraping}`);

  try {
    const originalReference = playbook.bibleVerse.reference;
    const originalText = playbook.bibleVerse.text;
    
    console.log(`[Playbook Scripture] Calling bibleVerseService.fetchVerse...`);
    const exactVerse = await bibleVerseService.fetchVerse(originalReference, version);
    
    console.log(`[Playbook Scripture] ✅ Fetch successful - Source: ${exactVerse.source}`);
    console.log(`[Playbook Scripture] Scraped text (first 100 chars): ${exactVerse.text.substring(0, 100)}`);
    console.log(`[Playbook Scripture] Scraped reference: ${exactVerse.reference}`);
    
    playbook.bibleVerse.text = exactVerse.text;
    playbook.bibleVerse.reference = exactVerse.reference;
    playbook.bibleVerse.version = version;

    console.log(`[Playbook Scripture] Verse text replaced:`, {
      wasAIText: originalText !== exactVerse.text,
      aiTextLength: originalText.length,
      scrapedTextLength: exactVerse.text.length,
      referenceChanged: originalReference !== exactVerse.reference,
      source: exactVerse.source,
    });
    console.log(`[Playbook Scripture] FINAL playbook.bibleVerse:`, {
      text: playbook.bibleVerse.text.substring(0, 100),
      reference: playbook.bibleVerse.reference,
      version: playbook.bibleVerse.version,
    });
    console.log(`[Playbook Scripture] ============ ENFORCEMENT END ============`);
  } catch (error) {
    console.error('[Playbook Scripture] ❌ ENFORCEMENT FAILED:', error);
    console.error('[Playbook Scripture] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.log('[Playbook Scripture] ⚠️  Keeping AI-generated text as fallback');
    console.log(`[Playbook Scripture] ============ ENFORCEMENT END (FAILED) ============`);
  }
}

function parseOpenAIResponse(aiData: OpenAIData, _userName: string, userInput: string, bibleVersion?: string): Playbook {
  const content = aiData.choices[0]?.message?.content || '';

  // Extract playbook title and subtitle
  let mainTitle = '';
  let subtitle = '';

  // First try to match the exact format with angle brackets
  const titleMatch = content.match(/PLAYBOOK TITLE:\s*\n<([^>]+)>\n<([^>]*)>/i);
  if (titleMatch) {
    mainTitle = titleMatch[1].trim();
    subtitle = titleMatch[2].trim();
  } else {
    // Fallback to the original method if the exact format isn't found
    const playbookTitleMatch = content.match(/PLAYBOOK TITLE:\s*([\s\S]*?)(?=\n(?:TRUTH SUMMARY:|TRUTH IN LOVE:|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$))/i);
    if (playbookTitleMatch) {
      const titleLines = playbookTitleMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
      mainTitle = titleLines[0] || '';
      subtitle = titleLines[1] || '';
    }
  }

  // Clean up markdown formatting and quotes from titles
  const cleanMarkdown = (text: string): string => {
    if (!text) {return '';}
    // Remove markdown bold/italic formatting (**, __, *)
    let cleaned = text.replace(/\*\*|__|\*/g, '').trim();
    // Remove quotes from titles
    cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '').trim();
    return cleaned;
  };

  mainTitle = cleanMarkdown(mainTitle);
  subtitle = cleanMarkdown(subtitle);

  const playbook: Playbook = {
    id: generateUUID(),
    title: mainTitle,
    subtitle,
    truthInLove: {
      summary: '',
      text: '',
    },
    actionSteps: [],
    affirmations: [],
    bibleVerse: { text: '', reference: '' },
    directChallenge: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userInput,
    progress: 0,
    totalTasks: 0,
  };

  // Parse Truth Summary
  const truthSummaryMatch = content.match(/TRUTH SUMMARY:\s*([\s\S]*?)(?=TRUTH IN LOVE:|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (truthSummaryMatch) {
    const summary = truthSummaryMatch[1].trim();

    // Keep the actual userName in playbooks (don't replace with placeholder)
    // The AI should include the user's name naturally in the summary

    playbook.truthInLove.summary = summary;
  }

  // Parse Truth in Love
  const truthInLoveMatch = content.match(/TRUTH IN LOVE:\s*([\s\S]*?)(?=ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (truthInLoveMatch) {
    const truthText = truthInLoveMatch[1].trim();

    // Keep the actual userName in playbooks (don't replace with placeholder)
    // The AI should include the user's name naturally in the truth text

    playbook.truthInLove.text = truthText;
  }

  // Parse Action Steps with Smart Journaling
  const actionStepsMatch = content.match(/ACTION STEPS:\s*([\s\S]*?)(?=AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (actionStepsMatch) {
    const stepBlocks = actionStepsMatch[1]
      .split(/\n(?=\d+\.\s)/)
      .filter((block: string) => block.match(/^\d+\./));

    playbook.actionSteps = stepBlocks.map((block: string, idx: number) => {
      const lines = block.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const titleLine = lines[0].replace(/^\d+\.\s*/, '');
      const subTasks: SubTask[] = [];
      const examples: string[] = [];
      let exampleInteractive = false;

      lines.slice(1).forEach((line: string) => {
        const trimmedLine = line.trim();
        if (/^-\s*Sub-task:/i.test(trimmedLine)) {
          const subTaskText = trimmedLine.replace(/^-\s*Sub-task:\s*/i, '').trim();

          if (subTaskText) {
            subTasks.push({
              id: generateUUID(),
              text: subTaskText,
              completed: false,
              is_example: false,
              example_interactive: false,
              orderIndex: subTasks.length,
            });
          }
        } else if (/^-\s*Example:/i.test(trimmedLine)) {
          const exampleText = trimmedLine.replace(/^-\s*Example:\s*/i, '').trim();

          // Check if example is interactive
          const interactiveMatch = exampleText.match(/(.+?)\s*\|\s*Interactive:\s*(true|false)/i);
          if (interactiveMatch) {
            const cleanExampleText = interactiveMatch[1].trim();
            exampleInteractive = interactiveMatch[2].toLowerCase() === 'true';
            if (cleanExampleText) {examples.push(cleanExampleText);}
          } else if (exampleText) {
            examples.push(exampleText);
          }
        } else if (subTasks.length > 0 && !trimmedLine.startsWith('- ')) {
          // Handle multi-line sub-tasks
          const lastIndex = subTasks.length - 1;
          subTasks[lastIndex].text = `${subTasks[lastIndex].text} ${trimmedLine}`.trim();
        }
      });

      return {
        id: generateUUID(),
        title: titleLine,
        subTasks,
        examples,
        example_interactive: exampleInteractive,
        completed: false,
        orderIndex: idx,
      };
    });

    // Calculate total tasks (count all subtasks)
    playbook.totalTasks = playbook.actionSteps.reduce((total, step) => total + step.subTasks.length, 0);
    
    // Validate that each action step has at least one example
    playbook.actionSteps.forEach((step, index) => {
      if (!step.examples || step.examples.length === 0) {
        console.warn(`⚠️ Action step ${index + 1} ("${step.title}") is missing examples. Adding placeholder.`);
        step.examples = [`For "${step.title}": Set aside dedicated time this week to work through this step. Break it into smaller tasks, pray for guidance, and track your progress in the app.`];
      }
    });
  }

  // Parse Affirmations
  const affMatch = content.match(/AFFIRMATIONS?:\s*([\s\S]*?)(?=BIBLE VERSE:|CHALLENGE:|$)/i);
  if (affMatch) {
    const affirmations = affMatch[1].split(/\n/).filter(l => l.trim().length > 0);
    playbook.affirmations = affirmations
      .map((text, _idx) => {
        // Remove any leading numbers, dots, dashes, or other punctuation
        const cleanText = text.replace(/^[\s\d\-*•.]+/, '').trim();
        
        // Check if affirmation contains a Bible verse reference
        const verseRefMatches = cleanText.match(/([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/gi);
        
        if (verseRefMatches) {
          // Get unique references to avoid duplicates
          const uniqueRefs = Array.from(new Set(verseRefMatches.map(ref => ref.trim())));
          const reference = uniqueRefs[0]; // Use the first unique reference
          
          // Check if the reference is already in the text
          const hasReferenceInText = cleanText.includes(`(${reference})`);
          
          if (hasReferenceInText) {
            // Reference already exists, just return the clean text as-is
            return {
              id: generateUUID(),
              text: cleanText,
              completed: false,
            };
          } else {
            // Remove parenthetical Bible references at the end only
            let affirmationText = cleanText.replace(/\s*\([^)]*\d+:\d+[^)]*\)\s*$/g, '').trim();
            
            // Clean up extra whitespace
            affirmationText = affirmationText.replace(/\s{2,}/g, ' ').trim();
            
            // If there's still text before the references, keep it with the reference
            if (affirmationText && affirmationText.length > 0) {
              return {
                id: generateUUID(),
                text: `${affirmationText} (${reference})`,
                completed: false,
              };
            } else {
              // Just return the reference in parentheses
              return {
                id: generateUUID(),
                text: `(${reference})`,
                completed: false,
              };
            }
          }
        }
        
        // Filter out lines that are just Bible verse references without any affirmation text
        const isBibleReferenceOnly = /^[A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:\s*[A-Z]+)?$/i.test(cleanText);
        
        if (isBibleReferenceOnly) {
          return null; // Filter out standalone Bible verse references
        }
        
        return {
          id: generateUUID(),
          text: cleanText,
          completed: false,
        };
      })
      .filter((aff): aff is { id: string; text: string; completed: boolean } => aff !== null);
  }

  // Parse Bible Verse with enhanced scripture patterns
  const verseMatch = content.match(/BIBLE VERSE:\s*([\s\S]*?)(?=CHALLENGE:|$)/i);
  if (verseMatch) {
    const verseContent = verseMatch[1].trim();
    console.log('[BIBLE VERSE PARSER] Raw content:', verseContent.substring(0, 200));

    // Define scripture patterns to try in order of specificity
    // Updated to handle the formats specified in the AI prompt
    const scripturePatterns = [
      // Format: "verse" (BOOK 1:19-20) (reference in parentheses) - most common AI output
      {
        pattern: /['"]([^'"\n]+)['"]\s*\(\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*\)/i,
        name: 'format "verse" (reference)',
      },
      // Format: "verse" (BOOK 1:19) (VERSION) - AI output with version
      {
        pattern: /['"]([^'"\n]+)['"]\s*\(\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*\)\s*\(\s*([A-Z]+)\s*\)/i,
        name: 'format "verse" (reference) (version)',
      },
      // Format: BOOK 1:19: "verse" (reference first, with colon)
      {
        pattern: /([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*:\s*['"]([^'"\n]+)['"]/i,
        name: 'format reference: "verse" (with colon)',
      },
      // Format: BOOK 1:19-20: "verse" (with dash)
      {
        pattern: /([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*:\s*['"]([^'"\n]+)['"]/i,
        name: 'format reference: "verse" (with dash)',
      },
      // Format: "verse" - BOOK 1:19-20 (with dash)
      {
        pattern: /['"]([^'"\n]+)['"]\s*[-—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
        name: 'format "verse" - reference (with dash)',
      },
      // Format: BOOK 1:19-20 - "verse"
      {
        pattern: /([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*[-—]\s*['"]([^'"\n]+)['"]/i,
        name: 'format reference - "verse"',
      },
      // Format: BOOK 1:19-20 verse (without quotes)
      {
        pattern: /([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s+([^\n]+)/i,
        name: 'format reference verse (no quotes)',
      },
      // Format: "verse" (just quoted verse without reference) - must be substantial text
      {
        pattern: /^['"]([^'"\n]{50,})['"]$/i,
        name: 'format "verse" (no reference)',
      },
    ];

    let verseText = '';
    let verseRef = '';

    // Try each pattern to extract verse text and reference
    for (const { pattern, name } of scripturePatterns) {
      const match = verseContent.match(pattern);
      if (match) {
        console.log(`[BIBLE VERSE] Matched pattern: ${name}`);
        
        // For patterns where reference comes first (groups 1=ref, 2=text)
        if (name.includes('reference:')) {
          verseRef = match[1]?.trim() || '';
          verseText = match[2]?.trim() || '';
        } 
        // For patterns with text, reference, and version (groups 1=text, 2=ref, 3=version)
        else if (name.includes('(version)')) {
          verseText = match[1]?.trim() || '';
          verseRef = match[2]?.trim() || '';
          // The version (match[3]) is captured but not used since we handle version separately
        }
        // For patterns where text comes first (groups 1=text, 2=ref)
        else if (name.includes('"verse"')) {
          if (name.includes('(no reference)')) {
            verseText = match[1]?.trim() || '';
            verseRef = 'Philippians 4:6'; // Default reference from context
          } else {
            verseText = match[1]?.trim() || '';
            verseRef = match[2]?.trim() || '';
          }
        }
        // For fallback pattern (just reference)
        else if (name.includes('just verse reference')) {
          verseRef = match[1]?.trim() || '';
          verseText = verseContent.replace(verseRef, '').trim();
        }
        
        // If we found both text and reference, break
        if (verseText && verseRef) {
          break;
        }
      }
    }

    // If no pattern matched, try to extract reference from the content
    if (!verseRef) {
      // Look for reference pattern that's NOT at the start of a quoted verse
      const refMatch = verseContent.match(/^(?:"[^"]+"\s*)?([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i);
      if (refMatch) {
        verseRef = refMatch[1]?.trim() || '';
        // Only replace if we actually found a reference (not the entire quoted text)
        if (verseRef && verseContent.includes(verseRef) && verseContent.length > verseRef.length) {
          verseText = verseContent.replace(verseRef, '').replace(/^"\s*|\s*"$/g, '').trim();
        } else {
          // If the entire content is a quoted verse, treat it all as text
          verseText = verseContent.replace(/^"\s*|\s*"$/g, '').trim();
          verseRef = '';
        }
      }
    }

    // If we found a reference but no text, use the entire content
    if (verseRef && !verseText) {
      verseText = verseContent.replace(verseRef, '').trim();
    }
    // If we found text but no reference, try to extract one from the text
    else if (verseText && !verseRef) {
      const refMatch = verseText.match(/([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i);
      if (refMatch) {
        verseRef = refMatch[0].trim().toUpperCase();
        verseText = verseText.replace(verseRef, '').trim();
      }
    }

    // NO CLEANING - Preserve exact Bible verse text as provided by AI
    // AMP and other translations require exact formatting including brackets and quotes
    // Only trim whitespace and remove version markers if present at the very end
    verseText = verseText.trim();

    // Remove version marker like (AMP), ( AMP), (NASB) etc. from the end of verse text
    verseText = verseText.replace(/\s*\(\s*[A-Z]{2,5}\s*\)\s*$/i, '').trim();

    // Set the values in the playbook (text is the raw verse text, reference is just book/chapter/verse)
    playbook.bibleVerse.text = verseText || verseContent;

    // Clean the reference and strip any trailing version marker like (AMP), (NASB) etc.
    let cleanVerseRef = verseRef ? verseRef.trim() : '';
    if (cleanVerseRef) {
      cleanVerseRef = cleanVerseRef.replace(/\s*\(\s*[A-Z]{2,5}\s*\)\s*$/i, '').trim();
    }
    
    console.log('[BIBLE VERSE PARSER] Extracted values:', {
      verseText: verseText.substring(0, 100),
      verseRef,
      cleanVerseRef,
      hasReference: !!cleanVerseRef,
    });
    
    // FALLBACK: If no reference found in BIBLE VERSE section, scan the entire AI output
    if (!cleanVerseRef) {
      console.warn('[BIBLE VERSE PARSER] No reference in BIBLE VERSE section, scanning full content...');
      
      // Look for scripture references anywhere in the full content
      const fullRefMatch = content.match(/([A-Za-z0-9]+\s+\d+:\d+(?:-\d+)?)/);
      if (fullRefMatch) {
        cleanVerseRef = fullRefMatch[1].trim();
        console.log('[BIBLE VERSE PARSER] Found reference in full content:', cleanVerseRef);
      } else {
        console.error('[BIBLE VERSE PARSER] ❌ No scripture reference found anywhere in AI output!');
        console.error('[BIBLE VERSE PARSER] AI must include reference like: "verse text" (Book 1:1)');
      }
    }
    
    playbook.bibleVerse.reference = cleanVerseRef;
    
    // Store the Bible version that was used for generation
    playbook.bibleVerse.version = bibleVersion || 'NASB';
  }

  // Parse Direct Challenge
  const challengeMatch = content.match(/CHALLENGE:\s*([\s\S]*)/i);
  if (challengeMatch) {
    playbook.directChallenge = challengeMatch[1].trim();
  }

  return playbook;
}

interface RequestBody {
  userInput: string;
  userName: string;
  userId?: string;
  dateOfBirth?: string;  // ISO date string from user profile
  ageGroup?: string;     // From onboarding: 'teen', 'young-adult', 'adult', 'middle-aged', 'senior'
  bibleVersion?: string; // User's preferred Bible translation (default: NASB)
  location?: string;     // User's location for regional resources (e.g., "Philippines", "USA", "UK")
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Invalid request method' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let requestBody: RequestBody;
  try {
    requestBody = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: 'We couldn\'t process your request. Please try again.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { userInput, userName, userId, dateOfBirth, ageGroup, bibleVersion, location } = requestBody;

  // Log received Bible version for debugging
  console.log('[Generate-Playbook] Received Bible version from request:', bibleVersion || 'NOT PROVIDED - will default to NASB');

  // Extract user ID from authorization header for rate limiting
  const authHeader = req.headers.get('authorization');
  const rateLimitUserId = authHeader ? authHeader.split(' ')[1] : userId || 'anonymous';

  // Check rate limit
  console.log('[Generate-Playbook] Checking rate limit for user:', rateLimitUserId);
  const rateLimitResult = SimpleRateLimiter.checkLimit(rateLimitUserId, RATE_LIMIT_CONFIGS.playbook);
  
  if (!rateLimitResult.allowed) {
    console.log('[Generate-Playbook] Rate limit exceeded for user:', rateLimitUserId);
    return createRateLimitError(
      rateLimitResult,
      `You've created ${RATE_LIMIT_CONFIGS.playbook.maxRequests} playbooks in the last hour. Please wait a moment before creating another.`
    );
  }
  
  console.log('[Generate-Playbook] Rate limit check passed. Remaining:', rateLimitResult.remaining);

  // Simplified age check: only adjust language for teens (13-16)
  let isTeenUser = false;
  
  if (dateOfBirth) {
    try {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let userAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        userAge--;
      }
      
      // Only flag teens (13-16) for simplified language
      isTeenUser = userAge >= 13 && userAge <= 16;
    } catch (error) {
      console.log('[Generate-Playbook] Error calculating age:', error);
    }
  }
  
  // Fallback to age group from onboarding
  if (!isTeenUser && ageGroup === 'teen') {
    isTeenUser = true;
  }
  
  console.log('[Generate-Playbook] Teen user (simplified language):', isTeenUser);

  // DISABLE CACHING for personalized content
  // Each user should get unique, personalized playbooks
  console.log('[Generate-Playbook] Caching disabled for personalized content');
  console.log('[Generate-Playbook] Generating new playbook for user:', userName);

  try {
    // ENTERPRISE FEATURE: Fetch user's recent playbook titles to ensure uniqueness
    let recentTitles: string[] = [];
    if (userId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          // Fetch last 10 playbook titles for this user
          const { data: recentPlaybooks } = await supabase
            .from('playbooks')
            .select('title')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);
          
          if (recentPlaybooks && recentPlaybooks.length > 0) {
            recentTitles = recentPlaybooks.map((p: { title: string }) => p.title).filter(Boolean);
            console.log(`Found ${recentTitles.length} recent playbook titles for context`);
          }
        }
      } catch (error) {
        console.warn('Could not fetch recent playbooks for context:', error);
        // Continue without context - non-blocking
      }
    }

    // Initialize contextual prompt
    let contextualPrompt = '';
    
    // Apply persona context with Bible version
    contextualPrompt = applyPersonaContext(strategicAdvisorPersona, userInput, bibleVersion);
    
    // ENTERPRISE FEATURE: Enrich prompt with timestamp and context for uniqueness
    // Build contextual prompt with title uniqueness check and age personalization
    // Add unique timestamp to ensure no caching and fresh generation every time
    const generationTimestamp = new Date().toISOString();
    contextualPrompt += `\n\nUser Name: ${userName}\nUser Request: ${userInput}\nGeneration ID: ${generationTimestamp}

${recentTitles.length > 0 ? `\n\n## TITLE UNIQUENESS REQUIREMENT\nThe user already has these playbook titles:\n${recentTitles.map(t => `- "${t}"`).join('\n')}\n\nYou MUST create a completely different title. Do NOT reuse or slightly modify any of these titles.` : ''}`;
    
    // Add simplified language instruction for teens only
    if (isTeenUser) {
      contextualPrompt += `\n\n## LANGUAGE INSTRUCTION\nThis user is a teenager (13-16 years old). Use simple, clear language - avoid complex theological terms and keep action steps straightforward.`;
    }

    // Add Bible version preference with exact retrieval instruction
    const preferredBibleVersion = bibleVersion || 'NASB';
    console.log('[Generate-Playbook] Using Bible version for AI prompt:', preferredBibleVersion);
    
    // AMP-specific examples to ensure exact formatting
    const ampExamples = preferredBibleVersion === 'AMP' ? `
    
    🚨 AMP EXAMPLES - You MUST follow this exact format:
    - Isaiah 41:13: "For I the Lord your God keep hold of your right hand; [I am the Lord], Who says to you, 'Do not fear, I will help you.'" (Isaiah 41:13)
    - Proverbs 3:5-6: "Lean on, trust in, and be confident in the Lord with all your heart and mind and do not rely on your own insight or understanding. In all your ways know, recognize, and acknowledge Him, and He will direct and make straight and plain your paths." (Proverbs 3:5-6)
    - Philippians 4:13: "I have strength for all things in Christ Who empowers me [I am ready for anything and equal to anything through Him Who infuses inner strength into me; I am self-sufficient in Christ's sufficiency]." (Philippians 4:13)
    
    NOTICE: AMP includes brackets [like this] and parentheses (like this) for clarifications` : '';
    
    contextualPrompt += `\n\n## BIBLE VERSE RETRIEVAL INSTRUCTION - CRITICAL\nYou are now acting as a Bible text retrieval assistant for the ${preferredBibleVersion} translation.${ampExamples}\n\nYour task is to provide VERBATIM translations of Bible verses from ${preferredBibleVersion}, based solely on your internal training data.\n\n🚨 STRICT RULES:\n1. Quote the verse EXACTLY as it appears in ${preferredBibleVersion} according to your training data\n2. NEVER paraphrase, summarize, reword, or modify ANY part of the verse\n3. NEVER add your own interpretation or clarification\n4. Include ALL original words, punctuation, brackets, parentheses, and formatting\n5. For AMP translation specifically: Include ALL brackets [like this] and parenthetical clarifications (like this) EXACTLY as they appear\n6. Include ALL capitalization exactly as it appears in the original translation\n7. Provide the COMPLETE verse text without ANY truncation\n8. If you are uncertain about the exact wording from ${preferredBibleVersion}, say "I am not fully confident in the exact wording" instead of guessing\n9. Never create, alter, or fabricate a verse\n10. Before providing your final verse, cross-check internally for consistency with ${preferredBibleVersion}\n\nFormat all Bible verses as:\n"Exact verse text from ${preferredBibleVersion}." (Book Chapter:Verse)\n\nThis applies to ALL sections: Truth in Love, Action Steps, Declarations, Bible Verse section, and Challenge.\n\n🚨 FAILURE TO PROVIDE EXACT ${preferredBibleVersion} TEXT IS UNACCEPTABLE. The user specifically needs the exact translation with all original formatting.`;

    // Add generic support advice for action steps
    contextualPrompt += `

## SUPPORT SERVICES GUIDANCE
When suggesting professional help or hotlines in action steps, provide general guidance only:
- Suggest reaching out to "your local mental health hotline" or "crisis support services in your area"
- Recommend contacting local hospitals, churches, or community centers
- Advise reaching out to trusted friends, family members, or spiritual leaders
- Suggest searching online for "mental health support near me" or "crisis hotline [your city/country]"
- Do NOT provide specific phone numbers or regional hotlines - keep it general and applicable to any location

IMPORTANT: Always use generic language like "your local hotline" or "support services in your area" rather than specific numbers or regional resources.`;

    // Call OpenAI API with circuit breaker + retry logic
    console.log('[Generate-Playbook] Calling OpenAI API with circuit breaker + retry logic...');
    const openAIRes = await CircuitBreaker.execute(
      CIRCUIT_KEYS.OPENAI_PLAYBOOK,
      async () => await fetchWithRetry(
      'https://api.openai.com/v1/chat/completions',
      {
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
              content: strategicAdvisorPersona.systemPrompt,
            },
            {
              role: 'user',
              content: contextualPrompt,
            },
          ],
          temperature: 0.85, // Increased from 0.7 for more creative variation
          max_tokens: 2500,
        }),
      },
      OPENAI_RETRY_CONFIG
      )
    );
    
    console.log('[Generate-Playbook] OpenAI API call successful');

    const aiData = await openAIRes.json();

    // Log raw AI response for debugging
    const rawContent = aiData.choices?.[0]?.message?.content || '';
    console.log('[Generate-Playbook] ========== RAW AI OUTPUT START ==========');
    console.log(rawContent);
    console.log('[Generate-Playbook] ========== RAW AI OUTPUT END ==========');
    
    // Extract and log just the Bible verse section
    const bibleVerseMatch = rawContent.match(/BIBLE VERSE:\s*([\s\S]*?)(?=CHALLENGE:|$)/i);
    if (bibleVerseMatch) {
      console.log('[Generate-Playbook] ========== BIBLE VERSE SECTION START ==========');
      console.log(bibleVerseMatch[1].trim());
      console.log('[Generate-Playbook] ========== BIBLE VERSE SECTION END ==========');
    } else {
      console.log('[Generate-Playbook] ⚠️ WARNING: No BIBLE VERSE section found in AI response');
    }

    // Parse the playbook
    let playbook = parseOpenAIResponse(aiData, userName, userInput, preferredBibleVersion);

    // Enforce persona rules on the response
    if (aiData.choices?.[0]?.message?.content) {
      const enforcedContent = enforcePersona(
        aiData.choices[0].message.content,
        strategicAdvisorPersona
      );

      // Update playbook with enforced content if needed
      if (enforcedContent !== aiData.choices[0].message.content) {
        playbook = parseOpenAIResponse(
          { choices: [{ message: { content: enforcedContent } }] },
          userName,
          userInput,
          preferredBibleVersion
        );
      }
    }

    // Enforce exact scripture text for playbook verse using scraper when needed
    await enforcePlaybookBibleVerse(playbook, preferredBibleVersion);

    // Set totalTasks to the number of main action steps
    playbook.totalTasks = playbook.actionSteps.length;
    playbook.progress = 0; // Reset progress to 0 since no tasks are completed yet
    playbook.persona = strategicAdvisorPersona.role; // Track which persona was used

    // Caching disabled for personalized content
    console.log('[Generate-Playbook] Response generated (not cached)');

    return new Response(JSON.stringify(playbook, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
      },
    });
  } catch (error: unknown) {
    console.error('Error generating playbook:', error);
    return new Response(
      JSON.stringify({
        error: 'We couldn\'t create your playbook right now',
        message: 'Something went wrong while creating your personalized playbook. Please try again in a moment.',
        retryable: true,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
