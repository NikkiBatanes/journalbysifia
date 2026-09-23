import fs from 'fs';
import path from 'path';

const guidedSource = fs.readFileSync(path.resolve(__dirname, '../GuidedReflectionExperience.tsx'), 'utf8');
const tabSource = fs.readFileSync(path.resolve(__dirname, '../../../navigation/BottomTabNavigator.tsx'), 'utf8');
const screenSource = fs.readFileSync(path.resolve(__dirname, '../../../screens/ReflectionEditorScreen.tsx'), 'utf8');
const editorSource = fs.readFileSync(path.resolve(__dirname, '../ReflectionLogEditor.tsx'), 'utf8');
const logSource = fs.readFileSync(path.resolve(__dirname, '../ReflectionLogReactQuery.tsx'), 'utf8');
const legacyPromptModalSource = fs.readFileSync(path.resolve(__dirname, '../../../screens/SmartJournalingReflectionModal.tsx'), 'utf8');
const composerSource = fs.readFileSync(path.resolve(__dirname, '../shared/JournalComposer.tsx'), 'utf8');
const inlineBlockSource = fs.readFileSync(path.resolve(__dirname, '../shared/JournalInlineBlock.tsx'), 'utf8');
const tableBlockSource = fs.readFileSync(path.resolve(__dirname, '../shared/JournalTableBlock.tsx'), 'utf8');
const reflectionStylesSource = fs.readFileSync(path.resolve(__dirname, '../reflectionStyles.ts'), 'utf8');

describe('Guided Reflection presentation contract', () => {
  it('uses an ivory cursor and selection across every guided reflection input', () => {
    const guidedInputs = guidedSource.match(/<JournalTextInput(?=\s)[\s\S]*?\/>/g) || [];
    expect(guidedInputs).toHaveLength(7);
    // All fields must use the same mount-time policy, including fields whose
    // refs are not registered with the parent (list rows, table cells, authors).
    const inputSources = [guidedSource, editorSource, screenSource,
      inlineBlockSource, tableBlockSource,
      ...['JournalNestedBlockEditor', 'JournalListBlock', 'ScriptureLookupInput'].map(name =>
        fs.readFileSync(path.resolve(__dirname, `../shared/${name}.tsx`), 'utf8')),
      fs.readFileSync(path.resolve(__dirname, '../ReflectionSpecialBlock.tsx'), 'utf8'),
    ];
    inputSources.forEach(source => {
      expect(source).toContain('<JournalTextInput');
      expect(source).not.toMatch(/<(?:TextInput|ThemedTextInput|IvoryTextInput)(?=\s)/);
    });
    expect(guidedSource).toMatch(
      /<JournalTextInput[\s\S]*?placeholder="Write here\.\.\."[\s\S]*?\/>/,
    );
    expect(editorSource).toMatch(
      /pendingFocusBlockIdRef[\s\S]*?focusBlockInput\(blockId\)[\s\S]*?setTimeout[\s\S]*?focusBlockInput\(blockId\)/,
    );
  });

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

  it('uses the shared Reflection Editor header and sheet geometry for guided paths', () => {
    expect(guidedSource).toContain("import {styles as reflectionEditorStyles} from './reflectionStyles'");
    expect(guidedSource.match(/style=\{reflectionEditorStyles\.header\}/g)).toHaveLength(2);
    expect(guidedSource.match(/style=\{reflectionEditorStyles\.title\}/g)).toHaveLength(2);
    expect(guidedSource.match(/reflectionEditorStyles\.headerActions/g)).toHaveLength(2);
    expect(guidedSource.match(/style=\{reflectionEditorStyles\.headerCloseButton\}/g)).toHaveLength(2);
    expect(guidedSource.match(/style=\{reflectionEditorStyles\.contentCard\}/g)).toHaveLength(2);
    expect(guidedSource).toContain('style={reflectionEditorStyles.headerPlainButton}');
    expect(editorSource).toContain('style={s.headerActions}');
    expect(editorSource).toContain('style={s.headerPlainButton}');
    expect(reflectionStylesSource).toMatch(/header:\s*\{[\s\S]*?paddingTop: 50,[\s\S]*?paddingHorizontal: 16,[\s\S]*?paddingBottom: 10/);
    expect(reflectionStylesSource).toMatch(/contentCard:\s*\{[\s\S]*?borderTopLeftRadius: 30,[\s\S]*?borderTopRightRadius: 30/);
    expect(guidedSource).toContain('styles.journeyPathTitle');
    expect(guidedSource).toContain('styles.journeyProgressFill');
    expect(guidedSource).toContain('journeyScreen: {flex: 1, backgroundColor: Colors.sage}');
    expect(guidedSource).toContain('<View style={styles.journeyHeaderBackdrop} />');
    expect(guidedSource).toMatch(/journeyHeaderBackdrop:\s*\{[\s\S]*?backgroundColor: Colors\.lightBackground/);
  });

  it('reopens structured saved journeys in the readable guided summary', () => {
    expect(screenSource).toMatch(/showGuidedExperience = guidedMode[\s\S]*?Boolean\(structuredJourney\)/);
    expect(guidedSource).toContain('style={styles.savedJourneyPrompt}');
    expect(guidedSource).toContain('style={styles.savedSelectionPill}');
    expect(guidedSource).toContain('<SavedReflectionBlocks');
    expect(guidedSource).toContain('blocks={prepareJournalBlocksForSave(savedAnswer.notes)}');
    expect(guidedSource).toContain('contentContainerStyle={styles.savedJourneyContent}');
    expect(guidedSource).toContain('accessibilityLabel="Close"');
    expect(guidedSource).toContain('<Ionicons name="close" size={17} color={Colors.sage} />');
    expect(guidedSource).toContain('accessibilityLabel="Edit guided reflection"');
    expect(guidedSource).toContain('<Pencil size={20} color={Colors.sage} strokeWidth={1.7} />');
    expect(guidedSource).not.toContain('name="pencil-outline"');
  });

  it('reopens a saved Guided Reflection in its original walkthrough for editing', () => {
    expect(guidedSource).toContain('const editSavedJourney = () => {');
    expect(guidedSource).toMatch(/editSavedJourney[\s\S]*?setStepIndex\(0\)[\s\S]*?setShowSavedView\(false\)/);
    expect(guidedSource).toContain('onPress={editSavedJourney}');
    expect(guidedSource).toContain('const returnToSavedJourney = () => {');
    expect(guidedSource).toMatch(
      /returnToSavedJourney[\s\S]*?setPayload\(savedPayloadRef\.current\)/,
    );
    expect(guidedSource).toMatch(/editingSavedJourney[\s\S]*?returnToSavedJourney\(\)/);
  });

  it('allows a saved journey title to change without losing its guided path', () => {
    expect(guidedSource).toContain('accessibilityLabel="Rename guided reflection"');
    expect(guidedSource).toContain('accessibilityLabel="Guided reflection title"');
    expect(guidedSource).toContain('accessibilityLabel="Save title"');
    expect(guidedSource).toContain('entryTitle: nextTitle && nextTitle !== path.title ? nextTitle : undefined');
    expect(guidedSource).toContain("title: nextPayload.entryTitle?.trim() || path.title");
    expect(guidedSource).toContain('prompt: path.title');
    expect(guidedSource).toContain('GUIDED PATH · {path.title}');
    expect(logSource).toContain('const guidedTitle = guidedJourney');
    expect(logSource).toContain('guidedJourney.pathTitle');
  });

  it('stacks the guided path inside the original Moments type pill', () => {
    expect(logSource).toContain("'GUIDED REFLECTION'");
    expect(logSource).toContain('styles.guidedPromptRow');
    expect(logSource).toContain('styles.guidedStackedPromptContainer');
    expect(logSource).toContain('styles.guidedPathLabel');
    expect(logSource).toContain("'Guided reflection path'");
    expect(logSource).toContain('{guidedContext}');
  });

  it('allows the journal title to be renamed from every journey page', () => {
    expect(guidedSource).toContain('const saveActiveJourneyTitle = async () => {');
    expect(guidedSource).not.toContain('stepIndex === 0 && titleEditing');
    expect(guidedSource).not.toMatch(
      /stepIndex === 0 \? \([\s\S]*?accessibilityLabel="Rename guided reflection"/,
    );
    expect(guidedSource).toContain(
      'setTitleDraft(nextPayload.entryTitle?.trim() || selectedPath.title)',
    );
    expect(guidedSource).toMatch(
      /saveActiveJourneyTitle[\s\S]*?setPayload\(nextPayload\)[\s\S]*?setTitleEditing\(false\)/,
    );
  });

  it('keeps added reflection blocks clear of wrapped option pills', () => {
    expect(guidedSource).toMatch(/<View\s+style=\{styles\.inlineNotes\}/);
    expect(guidedSource).toContain('inlineNotes: {marginTop: 18}');
  });

  it('shows guided selections as pills in Heart Journal even when note blocks exist', () => {
    expect(logSource).toContain('const guidedSelections = guidedJourney');
    expect(logSource).toContain('styles.guidedSelectionPill');
    expect(logSource).toMatch(/guidedSelections\.length[\s\S]*?entry\.journal_blocks\?\.length/);
  });

  it('opens a focused Write block for Something else where the full-mind path offers it', () => {
    expect(guidedSource).toContain("path?.id === 'mind-feels-full'");
    expect(guidedSource).toContain("step?.id === 'space' || step?.id === 'need'");
    expect(guidedSource).toContain("value === 'Something else'");
    expect(guidedSource).toContain('`mind-feels-full:${step.id}:something-else`');
    expect(guidedSource).toContain('{selected: nextSelected}');
    expect(guidedSource).toContain("somethingElseText || 'Something else'");
    expect(guidedSource).toContain("spaceAnswer.optionalText?.trim()");
  });

  it('skips the heaviest comparison when the user selected only one item', () => {
    expect(guidedSource).toContain('const skipHeaviestStep = mindSpaceOptions.length === 1');
    expect(guidedSource).toContain('item.stepId === heaviestStepId');
    expect(guidedSource).toContain('selected: [mindSpaceOptions[0]]');
    expect(guidedSource).toContain('goToJourneyStep(2)');
    expect(guidedSource).toContain('skipHeaviestStep && stepIndex === 2 ? 0 : stepIndex - 1');
    expect(guidedSource).toContain('journeyStepPosition} of {journeyStepCount');
  });

  it('prepares the guided journey before switching away from the chooser', () => {
    expect(guidedSource).toContain('const openGuidedPath =');
    expect(guidedSource).toMatch(/openGuidedPath[\s\S]*?setPayload\([\s\S]*?setPathId\(selectedPath\.id\)/);
    expect(guidedSource).toContain('onPress={() => openGuidedPath(item)}');
  });

  it('animates a selected guided path into its reflection journey', () => {
    expect(guidedSource).toContain('journeyHeaderActionEntrance');
    expect(guidedSource).toContain('journeyContentEntrance');
    expect(guidedSource).toContain('payload.pathId !== path.id');
    expect(guidedSource).toContain('journeyHeaderActionEntranceStyle');
    expect(guidedSource).toContain('journeyContentEntranceStyle');
    expect(guidedSource).toMatch(/reflectionEditorStyles\.contentCard[\s\S]*?Animated\.View[\s\S]*?journeyContentEntranceStyle/);
    expect(guidedSource).toContain('useLayoutEffect(() => {');
    expect(guidedSource).toContain('goToJourneyStep');
    expect(guidedSource).toContain('goToJourneyStep(stepIndex + 1)');
    expect(guidedSource).toContain('skipHeaviestStep && stepIndex === 2 ? 0 : stepIndex - 1');
    expect(guidedSource).toContain('journeyTransitioning');
  });

  it('staggers guided pills, fields, and inserted note blocks independently', () => {
    expect(guidedSource).toContain('key={step.id}');
    expect(guidedSource).toContain('itemEntrances');
    expect(guidedSource).toContain('Animated.stagger(\n        55');
    expect(guidedSource).toContain('itemEntranceStyle(index)');
    expect(guidedSource).toContain('<NoteEntrance delay={noteIndex * 55}>{content}</NoteEntrance>');
    expect(guidedSource).toContain('const NoteEntrance =');
    expect(guidedSource).toContain('delay,\n      useNativeDriver: true');
    expect(guidedSource).toContain('<JournalPickerMenu');
    expect(guidedSource).toContain('animations={notePickerAnimations}');
  });

  it('keeps text-bearing pills sharp while their entrances animate', () => {
    expect(guidedSource).not.toContain('outputRange: [0.96, 1]');
    expect(guidedSource).not.toContain('outputRange: [0.97, 1]');
    expect(guidedSource).not.toContain('outputRange: [0.94, 1]');
    expect(guidedSource).not.toContain('outputRange: [0.975, 1]');
  });

  it('uses a block-first journey without built-in response inputs', () => {
    expect(guidedSource).toContain("if (step.interactionType === 'write') return null");
    expect(guidedSource).toMatch(/scripture_reflection[\s\S]*?return \([\s\S]*?styles\.scripture[\s\S]*?styles\.inputLabel/);
    expect(guidedSource).not.toContain('primaryFocusTimerRef');
    expect(guidedSource).not.toContain('onFocusTarget');
    expect(guidedSource).toMatch(/freeText:\s*\{[\s\S]*?minHeight: 44,[\s\S]*?marginBottom: 6/);
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
    expect(guidedSource).toContain('{renderInlineNotes()}');
    expect(guidedSource).not.toContain('activeNoteAnchor');
    expect(guidedSource).not.toContain('anchorId: activeNoteAnchor');
    expect(guidedSource).toContain("noteKind === 'scripture'");
    expect(guidedSource).toContain("noteKind === 'quote'");
  });

  it('keeps newly added blocks anchored while their layout and keyboard settle', () => {
    expect(guidedSource).toContain('pendingFocusNoteIdRef.current = note.id');
    expect(guidedSource).toContain('pendingFocusShouldScrollEndRef.current = shouldScrollToEnd');
    expect(guidedSource).toContain('keepScrollAtEndRef.current = shouldScrollToEnd');
    expect(guidedSource).toContain('onContentSizeChange={() => {');
    expect(guidedSource).toContain('if (keepScrollAtEndRef.current)');
    expect(guidedSource).toContain('paddingBottom: keyboardHeight + 80');
    expect(guidedSource).toContain('inlineNotesLayoutRef.current = event.nativeEvent.layout');
    expect(guidedSource).toContain('notesLayout.y + layout.y - 20');
    expect(guidedSource).toMatch(
      /noteFocusTimerRef\.current = setTimeout[\s\S]*?focusNoteInput\(noteId\)[\s\S]*?scrollToPendingNote\(\)/,
    );
  });

  it('lets guided reflection blocks move like blocks in the other editors', () => {
    expect(guidedSource).toContain("import DraggableJournalBlock from './shared/DraggableJournalBlock'");
    expect(guidedSource).toContain('resolveJournalBlockDropIndex(');
    expect(guidedSource).toContain('reorderJournalBlock(topLevelNotes, blockId, targetIndex)');
    expect(guidedSource).toContain('<DraggableJournalBlock');
    expect(guidedSource).toContain('selected={selectedNoteId === note.id}');
    expect(guidedSource).toContain('onDragEnd={handleDragNoteEnd}');
  });

  it('renders saved note types with the Sermon Notes inline block interface', () => {
    expect(guidedSource).toContain('<JournalInlineBlock');
    expect(guidedSource).toContain('tone="onDark"');
    expect(guidedSource).toMatch(/capture:\s*\{[\s\S]*?borderRadius: 14,[\s\S]*?padding: 12/);
    expect(guidedSource).toContain("configOverride={note.kind === 'text' ? undefined : config}");
    expect(guidedSource).toContain('textPlaceholder="Write here…"');
    expect(inlineBlockSource).toContain("if (block.kind === 'text' && !configOverride)");
    expect(inlineBlockSource).toContain("if (!block.text.trim()) {");
    expect(inlineBlockSource).toContain('onDelete(false);');
  });

  it('uses the same picker implementation and motion as Sermon Notes', () => {
    expect(guidedSource).toContain('notePlusRotation');
    expect(guidedSource).toContain('notePickerColorAnim');
    expect(guidedSource).toContain('Animated.stagger(\n          38');
    expect(composerSource).toContain("outputRange: ['0deg', '45deg']");
    expect(guidedSource).toContain("import {JournalComposerBar, JournalPickerMenu}");
    expect(guidedSource).toContain('Keyboard.dismiss()');
    expect(guidedSource).not.toContain('styles.menuDim');
    expect(composerSource).toContain('styles.floatingTools');
  });

  it('keeps guided content scrollable above the open note picker', () => {
    expect(guidedSource).toContain('notePickerOpen && styles.stepContentWithNotePicker');
    expect(guidedSource).toContain('stepContentWithNotePicker: {paddingBottom: 410}');
    expect(guidedSource).toContain('scrollIndicatorInsets={{bottom: notePickerOpen ? 300 : 120}}');
    expect(guidedSource).toContain('stepContent: {padding: 24, paddingBottom: 180}');
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

  it('uses the requested Guided Reflection composer colors', () => {
    expect(composerSource).toContain("backButtonOnDark: {backgroundColor: '#64796C'}");
    expect(composerSource).toContain("writeButtonOnDark: {backgroundColor: '#6B7F73'}");
    expect(composerSource).toContain("actionButtonOnDark: {backgroundColor: '#64796C'}");
    expect(composerSource).toContain("tone === 'onDark' ? '#64796C' : Colors.sage");
  });

  it('offers the full Reflection note registry without Sermon-only types', () => {
    expect(guidedSource).toContain('items={REFLECTION_NOTE_TYPES');
    expect(guidedSource).toContain('<JournalListBlock');
    expect(guidedSource).toContain('<JournalTableBlock');
    expect(guidedSource).toContain('<JournalColumnBlock');
    expect(guidedSource).toContain('<ReflectionSpecialBlock');
    expect(guidedSource).toContain("kind === 'photo'");
    expect(guidedSource).toContain('pickImageLocal()');
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

  it('lays curated questions out as two natural-height masonry columns', () => {
    expect(guidedSource).toContain('{[0, 1].map(column => (');
    expect(guidedSource).toContain('index % 2 === column');
    expect(guidedSource).toContain('style={styles.questionColumn}');
    expect(guidedSource).toContain("questionColumn: {flex: 1, minWidth: 0, gap: 10}");
    expect(guidedSource).not.toMatch(/promptCard:\s*\{[\s\S]*?minHeight: 160/);
  });

  it('stagger-reveals masonry cards and settles every card at its final position', () => {
    expect(guidedSource).toContain("section === 'questions' ? 65 : 38");
    expect(guidedSource).toContain('outputRange: [34, 0]');
    expect(guidedSource).toContain('outputRange: [0.92, 1]');
    expect(guidedSource).toContain("tension: section === 'questions' ? 72 : 90");
    expect(guidedSource).toContain("friction: section === 'questions' ? 7 : 12");
    expect(guidedSource).toContain('overshootClamping: false');
    expect(guidedSource).toContain('animations.forEach(animation => animation.setValue(1))');
    expect(guidedSource).toContain('questionRevealAnims.forEach(animation => {');
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
    expect(guidedSource).toContain("section === 'questions' ? 65 : 38");
    expect(guidedSource).toContain('tension: 90');
    expect(guidedSource).toContain('friction: 12');
    expect(guidedSource).toContain('duration: 130');
    expect(guidedSource).toContain('chooserRevealStyle');
  });

  it('plays the card entrance only when the question section is opened', () => {
    expect(guidedSource).toContain('chooserPageAnim.setValue(0)');
    expect(guidedSource).toContain('[chooserPageAnim, guideRevealAnims, pathId]');
    expect(guidedSource).toContain('changeQuestionTopic');
    expect(guidedSource).toContain('questionRevealAnims.forEach(animation => {');
    expect(guidedSource).not.toContain('topicTransitioning');
    expect(guidedSource).not.toContain('questionsForTopic(nextTopic)');
    expect(guidedSource).toContain("LAST_QUESTION_TOPIC_KEY = 'heart-journal:last-question-topic'");
    expect(guidedSource).toContain('useState<GuidedQuestionTopic>(lastQuestionTopic)');
    expect(guidedSource).toContain('AsyncStorage.getItem(LAST_QUESTION_TOPIC_KEY)');
    expect(guidedSource).toContain('AsyncStorage.setItem(LAST_QUESTION_TOPIC_KEY, nextTopic)');
    expect(guidedSource).toContain('questionRevealStyle(questionRevealAnims[index + 1])');
    expect(guidedSource).toMatch(/const questionRevealStyle = [\s\S]*?transform:/);
  });

  it('opens the selected question directly in the guided writer', () => {
    expect(guidedSource).toContain('onSelectQuestion(question.prompt, topic)');
    expect(screenSource).toContain('onSelectQuestion={(prompt, topic) => {');
    expect(screenSource).toContain('setSingleGuidedTopic(topic)');
    expect(screenSource).toContain('setSingleGuidedPrompt(prompt)');
    expect(screenSource).toContain('guidedQuestionTopicForPrompt(legacyGuidedPrompt)');
    expect(screenSource).toContain('guidedQuestionTopic={guidedQuestionTopic}');
    expect(editorSource).toContain('{guidedQuestionTopic}');
    expect(editorSource).not.toContain('PART OF LIFE');
    expect(editorSource).toContain('...(guidedQuestionTopic && {questionTopic: guidedQuestionTopic})');
    expect(editorSource).toMatch(/source === 'guided' \|\| source === 'guided_prompt'[\s\S]*?initialPrompt \|\| initialTitle/);
    expect(editorSource).toContain('const guidedPrompt = initialPrompt || initialTitle');
    expect(editorSource).toContain('setSelectedPrompt(guidedPrompt)');
    expect(editorSource).toContain("const effectiveViewMode = 'free-form' as const");
    expect(editorSource).toMatch(/source === 'guided' \|\| source === 'guided_prompt'[\s\S]*?createManagedTimeout\(\(\) => \{[\s\S]*?contentInputRef\.current\.focus\(\)/);
    expect(editorSource).toContain('<JournalComposerBar');
    expect(editorSource).toContain('<JournalPickerMenu');
    expect(editorSource).toContain('<JournalInlineBlock');
    expect(editorSource).not.toContain('contentInputRef.current.setSelection(cursor, cursor)');
    expect(guidedSource).toContain('noteFocusTimerRef');
    expect(guidedSource).toContain('noteFocusFrameRef');
    expect(guidedSource).toContain('scrollToPendingNote');
    expect(guidedSource).toContain('}, 320);');
  });

  it('does not collapse legacy Guided Prompts into Guided Reflections', () => {
    expect(screenSource).toContain('guidedEntrySource({');
    expect(screenSource).toContain("const usesGuidedPromptEditor = existingGuidedKind === 'prompt'");
    expect(screenSource).toContain("source={usesGuidedPromptEditor");
    expect(screenSource).toContain("determinedSource === 'guided_prompt' ? 'Guided Prompt' : 'Guided Reflection'");
    expect(legacyPromptModalSource).toContain("? 'guided_prompt'");
    expect(legacyPromptModalSource).toContain('source: finalSource');
    expect(legacyPromptModalSource).toContain('const dateStrKey = dateStr');
    expect(logSource).toContain("guidedEntryKind(entry) === 'prompt' ? 'GUIDED PROMPT' : 'GUIDED REFLECTION'");
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

  it('offers deletion when editing a saved structured Guided Reflection', () => {
    expect(screenSource).toContain('entryId={editingId || undefined}');
    expect(screenSource).toContain('onDelete={editingId ? handleDelete : undefined}');
    expect(guidedSource).toContain('accessibilityLabel="Delete guided reflection"');
    expect(guidedSource).toContain("'Delete Guided Reflection'");
    expect(guidedSource).toContain('<Trash2 size={22} color={Colors.sage} strokeWidth={1.5} />');
    expect(guidedSource).toMatch(/entryId && onDelete && \([\s\S]*?onPress=\{deleteSavedJourney\}/);
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
