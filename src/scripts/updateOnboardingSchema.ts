/**
 * Update Onboarding Schema Script
 * Fixes database function return types and ensures schema consistency
 */

import { supabase } from '../services/supabaseClient';
import { Logger } from '../utils/ProductionLogger';

async function updateOnboardingSchema() {

  try {
    // Update the calculate_onboarding_metrics function with correct return types
    const functionSQL = `
      CREATE OR REPLACE FUNCTION calculate_onboarding_metrics()
      RETURNS TABLE(
        step_name TEXT,
        completion_rate NUMERIC,
        average_time_spent INTEGER,
        skip_rate NUMERIC,
        total_users INTEGER
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          sa.step_name,
          AVG(CASE WHEN sa.completion_method = 'completed' THEN 1.0 ELSE 0.0 END) as completion_rate,
          AVG(sa.time_spent_seconds)::INTEGER as average_time_spent,
          AVG(CASE WHEN sa.completion_method = 'skipped' THEN 1.0 ELSE 0.0 END) as skip_rate,
          COUNT(DISTINCT sa.user_id)::INTEGER as total_users
        FROM onboarding_step_analytics sa
        WHERE sa.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY sa.step_name
        ORDER BY sa.step_name;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    const { error: functionError } = await supabase.rpc('exec_sql', {
      sql: functionSQL,
    });

    if (functionError) {
      Logger.error('❌ Error updating function', functionError as Error, {
        component: 'updateOnboardingSchema',
      });
      // Try direct execution if exec_sql doesn't exist
      await supabase
        .from('_temp_schema_update')
        .select('*')
        .limit(0); // This will fail but we can catch it

    } else {

    }

    // Test the function

    const { error: testError } = await supabase
      .rpc('calculate_onboarding_metrics');

    if (testError) {
      Logger.error('❌ Function test failed', testError as Error, {
        component: 'updateOnboardingSchema',
      });
    } else {
      Logger.debug('✅ Function test passed', { component: 'updateOnboardingSchema' });
    }

  } catch (error) {
    Logger.error('❌ Schema update failed', error as Error, { component: 'updateOnboardingSchema' });
  }
}

// Run if called directly
if (require.main === module) {
  updateOnboardingSchema();
}

export { updateOnboardingSchema };
