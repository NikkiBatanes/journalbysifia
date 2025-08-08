/**
 * Database Check Utility
 * Check if required tables exist and have correct structure
 */

import { supabase } from '../services/supabaseClient';

export const checkDatabaseTables = async () => {
  console.log('🔍 Checking database tables...');

  try {
    // Check if faith_points_profiles table exists
    console.log('📋 Checking faith_points_profiles table...');
    const { error: profilesError } = await supabase
      .from('faith_points_profiles')
      .select('*')
      .limit(1);

    if (profilesError) {
      console.log('❌ faith_points_profiles table error:', profilesError);
    } else {
      console.log('✅ faith_points_profiles table exists');
    }

    // Check if faith_points_log table exists
    console.log('📋 Checking faith_points_log table...');
    const { error: logError } = await supabase
      .from('faith_points_log')
      .select('*')
      .limit(1);

    if (logError) {
      console.log('❌ faith_points_log table error:', logError);
    } else {
      console.log('✅ faith_points_log table exists');
    }

    // Check if playbooks table exists
    console.log('📋 Checking playbooks table...');
    const { error: playbooksError } = await supabase
      .from('playbooks')
      .select('*')
      .limit(1);

    if (playbooksError) {
      console.log('❌ playbooks table error:', playbooksError);
    } else {
      console.log('✅ playbooks table exists');
    }

    // Check if devotionals table exists
    console.log('📋 Checking devotionals table...');
    const { error: devotionalsError } = await supabase
      .from('devotionals')
      .select('*')
      .limit(1);

    if (devotionalsError) {
      console.log('❌ devotionals table error:', devotionalsError);
    } else {
      console.log('✅ devotionals table exists');
    }

    console.log('✅ Database check complete!');
    return {
      profilesTable: !profilesError,
      logTable: !logError,
      playbooksTable: !playbooksError,
      devotionalsTable: !devotionalsError,
    };

  } catch (error) {
    console.error('❌ Database check failed:', error);
    return {
      profilesTable: false,
      logTable: false,
      playbooksTable: false,
      devotionalsTable: false,
    };
  }
};

export const createMissingTables = async () => {
  console.log('🔧 Attempting to create missing tables...');

  try {
    // This would require admin privileges, so we'll just log what needs to be done
    console.log('📝 To create missing tables, run the complete_database_schema.sql file in your Supabase dashboard');
    console.log('📝 Or use the Supabase CLI: supabase db push');

  } catch (error) {
    console.error('❌ Failed to create tables:', error);
  }
};
