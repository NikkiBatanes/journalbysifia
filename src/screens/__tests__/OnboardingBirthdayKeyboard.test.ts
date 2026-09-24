import fs from 'fs';
import path from 'path';

const journalOnboardingSource = fs.readFileSync(
  path.resolve(__dirname, '../journalOnboarding/JournalOnboardingScreen.tsx'),
  'utf8',
);
const personalizationSource = fs.readFileSync(
  path.resolve(__dirname, '../onboarding/OnboardingPersonalizationScreen.tsx'),
  'utf8',
);

describe('onboarding birthday keyboard behavior', () => {
  it('dismisses the keyboard before opening either onboarding birthday picker', () => {
    expect(journalOnboardingSource).toMatch(
      /style=\{styles\.dateInput\}[\s\S]*?onPress=\{\(\) => \{[\s\S]*?Keyboard\.dismiss\(\);[\s\S]*?setShowBirthDatePicker/,
    );
    expect(personalizationSource).toMatch(
      /const openBirthdayPicker = useCallback\(\(\) => \{[\s\S]*?Keyboard\.dismiss\(\);[\s\S]*?setShowInlineYearPicker\(true\)/,
    );
  });
});
