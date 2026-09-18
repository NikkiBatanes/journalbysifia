import fs from 'fs';
import path from 'path';

const srcRoot = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(srcRoot, relative), 'utf8');

describe('paid-upfront Journal presentation boundary', () => {
  it('removes the old subscription and trial screens, routes, and pricing UI', () => {
    [
      'screens/onboarding/OnboardingSalesOfferScreen.tsx',
      'screens/onboarding/OnboardingTrialOfferScreen.tsx',
      'components/SubscriptionPlanModal.tsx',
      'components/DynamicPricingModal.tsx',
      'components/PurchaseSuccessModal.tsx',
      'services/pricingService.ts',
    ].forEach(file => expect(fs.existsSync(path.join(srcRoot, file))).toBe(false));

    const root = read('navigation/RootStackNavigator.tsx');
    const types = read('navigation/types.ts');
    expect(root).not.toContain('OnboardingSalesOffer');
    expect(root).not.toContain('OnboardingTrialOffer');
    expect(types).not.toContain('OnboardingSalesOffer');
    expect(types).not.toContain('OnboardingTrialOffer');
  });

  it('keeps onboarding connected to preferences and MainTabs without a paywall', () => {
    const walkthrough = read('screens/PlaybookWalkthroughScreen.tsx');
    const streak = read('screens/StreakPlanScreen.tsx');
    const preferences = read('screens/onboarding/OnboardingNotificationSetupScreen.tsx');
    const personalization = read('screens/onboarding/OnboardingPersonalizationScreen.tsx');

    expect(walkthrough).toContain("navigate('OnboardingNotificationSetup'");
    expect(walkthrough).toContain("replace('OnboardingNotificationSetup'");
    expect(streak).toContain("navigate('OnboardingNotificationSetup'");
    expect(preferences).toContain("name: 'MainTabs'");
    expect(personalization).toContain("routes: [{ name: 'MainTabs' }]");
    expect(preferences).not.toContain('Trial Reminders');
    expect(preferences).not.toContain('trial_notifications:');
  });

  it('removes Journal plan, billing, restore, and upgrade presentation from Profile', () => {
    const profile = read('screens/UserProfileScreen.tsx');
    [
      'SubscriptionPlanModal',
      'renderSubscriptionSection',
      'Restore Purchases',
      'Sync Purchases',
      'Trial Notifications',
      'Spark Plan',
      'Growth Plan',
      'Transformation Plan',
      'Free Trial Plan',
    ].forEach(copy => expect(profile).not.toContain(copy));
  });

  it('has no production navigation to the retired offer routes', () => {
    const productionFiles: string[] = [];
    const collect = (directory: string) => {
      fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') collect(target);
        } else if (/\.tsx?$/.test(entry.name)) {
          productionFiles.push(target);
        }
      });
    };
    collect(srcRoot);
    const production = productionFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
    expect(production).not.toMatch(/(?:navigate|replace)\([^\n]*['"]OnboardingSalesOffer['"]/);
    expect(production).not.toMatch(/(?:navigate|replace)\([^\n]*['"]OnboardingTrialOffer['"]/);
  });

  it('quarantines low-level store services and removes obsolete payment facades', () => {
    [
      'services/AppleStoreKitService.ts',
      'services/GooglePlayBillingService.ts',
    ].forEach(file => expect(fs.existsSync(path.join(srcRoot, file))).toBe(true));
    [
      'services/PlatformPaymentService.ts',
      'services/platformSubscriptionService.ts',
      'hooks/usePlatformSubscription.ts',
    ].forEach(file => expect(fs.existsSync(path.join(srcRoot, file))).toBe(false));
    expect(read('services/AppleStoreKitService.ts')).toContain('PRODUCT_IDS');
    expect(read('services/GooglePlayBillingService.ts')).toContain('PRODUCT_IDS');
  });

  it('makes share-card watermark choice a core feature with no tier upsell', () => {
    const composer = read('components/TruthToCarryShareComposer.tsx');
    expect(composer).not.toContain('NewSubscriptionService');
    expect(composer).not.toContain('Available with Growth');
    expect(composer).not.toContain('Get Growth');
    expect(composer).toContain('onPress={toggleWatermark}');
  });
});
