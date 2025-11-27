import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface DeleteAccountRequest {
  userId: string
  birthYear: string
  confirmationToken?: string
}

interface DeleteAccountResponse {
  success: boolean
  message: string
  deletionId?: string
  gracePeriodEnds?: string
}

const GRACE_PERIOD_DAYS = 30

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: DeleteAccountRequest = await req.json()
    const { userId, birthYear, confirmationToken } = body

    // Validate required fields
    if (!userId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          details: { userId: !!userId, birthYear: !!birthYear }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate birth year (optional now)
    let birthYearNum: number;
    if (birthYear && birthYear.trim() !== '') {
      birthYearNum = parseInt(birthYear, 10);
      const currentYear = new Date().getFullYear();
      const MIN_AGE = 13;
      const MAX_AGE = 120;
      
      if (isNaN(birthYearNum) || birthYearNum < currentYear - MAX_AGE || birthYearNum > currentYear - MIN_AGE) {
        return new Response(
          JSON.stringify({ error: 'Invalid birth year format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Use a default birth year when not provided
      birthYearNum = 1990; // Default year for simplicity
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user exists and get their data
    const { data: userResponse, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
    
    if (userError || !userResponse?.user) {
      return new Response(
        JSON.stringify({ error: 'User not found or invalid' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const user = userResponse.user

    // Check if there's already a pending deletion
    const { data: existingDeletion } = await supabaseAdmin
      .from('account_deletions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single()

    if (existingDeletion) {
      const gracePeriodEnds = new Date(existingDeletion.grace_period_ends)
      const remainingDays = Math.ceil((gracePeriodEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Account deletion already in progress',
          gracePeriodEnds: existingDeletion.grace_period_ends,
          remainingDays
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate deletion tracking ID
    const deletionId = crypto.randomUUID()
    const gracePeriodEnds = new Date()
    gracePeriodEnds.setDate(gracePeriodEnds.getDate() + GRACE_PERIOD_DAYS)

    // Create deletion record with grace period
    const { error: deletionError } = await supabaseAdmin
      .from('account_deletions')
      .insert({
        id: deletionId,
        user_id: userId,
        birth_year: birthYearNum,
        status: 'pending',
        grace_period_ends: gracePeriodEnds.toISOString(),
        requested_at: new Date().toISOString(),
        confirmation_token: confirmationToken || null,
        user_email: user.email || null,
        user_metadata: user.user_metadata || {}
      })

    if (deletionError) {
      console.error('Error creating deletion record:', deletionError)
      return new Response(
        JSON.stringify({ error: 'Failed to initiate deletion process' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log the deletion request for audit purposes
    console.log(`Account deletion requested: ${deletionId} for user ${userId}`)

    // Schedule the actual deletion (in a real implementation, you'd use a cron job)
    // For now, we'll return the deletion ID and grace period info
    
    const response: DeleteAccountResponse = {
      success: true,
      message: `Account deletion initiated. Your account will be permanently deleted after ${GRACE_PERIOD_DAYS} days grace period. You can cancel anytime by contacting support.`,
      deletionId,
      gracePeriodEnds: gracePeriodEnds.toISOString()
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Delete account function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
