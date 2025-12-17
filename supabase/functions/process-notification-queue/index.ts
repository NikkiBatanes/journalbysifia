import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
      serviceKeyPrefix: serviceRoleKey.substring(0, 20)
    });
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get pending notifications that are due to be sent
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .lt('attempts', 3) // Don't retry more than 3 times
      .order('priority', { ascending: false }) // Critical first
      .order('scheduled_for', { ascending: true }) // Oldest first
      .limit(50); // Process in batches

    console.log('Query result:', {
      count: pendingNotifications?.length ?? 0,
      error: fetchError?.message
    });

    if (fetchError) {
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
    }

    const results = [];
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const usersProcessedInThisBatch = new Set<string>();

    // Process notifications with rate limiting
    for (const notification of pendingNotifications || []) {
      try {
        const userId = notification.user_id;
        
        // Check if we already sent a notification to this user in THIS batch
        if (usersProcessedInThisBatch.has(userId)) {
          console.log(`Skipping notification ${notification.id} - user ${userId} already received one in this batch`);
          
          // Reschedule for later (30 minutes from now)
          await supabase
            .from('notification_queue')
            .update({
              status: 'pending',
              scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);
          
          results.push({
            id: notification.id,
            success: false,
            reason: 'rate_limited_same_batch',
          });
          continue;
        }
        
        // Check if this user received a notification in the last 30 minutes from database
        const { data: recentNotif } = await supabase
          .from('notifications')
          .select('created_at')
          .eq('user_id', userId)
          .gte('created_at', thirtyMinutesAgo)
          .limit(1)
          .single();
        
        if (recentNotif) {
          console.log(`Skipping notification ${notification.id} - user ${userId} received one recently`);
          
          // Reschedule for later (30 minutes from now)
          await supabase
            .from('notification_queue')
            .update({
              status: 'pending',
              scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);
          
          results.push({
            id: notification.id,
            success: false,
            reason: 'rate_limited_recent',
          });
          continue;
        }
        
        // Mark as being processed
        await supabase
          .from('notification_queue')
          .update({
            attempts: notification.attempts + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        // Send the notification
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notification_id: notification.id,
            user_id: notification.user_id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            priority: notification.priority,
          }),
        });

        if (response.ok) {
          // Mark as sent
          await supabase
            .from('notification_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);

          // Track this user to prevent sending more notifications in this batch
          usersProcessedInThisBatch.add(userId);
          
          results.push({
            id: notification.id,
            success: true,
          });
        } else {
          const errorText = await response.text();

          // Exponential backoff: retry after 1min, 5min, 15min
          const retryDelays = [1, 5, 15]; // minutes
          const currentAttempt = notification.attempts + 1;
          const maxAttempts = 3;

          // Mark as failed if max attempts reached, otherwise schedule retry
          const newStatus = currentAttempt >= maxAttempts ? 'failed' : 'pending';
          
          // Calculate next retry time with exponential backoff
          let nextRetry = new Date().toISOString();
          if (currentAttempt < maxAttempts && retryDelays[currentAttempt - 1]) {
            const delayMinutes = retryDelays[currentAttempt - 1];
            nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
          }

          await supabase
            .from('notification_queue')
            .update({
              status: newStatus,
              error_message: errorText,
              scheduled_for: newStatus === 'pending' ? nextRetry : notification.scheduled_for,
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);

          results.push({
            id: notification.id,
            success: false,
            error: errorText,
            next_retry: newStatus === 'pending' ? nextRetry : null,
          });
        }

      } catch (error) {
        console.error(`Failed to process notification ${notification.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Mark as failed if max attempts reached
        const newStatus = notification.attempts + 1 >= 3 ? 'failed' : 'pending';

        await supabase
          .from('notification_queue')
          .update({
            status: newStatus,
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        results.push({
          id: notification.id,
          success: false,
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Queue processing error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
