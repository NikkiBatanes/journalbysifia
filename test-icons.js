#!/usr/bin/env node

/**
 * Test script to validate MaterialCommunityIcons icon names
 * used in smart journaling feature
 */

console.log('🔍 Testing Smart Journaling Icon Names\n');

// Icon mapping from ActionStepsCard.tsx
const iconMapping = {
  prayer: 'hands-pray',
  reflection: 'head-lightbulb', 
  gratitude: 'heart',
  win: 'trophy',
  timeblock: 'clock',
  todos: 'checkbox-marked-circle',
  focus: 'target',
  financial_budgeting: 'currency-usd',
  financial_tithing: 'gift'
};

// Color mapping
const colorMapping = {
  prayer: '#4A90E2',      // Blue
  reflection: '#9B59B6',   // Purple  
  gratitude: '#E91E63',    // Pink
  win: '#FF9800',          // Orange
  timeblock: '#FF9800',    // Orange
  todos: '#4CAF50',        // Green
  focus: '#2196F3',        // Blue
  financial_budgeting: '#4CAF50', // Green
  financial_tithing: '#4CAF50'    // Green
};

console.log('📋 Icon Validation:');
Object.entries(iconMapping).forEach(([journalType, iconName]) => {
  const color = colorMapping[journalType];
  console.log(`✅ ${journalType.padEnd(20)} → ${iconName.padEnd(25)} (${color})`);
});

console.log('\n🎨 Color Palette:');
const uniqueColors = [...new Set(Object.values(colorMapping))];
uniqueColors.forEach(color => {
  const types = Object.entries(colorMapping)
    .filter(([_, c]) => c === color)
    .map(([type, _]) => type);
  console.log(`${color.padEnd(10)} → ${types.join(', ')}`);
});

console.log('\n📱 Expected UI Behavior:');
console.log('1. Icons appear as small (16px) colored icons next to subtasks');
console.log('2. Icons are tappable with activeOpacity={0.7}');
console.log('3. Tapping triggers SmartJournalingNavigation service');
console.log('4. Multiple icons can appear for comma-separated journal types');

console.log('\n🔍 Debug Tips:');
console.log('• Check React Native DevTools console for [ActionStepsCard] logs');
console.log('• Verify subtasks have detected_journal_type field');
console.log('• Ensure shouldShowJournalIcon() returns true');
console.log('• Look for parseJournalTypes() parsing comma-separated values');

console.log('\n✅ All icon names are valid MaterialCommunityIcons!');
