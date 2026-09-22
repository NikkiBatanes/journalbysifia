import {
  createJournalBlock,
  type JournalBlock,
  type JournalBlockKind,
} from './journalBlocks';

export const insertJournalBlock = (
  blocks: JournalBlock[],
  kind: JournalBlockKind,
  id?: string,
  afterId?: string | null,
) => {
  const block = createJournalBlock(kind, id);
  const afterIndex = afterId
    ? blocks.findIndex(item => item.id === afterId)
    : -1;
  if (afterIndex < 0) {
    return {block, blocks: [...blocks, block]};
  }
  const nextBlocks = [...blocks];
  nextBlocks.splice(afterIndex + 1, 0, block);
  return {block, blocks: nextBlocks};
};

export const updateJournalBlock = (
  blocks: JournalBlock[],
  id: string,
  changes: Partial<JournalBlock>,
) => blocks.map(block => (block.id === id ? {...block, ...changes} : block));

export const removeJournalBlock = (blocks: JournalBlock[], id: string) =>
  blocks.filter(block => block.id !== id);

export const reorderJournalBlock = <T extends {id: string}>(
  blocks: T[],
  id: string,
  toIndex: number,
): T[] => {
  const fromIndex = blocks.findIndex(block => block.id === id);
  if (fromIndex < 0 || blocks.length < 2) {
    return blocks;
  }
  const boundedIndex = Math.max(0, Math.min(toIndex, blocks.length - 1));
  if (fromIndex === boundedIndex) {
    return blocks;
  }
  const nextBlocks = [...blocks];
  const [moved] = nextBlocks.splice(fromIndex, 1);
  nextBlocks.splice(boundedIndex, 0, moved);
  return nextBlocks;
};

export const resolveJournalBlockDropIndex = <T extends {id: string}>(
  blocks: T[],
  layouts: ReadonlyMap<string, {y: number; height: number}>,
  id: string,
  deltaY: number,
): number => {
  const fromIndex = blocks.findIndex(block => block.id === id);
  const sourceLayout = layouts.get(id);
  if (fromIndex < 0 || !sourceLayout || Math.abs(deltaY) < 12) {
    return fromIndex;
  }

  const movingCenter = sourceLayout.y + sourceLayout.height / 2 + deltaY;
  let targetIndex = fromIndex;
  let nearestDistance = Number.POSITIVE_INFINITY;
  blocks.forEach((block, index) => {
    const layout = layouts.get(block.id);
    if (!layout) {return;}
    const distance = Math.abs(layout.y + layout.height / 2 - movingCenter);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      targetIndex = index;
    }
  });
  return targetIndex;
};
