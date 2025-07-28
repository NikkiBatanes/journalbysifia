/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { strategicAdvisorPersona, applyPersonaContext, enforcePersona } from './persona.config.ts';

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

  // Clean up markdown formatting from titles
  const cleanMarkdown = (text: string): string => {
    if (!text) {return '';}
    // Remove markdown bold/italic formatting (**, __, *)
    return text.replace(/\*\*|__|\*/g, '').trim();
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

    // Remove userName prefix if present (case insensitive)
    const usernamePrefix = new RegExp(`^${userName},?\s*`, 'i'); // eslint-disable-line no-useless-escape
    summary = summary.replace(usernamePrefix, '').trim();

    // Remove literal "[User's Name]," if AI outputs it literally (case insensitive)
    summary = summary.replace(/^\[User'?s Name\],?\s*/i, '').trim();

    // Ensure the summary starts with a capital letter and has proper spacing
    if (summary.length > 0) {
      // First, trim any leading/trailing whitespace
      summary = summary.trim();
      // Then capitalize the first letter and ensure proper spacing after any punctuation
      summary = summary.charAt(0).toUpperCase() +
               (summary.length > 1 ? summary.slice(1).replace(/^\s*[.,;:!?]\s*/, (match) =>
                 match.trim() + ' '  // Add space after punctuation if missing
               ) : '');
    }

    playbook.truthInLove.summary = summary;
  }

  // Parse Truth in Love
  const truthInLoveMatch = content.match(/TRUTH IN LOVE:\s*([\s\S]*?)(?=ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (truthInLoveMatch) {
    const truthText = truthInLoveMatch[1].trim();

    // Keep [User's Name] placeholder for dynamic replacement in the UI
    // This allows the name to update when user changes their name in settings
    // truthText = truthText.replace(/\[User's Name\]/g, userName);

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
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let requestBody: RequestBody;
  try {
    requestBody = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { userInput, userName } = requestBody;

  try {
    // Persona context is applied through the system prompt
    // Keeping the function call for future use
    applyPersonaContext(strategicAdvisorPersona, userInput);

    // Call OpenAI API with persona context
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
            content: strategicAdvisorPersona.systemPrompt,
          },
          {
            role: 'user',
            content: `User: ${userName}\nStruggle: ${userInput}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2500,
      }),
    });

    if (!openAIRes.ok) {
      const error = await openAIRes.text();
      console.error('OpenAI API Error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to generate playbook', details: error }),
        { status: openAIRes.status }
      );
    }

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

    return new Response(JSON.stringify(playbook, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error generating playbook:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({
        error: 'Failed to generate playbook',
        details: errorMessage,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
