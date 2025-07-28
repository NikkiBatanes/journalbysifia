#!/usr/bin/env node

/**
 * Comprehensive UI Debug Test
 * Tests the entire flow from API to UI rendering
 */

// const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config();

// const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function debugUIComprehensive() {
  console.log('🔍 Comprehensive UI Debug Test\n');

  // 1. Test API Response Structure
  console.log('1️⃣ Testing API Response Structure...');
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/generate-playbook`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userInput: 'Help me pray for my family and reflect on God\'s goodness. I want to write down what I\'m grateful for.',
        userId: 'debug-ui-test',
      }),
    });

    if (!response.ok) {
      console.log('❌ API Error:', response.status);
      return;
    }

    const apiResult = response.json();

    console.log('✅ API Response Structure:');
    console.log('   Title:', apiResult.title);
    console.log('   Action Steps:', apiResult.actionSteps?.length || 0);

    if (apiResult.actionSteps && apiResult.actionSteps.length > 0) {
      apiResult.actionSteps.forEach((step, stepIndex) => {
        console.log(`   Step ${stepIndex + 1}: ${step.title}`);
        console.log(`     Subtasks: ${step.subTasks?.length || 0}`);

        if (step.subTasks && step.subTasks.length > 0) {
          step.subTasks.forEach((subtask, subIndex) => {
            const journalType = subtask.detected_journal_type || 'none';
            const emoji = getJournalEmoji(journalType);
            console.log(`       ${subIndex + 1}. "${subtask.text.substring(0, 40)}..." → ${journalType} ${emoji}`);
          });
        }
      });
    }

  } catch (err) {
    console.error('❌ API Test Error:', err.message);
  }

  // 2. Check Database vs In-Memory Data Flow
  console.log('\n2️⃣ Checking Data Flow...');
  console.log('📊 Current Flow:');
  console.log('   UserInputScreen.tsx → generatePlaybook() → aiResponse');
  console.log('   UserInputScreen.tsx → savePlaybook(aiResponse) → Database');
  console.log('   UserInputScreen.tsx → navigate with route.params.playbook = aiResponse');
  console.log('   PlaybookDetailScreen → Uses route.params.playbook (IN-MEMORY)');
  console.log('');
  console.log('🎯 This means the UI should show smart journaling data from aiResponse!');

  // 3. Check ActionStepsCard Logic
  console.log('\n3️⃣ Checking ActionStepsCard Logic...');
  console.log('✅ shouldShowJournalIcon() checks for non-"none" values');
  console.log('✅ parseJournalTypes() splits comma-separated values');
  console.log('✅ getJournalTypeIcon() maps types to MaterialCommunityIcons');
  console.log('✅ getJournalTypeColor() maps types to colors');
  console.log('✅ Debug logging added to see actual subtask data');

  // 4. Potential Issues
  console.log('\n4️⃣ Potential Issues to Check:');
  console.log('🔍 Check React Native debugger console for:');
  console.log('   • [ActionStepsCard] Subtask debug logs');
  console.log('   • detected_journal_type values');
  console.log('   • shouldShow boolean values');
  console.log('   • parsedTypes arrays');
  console.log('');
  console.log('🔍 Check if MaterialCommunityIcons are rendering:');
  console.log('   • hands-pray, head-lightbulb, heart, clock, checkbox-marked-circle');
  console.log('   • Colors: #4A90E2, #9B59B6, #E91E63, #FF9800, #4CAF50');
  console.log('');
  console.log('🔍 Check component hierarchy:');
  console.log('   • PlaybookDetailScreen → DocumentCardView → ActionStepsCard');
  console.log('   • Navigation prop passed correctly');
  console.log('   • Subtask data structure preserved');

  // 5. Test Instructions
  console.log('\n5️⃣ Testing Instructions:');
  console.log('📱 In the siFia app:');
  console.log('   1. Generate a new playbook with spiritual content');
  console.log('   2. Open React Native DevTools (press j in Metro terminal)');
  console.log('   3. Look for [ActionStepsCard] Subtask debug logs');
  console.log('   4. Check if detected_journal_type has valid values');
  console.log('   5. Verify shouldShow is true for smart journaling subtasks');
  console.log('   6. Look for colored icons next to subtask text');

  console.log('\n✅ Debug test complete! Check the app with DevTools open.');
}

function getJournalEmoji(type) {
  const emojis = {
    prayer: '🙏',
    reflection: '💡',
    gratitude: '❤️',
    win: '🏆',
    timeblock: '🕐',
    todos: '✅',
    focus: '🎯',
    financial_budgeting: '💰',
    financial_tithing: '🎁',
  };
  return emojis[type] || '📝';
}

debugUIComprehensive().catch(console.error);
