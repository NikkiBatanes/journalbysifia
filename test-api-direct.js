#!/usr/bin/env node

/**
 * Direct API Test for Smart Journaling
 * Test the generate-playbook API directly to see if it's working
 */

const https = require('https');
require('dotenv').config();

console.log('🧪 Direct API Test for Smart Journaling\n');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log('❌ Missing environment variables. Please check your .env file.');
  process.exit(1);
}

const testRequest = {
  userInput: "Help me grow spiritually this week. I want to pray for my family, reflect on God's faithfulness, schedule time for devotions, and write down what I'm grateful for.",
  userId: 'test-user-123',
};

console.log('📤 Testing generate-playbook API...');
console.log('Request:', JSON.stringify(testRequest, null, 2));

function makeAPICall() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(testRequest);
    const url = new URL(`${SUPABASE_URL}/functions/v1/generate-playbook`);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: result });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}\nResponse: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function testAPI() {
  try {
    console.log('⏳ Calling API...\n');

    const response = await makeAPICall();

    console.log(`✅ API Response (Status: ${response.status})\n`);

    if (response.status !== 200) {
      console.log('❌ API Error:', response.data);
      return;
    }

    const playbook = response.data;

    // Analyze the response for smart journaling data
    console.log('📊 Smart Journaling Analysis:\n');

    if (!playbook.actionSteps || playbook.actionSteps.length === 0) {
      console.log('❌ No action steps found in response');
      return;
    }

    let totalSubtasks = 0;
    let smartJournalingSubtasks = 0;

    playbook.actionSteps.forEach((step, stepIndex) => {
      console.log(`📋 Step ${stepIndex + 1}: ${step.title}`);

      if (!step.subTasks || step.subTasks.length === 0) {
        console.log('   ❌ No subtasks found');
        return;
      }

      step.subTasks.forEach((subtask, taskIndex) => {
        totalSubtasks++;
        const journalType = subtask.detected_journal_type || 'none';
        const hasSmartJournaling = journalType !== 'none' && journalType !== null;

        if (hasSmartJournaling) {
          smartJournalingSubtasks++;
        }

        const icon = getJournalIcon(journalType);
        const status = hasSmartJournaling ? '✅' : '❌';

        console.log(`   ${taskIndex + 1}. "${subtask.text}"`);
        console.log(`      Journal Type: ${journalType} ${icon} ${status}`);
        console.log(`      Is Example: ${subtask.is_example || false}`);
        console.log(`      Interactive: ${subtask.example_interactive || false}`);
        console.log('');
      });
    });

    console.log('📈 Summary:');
    console.log(`   Total Subtasks: ${totalSubtasks}`);
    console.log(`   Smart Journaling Subtasks: ${smartJournalingSubtasks}`);
    console.log(`   Detection Rate: ${totalSubtasks > 0 ? Math.round((smartJournalingSubtasks / totalSubtasks) * 100) : 0}%`);

    if (smartJournalingSubtasks === 0) {
      console.log('\n❌ No smart journaling detected!');
      console.log('🔧 Possible issues:');
      console.log('   1. AI prompt not generating Journal: tags');
      console.log('   2. Parsing logic not working');
      console.log('   3. API not using enhanced persona config');

      // Show raw AI response for debugging
      console.log('\n🔍 Raw AI Response (first 500 chars):');
      console.log(JSON.stringify(playbook, null, 2).substring(0, 500) + '...');

    } else {
      console.log('\n✅ Smart journaling is working!');
      console.log('🎯 These subtasks should show UI indicators in the app.');
    }

  } catch (error) {
    console.error('❌ API Test Failed:', error.message);
  }
}

function getJournalIcon(type) {
  const icons = {
    prayer: '🙏',
    reflection: '💡',
    gratitude: '❤️',
    timeblock: '🕐',
    todos: '✅',
    win: '🏆',
    focus: '🎯',
    none: '⚪',
  };
  return icons[type] || '❓';
}

testAPI();
