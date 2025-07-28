#!/usr/bin/env node

/**
 * Test raw AI output to see exact format
 */

const fetch = require('node-fetch');
require('dotenv').config();

async function testRawOutput() {
  console.log('🔍 Testing Raw AI Output Format\n');
  
  const testInput = 'Help me pray for clarity and list things I am grateful for.';

  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/generate-playbook`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userInput: testInput,
        userId: 'test-raw-output'
      })
    });
    
    if (!response.ok) {
      console.log('❌ API Error:', response.status);
      return;
    }
    
    const result = await response.json();
    
    console.log('📄 Raw AI Response (first 2000 characters):');
    console.log('=' .repeat(60));
    console.log(result.rawResponse?.substring(0, 2000) || 'No raw response available');
    console.log('=' .repeat(60));
    
    console.log('\n📋 Parsed Subtasks:');
    const allSubtasks = result.actionSteps?.flatMap(step => step.subTasks || []) || [];
    allSubtasks.forEach((task, i) => {
      console.log(`${i+1}. "${task.text}"`);
      console.log(`   Journal Type: ${task.detected_journal_type || 'none'}`);
      console.log('');
    });
    
  } catch (err) {
    console.error('❌ Test Error:', err.message);
  }
}

testRawOutput().catch(console.error);
