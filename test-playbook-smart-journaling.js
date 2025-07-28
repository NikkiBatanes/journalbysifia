// Test script for the generate-playbook Edge Function with Smart Journaling Detection
// Use a different name for the imported fetch to avoid shadowing
global.fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Use the same configuration as in supabaseApi.ts
const SUPABASE_URL = 'https://aesmrjinczhknchlrsmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NjYxOTMsImV4cCI6MjA2NDM0MjE5M30.x7XMjrm9WWlvEdc5eaK7Z5Fy-V_85qMJQ7pInsrKIyM';

// Test scenarios for smart journaling detection
const testScenarios = [
  {
    name: "Prayer Detection Test",
    userInput: "I'm struggling with forgiveness and need help processing emotions",
    expectedPatterns: ["prayer", "reflection"]
  },
  {
    name: "Time Management Test", 
    userInput: "I need to establish better work-life balance and sleep schedule",
    expectedPatterns: ["timeblock", "reflection"]
  },
  {
    name: "Financial Stewardship Test",
    userInput: "I want to improve my spending habits and practice biblical stewardship",
    expectedPatterns: ["reflection", "todos", "financial_budgeting"]
  },
  {
    name: "Mixed Journal Types Test",
    userInput: "Help me create a morning routine with prayer, Bible study, and exercise",
    expectedPatterns: ["timeblock", "prayer", "reflection", "todos"]
  }
];

async function testPlaybookGeneration(scenario) {
  const functionUrl = `${SUPABASE_URL}/functions/v1/generate-playbook`;

  try {
    console.log(`\n🧪 Testing: ${scenario.name}`);
    console.log(`📝 Input: ${scenario.userInput}`);
    console.log(`🎯 Expected patterns: ${scenario.expectedPatterns.join(', ')}`);

    const requestBody = {
      userInput: scenario.userInput,
      userId: 'test-user-123',
    };

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP Error ${response.status}:`, errorText);
      return false;
    }

    const result = await response.json();
    console.log('✅ Response received');

    // Analyze the smart journaling detection
    if (result && result.actionSteps) {
      console.log('\n📊 Smart Journaling Analysis:');
      
      const detectedTypes = new Set();
      let totalSubtasks = 0;
      let subtasksWithJournaling = 0;

      result.actionSteps.forEach((step, stepIndex) => {
        console.log(`\n  Step ${stepIndex + 1}: ${step.title}`);
        
        if (step.subTasks && step.subTasks.length > 0) {
          step.subTasks.forEach((subtask, subtaskIndex) => {
            totalSubtasks++;
            const journalType = subtask.detected_journal_type || 'none';
            
            if (journalType !== 'none') {
              subtasksWithJournaling++;
              detectedTypes.add(journalType);
            }

            console.log(`    ${subtaskIndex + 1}. ${subtask.text} → ${journalType}`);
          });
        }
      });

      console.log(`\n📈 Detection Summary:`);
      console.log(`  Total subtasks: ${totalSubtasks}`);
      console.log(`  With journaling: ${subtasksWithJournaling} (${Math.round(subtasksWithJournaling/totalSubtasks*100)}%)`);
      console.log(`  Detected types: ${Array.from(detectedTypes).join(', ')}`);
      
      // Check if expected patterns were found
      const foundExpected = scenario.expectedPatterns.filter(pattern => 
        detectedTypes.has(pattern)
      );
      
      console.log(`\n🎯 Pattern Matching:`);
      console.log(`  Expected: ${scenario.expectedPatterns.join(', ')}`);
      console.log(`  Found: ${foundExpected.join(', ')}`);
      console.log(`  Match rate: ${Math.round(foundExpected.length/scenario.expectedPatterns.length*100)}%`);

      return foundExpected.length >= scenario.expectedPatterns.length * 0.5; // 50% match threshold
    } else {
      console.error('❌ No actionSteps found in response');
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Smart Journaling Detection Tests\n');
  console.log('=' .repeat(60));

  let passedTests = 0;
  const totalTests = testScenarios.length;

  for (const scenario of testScenarios) {
    const passed = await testPlaybookGeneration(scenario);
    if (passed) {
      passedTests++;
      console.log('✅ PASSED\n');
    } else {
      console.log('❌ FAILED\n');
    }
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('=' .repeat(60));
  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Smart journaling detection is working correctly.');
  } else if (passedTests >= totalTests * 0.75) {
    console.log('⚠️  Most tests passed. Some fine-tuning may be needed.');
  } else {
    console.log('🔧 Several tests failed. Detection logic needs improvement.');
  }
}

// Run the tests
runAllTests();
