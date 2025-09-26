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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    if (fetchError) {
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
    }

    const results = [];

    for (const notification of pendingNotifications) {
      try {
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

          results.push({
            id: notification.id,
            success: true,
          });
        } else {
          const errorText = await response.text();

          // Mark as failed if max attempts reached
          const newStatus = notification.attempts + 1 >= 3 ? 'failed' : 'pending';

          await supabase
            .from('notification_queue')
            .update({
              status: newStatus,
              error_message: errorText,
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);

          results.push({
            id: notification.id,
            success: false,
            error: errorText,
          });
        }

      } catch (error) {
        console.error(`Failed to process notification ${notification.id}:`, error);

        // Mark as failed if max attempts reached
        const newStatus = notification.attempts + 1 >= 3 ? 'failed' : 'pending';

        await supabase
          .from('notification_queue')
          .update({
            status: newStatus,
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        results.push({
          id: notification.id,
          success: false,
          error: error.message,
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
