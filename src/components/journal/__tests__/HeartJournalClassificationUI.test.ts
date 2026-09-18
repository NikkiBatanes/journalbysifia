import fs from 'fs';
import path from 'path';
import {
  HEART_JOURNAL_CLASSIFICATIONS,
  HEART_JOURNAL_WRITING_COPY,
} from '../../../types/heartJournal';

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../../', relativePath), 'utf8');

describe('Heart Journal classification UI contract', () => {
  const screenSource = readSource('screens/ReflectionEditorScreen.tsx');
  const editorSource = readSource('components/journal/ReflectionLogEditor.tsx');

  it('animates the chooser and its transition into Guided Reflection', () => {
    expect(screenSource).toContain('classificationRevealAnims');
    expect(screenSource).toContain('leaveClassificationChooser');
    expect(screenSource).toContain('Animated.stagger(');
    expect(screenSource).toContain('<BookHeart');
    expect(screenSource).toContain("'transitionEnd'");
    expect(screenSource).toContain('playClassificationEntrance');
  });

  it('opens a separate chooser for a new direct entry and skips it for existing or guided entries', () => {
    expect(screenSource).toContain('!existingReflection && !guidedMode && !journalClassification');
    expect(screenSource).toContain('if (showClassificationChooser)');
  });

  it('offers all classifications, including a custom Other choice, in a wrapping grid', () => {
    expect(HEART_JOURNAL_CLASSIFICATIONS).toHaveLength(8);
    expect(HEART_JOURNAL_CLASSIFICATIONS).toContainEqual({
      value: 'other',
      label: 'Other',
      description: 'Name your own',
    });
    expect(screenSource).toContain('testID="heart-journal-classification-grid"');
    expect(screenSource).toContain("flexWrap: 'wrap'");
    expect(screenSource).toContain('Name your journal type');
    expect(screenSource).toContain('setJournalClassification(`other:${name}`)');
    expect(editorSource).not.toMatch(/<ScrollView horizontal[^>]*>[\s\S]*HEART_JOURNAL_CLASSIFICATIONS/);
  });

  it('keeps Guided Reflection separate from the seven classifications', () => {
    expect(HEART_JOURNAL_CLASSIFICATIONS.map(item => item.label)).not.toContain('Guided Reflection');
    expect(screenSource).toContain('setGuidedFromChooser(true)');
    expect(screenSource).toContain('Choose a question to reflect on');
  });

  it('uses a compact collapsible classification control in the editor', () => {
    expect(editorSource).toContain('testID="heart-journal-classification-control"');
    expect(editorSource).toContain('setIsClassificationPickerOpen(open => !open)');
    expect(editorSource).toContain('setJournalClassification(item.value)');
    expect(editorSource).toContain("width: '48.5%'");
    expect(editorSource).not.toContain("item.value === 'letter' ? '100%'");
  });

  it('shows classification only for a direct free-form Heart Journal entry', () => {
    expect(editorSource).toContain("source === 'freeform'");
    expect(editorSource).toContain("initialEntry.type !== 'guided'");
    expect(editorSource).toContain('!selectedPrompt');
    expect(editorSource).toContain('{isDirectHeartJournal && (');
  });

  it('does not retain the legacy guided-question picker in the writing editor', () => {
    expect(editorSource).not.toContain('accessibilityLabel="Guided Reflection"');
    expect(editorSource).not.toContain('<ReflectionQuestionCard');
    expect(editorSource).not.toContain("setViewMode('guided')");
    expect(editorSource).toContain("const effectiveViewMode = 'free-form' as const");
  });

  it('provides the approved writing copy for every classification', () => {
    expect(HEART_JOURNAL_WRITING_COPY).toEqual({
      thoughts: { title: 'Name this thought...', body: "What's on your mind?" },
      notes: { title: 'Add a title...', body: 'What do you want to keep?' },
      reflection: { title: 'Name your reflection...', body: 'Take your time. What are you processing?' },
      brain_dump: { title: "What's filling your head?", body: "Get it all out. It doesn't have to be organized." },
      lesson: { title: 'What are you learning?', body: "Write down what you're beginning to see..." },
      idea: { title: 'Name your idea...', body: 'Explore it here...' },
      letter: { title: 'Who or what is this for?', body: 'Write what you want to say...' },
      other: { title: 'Name this entry...', body: "What's on your heart?" },
    });
    expect(editorSource).toContain('placeholder={titlePlaceholder}');
    expect(editorSource).toContain('textPlaceholder={bodyPlaceholder}');
    expect(editorSource).toContain('freeText: [s.freeText, {fontFamily: fontFamilyRegular}]');
    expect(editorSource).toContain('captureInput: [s.captureInput, {fontFamily: fontFamilyRegular}]');
    expect(editorSource).toMatch(/freeText:\s*\{[\s\S]*?minHeight: 44,[\s\S]*?marginBottom: 6/);
    expect(editorSource).toContain('{paddingBottom: notePickerOpen ? 410 : 180}');
    expect(editorSource).toContain('editorScrollRef.current?.scrollToEnd({animated: true})');
    expect(editorSource).toContain('pendingFocusBlockIdRef.current = block.id');
    expect(editorSource).toContain('blockInputRefs.current.get(blockId)?.focus()');
    expect(editorSource).toContain('}, 320);');
  });

  it('allows a Brain Dump with body content and no title', () => {
    expect(editorSource).toContain("journalClassification === 'brain_dump'");
    expect(editorSource).toContain('(!canSaveWithoutTitle && !newEntry.title.trim())');
  });

  it('uses the selected classification, including a custom Other name, in the success title', () => {
    expect(screenSource).toContain("savedClassification === 'notes'");
    expect(screenSource).toContain('heartJournalClassificationLabel(savedClassification)');
    expect(screenSource).toContain("title: `${successLabel} ${editingId ? 'Updated' : 'Saved'}`");
  });

  it('does not persist the legacy Thoughts display fallback automatically', () => {
    expect(editorSource).toMatch(/heartJournalClassificationLabel\(\s*journalClassification,?\s*\) \|\| 'Thoughts'/);
    expect(editorSource).toMatch(/\.\.\.\(journalClassification && \{\s*journalClassification,?\s*\}\)/);
  });

  it('keeps header icons aligned with their touch targets', () => {
    expect(editorSource).not.toContain('fill={Colors.sage}');
    expect(editorSource).not.toContain('iconsSlideAnim');
    expect(editorSource).toContain('accessibilityLabel="Write reflection"');
    expect(editorSource).not.toContain('accessibilityLabel="Guided Reflection"');
    expect(editorSource).toContain('accessibilityLabel="Delete reflection"');
  });

  it('treats canonical entry identity as edit mode even when its content is empty', () => {
    expect(editorSource).toContain('const isEditing = Boolean(entryId)');
    expect(editorSource).toContain('{isEditing && onDelete && (');
  });
});
