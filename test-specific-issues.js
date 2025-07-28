#!/usr/bin/env node

/**
 * Test specific journal type classification issues
 */

const fetch = require('node-fetch');
require('dotenv').config();

async function testSpecificIssues() {
  console.log('🎯 Testing Specific Journal Type Issues\n');
  
  const testInput = `I need help with prayer and gratitude. I want to:
- Ask God to reveal areas where I may be lacking trust
- Dedicate time each day to pray for contentment  
- Schedule regular check-ins to discuss my progress
- Pray for clarity regarding my desires and motivations
- List ten things I am grateful for
- Write down what I'm thankful for each day`;

  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/generate-playbook`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userInput: testInput,
        userId: 'test-specific-issues'
      })
    });
    
    if (!response.ok) {
      console.log('❌ API Error:', response.status);
      return;
    }
    
    const result = await response.json();
    const allSubtasks = result.actionSteps?.flatMap(step => step.subTasks || []) || [];
    
    console.log('📋 Checking specific issue patterns:\n');
    
    const testCases = [
      { pattern: /ask god.*reveal/i, expected: 'prayer', description: 'Ask God to reveal' },
      { pattern: /dedicate.*time.*pray/i, expected: 'timeblock', description: 'Dedicate time to pray' },
      { pattern: /schedule.*check-ins/i, expected: 'timeblock', description: 'Schedule check-ins' },
      { pattern: /pray.*clarity/i, expected: 'prayer', description: 'Pray for clarity' },
      { pattern: /list.*grateful/i, expected: 'gratitude', description: 'List grateful things' },
      { pattern: /write.*thankful/i, expected: 'gratitude', description: 'Write thankful things' }
    ];
    
    let correctCount = 0;
    let totalCount = 0;
    
    testCases.forEach(testCase => {
      const matchingTasks = allSubtasks.filter(task => 
        testCase.pattern.test(task.text)
      );
      
      matchingTasks.forEach(task => {
        totalCount++;
        const isCorrect = task.detected_journal_type === testCase.expected;
        if (isCorrect) correctCount++;
        
        const status = isCorrect ? '✅' : '❌';
        console.log(`${status} "${task.text.substring(0, 50)}..."`);
        console.log(`   Expected: ${testCase.expected}, Got: ${task.detected_journal_type || 'none'}`);
        console.log('');
      });
    });
    
    console.log(`📊 Accuracy: ${correctCount}/${totalCount} (${Math.round(correctCount/totalCount*100)}%)`);
    
    if (correctCount === totalCount) {
      console.log('🎉 All specific issues have been fixed!');
    } else {
      console.log('⚠️  Some issues still need attention.');
      console.log('The AI prompt may need further refinement.');
    }
    
  } catch (err) {
    console.error('❌ Test Error:', err.message);
  }
}

testSpecificIssues().catch(console.error);
