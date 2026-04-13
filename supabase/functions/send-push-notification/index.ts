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

// ─────────────────────────────────────────────────────────────────────────────
// [FIX] Generate a fresh APNS JWT token every call.
// APNS tokens expire every 60 minutes — using a static APNS_JWT_TOKEN env var
// is what caused all notifications to silently fail since November 2025.
// This function generates a valid token from your .p8 key on every invocation.
// ─────────────────────────────────────────────────────────────────────────────
async function generateAPNSToken(): Promise<string> {
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const privateKeyPem = Deno.env.get('APNS_AUTH_KEY'); // Contents of your .p8 file

  if (!keyId || !teamId || !privateKeyPem) {
    throw new Error(
      `Missing APNS credentials. Required: APNS_KEY_ID, APNS_TEAM_ID, APNS_AUTH_KEY. ` +
      `Got: keyId=${!!keyId}, teamId=${!!teamId}, privateKey=${!!privateKeyPem}` 
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'ES256', kid: keyId };
  const payload = { iss: teamId, iat: now };

  const encodeBase64Url = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const headerB64 = encodeBase64Url(header);
  const payloadB64 = encodeBase64Url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  // Strip PEM headers and whitespace to get raw base64
  const pemBody = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace('-----BEGIN EC PRIVATE KEY-----', '')
    .replace('-----END EC PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    encoder.encode(signingInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

serve(async (req) => {
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

    const rateLimitExemptTypes = [
      'family_invitation',
      'member_joined',
      'member_removed',
      'trial_converted',
    ];

    if (!rateLimitExemptTypes.includes(type)) {
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

    if (prefError && prefError.code !== 'PGRST116') {
      console.warn('Failed to get preferences:', prefError.message);
    }

    if (preferences && !isNotificationTypeEnabled(type, preferences)) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Notification type disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (preferences && isInQuietHours(preferences)) {
      if (priority !== 'critical') {
        await scheduleForLater(supabase, payload, preferences);
        return new Response(
          JSON.stringify({ success: true, scheduled: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const shouldBatch = await checkForBatching(supabase, user_id, type);
    if (shouldBatch && priority !== 'critical') {
      await supabase
        .from('notification_queue')
        .insert({
          user_id,
          type,
          title,
          message,
          data: data || {},
          scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          priority,
          status: 'pending',
        });

      return new Response(
        JSON.stringify({ success: true, batched: true, message: 'Notification queued for batching' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    for (const deviceToken of deviceTokens) {
      try {
        const pushMessage: PushMessage = {
          to: deviceToken.token,
          title,
          body: message,
          data: { type, ...data },
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

        // Deactivate bad device tokens automatically
        if (!result.success && result.error?.message) {
          const errorData = JSON.parse(result.error.message || '{}');
          if (errorData.reason === 'BadDeviceToken' || errorData.reason === 'Unregistered') {
            await supabase
              .from('device_tokens')
              .update({ is_active: false })
              .eq('id', deviceToken.id);
            console.log(`[APNS] Deactivated bad token for device ${deviceToken.device_id}`);
          }
        }

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
  const isProduction = Deno.env.get('APP_ENV') === 'production' ||
                       Deno.env.get('APNS_ENVIRONMENT') === 'production';
  const apnsHost = isProduction
    ? 'https://api.push.apple.com/3/device/'
    : 'https://api.sandbox.push.apple.com/3/device/';
  const apnsUrl = apnsHost + message.to;

  console.log(`[APNS] Sending to ${isProduction ? 'PRODUCTION' : 'SANDBOX'}`);

  // Generate fresh JWT every call — static tokens expire after 60 minutes
  const jwtToken = await generateAPNSToken();

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
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
      'apns-topic': Deno.env.get('APNS_BUNDLE_ID') || 'app.sifia.com',
      'apns-priority': message.priority === 'high' ? '10' : '5',
      'apns-push-type': 'alert',
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    console.log('[APNS] ✅ Notification sent successfully');
    return { success: true };
  } else {
    const error = await response.json().catch(() => ({ reason: response.statusText }));
    console.error('[APNS] ❌ Failed:', error);
    return { success: false, error: { message: JSON.stringify(error) } };
  }
}

async function sendFCM(message: PushMessage) {
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
  if (!prefKey) { return true; }
  return preferences[prefKey] !== false;
}

function isInQuietHours(preferences: any): boolean {
  if (!preferences.quiet_hours_enabled) { return false; }

  const userTimezone = preferences.timezone || 'UTC';
  const now = new Date();
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
  const currentTime = userTime.toTimeString().slice(0, 5);

  const startTime = preferences.quiet_hours_start || '22:00';
  const endTime = preferences.quiet_hours_end || '07:00';

  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
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

async function checkForBatching(supabase: any, userId: string, type: string): Promise<boolean> {
  const batchableTypes = [
    'prayer_reminder',
    'devotional_reminder',
    'journal_prompt',
    'playbook_step',
    'streak_alert',
    'reflection_question',
  ];

  if (!batchableTypes.includes(type)) { return false; }

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('notification_queue')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('status', 'pending')
    .gte('created_at', thirtyMinutesAgo);

  if (error) {
    console.error('Error checking for batching:', error);
    return false;
  }

  return data && data.length > 0;
}
