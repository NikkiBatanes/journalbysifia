#!/usr/bin/env node

/**
 * Check Database Schema for Smart Journaling Columns
 * Verify if the database has the smart journaling columns
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🔍 Checking Database Schema for Smart Journaling Columns\n');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('❌ Missing environment variables:');
  console.log('   - SUPABASE_URL');
  console.log('   - SUPABASE_ANON_KEY');
  console.log('\n💡 Please check your .env file or environment setup.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  try {
    console.log('📋 Checking playbook_sub_tasks table schema...\n');
    
    // Try to query the table with smart journaling columns
    const { data, error } = await supabase
      .from('playbook_sub_tasks')
      .select('id, text, detected_journal_type, is_example, example_interactive')
      .limit(1);
    
    if (error) {
      console.log('❌ Smart journaling columns not found in database!');
      console.log('Error:', error.message);
      console.log('\n🔧 Solution: Run the database migration');
      console.log('   1. Copy the SQL from database/smart-journaling-migration.sql');
      console.log('   2. Run it in your Supabase SQL editor');
      console.log('   3. Or use: npx supabase db push');
      return false;
    }
    
    console.log('✅ Smart journaling columns exist in database!');
    console.log('Schema check result:', data ? 'Success' : 'No data yet');
    
    // Check if any existing data has smart journaling fields
    const { data: existingData, error: queryError } = await supabase
      .from('playbook_sub_tasks')
      .select('id, text, detected_journal_type, is_example, example_interactive')
      .not('detected_journal_type', 'is', null)
      .limit(5);
    
    if (queryError) {
      console.log('⚠️  Error querying existing data:', queryError.message);
    } else if (existingData && existingData.length > 0) {
      console.log('\n📊 Found existing smart journaling data:');
      existingData.forEach((item, index) => {
        console.log(`${index + 1}. "${item.text}"`);
        console.log(`   Journal Type: ${item.detected_journal_type || 'none'}`);
        console.log(`   Is Example: ${item.is_example || false}`);
        console.log('');
      });
    } else {
      console.log('\n📝 No existing smart journaling data found.');
      console.log('   This is normal for a fresh migration.');
      console.log('   Generate a new playbook to see smart journaling in action!');
    }
    
    return true;
    
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    return false;
  }
}

async function checkRecentPlaybooks() {
  try {
    console.log('\n🔍 Checking recent playbooks for smart journaling data...\n');
    
    // Get recent playbooks
    const { data: playbooks, error: playbookError } = await supabase
      .from('playbooks')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (playbookError) {
      console.log('❌ Error fetching playbooks:', playbookError.message);
      return;
    }
    
    if (!playbooks || playbooks.length === 0) {
      console.log('📝 No playbooks found. Generate a new one to test!');
      return;
    }
    
    console.log('📋 Recent playbooks:');
    for (const playbook of playbooks) {
      console.log(`\n📖 ${playbook.title} (${new Date(playbook.created_at).toLocaleDateString()})`);
      
      // Get subtasks for this playbook
      const { data: subtasks, error: subtaskError } = await supabase
        .from('playbook_sub_tasks')
        .select('text, detected_journal_type, is_example')
        .eq('playbook_id', playbook.id)
        .limit(5);
      
      if (subtaskError) {
        console.log('   ❌ Error fetching subtasks:', subtaskError.message);
        continue;
      }
      
      if (!subtasks || subtasks.length === 0) {
        console.log('   📝 No subtasks found');
        continue;
      }
      
      console.log('   Subtasks:');
      subtasks.forEach((subtask, index) => {
        const journalType = subtask.detected_journal_type || 'none';
        const icon = getJournalIcon(journalType);
        const hasSmartData = subtask.detected_journal_type !== null && subtask.detected_journal_type !== 'none';
        
        console.log(`   ${index + 1}. "${subtask.text}"`);
        console.log(`      Journal Type: ${journalType} ${icon} ${hasSmartData ? '✅' : '❌'}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Error checking playbooks:', err.message);
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
    none: '⚪'
  };
  return icons[type] || '❓';
}

async function main() {
  const schemaOk = await checkSchema();
  
  if (schemaOk) {
    await checkRecentPlaybooks();
    
    console.log('\n🎯 Next Steps:');
    console.log('1. ✅ Database schema is ready');
    console.log('2. 📱 Generate a new playbook in the app');
    console.log('3. 👀 Look for colored journal type icons');
    console.log('4. 🖱️  Tap icons to test navigation');
    
  } else {
    console.log('\n🔧 Required Actions:');
    console.log('1. ❌ Run database migration first');
    console.log('2. 📝 Copy SQL from database/smart-journaling-migration.sql');
    console.log('3. 🔧 Execute in Supabase SQL editor');
    console.log('4. 🔄 Re-run this check');
  }
  
  console.log('\n📞 Need help? Check the implementation guide!');
}

main().catch(console.error);
