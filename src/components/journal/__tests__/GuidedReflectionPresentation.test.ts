import fs from 'fs';
import path from 'path';

const guidedSource = fs.readFileSync(path.resolve(__dirname, '../GuidedReflectionExperience.tsx'), 'utf8');
const tabSource = fs.readFileSync(path.resolve(__dirname, '../../../navigation/BottomTabNavigator.tsx'), 'utf8');
const screenSource = fs.readFileSync(path.resolve(__dirname, '../../../screens/ReflectionEditorScreen.tsx'), 'utf8');
const editorSource = fs.readFileSync(path.resolve(__dirname, '../ReflectionLogEditor.tsx'), 'utf8');
const composerSource = fs.readFileSync(path.resolve(__dirname, '../shared/JournalComposer.tsx'), 'utf8');
const inlineBlockSource = fs.readFileSync(path.resolve(__dirname, '../shared/JournalInlineBlock.tsx'), 'utf8');

describe('Guided Reflection presentation contract', () => {
  it('hides the global tab bar while ReflectionEditor is focused', () => {
    expect(tabSource).toContain("activeNestedRouteName === 'ReflectionEditor'");
    expect(tabSource).toContain('isSermonNotes || isReflectionEditor');
  });

  it('hides the system status bar for every Heart Journal surface', () => {
    expect(screenSource).toContain('useFocusEffect(');
    expect(screenSource).toContain("StatusBar.setHidden(true, 'slide')");
    expect(screenSource).toContain("StatusBar.setHidden(false, 'slide')");
  });

  it('uses the focused back, Write, note picker, and next action language', () => {
    expect(guidedSource).toContain('backLabel="Previous step"');
    expect(composerSource).toContain('accessibilityLabel="Write"');
    expect(composerSource).toContain("addOpen ? 'Close note type picker' : 'Choose a note type'");
    expect(guidedSource).toContain("atLastStep ? 'Save reflection' : 'Next step'");
  });

  it('uses the Reflection Log shell for an active guided path', () => {
    expect(guidedSource).toContain('styles.journeyHeader');
    expect(guidedSource).toContain('styles.journeyDate');
    expect(guidedSource).toContain('styles.journeySheet');
    expect(guidedSource).toContain('styles.journeyPathTitle');
    expect(guidedSource).toContain('styles.journeyProgressFill');
  });

  it('animates a selected guided path into its reflection journey', () => {
    expect(guidedSource).toContain('journeyHeaderActionEntrance');
    expect(guidedSource).toContain('journeyContentEntrance');
    expect(guidedSource).toContain('payload.pathId !== path.id');
    expect(guidedSource).toContain('journeyHeaderActionEntranceStyle');
    expect(guidedSource).toContain('journeyContentEntranceStyle');
    expect(guidedSource).toMatch(/styles\.journeySheet[\s\S]*?Animated\.View[\s\S]*?journeyContentEntranceStyle/);
    expect(guidedSource).toContain('useLayoutEffect(() => {');
    expect(guidedSource).toContain('goToJourneyStep');
    expect(guidedSource).toContain('goToJourneyStep(stepIndex + 1)');
    expect(guidedSource).toContain('goToJourneyStep(stepIndex - 1)');
    expect(guidedSource).toContain('journeyTransitioning');
  });

  it('staggers guided pills, fields, and inserted note blocks independently', () => {
    expect(guidedSource).toContain('key={step.id}');
    expect(guidedSource).toContain('itemEntrances');
    expect(guidedSource).toContain('Animated.stagger(\n        55');
    expect(guidedSource).toContain('itemEntranceStyle(index)');
    expect(guidedSource).toContain('<NoteEntrance key={note.id} delay={noteIndex * 55}>');
    expect(guidedSource).toContain('const NoteEntrance =');
    expect(guidedSource).toContain('delay,\n      useNativeDriver: true');
    expect(guidedSource).toContain('noteMenuEntrance');
    expect(guidedSource).toMatch(/styles\.noteMenu[\s\S]*?opacity: noteMenuEntrance\.interpolate/);
  });

  it('keeps the step count beside the title and the progress line full width', () => {
    expect(guidedSource).toMatch(/styles\.journeyPathTitle[\s\S]*?styles\.journeyStepCount[\s\S]*?styles\.journeyProgress/);
    expect(guidedSource).toContain("journeyProgress: {height: 2, backgroundColor: 'rgba(255,255,255,0.18)'}");
    expect(guidedSource).toContain('journeyProgressFill: {height: 2, backgroundColor: Colors.hopeWhite}');
  });

  it('adds Write and note types directly as focused inline blocks', () => {
    expect(guidedSource).toContain('appendInlineNote');
    expect(guidedSource).toContain("appendInlineNote('text')");
    expect(guidedSource).toContain('closeNotePicker(() => appendInlineNote(kind))');
    expect(guidedSource).toContain('journeyScrollRef.current?.scrollToEnd');
    expect(guidedSource).toContain("noteInputRefs.current.get(id)?.focus()");
    expect(guidedSource).toContain('activeNoteAnchor');
    expect(guidedSource).toContain('renderNotesForAnchor={anchorId => renderInlineNotes(anchorId)}');
    expect(guidedSource).toContain('onFocus={() => onFocusTarget(field.id)}');
    expect(guidedSource).toContain("noteKind === 'scripture'");
    expect(guidedSource).toContain("noteKind === 'quote'");
  });

  it('renders saved note types with the Sermon Notes inline block interface', () => {
    expect(guidedSource).toContain('<JournalInlineBlock');
    expect(guidedSource).toContain('tone="onDark"');
    expect(guidedSource).toMatch(/capture:\s*\{[\s\S]*?borderRadius: 14,[\s\S]*?padding: 12/);
    expect(guidedSource).toContain("configOverride={note.kind === 'text' ? undefined : config}");
    expect(guidedSource).toContain('textPlaceholder="Write here…"');
    expect(inlineBlockSource).toContain("if (block.kind === 'text' && !configOverride)");
    expect(inlineBlockSource).toContain("if (!block.text.trim()) onDelete(false)");
  });

  it('uses the Sermon Notes add-button motion without a dimmed backdrop', () => {
    expect(guidedSource).toContain('notePlusRotation');
    expect(guidedSource).toContain('notePickerColorAnim');
    expect(guidedSource).toContain('Animated.stagger(\n          38');
    expect(composerSource).toContain("outputRange: ['0deg', '45deg']");
    expect(guidedSource).toMatch(/menuDim:\s*\{[\s\S]*?backgroundColor: 'transparent'/);
    expect(guidedSource).toMatch(/noteMenuPill:\s*\{[\s\S]*?minHeight: 36[\s\S]*?backgroundColor: Colors\.cardBackground/);
    expect(guidedSource).toContain('{item.label.toUpperCase()}');
  });

  it('floats the shared Sermon Notes composer and removes Save here', () => {
    expect(guidedSource).toContain('<JournalComposerBar');
    expect(guidedSource).toContain('styles.floatingComposer');
    expect(guidedSource).toContain('useFloatingKeyboardButton(insets.bottom)');
    expect(guidedSource).toContain('{bottom: composerBottom}');
    expect(guidedSource).toContain('tone="onDark"');
    expect(guidedSource).toMatch(/styles\.floatingComposer,[\s\S]*?\{bottom: composerBottom\}[\s\S]*?<Animated\.View[\s\S]*?opacity: composerEntrance/);
    expect(guidedSource).not.toContain('Save here');
  });

  it('only renders the approved Guided note registry', () => {
    expect(guidedSource).toContain('[...GUIDED_NOTE_TYPES].reverse()');
    for (const sermonOnly of ['Bible Character', 'Historical Context', 'Language Note', 'Message Outline', 'Worship Song', 'Book to Read']) {
      expect(guidedSource).not.toContain(sermonOnly);
    }
  });

  it('keeps topics horizontal and restores boxy Reflect cards', () => {
    expect(guidedSource).toMatch(/<ScrollView\s+horizontal/);
    expect(guidedSource).toContain('<ReflectionQuestionCard');
    expect(guidedSource).toContain('styles={styles}');
    expect(guidedSource).toContain("maxWidth: '100%'");
    expect(guidedSource).toContain('flexShrink: 1');
  });

  it('keeps the Guided chooser on the Heart Journal cover surface', () => {
    expect(guidedSource).toContain('styles.heartJournalChooser');
    expect(guidedSource).toMatch(/HEART JOURNAL/);
    expect(guidedSource).toContain('styles.chooserClose');
    expect(guidedSource).toContain('<BookHeart');
    expect(guidedSource).toContain('chooserPageAnim');
  });

  it('expands questions while spring-collapsing the guided paths', () => {
    expect(guidedSource).toContain("useState<'guided' | 'questions'>('guided')");
    expect(guidedSource).toContain("expandChooserSection('questions')");
    expect(guidedSource).toContain("chooserSection === 'guided' &&");
    expect(guidedSource).toContain("chooserSection === 'questions' &&");
    expect(guidedSource).toContain('LayoutAnimation.Types.spring');
    expect(guidedSource).toContain('Animated.stagger(\n      38');
    expect(guidedSource).toContain('tension: 90');
    expect(guidedSource).toContain('friction: 12');
    expect(guidedSource).toContain('duration: 130');
    expect(guidedSource).toContain('chooserRevealStyle');
  });

  it('replays entrances after returning and when changing question topics', () => {
    expect(guidedSource).toContain('chooserPageAnim.setValue(0)');
    expect(guidedSource).toContain('[chooserPageAnim, guideRevealAnims, pathId]');
    expect(guidedSource).toContain('changeQuestionTopic');
    expect(guidedSource).toContain('questionsForTopic(nextTopic)');
    expect(guidedSource).toContain('setTopicTransitioning(false)');
  });

  it('opens the selected question directly in the guided writer', () => {
    expect(screenSource).toContain('onSelectQuestion={prompt => setSingleGuidedPrompt(prompt)}');
    expect(editorSource).toContain("source === 'guided' ? initialPrompt || initialTitle || '' : ''");
    expect(editorSource).toContain('const guidedPrompt = initialPrompt || initialTitle');
    expect(editorSource).toContain('setSelectedPrompt(guidedPrompt)');
    expect(editorSource).toContain("const effectiveViewMode = 'free-form' as const");
    expect(editorSource).toMatch(/source === 'guided'[\s\S]*?createManagedTimeout\(\(\) => \{[\s\S]*?contentInputRef\.current\.focus\(\)/);
    expect(editorSource).toContain("autoFocus={!isEditing && source !== 'guided'}");
    expect(editorSource).not.toContain('contentInputRef.current.setSelection(cursor, cursor)');
    expect(guidedSource).toContain('noteFocusTimerRef');
    expect(guidedSource).toContain('noteFocusFrameRef');
  });

  it('uses only the new Guided Reflection question screen', () => {
    expect(guidedSource).toContain('<ReflectionQuestionCard');
    expect(editorSource).not.toContain('<ReflectionQuestionCard');
    expect(editorSource).not.toContain('accessibilityLabel="Guided Reflection"');
    expect(editorSource).not.toContain("setViewMode('guided')");
  });

  it('mounts the save success modal above the Guided Reflection experience', () => {
    expect(screenSource).toMatch(
      /if \(showGuidedExperience\)[\s\S]*?<GuidedReflectionExperience[\s\S]*?<NewSuccessModal[\s\S]*?visible=\{successModal\.isVisible\}/,
    );
  });

  it('animates the Reflection Log Editor into the focused writer', () => {
    expect(editorSource).toContain('editorEntranceAnims');
    expect(editorSource).toContain('editorEntranceKey');
    expect(editorSource).toContain('Animated.sequence([');
    expect(editorSource).toContain('Animated.parallel([');
    expect(editorSource).toContain('editorHeaderEntranceStyle');
    expect(editorSource).toContain('editorContentEntranceStyle');
    expect(editorSource).toContain('editorActionsEntranceStyle');
    expect(editorSource).toContain('writerItemEntrances');
    expect(editorSource).toContain('writerItemEntranceStyle');
    expect(editorSource).toContain('Animated.stagger(\n              55');
    expect(editorSource).toContain('writerItemEntranceStyle(isDirectHeartJournal ? 1 : 0)');
    expect(editorSource).toContain('writerItemEntranceStyle(isDirectHeartJournal ? 2 : 1)');
    expect(editorSource).toContain('<View style={s.contentCard}>');
    expect(editorSource).toContain('<Animated.View style={editorContentEntranceStyle}>');
    expect(editorSource).not.toContain('<Animated.View style={[s.contentCard, editorContentEntranceStyle]}>');
  });

  it('keeps Reflection Log close and save actions floating above the keyboard', () => {
    expect(editorSource).toContain('useFloatingKeyboardButton(insets.bottom)');
    expect(editorSource).toContain('{bottom: fabAnimatedValue}');
    expect(editorSource).toContain('pointerEvents="box-none"');
    expect(editorSource).not.toContain('Keep FABs at fixed initial position');
  });

  it('provides haptics for Heart Journal closes, pills, and guided actions', () => {
    expect(screenSource).toMatch(/accessibilityLabel="Close"[\s\S]*?triggerLightHaptic\(\);[\s\S]*?handleCancel\(\)/);
    expect(guidedSource).toMatch(/accessibilityLabel="Close Guided Reflection"[\s\S]*?triggerLightHaptic\(\)/);
    expect(guidedSource).toMatch(/onPress=\{\(\) => \{[\s\S]*?triggerLightHaptic\(\);[\s\S]*?onSelect\(option\)/);
    expect(guidedSource).toMatch(/onReflect=\{\(\) => \{[\s\S]*?triggerLightHaptic\(\);[\s\S]*?onSelectQuestion/);
  });
});
