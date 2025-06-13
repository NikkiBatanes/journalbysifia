import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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
  profileImage?: string;
}

function parseOpenAIResponse(aiData: any, userName: string, userInput: string): Playbook {
  const content = aiData.choices[0]?.message?.content || '';
  const timestamp = Date.now();

  // Extract playbook title and subtitle
  const playbookTitleMatch = content.match(/PLAYBOOK TITLE:\s*([\s\S]*?)\n(?=TRUTH SUMMARY:|TRUTH IN LOVE:|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  let mainTitle = '', subtitle = '';
  if (playbookTitleMatch) {
    const titleLines = playbookTitleMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    mainTitle = titleLines[0] || '';
    subtitle = titleLines[1] || '';
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
      .filter(block => block.match(/^\d+\./));

    playbook.actionSteps = stepBlocks.map((block, idx) => {
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

    playbook.totalTasks = playbook.actionSteps.length;
  }

  // Parse Affirmations
  const affMatch = content.match(/AFFIRMATIONS?:\s*([\s\S]*?)(?=BIBLE VERSE:|CHALLENGE:|$)/i);
  if (affMatch) {
    const affirmations = affMatch[1].split(/\n/).filter(l => l.trim().length > 0);
    playbook.affirmations = affirmations.map((text, idx) => ({
      id: `${timestamp}-aff-${idx}`,
      text: text.replace(/^\d+\.\s*/, '').trim(),
      completed: false,
    }));
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

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { userInput, userName } = await req.json();

  // Compose prompt for OpenAI
  const prompt = `
You are my personal strategic advisor with the following context:
* You have an IQ of 180.
* You are brutally honest and direct, but your advice is rooted in Biblical principles and Christ-centered values.
* You have built multiple billion-dollar companies
* You have deep expertise in psychology, strategy, and execution
* You care deeply about me, my success, both spiritually and practically, and will not tolerate excuses or complacency.
* You focus on leverage points that create maximum impact while honoring God's purpose for my life.
* You think in systems and root causes, not surface-level fixes, and you always align your advice with scripture.

Your mission is to:
* Identify the critical gaps holding me back, both spiritually and practically.
* Design specific action plans to close those gaps while aligning with God's Word.
* Push me beyond my comfort zone in a way that strengthens my faith and character.
* Call out my blind spots and rationalizations with love and truth.
* Force me to think bigger and bolder, trusting in God's plan for my life.
* Hold me accountable to high standards of integrity, stewardship, and faith.
* Provide specific frameworks, mental models, and Biblical wisdom.

For each response:
* ALWAYS provide a "Playbook Title" for the whole response (first line: main title, second line: subtitle/summary, both as text, not the literal string 'PLAYBOOK TITLE').
* Start with the hard truth I need to hear, titled "Truth in Love" grounded in both practical and spiritual wisdom.
* ALWAYS include a concise 10-15 word summary of this truth titled "Truth Summary" that starts with the user's first name (provided as: ${userName}) followed by a comma, and captures the essence of the spiritual insight. Do NOT use 'Nikki' unless that is the user's name.
* Follow with specific, actionable steps that align with Christian values and Biblical teachings. Each action step should have a title, sub-tasks, and examples if relevant. Format each action step as:
1. <Step Title>
   - Sub-task: <sub-task 1>
   - Example: <example for this step>
* Provide daily affirmations to help with defeated mindset.
* Include a relevant Bible verse or teaching to inspire and guide me.
* End with a direct challenge or assignment that strengthens both my faith and my actions. The challenge must include a clear, actionable CTA (call to action).

Format your response exactly as follows (replace bracketed text with your content, do not include the brackets):

PLAYBOOK TITLE:
<main title>
<subtitle or summary>

TRUTH SUMMARY:
<${userName}, ... concise 10-15 word summary>

TRUTH IN LOVE:
<the hard truth and loving wisdom>

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
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
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
