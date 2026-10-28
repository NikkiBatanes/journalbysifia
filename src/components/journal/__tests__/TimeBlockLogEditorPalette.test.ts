import fs from 'fs';
import path from 'path';

const editorSource = fs.readFileSync(path.resolve(__dirname, '../TimeBlockLogEditor.tsx'), 'utf8');
const locationSource = fs.readFileSync(path.resolve(__dirname, '../../LocationSelector.tsx'), 'utf8');
const categorySource = fs.readFileSync(path.resolve(__dirname, '../TimeBlockCategoryModal.tsx'), 'utf8');
const screenSource = fs.readFileSync(path.resolve(__dirname, '../../../screens/TimeBlockEditorScreen.tsx'), 'utf8');
const stackSource = fs.readFileSync(path.resolve(__dirname, '../../../navigation/JournalStackNavigator.tsx'), 'utf8');
const moreSource = fs.readFileSync(path.resolve(__dirname, '../../../screens/UserProfileScreen.tsx'), 'utf8');

describe('Time Block Journal palette', () => {
  it('uses a warm cream page with soft ivory fields', () => {
    expect(editorSource).toMatch(/container:\s*\{[\s\S]*?backgroundColor: Colors\.lightBackground/);
    expect(editorSource).toMatch(/repeatButton:\s*\{[\s\S]*?backgroundColor: Colors\.cardBackground/);
    expect(editorSource).toMatch(/notesInputContainer:\s*\{[\s\S]*?backgroundColor: Colors\.cardBackground/);
    expect(editorSource).toMatch(/titleInputContainer:\s*\{[\s\S]*?backgroundColor: Colors\.cardBackground/);
    expect(editorSource).toMatch(/categoryButton:\s*\{[\s\S]*?backgroundColor: Colors\.cardBackground/);
    expect(editorSource).toMatch(/titleInputField:\s*\{[\s\S]*?color: Colors\.text/);
    expect(editorSource).toContain('placeholderTextColor={Colors.textGray}');
  });

  it('uses sage field icons and warm-gray chevrons on ivory', () => {
    expect(editorSource).toContain('name="text" size={18} color={Colors.sage}');
    expect(editorSource).toContain('name="repeat" size={18} color={Colors.sage}');
    expect(editorSource).toContain('name="notifications-outline" size={18} color={Colors.sage}');
    expect(editorSource).toContain('name="document-text-outline" size={18} color={Colors.sage}');
    expect(editorSource).toContain('name="chevron-down" size={16} color={Colors.textGray}');
  });

  it('uses light modals with sage selected and confirmation states', () => {
    expect(editorSource).toMatch(/timePickerContainer:\s*\{[\s\S]*?backgroundColor: Colors\.cardBackground/);
    expect(editorSource).toMatch(/repeatModalContainer:\s*\{[\s\S]*?backgroundColor: Colors\.cardBackground/);
    expect(editorSource).toMatch(/repeatOptionPillActive:\s*\{[\s\S]*?backgroundColor: Colors\.sage/);
    expect(editorSource).toMatch(/timePickerConfirmButton:\s*\{[\s\S]*?backgroundColor: Colors\.sage/);
    expect(editorSource).toContain('themeVariant="light"');
  });

  it('uses the same native toggle treatment as the More tab', () => {
    const sharedTrack = 'trackColor={{false: Colors.lightGray, true: Colors.sageMuted}}';
    const sharedThumb = 'thumbColor={Colors.hopeWhite}';

    expect(editorSource).toContain('<Switch');
    expect(editorSource).toContain(sharedTrack);
    expect(editorSource).toContain(sharedThumb);
    expect(moreSource).toContain(sharedTrack);
    expect(moreSource).toContain(sharedThumb);
    expect(editorSource).toMatch(/allDaySwitch:\s*\{[\s\S]*?marginRight: Platform\.OS === 'ios' \? 10 : 0/);
    expect(editorSource).toContain('style={s.allDaySwitch}');
    expect(editorSource).not.toContain('switchTrackActive');
    expect(editorSource).not.toContain('switchThumb:');
  });

  it('uses the standard walkthrough close control in the upper-right', () => {
    expect(editorSource).toContain("import HeaderCloseButton from '../common/HeaderCloseButton'");
    expect(editorSource).toContain('const insets = useSafeAreaInsets()');
    expect(editorSource).toContain('<HeaderCloseButton');
    expect(editorSource).toContain('style={[s.headerCloseButton, { top: insets.top + 8 }]}');
    expect(editorSource).toMatch(/headerCloseButton:\s*\{[\s\S]*?right: 20,[\s\S]*?zIndex: 100/);
    expect(editorSource).not.toContain('{/* Cancel FAB */}');
    expect(editorSource).not.toContain('cancelFab:');
  });

  it('matches location, category, screen, and native transition surfaces', () => {
    expect(locationSource).toContain('<MapPin size={16} color={Colors.sage} />');
    expect(locationSource).toMatch(/inputContainer:\s*\{[\s\S]*?backgroundColor: Colors\.cardBackground/);
    expect(locationSource).toMatch(/textInput:\s*\{[\s\S]*?color: Colors\.text/);
    expect(categorySource).toMatch(/overlay:\s*\{[\s\S]*?backgroundColor: Colors\.lightBackground/);
    expect(categorySource).toMatch(/categoryCardSelected:\s*\{[\s\S]*?backgroundColor: Colors\.sage/);
    expect(screenSource).toContain('backgroundColor: Colors.lightBackground');
    expect(stackSource).toContain("contentStyle: { backgroundColor: '#F6F5EF' }");
  });

  it('does not use the coral alert color anywhere in the Time Block flow', () => {
    [editorSource, locationSource, categorySource, screenSource].forEach(source => {
      expect(source).not.toContain('Colors.alertCoral');
    });
  });

  it('saves Journal Time Blocks locally without requiring an account', () => {
    expect(screenSource).toContain("import { LOCAL_TIME_BLOCK_USER_ID } from '../storage/localTimeBlockStorage'");
    expect(screenSource).toContain('user_id: LOCAL_TIME_BLOCK_USER_ID');
    expect(screenSource).not.toContain('Sign In Required');
    expect(screenSource).not.toContain("user_id: user?.id || ''");
  });
});
