import {
  createJournalBlock,
  type JournalBlock,
  type JournalBlockKind,
} from './journalBlocks';

export const insertJournalBlock = (
  blocks: JournalBlock[],
  kind: JournalBlockKind,
  id?: string,
) => {
  const block = createJournalBlock(kind, id);
  return {block, blocks: [...blocks, block]};
};

export const updateJournalBlock = (
  blocks: JournalBlock[],
  id: string,
  changes: Partial<JournalBlock>,
) => blocks.map(block => (block.id === id ? {...block, ...changes} : block));

export const removeJournalBlock = (blocks: JournalBlock[], id: string) =>
  blocks.filter(block => block.id !== id);
