import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../ForMeDayScreen.tsx'),
  'utf8',
);
const cardSource = fs.readFileSync(
  path.resolve(__dirname, '../../components/ForMeDayFlipCard.tsx'),
  'utf8',
);

describe('For Me Day testimony presentation', () => {
  it('uses testimony language in the editor and flip card', () => {
    expect(source).toContain('YOUR TESTIMONY');
    expect(source).toContain('<ForMeDayFlipCard');
    expect(cardSource).toContain('Your testimony');
    expect(source).not.toContain('YOUR STORY · OPTIONAL');
  });

  it('opens testimony writing in its own full-screen walkthrough', () => {
    expect(source).toContain('if (showTestimonyEditor)');
    expect(source).toContain('eyebrow="YOUR TESTIMONY"');
    expect(source).toContain('accessibilityLabel="Your testimony"');
    expect(source).toContain('style={styles.walkthroughReflectionInput}');
    expect(source).toContain('extraScrollBottomPadding={80}');
    expect(source).not.toContain('styles.storyInput');
  });

  it('presents testimony as a settings card with written or updated date copy', () => {
    expect(source).toContain("hasTestimony ? 'Your testimony' : 'Write your testimony'");
    expect(source).toContain("hasTestimony ? 'Update' : 'Write'");
    expect(source).toContain('formatForMeDayTestimonyDate(settings.testimonyUpdatedAt, true)');
    expect(source).toContain('formatForMeDayTestimonyDate(settings.testimonyWrittenAt)');
  });

  it('removes the separate testimony section from beneath the milestone card', () => {
    expect(source).not.toContain('<Text style={styles.sectionHeading}>Your testimony</Text>');
    expect(source).not.toContain('styles.testimonyBlock');
    expect(source).not.toContain('styles.testimonyAccent');
  });

  it('keeps the testimony heading bold italic Georgia serif on the card back', () => {
    const headingStyle = cardSource.match(/testimonyHeading: \{([\s\S]*?)\n {2}\},/)?.[1] || '';
    expect(headingStyle).toContain("ios: 'Georgia-BoldItalic'");
    expect(headingStyle).toContain("android: 'serif'");
    expect(headingStyle).toContain("fontStyle: 'italic'");
    expect(headingStyle).toContain("fontWeight: '700'");
  });

  it('flips the milestone card to reveal the testimony', () => {
    expect(cardSource).toContain('Tap the card to show your testimony');
    expect(cardSource).toContain('accessibilityLabel="Show your testimony"');
    expect(cardSource).toContain("outputRange: ['0deg', '180deg']");
    expect(cardSource).toContain("outputRange: ['180deg', '360deg']");
    expect(cardSource).toContain('backfaceVisibility');
  });

  it('expands the card back and enables nested scrolling for long testimony', () => {
    expect(cardSource).toContain('maximumBackHeight');
    expect(cardSource).toContain('height: cardHeight');
    expect(cardSource).toContain('onContentSizeChange');
    expect(cardSource).toContain('nestedScrollEnabled');
    expect(cardSource).toContain('scrollEnabled={testimonyScrolls}');
    expect(cardSource).toContain('showsVerticalScrollIndicator={false}');
  });

  it('shows when the testimony was written as a date-and-time pill', () => {
    expect(source).toContain('writtenAt={settings.testimonyWrittenAt}');
    expect(cardSource).toContain("format(writtenDate, 'MMM d, yyyy · h:mm a')");
    expect(cardSource).toContain('styles.writtenPill');
    expect(cardSource).toContain('name="time-outline"');
  });

  it('keeps the testimony heading compact and the written pill with its heading', () => {
    expect(cardSource).toContain('fontSize: 17 * scale');
    expect(cardSource.indexOf('accessibilityLabel={writtenLabel}')).toBeLessThan(
      cardSource.indexOf('<View style={styles.testimonyBody}>'),
    );
  });

  it('only offers testimony after a New Life Day date has been saved', () => {
    expect(source).toContain('{hasSavedDate ? (');
    expect(source).toContain('<ThemedText style={styles.sectionLabel}>YOUR TESTIMONY</ThemedText>');
  });

  it('offers a direct testimony action from the milestone when testimony is empty', () => {
    expect(source).toContain('{!hasTestimony ? (');
    expect(source).toContain('accessibilityLabel="Write my testimony"');
    expect(source).toContain('setTestimonyDraft(\'\');');
    expect(source).toContain('setShowTestimonyEditor(true);');
  });

  it('opens the annual reflection in the standard full-screen walkthrough shell', () => {
    expect(source).toContain('<RoutineStepShell');
    expect(source).toContain('eyebrow="MY NEW LIFE DAY"');
    expect(source).toContain('onBack={() => setShowReflection(false)}');
    expect(source).toContain('accessibilityLabel="My New Life Day reflection"');
    expect(source).toContain('accessibilityLabel="Save My New Life Day reflection"');
    expect(source).not.toContain('styles.reflectionCard');
  });

  it('uses circular check actions for saving testimony and reflection', () => {
    expect(source.match(/name="checkmark"/g)).toHaveLength(2);
    expect(source).toMatch(
      /walkthroughSaveButton: \{[\s\S]*?width: 52,[\s\S]*?height: 52,[\s\S]*?borderRadius: 26/,
    );
    expect(source).not.toContain('styles.walkthroughSaveText');
  });

  it('uses the standard reflection success modal after saving', () => {
    expect(source).toContain("import NewSuccessModal from '../components/NewSuccessModal'");
    expect(source).toContain('const saveSuccessModal = useSuccessModal()');
    expect(source).toContain("title: 'Reflection Saved'");
    expect(source).toContain(
      "message: 'Your reflection has been saved to your journal.'",
    );
    expect(source).toContain('<NewSuccessModal');
    expect(source).not.toContain("Alert.alert(\n      'Saved to Moments'");
  });

  it('marks the annual reflection as a dedicated New Life Day review entry', () => {
    expect(source).toContain("forMeDayEntry: 'annual_reflection'");
    expect(source).toContain('reflectionYear: writtenAt.getFullYear()');
    expect(source).toContain('writtenAt: writtenAt.toISOString()');
  });
});
