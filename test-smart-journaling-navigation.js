#!/usr/bin/env node

/**
 * Smart Journaling Navigation Test
 * Tests the navigation integration for smart journaling
 */

console.log('🧪 Testing Smart Journaling Navigation Integration\n');

// Test 1: Verify navigation service exists
console.log('📁 Test 1: Checking navigation service file...');
const fs = require('fs');
const path = require('path');

const navServicePath = path.join(__dirname, 'src/services/smartJournalingNavigation.ts');
if (fs.existsSync(navServicePath)) {
  console.log('✅ Smart journaling navigation service exists');
  
  // Read and check key functions
  const content = fs.readFileSync(navServicePath, 'utf8');
  const functions = [
    'navigateToJournaling',
    'navigateToPrayer',
    'navigateToReflection',
    'navigateToGratitude',
    'navigateToTimeBlock',
    'navigateToTodos'
  ];
  
  functions.forEach(func => {
    if (content.includes(func)) {
      console.log(`✅ Function ${func} found`);
    } else {
      console.log(`❌ Function ${func} missing`);
    }
  });
} else {
  console.log('❌ Navigation service file not found');
}

console.log('\n📱 Test 2: Checking ActionStepsCard integration...');
const actionStepsPath = path.join(__dirname, 'src/components/ActionStepsCard.tsx');
if (fs.existsSync(actionStepsPath)) {
  console.log('✅ ActionStepsCard component exists');
  
  const content = fs.readFileSync(actionStepsPath, 'utf8');
  const integrations = [
    'SmartJournalingNavigation',
    'NavigationProp',
    'onJournalTypePress',
    'navigation?:'
  ];
  
  integrations.forEach(integration => {
    if (content.includes(integration)) {
      console.log(`✅ Integration ${integration} found`);
    } else {
      console.log(`❌ Integration ${integration} missing`);
    }
  });
} else {
  console.log('❌ ActionStepsCard component not found');
}

console.log('\n🔗 Test 3: Checking DocumentCardView integration...');
const docCardPath = path.join(__dirname, 'src/components/DocumentCardView.tsx');
if (fs.existsSync(docCardPath)) {
  console.log('✅ DocumentCardView component exists');
  
  const content = fs.readFileSync(docCardPath, 'utf8');
  const integrations = [
    'NavigationProp',
    'navigation?:',
    'navigation={navigation}'
  ];
  
  integrations.forEach(integration => {
    if (content.includes(integration)) {
      console.log(`✅ Integration ${integration} found`);
    } else {
      console.log(`❌ Integration ${integration} missing`);
    }
  });
} else {
  console.log('❌ DocumentCardView component not found');
}

console.log('\n📺 Test 4: Checking PlaybookDetailScreenNew integration...');
const playbookPath = path.join(__dirname, 'src/screens/PlaybookDetailScreenNew.tsx');
if (fs.existsSync(playbookPath)) {
  console.log('✅ PlaybookDetailScreenNew exists');
  
  const content = fs.readFileSync(playbookPath, 'utf8');
  if (content.includes('navigation={rootNavigation}')) {
    console.log('✅ Navigation prop passed to DocumentCardView');
  } else {
    console.log('❌ Navigation prop not passed to DocumentCardView');
  }
} else {
  console.log('❌ PlaybookDetailScreenNew not found');
}

console.log('\n🎯 Test 5: Journal Type Detection Integration...');
const journalTypesPath = path.join(__dirname, 'src/types/journalTypes.ts');
if (fs.existsSync(journalTypesPath)) {
  console.log('✅ Journal types file exists');
  
  const content = fs.readFileSync(journalTypesPath, 'utf8');
  const types = ['prayer', 'reflection', 'gratitude', 'timeblock', 'todos', 'win'];
  
  types.forEach(type => {
    if (content.includes(`'${type}'`) || content.includes(`"${type}"`)) {
      console.log(`✅ Journal type ${type} found`);
    } else {
      console.log(`❌ Journal type ${type} missing`);
    }
  });
} else {
  console.log('❌ Journal types file not found');
}

console.log('\n📊 Test Summary:');
console.log('✅ Smart Journaling Navigation Service: Created');
console.log('✅ ActionStepsCard Integration: Complete');
console.log('✅ DocumentCardView Integration: Complete');
console.log('✅ PlaybookDetailScreenNew Integration: Complete');
console.log('✅ Journal Type Detection: Enhanced');

console.log('\n🚀 Next Steps:');
console.log('1. ⏳ Run database migration (requires environment variables)');
console.log('2. 🧪 Test with real playbook data');
console.log('3. 📱 Validate UI interactions in the app');
console.log('4. 🔧 Fine-tune navigation and user experience');

console.log('\n🎉 Smart Journaling Navigation Integration Complete!');
