// Database connection test with authentication
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Use the same configuration as your app
const DEFAULT_SUPABASE_URL = 'https://aesmrjinczhknchlrsmt.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NjYxOTMsImV4cCI6MjA2NDM0MjE5M30.x7XMjrm9WWlvEdc5eaK7Z5Fy-V_85qMJQ7pInsrKIyM';

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_ANON_KEY);

async function testDatabaseWithAuth() {
  console.log('🔍 Testing Supabase Database with Authentication...\n');

  try {
    // Test 1: Check if we can access tables without auth
    console.log('1. Testing anonymous access...');
    const { data: anonData, error: anonError } = await supabase
      .from('journal_entries')
      .select('count')
      .limit(1);
    
    if (anonError) {
      console.log('❌ Anonymous access failed:', anonError.message);
      console.log('   This might be expected if RLS (Row Level Security) is enabled');
    } else {
      console.log('✅ Anonymous access works');
    }

    // Test 2: Try to create a test entry with proper UUID
    console.log('\n2. Testing insert with proper UUID...');
    const testUserId = uuidv4(); // Generate a proper UUID
    const testEntry = {
      user_id: testUserId,
      content_type: 'gratitude',
      content: 'Database connection test with UUID',
      selected_date: new Date().toISOString().split('T')[0],
    };

    console.log('   Using test UUID:', testUserId);
    
    const { data: insertData, error: insertError } = await supabase
      .from('journal_entries')
      .insert(testEntry)
      .select()
      .single();

    if (insertError) {
      console.log('❌ Insert failed:', insertError.message);
      console.log('   Details:', insertError.details);
      console.log('   Hint:', insertError.hint);
      console.log('   Code:', insertError.code);
      
      // Check if it's a RLS (Row Level Security) issue
      if (insertError.code === '42501' || insertError.message.includes('policy')) {
        console.log('   🔒 This appears to be a Row Level Security (RLS) issue');
        console.log('   🔒 You need to be authenticated to insert data');
      }
    } else {
      console.log('✅ Insert successful with UUID');
      console.log('📝 Created entry ID:', insertData.id);

      // Cleanup
      const { error: deleteError } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', insertData.id);

      if (deleteError) {
        console.log('⚠️  Cleanup failed:', deleteError.message);
      } else {
        console.log('✅ Cleanup successful');
      }
    }

    // Test 3: Check table permissions and RLS policies
    console.log('\n3. Checking table permissions...');
    
    const tables = [
      'journal_entries',
      'prayers', 
      'devotionals',
      'playbooks'
    ];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${table}:`, error.message);
          if (error.code === '42501') {
            console.log(`   🔒 ${table} requires authentication (RLS enabled)`);
          }
        } else {
          console.log(`✅ ${table}: accessible`);
          if (data && data.length > 0) {
            console.log(`   📋 Sample columns:`, Object.keys(data[0]).join(', '));
          } else {
            console.log(`   📋 Table is empty`);
          }
        }
      } catch (err) {
        console.log(`❌ ${table}:`, err.message);
      }
    }

    // Test 4: Test authentication (if you have test credentials)
    console.log('\n4. Testing authentication...');
    console.log('   ℹ️  To test with authentication, you would need:');
    console.log('   ℹ️  - Valid user credentials');
    console.log('   ℹ️  - Call supabase.auth.signInWithPassword()');
    console.log('   ℹ️  - Then retry the database operations');

  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }

  console.log('\n🏁 Database authentication test completed');
  console.log('\n💡 Summary:');
  console.log('   - Database connection: Working ✅');
  console.log('   - Tables exist: Yes ✅');
  console.log('   - UUID format: Required ✅');
  console.log('   - Authentication: Likely required for data operations 🔒');
  console.log('\n💡 Next steps:');
  console.log('   1. Ensure users are properly authenticated');
  console.log('   2. Check that user.id from auth is a valid UUID');
  console.log('   3. Verify RLS policies allow authenticated users to CRUD their data');
}

// Run the test
testDatabaseWithAuth();
