// Test script for daily review notification
// Run with: npx tsx test-daily-review-notification.ts <user_id>

const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

async function testDailyReviewNotification(userId: string) {
  console.log('🔔 Testing daily review notification for user:', userId);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/schedule-daily-notifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        test_user_id: userId,
      }),
    });

    const data = await response.json();
    console.log('✅ Response:', data);

    if (!response.ok) {
      console.error('❌ Error:', response.status, data);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Get user ID from command line argument
const userId = process.argv[2];

if (!userId) {
  console.log('❌ Error: Please provide a user_id');
  console.log('Usage: npx tsx test-daily-review-notification.ts <user_id>');
  process.exit(1);
}

testDailyReviewNotification(userId);
