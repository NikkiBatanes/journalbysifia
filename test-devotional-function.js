// Test script for the generate-devotional Edge Function
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Use the same configuration as in supabaseApi.ts
const SUPABASE_URL = 'https://aesmrjinczhknchlrsmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NjYxOTMsImV4cCI6MjA2NDM0MjE5M30.x7XMjrm9WWlvEdc5eaK7Z5Fy-V_85qMJQ7pInsrKIyM';

async function testGenerateDevotional() {
  const functionUrl = `${SUPABASE_URL}/functions/v1/generate-devotional`;
  
  try {
    console.log('Testing devotional generation...');
    console.log('Function URL:', functionUrl);
    
    const requestBody = {
      duration: 3,
      userInput: 'Test devotional generation',
      playbookId: 'test-playbook-123'
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    // Add a small delay to ensure the function is fully deployed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Sending request to:', functionUrl);
    console.log('With headers:', {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 5)}...` : 'undefined',
      'Authorization': 'Bearer [REDACTED]'
    });
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        // Add a dummy authorization header since the function might still require it
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(requestBody),
    });

    console.log('\n--- Response ---');
    console.log('Status:', response.status, response.statusText);
    
    const text = await response.text();
    console.log('\nHeaders:');
    console.log(JSON.stringify(Object.fromEntries([...response.headers.entries()]), null, 2));
    
    console.log('\nResponse Body:');
    try {
      // Try to parse as JSON for pretty printing
      const json = JSON.parse(text);
      console.log(JSON.stringify(json, null, 2));
      
      if (response.ok) {
        console.log('\n✅ Success! Devotional generated successfully');
      } else {
        console.error('\n❌ Error:', json.message || 'Unknown error');
      }
    } catch (e) {
      // If not JSON, output as text
      console.log(text);
      if (!response.ok) {
        console.error('\n❌ Error: Could not parse error response as JSON');
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testGenerateDevotional();
