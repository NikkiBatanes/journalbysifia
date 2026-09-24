import React from 'react';
import type {TextInput} from 'react-native';

import ReflectionSpecialBlock from '../ReflectionSpecialBlock';
import {JournalInlineBlock} from './JournalInlineBlock';
import {JournalAdvancedBlockEditor} from './JournalAdvancedBlockEditor';
import {JournalListBlock} from './JournalListBlock';
import {JournalTableBlock} from './JournalTableBlock';
import {
  NOTE_BLOCK_REGISTRY,
  type JournalBlock,
  type JournalBlockConfig,
} from './journalBlocks';

export type JournalBlockEditorProps = {
  block: JournalBlock;
  styles: any;
  registerInput: (input: TextInput | null) => void;
  onChange: (changes: Partial<JournalBlock>) => void;
  onDelete: (keepKeyboard?: boolean) => void;
  onFocus?: () => void;
  onLayout?: (layout: {y: number; height: number}) => void;
  onCreateNextAction?: () => void;
  renderScripture?: () => React.ReactNode;
  configOverride?: JournalBlockConfig;
  tone?: 'default' | 'onDark';
  textPlaceholder?: string;
  bibleVersion?: string;
  onCreateSection?: (title: string) => void;
};

/**
 * The canonical editable renderer for every reusable note-block family.
 * Layout containers (columns) and Session-only advanced blocks stay with their
 * owning composer, while all common block behavior is dispatched by registry.
 */
export const JournalBlockEditor = ({
  block,
  styles,
  registerInput,
  onChange,
  onDelete,
  onFocus,
  onLayout,
  onCreateNextAction,
  renderScripture,
  configOverride,
  tone = 'default',
  textPlaceholder,
  bibleVersion,
  onCreateSection,
}: JournalBlockEditorProps) => {
  const definition = NOTE_BLOCK_REGISTRY[block.kind];

  if (definition.renderMode === 'list') {
    return (
      <JournalListBlock
        kind={block.kind as 'bullets' | 'numbered'}
        title={block.text}
        points={block.points}
        tone={tone}
        onFocus={onFocus}
        onChangeTitle={text => onChange({text})}
        onChangePoints={points => onChange({points})}
        onDelete={() => onDelete()}
        registerInput={registerInput}
      />
    );
  }

  if (definition.renderMode === 'table') {
    return (
      <JournalTableBlock
        rows={block.tableRows}
        cellAlignments={block.tableCellAlignments}
        editing={block.tableEditing}
        tone={tone}
        onFocus={onFocus}
        onChangeRows={(tableRows, tableCellAlignments) =>
          onChange({
            tableRows,
            ...(tableCellAlignments ? {tableCellAlignments} : {}),
          })
        }
        onChangeCellAlignments={tableCellAlignments =>
          onChange({tableCellAlignments})
        }
        onChangeEditing={tableEditing => onChange({tableEditing})}
        onDelete={() => onDelete()}
        registerInput={registerInput}
      />
    );
  }

  if (definition.renderMode === 'special') {
    return (
      <ReflectionSpecialBlock
        block={block}
        tone={tone}
        onFocus={onFocus}
        onChange={changes => onChange(changes)}
        onDelete={() => onDelete()}
        onCreateNextAction={onCreateNextAction}
        registerInput={registerInput}
      />
    );
  }

  if (definition.renderMode === 'plain' || definition.renderMode === 'inline') {
    return (
      <JournalInlineBlock
        block={block}
        configOverride={configOverride}
        tone={tone}
        textPlaceholder={textPlaceholder}
        styles={styles}
        registerInput={registerInput}
        onChangeText={text => onChange({text})}
        onChangeSecondary={secondary => onChange({secondary})}
        onFocus={onFocus}
        onLayout={onLayout}
        onDelete={onDelete}
        renderScripture={renderScripture}
      />
    );
  }

  if (definition.renderMode === 'advanced') {
    return (
      <JournalAdvancedBlockEditor
        block={block}
        tone={tone}
        bibleVersion={bibleVersion}
        registerInput={registerInput}
        onChange={onChange}
        onDelete={() => onDelete()}
        onFocus={onFocus}
        onLayout={onLayout}
        onCreateSection={onCreateSection}
      />
    );
  }

  return null;
};

export default JournalBlockEditor;
