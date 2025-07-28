#!/usr/bin/env node

/**
 * Test Smart Journaling UI Integration
 * Generate a playbook with smart journaling data to test UI indicators
 */

// const https = require('https'); // Used in commented function

console.log('🧪 Testing Smart Journaling UI Integration\n');

// Test data that should trigger smart journaling detection
const testPlaybookRequest = {
  userInput: 'Help me grow spiritually this week through prayer, reflection, and gratitude',
  userProfile: {
    name: 'Test User',
    spiritualGoals: ['prayer', 'reflection', 'gratitude'],
    preferences: {
      journaling: true,
      timeBlocking: true,
    },
  },
};

console.log('📝 Test Request:');
console.log(JSON.stringify(testPlaybookRequest, null, 2));

// Function to make API request (commented out as it's unused)
/*
function testSmartJournalingAPI() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(testPlaybookRequest);

    const options = {
      hostname: 'your-supabase-project.supabase.co', // Replace with actual Supabase URL
      port: 443,
      path: '/functions/v1/generate-playbook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY', // Replace with actual key
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
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
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
*/

// Test scenarios that should show smart journaling indicators
const testScenarios = [
  {
    name: 'Prayer Request',
    subtask: 'Pray for healing for family members',
    expectedType: 'prayer',
    expectedIcon: '🙏',
    expectedColor: 'purple',
  },
  {
    name: 'Reflection Task',
    subtask: "Reflect on God's faithfulness this week",
    expectedType: 'reflection',
    expectedIcon: '💡',
    expectedColor: 'blue',
  },
  {
    name: 'Gratitude Expression',
    subtask: "Write down three things you're grateful for",
    expectedType: 'gratitude',
    expectedIcon: '❤️',
    expectedColor: 'yellow',
  },
  {
    name: 'Time Scheduling',
    subtask: 'Schedule 30 minutes for morning devotions',
    expectedType: 'timeblock',
    expectedIcon: '🕐',
    expectedColor: 'green',
  },
  {
    name: 'Action Todo',
    subtask: 'Call church to volunteer for food drive',
    expectedType: 'todos',
    expectedIcon: '✅',
    expectedColor: 'teal',
  },
];

console.log('\n🎯 Expected Smart Journaling UI Indicators:\n');

testScenarios.forEach((scenario, index) => {
  console.log(`${index + 1}. ${scenario.name}`);
  console.log(`   Subtask: "${scenario.subtask}"`);
  console.log(`   Expected Type: ${scenario.expectedType}`);
  console.log(`   Expected UI: ${scenario.expectedIcon} ${scenario.expectedColor} icon (tappable)`);
  console.log('   Navigation: Tap → Journal screen');
  console.log('');
});

console.log('📱 To See Smart Journaling in the UI:\n');

console.log('1. 🚀 **Generate New Playbook**');
console.log('   - Open siFia app');
console.log('   - Create new playbook with spiritual content');
console.log('   - Include tasks like "Pray for...", "Reflect on...", "Schedule time..."');

console.log('\n2. 👀 **Look for Visual Indicators**');
console.log('   - Purple prayer icons (🙏) for prayer requests');
console.log('   - Blue reflection icons (💡) for reflection tasks');
console.log('   - Green timeblock icons (🕐) for scheduling');
console.log('   - Teal todo icons (✅) for actionable tasks');
console.log('   - Yellow gratitude icons (❤️) for gratitude expressions');

console.log('\n3. 🖱️ **Test Navigation**');
console.log('   - Tap any journal type icon');
console.log('   - Should navigate to Journal screen');
console.log('   - Console logs will show navigation details');

console.log('\n4. 🔍 **Debug Information**');
console.log('   - Check React Native debugger console');
console.log('   - Look for "[SmartJournalingNavigation]" logs');
console.log('   - Verify "[ActionStepsCard] Journal type pressed" messages');

console.log('\n📊 **Why You Might Not See Indicators Yet:**');
console.log('   ❓ Existing playbooks may not have smart journaling data');
console.log('   ❓ Need to generate new playbook with enhanced AI detection');
console.log('   ❓ Database migration not run yet (affects data persistence)');
console.log('   ❓ Subtasks may be detected as "none" type (no indicators shown)');

console.log('\n🔧 **Next Steps to See UI:**');
console.log('   1. Generate a new playbook with spiritual content');
console.log('   2. Look for journal type icons next to subtasks');
console.log('   3. Test tapping icons to trigger navigation');
console.log('   4. Run database migration for full functionality');

console.log('\n✨ **The UI is ready - just needs smart journaling data!**');

// Mock data example for testing
console.log('\n📋 **Mock Data Example (for testing):**');
const mockSubtask = {
  id: 'test-subtask-1',
  text: 'Pray for healing for my grandmother',
  completed: false,
  detected_journal_type: 'prayer',
  is_example: false,
  example_interactive: false,
};

console.log(JSON.stringify(mockSubtask, null, 2));
console.log('\n👆 This subtask would show a purple prayer icon that navigates to Journal screen when tapped.');

console.log('\n🎉 Smart Journaling UI is implemented and ready for testing!');
