import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Cron wrapper for checking notification triggers
 * Calls generate-personalized-notifications with action: check_triggers
 * Scheduled to run hourly
 * 
 * Checks for:
 * - Users at risk of breaking streaks (< 4 hours left)
 * - Expiring playbook challenges (< 2 days left)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Checking notification triggers...');

    // Call the main notification generator with check_triggers action
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-personalized-notifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'check_triggers',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to check notification triggers: ${error}`);
    }

    const result = await response.json();
    console.log('Notification triggers checked:', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification triggers checked successfully',
        result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Notification trigger check error:', error);
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
