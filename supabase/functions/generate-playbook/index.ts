/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { strategicAdvisorPersona, applyPersonaContext, enforcePersona } from './persona.config.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { fetchWithRetry, OPENAI_RETRY_CONFIG } from '../_shared/retryLogic.ts';
import { SimpleRateLimiter, RATE_LIMIT_CONFIGS, createRateLimitError } from '../_shared/simpleRateLimiter.ts';
import { CircuitBreaker, CIRCUIT_KEYS } from '../_shared/circuitBreaker.ts';
import { ResponseCache, CACHE_CONFIGS, generateCacheKey } from '../_shared/responseCache.ts';

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
  detected_journal_type?: string;
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
  bibleVerse: { text: string; reference: string };
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

function parseOpenAIResponse(aiData: OpenAIData, userName: string, userInput: string): Playbook {
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
    let summary = truthSummaryMatch[1].trim();

    // More robust name replacement to prevent duplicates
    // First, check if it already has the placeholder
    if (!summary.includes('[User\'s Name]')) {
      // Replace any occurrence of the userName (not just at the beginning)
      const userNameRegex = new RegExp(`\\b${userName}\\b`, 'gi');
      summary = summary.replace(userNameRegex, '[User\'s Name]');

      // If still no placeholder found, and the summary doesn't start with the user's name,
      // only add placeholder if the summary seems to be addressing the user directly
      if (!summary.includes('[User\'s Name]') && summary.length > 0) {
        // Check if it starts with a direct address pattern (like "you are", "your", etc.)
        const directAddressPattern = /^(you\s|your\s)/i;
        if (directAddressPattern.test(summary)) {
          summary = '[User\'s Name], ' + summary.charAt(0).toLowerCase() + summary.slice(1);
        }
        // Otherwise, leave the summary as-is to avoid forced name insertion
      }
    }

    playbook.truthInLove.summary = summary;
  }

  // Parse Truth in Love
  const truthInLoveMatch = content.match(/TRUTH IN LOVE:\s*([\s\S]*?)(?=ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (truthInLoveMatch) {
    let truthText = truthInLoveMatch[1].trim();

    // Apply the same robust name replacement logic as summary
    if (!truthText.includes('[User\'s Name]')) {
      // Replace any occurrence of the userName
      const userNameRegex = new RegExp(`\\b${userName}\\b`, 'gi');
      truthText = truthText.replace(userNameRegex, '[User\'s Name]');
    }

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

          // Extract journal type(s) if present
          let journalTypes = ['none']; // default to none instead of reflection
          let cleanSubTaskText = subTaskText;

          const journalMatch = subTaskText.match(/(.+?)\s*\|\s*Journal:\s*([a-z_,\s]+)/i);
          if (journalMatch) {
            cleanSubTaskText = journalMatch[1].trim();
            const journalTypeString = journalMatch[2].trim();
            // Handle multiple types separated by commas
            journalTypes = journalTypeString.split(',').map(type => type.trim()).filter(type => type.length > 0);
          }

          // Use the first journal type for the main field (for backward compatibility)
          const primaryJournalType = journalTypes[0] || 'none';

          if (cleanSubTaskText) {
            subTasks.push({
              id: generateUUID(),
              text: cleanSubTaskText,
              completed: false,
              detected_journal_type: primaryJournalType,
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
  }

  // Parse Affirmations
  const affMatch = content.match(/AFFIRMATIONS?:\s*([\s\S]*?)(?=BIBLE VERSE:|CHALLENGE:|$)/i);
  if (affMatch) {
    const affirmations = affMatch[1].split(/\n/).filter(l => l.trim().length > 0);
    playbook.affirmations = affirmations.map((text, _idx) => {
      // Remove any leading numbers, dots, dashes, or other punctuation
      const cleanText = text.replace(/^[\s\d\-*•.]+/, '').trim();
      return {
        id: generateUUID(),
        text: cleanText,
        completed: false,
      };
    });
  }

  // Parse Bible Verse with enhanced scripture patterns
  const verseMatch = content.match(/BIBLE VERSE:\s*([\s\S]*?)(?=CHALLENGE:|$)/i);
  if (verseMatch) {
    const verseContent = verseMatch[1].trim();

    // Define scripture patterns to try in order of specificity
    const scripturePatterns = [
      // Format: "verse" - BOOK 1:19-20 (with dash)
      {
        pattern: /['"]([^'"\n]+)['"]\s*[-—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
        name: 'format 1 ("verse" - BOOK 1:19-20 with dash)',
      },
      // Format: BOOK 1:19-20 - "verse"
      {
        pattern: /([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*[-—]\s*['"]([^'"\n]+)['"]/i,
        name: 'format 2 (BOOK 1:19-20 - "verse")',
      },
      // Format: BOOK 1:19-20 verse (without quotes)
      {
        pattern: /([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s+([^\n]+)/i,
        name: 'format 3 (BOOK 1:19-20 verse)',
      },
      // Fallback: Just look for a verse reference pattern
      {
        pattern: /([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i,
        name: 'format 4 (just verse reference)',
      },
    ];

    let verseText = '';
    let verseRef = '';

    // Try each pattern until we find a match
    for (const { pattern, name } of scripturePatterns) {
      const match = verseContent.match(pattern);
      if (match) {
        console.log(`Matched scripture format: ${name}`, match);

        // Determine which group is the text and which is the reference
        if (match[1] && match[2]) {
          // If the first group looks like a reference, use it as such
          if (match[1].match(/[A-Za-z]+\s*\d+[\s:]/i)) {
            verseRef = match[1].trim().toUpperCase();
            verseText = match[2].trim();
          } else {
            verseText = match[1].trim();
            verseRef = match[2].trim().toUpperCase();
          }
          break;
        } else if (match[1]) {
          // If we only have one group, assume it's a reference
          verseRef = match[1].trim().toUpperCase();
          verseText = verseContent.replace(match[0], '').trim();
          break;
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

    // Clean up the verse text (remove any remaining quotes or dashes at the start/end)
    verseText = verseText.replace(/^[\s"'`-]+|[\s"'`-]+$/g, '').trim();

    // Set the values in the playbook
    playbook.bibleVerse.text = verseText || verseContent;
    playbook.bibleVerse.reference = verseRef || '';
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

  const { userInput, userName, userId } = requestBody;

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

  // Generate cache key (exclude userName - it's just a placeholder that gets replaced)
  const cacheKey = generateCacheKey('playbook', {
    userInput,
  });

  // Check cache first
  console.log('[Generate-Playbook] Checking cache...');
  const cachedResponse = ResponseCache.get(cacheKey, CACHE_CONFIGS.playbook);
  if (cachedResponse) {
    console.log('[Generate-Playbook] Returning cached response');
    return new Response(JSON.stringify(cachedResponse), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
      },
    });
  }
  console.log('[Generate-Playbook] Cache miss, generating new playbook...');

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

    // Persona context is applied through the system prompt
    // Keeping the function call for future use
    applyPersonaContext(strategicAdvisorPersona, userInput);

    // ENTERPRISE FEATURE: Enrich prompt with timestamp and context for uniqueness
    const timestamp = new Date().toISOString();
    const contextualPrompt = recentTitles.length > 0
      ? `User: ${userName}\nStruggle: ${userInput}\nGeneration Time: ${timestamp}\n\nNote: User has existing playbooks. Create a different title.`
      : `User: ${userName}\nStruggle: ${userInput}\nGeneration Time: ${timestamp}`;

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

    // Parse the playbook
    let playbook = parseOpenAIResponse(aiData, userName, userInput);

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
          userInput
        );
      }
    }

    // Set totalTasks to the number of main action steps
    playbook.totalTasks = playbook.actionSteps.length;
    playbook.progress = 0; // Reset progress to 0 since no tasks are completed yet
    playbook.persona = strategicAdvisorPersona.role; // Track which persona was used

    // Cache the successful response
    ResponseCache.set(cacheKey, playbook, CACHE_CONFIGS.playbook);
    console.log('[Generate-Playbook] Response cached successfully');

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
