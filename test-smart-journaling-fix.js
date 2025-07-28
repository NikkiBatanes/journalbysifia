#!/usr/bin/env node

/**
 * Comprehensive test to verify smart journaling fix
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testSmartJournalingFix() {
  console.log('🔧 Testing Smart Journaling Fix\n');
  
  // 1. Test API directly
  console.log('1️⃣ Testing API Direct Call...');
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/generate-playbook`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userInput: 'Help me find contentment and pray for my family. I want to reflect on God\'s goodness and write down what I\'m grateful for.',
        userId: 'test-user-fix-verification'
      })
    });
    
    if (!response.ok) {
      console.log('❌ API Error:', response.status);
      return;
    }
    
    const result = await response.json();
    const allSubtasks = result.actionSteps?.flatMap(step => step.subTasks || []) || [];
    const smartSubtasks = allSubtasks.filter(st => st.detected_journal_type && st.detected_journal_type !== 'none');
    
    console.log(`✅ API Response: ${allSubtasks.length} total subtasks, ${smartSubtasks.length} with smart journaling`);
    
    if (smartSubtasks.length > 0) {
      console.log('📋 Smart journaling types detected:');
      const types = [...new Set(smartSubtasks.map(st => st.detected_journal_type))];
      types.forEach(type => {
        const count = smartSubtasks.filter(st => st.detected_journal_type === type).length;
        console.log(`   • ${type}: ${count} subtasks`);
      });
    }
    
  } catch (err) {
    console.error('❌ API Test Error:', err.message);
  }
  
  // 2. Check database for recent data
  console.log('\n2️⃣ Checking Database for Recent Data...');
  try {
    const { data: recentSubtasks, error } = await supabase
      .from('playbook_sub_tasks')
      .select('text, detected_journal_type, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.log('❌ Database Error:', error.message);
    } else if (recentSubtasks && recentSubtasks.length > 0) {
      console.log(`✅ Found ${recentSubtasks.length} recent subtasks in database:`);
      recentSubtasks.forEach((task, i) => {
        const journalType = task.detected_journal_type || 'none';
        const emoji = getJournalEmoji(journalType);
        console.log(`   ${i+1}. "${task.text.substring(0, 40)}..." → ${journalType} ${emoji}`);
      });
    } else {
      console.log('📝 No recent subtasks found in database');
      console.log('   This is expected if no playbooks have been generated since the fix');
    }
  } catch (err) {
    console.error('❌ Database Check Error:', err.message);
  }
  
  // 3. Verify fix implementation
  console.log('\n3️⃣ Verifying Fix Implementation...');
  
  const fs = require('fs');
  const userInputScreenPath = './src/screens/UserInputScreen.tsx';
  
  try {
    const content = fs.readFileSync(userInputScreenPath, 'utf8');
    
    // Check for the fixed line
    if (content.includes('savedPlaybook = aiResponse;')) {
      console.log('✅ Fix applied: Using aiResponse instead of duplicate generatePlaybook call');
    } else {
      console.log('❌ Fix not found: Still calling generatePlaybook twice');
    }
    
    // Check for smart journaling data preservation
    if (content.includes('smart journaling data')) {
      console.log('✅ Smart journaling data preservation comment added');
    } else {
      console.log('⚠️  No smart journaling preservation comment found');
    }
    
  } catch (err) {
    console.error('❌ File Check Error:', err.message);
  }
  
  // 4. Instructions for testing
  console.log('\n4️⃣ Next Steps for Testing:');
  console.log('📱 In the siFia app:');
  console.log('   1. Generate a new playbook with spiritual content');
  console.log('   2. Look for colored journal icons next to subtasks');
  console.log('   3. Check React Native debugger for console logs');
  console.log('   4. Verify subtasks are saved to database with journal types');
  
  console.log('\n🔍 Expected Results:');
  console.log('   • Prayer subtasks: 🙏 (blue hands-pray icon)');
  console.log('   • Reflection subtasks: 💡 (purple lightbulb icon)');
  console.log('   • Gratitude subtasks: ❤️ (pink heart icon)');
  console.log('   • Todos subtasks: ✅ (green checkbox icon)');
  
  console.log('\n✅ Smart journaling fix verification complete!');
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
    financial_tithing: '🎁'
  };
  return emojis[type] || '📝';
}

testSmartJournalingFix().catch(console.error);
