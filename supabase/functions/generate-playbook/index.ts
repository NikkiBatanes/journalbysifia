/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { strategicAdvisorPersona, applyPersonaContext, enforcePersona } from './persona.config.ts';

interface Playbook {
  id: string;
  title: string;
  subtitle: string;
  truthInLove: {
    summary: string;
    text: string;
  };
  actionSteps: {
    id: string;
    title: string;
    subTasks: string[];
    examples: string[];
    completed: boolean;
  }[];
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
  const timestamp = Date.now();

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

  const playbook: Playbook = {
    id: timestamp.toString(),
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
    const usernamePrefix = `${userName},`;
    if (summary.startsWith(usernamePrefix)) {
      summary = summary.slice(usernamePrefix.length).trim();
    }
    playbook.truthInLove.summary = summary;
  }

  // Parse Truth in Love
  const truthInLoveMatch = content.match(/TRUTH IN LOVE:\s*([\s\S]*?)(?=ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (truthInLoveMatch) {
    playbook.truthInLove.text = truthInLoveMatch[1].trim();
  }

  // Parse Action Steps
  const actionStepsMatch = content.match(/ACTION STEPS:\s*([\s\S]*?)(?=AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (actionStepsMatch) {
    const stepBlocks = actionStepsMatch[1]
      .split(/\n(?=\d+\.\s)/)
      .filter((block: string) => block.match(/^\d+\./));

    playbook.actionSteps = stepBlocks.map((block: string, idx: number) => {
      const lines = block.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const titleLine = lines[0].replace(/^\d+\.\s*/, '');
      const subTasks: string[] = [];
      const examples: string[] = [];

      lines.slice(1).forEach((line: string) => {
        const trimmedLine = line.trim();
        if (/^-\s*Sub-task:/i.test(trimmedLine)) {
          const subTask = trimmedLine.replace(/^-\s*Sub-task:\s*/i, '').trim();
          if (subTask) {subTasks.push(subTask);}
        } else if (/^-\s*Example:/i.test(trimmedLine)) {
          const example = trimmedLine.replace(/^-\s*Example:\s*/i, '').trim();
          if (example) {examples.push(example);}
        } else if (subTasks.length > 0 && !trimmedLine.startsWith('- ')) {
          // Handle multi-line sub-tasks or examples
          const lastIndex = subTasks.length - 1;
          subTasks[lastIndex] = `${subTasks[lastIndex]} ${trimmedLine}`.trim();
        }
      });

      return {
        id: `${timestamp}-step-${idx}`,
        title: titleLine,
        subTasks,
        examples,
        completed: false,
      };
    });

    playbook.totalTasks = playbook.actionSteps.length;
  }

  // Parse Affirmations
  const affMatch = content.match(/AFFIRMATIONS?:\s*([\s\S]*?)(?=BIBLE VERSE:|CHALLENGE:|$)/i);
  if (affMatch) {
    const affirmations = affMatch[1].split(/\n/).filter(l => l.trim().length > 0);
    playbook.affirmations = affirmations.map((text, idx) => {
      // Remove any leading numbers, dots, dashes, or other punctuation
      const cleanText = text.replace(/^[\s\d\-*•.]+/, '').trim();
      return {
        id: `${timestamp}-aff-${idx}`,
        text: cleanText,
        completed: false,
      };
    });
  }

  // Parse Bible Verse
  const verseMatch = content.match(/BIBLE VERSE:\s*([\s\S]*?)(?=CHALLENGE:|$)/i);
  if (verseMatch) {
    const m = verseMatch[1].match(/["""'](.+?)["""']\s*[-—–]\s*(.+)/);
    if (m) {
      playbook.bibleVerse.text = m[1].trim();
      playbook.bibleVerse.reference = m[2].trim().toUpperCase();
    } else {
      playbook.bibleVerse.text = verseMatch[1].trim();
      playbook.bibleVerse.reference = '';
    }
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
