/**
 * Onboarding Testing Service
 * Comprehensive testing of the complete onboarding flow
 * Phase 3: Testing Implementation
 */

import { onboardingService, OnboardingStepData, ChristAcceptanceData } from './onboardingService';
import { databaseIntegrationService } from './databaseIntegrationService';
import { generateTestUserId } from '../utils/testUtils';

export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

export interface TestSuite {
  suiteName: string;
  results: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalDuration: number;
  overallPassed: boolean;
}

class OnboardingTestingService {
  private testUserId = generateTestUserId();

  /**
   * Run complete onboarding flow test
   */
  async runCompleteFlowTest(): Promise<TestSuite> {
    const suite: TestSuite = {
      suiteName: 'Complete Onboarding Flow',
      results: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      totalDuration: 0,
      overallPassed: false,
    };

    const tests = [
      () => this.testSchemaValidation(),
      () => this.testOnboardingInitialization(),
      () => this.testPersonalProfileStep(),
      () => this.testFaithJourneyStep(),
      () => this.testGoalsStep(),
      () => this.testPreferencesStep(),
      () => this.testTrialSetupStep(),
      () => this.testChristAcceptanceRecording(),
      () => this.testOnboardingCompletion(),
      () => this.testAnalyticsCollection(),
    ];

    for (const test of tests) {
      const result = await test();
      suite.results.push(result);
      suite.totalTests++;
      suite.totalDuration += result.duration;

      if (result.passed) {
        suite.passedTests++;
      } else {
        suite.failedTests++;
      }
    }

    suite.overallPassed = suite.failedTests === 0;
    return suite;
  }

  /**
   * Test schema validation
   */
  private async testSchemaValidation(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const validation = await databaseIntegrationService.validateOnboardingSchema();
      const duration = Date.now() - startTime;

      return {
        testName: 'Schema Validation',
        passed: validation.isValid,
        duration,
        error: validation.errors.length > 0 ? validation.errors.join(', ') : undefined,
        details: {
          missingTables: validation.missingTables,
          missingFunctions: validation.missingFunctions,
          missingEnums: validation.missingEnums,
        },
      };
    } catch (error) {
      return {
        testName: 'Schema Validation',
        passed: false,
        duration: Date.now() - startTime,
        error: `Schema validation failed: ${error}`,
      };
    }
  }

  /**
   * Test onboarding initialization
   */
  private async testOnboardingInitialization(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const sessionId = await onboardingService.initializeOnboarding(this.testUserId);
      const progress = await onboardingService.getOnboardingProgress(this.testUserId);

      const passed = !!(sessionId && progress && progress.current_step === 1);

      return {
        testName: 'Onboarding Initialization',
        passed,
        duration: Date.now() - startTime,
        details: { sessionId, progress },
      };
    } catch (error) {
      return {
        testName: 'Onboarding Initialization',
        passed: false,
        duration: Date.now() - startTime,
        error: `Initialization failed: ${error}`,
      };
    }
  }

  /**
   * Test personal profile step
   */
  private async testPersonalProfileStep(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const stepData: OnboardingStepData = {
        step_name: 'personal_profile',
        step_number: 1,
        data: {
          first_name: 'Test',
          last_name: 'User',
          age_range: '25-34',
          location: 'Test City',
          occupation: 'Tester',
        },
        time_spent_seconds: 120,
        interactions_count: 5,
        completion_method: 'completed',
      };

      await onboardingService.updateStepProgress(this.testUserId, stepData);
      const progress = await onboardingService.getOnboardingProgress(this.testUserId);

      const passed = progress?.current_step === 2;

      return {
        testName: 'Personal Profile Step',
        passed,
        duration: Date.now() - startTime,
        details: { stepData, progress },
      };
    } catch (error) {
      return {
        testName: 'Personal Profile Step',
        passed: false,
        duration: Date.now() - startTime,
        error: `Personal profile step failed: ${error}`,
      };
    }
  }

  /**
   * Test faith journey step
   */
  private async testFaithJourneyStep(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const faithData = {
        spiritual_maturity: 'growing' as const,
        church_attendance: 'weekly' as const,
        bible_reading_frequency: 'daily' as const,
        prayer_frequency: 'daily' as const,
        has_accepted_christ: true,
        acceptance_context: 'adult' as const,
        baptism_status: 'yes' as const,
      };

      await onboardingService.updateFaithJourneyProfile(this.testUserId, faithData);

      const stepData: OnboardingStepData = {
        step_name: 'faith_journey',
        step_number: 2,
        data: faithData,
        time_spent_seconds: 180,
        interactions_count: 8,
        completion_method: 'completed',
      };

      await onboardingService.updateStepProgress(this.testUserId, stepData);
      const faithProfile = await onboardingService.getFaithJourneyProfile(this.testUserId);

      const passed = !!(faithProfile && faithProfile.has_accepted_christ);

      return {
        testName: 'Faith Journey Step',
        passed,
        duration: Date.now() - startTime,
        details: { faithData, faithProfile },
      };
    } catch (error) {
      return {
        testName: 'Faith Journey Step',
        passed: false,
        duration: Date.now() - startTime,
        error: `Faith journey step failed: ${error}`,
      };
    }
  }

  /**
   * Test goals step
   */
  private async testGoalsStep(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const stepData: OnboardingStepData = {
        step_name: 'goals',
        step_number: 3,
        data: {
          selected_goals: ['daily_devotions', 'bible_study', 'prayer_life'],
          priority_goals: ['daily_devotions'],
          custom_goals: ['Grow in patience'],
        },
        time_spent_seconds: 90,
        interactions_count: 6,
        completion_method: 'completed',
      };

      await onboardingService.updateStepProgress(this.testUserId, stepData);
      const progress = await onboardingService.getOnboardingProgress(this.testUserId);

      const passed = progress?.current_step === 4;

      return {
        testName: 'Goals Step',
        passed,
        duration: Date.now() - startTime,
        details: { stepData, progress },
      };
    } catch (error) {
      return {
        testName: 'Goals Step',
        passed: false,
        duration: Date.now() - startTime,
        error: `Goals step failed: ${error}`,
      };
    }
  }

  /**
   * Test preferences step
   */
  private async testPreferencesStep(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const preferencesData = {
        personality_type: 'contemplative' as const,
        learning_style: 'visual' as const,
        preferred_content_length: 'medium' as const,
        preferred_topics: ['prayer', 'bible_study', 'faith_growth'],
        daily_commitment_minutes: 15,
        prefers_gentle_encouragement: true,
        likes_community_features: true,
      };

      await onboardingService.updatePersonalizationProfile(this.testUserId, preferencesData);

      const stepData: OnboardingStepData = {
        step_name: 'preferences',
        step_number: 4,
        data: preferencesData,
        time_spent_seconds: 150,
        interactions_count: 10,
        completion_method: 'completed',
      };

      await onboardingService.updateStepProgress(this.testUserId, stepData);
      const personalizationProfile = await onboardingService.getPersonalizationProfile(this.testUserId);

      const passed = !!(personalizationProfile && personalizationProfile.personality_type === 'contemplative');

      return {
        testName: 'Preferences Step',
        passed,
        duration: Date.now() - startTime,
        details: { preferencesData, personalizationProfile },
      };
    } catch (error) {
      return {
        testName: 'Preferences Step',
        passed: false,
        duration: Date.now() - startTime,
        error: `Preferences step failed: ${error}`,
      };
    }
  }

  /**
   * Test trial setup step
   */
  private async testTrialSetupStep(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const stepData: OnboardingStepData = {
        step_name: 'trial_setup',
        step_number: 5,
        data: {
          trial_started: true,
          selected_features: ['smart_journaling', 'personalized_content', 'progress_tracking'],
          notification_preferences: {
            daily_reminders: true,
            weekly_insights: true,
            milestone_celebrations: true,
          },
        },
        time_spent_seconds: 60,
        interactions_count: 4,
        completion_method: 'completed',
      };

      await onboardingService.updateStepProgress(this.testUserId, stepData);
      const progress = await onboardingService.getOnboardingProgress(this.testUserId);

      const passed = progress?.current_step === 6;

      return {
        testName: 'Trial Setup Step',
        passed,
        duration: Date.now() - startTime,
        details: { stepData, progress },
      };
    } catch (error) {
      return {
        testName: 'Trial Setup Step',
        passed: false,
        duration: Date.now() - startTime,
        error: `Trial setup step failed: ${error}`,
      };
    }
  }

  /**
   * Test Christ acceptance recording
   */
  private async testChristAcceptanceRecording(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const acceptanceData: ChristAcceptanceData = {
        acceptance_context: 'adult',
        influenced_by: 'Onboarding process',
        prayer_text: 'Lord Jesus, I accept you as my personal savior.',
        baptism_interest: true,
        church_connection_interest: true,
        discipleship_interest: true,
      };

      const eventId = await onboardingService.recordChristAcceptance(this.testUserId, acceptanceData);
      const passed = !!eventId;

      return {
        testName: 'Christ Acceptance Recording',
        passed,
        duration: Date.now() - startTime,
        details: { acceptanceData, eventId },
      };
    } catch (error) {
      return {
        testName: 'Christ Acceptance Recording',
        passed: false,
        duration: Date.now() - startTime,
        error: `Christ acceptance recording failed: ${error}`,
      };
    }
  }

  /**
   * Test onboarding completion
   */
  private async testOnboardingCompletion(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      await onboardingService.completeOnboarding(this.testUserId);
      const hasCompleted = await onboardingService.hasCompletedOnboarding(this.testUserId);
      const progress = await onboardingService.getOnboardingProgress(this.testUserId);

      const passed = hasCompleted && (progress?.is_completed ?? false);

      return {
        testName: 'Onboarding Completion',
        passed,
        duration: Date.now() - startTime,
        details: { hasCompleted, progress },
      };
    } catch (error) {
      return {
        testName: 'Onboarding Completion',
        passed: false,
        duration: Date.now() - startTime,
        error: `Onboarding completion failed: ${error}`,
      };
    }
  }

  /**
   * Test analytics collection
   */
  private async testAnalyticsCollection(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const metrics = await onboardingService.getOnboardingMetrics();
      const passed = Array.isArray(metrics) && metrics.length >= 0;

      return {
        testName: 'Analytics Collection',
        passed,
        duration: Date.now() - startTime,
        details: { metricsCount: metrics.length, metrics },
      };
    } catch (error) {
      return {
        testName: 'Analytics Collection',
        passed: false,
        duration: Date.now() - startTime,
        error: `Analytics collection failed: ${error}`,
      };
    }
  }

  /**
   * Generate test report
   */
  generateTestReport(suite: TestSuite): string {
    const report = [
      `=== ${suite.suiteName} Test Report ===`,
      `Total Tests: ${suite.totalTests}`,
      `Passed: ${suite.passedTests}`,
      `Failed: ${suite.failedTests}`,
      `Success Rate: ${((suite.passedTests / suite.totalTests) * 100).toFixed(1)}%`,
      `Total Duration: ${suite.totalDuration}ms`,
      `Overall Result: ${suite.overallPassed ? 'PASSED' : 'FAILED'}`,
      '',
      '=== Individual Test Results ===',
      ...suite.results.map(result =>
        `${result.passed ? '✅' : '❌'} ${result.testName} (${result.duration}ms)${
          result.error ? ` - Error: ${result.error}` : ''
        }`
      ),
    ];

    return report.join('\n');
  }
}

export const onboardingTestingService = new OnboardingTestingService();
