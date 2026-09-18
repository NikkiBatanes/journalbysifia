import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const srcRoot = path.join(root, 'src');
const readRoot = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const readSrc = (relative: string) => fs.readFileSync(path.join(srcRoot, relative), 'utf8');

describe('Journal subscription runtime boundary', () => {
  it('does not initialize or synchronize legacy subscriptions during startup', () => {
    const app = readRoot('App.tsx');
    expect(app).not.toContain('PlatformPaymentService');
    expect(app).not.toContain('AppleStoreKitService');
    expect(app).not.toContain('checkAndSyncSubscriptionStatus');
    expect(app).not.toContain('preloadProducts');
  });

  it('creates shared profiles without creating or repairing siFia subscriptions', () => {
    const auth = readSrc('context/IndustryStandardAuthContext.tsx');
    expect(auth).not.toContain("from('user_subscriptions_new')");
    expect(auth).not.toContain("rpc('create_default_seeker_subscription'");
    expect(auth).not.toContain('smart_journaling_enabled');
    expect(auth).not.toContain('subscription_display_name');
  });

  it('completes onboarding without resetting legacy subscription counters', () => {
    const onboarding = readSrc('services/onboardingService.ts');
    expect(onboarding).not.toContain('NewSubscriptionService');
    expect(onboarding).not.toContain('resetOnboardingAssistCounters');
    expect(onboarding).toContain('onboarding_completed: true');
  });

  it('keeps calendar, Guided prompts, and smart notifications independent of subscriptions', () => {
    const calendar = readSrc('hooks/useCalendarGating.ts');
    const guided = readSrc('hooks/useGuidedPromptGating.ts');
    const notifications = readSrc('services/notifications/notificationCandidateResolver.ts');
    [calendar, guided, notifications].forEach(source => {
      expect(source).not.toContain('NewSubscriptionService');
      expect(source).not.toContain('useSubscription');
    });
    expect(notifications).not.toContain('is_free_user');
  });

  it('removes closed local subscription graphs while retaining store quarantine', () => {
    const deleted = [
      'hooks/useSubscription.ts',
      'hooks/useNewSubscription.ts',
      'hooks/useUserState.ts',
      'hooks/usePlanningGating.ts',
      'hooks/useSmartJournalingGating.ts',
      'hooks/useFeatureAccess.ts',
      'services/tierRestrictionService.ts',
      'services/subscriptionService.ts',
      'services/intelligenceService.ts',
      'services/DiscountCodeService.ts',
      'services/retentionService.ts',
      'services/AppleWebhookHandler.ts',
      'services/TrialManagementService.ts',
      'services/billingNotificationService.ts',
      'utils/subscriptionSync.ts',
    ];
    deleted.forEach(file => expect(fs.existsSync(path.join(srcRoot, file))).toBe(false));
    expect(fs.existsSync(path.join(srcRoot, 'services/NewSubscriptionService.ts'))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, 'services/AppleStoreKitService.ts'))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, 'services/GooglePlayBillingService.ts'))).toBe(true);
  });
});
