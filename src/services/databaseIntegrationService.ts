/**
 * Database Integration Service
 * Handles schema deployment, validation, and database health checks
 * Phase 3: Database Deployment Integration
 */

import { supabase } from './supabaseClient';

export interface SchemaValidationResult {
  isValid: boolean;
  missingTables: string[];
  missingFunctions: string[];
  missingEnums: string[];
  errors: string[];
}

export interface DatabaseHealthCheck {
  isHealthy: boolean;
  tablesCount: number;
  functionsCount: number;
  enumsCount: number;
  lastMigration?: string;
  errors: string[];
}

class DatabaseIntegrationService {
  private supabase = supabase;

  /**
   * Validate onboarding schema deployment
   */
  async validateOnboardingSchema(): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      missingTables: [],
      missingFunctions: [],
      missingEnums: [],
      errors: [],
    };

    try {
      // Check required tables
      const requiredTables = [
        'onboarding_progress',
        'faith_journey_profiles',
        'onboarding_personalization_profiles',
        'onboarding_step_analytics',
        'christ_acceptance_events',
        'onboarding_content_effectiveness',
      ];

      for (const table of requiredTables) {
        const { data, error } = await this.supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_name', table)
          .eq('table_schema', 'public');

        if (error || !data || data.length === 0) {
          result.missingTables.push(table);
          result.isValid = false;
        }
      }

      // Check required functions
      const requiredFunctions = [
        'initialize_onboarding',
        'update_onboarding_progress',
        'record_christ_acceptance',
        'calculate_onboarding_metrics',
      ];

      for (const func of requiredFunctions) {
        const { data, error } = await this.supabase
          .rpc('check_function_exists', { function_name: func })
          .single();

        if (error || !data) {
          result.missingFunctions.push(func);
          result.isValid = false;
        }
      }

      // Check required enums
      const requiredEnums = [
        'onboarding_step_status',
        'spiritual_maturity_level',
        'acceptance_context',
        'personality_type',
      ];

      for (const enumType of requiredEnums) {
        const { data, error } = await this.supabase
          .from('information_schema.types')
          .select('typname')
          .eq('typname', enumType);

        if (error || !data || data.length === 0) {
          result.missingEnums.push(enumType);
          result.isValid = false;
        }
      }

    } catch (error) {
      result.errors.push(`Schema validation error: ${error}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Perform database health check
   */
  async performHealthCheck(): Promise<DatabaseHealthCheck> {
    const healthCheck: DatabaseHealthCheck = {
      isHealthy: true,
      tablesCount: 0,
      functionsCount: 0,
      enumsCount: 0,
      errors: [],
    };

    try {
      // Count tables
      const { data: tables, error: tablesError } = await this.supabase
        .from('information_schema.tables')
        .select('table_name', { count: 'exact' })
        .eq('table_schema', 'public');

      if (tablesError) {
        healthCheck.errors.push(`Tables check failed: ${tablesError.message}`);
        healthCheck.isHealthy = false;
      } else {
        healthCheck.tablesCount = tables?.length || 0;
      }

      // Count functions
      const { data: functions, error: functionsError } = await this.supabase
        .from('information_schema.routines')
        .select('routine_name', { count: 'exact' })
        .eq('routine_schema', 'public');

      if (functionsError) {
        healthCheck.errors.push(`Functions check failed: ${functionsError.message}`);
        healthCheck.isHealthy = false;
      } else {
        healthCheck.functionsCount = functions?.length || 0;
      }

      // Count enums
      const { data: enums, error: enumsError } = await this.supabase
        .from('information_schema.types')
        .select('typname', { count: 'exact' })
        .eq('typtype', 'e');

      if (enumsError) {
        healthCheck.errors.push(`Enums check failed: ${enumsError.message}`);
        healthCheck.isHealthy = false;
      } else {
        healthCheck.enumsCount = enums?.length || 0;
      }

    } catch (error) {
      healthCheck.errors.push(`Health check error: ${error}`);
      healthCheck.isHealthy = false;
    }

    return healthCheck;
  }

  /**
   * Test onboarding functions
   */
  async testOnboardingFunctions(userId: string): Promise<boolean> {
    try {
      // Test initialize_onboarding function
      const { error: initError } = await this.supabase
        .rpc('initialize_onboarding', { p_user_id: userId });

      if (initError) {
        console.error('Initialize onboarding test failed:', initError);
        return false;
      }

      // Test update_onboarding_progress function
      const { error: updateError } = await this.supabase
        .rpc('update_onboarding_progress', {
          p_user_id: userId,
          p_step_name: 'test_step',
          p_step_number: 1,
          p_status: 'completed',
          p_time_spent: 30,
        });

      if (updateError) {
        console.error('Update progress test failed:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Function test error:', error);
      return false;
    }
  }

  /**
   * Get database migration status
   */
  async getMigrationStatus(): Promise<{ applied: boolean; error?: string }> {
    try {
      const validation = await this.validateOnboardingSchema();
      return {
        applied: validation.isValid,
        error: validation.errors.length > 0 ? validation.errors.join(', ') : undefined,
      };
    } catch (error) {
      return {
        applied: false,
        error: `Migration status check failed: ${error}`,
      };
    }
  }
}

export const databaseIntegrationService = new DatabaseIntegrationService();
