import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface DeletionRecord {
  id: string
  user_id: string
  status: string
  grace_period_ends: string
}

serve(async (_req) => {
  // This function should be called by a cron job daily
  // It processes all accounts whose grace period has ended

  try {
    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting account deletion processing...')

    // Get all pending deletions whose grace period has ended
    const { data: pendingDeletions, error: fetchError } = await supabaseAdmin
      .from('account_deletions')
      .select('*')
      .eq('status', 'pending')
      .lte('grace_period_ends', new Date().toISOString())

    if (fetchError) {
      console.error('Error fetching pending deletions:', fetchError)
      throw fetchError
    }

    if (!pendingDeletions || pendingDeletions.length === 0) {
      console.log('No pending deletions to process')
      return new Response(
        JSON.stringify({ message: 'No pending deletions to process' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${pendingDeletions.length} accounts to delete`)

    const results = []

    for (const deletion of pendingDeletions) {
      try {
        console.log(`Processing deletion request: ${deletion.id}`)
        
        // Start transaction-like deletion process
        const userId = deletion.user_id
        
        // 1. Get all playbook IDs first (for cascade deletions)
        const { data: userPlaybooks } = await supabaseAdmin
          .from('playbooks')
          .select('id')
          .eq('user_id', userId)

        if (userPlaybooks && userPlaybooks.length > 0) {
          const playbookIds = userPlaybooks.map(p => p.id)
          
          // 2. Delete playbook-related data
          await supabaseAdmin.from('playbook_action_steps').delete().in('playbook_id', playbookIds)
          await supabaseAdmin.from('playbook_affirmations').delete().in('playbook_id', playbookIds)
        }

        // 3. Delete user data from all tables in order
        const deletionPromises = [
          supabaseAdmin.from('playbooks').delete().eq('user_id', userId),
          supabaseAdmin.from('devotionals').delete().eq('user_id', userId),
          supabaseAdmin.from('journal_entries').delete().eq('user_id', userId),
          supabaseAdmin.from('prayers').delete().eq('user_id', userId),
          supabaseAdmin.from('reflections').delete().eq('user_id', userId),
          supabaseAdmin.from('time_blocks').delete().eq('user_id', userId),
          supabaseAdmin.from('notification_preferences').delete().eq('user_id', userId),
          supabaseAdmin.from('faith_points_profiles').delete().eq('user_id', userId),
          supabaseAdmin.from('faith_points_log').delete().eq('user_id', userId),
          supabaseAdmin.from('user_streaks').delete().eq('user_id', userId),
          supabaseAdmin.from('subscriptions').delete().eq('user_id', userId),
          supabaseAdmin.from('user_profiles').delete().eq('id', userId),
        ]

        await Promise.all(deletionPromises)

        // 4. Delete the auth user
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        
        if (deleteAuthError) {
          console.error(`Failed to delete auth user ${userId}:`, deleteAuthError)
          // Continue with marking as deleted even if auth deletion fails
        }

        // 5. Update deletion record
        await supabaseAdmin
          .from('account_deletions')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString(),
            deletion_notes: deleteAuthError ? 'Data deleted, auth user deletion failed' : 'Successfully deleted'
          })
          .eq('id', deletion.id)

        console.log(`Successfully processed account deletion: ${deletion.id}`)
        results.push({ userId, status: 'success', error: null })

      } catch (error) {
        console.error(`Failed to delete account ${deletion.user_id}:`, error)
        
        // Mark as failed
        await supabaseAdmin
          .from('account_deletions')
          .update({ 
            status: 'failed',
            completed_at: new Date().toISOString(),
            deletion_notes: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', deletion.id)

        results.push({ 
          userId: deletion.user_id, 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`Account deletion processing completed. Results:`, results)

    return new Response(
      JSON.stringify({
        message: 'Account deletion processing completed',
        processed: results.length,
        results
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Account deletion processing error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'Failed to process account deletions'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
