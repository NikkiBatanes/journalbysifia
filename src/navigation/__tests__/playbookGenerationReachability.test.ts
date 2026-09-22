import fs from 'fs';
import path from 'path';

const srcRoot = path.resolve(__dirname, '../..');
const read = (relative: string) => fs.readFileSync(path.join(srcRoot, relative), 'utf8');
const productionSources = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const target = path.join(directory, entry.name);
  if (entry.isDirectory()) {
    return entry.name === '__tests__' ? [] : productionSources(target);
  }
  return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
});
const expectNoGenerationNavigation = (source: string) => {
  expect(source).not.toMatch(/navigate\([^\n]*['"](?:UserInput|GeneratingPlaybook|OnboardingPlaybookGeneration)['"]/);
  expect(source).not.toMatch(/replace\([^\n]*['"](?:UserInput|GeneratingPlaybook|OnboardingPlaybookGeneration)['"]/);
  expect(source).not.toMatch(/routes:\s*\[\{\s*name:\s*['"](?:UserInput|GeneratingPlaybook|OnboardingPlaybookGeneration)['"]/);
};

describe('Journal has no reachable Playbook generation entry point', () => {
  test.each([
    'navigation/BottomTabNavigator.tsx',
    'navigation/JournalStackNavigator.tsx',
    'screens/TodayScreen.tsx',
    'screens/MomentsScreen.tsx',
    'screens/PrayerListScreen.tsx',
  ])('%s does not navigate to generation', file => expectNoGenerationNavigation(read(file)));

  it('onboarding completion enters MainTabs and never invokes its retained legacy generation callback', () => {
    const files = [
      'screens/onboarding/OnboardingSplashScreen.tsx',
      'screens/onboarding/OnboardingWelcomeScreen.tsx',
      'screens/onboarding/OnboardingAccountCreationScreen.tsx',
      'screens/onboarding/OnboardingPersonalizationScreen.tsx',
      'screens/onboarding/OnboardingNotificationSetupScreen.tsx',
    ];
    files.forEach(file => expectNoGenerationNavigation(read(file)));
    const personalization = read('screens/onboarding/OnboardingPersonalizationScreen.tsx');
    expect(personalization).not.toContain('handleGenerationFlow');
    expect(personalization).not.toContain('unifiedGenerationService');
    expect(personalization).not.toContain('generationSteps');
    expect(personalization).not.toContain('queueId');
    expect(personalization).toContain("routes: [{ name: 'MainTabs' }]");
  });

  it('visible Playbook readers offer neither new generation nor refinement', () => {
    const walkthrough = read('screens/PlaybookWalkthroughScreen.tsx');
    expectNoGenerationNavigation(walkthrough);
    expect(walkthrough).not.toContain('onOpenRefinement');
    expect(walkthrough).not.toContain('playbookRefinementService');
    expect(walkthrough).not.toContain('onEditUserInput');
    expect(fs.existsSync(path.join(srcRoot, 'components/dashboard/PlaybookCarousel.tsx'))).toBe(false);
  });

  it('retains existing-ID historical Playbook deep links but retires creation intent', () => {
    const deepLinks = read('services/notificationDeepLinkService.ts');
    expect(deepLinks).toContain("navigate('PlaybookWalkthrough'");
    expect(deepLinks).toContain('playbook: { id }');
    expectNoGenerationNavigation(deepLinks);
    expect(deepLinks).toContain('Ignored retired UserInput generation deep link');
  });

  it('removes legacy generation routes and screen imports', () => {
    const root = read('navigation/RootStackNavigator.tsx');
    expect(root).not.toContain('name="UserInput"');
    expect(root).not.toContain('name="GeneratingPlaybook"');
    expect(root).not.toContain('name="OnboardingPlaybookGeneration"');
    expect(root).not.toContain('name="OnboardingPlaybookReady"');
    expect(root).toContain('name="PlaybookWalkthrough"');
  });

  it('sanitizes legacy authentication redirects to MainTabs', () => {
    const redirects = read('utils/postAuthRedirect.ts');
    expect(redirects).toContain("target: 'MainTabs'");
    expect(redirects).not.toContain("target: 'UserInput'");
  });

  it('preserves the Phase 1 compatibility layer without generation imports', () => {
    const compatibility = read('compatibility/sifiaReadCompatibility.ts');
    ['unifiedGenerationService', 'enhancedGenerationService', 'queueService', 'enhancedQueueService', 'playbookRefinementService'].forEach(name => expect(compatibility).not.toContain(name));
  });

  it('removes the closed local generation and refinement infrastructure graph', () => {
    const retired = [
      'services/unifiedGenerationService.ts',
      'services/enhancedGenerationService.ts',
      'services/queueService.ts',
      'services/enhancedQueueService.ts',
      'services/playbookRefinementService.ts',
    ];
    retired.forEach(file => expect(fs.existsSync(path.join(srcRoot, file))).toBe(false));

    const production = productionSources(srcRoot).map(file => fs.readFileSync(file, 'utf8')).join('\n');
    retired.forEach(file => expect(production).not.toContain(path.basename(file, '.ts')));
    expect(production).not.toContain('generate-guided-playbook');
    expect(production).not.toContain('refine-guided-playbook');
    expect(production).not.toContain("from('generation_queue')");
  });
});
