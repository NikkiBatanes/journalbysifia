/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { strategicAdvisorPersona, applyPersonaContext, enforcePersona } from './persona.config.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { fetchWithRetry, OPENAI_RETRY_CONFIG } from '../_shared/retryLogic.ts';
import { SimpleRateLimiter, RATE_LIMIT_CONFIGS, createRateLimitError } from '../_shared/simpleRateLimiter.ts';
import { CircuitBreaker, CIRCUIT_KEYS } from '../_shared/circuitBreaker.ts';
import { ResponseCache, CACHE_CONFIGS, generateCacheKey } from '../_shared/responseCache.ts';
import { bibleVerseService, BibleVerseService } from '../_shared/bibleVerseService.ts';
import { analyzeContent, paraphraseVictimExperience } from '../_shared/contentSafety.ts';
import { keyPoolManager } from '../_shared/keyPoolManager.ts';

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
  console.log('[Playbook Scripture] ============ ENFORCEMENT START ============');
  console.log(`[Playbook Scripture] Version: ${version}`);
  console.log(`[Playbook Scripture] Current verse text (first 100 chars): ${playbook.bibleVerse?.text?.substring(0, 100)}`);
  console.log(`[Playbook Scripture] Current reference: ${playbook.bibleVerse?.reference}`);

  if (!playbook.bibleVerse?.reference) {
    console.warn('[Playbook Scripture] ❌ No reference found, skipping enforcement');
    return;
  }

  // Check if this version requires scraping (NASB added to prevent AI from repeating same verses)
  const requiresScraping = ['MSG', 'AMP', 'NLT', 'CSB', 'NASB'].includes(version.toUpperCase());
  console.log(`[Playbook Scripture] Requires scraping: ${requiresScraping}`);

  try {
    const originalReference = playbook.bibleVerse.reference;
    const originalText = playbook.bibleVerse.text;

    console.log('[Playbook Scripture] Calling bibleVerseService.fetchVerse...');
    const exactVerse = await bibleVerseService.fetchVerse(originalReference, version);

    console.log(`[Playbook Scripture] ✅ Fetch successful - Source: ${exactVerse.source}`);
    console.log(`[Playbook Scripture] Scraped text (first 100 chars): ${exactVerse.text.substring(0, 100)}`);
    console.log(`[Playbook Scripture] Scraped reference: ${exactVerse.reference}`);

    playbook.bibleVerse.text = exactVerse.text;
    playbook.bibleVerse.reference = exactVerse.reference;
    playbook.bibleVerse.version = version;

    console.log('[Playbook Scripture] Verse text replaced:', {
      wasAIText: originalText !== exactVerse.text,
      aiTextLength: originalText.length,
      scrapedTextLength: exactVerse.text.length,
      referenceChanged: originalReference !== exactVerse.reference,
      source: exactVerse.source,
    });
    console.log('[Playbook Scripture] FINAL playbook.bibleVerse:', {
      text: playbook.bibleVerse.text.substring(0, 100),
      reference: playbook.bibleVerse.reference,
      version: playbook.bibleVerse.version,
    });
    console.log('[Playbook Scripture] ============ ENFORCEMENT END ============');
  } catch (error) {
    console.error('[Playbook Scripture] ❌ ENFORCEMENT FAILED:', error);
    console.error('[Playbook Scripture] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.log('[Playbook Scripture] ⚠️  Keeping AI-generated text as fallback');
    console.log('[Playbook Scripture] ============ ENFORCEMENT END (FAILED) ============');
  }
}

function parseOpenAIResponse(aiData: OpenAIData, userName: string, userInput: string, bibleVersion?: string): Playbook {
  const content = aiData.choices[0]?.message?.content || '';

  // Extract playbook title and subtitle
  let mainTitle = '';
  let subtitle = '';

  // First try to match the exact format with angle brackets (handle bold formatting)
  const titleMatch = content.match(/\*\*PLAYBOOK TITLE:\*\*\s*\n<([^>]+)>\n<([^>]*)>/i);
  if (titleMatch) {
    mainTitle = titleMatch[1].trim();
    subtitle = titleMatch[2].trim();
  } else {
    // Fallback to handle bold formatting without angle brackets
    const titleMatchBold = content.match(/\*\*PLAYBOOK TITLE:\*\*\s*\n(.+?)\n(.+?)\n/i);
    if (titleMatchBold) {
      mainTitle = titleMatchBold[1].trim();
      subtitle = titleMatchBold[2].trim();
    } else {
      // Fallback to ## or ### header format (new gpt-4o-mini format)
      const titleMatchHash = content.match(/##+ (.+?)\n\n(.+?)\n/i);
      if (titleMatchHash) {
        mainTitle = titleMatchHash[1].trim();
        subtitle = titleMatchHash[2].trim();
      } else {
        // Try ### TITLE: format
        const titleMatchHashTitle = content.match(/### TITLE:\s*\n(.+?)\n(.+?)\n/i);
        if (titleMatchHashTitle) {
          mainTitle = titleMatchHashTitle[1].trim();
          subtitle = titleMatchHashTitle[2].trim();
        } else {
        // Fallback to non-bold without angle brackets (gpt-4o format)
        const titleMatchGPT4o = content.match(/PLAYBOOK TITLE:\s*\n(.+?)\n(.+?)\n/i);
        if (titleMatchGPT4o) {
          mainTitle = titleMatchGPT4o[1].trim();
          subtitle = titleMatchGPT4o[2].trim();
        } else {
          // Fallback to the original method without bold formatting
          const playbookTitleMatch = content.match(/(?:###\s*)?TITLE:\s*([\s\S]*?)(?=\n(?:###\s*)?(?:TRUTH SUMMARY:|TRUTH IN LOVE:|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$))/i);
          if (playbookTitleMatch) {
            const titleLines = playbookTitleMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
            mainTitle = titleLines[0] || '';
            subtitle = titleLines[1] || '';
          }
        }
        }
      }
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

  // Parse Truth Summary (handle bold formatting)
  let truthSummaryMatch = content.match(/\*\*TRUTH SUMMARY:\*\*\s*([\s\S]*?)(?=\*\*TRUTH IN LOVE:\*\*|\*\*ACTION STEPS:\*\*|\*\*AFFIRMATIONS:\*\*|\*\*BIBLE VERSE:\*\*|\*\*CHALLENGE:\*\*|TRUTH IN LOVE:|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (!truthSummaryMatch) {
    // Fallback to ### format
    truthSummaryMatch = content.match(/### TRUTH SUMMARY:\s*([\s\S]*?)(?=\*\*TRUTH IN LOVE:\*\*|\*\*ACTION STEPS:\*\*|\*\*AFFIRMATIONS:\*\*|\*\*BIBLE VERSE:\*\*|\*\*CHALLENGE:\*\*|### TRUTH IN LOVE:|### ACTION STEPS:|### AFFIRMATIONS:|### BIBLE VERSE:|### CHALLENGE:|TRUTH IN LOVE:|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  }
  if (!truthSummaryMatch) {
    // Fallback to non-bold formatting
    truthSummaryMatch = content.match(/TRUTH SUMMARY:\s*([\s\S]*?)(?=\*\*TRUTH IN LOVE:\*\*|\*\*ACTION STEPS:\*\*|\*\*AFFIRMATIONS:\*\*|\*\*BIBLE VERSE:\*\*|\*\*CHALLENGE:\*\*|TRUTH IN LOVE:|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  }
  if (truthSummaryMatch) {
    const summary = truthSummaryMatch[1].trim();

    // Keep the actual userName in playbooks (don't replace with placeholder)
    // The AI should include the user's name naturally in the summary

    playbook.truthInLove.summary = summary;
  }

  // Parse Truth in Love (handle bold formatting)
  let truthInLoveMatch = content.match(/\*\*TRUTH IN LOVE:\*\*\s*([\s\S]*?)(?=\*\*ACTION STEPS:\*\*|\*\*AFFIRMATIONS:\*\*|\*\*BIBLE VERSE:\*\*|\*\*CHALLENGE:\*\*|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (!truthInLoveMatch) {
    // Fallback to ### format
    truthInLoveMatch = content.match(/### TRUTH IN LOVE:\s*([\s\S]*?)(?=\*\*ACTION STEPS:\*\*|\*\*AFFIRMATIONS:\*\*|\*\*BIBLE VERSE:\*\*|\*\*CHALLENGE:\*\*|### ACTION STEPS:|### AFFIRMATIONS:|### BIBLE VERSE:|### CHALLENGE:|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  }
  if (!truthInLoveMatch) {
    // Fallback to non-bold formatting
    truthInLoveMatch = content.match(/TRUTH IN LOVE:\s*([\s\S]*?)(?=\*\*ACTION STEPS:\*\*|\*\*AFFIRMATIONS:\*\*|\*\*BIBLE VERSE:\*\*|\*\*CHALLENGE:\*\*|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  }
  if (truthInLoveMatch) {
    const truthText = truthInLoveMatch[1].trim();

    // Keep the actual userName in playbooks (don't replace with placeholder)
    // The AI should include the user's name naturally in the truth text

    playbook.truthInLove.text = truthText;
  }

  // Parse Action Steps with Smart Journaling (handle bold formatting)
  let actionStepsMatch = content.match(/\*\*ACTION STEPS:\*\*\s*([\s\S]*?)(?=\*\*AFFIRMATIONS:\*\*|\*\*BIBLE VERSE:\*\*|\*\*CHALLENGE:\*\*|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (!actionStepsMatch) {
    // Fallback to ### format
    actionStepsMatch = content.match(/### ACTION STEPS:\s*([\s\S]*?)(?=\*\*AFFIRMATIONS:\*\*|\*\*BIBLE VERSE:\*\*|\*\*CHALLENGE:\*\*|### AFFIRMATIONS:|### BIBLE VERSE:|### CHALLENGE:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  }
  if (!actionStepsMatch) {
    // Fallback to non-bold formatting
    actionStepsMatch = content.match(/ACTION STEPS:\s*([\s\S]*?)(?=AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  }
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
        if (/^\s*-\s*Sub-task:/i.test(trimmedLine)) {
          const subTaskText = trimmedLine.replace(/^\s*-\s*Sub-task:\s*/i, '').trim();

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
        } else if (/^\s*-\s*Example:/i.test(trimmedLine)) {
          const exampleText = trimmedLine.replace(/^\s*-\s*Example:\s*/i, '').trim();

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

  // Parse Affirmations (handle bold formatting)
  let affMatch = content.match(/\*\*AFFIRMATIONS:\*\*\s*([\s\S]*?)(?=\*\*BIBLE VERSE:\*\*|\*\*CHALLENGE:\*\*|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (!affMatch) {
    // Fallback to ### format
    affMatch = content.match(/### AFFIRMATIONS:\s*([\s\S]*?)(?=\*\*BIBLE VERSE:\*\*|\*\*CHALLENGE:\*\*|### BIBLE VERSE:|### CHALLENGE:|BIBLE VERSE:|CHALLENGE:|$)/i);
  }
  if (!affMatch) {
    // Fallback to non-bold formatting
    affMatch = content.match(/AFFIRMATIONS:\s*([\s\S]*?)(?=\*\*BIBLE VERSE:\*\*|\*\*CHALLENGE:\*\*|BIBLE VERSE:|CHALLENGE:|$)/i);
  }
  if (affMatch) {
    const affirmationsText = affMatch[1].trim();
    // Split by numbered lines or lines that start with common affirmation patterns
    // Handle both gpt-4o (blank lines) and gpt-4o-mini formats
    let affirmations: string[];

    // Check if affirmations are numbered
    if (/^\d+\./.test(affirmationsText)) {
      // Split by numbers
      affirmations = affirmationsText
        .split(/\n(?=\d+\.)/)
        .filter(l => l.trim().length > 0);
    } else {
      // Split by double newlines (blank lines between affirmations)
      affirmations = affirmationsText
        .split(/\n\n+/)
        .filter(l => l.trim().length > 0);
    }
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

          // Check if the reference is already in the text (with or without parentheses)
          const hasReferenceInText = cleanText.includes(reference) || cleanText.includes(`(${reference})`);

          if (hasReferenceInText) {
            // Reference already exists, ensure it's properly formatted and return
            // If reference exists without parentheses, add them
            if (cleanText.includes(reference) && !cleanText.includes(`(${reference})`)) {
              // Replace the reference with parenthesized version
              const textWithRef = cleanText.replace(reference, `(${reference})`);
              return {
                id: generateUUID(),
                text: textWithRef,
                completed: false,
              };
            }
            // Reference already exists with parentheses, just return the clean text as-is
            return {
              id: generateUUID(),
              text: cleanText,
              completed: false,
            };
          } else {
            // Remove any existing parenthetical references at the end
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

  // Parse Bible Verse with enhanced scripture patterns (handle bold formatting)
  let bibleVerseMatch = content.match(/\*\*BIBLE VERSE:\*\*\s*([\s\S]*?)(?=\*\*CHALLENGE:\*\*|CHALLENGE:|$)/i);
  if (!bibleVerseMatch) {
    // Fallback to ### format
    bibleVerseMatch = content.match(/### BIBLE VERSE:\s*([\s\S]*?)(?=\*\*CHALLENGE:\*\*|### CHALLENGE:|CHALLENGE:|$)/i);
  }
  if (!bibleVerseMatch) {
    // Fallback to non-bold formatting
    bibleVerseMatch = content.match(/BIBLE VERSE:\s*([\s\S]*?)(?=\*\*CHALLENGE:\*\*|CHALLENGE:|$)/i);
  }
  if (bibleVerseMatch) {
    const verseContent = bibleVerseMatch[1].trim();
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

    // Clean the reference and strip any trailing version marker like (AMP), (NASB) etc.
    let cleanVerseRef = verseRef ? verseRef.trim() : '';
    if (cleanVerseRef) {
      cleanVerseRef = cleanVerseRef.replace(/\s*\(\s*[A-Z]{2,5}\s*\)\s*$/i, '').trim();
    }

    const fallbackVerseText = cleanVerseContentFallback(verseContent, cleanVerseRef || verseRef || '');

    // Set the values in the playbook (text is the raw verse text, reference is just book/chapter/verse)
    playbook.bibleVerse.text = verseText || fallbackVerseText;

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
  } else {
    console.log('[BIBLE VERSE PARSER] No match found. Checking content around BIBLE VERSE...');
    const bibleVerseIndex = content.indexOf('BIBLE VERSE:');
    if (bibleVerseIndex !== -1) {
      console.log('[BIBLE VERSE PARSER] Content around BIBLE VERSE:', content.substring(bibleVerseIndex, bibleVerseIndex + 200));
    }
  }

  // Parse Direct Challenge (handle bold formatting)
  let challengeMatch = content.match(/\*\*CHALLENGE:\*\*\s*([\s\S]*)/i);
  if (!challengeMatch) {
    // Fallback to ### format
    challengeMatch = content.match(/### CHALLENGE:\s*([\s\S]*)/i);
  }
  if (!challengeMatch) {
    // Fallback to non-bold formatting
    challengeMatch = content.match(/CHALLENGE:\s*([\s\S]*)/i);
  }
  if (challengeMatch) {
    playbook.directChallenge = challengeMatch[1].trim();
    console.log('[CHALLENGE PARSER] Parsed challenge length:', playbook.directChallenge.length);
  } else {
    console.log('[CHALLENGE PARSER] No match found. Checking content around CHALLENGE...');
    const challengeIndex = content.indexOf('CHALLENGE:');
    if (challengeIndex !== -1) {
      console.log('[CHALLENGE PARSER] Content around CHALLENGE:', content.substring(challengeIndex, challengeIndex + 200));
    }
  }

  if (!playbook.directChallenge || playbook.directChallenge.trim().length === 0) {
    console.warn('[CHALLENGE PARSER] Missing CHALLENGE section. Injecting fallback challenge.');
    playbook.directChallenge = [
      `${userName}, complete this two-part challenge exactly as written:`,
      '',
      'SPIRITUAL: Within the next 24 hours, block 20 minutes to pray Psalm 139:23-24, asking God to reveal truth and align your identity with His design. Journal what the Holy Spirit shows you inside the app before you stand up.',
      '',
      'TACTICAL (48-72 HOURS): Within 72 hours schedule a 30-minute check-in with a trusted pastor, mentor, or accountability partner. Share one concrete action you will take, request their covering prayer, and text them a summary plus the date of your next follow-up meeting.',
    ].join('\n');
  }

  sanitizeYogaSuggestions(playbook);

  return playbook;
}

function sanitizeText(text: string): string {
  return text.replace(/\byoga\b/gi, 'gentle stretching');
}

function cleanVerseContentFallback(content: string, verseRef: string): string {
  let cleaned = content;
  if (verseRef) {
    cleaned = cleaned.replace(new RegExp(escapeRegExp(verseRef), 'i'), '');
  }

  cleaned = cleaned.replace(/"""+/g, '"');
  cleaned = cleaned.replace(/""/g, '"');
  cleaned = cleaned.replace(/^"\s*|\s*"$/g, '');
  cleaned = cleaned.replace(/\s*"\s*/g, ' ');
  cleaned = cleaned.trim();

  if (cleaned.length === 0) {
    cleaned = content.replace(/"""+/g, '"').replace(/""/g, '"').replace(/^"\s*|\s*"$/g, '').trim();
  }

  return cleaned;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeYogaSuggestions(playbook: Playbook) {
  playbook.actionSteps = playbook.actionSteps.map(step => ({
    ...step,
    title: sanitizeText(step.title),
    subTasks: step.subTasks.map(subTask => ({
      ...subTask,
      text: sanitizeText(subTask.text),
    })),
    examples: step.examples.map(example => sanitizeText(example)),
  }));

  playbook.directChallenge = sanitizeText(playbook.directChallenge);
  playbook.truthInLove = {
    summary: sanitizeText(playbook.truthInLove.summary),
    text: sanitizeText(playbook.truthInLove.text),
  };
  playbook.title = sanitizeText(playbook.title);
  playbook.subtitle = sanitizeText(playbook.subtitle);
}

interface RequestBody {
  userInput: string;
  userName: string;
  userId?: string;
  dateOfBirth?: string;  // ISO date string from user profile
  ageGroup?: string;     // From onboarding: 'teen', 'young-adult', 'adult', 'middle-aged', 'senior'
  bibleVersion?: string; // User's preferred Bible translation (default: NASB)
  location?: string;     // User's location for regional resources (e.g., "Philippines", "USA", "UK")
  userTier?: string;     // User's subscription tier for key pool selection
  isOnboarding?: boolean; // Whether this is an onboarding generation
}

serve(async (req: Request) => {
  // Define CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Invalid request method' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let requestBody: RequestBody;
  try {
    requestBody = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: 'We couldn\'t process your request. Please try again.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { userInput, userName, userId, dateOfBirth, ageGroup, bibleVersion, location, userTier, isOnboarding } = requestBody;

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
  console.log('[Generate-Playbook] ========== AGE DETECTION START ==========');
  console.log('[Generate-Playbook] Received dateOfBirth:', dateOfBirth);
  console.log('[Generate-Playbook] Received ageGroup:', ageGroup);

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
      console.log('[Generate-Playbook] Calculated age from dateOfBirth:', userAge);

      // Flag ALL youth (age <= 16) for simplified language
      isTeenUser = userAge >= 0 && userAge <= 16;
      console.log('[Generate-Playbook] Is youth (<=16) based on dateOfBirth:', isTeenUser);
    } catch (error) {
      console.log('[Generate-Playbook] ❌ Error calculating age from dateOfBirth:', error);
      ageSource = 'error';
    }
  }

  // PRIORITY 2: Only use ageGroup if dateOfBirth is not available or failed
  if (ageSource !== 'dateOfBirth' && typeof ageGroup === 'string') {
    const simplifiedGroups = ['teen', 'teens', 'child', 'children', 'kid', 'youth', 'preteen'];
    if (simplifiedGroups.includes(ageGroup.toLowerCase())) {
      console.log('[Generate-Playbook] Using ageGroup fallback (no dateOfBirth):', ageGroup);
      isTeenUser = true;
      ageSource = 'ageGroup';
    } else {
      ageSource = 'ageGroup-not-teen';
    }
  }

  console.log('[Generate-Playbook] FINAL: Age source:', ageSource);
  console.log('[Generate-Playbook] FINAL: Calculated age:', calculatedAge);
  console.log('[Generate-Playbook] FINAL: Teen user (simplified language):', isTeenUser);
  console.log('[Generate-Playbook] ========== AGE DETECTION END ==========');

  // DISABLE CACHING for personalized content
  // Each user should get unique, personalized playbooks
  console.log('[Generate-Playbook] Caching disabled for personalized content');
  console.log('[Generate-Playbook] Generating new playbook for user:', userName);
  console.log('[Generate-Playbook] userName type:', typeof userName);
  console.log('[Generate-Playbook] userName length:', userName?.length || 0);
  console.log('[Generate-Playbook] userName JSON:', JSON.stringify(userName));

  try {
    // ENTERPRISE FEATURE: Fetch user's recent playbook titles to ensure uniqueness
    let recentTitles: string[] = [];
    if (userId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);

          // Fetch recent playbooks for title uniqueness (reduced from 5 to 3 to shorten prompt)
          const { data: recentPlaybooks, error: recentError } = await supabase
            .from('playbooks')
            .select('title')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(3);

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

    // CONTENT SAFETY CHECK: Analyze input for harmful intent
    console.log('[Generate-Playbook] Analyzing content for safety...');
    const contentAnalysis = analyzeContent(userInput);
    console.log('[Generate-Playbook] Content analysis:', contentAnalysis);

    // Block harmful planning content immediately
    if (contentAnalysis.shouldBlock) {
      console.error('[Generate-Playbook] Blocked harmful planning content');
      return new Response(
        JSON.stringify({
          error: 'CONTENT_BLOCKED',
          message: contentAnalysis.christianMessage,
          alternatives: contentAnalysis.constructiveAlternatives,
          category: contentAnalysis.category,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Paraphrasing function (only used if AI refuses)
    const paraphraseInput = (input: string): string => {
      let paraphrased = input;

      // Handle specific self-harm phrases first (before general replacements)
      paraphrased = paraphrased.replace(/\b(i want to|i need to|i will|i'm going to|i must)\s+(commit\s+)?suicide\b/gi, 'I am struggling with thoughts of ending my life');
      paraphrased = paraphrased.replace(/\b(i want to|i need to|i will|i'm going to)\s+kill\s+myself\b/gi, 'I am having thoughts of self-harm');
      paraphrased = paraphrased.replace(/\b(i want to|i need to|i will|i'm going to)\s+end\s+my\s+life\b/gi, 'I am struggling with suicidal thoughts');
      paraphrased = paraphrased.replace(/\b(i wish|i wished)\s+(to\s+)?(be|was|were)\s+dead\b/gi, 'I am struggling with thoughts of not wanting to live');
      paraphrased = paraphrased.replace(/\b(i wish|i wished)\s+i\s+(was|were)\s+dead\b/gi, 'I am struggling with difficult thoughts about life');
      paraphrased = paraphrased.replace(/\b(i wish|i wished)\s+i\s+(would|could)\s+die\b/gi, 'I am having thoughts about not wanting to be here');
      paraphrased = paraphrased.replace(/\b(i want to|i will|i'm going to|i wish|i wished)\s+(to\s+)?die\b/gi, 'I am struggling with thoughts about ending my life');

      // Handle gender identity gently (only if AI refuses)
      paraphrased = paraphrased.replace(/\b(i want to|i will|i'm going to)\s+change\s+my\s+gender\b/gi, 'I am exploring my gender identity');
      paraphrased = paraphrased.replace(/\b(i want to|i will|i'm going to)\s+transition\b/gi, 'I am considering gender transition');
      paraphrased = paraphrased.replace(/\bsex change\b/gi, 'gender transition');

      // Handle revenge gently (only if AI refuses)
      paraphrased = paraphrased.replace(/\b(i want|i need|i'm going to)\s+(to\s+)?(get\s+)?revenge\b/gi, 'I am struggling with feelings of wanting revenge');
      paraphrased = paraphrased.replace(/\b(get\s+)?revenge\b/gi, 'seeking justice');
      paraphrased = paraphrased.replace(/\bmake (him|her|them) pay\b/gi, 'finding a way to address what happened');
      paraphrased = paraphrased.replace(/\bpayback\b/gi, 'seeking resolution');
      paraphrased = paraphrased.replace(/\bretaliation\b/gi, 'responding to what was done');
      paraphrased = paraphrased.replace(/\bvengeance\b/gi, 'dealing with my anger');

      // Handle hate speech gently (only if AI refuses)
      paraphrased = paraphrased.replace(/\bi hate (white|black|asian|hispanic|latino|indian|jewish|muslim|christian|lgbt|gay|lesbian|bi|trans|queer|non-binary) people\b/gi, 'I am struggling with prejudice against $1 people');
      paraphrased = paraphrased.replace(/\bi hate (white|black|asian|hispanic|latino|indian|jewish|muslim|christian|lgbt|gay|lesbian|bi|trans|queer|non-binary)\b/gi, 'I am struggling with negative feelings toward $1 people');
      paraphrased = paraphrased.replace(/\b(all white|all black|all asian|all hispanic|all latino|all indian|all jewish|all muslim|all christian|all lgbt) people are\b/gi, 'I have negative stereotypes about $1 people');
      paraphrased = paraphrased.replace(/\b(hate|dislike) (white|black|asian|hispanic|latino|indian|jewish|muslim|christian|lgbt|gay|lesbian|bi|trans|queer) people\b/gi, 'I struggle with prejudice toward $2 people');

      // Soften direct action statements to contemplative ones (but not for gender identity, revenge, self-harm, or hate speech)
      if (!input.match(/\b(gender|transition|identity|revenge|payback|vengeance|dead|die|suicide|kill\s+myself|hate|prejudice)\b/i)) {
        paraphrased = paraphrased.replace(/\b(i want|i need|i will|i must)\b/gi, 'I am thinking about');
        paraphrased = paraphrased.replace(/\b(give me|get me)\b/gi, 'considering');
        paraphrased = paraphrased.replace(/\bnow\b/gi, '');
        paraphrased = paraphrased.replace(/\bimmediately\b/gi, '');
        paraphrased = paraphrased.replace(/\btoday\b/gi, '');
      }

      // Soften "trapped" language to "struggling with"
      paraphrased = paraphrased.replace(/\b(trapped|stuck)\b/gi, 'struggling with');
      paraphrased = paraphrased.replace(/\bin a (girl|boy|male|female) body\b/gi, 'my gender identity');

      // Soften medical/surgical terms (but preserve gender transition terms)
      if (!input.match(/\b(gender|transition)\b/i)) {
        paraphrased = paraphrased.replace(/\btransition\b/gi, 'exploring my identity');
      }

      // Soften severe violence/self-harm language
      paraphrased = paraphrased.replace(/\brape\b/gi, 'sexual assault');
      paraphrased = paraphrased.replace(/\bmurder\b/gi, 'taking a life');
      paraphrased = paraphrased.replace(/\bsuicide\b/gi, 'ending my life');

      // Clean up extra spaces
      paraphrased = paraphrased.replace(/\s+/g, ' ').trim();

      return paraphrased;
    };

    // Use a mutable variable for input (may be paraphrased later)
    let effectiveUserInput = userInput;

    // Initialize contextual prompt
    let contextualPrompt = '';

    // Apply persona context with Bible version
    contextualPrompt = applyPersonaContext(strategicAdvisorPersona, effectiveUserInput, bibleVersion);

    // ENTERPRISE FEATURE: Enrich prompt with timestamp and context for uniqueness
    // Build contextual prompt with title uniqueness check and age personalization
    // Add unique timestamp to ensure no caching and fresh generation every time
    const generationTimestamp = new Date().toISOString();
    contextualPrompt += `\n\nUser Name: ${userName}\nUser Request: ${effectiveUserInput}\nGeneration ID: ${generationTimestamp}

IMPORTANT: Only use "${userName}" as the user's name. Do NOT use any other names or full names even if you know them. The user's name is exactly "${userName}" - use this exact spelling and nothing else.

${recentTitles.length > 0 ? `\n\n## TITLE UNIQUENESS REQUIREMENT\nThe user already has these playbook titles:\n${recentTitles.map(t => `- "${t}"`).join('\n')}\n\nYou MUST create a completely different title. Do NOT reuse or slightly modify any of these titles.` : ''}`;

    // Add simplified language instruction for teens only
    if (isTeenUser) {
      contextualPrompt += '\n\n## LANGUAGE INSTRUCTION\nThis user is a teenager (13-16 years old). Use simple, clear language - avoid complex theological terms and keep action steps straightforward.';
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
- Do NOT provide specific phone numbers or regional hotlines - keep it general and applicable to any location

IMPORTANT: Always use generic language like "your local hotline" or "support services in your area" rather than specific numbers or regional resources.`;

    // Helper function for hybrid OpenAI API call with multi-key support
    async function callOpenAIWithFallback(model: string): Promise<Response> {
      console.log(`[Generate-Playbook] Calling OpenAI API with model: ${model}`);
      console.log(`[Generate-Playbook] Request params - userTier: ${userTier}, isOnboarding: ${isOnboarding}, userId: ${userId}`);
      
      // Get appropriate API key from pool based on user tier
      // IMPORTANT: Onboarding always uses Key 1 for best first impression
      const tierForKey = isOnboarding ? 'onboarding' : (userTier || 'spark'); // Prioritize onboarding, then tier, then default to spark
      console.log(`[Generate-Playbook] Resolved tierForKey: ${tierForKey}`);
      
      const apiKey = keyPoolManager.getBestKey(userId || 'anonymous', tierForKey);
      
      if (!apiKey) {
        console.error(`[Generate-Playbook] No API key available for tier: ${tierForKey}`);
        throw new Error('Service temporarily unavailable. Please try again in a moment.');
      }
      
      console.log(`[Generate-Playbook] Using API key: ${apiKey.id} (${apiKey.key.substring(0, 10)}...) for tier: ${tierForKey}`);
      
      try {
        const response = await CircuitBreaker.execute(
          CIRCUIT_KEYS.OPENAI_PLAYBOOK,
          async () => await fetchWithRetry(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey.key}`, // Use key from pool
            },
            body: JSON.stringify({
              model,
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
              temperature: 0.7,
              max_tokens: 6000,
              frequency_penalty: 0.1,
              presence_penalty: 0.1,
            }),
          },
          OPENAI_RETRY_CONFIG
          )
        );
        
        // Mark key as healthy on success
        keyPoolManager.setKeyHealth(apiKey.id, true);
        return response;
        
      } catch (error) {
        // Mark key as unhealthy on failure
        keyPoolManager.setKeyHealth(apiKey.id, false);
        console.error(`[Generate-Playbook] API key ${apiKey.id} failed, marked as unhealthy`);
        throw error;
      }
    }

    // Truncate prompt if too long to prevent token limit errors
    if (contextualPrompt.length > 4000) {
      console.log('[Generate-Playbook] Truncating prompt from', contextualPrompt.length, 'to 4000 chars');
      contextualPrompt = contextualPrompt.substring(0, 4000) + '\n\n[Response truncated to fit token limit]';
    }

    // Try with gpt-4o-mini, paraphrase and retry if refused
    let openAIRes: Response;
    let aiData: any;
    let rawContent: string;
    let usedParaphrasing = false;

    try {
      // First try with original input
      openAIRes = await callOpenAIWithFallback('gpt-4o-mini');
      aiData = await openAIRes.json();
      rawContent = aiData.choices?.[0]?.message?.content || '';

      // Check if AI refused (detect crisis support responses instead of playbook)
      const refusalPatterns = [
        /i'm sorry, but i can't assist/i,
        /i'm sorry, but i cannot assist/i,
        /i'm unable to assist/i,
        /i cannot assist with this request/i,
        /i'm unable to help with this/i,
        /i cannot fulfill this request/i,
        // Detect crisis support responses (AI offering help instead of generating playbook)
        /i'?m\s+(really\s+)?sorry\s+to\s+hear\s+that\s+you'?re\s+feeling\s+this\s+way/i,
        /it'?s\s+(really\s+)?important\s+(to\s+)?talk\s+to\s+someone/i,
        /please\s+(reach\s+out|talk)\s+to\s+(a\s+)?(mental\s+health|counselor|professional|trusted\s+person)/i,
        /you\s+are\s+not\s+alone/i,
      ];

      if (refusalPatterns.some(pattern => pattern.test(rawContent.toLowerCase()))) {
        console.log('[Generate-Playbook] AI refused, will attempt paraphrasing retries...');

        // AI refused, so we need to paraphrase to get past content filters
        // Use Christian-focused paraphrasing for victim experiences
        if (contentAnalysis.isVictimExperience) {
          console.log('[Generate-Playbook] Detected victim experience, using Christian paraphrasing');
          effectiveUserInput = paraphraseVictimExperience(userInput);
        } else if (contentAnalysis.category === 'gender_identity') {
          console.log('[Generate-Playbook] Gender identity topic - using gentle paraphrasing to help AI generate');
          // Paraphrase gender identity topics gently to help AI generate content
          effectiveUserInput = paraphraseInput(userInput);
        } else if (contentAnalysis.category === 'revenge') {
          console.log('[Generate-Playbook] Revenge topic - using gentle paraphrasing to help AI generate');
          // Paraphrase revenge topics gently to help AI generate content
          effectiveUserInput = paraphraseInput(userInput);
        } else if (contentAnalysis.category === 'self_harm') {
          console.log('[Generate-Playbook] Self-harm topic - using gentle paraphrasing to help AI generate');
          // Paraphrase self-harm topics gently to help AI generate content
          effectiveUserInput = paraphraseInput(userInput);
        } else if (contentAnalysis.category === 'hate_speech') {
          console.log('[Generate-Playbook] Hate speech topic - using gentle paraphrasing to help AI generate');
          // Paraphrase hate speech topics gently to help AI generate content
          effectiveUserInput = paraphraseInput(userInput);
        } else {
          console.log('[Generate-Playbook] AI refused - using standard paraphrasing for sensitive topic');
          effectiveUserInput = paraphraseInput(userInput);
        }
        
        console.log('[Generate-Playbook] Original:', userInput.substring(0, 100));
        console.log('[Generate-Playbook] Paraphrased:', effectiveUserInput.substring(0, 100));

        // Rebuild prompt with paraphrased input
        contextualPrompt = applyPersonaContext(strategicAdvisorPersona, effectiveUserInput, bibleVersion);
        contextualPrompt += `\n\nUser Name: ${userName}\nUser Request: ${effectiveUserInput}\nGeneration ID: ${generationTimestamp}

IMPORTANT: Only use "${userName}" as the user's name. Do NOT use any other names or full names even if you know them. The user's name is exactly "${userName}" - use this exact spelling and nothing else.

${recentTitles.length > 0 ? `\n\n## TITLE UNIQUENESS REQUIREMENT\nThe user already has these playbook titles:\n${recentTitles.map(t => `- "${t}"`).join('\n')}\n\nYou MUST create a completely different title. DO NOT reuse or slightly modify any of these titles.` : ''}`;

        if (isTeenUser) {
          contextualPrompt += '\n\n## LANGUAGE INSTRUCTION\nThis user is a teenager (13-16 years old). Use simple, clear language - avoid complex theological terms and keep action steps straightforward.';
        }

        contextualPrompt += `\n\n## BIBLE VERSION\nUse ${preferredBibleVersion} for all scripture references. When citing verses, retrieve the EXACT text from ${preferredBibleVersion}.`;

        // Truncate prompt if too long to prevent token limit errors
        if (contextualPrompt.length > 6000) {
          console.log('[Generate-Playbook] Truncating prompt from', contextualPrompt.length, 'to 6000 chars');
          contextualPrompt = contextualPrompt.substring(0, 6000) + '\n\n[Response truncated to fit token limit]';
        }

        // Retry with paraphrased input (allowing an extra retry if the first paraphrased attempt still refuses)
        usedParaphrasing = true;
        const maxParaphrasedAttempts = 2; // total paraphrased attempts (overall third try)
        let paraphrasedAttempt = 0;
        let paraphrasedSucceeded = false;

        while (paraphrasedAttempt < maxParaphrasedAttempts) {
          paraphrasedAttempt++;
          console.log(`[Generate-Playbook] Paraphrased attempt ${paraphrasedAttempt}/${maxParaphrasedAttempts}`);
          openAIRes = await callOpenAIWithFallback('gpt-4o-mini');
          aiData = await openAIRes.json();
          rawContent = aiData.choices?.[0]?.message?.content || '';

          if (!refusalPatterns.some(pattern => pattern.test(rawContent.toLowerCase()))) {
            paraphrasedSucceeded = true;
            break;
          }

          if (paraphrasedAttempt < maxParaphrasedAttempts) {
            console.warn('[Generate-Playbook] Paraphrased attempt still refused - retrying once more...');
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }

        if (!paraphrasedSucceeded) {
          console.error('[Generate-Playbook] AI refused even after additional paraphrased retries - topic too sensitive for AI');
          
          // Check if this is self-harm related (show crisis resources)
          if (contentAnalysis.category === 'self_harm') {
            return new Response(
              JSON.stringify({
                error: 'CONTENT_BLOCKED',
                message: 'If you\'re in crisis, please reach out for immediate support:\n\n🇺🇸 USA: 988 (Suicide & Crisis Lifeline)\n🇬🇧 UK: 116 123 (Samaritans)\n🇦🇺 Australia: 13 11 14 (Lifeline)\n🇨🇦 Canada: 1-833-456-4566\n🌍 International: https://findahelpline.com\n\nYou are deeply loved by God, and your life has immeasurable value in Christ. Please reach out to these resources or a trusted Christian counselor.',
                alternatives: [
                  'Finding hope and purpose in Christ',
                  'Understanding God\'s love for you',
                  'Connecting with a Christian counselor',
                  'Building a support network in faith',
                ],
                category: 'self_harm',
              }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
          
          // Generic AI refusal for other sensitive topics
          return new Response(
            JSON.stringify({
              error: 'CONTENT_BLOCKED',
              message: 'This topic appears to be too sensitive for automated generation. For personalized Christian guidance on sensitive matters, we recommend:\n\n• Speaking with a Christian counselor or pastor\n• Connecting with a trusted spiritual mentor\n• Reaching out to your church community\n\nGod cares deeply about your concerns and wants to walk with you through them.',
              alternatives: [
                'Finding guidance in Scripture',
                'Growing in your faith journey',
                'Building a stronger prayer life',
                'Connecting with Christian community',
                'Understanding God\'s will for your life',
              ],
              category: 'sensitive_topic',
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
    } catch (error) {
      console.error('[Generate-Playbook] Error with gpt-4o-mini:', error);
      throw error; // Propagate error instead of falling back
    }

    console.log('[Generate-Playbook] OpenAI API call successful');
    if (usedParaphrasing) {
      console.log('[Generate-Playbook] Used paraphrasing to bypass refusal');
    }

    // Log raw AI response for debugging
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

    // Check if AI provided any content at all
    if (!rawContent || rawContent.trim().length === 0) {
      console.error('[Generate-Playbook] AI returned empty response');
      throw new Error('AI returned empty response - no playbook content generated');
    }

    // Pre-check for topics that commonly trigger AI refusals
    const sensitiveTopics = [
      /gender.*transition|transition.*gender|gender.*identity/i,
      /sex.*change|change.*sex/i,
      /hormone.*therapy|hrt/i,
      /surgery.*gender|gender.*surgery/i,
      /self.*harm|harm.*self/i,
      /suicide|kill.*myself/i,
      /eating.*disorder|anorexia|bulimia/i,
      /abuse|trauma/i,
    ];

    if (sensitiveTopics.some(pattern => pattern.test(userInput))) {
      console.warn('[Generate-Playbook] Potentially sensitive topic detected:', userInput);
      // Continue with request but be prepared for refusal
    }

    // Check for AI refusal responses (more specific patterns)
    const refusalPatterns = [
      /i'm sorry, but i can't assist with that/i,
      /i'm sorry, but i cannot assist with that/i,
      /i'm sorry, but i'm unable to assist/i,
      /i cannot assist with this request/i,
      /i'm unable to help with this/i,
      /i cannot fulfill this request/i,
      /i'm sorry, but i can't assist/i,
      /i'm sorry, but i cannot assist/i,
      /i'm sorry, but i'm unable to help/i,
    ];

    if (refusalPatterns.some(pattern => pattern.test(rawContent))) {
      console.error('[Generate-Playbook] AI refused to generate content after retry:', rawContent);
      console.error('[Generate-Playbook] User input that triggered refusal:', userInput);
      
      // Final check: if this is harmful content, block it with Christian message
      const finalAnalysis = analyzeContent(userInput);
      if (finalAnalysis.isHarmfulIntent && !finalAnalysis.isVictimExperience) {
        console.error('[Generate-Playbook] Harmful content detected - blocking with Christian message');
        return new Response(
          JSON.stringify({
            error: 'CONTENT_BLOCKED',
            message: finalAnalysis.christianMessage || 'We cannot process this request. Please reach out to a Christian counselor or pastor for guidance.',
            alternatives: finalAnalysis.constructiveAlternatives,
            category: finalAnalysis.category,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      // Always return content blocked response for AI refusals to trigger proper frontend handling
      return new Response(
        JSON.stringify({
          error: 'CONTENT_BLOCKED',
          message: finalAnalysis.christianMessage || 'This request could not be processed due to content guidelines. Please try rephrasing with more constructive language.',
          alternatives: finalAnalysis.constructiveAlternatives,
          category: finalAnalysis.category,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse the playbook (store original userInput for display, not paraphrased)
    let playbook = parseOpenAIResponse(aiData, userName, userInput, preferredBibleVersion);

    console.log('[Generate-Playbook] Parsed playbook structure:', {
      hasTitle: !!playbook.title,
      titleLength: playbook.title?.length || 0,
      hasActionSteps: Array.isArray(playbook.actionSteps),
      actionStepsCount: playbook.actionSteps?.length || 0,
      hasTruthInLove: !!playbook.truthInLove,
      hasAffirmations: Array.isArray(playbook.affirmations),
      affirmationsCount: playbook.affirmations?.length || 0,
    });

    // Validate that the playbook has the minimum required structure
    if (!playbook.title || playbook.title.trim().length < 5) {
      console.error('[Generate-Playbook] Invalid playbook title:', playbook.title);
      throw new Error('AI failed to generate a valid playbook title');
    }

    if (!Array.isArray(playbook.actionSteps) || playbook.actionSteps.length === 0) {
      console.error('[Generate-Playbook] No action steps generated');
      throw new Error('AI failed to generate action steps');
    }

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
