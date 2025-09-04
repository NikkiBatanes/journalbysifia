// Debug script to check user's Bible version preference
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aesmrjinczhknchlrsmt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkBibleVersionPreference() {
  try {
    // Get all user profiles to see the structure
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, preferences')
      .limit(5);

    if (error) {
      console.error('Error fetching profiles:', error);
      return;
    }

    console.log('Sample user profiles and preferences:');
    profiles.forEach((profile, index) => {
      console.log(`\nProfile ${index + 1}:`);
      console.log('ID:', profile.id);
      console.log('Preferences:', JSON.stringify(profile.preferences, null, 2));
      
      if (profile.preferences?.content?.bibleVersion) {
        console.log('Bible Version:', profile.preferences.content.bibleVersion);
      } else {
        console.log('No Bible version preference found');
      }
    });

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkBibleVersionPreference();
