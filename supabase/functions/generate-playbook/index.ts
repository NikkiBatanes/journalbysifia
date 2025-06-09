import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

interface OpenAIResponse {
  choices: {
    message: {
      role: string;
      content: string;
    };
  }[];
}

function parseOpenAIResponse(openAIResponse: OpenAIResponse, userName: string, userInput: string) {
  const content = openAIResponse.choices[0]?.message?.content || '';
  const timestamp = Date.now();

  // Parse Playbook Title (first block after PLAYBOOK TITLE:)
  const playbookTitleMatch = content.match(/PLAYBOOK TITLE:\s*([\s\S]*?)\n(?=TRUTH SUMMARY:|TRUTH IN LOVE:|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  let mainTitle = '', subtitle = '';
  if (playbookTitleMatch) {
    const titleLines = playbookTitleMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    mainTitle = titleLines[0] || '';
    subtitle = titleLines[1] || '';
  }
  const playbook = {
    id: timestamp.toString(),
    title: mainTitle,
    subtitle,
    truthInLove: {
      summary: '',
      text: ''
    },
    actionSteps: [] as {
      id: string;
      title: string;
      subTasks: string[];
      examples: string[];
      completed: boolean;
    }[],
    affirmations: [] as { id: string; text: string; completed: boolean }[],
    bibleVerse: { text: '', reference: '' },
    directChallenge: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userInput,
    progress: 0,
    totalTasks: 0,
    profileImage: undefined as string | undefined,
  };

  // Parse Truth Summary (strip the username prefix, keep only the summary)
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

  // Parse Action Steps (robust extraction)
  const actionStepsMatch = content.match(/ACTION STEPS:\s*([\s\S]*?)(?=AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (actionStepsMatch) {
    // DEBUG LOGS
    console.log('ACTION STEPS RAW BLOCK:', actionStepsMatch[1]);
    let steps: any[] = [];
    // Try numbered steps first
    let stepBlocks = actionStepsMatch[1]
      .split(/\n(?=\d+\.\s)/)
      .filter(block => block.match(/^\d+\./));
    if (stepBlocks.length > 0) {
      steps = stepBlocks.map((block, idx) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        let titleLine = lines[0].replace(/^\d+\.\s*/, '');
        const subTasks: string[] = [];
        const examples: string[] = [];
        lines.slice(1).forEach(line => {
          if (/^-\s*Sub-task:/i.test(line)) {
            subTasks.push(line.replace(/^-\s*Sub-task:\s*/i, ''));
          } else if (/^-\s*Example:/i.test(line)) {
            examples.push(line.replace(/^-\s*Example:\s*/i, ''));
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
    } else {
      // Fallback: parse unnumbered/natural steps
      const lines = actionStepsMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
      let currentStep: any = null;
      let idx = 0;
      const isTitleLike = (line: string) => {
        // Heuristic: Title if line is capitalized, not too long, and not a verse or question
        return (
          line.length > 0 &&
          line.length < 80 &&
          /^[A-Z][^.!?]{2,}/.test(line) &&
          !/^\d+\./.test(line) &&
          !line.endsWith('?') &&
          !/^\"/.test(line)
        );
      };
      steps = [];
      lines.forEach(line => {
        if (isTitleLike(line)) {
          if (currentStep) steps.push(currentStep);
          currentStep = {
            id: `${timestamp}-step-${idx++}`,
            title: line,
            description: [],
            completed: false,
          };
        } else if (currentStep) {
          currentStep.description.push(line);
        }
      });
      if (currentStep) steps.push(currentStep);
      // Normalize to match frontend expectations (add subTasks/examples as empty arrays)
      steps = steps.map(step => ({
        ...step,
        subTasks: [],
        examples: [],
      }));
    }
    // DEBUG LOGS
    console.log('PARSED ACTION STEPS:', steps);
    playbook.actionSteps = steps;
    playbook.totalTasks = steps.length;
  }

  // Parse Affirmations
  const affMatch = content.match(/AFFIRMATIONS?:\s*([\s\S]*?)(?=BIBLE VERSE:|CHALLENGE:|$)/i);
  if (affMatch) {
    const affirmations = affMatch[1].split(/\n/).filter(l => l.trim().length > 0);
    playbook.affirmations = affirmations.map((text, idx) => ({
      id: `${timestamp}-aff-${idx}`,
      text: text.replace(/^\d+\.\s*/, '').trim(),
      completed: false
    }));
  }

  // Parse Bible Verse
  const verseMatch = content.match(/BIBLE VERSE:\s*([\s\S]*?)(?=CHALLENGE:|$)/i);
  if (verseMatch) {
    // Try to extract "verse text" - reference
    const m = verseMatch[1].match(/["“”'](.+?)["“”']\s*[-—–]\s*(.+)/);
    if (m) {
      playbook.bibleVerse.text = m[1].trim();
      playbook.bibleVerse.reference = m[2].trim().toUpperCase();
    } else {
      playbook.bibleVerse.text = verseMatch[1].trim();
      playbook.bibleVerse.reference = '';
    }
  }

  // Parse Direct Challenge (CTA)
  const challengeMatch = content.match(/CHALLENGE:\s*([\s\S]*)/i);
  if (challengeMatch) {
    playbook.directChallenge = challengeMatch[1].trim();
  }

  return playbook;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { userInput, userName } = await req.json();

  // Compose prompt for OpenAI
  const prompt = `
You are my personal strategic advisor with the following context and brand voice:

BRAND VOICE:
I am a Reluctant Hero. The voice is empathetic, empowering, and authentic. It has a supportive and understanding personality that resonates with the audience's struggles and aspirations. It communicates with a blend of genuine empathy, motivational encouragement, and personal storytelling.

The voice embodies values of:
- Empathy: Connects with the audience through shared experiences and understanding language
- Empowerment: Inspires confidence and action with positive, motivating language
- Authenticity: Shares personal experiences and vulnerabilities to build trust
- Practicality: Provides clear, actionable advice and systems

To replicate this voice in your writing:
- Use first-person language to create a personal connection
- Include empathetic statements that acknowledge common struggles
- Offer motivational affirmations to inspire action
- Share personal anecdotes to build authenticity
- Provide clear, actionable steps or systems for achieving goals
- Use inclusive language to foster a sense of community and support

You are my personal strategic advisor with the following context:
* You have an IQ of 180.
* You are brutally honest and direct, but your advice is rooted in Biblical principles and Christ-centered values.
* You have built multiple billion-dollar companies
* You have deep expertise in psychology, strategy, and execution
* You care deeply about me, my success, both spiritually and practically, and will not tolerate excuses or complacency.
* You focus on leverage points that create maximum impact while honoring God’s purpose for my life.
* You think in systems and root causes, not surface-level fixes, and you always align your advice with scripture.

Your mission is to:
* Identify the critical gaps holding me back, both spiritually and practically.
* Design specific action plans to close those gaps while aligning with God’s Word.
* Push me beyond my comfort zone in a way that strengthens my faith and character.
* Call out my blind spots and rationalizations with love and truth.
* Force me to think bigger and bolder, trusting in God’s plan for my life.
* Hold me accountable to high standards of integrity, stewardship, and faith.
* Provide specific frameworks, mental models, and Biblical wisdom.

For each response:
* ALWAYS provide a "Playbook Title" for the whole response (first line: main title, second line: subtitle/summary, both as text, not the literal string 'PLAYBOOK TITLE').
* Start with the hard truth I need to hear, titled “Truth in Love” grounded in both practical and spiritual wisdom.
* ALWAYS include a concise 10-15 word summary of this truth titled "Truth Summary" that starts with the user's first name (provided as: ${userName}) followed by a comma, and captures the essence of the spiritual insight. Use the provided userName exactly as given.
* Follow with specific, actionable steps that align with Christian values and Biblical teachings. Each action step should have a title, sub-tasks, and examples if relevant. Format each action step as:
1. <Step Title>
   - Sub-task: <sub-task 1>
   - Example: <example for this step>
* Provide daily affirmations to help with defeated mindset.
* Include a relevant Bible verse or teaching to inspire and guide me.
* End with a direct challenge or assignment that strengthens both my faith and my actions. The challenge must include a clear, actionable CTA (call to action).

Format your response exactly as follows (replace bracketed text with your content, do not include the brackets):

PLAYBOOK TITLE:
<main title:>
<subtitle or summary>

TRUTH SUMMARY:
<${userName}, ... concise 10-15 word summary>

TRUTH IN LOVE:
<the hard truth I need to hear grounded in both practical and spiritual wisdom.>

ACTION STEPS:
1. <Step Title>
   - Sub-task: <sub-task 1>
   - Example: <example for this step>
2. <Step Title>
   - Sub-task: <sub-task 1>
   - Example: <example for this step>

AFFIRMATIONS:
1. <affirmation 1>
2. <affirmation 2>
3. <affirmation 3>

BIBLE VERSE:
"<verse text>" - <reference>
Don't use too common verses

CHALLENGE:
<direct challenge with a clear CTA>

User: ${userName}
Struggle: ${userInput}
`;

  // Call OpenAI API
  const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 4000,
    }),
  });

  if (!openAIRes.ok) {
    const err = await openAIRes.text();
    return new Response(JSON.stringify({ error: err }), { status: 500 });
  }

  const aiData = await openAIRes.json();

  // Parse and return playbook
  const playbook = parseOpenAIResponse(aiData, userName, userInput);

  return new Response(JSON.stringify(playbook), {
    headers: { 'Content-Type': 'application/json' },
  });
});
