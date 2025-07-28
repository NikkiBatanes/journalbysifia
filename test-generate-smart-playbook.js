#!/usr/bin/env node

/**
 * Generate Smart Journaling Playbook Test
 * Test the actual API to generate a playbook with smart journaling data
 */

console.log('🚀 Generating Smart Journaling Playbook Test\n');

// Load environment variables if available
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log('⚠️  Environment variables not found. Using test mode.\n');
  
  // Show what the API would generate
  console.log('📋 Expected Smart Journaling Playbook Structure:\n');
  
  const mockPlaybook = {
    title: "Spiritual Growth Through Prayer and Reflection",
    description: "A week-long journey to deepen your relationship with God",
    actionSteps: [
      {
        id: "step-1",
        title: "Morning Prayer and Devotion",
        description: "Start each day with intentional time with God",
        subTasks: [
          {
            id: "subtask-1-1",
            text: "Pray for healing for family members who are struggling",
            completed: false,
            detected_journal_type: "prayer", // 🟣 Purple prayer icon
            is_example: false,
            example_interactive: false
          },
          {
            id: "subtask-1-2", 
            text: "Schedule 30 minutes for morning devotions at 6 AM",
            completed: false,
            detected_journal_type: "timeblock", // 🟢 Green timeblock icon
            is_example: false,
            example_interactive: false
          },
          {
            id: "subtask-1-3",
            text: "Reflect on how God showed His faithfulness this week",
            completed: false,
            detected_journal_type: "reflection", // 🔵 Blue reflection icon
            is_example: false,
            example_interactive: false
          }
        ]
      },
      {
        id: "step-2",
        title: "Gratitude and Service",
        description: "Express thankfulness and serve others",
        subTasks: [
          {
            id: "subtask-2-1",
            text: "Write down three things you are grateful for today",
            completed: false,
            detected_journal_type: "gratitude", // 🟡 Yellow gratitude icon
            is_example: false,
            example_interactive: false
          },
          {
            id: "subtask-2-2",
            text: "Call the church office to volunteer for the food drive",
            completed: false,
            detected_journal_type: "todos", // 🔷 Teal todo icon
            is_example: false,
            example_interactive: false
          },
          {
            id: "subtask-2-3",
            text: "Pick up groceries on the way home",
            completed: false,
            detected_journal_type: "none", // No icon (regular task)
            is_example: false,
            example_interactive: false
          }
        ]
      }
    ]
  };
  
  console.log(JSON.stringify(mockPlaybook, null, 2));
  
  console.log('\n🎨 Expected UI Indicators:');
  console.log('');
  
  const indicators = [
    { text: "Pray for healing for family members", type: "prayer", color: "🟣 Purple", icon: "🙏" },
    { text: "Schedule 30 minutes for morning devotions", type: "timeblock", color: "🟢 Green", icon: "🕐" },
    { text: "Reflect on how God showed His faithfulness", type: "reflection", color: "🔵 Blue", icon: "💡" },
    { text: "Write down three things you are grateful for", type: "gratitude", color: "🟡 Yellow", icon: "❤️" },
    { text: "Call the church office to volunteer", type: "todos", color: "🔷 Teal", icon: "✅" },
    { text: "Pick up groceries on the way home", type: "none", color: "⚪ None", icon: "❌" }
  ];
  
  indicators.forEach((item, index) => {
    console.log(`${index + 1}. "${item.text}"`);
    console.log(`   Type: ${item.type}`);
    console.log(`   UI: ${item.color} ${item.icon} ${item.type === 'none' ? '(no icon shown)' : '(tappable icon)'}`);
    console.log('');
  });
  
} else {
  console.log('✅ Environment variables found. Testing live API...\n');
  
  // Test with actual API
  const testRequest = {
    userInput: "Help me grow spiritually this week through prayer, reflection, gratitude, and service to others. I want to schedule time for devotions and pray for my family.",
    userId: "test-user-id"
  };
  
  console.log('📤 Sending request to generate-playbook API:');
  console.log(JSON.stringify(testRequest, null, 2));
  console.log('\n⏳ Generating playbook with smart journaling...\n');
  
  // Make actual API call
  fetch(`${SUPABASE_URL}/functions/v1/generate-playbook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify(testRequest)
  })
  .then(response => response.json())
  .then(data => {
    console.log('✅ API Response received!');
    console.log('\n📋 Generated Playbook with Smart Journaling:');
    console.log(JSON.stringify(data, null, 2));
    
    // Analyze smart journaling data
    if (data.actionSteps) {
      console.log('\n🎯 Smart Journaling Analysis:');
      data.actionSteps.forEach((step, stepIndex) => {
        console.log(`\nStep ${stepIndex + 1}: ${step.title}`);
        if (step.subTasks) {
          step.subTasks.forEach((subtask, taskIndex) => {
            const journalType = subtask.detected_journal_type || 'none';
            const icon = getJournalIcon(journalType);
            const color = getJournalColor(journalType);
            
            console.log(`  ${taskIndex + 1}. "${subtask.text}"`);
            console.log(`     Journal Type: ${journalType}`);
            console.log(`     UI Indicator: ${color} ${icon} ${journalType === 'none' ? '(no icon)' : '(tappable)'}`);
          });
        }
      });
    }
  })
  .catch(error => {
    console.error('❌ API Error:', error);
    console.log('\n💡 Try running the test in mock mode or check your environment variables.');
  });
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
    financial_budgeting: '💰',
    financial_tithing: '💝',
    financial_debt: '📊',
    none: '❌'
  };
  return icons[type] || '❓';
}

function getJournalColor(type) {
  const colors = {
    prayer: '🟣 Purple',
    reflection: '🔵 Blue',
    gratitude: '🟡 Yellow', 
    timeblock: '🟢 Green',
    todos: '🔷 Teal',
    win: '🟠 Orange',
    focus: '🟤 Brown',
    financial_budgeting: '💚 Dark Green',
    financial_tithing: '💚 Dark Green',
    financial_debt: '💚 Dark Green',
    none: '⚪ None'
  };
  return colors[type] || '❓ Unknown';
}

console.log('\n📱 To See in siFia App:');
console.log('1. Open the siFia app');
console.log('2. Generate a new playbook with spiritual content');
console.log('3. Look for colored journal type icons next to subtasks');
console.log('4. Tap icons to navigate to journaling components');
console.log('5. Check console logs for navigation debugging');

console.log('\n🎉 Smart Journaling is ready to enhance your spiritual growth!');
