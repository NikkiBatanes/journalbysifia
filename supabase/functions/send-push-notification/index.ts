import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  notification_id?: string
  user_id: string
  type: string
  title: string
  message: string
  data?: any
  priority?: 'low' | 'normal' | 'high' | 'critical'
}

interface PushMessage {
  to: string
  title: string
  body: string
  data?: any
  priority?: string
  sound?: string
  badge?: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: NotificationPayload = await req.json();
    const { notification_id, user_id, type, title, message, data, priority = 'normal' } = payload;

    // Some high-value, low-volume events should always deliver, even if the user
    // hit the general rate limit (e.g. family invitations and membership changes).
    const rateLimitExemptTypes = [
      'family_invitation',
      'member_joined',
      'member_removed',
      'trial_converted',
    ];

    if (!rateLimitExemptTypes.includes(type)) {
      // Rate limiting: Check how many notifications sent in last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentNotifications, error: rateLimitError } = await supabase
        .from('notification_delivery_log')
        .select('id')
        .eq('user_id', user_id)
        .gte('delivered_at', oneHourAgo);

      if (!rateLimitError && recentNotifications && recentNotifications.length >= 10) {
        console.warn(`Rate limit exceeded for user ${user_id}: ${recentNotifications.length} notifications in last hour`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            reason: 'Rate limit exceeded',
            message: 'Maximum 10 notifications per hour. Please try again later.'
          }),
          { 
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Get user's device tokens and preferences
    const { data: deviceTokens, error: tokenError } = await supabase
      .from('device_tokens')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true);

    if (tokenError) {
      throw new Error(`Failed to get device tokens: ${tokenError.message}`);
    }

    const { data: preferences, error: prefError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (prefError && prefError.code !== 'PGRST116') { // Ignore "not found" error
      console.warn('Failed to get preferences:', prefError.message);
    }

    // Check if notifications are enabled for this type
    if (preferences && !isNotificationTypeEnabled(type, preferences)) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Notification type disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check quiet hours
    if (preferences && isInQuietHours(preferences)) {
      // Schedule for later unless it's critical
      if (priority !== 'critical') {
        await scheduleForLater(supabase, payload, preferences);
        return new Response(
          JSON.stringify({ success: true, scheduled: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Send push notifications to all active devices
    const results = [];
    for (const deviceToken of deviceTokens) {
      try {
        const pushMessage: PushMessage = {
          to: deviceToken.token,
          title,
          body: message,
          data: {
            type,
            ...data,
          },
          priority: priority === 'critical' ? 'high' : 'normal',
          sound: 'default',
          badge: 1,
        };

        const result = await sendPushNotification(pushMessage, deviceToken.platform);
        results.push({
          device_id: deviceToken.device_id,
          platform: deviceToken.platform,
          success: result.success,
          error: result.error,
        });

        // Log delivery attempt
        await supabase
          .from('notification_delivery_log')
          .insert({
            notification_id,
            user_id,
            device_token_id: deviceToken.id,
            status: result.success ? 'delivered' : 'failed',
            error_code: result.error ? 'APNS_ERROR' : null,
            error_message: result.error?.message || null,
          });

        // Track analytics if notification was successfully delivered
        if (result.success && notification_id) {
          try {
            await supabase
              .from('notification_analytics')
              .insert({
                user_id,
                notification_id,
                type,
                sent_at: new Date().toISOString(),
                deep_link: data?.deep_link || null,
                metadata: {
                  platform: deviceToken.platform,
                  device_id: deviceToken.device_id,
                  priority,
                },
                created_at: new Date().toISOString(),
              });
          } catch (analyticsError) {
            // Non-fatal: log but don't fail the notification
            console.error('Failed to track analytics:', analyticsError);
          }
        }

      } catch (error) {
        console.error(`Failed to send to device ${deviceToken.device_id}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          device_id: deviceToken.device_id,
          platform: deviceToken.platform,
          success: false,
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Push notification error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function sendPushNotification(message: PushMessage, platform: string) {
  try {
    if (platform === 'ios') {
      return await sendAPNS(message);
    } else {
      return await sendFCM(message);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: { message: errorMessage } };
  }
}

async function sendAPNS(message: PushMessage) {
  // Apple Push Notification Service
  // Using sandbox host for development/testing with sandbox APNs key
  const apnsUrl = 'https://api.sandbox.push.apple.com/3/device/' + message.to;

  const payload = {
    aps: {
      alert: {
        title: message.title,
        body: message.body,
      },
      sound: message.sound || 'default',
      badge: message.badge || 1,
    },
    data: message.data || {},
  };

  const response = await fetch(apnsUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('APNS_JWT_TOKEN')}`,
      'Content-Type': 'application/json',
      'apns-topic': Deno.env.get('APNS_BUNDLE_ID') || 'com.sifiaopc.app',
      'apns-priority': message.priority === 'high' ? '10' : '5',
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return { success: true };
  } else {
    const error = await response.text();
    return { success: false, error: { message: error } };
  }
}

async function sendFCM(message: PushMessage) {
  // Firebase Cloud Messaging (for Android)
  const fcmUrl = 'https://fcm.googleapis.com/fcm/send';

  const payload = {
    to: message.to,
    notification: {
      title: message.title,
      body: message.body,
      sound: message.sound || 'default',
    },
    data: message.data || {},
    priority: message.priority === 'high' ? 'high' : 'normal',
  };

  const response = await fetch(fcmUrl, {
    method: 'POST',
    headers: {
      'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    const result = await response.json();
    return { success: result.success === 1 };
  } else {
    const error = await response.text();
    return { success: false, error: { message: error } };
  }
}

function isNotificationTypeEnabled(type: string, preferences: any): boolean {
  const typeMap: { [key: string]: string } = {
    'prayer_reminder': 'prayer_reminders',
    'prayer_request': 'prayer_requests',
    'playbook_step': 'playbook_actions',
    'playbook_verse': 'playbook_verses',
    'playbook_challenge': 'playbook_challenges',
    'playbook_affirmation': 'playbook_affirmations',
    'devotional_reminder': 'devotional_reminders',
    'journal_prompt': 'journal_prompts',
    'reflection_question': 'reflection_questions',
    'streak_alert': 'streak_alerts',
    'milestone_celebration': 'milestone_celebrations',
    'trial_notification': 'trial_notifications',
  };

  const prefKey = typeMap[type];
  if (!prefKey) {return true;} // Default to enabled for unknown types

  return preferences[prefKey] !== false;
}

function isInQuietHours(preferences: any): boolean {
  if (!preferences.quiet_hours_enabled) {return false;}

  // Get user's timezone (default to UTC if not set)
  const userTimezone = preferences.timezone || 'UTC';
  
  // Get current time in user's timezone
  const now = new Date();
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
  const currentTime = userTime.toTimeString().slice(0, 5); // HH:MM format

  const startTime = preferences.quiet_hours_start || '22:00';
  const endTime = preferences.quiet_hours_end || '07:00';

  if (startTime <= endTime) {
    // Quiet hours within same day (e.g., 08:00 - 17:00)
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Quiet hours span midnight (e.g., 22:00 - 07:00)
    return currentTime >= startTime || currentTime <= endTime;
  }
}

async function scheduleForLater(supabase: any, payload: NotificationPayload, preferences: any) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const morningTime = preferences.preferred_morning_time || '08:00';
  const scheduledTime = new Date(`${tomorrow.toISOString().split('T')[0]}T${morningTime}:00`);

  await supabase
    .from('notification_queue')
    .insert({
      user_id: payload.user_id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data || {},
      scheduled_for: scheduledTime.toISOString(),
      priority: payload.priority || 'normal',
    });
}
