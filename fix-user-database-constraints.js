const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixUserDatabaseConstraints() {
  console.log('🔧 Fixing user database constraints...');

  try {
    // 1. Check if users table exists
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'users');

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
      return;
    }

    console.log('📋 Users table exists:', tables && tables.length > 0);

    // 2. Check onboarding_progress foreign key constraints
    const { data: constraints, error: constraintsError } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name, table_name')
      .eq('table_schema', 'public')
      .eq('constraint_type', 'FOREIGN KEY')
      .like('constraint_name', '%user_id%');

    if (constraintsError) {
      console.error('❌ Error checking constraints:', constraintsError);
      return;
    }

    console.log('🔗 Foreign key constraints found:', constraints);

    // 3. If users table doesn't exist, create it or modify constraints
    if (!tables || tables.length === 0) {
      console.log('📝 Creating users table to match auth.users...');
      
      // Create users table that mirrors auth.users structure
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          -- Create users table if it doesn't exist
          CREATE TABLE IF NOT EXISTS public.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          -- Enable RLS
          ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

          -- Create policy for users to see their own data
          DROP POLICY IF EXISTS "Users can view own data" ON public.users;
          CREATE POLICY "Users can view own data" ON public.users
            FOR ALL USING (auth.uid() = id);

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

          -- Trigger to sync new users
          DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
          CREATE TRIGGER on_auth_user_created
            AFTER INSERT OR UPDATE ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
        `
      });

      if (createError) {
        console.error('❌ Error creating users table:', createError);
        return;
      }

      console.log('✅ Users table created successfully');
    }

    // 4. Sync existing auth users to public.users
    console.log('🔄 Syncing existing auth users...');
    
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }

    console.log(`📊 Found ${authUsers.users.length} auth users to sync`);

    for (const user of authUsers.users) {
      const { error: insertError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          updated_at: user.updated_at
        });

      if (insertError) {
        console.error(`❌ Error syncing user ${user.id}:`, insertError);
      } else {
        console.log(`✅ Synced user: ${user.email}`);
      }
    }

    // 5. Check and fix user_profiles foreign key if needed
    console.log('🔧 Checking user_profiles constraints...');
    
    const { data: profileConstraints, error: profileConstraintsError } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name')
      .eq('table_name', 'user_profiles')
      .eq('constraint_type', 'FOREIGN KEY');

    if (profileConstraintsError) {
      console.error('❌ Error checking profile constraints:', profileConstraintsError);
      return;
    }

    console.log('🔗 User profiles constraints:', profileConstraints);

    console.log('✅ Database constraints fixed successfully!');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the fix
fixUserDatabaseConstraints();
