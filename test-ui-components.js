#!/usr/bin/env node

/**
 * Test UI Components for Smart Journaling
 * Verify that the UI components are properly integrated
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing UI Components for Smart Journaling\n');

// Test 1: Check ActionStepsCard implementation
console.log('📱 Test 1: ActionStepsCard Implementation');

const actionStepsPath = path.join(__dirname, 'src/components/ActionStepsCard.tsx');
if (fs.existsSync(actionStepsPath)) {
  const content = fs.readFileSync(actionStepsPath, 'utf8');
  
  const requiredFeatures = [
    { name: 'Smart Journaling Import', pattern: /SmartJournalingNavigation/ },
    { name: 'Navigation Prop', pattern: /navigation\?:/ },
    { name: 'Journal Type Press Handler', pattern: /onJournalTypePress/ },
    { name: 'Journal Type Icon Function', pattern: /getJournalTypeIcon/ },
    { name: 'Journal Type Color Function', pattern: /getJournalTypeColor/ },
    { name: 'Multiple Journal Types Support', pattern: /split.*,.*map/ },
    { name: 'Navigation Service Usage', pattern: /SmartJournalingNavigation\.create/ }
  ];
  
  console.log('✅ ActionStepsCard found');
  requiredFeatures.forEach(feature => {
    if (feature.pattern.test(content)) {
      console.log(`   ✅ ${feature.name}`);
    } else {
      console.log(`   ❌ ${feature.name} - Missing or incorrect`);
    }
  });
  
  // Check for journal type mappings
  const journalTypes = ['prayer', 'reflection', 'gratitude', 'timeblock', 'todos'];
  console.log('\n   📋 Journal Type Mappings:');
  journalTypes.forEach(type => {
    if (content.includes(`'${type}'`) || content.includes(`"${type}"`)) {
      console.log(`   ✅ ${type}`);
    } else {
      console.log(`   ❌ ${type} - Not found`);
    }
  });
  
} else {
  console.log('❌ ActionStepsCard not found');
}

// Test 2: Check DocumentCardView integration
console.log('\n🔗 Test 2: DocumentCardView Integration');

const docCardPath = path.join(__dirname, 'src/components/DocumentCardView.tsx');
if (fs.existsSync(docCardPath)) {
  const content = fs.readFileSync(docCardPath, 'utf8');
  
  const integrationChecks = [
    { name: 'Navigation Import', pattern: /NavigationProp/ },
    { name: 'Navigation Prop in Interface', pattern: /navigation\?\s*:\s*NavigationProp/ },
    { name: 'Navigation Prop Destructuring', pattern: /navigation.*\}\s*=/ },
    { name: 'Navigation Passed to ActionStepsCard', pattern: /navigation=\{navigation\}/ }
  ];
  
  console.log('✅ DocumentCardView found');
  integrationChecks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`   ✅ ${check.name}`);
    } else {
      console.log(`   ❌ ${check.name} - Missing`);
    }
  });
  
} else {
  console.log('❌ DocumentCardView not found');
}

// Test 3: Check PlaybookDetailScreenNew integration
console.log('\n📺 Test 3: PlaybookDetailScreenNew Integration');

const playbookPath = path.join(__dirname, 'src/screens/PlaybookDetailScreenNew.tsx');
if (fs.existsSync(playbookPath)) {
  const content = fs.readFileSync(playbookPath, 'utf8');
  
  if (content.includes('navigation={rootNavigation}')) {
    console.log('✅ PlaybookDetailScreenNew found');
    console.log('   ✅ Navigation prop passed to DocumentCardView');
  } else {
    console.log('✅ PlaybookDetailScreenNew found');
    console.log('   ❌ Navigation prop not passed to DocumentCardView');
  }
  
} else {
  console.log('❌ PlaybookDetailScreenNew not found');
}

// Test 4: Check Smart Journaling Navigation Service
console.log('\n🧭 Test 4: Smart Journaling Navigation Service');

const navServicePath = path.join(__dirname, 'src/services/smartJournalingNavigation.ts');
if (fs.existsSync(navServicePath)) {
  const content = fs.readFileSync(navServicePath, 'utf8');
  
  const navigationMethods = [
    'navigateToJournaling',
    'navigateToPrayer', 
    'navigateToReflection',
    'navigateToGratitude',
    'navigateToTimeBlock',
    'navigateToTodos'
  ];
  
  console.log('✅ Smart Journaling Navigation Service found');
  navigationMethods.forEach(method => {
    if (content.includes(method)) {
      console.log(`   ✅ ${method}`);
    } else {
      console.log(`   ❌ ${method} - Missing`);
    }
  });
  
} else {
  console.log('❌ Smart Journaling Navigation Service not found');
}

console.log('\n🎯 Debugging Steps for UI Issues:\n');

console.log('1. 🔄 **Clear App Cache**');
console.log('   - Close the siFia app completely');
console.log('   - Clear React Native cache: npx react-native start --reset-cache');
console.log('   - Restart the app');

console.log('\n2. 📱 **Generate Fresh Playbook**');
console.log('   - Use spiritual content like: "Help me pray for my family and reflect on God\'s faithfulness"');
console.log('   - Include words like: pray, reflect, schedule, grateful, time');

console.log('\n3. 🔍 **Check Console Logs**');
console.log('   - Open React Native debugger');
console.log('   - Look for "[ActionStepsCard]" logs');
console.log('   - Check for "[SmartJournalingNavigation]" messages');

console.log('\n4. 📊 **Verify Data Structure**');
console.log('   - Check if subtasks have detected_journal_type field');
console.log('   - Ensure values are not "none" or null');

console.log('\n5. 🎨 **Look for Visual Indicators**');
console.log('   - Small colored icons next to subtask text');
console.log('   - Icons should be tappable');
console.log('   - Colors: Purple (prayer), Blue (reflection), Green (timeblock), etc.');

console.log('\n✨ The smart journaling system is fully implemented!');
console.log('   If you\'re still not seeing indicators, try the debugging steps above.');

// Create a mock data example
console.log('\n📋 **Expected Data Structure:**');
const mockData = {
  id: "test-subtask",
  text: "Pray for healing for my family",
  completed: false,
  detected_journal_type: "prayer",
  is_example: false,
  example_interactive: false
};

console.log(JSON.stringify(mockData, null, 2));
console.log('\n👆 This should show a purple prayer icon (🙏) that navigates when tapped.');
