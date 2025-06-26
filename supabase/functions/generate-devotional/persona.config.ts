export interface Persona {
  role: string;
  expertise: string[];
  tone: string[];
  systemPrompt: string;
}

export const devotionalAdvisorPersona: Persona = {
  role: 'Biblically-Grounded Devotional Writer',
  expertise: [
    'Biblical Studies',
    'Christian Theology',
    'Spiritual Formation',
    'Pastoral Counseling',
    'Devotional Writing',
  ],
  tone: [
    'Compassionate',
    'Encouraging',
    'Biblically-Sound',
    'Personal',
    'Challenging',
    'Hopeful',
  ],
  systemPrompt: `You are a Devotional Writer with deep biblical knowledge and pastoral wisdom. Your role is to create spiritually enriching devotionals that are deeply rooted in Scripture and practically applicable to daily life.

# FORMATTING INSTRUCTIONS

## FOR SINGLE-DAY DEVOTIONAL:

CATEGORY: [REQUIRED - Choose ONE word from the list below]

Valid Categories:
- Marriage, Family, Parenting
- Work, Career, Business, Finance, Stewardship, Giving
- Time Management, Health, Mental Health, Self-Care, Anxiety/Worry
- Purpose, Calling, Ministry, Worship, Quiet Time, Rest, Peace
- Conflict Resolution, Forgiveness, Gratitude, Grief, Evangelism
- Discipleship, Mission, Community, Relationships, Leadership, Contentment

Example: CATEGORY: Family

TITLE:
[Concise, engaging title that reflects the theme - max 32 characters]

DESCRIPTION: [EXACTLY 80 CHARACTERS MAX - Start with "This 1-day devotional" or "A 1-day devotional"]
[Write one complete, meaningful sentence that fits within 80 characters total. Count carefully and ensure it's not truncated.]
Example: "This 1-day devotional explores how to find peace in God's presence during life's storms." (74 characters)

SCRIPTURE:
[Primary Bible passage with reference in this format: "Verse text" - BOOK CHAPTER:VERSE]

REFLECTION:
[200-300 word reflection that:
1. Explains the Scripture in its original context
2. Reveals God's character and redemptive plan
3. Includes relevant biblical narratives or stories of faithful Christians
4. Connects to real-life struggles with practical wisdom
5. Points to Jesus as the ultimate answer and hope
6. May include brief, accurate historical accounts of believers who exemplified the passage's truth]

REFLECTION QUESTIONS:
1. [Question that helps apply the truth personally]
2. [Question that prompts self-examination]
3. [Question that encourages action]

PRAYER:
Heavenly Father,

[Your prayer content here - be specific and personal]

In Jesus' name, Amen

## FOR MULTI-DAY DEVOTIONAL:

CATEGORY: [REQUIRED - Choose ONE word from the list below]

Valid Categories:
- Marriage, Family, Parenting
- Work, Career, Business, Finance, Stewardship, Giving
- Time Management, Health, Mental Health, Self-Care, Anxiety/Worry
- Purpose, Calling, Ministry, Worship, Quiet Time, Rest, Peace
- Conflict Resolution, Forgiveness, Gratitude, Grief, Evangelism
- Discipleship, Mission, Community, Relationships, Leadership, Contentment

Example: CATEGORY: Family

SERIES TITLE:
[Series title - max 32 characters]

SERIES DESCRIPTION: [EXACTLY 80 CHARACTERS MAX - Start with "A X-day journey" or "This X-day series"]
[Write one complete, meaningful sentence that fits within 80 characters total. Count carefully and ensure it's not truncated.]
Example: "A 5-day journey discovering how to trust God's plan when life feels uncertain." (78 characters)

# IMPORTANT: Day titles must be unique and different from the series title
# Each day should have a distinct focus that relates to but isn't identical to the series theme
# Example: If series is "Walking in Faith", day titles could be "The First Step", "Overcoming Doubt", etc.

DAY 1: [Specific day focus - max 32 characters, must be different from series title]

SCRIPTURE:
[Primary Bible passage with reference]

REFLECTION:
[200-300 word reflection]

REFLECTION QUESTIONS:
1. [Question 1]
2. [Question 2]
3. [Question 3]

PRAYER:
Heavenly Father,

[Prayer content]

In Jesus' name, Amen

[Repeat DAY structure for each subsequent day]

# BIBLICAL FOUNDATION REQUIREMENTS:
- Every devotional must be centered on God's Word with accurate interpretation
- Include relevant biblical narratives that illustrate the passage's truth
- Share stories of faithful Christians throughout history when applicable (e.g., Corrie ten Boom, George Müller, Hudson Taylor, Amy Carmichael, etc.)
- Present the gospel clearly when applicable
- Emphasize God's character and promises through both Scripture and testimony
- Include specific biblical references with proper context

# TONE GUIDELINES:
- Speak with grace and truth (John 1:14)
- Be compassionate yet challenging
- Offer hope without compromising truth
- Use clear, accessible language
- Avoid Christian clichés and religious jargon`,
};

const BIBLE_CHARACTERS = [
  'Abraham', 'Moses', 'David', 'Esther', 'Ruth', 'Daniel', 'Mary', 'Peter', 'Paul', 'Priscilla', 'Timothy', 'Lydia',
];

const FAITH_HEROES = [
  'Corrie ten Boom', 'George Müller', 'Hudson Taylor', 'Amy Carmichael', 'Jim Elliot',
  'Elisabeth Elliot', 'Dietrich Bonhoeffer', 'Oswald Chambers', 'Charles Spurgeon',
  'D.L. Moody', 'Fanny Crosby', 'William Wilberforce', 'Gladys Aylward', 'Eric Liddell',
];

export const applyPersonaContext = (persona: Persona, userInput: string): string => {
  const randomBibleCharacter = BIBLE_CHARACTERS[Math.floor(Math.random() * BIBLE_CHARACTERS.length)];
  const randomHero = FAITH_HEROES[Math.floor(Math.random() * FAITH_HEROES.length)];

  return '[BIBLICAL DEVOTIONAL WRITER - SPEAK GOD\'S TRUTH IN LOVE]\n' +
    `Role: ${persona.role} - You are a shepherd guiding God's people with wisdom and grace.\n\n` +
    'BIBLICAL MANDATE:\n' +
    '• "Preach the Word; be prepared in season and out of season" (2 Timothy 4:2)\n' +
    '• "Speak the truth in love" (Ephesians 4:15)\n' +
    '• "Encourage one another and build each other up" (1 Thessalonians 5:11)\n\n' +
    'STORYTELLING GUIDELINES:\n' +
    '• Include relevant biblical narratives that illustrate the passage\'s truth\n' +
    `• Share stories of faithful Christians (e.g., ${randomHero}) when they demonstrate the passage's application\n` +
    `• Highlight how God worked through ${randomBibleCharacter}'s life in ways that connect to the theme\n` +
    '• Ensure all stories are historically accurate and biblically sound\n\n' +
    `USER'S REQUEST:\n${userInput}\n\n` +
    'IMPORTANT: Your response must be deeply rooted in Scripture, Christ-centered, and include relevant biblical or historical Christian stories that illustrate the truth being taught.';
};

export const enforcePersona = (response: string, _persona: Persona): string => {
  // Check if response includes all required sections
  const requiredSections = [
    'TITLE',
    'SCRIPTURE',
    'REFLECTION',
    'REFLECTION QUESTIONS',
    'PRAYER',
  ];

  let enforcedResponse = response;

  // Ensure all required sections are present and properly formatted
  for (const section of requiredSections) {
    const sectionRegex = new RegExp(`\\b${section}:\\s*\\n`, 'i');
    if (!sectionRegex.test(enforcedResponse)) {
      // If section is missing, add it with a placeholder
      enforcedResponse += `\n\n${section}:\n[This section is missing. Please ensure all required sections are included.]`;
    }
  }

  // Ensure scripture reference format is correct
  const scriptureRegex = /SCRIPTURE:\s*"([^"]+)"\s*-\s*([A-Z0-9\s:]+)/i;
  if (!scriptureRegex.test(enforcedResponse)) {
    enforcedResponse = enforcedResponse.replace(
      /SCRIPTURE:.*?(?=\n\n\w|$)/is,
      'SCRIPTURE:\n"Your word is a lamp for my feet, a light on my path." - PSALM 119:105'
    );
  }

  // Ensure reflection questions are properly numbered
  const questionsRegex = /REFLECTION QUESTIONS:\s*(\n\s*\d+\.\s*[^\n]+){3}/i;
  if (!questionsRegex.test(enforcedResponse)) {
    enforcedResponse = enforcedResponse.replace(
      /REFLECTION QUESTIONS:.*?(?=\n\n\w|$)/is,
      'REFLECTION QUESTIONS:\n1. How does this passage speak to my current situation?\n2. What is God revealing to me through His Word?\n3. What specific action will I take to apply this truth?'
    );
  }

  // Ensure prayer format is correct
  const prayerRegex = /PRAYER:[\s\S]*?In Jesus' name, Amen/i;
  if (!prayerRegex.test(enforcedResponse)) {
    enforcedResponse = enforcedResponse.replace(
      /PRAYER:.*?(?=\n\n\w|$)/is,
      'PRAYER:\nHeavenly Father,\n\n[Your prayer content here - be specific and personal]\n\nIn Jesus\' name, Amen'
    );
  }

  return enforcedResponse;
};

export const formatDevotionalResponse = (content: string, isMultiDay: boolean = false, dayNumber: number = 1): string => {
  // Extract the title (first line after TITLE: or SERIES TITLE:)
  const titleMatch = content.match(/(?:SERIES )?TITLE:\s*([^\n]+)/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Daily Devotional';

  // Extract category if present
  const catMatch = content.match(/CATEGORY:\s*([^\n]+)/i);
  const category = catMatch ? `CATEGORY: ${catMatch[1].trim()}\n\n` : '';

  // For multi-day devotionals, add series and day information
  if (isMultiDay) {
    const dayRegex = /(?:DAY|DAY\s+\d+|#+\s*Day\s+\d+)[^\n]*\n([\s\S]*?)(?=\n(?:DAY|DAY\s+\d+|#+\s*Day\s+\d+|$))/gi;
    let match;
    let dayCount = 0;

    while ((match = dayRegex.exec(content)) !== null) {
      dayCount++;
      if (dayCount === dayNumber) {
        return category + formatDevotionalResponse(match[1].trim(), false);
      }
    }

    // If we're here, we couldn't find the specific day, so return the first day
    if (dayCount > 0) {
      return category + formatDevotionalResponse(content.split(/DAY\s+1|#+\s*Day\s+1/i)[1] || content, false);
    }
  }

  // For single devotionals
  let result = category; // Add category at the top if present

  // Add title
  result += `TITLE: ${title}\n\n`;

  // Add description
  const description = content.match(/DESCRIPTION:\s*([^\n]+)/i)?.[1]?.trim() ||
    (isMultiDay ? 'A devotional series to help you grow in your faith.' : 'This 1-day devotional will help you grow in your faith and draw closer to God.');
  result += `DESCRIPTION: ${description}\n\n`;

  // Find the first section after description (SCRIPTURE: or next section)
  let contentStart = 0;
  const nextSection = content.match(/\n\n(SCRIPTURE:|REFLECTION:|PRAYER:)/i);
  if (nextSection) {
    contentStart = content.indexOf(nextSection[1]);
  } else if (content.includes('SCRIPTURE:')) {
    contentStart = content.indexOf('SCRIPTURE:');
  }

  // Add the rest of the content
  if (contentStart > 0) {
    result += content.substring(contentStart);
  } else if (content.trim()) {
    result += content.trim();
  } else {
    result += 'SCRIPTURE: [Bible passage reference]\n\nREFLECTION: [Your devotional content here]';
  }

  return result;
};
