// Debug script to check onboarding completion status
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://qjvgqcjhqnqjqjqjqjqj.supabase.co'; // Replace with actual URL
const supabaseKey = 'your-anon-key'; // Replace with actual key

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugOnboardingStatus() {
  console.log('🔍 Debugging Onboarding Status...\n');

  try {
    // 1. Check all users in user_profiles
    console.log('1️⃣ Checking user_profiles table:');
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, email, onboarding_completed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (profilesError) {
      console.error('❌ Error fetching user profiles:', profilesError);
    } else {
      console.log('📊 Recent user profiles:');
      profiles?.forEach(profile => {
        console.log(`   - ${profile.email}: onboarding_completed = ${profile.onboarding_completed}`);
      });
    }

    console.log('\n2️⃣ Checking onboarding_progress table:');
    const { data: progress, error: progressError } = await supabase
      .from('onboarding_progress')
      .select('user_id, is_completed, completed_at, current_step')
      .order('created_at', { ascending: false })
      .limit(10);

    if (progressError) {
      console.error('❌ Error fetching onboarding progress:', progressError);
    } else {
      console.log('📊 Recent onboarding progress:');
      progress?.forEach(prog => {
        console.log(`   - User ${prog.user_id}: is_completed = ${prog.is_completed}, step = ${prog.current_step}`);
      });
    }

    // 3. Check for mismatches
    console.log('\n3️⃣ Checking for data mismatches:');
    if (profiles && progress) {
      profiles.forEach(profile => {
        const userProgress = progress.find(p => p.user_id === profile.id);
        if (userProgress) {
          const profileCompleted = profile.onboarding_completed === true;
          const progressCompleted = userProgress.is_completed === true;

          if (profileCompleted !== progressCompleted) {
            console.log(`⚠️  MISMATCH for ${profile.email}:`);
            console.log(`     user_profiles.onboarding_completed = ${profileCompleted}`);
            console.log(`     onboarding_progress.is_completed = ${progressCompleted}`);
          }
        }
      });
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Run the debug function
debugOnboardingStatus();
