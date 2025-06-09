// Using Deno's built-in fetch
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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

  // Initialize playbook structure
  const playbook = {
    id: timestamp.toString(),
    title: '',
    subtitle: '',
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

  // Parse Playbook Title and Subtitle
  const playbookTitleMatch = content.match(/PLAYBOOK TITLE:\s*([\s\S]*?)(?=\n(?:TRUTH SUMMARY:|TRUTH IN LOVE:|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$))/i);
  if (playbookTitleMatch) {
    const titleBlock = playbookTitleMatch[1].trim();
    const titleLines = titleBlock.split('\n').map(l => l.trim()).filter(Boolean);
    
    // First line is the main title
    playbook.title = titleLines[0] || '';
    
    // If there are more lines, the second one is the subtitle
    if (titleLines.length > 1) {
      playbook.subtitle = titleLines[1];
    } else {
      // If no explicit subtitle, use an empty string
      playbook.subtitle = '';
    }
    
    console.log('Parsed title:', { title: playbook.title, subtitle: playbook.subtitle });
  }

  // Parse Truth Summary
  const truthSummaryMatch = content.match(/TRUTH SUMMARY:\s*([\s\S]*?)(?=TRUTH IN LOVE:|ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (truthSummaryMatch) {
    let summary = truthSummaryMatch[1].trim();
    const usernamePrefix = `${userName},`;
    if (summary.startsWith(usernamePrefix)) {
      summary = summary.slice(usernamePrefix.length).trim();
    }
    playbook.truthInLove.summary = summary;
  } else {
    console.warn('Truth Summary missing');
    playbook.truthInLove.summary = `${userName}, seek God’s guidance to overcome your challenges.`;
  }

  // Parse Truth in Love
  const truthInLoveMatch = content.match(/TRUTH IN LOVE:\s*([\s\S]*?)(?=ACTION STEPS:|AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (truthInLoveMatch) {
    playbook.truthInLove.text = truthInLoveMatch[1].trim();
  } else {
    console.warn('Truth in Love missing');
    playbook.truthInLove.text = 'Align your actions with God’s purpose to find true fulfillment.';
  }

  // Parse Action Steps
  const actionStepsMatch = content.match(/ACTION STEPS:\s*([\s\S]*?)(?=AFFIRMATIONS:|BIBLE VERSE:|CHALLENGE:|$)/i);
  if (actionStepsMatch) {
    console.log('ACTION STEPS RAW BLOCK:', actionStepsMatch[1]);
    let steps = [];
    const stepBlocks = actionStepsMatch[1].split(/\n(?=\d+\.\s)/).filter(block => block.match(/^\d+\./));
    if (stepBlocks.length > 0) {
      steps = stepBlocks.map((block, idx) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        const title = lines[0].replace(/^\d+\.\s*/, '');
        const subTasks = lines.slice(1)
          .filter(line => line.startsWith('-'))
          .map(line => line.replace(/^-\s*(Sub-task:)?\s*/i, ''));
        return {
          id: `${timestamp}-step-${idx}`,
          title,
          subTasks: subTasks.length >= 3 ? subTasks : [
            ...subTasks,
            'Reflect on God’s guidance for this step.',
            'Take one small action today.',
            'Pray for strength to proceed.'
          ].slice(0, Math.max(3, subTasks.length)),
          examples: [],
          completed: false,
        };
      });
    } else {
      // Fallback: parse unnumbered steps
      const lines = actionStepsMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
      let currentStep: {
        id: string;
        title: string;
        subTasks: string[];
        examples: string[];
        completed: boolean;
      } | null = null;
      let idx = 0;
      const isTitleLike = (line: string) => (
        line.length > 0 &&
        line.length < 80 &&
        /^[A-Z][^.!?]{2,}/.test(line) &&
        !/^\d+\./.test(line) &&
        !line.endsWith('?') &&
        !/^\"/.test(line)
      );
      steps = [];
      lines.forEach(line => {
        if (isTitleLike(line)) {
          if (currentStep) steps.push(currentStep);
          currentStep = {
            id: `${timestamp}-step-${idx++}`,
            title: line,
            subTasks: [],
            examples: [],
            completed: false,
          };
        } else if (currentStep && line.startsWith('-')) {
          currentStep.subTasks.push(line.replace(/^-\s*(Sub-task:)?\s*/i, ''));
        } else if (currentStep) {
          // First, check if this line is an example line
          const isExampleLine = line.match(/^(?:example|e\.g\.?|for example)[:\s]/i);
          
          // If this is an example line, process it
          if (isExampleLine) {
            // Remove the "Example:" or "e.g." prefix and clean up
            let exampleText = line
              .replace(/^(?:example|e\.g\.?|for example)[:\s,]+/i, '')  // Remove prefix
              .replace(/^[\s"'(-]+/, '')  // Remove leading quotes, parentheses, or whitespace
              .replace(/["').,;]+$/, '')  // Remove trailing quotes, parentheses, or punctuation
              .trim();
            
            if (exampleText) {
              // Capitalize first letter and ensure it ends with a period
              exampleText = exampleText.charAt(0).toUpperCase() + exampleText.slice(1);
              if (!/[.!?]$/.test(exampleText)) {
                exampleText += '.';
              }
              currentStep.examples.push(exampleText);
            }
          } else {
            // Check for inline examples in the format "text (e.g., example)"
            const inlineExampleMatch = line.match(/\(e\.g\.[\s,]+([^)]+)\)/i);
            if (inlineExampleMatch && inlineExampleMatch[1]) {
              let exampleText = inlineExampleMatch[1]
                .replace(/^[\s"'(-]+/, '')
                .replace(/["').,;]+$/, '')
                .trim();
              
              if (exampleText) {
                exampleText = exampleText.charAt(0).toUpperCase() + exampleText.slice(1);
                if (!/[.!?]$/.test(exampleText)) {
                  exampleText += '.';
                }
                currentStep.examples.push(exampleText);
              }
            }
          }
          }
        }
      });
      if (currentStep) steps.push(currentStep);
      // Ensure minimum sub-tasks
      steps = steps.map(step => ({
        ...step,
        subTasks: step.subTasks.length >= 3 ? step.subTasks : [
          ...step.subTasks,
          'Reflect on God’s guidance for this step.',
          'Take one small action today.',
          'Pray for strength to proceed.'
        ].slice(0, Math.max(3, step.subTasks.length))
      }));
    }
    console.log('PARSED ACTION STEPS:', steps);
    playbook.actionSteps = steps;
    playbook.totalTasks = steps.length;
  } else {
    console.warn('Action Steps missing');
    playbook.actionSteps = [{
      id: `${timestamp}-step-0`,
      title: 'Seek God’s Guidance',
      subTasks: [
        'Pray for clarity in your next steps.',
        'Read a relevant Bible passage.',
        'Journal your thoughts and prayers.'
      ],
      examples: [],
      completed: false,
    }];
    playbook.totalTasks = 1;
  }

  // Parse Affirmations
  const affMatch = content.match(/AFFIRMATIONS?:\s*([\s\S]*?)(?=BIBLE VERSE:|CHALLENGE:|$)/i);
  if (affMatch && affMatch[1].trim().length > 20) { // Ensure we have meaningful content
    const affirmations = affMatch[1].split(/\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && /^\d+\./.test(l)); // Only take numbered lines
    
    if (affirmations.length >= 3) {
      playbook.affirmations = affirmations.slice(0, 3).map((text, idx) => ({
        id: `${timestamp}-aff-${idx}`,
        text: text.replace(/^\d+\.\s*['"]?|['"]?$/g, '').trim(),
        completed: false
      }));
    } else {
      // If we don't have 3 valid affirmations, use fallback
      console.warn('Not enough valid affirmations, using fallback');
      useFallbackAffirmations();
    }
  } else {
    console.warn('Affirmations missing or too short, using fallback');
    useFallbackAffirmations();
  }
  
  function useFallbackAffirmations() {
    playbook.affirmations = [
      { 
        id: `${timestamp}-aff-0`, 
        text: 'I am fearfully and wonderfully made by God (Psalm 139:14)', 
        completed: false 
      },
      { 
        id: `${timestamp}-aff-1`, 
        text: 'I can do all things through Christ who strengthens me (Philippians 4:13)', 
        completed: false 
      },
      { 
        id: `${timestamp}-aff-2`, 
        text: 'God has a plan to prosper me and give me hope (Jeremiah 29:11)', 
        completed: false 
      }
    ];
  }

  // Parse Bible Verse
  const verseMatch = content.match(/BIBLE VERSE:\s*([\s\S]*?)(?=CHALLENGE:|$)/i);
  if (verseMatch) {
    const m = verseMatch[1].match(/["“”'](.+?)["“”']\s*[-—–]\s*(.+)/);
    if (m) {
      playbook.bibleVerse.text = m[1].trim();
      playbook.bibleVerse.reference = m[2].trim().toUpperCase();
    } else {
      playbook.bibleVerse.text = verseMatch[1].trim();
      playbook.bibleVerse.reference = '';
    }
  } else {
    console.warn('Bible Verse missing');
    playbook.bibleVerse = { text: 'Trust in the Lord with all your heart.', reference: 'PROVERBS 3:5' };
  }

  // Parse Direct Challenge
  const challengeMatch = content.match(/CHALLENGE:\s*([\s\S]*)/i);
  if (challengeMatch) {
    playbook.directChallenge = challengeMatch[1].trim();
  } else {
    console.warn('Challenge missing');
    playbook.directChallenge = 'Take one step this week to align with God’s purpose. Are you ready?';
  }

  return playbook;
}

// Validate playbook structure
function validatePlaybook(playbook: any) {
  return (
    playbook.title &&
    playbook.subtitle &&
    playbook.truthInLove.summary &&
    playbook.truthInLove.text &&
    playbook.actionSteps.length >= 3 && // Minimum 3 steps, but allow more
    playbook.actionSteps.every((step: any) => step.subTasks.length >= 3) &&
    playbook.affirmations.length >= 3 &&
    playbook.bibleVerse.text &&
    playbook.directChallenge
  );
}

// Main function handler for Supabase Edge Function
serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { userInput, userName } = await req.json();

    // Compose prompt for OpenAI with exact user-provided prompt and few-shot examples
    const prompt = `
You are my personal strategic advisor with the following context:
* You have an IQ of 180 and speak with unapologetic, radical honesty
* You are brutally direct and call out BS immediately - no sugarcoating, no coddling
* You have built multiple billion-dollar companies through sheer will and divine wisdom
* You have deep expertise in psychology, strategy, and execution with zero tolerance for excuses

You care enough to tell me the hard truths I need to hear, not what I want to hear.
* You expose my blind spots, rationalizations, and self-deceptions with surgical precision
* You challenge my limiting beliefs and comfort zones with biblical truth and practical wisdom
* You hold me to the highest standard because you believe in my God-given potential
* You refuse to let me settle for mediocrity or make excuses for my shortcomings

Your mission is to:
* Ruthlessly identify and expose the real issues holding me back - no matter how uncomfortable
* Design brutally honest action plans that confront my weaknesses and leverage my strengths
* Push me far beyond my comfort zone with biblical truth and strategic wisdom
* Call out my BS, excuses, and self-deceptions with surgical precision
* Challenge me to think and act at levels I didn't know were possible
* Hold me to the highest standard of Christ-like excellence in all areas of life
* Provide no-nonsense, practical wisdom grounded in Scripture and real-world results
* Refuse to accept my excuses while believing in my potential for transformation

For each response:
* Start with the RAW TRUTH - no sugarcoating, no fluff. Title it "Brutal Truth" and hit me with the cold, hard facts I need to hear.
* Follow with "Truth Summary" - a 10-15 word gut punch that starts with my name and captures the essence of what I need to face.
* Give me SPECIFIC, ACTIONABLE steps - no vague advice. If it's not measurable, it's not helpful.
* Include a relevant Bible verse that doesn't just comfort but CONFRONTS and CHALLENGES me.
* End with a direct challenge that pushes me beyond my comfort zone - make it specific, time-bound, and HARD.
* Title format: Make it a 2-line title that would make me uncomfortable if others saw it - that's how I'll know it's hitting home.
* Keep it 100% biblically grounded - if it's not in line with Scripture, don't say it.
* If I'm making excuses, CALL ME OUT. If I'm being lazy, SAY IT. If I'm settling for less than God's best, DON'T LET ME.

RESPONSE FORMAT:
PLAYBOOK TITLE:
<Main Title>
<Subtitle>

TRUTH SUMMARY:
<${userName}, 10-15 word summary>

TRUTH IN LOVE:
<Hard truth grounded in spiritual and practical wisdom.>

ACTION STEPS:
1. <Step Title>
   - Sub-task: <sub-task 1>
   - Sub-task: <sub-task 2>
   - Sub-task: <sub-task 3>
   Example: <example for this step>
2. <Step Title>
   [As many steps as necessary for success, 5-8 steps]
   

AFFIRMATIONS:
1. <Affirmation 1>
2. <Affirmation 2>
3. <Affirmation 3>

BIBLE VERSE:
"<Verse text>" - <Reference>
Avoid overly common verses like Jeremiah 29:11.

CHALLENGE:
<Direct challenge with specific timeframe and actions>
<Motivational CTA, e.g., Are you ready to take action?>

Example 1:
Input: When I work, I don’t stop. I love it and have a lot of passion for it. However, I often neglect basic things, like brushing my teeth, especially when working from home. I just work and work. I know I need to exercise too, but I don’t do it. I feel like I’m addicted to work. Even though I don’t go outside, I’m perfectly fine working at home. I love it, I’m passionate about it, but I don’t leave room for anything else.
Output:
PLAYBOOK TITLE:
Workaholism: 
Resting in God’s Design for Balance

TRUTH SUMMARY:
${userName}, work is a gift, but balance honors God and sustains your purpose.

TRUTH IN LOVE:
Your passion for work is a gift, but your lack of balance is a distortion of God’s design. The hard truth? You’re idolizing productivity and neglecting the temple of your body, your relationships, and your spiritual health. God didn’t create you to burn out or to find your identity in work. Even Jesus rested, prayed, and cared for His physical needs. Your addiction to work is not sustainable, and it’s robbing you of the fullness of life God intends for you. It’s time to honor God by stewarding your time, body, and mind with discipline and balance.

ACTION STEPS:
1. Reframe Work as Worship, Not Identity  
   - Sub-task: Remind yourself daily that your worth is not in your productivity but in Christ.  
   - Sub-task: Meditate on Colossians 3:23: “Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.” 
   - Sub-task: Write this verse and place it near your workspace as a reminder.
   Example: 
2. Create a God-Honoring Routine  
   - Sub-task: Morning Routine: Start your day with prayer, scripture, and basic self-care (shower, brush teeth, eat breakfast).  
   - Sub-task: Work Blocks: Set specific work hours with breaks. Use a timer to enforce this.  
   - Sub-task: Evening Routine: End your day with gratitude, reflection, and preparation for rest.
3. Prioritize Physical Health  
   - Sub-task: Schedule 30 minutes daily for exercise, even if it’s just a walk around your home.  
   - Sub-task: Set alarms to remind yourself to drink water, stretch, and eat balanced meals.  
   - Sub-task: Treat your body as God’s temple (1 Corinthians 6:19-20).
4. Practice Sabbath Rest  
   - Sub-task: Dedicate one day a week to rest and reconnect with God, family, and yourself.  
   - Sub-task: Use this time to reflect, recharge, and enjoy life outside of work.  
   - Sub-task: Trust that God will bless your obedience to rest.
5. Set Boundaries for Work  
   - Sub-task: Turn off work notifications after a set time each day.  
   - Sub-task: Create a designated workspace at home and leave it when your work hours are over.  
   - Sub-task: Communicate your boundaries to colleagues or clients if needed.
6. Reconnect with the Outside World  
   - Sub-task: Schedule one social or outdoor activity weekly, even if it’s just a coffee with a friend or a walk in the park.  
   - Sub-task: Remember, isolation can lead to burnout and spiritual stagnation.

AFFIRMATIONS:
1. “My worth is in Christ, not in my work.”  
2. “I honor God by caring for my body and mind.”  
3. “Rest is not weakness; it is obedience to God’s design.”

BIBLE VERSE:
“Come to me, all you who are weary and burdened, and I will give you rest. Take my yoke upon you and learn from me, for I am gentle and humble in heart, and you will find rest for your souls.” – MATTHEW 11:28-29  

CHALLENGE:
This week, commit to a morning routine that includes prayer, self-care, and exercise. Set a timer to enforce work breaks and end your workday at a specific time. On your Sabbath, step away from work completely and spend time with God, loved ones, or in nature.  
Are you ready to honor God by finding balance and living a fuller, healthier life?


Now, generate a response for:
User: ${userName}
Struggle: ${userInput}
Follow the exact structure, tone, and depth of the examples, generating as many action steps as necessary to ensure success in achieving the user’s goal.
`;

  try {
    let retries = 0;
    let result;
    while (retries < 2) {
      // Call OpenAI API
      const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7, // Adjusted for consistency
          max_tokens: 4000,
        }),
      });

      if (!openAIRes.ok) {
        const err = await openAIRes.text();
        return new Response(JSON.stringify({ error: err }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const openAIJson = await openAIRes.json();
      result = parseOpenAIResponse(openAIJson, userName, userInput);

      if (validatePlaybook(result)) break;
      console.warn(`Invalid playbook on attempt ${retries + 1}. Retrying...`);
      prompt += '\nEnsure all sections (Playbook Title with two lines, Truth Summary, Truth in Love, Action Steps with 3+ steps and 3-4 sub-tasks each, Affirmations, Bible Verse, Challenge) are included with detailed, empathetic, faith-based content as in the examples. Generate as many action steps as necessary for success.';
      retries++;
    }

    if (!validatePlaybook(result)) {
      return new Response(JSON.stringify({ error: 'Failed to generate a valid playbook after retries' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-playbook function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});