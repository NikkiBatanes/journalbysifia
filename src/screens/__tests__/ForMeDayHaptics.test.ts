import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../ForMeDayScreen.tsx'),
  'utf8',
);
const navigatorSource = fs.readFileSync(
  path.resolve(__dirname, '../../navigation/RootStackNavigator.tsx'),
  'utf8',
);

describe('For Me Day haptics', () => {
  it('responds immediately to navigation, editing, and save actions', () => {
    expect(source).toMatch(/closeForMeDay[\s\S]*?triggerLightHaptic\(\)/);
    expect(source).toMatch(/saveSettings[\s\S]*?triggerLightHaptic\(\)/);
    expect(source).toMatch(/saveReflection[\s\S]*?triggerLightHaptic\(\)/);
    expect(source).toMatch(/setEditing\(true\)/);
    expect(source).toMatch(/!editing \|\| hasUnsavedChanges \? \([\s\S]*?headerButton/);
    expect(source).toMatch(/editing \? \([\s\S]*?>\s*Save\s*</);
  });

  it('shows Save during first-time setup and after an existing setting changes', () => {
    expect(source).toContain('const settingsSignature =');
    expect(source).toContain('const [savedSettingsSignature, setSavedSettingsSignature]');
    expect(source).toMatch(
      /const hasUnsavedChanges = !hasSavedDate \|\| \(savedSettingsSignature !== null[\s\S]*?settingsSignature\(settings\) !== savedSettingsSignature/,
    );
    expect(source).toContain('setSavedSettingsSignature(settingsSignature(saved))');
  });

  it('provides selection feedback for the date and preference switches', () => {
    expect(source).toMatch(/setShowPicker\(true\)/);
    expect(source).toMatch(/if \(value\) \{\s*triggerSelectionHaptic\(\)/);
    expect(source).toMatch(/onValueChange=\{value => \{\s*triggerSelectionHaptic\(\)/);
  });

  it('uses the onboarding-style scroll wheel before committing a date', () => {
    expect(source).toContain('display="spinner"');
    expect(source).toContain('value={pendingBirthdayDate}');
    expect(source).toContain('minimumDate={new Date(1900, 0, 1)}');
    expect(source).toContain('accessibilityLabel="Cancel date change"');
    expect(source).toContain('accessibilityLabel="Confirm date change"');
  });

  it('scrolls edge to edge while keeping controls inside safe-area padding', () => {
    expect(source).not.toContain('<SafeAreaView');
    expect(source).toContain('contentInsetAdjustmentBehavior="never"');
    expect(source).toContain('automaticallyAdjustContentInsets={false}');
    expect(source).toContain('paddingTop: insets.top + 74');
    expect(source).toContain('paddingBottom: insets.bottom + 140');
    expect(source).toContain('pointerEvents="box-none"');
    expect(source).toContain('styles.floatingControls');
    expect(source).not.toContain('styles.headerTitle');
    expect(source).not.toContain('backgroundColor: Colors.lightBackground,\n  },\n  headerTitle');
    expect(navigatorSource).toMatch(
      /name="ForMeDay"[\s\S]*?statusBarTranslucent: true[\s\S]*?navigationBarTranslucent: true/,
    );
  });
});
