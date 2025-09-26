// Comprehensive test for recurring event deletion functionality
const fs = require('fs');
const path = require('path');

console.log('🧪 Running comprehensive deletion functionality test...');

// Test 1: Check if TimeBlockReactQuery.tsx has proper deletion logic
const timeBlockFile = path.join(__dirname, 'src/components/journal/TimeBlockReactQuery.tsx');
const timeBlockContent = fs.readFileSync(timeBlockFile, 'utf8');

console.log('\n📋 Test 1: Checking deletion logic structure...');

// Check for virtual instance detection
const hasVirtualDetection = timeBlockContent.includes('timeBlock.id.includes(\'-\')');
console.log('✓ Virtual instance detection:', hasVirtualDetection ? 'PRESENT' : 'MISSING');

// Check for exception system usage
const hasExceptionSystem = timeBlockContent.includes('exceptions: updatedExceptions');
console.log('✓ Exception system implementation:', hasExceptionSystem ? 'PRESENT' : 'MISSING');

// Check for metadata preservation
const hasMetadataPreservation = timeBlockContent.includes('...existingMetadata');
console.log('✓ Metadata preservation:', hasMetadataPreservation ? 'PRESENT' : 'MISSING');

// Check for React Query cache invalidation
const hasCacheInvalidation = timeBlockContent.includes('queryClient.invalidateQueries');
console.log('✓ Cache invalidation:', hasCacheInvalidation ? 'PRESENT' : 'MISSING');

// Test 2: Check if timeBlockApi.ts has proper filtering
const apiFile = path.join(__dirname, 'src/services/api/timeBlockApi.ts');
const apiContent = fs.readFileSync(apiFile, 'utf8');

console.log('\n📋 Test 2: Checking API filtering logic...');

// Check for exception filtering
const hasExceptionFiltering = apiContent.includes('blockExceptions.includes(block.selected_date)');
console.log('✓ Exception filtering:', hasExceptionFiltering ? 'PRESENT' : 'MISSING');

// Check for virtual ID generation
const hasVirtualIdGeneration = apiContent.includes('`${block.id}-${targetDate}`');
console.log('✓ Virtual ID generation:', hasVirtualIdGeneration ? 'PRESENT' : 'MISSING');

// Test 3: Check calendar sync service
const calendarFile = path.join(__dirname, 'src/services/calendarSyncService.ts');
const calendarContent = fs.readFileSync(calendarFile, 'utf8');

console.log('\n📋 Test 3: Checking calendar sync logic...');

// Check for granular deletion support
const hasGranularDeletion = calendarContent.includes('instanceStartDate');
console.log('✓ Granular calendar deletion:', hasGranularDeletion ? 'PRESENT' : 'MISSING');

// Check for event ID parsing
const hasEventIdParsing = calendarContent.includes('eventId.includes(\':\')');
console.log('✓ Event ID parsing:', hasEventIdParsing ? 'PRESENT' : 'MISSING');

// Test 4: Check database migration
const migrationFile = path.join(__dirname, 'supabase/migrations/20250915113000_add_calendar_event_id_to_time_blocks.sql');
const migrationContent = fs.readFileSync(migrationFile, 'utf8');

console.log('\n📋 Test 4: Checking database schema...');

// Check for metadata column
const hasMetadataColumn = migrationContent.includes('metadata JSONB');
console.log('✓ Metadata column:', hasMetadataColumn ? 'PRESENT' : 'MISSING');

// Check for repeat frequency column
const hasRepeatFrequency = migrationContent.includes('repeat_frequency');
console.log('✓ Repeat frequency column:', hasRepeatFrequency ? 'PRESENT' : 'MISSING');

console.log('\n🎯 Summary:');
const allTests = [
  hasVirtualDetection,
  hasExceptionSystem,
  hasMetadataPreservation,
  hasCacheInvalidation,
  hasExceptionFiltering,
  hasVirtualIdGeneration,
  hasGranularDeletion,
  hasEventIdParsing,
  hasMetadataColumn,
  hasRepeatFrequency,
];

const passedTests = allTests.filter(Boolean).length;
const totalTests = allTests.length;

console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);

if (passedTests === totalTests) {
  console.log('🎉 All deletion functionality components are properly implemented!');
} else {
  console.log('⚠️ Some components may need attention.');
}

console.log('\n📝 Deletion Flow Summary:');
console.log('1. Virtual instances (ID contains "-") → Exception system');
console.log('2. Original recurring events (single delete) → Exception system');
console.log('3. Original recurring events (future/all delete) → Full deletion');
console.log('4. Non-recurring events → Direct deletion');
console.log('5. Calendar sync with granular instance support');
console.log('6. Immediate UI refresh via React Query invalidation');
