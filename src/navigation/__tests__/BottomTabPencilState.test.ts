import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, '../BottomTabNavigator.tsx'), 'utf8');
const sermonSource = fs.readFileSync(path.resolve(__dirname, '../../screens/SermonNotesScreen.tsx'), 'utf8');
const gratitudeSource = fs.readFileSync(path.resolve(__dirname, '../../screens/GratitudeWalkthroughScreen.tsx'), 'utf8');
const journalStackSource = fs.readFileSync(path.resolve(__dirname, '../JournalStackNavigator.tsx'), 'utf8');
const bibleStudySource = fs.readFileSync(path.resolve(__dirname, '../../screens/BibleStudyScreen.tsx'), 'utf8');
const reviewSource = fs.readFileSync(path.resolve(__dirname, '../../screens/ReviewScreen.tsx'), 'utf8');
const gospelSource = fs.readFileSync(path.resolve(__dirname, '../../screens/GospelScreen.tsx'), 'utf8');
const todosSource = fs.readFileSync(path.resolve(__dirname, '../../components/journal/TodosExperience.tsx'), 'utf8');
const gratitudeEditorSource = fs.readFileSync(path.resolve(__dirname, '../../components/journal/GratitudeLogEditor.tsx'), 'utf8');
const bibleDetailSource = fs.readFileSync(path.resolve(__dirname, '../../components/journal/BibleStudyDetailView.tsx'), 'utf8');
const guidedReflectionSource = fs.readFileSync(path.resolve(__dirname, '../../components/journal/GuidedReflectionExperience.tsx'), 'utf8');
const journalComposerSource = fs.readFileSync(path.resolve(__dirname, '../../components/journal/shared/JournalComposer.tsx'), 'utf8');
const scriptureNoteSource = fs.readFileSync(path.resolve(__dirname, '../../screens/ScriptureNoteEditorScreen.tsx'), 'utf8');

describe('main navigation pencil state', () => {
  it('tracks a pencil-launched flow separately from the open menu', () => {
    expect(source).toContain('const [showAddMenu, setShowAddMenu]');
    expect(source).toContain('const [addFlowActive, setAddFlowActive]');
    expect(source).toContain('if (showAddMenu || addFlowActive)');
    expect(source).toContain('updateSelectorPosition(addButtonLayout.current.x)');
  });

  it('uses the same notebook-heart icon as the Heart Journal screen', () => {
    expect(source).toContain("{ icon: { family: 'lucide', component: BookHeart }, title: 'Heart Journal'");
    expect(source).not.toContain('component: NotebookPen');
  });

  it('closes stale menu state on destination and unrelated route changes', () => {
    expect(source).toContain('}, [currentRouteName, activeNestedRouteName]);');
    expect(source).toContain('activeAddRouteIdentityRef.current = nestedDestination');
    expect(source).toContain('activeAddRouteIdentityRef.current !== routeIdentity');
    expect(source).toContain("setMenuMode('main')");
  });

  it('keeps pencil selected after choosing an item and clears it on normal tabs', () => {
    expect(source).toContain('setAddFlowActive(Boolean(nestedDestination))');
    expect(source).toMatch(/const onPress = \(\) => \{[\s\S]*?closeAddMenuForNavigation\(\);\s*setAddFlowActive\(false\)/);
  });

  it('does not leave the pencil selected for root-stack or same-route actions', () => {
    expect(source).toContain("item.params?.screen !== 'JournalMoments'");
    expect(source).toContain('// These walkthroughs live in the root stack');
    expect(source).toContain("DeviceEventEmitter.addListener('pencilAddFlowClosed'");
  });

  it('tears down the add menu before navigating and blocks duplicate presses', () => {
    expect(source).toContain('const closeAddMenuForNavigation = React.useCallback');
    expect(source).toContain('addNavigationInFlightRef.current = true');
    expect(source).toContain('menuItemAnims.forEach(animation => animation.stopAnimation())');
    expect(source).toContain('requestAnimationFrame(() => {');
    expect(source).toMatch(/finally \{[\s\S]*?addNavigationInFlightRef\.current = false/);
  });

  it('stops pending add-menu animations before normal tab navigation', () => {
    expect(source).toMatch(/const onPress = \(\) => \{[\s\S]*?closeAddMenuForNavigation\(\);[\s\S]*?navigation\.emit/);
    expect(source).toMatch(/if \(showAddMenu\) \{[\s\S]*?closeAddMenuForNavigation\(\);/);
  });

  it('resets the pencil selector whenever Sermon Notes closes or loses focus', () => {
    expect(sermonSource).toContain("DeviceEventEmitter.emit('pencilAddFlowClosed')");
    expect(sermonSource).toMatch(/useFocusEffect\([\s\S]*?return \(\) => \{[\s\S]*?pencilAddFlowClosed/);
  });

  it('opens Gratitude in a To-dos-style standalone editor and completion screen', () => {
    expect(source).toContain("title: 'Gratitude', target: 'GratitudeWalkthrough'");
    expect(gratitudeSource).toContain('<GratitudeLogEditor');
    expect(gratitudeSource).toContain('Your gratitude has been saved');
    expect(gratitudeSource).toContain('style={styles.doneButton}');
  });

  it('opens Scripture Note without a bottom-up transition', () => {
    expect(journalStackSource).toMatch(/name="ScriptureNoteEditor"[\s\S]*?animation: 'none'/);
    expect(source).toContain("const isScriptureNoteEditor = activeNestedRouteName === 'ScriptureNoteEditor'");
    expect(source).toMatch(/if \(isSermonNotes \|\| isReflectionEditor \|\| isScriptureNoteEditor \|\| isBibleStudy \|\| isReview\)/);
  });

  it('gives Scripture Note the shared block composer and reliable focus behavior', () => {
    expect(scriptureNoteSource).toContain('<JournalComposerBar');
    expect(scriptureNoteSource).toContain('<JournalPickerMenu');
    expect(scriptureNoteSource).toContain('<JournalInlineBlock');
    expect(scriptureNoteSource).toContain('journalBlocks');
    expect(scriptureNoteSource).toContain('pendingFocusBlockIdRef.current = block.id');
    expect(scriptureNoteSource).toContain('ref={searchInputRef}');
    expect(scriptureNoteSource).toContain('autoFocus');
    expect(scriptureNoteSource).toContain('searchInputRef.current?.focus()');
    expect(scriptureNoteSource).toContain('blockInputRefs.current.get(blockId)?.focus()');
    expect(scriptureNoteSource).toMatch(/freeText:\s*\{[\s\S]*?minHeight: 44,[\s\S]*?marginBottom: 6/);
    expect(scriptureNoteSource).toContain('fontFamily: fontFamilyRegular');
    expect(scriptureNoteSource).toMatch(/<\/KeyboardAvoidingView>[\s\S]*?styles\.floatingComposer[\s\S]*?<JournalComposerBar/);
    expect(scriptureNoteSource).toMatch(/floatingComposer:\s*\{[\s\S]*?position: 'absolute'/);
    expect(scriptureNoteSource).not.toContain('<View style={s.fabWrapper}>');
  });

  it('uses the navigation scroll icon with reference info and sharing in Scripture Note', () => {
    expect(scriptureNoteSource).toContain('accessibilityLabel="Bible translation information"');
    expect(scriptureNoteSource).toContain('<BibleCopyrightModal');
    expect(scriptureNoteSource).toContain('accessibilityLabel="Close scripture note"');
    expect(scriptureNoteSource).toContain('<Ionicons name="close" size={17} color={Colors.sage} />');
    expect(scriptureNoteSource).toContain('<Text style={styles.versePreviewText}>');
    expect(scriptureNoteSource).toContain("fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' })");
    expect(scriptureNoteSource).toContain("fontStyle: 'italic'");
    expect(scriptureNoteSource).toMatch(/versePreviewRef:\s*\{[\s\S]*?textTransform: 'uppercase'/);
    expect(scriptureNoteSource).toContain('{stripWrappingQuotationMarks(resolvedVerse.text)}');
    expect(scriptureNoteSource).toMatch(/versePreview:\s*\{[\s\S]*?borderLeftWidth: 2/);
    expect(scriptureNoteSource).not.toContain('numberOfLines={3}');
    expect(scriptureNoteSource).toContain('style={s.headerCloseButton}');
    expect(scriptureNoteSource).toContain('style={[s.header, styles.header]}');
    expect(scriptureNoteSource).toContain('<Animated.View style={[s.modeToggle, editorHeaderEntranceStyle]}>');
    expect(scriptureNoteSource).toContain('duration: 140');
    expect(scriptureNoteSource).toContain('tension: 82');
    expect(scriptureNoteSource).toContain('friction: 11');
    expect(scriptureNoteSource).toContain('tension: 88');
    expect(scriptureNoteSource).toContain('friction: 12');
    expect(scriptureNoteSource).toContain('outputRange: [14, 0]');
    expect(scriptureNoteSource).toContain('outputRange: [10, 0]');
    expect(scriptureNoteSource).toMatch(/header:\s*\{[\s\S]*?backgroundColor: Colors\.lightBackground,[\s\S]*?paddingBottom: 0/);
    expect(scriptureNoteSource).not.toContain('accessibilityLabel="Share scripture note"');
    expect(scriptureNoteSource).not.toContain('name="paper-plane-outline"');
    expect(scriptureNoteSource).toContain("import ShareComposer from '../components/TruthToCarryShareComposer'");
    expect(scriptureNoteSource).toContain('setShareComposerText(text)');
    expect(scriptureNoteSource).toContain('setShareComposerOpen(true)');
    expect(scriptureNoteSource).toMatch(/<ShareComposer[\s\S]*?visible=\{shareComposerOpen\}[\s\S]*?text=\{shareComposerText\}/);
    expect(scriptureNoteSource).not.toContain('await Share.share({');
    expect(scriptureNoteSource).not.toContain('name="book-open-page-variant-outline"');
  });

  it('opens Reflection Editor without fading through the ivory screen', () => {
    expect(journalStackSource).toMatch(/name="ReflectionEditor"[\s\S]*?animation: 'none'/);
    expect(journalStackSource).toMatch(/name="ReflectionEditor"[\s\S]*?contentStyle: \{ backgroundColor: '#526A5B' \}/);
    expect(guidedReflectionSource).toMatch(/journeyScreen:\s*\{flex: 1, backgroundColor: Colors\.sage\}/);
    expect(guidedReflectionSource).toContain('<View style={styles.journeyHeaderBackdrop} />');
  });

  it('opens Session Notes without a slide and gives Bible Study the Heart Journal fade', () => {
    expect(journalStackSource).toMatch(/name="SermonNotes"[\s\S]*?animation: 'none'/);
    expect(journalStackSource).toMatch(/name="BibleStudy"[\s\S]*?animation: 'fade'/);
    expect(source).toContain("title: 'Session Notes', target: 'Journal', params: { screen: 'SermonNotes'");
    expect(source).not.toContain('opensSessionMenu');
    expect(source).toContain("openedFromPencil: true");
    expect(sermonSource).toMatch(/openedFromPencil[\s\S]*?popTo\('JournalMoments'\)/);
    expect(bibleStudySource).toMatch(/openedFromPencil[\s\S]*?popTo\('JournalMoments'\)/);
  });

  it('shows every Bible Study topic without a Show more control', () => {
    expect(bibleStudySource).toContain('topics={BIBLE_STUDY_TOPICS} expanded');
    expect(bibleStudySource).not.toContain('topicsExpanded');
    expect(bibleStudySource).not.toContain("'Show more'");
  });

  it('uses the Write navigation Bible Study icon throughout the editor', () => {
    expect(source).toContain("title: 'Bible Study'");
    expect(source).toContain("name: 'book-outline'");
    expect(bibleStudySource).toContain('name="book-outline"');
    expect(bibleStudySource).not.toContain('name="script-text"');
  });

  it('matches walkthrough close controls to the Sermon Notes close button', () => {
    [bibleStudySource, reviewSource, gospelSource, todosSource, gratitudeEditorSource, bibleDetailSource].forEach(screen => {
      expect(screen).toContain('size={17} color={Colors.sage}');
    });
    [bibleStudySource, reviewSource, gospelSource, todosSource, gratitudeEditorSource, bibleDetailSource].forEach(screen => {
      expect(screen).toContain('backgroundColor: Colors.cardBackground');
    });
  });

  it('keeps the Heart Journal guided chooser original and standardizes later guided screens', () => {
    expect(guidedReflectionSource).toContain("backgroundColor: 'rgba(255, 255, 255, 0.15)'");
    expect(guidedReflectionSource).toContain('What would help you reflect today?');
    expect(guidedReflectionSource).toContain('size={17}');
    expect(guidedReflectionSource).toContain('Colors.sage');
    expect(guidedReflectionSource).toContain('backgroundColor: Colors.cardBackground');
    expect(guidedReflectionSource).toContain('borderRadius: 999');
  });

  it('gives the single-question Reflection Editor the standard circular close control', () => {
    expect(journalComposerSource).toBeTruthy();
    expect(fs.readFileSync(path.resolve(__dirname, '../../components/journal/ReflectionLogEditor.tsx'), 'utf8'))
      .toContain('style={s.headerCloseButton}');
    expect(fs.readFileSync(path.resolve(__dirname, '../../components/journal/reflectionStyles.ts'), 'utf8'))
      .toMatch(/headerCloseButton:\s*\{[\s\S]*?width: 42,[\s\S]*?height: 42,[\s\S]*?borderRadius: 999,[\s\S]*?backgroundColor: Colors\.cardBackground/);
  });

  it('uses a low-glare forest active state in the Heart Journal guided chooser', () => {
    expect(guidedReflectionSource).toMatch(/chooserSectionPillActive: \{[\s\S]*?backgroundColor: Colors\.darkBackground/);
    expect(guidedReflectionSource).toMatch(/chooserTopicSelected: \{[\s\S]*?backgroundColor: Colors\.darkBackground/);
    expect(guidedReflectionSource).toContain('chooserSectionLabelActive: {color: Colors.hopeWhite}');
    expect(guidedReflectionSource).toContain('chooserTopicTextSelected: {color: Colors.hopeWhite}');
  });

  it('uses the same low-glare selection inside Guided Reflection steps', () => {
    expect(guidedReflectionSource).toContain('optionSelected: {backgroundColor: Colors.darkBackground, borderColor: Colors.sageMuted}');
    expect(guidedReflectionSource).toContain('optionTextSelected: {color: Colors.hopeWhite}');
    expect(guidedReflectionSource).toContain('name="checkmark" size={16} color={Colors.hopeWhite}');
  });

  it('gives the shared Guided/Sermon back action haptics and equal compact controls', () => {
    expect(journalComposerSource).toMatch(/triggerLightHaptic\(\);\s*onBack\(\)/);
    expect(journalComposerSource).toMatch(/backButton: \{[\s\S]*?width: 42,[\s\S]*?height: 42/);
    expect(journalComposerSource).toMatch(/circleButton: \{[\s\S]*?width: 42,[\s\S]*?height: 42/);
  });

  it('clears pencil selection when its menu is dismissed without choosing', () => {
    expect(source).toContain('setAddFlowActive(opening)');
    expect(source).toMatch(/styles\.addMenuDismissLayer[\s\S]*?onPress=\{\(\) => \{\s*closeAddMenuForNavigation\(\);\s*setAddFlowActive\(false\)/);
  });

  it('uses a blur instead of dimming the screen behind the pencil menu', () => {
    expect(source).toContain("import { BlurView } from '@react-native-community/blur'");
    expect(source).toContain('styles.addMenuBlur');
    expect(source).toContain('blurAmount={7}');
    expect(source).toContain('styles.addMenuDismissLayer');
    expect(source).not.toContain('styles.addMenuDim');
  });

  it('hides the native status bar while the blurred pencil menu is open', () => {
    expect(source).toContain('StatusBar.setHidden(showAddMenu, \'fade\')');
    expect(source).toContain("return () => StatusBar.setHidden(false, 'fade')");
  });

  it('animates each menu heading in the same stagger as its choices', () => {
    expect(source).toContain('const menuTitleAnim = React.useRef(new Animated.Value(0)).current');
    expect(source).toContain('[...[...menuItemAnims].reverse(), menuTitleAnim]');
    expect(source).toContain('[...[...anims].reverse(), menuTitleAnim]');
    expect(source).toContain('opacity: menuTitleAnim');
    expect(source).toContain('React.useLayoutEffect(() => {');
  });

  it('finishes the current menu animation before opening a second-level menu', () => {
    expect(source).toContain('const transitionMenuMode = React.useCallback');
    expect(source).toContain("transitionMenuMode('prayer')");
    expect(source).toContain("transitionMenuMode('session')");
    expect(source).toContain('[menuTitleAnim, ...outgoing]');
    expect(source).toContain('disabled={menuModeTransitioning}');
  });
});
