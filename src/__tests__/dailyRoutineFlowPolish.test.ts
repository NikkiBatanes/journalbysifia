import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('daily routine flow polish', () => {
  it('opens both routines without a bottom-up modal and uses horizontal gesture transitions inside them', () => {
    const root = read('navigation/RootStackNavigator.tsx');
    const morningRegistration = root.slice(root.indexOf('name="MorningFlow"'), root.indexOf('name="MorningFlow"') + 380);
    const eveningRegistration = root.slice(root.indexOf('name="EveningFlow"'), root.indexOf('name="EveningFlow"') + 380);
    const morningStack = read('navigation/MorningFlowStackNavigator.tsx');
    const eveningStack = read('navigation/EveningFlowStackNavigator.tsx');
    const routineShell = read('components/routine/RoutineStepShell.tsx');

    expect(morningRegistration).toContain("animation: 'fade'");
    expect(eveningRegistration).toContain("animation: 'fade'");
    expect(morningRegistration).not.toContain("animation: 'slide_from_bottom'");
    expect(eveningRegistration).not.toContain("animation: 'slide_from_bottom'");
    for (const stack of [morningStack, eveningStack]) {
      expect(stack).toContain("animation: 'fade_from_bottom'");
      expect(stack).toContain('gestureEnabled: true');
      expect(stack).toContain('fullScreenGestureEnabled: true');
      expect(stack).toContain('animationMatchesGesture: true');
    }
    expect(routineShell).toContain('PanResponder.create');
    expect(routineShell).toContain('onSwipeBack();');
    expect(routineShell).toContain('onSwipeForward();');
    expect(read('screens/evening/EveningGratitudeScreen.tsx')).toContain('swipeForwardEnabled');
    expect(read('screens/morning/MorningTodosScreen.tsx')).toContain('onBackFromStart={() => navigation.goBack()}');
  });

  it('keeps both Scripture reader controls floating above their chapter scroll', () => {
    expect(read('screens/morning/PsalmOfTheDayScreen.tsx')).toContain('stickyRightControls');
    expect(read('screens/evening/EveningProverbsScreen.tsx')).toContain('stickyRightControls');
  });

  it('restores the saved Scripture chapter throughout revisited routines', () => {
    const psalmReader = read('screens/morning/PsalmOfTheDayScreen.tsx');
    const psalmReflection = read('screens/morning/CarryItScreen.tsx');
    const proverbReader = read('screens/evening/EveningProverbsScreen.tsx');
    const proverbReflection = read('screens/evening/EveningFlowScreens.tsx');

    expect(psalmReader).toContain('resolveSavedPsalmNumber(existing, fallbackPsalmNumber)');
    expect(psalmReflection).toContain('resolveSavedPsalmNumber(existing, dailyPsalmNumber)');
    expect(proverbReader).toContain('resolveSavedProverbNumber(existing, fallbackProverbNumber)');
    expect(proverbReflection).toContain('resolveSavedProverbNumber(existing, dailyChapter)');
    expect(read('screens/morning/MorningClosingScreen.tsx')).toContain('psalmNumber: summary.psalmNumber');
    expect(proverbReflection).toContain('proverbNumber: summary.proverbNumber');
  });

  it('adds haptics to gratitude save and the Wisdom custom choice', () => {
    const gratitude = read('components/journal/GratitudeLogEditor.tsx');
    const wisdom = read('screens/evening/EveningFlowScreens.tsx');

    expect(gratitude).toMatch(/const handleSave[\s\S]*triggerLightHaptic\(\);[\s\S]*await onSave/);
    expect(wisdom).toContain('onPress={() => { triggerLightHaptic(); setHasTappedChoice(true); setFocusedInsightId(null); setShowCustom');
  });

  it('uses the preferred Bible version for rotating gratitude and win verses', () => {
    const gratitudeVerse = read('components/journal/GratitudeVerse.tsx');
    const win = read('screens/TodaysWinWalkthroughScreen.tsx');

    expect(gratitudeVerse).toContain('getScripturePassage(dailyVerse.reference, preferredVersion)');
    expect(gratitudeVerse).toContain('{verse.reference.toUpperCase()}');
    expect(gratitudeVerse).not.toContain('dailyVerse.text');
    expect(win).toContain('<WisdomScripturePassage reference={winVerse.reference} version={bibleVersion} />');
  });

  it('uses staggered spring entrances for Morning and Evening choice groups', () => {
    const stagger = read('components/common/StaggeredBounceIn.tsx');
    expect(stagger).toContain('Animated.spring');
    expect(stagger).toContain('index * 45');

    for (const file of [
      'screens/morning/EmotionCheckInScreen.tsx',
      'screens/morning/CarryItScreen.tsx',
      'components/journal/TodaysFocusExperience.tsx',
      'screens/TodaysWinWalkthroughScreen.tsx',
      'components/journal/LookingForwardExperience.tsx',
      'screens/evening/EveningFlowScreens.tsx',
    ]) {
      expect(read(file)).toContain('<StaggeredBounceIn');
    }
  });

  it('emphasizes both saved pages with success feedback and outline iconography', () => {
    const morning = read('screens/morning/MorningClosingScreen.tsx');
    const evening = read('screens/evening/EveningFlowScreens.tsx');

    for (const closing of [morning, evening]) {
      expect(closing).toContain('triggerSuccessHaptic();');
      expect(closing).toContain('checkmark-circle-outline');
      expect(closing).toContain('completionProgress.interpolate');
    }
    expect(morning).toContain('musical-notes-outline');
    expect(evening).toContain('heart-outline');
    expect(evening).toContain('trophy-outline');
  });

  it('renders the streak marker as a visible outlined vector with contrast', () => {
    const streak = read('screens/StreakPlanScreen.tsx');
    expect(streak).toContain('<RhythmCelebrationIcon rhythm={params.rhythm} />');
    expect(streak).toContain('borderColor: Colors.sage');
  });
});
