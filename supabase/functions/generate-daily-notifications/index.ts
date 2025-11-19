import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Cron wrapper for daily notification generation
 * Calls generate-personalized-notifications with action: daily_batch
 * Scheduled to run daily at 6:00 AM UTC
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting daily notification batch generation...');

    // Call the main notification generator with daily_batch action
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-personalized-notifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'daily_batch',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to generate daily notifications: ${error}`);
    }

    const result = await response.json();
    console.log('Daily notifications generated:', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily notifications generated successfully',
        result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Daily notification generation error:', error);
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
