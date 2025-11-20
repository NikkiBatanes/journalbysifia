import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Automatic APNs JWT Token Refresh
 * Runs every 50 minutes to keep token fresh
 * Apple recommends tokens be < 60 minutes old
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting APNs JWT token refresh...');

    // Get required environment variables
    const apnsKeyId = Deno.env.get('APNS_KEY_ID');
    const apnsTeamId = Deno.env.get('APNS_TEAM_ID');
    const apnsAuthKey = Deno.env.get('APNS_AUTH_KEY');

    if (!apnsKeyId || !apnsTeamId || !apnsAuthKey) {
      throw new Error('Missing required APNs configuration');
    }

    // Import JWT library
    const jose = await import('https://deno.land/x/jose@v4.14.4/index.ts');

    // Parse the P8 key
    const privateKey = await jose.importPKCS8(apnsAuthKey, 'ES256');

    // Generate new JWT token
    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({
        alg: 'ES256',
        kid: apnsKeyId,
        typ: 'JWT',
      })
      .setIssuer(apnsTeamId)
      .setIssuedAt()
      .sign(privateKey);

    console.log('New JWT token generated successfully');

    // Update Supabase secret
    const supabaseProjectRef = Deno.env.get('SUPABASE_PROJECT_REF') || 'aesmrjinczhknchlrsmt';
    const supabaseAccessToken = Deno.env.get('MGMT_ACCESS_TOKEN');

    if (supabaseAccessToken) {
      // Update via Supabase Management API
      const updateResponse = await fetch(
        `https://api.supabase.com/v1/projects/${supabaseProjectRef}/secrets`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              name: 'APNS_JWT_TOKEN',
              value: jwt,
            },
          ]),
        }
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('Failed to update Supabase secret:', errorText);
        throw new Error(`Failed to update secret: ${errorText}`);
      }

      console.log('Supabase secret updated successfully');
    } else {
      console.warn('MGMT_ACCESS_TOKEN not set - token generated but not auto-deployed');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'APNs JWT token refreshed successfully',
        token_preview: jwt.substring(0, 50) + '...',
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('APNs token refresh error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
