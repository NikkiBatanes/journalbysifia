/**
 * Test script to debug 1-day devotional generation issue
 * Run with: node test-1day-devotional.js
 */

// Simulate the parsing logic for 1-day devotionals
const content = `CATEGORY: Purpose

TITLE: Finding Your Purpose in Christ

DESCRIPTION: This 1-day devotional explores how to discover God's unique calling for your life.

SCRIPTURE:
"For we are God's handiwork, created in Christ Jesus to do good works, which God prepared in advance for us to do." - Ephesians 2:10

REFLECTION:
In a world that constantly asks us what we want to be, God's Word reminds us that we are already something beautiful - His handiwork. The Greek word for "handiwork" is "poiema," from which we get our word "poem." You are God's masterpiece, His work of art.

This passage reveals three profound truths about your purpose: First, you are created "in Christ Jesus" - your identity is rooted in Him, not in your achievements. Second, you were made "to do good works" - God has specific tasks prepared for you. Third, these works were "prepared in advance" - your purpose existed before you were born.

Consider the story of Esther, who discovered she was born "for such a time as this" (Esther 4:14). Her purpose wasn't about her comfort or status, but about being positioned to save her people. Similarly, your purpose isn't just about personal fulfillment - it's about participating in God's redemptive plan.

REFLECTION QUESTIONS:
1. What unique gifts and experiences has God given you that might point to your purpose?
2. How does knowing you're God's "handiwork" change how you view your worth and calling?
3. What "good work" is God inviting you to step into today, even if it feels small?

PRAYER:
Heavenly Father,

Thank You for creating me with intention and purpose. Help me to see myself as You see me - as Your masterpiece, created for good works. Give me courage to step into the calling You've prepared for me, even when I feel inadequate. Show me the next step in fulfilling the purpose You've designed for my life.

In Jesus' Name, Amen`;

console.log('=== TESTING 1-DAY DEVOTIONAL PARSING ===\n');
console.log('Content length:', content.length);
console.log('Duration: 1');

// Test the day matching patterns with the fix
const dayPatterns = [
  { name: 'Pattern 1: **DAY X:**', regex: /\*\*DAY\s*(\d+):\*\*/gi },
  { name: 'Pattern 2: DAY X:', regex: /(?:^|\n)DAY\s*(\d+):/gi },
  { name: 'Pattern 3: # DAY X', regex: /(?:^|\n)#{1,3}\s*DAY\s*(\d+)/gi },
  { name: 'Pattern 4: Numbered (with fix)', regex: /(?:^|\n)(\d+)[.)]\s*/gi, needsFilter: true },
];

console.log('\n=== TESTING DAY PATTERNS ===');

// Find REFLECTION QUESTIONS sections to exclude
const reflectionQuestionsRegex = /REFLECTION QUESTIONS:[\s\S]*?(?=\n\n[A-Z]+:|$)/gi;
const reflectionSections = [];
let reflectionMatch;
while ((reflectionMatch = reflectionQuestionsRegex.exec(content)) !== null) {
  reflectionSections.push({
    start: reflectionMatch.index,
    end: reflectionMatch.index + reflectionMatch[0].length
  });
}
console.log(`Found ${reflectionSections.length} REFLECTION QUESTIONS sections to exclude`);

let dayMatches = [];
for (const pattern of dayPatterns) {
  const matches = [...content.matchAll(pattern.regex)];
  console.log(`${pattern.name}: ${matches.length} matches`);
  
  if (matches.length > 0) {
    console.log('   Matches:', matches.map(m => `"${m[0]}" at position ${m.index}`));
    
    // Apply filter for Pattern 4
    if (pattern.needsFilter) {
      const filteredMatches = matches.filter(match => {
        const matchPos = match.index;
        const isInReflectionQuestions = reflectionSections.some(
          section => matchPos >= section.start && matchPos <= section.end
        );
        return !isInReflectionQuestions;
      });
      console.log(`   After filtering: ${filteredMatches.length} matches`);
      dayMatches = filteredMatches;
    } else {
      dayMatches = matches;
    }
    
    if (dayMatches.length > 0) {
      break;
    }
  }
}

console.log('\n=== RESULT ===');
if (dayMatches.length === 0) {
  console.log('✅ No DAY patterns found (EXPECTED for 1-day devotionals)');
  console.log('✅ Fallback should trigger: dayMatches = [[null, "1", content]]');
  console.log('\n=== PARSING SCRIPTURE ===');
  
  // Test scripture parsing
  console.log('Looking for scripture in content...');
  const scriptureSection = content.match(/SCRIPTURE:([\s\S]*?)(?=REFLECTION:|$)/i);
  if (scriptureSection) {
    console.log('Scripture section found:', scriptureSection[1].substring(0, 200));
  }
  
  const scriptureMatch = content.match(/SCRIPTURE:[\s\n]*['"]([^'"\n]+)['"][\s\n]*[-—][\s\n]*([A-Za-z0-9 ]+\s*\d+:\d+)/i);
  if (scriptureMatch) {
    console.log('✅ Scripture found:');
    console.log('   Text:', scriptureMatch[1]);
    console.log('   Reference:', scriptureMatch[2]);
  } else {
    console.log('❌ Scripture NOT found with primary pattern');
    console.log('   The issue: Scripture is on multiple lines, not single line with quotes');
    console.log('   Actual format: SCRIPTURE:\\n"verse" - BOOK 1:1 (with newline after colon)');
  }
  
  console.log('\n=== PARSING REFLECTION ===');
  const reflectionMatch = content.match(/REFLECTION:[\s\n]+([\s\S]*?)(?=REFLECTION QUESTIONS:|PRAYER:|$)/i);
  if (reflectionMatch) {
    console.log('✅ Reflection found:', reflectionMatch[1].substring(0, 100) + '...');
  } else {
    console.log('❌ Reflection NOT found');
  }
  
  console.log('\n=== PARSING PRAYER ===');
  const prayerMatch = content.match(/PRAYER:[\s\n]+([\s\S]*?)$/i);
  if (prayerMatch) {
    console.log('✅ Prayer found:', prayerMatch[1].substring(0, 100) + '...');
  } else {
    console.log('❌ Prayer NOT found');
  }
  
} else {
  console.log('❌ DAY patterns found (UNEXPECTED for 1-day devotionals)');
  console.log('   This would cause the parser to try multi-day logic');
}

console.log('\n=== CONCLUSION ===');
console.log('For 1-day devotionals, the content should NOT have DAY 1: prefix');
console.log('The parser fallback at line 511 should handle this correctly');
console.log('If there\'s an error, it\'s likely in the scripture/reflection/prayer parsing');
