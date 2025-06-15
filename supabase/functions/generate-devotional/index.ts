import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface Scripture {
  reference: string;
  text: string;
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
  completed: boolean;
}

interface Devotional {
  id: string;
  title: string;
  description: string;
  category: string;
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

function parseOpenAIResponse(aiData: any, duration: number, playbookId?: string, userInput?: string): Devotional {
  const content = aiData.choices[0]?.message?.content || '';
  const timestamp = Date.now();
  
  // Extract devotional title
  const titleMatch = content.match(/DEVOTIONAL TITLE:\s*([\s\S]*?)(?=CATEGORY:|DESCRIPTION:|DAY \d+:|$)/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Daily Devotional';

  // Extract category
  const categoryMatch = content.match(/CATEGORY:\s*([\s\S]*?)(?=DESCRIPTION:|DAY \d+:|$)/i);
  const category = categoryMatch ? categoryMatch[1].trim() : 'Growth';

  // Extract description
  const descriptionMatch = content.match(/DESCRIPTION:\s*([\s\S]*?)(?=DAY \d+:|$)/i);
  const description = descriptionMatch ? descriptionMatch[1].trim() : '';

  // Initialize devotional object
  const devotional: Devotional = {
    id: timestamp.toString(),
    title,
    description,
    category,
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

  // Extract days
  const dayMatches = content.matchAll(/DAY (\d+):\s*([\s\S]*?)(?=DAY \d+:|$)/gi);
  const days = Array.from(dayMatches);

  for (let i = 0; i < days.length; i++) {
    const dayMatch = days[i];
    const dayNumber = parseInt(dayMatch[1]);
    const dayContent = dayMatch[2].trim();

    // Extract day title
    const dayTitleMatch = dayContent.match(/TITLE:\s*([\s\S]*?)(?=SCRIPTURE:|$)/i);
    const dayTitle = dayTitleMatch ? dayTitleMatch[1].trim() : `Day ${dayNumber}`;

    // Extract scripture
    const scriptureMatch = dayContent.match(/SCRIPTURE:\s*"([\s\S]*?)"\s*-\s*([\s\S]*?)(?=REFLECTION:|$)/i);
    const scriptureText = scriptureMatch ? scriptureMatch[1].trim() : '';
    const scriptureRef = scriptureMatch ? scriptureMatch[2].trim() : '';

    // Extract reflection
    const reflectionMatch = dayContent.match(/REFLECTION:\s*([\s\S]*?)(?=REFLECTION QUESTIONS:|$)/i);
    const reflection = reflectionMatch ? reflectionMatch[1].trim() : '';

    // Extract reflection questions
    const questionsMatch = dayContent.match(/REFLECTION QUESTIONS:\s*([\s\S]*?)(?=PRAYER:|$)/i);
    const questionsContent = questionsMatch ? questionsMatch[1].trim() : '';
    const questions = questionsContent.split(/\n/).filter(q => q.trim().length > 0);

    // Create the day object
    const day: DevotionalDay = {
      id: `${timestamp}-day-${dayNumber}`,
      dayNumber,
      title: dayTitle,
      scripture: {
        text: scriptureText,
        reference: scriptureRef,
      },
      reflection,
      reflectionQuestions: questions.map((q, idx) => ({
        id: `${timestamp}-day-${dayNumber}-q-${idx}`,
        text: q.replace(/^\d+\.\s*/, '').trim(),
      })),
      completed: false,
    };

    devotional.days.push(day);
  }

  // Ensure days are in correct order
  devotional.days.sort((a, b) => a.dayNumber - b.dayNumber);
  
  return devotional;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { duration, playbookId, userInput } = await req.json();

  if (!duration || duration < 1 || duration > 7) {
    return new Response(JSON.stringify({ error: 'Invalid duration. Must be between 1 and 7 days.' }), { status: 400 });
  }

  // Compose prompt for OpenAI
  const prompt = `
You are a compassionate spiritual guide creating a ${duration}-day devotional series to help someone grow in their faith. 
The devotional should be based on the following user input: "${userInput || 'spiritual growth'}".

Create a structured ${duration}-day devotional that follows this format:

DEVOTIONAL TITLE:
[Create a meaningful, engaging title for the devotional series]

CATEGORY:
[Choose ONE category that best fits this devotional: Prayer, Growth, Healing, Wisdom, Relationships, Purpose, Career, Finances, Mental Health, Parenting, Health]

DESCRIPTION:
[Write a brief 2-3 sentence description of what this devotional journey will help the reader accomplish]

For each day (${duration} days total), create the following structure:

DAY 1:
TITLE: [Create a meaningful title for this day's devotional]
SCRIPTURE: "[Full Bible verse text]" - [Reference (book chapter:verse)]
REFLECTION: [Write a 150-250 word reflection that connects the Scripture to the user's situation, offers spiritual insight, and points to Jesus as the source of hope/strength/transformation]
REFLECTION QUESTIONS:
1. [Question that encourages introspection]
2. [Question that encourages application]
3. [Question that encourages spiritual growth]
PRAYER: [Write a 50-100 word prayer addressing God directly, seeking His help for the specific situation, incorporating the theme and Scripture]

[Repeat the above structure for each day, from DAY 1 to DAY ${duration}]

Make sure each day builds on the previous one, creating a cohesive journey toward spiritual growth and practical application. Each day should have strategic purpose in helping the reader grow in their faith and address their specific situation.
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
      max_tokens: 2500,
    }),
  });

  if (!openAIRes.ok) {
    const err = await openAIRes.text();
    return new Response(JSON.stringify({ error: err }), { status: 500 });
  }

  const aiData = await openAIRes.json();

  // Parse and return devotional
  const devotional = parseOpenAIResponse(aiData, duration, playbookId, userInput);

  return new Response(JSON.stringify(devotional), {
    headers: { 'Content-Type': 'application/json' },
  });
});
