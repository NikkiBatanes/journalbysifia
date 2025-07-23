// Database connection test script
const { createClient } = require('@supabase/supabase-js');

// Use the same configuration as your app
const DEFAULT_SUPABASE_URL = 'https://aesmrjinczhknchlrsmt.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NjYxOTMsImV4cCI6MjA2NDM0MjE5M30.x7XMjrm9WWlvEdc5eaK7Z5Fy-V_85qMJQ7pInsrKIyM';

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_ANON_KEY);

async function testDatabaseConnection() {
  console.log('🔍 Testing Supabase Database Connection...\n');

  try {
    // Test 1: Basic connection
    console.log('1. Testing basic connection...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('journal_entries')
      .select('count')
      .limit(1);
    
    if (healthError) {
      console.log('❌ Connection failed:', healthError.message);
      return;
    }
    console.log('✅ Basic connection successful');

    // Test 2: Check table structure
    console.log('\n2. Checking journal_entries table structure...');
    const { data: tableData, error: tableError } = await supabase
      .from('journal_entries')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.log('❌ Table access failed:', tableError.message);
    } else {
      console.log('✅ journal_entries table accessible');
      if (tableData && tableData.length > 0) {
        console.log('📋 Sample entry structure:', Object.keys(tableData[0]));
      } else {
        console.log('📋 Table is empty (no sample data)');
      }
    }

    // Test 3: Test insert operation
    console.log('\n3. Testing insert operation...');
    const testEntry = {
      user_id: 'test-user-' + Date.now(),
      content_type: 'gratitude',
      content: 'Database connection test',
      selected_date: new Date().toISOString().split('T')[0],
    };

    const { data: insertData, error: insertError } = await supabase
      .from('journal_entries')
      .insert(testEntry)
      .select()
      .single();

    if (insertError) {
      console.log('❌ Insert failed:', insertError.message);
      console.log('   Details:', insertError.details);
      console.log('   Hint:', insertError.hint);
    } else {
      console.log('✅ Insert successful');
      console.log('📝 Created entry ID:', insertData.id);

      // Test 4: Test delete operation (cleanup)
      console.log('\n4. Cleaning up test data...');
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

    // Test 5: Check other tables
    console.log('\n5. Checking other tables...');
    
    const tables = ['prayers', 'devotionals', 'playbooks'];
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${table} table:`, error.message);
        } else {
          console.log(`✅ ${table} table accessible`);
        }
      } catch (err) {
        console.log(`❌ ${table} table:`, err.message);
      }
    }

  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }

  console.log('\n🏁 Database test completed');
}

// Run the test
testDatabaseConnection();
