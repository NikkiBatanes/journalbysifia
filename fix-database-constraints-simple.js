// Simple database constraint fix script
// Run this after ensuring your .env file has the correct Supabase credentials

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function fixDatabaseConstraints() {
  console.log('🔧 Starting database constraint fixes...');

  // Check if environment variables are loaded
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables. Please check your .env file:');
    console.error('   - SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('📋 Checking current database state...');

    // 1. Check if users table exists
    const { data: userTable, error: userTableError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
          ) as table_exists;
        `,
      });

    if (userTableError) {
      console.error('❌ Error checking users table:', userTableError);
      return;
    }

    console.log('👥 Users table exists:', userTable?.[0]?.table_exists || false);

    // 2. Run the constraint fix SQL
    console.log('🔧 Applying database constraint fixes...');

    const { error: sqlError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create users table if it doesn't exist
        CREATE TABLE IF NOT EXISTS public.users (
          id UUID PRIMARY KEY,
          email TEXT UNIQUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Enable RLS
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

        -- Create policies
        DROP POLICY IF EXISTS "Users can view own data" ON public.users;
        CREATE POLICY "Users can view own data" ON public.users
          FOR SELECT USING (auth.uid() = id);

        -- Function to sync auth.users with public.users
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER AS $$
        BEGIN
          INSERT INTO public.users (id, email, created_at, updated_at)
          VALUES (NEW.id, NEW.email, NEW.created_at, NEW.updated_at)
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            updated_at = EXCLUDED.updated_at;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        -- Create trigger
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT OR UPDATE ON auth.users
          FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
      `,
    });

    if (sqlError) {
      console.error('❌ Error applying SQL fixes:', sqlError);
      return;
    }

    console.log('✅ Database constraint fixes applied successfully!');

    // 3. Sync existing auth users
    console.log('🔄 Syncing existing auth users...');

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }

    console.log(`📊 Found ${authUsers.users.length} auth users to sync`);

    let syncedCount = 0;
    for (const user of authUsers.users) {
      const { error: insertError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          updated_at: user.updated_at,
        });

      if (insertError) {
        console.error(`❌ Error syncing user ${user.email}:`, insertError);
      } else {
        syncedCount++;
        console.log(`✅ Synced user: ${user.email}`);
      }
    }

    console.log(`🎉 Successfully synced ${syncedCount}/${authUsers.users.length} users`);
    console.log('✅ Database constraint fixes completed!');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the fix
if (require.main === module) {
  fixDatabaseConstraints();
}

module.exports = { fixDatabaseConstraints };
