import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const srcRoot = path.join(root, 'src');
const readRoot = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const readSrc = (relative: string) => fs.readFileSync(path.join(srcRoot, relative), 'utf8');

const collectProductionSource = (directory: string): string => fs
  .readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : [collectProductionSource(target)];
    }
    return /\.(?:ts|tsx)$/.test(entry.name) ? [fs.readFileSync(target, 'utf8')] : [];
  })
  .join('\n');

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

  it('updates shared profiles by column without replacing opaque siFia metadata', () => {
    const userApi = readSrc('services/userApi.ts');
    const onboarding = readSrc('services/onboardingService.ts');

    expect(userApi).toContain(".from('user_profiles')");
    expect(userApi).toContain('.update(profileUpdates)');
    expect(userApi).toContain('.update({\n          preferences,');
    expect(onboarding).toContain(".from('user_profiles')");
    expect(onboarding).toContain('onboarding_completed: true');
    expect(userApi).not.toMatch(/\.from\(['"]user_profiles['"]\)\s*\.delete\(/);
    expect(onboarding).not.toMatch(/\.from\(['"]user_profiles['"]\)\s*\.delete\(/);
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

  it('removes the complete local subscription and store service graph', () => {
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
      'services/NewSubscriptionService.ts',
      'services/AppleStoreKitService.ts',
      'services/GooglePlayBillingService.ts',
      'utils/paymentFailureLogger.ts',
    ];
    deleted.forEach(file => expect(fs.existsSync(path.join(srcRoot, file))).toBe(false));
  });

  it('has zero production references to the deleted service graph', () => {
    const production = collectProductionSource(srcRoot);
    [
      'AppleStoreKitService',
      'GooglePlayBillingService',
      'NewSubscriptionService',
      'paymentFailureLogger',
      'PaymentFailureLogger',
    ].forEach(symbol => expect(production).not.toContain(symbol));
  });
});
