#!/usr/bin/env node

const fetch = require('node-fetch');
require('dotenv').config();

async function testContentmentAPI() {
  try {
    console.log('🧪 Testing API with Contentment theme...\n');

    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/generate-playbook`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userInput: 'Help me find contentment and overcome desire for more. I want to pray for contentment and reflect on God\'s provision.',
        userId: 'test-user-contentment',
      }),
    });

    if (!response.ok) {
      console.log('❌ API Error:', response.status, response.statusText);
      return;
    }

    const result = await response.json();
    console.log('✅ API Response received');

    // Check for smart journaling data
    const allSubtasks = result.actionSteps?.flatMap(step => step.subTasks || []) || [];
    const smartSubtasks = allSubtasks.filter(st => st.detected_journal_type && st.detected_journal_type !== 'none');

    console.log(`📊 Total subtasks: ${allSubtasks.length}`);
    console.log(`📊 Smart journaling subtasks: ${smartSubtasks.length}`);

    if (smartSubtasks.length > 0) {
      console.log('\n✅ Smart journaling detected:');
      smartSubtasks.forEach((st, i) => {
        console.log(`${i + 1}. "${st.text}" → ${st.detected_journal_type}`);
      });
    } else {
      console.log('\n❌ No smart journaling data found!');
      console.log('\n📝 First few subtasks:');
      allSubtasks.slice(0, 5).forEach((st, i) => {
        console.log(`${i + 1}. "${st.text}" → ${st.detected_journal_type || 'NONE'}`);
      });

      console.log('\n🔍 Raw API response structure:');
      console.log('Title:', result.title);
      console.log('Action Steps:', result.actionSteps?.length || 0);
      if (result.actionSteps && result.actionSteps[0]) {
        console.log('First step subtasks:', result.actionSteps[0].subTasks?.length || 0);
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testContentmentAPI();
